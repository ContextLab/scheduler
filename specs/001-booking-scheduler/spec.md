# Feature Specification: Booking Scheduler (YouCanBook.me Clone)

**Feature Branch**: `001-booking-scheduler`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "YouCanBook.me clone scheduling app for GitHub Pages"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Book a Meeting (Priority: P1)

A visitor arrives at the scheduling page, selects a meeting type (e.g., "Office hours" or "Project meeting"), views available time slots on a navigable calendar, picks a slot, fills out a booking form with their name, email, meeting format (in-person/virtual), and purpose, then confirms the booking. The system creates a calendar event (adding the visitor as a guest, which triggers a native Google Calendar invite), and sends a separate confirmation email to the calendar owner.

**Why this priority**: This is the core value proposition — without booking, the app has no purpose. Every other feature depends on this flow working end-to-end.

**Independent Test**: Can be fully tested by visiting the live site, selecting a meeting type, choosing a time slot, filling out the form, and confirming. Verified by checking that (a) the event appears on the owner's Google Calendar, (b) the visitor receives an iCal email invite, and (c) the owner receives a confirmation email.

**Acceptance Scenarios**:

1. **Given** the scheduling page is loaded, **When** a visitor selects "Office hours" (15 min), **Then** the calendar displays only time slots that are 15 minutes long, fall within the owner's designated availability windows, and do not conflict with any existing events on linked calendars.
2. **Given** available slots are displayed, **When** the visitor clicks a slot on Wednesday at 2:00 PM, **Then** a booking form appears with fields for first name, last name, email, in-person/virtual dropdown, meeting purpose, and additional notes.
3. **Given** the booking form is filled out completely, **When** the visitor clicks "Confirm Booking," **Then** the system creates an event on the owner's Google Calendar with correct title, time, location, and notes; sends an iCal invite to the visitor's email; sends a confirmation email to the owner; and displays a confirmation page with event details and cancel/reschedule links.
4. **Given** a visitor tries to book a slot with less than 12 hours notice, **Then** that slot is not shown as available.
5. **Given** a visitor tries to book more than 90 days in advance, **Then** those dates are not shown.

---

### User Story 2 - Cancel a Booking (Priority: P2)

A visitor who previously booked a meeting clicks the "Cancel" link in their confirmation email or on the confirmation page. The system deletes the event from the owner's calendar and sends cancellation emails to both the visitor and the owner.

**Why this priority**: Cancellation is essential for managing calendar hygiene. Without it, no-shows clog the owner's schedule and there's no self-service way to free up slots.

**Independent Test**: Can be tested by first completing a booking (US1), then clicking the cancel link. Verified by checking that (a) the event is removed from the owner's calendar, (b) both parties receive cancellation emails.

**Acceptance Scenarios**:

1. **Given** a visitor has a confirmed booking, **When** they click the cancel link, **Then** the system displays a cancellation confirmation page, deletes the calendar event, and sends cancellation emails to both the visitor and the owner.
2. **Given** a cancel link has already been used, **When** someone clicks it again, **Then** the system displays a message that the booking was already cancelled.
3. **Given** a cancel link with an invalid or expired token, **When** someone clicks it, **Then** the system displays an error message without modifying any calendar events.

---

### User Story 3 - Reschedule a Booking (Priority: P3)

A visitor who previously booked a meeting clicks the "Reschedule" link. The system brings them back to the scheduling page (pre-populated with their meeting type), lets them pick a new time slot, and upon confirmation cancels the old event and creates a new one, emailing both parties about the change.

**Why this priority**: Rescheduling is the next most common action after cancellation and prevents visitors from having to cancel-then-rebook manually.

**Independent Test**: Can be tested by completing a booking (US1), clicking reschedule, selecting a new time, and confirming. Verified by checking that (a) the old event is removed, (b) a new event is created at the new time, (c) both parties receive reschedule notification emails.

**Acceptance Scenarios**:

1. **Given** a visitor has a confirmed booking, **When** they click the reschedule link, **Then** the scheduling page loads with their meeting type pre-selected and available slots shown.
2. **Given** the visitor selects a new time slot during rescheduling, **When** they confirm, **Then** the old event is deleted, a new event is created, and both parties receive emails about the change.
3. **Given** a visitor is rescheduling but decides not to pick a new time, **When** they navigate away, **Then** the original booking remains unchanged.

---

### User Story 4 - Configure Meeting Types (Priority: P4)

The calendar owner defines meeting types in a YAML configuration file, specifying names, descriptions, durations, and any special instructions. The scheduling page reads this file and displays the meeting types to visitors.

**Why this priority**: Configuration is essential for the owner to customize the system, but a hardcoded default set can serve as MVP while this is formalized.

**Independent Test**: Can be tested by modifying the YAML file, deploying, and verifying the scheduling page reflects the updated meeting types.

**Acceptance Scenarios**:

1. **Given** the meeting types YAML file contains 7 meeting types, **When** a visitor loads the scheduling page, **Then** all 7 types are displayed with their names, descriptions, and durations.
2. **Given** a meeting type is removed from the YAML file, **When** the site is redeployed, **Then** that type no longer appears on the scheduling page.

---

### User Story 5 - Configure Locations (Priority: P5)

The calendar owner defines meeting locations in a YAML file (e.g., virtual = Zoom link, in-person = office address). When a visitor selects "In-person" or "Virtual" on the booking form, the corresponding location is used in the calendar event's location field.

**Why this priority**: Location configuration is a refinement of the booking flow (US1) that can be hardcoded initially.

**Independent Test**: Can be tested by updating the locations YAML, booking a meeting with each format option, and verifying the calendar event has the correct location.

**Acceptance Scenarios**:

1. **Given** the locations YAML defines "virtual" as a Zoom link and "in-person" as an office address, **When** a visitor selects "Virtual" and books, **Then** the calendar event location is set to the Zoom link.
2. **Given** a visitor selects "In-person," **When** the booking is confirmed, **Then** the calendar event location is set to the office address.

---

### Edge Cases

- What happens when a visitor and another person try to book the same slot simultaneously? The system MUST handle race conditions — the first confirmed booking wins; the second visitor sees an error and is asked to pick another slot.
- What happens when the owner's calendar becomes unavailable (API error)? The system MUST display a friendly error message asking the visitor to try again later.
- What happens when a visitor enters an invalid email address? The form MUST validate email format before submission.
- What happens when all slots for a day are booked? That day MUST appear as fully booked (greyed out or no slots shown).
- What happens if the owner has no availability windows defined? The system MUST display a message that no times are currently available.
- What happens across timezone boundaries? Slots MUST be displayed in the visitor's detected timezone (with option to change), but stored in UTC. If timezone detection fails (e.g., privacy browser), the system MUST fall back to the default_timezone from settings.yaml (America/New_York).

## Clarifications

### Session 2026-03-10

- Q: What naming pattern should availability window events use? → A: Configurable via YAML; default: "Jeremy office hours"
- Q: Backend architecture for calendar/email API calls? → A: Google Apps Script deployed as a web app (free, native Google integration)
- Q: Where should booking state (tokens, visitor info) be persisted? → A: Google Sheets (free, native Apps Script integration, easy to inspect)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display meeting types read from a YAML configuration file, including name, description, and duration for each type.
- **FR-002**: System MUST check a designated Google Calendar for events whose title matches a configurable template name (defined in YAML, default: "Jeremy office hours") to determine availability windows. Availability is identified by title pattern match; the event's free/busy transparency status is not used for filtering (CalendarApp does not support filtering by transparency).
- **FR-003**: System MUST check all linked calendars for conflicts (busy times) and exclude those times from available slots.
- **FR-004**: System MUST generate available time slots based on the selected meeting duration (15, 30, 45, or 60 minutes) within availability windows and free of conflicts.
- **FR-005**: System MUST enforce a minimum booking notice of 12 hours.
- **FR-006**: System MUST enforce a maximum advance booking window of 90 days.
- **FR-007**: System MUST display available slots in a scrollable, navigable calendar view where visitors can click to select a slot.
- **FR-008**: System MUST collect visitor information via a booking form: first name (required), last name (required), email (required), in-person/virtual (dropdown, required), meeting purpose (text), and additional notes (text).
- **FR-009**: System MUST validate all form inputs (required fields present, valid email format) before submission.
- **FR-010**: System MUST create a Google Calendar event on the owner's designated calendar with correct title, time, duration, location (from locations YAML), and notes (from form).
- **FR-011**: System MUST add the visitor as a guest on the calendar event (which triggers a native Google Calendar invite). A separate confirmation email with an iCal (.ics) attachment MUST also be sent via MailApp for non-Google calendar users.
- **FR-012**: System MUST send a confirmation email to the calendar owner.
- **FR-013**: System MUST display a confirmation page after successful booking, including event details and cancel/reschedule links.
- **FR-014**: System MUST support cancellation via a secure link that deletes the calendar event and notifies both parties.
- **FR-015**: System MUST support rescheduling via a secure link that returns the visitor to the scheduling flow, then cancels the old event and creates a new one upon confirmation.
- **FR-016**: System MUST read location options (virtual/in-person with addresses/links) from a YAML configuration file.
- **FR-017**: System MUST display times in the visitor's timezone (auto-detected with option to change), defaulting to America/New_York.
- **FR-018**: System MUST use a sage green (#CCE2D8) theme color scheme.
- **FR-019**: Cancel and reschedule links MUST use cryptographically secure, single-use or time-limited tokens.
- **FR-020**: System MUST handle concurrent booking attempts gracefully — first confirmation wins, second receives an error with option to pick another slot.

### Key Entities

- **Meeting Type**: A category of meeting with a name, description, duration (15/30/45/60 min), and optional special instructions. Defined in YAML configuration.
- **Location**: A meeting venue option (e.g., Zoom link, office address) associated with a format label (virtual/in-person). Defined in YAML configuration.
- **Availability Window**: A time block on the owner's calendar whose title matches the configurable template name (YAML setting, default: "Jeremy office hours"), representing times the owner is available for bookings. Identified by title pattern match only (not by free/busy transparency status).
- **Booking**: A confirmed meeting with a visitor, containing: visitor info (name, email), meeting type, time slot, location, purpose, notes, and a unique secure token for cancel/reschedule operations.
- **Calendar Event**: The Google Calendar representation of a booking, including title, time, duration, location, description (with notes), and attendees.
- **Booking Store**: A Google Sheet used as the persistence layer for booking metadata, including visitor info, secure tokens (cancel/reschedule), event IDs, and booking status. Accessed natively from Google Apps Script.

### Assumptions

- The calendar owner has a Google account with Google Calendar API access enabled.
- The owner pre-creates "availability window" events on a designated calendar (similar to Google Calendar's "appointment slots" concept) — these are recurring or one-off events marked as "free" with a recognizable title pattern.
- The backend is a Google Apps Script deployed as a web app, running under the owner's Google account. It natively accesses Google Calendar and Gmail without separate OAuth setup. Sensitive configuration (calendar IDs, etc.) is stored in Apps Script's PropertiesService, never in the public repo.
- Email sending uses Apps Script's MailApp/GmailApp service — zero cost, no separate API keys needed.
- The site serves a single owner's calendar (not multi-tenant).
- The `apps_script_url` in settings.yaml is a public endpoint URL (not a secret). The URL alone does not grant write access — the Apps Script enforces its own authorization.
- Booking rows in Google Sheets accumulate indefinitely for MVP. No automated cleanup or archival is implemented initially; this is a future consideration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can complete the full booking flow (select type → pick slot → fill form → confirm) in under 2 minutes.
- **SC-002**: 100% of confirmed bookings result in a correctly created calendar event visible on the owner's Google Calendar within 30 seconds.
- **SC-003**: 100% of confirmed bookings result in an iCal invite delivered to the visitor's email within 2 minutes.
- **SC-004**: 100% of confirmed bookings result in a confirmation email delivered to the owner within 2 minutes.
- **SC-005**: Cancellation via the cancel link removes the calendar event and notifies both parties within 30 seconds.
- **SC-006**: Rescheduling via the reschedule link results in the old event being removed and a new event created, with both parties notified within 30 seconds.
- **SC-007**: The scheduling page loads and displays available slots within 3 seconds on a standard broadband connection.
- **SC-008**: The system correctly prevents double-booking — no two visitors can confirm the same time slot.
- **SC-009**: All form validation errors are displayed inline before submission, preventing invalid bookings.
- **SC-010**: The site is fully functional and visually correct on desktop and mobile browsers (Chrome, Firefox, Safari, Edge).
