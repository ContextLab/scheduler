/**
 * API Client — communicates with the Google Apps Script backend.
 * Uses text/plain content-type to avoid CORS preflight.
 */

const ApiClient = (function () {
  let _baseUrl = null;
  var _slotCache = {}; // key: "startISO|endISO|duration" → Promise<result>

  function init(appsScriptUrl) {
    _baseUrl = appsScriptUrl;
  }

  /**
   * Prefetch slots for a date range at 15-min granularity.
   * Called early (page load) so data is ready when user reaches Step 3.
   */
  function prefetchSlots(startDate, endDate) {
    var key = startDate + '|' + endDate + '|15';
    if (_slotCache[key]) return; // already prefetching
    _slotCache[key] = apiCall('getAvailableSlots', {
      startDate: startDate,
      endDate: endDate,
      durationMinutes: 15,
    }).catch(function () { delete _slotCache[key]; });
  }

  /**
   * Get the cache key for a slot request. Returns cached promise if available.
   */
  function getCachedSlots(startDate, endDate, durationMinutes) {
    var key = startDate + '|' + endDate + '|' + durationMinutes;
    return _slotCache[key] || null;
  }

  function cacheSlots(startDate, endDate, durationMinutes, promise) {
    _slotCache[startDate + '|' + endDate + '|' + durationMinutes] = promise;
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
    // Check cache first
    var cached = getCachedSlots(startDate, endDate, durationMinutes);
    if (cached) return cached;

    var promise = apiCall('getAvailableSlots', {
      startDate: startDate,
      endDate: endDate,
      durationMinutes: durationMinutes,
    });
    cacheSlots(startDate, endDate, durationMinutes, promise);
    return promise;
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
