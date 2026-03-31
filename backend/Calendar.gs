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
   * Find events on the designated calendar that represent available booking windows.
   * Two detection paths:
   *   1. Title matches the AVAILABILITY_PATTERN (e.g. "Jeremy office hours")
   *   2. Title matches a FREE_EVENT_PATTERNS entry AND the event is marked "free"
   *      (transparency = "transparent" in Google Calendar)
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
    var freePatterns = getFreeEventPatterns();

    for (var i = 0; i < events.length; i++) {
      var title = events[i].getTitle().toLowerCase();

      // Path 1: title matches the main availability pattern
      if (title.indexOf(patternLower) !== -1) {
        windows.push({
          start: events[i].getStartTime().getTime(),
          end: events[i].getEndTime().getTime(),
        });
        continue;
      }

      // Path 2: title matches a free-event pattern AND event is marked "free"
      if (freePatterns.length > 0 && matchesFreePattern(title, freePatterns)) {
        if (isEventFree(calendarId, events[i])) {
          windows.push({
            start: events[i].getStartTime().getTime(),
            end: events[i].getEndTime().getTime(),
          });
        }
      }
    }

    return windows;
  }

  /**
   * Parse FREE_EVENT_PATTERNS Script Property into an array of lowercase patterns.
   */
  function getFreeEventPatterns() {
    var raw = Config.get('FREE_EVENT_PATTERNS');
    if (!raw) return [];
    try {
      var patterns = JSON.parse(raw);
      if (!Array.isArray(patterns)) return [];
      return patterns.map(function (p) { return p.toLowerCase(); });
    } catch (e) {
      return [];
    }
  }

  /**
   * Check if an event title matches any of the free-event patterns.
   */
  function matchesFreePattern(titleLower, freePatterns) {
    for (var i = 0; i < freePatterns.length; i++) {
      if (titleLower.indexOf(freePatterns[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Check if an event is marked as "free" (transparent) using the Calendar Advanced Service.
   * CalendarApp doesn't expose transparency, so we use Calendar.Events.get().
   */
  function isEventFree(calendarId, event) {
    try {
      var eventId = event.getId().replace('@google.com', '');
      var resource = Calendar.Events.get(calendarId, eventId);
      return resource.transparency === 'transparent';
    } catch (e) {
      Logger.log('Could not check transparency for event: ' + e.message);
      return false;
    }
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

    // Get configured conflict calendars (only these are checked for busy times)
    var conflictIds = getConflictCalendarIds(designatedCalId);

    // Use Events.list instead of FreeBusy to correctly handle transparency.
    // FreeBusy reports all-day events as busy even when marked "free".
    for (var c = 0; c < conflictIds.length; c++) {
      busyTimes = busyTimes.concat(
        getConflictCalendarBusyTimes(conflictIds[c], startDate, endDate)
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
    var freePatterns = getFreeEventPatterns();

    for (var i = 0; i < events.length; i++) {
      var title = events[i].getTitle().toLowerCase();
      // Skip availability window events — they define free time, not busy time
      if (title.indexOf(patternLower) !== -1) continue;
      // Skip free-pattern events that are marked as "free" — they also define available time
      if (freePatterns.length > 0 && matchesFreePattern(title, freePatterns) && isEventFree(calendarId, events[i])) continue;
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
  /**
   * Parse the CONFLICT_CALENDAR_IDS Script Property.
   * Returns array of calendar IDs to check for conflicts (excluding designated).
   */
  function getConflictCalendarIds(designatedCalId) {
    var raw = Config.get('CONFLICT_CALENDAR_IDS');
    if (!raw) return [];

    try {
      var ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return [];
      return ids.filter(function (id) { return id !== designatedCalId; });
    } catch (e) {
      // Try comma-separated fallback
      return raw.split(',').map(function (s) { return s.trim(); })
        .filter(function (id) { return id && id !== designatedCalId; });
    }
  }

  /**
   * Get busy times from a conflict calendar using Events.list.
   * Skips events marked as "free" (transparent) and declined events.
   */
  function getConflictCalendarBusyTimes(calendarId, startDate, endDate) {
    var busyTimes = [];
    try {
      var pageToken = null;
      do {
        var params = {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          maxResults: 250,
        };
        if (pageToken) params.pageToken = pageToken;

        var response = Calendar.Events.list(calendarId, params);
        var items = response.items || [];

        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          // Skip events marked as "free" (transparent)
          if (item.transparency === 'transparent') continue;
          // Skip cancelled events
          if (item.status === 'cancelled') continue;
          // Skip all-day events (have start.date instead of start.dateTime)
          if (!item.start.dateTime) continue;
          // Skip events the user has declined
          if (item.attendees) {
            var selfAttendee = item.attendees.filter(function (a) { return a.self; })[0];
            if (selfAttendee && selfAttendee.responseStatus === 'declined') continue;
          }

          var start = new Date(item.start.dateTime).getTime();
          var end = new Date(item.end.dateTime).getTime();
          // Skip events spanning 24h+ (all-day events expanded with dateTime by Advanced Service)
          if (end - start >= 24 * 60 * 60 * 1000) continue;

          busyTimes.push({ start: start, end: end });
        }

        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (e) {
      Logger.log('Events.list failed for ' + calendarId + ': ' + e.message);
      // Fall back to CalendarApp scan, but skip all-day and transparent events
      var calendar = CalendarApp.getCalendarById(calendarId);
      if (calendar) {
        var events = calendar.getEvents(startDate, endDate);
        for (var j = 0; j < events.length; j++) {
          var myStatus = events[j].getMyStatus();
          if (myStatus === CalendarApp.GuestStatus.NO) continue;
          var evStart = events[j].getStartTime().getTime();
          var evEnd = events[j].getEndTime().getTime();
          // Skip all-day events (24h+ duration)
          if (evEnd - evStart >= 24 * 60 * 60 * 1000) continue;
          // Skip events marked as free via Advanced Service
          try {
            var evId = events[j].getId().replace('@google.com', '');
            var resource = Calendar.Events.get(calendarId, evId);
            if (resource.transparency === 'transparent') continue;
          } catch (ignored) {}
          busyTimes.push({ start: evStart, end: evEnd });
        }
      }
    }
    return busyTimes;
  }

  function getAllBusyTimesFallback(startDate, endDate, excludeCalId, onlyCalIds) {
    var busyTimes = [];

    for (var i = 0; i < onlyCalIds.length; i++) {
      var calendar = CalendarApp.getCalendarById(onlyCalIds[i]);
      if (!calendar) continue;

      var events = calendar.getEvents(startDate, endDate);
      for (var j = 0; j < events.length; j++) {
        var myStatus = events[j].getMyStatus();
        if (myStatus === CalendarApp.GuestStatus.NO) continue;

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

  function debug(startDate, endDate) {
    var calendarId = Config.get('CALENDAR_ID');
    var pattern = Config.get('AVAILABILITY_PATTERN');
    var calendar = CalendarApp.getCalendarById(calendarId);
    var calName = calendar ? calendar.getName() : 'NOT FOUND';

    var allEvents = calendar ? calendar.getEvents(startDate, endDate) : [];
    var eventList = allEvents.map(function (ev) {
      return {
        title: ev.getTitle(),
        start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString(),
      };
    });

    var windows = findAvailabilityWindows(calendarId, pattern, startDate, endDate);

    var allCalendars = CalendarApp.getAllCalendars();
    var calIds = allCalendars.map(function (c) { return c.getId() + ' (' + c.getName() + ')'; });

    // Separate busy time sources for debugging
    var designatedBusy = getDesignatedCalendarBusyTimes(calendarId, pattern, startDate, endDate);
    var conflictIds = getConflictCalendarIds(calendarId);
    var conflictBusy = [];
    for (var ci = 0; ci < conflictIds.length; ci++) {
      var calBusy = getConflictCalendarBusyTimes(conflictIds[ci], startDate, endDate);
      calBusy.forEach(function (b) { b.source = conflictIds[ci]; });
      conflictBusy = conflictBusy.concat(calBusy);
    }

    var busyTimes = getAllBusyTimes(startDate, endDate);
    var freeWindows = subtractBusyTimes(windows, busyTimes);
    var slots = generateSlots(freeWindows, 15);

    var freePatterns = getFreeEventPatterns();

    return {
      calendarId: calendarId,
      calendarName: calName,
      pattern: pattern,
      freeEventPatterns: freePatterns,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      totalEventsInRange: eventList.length,
      events: eventList,
      availabilityWindowsFound: windows.length,
      windows: windows.map(function (w) {
        return { start: new Date(w.start).toISOString(), end: new Date(w.end).toISOString() };
      }),
      designatedBusy: designatedBusy.map(function (b) {
        return { start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
      }),
      conflictBusy: conflictBusy.map(function (b) {
        return { source: b.source, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
      }),
      conflictCalendarIds: conflictIds,
      busyTimesCount: busyTimes.length,
      busyTimes: busyTimes.map(function (b) {
        return { start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
      }),
      freeWindowsAfterSubtract: freeWindows.length,
      freeWindows: freeWindows.map(function (w) {
        return { start: new Date(w.start).toISOString(), end: new Date(w.end).toISOString() };
      }),
      slotsGenerated: slots.length,
      allCalendarCount: allCalendars.length,
      allCalendarIds: calIds,
    };
  }

  return {
    getAvailableSlots: getAvailableSlots,
    debug: debug,
  };
})();
