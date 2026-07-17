/**
 * Backend integrity tests for the two booking bugs.
 *
 * Exercises the REAL production functions in backend/Calendar.gs and
 * backend/Booking.gs (loaded via gas-harness), stubbing only the Google-service
 * boundary. Run: node tests/backend/booking-integrity.test.js
 *
 * Covers:
 *   BUG A — CalendarService.isRangeAvailable() must accept any free interval,
 *           not just slots on a duration-aligned grid (the 10:30 regression).
 *   BUG B — BookingStore.findOverlappingConfirmed() must detect an existing
 *           confirmed booking that overlaps a requested interval.
 */

const assert = require('assert');
const { loadBackend } = require('./gas-harness');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n      ' + e.message);
  }
}

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

// ---------------------------------------------------------------------------
// BUG A — interval-containment availability
// ---------------------------------------------------------------------------
console.log('BUG A: CalendarService.isRangeAvailable (interval containment)');

const CAL = 'cal-primary';
const winStart = Date.now() + 48 * HOUR;         // availability window start (well beyond min-notice)
const winEnd = winStart + 2 * HOUR;              // 2-hour "Jeremy office hours" window

function ev(summary, startMs, endMs, extra) {
  return Object.assign({
    summary: summary,
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(endMs).toISOString() },
    status: 'confirmed',
  }, extra || {});
}

// Designated calendar: one availability window + one booked (busy) event 30–60 min in.
const events = [
  ev('Jeremy office hours', winStart, winEnd),
  ev('Alice/Jeremy: Office hours', winStart + 30 * MIN, winStart + 60 * MIN),
];

const calCtx = loadBackend({
  config: {
    CALENDAR_ID: CAL,
    AVAILABILITY_PATTERN: 'Jeremy office hours',
    MIN_NOTICE_HOURS: '0',
    MAX_ADVANCE_DAYS: '3650',
    CONFLICT_CALENDAR_IDS: '',
    FREE_EVENT_PATTERNS: '',
  },
  calendarEvents: { [CAL]: events },
}, ['Calendar.gs']);

const CalendarService = calCtx.CalendarService;

test('exposes isRangeAvailable', function () {
  assert.strictEqual(typeof CalendarService.isRangeAvailable, 'function');
});

test('accepts a free 45-min interval at an off-grid start (the 10:30 regression)', function () {
  // 10:30-equivalent: starts 60 min into window, 45 min long, after the busy block.
  var ok = CalendarService.isRangeAvailable(
    new Date(winStart + 60 * MIN), new Date(winStart + 105 * MIN));
  assert.strictEqual(ok, true, 'a genuinely free interval must be bookable');
});

test('accepts a free interval running to the window end', function () {
  var ok = CalendarService.isRangeAvailable(
    new Date(winStart + 60 * MIN), new Date(winEnd));
  assert.strictEqual(ok, true);
});

test('rejects an interval overlapping a booked (busy) event', function () {
  var ok = CalendarService.isRangeAvailable(
    new Date(winStart + 15 * MIN), new Date(winStart + 60 * MIN));
  assert.strictEqual(ok, false, 'overlap with a booked event must be rejected');
});

test('rejects an interval extending past the availability window', function () {
  var ok = CalendarService.isRangeAvailable(
    new Date(winStart + 90 * MIN), new Date(winEnd + 30 * MIN));
  assert.strictEqual(ok, false);
});

test('rejects an interval with no availability window at all', function () {
  var ok = CalendarService.isRangeAvailable(
    new Date(winEnd + 5 * HOUR), new Date(winEnd + 6 * HOUR));
  assert.strictEqual(ok, false);
});

// ---------------------------------------------------------------------------
// BUG B — authoritative overlap check against the Bookings sheet
// ---------------------------------------------------------------------------
console.log('\nBUG B: BookingStore.findOverlappingConfirmed (authoritative store)');

// Build sheet rows using the real HEADERS order.
const bookCtx = loadBackend({
  config: { SPREADSHEET_ID: 'sheet-1' },
  bookingRows: [],
}, ['Booking.gs']);
const BookingStore = bookCtx.BookingStore;

function rowFor(overrides) {
  return BookingStore.HEADERS.map(function (h) {
    return Object.prototype.hasOwnProperty.call(overrides, h) ? overrides[h] : '';
  });
}

const bStart = Date.now() + 72 * HOUR;
const bEnd = bStart + 30 * MIN;

// Seed the in-memory sheet: header + one confirmed, one cancelled (overlapping), one elsewhere.
bookCtx._sheet._rows = [
  BookingStore.HEADERS.slice(),
  rowFor({ token: 'confirmed-1', status: 'confirmed',
           startTime: new Date(bStart).toISOString(), endTime: new Date(bEnd).toISOString() }),
  rowFor({ token: 'cancelled-1', status: 'cancelled',
           startTime: new Date(bStart).toISOString(), endTime: new Date(bEnd).toISOString() }),
  rowFor({ token: 'far-away', status: 'confirmed',
           startTime: new Date(bStart + 10 * HOUR).toISOString(),
           endTime: new Date(bStart + 10 * HOUR + 30 * MIN).toISOString() }),
];

test('exposes findOverlappingConfirmed', function () {
  assert.strictEqual(typeof BookingStore.findOverlappingConfirmed, 'function');
});

test('detects a confirmed booking overlapping the requested interval', function () {
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bStart + 15 * MIN).toISOString(),
    new Date(bStart + 45 * MIN).toISOString(), null);
  assert.ok(clash, 'expected a clash');
  assert.strictEqual(clash.token, 'confirmed-1');
});

test('ignores cancelled bookings', function () {
  // Remove the confirmed row, leaving only the cancelled overlapping one.
  var saved = bookCtx._sheet._rows;
  bookCtx._sheet._rows = [saved[0], saved[2]]; // header + cancelled
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bStart + 15 * MIN).toISOString(),
    new Date(bStart + 45 * MIN).toISOString(), null);
  bookCtx._sheet._rows = saved;
  assert.strictEqual(clash, null, 'cancelled bookings must not block');
});

test('returns null when nothing overlaps', function () {
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bStart + 2 * HOUR).toISOString(),
    new Date(bStart + 2 * HOUR + 30 * MIN).toISOString(), null);
  assert.strictEqual(clash, null);
});

test('respects excludeToken (for reschedule of the same booking)', function () {
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bStart).toISOString(),
    new Date(bEnd).toISOString(), 'confirmed-1');
  assert.strictEqual(clash, null, 'the booking being rescheduled must be excluded');
});

test('treats touching-but-not-overlapping intervals as free', function () {
  // Requested interval starts exactly when confirmed-1 ends.
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bEnd).toISOString(),
    new Date(bEnd + 30 * MIN).toISOString(), null);
  assert.strictEqual(clash, null, 'adjacent intervals do not overlap');
});

test('ignores rescheduled bookings', function () {
  var saved = bookCtx._sheet._rows;
  bookCtx._sheet._rows = [
    BookingStore.HEADERS.slice(),
    rowFor({ token: 'resched-1', status: 'rescheduled',
             startTime: new Date(bStart).toISOString(), endTime: new Date(bEnd).toISOString() }),
  ];
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bStart + 15 * MIN).toISOString(),
    new Date(bStart + 45 * MIN).toISOString(), null);
  bookCtx._sheet._rows = saved;
  assert.strictEqual(clash, null, 'rescheduled (superseded) bookings must not block');
});

test('detects overlap when the sheet stored times as Date objects (Sheets coercion)', function () {
  // Google Sheets can coerce an ISO datetime string back into a Date value;
  // findOverlappingConfirmed must handle Date cells, not just ISO strings.
  var saved = bookCtx._sheet._rows;
  bookCtx._sheet._rows = [
    BookingStore.HEADERS.slice(),
    rowFor({ token: 'confirmed-date', status: 'confirmed',
             startTime: new Date(bStart), endTime: new Date(bEnd) }),
  ];
  var clash = BookingStore.findOverlappingConfirmed(
    new Date(bStart + 15 * MIN).toISOString(),
    new Date(bStart + 45 * MIN).toISOString(), null);
  bookCtx._sheet._rows = saved;
  assert.ok(clash, 'expected a clash even with Date-typed cells');
  assert.strictEqual(clash.token, 'confirmed-date');
});

// ---------------------------------------------------------------------------
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
