# Tasks: Booking Scheduler

**Input**: Design documents from `/specs/001-booking-scheduler/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/apps-script-api.md, quickstart.md

**Tests**: Included — required by Constitution Principle IV (Automated Test Suite).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, directory structure, and dependency setup

- [x] T001 Create project directory structure per plan.md (frontend/, backend/, tests/, frontend/config/, frontend/css/, frontend/js/, frontend/lib/)
- [x] T002 Add `.nojekyll` file to repository root to disable Jekyll processing on GitHub Pages
- [x] T003 [P] Create `frontend/config/meeting-types.yaml` with 7 seed meeting types (office hours 15m, chat 15m, project meeting 30m, other 15/30/45/60m)
- [x] T004 [P] Create `frontend/config/locations.yaml` with virtual (Zoom link placeholder) and in-person (office address placeholder) options
- [x] T005 [P] Create `frontend/config/settings.yaml` with defaults (availability_pattern: "Jeremy office hours", min_notice_hours: 12, max_advance_days: 90, default_timezone: "America/New_York", theme_color: "#CCE2D8", apps_script_url: placeholder)
- [x] T006 [P] Download js-yaml 4.1.0 minified to `frontend/lib/js-yaml.min.js` and add CDN fallback in HTML
- [x] T007 [P] Download FullCalendar 6.1.11 global bundle (JS + CSS) to `frontend/lib/`
- [x] T008 [P] Create `backend/appsscript.json` manifest with V8 runtime and Calendar advanced service enabled
- [x] T009 [P] Create `.gitignore` with entries for `.env`, `.clasprc.json`, `node_modules/`, and any credentials files
- [x] T010 [P] Initialize `tests/frontend/package.json` with Jest as test dependency
- [x] T011 [P] Create `backend/.clasp.json` template (script ID placeholder, rootDir set to backend/)
- [x] T011a [P] Create pre-commit hook or CI step in `.github/workflows/secret-scan.yml` that scans staged files for potential secrets (API keys, tokens, passwords, email addresses) and blocks the commit/push if any are detected; use a pattern-based approach (regex for common secret formats)

**Checkpoint**: Project skeleton ready — all directories, config files, and dependencies in place

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T012 Implement YAML config loader in `frontend/js/config-loader.js` — fetch and parse meeting-types.yaml, locations.yaml, and settings.yaml; export loaded config objects
- [x] T013 Implement API client in `frontend/js/api-client.js` — generic `apiCall(action, data)` function using fetch with `text/plain` content-type, `redirect: 'follow'`, JSON parse response; error handling for non-success responses
- [x] T014 Implement timezone utilities in `frontend/js/timezone.js` — auto-detect visitor timezone via `Intl.DateTimeFormat`, convert UTC↔local, format dates for display; support timezone override
- [x] T015 [P] Create base HTML layout in `frontend/index.html` — sage green theme (#CCE2D8), responsive meta tags, include js-yaml, FullCalendar, and app JS files; create step-based UI skeleton (step 1: meeting type, step 2: calendar, step 3: form, step 4: confirmation)
- [x] T016 [P] Create base CSS in `frontend/css/styles.css` — sage green (#CCE2D8) theme, responsive layout, typography, form styles, calendar container styles, step navigation, loading spinner, error message styles
- [x] T017 [P] Implement Apps Script routing in `backend/Code.gs` — doGet(e) for health check, doPost(e) with JSON.parse(e.postData.contents), route by `action` field to handler functions, return JSON via ContentService; include CORS origin validation that checks request origin against GITHUB_PAGES_URL from PropertiesService and rejects requests from unauthorized origins
- [x] T018 [P] Implement Apps Script config helpers in `backend/Config.gs` — getProperty/setProperty wrappers around PropertiesService.getScriptProperties(), with defaults for CALENDAR_ID, OWNER_EMAIL, OWNER_NAME, SPREADSHEET_ID, GITHUB_PAGES_URL
- [x] T019 [P] Implement token generation in `backend/Token.gs` — generateToken() using Utilities.getUuid() with token_expires_at set to 90 days from creation, validateToken(token) that looks up in Sheets and rejects expired tokens (compares token_expires_at against current time)
- [x] T020 [P] Implement booking store in `backend/Booking.gs` — createBooking(data) appends row to Sheet, getBookingByToken(token) searches rows, updateBookingStatus(token, status) modifies row; all writes use LockService.getScriptLock()

**Checkpoint**: Foundation ready — config loading, API client, backend routing, and data store operational

---

## Phase 3: User Story 1 — Book a Meeting (Priority: P1) 🎯 MVP

**Goal**: Visitor selects meeting type → views available slots → fills form → confirms → event created + emails sent

**Independent Test**: Visit live site, complete full booking flow, verify calendar event + emails received

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T021 [P] [US1] Unit test for config loader in `tests/frontend/config-loader.test.js` — test YAML parsing of meeting types, locations, settings; test error handling for missing/malformed files
- [x] T022 [P] [US1] Unit test for booking form validation in `tests/frontend/booking-form.test.js` — test required field validation (first name, last name, email, format), email format validation, form data extraction
- [x] T023 [P] [US1] Unit test for timezone conversion in `tests/frontend/timezone.test.js` — test UTC↔local conversion, timezone detection, date formatting across timezones
- [x] T024 [P] [US1] Integration test for calendar operations in `backend/test-calendar.gs` — test finding availability windows by title pattern, test free/busy query across calendars, test slot generation for different durations (15/30/45/60 min)
- [x] T025 [P] [US1] Integration test for booking store in `backend/test-booking.gs` — test createBooking writes correct row to Sheet, test getBookingByToken retrieval, test concurrent writes with LockService
- [x] T026 [P] [US1] Integration test for email sending in `backend/test-email.gs` — test iCal attachment generation, test confirmation email to owner, test invite email to visitor
- [x] T026a [P] [US1] Integration test for concurrent booking in `backend/test-booking.gs` — simulate two simultaneous createBooking calls for the same time slot; verify only one succeeds and the other receives SLOT_TAKEN error
- [x] T026b [P] [US1] Unit test for UI state management in `tests/frontend/app-state.test.js` — test step navigation (type → calendar → form → confirm), loading spinner display/hide, error message rendering, back navigation between steps
- [x] T026c [P] [US1] Unit test for timezone selector in `tests/frontend/timezone.test.js` — test timezone dropdown rendering, timezone override selection, fallback to default_timezone when Intl API unavailable

### Implementation for User Story 1

- [x] T027 [US1] Implement calendar availability logic in `backend/Calendar.gs` — getAvailableSlots(startDate, endDate, durationMinutes): find events matching availability_pattern on designated calendar, check free/busy across all calendars via Calendar advanced service, generate available slots of requested duration, enforce min_notice_hours and max_advance_days
- [x] T028 [US1] Implement email sending in `backend/Email.gs` — sendBookingConfirmation(booking) sends confirmation email to visitor with iCal (.ics) attachment (for non-Google calendar users) + separate confirmation email to owner; note: the native Google Calendar invite is sent automatically by CalendarApp.createEvent({guests, sendInvites: true}) in T029; buildICalContent(booking) generates valid .ics string; createICalBlob(icsContent) wraps in Blob; sendCancellationEmail(booking) and sendRescheduleEmail(booking, newBooking) stubs for US2/US3
- [x] T029 [US1] Implement createBooking handler in `backend/Code.gs` — validate input, re-check slot availability (race condition prevention), acquire lock, create calendar event via CalendarApp.createEvent() with guests/location/description, store booking in Sheet, send emails, return booking with token and cancel/reschedule URLs
- [x] T030 [US1] Implement getAvailableSlots handler in `backend/Code.gs` — validate date range, call Calendar.gs, return slots array
- [x] T031 [US1] Implement meeting type selection UI in `frontend/js/app.js` — load meeting types from config, render cards/buttons for each type with name, description, duration; on selection advance to calendar step
- [x] T032 [US1] Implement calendar slot display in `frontend/js/calendar.js` — initialize FullCalendar with timeGridWeek view, fetch available slots from backend for visible date range, render slots as clickable events, handle week/day navigation and slot selection; apply sage green theme colors
- [x] T033 [US1] Implement booking form in `frontend/js/booking-form.js` — render form with first name, last name, email, in-person/virtual dropdown (options from locations.yaml), meeting purpose, additional notes; validate on submit; send createBooking request to backend
- [x] T034 [US1] Create confirmation page in `frontend/confirm.html` — display booking details (type, date/time, location, attendee), show cancel and reschedule links; parse booking data from URL params or sessionStorage
- [x] T035 [US1] Wire up end-to-end booking flow in `frontend/js/app.js` — step navigation (type → calendar → form → confirm), loading states, error handling, transition animations between steps

**Checkpoint**: Full booking flow works end-to-end — select type, pick slot, fill form, confirm, event created, emails sent

---

## Phase 4: User Story 2 — Cancel a Booking (Priority: P2)

**Goal**: Visitor clicks cancel link → event deleted → both parties notified

**Independent Test**: Complete a booking (US1), click cancel link, verify event removed + cancellation emails received

### Tests for User Story 2 ⚠️

- [x] T036 [P] [US2] Integration test for cancellation in `backend/test-booking.gs` — test cancelBooking deletes calendar event, updates Sheet status, test already-cancelled token, test invalid token

### Implementation for User Story 2

- [x] T037 [US2] Implement cancelBooking handler in `backend/Code.gs` — validate token, look up booking in Sheet, verify status is "confirmed", delete calendar event by eventId, update booking status to "cancelled" with cancelled_at timestamp, send cancellation emails to both parties
- [x] T038 [US2] Implement cancellation email in `backend/Email.gs` — sendCancellationEmail(booking) sends notification to visitor and owner with event details and cancellation confirmation
- [x] T039 [US2] Create cancellation page in `frontend/cancel.html` — read token from URL params, call cancelBooking API, display success message or error (already cancelled, invalid token); include link back to scheduling page

**Checkpoint**: Cancel flow works — click link, event deleted, both parties notified

---

## Phase 5: User Story 3 — Reschedule a Booking (Priority: P3)

**Goal**: Visitor clicks reschedule link → selects new time → old event cancelled, new event created → both parties notified

**Independent Test**: Complete a booking (US1), click reschedule, pick new time, verify old event removed + new event created + emails sent

### Tests for User Story 3 ⚠️

- [x] T040 [P] [US3] Integration test for rescheduling in `backend/test-booking.gs` — test rescheduleBooking cancels old event, creates new event, updates Sheet, test reschedule of already-cancelled booking

### Implementation for User Story 3

- [x] T041 [US3] Implement getBooking handler in `backend/Code.gs` — validate token, return booking details (meeting type, visitor info) for pre-filling reschedule form
- [x] T042 [US3] Implement rescheduleBooking handler in `backend/Code.gs` — validate oldToken, verify booking is confirmed, check new slot availability, acquire lock, delete old calendar event, create new calendar event, update old booking status to "rescheduled" with rescheduled_to pointer, create new booking row, send reschedule emails
- [x] T043 [US3] Implement reschedule email in `backend/Email.gs` — sendRescheduleEmail(oldBooking, newBooking) sends notification to both parties with old and new time details
- [x] T044 [US3] Create reschedule page in `frontend/reschedule.html` — read token from URL params, call getBooking API to get meeting type, load calendar with available slots for that duration, on slot selection call rescheduleBooking API, display confirmation or error

**Checkpoint**: Reschedule flow works — click link, pick new time, old event removed, new event created, both parties notified

---

## Phase 6: User Story 4 — Configure Meeting Types (Priority: P4)

**Goal**: Owner edits YAML file to customize meeting types; site reflects changes on redeploy

**Independent Test**: Modify meeting-types.yaml, push to GitHub, verify site displays updated types

### Implementation for User Story 4

- [x] T045 [US4] Add YAML validation to config loader in `frontend/js/config-loader.js` — validate meeting type schema (required: id, name, duration, description; optional: instructions), log warnings for invalid entries, gracefully skip malformed types
- [x] T046 [US4] Add meeting type documentation to `README.md` — document YAML schema for meeting-types.yaml with all fields, provide examples, explain how to add/remove/modify types

**Checkpoint**: Meeting types are fully configurable via YAML with validation and documentation

---

## Phase 7: User Story 5 — Configure Locations (Priority: P5)

**Goal**: Owner edits YAML file to customize locations; booking form reflects changes

**Independent Test**: Modify locations.yaml, push to GitHub, book meeting with each format, verify correct location on calendar event

### Implementation for User Story 5

- [x] T047 [US5] Add YAML validation to config loader in `frontend/js/config-loader.js` — validate location schema (required: id, label, value), log warnings for invalid entries
- [x] T048 [US5] Add location documentation to `README.md` — document YAML schema for locations.yaml with all fields, provide examples for virtual (Zoom, Teams, etc.) and in-person options

**Checkpoint**: Locations are fully configurable via YAML with validation and documentation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T049 [P] Create comprehensive `README.md` in repository root — project overview, features list, screenshots placeholder, link to quickstart.md for setup instructions, link to specs for technical details
- [x] T050 [P] Create `docs/setup-guide.md` — step-by-step Google Apps Script setup (create project, enable Calendar API, set script properties, deploy as web app); GATE: every instruction MUST be verified by fetching the current Google Apps Script documentation URLs via web search/fetch before finalizing — never assume or hallucinate steps
- [x] T051 [P] Create `docs/google-account-setup.md` — how to create/configure a Google account for this project, enable APIs, create OAuth consent screen if needed; GATE: every instruction MUST be verified by fetching current Google Cloud Console documentation URLs via web search/fetch before finalizing
- [x] T052 Add input sanitization to all backend handlers in `backend/Code.gs` — escape HTML in user inputs, validate email format server-side, enforce string length limits
- [x] T053 Add rate limiting to backend in `backend/Code.gs` — track requests per IP/session in Sheet or CacheService, reject excessive requests with friendly error
- [x] T054 [P] Add mobile-responsive CSS in `frontend/css/styles.css` — media queries for mobile/tablet, touch-friendly slot selection, responsive form layout
- [x] T055 [P] Create end-to-end test script in `tests/e2e/booking-flow.test.js` — automated test that exercises full booking → cancel → reschedule flow against live backend
- [x] T056 Add error boundary and offline handling in `frontend/js/app.js` — graceful error messages for network failures, Apps Script timeouts, and calendar unavailability
- [x] T057 Run quickstart.md validation — follow every step in quickstart.md on a fresh setup to verify accuracy; update any incorrect instructions
- [x] T058 [P] Add GitHub Pages deployment configuration — ensure correct directory structure for Pages deployment, add GitHub Actions workflow if needed for build step
- [x] T059 Security hardening — verify CORS origin checking in Apps Script, ensure tokens are UUID v4 with expiry, verify no secrets in committed files, add Content-Security-Policy headers to HTML
- [x] T060 [P] Accessibility pass in `frontend/` — add ARIA labels to form inputs, calendar navigation, and step indicators; ensure keyboard navigation works for slot selection and form submission; verify color contrast meets WCAG AA for sage green theme

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP, must complete first
- **User Story 2 (Phase 4)**: Depends on US1 (needs working booking to cancel)
- **User Story 3 (Phase 5)**: Depends on US1 (needs working booking to reschedule)
- **User Story 4 (Phase 6)**: Can start after Foundational (config loader independent)
- **User Story 5 (Phase 7)**: Can start after Foundational (config loader independent)
- **Polish (Phase 8)**: Depends on US1-US3 completion

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no other story dependencies
- **US2 (P2)**: Depends on US1 (cancel requires a confirmed booking to exist)
- **US3 (P3)**: Depends on US1 (reschedule requires a confirmed booking to exist)
- **US4 (P4)**: Independent after Foundational — config validation enhancement
- **US5 (P5)**: Independent after Foundational — config validation enhancement

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend logic before frontend UI
- Core operations before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T011)
- Foundational: T015-T020 can run in parallel (different files)
- US1 tests: T021-T026 can all run in parallel
- US4 and US5 can run in parallel with each other (and with US2/US3 if staffed)
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "Unit test for config loader in tests/frontend/config-loader.test.js"
Task: "Unit test for booking form validation in tests/frontend/booking-form.test.js"
Task: "Unit test for timezone conversion in tests/frontend/timezone.test.js"
Task: "Integration test for calendar operations in backend/test-calendar.gs"
Task: "Integration test for booking store in backend/test-booking.gs"
Task: "Integration test for email sending in backend/test-email.gs"

# Then implementation (backend first, then frontend):
Task: "Implement calendar availability logic in backend/Calendar.gs"
Task: "Implement email sending in backend/Email.gs"
# Then (depends on above):
Task: "Implement createBooking handler in backend/Code.gs"
Task: "Implement getAvailableSlots handler in backend/Code.gs"
# Frontend (can parallel with backend after API client exists):
Task: "Implement meeting type selection UI in frontend/js/app.js"
Task: "Implement calendar slot display in frontend/js/calendar.js"
Task: "Implement booking form in frontend/js/booking-form.js"
# Then wire-up (depends on all above):
Task: "Wire up end-to-end booking flow in frontend/js/app.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test booking flow end-to-end manually
5. Deploy to GitHub Pages

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → Deploy (MVP!)
3. US2 (Cancel) → Test independently → Deploy
4. US3 (Reschedule) → Test independently → Deploy
5. US4 + US5 (Config) → Test independently → Deploy
6. Polish → Final testing → Deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All backend .gs files are pushed to Apps Script via `clasp push`
- Frontend files are deployed via GitHub Pages on push to main
