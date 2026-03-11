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

  // Rate limiting via CacheService
  var clientId = requestData.clientId || 'anonymous';
  var cacheKey = 'rate_' + clientId;
  var cache = CacheService.getScriptCache();
  var requestCount = parseInt(cache.get(cacheKey) || '0', 10);
  if (requestCount >= 30) {
    return jsonResponse({ success: false, error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute and try again.' });
  }
  cache.put(cacheKey, String(requestCount + 1), 60); // 60-second window

  try {
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
    // Re-check slot availability (race condition prevention)
    var startDate = new Date(data.start);
    var endDate = new Date(data.end);
    var duration = Math.round((endDate - startDate) / 60000);
    var slots = CalendarService.getAvailableSlots(startDate, new Date(endDate.getTime() + 1), duration);
    var slotAvailable = slots.some(function (s) {
      return s.start === data.start && s.end === data.end;
    });

    if (!slotAvailable) {
      return jsonResponse({ success: false, error: 'SLOT_TAKEN', message: 'This time slot is no longer available. Please select another time.' });
    }

    // Create calendar event
    var eventTitle = data.meetingTypeName + ' — ' + data.firstName + ' ' + data.lastName;
    var description = buildEventDescription(data);
    var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
    var event = calendar.createEvent(eventTitle, startDate, endDate, {
      guests: data.email,
      sendInvites: true,
      location: data.location,
      description: description,
    });

    // Generate token and store booking
    var token = TokenService.generateToken();
    var pagesUrl = Config.get('GITHUB_PAGES_URL');
    var bookingRecord = {
      token: token,
      tokenExpiresAt: TokenService.getExpiryDate(),
      eventId: event.getId(),
      status: 'confirmed',
      meetingTypeId: data.meetingTypeId,
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
    meetingTypeName: oldBooking.meetingTypeId, // Will be resolved from config
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
    // Check new slot availability
    var newStart = new Date(data.newStart);
    var newEnd = new Date(data.newEnd);
    var duration = Math.round((newEnd - newStart) / 60000);
    var slots = CalendarService.getAvailableSlots(newStart, new Date(newEnd.getTime() + 1), duration);
    var slotAvailable = slots.some(function (s) {
      return s.start === data.newStart && s.end === data.newEnd;
    });

    if (!slotAvailable) {
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

    // Create new calendar event
    var eventTitle = oldBooking.meetingTypeId + ' — ' + oldBooking.firstName + ' ' + oldBooking.lastName;
    var description = buildEventDescription(oldBooking);
    var calendar = CalendarApp.getCalendarById(Config.get('CALENDAR_ID'));
    var newEvent = calendar.createEvent(eventTitle, newStart, newEnd, {
      guests: oldBooking.email,
      sendInvites: true,
      location: oldBooking.location,
      description: description,
    });

    // Generate new token
    var newToken = TokenService.generateToken();
    var pagesUrl = Config.get('GITHUB_PAGES_URL');

    var newBookingRecord = {
      token: newToken,
      tokenExpiresAt: TokenService.getExpiryDate(),
      eventId: newEvent.getId(),
      status: 'confirmed',
      meetingTypeId: oldBooking.meetingTypeId,
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
    lock.releaseLock();
  }
}

// --- Helper Functions ---

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
