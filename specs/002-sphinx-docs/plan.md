# Implementation Plan: Sphinx Documentation for CDL Scheduler

**Branch**: `002-sphinx-docs` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-sphinx-docs/spec.md`

## Summary

Create comprehensive ReadTheDocs documentation for the CDL Scheduler booking system. Uses Sphinx with MyST Markdown, Furo theme customized to match ContextLab branding (Nunito Sans, green rgb(0,112,60)), and Playwright-generated screenshots. Documentation covers setup guide, user guide, configuration reference, and architecture overview.

## Technical Context

**Language/Version**: Python 3.13 (for Sphinx build and Playwright screenshot generation)
**Primary Dependencies**: sphinx, furo (theme), myst-parser (Markdown support), playwright (screenshots)
**Storage**: N/A (static documentation site)
**Testing**: `sphinx-build -b html` (build verification), visual inspection of rendered pages
**Target Platform**: ReadTheDocs (Ubuntu 24.04, as specified in .readthedocs.yaml)
**Project Type**: Documentation site
**Performance Goals**: N/A
**Constraints**: Zero cost (ReadTheDocs free tier), must match ContextLab branding
**Scale/Scope**: 5 documentation pages + screenshot generation script

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-|-|-|
| I. Static Hosting | PASS | Documentation hosted on ReadTheDocs (free), not GitHub Pages. No conflict. |
| II. No Public Secrets | PASS | Documentation contains no secrets. Screenshot script uses only public-facing pages. |
| III. Manual Verification | PASS | Documentation will be manually reviewed on ReadTheDocs after deployment. |
| IV. Automated Test Suite | PASS | Sphinx build serves as automated verification. Screenshot script is runnable. |
| V. Zero Cost | PASS | ReadTheDocs free tier. Sphinx, Furo, myst-parser, Playwright are all free/open-source. |

**Post-design re-check**: All gates still pass. No secrets in documentation content. Screenshots avoid private data.

## Project Structure

### Documentation (this feature)

```text
specs/002-sphinx-docs/
├── plan.md
├── research.md
├── spec.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
docs/
├── conf.py                 # Sphinx configuration with Furo theme + ContextLab branding
├── requirements.txt        # RTD build dependencies (sphinx, furo, myst-parser)
├── index.md                # Landing page: project overview + quick-start summary
├── setup.md                # Full setup guide (prerequisites → verification)
├── user-guide.md           # Booking, rescheduling, cancelling with screenshots
├── configuration.md        # All config options: Script Properties, YAML, GitHub secrets
├── architecture.md         # System architecture overview with diagram
├── _static/
│   ├── custom.css          # ContextLab theme overrides (Nunito Sans, colors, layout)
│   └── screenshots/        # Playwright-generated images (committed to repo)
└── _templates/             # Optional Furo layout overrides (if needed)

scripts/
└── generate-screenshots.py # Playwright script to capture UI screenshots
```

**Structure Decision**: Flat `docs/` directory with one `.md` file per documentation topic. Screenshots stored in `docs/_static/screenshots/` and committed to the repo so ReadTheDocs can include them without running Playwright during build. Screenshot generation is a separate developer-run script in `scripts/`.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## Implementation Phases

### Phase 1: Sphinx Project Setup
- Create `docs/conf.py` with Furo theme, MyST parser, ContextLab branding via CSS variables
- Create `docs/requirements.txt` with pinned dependencies
- Create `docs/_static/custom.css` with Nunito Sans import, color overrides, layout tweaks
- Enable `.readthedocs.yaml` python requirements (uncomment existing section)
- Verify local build with `sphinx-build -b html docs docs/_build`

### Phase 2: Documentation Content
- Write `docs/index.md` — project overview, feature list, quick-start summary, navigation
- Write `docs/setup.md` — prerequisites, Apps Script setup (clasp create, push, deploy, Script Properties), GitHub Pages setup, YAML configuration, GitHub Secrets, verification steps
- Write `docs/user-guide.md` — booking flow, rescheduling, cancelling, each with screenshot placeholders
- Write `docs/configuration.md` — all Script Properties (with defaults/examples), YAML files (annotated), GitHub Action secrets
- Write `docs/architecture.md` — system diagram (text-based), component descriptions, data flow

### Phase 3: Screenshot Generation
- Create `scripts/generate-screenshots.py` using Playwright Python
- Capture screenshots of: meeting type selection, calendar view with slots, booking form, confirmation page, reschedule page, cancel page
- Ensure no personal data visible (use public-facing pages only, crop if needed)
- Save to `docs/_static/screenshots/`
- Integrate screenshots into user-guide.md

### Phase 4: Build Verification & Polish
- Run full Sphinx build, fix any warnings
- Verify ReadTheDocs rendering (push and check cdl-scheduler.readthedocs.io)
- Visual comparison with ContextLab website for branding consistency
- Manual review of all documentation for accuracy and completeness
