# Implementation Plan: Booking Scheduler

**Branch**: `001-booking-scheduler` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-booking-scheduler/spec.md`

## Summary

A YouCanBook.me clone that runs as a static GitHub Pages site with a Google Apps Script backend. Visitors select a meeting type, view available calendar slots, fill out a booking form, and confirm. The system creates Google Calendar events, sends iCal invites and confirmation emails. Supports cancel/reschedule via secure links. All configuration (meeting types, locations, availability pattern) via YAML files. Zero cost — uses only free Google services.

## Technical Context

**Language/Version**: JavaScript (ES2020+) for frontend; Google Apps Script (V8 runtime) for backend
**Primary Dependencies**: js-yaml (YAML parsing), FullCalendar or similar (calendar UI), Google Apps Script built-in services (CalendarApp, GmailApp, SpreadsheetApp, PropertiesService)
**Storage**: Google Sheets (booking metadata, tokens) via SpreadsheetApp; YAML files (static config)
**Testing**: Jest (frontend unit tests), Apps Script manual + clasp-based testing, end-to-end manual verification
**Target Platform**: GitHub Pages (static frontend), Google Apps Script (backend web app)
**Project Type**: Web application (static frontend + serverless backend)
**Performance Goals**: Page load < 3s, booking confirmation < 30s, email delivery < 2 min
**Constraints**: Zero cost (no paid services), GitHub Pages static-only hosting, Apps Script execution time limit (6 min/execution), Gmail daily email quota (100/day free account)
**Scale/Scope**: Single-owner calendar, low volume (estimated < 20 bookings/day)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-|-|-|
| I. Static Hosting | PASS | Frontend is static HTML/CSS/JS on GitHub Pages; backend is Google Apps Script (free) |
| II. No Public Secrets | PASS | Calendar IDs, owner email stored in Apps Script PropertiesService; OAuth handled by Apps Script runtime; no secrets in repo |
| III. Manual Verification | PASS | QA workflow requires owner sign-off on real calendar, real email, real browser |
| IV. Automated Test Suite | PASS | Jest for frontend logic, Apps Script tests for backend, integration tests against real Google services |
| V. Zero Cost | PASS | GitHub Pages (free), Google Apps Script (free), Google Sheets (free), Gmail sending (free, 100/day quota) |

## Project Structure

### Documentation (this feature)

```text
specs/001-booking-scheduler/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Apps Script API endpoints)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── index.html               # Main scheduling page
├── css/
│   └── styles.css           # Sage green theme (#CCE2D8)
├── js/
│   ├── app.js               # Main app logic, routing
│   ├── calendar.js          # Calendar UI component
│   ├── booking-form.js      # Booking form logic + validation
│   ├── config-loader.js     # YAML config loading
│   ├── api-client.js        # Apps Script backend communication
│   └── timezone.js          # Timezone detection + conversion
├── config/
│   ├── meeting-types.yaml   # Meeting type definitions
│   ├── locations.yaml       # Location options (virtual/in-person)
│   └── settings.yaml        # General settings (availability pattern, min notice, etc.)
├── confirm.html             # Booking confirmation page
├── cancel.html              # Cancellation page
├── reschedule.html          # Reschedule flow page
└── lib/                     # Third-party libraries (js-yaml, calendar lib)

backend/
├── Code.gs                  # Main Apps Script: doGet/doPost handlers, routing
├── Calendar.gs              # Calendar operations (availability, create/delete events)
├── Email.gs                 # Email sending (iCal invites, confirmations, cancellations)
├── Booking.gs               # Booking CRUD (Google Sheets operations)
├── Token.gs                 # Secure token generation + validation
├── Config.gs                # PropertiesService configuration helpers
└── appsscript.json          # Apps Script manifest

tests/
├── frontend/
│   ├── config-loader.test.js
│   ├── booking-form.test.js
│   ├── calendar.test.js
│   └── timezone.test.js
├── backend/
│   ├── test-calendar.gs     # Integration tests for calendar operations
│   ├── test-email.gs        # Integration tests for email
│   ├── test-booking.gs      # Integration tests for booking store
│   └── test-token.gs        # Token generation/validation tests
└── e2e/
    └── booking-flow.test.js # End-to-end test runner
```

**Structure Decision**: Web application pattern with separated frontend (static GitHub Pages) and backend (Google Apps Script). Config YAML files live in frontend/config/ since they're served as static assets. Backend .gs files are managed via clasp for local development and deployed to Google Apps Script.

## Complexity Tracking

> No constitution violations — no entries needed.
