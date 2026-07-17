/**
 * Availability-classification tests for backend/Calendar.gs.
 *
 * These pin down how designated-calendar events are partitioned into
 * availability windows vs busy time — the logic that underpins double-booking
 * prevention. Run: node tests/backend/calendar-availability.test.js
 */

const assert = require('assert');
const { loadBackend } = require('./gas-harness');
const { createRunner } = require('./_runner');

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const CAL = 'cal-primary';
const CONFLICT = 'cal-conflict';

function ev(summary, startMs, endMs, extra) {
  return Object.assign({
    summary: summary,
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(endMs).toISOString() },
    status: 'confirmed',
  }, extra || {});
}

function allDay(summary, dateStr) {
  return { summary: summary, start: { date: dateStr }, end: { date: dateStr }, status: 'confirmed' };
}

function make(events, extraConfig, conflictEvents) {
  const calendarEvents = { [CAL]: events };
  if (conflictEvents) calendarEvents[CONFLICT] = conflictEvents;
  return loadBackend({
    config: Object.assign({
      CALENDAR_ID: CAL,
      AVAILABILITY_PATTERN: 'Jeremy office hours',
      MIN_NOTICE_HOURS: '0',
      MAX_ADVANCE_DAYS: '3650',
      CONFLICT_CALENDAR_IDS: '',
      FREE_EVENT_PATTERNS: '',
    }, extraConfig || {}),
    calendarEvents: calendarEvents,
  }, ['Calendar.gs']).CalendarService;
}

const win = Date.now() + 48 * HOUR;
const winEnd = win + 2 * HOUR;

const r = createRunner('CalendarService availability classification');

// --- The core invariant: a booked event is BUSY, never a new availability window ---
r.test('a booked event ("Name/Jeremy: Office hours") makes its time unavailable', function () {
  const svc = make([
    ev('Jeremy office hours', win, winEnd),
    ev('Sam/Jeremy: Office hours', win + 30 * MIN, win + 60 * MIN),
  ]);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), false,
    'booked time must be busy, not re-offered as availability');
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 60 * MIN), new Date(win + 90 * MIN)), true,
    'unbooked time in the same window stays available');
});

r.test('a booked event ALONE (no availability window) creates zero availability', function () {
  const svc = make([ev('Sam/Jeremy: Office hours', win + 30 * MIN, win + 60 * MIN)]);
  const slots = svc.getAvailableSlots(new Date(win), new Date(winEnd), 30);
  assert.strictEqual(slots.length, 0, 'a booking must not masquerade as an availability window');
});

r.test('getAvailableSlots excludes a booked sub-interval', function () {
  const svc = make([
    ev('Jeremy office hours', win, winEnd),
    ev('Sam/Jeremy: Office hours', win + 60 * MIN, win + 90 * MIN),
  ]);
  const starts = svc.getAvailableSlots(new Date(win), new Date(winEnd), 30)
    .map((s) => new Date(s.start).getTime());
  assert.ok(starts.indexOf(win + 30 * MIN) !== -1, 'free slot present');
  assert.ok(starts.indexOf(win + 60 * MIN) === -1, 'booked slot absent');
});

// --- Non-bookable event shapes are ignored ---
r.test('all-day events are ignored (neither availability nor busy)', function () {
  const dateStr = new Date(win).toISOString().slice(0, 10);
  const svc = make([
    ev('Jeremy office hours', win, winEnd),
    allDay('Conference (all day)', dateStr),
  ]);
  // An all-day "busy"-looking event must not blanket-block the window.
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), true);
});

r.test('cancelled events are ignored', function () {
  const svc = make([
    ev('Jeremy office hours', win, winEnd),
    ev('Sam/Jeremy: Office hours', win + 30 * MIN, win + 60 * MIN, { status: 'cancelled' }),
  ]);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), true,
    'a cancelled booking must not block');
});

r.test('an event the owner declined does not count as busy', function () {
  const svc = make([
    ev('Jeremy office hours', win, winEnd),
    ev('Optional talk', win + 30 * MIN, win + 60 * MIN,
      { attendees: [{ self: true, responseStatus: 'declined' }] }),
  ]);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), true);
});

// --- Free-event patterns ---
r.test('a transparent event matching FREE_EVENT_PATTERNS opens availability', function () {
  const svc = make(
    [ev('Gym', win, win + HOUR, { transparency: 'transparent' })],
    { FREE_EVENT_PATTERNS: '["gym"]' });
  assert.strictEqual(svc.isRangeAvailable(new Date(win), new Date(win + 30 * MIN)), true,
    'free-marked pattern event should be bookable availability');
});

r.test('a free-pattern event that is NOT transparent does not open availability', function () {
  const svc = make(
    [ev('Gym', win, win + HOUR)], // opaque
    { FREE_EVENT_PATTERNS: '["gym"]' });
  assert.strictEqual(svc.isRangeAvailable(new Date(win), new Date(win + 30 * MIN)), false);
});

// --- Conflict calendars ---
r.test('an opaque conflict-calendar event blocks availability', function () {
  const svc = make(
    [ev('Jeremy office hours', win, winEnd)],
    { CONFLICT_CALENDAR_IDS: JSON.stringify([CONFLICT]) },
    [ev('Dentist', win + 30 * MIN, win + 60 * MIN)]);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), false);
});

r.test('a transparent conflict-calendar event does NOT block availability', function () {
  const svc = make(
    [ev('Jeremy office hours', win, winEnd)],
    { CONFLICT_CALENDAR_IDS: JSON.stringify([CONFLICT]) },
    [ev('Tentative', win + 30 * MIN, win + 60 * MIN, { transparency: 'transparent' })]);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), true);
});

// --- Min-notice / max-advance boundaries on isRangeAvailable ---
r.test('isRangeAvailable rejects slots before the min-notice horizon', function () {
  const svc = make([ev('Jeremy office hours', win, winEnd)], { MIN_NOTICE_HOURS: '72' });
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), false);
});

r.test('isRangeAvailable rejects slots beyond the max-advance horizon', function () {
  // Window is 48h out; cap advance at 1 day so it is out of range.
  const svc = make([ev('Jeremy office hours', win, winEnd)], { MAX_ADVANCE_DAYS: '1' });
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 60 * MIN)), false);
});

r.test('isRangeAvailable rejects a zero-length or inverted interval', function () {
  const svc = make([ev('Jeremy office hours', win, winEnd)]);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 30 * MIN), new Date(win + 30 * MIN)), false);
  assert.strictEqual(svc.isRangeAvailable(new Date(win + 60 * MIN), new Date(win + 30 * MIN)), false);
});

process.exit(r.done() === 0 ? 0 : 1);
