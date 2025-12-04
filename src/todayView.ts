import { App } from '@slack/bolt';
import { fetchTodaysEvents } from './calendar';
import { readConfig } from './storage';
import {
  buildEventSection,
  buildDivider,
} from './blocks/eventBlocks';
import { SlackBlock, HeaderBlock } from './blocks/types';
import { fetchEventsWithAttendance } from './services/eventService';

export function setupTodayViewHandlers(app: App): void {
  app.command('/meeting-today', async ({ ack, body, client }) => {
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
      const events = await fetchTodaysEvents(config.calendarId, config.timezone);
      
      if (events.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '📅 No meetings scheduled for today!',
        });
        return;
      }

      // Sort events by start time
      events.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Format today's date
      const today = new Date();
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(config.timezone && { timeZone: config.timezone }),
      };
      const todayStr = today.toLocaleDateString('en-US', dateOptions);

      // Fetch events with attendance data
      const eventsWithAttendance = await fetchEventsWithAttendance(events, config.timezone);

      const blocks: SlackBlock[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📅 Today's Meetings - ${todayStr}`,
          },
        } as HeaderBlock,
        buildDivider(),
      ];

      for (const eventData of eventsWithAttendance) {
        // Use detailed attendance (with bullet points) for today view
        blocks.push(buildEventSection(
          eventData.event,
          { attending: eventData.attending, notAttending: eventData.notAttending },
          config.timezone,
          { detailedAttendance: true }
        ));
        blocks.push(buildDivider());
      }

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        blocks: blocks as any[],
        text: `Today's Meetings`,
      });
    } catch (error) {
      console.error('Error displaying today\'s meetings:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ Error fetching today\'s meetings. Please try again later.',
      });
    }
  });
}
