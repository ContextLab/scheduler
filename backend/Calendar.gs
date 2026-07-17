/**
 * CalendarService — availability detection and slot generation.
 * Finds availability windows by title pattern match on the designated calendar,
 * then checks all calendars for conflicts to produce bookable slots.
 *
 * Performance: uses Calendar.Events.list() (Advanced Service) instead of
 * CalendarApp.getEvents() to get transparency in a single API call per calendar.
 * Total API calls per getAvailableSlots request: 1 (designated) + N (conflict calendars).
 */

var CalendarService = (function () {

  /**
   * Get available booking slots within a date range for a given duration.
   */
  function getAvailableSlots(startDate, endDate, durationMinutes) {
    var minNoticeHours = parseInt(Config.get('MIN_NOTICE_HOURS'), 10) || 12;
    var maxAdvanceDays = parseInt(Config.get('MAX_ADVANCE_DAYS'), 10) || 90;

    var maxDate = new Date(Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000);
    if (endDate > maxDate) endDate = maxDate;

    var earliest = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000);
    if (startDate < earliest) startDate = earliest;

    if (startDate >= endDate) return [];

    var freeWindows = computeFreeWindows(startDate, endDate);
    if (freeWindows.length === 0) return [];

    var slots = generateSlots(freeWindows, durationMinutes);

    slots = slots.filter(function (slot) {
      return new Date(slot.start) >= earliest;
    });

    return slots;
  }

  /**
   * Compute the free availability windows within [startDate, endDate]:
   * the designated calendar's availability windows minus all busy times
   * (designated + conflict calendars). Shared by getAvailableSlots (which
   * chops these into a slot grid) and isRangeAvailable (which tests
   * containment of an exact requested interval).
   */
  function computeFreeWindows(startDate, endDate) {
    var calendarId = Config.get('CALENDAR_ID');
    var pattern = Config.get('AVAILABILITY_PATTERN');

    // Single fetch of designated calendar events (1 API call)
    var designatedEvents = listEvents(calendarId, startDate, endDate);

    // Partition into availability windows and busy times in one pass
    var patternLower = pattern.toLowerCase();
    var freePatterns = getFreeEventPatterns();
    var partition = partitionDesignatedEvents(designatedEvents, patternLower, freePatterns);

    if (partition.windows.length === 0) return [];

    // Get busy times from conflict calendars (1 API call each)
    var conflictIds = getConflictCalendarIds(calendarId);
    var allBusy = partition.busy.slice(); // start with designated busy
    for (var c = 0; c < conflictIds.length; c++) {
      allBusy = allBusy.concat(getConflictCalendarBusyTimes(conflictIds[c], startDate, endDate));
    }
    var mergedBusy = mergePeriods(allBusy);

    return subtractBusyTimes(partition.windows, mergedBusy);
  }

  /**
   * Is the exact interval [startDate, endDate] bookable?
   *
   * Returns true iff the interval is fully contained in a single free
   * availability window and satisfies min-notice / max-advance bounds. This is
   * the booking re-check: it validates the *requested interval*, not a position
   * on a pre-generated slot grid. (The previous re-check regenerated a
   * duration-stepped grid anchored to the window start and demanded an exact
   * match, so any interval offset from that grid — e.g. a client-merged 45-min
   * slot at 10:30 — was wrongly rejected as SLOT_TAKEN.)
   */
  function isRangeAvailable(startDate, endDate) {
    var minNoticeHours = parseInt(Config.get('MIN_NOTICE_HOURS'), 10) || 12;
    var maxAdvanceDays = parseInt(Config.get('MAX_ADVANCE_DAYS'), 10) || 90;

    var earliest = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000);
    var maxDate = new Date(Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000);

    if (startDate >= endDate) return false;
    if (startDate < earliest) return false;
    if (endDate > maxDate) return false;

    var s = startDate.getTime();
    var e = endDate.getTime();

    // Pad the fetch window slightly so the containing availability window and
    // any straddling busy events are captured regardless of API boundary rules.
    var freeWindows = computeFreeWindows(
      new Date(s - 60 * 1000), new Date(e + 60 * 1000));

    for (var i = 0; i < freeWindows.length; i++) {
      if (freeWindows[i].start <= s && freeWindows[i].end >= e) return true;
    }
    return false;
  }

  /**
   * Fetch all events from a calendar using the Advanced Service (Calendar.Events.list).
   * Returns raw event resources with transparency, status, attendees, etc.
   * Single API call (paginated if >250 events).
   */
  function listEvents(calendarId, startDate, endDate) {
    var allItems = [];
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
        allItems = allItems.concat(response.items || []);
        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (e) {
      Logger.log('Calendar.Events.list failed for ' + calendarId + ': ' + e.message);
      // Fallback to CalendarApp
      var calendar = CalendarApp.getCalendarById(calendarId);
      if (calendar) {
        var events = calendar.getEvents(startDate, endDate);
        allItems = events.map(function (ev) {
          return {
            summary: ev.getTitle(),
            start: { dateTime: ev.getStartTime().toISOString() },
            end: { dateTime: ev.getEndTime().toISOString() },
            status: 'confirmed',
            transparency: undefined, // CalendarApp doesn't expose transparency
            _isAllDay: (ev.getEndTime().getTime() - ev.getStartTime().getTime()) >= 24 * 60 * 60 * 1000,
          };
        });
      }
    }
    return allItems;
  }

  /**
   * Partition designated calendar events into availability windows and busy times.
   * Single pass over the event list — no per-event API calls needed since
   * listEvents() already provides transparency on each item.
   */
  function partitionDesignatedEvents(events, patternLower, freePatterns) {
    var windows = [];
    var busy = [];

    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      if (item.status === 'cancelled') continue;

      var title = (item.summary || '').toLowerCase();
      var isAllDay = !item.start.dateTime;
      var isFree = item.transparency === 'transparent';

      // Skip all-day events entirely
      if (isAllDay || item._isAllDay) continue;

      var start = new Date(item.start.dateTime).getTime();
      var end = new Date(item.end.dateTime).getTime();

      // Skip 24h+ events (all-day events expanded with dateTime)
      if (end - start >= 24 * 60 * 60 * 1000) continue;

      // Path 1: title matches the main availability pattern → availability window
      if (title.indexOf(patternLower) !== -1) {
        windows.push({ start: start, end: end });
        continue;
      }

      // Path 2: title matches a free-event pattern AND event is marked "free"
      if (freePatterns.length > 0 && matchesFreePattern(title, freePatterns) && isFree) {
        windows.push({ start: start, end: end });
        continue;
      }

      // Check if user declined
      if (item.attendees) {
        var declined = false;
        for (var a = 0; a < item.attendees.length; a++) {
          if (item.attendees[a].self && item.attendees[a].responseStatus === 'declined') {
            declined = true;
            break;
          }
        }
        if (declined) continue;
      }

      // Everything else is busy time
      busy.push({ start: start, end: end });
    }

    return { windows: windows, busy: busy };
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
   * Get busy times from ALL calendars.
   */
  function getAllBusyTimes(startDate, endDate) {
    var calendarId = Config.get('CALENDAR_ID');
    var pattern = Config.get('AVAILABILITY_PATTERN');
    var freePatterns = getFreeEventPatterns();

    // Single fetch of designated calendar events
    var designatedEvents = listEvents(calendarId, startDate, endDate);
    var partition = partitionDesignatedEvents(designatedEvents, pattern.toLowerCase(), freePatterns);
    var busyTimes = partition.busy.slice();

    // Conflict calendars
    var conflictIds = getConflictCalendarIds(calendarId);
    for (var c = 0; c < conflictIds.length; c++) {
      busyTimes = busyTimes.concat(
        getConflictCalendarBusyTimes(conflictIds[c], startDate, endDate)
      );
    }

    return mergePeriods(busyTimes);
  }

  /**
   * Parse the CONFLICT_CALENDAR_IDS Script Property.
   */
  function getConflictCalendarIds(designatedCalId) {
    var raw = Config.get('CONFLICT_CALENDAR_IDS');
    if (!raw) return [];
    try {
      var ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return [];
      return ids.filter(function (id) { return id !== designatedCalId; });
    } catch (e) {
      return raw.split(',').map(function (s) { return s.trim(); })
        .filter(function (id) { return id && id !== designatedCalId; });
    }
  }

  /**
   * Get busy times from a conflict calendar using Events.list.
   * Skips transparent, cancelled, all-day, and declined events.
   */
  function getConflictCalendarBusyTimes(calendarId, startDate, endDate) {
    var events = listEvents(calendarId, startDate, endDate);
    var busyTimes = [];

    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      if (item.transparency === 'transparent') continue;
      if (item.status === 'cancelled') continue;
      if (!item.start.dateTime) continue;
      if (item._isAllDay) continue;

      if (item.attendees) {
        var declined = false;
        for (var a = 0; a < item.attendees.length; a++) {
          if (item.attendees[a].self && item.attendees[a].responseStatus === 'declined') {
            declined = true;
            break;
          }
        }
        if (declined) continue;
      }

      var start = new Date(item.start.dateTime).getTime();
      var end = new Date(item.end.dateTime).getTime();
      if (end - start >= 24 * 60 * 60 * 1000) continue;

      busyTimes.push({ start: start, end: end });
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
            newRemaining.push(seg);
          } else {
            if (busy.start > seg.start) newRemaining.push({ start: seg.start, end: busy.start });
            if (busy.end < seg.end) newRemaining.push({ start: busy.end, end: seg.end });
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
    var freePatterns = getFreeEventPatterns();

    var designatedEvents = listEvents(calendarId, startDate, endDate);
    var partition = partitionDesignatedEvents(designatedEvents, pattern.toLowerCase(), freePatterns);

    var conflictIds = getConflictCalendarIds(calendarId);
    var conflictBusy = [];
    for (var ci = 0; ci < conflictIds.length; ci++) {
      var calBusy = getConflictCalendarBusyTimes(conflictIds[ci], startDate, endDate);
      calBusy.forEach(function (b) { b.source = conflictIds[ci]; });
      conflictBusy = conflictBusy.concat(calBusy);
    }

    var allBusy = partition.busy.concat(conflictBusy);
    var mergedBusy = mergePeriods(allBusy);
    var freeWindows = subtractBusyTimes(partition.windows, mergedBusy);
    var slots = generateSlots(freeWindows, 15);

    return {
      calendarId: calendarId,
      pattern: pattern,
      freeEventPatterns: freePatterns,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      totalEventsInRange: designatedEvents.length,
      events: designatedEvents.map(function (e) {
        return { title: e.summary, start: e.start.dateTime || e.start.date, end: e.end.dateTime || e.end.date, transparency: e.transparency || 'opaque' };
      }),
      availabilityWindowsFound: partition.windows.length,
      windows: partition.windows.map(function (w) {
        return { start: new Date(w.start).toISOString(), end: new Date(w.end).toISOString() };
      }),
      designatedBusy: partition.busy.map(function (b) {
        return { start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
      }),
      conflictBusy: conflictBusy.map(function (b) {
        return { source: b.source, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
      }),
      conflictCalendarIds: conflictIds,
      busyTimesCount: mergedBusy.length,
      busyTimes: mergedBusy.map(function (b) {
        return { start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() };
      }),
      freeWindowsAfterSubtract: freeWindows.length,
      freeWindows: freeWindows.map(function (w) {
        return { start: new Date(w.start).toISOString(), end: new Date(w.end).toISOString() };
      }),
      slotsGenerated: slots.length,
    };
  }

  return {
    getAvailableSlots: getAvailableSlots,
    isRangeAvailable: isRangeAvailable,
    debug: debug,
  };
})();
