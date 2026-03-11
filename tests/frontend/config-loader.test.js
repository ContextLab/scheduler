/**
 * T021 — Unit tests for ConfigLoader
 * Tests YAML parsing of meeting types, locations, settings; error handling for missing/malformed files.
 */

const ConfigLoader = require('../../js/config-loader');

// Provide a minimal jsyaml stub for the global scope (ConfigLoader uses global jsyaml)
global.jsyaml = { load: jest.fn((text) => JSON.parse(text)) };

beforeEach(() => {
  ConfigLoader.resetConfig();
  global.fetch = jest.fn();
  global.jsyaml.load.mockImplementation((text) => JSON.parse(text));
});

function mockFetchResponses(meetingTypes, locations, settings) {
  global.fetch.mockImplementation((path) => {
    let data;
    if (path.includes('meeting-types')) data = meetingTypes;
    else if (path.includes('locations')) data = locations;
    else if (path.includes('settings')) data = settings;
    else return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });

    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  });
}

describe('ConfigLoader.validateMeetingTypes', () => {
  test('returns valid meeting types with all required fields', () => {
    const data = {
      meeting_types: [
        { id: 'office', name: 'Office Hours', duration: 15, description: 'Meet about a course' },
        { id: 'chat', name: 'Chat', duration: 15, description: 'Check in' },
      ],
    };
    const result = ConfigLoader.validateMeetingTypes(data);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('office');
  });

  test('filters out entries missing required fields', () => {
    const data = {
      meeting_types: [
        { id: 'valid', name: 'Valid', duration: 15, description: 'OK' },
        { id: 'missing-name', duration: 30 },
        { name: 'Missing ID', duration: 15, description: 'Nope' },
      ],
    };
    const result = ConfigLoader.validateMeetingTypes(data);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid');
  });

  test('returns empty array for null/undefined data', () => {
    expect(ConfigLoader.validateMeetingTypes(null)).toEqual([]);
    expect(ConfigLoader.validateMeetingTypes(undefined)).toEqual([]);
  });

  test('returns empty array when meeting_types is not an array', () => {
    expect(ConfigLoader.validateMeetingTypes({ meeting_types: 'not-array' })).toEqual([]);
    expect(ConfigLoader.validateMeetingTypes({})).toEqual([]);
  });

  test('preserves optional instructions field', () => {
    const data = {
      meeting_types: [
        { id: 'proj', name: 'Project', duration: 30, description: 'Update', instructions: 'Share a doc' },
      ],
    };
    const result = ConfigLoader.validateMeetingTypes(data);
    expect(result[0].instructions).toBe('Share a doc');
  });
});

describe('ConfigLoader.validateLocations', () => {
  test('returns valid locations with all required fields', () => {
    const data = {
      locations: [
        { id: 'virtual', label: 'Virtual (Zoom)', value: 'https://zoom.us/123' },
        { id: 'in-person', label: 'In-person', value: 'Moore 349' },
      ],
    };
    const result = ConfigLoader.validateLocations(data);
    expect(result).toHaveLength(2);
  });

  test('filters out entries missing required fields', () => {
    const data = {
      locations: [
        { id: 'ok', label: 'OK', value: 'somewhere' },
        { id: 'bad' },
      ],
    };
    const result = ConfigLoader.validateLocations(data);
    expect(result).toHaveLength(1);
  });

  test('returns empty array for missing/invalid data', () => {
    expect(ConfigLoader.validateLocations(null)).toEqual([]);
    expect(ConfigLoader.validateLocations({ locations: 'string' })).toEqual([]);
  });
});

describe('ConfigLoader.loadAll', () => {
  test('fetches all three config files and returns parsed config', async () => {
    const meetingTypes = { meeting_types: [{ id: 'a', name: 'A', duration: 15, description: 'd' }] };
    const locations = { locations: [{ id: 'v', label: 'V', value: 'url' }] };
    const settings = { default_timezone: 'America/New_York', min_notice_hours: 12 };

    mockFetchResponses(meetingTypes, locations, settings);

    const config = await ConfigLoader.loadAll();
    expect(config.meetingTypes).toHaveLength(1);
    expect(config.locations).toHaveLength(1);
    expect(config.settings.default_timezone).toBe('America/New_York');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('caches config on subsequent calls', async () => {
    const meetingTypes = { meeting_types: [{ id: 'a', name: 'A', duration: 15, description: 'd' }] };
    const locations = { locations: [{ id: 'v', label: 'V', value: 'url' }] };
    const settings = {};

    mockFetchResponses(meetingTypes, locations, settings);

    await ConfigLoader.loadAll();
    await ConfigLoader.loadAll();
    expect(global.fetch).toHaveBeenCalledTimes(3); // Only first call fetches
  });

  test('throws on fetch failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(ConfigLoader.loadAll()).rejects.toThrow('Failed to load');
  });
});

describe('ConfigLoader.getConfig', () => {
  test('returns null before loadAll', () => {
    expect(ConfigLoader.getConfig()).toBeNull();
  });

  test('returns config after loadAll', async () => {
    mockFetchResponses(
      { meeting_types: [{ id: 'a', name: 'A', duration: 15, description: 'd' }] },
      { locations: [{ id: 'v', label: 'V', value: 'u' }] },
      { timezone: 'UTC' }
    );
    await ConfigLoader.loadAll();
    expect(ConfigLoader.getConfig()).not.toBeNull();
  });
});
