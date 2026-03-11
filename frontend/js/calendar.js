/**
 * CalendarUI — FullCalendar wrapper for displaying available time slots.
 * Fetches slots from the backend and renders them as clickable events.
 */

var CalendarUI = (function () {
  var _calendar = null;
  var _durationMinutes = 15;
  var _onSlotSelected = null;

  function init(durationMinutes, onSlotSelected) {
    _durationMinutes = durationMinutes;
    _onSlotSelected = onSlotSelected;

    var containerEl = document.getElementById('calendar-container');
    containerEl.textContent = '';

    _calendar = new FullCalendar.Calendar(containerEl, {
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay',
      },
      allDaySlot: false,
      slotMinTime: '07:00:00',
      slotMaxTime: '21:00:00',
      slotDuration: minutesToSlotDuration(durationMinutes),
      timeZone: TimezoneUtil.getTimezone(),
      height: 'auto',
      nowIndicator: true,
      selectable: false,
      editable: false,
      events: fetchSlots,
      eventClick: function (info) {
        if (_onSlotSelected) {
          _onSlotSelected({
            start: info.event.startStr,
            end: info.event.endStr,
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
    });

    _calendar.render();
  }

  function fetchSlots(info, successCallback, failureCallback) {
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
          };
        });

        if (events.length === 0) {
          showNoSlotsMessage();
        } else {
          hideNoSlotsMessage();
        }

        successCallback(events);
      })
      .catch(function (err) {
        App.showError('Failed to load available times: ' + err.message, 5000);
        failureCallback(err);
      });
  }

  function showNoSlotsMessage() {
    var container = document.getElementById('calendar-container');
    var existing = container.querySelector('.no-slots-message');
    if (!existing) {
      var msg = document.createElement('div');
      msg.className = 'no-slots-message';
      msg.textContent = 'No available times this week. Try navigating to another week.';
      container.appendChild(msg);
    }
  }

  function hideNoSlotsMessage() {
    var container = document.getElementById('calendar-container');
    var existing = container.querySelector('.no-slots-message');
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
      _calendar.setOption('timeZone', TimezoneUtil.getTimezone());
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
