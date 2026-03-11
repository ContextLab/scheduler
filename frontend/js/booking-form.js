/**
 * BookingForm — form validation, data extraction, and submission.
 * Handles the Step 3 booking form with real-time validation.
 */

var BookingForm = (function () {
  var _locations = [];

  function init(locations) {
    _locations = locations || [];
    populateFormatDropdown();
    setupFormHandler();
  }

  function populateFormatDropdown() {
    var select = document.getElementById('format');
    // Keep the first "Select format..." option
    while (select.options.length > 1) {
      select.remove(1);
    }
    _locations.forEach(function (loc) {
      var option = document.createElement('option');
      option.value = loc.id;
      option.textContent = loc.label;
      select.appendChild(option);
    });
  }

  function setupFormHandler() {
    var form = document.getElementById('booking-form');
    if (!form) return;

    // Real-time validation on blur
    var fields = ['first-name', 'last-name', 'email', 'format'];
    fields.forEach(function (fieldId) {
      var el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('blur', function () {
          var name = fieldIdToName(fieldId);
          var error = validateField(name, el.value);
          showFieldError(fieldId, error);
        });
        el.addEventListener('input', function () {
          el.classList.remove('invalid');
          var errorEl = document.getElementById(fieldId + '-error');
          if (errorEl) errorEl.textContent = '';
        });
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = extractFormData();
      var errors = validateAll(data);

      // Show all errors
      clearAllErrors();
      var hasErrors = false;
      for (var field in errors) {
        var fieldId = nameToFieldId(field);
        showFieldError(fieldId, errors[field]);
        hasErrors = true;
      }

      if (!hasErrors) {
        App.submitBooking(data);
      }
    });
  }

  function validateField(name, value) {
    switch (name) {
      case 'firstName':
        if (!value || !value.trim()) return 'First name is required';
        return '';
      case 'lastName':
        if (!value || !value.trim()) return 'Last name is required';
        return '';
      case 'email':
        if (!value || !value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      case 'format':
        if (!value || !value.trim()) return 'Please select a meeting format';
        return '';
      default:
        return '';
    }
  }

  function validateAll(data) {
    var errors = {};
    var fields = ['firstName', 'lastName', 'email', 'format'];
    fields.forEach(function (field) {
      var error = validateField(field, data[field]);
      if (error) {
        errors[field] = error;
      }
    });
    return errors;
  }

  function extractFormData() {
    return {
      firstName: (document.getElementById('first-name').value || '').trim(),
      lastName: (document.getElementById('last-name').value || '').trim(),
      email: (document.getElementById('email').value || '').trim(),
      format: (document.getElementById('format').value || '').trim(),
      purpose: (document.getElementById('purpose').value || '').trim(),
      notes: (document.getElementById('notes').value || '').trim(),
    };
  }

  function showFieldError(fieldId, message) {
    var input = document.getElementById(fieldId);
    var errorEl = document.getElementById(fieldId + '-error');
    if (message) {
      if (input) input.classList.add('invalid');
      if (errorEl) errorEl.textContent = message;
    } else {
      if (input) input.classList.remove('invalid');
      if (errorEl) errorEl.textContent = '';
    }
  }

  function clearAllErrors() {
    var fields = ['first-name', 'last-name', 'email', 'format'];
    fields.forEach(function (fieldId) {
      showFieldError(fieldId, '');
    });
  }

  function fieldIdToName(fieldId) {
    var map = {
      'first-name': 'firstName',
      'last-name': 'lastName',
      'email': 'email',
      'format': 'format',
    };
    return map[fieldId] || fieldId;
  }

  function nameToFieldId(name) {
    var map = {
      'firstName': 'first-name',
      'lastName': 'last-name',
      'email': 'email',
      'format': 'format',
    };
    return map[name] || name;
  }

  return {
    init: init,
    validateField: validateField,
    validateAll: validateAll,
    extractFormData: extractFormData,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingForm;
}
