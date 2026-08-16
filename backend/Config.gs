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
    CONFLICT_CALENDAR_IDS: '',  // JSON array of calendar IDs to check for conflicts
    FREE_EVENT_PATTERNS: '',   // JSON array of event title patterns to treat as availability when marked "free"
    // Rate limiting (per 60s window). Buckets are keyed per client so one visitor
    // can never starve another (the previous single shared bucket did exactly
    // that under class-sized load). Reads are cheap and generous; writes are
    // tighter per-client, with a high global backstop that bounds abuse without
    // blocking a realistic burst of concurrent bookings.
    RATE_LIMIT_READ_PER_CLIENT: '120',
    RATE_LIMIT_WRITE_PER_CLIENT: '15',
    RATE_LIMIT_WRITE_GLOBAL: '300',
    RATE_LIMIT_WRITE_PER_EMAIL: '10',  // writes per email per hour (naive-abuse / double-submit cap)
    // A confirmed booking younger than this is trusted unconditionally in the
    // double-booking guard (and skipped by reconciliation). This preserves the
    // authoritative sheet check against the calendar's read-after-write lag: a
    // just-created event may not yet be visible via getEventById, so a fresh row
    // must never be mistaken for a "ghost" (deleted-out-of-band) row.
    GHOST_GRACE_MINUTES: '10',
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
