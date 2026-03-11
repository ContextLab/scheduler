# Apps Script Web App API Contract

**Base URL**: `{APPS_SCRIPT_WEB_APP_URL}` (configured in `settings.yaml`)

All requests use `Content-Type: text/plain;charset=utf-8` to avoid CORS preflight.
All request bodies are JSON strings parsed server-side via `JSON.parse(e.postData.contents)`.
All responses are JSON with `Content-Type: application/json`.

## Endpoints

All operations go through a single URL. The `action` field in the request body determines the operation.

---

### GET: Health Check / Config

**Request**: `GET {BASE_URL}?action=health`

**Response** (200):
```json
{
  "status": "ok",
  "version": "1.0.0",
  "quotas": {
    "emails_remaining": 48,
    "daily_email_limit": 50
  }
}
```

---

### POST: Get Available Slots

**Request**:
```json
{
  "action": "getAvailableSlots",
  "startDate": "2026-03-15T00:00:00Z",
  "endDate": "2026-03-22T00:00:00Z",
  "durationMinutes": 30
}
```

**Response** (200):
```json
{
  "success": true,
  "slots": [
    {
      "start": "2026-03-16T14:00:00Z",
      "end": "2026-03-16T14:30:00Z"
    },
    {
      "start": "2026-03-16T14:30:00Z",
      "end": "2026-03-16T15:00:00Z"
    }
  ]
}
```

**Error** (200 — Apps Script always returns 200):
```json
{
  "success": false,
  "error": "Calendar service unavailable"
}
```

---

### POST: Create Booking

**Request**:
```json
{
  "action": "createBooking",
  "meetingTypeId": "office-hours",
  "meetingTypeName": "Office hours",
  "start": "2026-03-16T14:00:00Z",
  "end": "2026-03-16T14:30:00Z",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "format": "virtual",
  "location": "https://dartmouth.zoom.us/my/contextlab",
  "purpose": "Discuss research project",
  "notes": "See attached paper draft"
}
```

**Response** (200):
```json
{
  "success": true,
  "booking": {
    "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "eventId": "abc123xyz",
    "start": "2026-03-16T14:00:00Z",
    "end": "2026-03-16T14:30:00Z",
    "cancelUrl": "https://{GITHUB_PAGES_URL}/cancel.html?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "rescheduleUrl": "https://{GITHUB_PAGES_URL}/reschedule.html?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

**Error — slot taken** (200):
```json
{
  "success": false,
  "error": "SLOT_TAKEN",
  "message": "This time slot is no longer available. Please select another time."
}
```

**Error — validation** (200):
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Email address is required"
}
```

---

### POST: Cancel Booking

**Request**:
```json
{
  "action": "cancelBooking",
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

**Error — already cancelled** (200):
```json
{
  "success": false,
  "error": "ALREADY_CANCELLED",
  "message": "This booking has already been cancelled"
}
```

**Error — not found** (200):
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Booking not found"
}
```

---

### POST: Get Booking (for reschedule pre-fill)

**Request**:
```json
{
  "action": "getBooking",
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response** (200):
```json
{
  "success": true,
  "booking": {
    "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "confirmed",
    "meetingTypeId": "office-hours",
    "start": "2026-03-16T14:00:00Z",
    "end": "2026-03-16T14:30:00Z",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "format": "virtual"
  }
}
```

---

### POST: Reschedule Booking

**Request**:
```json
{
  "action": "rescheduleBooking",
  "oldToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "newStart": "2026-03-17T10:00:00Z",
  "newEnd": "2026-03-17T10:30:00Z"
}
```

**Response** (200):
```json
{
  "success": true,
  "booking": {
    "token": "new-uuid-here",
    "eventId": "newEventId123",
    "start": "2026-03-17T10:00:00Z",
    "end": "2026-03-17T10:30:00Z",
    "cancelUrl": "https://{GITHUB_PAGES_URL}/cancel.html?token=new-uuid-here",
    "rescheduleUrl": "https://{GITHUB_PAGES_URL}/reschedule.html?token=new-uuid-here"
  }
}
```

## Error Codes

| Code | Meaning |
|-|-|
| SLOT_TAKEN | Time slot was booked by someone else |
| VALIDATION_ERROR | Missing or invalid input fields |
| ALREADY_CANCELLED | Booking was already cancelled |
| NOT_FOUND | Token does not match any booking |
| LOCK_TIMEOUT | Could not acquire write lock (concurrent request) |
| CALENDAR_ERROR | Google Calendar API failure |
| EMAIL_ERROR | Email sending failure (quota or other) |
| INTERNAL_ERROR | Unexpected server error |

## Frontend Fetch Pattern

```js
async function apiCall(action, data = {}) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...data })
  });
  return response.json();
}
```
