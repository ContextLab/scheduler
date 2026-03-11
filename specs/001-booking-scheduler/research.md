# Research: Booking Scheduler

**Date**: 2026-03-10
**Branch**: `001-booking-scheduler`

## Decision 1: Backend Architecture — Google Apps Script

**Decision**: Use Google Apps Script deployed as a web app for all backend operations (calendar, email, booking storage).

**Rationale**:
- Free, no paid services required (Constitution Principle V)
- Native integration with Google Calendar (CalendarApp) and Gmail (MailApp) — no separate OAuth setup
- Deployed as a web app via `doGet(e)`/`doPost(e)` handlers returning JSON via `ContentService`
- Runs under the owner's Google account, inheriting their calendar and email permissions

**Alternatives considered**:
- Cloudflare Workers: Rejected — free tier exists but requires separate OAuth token management and is a paid service at scale
- GitHub Actions + repository_dispatch: Rejected — high latency (30s+ cold start), complex webhook architecture, not suitable for real-time booking
- Firebase Functions: Rejected — requires billing account even for free tier

**Key technical details**:
- `doPost(e)` receives POST data via `e.postData.contents` (parse with `JSON.parse()`)
- Returns JSON: `ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)`
- 2-5 second cold start latency (acceptable for booking flow)
- 6-minute execution time limit per invocation
- 50 emails/day limit on free accounts (MailApp); sufficient for low-volume booking
- ~5,000 calendar operations/day

## Decision 2: CORS Handling

**Decision**: Use `Content-Type: text/plain;charset=utf-8` for POST requests from GitHub Pages to Apps Script, with `redirect: 'follow'` in fetch options.

**Rationale**:
- Apps Script cannot handle OPTIONS preflight requests
- Setting `Content-Type: application/json` triggers a CORS preflight that will fail
- Using `text/plain` avoids preflight; Apps Script receives the JSON string in `e.postData.contents`
- `redirect: 'follow'` is required because Apps Script POST responses return a 302 redirect

**Alternatives considered**:
- JSONP via doGet: Rejected — only supports GET, not suitable for booking creation
- Proxy server: Rejected — violates zero-cost constraint

## Decision 3: Calendar Availability — CalendarApp + Advanced Calendar Service

**Decision**: Use CalendarApp for basic event operations and the Advanced Calendar Service (`Calendar.Freebusy.query()`) for checking availability across multiple calendars.

**Rationale**:
- `calendar.getEvents(start, end, {search: 'pattern'})` finds availability window events by title
- `Calendar.Freebusy.query()` checks busy times across all linked calendars in a single API call
- CalendarApp handles event creation with guests: `calendar.createEvent(title, start, end, {guests, sendInvites: true})`

**Key patterns**:
- Find availability windows: `calendar.getEvents(startDate, endDate, {search: 'Jeremy office hours'})`
- Check all calendars for conflicts: Advanced Calendar Service Freebusy query
- Create booking event: `calendar.createEvent()` with `{guests: visitorEmail, sendInvites: true}`
- Delete event: `calendar.getEventById(eventId).deleteEvent()`

## Decision 4: Booking Storage — Google Sheets

**Decision**: Use a Google Sheet as the persistence layer for booking metadata.

**Rationale**:
- Free, native Apps Script integration via SpreadsheetApp
- Easy to inspect and debug (owner can view the sheet directly)
- Sufficient for single-owner, low-volume use case
- Supports concurrent access with `LockService` for race condition handling

**Schema** (columns):
- Token (UUID), EventID, Status (confirmed/cancelled/rescheduled), MeetingType, StartTime, EndTime, FirstName, LastName, Email, Format, Location, Purpose, Notes, CreatedAt, CancelledAt, RescheduledTo

**Key patterns**:
- Read: `sheet.getDataRange().getValues()` returns 2D array
- Write: `sheet.appendRow([...])`
- Concurrent safety: `LockService.getScriptLock().tryLock(10000)` before writes
- Lookup by token: iterate rows or use column search

## Decision 5: Token Generation

**Decision**: Use `Utilities.getUuid()` for booking tokens (cancel/reschedule links).

**Rationale**:
- UUID v4 provides sufficient uniqueness and unpredictability for booking tokens
- Simple, built-in, no external dependencies
- For additional security, tokens can be combined with HMAC: `Utilities.computeHmacSha256Signature()`

## Decision 6: Email with iCal Attachments

**Decision**: Use MailApp.sendEmail() with manually constructed .ics content as a Blob attachment.

**Rationale**:
- MailApp requires fewer permission prompts than GmailApp
- iCal content is a simple text format that can be constructed as a string
- Attach via: `Utilities.newBlob(icsContent, 'text/calendar', 'invite.ics')`

**Key pattern**:
```
var icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\n...END:VCALENDAR";
var blob = Utilities.newBlob(icsContent, 'text/calendar', 'invite.ics');
MailApp.sendEmail({to: email, subject: subject, body: body, attachments: [blob]});
```

## Decision 7: Frontend YAML Parsing

**Decision**: Use js-yaml library via CDN for parsing YAML configuration files.

**Rationale**:
- Most popular browser YAML parser (~6KB minified+gzipped)
- No build system required — single CDN script tag
- GitHub Pages serves .yaml files as static assets without issues

**Key pattern**:
```html
<script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>
```
```js
const response = await fetch('./config/meeting-types.yaml');
const data = jsyaml.load(await response.text());
```

**Note**: Add `.nojekyll` file to repo root to prevent GitHub Pages Jekyll processing from ignoring files.

## Decision 8: Calendar UI Component

**Decision**: Use FullCalendar library for the time slot display.

**Rationale**:
- No build system required — global JS bundle via CDN
- Built-in `timeGridWeek` and `timeGridDay` views with scrollable time slots
- Active maintenance, extensive documentation
- ~45KB gzipped — reasonable for the functionality provided

**Alternatives considered**:
- tui-calendar (toast-ui/calendar): Rejected — v2 requires npm/build tooling; v1 is legacy
- Vanilla JS: Rejected — significant effort to match FullCalendar's navigation and responsive features

**Key pattern**:
```html
<link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
```

## Quotas & Limits Summary

| Resource | Free Account Limit |
|-|-|
| MailApp emails/day | 50 |
| Script execution time | 6 min/invocation |
| Total trigger runtime | 90 min/day |
| Calendar operations/day | ~5,000 |
| Simultaneous executions | 30 |
| PropertiesService storage | 500KB total, 9KB/value |
| Sheets rows | 10 million cells/spreadsheet |

## Gotchas & Mitigations

1. **Cold start latency** (2-5s): Show loading spinner on frontend; acceptable for booking flow
2. **No WebSockets**: Use request-response pattern only; no real-time updates
3. **POST 302 redirects**: Frontend must use `redirect: 'follow'` in fetch options
4. **Timezone mismatches**: Store all times in UTC; convert on frontend using Intl API
5. **Concurrent Sheets writes**: Always use LockService before writing to booking sheet
6. **50 email/day limit**: Each booking sends 2 emails (visitor + owner); limit is ~25 bookings/day — sufficient for stated scale
