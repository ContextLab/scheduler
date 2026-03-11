# Tasks: Sphinx Documentation for CDL Scheduler

**Input**: Design documents from `/specs/002-sphinx-docs/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Sphinx project with dependencies and build configuration

- [X] T001 Create docs/requirements.txt with pinned dependencies: sphinx, furo, myst-parser
- [X] T002 Create docs/conf.py with Sphinx configuration: project name "CDL Scheduler", Furo theme, myst_parser extension, custom CSS, ContextLab branding via light_css_variables (color-brand-primary: #007030)
- [X] T003 [P] Create docs/_static/custom.css with Nunito Sans Google Fonts import, heading styles (lowercase, letter-spacing 0.6px, weight 300), and ContextLab color overrides
- [X] T004 Update .readthedocs.yaml to uncomment and enable python requirements: docs/requirements.txt
- [X] T005 Create placeholder docs/index.md with minimal content to verify build
- [X] T006 Verify local Sphinx build succeeds: run sphinx-build -b html docs docs/_build and confirm no errors

**Checkpoint**: Sphinx project builds locally with Furo theme and ContextLab branding applied

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create landing page and architecture overview that all other docs reference

**⚠️ CRITICAL**: Index page structure must be finalized before individual content pages

- [X] T007 Write docs/index.md with project overview (what CDL Scheduler does, key features), quick-start summary (5-step overview linking to setup.md), and toctree listing all documentation pages
- [X] T008 [P] Write docs/architecture.md with system architecture overview: component descriptions (GitHub Pages frontend, Apps Script backend, Google Calendar integration, Google Sheets database), data flow for booking/cancel/reschedule, and a text-based architecture diagram
- [X] T009 Create docs/_static/screenshots/ directory with a placeholder .gitkeep file

**Checkpoint**: Landing page and architecture overview render correctly with navigation

---

## Phase 3: User Story 1 - Setup Guide (Priority: P1) 🎯 MVP

**Goal**: A new user can follow the setup guide to deploy their own scheduler instance

**Independent Test**: Follow the guide from scratch on a clean GitHub account and verify a working scheduler

### Implementation for User Story 1

- [X] T010 [US1] Write docs/setup.md prerequisites section: Google account, GitHub account, Node.js with npm (for clasp), git; list required Google API access (Calendar, Gmail)
- [X] T011 [US1] Write docs/setup.md backend setup section: install clasp, create Apps Script project (clasp create), push backend code (clasp push --force), set Script Properties (CALENDAR_ID, OWNER_EMAIL, OWNER_NAME, SPREADSHEET_ID, GITHUB_PAGES_URL, AVAILABILITY_PATTERN, CONFLICT_CALENDAR_IDS, MIN_NOTICE_HOURS, MAX_ADVANCE_DAYS, TOKEN_EXPIRY_DAYS), enable Calendar Advanced Service, create versioned deployment
- [X] T012 [US1] Write docs/setup.md frontend setup section: fork/clone repository, update config/settings.yaml with Apps Script URL, enable GitHub Pages (Settings > Pages > Deploy from branch: main), verify site loads at username.github.io/scheduler
- [X] T013 [US1] Write docs/setup.md configuration section: edit config/meeting-types.yaml (customize meeting types, durations, descriptions), edit config/locations.yaml (virtual/in-person options), edit config/settings.yaml (timezone, notice hours, advance days)
- [X] T014 [US1] Write docs/setup.md GitHub Actions section: add APPS_SCRIPT_URL and CLEANUP_KEY as repository secrets, verify cleanup workflow exists, test manual trigger
- [X] T015 [US1] Write docs/setup.md verification section: create test availability event on Google Calendar matching AVAILABILITY_PATTERN, visit scheduler site, confirm slots appear, make test booking, verify calendar event and emails received

**Checkpoint**: Setup guide is complete and covers the full deployment flow

---

## Phase 4: User Story 2 - User Guide (Priority: P2)

**Goal**: End users can learn to book, reschedule, and cancel meetings with visual guidance

**Independent Test**: A person with no prior exposure can follow the guide and complete each action

### Implementation for User Story 2

- [X] T016 [US2] Write docs/user-guide.md booking section: selecting a meeting type, viewing the calendar, clicking an available slot, filling out the booking form (name, email, format, purpose, notes), submitting and receiving confirmation; include screenshot placeholders for each step
- [X] T017 [US2] Write docs/user-guide.md rescheduling section: finding the reschedule link (confirmation email or calendar event), selecting a new time, confirming the reschedule, receiving updated confirmation; include screenshot placeholders
- [X] T018 [US2] Write docs/user-guide.md cancellation section: finding the cancel link, confirming cancellation, notification sent to both parties; include screenshot placeholders
- [X] T019 [US2] Write docs/user-guide.md email notifications section: describe what emails are sent (confirmation, cancellation, reschedule) and to whom (requester + calendar owner), mention iCal attachment

**Checkpoint**: User guide covers all three user flows with placeholder screenshots

---

## Phase 5: User Story 3 - Configuration Reference (Priority: P3)

**Goal**: Administrators can look up and modify any configuration option

**Independent Test**: An administrator can change a setting using only the reference docs

### Implementation for User Story 3

- [X] T020 [P] [US3] Write docs/configuration.md Script Properties section: table with columns Name, Description, Default, Example for all properties (CALENDAR_ID, OWNER_EMAIL, OWNER_NAME, SPREADSHEET_ID, GITHUB_PAGES_URL, AVAILABILITY_PATTERN, CONFLICT_CALENDAR_IDS, MIN_NOTICE_HOURS, MAX_ADVANCE_DAYS, TOKEN_EXPIRY_DAYS, CLEANUP_KEY)
- [X] T021 [P] [US3] Write docs/configuration.md YAML files section: annotated examples of config/settings.yaml, config/meeting-types.yaml, and config/locations.yaml with field-by-field descriptions
- [X] T022 [P] [US3] Write docs/configuration.md GitHub Secrets section: table with APPS_SCRIPT_URL and CLEANUP_KEY, how to set them (Settings > Secrets and variables > Actions), what they control
- [X] T023 [US3] Write docs/configuration.md advanced section: adding custom meeting types, changing the availability pattern, configuring which calendars to check for conflicts (JSON array format)

**Checkpoint**: All configuration options are documented with defaults and examples

---

## Phase 6: User Story 5 - Automated Screenshots (Priority: P5)

**Goal**: Screenshots are generated programmatically and integrated into the user guide

**Independent Test**: Run the screenshot script and verify all images are produced without private data

### Implementation for User Story 5

- [X] T024 [US5] Create scripts/generate-screenshots.py with Playwright Python: install chromium, navigate to the live scheduler URL, capture meeting type selection page (step 1)
- [X] T025 [US5] Add screenshot captures for: calendar view with available slots, booking form (pre-filled with demo data "Jane Doe", "jane@example.com"), confirmation page after mock flow
- [X] T026 [US5] Add screenshot captures for reschedule page (calendar with available slots) and cancel page (confirmation message)
- [X] T027 [US5] Add privacy safeguards: verify no real email addresses, calendar IDs, or personal event titles appear in any screenshot; crop or mask if needed
- [X] T028 [US5] Save all screenshots to docs/_static/screenshots/ with descriptive filenames (01-meeting-types.png, 02-calendar-view.png, 03-booking-form.png, 04-confirmation.png, 05-reschedule.png, 06-cancel.png)
- [X] T029 [US5] Update docs/user-guide.md to replace screenshot placeholders with actual image references using MyST image directives

**Checkpoint**: All screenshots generated, privacy-verified, and integrated into user guide

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Build verification, ReadTheDocs deployment, and final quality checks

- [X] T030 Run full Sphinx build (sphinx-build -b html docs docs/_build) and fix any warnings or errors
- [X] T031 [P] Add docs/ to .gitignore for _build/ directory (docs/_build/)
- [ ] T032 Commit and push all documentation; verify build succeeds on ReadTheDocs at cdl-scheduler.readthedocs.io
- [X] T033 Visual comparison of rendered docs site with ContextLab website (contextlab.github.io) for branding consistency: check colors, fonts, heading styles, overall aesthetic
- [X] T034 Review all documentation pages for accuracy: verify setup steps match actual project structure, config options match current Code.gs/Config.gs defaults, architecture diagram reflects current system
- [ ] T035 Manual walkthrough: follow setup guide on the rendered docs site and verify clarity and completeness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (needs working Sphinx build)
- **US1 Setup Guide (Phase 3)**: Depends on Phase 2 (needs index.md toctree)
- **US2 User Guide (Phase 4)**: Depends on Phase 2 (needs index.md toctree)
- **US3 Config Reference (Phase 5)**: Depends on Phase 2 (needs index.md toctree)
- **US5 Screenshots (Phase 6)**: Depends on Phase 4 (needs user-guide.md with placeholders)
- **Polish (Phase 7)**: Depends on all content phases complete

### User Story Dependencies

- **US1 (Setup Guide)**: Independent after Phase 2
- **US2 (User Guide)**: Independent after Phase 2 (screenshot placeholders first, real images in Phase 6)
- **US3 (Config Reference)**: Independent after Phase 2
- **US4 (Themed Design)**: Handled in Phase 1 setup (conf.py + custom.css) — foundational
- **US5 (Screenshots)**: Depends on US2 completion (needs placeholder locations in user-guide.md)

### Parallel Opportunities

- T003 can run in parallel with T001/T002 (different files)
- T008 can run in parallel with T007 (different files)
- T020, T021, T022 can all run in parallel (different sections of same file, but independent content)
- US1 (Phase 3), US2 (Phase 4), and US3 (Phase 5) can run in parallel after Phase 2

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Sphinx setup with Furo theme + branding
2. Complete Phase 2: Index page + architecture overview
3. Complete Phase 3: Setup guide (US1)
4. **STOP and VALIDATE**: Verify docs build on ReadTheDocs with branded theme and complete setup guide

### Incremental Delivery

1. Setup + Foundational → Docs site live with branding
2. Add US1 (Setup Guide) → Primary adoption blocker removed
3. Add US2 (User Guide) + US3 (Config Reference) → Full docs coverage
4. Add US5 (Screenshots) → Visual polish for user guide
5. Polish → Final verification and cleanup

---

## Notes

- US4 (Themed Design) is embedded in Phase 1 setup tasks (T002, T003) rather than a separate phase, since it's foundational
- Screenshots (US5) are deferred to Phase 6 so content can be written with placeholders first
- All content pages use MyST Markdown (.md) for ease of authoring
- Screenshots are committed to the repo so ReadTheDocs doesn't need Playwright installed
