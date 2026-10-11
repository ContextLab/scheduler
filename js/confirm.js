/**
 * ConfirmPage — controller for confirm.html (email-verification step).
 *
 * A new booking is only a pending request until the visitor opens the link in
 * their verification email and clicks "Confirm booking". Like cancel.html, the
 * state change must NEVER happen on page load: email security scanners GET (and
 * may render) every link in a message, which would otherwise verify addresses on
 * the visitor's behalf and defeat the check. Load is read-only; confirming
 * requires an explicit click.
 */

var ConfirmPage = (function () {
  function getToken(opts) {
    if (opts && opts.token) return opts.token;
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.search).get('token');
    }
    return null;
  }

  function formatWhen(start) {
    try {
      if (typeof TimezoneUtil !== 'undefined' && start) {
        return TimezoneUtil.formatDateTime(start) + ' (' + TimezoneUtil.getTimezoneAbbreviation() + ')';
      }
    } catch (e) { /* fall back to raw value */ }
    return start || '';
  }

  function init(opts) {
    var token = getToken(opts);
    var container = document.getElementById('confirm-content');

    if (!token) {
      PageMessage.render(container, 'Invalid Link',
        'No booking token provided. Please use the link from your verification email.');
      return Promise.resolve();
    }

    return ConfigLoader.loadAll()
      .then(function (config) {
        ApiClient.init(config.settings.apps_script_url);
        // Without detect() the timezone is null and every date renders as a raw ISO string.
        if (typeof TimezoneUtil !== 'undefined') TimezoneUtil.detect(config.settings.default_timezone);
        return ApiClient.getBooking(token);
      })
      .then(function (result) {
        var booking = result && result.booking;
        var status = booking && booking.status;
        if (status === 'confirmed') {
          renderConfirmed(container, { token: token, start: booking.start }, true);
        } else if (status === 'pending') {
          renderPrompt(container, token, booking);
        } else {
          PageMessage.render(container, 'Request No Longer Active',
            'This booking request has expired or was cancelled. Please book again.');
        }
      })
      .catch(function (err) {
        if (err && err.code === 'NOT_FOUND') {
          PageMessage.render(container, 'Booking Not Found',
            'This booking request was not found or the link has expired.');
        } else {
          // Couldn't load details, but still gate confirmation behind a click.
          renderPrompt(container, token, null);
        }
      });
  }

  function renderPrompt(container, token, booking) {
    container.textContent = '';

    var h2 = document.createElement('h2');
    h2.textContent = 'Confirm your booking';
    container.appendChild(h2);

    if (booking) {
      var summary = document.createElement('p');
      summary.className = 'cancel-details';
      summary.textContent = (booking.meetingTypeId || 'Meeting') + ' — ' + formatWhen(booking.start);
      container.appendChild(summary);
    }

    var info = document.createElement('p');
    info.textContent = 'Your meeting is not booked until you confirm.';
    container.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'confirmation-links';
    actions.style.marginTop = '16px';

    var yes = document.createElement('button');
    yes.id = 'confirm-booking-btn';
    yes.type = 'button';
    yes.className = 'btn btn-primary';
    yes.textContent = 'Confirm booking';
    yes.addEventListener('click', function () {
      yes.disabled = true;
      performConfirm(container, token);
    });
    actions.appendChild(yes);
    container.appendChild(actions);
  }

  function performConfirm(container, token) {
    var loading = document.getElementById('loading');
    if (loading) loading.classList.add('visible');

    return ApiClient.confirmBooking(token)
      .then(function (result) {
        if (loading) loading.classList.remove('visible');
        renderConfirmed(container, result.booking, false);
      })
      .catch(function (err) {
        if (loading) loading.classList.remove('visible');
        var code = err && err.code;
        if (code === 'SLOT_TAKEN') {
          PageMessage.render(container, 'Time No Longer Available',
            'Sorry, someone else booked this time before you confirmed. Please choose another time.');
        } else if (code === 'EXPIRED') {
          PageMessage.render(container, 'Link Expired',
            'This confirmation link has expired. Please book again.');
        } else if (code === 'ALREADY_CANCELLED') {
          PageMessage.render(container, 'Request No Longer Active',
            'This booking request has expired or was cancelled. Please book again.');
        } else if (code === 'NOT_FOUND') {
          PageMessage.render(container, 'Booking Not Found',
            'This booking request was not found.');
        } else {
          PageMessage.render(container, 'Error', (err && err.message) || 'An error occurred while confirming.');
        }
      });
  }

  function renderConfirmed(container, booking, wasAlready) {
    PageMessage.render(container, wasAlready ? 'Already Confirmed' : 'Booking Confirmed!',
      (booking && booking.start ? formatWhen(booking.start) + '. ' : '') +
      'A calendar invite and confirmation email (with cancel and reschedule links) have been sent to you.',
      true);
  }

  return { init: init };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfirmPage;
}
