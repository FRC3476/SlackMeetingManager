import { App } from '@slack/bolt';
import { fetchWeeklyEvents, CalendarEvent, formatEventDate } from './calendar';
import { readConfig } from './storage';
import { getAttendanceKey } from './attendance';
import {
  buildEventWithButtons,
  buildDateHeader,
  buildDivider,
  buildIntroSection,
} from './blocks/eventBlocks';
import { SlackBlock } from './blocks/types';
import {
  fetchEventsWithAttendance,
  fetchEventWithAttendance,
  groupEventsByDate,
  getSortedDateKeys,
} from './services/eventService';

export async function postWeeklyAnnouncement(app: App): Promise<void> {
  try {
    const config = await readConfig();
    
    if (!config.channelId || !config.calendarId) {
      console.error('Channel ID or Calendar ID not configured');
      return;
    }

    const events = await fetchWeeklyEvents(config.calendarId);
    
    if (events.length === 0) {
      console.log('No events found for this week');
      return;
    }

    const template = config.weeklyTemplate || 
      `📅 *Weekly Meeting Schedule*\n\nHere are the meetings for this week. Please confirm your attendance:`;

    const blocks: SlackBlock[] = [
      buildIntroSection(template),
      buildDivider(),
    ];

    // Fetch events with attendance data
    const eventsWithAttendance = await fetchEventsWithAttendance(events, config.timezone);
    
    // Group events by date
    const eventsByDate = groupEventsByDate(eventsWithAttendance);
    const sortedDates = getSortedDateKeys(eventsByDate);

    // Build blocks for each date and its events
    for (const dateKey of sortedDates) {
      const dateEvents = eventsByDate.get(dateKey)!;
      const firstEvent = dateEvents[0].event;
      const dateStr = formatEventDate(firstEvent, config.timezone);

      blocks.push(buildDateHeader(dateStr));

      for (const eventData of dateEvents) {
        const eventBlocks = buildEventWithButtons(
          eventData.event,
          eventData.attendanceKey,
          { attending: eventData.attending, notAttending: eventData.notAttending },
          config.timezone
        );
        blocks.push(...eventBlocks);
      }
    }

    await app.client.chat.postMessage({
      channel: config.channelId,
      blocks: blocks as any[],
      text: 'Weekly Meeting Schedule',
    });

    console.log(`Posted weekly announcement with ${events.length} events`);
  } catch (error) {
    console.error('Error posting weekly announcement:', error);
    throw error;
  }
}

/**
 * Post an announcement for a newly created event that falls within the current week.
 */
export async function postNewEventAnnouncement(app: App, event: CalendarEvent): Promise<void> {
  try {
    const config = await readConfig();
    
    if (!config.channelId) {
      console.error('Channel ID not configured');
      return;
    }

    const eventData = await fetchEventWithAttendance(event, config.timezone);

    const blocks: SlackBlock[] = [
      buildIntroSection(`🆕 *New Event this Week*\n\nA new event has been added to the calendar this week. Please confirm your attendance:`),
      buildDivider(),
      ...buildEventWithButtons(
        eventData.event,
        eventData.attendanceKey,
        { attending: eventData.attending, notAttending: eventData.notAttending },
        config.timezone,
        { showDate: true }
      ),
    ];

    await app.client.chat.postMessage({
      channel: config.channelId,
      blocks: blocks as any[],
      text: 'New Event this Week',
    });

    console.log(`Posted new event announcement for "${event.summary}"`);
  } catch (error) {
    console.error('Error posting new event announcement:', error);
  }
}
