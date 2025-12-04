import { App } from '@slack/bolt';
import { fetchWeeklyEvents, formatEventDate } from './calendar';
import { readConfig } from './storage';
import { getWeekBoundsInTimezone } from './utils/timezone';
import {
  buildEventSection,
  buildDateHeader,
  buildDivider,
} from './blocks/eventBlocks';
import { SlackBlock, HeaderBlock } from './blocks/types';
import {
  fetchEventsWithAttendance,
  groupEventsByDate,
  getSortedDateKeys,
} from './services/eventService';

export function setupCalendarViewHandlers(app: App): void {
  app.command('/meeting-calendar', async ({ ack, body, client }) => {
    await ack();

    const config = await readConfig();
    
    if (!config.calendarId) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ Calendar ID not configured. Please use `/meeting-config` to set it up.',
      });
      return;
    }

    try {
      // Parse optional week parameter
      const weekOffset = body.text ? parseInt(body.text) || 0 : 0;
      
      // Get week boundaries in the configured timezone
      const timezone = config.timezone || 'America/Los_Angeles';
      const { start: startDate, end: endDate } = getWeekBoundsInTimezone(timezone, weekOffset);

      // Fetch events for the specified week
      const weekEvents = await fetchWeeklyEvents(config.calendarId, startDate, endDate);

      if (weekEvents.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `No meetings found for the week of ${startDate.toLocaleDateString()}.`,
        });
        return;
      }

      // Fetch events with attendance data
      const eventsWithAttendance = await fetchEventsWithAttendance(weekEvents, config.timezone);
      
      // Group events by date
      const eventsByDate = groupEventsByDate(eventsWithAttendance);
      const sortedDates = getSortedDateKeys(eventsByDate);

      // Create calendar view blocks
      const blocks: SlackBlock[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📅 Meeting Calendar - Week of ${startDate.toLocaleDateString()}`,
          },
        } as HeaderBlock,
        buildDivider(),
      ];

      for (const dateKey of sortedDates) {
        const dateEvents = eventsByDate.get(dateKey)!;
        const firstEvent = dateEvents[0].event;
        const dateStr = formatEventDate(firstEvent, config.timezone);

        blocks.push(buildDateHeader(dateStr));

        for (const eventData of dateEvents) {
          // Use detailed attendance (with bullet points) for calendar view
          blocks.push(buildEventSection(
            eventData.event,
            { attending: eventData.attending, notAttending: eventData.notAttending },
            config.timezone,
            { detailedAttendance: true }
          ));
          blocks.push(buildDivider());
        }
      }

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        blocks: blocks as any[],
        text: 'Meeting Calendar',
      });
    } catch (error) {
      console.error('Error displaying calendar view:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ Error fetching calendar data. Please try again later.',
      });
    }
  });
}
