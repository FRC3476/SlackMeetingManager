import { App } from '@slack/bolt';
import { DateTime } from 'luxon';
import { updateAttendance, readAttendance, batchUpdateAttendance } from './storage';
import { CalendarEvent } from './calendar';
import { UserCache } from './userCache';
import { buildAttendanceText } from './blocks/eventBlocks';

/**
 * Generate a stable attendance key for an event.
 * For recurring events, uses recurringEventId + date to ensure consistency across API calls.
 * For non-recurring events, uses the event ID directly.
 */
export function getAttendanceKey(event: CalendarEvent, timezone?: string): string {
  if (event.recurringEventId) {
    const tz = timezone || 'UTC';
    const dt = DateTime.fromJSDate(event.start).setZone(tz);
    const dateStr = dt.toFormat('yyyy-MM-dd');
    const key = `${event.recurringEventId}|${dateStr}`;
    console.log(`Generated attendance key for recurring event: ${key} (instance ID: ${event.id})`);
    return key;
  }
  console.log(`Using event ID as attendance key: ${event.id}`);
  return event.id;
}

export function setupAttendanceHandlers(app: App, userCache: UserCache): void {
  app.action('attending', async ({ ack, body, action, client }) => {
    await ack();
    
    if (!('user' in body) || !action || !('value' in action)) {
      return;
    }

    const userId = body.user.id;
    const eventId = action.value as string;
    const channelId = 'channel' in body ? body.channel?.id : undefined;
    const messageTs = 'message' in body && body.message && 'ts' in body.message ? body.message.ts : undefined;

    try {
      await updateAttendance(eventId, userId, 'attending');
      
      if (channelId && messageTs) {
        await updateMessageAttendance(client, channelId, messageTs, [eventId], userCache);
      }
      
      if (channelId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '✅ You marked yourself as attending!',
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  });

  app.action('not_attending', async ({ ack, body, action, client }) => {
    await ack();
    
    if (!('user' in body) || !action || !('value' in action)) {
      return;
    }

    const userId = body.user.id;
    const eventId = action.value as string;
    const channelId = 'channel' in body ? body.channel?.id : undefined;
    const messageTs = 'message' in body && body.message && 'ts' in body.message ? body.message.ts : undefined;

    try {
      await updateAttendance(eventId, userId, 'not_attending');
      
      if (channelId && messageTs) {
        await updateMessageAttendance(client, channelId, messageTs, [eventId], userCache);
      }
      
      if (channelId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '❌ You marked yourself as not attending.',
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  });

  app.action('not_attending_any', async ({ ack, body, action, client }) => {
    await ack();
    
    if (!('user' in body) || !action || !('value' in action)) {
      return;
    }

    const userId = body.user.id;
    const eventIds = (action.value as string).split(',').map(id => id.trim());
    const channelId = 'channel' in body ? body.channel?.id : undefined;
    const messageTs = 'message' in body && body.message && 'ts' in body.message ? body.message.ts : undefined;

    try {
      const updates = eventIds.map(eventId => ({
        eventId,
        userId,
        status: 'not_attending' as const,
      }));
      await batchUpdateAttendance(updates);
      
      if (channelId && messageTs) {
        await updateMessageAttendance(client, channelId, messageTs, eventIds, userCache);
      }
      
      if (channelId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: `❌ You marked yourself as not attending all ${eventIds.length} meeting${eventIds.length !== 1 ? 's' : ''}.`,
        });
      }
    } catch (error) {
      console.error('Error updating attendance for all events:', error);
    }
  });
}

/**
 * Unified function to update message attendance for one or more events.
 * Handles both single event updates and batch updates efficiently.
 */
async function updateMessageAttendance(
  client: any,
  channelId: string,
  messageTs: string,
  eventIds: string[],
  userCache: UserCache
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  try {
    // Fetch attendance data for all events
    const attendanceByEvent = new Map<string, { attending: string[]; notAttending: string[] }>();
    for (const eventId of eventIds) {
      const { attending, notAttending } = await getAttendees(eventId, userCache);
      attendanceByEvent.set(eventId, { attending, notAttending });
    }
    
    // Get the original message
    const result = await client.conversations.history({
      channel: channelId,
      latest: messageTs,
      limit: 1,
      inclusive: true,
    });

    if (!result.messages || result.messages.length === 0 || !result.messages[0].blocks) {
      return;
    }

    const message = result.messages[0];
    
    // Build a map of button block indices for each event
    const eventButtonIndices = new Map<string, number>();
    for (let i = 0; i < message.blocks.length; i++) {
      const block = message.blocks[i];
      if (block.type === 'actions' && block.elements) {
        for (const eventId of eventIds) {
          if (block.elements.some((el: any) => el.value === eventId)) {
            eventButtonIndices.set(eventId, i);
            break;
          }
        }
      }
    }
    
    // Update relevant section blocks
    const updatedBlocks = message.blocks.map((block: any, index: number) => {
      if (block.type !== 'section' || !block.text?.text) {
        return block;
      }

      // Find which event this section belongs to (it should be before an event's button block)
      for (const [eventId, buttonIndex] of eventButtonIndices.entries()) {
        if (buttonIndex > 0 && index === buttonIndex - 1) {
          const text = block.text.text;
          if (hasAttendanceMarkers(text)) {
            const attendanceData = attendanceByEvent.get(eventId);
            if (attendanceData) {
              const updatedText = rebuildBlockText(text, attendanceData);
              return {
                ...block,
                text: { ...block.text, text: updatedText },
              };
            }
          }
        }
      }
      
      return block;
    });

    console.log(`Updating message ${messageTs} for ${eventIds.length} event(s)`);
    
    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      blocks: updatedBlocks,
      text: 'Meeting attendance updated',
    });
  } catch (error) {
    console.error('Error updating message attendance:', error);
  }
}

/**
 * Check if text contains attendance markers
 */
function hasAttendanceMarkers(text: string): boolean {
  return text.includes('✅') || text.includes('❌') || 
         text.includes(':white_check_mark:') || text.includes(':x:') ||
         text.includes('Attending:');
}

/**
 * Rebuild block text with updated attendance data
 */
function rebuildBlockText(
  originalText: string,
  attendance: { attending: string[]; notAttending: string[] }
): string {
  // Extract base event info (everything before the first attendance marker)
  const baseEventInfo = originalText.split(/\n✅|\n❌|\n:white_check_mark:|\n:x:/)[0];
  
  // Build new attendance text using shared builder
  const attendanceText = buildAttendanceText(attendance.attending, attendance.notAttending, false);
  
  return baseEventInfo + attendanceText;
}

/**
 * Get attendance count for an event
 */
export async function getAttendanceCount(eventId: string): Promise<{
  attending: number;
  notAttending: number;
  total: number;
}> {
  const attendance = await readAttendance();
  const eventAttendance = attendance[eventId] || {};
  
  let attending = 0;
  let notAttending = 0;

  Object.values(eventAttendance).forEach((entry) => {
    if (entry.status === 'attending') {
      attending++;
    } else if (entry.status === 'not_attending') {
      notAttending++;
    }
  });

  return {
    attending,
    notAttending,
    total: attending + notAttending,
  };
}

/**
 * Get list of attendees for an event
 */
export async function getAttendees(eventId: string, userCache: UserCache): Promise<{
  attending: string[];
  notAttending: string[];
}> {
  const attendance = await readAttendance();
  const eventAttendance = attendance[eventId] || {};
  
  const attending: string[] = [];
  const notAttending: string[] = [];

  for (const [userId, entry] of Object.entries(eventAttendance)) {
    const userName = await userCache.getDisplayNameAsync(userId);
    
    if (entry.status === 'attending') {
      attending.push(userName);
    } else if (entry.status === 'not_attending') {
      notAttending.push(userName);
    }
  }

  return { attending, notAttending };
}
