# Booking Scheduler

A self-hosted scheduling application inspired by YouCanBook.me, running as a static GitHub Pages frontend with a free Google Apps Script backend.

## Features

- **Meeting type selection** — configurable via YAML (office hours, check-ins, project meetings, custom durations)
- **Calendar availability** — reads availability windows from Google Calendar, checks all linked calendars for conflicts
- **Booking form** — collects visitor details, supports in-person and virtual formats
- **Email notifications** — sends confirmation, cancellation, and reschedule emails with iCal attachments
- **Cancel & reschedule** — secure token-based links in every confirmation email
- **Zero cost** — GitHub Pages (free) + Google Apps Script (free) + Google Sheets (free)

## Quick Start

See [quickstart.md](specs/001-booking-scheduler/quickstart.md) for full setup instructions.

## Configuration

### Meeting Types (`config/meeting-types.yaml`)

Define available meeting types. Each entry requires:

| Field | Required | Description |
|-|-|-|
| `id` | Yes | Unique identifier (e.g., `office-hours`) |
| `name` | Yes | Display name (e.g., "Office Hours") |
| `duration` | Yes | Duration in minutes (15, 30, 45, or 60) |
| `description` | Yes | Short description shown to visitors |
| `instructions` | No | Additional instructions (shown in italics) |

Example:

```yaml
meeting_types:
  - id: office-hours
    name: "Office Hours"
    duration: 15
    description: "Meet with me about a course you're enrolled in this term."
  - id: project-meeting
    name: "Project Meeting"
    duration: 30
    description: "Discuss or provide an update on a lab project."
    instructions: "Please share a Google Doc with your agenda before we meet."
```

To add a new type, add an entry to the `meeting_types` array. To remove one, delete the entry. Changes take effect on the next GitHub Pages deployment.

### Locations (`config/locations.yaml`)

Define meeting format options shown in the booking form dropdown.

| Field | Required | Description |
|-|-|-|
| `id` | Yes | Unique identifier (e.g., `virtual`, `in-person`) |
| `label` | Yes | Display label in the dropdown |
| `value` | Yes | Value stored on the calendar event (URL or address) |

Example:

```yaml
locations:
  - id: virtual
    label: "Virtual (Zoom)"
    value: "https://dartmouth.zoom.us/my/contextlab"
  - id: in-person
    label: "In-person"
    value: "Moore 349, Dartmouth College, Hanover, NH 03755"
```

You can add additional formats (e.g., Microsoft Teams, Google Meet, phone call) by adding entries.

### Settings (`config/settings.yaml`)

| Field | Description | Default |
|-|-|-|
| `availability_pattern` | Calendar event title pattern for availability windows | `Jeremy office hours` |
| `min_notice_hours` | Minimum hours before a slot can be booked | `12` |
| `max_advance_days` | Maximum days in advance a slot can be booked | `90` |
| `default_timezone` | Default timezone for new visitors | `America/New_York` |
| `theme_color` | Primary theme color | `#CCE2D8` |
| `apps_script_url` | Deployed Google Apps Script web app URL | — |

## Architecture

```
index.html         Main booking flow (4-step wizard)
cancel.html        Cancellation page
reschedule.html    Reschedule page
config/            YAML configuration files
css/               Styles (sage green theme)
js/                Application modules
lib/               Vendored libraries (js-yaml, FullCalendar)

backend/           Google Apps Script
  Code.gs          Request routing and handlers
  Calendar.gs      Availability detection and slot generation
  Email.gs         Email sending with iCal attachments
  Booking.gs       Google Sheets CRUD for bookings
  Config.gs        Script Properties wrapper
  Token.gs         Secure token generation and validation
```

## Tech Stack

- **Frontend**: HTML, CSS, vanilla JavaScript (no build tools)
- **Backend**: Google Apps Script (V8 runtime)
- **Database**: Google Sheets
- **Calendar**: Google Calendar API (via CalendarApp + Calendar Advanced Service)
- **Email**: Google MailApp + CalendarApp native invites
- **Libraries**: [js-yaml](https://github.com/nodeca/js-yaml) (YAML parsing), [FullCalendar](https://fullcalendar.io/) v6.1.11 (calendar UI)

## Development

### Running Frontend Tests

```bash
cd tests/frontend
npm install
npm test
```

### Deploying Backend

```bash
cd backend
clasp login
clasp push
clasp deploy
```

## License

MIT
