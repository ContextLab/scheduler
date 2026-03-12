# scheduler Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-10

## Active Technologies
- Python 3.13 (for Sphinx build and Playwright screenshot generation) + sphinx, furo (theme), myst-parser (Markdown support), playwright (screenshots) (002-sphinx-docs)
- N/A (static documentation site) (002-sphinx-docs)

- JavaScript (ES2020+) for frontend; Google Apps Script (V8 runtime) for backend + js-yaml (YAML parsing), FullCalendar or similar (calendar UI), Google Apps Script built-in services (CalendarApp, GmailApp, SpreadsheetApp, PropertiesService) (001-booking-scheduler)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

JavaScript (ES2020+) for frontend; Google Apps Script (V8 runtime) for backend: Follow standard conventions

## Recent Changes
- 002-sphinx-docs: Added Python 3.13 (for Sphinx build and Playwright screenshot generation) + sphinx, furo (theme), myst-parser (Markdown support), playwright (screenshots)

- 001-booking-scheduler: Added JavaScript (ES2020+) for frontend; Google Apps Script (V8 runtime) for backend + js-yaml (YAML parsing), FullCalendar or similar (calendar UI), Google Apps Script built-in services (CalendarApp, GmailApp, SpreadsheetApp, PropertiesService)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
