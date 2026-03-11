/**
 * Timezone utilities — detect visitor timezone, convert UTC↔local, format dates.
 */

const TimezoneUtil = (function () {
  let _currentTimezone = null;

  function detect(defaultTimezone) {
    try {
      _currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      _currentTimezone = defaultTimezone || 'America/New_York';
    }
    if (!_currentTimezone) {
      _currentTimezone = defaultTimezone || 'America/New_York';
    }
    return _currentTimezone;
  }

  function setTimezone(tz) {
    _currentTimezone = tz;
  }

  function getTimezone() {
    return _currentTimezone;
  }

  function utcToLocal(utcDateStr) {
    var date = new Date(utcDateStr);
    return new Date(date.toLocaleString('en-US', { timeZone: _currentTimezone }));
  }

  function localToUtc(localDate) {
    return localDate.toISOString();
  }

  function formatDate(utcDateStr) {
    var date = new Date(utcDateStr);
    return date.toLocaleDateString('en-US', {
      timeZone: _currentTimezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatTime(utcDateStr) {
    var date = new Date(utcDateStr);
    return date.toLocaleTimeString('en-US', {
      timeZone: _currentTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDateTime(utcDateStr) {
    return formatDate(utcDateStr) + ' at ' + formatTime(utcDateStr);
  }

  function formatTimeRange(startUtc, endUtc) {
    return formatTime(startUtc) + ' – ' + formatTime(endUtc);
  }

  function getTimezoneAbbreviation() {
    try {
      var date = new Date();
      var parts = date.toLocaleTimeString('en-US', {
        timeZone: _currentTimezone,
        timeZoneName: 'short',
      }).split(' ');
      return parts[parts.length - 1];
    } catch (e) {
      return '';
    }
  }

  function getCommonTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
      { value: 'Europe/London', label: 'GMT / BST' },
      { value: 'Europe/Paris', label: 'Central European Time (CET)' },
      { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
      { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
      { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
    ];
  }

  return {
    detect: detect,
    setTimezone: setTimezone,
    getTimezone: getTimezone,
    utcToLocal: utcToLocal,
    localToUtc: localToUtc,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    formatTimeRange: formatTimeRange,
    getTimezoneAbbreviation: getTimezoneAbbreviation,
    getCommonTimezones: getCommonTimezones,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneUtil;
}
