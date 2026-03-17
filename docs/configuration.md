# configuration reference

This page documents all configuration options for CDL Scheduler.

## Script Properties

Script Properties are set in the Google Apps Script editor under **Project Settings** > **Script Properties**. They control the backend behavior.

| Property | Description | Default | Example |
|-|-|-|-|
| `CALENDAR_ID` | Google Calendar ID used for availability detection and booking creation | `primary` | `jane@gmail.com` |
| `OWNER_EMAIL` | Email address that receives booking notifications | *(none)* | `jane@gmail.com` |
| `OWNER_NAME` | Display name used in notification emails | *(none)* | `Jane Doe` |
| `SPREADSHEET_ID` | ID of the Google Sheet used as the booking database | *(none)* | `1AbCdEfG...` |
| `GITHUB_PAGES_URL` | URL of your GitHub Pages site (used in booking links) | *(none)* | `https://jane.github.io/scheduler` |
| `AVAILABILITY_PATTERN` | Title substring to match availability events on your calendar | `Jeremy office hours` | `Office hours` |
| `CONFLICT_CALENDAR_IDS` | JSON array of calendar IDs to check for scheduling conflicts | `[]` (empty) | `["jane@gmail.com", "work@group.calendar.google.com"]` |
| `MIN_NOTICE_HOURS` | Minimum hours of advance notice required for bookings | `12` | `24` |
| `MAX_ADVANCE_DAYS` | Maximum number of days in advance a slot can be booked | `90` | `60` |
| `TOKEN_EXPIRY_DAYS` | Number of days before booking management tokens expire | `90` | `30` |
| `CLEANUP_KEY` | Secret key for authenticating cleanup API requests | *(none)* | `a1b2c3d4e5...` |

```{note}
All Script Properties are stored as strings. Numeric values (like `MIN_NOTICE_HOURS`) are parsed as integers by the backend.
```

## YAML configuration files

The frontend reads configuration from YAML files in the `config/` directory. These are parsed client-side using js-yaml.

### config/settings.yaml

Controls global frontend settings.

```yaml
# Title pattern for matching availability events (should match AVAILABILITY_PATTERN Script Property)
availability_pattern: "Office hours"

# Minimum hours of advance notice (should match MIN_NOTICE_HOURS Script Property)
min_notice_hours: 12

# Maximum days in advance to show availability (should match MAX_ADVANCE_DAYS Script Property)
max_advance_days: 90

# Default timezone for the calendar display
default_timezone: "America/New_York"

# Accent color for the booking interface
theme_color: "#CCE2D8"

# URL of the deployed Apps Script web app
apps_script_url: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

| Field | Description |
|-|-|
| `availability_pattern` | Must match the `AVAILABILITY_PATTERN` Script Property exactly |
| `min_notice_hours` | Should match the backend `MIN_NOTICE_HOURS` value |
| `max_advance_days` | Should match the backend `MAX_ADVANCE_DAYS` value |
| `default_timezone` | IANA timezone identifier (e.g., `America/New_York`, `Europe/London`) |
| `theme_color` | Hex color code for UI accents |
| `apps_script_url` | The web app URL from your Apps Script deployment |

### config/meeting-types.yaml

Defines the types of meetings visitors can book. Duration is selected separately by the visitor (15, 30, 45, or 60 minutes) and is not part of the meeting type definition.

```yaml
meeting_types:
  - id: office-hours
    name: "Office hours"
    description: "Meet with me about a course you're enrolled in this term."

  - id: chat-check-in
    name: "Chat or check-in"
    description: "Chat or check in about your research or anything else."
    instructions: "Please share a Google Doc with your agenda and supporting materials before our meeting."

  - id: project-meeting
    name: "Project meeting"
    description: "Discuss or provide an update on a lab project."
    instructions: "Please share a Google Doc with your agenda and supporting materials before our meeting."

  - id: other
    name: "Other"
    description: "For non-standard meetings. Please specify details in the booking form."
```

| Field | Required | Description |
|-|-|-|
| `id` | Yes | Unique identifier (lowercase, hyphens) |
| `name` | Yes | Display name shown to visitors |
| `description` | Yes | Description shown on the meeting type selection page |
| `instructions` | No | Instructions displayed prominently on the booking form (Step 4) when this type is selected. Used to request pre-meeting materials such as a Google Doc with agenda. |

### config/locations.yaml

Defines available meeting locations (virtual and/or in-person).

```yaml
locations:
  - id: virtual
    label: "Virtual (Zoom)"
    value: "https://zoom.us/my/yourroom"

  - id: in-person
    label: "In-person"
    value: "Room 123, Building Name, City, State ZIP"
```

| Field | Required | Description |
|-|-|-|
| `id` | Yes | Unique identifier |
| `label` | Yes | Display label shown in the booking form dropdown |
| `value` | Yes | Location details — a URL for virtual meetings, or an address for in-person |

## GitHub Secrets

Repository secrets are used by the GitHub Actions cleanup workflow. Set them in **Settings** > **Secrets and variables** > **Actions**.

| Secret | Description | Where to find the value |
|-|-|-|
| `APPS_SCRIPT_URL` | The deployed Apps Script web app URL | From the Apps Script deployment step (Deploy > Manage deployments > Web app URL) |
| `CLEANUP_KEY` | Secret key matching the `CLEANUP_KEY` Script Property | The same value you set in Script Properties |

The cleanup workflow (`.github/workflows/cleanup-bookings.yml`) runs weekly on Sundays at midnight UTC and can also be triggered manually from the Actions tab.

## advanced configuration

### adding custom meeting types

To add a new meeting type, append an entry to `config/meeting-types.yaml`:

```yaml
  - id: my-custom-meeting
    name: "Custom Meeting"
    description: "A custom meeting type for specific needs."
    instructions: "Optional instructions shown on the booking form."
```

The `id` must be unique across all meeting types. Duration is not specified per type — visitors choose their preferred duration (15, 30, 45, or 60 minutes) in a separate step. If you include an `instructions` field, its text will be displayed prominently on the booking form when a visitor selects this meeting type.

### changing the availability pattern

The availability pattern is a case-sensitive substring match against calendar event titles. To change it:

1. Update `AVAILABILITY_PATTERN` in Script Properties
2. Update `availability_pattern` in `config/settings.yaml` to match
3. Rename your availability events on Google Calendar to match the new pattern
4. Create a new Apps Script deployment for the change to take effect

### configuring conflict calendars

By default, only the designated calendar (`CALENDAR_ID`) is checked for conflicts. To check additional calendars:

1. Set `CONFLICT_CALENDAR_IDS` in Script Properties to a JSON array of calendar IDs:

   ```json
   ["personal@gmail.com", "work-calendar-id@group.calendar.google.com"]
   ```

2. Create a new Apps Script deployment

The backend will check all listed calendars for busy times and exclude those slots from availability. The designated calendar is always checked automatically — you do not need to include it in this list.

```{tip}
To find a calendar's ID: open Google Calendar > click the three-dot menu next to the calendar name > Settings > scroll to "Integrate calendar" > copy the Calendar ID.
```

### setting a custom timezone

The `default_timezone` in `config/settings.yaml` sets the initial timezone shown to visitors. Visitors can change the timezone using the dropdown at the top of the booking page.

Use a valid [IANA timezone identifier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) such as:
- `America/New_York`
- `America/Los_Angeles`
- `Europe/London`
- `Asia/Tokyo`
