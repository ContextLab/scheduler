# Research: Sphinx Documentation for CDL Scheduler

## Decision 1: Sphinx Theme

**Decision**: Use the **Furo** theme with CSS variable overrides for ContextLab branding.

**Rationale**: Furo provides the easiest color/font customization via `light_css_variables` in `conf.py`. Setting `"color-brand-primary": "#007030"` applies the green throughout. Custom CSS adds Nunito Sans font. Furo's clean, modern, minimal aesthetic aligns naturally with the ContextLab academic style.

**Alternatives considered**:
- **pydata-sphinx-theme**: Strong branding features but heavier, data-science-oriented feel
- **sphinx-book-theme**: More limited CSS variable exposure, requires deeper custom CSS
- **sphinx-rtd-theme**: Basic customization only, hard to achieve branded look

## Decision 2: Markup Format

**Decision**: Use **MyST Markdown** (`.md` files) via `myst-parser`.

**Rationale**: MyST enables Markdown authoring with full Sphinx directive support. Easier for contributors than RST. Already implied by `.readthedocs.yaml` configuration. Install via `pip install myst-parser`, add `"myst_parser"` to extensions.

**Alternatives considered**:
- **reStructuredText**: More powerful but steeper learning curve, less familiar to most contributors

## Decision 3: Screenshot Generation

**Decision**: Use **Playwright** (Python) to capture screenshots from the live site, with privacy-safe page states.

**Rationale**: Playwright can navigate the public-facing scheduler pages (meeting type selection, calendar view, booking form, confirmation) without exposing private calendar data. Screenshots capture only the booking UI, not the admin/calendar backend. Use `page.screenshot()` with specific viewport sizes for consistent output.

**Alternatives considered**:
- **Selenium**: Heavier setup, slower; Playwright is more modern and reliable
- **Manual screenshots**: Would become stale; automated generation keeps docs current

## Decision 4: Documentation Structure

**Decision**: Use a flat `docs/` directory with separate `.md` files per topic.

**Rationale**: Simple structure matches the 5-page documentation scope. No need for nested directories. ReadTheDocs builds from `docs/conf.py` as configured in `.readthedocs.yaml`.

```
docs/
├── conf.py
├── requirements.txt
├── index.md              # Landing page with quick-start
├── setup.md              # Full setup guide
├── user-guide.md         # Booking/reschedule/cancel with screenshots
├── configuration.md      # All config options reference
├── architecture.md       # System architecture overview
├── _static/
│   ├── custom.css        # ContextLab theme overrides
│   └── screenshots/      # Playwright-generated images
└── _templates/           # Optional layout overrides
```
