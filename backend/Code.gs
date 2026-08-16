/**
 * Main Apps Script entry point — doGet/doPost handlers and request routing.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'health') {
    return jsonResponse({
      status: 'ok',
      version: '1.0.0',
      quotas: {
        emails_remaining: MailApp.getRemainingDailyQuota(),
        daily_email_limit: 50,
      },
    });
  }

  // Throttle the key-gated admin actions so the CLEANUP_KEY can't be brute-forced
  // through the unauthenticated web app.
  if (action === 'cleanup' || action === 'debug') {
    if (!rateBump(CacheService.getScriptCache(), 'rlg_' + action, 10, 60)) {
      return jsonResponse({ success: false, error: 'RATE_LIMITED', message: 'Too many requests.' });
    }
  }

  if (action === 'cleanup') {
    var key = (e && e.parameter && e.parameter.key) || '';
    var cleanupKey = Config.get('CLEANUP_KEY');
    if (!cleanupKey || key !== cleanupKey) {
      return jsonResponse({ success: false, error: 'UNAUTHORIZED', message: 'Invalid cleanup key' });
    }
    var deleted = BookingStore.deleteOldBookings(30);
    return jsonResponse({ success: true, deleted: deleted });
  }

  if (action === 'debug') {
    var debugKey = (e && e.parameter && e.parameter.key) || '';
    var cleanupKey = Config.get('CLEANUP_KEY');
    if (!cleanupKey || debugKey !== cleanupKey) {
      return jsonResponse({ success: false, error: 'UNAUTHORIZED' });
    }
    return jsonResponse({ success: true, debug: CalendarService.debug(
      new Date((e && e.parameter && e.parameter.start) || Date.now()),
      new Date((e && e.parameter && e.parameter.end) || (Date.now() + 7 * 24 * 60 * 60 * 1000))
    )});
  }

  return jsonResponse({ success: false, error: 'UNKNOWN_ACTION', message: 'Unknown action: ' + action });
}

function doPost(e) {
  // CORS origin validation
  var origin = e && e.parameter && e.parameter.origin;
  var allowedOrigin = Config.get('GITHUB_PAGES_URL');
  // Note: Apps Script web apps receive redirected POST requests,
  // so origin header may not always be available. We validate when present.

  var requestData;
  try {
    requestData = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'PARSE_ERROR', message: 'Invalid JSON in request body' });
  }

  var action = requestData.action;
  if (!action) {
    return jsonResponse({ success: false, error: 'MISSING_ACTION', message: 'Request must include an action field' });
  }

  try {
    // Rate limiting via CacheService. Buckets are keyed PER CLIENT so a busy
    // period (e.g. a whole class opening the booking link at once) can't let one
    // visitor exhaust a shared bucket and lock everyone else out — the bug that
    // made real bookings fail with no event and no email. Kept inside the
    // try/catch so a transient CacheService/Config error degrades to a clean JSON
    // error, never an unparseable 500.
    if (!rateLimitOk(action, requestData)) {
      return jsonResponse({ success: false, error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute and try again.' });
    }

    switch (action) {
      case 'getAvailableSlots':
        return handleGetAvailableSlots(requestData);
      case 'createBooking':
        return handleCreateBooking(requestData);
      case 'cancelBooking':
        return handleCancelBooking(requestData);
      case 'getBooking':
        return handleGetBooking(requestData);
      case 'rescheduleBooking':
        return handleRescheduleBooking(requestData);
      default:
        return jsonResponse({ success: false, error: 'UNKNOWN_ACTION', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    Logger.log('Error handling action ' + action + ': ' + err.message + '\n' + err.stack);
    return jsonResponse({ success: false, error: 'INTERNAL_ERROR', message: 'An internal error occurred. Please try again.' });
  }
}

function handleGetAvailableSlots(data) {
  if (!data.startDate || !data.endDate || !data.durationMinutes) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'startDate, endDate, and durationMinutes are required' });
  }

  var startDate = new Date(data.startDate);
  var endDate = new Date(data.endDate);
  var duration = parseInt(data.durationMinutes, 10);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Invalid date format' });
  }
  if ([15, 30, 45, 60].indexOf(duration) === -1) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Duration must be 15, 30, 45, or 60 minutes' });
  }

  var slots = CalendarService.getAvailableSlots(startDate, endDate, duration);
  return jsonResponse({ success: true, slots: slots });
}

function handleCreateBooking(data) {
  // Honeypot: a hidden form field real users never see. A filled value means an
  // automated bot walked the form, so reject before doing any work — no event,
  // no row, no email. The message is deliberately generic so bots can't tell the
  // honeypot tripped them.
  if (data.hp) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Your booking could not be processed.' });
  }

  // Validate required fields
  var required = ['meetingTypeId', 'meetingTypeName', 'start', 'end', 'firstName', 'lastName', 'email', 'format', 'location'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]]) {
      return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: required[i] + ' is required' });
    }
  }

  // Validate email format
  if (!isValidEmail(data.email)) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Invalid email address' });
  }

  // Sanitize text inputs
  data.firstName = sanitize(data.firstName);
  data.lastName = sanitize(data.lastName);
  data.purpose = sanitize(data.purpose || '');
  data.notes = sanitize(data.notes || '');

  // Acquire lock for concurrent access protection
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse({ success: false, error: 'LOCK_TIMEOUT', message: 'Server is busy. Please try again in a moment.' });
  }

  try {
    // Re-check slot availability inside the lock (race-condition prevention).
    var startDate = new Date(data.start);
    var endDate = new Date(data.end);

    // 1) Authoritative check against the Bookings sheet, which is immediately
    //    consistent under the lock — unlike the calendar, which is read back via
    //    the eventually-consistent Calendar.Events.list and can lag behind a
    //    just-created event, letting two requests both pass a calendar-only check.
    if (BookingStore.findOverlappingConfirmed(data.start, data.end, null, isStaleGhost)) {
      return jsonResponse({ success: false, error: 'SLOT_TAKEN', message: 'This time slot is no longer available. Please select another time.' });
    }

    // 2) Calendar check: the requested interval must fall within free availability.
    if (!CalendarService.isRangeAvailable(startDate, endDate)) {
      return jsonResponse({ success: false, error: 'SLOT_TAKEN', message: 'This time slot is no longer available. Please select another time.' });
    }

    // Generate token first so it's available for the event description
    var token = TokenService.generateToken();
    var pagesUrl = Config.get('GITHUB_PAGES_URL');
    data.token = token;

    // Create calendar event
    var ownerName = Config.get('OWNER_NAME') || 'Jeremy';
    var ownerFirst = ownerName.split(' ')[0];
    var eventTitle = data.eventLabel
      ? data.firstName + '/' + ownerFirst + ' ' + data.eventLabel
      : data.firstName + '/' + ownerFirst + ': ' + data.meetingTypeName;
    var description = buildEventDescription(data);
    var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
    var event = calendar.createEvent(eventTitle, startDate, endDate, {
      guests: data.email,
      sendInvites: true,
      location: data.location,
      description: description,
    });
    var bookingRecord = {
      token: token,
      tokenExpiresAt: TokenService.getExpiryDate(),
      eventId: event.getId(),
      status: 'confirmed',
      meetingTypeId: data.meetingTypeId,
      meetingTypeName: data.meetingTypeName,
      eventLabel: data.eventLabel || '',
      startTime: data.start,
      endTime: data.end,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      format: data.format,
      location: data.location,
      purpose: data.purpose,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      cancelledAt: '',
      rescheduledTo: '',
    };

    BookingStore.create(bookingRecord);

    // Send emails
    EmailService.sendBookingConfirmation(bookingRecord);

    return jsonResponse({
      success: true,
      booking: {
        token: token,
        eventId: event.getId(),
        start: data.start,
        end: data.end,
        cancelUrl: pagesUrl + '/cancel.html?token=' + token,
        rescheduleUrl: pagesUrl + '/reschedule.html?token=' + token,
      },
    });
  } finally {
    // Persist pending sheet writes BEFORE releasing the lock, so the next request
    // to take the lock sees this booking's row. Without the flush the row might
    // not commit until this execution ends (after releaseLock), leaving a window
    // where a concurrent booking reads a stale sheet and double-books.
    try { SpreadsheetApp.flush(); } catch (e) { /* nothing pending */ }
    lock.releaseLock();
  }
}

function handleCancelBooking(data) {
  if (!data.token) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Token is required' });
  }

  if (!TokenService.validateToken(data.token)) {
    return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Booking not found or token expired' });
  }

  var booking = BookingStore.getByToken(data.token);
  if (!booking) {
    return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
  }
  if (booking.status === 'cancelled') {
    return jsonResponse({ success: false, error: 'ALREADY_CANCELLED', message: 'This booking has already been cancelled' });
  }
  if (booking.status === 'rescheduled') {
    return jsonResponse({ success: false, error: 'ALREADY_CANCELLED', message: 'This booking has been rescheduled' });
  }

  // Delete calendar event
  try {
    var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
    var event = calendar.getEventById(booking.eventId);
    if (event) {
      event.deleteEvent();
    }
  } catch (err) {
    Logger.log('Error deleting calendar event: ' + err.message);
  }

  // Update booking status
  BookingStore.updateStatus(data.token, 'cancelled', { cancelledAt: new Date().toISOString() });

  // Send cancellation emails
  EmailService.sendCancellationEmail(booking);

  return jsonResponse({ success: true, message: 'Booking cancelled successfully' });
}

function handleGetBooking(data) {
  if (!data.token) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'Token is required' });
  }

  if (!TokenService.validateToken(data.token)) {
    return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Booking not found or token expired' });
  }

  var booking = BookingStore.getByToken(data.token);
  if (!booking) {
    return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
  }

  return jsonResponse({
    success: true,
    booking: {
      token: booking.token,
      status: booking.status,
      meetingTypeId: booking.meetingTypeId,
      start: booking.startTime,
      end: booking.endTime,
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      format: booking.format,
    },
  });
}

function handleRescheduleBooking(data) {
  if (!data.oldToken || !data.newStart || !data.newEnd) {
    return jsonResponse({ success: false, error: 'VALIDATION_ERROR', message: 'oldToken, newStart, and newEnd are required' });
  }

  if (!TokenService.validateToken(data.oldToken)) {
    return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Booking not found or token expired' });
  }

  var oldBooking = BookingStore.getByToken(data.oldToken);
  if (!oldBooking) {
    return jsonResponse({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
  }
  if (oldBooking.status !== 'confirmed') {
    return jsonResponse({ success: false, error: 'ALREADY_CANCELLED', message: 'This booking cannot be rescheduled' });
  }

  // Create new booking with reschedule
  var newBookingData = {
    meetingTypeId: oldBooking.meetingTypeId,
    meetingTypeName: oldBooking.meetingTypeName || oldBooking.meetingTypeId,
    start: data.newStart,
    end: data.newEnd,
    firstName: oldBooking.firstName,
    lastName: oldBooking.lastName,
    email: oldBooking.email,
    format: oldBooking.format,
    location: oldBooking.location,
    purpose: oldBooking.purpose,
    notes: oldBooking.notes,
  };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse({ success: false, error: 'LOCK_TIMEOUT', message: 'Server is busy. Please try again in a moment.' });
  }

  try {
    // Check new slot availability, excluding the booking being rescheduled.
    var newStart = new Date(data.newStart);
    var newEnd = new Date(data.newEnd);

    if (BookingStore.findOverlappingConfirmed(data.newStart, data.newEnd, data.oldToken, isStaleGhost)) {
      return jsonResponse({ success: false, error: 'SLOT_TAKEN', message: 'This time slot is no longer available. Please select another time.' });
    }
    if (!CalendarService.isRangeAvailable(newStart, newEnd)) {
      return jsonResponse({ success: false, error: 'SLOT_TAKEN', message: 'This time slot is no longer available. Please select another time.' });
    }

    // Delete old calendar event
    try {
      var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
      var oldEvent = calendar.getEventById(oldBooking.eventId);
      if (oldEvent) {
        oldEvent.deleteEvent();
      }
    } catch (err) {
      Logger.log('Error deleting old event during reschedule: ' + err.message);
    }

    // Generate new token first so it's available for the event description
    var newToken = TokenService.generateToken();
    var pagesUrl = Config.get('GITHUB_PAGES_URL');

    // Create new calendar event with the new token in the description
    var descData = {
      token: newToken,
      firstName: oldBooking.firstName,
      lastName: oldBooking.lastName,
      email: oldBooking.email,
      purpose: oldBooking.purpose,
      notes: oldBooking.notes,
    };
    var ownerName = Config.get('OWNER_NAME') || 'Jeremy';
    var ownerFirst = ownerName.split(' ')[0];
    var eventTitle = oldBooking.eventLabel
      ? oldBooking.firstName + '/' + ownerFirst + ' ' + oldBooking.eventLabel
      : oldBooking.firstName + '/' + ownerFirst + ': ' + (oldBooking.meetingTypeName || oldBooking.meetingTypeId);
    var description = buildEventDescription(descData);
    var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
    var newEvent = calendar.createEvent(eventTitle, newStart, newEnd, {
      guests: oldBooking.email,
      sendInvites: true,
      location: oldBooking.location,
      description: description,
    });

    var newBookingRecord = {
      token: newToken,
      tokenExpiresAt: TokenService.getExpiryDate(),
      eventId: newEvent.getId(),
      status: 'confirmed',
      meetingTypeId: oldBooking.meetingTypeId,
      meetingTypeName: oldBooking.meetingTypeName || oldBooking.meetingTypeId,
      eventLabel: oldBooking.eventLabel || '',
      startTime: data.newStart,
      endTime: data.newEnd,
      firstName: oldBooking.firstName,
      lastName: oldBooking.lastName,
      email: oldBooking.email,
      format: oldBooking.format,
      location: oldBooking.location,
      purpose: oldBooking.purpose,
      notes: oldBooking.notes,
      createdAt: new Date().toISOString(),
      cancelledAt: '',
      rescheduledTo: '',
    };

    BookingStore.create(newBookingRecord);
    BookingStore.updateStatus(data.oldToken, 'rescheduled', { rescheduledTo: newToken });

    // Send reschedule emails
    EmailService.sendRescheduleEmail(oldBooking, newBookingRecord);

    return jsonResponse({
      success: true,
      booking: {
        token: newToken,
        eventId: newEvent.getId(),
        start: data.newStart,
        end: data.newEnd,
        cancelUrl: pagesUrl + '/cancel.html?token=' + newToken,
        rescheduleUrl: pagesUrl + '/reschedule.html?token=' + newToken,
      },
    });
  } finally {
    // Persist pending sheet writes BEFORE releasing the lock, so the next request
    // to take the lock sees this booking's row. Without the flush the row might
    // not commit until this execution ends (after releaseLock), leaving a window
    // where a concurrent booking reads a stale sheet and double-books.
    try { SpreadsheetApp.flush(); } catch (e) { /* nothing pending */ }
    lock.releaseLock();
  }
}

// --- Helper Functions ---

/**
 * Increment a cache counter within a window; return false once it hits `limit`.
 * Best-effort: the read-modify-write is not atomic, so under heavy concurrency a
 * counter can undercount and let a few extra requests through — it errs toward
 * allowing, never toward wrongly blocking, so it can't starve legitimate users.
 */
function rateBump(cache, key, limit, windowSec) {
  if (limit <= 0) return true; // 0/blank disables that particular limit
  var n = parseInt(cache.get(key) || '0', 10);
  if (n >= limit) return false;
  cache.put(key, String(n + 1), windowSec);
  return true;
}

/**
 * Per-client, read/write-split rate limiter.
 *
 * Reads (availability/lookup) get a generous per-client budget. Writes
 * (create/cancel/reschedule) get a tighter per-client budget, a per-email budget
 * (so one person — or a naive abuser reusing an address — can't spray bookings),
 * and a high global backstop. Keying per client is the fix for the old single
 * 'anonymous' bucket that let any load spike lock every visitor out.
 *
 * A public, unauthenticated endpoint can't fully stop a determined attacker who
 * rotates clientId AND email (that needs a CAPTCHA / sign-in); these limits plus
 * the honeypot stop naive bots and accidental floods while never blocking a
 * realistic class-sized burst. Limits are Config-tunable without a code change.
 *
 * @return {boolean} true if the request is allowed, false if it should be throttled.
 */
function rateLimitOk(action, requestData) {
  var WRITE_ACTIONS = { createBooking: true, cancelBooking: true, rescheduleBooking: true };
  var cache = CacheService.getScriptCache();
  var clientId = requestData && requestData.clientId;
  var cid = clientId ? String(clientId).slice(0, 64) : 'anon';
  var MINUTE = 60;

  if (WRITE_ACTIONS[action]) {
    var perClient = parseInt(Config.get('RATE_LIMIT_WRITE_PER_CLIENT'), 10) || 15;
    var global = parseInt(Config.get('RATE_LIMIT_WRITE_GLOBAL'), 10) || 300;
    var perEmail = parseInt(Config.get('RATE_LIMIT_WRITE_PER_EMAIL'), 10) || 10;
    if (!rateBump(cache, 'rlw_' + cid, perClient, MINUTE)) return false;
    // Per-email budget over a longer window (a human books a handful of meetings,
    // not dozens). Keyed on the normalized email when present.
    var email = requestData && requestData.email ? String(requestData.email).trim().toLowerCase().slice(0, 128) : '';
    if (email && !rateBump(cache, 'rlwe_' + email, perEmail, 60 * MINUTE)) return false;
    if (!rateBump(cache, 'rlw_global', global, MINUTE)) return false;
    return true;
  }

  var readLimit = parseInt(Config.get('RATE_LIMIT_READ_PER_CLIENT'), 10) || 120;
  return rateBump(cache, 'rlr_' + cid, readLimit, MINUTE);
}

/**
 * Is this overlapping confirmed booking a stale "ghost" — its calendar event was
 * removed out-of-band (deleted/moved directly on the calendar) so the row no
 * longer represents a real meeting and must stop blocking the slot?
 *
 * Fails CLOSED (returns false → treat as a real conflict) in every uncertain
 * case, so it can never open a double-booking:
 *   - A FRESH row (createdAt within the grace window) is always trusted. A just-
 *     created event may not yet be visible via getEventById in a concurrent
 *     execution, so treating a fresh row as a ghost would reintroduce the exact
 *     calendar read-after-write race the sheet check exists to prevent.
 *   - A row with a blank/unparseable eventId can't be verified → real conflict.
 *   - A calendar API error or missing calendar → real conflict.
 * Only an OLD row whose event id verifiably resolves to nothing is a ghost.
 */
function isStaleGhost(booking) {
  var graceMin = parseInt(Config.get('GHOST_GRACE_MINUTES'), 10) || 10;
  var createdAt = new Date(booking.createdAt).getTime();
  if (!isNaN(createdAt) && (Date.now() - createdAt) < graceMin * 60 * 1000) {
    return false; // fresh row — trust it (guards the propagation-lag race)
  }
  if (!booking.eventId) return false; // unverifiable — treat as a real conflict
  try {
    var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
    if (!calendar) return false; // can't verify — treat as a real conflict
    return !calendar.getEventById(booking.eventId); // event gone => ghost
  } catch (err) {
    Logger.log('isStaleGhost lookup error for ' + booking.eventId + ': ' + err.message);
    return false; // API hiccup — treat as a real conflict
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function buildEventDescription(data) {
  var pagesUrl = Config.get('GITHUB_PAGES_URL');
  var lines = [];
  if (data.purpose) lines.push('Purpose: ' + data.purpose);
  if (data.notes) lines.push('Notes: ' + data.notes);
  lines.push('');
  lines.push('Booked by: ' + data.firstName + ' ' + data.lastName + ' (' + data.email + ')');
  lines.push('');
  lines.push('Cancel: ' + pagesUrl + '/cancel.html?token=' + data.token);
  lines.push('Reschedule: ' + pagesUrl + '/reschedule.html?token=' + data.token);
  return lines.join('\n');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str) {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
