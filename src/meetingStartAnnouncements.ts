import { App } from '@slack/bolt';
import { fetchTodaysEvents, formatEventTime, CalendarEvent } from './calendar';
import { readConfig } from './storage';
import { getAttendanceKey } from './attendance';
import { DateTime } from 'luxon';
import {
  buildAttendanceText,
  buildIntroSection,
} from './blocks/eventBlocks';
import { SlackBlock } from './blocks/types';
import { fetchEventsWithAttendance } from './services/eventService';

// Track which meetings we've already announced
const announcedMeetings = new Set<string>();

export async function checkAndAnnounceMeetingStarts(app: App): Promise<void> {
  try {
    const config = await readConfig();
    
    if (!config.channelId || !config.calendarId) {
      return;
    }

    const timezone = config.timezone || 'America/Los_Angeles';
    const events = await fetchTodaysEvents(config.calendarId, timezone);
    const now = new Date();
    const nowLocal = DateTime.fromJSDate(now).setZone(timezone);
    const nowUTC = DateTime.fromJSDate(now).toUTC();
    
    console.log(`\n=== Checking Meeting Start Announcements ===`);
    console.log(`Current time: ${nowLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')} (${nowUTC.toFormat('HH:mm:ss')} UTC)`);
    console.log(`Found ${events.length} event(s) for today`);
    
    // Filter events that need announcements
    const eventsToAnnounce: CalendarEvent[] = [];
    for (const event of events) {
      if (announcedMeetings.has(event.id)) {
        console.log(`\n  Event: "${event.summary}"`);
        console.log(`    Status: Already announced, skipping`);
        continue;
      }

      const startTime = event.start;
      const startTimeLocal = DateTime.fromJSDate(startTime).setZone(timezone);
      const startTimeUTC = DateTime.fromJSDate(startTime).toUTC();
      const timeUntilStart = startTime.getTime() - now.getTime();
      const minutesUntilStart = Math.floor(timeUntilStart / 60000);
      const secondsUntilStart = Math.floor((timeUntilStart % 60000) / 1000);
      
      console.log(`\n  Event: "${event.summary}"`);
      console.log(`    Start time: ${startTimeLocal.toFormat('HH:mm:ss ZZZZ')} (${startTimeUTC.toFormat('HH:mm:ss')} UTC)`);
      console.log(`    Time until start: ${minutesUntilStart}m ${secondsUntilStart}s (${timeUntilStart}ms)`);
      
      // Announce if meeting starts within the next 5 minutes
      if (timeUntilStart >= 0 && timeUntilStart <= 300000) {
        console.log(`    Decision: WILL ANNOUNCE (within 5-minute window)`);
        eventsToAnnounce.push(event);
      } else if (timeUntilStart < 0) {
        console.log(`    Decision: Skip (meeting already started ${Math.abs(minutesUntilStart)} minutes ago)`);
      } else {
        console.log(`    Decision: Skip (too far in future: ${minutesUntilStart} minutes away)`);
      }
    }

    // Fetch attendance and post announcements
    if (eventsToAnnounce.length > 0) {
      const eventsWithAttendance = await fetchEventsWithAttendance(eventsToAnnounce, config.timezone);

      for (const eventData of eventsWithAttendance) {
        const event = eventData.event;
        const timeStr = formatEventTime(event, config.timezone);
        const locationStr = event.location ? `📍 ${event.location}` : '';

        let announcementText = `🔔 *Meeting Starting Now: ${event.summary}*\n`;
        announcementText += `🕐 ${timeStr}\n`;
        if (locationStr) {
          announcementText += `${locationStr}\n`;
        }
        announcementText += buildAttendanceText(eventData.attending, eventData.notAttending, true);

        const blocks: SlackBlock[] = [
          buildIntroSection(announcementText),
        ];

        await app.client.chat.postMessage({
          channel: config.channelId,
          blocks: blocks as any[],
          text: `Meeting Starting: ${event.summary}`,
        });

        announcedMeetings.add(event.id);
        console.log(`\n  Posted announcement for: ${event.summary}`);
      }
    }

    if (eventsToAnnounce.length === 0) {
      console.log(`\nNo events need announcements at this time.`);
    }

    // Clean up old announcements (meetings that have passed)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    let cleanedCount = 0;
    for (const event of events) {
      if (event.end < oneHourAgo) {
        announcedMeetings.delete(event.id);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`\nCleaned up ${cleanedCount} old announcement(s) from tracking.`);
    }
    
    console.log(`=== End Meeting Start Check ===\n`);
  } catch (error) {
    console.error('Error checking meeting starts:', error);
  }
}
