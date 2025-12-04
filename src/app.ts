import { App, ExpressReceiver } from '@slack/bolt';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { initializeCalendarAuth } from './calendar';
import { setupAttendanceHandlers } from './attendance';
import { setupConfigHandlers } from './config';
import { setupCalendarViewHandlers } from './calendarView';
import { setupTodayViewHandlers } from './todayView';
import { setupDailyReminderCommand } from './dailyReminderCommand';
import { setupEventCommands } from './eventCommands';
import { postWeeklyAnnouncement } from './announcements';
import { postDailyReminders } from './reminders';
import { checkAndAnnounceMeetingStarts } from './meetingStartAnnouncements';
import { getUserCache } from './userCache';
import { validateSchedulerConfig } from './cloudScheduler';

// Load environment variables
dotenv.config();

// Validate Cloud Scheduler configuration at startup
const schedulerConfigError = validateSchedulerConfig();
if (schedulerConfigError) {
  console.warn(
    '⚠️  Cloud Scheduler integration is not configured:',
    schedulerConfigError
  );
  console.warn(
    '   Automatic job updates from /meeting-config will not work.'
  );
  console.warn(
    '   To fix: Set GCP_PROJECT, GOOGLE_CLOUD_PROJECT, or PROJECT_ID environment variable.'
  );
} else {
  console.log('✓ Cloud Scheduler integration is properly configured');
}

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Create Express receiver
const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  processBeforeResponse: true,
});

// ExpressReceiver handles body parsing and routing automatically
// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver,
});

// Add error handling middleware AFTER app initialization
expressReceiver.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err);
  console.error('Error stack:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Initialize Google Calendar authentication
initializeCalendarAuth().catch(error => {
  console.error('Error initializing calendar auth:', error);
});

// Get user cache instance (initialization happens in startup block)
const userCache = getUserCache();

// Setup event handlers
setupAttendanceHandlers(app, userCache);
setupConfigHandlers(app);
setupCalendarViewHandlers(app);
setupTodayViewHandlers(app);
setupDailyReminderCommand(app);
setupEventCommands(app);

// Health check endpoint
expressReceiver.app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Explicit URL verification handler (ExpressReceiver should handle this, but ensuring it works)
expressReceiver.app.post('/slack/events', (req: Request, res: Response, next: express.NextFunction) => {
  // Handle URL verification challenge before signature verification
  if (req.body && req.body.type === 'url_verification' && req.body.challenge) {
    console.log('Handling URL verification challenge');
    return res.status(200).json({ challenge: req.body.challenge });
  }
  // Let ExpressReceiver handle other requests
  next();
});

// Manual trigger endpoints (for testing or Cloud Scheduler)
expressReceiver.app.post('/api/weekly-announcement', async (_req: Request, res: Response) => {
  try {
    await postWeeklyAnnouncement(app);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error posting weekly announcement:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

expressReceiver.app.post('/api/daily-reminder', async (_req: Request, res: Response) => {
  try {
    await postDailyReminders(app);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error posting daily reminders:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

expressReceiver.app.post('/api/meeting-starts', async (_req: Request, res: Response) => {
  try {
    await checkAndAnnounceMeetingStarts(app);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error checking meeting starts:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Start the app
(async () => {
  try {
    // Initialize user cache before accepting requests
    await userCache.initialize(app.client);
    
    await expressReceiver.start(port);
    console.log(`⚡️ Slack app is running on port ${port}!`);
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
})();

