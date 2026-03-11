# Google Account Setup for Booking Scheduler

This guide covers setting up the Google services needed by the scheduler app. Everything runs on Google Apps Script, so no billing, OAuth consent screen, or API keys are required.

## 1. Google Account Requirements

Any Google account (personal Gmail or Google Workspace) works. You do **not** need to create a Google Cloud project or enable billing. Apps Script automatically creates a default Cloud project behind the scenes, which is sufficient for this app.

> **Verified:** Per [Google's documentation](https://developers.google.com/apps-script/guides/cloud-platform-projects), every Apps Script project has an associated default Cloud project. A standard Cloud project is only needed for publishing add-ons, verifying OAuth clients, or using the Apps Script API's `scripts.run` method.

## 2. Create a Google Calendar for Availability

1. Open [Google Calendar](https://calendar.google.com) in a browser (new calendars cannot be created from the mobile app).
2. In the left sidebar, click **+** next to "Other calendars."
3. Select **Create new calendar**.
4. Enter a name (e.g., "Office Hours") and optional description.
5. Click **Create calendar**.

Once created, add events to mark your available times:

1. Click on a time slot in the calendar.
2. Set the title to **"Jeremy office hours"** (the app matches this pattern to find availability).
3. Set the correct start and end times.
4. If recurring, click **More options** and set a recurrence rule.
5. Click **Save**.

> **Verified:** Steps match [Google Calendar Help - Create a new calendar](https://support.google.com/calendar/answer/37095?hl=en).

## 3. Create a Google Spreadsheet for the Booking Database

1. Go to [Google Sheets](https://sheets.google.com).
2. Click **Blank spreadsheet** (the "+" button).
3. Rename it (e.g., "Booking Database").
4. Copy the **Spreadsheet ID** from the URL. The URL format is:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
   ```
   The `SPREADSHEET_ID` is the long string of letters, numbers, hyphens, and underscores between `/d/` and `/edit`.

Leave the spreadsheet blank -- the Apps Script code will create headers and populate it.

> **Verified:** URL structure confirmed by [Google Sheets documentation](https://developers.google.com/workspace/sheets/api/samples/sheet) and [multiple guides](https://knowsheets.com/how-to-get-the-id-of-a-google-sheet/).

## 4. Get the Calendar ID

1. Open [Google Calendar](https://calendar.google.com) in a browser.
2. In the left sidebar under "My calendars" or "Other calendars," hover over the calendar you created.
3. Click the **three-dot menu** (More) that appears.
4. Select **Settings and sharing**.
5. Scroll down to the **Integrate calendar** section.
6. Copy the **Calendar ID**. It will look like: `abc123xyz@group.calendar.google.com`

> **Note:** Your primary calendar's ID is just your Gmail address. Calendars you create will have an ID ending in `@group.calendar.google.com`.

> **Verified:** Steps match [University of Minnesota IT guide](https://it.umn.edu/services-technologies/how-tos/google-calendar-find-your-google) and [Simple Calendar documentation](https://docs.simplecalendar.io/find-google-calendar-id/).

## 5. Enable the Google Calendar API in Apps Script

The built-in `CalendarApp` service is always available. However, if the script uses the **advanced** Calendar API (the `Calendar` service), you must enable it:

1. Open your Apps Script project at [script.google.com](https://script.google.com).
2. In the left sidebar of the editor, find **Services** (below "Files").
3. Click the **+** icon next to "Services."
4. In the dialog, scroll to or search for **Google Calendar API**.
5. Select it and click **Add**.

The service will now appear under "Services" in the sidebar, and you can use `Calendar` (the advanced service) in your code.

> **Important distinction:** `CalendarApp` (built-in) is always available with no setup. The advanced `Calendar` service provides additional features (e.g., setting event colors, working with ACLs) and requires this explicit enable step.

> **Verified:** Steps match [Google's Advanced Calendar Service docs](https://developers.google.com/apps-script/advanced/calendar) and [Advanced Google Services guide](https://developers.google.com/apps-script/guides/services/advanced).

---

## Summary of Values Needed by the App

| Value | Where to Find | Example |
|-|-|-|
| Calendar ID | Calendar Settings > Integrate calendar | `abc123@group.calendar.google.com` |
| Spreadsheet ID | URL of the Google Sheet | `1QPvcIcmNU1QbZYRF__rrjIC4C1F0Ir3KI-YtIRCCWws` |
| Event title pattern | Your calendar events | `Jeremy office hours` |
