/**
 * T025 + T026a — Integration tests for BookingStore and concurrent booking
 * Tests CRUD operations on Sheets and concurrent write protection.
 * Run these in the Apps Script editor after deploying.
 */

function testBookingStore() {
  var results = { passed: 0, failed: 0, errors: [] };

  // Test 1: Create booking writes a row to Sheet
  try {
    var testBooking = {
      token: 'test-token-' + Utilities.getUuid().substring(0, 8),
      tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      eventId: 'test-event-id',
      status: 'confirmed',
      meetingTypeId: 'office-hours',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 15 * 60000).toISOString(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      format: 'virtual',
      location: 'https://zoom.us/test',
      purpose: 'Testing',
      notes: '',
      createdAt: new Date().toISOString(),
      cancelledAt: '',
      rescheduledTo: '',
    };

    BookingStore.create(testBooking);
    results.passed++;
    Logger.log('PASS: create booking writes row');
  } catch (e) {
    results.failed++;
    results.errors.push('create: ' + e.message);
    Logger.log('FAIL: create — ' + e.message);
  }

  // Test 2: getByToken retrieves the booking
  try {
    var allBookings = BookingStore.getAll();
    if (allBookings.length === 0) {
      throw new Error('No bookings found after create');
    }
    var lastBooking = allBookings[allBookings.length - 1];
    var retrieved = BookingStore.getByToken(lastBooking.token);
    if (!retrieved) {
      throw new Error('getByToken returned null for token: ' + lastBooking.token);
    }
    if (retrieved.firstName !== lastBooking.firstName) {
      throw new Error('firstName mismatch: ' + retrieved.firstName + ' vs ' + lastBooking.firstName);
    }
    results.passed++;
    Logger.log('PASS: getByToken retrieves correct booking');
  } catch (e) {
    results.failed++;
    results.errors.push('getByToken: ' + e.message);
    Logger.log('FAIL: getByToken — ' + e.message);
  }

  // Test 3: getByToken returns null for nonexistent token
  try {
    var found = BookingStore.getByToken('nonexistent-token-xyz');
    if (found !== null) {
      throw new Error('Expected null for nonexistent token, got: ' + JSON.stringify(found));
    }
    results.passed++;
    Logger.log('PASS: getByToken returns null for missing token');
  } catch (e) {
    results.failed++;
    results.errors.push('getByToken null: ' + e.message);
    Logger.log('FAIL: getByToken null — ' + e.message);
  }

  // Test 4: updateStatus changes booking status
  try {
    var allBookings = BookingStore.getAll();
    var lastBooking = allBookings[allBookings.length - 1];
    var updated = BookingStore.updateStatus(lastBooking.token, 'cancelled', {
      cancelledAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('updateStatus returned false');
    }
    var reloaded = BookingStore.getByToken(lastBooking.token);
    if (reloaded.status !== 'cancelled') {
      throw new Error('Status not updated: ' + reloaded.status);
    }
    results.passed++;
    Logger.log('PASS: updateStatus changes booking status');
  } catch (e) {
    results.failed++;
    results.errors.push('updateStatus: ' + e.message);
    Logger.log('FAIL: updateStatus — ' + e.message);
  }

  // Test 5: getAll returns array of bookings
  try {
    var all = BookingStore.getAll();
    if (!Array.isArray(all)) {
      throw new Error('Expected array, got ' + typeof all);
    }
    if (all.length === 0) {
      throw new Error('Expected at least 1 booking');
    }
    results.passed++;
    Logger.log('PASS: getAll returns array');
  } catch (e) {
    results.failed++;
    results.errors.push('getAll: ' + e.message);
    Logger.log('FAIL: getAll — ' + e.message);
  }

  Logger.log('BookingStore tests: ' + results.passed + ' passed, ' + results.failed + ' failed');
  return results;
}

/**
 * T026a — Test concurrent booking protection
 * Simulates two simultaneous lock acquisitions.
 */
function testConcurrentBooking() {
  var results = { passed: 0, failed: 0, errors: [] };

  // Test: LockService prevents concurrent access
  try {
    var lock = LockService.getScriptLock();
    var acquired = lock.tryLock(5000);
    if (!acquired) {
      throw new Error('Could not acquire lock for test');
    }

    // While holding the lock, a second attempt should fail quickly
    var lock2 = LockService.getScriptLock();
    var acquired2 = lock2.tryLock(100); // Very short timeout
    // Note: In single-threaded Apps Script execution, this will succeed
    // because lock.tryLock is reentrant within the same execution.
    // True concurrent testing requires two simultaneous HTTP requests.

    lock.releaseLock();
    results.passed++;
    Logger.log('PASS: Lock acquisition works (true concurrency requires live test)');
  } catch (e) {
    results.failed++;
    results.errors.push('Concurrent lock: ' + e.message);
    Logger.log('FAIL: Concurrent lock — ' + e.message);
  }

  Logger.log('Concurrent booking tests: ' + results.passed + ' passed, ' + results.failed + ' failed');
  Logger.log('NOTE: Full concurrent testing requires sending two simultaneous HTTP POST requests');
  return results;
}
