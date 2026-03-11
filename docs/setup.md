# setup guide

Follow this guide to deploy your own instance of CDL Scheduler.

## prerequisites

You will need:

- A **Google account** with access to Google Calendar, Gmail, and Google Sheets
- A **GitHub account** with GitHub Pages enabled
- **Node.js** (v16+) with npm installed
- **git** installed locally
- **clasp** (Command Line Apps Script Projects) — install with:

  ```bash
  npm install -g @google/clasp
  ```

- Enable the **Google Apps Script API** at [script.google.com/home/usersettings](https://script.google.com/home/usersettings)

## step 1: clone the repository

Fork the [CDL Scheduler repository](https://github.com/ContextLab/scheduler) on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/scheduler.git
cd scheduler
```

## step 2: set up the backend (Google Apps Script)

### log in to clasp

```bash
clasp login
```

This opens a browser window to authorize clasp with your Google account.

### create a new Apps Script project

```bash
cd backend
clasp create --type webapp --title "CDL Scheduler Backend"
```

This creates a new Apps Script project and generates a `.clasp.json` file in the `backend/` directory.

### push the backend code

```bash
clasp push --force
```

This uploads all `.gs` files and `appsscript.json` to your Apps Script project.

### enable the Calendar Advanced Service

1. Open the Apps Script editor:

   ```bash
   clasp open
   ```

2. In the editor, click **Services** (the `+` icon in the left sidebar)
3. Find **Google Calendar API** and click **Add**
4. Keep the default identifier `Calendar` and click **Add**

### set Script Properties

In the Apps Script editor:

1. Click the **gear icon** (Project Settings) in the left sidebar
2. Scroll down to **Script Properties**
3. Click **Edit script properties** and add the following:

| Property | Description | Example |
|-|-|-|
| `CALENDAR_ID` | Google Calendar ID to check for availability | `your.email@gmail.com` |
| `OWNER_EMAIL` | Your email address (receives booking notifications) | `your.email@gmail.com` |
| `OWNER_NAME` | Your display name in emails | `Jane Doe` |
| `SPREADSHEET_ID` | ID of a Google Sheet for storing bookings (create a blank sheet and copy the ID from the URL) | `1AbCdEfGhIjKlMnOpQrStUvWxYz` |
| `GITHUB_PAGES_URL` | Your GitHub Pages URL | `https://yourusername.github.io/scheduler` |
| `AVAILABILITY_PATTERN` | Title of calendar events that define your availability | `Office hours` |
| `CONFLICT_CALENDAR_IDS` | JSON array of calendar IDs to check for conflicts | `["your.email@gmail.com"]` |
| `MIN_NOTICE_HOURS` | Minimum hours before a slot can be booked | `12` |
| `MAX_ADVANCE_DAYS` | Maximum days in advance a slot can be booked | `90` |
| `TOKEN_EXPIRY_DAYS` | Days before booking tokens expire | `90` |
| `CLEANUP_KEY` | Secret key for the cleanup endpoint (generate a random string) | `my-secret-cleanup-key-123` |

```{tip}
To generate a secure `CLEANUP_KEY`, run:
`python3 -c "import secrets; print(secrets.token_hex(32))"`
```

### deploy the web app

1. In the Apps Script editor, click **Deploy** > **New deployment**
2. Click the **gear icon** next to "Select type" and choose **Web app**
3. Set:
   - **Description**: `v1` (or any version label)
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. **Copy the Web app URL** — you will need this for the frontend configuration

```{important}
After every `clasp push --force`, you must create a **new versioned deployment** for changes to take effect:
1. Click **Deploy** > **Manage deployments**
2. Click the **pencil icon** on your deployment
3. Under **Version**, select **New version**
4. Click **Deploy**
```

## step 3: set up the frontend (GitHub Pages)

### update frontend configuration

Edit `config/settings.yaml` with your Apps Script URL and preferences:

```yaml
availability_pattern: "Office hours"
min_notice_hours: 12
max_advance_days: 90
default_timezone: "America/New_York"
theme_color: "#CCE2D8"
apps_script_url: "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"
```

Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL you copied during deployment.

### customize meeting types

Edit `config/meeting-types.yaml` to define your meeting types:

```yaml
meeting_types:
  - id: office-hours
    name: "Office hours"
    duration: 15
    description: "Meet with me about a course."

  - id: project-meeting
    name: "Project meeting"
    duration: 30
    description: "Discuss a project update."
    instructions: "Please share an agenda before our meeting."
```

Each meeting type has:
- `id` — unique identifier (used internally)
- `name` — display name shown to visitors
- `duration` — meeting length in minutes (15, 30, 45, or 60)
- `description` — shown on the meeting type selection page
- `instructions` — (optional) additional instructions shown to visitors

### customize locations

Edit `config/locations.yaml` to define available meeting locations:

```yaml
locations:
  - id: virtual
    label: "Virtual (Zoom)"
    value: "https://zoom.us/my/yourroom"

  - id: in-person
    label: "In-person"
    value: "Room 123, Building Name"
```

### enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose **main** branch and **/ (root)** directory
5. Click **Save**

Your scheduler will be available at `https://yourusername.github.io/scheduler` after a few minutes.

## step 4: set up GitHub Actions

The cleanup workflow automatically removes expired bookings. It requires two repository secrets.

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add:

| Secret | Value |
|-|-|
| `APPS_SCRIPT_URL` | Your Apps Script web app URL (same URL from the deployment step) |
| `CLEANUP_KEY` | The same `CLEANUP_KEY` value you set in Script Properties |

The cleanup runs automatically every Sunday at midnight UTC. You can also trigger it manually from the **Actions** tab.

## step 5: create availability

CDL Scheduler finds your available time slots by looking for calendar events that match your `AVAILABILITY_PATTERN`.

1. Open [Google Calendar](https://calendar.google.com)
2. Create a new event with the title matching your pattern (e.g., "Office hours")
3. Set it as a **recurring event** on the days and times you want to be available
4. Make sure the event is on the calendar matching your `CALENDAR_ID`

```{tip}
The availability pattern is a case-sensitive substring match. If your pattern is "Office hours", events titled "Office hours" or "Office hours (Spring 2026)" will both match.
```

## step 6: verify your setup

1. Visit your scheduler site at `https://yourusername.github.io/scheduler`
2. Confirm that your meeting types are displayed
3. Select a meeting type and verify that available slots appear on the calendar
4. Make a **test booking**:
   - Pick an available slot
   - Fill in the form with test details
   - Submit the booking
5. Verify that:
   - A calendar event was created on your Google Calendar
   - You received a confirmation email
   - The test visitor email received a confirmation
   - The reschedule and cancel links in the email work correctly

```{tip}
If no availability slots appear, check:
1. Your `AVAILABILITY_PATTERN` matches the exact title of your calendar events
2. The calendar events are on the calendar matching `CALENDAR_ID`
3. The slots are within the `MIN_NOTICE_HOURS` and `MAX_ADVANCE_DAYS` window
4. The `CONFLICT_CALENDAR_IDS` doesn't include calendars with events blocking your availability windows
```
