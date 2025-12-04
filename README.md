# Slack Meeting Attendance Manager

A Slack app that integrates with Google Calendar to manage meeting announcements and track team attendance for FRC Team 3476 Code Orange.

## Features

- **Weekly Meeting Announcements**: Automatically post weekly meeting schedules with interactive attendance buttons
- **Daily Meeting Reminders**: Post reminders on meeting days at a configurable time
- **Meeting Start Alerts**: Announce when meetings are about to start (5 minutes before)
- **Interactive Attendance**: Users click "Attending" or "Not Attending" directly in Slack messages
- **Calendar View**: View a calendar grid showing events and attendee lists via `/meeting-calendar`
- **Today View**: Quick view of today's meetings with `/meeting-today`
- **Event Management**: Create and manage events with `/meeting-event`
- **Cloud Scheduler Integration**: Automatic job scheduling via Google Cloud Scheduler
- **Multi-event Support**: Handle multiple events per day in different locations

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Slack Integration**: Slack Bolt Framework
- **Calendar**: Google Calendar API with service account authentication
- **Storage**: Local JSON or Google Cloud Storage
- **Deployment**: Docker container on Google Cloud Run
- **Scheduling**: Google Cloud Scheduler

## Slack Commands

| Command | Description |
|---------|-------------|
| `/meeting-config` | Open configuration modal to set up the app |
| `/meeting-calendar [week]` | View calendar with events and attendees (week offset optional) |
| `/meeting-today` | View today's meetings |
| `/meeting-reminder` | Manually trigger daily reminders |
| `/meeting-event` | Create or manage calendar events |

## Project Structure

```
├── src/
│   ├── app.ts                    # Main Slack app entry point
│   ├── calendar.ts               # Google Calendar API integration
│   ├── announcements.ts          # Weekly announcement generation
│   ├── reminders.ts              # Daily meeting reminder generation
│   ├── meetingStartAnnouncements.ts  # Meeting start alerts
│   ├── attendance.ts             # Attendance tracking logic
│   ├── calendarView.ts           # Calendar view display
│   ├── todayView.ts              # Today's meetings view
│   ├── config.ts                 # Configuration management
│   ├── cloudScheduler.ts         # Cloud Scheduler integration
│   ├── storage.ts                # Storage utilities (local/GCS)
│   ├── userCache.ts              # Slack user caching
│   ├── dailyReminderCommand.ts   # Manual reminder command
│   ├── eventCommands.ts          # Event management commands
│   ├── blocks/                   # Slack Block Kit components
│   │   ├── eventBlocks.ts
│   │   ├── modalBlocks.ts
│   │   └── types.ts
│   ├── services/
│   │   └── eventService.ts       # Event business logic
│   └── utils/
│       ├── channelRestriction.ts
│       └── timezone.ts
├── config/
│   ├── service-account.json      # Google credentials (gitignored)
│   └── app-config.json           # App configuration (gitignored)
├── data/
│   └── attendance.json           # Attendance data (gitignored)
├── Dockerfile
├── cloudbuild.yaml
└── package.json
```

## Local Development

### Prerequisites

- Node.js 18+
- A Slack workspace with app creation permissions
- Google Cloud project with Calendar API enabled
- A Google Calendar shared with your service account

### Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/FRC3476/SlackMeetingManager.git
   cd SlackMeetingManager
   npm install
   ```

2. **Configure Google Calendar service account**
   - Create a service account in Google Cloud Console
   - Download the JSON key and save as `config/service-account.json`
   - Share your calendar with the service account email

3. **Create a Slack app** at [api.slack.com/apps](https://api.slack.com/apps)
   - Add Bot Token Scopes: `chat:write`, `commands`, `users:read`, `channels:read`
   - Install to your workspace and copy the Bot Token and Signing Secret

4. **Create `.env` file**
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   GOOGLE_SERVICE_ACCOUNT_PATH=config/service-account.json
   PORT=3000
   STORAGE_TYPE=local
   ```

5. **Build and run**
   ```bash
   npm run build
   npm start
   ```

6. **Expose locally with ngrok** for Slack events
   ```bash
   ngrok http 3000
   ```
   Set your Slack app's Request URL to `https://your-ngrok-url/slack/events`

7. **Configure the app** using `/meeting-config` in Slack

## Cloud Deployment

The app is configured for deployment on Google Cloud Run with Cloud Build.

### Deploy with Cloud Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

### Required Secrets (in Secret Manager)

- `slack-bot-token`: Slack Bot OAuth Token
- `slack-signing-secret`: Slack Signing Secret

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Bot token (via Secret Manager) |
| `SLACK_SIGNING_SECRET` | Signing secret (via Secret Manager) |
| `PORT` | Server port (default: 8080) |
| `STORAGE_TYPE` | `local` or `gcs` |
| `GCS_BUCKET_NAME` | Cloud Storage bucket for persistence |
| `GCP_PROJECT` | Google Cloud project ID |

### API Endpoints

These endpoints can be triggered by Cloud Scheduler:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/weekly-announcement` | Post weekly meeting announcement |
| `POST /api/daily-reminder` | Post daily meeting reminders |
| `POST /api/meeting-starts` | Check and announce meeting starts |
| `GET /health` | Health check |

## License

MIT
