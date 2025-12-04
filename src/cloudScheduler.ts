import { google } from 'googleapis';
import type { AppConfig } from './storage';

const scheduler = google.cloudscheduler('v1');
const DEFAULT_LOCATION = process.env.SCHEDULER_LOCATION || 'us-central1';

function getProjectId(): string {
  const projectId =
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.PROJECT_ID;

  if (!projectId) {
    throw new Error(
      'Project ID not found. Set GCP_PROJECT, GOOGLE_CLOUD_PROJECT, or PROJECT_ID environment variable.'
    );
  }

  return projectId;
}

/**
 * Validates that the environment is properly configured for Cloud Scheduler integration.
 * Returns an error message if configuration is missing, or null if valid.
 */
export function validateSchedulerConfig(): string | null {
  try {
    getProjectId();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown configuration error';
  }
}

async function initAuth(): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  // Use the GoogleAuth instance directly; this matches the types expected by google.options
  google.options({ auth });
}

/**
 * Synchronize Cloud Scheduler jobs with the current application configuration.
 *
 * This updates the cron schedule and timezone for:
 * - projects/{projectId}/locations/{location}/jobs/daily-reminder
 * - projects/{projectId}/locations/{location}/jobs/weekly-announcement
 *
 * Jobs must already exist; failures are logged but do not throw.
 */
export async function syncSchedulerWithConfig(config: AppConfig): Promise<void> {
  const projectId = getProjectId();
  const locationId = DEFAULT_LOCATION;
  const parent = `projects/${projectId}/locations/${locationId}`;
  const timezone = config.timezone || 'America/Los_Angeles';

  await initAuth();

  // Update daily reminder job schedule, if configured
  if (config.reminderTime) {
    const [hours, minutes] = config.reminderTime.split(':').map(Number);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      const cronExpression = `${minutes} ${hours} * * *`; // minute hour * * *

      try {
        await scheduler.projects.locations.jobs.patch({
          name: `${parent}/jobs/daily-reminder`,
          updateMask: 'schedule,timeZone',
          requestBody: {
            schedule: cronExpression,
            timeZone: timezone,
          },
        });
        console.log(
          `Cloud Scheduler: updated daily-reminder to "${cronExpression}" (${timezone})`
        );
      } catch (error) {
        console.error('Cloud Scheduler: failed to update daily-reminder job:', error);
      }
    } else {
      console.warn(
        `Cloud Scheduler: invalid reminderTime "${config.reminderTime}", skipping daily-reminder update`
      );
    }
  }

  // Update weekly announcement job schedule, if configured
  if (
    config.weeklySchedule &&
    config.weeklySchedule.dayOfWeek !== undefined &&
    config.weeklySchedule.time
  ) {
    const [hours, minutes] = config.weeklySchedule.time.split(':').map(Number);
    const dayOfWeek = config.weeklySchedule.dayOfWeek;

    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59 &&
      dayOfWeek >= 0 &&
      dayOfWeek <= 6
    ) {
      const cronExpression = `${minutes} ${hours} * * ${dayOfWeek}`; // minute hour * * dayOfWeek

      try {
        await scheduler.projects.locations.jobs.patch({
          name: `${parent}/jobs/weekly-announcement`,
          updateMask: 'schedule,timeZone',
          requestBody: {
            schedule: cronExpression,
            timeZone: timezone,
          },
        });
        console.log(
          `Cloud Scheduler: updated weekly-announcement to "${cronExpression}" (${timezone})`
        );
      } catch (error) {
        console.error(
          'Cloud Scheduler: failed to update weekly-announcement job:',
          error
        );
      }
    } else {
      console.warn(
        `Cloud Scheduler: invalid weeklySchedule "${JSON.stringify(
          config.weeklySchedule
        )}", skipping weekly-announcement update`
      );
    }
  }
}


