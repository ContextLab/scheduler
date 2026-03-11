#!/usr/bin/env python3
"""
Generate screenshots of the CDL Scheduler booking interface for documentation.

Usage:
    pip install playwright
    playwright install chromium
    python scripts/generate-screenshots.py [--url URL]

Screenshots are saved to docs/_static/screenshots/.
Uses demo data to avoid exposing personal information.
"""

import argparse
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Error: playwright is not installed.")
    print("Install it with: pip install playwright && playwright install chromium")
    sys.exit(1)

SCREENSHOT_DIR = Path(__file__).parent.parent / "docs" / "_static" / "screenshots"

# Demo data for filling forms (no real personal information)
DEMO_DATA = {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "purpose": "Discuss project proposal",
    "notes": "Looking forward to meeting!",
}


def ensure_output_dir():
    """Create the screenshots directory if it doesn't exist."""
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def wait_for_load(page, timeout=10000):
    """Wait for the page to finish loading dynamic content."""
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        pass  # networkidle can timeout on long-polling pages


def screenshot(page, filename):
    """Take a screenshot and report it."""
    path = str(SCREENSHOT_DIR / filename)
    page.screenshot(path=path, full_page=False)
    print(f"    -> {filename}")


def capture_meeting_types(page, base_url):
    """Capture the meeting type selection page (Step 1)."""
    print("  Capturing meeting type selection...")
    page.goto(base_url)
    wait_for_load(page)

    # Wait for meeting types to render
    page.wait_for_selector(".meeting-type-card", timeout=15000)
    time.sleep(1)

    screenshot(page, "01-meeting-types.png")


def navigate_to_slots(page):
    """Navigate the calendar forward week by week until slots appear (max 8 weeks)."""
    for i in range(8):
        time.sleep(5)  # Wait for backend fetch
        count = page.evaluate('document.querySelectorAll(".fc-event").length')
        if count > 0:
            print(f"    Found {count} slots (navigated {i} weeks forward)")
            return True
        page.click(".fc-next-button")
    print("    Warning: No slots found after navigating 8 weeks")
    return False


def capture_calendar_view(page, base_url):
    """Capture the calendar view with available slots (Step 2)."""
    print("  Capturing calendar view...")
    page.goto(base_url)
    wait_for_load(page)

    # Warm up backend first
    page.wait_for_selector(".meeting-type-card", timeout=15000)
    page.click(".meeting-type-card")

    # Wait for calendar to render
    page.wait_for_selector(".fc-timegrid", timeout=15000)

    # Navigate forward until we find slots
    navigate_to_slots(page)
    time.sleep(2)

    screenshot(page, "02-calendar-view.png")


def capture_booking_form(page, base_url):
    """Capture the booking form pre-filled with demo data (Step 3)."""
    print("  Capturing booking form...")
    page.goto(base_url)
    wait_for_load(page)

    # Step 1: Click meeting type
    page.wait_for_selector(".meeting-type-card", timeout=15000)
    page.click(".meeting-type-card")

    # Step 2: Wait for calendar and navigate to slots
    page.wait_for_selector(".fc-timegrid", timeout=15000)
    if not navigate_to_slots(page):
        print("    Cannot capture booking form without slots")
        return

    time.sleep(1)
    page.click(".fc-event")

    # Step 3: Wait for form to become visible
    page.wait_for_selector("#first-name:visible", timeout=10000)
    time.sleep(0.5)

    # Fill form with demo data
    page.fill("#first-name", DEMO_DATA["first_name"])
    page.fill("#last-name", DEMO_DATA["last_name"])
    page.fill("#email", DEMO_DATA["email"])
    page.fill("#purpose", DEMO_DATA["purpose"])
    page.fill("#notes", DEMO_DATA["notes"])

    time.sleep(0.5)

    screenshot(page, "03-booking-form.png")


def capture_confirmation(page, base_url):
    """Capture the confirmation step (Step 4) with mock content.

    Uses DOM manipulation with hardcoded demo data to show what the
    confirmation page looks like without creating a real booking.
    Note: This uses textContent and createElement for safe DOM updates.
    """
    print("  Capturing confirmation page...")
    page.goto(base_url)
    wait_for_load(page)

    # Show step 4 with mock confirmation data using safe DOM methods
    page.evaluate("""() => {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(el => {
            el.style.display = 'none';
            el.classList.remove('active');
        });

        // Show step 4 (confirmation)
        const step4 = document.getElementById('step-4');
        if (step4) {
            step4.style.display = 'block';
            step4.classList.add('active');

            // Update step indicators
            document.querySelectorAll('.step').forEach((el, i) => {
                el.classList.toggle('active', i === 3);
                if (i < 3) el.classList.add('completed');
            });
        }

        // Build confirmation content using safe DOM methods
        const details = document.getElementById('confirmation-details');
        if (details) {
            // Clear existing content
            while (details.firstChild) details.removeChild(details.firstChild);

            const card = document.createElement('div');
            card.className = 'confirmation-card';

            const heading = document.createElement('h3');
            heading.textContent = 'Booking Confirmed!';
            card.appendChild(heading);

            const fields = [
                ['Meeting', 'Office hours'],
                ['Date', 'Thursday, March 20, 2026'],
                ['Time', '10:00 AM - 10:15 AM (Eastern Time)'],
                ['Location', 'Virtual (Zoom)'],
                ['Name', 'Jane Doe'],
                ['Email', 'jane@example.com'],
            ];

            fields.forEach(([label, value]) => {
                const row = document.createElement('div');
                row.className = 'detail-row';
                const strong = document.createElement('strong');
                strong.textContent = label + ': ';
                row.appendChild(strong);
                row.appendChild(document.createTextNode(value));
                card.appendChild(row);
            });

            details.appendChild(card);

            const note = document.createElement('p');
            note.textContent = 'A confirmation email has been sent with calendar details.';
            details.appendChild(note);
        }
    }""")
    time.sleep(1)

    screenshot(page, "04-confirmation.png")


def capture_reschedule(page, base_url):
    """Capture the reschedule page."""
    print("  Capturing reschedule page...")
    page.goto(f"{base_url}/reschedule.html")
    wait_for_load(page)
    time.sleep(2)

    screenshot(page, "05-reschedule.png")


def capture_cancel(page, base_url):
    """Capture the cancel page."""
    print("  Capturing cancel page...")
    page.goto(f"{base_url}/cancel.html")
    wait_for_load(page)
    time.sleep(2)

    screenshot(page, "06-cancel.png")


def verify_privacy(screenshot_dir):
    """Basic check that no real email addresses or calendar IDs appear in filenames."""
    print("\nPrivacy verification:")
    issues = []
    for f in screenshot_dir.glob("*.png"):
        name = f.name.lower()
        if "@" in name and "example" not in name:
            issues.append(f"Potential PII in filename: {f.name}")

    if issues:
        for issue in issues:
            print(f"  WARNING: {issue}")
        return False
    else:
        print("  All filenames pass privacy check.")
        return True


def main():
    parser = argparse.ArgumentParser(description="Generate documentation screenshots")
    parser.add_argument(
        "--url",
        default="https://contextlab.github.io/scheduler",
        help="Base URL of the scheduler (default: https://contextlab.github.io/scheduler)",
    )
    parser.add_argument(
        "--width", type=int, default=1280, help="Viewport width (default: 1280)"
    )
    parser.add_argument(
        "--height", type=int, default=800, help="Viewport height (default: 800)"
    )
    args = parser.parse_args()

    ensure_output_dir()

    print(f"Generating screenshots from {args.url}")
    print(f"Viewport: {args.width}x{args.height}")
    print(f"Output: {SCREENSHOT_DIR}\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": args.width, "height": args.height},
            device_scale_factor=2,  # Retina-quality screenshots
        )
        page = context.new_page()

        try:
            capture_meeting_types(page, args.url)
            capture_calendar_view(page, args.url)
            capture_booking_form(page, args.url)
            capture_confirmation(page, args.url)
            capture_reschedule(page, args.url)
            capture_cancel(page, args.url)
        except Exception as e:
            print(f"\nError during screenshot capture: {e}")
            print("Some screenshots may not have been generated.")
        finally:
            browser.close()

    verify_privacy(SCREENSHOT_DIR)

    print("\nDone! Screenshots saved to docs/_static/screenshots/")
    print("Review screenshots manually before committing to verify no PII is visible.")


if __name__ == "__main__":
    main()
