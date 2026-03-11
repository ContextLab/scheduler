/**
 * CalendarService — availability detection and slot generation.
 * Finds availability windows by title pattern match on the designated calendar,
 * then checks all calendars for conflicts to produce bookable slots.
 */

var CalendarService = (function () {

  /**
   * Get available booking slots within a date range for a given duration.
   * 1. Find "availability window" events on the designated calendar (by title pattern)
   * 2. Subtract busy times from ALL calendars
   * 3. Split remaining free windows into slots of the requested duration
   * 4. Enforce min_notice_hours and max_advance_days
   *
   * @param {Date} startDate - range start
   * @param {Date} endDate - range end
   * @param {number} durationMinutes - slot duration (15, 30, 45, or 60)
   * @returns {Array<{start: string, end: string}>} available slots as ISO strings
   */
  function getAvailableSlots(startDate, endDate, durationMinutes) {
    var calendarId = Config.get('CALENDAR_ID');
    var pattern = Config.get('AVAILABILITY_PATTERN');
    var minNoticeHours = parseInt(Config.get('MIN_NOTICE_HOURS'), 10) || 12;
    var maxAdvanceDays = parseInt(Config.get('MAX_ADVANCE_DAYS'), 10) || 90;

    // Enforce max advance window
    var maxDate = new Date(Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000);
    if (endDate > maxDate) {
      endDate = maxDate;
    }

    // Enforce min notice
    var earliest = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000);
    if (startDate < earliest) {
      startDate = earliest;
    }

    if (startDate >= endDate) {
      return [];
    }

    // Step 1: Find availability windows on the designated calendar
    var windows = findAvailabilityWindows(calendarId, pattern, startDate, endDate);
    if (windows.length === 0) {
      return [];
    }

    // Step 2: Get busy times from ALL calendars
    var busyTimes = getAllBusyTimes(startDate, endDate);

    // Step 3: Subtract busy times from availability windows
    var freeWindows = subtractBusyTimes(windows, busyTimes);

    // Step 4: Split into slots of the requested duration
    var slots = generateSlots(freeWindows, durationMinutes);

    // Step 5: Filter out slots before min notice threshold
    slots = slots.filter(function (slot) {
      return new Date(slot.start) >= earliest;
    });

    return slots;
  }

  /**
   * Find events on the designated calendar whose title matches the availability pattern.
   */
  function findAvailabilityWindows(calendarId, pattern, startDate, endDate) {
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      Logger.log('Calendar not found: ' + calendarId);
      return [];
    }

    var events = calendar.getEvents(startDate, endDate);
    var windows = [];
    var patternLower = pattern.toLowerCase();

    for (var i = 0; i < events.length; i++) {
      var title = events[i].getTitle().toLowerCase();
      if (title.indexOf(patternLower) !== -1) {
        windows.push({
          start: events[i].getStartTime().getTime(),
          end: events[i].getEndTime().getTime(),
        });
      }
    }

    return windows;
  }

  /**
   * Get busy times from ALL calendars the user has access to,
   * using the Calendar Advanced Service (freeBusy query).
   */
  function getAllBusyTimes(startDate, endDate) {
    var busyTimes = [];
    var designatedCalId = Config.get('CALENDAR_ID');
    var pattern = Config.get('AVAILABILITY_PATTERN');

    // Add busy times from the designated calendar (non-availability events only)
    busyTimes = busyTimes.concat(
      getDesignatedCalendarBusyTimes(designatedCalId, pattern, startDate, endDate)
    );

    try {
      // Use Calendar Advanced Service for freeBusy query on OTHER calendars
      var calendars = CalendarApp.getAllCalendars();
      var calendarIds = calendars
        .filter(function (cal) { return cal.getId() !== designatedCalId; })
        .map(function (cal) { return { id: cal.getId() }; });

      if (calendarIds.length === 0) {
        return mergePeriods(busyTimes);
      }

      var request = {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: calendarIds,
      };

      var response = Calendar.Freebusy.query(request);

      if (response && response.calendars) {
        for (var calId in response.calendars) {
          var calData = response.calendars[calId];
          if (calData.busy) {
            for (var j = 0; j < calData.busy.length; j++) {
              busyTimes.push({
                start: new Date(calData.busy[j].start).getTime(),
                end: new Date(calData.busy[j].end).getTime(),
              });
            }
          }
        }
      }
    } catch (e) {
      Logger.log('FreeBusy query failed, falling back to event scan: ' + e.message);
      // Fallback: scan events on all non-designated calendars
      busyTimes = busyTimes.concat(
        getAllBusyTimesFallback(startDate, endDate, designatedCalId)
      );
    }

    // Sort and merge overlapping busy periods
    return mergePeriods(busyTimes);
  }

  /**
   * Get busy times from the designated calendar, excluding availability window events.
   */
  function getDesignatedCalendarBusyTimes(calendarId, pattern, startDate, endDate) {
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return [];

    var events = calendar.getEvents(startDate, endDate);
    var busyTimes = [];
    var patternLower = pattern.toLowerCase();

    for (var i = 0; i < events.length; i++) {
      var title = events[i].getTitle().toLowerCase();
      // Skip availability window events — they define free time, not busy time
      if (title.indexOf(patternLower) !== -1) continue;
      // Skip events the user has declined
      var myStatus = events[i].getMyStatus();
      if (myStatus === CalendarApp.GuestStatus.NO) continue;

      busyTimes.push({
        start: events[i].getStartTime().getTime(),
        end: events[i].getEndTime().getTime(),
      });
    }

    return busyTimes;
  }

  /**
   * Fallback: scan events on all calendars when Advanced Service unavailable.
   */
  function getAllBusyTimesFallback(startDate, endDate, excludeCalId) {
    var calendars = CalendarApp.getAllCalendars();
    var busyTimes = [];

    for (var i = 0; i < calendars.length; i++) {
      // Skip the designated calendar (handled separately)
      if (excludeCalId && calendars[i].getId() === excludeCalId) continue;

      var events = calendars[i].getEvents(startDate, endDate);
      for (var j = 0; j < events.length; j++) {
        // Skip events the user has declined
        var myStatus = events[j].getMyStatus();
        if (myStatus === CalendarApp.GuestStatus.NO) {
          continue;
        }
        busyTimes.push({
          start: events[j].getStartTime().getTime(),
          end: events[j].getEndTime().getTime(),
        });
      }
    }

    return busyTimes;
  }

  /**
   * Merge overlapping time periods into non-overlapping intervals.
   */
  function mergePeriods(periods) {
    if (periods.length === 0) return [];

    periods.sort(function (a, b) { return a.start - b.start; });

    var merged = [periods[0]];
    for (var i = 1; i < periods.length; i++) {
      var last = merged[merged.length - 1];
      if (periods[i].start <= last.end) {
        last.end = Math.max(last.end, periods[i].end);
      } else {
        merged.push(periods[i]);
      }
    }
    return merged;
  }

  /**
   * Subtract busy times from availability windows.
   * Returns remaining free windows.
   */
  function subtractBusyTimes(windows, busyTimes) {
    var free = [];

    for (var w = 0; w < windows.length; w++) {
      var remaining = [{ start: windows[w].start, end: windows[w].end }];

      for (var b = 0; b < busyTimes.length; b++) {
        var newRemaining = [];
        for (var r = 0; r < remaining.length; r++) {
          var seg = remaining[r];
          var busy = busyTimes[b];

          if (busy.end <= seg.start || busy.start >= seg.end) {
            // No overlap
            newRemaining.push(seg);
          } else {
            // Overlap — split around the busy time
            if (busy.start > seg.start) {
              newRemaining.push({ start: seg.start, end: busy.start });
            }
            if (busy.end < seg.end) {
              newRemaining.push({ start: busy.end, end: seg.end });
            }
          }
        }
        remaining = newRemaining;
      }

      free = free.concat(remaining);
    }

    return free;
  }

  /**
   * Split free windows into discrete slots of the given duration.
   */
  function generateSlots(freeWindows, durationMinutes) {
    var durationMs = durationMinutes * 60 * 1000;
    var slots = [];

    for (var i = 0; i < freeWindows.length; i++) {
      var window = freeWindows[i];
      var slotStart = window.start;

      while (slotStart + durationMs <= window.end) {
        slots.push({
          start: new Date(slotStart).toISOString(),
          end: new Date(slotStart + durationMs).toISOString(),
        });
        slotStart += durationMs;
      }
    }

    return slots;
  }

  return {
    getAvailableSlots: getAvailableSlots,
  };
})();
