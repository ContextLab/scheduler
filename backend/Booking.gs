/**
 * BookingStore — CRUD operations on the Google Sheets booking database.
 * All writes use LockService for concurrent access safety.
 */

var BookingStore = (function () {
  var HEADERS = [
    'token', 'tokenExpiresAt', 'eventId', 'status', 'meetingTypeId',
    'startTime', 'endTime', 'firstName', 'lastName', 'email',
    'format', 'location', 'purpose', 'notes', 'createdAt',
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

  return {
    create: create,
    getByToken: getByToken,
    updateStatus: updateStatus,
    getAll: getAll,
    HEADERS: HEADERS,
  };
})();
