# CDL Scheduler

A self-hosted appointment scheduling system — like YouCanBook.me or Calendly, but free, open-source, and fully under your control.

Built with **GitHub Pages** (frontend) and **Google Apps Script** (backend), CDL Scheduler lets visitors book time on your Google Calendar without needing access to your calendar directly.

## key features

- **Availability-based scheduling** — define availability windows on your Google Calendar; only free slots are shown to visitors
- **Multiple meeting types** — configure different durations and descriptions (office hours, project meetings, etc.)
- **Booking, rescheduling, and cancellation** — visitors manage their own bookings via secure token links
- **Email notifications** — automatic confirmation emails with iCal attachments for both parties
- **Conflict detection** — checks multiple calendars to avoid double-booking
- **Zero cost** — runs entirely on free-tier services (GitHub Pages + Google Apps Script)
- **Privacy-first** — no third-party services; your calendar data stays in your Google account

## quick start

1. **Set up the backend** — create a Google Apps Script project, push the backend code with `clasp`, and configure Script Properties
2. **Deploy the frontend** — fork/clone the repository and enable GitHub Pages
3. **Configure meeting types** — edit YAML files to define your meeting types, locations, and settings
4. **Create availability** — add recurring calendar events matching your availability pattern
5. **Verify** — visit your site, book a test appointment, and confirm everything works

See the {doc}`setup` for detailed step-by-step instructions.

## documentation

```{toctree}
:maxdepth: 2
:caption: contents

setup
user-guide
configuration
architecture
```
