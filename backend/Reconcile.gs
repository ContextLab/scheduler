/**
 * Sheet/calendar drift reconciliation.
 *
 * When a booking's calendar event is deleted or moved directly on Google Calendar
 * (instead of through the cancel/reschedule links), its Bookings row is left with
 * status='confirmed'. That "ghost" row then blocks the freed slot in the
 * double-booking guard (findOverlappingConfirmed) and misrepresents the schedule.
 *
 * reconcileBookings() sweeps every confirmed row and cancels the ones whose
 * calendar event no longer exists, healing the drift in a single pass. It is
 * idempotent and safe to re-run (and to wire to a time-based trigger).
 *
 * It is deliberately CONSERVATIVE — it never cancels a row it cannot positively
 * prove is stale, so it can't destroy a live booking:
 *   - Rows younger than GHOST_GRACE_MINUTES are skipped (a just-created event can
 *     lag in getEventById; and a genuine ghost is never brand new).
 *   - Rows with a blank/unverifiable eventId are skipped (can't prove it's gone).
 *   - A getEventById error skips the row (transient failure != deleted).
 * Only an old row whose non-blank eventId resolves to nothing is cancelled.
 *
 * Note: it intentionally does NOT email the guest — the calendar event is already
 * gone, so there is nothing to un-book; this is a data-hygiene sweep.
 *
 * Reads the sheet once and writes once (batched) to stay within execution limits
 * on large sheets. Run from the Apps Script editor or `clasp run reconcileBookings`.
 */
function reconcileBookings() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, error: 'Could not acquire lock; try again.' };
  }
  try {
    var ss = SpreadsheetApp.openById(Config.get('SPREADSHEET_ID'));
    var sheet = ss.getSheetByName('Bookings');
    if (!sheet) return { success: false, error: 'No Bookings sheet found.' };

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, checked: 0, reconciled: 0, healed: [] };

    var header = data[0].map(function (h) { return String(h); });
    var statusCol = header.indexOf('status');
    var eventIdCol = header.indexOf('eventId');
    var createdAtCol = header.indexOf('createdAt');
    var cancelledAtCol = header.indexOf('cancelledAt');
    var tokenCol = header.indexOf('token');
    var startCol = header.indexOf('startTime');
    var endCol = header.indexOf('endTime');
    var emailCol = header.indexOf('email');
    if (statusCol === -1 || eventIdCol === -1) {
      return { success: false, error: 'Unexpected sheet schema (missing status/eventId column).' };
    }

    var graceMs = (parseInt(Config.get('GHOST_GRACE_MINUTES'), 10) || 10) * 60 * 1000;
    var now = Date.now();
    var nowIso = new Date().toISOString();

    var checked = 0, reconciled = 0, healed = [], changed = false;

    for (var i = 1; i < data.length; i++) {
      var rowVals = data[i];
      if (String(rowVals[statusCol]) !== 'confirmed') continue;
      checked++;

      var eventId = rowVals[eventIdCol];
      if (!eventId) continue; // unverifiable -> never destroy

      if (createdAtCol !== -1) {
        var created = new Date(rowVals[createdAtCol]).getTime();
        if (!isNaN(created) && (now - created) < graceMs) continue; // too fresh to trust as a ghost
      }

      // Leave history alone: reconciliation exists to free FUTURE bookable slots
      // that a deleted event is blocking. A past meeting's slot isn't bookable, and
      // its event being gone may just mean the meeting happened and was tidied up —
      // marking a completed booking 'cancelled' would misrepresent it.
      if (endCol !== -1) {
        var endMs = new Date(rowVals[endCol]).getTime();
        if (!isNaN(endMs) && endMs < now) continue;
      }

      // Existence check over the booking's window (active events only). Fails
      // closed on any transient/uncertain error, so we only ever cancel a row
      // whose event is definitively gone.
      if (CalendarService.eventIsActive(eventId, rowVals[startCol], rowVals[endCol])) continue;

      rowVals[statusCol] = 'cancelled';
      if (cancelledAtCol !== -1) rowVals[cancelledAtCol] = nowIso;
      reconciled++;
      changed = true;
      healed.push({
        token: tokenCol !== -1 ? rowVals[tokenCol] : '',
        startTime: startCol !== -1 ? rowVals[startCol] : '',
        email: emailCol !== -1 ? rowVals[emailCol] : '',
      });
    }

    if (changed) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    return { success: true, checked: checked, reconciled: reconciled, healed: healed };
  } finally {
    lock.releaseLock();
  }
}
