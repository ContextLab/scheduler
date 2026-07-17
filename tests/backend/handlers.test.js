/**
 * End-to-end tests for the real request handlers in backend/Code.gs.
 *
 * Drives handleCreateBooking / handleRescheduleBooking through the full path
 * (validation -> lock -> authoritative sheet check -> calendar check ->
 * createEvent -> sheet write -> email -> response), with only the Google-service
 * boundary stubbed. Run: node tests/backend/handlers.test.js
 *
 * The harness deliberately does NOT reflect created events back into
 * Calendar.Events.list (simulating propagation lag), so the double-booking tests
 * pass ONLY because the authoritative sheet check works.
 */

const assert = require('assert');
const { loadBackend, parseResponse } = require('./gas-harness');
const { createRunner } = require('./_runner');

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const CAL = 'cal-primary';

const BASE_CONFIG = {
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
};

function ev(summary, startMs, endMs, extra) {
  return Object.assign({
    summary: summary,
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(endMs).toISOString() },
    status: 'confirmed',
  }, extra || {});
}

const FILES = ['Booking.gs', 'Calendar.gs', 'Token.gs', 'Code.gs'];

/** Build a harness with a 2-hour availability window 48h out, seeded sheet header. */
function makeCtx(overrides) {
  overrides = overrides || {};
  const winStart = Date.now() + 48 * HOUR;
  const winEnd = winStart + 2 * HOUR;
  const events = [ev('Jeremy office hours', winStart, winEnd)].concat(overrides.extraEvents || []);
  const ctx = loadBackend({
    config: Object.assign({}, BASE_CONFIG, overrides.config || {}),
    calendarEvents: { [CAL]: events },
    bookingRows: [],
    lock: overrides.lock,
    reflectCreatedEvents: false, // simulate calendar propagation lag
  }, FILES);
  ctx._sheet._rows = [ctx.BookingStore.HEADERS.slice()]; // header only
  ctx._winStart = winStart;
  ctx._winEnd = winEnd;
  return ctx;
}

function bookingData(_ctx, startMs, endMs, extra) {
  return Object.assign({
    meetingTypeId: 'office-hours',
    meetingTypeName: 'Office hours',
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    firstName: 'Sam',
    lastName: 'Student',
    email: 'sam@example.edu',
    format: 'in-person',
    location: "Jeremy's office",
  }, extra || {});
}

const r = createRunner('handleCreateBooking / handleRescheduleBooking (end-to-end)');

// --- BUG A end-to-end: an off-grid 45-min slot books successfully ---
r.test('books an off-grid 45-min slot (the 10:30 case) through the full handler', function () {
  const ctx = makeCtx();
  const data = bookingData(ctx, ctx._winStart + 60 * MIN, ctx._winStart + 105 * MIN);
  const res = parseResponse(ctx.handleCreateBooking(data));
  assert.strictEqual(res.success, true, JSON.stringify(res));
  assert.ok(res.booking && res.booking.token, 'expected a token');
  assert.strictEqual(ctx._createdEvents.length, 1, 'one calendar event created');
  assert.strictEqual(ctx._sheet._rows.length, 2, 'header + one booking row');
  assert.strictEqual(ctx._sentEmails.length, 1, 'a confirmation email queued');
});

// --- BUG B end-to-end: second booking of the same slot is rejected ---
r.test('rejects a second booking of the same slot (sheet check beats calendar lag)', function () {
  const ctx = makeCtx();
  const start = ctx._winStart + 60 * MIN, end = ctx._winStart + 105 * MIN;
  const first = parseResponse(ctx.handleCreateBooking(bookingData(ctx, start, end)));
  assert.strictEqual(first.success, true);

  // Calendar.Events.list still does NOT show the new event (lag). Only the sheet does.
  const second = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, start, end, { firstName: 'Alex', email: 'alex@example.edu' })));
  assert.strictEqual(second.success, false, 'second identical booking must fail');
  assert.strictEqual(second.error, 'SLOT_TAKEN');
  assert.strictEqual(ctx._createdEvents.length, 1, 'no second calendar event');
  assert.strictEqual(ctx._sheet._rows.length, 2, 'no second booking row');
});

// --- Overlapping (not identical) second booking is also rejected ---
r.test('rejects a second booking that overlaps an existing one', function () {
  const ctx = makeCtx();
  const s1 = ctx._winStart + 30 * MIN, e1 = ctx._winStart + 75 * MIN; // 45 min
  assert.strictEqual(parseResponse(ctx.handleCreateBooking(bookingData(ctx, s1, e1))).success, true);
  const s2 = ctx._winStart + 60 * MIN, e2 = ctx._winStart + 90 * MIN; // overlaps [60,75)
  const res = parseResponse(ctx.handleCreateBooking(bookingData(ctx, s2, e2)));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'SLOT_TAKEN');
});

// --- Calendar conflict (pre-existing busy meeting) blocks a booking ---
r.test('rejects a booking overlapping a pre-existing busy calendar event', function () {
  const winStart = Date.now() + 48 * HOUR;
  const ctx = makeCtx({ extraEvents: [ev('Faculty meeting', winStart + 60 * MIN, winStart + 90 * MIN)] });
  const res = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winStart + 60 * MIN, ctx._winStart + 105 * MIN)));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'SLOT_TAKEN');
  assert.strictEqual(ctx._createdEvents.length, 0);
});

// --- Booking outside any availability window is rejected ---
r.test('rejects a booking outside the availability window', function () {
  const ctx = makeCtx();
  const res = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winEnd + 2 * HOUR, ctx._winEnd + 3 * HOUR)));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'SLOT_TAKEN');
});

// --- Min-notice window is enforced ---
r.test('rejects a booking inside the min-notice window', function () {
  const ctx = makeCtx({ config: { MIN_NOTICE_HOURS: '72' } }); // window is only 48h out
  const res = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winStart + 60 * MIN, ctx._winStart + 105 * MIN)));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'SLOT_TAKEN');
});

// --- Validation + lock behaviour ---
r.test('rejects a booking missing a required field', function () {
  const ctx = makeCtx();
  const data = bookingData(ctx, ctx._winStart + 60 * MIN, ctx._winStart + 105 * MIN);
  delete data.email;
  const res = parseResponse(ctx.handleCreateBooking(data));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'VALIDATION_ERROR');
});

r.test('returns LOCK_TIMEOUT when the lock cannot be acquired', function () {
  const ctx = makeCtx({ lock: false });
  const res = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winStart + 60 * MIN, ctx._winStart + 105 * MIN)));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'LOCK_TIMEOUT');
  assert.strictEqual(ctx._sheet._rows.length, 1, 'nothing written without the lock');
});

// --- Reschedule flow ---
r.test('reschedules a booking to a new free slot', function () {
  const ctx = makeCtx();
  const first = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winStart + 15 * MIN, ctx._winStart + 45 * MIN)));
  assert.strictEqual(first.success, true);
  const oldToken = first.booking.token;

  const res = parseResponse(ctx.handleRescheduleBooking({
    oldToken: oldToken,
    newStart: new Date(ctx._winStart + 75 * MIN).toISOString(),
    newEnd: new Date(ctx._winStart + 105 * MIN).toISOString(),
  }));
  assert.strictEqual(res.success, true, JSON.stringify(res));
  assert.notStrictEqual(res.booking.token, oldToken, 'a new token is issued');

  const oldRow = ctx.BookingStore.getByToken(oldToken);
  assert.strictEqual(oldRow.status, 'rescheduled', 'old booking marked rescheduled');
  const newRow = ctx.BookingStore.getByToken(res.booking.token);
  assert.strictEqual(newRow.status, 'confirmed');
});

r.test('rejects a reschedule onto another confirmed booking', function () {
  const ctx = makeCtx();
  // Booking A occupies [75,105); we will try to move booking B onto it.
  parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winStart + 75 * MIN, ctx._winStart + 105 * MIN,
      { firstName: 'Occupant', email: 'occ@example.edu' })));
  const b = parseResponse(ctx.handleCreateBooking(
    bookingData(ctx, ctx._winStart + 15 * MIN, ctx._winStart + 45 * MIN)));
  assert.strictEqual(b.success, true);

  const res = parseResponse(ctx.handleRescheduleBooking({
    oldToken: b.booking.token,
    newStart: new Date(ctx._winStart + 75 * MIN).toISOString(),
    newEnd: new Date(ctx._winStart + 105 * MIN).toISOString(),
  }));
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'SLOT_TAKEN');
});

process.exit(r.done() === 0 ? 0 : 1);
