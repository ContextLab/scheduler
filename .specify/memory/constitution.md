<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - I. Static Hosting → updated to remove paid service examples (Cloudflare Workers,
    Netlify Functions, Express server); now references free-tier serverless options only
  - II. No Public Secrets → updated storage options to remove paid platform references
- Added sections:
  - V. Zero Cost (NON-NEGOTIABLE) — new principle prohibiting paid services
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ No updates needed
  - .specify/templates/spec-template.md ✅ No updates needed
  - .specify/templates/tasks-template.md ✅ No updates needed
- Follow-up TODOs:
  - Spec (specs/001-booking-scheduler/spec.md) references "lightweight serverless
    proxy" in Assumptions — MUST be updated to align with zero-cost constraint
-->

# Scheduler Constitution

## Core Principles

### I. Static Hosting (NON-NEGOTIABLE)

The application MUST run entirely as a GitHub Pages site. All user-facing
functionality MUST be delivered via static HTML, CSS, and JavaScript served
from GitHub Pages. Any server-side logic (calendar API calls, email sending,
event creation) MUST be handled through free-tier serverless functions
(e.g., GitHub Actions, Google Apps Script, or other zero-cost options)
that the static frontend calls. No server-side rendering or dynamic
hosting is permitted for the frontend. 100% local operation is preferred
where possible.

**Rationale**: GitHub Pages provides free, reliable, zero-maintenance hosting.
Keeping the frontend static ensures the site is fast, cacheable, and simple
to deploy via `git push`.

### II. No Public Secrets (NON-NEGOTIABLE)

API keys, OAuth credentials, calendar IDs, email addresses, and any other
sensitive information MUST NEVER appear in the public repository. Secrets
MUST be stored using one of:
- GitHub Secrets (injected at build time via GitHub Actions)
- Environment variables on the free-tier backend service
- Encrypted configuration files that are `.gitignore`d

Every PR MUST be reviewed for accidental secret exposure before merge.
The `.gitignore` file MUST include patterns for `.env`, credentials files,
and any local configuration containing secrets.

**Rationale**: The repository is public. Any committed secret is immediately
compromised and must be rotated.

### III. Manual Verification Required (NON-NEGOTIABLE)

Every feature MUST be directly tested and signed off on manually by the
project owner before it is considered complete. This means:
- Calendar availability checking tested against a real Google Calendar
- Event creation verified on a real calendar
- Email invitations received in a real inbox
- Booking flow completed end-to-end in a real browser
- Cancel/reschedule links tested with real events

No feature is "done" until the owner has personally verified it works
with real services and real data.

**Rationale**: Automated tests catch regressions but cannot verify the
full user experience across external services. Manual sign-off ensures
the product actually works as intended.

### IV. Automated Test Suite Required

The project MUST include an automated test suite that covers:
- Form validation (required fields, email format, input sanitization)
- Calendar availability logic (slot generation, conflict detection)
- Event creation payloads (correct format for Google Calendar API)
- Email content generation (iCal attachments, confirmation text)
- UI state management (navigation, booking flow, error states)
- API integration tests against Google Calendar and Gmail APIs

Tests MUST use real API calls where feasible (not mocks) to verify
external service compatibility. Tests MUST be run before every push
to the repository.

**Rationale**: A test suite provides confidence that changes don't break
existing functionality and documents expected behavior.

### V. Zero Cost (NON-NEGOTIABLE)

No paid services, servers, or utilities are permitted. The entire system
MUST operate at zero monetary cost. Specifically:
- 100% local operation is preferred wherever possible
- Free third-party services are permitted only when no local alternative
  exists (e.g., Google Calendar API for calendar operations, Gmail API
  for sending emails, GitHub Pages for hosting)
- Any free third-party service used MUST have its account setup and API
  key configuration fully documented with step-by-step instructions
- Setup instructions MUST be verified via web search/fetch against the
  service's current documentation — never assumed or hallucinated
- If a free service changes its pricing or terms to require payment,
  the system MUST be updated to use an alternative free solution

**Rationale**: The project must remain accessible to anyone without
financial barriers. Paid dependencies create ongoing costs and lock-in.

## Security Requirements

- All API communication MUST use HTTPS
- OAuth tokens MUST be stored server-side only (never in browser localStorage
  or cookies accessible to JavaScript)
- The backend service MUST validate all incoming requests (origin checking,
  rate limiting, input sanitization)
- CORS MUST be configured to allow only the GitHub Pages domain
- No user-submitted data may be rendered as raw HTML (XSS prevention)
- Cancel/reschedule tokens MUST be cryptographically random and
  single-use or time-limited

## Quality Assurance Workflow

1. **Development**: Implement feature on a branch
2. **Automated Tests**: Run full test suite; all tests MUST pass
3. **Secret Scan**: Verify no secrets in committed files
4. **Deploy Preview**: Deploy to GitHub Pages (staging or production)
5. **Manual Verification**: Project owner tests with real Google Calendar,
   real email, and real browser
6. **Sign-off**: Owner confirms feature works; merge to main

No step may be skipped. If automated tests pass but manual verification
fails, the feature MUST be fixed and re-tested from step 2.

## Governance

This constitution is the authoritative reference for all development
decisions on this project. When in doubt, the constitution takes
precedence over convenience.

- **Amendments**: Any change to this constitution MUST be documented with
  a version bump, rationale, and date. Changes to NON-NEGOTIABLE
  principles require explicit owner approval.
- **Versioning**: MAJOR.MINOR.PATCH semantic versioning. MAJOR for
  principle removals or redefinitions; MINOR for new principles or
  sections; PATCH for clarifications.
- **Compliance**: Every PR review MUST include a constitution compliance
  check. The plan template's "Constitution Check" gate MUST reference
  these principles.

**Version**: 1.1.0 | **Ratified**: 2026-03-10 | **Last Amended**: 2026-03-10
