/**
 * Integration tests for the booking-submit path in app.js (BUG C + prefetch
 * invalidation wiring). Drives the REAL app.js flow (select type -> duration ->
 * slot -> submit) with stubbed collaborators.
 */

const CONFIG = {
  settings: {
    default_timezone: 'America/New_York',
    apps_script_url: 'https://example.test/exec',
    min_notice_hours: 12,
    max_advance_days: 90,
  },
  meetingTypes: [
    { id: 'office-hours', name: 'Office hours', description: 'Meet about a course.' },
  ],
  locations: [
    { id: 'in-person', label: 'In person', value: "Jeremy's office" },
  ],
};

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setupDOM() {
  document.body.textContent = '';

  const indicator = document.createElement('div');
  indicator.className = 'step-indicator';
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.className = i === 1 ? 'step active' : 'step';
    span.dataset.step = String(i);
    indicator.appendChild(span);
  }
  document.body.appendChild(indicator);

  for (let i = 1; i <= 5; i++) {
    const section = document.createElement('section');
    section.id = 'step-' + i;
    section.className = i === 1 ? 'step-content active' : 'step-content';
    document.body.appendChild(section);
  }

  const ids = [
    'loading', 'error-banner', 'meeting-types', 'duration-options',
    'back-to-step-1', 'back-to-step-2', 'back-to-step-3',
    'selected-type-info', 'selected-duration-info', 'selected-slot-info',
    'instruction-banner', 'confirmation-content',
  ];
  ids.forEach((id) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  });

  const tz = document.createElement('select');
  tz.id = 'timezone-select';
  document.body.appendChild(tz);

  const submitBtn = document.createElement('button');
  submitBtn.id = 'submit-booking';
  submitBtn.type = 'submit';
  document.body.appendChild(submitBtn);
}

const FORM_DATA = {
  firstName: 'Sam', lastName: 'Student', email: 'sam@example.edu',
  format: 'in-person', purpose: '', notes: '',
};

describe('app.js submitBooking flow', () => {
  let App;
  let capturedSlotCb;

  beforeEach(async () => {
    jest.resetModules();
    setupDOM();
    capturedSlotCb = null;

    global.ConfigLoader = {
      loadAll: () => Promise.resolve(CONFIG),
      getConfig: () => CONFIG,
    };
    global.TimezoneUtil = {
      detect: () => {},
      getCommonTimezones: () => [],
      getTimezone: () => 'America/New_York',
      setTimezone: () => {},
      formatDateTime: () => 'Tue, Jul 21, 10:30 AM',
      getTimezoneAbbreviation: () => 'ET',
    };
    global.ApiClient = {
      init: () => {},
      prefetchSlots: () => {},
      invalidatePrefetch: jest.fn(),
      createBooking: jest.fn(() => new Promise(() => {})), // default: never resolves
    };
    global.CalendarUI = {
      init: (_minutes, cb) => { capturedSlotCb = cb; },
      refresh: jest.fn(),
    };
    global.BookingForm = { init: () => {}, updateLocations: () => {} };

    App = require('../../js/app'); // auto-inits: readyState 'complete' + #meeting-types present
    await flush(); // let ConfigLoader.loadAll().then(...) render the meeting-type cards

    // Drive the real flow to populate selection state (type -> duration -> slot).
    document.querySelector('#meeting-types .meeting-type-card').click();
    document.querySelector('#duration-options .duration-card').click();
    expect(typeof capturedSlotCb).toBe('function');
    capturedSlotCb({
      start: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      end: new Date(Date.now() + 48 * 3600 * 1000 + 30 * 60 * 1000).toISOString(),
    });
  });

  test('a double-click does not fire a second createBooking request', () => {
    App.submitBooking(FORM_DATA);
    App.submitBooking(FORM_DATA);
    expect(global.ApiClient.createBooking).toHaveBeenCalledTimes(1);
    expect(document.getElementById('submit-booking').disabled).toBe(true);
  });

  test('on success it invalidates the prefetch and advances to confirmation', async () => {
    global.ApiClient.createBooking = jest.fn(() => Promise.resolve({
      booking: {
        token: 'tok-1',
        start: FORM_DATA.start,
        end: FORM_DATA.end,
        cancelUrl: 'https://x/cancel?token=tok-1',
        rescheduleUrl: 'https://x/reschedule?token=tok-1',
      },
    }));
    App.submitBooking(FORM_DATA);
    await flush();
    expect(global.ApiClient.invalidatePrefetch).toHaveBeenCalledTimes(1);
    expect(document.getElementById('step-5').classList.contains('active')).toBe(true);
  });

  test('on SLOT_TAKEN it invalidates the prefetch, refreshes, and re-enables the button', async () => {
    const err = new Error('taken');
    err.code = 'SLOT_TAKEN';
    global.ApiClient.createBooking = jest.fn(() => Promise.reject(err));
    App.submitBooking(FORM_DATA);
    await flush();
    expect(global.ApiClient.invalidatePrefetch).toHaveBeenCalledTimes(1);
    expect(global.CalendarUI.refresh).toHaveBeenCalledTimes(1);
    expect(document.getElementById('step-3').classList.contains('active')).toBe(true);
    expect(document.getElementById('submit-booking').disabled).toBe(false);
  });

  test('on a generic error it re-enables the button and does NOT invalidate the prefetch', async () => {
    global.ApiClient.createBooking = jest.fn(() => Promise.reject(new Error('network boom')));
    App.submitBooking(FORM_DATA);
    await flush();
    expect(global.ApiClient.invalidatePrefetch).not.toHaveBeenCalled();
    expect(document.getElementById('submit-booking').disabled).toBe(false);
    const banner = document.getElementById('error-banner');
    expect(banner.classList.contains('visible')).toBe(true);
    expect(banner.textContent).toContain('network boom');
  });

  test('after a failed submit the user can retry (guard resets)', async () => {
    const err = new Error('taken');
    err.code = 'SLOT_TAKEN';
    global.ApiClient.createBooking = jest.fn(() => Promise.reject(err));
    App.submitBooking(FORM_DATA);
    await flush();
    // Second attempt should go through (a new request fires).
    global.ApiClient.createBooking = jest.fn(() => new Promise(() => {}));
    App.submitBooking(FORM_DATA);
    expect(global.ApiClient.createBooking).toHaveBeenCalledTimes(1);
  });
});
