/**
 * Config — wrapper around PropertiesService for script-level configuration.
 */

var Config = (function () {
  var DEFAULTS = {
    CALENDAR_ID: 'primary',
    OWNER_EMAIL: '',
    OWNER_NAME: '',
    SPREADSHEET_ID: '',
    GITHUB_PAGES_URL: '',
    AVAILABILITY_PATTERN: 'Jeremy office hours',
    MIN_NOTICE_HOURS: '12',
    MAX_ADVANCE_DAYS: '90',
    TOKEN_EXPIRY_DAYS: '90',
  };

  function get(key) {
    var props = PropertiesService.getScriptProperties();
    var value = props.getProperty(key);
    if (value !== null) return value;
    return DEFAULTS[key] || '';
  }

  function set(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }

  function getAll() {
    var props = PropertiesService.getScriptProperties().getProperties();
    var result = {};
    for (var key in DEFAULTS) {
      result[key] = props[key] || DEFAULTS[key];
    }
    return result;
  }

  function getNumber(key) {
    return parseInt(get(key), 10) || 0;
  }

  return {
    get: get,
    set: set,
    getAll: getAll,
    getNumber: getNumber,
  };
})();
