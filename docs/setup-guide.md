# Google Apps Script Backend — Setup Guide

This guide walks through setting up the scheduler's Google Apps Script backend as a web app, from project creation through local development with clasp.

**Services used:** CalendarApp, Calendar Advanced Service (v3), MailApp, SpreadsheetApp, PropertiesService, CacheService, LockService, ContentService.

---

## 1. Create the Google Apps Script Project

1. Go to [script.google.com](https://script.google.com/) and sign in with your Google account.
2. Click **New project** (top-left).
3. Click "Untitled project" at the top and rename it (e.g., `scheduler-backend`).
4. The editor opens with a default `Code.gs` file. You can delete the placeholder content — the project code will be pushed via clasp later.

> **Source:** [Apps Script overview](https://developers.google.com/apps-script/)

---

## 2. Enable the V8 Runtime

The project uses the V8 runtime (set in `appsscript.json` via `"runtimeVersion": "V8"`). If pushing code with clasp, the manifest handles this automatically. To verify manually:

1. In the Apps Script editor, click the gear icon (**Project Settings**) in the left sidebar.
2. Under **General settings**, confirm **Chrome V8** runtime is selected.

> **Source:** [V8 Runtime Overview](https://developers.google.com/apps-script/guides/v8-runtime)

---

## 3. Enable the Calendar Advanced Service

The Calendar Advanced Service provides access to the full Google Calendar API (beyond the built-in CalendarApp). This project requires it — see `appsscript.json`:

```json
"enabledAdvancedServices": [
  { "userSymbol": "Calendar", "version": "v3", "serviceId": "calendar" }
]
```

### In the Apps Script editor:

1. In the left sidebar, click the **+** next to **Services**.
2. Scroll to **Google Calendar API** (or search for "Calendar").
3. Select it and click **Add**.

### In Google Cloud Console (if using a standard Cloud project):

If your script is associated with a standard Google Cloud project (not the default one), you must also enable the API there:

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select the Cloud project linked to your script.
3. Go to **APIs & Services > Library**.
4. Search for **Google Calendar API** and click **Enable**.

> **Note:** If you are using the default Cloud project that Apps Script creates automatically, you only need the editor step above — the API is enabled automatically.

> **Source:** [Advanced Google services](https://developers.google.com/apps-script/guides/services/advanced), [Advanced Calendar Service](https://developers.google.com/apps-script/advanced/calendar)

---

## 4. Set Script Properties

The backend reads configuration from `PropertiesService.getScriptProperties()`. The `Config.gs` module wraps this with defaults, but you must set your actual values.

### Required properties:

| Property | Description | Example |
|-|-|-|
| `CALENDAR_ID` | Google Calendar ID to manage | `your-email@gmail.com` or `primary` |
| `OWNER_EMAIL` | Your email (for notification emails) | `you@example.com` |
| `OWNER_NAME` | Your display name (used in emails) | `Jeremy Manning` |
| `SPREADSHEET_ID` | ID of the Google Sheet for booking storage | `1aBcDeFgHiJkLmNoPqRsTuVwXyZ` |
| `GITHUB_PAGES_URL` | Base URL of the frontend (no trailing slash) | `https://username.github.io/scheduler` |
| `AVAILABILITY_PATTERN` | Calendar event title prefix that marks available slots | `Jeremy office hours` |

### Optional properties (have sensible defaults):

| Property | Default | Description |
|-|-|-|
| `MIN_NOTICE_HOURS` | `12` | Minimum hours in advance a booking can be made |
| `MAX_ADVANCE_DAYS` | `90` | How far ahead users can book |
| `TOKEN_EXPIRY_DAYS` | `90` | Days before a booking management token expires |

### How to set them:

**Option A — Via the Apps Script editor:**

1. Click the gear icon (**Project Settings**) in the left sidebar.
2. Scroll down to **Script Properties**.
3. Click **Edit script properties**.
4. Click **Add script property** for each key-value pair listed above.
5. Click **Save script properties**.

**Option B — Programmatically (run once in the editor):**

Create a temporary function and run it from the editor (Run > `setInitialProperties`):

```javascript
function setInitialProperties() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    CALENDAR_ID: 'your-email@gmail.com',
    OWNER_EMAIL: 'your-email@gmail.com',
    OWNER_NAME: 'Your Name',
    SPREADSHEET_ID: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
    GITHUB_PAGES_URL: 'https://username.github.io/scheduler',
    AVAILABILITY_PATTERN: 'Jeremy office hours',
  });
  Logger.log('Properties set: ' + JSON.stringify(props.getProperties()));
}
```

Delete this function after running it (it should not be part of the deployed code).

> **Source:** [Properties Service](https://developers.google.com/apps-script/guides/properties)

---

## 5. Create the Booking Spreadsheet

1. Create a new Google Sheet at [sheets.google.com](https://sheets.google.com/).
2. Name it (e.g., `Scheduler Bookings`).
3. Copy the Spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
4. Use this ID as the `SPREADSHEET_ID` script property.
5. The backend (`BookingStore`) will create headers and populate rows automatically on first use.

---

## 6. Deploy as a Web App

The backend uses `doGet()` and `doPost()` handlers in `Code.gs` to serve JSON responses via `ContentService`.

1. In the Apps Script editor, click **Deploy** (top-right) > **New deployment**.
2. Click the gear icon next to **Select type** and choose **Web app**.
3. Fill in the deployment configuration:
   - **Description:** e.g., `v1.0.0 — initial deployment`
   - **Execute as:** **Me** (your account) — the app accesses your calendar and spreadsheet.
   - **Who has access:** **Anyone** — the frontend must call it without Google sign-in.
4. Click **Deploy**.
5. **Copy the web app URL** — this is the endpoint your frontend will call. It looks like:
   `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`
6. You may need to **authorize** the script on first deploy. Review and accept the permissions for Calendar, Gmail, and Sheets.

### Updating a deployment:

After code changes, you must create a new deployment or update the existing one:

1. Click **Deploy** > **Manage deployments**.
2. Click the pencil icon on the active deployment.
3. Set **Version** to **New version**.
4. Click **Deploy**.

### Test deployment:

For development, use **Deploy** > **Test deployments** to get a URL that always runs the latest saved code (without creating a versioned deployment).

> **Note:** The `appsscript.json` manifest already includes the correct webapp settings:
> ```json
> "webapp": {
>   "executeAs": "USER_DEPLOYING",
>   "access": "ANYONE_ANONYMOUS"
> }
> ```

> **Source:** [Web Apps](https://developers.google.com/apps-script/guides/web), [Create and manage deployments](https://developers.google.com/apps-script/concepts/deployments)

---

## 7. Install clasp CLI for Local Development

[clasp](https://github.com/google/clasp) (Command Line Apps Script Projects) lets you develop locally and push code to the Apps Script project.

### Install:

```bash
npm install -g @google/clasp
```

Requires Node.js v4.7.4 or later (v18+ recommended).

### Log in:

```bash
clasp login
```

This opens a browser window for Google OAuth. After authorizing, credentials are saved to `~/.clasprc.json`.

### Enable the Apps Script API:

Before using clasp, you must enable the Apps Script API:

1. Go to [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. Set **Google Apps Script API** to **On**.

> **Source:** [clasp CLI guide](https://developers.google.com/apps-script/guides/clasp), [clasp GitHub repo](https://github.com/google/clasp)

---

## 8. Use clasp to Push Code from `backend/`

The `backend/` directory already contains a `.clasp.json` file:

```json
{
  "scriptId": "PLACEHOLDER_SCRIPT_ID",
  "rootDir": "."
}
```

### First-time setup:

1. Get your script ID from the Apps Script editor: **Project Settings** (gear icon) > **IDs** section > copy the **Script ID**.
2. Edit `backend/.clasp.json` and replace `PLACEHOLDER_SCRIPT_ID` with your actual script ID.

### Push code:

```bash
cd backend/
clasp push
```

This uploads all `.gs` files and `appsscript.json` to your Apps Script project. It **replaces** all server-side code with the local files.

### Pull code (to sync remote changes locally):

```bash
cd backend/
clasp pull
```

### Other useful commands:

```bash
clasp open          # Open the script in the browser
clasp status        # Show files that will be pushed
clasp versions      # List deployment versions
clasp deploy        # Create a new versioned deployment
clasp logs          # View Stackdriver logs
```

### File structure pushed to Apps Script:

| Local file | Purpose |
|-|-|
| `appsscript.json` | Project manifest (runtime, services, webapp config) |
| `Code.gs` | doGet/doPost handlers and request routing |
| `Config.gs` | PropertiesService wrapper |
| `Calendar.gs` | Availability slot logic |
| `Booking.gs` | SpreadsheetApp-backed booking storage |
| `Email.gs` | MailApp email notifications |
| `Token.gs` | Booking token generation and validation |

> **Source:** [clasp CLI guide](https://developers.google.com/apps-script/guides/clasp)

---

## Quick-Start Checklist

- [ ] Created Apps Script project at script.google.com
- [ ] Enabled Calendar Advanced Service in the editor (Services > +)
- [ ] Created a Google Sheet for booking data
- [ ] Set all required Script Properties (Project Settings > Script Properties)
- [ ] Deployed as web app (Execute as: Me, Who has access: Anyone)
- [ ] Copied the web app URL for frontend configuration
- [ ] Installed clasp (`npm install -g @google/clasp`)
- [ ] Enabled the Apps Script API in user settings
- [ ] Logged in with `clasp login`
- [ ] Set the real script ID in `backend/.clasp.json`
- [ ] Pushed code with `clasp push` from the `backend/` directory

---

## Troubleshooting

**"Authorization required" on first run:**
After deploying, the first request may trigger an authorization prompt. Open the web app URL in a browser, click "Review Permissions," and grant access.

**"Access denied" or "Script function not found" errors:**
Ensure `doGet` and `doPost` are defined as top-level functions in `Code.gs` (not inside a module or IIFE).

**Calendar events not appearing:**
Verify `CALENDAR_ID` matches your actual calendar ID. For your primary calendar, this is usually your Gmail address. Check at [Google Calendar settings](https://calendar.google.com/calendar/r/settings) under the specific calendar's "Integrate calendar" section.

**clasp push fails with "Script API not enabled":**
Visit [script.google.com/home/usersettings](https://script.google.com/home/usersettings) and toggle the API on.

**clasp push fails with "Manifest file has been updated":**
This means `appsscript.json` on the server differs from local. Run `clasp pull` first to review, then resolve conflicts and push again.

---

## Verified Sources

- [Web Apps (deploy as web app)](https://developers.google.com/apps-script/guides/web)
- [Create and manage deployments](https://developers.google.com/apps-script/concepts/deployments)
- [Advanced Google services](https://developers.google.com/apps-script/guides/services/advanced)
- [Advanced Calendar Service](https://developers.google.com/apps-script/advanced/calendar)
- [Properties Service](https://developers.google.com/apps-script/guides/properties)
- [clasp CLI guide](https://developers.google.com/apps-script/guides/clasp)
- [clasp GitHub repository](https://github.com/google/clasp)
