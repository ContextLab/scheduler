/**
 * Config Loader — fetches and parses YAML configuration files.
 * Loads meeting-types.yaml, locations.yaml, and settings.yaml from frontend/config/.
 */

const ConfigLoader = (function () {
  let _config = null;

  async function loadYaml(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return jsyaml.load(text);
  }

  async function loadAll() {
    if (_config) return _config;

    const [meetingTypesData, locationsData, settingsData] = await Promise.all([
      loadYaml('./config/meeting-types.yaml'),
      loadYaml('./config/locations.yaml'),
      loadYaml('./config/settings.yaml'),
    ]);

    const meetingTypes = validateMeetingTypes(meetingTypesData);
    const locations = validateLocations(locationsData);
    const settings = settingsData;

    _config = { meetingTypes, locations, settings };
    return _config;
  }

  function validateMeetingTypes(data) {
    if (!data || !Array.isArray(data.meeting_types)) {
      console.warn('meeting-types.yaml: missing or invalid meeting_types array');
      return [];
    }
    return data.meeting_types.filter(function (mt) {
      var valid = mt.id && mt.name && mt.duration && mt.description;
      if (!valid) {
        console.warn('meeting-types.yaml: skipping invalid entry:', mt);
      }
      return valid;
    });
  }

  function validateLocations(data) {
    if (!data || !Array.isArray(data.locations)) {
      console.warn('locations.yaml: missing or invalid locations array');
      return [];
    }
    return data.locations.filter(function (loc) {
      var valid = loc.id && loc.label && loc.value;
      if (!valid) {
        console.warn('locations.yaml: skipping invalid entry:', loc);
      }
      return valid;
    });
  }

  function getConfig() {
    return _config;
  }

  function resetConfig() {
    _config = null;
  }

  return {
    loadAll: loadAll,
    getConfig: getConfig,
    resetConfig: resetConfig,
    validateMeetingTypes: validateMeetingTypes,
    validateLocations: validateLocations,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigLoader;
}
