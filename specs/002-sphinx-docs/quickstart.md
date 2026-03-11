# Quickstart: Sphinx Documentation

## Verify Local Build

```bash
# Install dependencies
pip install -r docs/requirements.txt

# Build documentation
sphinx-build -b html docs docs/_build

# View locally
open docs/_build/index.html
```

## Generate Screenshots

```bash
# Install Playwright
pip install playwright
playwright install chromium

# Generate all screenshots
python scripts/generate-screenshots.py
```

## Verify on ReadTheDocs

1. Push changes to the repository
2. Visit https://cdl-scheduler.readthedocs.io
3. Verify all pages render correctly with ContextLab branding
4. Check all screenshots display properly
5. Test navigation between pages
