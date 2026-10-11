/**
 * Tests for ConfirmPage (confirm.html controller, email-verification step).
 *
 * The critical guard: loading the page must NOT confirm the booking. Email
 * link-scanners GET every link in a message; if load confirmed, scanners would
 * verify addresses on the visitor's behalf and the check would be meaningless.
 */

let ConfirmPage;

function setupDOM() {
  document.body.textContent = '';
  const content = document.createElement('div');
  content.id = 'confirm-content';
  document.body.appendChild(content);
  const loading = document.createElement('div');
  loading.id = 'loading';
  document.body.appendChild(loading);
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function apiError(code) {
  const e = new Error('err ' + code);
  e.code = code;
  return Promise.reject(e);
}

describe('ConfirmPage', () => {
  beforeEach(() => {
    jest.resetModules();
    setupDOM();
    global.PageMessage = require('../../js/page-message');
    ConfirmPage = require('../../js/confirm');
    global.ConfigLoader = {
      loadAll: () => Promise.resolve({ settings: { apps_script_url: 'https://x/exec' } }),
    };
    global.ApiClient = {
      init: jest.fn(),
      getBooking: jest.fn(() => Promise.resolve({
        booking: { token: 'tok-1', status: 'pending', meetingTypeId: 'office-hours', start: '2030-07-21T14:30:00.000Z' },
      })),
      confirmBooking: jest.fn(() => Promise.resolve({
        success: true, booking: { token: 'tok-1', start: '2030-07-21T14:30:00.000Z' },
      })),
    };
  });

  const h2 = () => document.querySelector('#confirm-content h2').textContent;

  test('loading the page reads the request but does NOT confirm it', async () => {
    await ConfirmPage.init({ token: 'tok-1' });
    await flush();
    expect(global.ApiClient.getBooking).toHaveBeenCalledWith('tok-1');
    expect(global.ApiClient.confirmBooking).not.toHaveBeenCalled();
    expect(document.getElementById('confirm-booking-btn')).not.toBeNull();
  });

  test('confirmation happens only after the button is clicked', async () => {
    await ConfirmPage.init({ token: 'tok-1' });
    await flush();
    document.getElementById('confirm-booking-btn').click();
    await flush();
    expect(global.ApiClient.confirmBooking).toHaveBeenCalledTimes(1);
    expect(global.ApiClient.confirmBooking).toHaveBeenCalledWith('tok-1');
    expect(h2()).toBe('Booking Confirmed!');
  });

  test('an already-confirmed booking says so and offers no button', async () => {
    global.ApiClient.getBooking = jest.fn(() => Promise.resolve({ booking: { status: 'confirmed', start: '2030-07-21T14:30:00.000Z' } }));
    await ConfirmPage.init({ token: 'tok-1' });
    await flush();
    expect(h2()).toBe('Already Confirmed');
    expect(document.getElementById('confirm-booking-btn')).toBeNull();
  });

  test('an expired/cancelled request offers no button', async () => {
    global.ApiClient.getBooking = jest.fn(() => Promise.resolve({ booking: { status: 'expired' } }));
    await ConfirmPage.init({ token: 'tok-1' });
    await flush();
    expect(h2()).toBe('Request No Longer Active');
    expect(document.getElementById('confirm-booking-btn')).toBeNull();
  });

  test.each([
    ['SLOT_TAKEN', 'Time No Longer Available'],
    ['EXPIRED', 'Link Expired'],
    ['ALREADY_CANCELLED', 'Request No Longer Active'],
  ])('confirm error %s shows "%s"', async (code, title) => {
    global.ApiClient.confirmBooking = jest.fn(() => apiError(code));
    await ConfirmPage.init({ token: 'tok-1' });
    await flush();
    document.getElementById('confirm-booking-btn').click();
    await flush();
    expect(h2()).toBe(title);
  });

  test('missing token shows an invalid-link message without calling the API', async () => {
    await ConfirmPage.init({ token: null });
    expect(h2()).toBe('Invalid Link');
    expect(global.ApiClient.getBooking).not.toHaveBeenCalled();
  });
});
