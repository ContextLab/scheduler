/**
 * One-time migration for the Bookings sheet schema drift.
 *
 * The sheet header is the original 17-column schema, but the code's
 * BookingStore.HEADERS grew to 19 columns when `meetingTypeName` (index 5) and
 * `eventLabel` (index 6) were added. Every booking written after that change is
 * stored shifted +2, which scrambles reads (cancel/reschedule/getBooking) and
 * silently defeats the double-booking overlap check.
 *
 * migrateBookingsSheet():
 *   1. no-ops if the header already matches HEADERS,
 *   2. backs up the current sheet to "Bookings_backup_<timestamp>",
 *   3. decodes every row to the canonical 19 fields (detecting old vs new
 *      layout, and undoing the notes/createdAt overwrites that past cancel/
 *      reschedule operations caused on shifted rows),
 *   4. rewrites the Bookings sheet aligned to HEADERS.
 *
 * Run from the Apps Script editor or `clasp run migrateBookingsSheet`.
 *
 * Known loss: on NEW-layout rows that were later cancelled, the past cancel
 * overwrote the `notes` cell with the cancellation timestamp, so those notes
 * are unrecoverable and become blank. Everything else is preserved.
 */
function migrateBookingsSheet() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, error: 'Could not acquire lock; try again.' };
  }
  try {
    var ss = SpreadsheetApp.openById(Config.get('SPREADSHEET_ID'));
    var sheet = ss.getSheetByName('Bookings');
    if (!sheet) return { success: false, error: 'No Bookings sheet found.' };

    var data = sheet.getDataRange().getValues();
    if (data.length < 1) return { success: false, error: 'Sheet is empty.' };

    var HEADERS = BookingStore.HEADERS;
    var header = data[0].map(function (h) { return String(h); });

    if (header.length === HEADERS.length && header.join('|') === HEADERS.join('|')) {
      return { success: true, migrated: 0, note: 'Header already matches HEADERS; nothing to do.' };
    }

    var backupName = 'Bookings_backup_' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    sheet.copyTo(ss).setName(backupName);

    var rows = [HEADERS.slice()];
    var migrated = 0;
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // skip blank rows (no token)
      var b = decodeBookingRow(data[i]);
      rows.push(HEADERS.map(function (h) { return b[h] !== undefined && b[h] !== null ? b[h] : ''; }));
      migrated++;
    }

    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);

    return { success: true, migrated: migrated, backup: backupName };
  } finally {
    lock.releaseLock();
  }
}

function isIsoDateValue(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
}

/**
 * Decode one raw sheet row (17- or 19-wide) into the canonical field object.
 * col6 (index 5) discriminates: an ISO datetime => old aligned layout;
 * a name (meetingTypeName) => new shifted layout.
 */
function decodeBookingRow(c) {
  var out = {};
  var newLayout = !isIsoDateValue(c[5]);

  if (!newLayout) {
    out.token = c[0]; out.tokenExpiresAt = c[1]; out.eventId = c[2]; out.status = c[3];
    out.meetingTypeId = c[4]; out.meetingTypeName = ''; out.eventLabel = '';
    out.startTime = c[5]; out.endTime = c[6]; out.firstName = c[7]; out.lastName = c[8];
    out.email = c[9]; out.format = c[10]; out.location = c[11]; out.purpose = c[12];
    out.notes = c[13]; out.createdAt = c[14];
    out.cancelledAt = c[15] || ''; out.rescheduledTo = c[16] || '';
    return out;
  }

  out.token = c[0]; out.tokenExpiresAt = c[1]; out.eventId = c[2]; out.status = c[3];
  out.meetingTypeId = c[4]; out.meetingTypeName = c[5]; out.eventLabel = c[6];
  out.startTime = c[7]; out.endTime = c[8]; out.firstName = c[9]; out.lastName = c[10];
  out.email = c[11]; out.format = c[12]; out.location = c[13]; out.purpose = c[14];

  if (c[3] === 'cancelled') {
    // Past cancel overwrote the notes slot (c[15]) with cancelledAt; createdAt at c[16].
    out.notes = ''; out.createdAt = c[16] || ''; out.cancelledAt = c[15] || ''; out.rescheduledTo = '';
  } else if (c[3] === 'rescheduled') {
    // Past reschedule overwrote the createdAt slot (c[16]) with rescheduledTo.
    out.notes = c[15] || ''; out.createdAt = ''; out.cancelledAt = ''; out.rescheduledTo = c[16] || '';
  } else {
    out.notes = c[15] || ''; out.createdAt = c[16] || '';
    out.cancelledAt = c[17] || ''; out.rescheduledTo = c[18] || '';
  }
  return out;
}
