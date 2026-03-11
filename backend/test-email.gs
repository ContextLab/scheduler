/**
 * T026 — Integration tests for email sending
 * Tests iCal generation, confirmation email, and invite email.
 * Run these in the Apps Script editor after deploying.
 */

function testEmailService() {
  var results = { passed: 0, failed: 0, errors: [] };

  // Test 1: buildICalContent generates valid .ics string
  try {
    var testBooking = {
      meetingTypeId: 'office-hours',
      startTime: '2026-04-01T14:00:00Z',
      endTime: '2026-04-01T14:15:00Z',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      location: 'https://zoom.us/test',
      purpose: 'Testing',
    };

    var ics = EmailService.buildICalContent(testBooking);
    if (!ics) throw new Error('buildICalContent returned empty');
    if (ics.indexOf('BEGIN:VCALENDAR') === -1) throw new Error('Missing VCALENDAR header');
    if (ics.indexOf('BEGIN:VEVENT') === -1) throw new Error('Missing VEVENT');
    if (ics.indexOf('END:VCALENDAR') === -1) throw new Error('Missing VCALENDAR footer');
    if (ics.indexOf('DTSTART') === -1) throw new Error('Missing DTSTART');
    if (ics.indexOf('DTEND') === -1) throw new Error('Missing DTEND');
    results.passed++;
    Logger.log('PASS: buildICalContent generates valid .ics');
  } catch (e) {
    results.failed++;
    results.errors.push('buildICalContent: ' + e.message);
    Logger.log('FAIL: buildICalContent — ' + e.message);
  }

  // Test 2: createICalBlob returns a Blob
  try {
    var icsContent = 'BEGIN:VCALENDAR\nEND:VCALENDAR';
    var blob = EmailService.createICalBlob(icsContent);
    if (!blob) throw new Error('createICalBlob returned null');
    if (typeof blob.getContentType !== 'function') throw new Error('Not a Blob object');
    if (blob.getContentType() !== 'text/calendar') {
      throw new Error('Wrong content type: ' + blob.getContentType());
    }
    results.passed++;
    Logger.log('PASS: createICalBlob returns correct Blob');
  } catch (e) {
    results.failed++;
    results.errors.push('createICalBlob: ' + e.message);
    Logger.log('FAIL: createICalBlob — ' + e.message);
  }

  // Test 3: MailApp quota is available
  try {
    var remaining = MailApp.getRemainingDailyQuota();
    if (typeof remaining !== 'number') {
      throw new Error('Quota is not a number: ' + typeof remaining);
    }
    if (remaining <= 0) {
      throw new Error('No email quota remaining: ' + remaining);
    }
    results.passed++;
    Logger.log('PASS: Email quota available (' + remaining + ' remaining)');
  } catch (e) {
    results.failed++;
    results.errors.push('Email quota: ' + e.message);
    Logger.log('FAIL: Email quota — ' + e.message);
  }

  Logger.log('Email tests: ' + results.passed + ' passed, ' + results.failed + ' failed');
  Logger.log('NOTE: Actual send tests skipped to avoid consuming quota. Test manually.');
  return results;
}
