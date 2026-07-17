/**
 * Tests for CancelPage (cancel.html controller).
 *
 * The critical regression guard: loading the page must NOT cancel the booking
 * (an email link-scanner GETs the URL). Cancellation may only happen after an
 * explicit click on the confirm button.
 */

let CancelPage;

function setupDOM() {
  document.body.textContent = '';
  const content = document.createElement('div');
  content.id = 'cancel-content';
  document.body.appendChild(content);
  const loading = document.createElement('div');
  loading.id = 'loading';
  document.body.appendChild(loading);
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CancelPage — no cancel on page load', () => {
  beforeEach(() => {
    jest.resetModules();
    setupDOM();
    CancelPage = require('../../js/cancel');

    global.ConfigLoader = {
      loadAll: () => Promise.resolve({ settings: { apps_script_url: 'https://x/exec' } }),
    };
    global.ApiClient = {
      init: jest.fn(),
      getBooking: jest.fn(() => Promise.resolve({
        booking: { token: 'tok-1', status: 'confirmed', meetingTypeId: 'project-meeting', start: '2026-07-21T14:30:00.000Z' },
      })),
      cancelBooking: jest.fn(() => Promise.resolve({ success: true })),
    };
  });

  test('loading the page reads the booking but does NOT cancel it', async () => {
    await CancelPage.init({ token: 'tok-1' });
    await flush();
    expect(global.ApiClient.getBooking).toHaveBeenCalledWith('tok-1');
    expect(global.ApiClient.cancelBooking).not.toHaveBeenCalled(); // the whole point
    expect(document.getElementById('confirm-cancel-btn')).not.toBeNull();
  });

  test('cancellation happens only after the confirm button is clicked', async () => {
    await CancelPage.init({ token: 'tok-1' });
    await flush();
    expect(global.ApiClient.cancelBooking).not.toHaveBeenCalled();

    document.getElementById('confirm-cancel-btn').click();
    await flush();

    expect(global.ApiClient.cancelBooking).toHaveBeenCalledTimes(1);
    expect(global.ApiClient.cancelBooking).toHaveBeenCalledWith('tok-1');
  });

  test('an already-cancelled booking shows a message and offers no cancel button', async () => {
    global.ApiClient.getBooking = jest.fn(() => Promise.resolve({
      booking: { token: 'tok-1', status: 'cancelled' },
    }));
    await CancelPage.init({ token: 'tok-1' });
    await flush();
    expect(global.ApiClient.cancelBooking).not.toHaveBeenCalled();
    expect(document.getElementById('confirm-cancel-btn')).toBeNull();
    expect(document.body.textContent).toMatch(/already been cancelled/i);
  });

  test('a missing token cancels nothing and never calls the API', async () => {
    await CancelPage.init({ token: null });
    await flush();
    expect(global.ApiClient.getBooking).not.toHaveBeenCalled();
    expect(global.ApiClient.cancelBooking).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/invalid link/i);
  });

  test('even if the booking cannot be loaded, cancel still requires a click', async () => {
    const err = new Error('server down');
    global.ApiClient.getBooking = jest.fn(() => Promise.reject(err));
    await CancelPage.init({ token: 'tok-1' });
    await flush();
    expect(global.ApiClient.cancelBooking).not.toHaveBeenCalled();
    expect(document.getElementById('confirm-cancel-btn')).not.toBeNull();
  });
});
