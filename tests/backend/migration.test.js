/**
 * Tests for decodeBookingRow (backend/Migration.gs) — the schema-drift decoder.
 * Run: node tests/backend/migration.test.js
 */

const assert = require('assert');
const { loadBackend } = require('./gas-harness');
const { createRunner } = require('./_runner');

const ctx = loadBackend({ config: {} }, ['Booking.gs', 'Migration.gs']);
const decodeBookingRow = ctx.decodeBookingRow;
const HEADERS = ctx.BookingStore.HEADERS;

// Real sample rows from the live sheet.
const OLD_ROW = ['d03faeab-885c-4b4c-b3f6-4840eea8da5e','2026-06-09T04:20:03.845Z','7ghf4pi5da1c58jhu7l9ml0lf0@google.com','cancelled','office-hours','2026-03-20T18:00:00.000Z','2026-03-20T18:15:00.000Z','E2E','Test','jeremy.manning@gmail.com','virtual','https://zoom.us/test','E2E test booking','Automated test - safe to delete','2026-03-11T04:20:03.846Z','2026-03-11T04:20:09.915Z',''];
const NEW_CONFIRMED = ['d41f1a65-aa15-4cea-aecc-9888abd6c4e2','2026-07-02T03:06:13.042Z','nsarafoln7tfq1oflpeq8h917c@google.com','confirmed','project-meeting','Project meeting','','2026-04-21T17:00:00.000Z','2026-04-21T17:30:00.000Z','Fiona','Hood','fiona.h.hood.26@dartmouth.edu','in-person','Moore 349, Dartmouth College, Hanover, NH 03755','Questions about research','','2026-04-03T03:06:13.044Z'];
const NEW_CANCELLED = ['1aa02171-e3b6-4113-b6ac-d738a55a0200','2026-06-29T15:59:15.064Z','hl14296cmrcfucmtvchembs6rg@google.com','cancelled','office-hours','Office hours','','2026-04-14T17:30:00.000Z','2026-04-14T18:00:00.000Z','Jason','Kang','jason.j.kang.28@dartmouth.edu','in-person','Moore 349, Dartmouth College, Hanover, NH 03755','','2026-04-14T17:29:36.270Z','2026-03-31T15:59:15.065Z'];

const r = createRunner('decodeBookingRow (schema-drift migration)');

r.test('old aligned row decodes correctly (no meetingTypeName stored)', function () {
  var d = decodeBookingRow(OLD_ROW);
  assert.strictEqual(d.startTime, '2026-03-20T18:00:00.000Z');
  assert.strictEqual(d.endTime, '2026-03-20T18:15:00.000Z');
  assert.strictEqual(d.firstName, 'E2E');
  assert.strictEqual(d.email, 'jeremy.manning@gmail.com');
  assert.strictEqual(d.meetingTypeName, '');
  assert.strictEqual(d.createdAt, '2026-03-11T04:20:03.846Z');
  assert.strictEqual(d.cancelledAt, '2026-03-11T04:20:09.915Z');
});

r.test('new confirmed row un-shifts correctly', function () {
  var d = decodeBookingRow(NEW_CONFIRMED);
  assert.strictEqual(d.meetingTypeName, 'Project meeting');
  assert.strictEqual(d.startTime, '2026-04-21T17:00:00.000Z');
  assert.strictEqual(d.firstName, 'Fiona');
  assert.strictEqual(d.lastName, 'Hood');
  assert.strictEqual(d.email, 'fiona.h.hood.26@dartmouth.edu');
  assert.strictEqual(d.format, 'in-person');
  assert.strictEqual(d.purpose, 'Questions about research');
  assert.strictEqual(d.createdAt, '2026-04-03T03:06:13.044Z');
  assert.strictEqual(d.cancelledAt, '');
});

r.test('new cancelled row recovers createdAt/cancelledAt (notes lost)', function () {
  var d = decodeBookingRow(NEW_CANCELLED);
  assert.strictEqual(d.startTime, '2026-04-14T17:30:00.000Z');
  assert.strictEqual(d.email, 'jason.j.kang.28@dartmouth.edu');
  assert.strictEqual(d.createdAt, '2026-03-31T15:59:15.065Z');
  assert.strictEqual(d.cancelledAt, '2026-04-14T17:29:36.270Z');
  assert.strictEqual(d.notes, ''); // overwritten by the past cancel, unrecoverable
});

r.test('every decoded row maps cleanly onto the 19-column HEADERS', function () {
  [OLD_ROW, NEW_CONFIRMED, NEW_CANCELLED].forEach(function (row) {
    var d = decodeBookingRow(row);
    var mapped = HEADERS.map(function (h) { return d[h] !== undefined ? d[h] : ''; });
    assert.strictEqual(mapped.length, 19);
    assert.strictEqual(mapped[HEADERS.indexOf('token')], row[0]);
    // startTime column must hold an ISO datetime for every row after migration
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(mapped[HEADERS.indexOf('startTime')]),
      'startTime must be a real date, not a meeting-type name');
    // email column must hold an email for every row after migration
    assert.ok(mapped[HEADERS.indexOf('email')].indexOf('@') !== -1,
      'email must be a real address, not a first name');
  });
});

process.exit(r.done() === 0 ? 0 : 1);
