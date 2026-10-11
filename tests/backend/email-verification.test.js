/**
 * Tests for the email-verification gate on new bookings (backend/Code.gs).
 *
 * Non-legitimate bookings (throwaway names/addresses, keyboard-mash notes) were
 * landing straight on the calendar, sending invites to arbitrary addresses and
 * notifying the owner. With verification on (the default), createBooking only
 * records a PENDING request and emails the visitor a confirm link; the meeting
 * is created by confirmBooking once they click through. Pending requests never
 * hold the slot, so unverified spam can't squat times.
 *
 * Run: node tests/backend/email-verification.test.js
 */

const assert = require('assert');
const { loadBackend, parseResponse } = require('./gas-harness');
const { createRunner } = require('./_runner');

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const CAL = 'cal-primary';

const CONFIG = {
  CALENDAR_ID: CAL,
  OWNER_NAME: 'Jeremy Manning',
  GITHUB_PAGES_URL: 'https://pages.example/booking',
  AVAILABILITY_PATTERN: 'Jeremy office hours',
  MIN_NOTICE_HOURS: '0',
  MAX_ADVANCE_DAYS: '3650',
  SPREADSHEET_ID: 'sheet-1',
  TOKEN_EXPIRY_DAYS: '90',
  // REQUIRE_EMAIL_VERIFICATION deliberately unset: verification must be ON by default.
};

const FILES = ['Booking.gs', 'Calendar.gs', 'Token.gs', 'Code.gs', 'Reconcile.gs'];

function makeCtx(config, harnessOpts) {
  harnessOpts = harnessOpts || {};
  const winStart = harnessOpts.winStart || Date.now() + 48 * HOUR;
  const ctx = loadBackend({
    mailQuota: harnessOpts.mailQuota,
    verifyEmailFails: harnessOpts.verifyEmailFails,
    config: Object.assign({}, CONFIG, config || {}),
    calendarEvents: { [CAL]: [{
      summary: 'Jeremy office hours',
      start: { dateTime: new Date(winStart).toISOString() },
      end: { dateTime: new Date(winStart + 2 * HOUR).toISOString() },
      status: 'confirmed',
    }] },
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

let clientSeq = 0;
function create(ctx, offsetMin, durMin, extra) {
  const s = ctx._winStart + offsetMin * MIN;
  return post(ctx, Object.assign({
    action: 'createBooking', clientId: 'c' + (++clientSeq),
    meetingTypeId: 'office-hours', meetingTypeName: 'Office hours',
    start: new Date(s).toISOString(), end: new Date(s + durMin * MIN).toISOString(),
    firstName: 'Sam', lastName: 'Student', email: 'sam@example.edu',
    format: 'virtual', location: 'https://zoom.example/x',
  }, extra || {}));
}

function confirm(ctx, token) {
  return post(ctx, { action: 'confirmBooking', clientId: 'c' + (++clientSeq), token: token });
}

function pendingToken(ctx, email) {
  const rows = ctx.BookingStore.getAll().filter(function (b) { return b.status === 'pending' && (!email || b.email === email); });
  assert.ok(rows.length, 'expected a pending row');
  return rows[rows.length - 1].token;
}

function ageRow(ctx, token, minutes) {
  const H = ctx.BookingStore.HEADERS;
  const row = ctx._sheet._rows.find(function (rr) { return rr[H.indexOf('token')] === token; });
  row[H.indexOf('createdAt')] = new Date(Date.now() - minutes * MIN).toISOString();
}

// Simulate calendar read-after-write lag: the event exists but isn't yet visible
// to CalendarApp.getEvents (the harness skips events without a start).
function hideEvent(ctx, eventId) {
  ctx._createdEvents.forEach(function (e) { if (e.id === eventId) e.start = undefined; });
}

const r = createRunner('Email verification gate (createBooking -> confirmBooking)');

r.test('createBooking only records a pending request and emails a confirm link', function () {
  const ctx = makeCtx();
  const res = create(ctx, 0, 30);
  assert.strictEqual(res.success, true, JSON.stringify(res));
  assert.strictEqual(res.pending, true);
  assert.strictEqual(res.booking.token, undefined, 'token must only travel via the email');
  assert.strictEqual(res.booking.cancelUrl, undefined);

  assert.strictEqual(ctx._createdEvents.length, 0, 'no calendar event / invite before verification');
  assert.deepStrictEqual(ctx._sentEmails.map(function (e) { return e.type; }), ['verify'],
    'only the verification email is sent (no confirmation, no owner notification)');
  const rows = ctx.BookingStore.getAll();
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].status, 'pending');
  assert.strictEqual(rows[0].eventId, '');
});

r.test('confirmBooking creates the event, confirms the row, and sends the normal emails', function () {
  const ctx = makeCtx();
  create(ctx, 0, 30);
  const token = pendingToken(ctx);
  const res = confirm(ctx, token);
  assert.strictEqual(res.success, true, JSON.stringify(res));
  assert.strictEqual(res.booking.token, token);
  assert.ok(/cancel\.html\?token=/.test(res.booking.cancelUrl));
  assert.ok(/reschedule\.html\?token=/.test(res.booking.rescheduleUrl));

  assert.strictEqual(ctx._createdEvents.length, 1);
  assert.strictEqual(ctx._createdEvents[0].options.guests, 'sam@example.edu');
  assert.strictEqual(ctx._createdEvents[0].options.sendInvites, true);
  const row = ctx.BookingStore.getByToken(token);
  assert.strictEqual(row.status, 'confirmed');
  assert.strictEqual(row.eventId, ctx._createdEvents[0].id);
  assert.deepStrictEqual(ctx._sentEmails.map(function (e) { return e.type; }), ['verify', 'confirm']);
});

r.test('confirming twice is idempotent (no second event or email)', function () {
  const ctx = makeCtx();
  create(ctx, 0, 30);
  const token = pendingToken(ctx);
  confirm(ctx, token);
  const again = confirm(ctx, token);
  assert.strictEqual(again.success, true);
  assert.strictEqual(again.alreadyConfirmed, true);
  assert.strictEqual(ctx._createdEvents.length, 1);
  assert.strictEqual(ctx._sentEmails.filter(function (e) { return e.type === 'confirm'; }).length, 1);
});

r.test('an unverified request does NOT hold the slot (spam cannot squat times)', function () {
  const ctx = makeCtx();
  create(ctx, 0, 30, { email: 'spam@throwaway.example' });
  const res = create(ctx, 0, 30, { email: 'real@example.edu' });
  assert.strictEqual(res.success, true, 'a second visitor can still request the same time');
  const real = pendingToken(ctx, 'real@example.edu');
  assert.strictEqual(confirm(ctx, real).success, true, 'and the one who verifies gets it');
});

r.test('first to verify wins; a later confirm of the same slot is SLOT_TAKEN', function () {
  const ctx = makeCtx();
  create(ctx, 0, 30, { email: 'a@example.edu' });
  create(ctx, 15, 30, { email: 'b@example.edu' }); // overlaps a's slot
  const ta = pendingToken(ctx, 'a@example.edu');
  const tb = pendingToken(ctx, 'b@example.edu');
  assert.strictEqual(confirm(ctx, tb).success, true);
  const lost = confirm(ctx, ta);
  assert.strictEqual(lost.success, false);
  assert.strictEqual(lost.error, 'SLOT_TAKEN');
  assert.strictEqual(ctx._createdEvents.length, 1, 'no double-booking');
  assert.strictEqual(ctx.BookingStore.getByToken(ta).status, 'expired');
});

r.test('a confirmed booking blocks new requests for that time immediately', function () {
  const ctx = makeCtx();
  create(ctx, 0, 30);
  confirm(ctx, pendingToken(ctx));
  const res = create(ctx, 0, 30, { email: 'other@example.edu' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'SLOT_TAKEN');
});

r.test('an expired link is rejected and nothing is booked', function () {
  const ctx = makeCtx({ VERIFY_LINK_MINUTES: '60' });
  create(ctx, 0, 30);
  const token = pendingToken(ctx);
  // Age the request past the link lifetime.
  const H = ctx.BookingStore.HEADERS;
  ctx._sheet._rows[1][H.indexOf('createdAt')] = new Date(Date.now() - 61 * MIN).toISOString();
  const res = confirm(ctx, token);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'EXPIRED');
  assert.strictEqual(ctx._createdEvents.length, 0);
  assert.strictEqual(ctx.BookingStore.getByToken(token).status, 'expired');
  assert.strictEqual(confirm(ctx, token).error, 'ALREADY_CANCELLED', 'stays dead');
});

r.test('unknown / missing tokens are rejected', function () {
  const ctx = makeCtx();
  assert.strictEqual(confirm(ctx, 'nope').error, 'NOT_FOUND');
  assert.strictEqual(post(ctx, { action: 'confirmBooking', clientId: 'x' }).error, 'VALIDATION_ERROR');
});

r.test('cancelling a pending request sends no emails and touches no calendar', function () {
  const ctx = makeCtx();
  create(ctx, 0, 30);
  const token = pendingToken(ctx);
  const res = post(ctx, { action: 'cancelBooking', clientId: 'x', token: token });
  assert.strictEqual(res.success, true, JSON.stringify(res));
  assert.strictEqual(ctx.BookingStore.getByToken(token).status, 'cancelled');
  assert.deepStrictEqual(ctx._sentEmails.map(function (e) { return e.type; }), ['verify']);
  assert.strictEqual(confirm(ctx, token).error, 'ALREADY_CANCELLED', 'a cancelled request cannot be confirmed');
});

r.test('the honeypot still rejects before anything is stored or emailed', function () {
  const ctx = makeCtx();
  const res = create(ctx, 0, 30, { hp: 'http://spam.example' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(ctx.BookingStore.getAll().length, 0);
  assert.strictEqual(ctx._sentEmails.length, 0);
});

r.test('REQUIRE_EMAIL_VERIFICATION=false finalizes immediately (opt-out)', function () {
  const ctx = makeCtx({ REQUIRE_EMAIL_VERIFICATION: 'false' });
  const res = create(ctx, 0, 30);
  assert.strictEqual(res.success, true);
  assert.ok(!res.pending);
  assert.ok(res.booking.cancelUrl);
  assert.strictEqual(ctx._createdEvents.length, 1);
  assert.strictEqual(ctx.BookingStore.getAll()[0].status, 'confirmed');
  assert.deepStrictEqual(ctx._sentEmails.map(function (e) { return e.type; }), ['confirm']);
});

r.test('a link confirmed >GHOST_GRACE after the request is not mistaken for a ghost (no double-booking)', function () {
  const ctx = makeCtx({ GHOST_GRACE_MINUTES: '10' });
  create(ctx, 0, 30, { email: 'a@example.edu' });
  create(ctx, 0, 30, { email: 'b@example.edu' });
  const ta = pendingToken(ctx, 'a@example.edu');
  const tb = pendingToken(ctx, 'b@example.edu');
  ageRow(ctx, ta, 20); // A verifies 20 minutes after requesting
  assert.strictEqual(confirm(ctx, ta).success, true);
  hideEvent(ctx, ctx.BookingStore.getByToken(ta).eventId); // A's new event still propagating
  const res = confirm(ctx, tb);
  assert.strictEqual(res.error, 'SLOT_TAKEN', 'the fresh confirmed row must be trusted: ' + JSON.stringify(res));
  assert.strictEqual(ctx.BookingStore.getAll().filter(function (b) { return b.status === 'confirmed'; }).length, 1);
});

r.test('reconcile does not cancel a just-confirmed booking whose event is still propagating', function () {
  const ctx = makeCtx({ GHOST_GRACE_MINUTES: '10' });
  create(ctx, 0, 30);
  const t = pendingToken(ctx);
  ageRow(ctx, t, 30);
  confirm(ctx, t);
  hideEvent(ctx, ctx.BookingStore.getByToken(t).eventId);
  assert.strictEqual(ctx.reconcileBookings().reconciled, 0);
  assert.strictEqual(ctx.BookingStore.getByToken(t).status, 'confirmed');
});

r.test('min-notice is measured from the request, so confirming later does not fail a near-limit slot', function () {
  const ctx = makeCtx({ MIN_NOTICE_HOURS: '12' }, { winStart: Date.now() + 11 * HOUR + 50 * MIN });
  const res = create(ctx, 15, 30); // slot at now+12h05m: just past the notice limit
  assert.strictEqual(res.success, true, JSON.stringify(res));
  const t = pendingToken(ctx);
  // Simulate the visitor clicking the link 10 minutes later: the request is 10
  // minutes old and the slot is 10 minutes closer (now+11h55m, inside 12h notice).
  ageRow(ctx, t, 10);
  const H = ctx.BookingStore.HEADERS;
  const row = ctx._sheet._rows[1];
  ['startTime', 'endTime'].forEach(function (k) {
    row[H.indexOf(k)] = new Date(new Date(row[H.indexOf(k)]).getTime() - 10 * MIN).toISOString();
  });
  const c = confirm(ctx, t);
  assert.strictEqual(c.success, true, JSON.stringify(c));
});

r.test('a slot that is already in the past at confirm time is still rejected', function () {
  // Requested 13h ago (so request-relative notice would allow a start 1h ago),
  // inside an availability window that spans now; the start has since passed.
  const ctx = makeCtx({ MIN_NOTICE_HOURS: '12', VERIFY_LINK_MINUTES: '100000' }, { winStart: Date.now() - HOUR });
  const H = ctx.BookingStore.HEADERS;
  const spec = { token: 'past-1', status: 'pending', email: 'p@example.edu', firstName: 'P', lastName: 'Q',
    meetingTypeId: 'office-hours', startTime: new Date(Date.now() - 30 * MIN).toISOString(),
    endTime: new Date(Date.now()).toISOString(), createdAt: new Date(Date.now() - 13 * HOUR).toISOString() };
  ctx._sheet._rows.push(H.map(function (h) { return spec[h] || ''; }));
  const res = confirm(ctx, 'past-1');
  assert.strictEqual(res.success, false, JSON.stringify(res));
  assert.strictEqual(ctx._createdEvents.length, 0);
});

r.test('if the verification email fails to send, the visitor is told (not "check your email")', function () {
  const ctx = makeCtx({}, { verifyEmailFails: true });
  const res = create(ctx, 0, 30);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'EMAIL_UNAVAILABLE');
  assert.strictEqual(ctx.BookingStore.getAll()[0].status, 'cancelled');
});

r.test('with the MailApp quota exhausted, nothing is stored and the visitor is told', function () {
  const ctx = makeCtx({}, { mailQuota: 0 });
  const res = create(ctx, 0, 30);
  assert.strictEqual(res.error, 'EMAIL_UNAVAILABLE');
  assert.strictEqual(ctx.BookingStore.getAll().length, 0);
});

process.exit(r.done() ? 1 : 0);
