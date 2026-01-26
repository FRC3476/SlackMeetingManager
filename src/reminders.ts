import { App } from '@slack/bolt';
import { fetchTodaysEvents, fetchTomorrowsEvents } from './calendar';
import { readConfig } from './storage';
import {
  buildEventWithButtons,
  buildDivider,
  buildIntroSection,
  buildNotAttendingAnyButton,
  buildAttendingAllButton,
  buildDateHeader,
} from './blocks/eventBlocks';
import { SlackBlock } from './blocks/types';
import { fetchEventsWithAttendance } from './services/eventService';

// Track which events we've already posted reminders for today
const postedRemindersToday = new Set<string>();
let lastReminderDate: string | null = null;

export async function postDailyReminders(app: App): Promise<void> {
  try {
    const config = await readConfig();
    
    if (!config.channelId || !config.calendarId) {
      console.error('Channel ID or Calendar ID not configured');
      return;
    }

    // Reset tracking if it's a new day
    const tz = config.timezone || 'UTC';
    const todayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = todayFormatter.format(new Date());
    if (lastReminderDate !== today) {
      console.log(`New day detected, resetting reminder tracking. Previous day: ${lastReminderDate}, Today: ${today}`);
      postedRemindersToday.clear();
      lastReminderDate = today;
    }

    // Fetch today's and tomorrow's events
    const [todayEvents, tomorrowEvents] = await Promise.all([
      fetchTodaysEvents(config.calendarId, config.timezone),
      fetchTomorrowsEvents(config.calendarId, config.timezone),
    ]);
    
    console.log(`Found ${todayEvents.length} events for today`);
    todayEvents.forEach(event => {
      console.log(`  - ${event.summary} at ${event.start.toISOString()}`);
    });
    console.log(`Found ${tomorrowEvents.length} events for tomorrow`);
    tomorrowEvents.forEach(event => {
      console.log(`  - ${event.summary} at ${event.start.toISOString()}`);
    });
    
    const totalEvents = todayEvents.length + tomorrowEvents.length;
    if (totalEvents === 0) {
      console.log('No events found for today or tomorrow');
      return;
    }

    // Check if we've already posted reminders today
    const allEventIds = [...todayEvents, ...tomorrowEvents].map(e => e.id).join(',');
    if (postedRemindersToday.has(allEventIds)) {
      console.log('Daily reminders already posted today, skipping');
      return;
    }
    
    // Mark all events as posted
    [...todayEvents, ...tomorrowEvents].forEach(event => postedRemindersToday.add(event.id));
    postedRemindersToday.add(allEventIds);

    const blocks: SlackBlock[] = [];
    
    // Add custom template as header if provided
    if (config.dailyTemplate) {
      blocks.push(buildIntroSection(config.dailyTemplate));
      blocks.push(buildDivider());
    }

    // Collect all attendance keys for the "Not Attending Any" button
    const allAttendanceKeys: string[] = [];

    // Build blocks for today's events
    if (todayEvents.length > 0) {
      blocks.push(buildDateHeader("Today's Events"));
      
      const todayEventsWithAttendance = await fetchEventsWithAttendance(todayEvents, config.timezone);
      
      for (const eventData of todayEventsWithAttendance) {
        const eventBlocks = buildEventWithButtons(
          eventData.event,
          eventData.attendanceKey,
          { attending: eventData.attending, notAttending: eventData.notAttending },
          config.timezone,
          { titlePrefix: '🔔 ' }
        );
        blocks.push(...eventBlocks);
        allAttendanceKeys.push(eventData.attendanceKey);
      }
    }

    // Build blocks for tomorrow's events
    if (tomorrowEvents.length > 0) {
      blocks.push(buildDateHeader("Tomorrow's Events"));
      
      const tomorrowEventsWithAttendance = await fetchEventsWithAttendance(tomorrowEvents, config.timezone);
      
      for (const eventData of tomorrowEventsWithAttendance) {
        const eventBlocks = buildEventWithButtons(
          eventData.event,
          eventData.attendanceKey,
          { attending: eventData.attending, notAttending: eventData.notAttending },
          config.timezone,
          { titlePrefix: '📅 ' }
        );
        blocks.push(...eventBlocks);
        allAttendanceKeys.push(eventData.attendanceKey);
      }
    }

    // Add "Attending All" and "Not Attending Any" buttons if there are multiple events total
    if (totalEvents > 1) {
      blocks.push({
        type: 'actions',
        elements: [
          buildAttendingAllButton(allAttendanceKeys).elements[0],
          buildNotAttendingAnyButton(allAttendanceKeys).elements[0],
        ],
      });
    }

    // Build summary text
    const summaryParts: string[] = [];
    if (todayEvents.length > 0) {
      summaryParts.push(`${todayEvents.length} today`);
    }
    if (tomorrowEvents.length > 0) {
      summaryParts.push(`${tomorrowEvents.length} tomorrow`);
    }
    const summaryText = `Daily Meeting Reminders - ${summaryParts.join(', ')}`;

    await app.client.chat.postMessage({
      channel: config.channelId,
      blocks: blocks as any[],
      text: summaryText,
      unfurl_links: false,
      unfurl_media: false,
    });

    console.log(`Posted daily reminder with ${todayEvents.length} events today and ${tomorrowEvents.length} events tomorrow`);
  } catch (error) {
    console.error('Error posting daily reminders:', error);
    throw error;
  }
}
