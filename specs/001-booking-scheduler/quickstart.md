# Quickstart: Booking Scheduler

## Prerequisites

- A Google account (for Calendar, Sheets, and Apps Script)
- A GitHub account with a repository for this project
- Node.js installed locally (for running frontend tests)
- Google `clasp` CLI installed (`npm install -g @google/clasp`)

## Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/{YOUR_USERNAME}/scheduler.git
cd scheduler
```

### 2. Set Up Google Apps Script Backend

1. Go to [script.google.com](https://script.google.com) and create a new project
2. In the Apps Script editor, go to **Project Settings** and copy the **Script ID**
3. Locally, log in to clasp:
   ```bash
   clasp login
   ```
4. Link the local `backend/` directory to your Apps Script project:
   ```bash
   cd backend
   clasp clone {YOUR_SCRIPT_ID}
   ```
5. Push backend code to Apps Script:
   ```bash
   clasp push
   ```

### 3. Configure Apps Script Properties

In the Apps Script editor, go to **Project Settings** → **Script Properties** and add:

| Property | Value |
|-|-|
| `CALENDAR_ID` | Your Google Calendar ID (e.g., `primary` or `your.email@gmail.com`) |
| `OWNER_EMAIL` | Your email address (for confirmation emails) |
| `OWNER_NAME` | Your display name |
| `SPREADSHEET_ID` | The ID of the Google Sheet for booking storage (create a blank sheet first) |
| `GITHUB_PAGES_URL` | Your GitHub Pages URL (e.g., `https://username.github.io/scheduler`) |

### 4. Enable Advanced Calendar Service

In the Apps Script editor:
1. Click **Services** (+ icon) in the left sidebar
2. Search for **Google Calendar API**
3. Click **Add**

### 5. Deploy Apps Script as Web App

1. In the Apps Script editor, click **Deploy** → **New deployment**
2. Select **Web app** as the type
3. Set **Execute as**: "Me"
4. Set **Who has access**: "Anyone"
5. Click **Deploy** and copy the web app URL

### 6. Configure Frontend

Edit `frontend/config/settings.yaml`:

```yaml
apps_script_url: "https://script.google.com/macros/s/{YOUR_DEPLOYMENT_ID}/exec"
availability_pattern: "Jeremy office hours"
min_notice_hours: 12
max_advance_days: 90
default_timezone: "America/New_York"
theme_color: "#CCE2D8"
```

Edit `frontend/config/meeting-types.yaml` and `frontend/config/locations.yaml` as needed.

### 7. Create Availability Events

On your Google Calendar, create events titled "Jeremy office hours" (or your configured pattern) during times you're available. Mark them as **Free** (not Busy). These can be recurring events.

### 8. Enable GitHub Pages

1. Go to your repo **Settings** → **Pages**
2. Set **Source** to the branch and `/frontend` directory (or root if using a build step)
3. Save and wait for deployment

### 9. Add `.nojekyll` File

```bash
touch .nojekyll
git add .nojekyll
git commit -m "Disable Jekyll processing for GitHub Pages"
git push
```

### 10. Test the Booking Flow

1. Visit your GitHub Pages URL
2. Select a meeting type
3. Choose an available time slot
4. Fill out the booking form
5. Confirm the booking
6. Verify:
   - Event appears on your Google Calendar
   - Visitor email receives iCal invite
   - You receive a confirmation email
   - Cancel and reschedule links work

## Running Tests

### Frontend Tests

```bash
cd tests/frontend
npm install
npm test
```

### Backend Tests

```bash
cd backend
clasp push  # ensure latest code is deployed
# Run test functions from Apps Script editor or via clasp run
clasp run testCalendar
clasp run testEmail
clasp run testBooking
```

## Troubleshooting

- **CORS errors**: Ensure frontend uses `Content-Type: text/plain;charset=utf-8` and `redirect: 'follow'`
- **Calendar not showing slots**: Verify availability events exist, are marked "Free," and title matches `availability_pattern`
- **Emails not sending**: Check Apps Script email quota (50/day for free accounts) at [script.google.com](https://script.google.com) → **Executions**
- **Apps Script errors**: Check **Executions** log in the Apps Script editor for error details
