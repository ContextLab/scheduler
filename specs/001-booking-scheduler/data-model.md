# Data Model: Booking Scheduler

**Date**: 2026-03-10
**Branch**: `001-booking-scheduler`

## Entities

### MeetingType (YAML config — `frontend/config/meeting-types.yaml`)

| Field | Type | Required | Description |
|-|-|-|-|
| id | string | yes | Unique slug identifier (e.g., `office-hours`) |
| name | string | yes | Display name (e.g., "Office hours") |
| duration | integer | yes | Duration in minutes (15, 30, 45, or 60) |
| description | string | yes | Description shown to visitor |
| instructions | string | no | Special instructions (e.g., "Share a Google Doc beforehand") |

### Location (YAML config — `frontend/config/locations.yaml`)

| Field | Type | Required | Description |
|-|-|-|-|
| id | string | yes | Unique identifier (e.g., `virtual`, `in-person`) |
| label | string | yes | Display label in dropdown |
| value | string | yes | Location string for calendar event (e.g., Zoom link or office address) |

### Settings (YAML config — `frontend/config/settings.yaml`)

| Field | Type | Required | Default | Description |
|-|-|-|-|-|
| availability_pattern | string | yes | "Jeremy office hours" | Title pattern to match availability window events |
| min_notice_hours | integer | yes | 12 | Minimum hours before a slot can be booked |
| max_advance_days | integer | yes | 90 | Maximum days in advance a slot can be booked |
| default_timezone | string | yes | "America/New_York" | Default display timezone |
| theme_color | string | yes | "#CCE2D8" | Primary theme color (sage green) |
| apps_script_url | string | yes | — | Deployed Google Apps Script web app URL |

### Booking (Google Sheets — one row per booking)

| Column | Type | Required | Description |
|-|-|-|-|
| token | string (UUID) | yes | Unique secure token for cancel/reschedule links |
| token_expires_at | ISO 8601 datetime | yes | Token expiry time (default: 90 days after booking creation). Expired tokens are rejected by validateToken() |
| event_id | string | yes | Google Calendar event ID |
| status | enum | yes | `confirmed`, `cancelled`, `rescheduled` |
| meeting_type_id | string | yes | References MeetingType.id |
| start_time | ISO 8601 datetime | yes | Booking start time (UTC) |
| end_time | ISO 8601 datetime | yes | Booking end time (UTC) |
| first_name | string | yes | Visitor's first name |
| last_name | string | yes | Visitor's last name |
| email | string | yes | Visitor's email address |
| format | string | yes | `virtual` or `in-person` |
| location | string | yes | Resolved location string from locations.yaml |
| purpose | string | no | Meeting purpose text |
| notes | string | no | Additional notes/links |
| created_at | ISO 8601 datetime | yes | When the booking was created |
| cancelled_at | ISO 8601 datetime | no | When the booking was cancelled (if applicable) |
| rescheduled_to | string (UUID) | no | Token of the new booking (if rescheduled) |

### AvailabilityWindow (derived — not stored)

Computed at query time from Google Calendar events whose title matches the availability pattern (title match only — free/busy transparency status is not used for filtering, as CalendarApp does not support filtering by transparency).

| Field | Type | Description |
|-|-|-|
| start | datetime | Start of availability window |
| end | datetime | End of availability window |
| calendar_id | string | Which calendar the window is on |

### CalendarEvent (Google Calendar — created by the system)

| Field | Mapping | Description |
|-|-|-|
| title | `{MeetingType.name} — {FirstName} {LastName}` | Event title |
| start | Booking.start_time | Event start |
| end | Booking.end_time | Event end |
| location | Booking.location | From locations.yaml based on format |
| description | Constructed from purpose + notes + cancel/reschedule links | Event description/notes |
| guests | Booking.email | Visitor added as attendee |

## Relationships

```
MeetingType (YAML) ──< Booking (Sheets) >── Location (YAML)
                           │
                           ▼
                    CalendarEvent (Google Calendar)
```

- A Booking references one MeetingType (by `meeting_type_id`)
- A Booking has one resolved Location (by `format` → lookup in locations.yaml)
- A Booking creates one CalendarEvent (linked by `event_id`)
- A rescheduled Booking points to a new Booking (via `rescheduled_to` token)

## State Transitions

```
                    ┌──────────┐
                    │ confirmed│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
        ┌───────────┐       ┌─────────────┐
        │ cancelled  │       │ rescheduled │
        └───────────┘       └──────┬──────┘
                                   │
                                   ▼
                            ┌──────────┐
                            │ confirmed│ (new booking)
                            └──────────┘
```

- `confirmed` → `cancelled`: Via cancel link; event deleted; emails sent
- `confirmed` → `rescheduled`: Via reschedule link; old event deleted; new booking created as `confirmed`; `rescheduled_to` points to new token
- Terminal states: `cancelled`, `rescheduled` (no further transitions)

## Concurrency Control

- All Sheets writes MUST acquire `LockService.getScriptLock()` before modifying the booking sheet
- Double-booking prevention: Before creating a calendar event, re-check that the time slot is still free; if not, release lock and return error
- Lock timeout: 10 seconds; if lock cannot be acquired, return "busy, try again" error
