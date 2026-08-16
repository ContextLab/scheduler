/**
 * Minimal Google Apps Script harness for Node.
 *
 * Loads real backend/*.gs files into a VM sandbox, stubbing ONLY the external
 * Google-service boundary (Calendar Advanced Service, CalendarApp, SpreadsheetApp,
 * LockService, EmailService, ContentService, Config, Logger). Everything else —
 * request handlers, partitioning, busy subtraction, interval containment,
 * overlap detection, the sheet-backed store — is the real production code.
 *
 * Design choice for realism: created calendar events are NOT reflected back into
 * Calendar.Events.list by default (opts.reflectCreatedEvents), deliberately
 * simulating the CalendarApp -> Advanced Service propagation lag that lets a
 * calendar-only re-check miss a just-created booking. This proves the authoritative
 * sheet check is what actually prevents double-booking.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..', '..', 'backend');

/**
 * @param {object} opts
 *   config: {KEY: value} overrides for Config.get
 *   calendarEvents: {calendarId: [rawEventResource]} for Calendar.Events.list
 *   bookingRows: 2D array (incl. header row) backing the Bookings sheet
 *   lock: boolean — whether LockService.tryLock succeeds (default true)
 *   reflectCreatedEvents: boolean — echo createEvent() into Events.list (default false)
 * @param {string[]} files - .gs filenames to load (in order)
 */
function loadBackend(opts, files) {
  opts = opts || {};
  const config = opts.config || {};
  const calendarEvents = opts.calendarEvents || {};
  const bookingRows = opts.bookingRows || null;
  const lockGranted = opts.lock === undefined ? true : opts.lock;
  const reflectCreated = !!opts.reflectCreatedEvents;

  const sandbox = {};
  sandbox.console = console;

  // --- Config stub ---
  sandbox.Config = {
    get: function (key) {
      return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : '';
    },
    getNumber: function (key) {
      return parseInt(sandbox.Config.get(key), 10) || 0;
    },
  };

  // --- Logger stub ---
  sandbox.Logger = { log: function () {} };

  // --- Created-event log (shared by CalendarApp + optional Events.list echo) ---
  const createdEvents = [];
  sandbox._createdEvents = createdEvents;

  // --- Calendar Advanced Service stub ---
  sandbox.Calendar = {
    Events: {
      list: function (calendarId, _params) {
        var items = (calendarEvents[calendarId] || []).slice();
        if (reflectCreated) {
          createdEvents.forEach(function (ce) {
            if (ce._calendarId === calendarId && !ce._deleted) items.push(ce._resource);
          });
        }
        return { items: items, nextPageToken: null };
      },
      // Direct lookup by id. Mirrors the live Advanced API: a deleted event
      // throws a 404-style "Not Found"; a cancelled event returns status
      // 'cancelled'; an active event returns status 'confirmed'.
      get: function (_calendarId, eventId) {
        for (var i = 0; i < createdEvents.length; i++) {
          var ce = createdEvents[i];
          var bareId = String(ce.id).replace(/@google\.com$/i, '');
          if (bareId === eventId || ce.id === eventId) {
            if (ce._deleted) throw new Error('API call to calendar.events.get failed with error: Not Found');
            return (ce._resource && ce._resource.status) ? ce._resource : { status: 'confirmed' };
          }
        }
        throw new Error('API call to calendar.events.get failed with error: Not Found');
      },
    },
  };

  // --- CalendarApp stub (createEvent / getEventById / deleteEvent) ---
  sandbox.CalendarApp = {
    getCalendarById: function (calId) {
      if (!calId) return null;
      return {
        createEvent: function (title, start, end, evOpts) {
          var id = 'evt-' + (createdEvents.length + 1);
          var resource = {
            summary: title,
            start: { dateTime: new Date(start).toISOString() },
            end: { dateTime: new Date(end).toISOString() },
            status: 'confirmed',
          };
          createdEvents.push({
            id: id, title: title, start: start, end: end,
            options: evOpts || {}, _calendarId: calId, _resource: resource, _deleted: false,
          });
          return { getId: function () { return id; } };
        },
        getEventById: function (id) {
          var found = null;
          for (var i = 0; i < createdEvents.length; i++) {
            if (createdEvents[i].id === id) { found = createdEvents[i]; break; }
          }
          // A deleted event is not retrievable in real GAS — getEventById returns
          // null. This lets tests model an event removed out-of-band (directly on
          // the calendar) by flipping _deleted without touching the sheet row.
          if (!found || found._deleted) return null;
          return { deleteEvent: function () { found._deleted = true; } };
        },
      };
    },
  };

  // --- LockService stub ---
  sandbox.LockService = {
    getScriptLock: function () {
      return {
        tryLock: function () { return lockGranted; },
        releaseLock: function () {},
      };
    },
  };

  // --- EmailService stub (records sends) ---
  const sentEmails = [];
  sandbox._sentEmails = sentEmails;
  sandbox.EmailService = {
    sendBookingConfirmation: function (r) { sentEmails.push({ type: 'confirm', record: r }); },
    sendCancellationEmail: function (r) { sentEmails.push({ type: 'cancel', record: r }); },
    sendRescheduleEmail: function (a, b) { sentEmails.push({ type: 'reschedule', from: a, to: b }); },
  };

  // --- ContentService stub (captures JSON payloads) ---
  sandbox.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: function (text) {
      return {
        _text: text,
        setMimeType: function () { return this; },
        getContent: function () { return this._text; },
      };
    },
  };

  // --- Misc GAS globals ---
  var uuidCounter = 0;
  sandbox.Utilities = { getUuid: function () { uuidCounter++; return 'token-' + uuidCounter; } };
  // Stateful in-memory cache so rate-limiting (keyed per client) is exercisable.
  // TTL is ignored (tests fire synchronously); counts accumulate within a run.
  const cacheStore = {};
  sandbox._cacheStore = cacheStore;
  sandbox.CacheService = {
    getScriptCache: function () {
      return {
        get: function (k) { return Object.prototype.hasOwnProperty.call(cacheStore, k) ? cacheStore[k] : null; },
        put: function (k, v) { cacheStore[k] = v; },
      };
    },
  };
  var mailQuota = opts.mailQuota === undefined ? 50 : opts.mailQuota;
  sandbox.MailApp = { getRemainingDailyQuota: function () { return mailQuota; } };

  // --- SpreadsheetApp stub backing BookingStore via an in-memory 2D array ---
  if (bookingRows) {
    var sheet = {
      _rows: bookingRows,
      getDataRange: function () {
        return { getValues: function () { return sheet._rows; } };
      },
      appendRow: function (row) { sheet._rows.push(row.slice()); },
      getRange: function (row, col, numRows, numCols) {
        if (numRows === undefined) {
          return {
            setValue: function (v) { sheet._rows[row - 1][col - 1] = v; },
            getValue: function () { return sheet._rows[row - 1][col - 1]; },
          };
        }
        return {
          setValues: function (vals) {
            for (var r = 0; r < numRows; r++) {
              for (var c = 0; c < numCols; c++) sheet._rows[row - 1 + r][col - 1 + c] = vals[r][c];
            }
          },
          getValues: function () {
            var out = [];
            for (var r = 0; r < numRows; r++) {
              var rr = [];
              for (var c = 0; c < numCols; c++) rr.push(sheet._rows[row - 1 + r][col - 1 + c]);
              out.push(rr);
            }
            return out;
          },
        };
      },
      deleteRow: function (row) { sheet._rows.splice(row - 1, 1); },
    };
    sandbox.SpreadsheetApp = {
      openById: function () {
        return {
          getSheetByName: function () { return sheet; },
          insertSheet: function () { return sheet; },
        };
      },
      flush: function () {},
    };
    sandbox._sheet = sheet;
  }

  const ctx = vm.createContext(sandbox);
  files.forEach(function (f) {
    const code = fs.readFileSync(path.join(BACKEND, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  });
  return ctx;
}

/** Parse the JSON body from a handler's ContentService response. */
function parseResponse(out) {
  return JSON.parse(out.getContent());
}

module.exports = { loadBackend, parseResponse };
