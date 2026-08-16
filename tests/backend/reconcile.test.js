/**
 * Tests for reconcileBookings() (backend/Reconcile.gs).
 *
 * When a calendar event is deleted or moved directly on Google Calendar (not via
 * the cancel link), its Bookings row stays status='confirmed'. That "ghost" row
 * then blocks the slot in the double-booking guard. reconcileBookings() sweeps the
 * sheet and cancels every confirmed row whose calendar event no longer exists,
 * healing the drift in one pass. Run: node tests/backend/reconcile.test.js
 */

const assert = require('assert');
const { loadBackend } = require('./gas-harness');
const { createRunner } = require('./_runner');

const CAL = 'cal-primary';
const FILES = ['Booking.gs', 'Calendar.gs', 'Reconcile.gs'];

const CONFIG = {
  CALENDAR_ID: CAL,
  SPREADSHEET_ID: 'sheet-1',
};

// Build a 19-column row from a small spec, matching BookingStore.HEADERS order.
function row(headers, spec) {
  return headers.map(function (h) { return Object.prototype.hasOwnProperty.call(spec, h) ? spec[h] : ''; });
}

function makeCtx(specs) {
  const ctx = loadBackend({ config: CONFIG, bookingRows: [], calendarEvents: { [CAL]: [] } }, FILES);
  const H = ctx.BookingStore.HEADERS;
  ctx._sheet._rows = [H.slice()].concat(specs.map(function (s) { return row(H, s); }));
  return ctx;
}

// Seed a fake pre-existing calendar event with a specific id into the harness.
// deleted=true models a purged event (Events.get 404s); status='cancelled' models
// a soft-deleted event that Events.get still returns but flagged cancelled.
function seedEvent(ctx, id, deleted, status) {
  ctx._createdEvents.push({ id: id, _calendarId: CAL, _deleted: !!deleted, _resource: status ? { status: status } : {} });
}

const r = createRunner('reconcileBookings (sheet/calendar drift healer)');

r.test('cancels confirmed rows whose calendar event is missing, keeps live ones', function () {
  const ctx = makeCtx([
    { token: 't-live', eventId: 'evt-live', status: 'confirmed', startTime: '2026-09-01T14:00:00.000Z', endTime: '2026-09-01T14:15:00.000Z' },
    { token: 't-gone', eventId: 'evt-gone', status: 'confirmed', startTime: '2026-09-01T15:00:00.000Z', endTime: '2026-09-01T15:15:00.000Z' },
    { token: 't-del',  eventId: 'evt-del',  status: 'confirmed', startTime: '2026-09-01T16:00:00.000Z', endTime: '2026-09-01T16:15:00.000Z' },
    { token: 't-canc', eventId: 'evt-canc', status: 'cancelled', startTime: '2026-09-01T17:00:00.000Z', endTime: '2026-09-01T17:15:00.000Z', cancelledAt: '2026-08-01T00:00:00.000Z' },
  ]);
  seedEvent(ctx, 'evt-live', false); // still on the calendar
  // 'evt-gone' is never seeded -> getEventById returns null
  seedEvent(ctx, 'evt-del', true);   // present but deleted -> getEventById returns null

  const res = ctx.reconcileBookings();
  assert.strictEqual(res.success, true, JSON.stringify(res));
  assert.strictEqual(res.reconciled, 2, 'two ghost rows healed');

  assert.strictEqual(ctx.BookingStore.getByToken('t-live').status, 'confirmed', 'live booking untouched');
  assert.strictEqual(ctx.BookingStore.getByToken('t-gone').status, 'cancelled', 'missing-event row cancelled');
  assert.strictEqual(ctx.BookingStore.getByToken('t-del').status, 'cancelled', 'deleted-event row cancelled');
  assert.ok(ctx.BookingStore.getByToken('t-gone').cancelledAt, 'cancelledAt stamped on healed row');

  // An already-cancelled row is left exactly as it was.
  assert.strictEqual(ctx.BookingStore.getByToken('t-canc').cancelledAt, '2026-08-01T00:00:00.000Z');
});

r.test('is a no-op when every confirmed booking still has its event', function () {
  const ctx = makeCtx([
    { token: 't1', eventId: 'evt-1', status: 'confirmed', startTime: '2026-09-02T14:00:00.000Z', endTime: '2026-09-02T14:15:00.000Z' },
    { token: 't2', eventId: 'evt-2', status: 'confirmed', startTime: '2026-09-02T15:00:00.000Z', endTime: '2026-09-02T15:15:00.000Z' },
  ]);
  seedEvent(ctx, 'evt-1', false);
  seedEvent(ctx, 'evt-2', false);
  const res = ctx.reconcileBookings();
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.reconciled, 0);
  assert.strictEqual(ctx.BookingStore.getByToken('t1').status, 'confirmed');
  assert.strictEqual(ctx.BookingStore.getByToken('t2').status, 'confirmed');
});

r.test('cancels a row whose event still resolves but is status=cancelled (soft-deleted)', function () {
  const ctx = makeCtx([
    { token: 't-soft', eventId: 'evt-soft', status: 'confirmed', startTime: '2026-09-04T14:00:00.000Z', endTime: '2026-09-04T14:15:00.000Z' },
  ]);
  seedEvent(ctx, 'evt-soft', false, 'cancelled'); // Events.get returns it, flagged cancelled
  const res = ctx.reconcileBookings();
  assert.strictEqual(res.reconciled, 1, 'a cancelled-status event must count as gone');
  assert.strictEqual(ctx.BookingStore.getByToken('t-soft').status, 'cancelled');
});

r.test('never cancels a confirmed row with a blank eventId (unverifiable => keep)', function () {
  const ctx = makeCtx([
    { token: 't-blank', eventId: '', status: 'confirmed', startTime: '2026-09-03T14:00:00.000Z', endTime: '2026-09-03T14:15:00.000Z' },
  ]);
  const res = ctx.reconcileBookings();
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.reconciled, 0, 'a blank-eventId row must not be destroyed');
  assert.strictEqual(ctx.BookingStore.getByToken('t-blank').status, 'confirmed');
});

r.test('never cancels a freshly-created row even if its event is not yet visible', function () {
  const nowIso = new Date().toISOString();
  const ctx = makeCtx([
    { token: 't-fresh', eventId: 'evt-lagging', status: 'confirmed', createdAt: nowIso, startTime: '2026-09-03T15:00:00.000Z', endTime: '2026-09-03T15:15:00.000Z' },
  ]);
  // 'evt-lagging' is not seeded -> getEventById returns null (models propagation lag).
  const res = ctx.reconcileBookings();
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.reconciled, 0, 'a fresh row within the grace window must be left alone');
  assert.strictEqual(ctx.BookingStore.getByToken('t-fresh').status, 'confirmed');
});

process.exit(r.done() === 0 ? 0 : 1);
