/**
 * EmailService — email sending with iCal attachments.
 * Sends confirmation, cancellation, and reschedule emails.
 * Native Google Calendar invite is handled by CalendarApp.createEvent({sendInvites: true}).
 * This service handles the supplementary MailApp emails with .ics for non-Google users.
 */

var EmailService = (function () {

  /**
   * Send booking confirmation emails:
   * 1. To visitor: confirmation with iCal attachment (for non-Google calendar users)
   * 2. To owner: notification of new booking
   */
  function sendBookingConfirmation(booking) {
    var ownerEmail = Config.get('OWNER_EMAIL');
    var ownerName = Config.get('OWNER_NAME');
    var pagesUrl = Config.get('GITHUB_PAGES_URL');

    var startDate = new Date(booking.startTime);
    var endDate = new Date(booking.endTime);
    var dateStr = formatDateForEmail(startDate);
    var timeStr = formatTimeRange(startDate, endDate);

    // Email to visitor with iCal attachment
    var icsContent = buildICalContent(booking);
    var icsBlob = createICalBlob(icsContent);

    var visitorSubject = 'Booking Confirmed: ' + booking.meetingTypeId + ' on ' + dateStr;
    var visitorBody = 'Hi ' + booking.firstName + ',\n\n'
      + 'Your meeting has been confirmed!\n\n'
      + 'Details:\n'
      + '  Type: ' + booking.meetingTypeId + '\n'
      + '  Date: ' + dateStr + '\n'
      + '  Time: ' + timeStr + '\n'
      + '  Location: ' + booking.location + '\n'
      + (booking.purpose ? '  Purpose: ' + booking.purpose + '\n' : '')
      + '\nTo cancel: ' + pagesUrl + '/cancel.html?token=' + booking.token
      + '\nTo reschedule: ' + pagesUrl + '/reschedule.html?token=' + booking.token
      + '\n\nA calendar invite has also been sent to your email.'
      + '\nIf it didn\'t arrive, use the attached .ics file to add it to your calendar.'
      + '\n\nBest,\n' + ownerName;

    try {
      MailApp.sendEmail({
        to: booking.email,
        subject: visitorSubject,
        body: visitorBody,
        attachments: [icsBlob],
        name: ownerName,
      });
    } catch (e) {
      Logger.log('Failed to send visitor confirmation: ' + e.message);
    }

    // Email to owner
    var ownerSubject = 'New Booking: ' + booking.firstName + ' ' + booking.lastName + ' — ' + dateStr;
    var ownerBody = 'New meeting booked:\n\n'
      + '  Visitor: ' + booking.firstName + ' ' + booking.lastName + ' (' + booking.email + ')\n'
      + '  Type: ' + booking.meetingTypeId + '\n'
      + '  Date: ' + dateStr + '\n'
      + '  Time: ' + timeStr + '\n'
      + '  Format: ' + booking.format + '\n'
      + '  Location: ' + booking.location + '\n'
      + (booking.purpose ? '  Purpose: ' + booking.purpose + '\n' : '')
      + (booking.notes ? '  Notes: ' + booking.notes + '\n' : '')
      + '\nCancel: ' + pagesUrl + '/cancel.html?token=' + booking.token
      + '\nReschedule: ' + pagesUrl + '/reschedule.html?token=' + booking.token;

    try {
      MailApp.sendEmail({
        to: ownerEmail,
        subject: ownerSubject,
        body: ownerBody,
        name: 'Booking Scheduler',
      });
    } catch (e) {
      Logger.log('Failed to send owner notification: ' + e.message);
    }
  }

  /**
   * Send cancellation emails to both visitor and owner.
   */
  function sendCancellationEmail(booking) {
    var ownerEmail = Config.get('OWNER_EMAIL');
    var ownerName = Config.get('OWNER_NAME');
    var pagesUrl = Config.get('GITHUB_PAGES_URL');

    var startDate = new Date(booking.startTime);
    var endDate = new Date(booking.endTime);
    var dateStr = formatDateForEmail(startDate);
    var timeStr = formatTimeRange(startDate, endDate);

    // Email to visitor
    var visitorSubject = 'Booking Cancelled: ' + booking.meetingTypeId + ' on ' + dateStr;
    var visitorBody = 'Hi ' + booking.firstName + ',\n\n'
      + 'Your meeting has been cancelled.\n\n'
      + 'Cancelled meeting details:\n'
      + '  Type: ' + booking.meetingTypeId + '\n'
      + '  Date: ' + dateStr + '\n'
      + '  Time: ' + timeStr + '\n'
      + '\nTo book a new meeting: ' + pagesUrl
      + '\n\nBest,\n' + ownerName;

    try {
      MailApp.sendEmail({
        to: booking.email,
        subject: visitorSubject,
        body: visitorBody,
        name: ownerName,
      });
    } catch (e) {
      Logger.log('Failed to send visitor cancellation: ' + e.message);
    }

    // Email to owner
    var ownerSubject = 'Booking Cancelled: ' + booking.firstName + ' ' + booking.lastName + ' — ' + dateStr;
    var ownerBody = 'A meeting has been cancelled:\n\n'
      + '  Visitor: ' + booking.firstName + ' ' + booking.lastName + ' (' + booking.email + ')\n'
      + '  Type: ' + booking.meetingTypeId + '\n'
      + '  Date: ' + dateStr + '\n'
      + '  Time: ' + timeStr + '\n';

    try {
      MailApp.sendEmail({
        to: ownerEmail,
        subject: ownerSubject,
        body: ownerBody,
        name: 'Booking Scheduler',
      });
    } catch (e) {
      Logger.log('Failed to send owner cancellation: ' + e.message);
    }
  }

  /**
   * Send reschedule emails to both visitor and owner.
   */
  function sendRescheduleEmail(oldBooking, newBooking) {
    var ownerEmail = Config.get('OWNER_EMAIL');
    var ownerName = Config.get('OWNER_NAME');
    var pagesUrl = Config.get('GITHUB_PAGES_URL');

    var oldStart = new Date(oldBooking.startTime);
    var oldEnd = new Date(oldBooking.endTime);
    var newStart = new Date(newBooking.startTime);
    var newEnd = new Date(newBooking.endTime);

    var oldDateStr = formatDateForEmail(oldStart);
    var oldTimeStr = formatTimeRange(oldStart, oldEnd);
    var newDateStr = formatDateForEmail(newStart);
    var newTimeStr = formatTimeRange(newStart, newEnd);

    // iCal for the new booking
    var icsContent = buildICalContent(newBooking);
    var icsBlob = createICalBlob(icsContent);

    // Email to visitor
    var visitorSubject = 'Meeting Rescheduled: ' + newBooking.meetingTypeId + ' — ' + newDateStr;
    var visitorBody = 'Hi ' + newBooking.firstName + ',\n\n'
      + 'Your meeting has been rescheduled.\n\n'
      + 'Previous time:\n'
      + '  Date: ' + oldDateStr + '\n'
      + '  Time: ' + oldTimeStr + '\n\n'
      + 'New time:\n'
      + '  Date: ' + newDateStr + '\n'
      + '  Time: ' + newTimeStr + '\n'
      + '  Location: ' + newBooking.location + '\n'
      + '\nTo cancel: ' + pagesUrl + '/cancel.html?token=' + newBooking.token
      + '\nTo reschedule again: ' + pagesUrl + '/reschedule.html?token=' + newBooking.token
      + '\n\nBest,\n' + ownerName;

    try {
      MailApp.sendEmail({
        to: newBooking.email,
        subject: visitorSubject,
        body: visitorBody,
        attachments: [icsBlob],
        name: ownerName,
      });
    } catch (e) {
      Logger.log('Failed to send visitor reschedule email: ' + e.message);
    }

    // Email to owner
    var ownerSubject = 'Meeting Rescheduled: ' + newBooking.firstName + ' ' + newBooking.lastName;
    var ownerBody = 'A meeting has been rescheduled:\n\n'
      + '  Visitor: ' + newBooking.firstName + ' ' + newBooking.lastName + ' (' + newBooking.email + ')\n'
      + '  Old: ' + oldDateStr + ' ' + oldTimeStr + '\n'
      + '  New: ' + newDateStr + ' ' + newTimeStr + '\n'
      + '  Location: ' + newBooking.location + '\n';

    try {
      MailApp.sendEmail({
        to: ownerEmail,
        subject: ownerSubject,
        body: ownerBody,
        name: 'Booking Scheduler',
      });
    } catch (e) {
      Logger.log('Failed to send owner reschedule email: ' + e.message);
    }
  }

  /**
   * Build iCalendar (.ics) content string for a booking.
   * RFC 5545 compliant.
   */
  function buildICalContent(booking) {
    var startDate = new Date(booking.startTime);
    var endDate = new Date(booking.endTime);
    var now = new Date();
    var uid = (booking.token || Utilities.getUuid()) + '@booking-scheduler';

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BookingScheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTART:' + formatICalDate(startDate),
      'DTEND:' + formatICalDate(endDate),
      'DTSTAMP:' + formatICalDate(now),
      'SUMMARY:' + escapeICalText(booking.meetingTypeId),
      'LOCATION:' + escapeICalText(booking.location || ''),
      'DESCRIPTION:' + escapeICalText(
        (booking.purpose ? 'Purpose: ' + booking.purpose : '')
        + (booking.notes ? '\\nNotes: ' + booking.notes : '')
      ),
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    return lines.join('\r\n');
  }

  /**
   * Create a Blob from iCal content string.
   */
  function createICalBlob(icsContent) {
    return Utilities.newBlob(icsContent, 'text/calendar', 'invite.ics');
  }

  /**
   * Format a Date to iCal date-time format (YYYYMMDDTHHmmssZ).
   */
  function formatICalDate(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Escape special characters for iCal text fields.
   */
  function escapeICalText(text) {
    if (!text) return '';
    return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  /**
   * Format date for email display.
   */
  function formatDateForEmail(date) {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
  }

  /**
   * Format time range for email display.
   */
  function formatTimeRange(startDate, endDate) {
    return formatTimeForEmail(startDate) + ' – ' + formatTimeForEmail(endDate);
  }

  function formatTimeForEmail(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    var minStr = minutes < 10 ? '0' + minutes : '' + minutes;
    return hours + ':' + minStr + ' ' + ampm;
  }

  return {
    sendBookingConfirmation: sendBookingConfirmation,
    sendCancellationEmail: sendCancellationEmail,
    sendRescheduleEmail: sendRescheduleEmail,
    buildICalContent: buildICalContent,
    createICalBlob: createICalBlob,
  };
})();
