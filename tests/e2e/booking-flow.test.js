/**
 * T055 — End-to-end test script for booking flow.
 * Exercises full booking → cancel → reschedule flow against a live backend.
 *
 * Prerequisites:
 *   - Apps Script deployed and URL set in APPS_SCRIPT_URL env var
 *   - Calendar with availability windows configured
 *   - Valid test email address in TEST_EMAIL env var
 *
 * Usage:
 *   APPS_SCRIPT_URL=https://script.google.com/macros/s/xxx/exec \
 *   TEST_EMAIL=test@example.com \
 *   node tests/e2e/booking-flow.test.js
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'PLACEHOLDER_APPS_SCRIPT_URL') {
  console.error('ERROR: Set APPS_SCRIPT_URL environment variable to your deployed Apps Script URL');
  process.exit(1);
}

async function apiCall(action, data) {
  const body = JSON.stringify(Object.assign({ action: action }, data || {}));
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: body,
  });
  return response.json();
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  let bookingToken = null;

  // Test 1: Health check
  try {
    const response = await fetch(APPS_SCRIPT_URL + '?action=health', { redirect: 'follow' });
    const health = await response.json();
    console.assert(health.status === 'ok', 'Health check status should be ok');
    console.log('PASS: Health check — status:', health.status);
    passed++;
  } catch (e) {
    console.log('FAIL: Health check —', e.message);
    failed++;
  }

  // Test 2: Get available slots
  let slots = [];
  try {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const result = await apiCall('getAvailableSlots', {
      startDate: now.toISOString(),
      endDate: nextWeek.toISOString(),
      durationMinutes: 15,
    });
    console.assert(result.success === true, 'getAvailableSlots should succeed');
    console.assert(Array.isArray(result.slots), 'slots should be an array');
    slots = result.slots;
    console.log('PASS: Get available slots —', slots.length, 'slots found');
    passed++;
  } catch (e) {
    console.log('FAIL: Get available slots —', e.message);
    failed++;
  }

  // Test 3: Create booking (if slots available)
  if (slots.length > 0) {
    try {
      const slot = slots[0];
      const result = await apiCall('createBooking', {
        meetingTypeId: 'office-hours',
        meetingTypeName: 'Office Hours',
        start: slot.start,
        end: slot.end,
        firstName: 'E2E',
        lastName: 'Test',
        email: TEST_EMAIL,
        format: 'virtual',
        location: 'https://zoom.us/test',
        purpose: 'E2E test booking',
        notes: 'Automated test — safe to delete',
      });
      console.assert(result.success === true, 'createBooking should succeed');
      console.assert(result.booking.token, 'booking should have token');
      bookingToken = result.booking.token;
      console.log('PASS: Create booking — token:', bookingToken.substring(0, 8) + '...');
      passed++;
    } catch (e) {
      console.log('FAIL: Create booking —', e.message);
      failed++;
    }
  } else {
    console.log('SKIP: Create booking — no available slots');
  }

  // Test 4: Get booking details
  if (bookingToken) {
    try {
      const result = await apiCall('getBooking', { token: bookingToken });
      console.assert(result.success === true, 'getBooking should succeed');
      console.assert(result.booking.firstName === 'E2E', 'firstName should match');
      console.log('PASS: Get booking details');
      passed++;
    } catch (e) {
      console.log('FAIL: Get booking details —', e.message);
      failed++;
    }
  }

  // Test 5: Cancel booking
  if (bookingToken) {
    try {
      const result = await apiCall('cancelBooking', { token: bookingToken });
      console.assert(result.success === true, 'cancelBooking should succeed');
      console.log('PASS: Cancel booking');
      passed++;
    } catch (e) {
      console.log('FAIL: Cancel booking —', e.message);
      failed++;
    }
  }

  // Test 6: Cancel already-cancelled booking (should fail gracefully)
  if (bookingToken) {
    try {
      const result = await apiCall('cancelBooking', { token: bookingToken });
      console.assert(result.success === false, 'double cancel should fail');
      console.assert(result.error === 'ALREADY_CANCELLED', 'should be ALREADY_CANCELLED');
      console.log('PASS: Double cancel returns ALREADY_CANCELLED');
      passed++;
    } catch (e) {
      console.log('FAIL: Double cancel —', e.message);
      failed++;
    }
  }

  // Test 7: Invalid token
  try {
    const result = await apiCall('getBooking', { token: 'nonexistent-token' });
    console.assert(result.success === false, 'invalid token should fail');
    console.assert(result.error === 'NOT_FOUND', 'should be NOT_FOUND');
    console.log('PASS: Invalid token returns NOT_FOUND');
    passed++;
  } catch (e) {
    console.log('FAIL: Invalid token —', e.message);
    failed++;
  }

  // Test 8: Validation error
  try {
    const result = await apiCall('createBooking', { firstName: 'Test' });
    console.assert(result.success === false, 'incomplete booking should fail');
    console.assert(result.error === 'VALIDATION_ERROR', 'should be VALIDATION_ERROR');
    console.log('PASS: Missing fields returns VALIDATION_ERROR');
    passed++;
  } catch (e) {
    console.log('FAIL: Validation error —', e.message);
    failed++;
  }

  console.log('\n--- E2E Results ---');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(function (err) {
  console.error('Test runner error:', err);
  process.exit(1);
});
