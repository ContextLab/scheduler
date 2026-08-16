/**
 * Tests for per-client, read/write-split rate limiting in doPost (backend/Code.gs).
 *
 * The pre-fix limiter keyed every request on `clientId || 'anonymous'`, and the
 * frontend never sent a clientId, so ALL visitors shared one 30/min bucket — a
 * class opening the booking link together saturated it and real bookings failed
 * with RATE_LIMITED. These tests pin the fixed behaviour: buckets are per client,
 * reads are far more generous than writes, and one client cannot starve another.
 *
 * Run: node tests/backend/rate-limit.test.js
 */

const assert = require('assert');
const { loadBackend, parseResponse } = require('./gas-harness');
const { createRunner } = require('./_runner');

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const CAL = 'cal-primary';

// Small, explicit limits so the test is fast and unambiguous.
const CONFIG = {
  CALENDAR_ID: CAL,
  OWNER_NAME: 'Jeremy Manning',
  GITHUB_PAGES_URL: 'https://pages.example/booking',
  AVAILABILITY_PATTERN: 'Jeremy office hours',
  MIN_NOTICE_HOURS: '0',
  MAX_ADVANCE_DAYS: '3650',
  SPREADSHEET_ID: 'sheet-1',
  TOKEN_EXPIRY_DAYS: '90',
  CONFLICT_CALENDAR_IDS: '',
  FREE_EVENT_PATTERNS: '',
  RATE_LIMIT_WRITE_PER_CLIENT: '3',
  RATE_LIMIT_WRITE_GLOBAL: '100',
  RATE_LIMIT_READ_PER_CLIENT: '10',
};

const FILES = ['Booking.gs', 'Calendar.gs', 'Token.gs', 'Code.gs'];

function ev(summary, startMs, endMs, extra) {
  return Object.assign({
    summary: summary,
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(endMs).toISOString() },
    status: 'confirmed',
  }, extra || {});
}

function makeCtx() {
  const winStart = Date.now() + 48 * HOUR;
  const winEnd = winStart + 6 * HOUR; // roomy window so many distinct slots exist
  const ctx = loadBackend({
    config: CONFIG,
    calendarEvents: { [CAL]: [ev('Jeremy office hours', winStart, winEnd)] },
    bookingRows: [],
    reflectCreatedEvents: false,
  }, FILES);
  ctx._sheet._rows = [ctx.BookingStore.HEADERS.slice()];
  ctx._winStart = winStart;
  return ctx;
}

function post(ctx, payload) {
  return parseResponse(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify(payload) } }));
}

function readReq(clientId) {
  return {
    action: 'getAvailableSlots', clientId: clientId,
    startDate: new Date(Date.now() + 40 * HOUR).toISOString(),
    endDate: new Date(Date.now() + 100 * HOUR).toISOString(),
    durationMinutes: 15,
  };
}

function writeReq(ctx, clientId, slotIndex) {
  const start = ctx._winStart + slotIndex * 30 * MIN;
  return {
    action: 'createBooking', clientId: clientId,
    meetingTypeId: 'office-hours', meetingTypeName: 'Office hours',
    start: new Date(start).toISOString(), end: new Date(start + 15 * MIN).toISOString(),
    firstName: 'Sam', lastName: 'Student', email: 'sam@example.edu',
    format: 'in-person', location: "Jeremy's office",
  };
}

const r = createRunner('doPost rate limiting (per-client, read/write split)');

r.test('a single client can make many more reads than the write limit', function () {
  const ctx = makeCtx();
  // Write limit is 3, read limit is 10. Ten reads must all succeed.
  for (var i = 0; i < 10; i++) {
    var res = post(ctx, readReq('client-A'));
    assert.strictEqual(res.success, true, 'read ' + (i + 1) + ' should succeed: ' + JSON.stringify(res));
  }
  // 11th read for the same client is throttled.
  assert.strictEqual(post(ctx, readReq('client-A')).error, 'RATE_LIMITED');
});

r.test('per-client write limit is enforced', function () {
  const ctx = makeCtx();
  for (var i = 0; i < 3; i++) {
    assert.strictEqual(post(ctx, writeReq(ctx, 'client-A', i)).success, true, 'write ' + (i + 1));
  }
  var fourth = post(ctx, writeReq(ctx, 'client-A', 3));
  assert.strictEqual(fourth.success, false);
  assert.strictEqual(fourth.error, 'RATE_LIMITED');
});

r.test('one client exhausting its writes does NOT block another client', function () {
  const ctx = makeCtx();
  // Client A burns its 3 writes and is then throttled.
  for (var i = 0; i < 3; i++) post(ctx, writeReq(ctx, 'client-A', i));
  assert.strictEqual(post(ctx, writeReq(ctx, 'client-A', 3)).error, 'RATE_LIMITED');
  // Client B is unaffected — this is the whole point of the fix.
  var b = post(ctx, writeReq(ctx, 'client-B', 4));
  assert.strictEqual(b.success, true, 'client B must not be starved by client A: ' + JSON.stringify(b));
});

r.test('reads and writes use separate buckets for the same client', function () {
  const ctx = makeCtx();
  // Exhaust the write bucket (3) ...
  for (var i = 0; i < 3; i++) post(ctx, writeReq(ctx, 'client-A', i));
  assert.strictEqual(post(ctx, writeReq(ctx, 'client-A', 3)).error, 'RATE_LIMITED');
  // ... reads for the same client still work (independent bucket).
  assert.strictEqual(post(ctx, readReq('client-A')).success, true);
});

r.test('a per-email cap bounds writes from one address across rotated clientIds', function () {
  const ctx = loadBackend({
    config: Object.assign({}, CONFIG, {
      RATE_LIMIT_WRITE_PER_EMAIL: '2', RATE_LIMIT_WRITE_PER_CLIENT: '50', RATE_LIMIT_WRITE_GLOBAL: '100',
    }),
    calendarEvents: { [CAL]: [ev('Jeremy office hours', Date.now() + 48 * HOUR, Date.now() + 54 * HOUR)] },
    bookingRows: [],
    reflectCreatedEvents: false,
  }, FILES);
  ctx._sheet._rows = [ctx.BookingStore.HEADERS.slice()];
  ctx._winStart = Date.now() + 48 * HOUR;
  function emailWrite(clientId, slotIndex) {
    return Object.assign(writeReq(ctx, clientId, slotIndex), { email: 'abuser@example.edu' });
  }
  // Same email, DIFFERENT clientIds each time (rotation), so only the per-email
  // cap can stop it. Two succeed, the third is throttled.
  assert.strictEqual(post(ctx, emailWrite('c1', 0)).success, true);
  assert.strictEqual(post(ctx, emailWrite('c2', 1)).success, true);
  assert.strictEqual(post(ctx, emailWrite('c3', 2)).error, 'RATE_LIMITED');
  // A different email from a fresh client still works.
  const other = Object.assign(writeReq(ctx, 'c4', 3), { email: 'legit@example.edu' });
  assert.strictEqual(post(ctx, other).success, true);
});

r.test('a global write backstop bounds total writes even across many clients', function () {
  const ctx = loadBackend({
    config: Object.assign({}, CONFIG, { RATE_LIMIT_WRITE_GLOBAL: '2', RATE_LIMIT_WRITE_PER_CLIENT: '10' }),
    calendarEvents: { [CAL]: [ev('Jeremy office hours', Date.now() + 48 * HOUR, Date.now() + 54 * HOUR)] },
    bookingRows: [],
    reflectCreatedEvents: false,
  }, FILES);
  ctx._sheet._rows = [ctx.BookingStore.HEADERS.slice()];
  ctx._winStart = Date.now() + 48 * HOUR;
  assert.strictEqual(post(ctx, writeReq(ctx, 'c1', 0)).success, true);
  assert.strictEqual(post(ctx, writeReq(ctx, 'c2', 1)).success, true);
  // Third write from a fresh client is blocked by the global backstop (limit 2).
  assert.strictEqual(post(ctx, writeReq(ctx, 'c3', 2)).error, 'RATE_LIMITED');
});

process.exit(r.done() === 0 ? 0 : 1);
