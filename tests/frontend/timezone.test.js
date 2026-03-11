/**
 * T023 + T026c — Unit tests for TimezoneUtil
 * Tests UTC-local conversion, timezone detection, date formatting, timezone selector rendering.
 */

const TimezoneUtil = require('../../js/timezone');

describe('TimezoneUtil.detect', () => {
  test('detects browser timezone via Intl API', () => {
    const tz = TimezoneUtil.detect('America/New_York');
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  test('falls back to provided default when Intl unavailable', () => {
    const origIntl = global.Intl;
    global.Intl = undefined;
    const tz = TimezoneUtil.detect('Europe/London');
    expect(tz).toBe('Europe/London');
    global.Intl = origIntl;
  });

  test('falls back to America/New_York when no default provided and Intl unavailable', () => {
    const origIntl = global.Intl;
    global.Intl = undefined;
    const tz = TimezoneUtil.detect();
    expect(tz).toBe('America/New_York');
    global.Intl = origIntl;
  });
});

describe('TimezoneUtil.setTimezone / getTimezone', () => {
  test('set and get timezone', () => {
    TimezoneUtil.setTimezone('Asia/Tokyo');
    expect(TimezoneUtil.getTimezone()).toBe('Asia/Tokyo');
  });
});

describe('TimezoneUtil.formatDate', () => {
  beforeEach(() => TimezoneUtil.setTimezone('America/New_York'));

  test('formats UTC date string to readable date', () => {
    const result = TimezoneUtil.formatDate('2026-03-15T14:00:00Z');
    expect(result).toMatch(/March/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Sunday/);
  });
});

describe('TimezoneUtil.formatTime', () => {
  beforeEach(() => TimezoneUtil.setTimezone('America/New_York'));

  test('formats UTC time string to local time', () => {
    const result = TimezoneUtil.formatTime('2026-03-15T14:00:00Z');
    expect(result).toMatch(/10:00\s*AM/i);
  });

  test('formats time in different timezone', () => {
    TimezoneUtil.setTimezone('Europe/London');
    const result = TimezoneUtil.formatTime('2026-03-15T14:00:00Z');
    expect(result).toMatch(/2:00\s*PM/i);
  });
});

describe('TimezoneUtil.formatDateTime', () => {
  beforeEach(() => TimezoneUtil.setTimezone('America/New_York'));

  test('combines date and time with "at"', () => {
    const result = TimezoneUtil.formatDateTime('2026-03-15T14:00:00Z');
    expect(result).toContain('at');
    expect(result).toMatch(/March/);
  });
});

describe('TimezoneUtil.formatTimeRange', () => {
  beforeEach(() => TimezoneUtil.setTimezone('America/New_York'));

  test('formats start-end time range', () => {
    const result = TimezoneUtil.formatTimeRange('2026-03-15T14:00:00Z', '2026-03-15T14:30:00Z');
    expect(result).toContain('\u2013');
    expect(result).toMatch(/10:00\s*AM/i);
    expect(result).toMatch(/10:30\s*AM/i);
  });
});

describe('TimezoneUtil.utcToLocal', () => {
  beforeEach(() => TimezoneUtil.setTimezone('America/New_York'));

  test('converts UTC date to local Date object', () => {
    const local = TimezoneUtil.utcToLocal('2026-03-15T14:00:00Z');
    expect(local instanceof Date).toBe(true);
  });
});

describe('TimezoneUtil.localToUtc', () => {
  test('returns ISO string from Date object', () => {
    const date = new Date('2026-03-15T10:00:00');
    const result = TimezoneUtil.localToUtc(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result).toMatch(/Z$/);
  });
});

describe('TimezoneUtil.getTimezoneAbbreviation', () => {
  test('returns a non-empty abbreviation string', () => {
    TimezoneUtil.setTimezone('America/New_York');
    const abbr = TimezoneUtil.getTimezoneAbbreviation();
    expect(typeof abbr).toBe('string');
    expect(abbr.length).toBeGreaterThan(0);
  });
});

describe('TimezoneUtil.getCommonTimezones', () => {
  test('returns array of timezone objects with value and label', () => {
    const tzList = TimezoneUtil.getCommonTimezones();
    expect(Array.isArray(tzList)).toBe(true);
    expect(tzList.length).toBeGreaterThan(0);
    tzList.forEach((tz) => {
      expect(tz).toHaveProperty('value');
      expect(tz).toHaveProperty('label');
    });
  });

  test('includes America/New_York', () => {
    const tzList = TimezoneUtil.getCommonTimezones();
    const ny = tzList.find((tz) => tz.value === 'America/New_York');
    expect(ny).toBeDefined();
    expect(ny.label).toContain('Eastern');
  });
});

// T026c — Timezone selector UI tests
describe('Timezone selector UI', () => {
  beforeEach(() => {
    // Safe: hardcoded test fixture, not untrusted content
    document.body.textContent = '';
    const select = document.createElement('select');
    select.id = 'timezone-select';
    document.body.appendChild(select);
  });

  test('can populate dropdown with common timezones', () => {
    const select = document.getElementById('timezone-select');
    const timezones = TimezoneUtil.getCommonTimezones();
    timezones.forEach((tz) => {
      const option = document.createElement('option');
      option.value = tz.value;
      option.textContent = tz.label;
      select.appendChild(option);
    });
    expect(select.options.length).toBe(timezones.length);
  });

  test('selecting timezone updates TimezoneUtil', () => {
    TimezoneUtil.setTimezone('America/New_York');
    expect(TimezoneUtil.getTimezone()).toBe('America/New_York');
    TimezoneUtil.setTimezone('Asia/Tokyo');
    expect(TimezoneUtil.getTimezone()).toBe('Asia/Tokyo');
  });
});
