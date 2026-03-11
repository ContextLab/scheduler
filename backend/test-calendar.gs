/**
 * T024 — Integration tests for calendar operations
 * Tests finding availability windows, free/busy queries, slot generation.
 * Run these in the Apps Script editor after deploying.
 */

function testCalendarOperations() {
  var results = { passed: 0, failed: 0, errors: [] };

  // Test 1: getAvailableSlots returns an array
  try {
    var now = new Date();
    var nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    var slots = CalendarService.getAvailableSlots(now, nextWeek, 15);
    if (!Array.isArray(slots)) {
      throw new Error('Expected array, got ' + typeof slots);
    }
    results.passed++;
    Logger.log('PASS: getAvailableSlots returns array (' + slots.length + ' slots)');
  } catch (e) {
    results.failed++;
    results.errors.push('getAvailableSlots array: ' + e.message);
    Logger.log('FAIL: getAvailableSlots returns array — ' + e.message);
  }

  // Test 2: Slots have correct structure (start, end as ISO strings)
  try {
    var now = new Date();
    var nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    var slots = CalendarService.getAvailableSlots(now, nextWeek, 15);
    if (slots.length > 0) {
      var slot = slots[0];
      if (!slot.start || !slot.end) {
        throw new Error('Slot missing start/end: ' + JSON.stringify(slot));
      }
      // Verify ISO format
      if (isNaN(new Date(slot.start).getTime())) {
        throw new Error('Invalid start date: ' + slot.start);
      }
    }
    results.passed++;
    Logger.log('PASS: Slots have correct structure');
  } catch (e) {
    results.failed++;
    results.errors.push('Slot structure: ' + e.message);
    Logger.log('FAIL: Slot structure — ' + e.message);
  }

  // Test 3: 30-minute slots are correct duration
  try {
    var now = new Date();
    var nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    var slots = CalendarService.getAvailableSlots(now, nextWeek, 30);
    if (slots.length > 0) {
      var slot = slots[0];
      var duration = (new Date(slot.end) - new Date(slot.start)) / 60000;
      if (duration !== 30) {
        throw new Error('Expected 30 min duration, got ' + duration);
      }
    }
    results.passed++;
    Logger.log('PASS: 30-minute slots have correct duration');
  } catch (e) {
    results.failed++;
    results.errors.push('30-min duration: ' + e.message);
    Logger.log('FAIL: 30-min duration — ' + e.message);
  }

  // Test 4: Slots respect min_notice_hours (no slots in the past)
  try {
    var now = new Date();
    var minNotice = parseInt(Config.get('MIN_NOTICE_HOURS'), 10) || 12;
    var earliest = new Date(now.getTime() + minNotice * 60 * 60 * 1000);
    var nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    var slots = CalendarService.getAvailableSlots(now, nextWeek, 15);
    var tooEarly = slots.filter(function (s) {
      return new Date(s.start) < earliest;
    });
    if (tooEarly.length > 0) {
      throw new Error(tooEarly.length + ' slots violate min notice of ' + minNotice + ' hours');
    }
    results.passed++;
    Logger.log('PASS: No slots violate min_notice_hours');
  } catch (e) {
    results.failed++;
    results.errors.push('min_notice_hours: ' + e.message);
    Logger.log('FAIL: min_notice_hours — ' + e.message);
  }

  // Test 5: Different durations produce different slot counts (15 vs 60)
  try {
    var now = new Date();
    var nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    var slots15 = CalendarService.getAvailableSlots(now, nextWeek, 15);
    var slots60 = CalendarService.getAvailableSlots(now, nextWeek, 60);
    // 60-min slots should be fewer or equal to 15-min slots
    if (slots60.length > slots15.length) {
      throw new Error('60-min slots (' + slots60.length + ') > 15-min slots (' + slots15.length + ')');
    }
    results.passed++;
    Logger.log('PASS: 60-min slots <= 15-min slots');
  } catch (e) {
    results.failed++;
    results.errors.push('Duration comparison: ' + e.message);
    Logger.log('FAIL: Duration comparison — ' + e.message);
  }

  Logger.log('Calendar tests complete: ' + results.passed + ' passed, ' + results.failed + ' failed');
  return results;
}
