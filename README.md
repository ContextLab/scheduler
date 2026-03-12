# Booking Scheduler

[![Documentation Status](https://readthedocs.org/projects/cdl-scheduler/badge/?version=latest)](https://cdl-scheduler.readthedocs.io/en/latest/?badge=latest)
[![GitHub Pages](https://img.shields.io/website?url=https%3A%2F%2Fcontextlab.github.io%2Fscheduler&label=demo)](https://contextlab.github.io/scheduler)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A self-hosted scheduling application inspired by YouCanBook.me and Calendly, running as a static GitHub Pages frontend with a free Google Apps Script backend.

## Features

- **Meeting type selection** — configurable via YAML (office hours, check-ins, project meetings, custom durations)
- **Calendar availability** — reads availability windows from Google Calendar, checks configured calendars for conflicts
- **Booking form** — collects visitor details, supports in-person and virtual formats
- **Email notifications** — sends confirmation, cancellation, and reschedule emails with iCal attachments
- **Cancel & reschedule** — secure token-based links in every confirmation email
- **Zero cost** — GitHub Pages (free) + Google Apps Script (free) + Google Sheets (free)

## Documentation

Full documentation is available at **[cdl-scheduler.readthedocs.io](https://cdl-scheduler.readthedocs.io)**:

- **[Setup Guide](https://cdl-scheduler.readthedocs.io/en/latest/setup.html)** — step-by-step deployment instructions (Apps Script backend, GitHub Pages frontend, YAML configuration, GitHub Actions)
- **[User Guide](https://cdl-scheduler.readthedocs.io/en/latest/user-guide.html)** — how to book, reschedule, and cancel appointments, with screenshots
- **[Configuration Reference](https://cdl-scheduler.readthedocs.io/en/latest/configuration.html)** — all Script Properties, YAML config files, and GitHub Secrets
- **[Architecture Overview](https://cdl-scheduler.readthedocs.io/en/latest/architecture.html)** — system design, component descriptions, and data flow diagrams

## Quick Start

1. Fork this repository
2. Set up the Google Apps Script backend (`clasp create`, `clasp push`)
3. Configure Script Properties (calendar ID, email, spreadsheet ID, etc.)
4. Update `config/settings.yaml` with your Apps Script URL
5. Enable GitHub Pages on your fork
6. Create availability events on your Google Calendar

See the [full setup guide](https://cdl-scheduler.readthedocs.io/en/latest/setup.html) for detailed instructions.

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

docs/              Sphinx documentation (ReadTheDocs)
scripts/           Developer tools (screenshot generation)
```

## Tech Stack

- **Frontend**: HTML, CSS, vanilla JavaScript (no build tools)
- **Backend**: Google Apps Script (V8 runtime)
- **Database**: Google Sheets
- **Calendar**: Google Calendar API (via CalendarApp + Calendar Advanced Service)
- **Email**: Google MailApp + CalendarApp native invites
- **Documentation**: Sphinx + Furo theme + MyST Markdown
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
clasp push --force
```

Then create a new versioned deployment in the [Apps Script editor](https://script.google.com) (Deploy > Manage deployments > New version).

### Generating Documentation Screenshots

```bash
pip install playwright
playwright install chromium
python scripts/generate-screenshots.py
```

### Building Documentation Locally

```bash
pip install -r docs/requirements.txt
sphinx-build -b html docs docs/_build
open docs/_build/index.html
```

## License

MIT
