# Google Apps Script Research for Booking/Scheduling System
## Date: 2026-03-10

### 1. Web App Deployment (doGet/doPost)
- Script must contain `doGet(e)` and/or `doPost(e)` returning `HtmlOutput` or `TextOutput`
- Deploy via Apps Script editor > Deploy > New deployment > Web app
- Settings: "Execute as" (you vs accessing user) and "Who has access" (anyone, anyone with Google, specific users)
- Return JSON: `ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)`
- POST caveat: Apps Script redirects POST requests (302), so clients must follow redirects

### 2. CalendarApp vs Calendar Advanced Service
- **CalendarApp**: Built-in, simpler API. Good for basic CRUD.
- **Calendar Advanced Service**: Wraps the full Google Calendar REST API. Required for free/busy queries across multiple calendars (`Calendar.Freebusy.query()`).
- CalendarApp has NO native free/busy method -- must use Advanced Service or manually check event overlap.

### 3. CalendarApp Patterns
- **List events by title**: `calendar.getEvents(startTime, endTime, {search: 'title pattern'})`
- **Check free/busy**: Use Advanced Calendar Service: `Calendar.Freebusy.query({timeMin, timeMax, items: [{id: calId1}, {id: calId2}]})`
- **Create with attendees**: `calendar.createEvent(title, start, end, {guests: 'email1,email2', sendInvites: true})`
- Access other calendars: `CalendarApp.getCalendarById(calendarId)`

### 4. Email with iCal Attachments
- **MailApp** (simpler, fewer permissions) vs **GmailApp** (full Gmail access)
- Send iCal: Build .ics string manually, create Blob, attach:
  ```javascript
  var icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\n...END:VCALENDAR";
  var blob = Utilities.newBlob(icsContent, 'text/calendar', 'invite.ics');
  MailApp.sendEmail({
    to: email, subject: subject, body: body,
    attachments: [blob]
  });
  ```
- MailApp is preferred if you only need to send (fewer permission prompts)

### 5. SpreadsheetApp as Database
- **Read all**: `sheet.getDataRange().getValues()` returns 2D array
- **Append row**: `sheet.appendRow([val1, val2, val3])`
- **Update specific cell**: `sheet.getRange(row, col).setValue(value)`
- **Find row**: Loop through getValues() result; no native query
- **Performance tip**: Read all data once into memory, manipulate, write back with `setValues()`
- Batch reads/writes are MUCH faster than cell-by-cell

### 6. CORS Handling (GitHub Pages -> Apps Script)
- **Apps Script does NOT support OPTIONS** (preflight) requests -- only GET and POST
- **Solution**: Use `fetch()` with `mode: 'no-cors'` OR (better) set Content-Type to `text/plain` to avoid preflight:
  ```javascript
  fetch(WEBAPP_URL, {
    method: 'POST',
    headers: {'Content-Type': 'text/plain;charset=utf-8'},
    body: JSON.stringify(payload),
    redirect: 'follow'  // Important: Apps Script redirects
  })
  ```
- `mode: 'no-cors'` makes response opaque (can't read it). text/plain approach avoids preflight and allows reading response.
- In doPost, parse body: `JSON.parse(e.postData.contents)`

### 7. Quotas (Free/Consumer Google Accounts)
- **Email**: 50 emails/day (MailApp), 100/day (GmailApp) -- some sources say up to 100
- **Script execution time**: 6 minutes per execution
- **Total trigger runtime**: 90 minutes/day
- **Calendar operations**: ~5,000/day
- **URL Fetch calls**: 20,000/day
- **Properties read/write**: 50,000/day
- **Spreadsheet operations**: Not explicitly capped but slow after ~50k rows
- **Simultaneous executions**: 30 per user
- Quotas reset 24 hours after first request, subject to change without notice

### 8. PropertiesService for Secrets/Config
- `PropertiesService.getScriptProperties()` -- shared across all users of the script
- `PropertiesService.getUserProperties()` -- per-user
- Store: `scriptProperties.setProperty('API_KEY', 'value')`
- Read: `scriptProperties.getProperty('API_KEY')`
- Not visible in code editor but accessible to anyone with script edit access
- For high-value secrets, consider Google Cloud Secret Manager
- Size limit: 9KB per property value, 500KB total per property store

### 9. Token Generation
- `Utilities.getUuid()` -- returns UUID v4 string (uses java.util.UUID.randomUUID())
- NOT cryptographically guaranteed unique but sufficient for session tokens / booking IDs
- For stronger randomness, can combine: `Utilities.getUuid() + Utilities.getUuid()`
- No native crypto.getRandomValues() -- Apps Script runs on server, not browser
- For HMAC signing: `Utilities.computeHmacSha256Signature(value, key)`

### 10. Gotchas and Limitations
- **No WebSockets** -- polling only for real-time updates
- **Cold start latency** -- first request after idle can take 2-5 seconds
- **302 redirects on POST** -- clients must follow redirects (fetch with redirect:'follow')
- **No persistent server state** -- every invocation is stateless; use PropertiesService or Sheets
- **Concurrent writes to Sheets** -- use LockService to prevent race conditions:
  ```javascript
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // wait up to 10s
  // ... write to sheet ...
  lock.releaseLock();
  ```
- **Deployment versioning** -- must create new deployment or update existing; "Test deployments" use HEAD but production uses specific version
- **No npm/node modules** -- vanilla JS (ES6-ish) with Google's built-in services only
- **6-minute execution limit** -- long operations must be chunked with triggers
- **Time zone confusion** -- script TZ vs calendar TZ vs user TZ can cause bugs
