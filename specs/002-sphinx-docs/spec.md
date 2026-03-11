# Feature Specification: Sphinx Documentation for CDL Scheduler

**Feature Branch**: `002-sphinx-docs`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Comprehensive ReadTheDocs documentation with setup guide, user guide, configuration reference, automated screenshots, and ContextLab-themed design"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New Administrator Sets Up Their Own Scheduler (Priority: P1)

A new user discovers the CDL Scheduler project and wants to deploy their own instance. They read the documentation site, follow the setup guide step by step, and have a working booking system for their own organization within a single session.

**Why this priority**: Without setup documentation, no one outside the original team can use the project. This is the primary barrier to adoption.

**Independent Test**: Can be tested by having a person with no prior knowledge of the project follow the setup guide from start to finish and successfully deploy a working scheduler instance.

**Acceptance Scenarios**:

1. **Given** a user visits the documentation site, **When** they navigate to the setup guide, **Then** they find a clear table of contents covering all setup steps (prerequisites, backend, frontend, configuration, verification).
2. **Given** a user follows the setup guide, **When** they complete all steps, **Then** they have a working scheduler that shows availability and accepts bookings.
3. **Given** a user encounters a setup step requiring external services (Google account, GitHub), **When** they read the prerequisites section, **Then** they know exactly what accounts and permissions they need before starting.

---

### User Story 2 - End User Learns to Book, Reschedule, and Cancel (Priority: P2)

A person who has been sent a scheduler link wants to understand how to book a meeting, reschedule it, or cancel it. They refer to the user guide with screenshots showing each step of the flow.

**Why this priority**: End users need guidance to complete the booking flow confidently. Screenshots make the process self-explanatory and reduce support requests.

**Independent Test**: Can be tested by having someone with no prior exposure view the user guide and successfully complete each action (book, reschedule, cancel) on a live scheduler instance.

**Acceptance Scenarios**:

1. **Given** a user visits the user guide, **When** they view the booking section, **Then** they see annotated screenshots for each step: meeting type selection, calendar view, form submission, and confirmation.
2. **Given** a user needs to reschedule, **When** they read the reschedule section, **Then** they understand how to use the reschedule link and select a new time.
3. **Given** a user needs to cancel, **When** they read the cancellation section, **Then** they understand how to use the cancel link and what notifications are sent.

---

### User Story 3 - Administrator Customizes Configuration (Priority: P3)

An administrator who has completed initial setup wants to customize their scheduler: change meeting types, adjust timezone, modify availability patterns, or update locations. They consult the configuration reference for all available options.

**Why this priority**: Customization is essential for real-world use but only relevant after initial setup is working.

**Independent Test**: Can be tested by having an administrator change a configuration value (e.g., add a new meeting type) using only the configuration reference and verifying the change takes effect.

**Acceptance Scenarios**:

1. **Given** an administrator visits the configuration reference, **When** they look up a Script Property, **Then** they find its name, description, default value, and example.
2. **Given** an administrator wants to add a meeting type, **When** they read the YAML configuration section, **Then** they see the file format with annotated examples.
3. **Given** an administrator wants to understand the system architecture, **When** they read the architecture overview, **Then** they understand the relationship between the frontend, backend, and Google services.

---

### User Story 4 - Documentation Site Matches Organization Branding (Priority: P4)

The documentation site visually matches the ContextLab website aesthetic (Nunito Sans font, green color scheme, clean academic style), creating a cohesive brand experience across the project's web presence.

**Why this priority**: Visual consistency reinforces professionalism and trust but does not affect functional completeness.

**Independent Test**: Can be tested by visually comparing the documentation site with the ContextLab website and verifying consistent use of colors, fonts, and layout patterns.

**Acceptance Scenarios**:

1. **Given** a user visits the documentation site, **When** they compare it to the ContextLab website, **Then** they see consistent green color scheme, Nunito Sans typography, and clean layout.
2. **Given** a user views the documentation on a mobile device, **When** the page loads, **Then** the layout is responsive and readable.

---

### User Story 5 - Automated Screenshots Stay Current (Priority: P5)

Screenshots in the documentation are generated programmatically from the live application, ensuring they stay accurate as the UI evolves. Screenshots do not reveal personal calendar details or private information.

**Why this priority**: Automated screenshots prevent documentation from becoming stale, but can be initially generated once and updated later.

**Independent Test**: Can be tested by running the screenshot generation script and verifying it produces all required images without exposing private data.

**Acceptance Scenarios**:

1. **Given** a developer runs the screenshot generation script, **When** it completes, **Then** all required screenshots are saved to the documentation assets directory.
2. **Given** screenshots are generated from the live site, **When** they are reviewed, **Then** no personal calendar details, email addresses, or private information is visible.

---

### Edge Cases

- What happens when the documentation is built without screenshots present? The build should succeed with placeholder images or warnings, not fail.
- How does the documentation handle version differences? The docs should note the scheduler version they cover.
- What happens when a user follows setup instructions on a non-standard OS? Prerequisites section should note supported platforms and tool alternatives.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Documentation site MUST be buildable from the `docs/` directory and deployable on ReadTheDocs without errors.
- **FR-002**: Documentation MUST include a setup guide covering: prerequisites, backend setup (Apps Script project creation, code deployment, Script Properties), frontend setup (GitHub Pages), YAML configuration files, and verification steps.
- **FR-003**: Documentation MUST include a user guide covering: booking a meeting, rescheduling, and cancelling, each with at least one screenshot.
- **FR-004**: Documentation MUST include a configuration reference listing all Script Properties, YAML configuration options, and GitHub Action secrets with descriptions, defaults, and examples.
- **FR-005**: Documentation MUST include an architecture overview explaining the system components (static frontend, serverless backend, Google Calendar integration, spreadsheet database) and their interactions.
- **FR-006**: Documentation site MUST visually match the ContextLab website color scheme (primary green), typography (Nunito Sans), and clean academic layout style.
- **FR-007**: Screenshots MUST be generated programmatically and MUST NOT contain personal calendar details, private email addresses, or sensitive configuration values.
- **FR-008**: Documentation MUST include a quick-start overview that summarizes the end-to-end setup process.
- **FR-009**: Documentation MUST render correctly on ReadTheDocs with the custom theme applied.
- **FR-010**: Documentation MUST include a `docs/requirements.txt` file listing all build dependencies for ReadTheDocs.

### Key Entities

- **Documentation Page**: A single page covering one topic (setup, usage, configuration, architecture). Has a title, content body, navigation position, and optional screenshots.
- **Screenshot**: A programmatically generated image of the scheduler UI at a specific step in the user flow. Has a descriptive filename, alt text, and privacy constraints.
- **Configuration Option**: A setting that controls scheduler behavior. Has a name, type, description, default value, and example usage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user with no prior knowledge can follow the setup guide and have a working scheduler instance within 60 minutes.
- **SC-002**: All documentation pages render correctly on ReadTheDocs without build errors or missing assets.
- **SC-003**: 100% of user-facing features (book, reschedule, cancel) are documented with at least one screenshot each.
- **SC-004**: All configuration options (Script Properties, YAML settings, GitHub secrets) are documented with descriptions and examples.
- **SC-005**: Zero personal or sensitive information appears in any documentation screenshot.
- **SC-006**: Documentation site visual design matches ContextLab website branding, verified by side-by-side comparison of colors, fonts, and layout.

## Assumptions

- The scheduler application is already deployed and functional; this feature covers documentation only.
- ReadTheDocs is the hosting platform; builds are triggered automatically from the repository.
- Screenshots can be generated from the live CDL scheduler instance using browser automation, with personal details avoided by using the public-facing pages (meeting type selection, calendar view, booking form) rather than admin/calendar views.
- The ContextLab website at `contextlab.github.io` is the authoritative source for branding guidelines.
- Documentation will use MyST Markdown for ease of authoring, compatible with the Sphinx build system.
- The `docs/` directory structure and `conf.py` follow the standard Sphinx layout expected by ReadTheDocs.
