/**
 * API Client — communicates with the Google Apps Script backend.
 * Uses text/plain content-type to avoid CORS preflight.
 */

const ApiClient = (function () {
  let _baseUrl = null;
  var _prefetchPromise = null; // Promise<{slots: [{start,end}]}> for full date range
  var _prefetchRange = null;   // {start: ISO, end: ISO}

  function init(appsScriptUrl) {
    _baseUrl = appsScriptUrl;
  }

  /**
   * Prefetch slots for the full booking window at 15-min granularity.
   * Called on page load so data is ready when user reaches Step 3.
   */
  function prefetchSlots(startDate, endDate) {
    if (_prefetchPromise) return;
    _prefetchRange = { start: startDate, end: endDate };
    _prefetchPromise = apiCall('getAvailableSlots', {
      startDate: startDate,
      endDate: endDate,
      durationMinutes: 15,
    }).catch(function () {
      _prefetchPromise = null;
      _prefetchRange = null;
    });
  }

  /**
   * Discard the prefetched availability snapshot.
   *
   * The prefetch is a page-load snapshot; without invalidation, every slot list
   * (including the "pick another time" refresh after a SLOT_TAKEN) is served
   * from stale data, so students keep seeing slots that were booked since load.
   * Call this after any booking so the next slot fetch hits the backend fresh.
   */
  function invalidatePrefetch() {
    _prefetchPromise = null;
    _prefetchRange = null;
  }

  /**
   * Try to serve a slot request from the prefetched data.
   * The prefetch uses 15-min slots; for larger durations we filter
   * to only include slots whose time boundaries align with the requested duration.
   */
  function tryServePrefetch(startDate, endDate, durationMinutes) {
    if (!_prefetchPromise || !_prefetchRange) return null;
    // Check if requested range is within prefetched range
    if (new Date(startDate) < new Date(_prefetchRange.start) ||
        new Date(endDate) > new Date(_prefetchRange.end)) {
      return null;
    }
    var reqStart = new Date(startDate).getTime();
    var reqEnd = new Date(endDate).getTime();
    var durationMs = durationMinutes * 60 * 1000;

    return _prefetchPromise.then(function (result) {
      if (!result || !result.slots) return result;
      // Filter slots to the requested date range and duration
      var filtered = result.slots.filter(function (slot) {
        var s = new Date(slot.start).getTime();
        var e = new Date(slot.end).getTime();
        return s >= reqStart && e <= reqEnd;
      });
      // For durations > 15 min, merge consecutive 15-min slots into
      // larger slots of the requested duration
      if (durationMinutes > 15) {
        filtered = mergeIntoSlots(filtered, durationMs);
      }
      return { success: true, slots: filtered };
    });
  }

  /**
   * Merge consecutive 15-min slots into slots of the target duration.
   * E.g., four consecutive 15-min slots → one 60-min slot.
   */
  function mergeIntoSlots(fifteenMinSlots, durationMs) {
    if (fifteenMinSlots.length === 0) return [];
    var slots = [];
    // Sort by start time
    fifteenMinSlots.sort(function (a, b) {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
    // Slide window: for each 15-min slot, check if there are enough
    // consecutive slots to fill the target duration
    for (var i = 0; i < fifteenMinSlots.length; i++) {
      var candidateStart = new Date(fifteenMinSlots[i].start).getTime();
      var candidateEnd = candidateStart + durationMs;
      // Check that all 15-min slots needed are present and consecutive
      var covered = candidateStart;
      var valid = true;
      for (var j = i; j < fifteenMinSlots.length && covered < candidateEnd; j++) {
        var slotStart = new Date(fifteenMinSlots[j].start).getTime();
        var slotEnd = new Date(fifteenMinSlots[j].end).getTime();
        if (slotStart !== covered) { valid = false; break; }
        covered = slotEnd;
      }
      if (valid && covered >= candidateEnd) {
        slots.push({
          start: fifteenMinSlots[i].start,
          end: new Date(candidateEnd).toISOString(),
        });
      }
    }
    return slots;
  }

  async function apiCall(action, data) {
    if (!_baseUrl || _baseUrl === 'PLACEHOLDER_APPS_SCRIPT_URL') {
      throw new Error('Apps Script URL not configured. Update settings.yaml with your deployed web app URL.');
    }

    const body = JSON.stringify(Object.assign({ action: action }, data || {}));

    var response;
    try {
      response = await fetch(_baseUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
      });
    } catch (err) {
      throw new Error('Network error: unable to reach the booking server. Please try again later.');
    }

    if (!response.ok) {
      throw new Error('Server error: ' + response.status + ' ' + response.statusText);
    }

    var result;
    try {
      result = await response.json();
    } catch (err) {
      throw new Error('Invalid response from server. Please try again later.');
    }

    if (!result.success) {
      var error = new Error(result.message || 'An unknown error occurred');
      error.code = result.error || 'UNKNOWN_ERROR';
      throw error;
    }

    return result;
  }

  async function getAvailableSlots(startDate, endDate, durationMinutes) {
    // Try to serve from prefetched data (covers full booking window)
    var fromPrefetch = tryServePrefetch(startDate, endDate, durationMinutes);
    if (fromPrefetch) return fromPrefetch;

    // Fallback: fresh API call
    return apiCall('getAvailableSlots', {
      startDate: startDate,
      endDate: endDate,
      durationMinutes: durationMinutes,
    });
  }

  async function createBooking(bookingData) {
    return apiCall('createBooking', bookingData);
  }

  async function cancelBooking(token) {
    return apiCall('cancelBooking', { token: token });
  }

  async function getBooking(token) {
    return apiCall('getBooking', { token: token });
  }

  async function rescheduleBooking(oldToken, newStart, newEnd) {
    return apiCall('rescheduleBooking', {
      oldToken: oldToken,
      newStart: newStart,
      newEnd: newEnd,
    });
  }

  async function healthCheck() {
    if (!_baseUrl || _baseUrl === 'PLACEHOLDER_APPS_SCRIPT_URL') {
      return { status: 'not_configured' };
    }
    try {
      var response = await fetch(_baseUrl + '?action=health', { redirect: 'follow' });
      return await response.json();
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  return {
    init: init,
    apiCall: apiCall,
    getAvailableSlots: getAvailableSlots,
    prefetchSlots: prefetchSlots,
    invalidatePrefetch: invalidatePrefetch,
    createBooking: createBooking,
    cancelBooking: cancelBooking,
    getBooking: getBooking,
    rescheduleBooking: rescheduleBooking,
    healthCheck: healthCheck,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
}
