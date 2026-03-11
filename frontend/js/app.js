/**
 * App — main application orchestrator.
 * Manages step navigation, loading states, error display, and wires up the booking flow.
 */

var App = (function () {
  var _currentStep = 1;
  var _selectedType = null;
  var _selectedSlot = null;
  var _errorTimeout = null;

  function init() {
    ConfigLoader.loadAll()
      .then(function (config) {
        // Initialize timezone
        var defaultTz = config.settings.default_timezone || 'America/New_York';
        TimezoneUtil.detect(defaultTz);
        populateTimezoneSelector();

        // Initialize API client
        ApiClient.init(config.settings.apps_script_url);

        // Render meeting types
        renderMeetingTypes(config.meetingTypes);

        // Set up back buttons
        document.getElementById('back-to-step-1').addEventListener('click', function () {
          goToStep(1);
        });
        document.getElementById('back-to-step-2').addEventListener('click', function () {
          goToStep(2);
        });

        // Set up booking form
        BookingForm.init(config.locations);
      })
      .catch(function (err) {
        showError('Failed to load configuration: ' + err.message);
      });
  }

  function populateTimezoneSelector() {
    var select = document.getElementById('timezone-select');
    var timezones = TimezoneUtil.getCommonTimezones();
    var currentTz = TimezoneUtil.getTimezone();

    timezones.forEach(function (tz) {
      var option = document.createElement('option');
      option.value = tz.value;
      option.textContent = tz.label;
      if (tz.value === currentTz) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', function () {
      TimezoneUtil.setTimezone(select.value);
      // Re-render calendar if on step 2
      if (_currentStep === 2 && _selectedType) {
        CalendarUI.refresh();
      }
    });
  }

  function renderMeetingTypes(meetingTypes) {
    var container = document.getElementById('meeting-types');
    container.textContent = '';

    meetingTypes.forEach(function (type) {
      var card = document.createElement('div');
      card.className = 'meeting-type-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', type.name + ', ' + type.duration + ' minutes');

      var h3 = document.createElement('h3');
      h3.textContent = type.name;
      card.appendChild(h3);

      var duration = document.createElement('div');
      duration.className = 'duration';
      duration.textContent = type.duration + ' minutes';
      card.appendChild(duration);

      var desc = document.createElement('div');
      desc.className = 'description';
      desc.textContent = type.description;
      card.appendChild(desc);

      if (type.instructions) {
        var instr = document.createElement('div');
        instr.className = 'instructions';
        instr.textContent = type.instructions;
        card.appendChild(instr);
      }

      card.addEventListener('click', function () {
        selectMeetingType(type);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectMeetingType(type);
        }
      });

      container.appendChild(card);
    });
  }

  function selectMeetingType(type) {
    _selectedType = type;
    document.getElementById('selected-type-info').textContent =
      type.name + ' (' + type.duration + ' min)';
    goToStep(2);
    CalendarUI.init(type.duration, onSlotSelected);
  }

  function onSlotSelected(slot) {
    _selectedSlot = slot;
    document.getElementById('selected-slot-info').textContent =
      _selectedType.name + ' — ' +
      TimezoneUtil.formatDateTime(slot.start) + ' (' +
      TimezoneUtil.getTimezoneAbbreviation() + ')';
    goToStep(3);
  }

  function goToStep(step) {
    // Hide all steps
    for (var i = 1; i <= 4; i++) {
      var section = document.getElementById('step-' + i);
      section.classList.remove('active');
    }

    // Show target step
    document.getElementById('step-' + step).classList.add('active');

    // Update step indicator
    var indicators = document.querySelectorAll('.step-indicator .step');
    indicators.forEach(function (el) {
      var s = parseInt(el.dataset.step, 10);
      el.classList.remove('active', 'completed');
      if (s === step) {
        el.classList.add('active');
      } else if (s < step) {
        el.classList.add('completed');
      }
    });

    _currentStep = step;
    hideError();
  }

  function showLoading() {
    document.getElementById('loading').classList.add('visible');
  }

  function hideLoading() {
    document.getElementById('loading').classList.remove('visible');
  }

  function showError(message, autoHideMs) {
    var banner = document.getElementById('error-banner');
    banner.textContent = message;
    banner.classList.add('visible');

    if (_errorTimeout) {
      clearTimeout(_errorTimeout);
      _errorTimeout = null;
    }

    if (autoHideMs) {
      _errorTimeout = setTimeout(function () {
        hideError();
      }, autoHideMs);
    }
  }

  function hideError() {
    var banner = document.getElementById('error-banner');
    banner.classList.remove('visible');
    banner.textContent = '';
    if (_errorTimeout) {
      clearTimeout(_errorTimeout);
      _errorTimeout = null;
    }
  }

  function submitBooking(formData) {
    if (!_selectedType || !_selectedSlot) {
      showError('Please select a meeting type and time slot first.');
      return;
    }

    var config = ConfigLoader.getConfig();
    var location = config.locations.find(function (loc) {
      return loc.id === formData.format;
    });

    var bookingData = {
      meetingTypeId: _selectedType.id,
      meetingTypeName: _selectedType.name,
      start: _selectedSlot.start,
      end: _selectedSlot.end,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      format: formData.format,
      location: location ? location.value : formData.format,
      purpose: formData.purpose || '',
      notes: formData.notes || '',
    };

    showLoading();

    ApiClient.createBooking(bookingData)
      .then(function (result) {
        hideLoading();
        showConfirmation(result.booking, bookingData);
        goToStep(4);
      })
      .catch(function (err) {
        hideLoading();
        if (err.code === 'SLOT_TAKEN') {
          showError('This time slot was just taken. Please select another time.', 5000);
          goToStep(2);
          CalendarUI.refresh();
        } else {
          showError(err.message || 'Failed to create booking. Please try again.', 8000);
        }
      });
  }

  function showConfirmation(booking, formData) {
    var container = document.getElementById('confirmation-content');
    container.textContent = '';

    var box = document.createElement('div');
    box.className = 'confirmation-box';

    var checkmark = document.createElement('div');
    checkmark.className = 'checkmark';
    checkmark.textContent = '\u2713';
    box.appendChild(checkmark);

    var h2 = document.createElement('h2');
    h2.textContent = 'Booking Confirmed!';
    box.appendChild(h2);

    var details = document.createElement('dl');
    details.className = 'confirmation-details';

    var fields = [
      { label: 'Meeting Type', value: _selectedType.name },
      { label: 'Date & Time', value: TimezoneUtil.formatDateTime(booking.start) + ' (' + TimezoneUtil.getTimezoneAbbreviation() + ')' },
      { label: 'Duration', value: _selectedType.duration + ' minutes' },
      { label: 'Format', value: formData.format },
      { label: 'Location', value: formData.location },
      { label: 'Name', value: formData.firstName + ' ' + formData.lastName },
      { label: 'Email', value: formData.email },
    ];

    if (formData.purpose) {
      fields.push({ label: 'Purpose', value: formData.purpose });
    }

    fields.forEach(function (field) {
      var dt = document.createElement('dt');
      dt.textContent = field.label;
      details.appendChild(dt);
      var dd = document.createElement('dd');
      dd.textContent = field.value;
      details.appendChild(dd);
    });

    box.appendChild(details);

    var links = document.createElement('div');
    links.className = 'confirmation-links';

    if (booking.cancelUrl) {
      var cancelLink = document.createElement('a');
      cancelLink.href = booking.cancelUrl;
      cancelLink.textContent = 'Cancel Booking';
      links.appendChild(cancelLink);
    }

    if (booking.rescheduleUrl) {
      var rescheduleLink = document.createElement('a');
      rescheduleLink.href = booking.rescheduleUrl;
      rescheduleLink.textContent = 'Reschedule';
      links.appendChild(rescheduleLink);
    }

    box.appendChild(links);

    var note = document.createElement('p');
    note.style.marginTop = '16px';
    note.style.fontSize = '0.85rem';
    note.style.color = '#636E72';
    note.textContent = 'A calendar invite and confirmation email have been sent to ' + formData.email + '.';
    box.appendChild(note);

    container.appendChild(box);
  }

  // Initialize on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    goToStep: goToStep,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showError: showError,
    hideError: hideError,
    submitBooking: submitBooking,
    getSelectedType: function () { return _selectedType; },
    getSelectedSlot: function () { return _selectedSlot; },
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
