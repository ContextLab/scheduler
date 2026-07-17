/**
 * BookingStore — CRUD operations on the Google Sheets booking database.
 * All writes use LockService for concurrent access safety.
 */

var BookingStore = (function () {
  var HEADERS = [
    'token', 'tokenExpiresAt', 'eventId', 'status', 'meetingTypeId',
    'meetingTypeName', 'eventLabel', 'startTime', 'endTime', 'firstName', 'lastName',
    'email', 'format', 'location', 'purpose', 'notes', 'createdAt',
    'cancelledAt', 'rescheduledTo',
  ];

  function getSheet() {
    var spreadsheetId = Config.get('SPREADSHEET_ID');
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID not configured in Script Properties');
    }
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('Bookings');
    if (!sheet) {
      sheet = ss.insertSheet('Bookings');
      sheet.appendRow(HEADERS);
    }
    return sheet;
  }

  function create(bookingData) {
    var sheet = getSheet();
    var row = HEADERS.map(function (h) {
      return bookingData[h] || '';
    });
    sheet.appendRow(row);
    return bookingData;
  }

  function getByToken(token) {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null; // Only headers

    var headerRow = data[0];
    var tokenCol = headerRow.indexOf('token');
    if (tokenCol === -1) return null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][tokenCol] === token) {
        var booking = {};
        for (var j = 0; j < headerRow.length; j++) {
          booking[headerRow[j]] = data[i][j];
        }
        return booking;
      }
    }
    return null;
  }

  function updateStatus(token, newStatus, extraFields) {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;

    var headerRow = data[0];
    var tokenCol = headerRow.indexOf('token');
    var statusCol = headerRow.indexOf('status');
    if (tokenCol === -1 || statusCol === -1) return false;

    for (var i = 1; i < data.length; i++) {
      if (data[i][tokenCol] === token) {
        var rowNum = i + 1; // 1-indexed
        sheet.getRange(rowNum, statusCol + 1).setValue(newStatus);

        if (extraFields) {
          for (var field in extraFields) {
            var col = headerRow.indexOf(field);
            if (col !== -1) {
              sheet.getRange(rowNum, col + 1).setValue(extraFields[field]);
            }
          }
        }
        return true;
      }
    }
    return false;
  }

  function getAll() {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    var headerRow = data[0];
    var bookings = [];
    for (var i = 1; i < data.length; i++) {
      var booking = {};
      for (var j = 0; j < headerRow.length; j++) {
        booking[headerRow[j]] = data[i][j];
      }
      bookings.push(booking);
    }
    return bookings;
  }

  /**
   * Find a confirmed booking whose time range overlaps [startISO, endISO].
   *
   * This is the authoritative, immediately-consistent double-booking guard:
   * unlike the calendar (read back through the eventually-consistent
   * Calendar.Events.list service), a row written here under the script lock is
   * visible to the very next request. Call this inside LockService, before
   * creating the calendar event.
   *
   * @param {string} startISO   requested start (ISO 8601)
   * @param {string} endISO     requested end (ISO 8601)
   * @param {string} excludeToken  token to ignore (e.g. the booking being
   *                                rescheduled); pass null/'' to check all.
   * @return {object|null} the clashing booking, or null if the slot is free.
   */
  function findOverlappingConfirmed(startISO, endISO, excludeToken) {
    var reqStart = new Date(startISO).getTime();
    var reqEnd = new Date(endISO).getTime();
    if (isNaN(reqStart) || isNaN(reqEnd)) return null;

    var all = getAll();
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      if (b.status !== 'confirmed') continue;
      if (excludeToken && b.token === excludeToken) continue;

      // startTime/endTime may come back as ISO strings or as Date values
      // (Sheets can auto-coerce datetime-looking cells); new Date() handles both.
      var bStart = new Date(b.startTime).getTime();
      var bEnd = new Date(b.endTime).getTime();
      if (isNaN(bStart) || isNaN(bEnd)) continue;

      // Half-open overlap: touching intervals (a.end === b.start) do not clash.
      if (reqStart < bEnd && bStart < reqEnd) return b;
    }
    return null;
  }

  function deleteOldBookings(olderThanDays) {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 0;

    var headerRow = data[0];
    var startTimeCol = headerRow.indexOf('startTime');
    if (startTimeCol === -1) return 0;

    var cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    var deletedCount = 0;

    // Walk rows bottom-up so deleting doesn't shift indices
    for (var i = data.length - 1; i >= 1; i--) {
      var startTime = new Date(data[i][startTimeCol]);
      if (startTime < cutoff) {
        sheet.deleteRow(i + 1); // 1-indexed
        deletedCount++;
      }
    }
    return deletedCount;
  }

  return {
    create: create,
    getByToken: getByToken,
    updateStatus: updateStatus,
    getAll: getAll,
    findOverlappingConfirmed: findOverlappingConfirmed,
    deleteOldBookings: deleteOldBookings,
    HEADERS: HEADERS,
  };
})();
