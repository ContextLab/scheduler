/**
 * CalendarUI — FullCalendar wrapper for displaying available time slots.
 * Fetches slots from the backend and renders them as clickable events.
 * Dynamically adjusts visible time range based on available slots.
 */

var CalendarUI = (function () {
  var _calendar = null;
  var _durationMinutes = 15;
  var _onSlotSelected = null;
  var _containerEl = null;
  var _currentMinTime = '09:00:00';
  var _currentMaxTime = '17:00:00';
  var _prefetchedEvents = null;
  var DEFAULT_MIN_TIME = '09:00:00';
  var DEFAULT_MAX_TIME = '17:00:00';

  function init(durationMinutes, onSlotSelected) {
    _durationMinutes = durationMinutes;
    _onSlotSelected = onSlotSelected;
    _currentMinTime = DEFAULT_MIN_TIME;
    _currentMaxTime = DEFAULT_MAX_TIME;
    _prefetchedEvents = null;

    _containerEl = document.getElementById('calendar-container');
    _containerEl.textContent = '';

    buildCalendar(_currentMinTime, _currentMaxTime);
  }

  function makeCalendarOptions(minTime, maxTime, initialView, initialDate) {
    var opts = {
      initialView: initialView || 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay',
      },
      allDaySlot: false,
      slotMinTime: minTime,
      slotMaxTime: maxTime,
      slotDuration: minutesToSlotDuration(_durationMinutes),
      timeZone: 'local',
      contentHeight: 500,
      expandRows: true,
      nowIndicator: true,
      selectable: false,
      editable: false,
      events: fetchSlots,
      eventClick: function (info) {
        if (_onSlotSelected) {
          _onSlotSelected({
            start: info.event.extendedProps.utcStart,
            end: info.event.extendedProps.utcEnd,
          });
        }
      },
      eventClassNames: function () {
        return ['available-slot'];
      },
      loading: function (isLoading) {
        if (isLoading) {
          App.showLoading();
        } else {
          App.hideLoading();
          equalizeSlotRows();
        }
      },
      validRange: function () {
        var config = ConfigLoader.getConfig();
        var maxDays = (config && config.settings && config.settings.max_advance_days) || 90;
        var minHours = (config && config.settings && config.settings.min_notice_hours) || 12;
        return {
          start: new Date(Date.now() + minHours * 60 * 60 * 1000),
          end: new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000),
        };
      },
    };
    if (initialDate) {
      opts.initialDate = initialDate;
    }
    return opts;
  }

  function buildCalendar(minTime, maxTime, initialView, initialDate) {
    if (_calendar) {
      _calendar.destroy();
      _calendar = null;
    }
    _currentMinTime = minTime;
    _currentMaxTime = maxTime;
    _calendar = new FullCalendar.Calendar(
      _containerEl,
      makeCalendarOptions(minTime, maxTime, initialView, initialDate)
    );
    _calendar.render();
    // Defer equalization to after FullCalendar finishes DOM layout
    setTimeout(equalizeSlotRows, 100);
  }

  function fetchSlots(info, successCallback, failureCallback) {
    // If we have prefetched events from a rebuild, use them once
    if (_prefetchedEvents !== null) {
      var cached = _prefetchedEvents;
      _prefetchedEvents = null;
      displayEvents(cached);
      successCallback(cached);
      return;
    }

    ApiClient.getAvailableSlots(
      info.startStr,
      info.endStr,
      _durationMinutes
    )
      .then(function (result) {
        var events = (result.slots || []).map(function (slot) {
          return {
            title: 'Available',
            start: slot.start,
            end: slot.end,
            backgroundColor: '#9EC5B3',
            borderColor: '#6EA890',
            textColor: '#2D3436',
            display: 'block',
            extendedProps: {
              utcStart: slot.start,
              utcEnd: slot.end,
            },
          };
        });

        // Determine correct time range
        var newMin, newMax;
        if (events.length === 0) {
          newMin = DEFAULT_MIN_TIME;
          newMax = DEFAULT_MAX_TIME;
        } else {
          var range = getTimeRange(events);
          newMin = range.minTime;
          newMax = range.maxTime;
        }

        // If range changed, rebuild the calendar with the correct range
        // Use setTimeout to avoid destroying calendar inside its own callback
        if (newMin !== _currentMinTime || newMax !== _currentMaxTime) {
          var currentDate = _calendar ? _calendar.getDate() : null;
          var currentView = _calendar ? _calendar.view.type : 'timeGridWeek';
          _prefetchedEvents = events;
          successCallback([]); // satisfy FullCalendar's callback requirement
          setTimeout(function () {
            buildCalendar(newMin, newMax, currentView, currentDate);
          }, 0);
          return;
        }

        displayEvents(events);
        successCallback(events);
      })
      .catch(function (err) {
        App.showError('Failed to load available times: ' + err.message, 5000);
        failureCallback(err);
      });
  }

  function displayEvents(events) {
    if (events.length === 0) {
      showNoSlotsMessage();
    } else {
      hideNoSlotsMessage();
    }
  }

  /**
   * Calculate the visible time range from slot boundaries.
   */
  function getTimeRange(events) {
    var minHour = 23;
    var minMinute = 59;
    var maxHour = 0;
    var maxMinute = 0;

    events.forEach(function (evt) {
      var start = new Date(evt.start);
      var end = new Date(evt.end);

      var sH = start.getHours();
      var sM = start.getMinutes();
      var eH = end.getHours();
      var eM = end.getMinutes();

      if (sH < minHour || (sH === minHour && sM < minMinute)) {
        minHour = sH;
        minMinute = sM;
      }
      if (eH > maxHour || (eH === maxHour && eM > maxMinute)) {
        maxHour = eH;
        maxMinute = eM;
      }
    });

    return {
      minTime: padTime(minHour) + ':' + padTime(minMinute) + ':00',
      maxTime: padTime(maxHour) + ':' + padTime(maxMinute) + ':00',
    };
  }

  /**
   * Force the slots table height to match the scroller container,
   * so that all slot rows distribute the space equally.
   * CSS height:100% doesn't work because the parent chain lacks explicit heights.
   */
  function equalizeSlotRows() {
    if (!_containerEl) return;
    var scroller = _containerEl.querySelector('.fc-scroller-liquid-absolute');
    var slotsTable = _containerEl.querySelector('.fc-timegrid-slots table');
    if (scroller && slotsTable) {
      slotsTable.style.height = scroller.offsetHeight + 'px';
    }
  }

  function padTime(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function showNoSlotsMessage() {
    var existing = _containerEl.querySelector('.no-slots-message');
    if (!existing) {
      var msg = document.createElement('div');
      msg.className = 'no-slots-message';
      msg.textContent = 'No available times this week. Try navigating to another week.';
      _containerEl.appendChild(msg);
    }
  }

  function hideNoSlotsMessage() {
    var existing = _containerEl.querySelector('.no-slots-message');
    if (existing) {
      existing.remove();
    }
  }

  function minutesToSlotDuration(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':00';
  }

  function refresh() {
    if (_calendar) {
      _calendar.refetchEvents();
    }
  }

  function destroy() {
    if (_calendar) {
      _calendar.destroy();
      _calendar = null;
    }
  }

  return {
    init: init,
    refresh: refresh,
    destroy: destroy,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarUI;
}
