/**
 * CancelPage — controller for cancel.html.
 *
 * IMPORTANT: cancellation must NEVER happen on page load. Enterprise email
 * security (Microsoft Defender Safe Links, Proofpoint URL Defense, etc.)
 * automatically GETs every link in an incoming message — including the cancel
 * link in a confirmation email — within seconds of delivery. The previous
 * version cancelled the booking the instant the page loaded, so those scanners
 * silently cancelled real bookings ~26s after they were made.
 *
 * The fix: on load we only READ the booking (safe), then require an explicit
 * user click on a confirm button to actually cancel. Link scanners fetch and
 * may render the page, but do not click buttons.
 */

var CancelPage = (function () {
  function getToken(opts) {
    if (opts && opts.token) return opts.token;
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.search).get('token');
    }
    return null;
  }

  function init(opts) {
    var token = getToken(opts);
    var container = document.getElementById('cancel-content');

    if (!token) {
      renderMessage(container, 'Invalid Link',
        'No booking token provided. Please use the cancel link from your confirmation email.');
      return Promise.resolve();
    }

    // Read-only load of booking details. This does NOT change anything, so an
    // email link-scanner that fetches this URL cannot cancel the booking.
    return ConfigLoader.loadAll()
      .then(function (config) {
        ApiClient.init(config.settings.apps_script_url);
        return ApiClient.getBooking(token);
      })
      .then(function (result) {
        var booking = result && result.booking;
        if (booking && booking.status === 'cancelled') {
          renderMessage(container, 'Already Cancelled', 'This booking has already been cancelled.');
          return;
        }
        renderConfirm(container, token, booking);
      })
      .catch(function (err) {
        if (err && err.code === 'NOT_FOUND') {
          renderMessage(container, 'Booking Not Found',
            'This booking was not found or the link has expired.');
        } else {
          // Couldn't load details, but still gate the cancel behind a click.
          renderConfirm(container, token, null);
        }
      });
  }

  function renderConfirm(container, token, booking) {
    container.textContent = '';

    var h2 = document.createElement('h2');
    h2.textContent = 'Cancel this booking?';
    container.appendChild(h2);

    if (booking) {
      var when = booking.start;
      try {
        if (typeof TimezoneUtil !== 'undefined' && booking.start) {
          when = TimezoneUtil.formatDateTime(booking.start);
        }
      } catch (e) { /* fall back to raw value */ }
      var summary = document.createElement('p');
      summary.className = 'cancel-details';
      summary.textContent = 'You are about to cancel: ' +
        (booking.meetingTypeId || 'your meeting') + (when ? ' — ' + when : '');
      container.appendChild(summary);
    }

    var warn = document.createElement('p');
    warn.textContent = 'This cannot be undone.';
    container.appendChild(warn);

    var actions = document.createElement('div');
    actions.className = 'confirmation-links';
    actions.style.marginTop = '16px';

    var yes = document.createElement('button');
    yes.id = 'confirm-cancel-btn';
    yes.type = 'button';
    yes.className = 'btn btn-primary';
    yes.textContent = 'Yes, cancel my booking';
    yes.addEventListener('click', function () {
      yes.disabled = true;
      performCancel(container, token);
    });
    actions.appendChild(yes);

    var no = document.createElement('a');
    no.href = './';
    no.className = 'btn';
    no.textContent = 'No, keep my booking';
    actions.appendChild(no);

    container.appendChild(actions);
  }

  function performCancel(container, token) {
    var loading = document.getElementById('loading');
    if (loading) loading.classList.add('visible');

    return ApiClient.cancelBooking(token)
      .then(function () {
        if (loading) loading.classList.remove('visible');
        renderMessage(container, 'Booking Cancelled',
          'Your booking has been cancelled. A cancellation notice has been sent to both parties.', true);
      })
      .catch(function (err) {
        if (loading) loading.classList.remove('visible');
        if (err && err.code === 'ALREADY_CANCELLED') {
          renderMessage(container, 'Already Cancelled', 'This booking has already been cancelled.');
        } else if (err && err.code === 'NOT_FOUND') {
          renderMessage(container, 'Booking Not Found',
            'This booking was not found or the link has expired.');
        } else {
          renderMessage(container, 'Error', (err && err.message) || 'An error occurred while cancelling.');
        }
      });
  }

  function renderMessage(container, title, body, showCheck) {
    if (!container) return;
    container.textContent = '';

    if (showCheck) {
      var checkmark = document.createElement('div');
      checkmark.className = 'checkmark';
      checkmark.textContent = '✓';
      container.appendChild(checkmark);
    }

    var h2 = document.createElement('h2');
    h2.textContent = title;
    container.appendChild(h2);

    var p = document.createElement('p');
    p.style.marginTop = '12px';
    p.textContent = body;
    container.appendChild(p);

    var links = document.createElement('div');
    links.className = 'confirmation-links';
    links.style.marginTop = '16px';
    var a = document.createElement('a');
    a.href = './';
    a.textContent = 'Back to scheduling';
    links.appendChild(a);
    container.appendChild(links);
  }

  return { init: init };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CancelPage;
}
