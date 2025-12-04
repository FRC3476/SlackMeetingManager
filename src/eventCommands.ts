import { App } from '@slack/bolt';
import { readConfig } from './storage';
import { checkChannelRestriction } from './utils/channelRestriction';
import {
  createCalendarEvent,
  updateCalendarEvent,
  getEventById,
  searchEvents,
  CreateEventData,
  UpdateEventData,
} from './calendar';
import { createDateInTimezone, isEventInCurrentWeek } from './utils/timezone';
import { postNewEventAnnouncement } from './announcements';
import {
  buildCreateEventModalBlocks,
  buildUpdateEventModalBlocks,
  buildSearchEventModalBlocks,
  buildEventSelectionBlocks,
  buildSuccessModal,
} from './blocks/modalBlocks';

// Day abbreviations for RRULE format (Sunday = 0)
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Generate an RRULE string from a recurrence option and date
 */
function generateRrule(option: string, date: Date): string | null {
  if (!option || option === 'none') {
    return null;
  }

  const dayOfWeek = date.getDay();
  const dayAbbrev = RRULE_DAYS[dayOfWeek];
  const dayOfMonth = date.getDate();

  switch (option) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'weekly':
      return `RRULE:FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
    case 'monthly_weekday': {
      const weekNumber = Math.ceil(dayOfMonth / 7);
      const nextWeekSameDay = new Date(date);
      nextWeekSameDay.setDate(dayOfMonth + 7);
      const isLastOccurrence = nextWeekSameDay.getMonth() !== date.getMonth();
      if (isLastOccurrence && weekNumber >= 4) {
        return `RRULE:FREQ=MONTHLY;BYDAY=-1${dayAbbrev}`;
      }
      return `RRULE:FREQ=MONTHLY;BYDAY=${weekNumber}${dayAbbrev}`;
    }
    case 'monthly_date':
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
    case 'yearly':
      return 'RRULE:FREQ=YEARLY';
    case 'weekday':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    default:
      return null;
  }
}

export function setupEventCommands(app: App): void {
  // Handle /create-event command
  app.command('/create-event', async ({ ack, body, client }) => {
    await ack();

    const config = await readConfig();

    if (!checkChannelRestriction(body.channel_id, config.allowedChannels)) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command can only be executed in specific channels. Please contact an administrator.',
      });
      return;
    }

    if (!config.calendarId) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ Calendar ID not configured. Please use `/meeting-config` to set it up.',
      });
      return;
    }

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal' as const,
          callback_id: 'create_event_modal',
          title: { type: 'plain_text', text: 'Create Calendar Event' },
          submit: { type: 'plain_text', text: 'Create' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: buildCreateEventModalBlocks() as any[],
        },
      });
    } catch (error) {
      console.error('Error opening create event modal:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `❌ Error opening event creation form: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });

  // Handle /update-event command
  app.command('/update-event', async ({ ack, body, client }) => {
    await ack();

    const config = await readConfig();

    if (!checkChannelRestriction(body.channel_id, config.allowedChannels)) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command can only be executed in specific channels. Please contact an administrator.',
      });
      return;
    }

    if (!config.calendarId) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ Calendar ID not configured. Please use `/meeting-config` to set it up.',
      });
      return;
    }

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal' as const,
          callback_id: 'select_event_modal',
          title: { type: 'plain_text', text: 'Select Event to Update' },
          submit: { type: 'plain_text', text: 'Search' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: buildSearchEventModalBlocks() as any[],
        },
      });
    } catch (error) {
      console.error('Error opening event search modal:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `❌ Error opening event search form: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });

  // Handle event search modal submission
  app.view('select_event_modal', async ({ ack, body, view, client }) => {
    const config = await readConfig();
    const values = view.state.values;

    const keyword = values.search_keyword?.keyword_input?.value || '';
    const startDateStr = values.start_date?.start_date_select?.selected_date;
    const endDateStr = values.end_date?.end_date_select?.selected_date;

    let timeMin: Date | undefined;
    let timeMax: Date | undefined;
    const timezone = config.timezone || 'America/Los_Angeles';

    if (startDateStr) {
      const [year, month, day] = startDateStr.split('-').map(Number);
      timeMin = createDateInTimezone(year, month, day, 0, 0, timezone);
    }

    if (endDateStr) {
      const [year, month, day] = endDateStr.split('-').map(Number);
      timeMax = createDateInTimezone(year, month, day, 23, 59, timezone);
    }

    try {
      const events = await searchEvents(
        config.calendarId!,
        keyword || undefined,
        20,
        timeMin,
        timeMax
      );

      if (events.length === 0) {
        await ack({
          response_action: 'errors',
          errors: { search_keyword: 'No events found matching your search criteria.' },
        });
        return;
      }

      await ack({
        response_action: 'update',
        view: {
          type: 'modal' as const,
          callback_id: 'select_event_result_modal',
          title: { type: 'plain_text', text: 'Select Event to Update' },
          submit: { type: 'plain_text', text: 'Select' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: buildEventSelectionBlocks(events) as any[],
        },
      });
    } catch (error) {
      console.error('Error searching events:', error);
      await ack({
        response_action: 'errors',
        errors: { search_keyword: `Error searching events: ${error instanceof Error ? error.message : String(error)}` },
      });
    }
  });

  // Handle event selection and open update form
  app.view('select_event_result_modal', async ({ ack, body, view, client }) => {
    const config = await readConfig();
    const values = view.state.values;
    const eventId = values.event_id?.event_select?.selected_option?.value;

    if (!eventId) {
      await ack({
        response_action: 'errors',
        errors: { event_id: 'Please select an event.' },
      });
      return;
    }

    try {
      const event = await getEventById(config.calendarId!, eventId);

      const eventDate = event.start.toISOString().split('T')[0];
      const startTime = event.start.toTimeString().slice(0, 5);
      const endTime = event.end.toTimeString().slice(0, 5);

      await ack({
        response_action: 'update',
        view: {
          type: 'modal' as const,
          callback_id: 'update_event_modal',
          private_metadata: eventId,
          title: { type: 'plain_text', text: 'Update Calendar Event' },
          submit: { type: 'plain_text', text: 'Update' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: buildUpdateEventModalBlocks(event, eventDate, startTime, endTime) as any[],
        },
      });
    } catch (error) {
      console.error('Error fetching event:', error);
      await ack({
        response_action: 'errors',
        errors: { event_id: `Error loading event: ${error instanceof Error ? error.message : String(error)}` },
      });
    }
  });

  // Handle create event modal submission
  app.view('create_event_modal', async ({ ack, body, view, client }) => {
    const config = await readConfig();
    const values = view.state.values;

    try {
      const title = values.title?.title_input?.value;
      const description = values.description?.description_input?.value;
      const dateStr = values.date?.date_select?.selected_date;
      const startTimeStr = values.start_time?.start_time_select?.selected_time;
      const endTimeStr = values.end_time?.end_time_select?.selected_time;
      const location = values.location?.location_input?.value;
      const recurrenceOption = values.recurrence?.recurrence_select?.selected_option?.value;

      if (!title || !dateStr || !startTimeStr || !endTimeStr) {
        const errors: Record<string, string> = {};
        if (!title) errors.title = 'Title is required.';
        if (!dateStr) errors.date = 'Date is required.';
        if (!startTimeStr) errors.start_time = 'Start time is required.';
        if (!endTimeStr) errors.end_time = 'End time is required.';
        await ack({ response_action: 'errors', errors });
        return;
      }

      const timezone = config.timezone || 'America/Los_Angeles';
      const [year, month, day] = dateStr.split('-').map(Number);
      const [startHour, startMinute] = startTimeStr.split(':').map(Number);
      const [endHour, endMinute] = endTimeStr.split(':').map(Number);

      const startDate = createDateInTimezone(year, month, day, startHour, startMinute, timezone);
      const endDate = createDateInTimezone(year, month, day, endHour, endMinute, timezone);

      if (endDate <= startDate) {
        await ack({
          response_action: 'errors',
          errors: { end_time: 'End time must be after start time.' },
        });
        return;
      }

      const eventData: CreateEventData = {
        summary: title,
        description: description || undefined,
        start: startDate,
        end: endDate,
        location: location || undefined,
      };

      const rrule = generateRrule(recurrenceOption || 'none', startDate);
      if (rrule) {
        eventData.recurrence = [rrule];
      }

      const createdEvent = await createCalendarEvent(config.calendarId!, eventData, config.timezone);

      const successView = buildSuccessModal(
        'Event Created',
        `Event "${createdEvent.summary}" has been created successfully!`,
        createdEvent.htmlLink
      );

      await ack({
        response_action: 'update',
        view: successView as any,
      });

      // Post announcement if event is in current week
      try {
        if (isEventInCurrentWeek(createdEvent.start, timezone)) {
          console.log(`Event "${createdEvent.summary}" is in current week, posting announcement`);
          postNewEventAnnouncement(app, createdEvent).catch(err => {
            console.error('Failed to post new event announcement:', err);
          });
        }
      } catch (error) {
        console.error('Error checking if event is in current week:', error);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      await ack({
        response_action: 'errors',
        errors: { title: `Failed to create event: ${error instanceof Error ? error.message : String(error)}` },
      });
    }
  });

  // Handle update event modal submission
  app.view('update_event_modal', async ({ ack, body, view, client }) => {
    const config = await readConfig();
    const values = view.state.values;
    const eventId = view.private_metadata;

    if (!eventId) {
      await ack({
        response_action: 'errors',
        errors: { title: 'Event ID is missing. Please try again.' },
      });
      return;
    }

    try {
      const title = values.title?.title_input?.value;
      const description = values.description?.description_input?.value;
      const dateStr = values.date?.date_select?.selected_date;
      const startTimeStr = values.start_time?.start_time_select?.selected_time;
      const endTimeStr = values.end_time?.end_time_select?.selected_time;
      const location = values.location?.location_input?.value;
      const recurrenceStr = values.recurrence?.recurrence_input?.value;

      if (!title || !dateStr || !startTimeStr || !endTimeStr) {
        const errors: Record<string, string> = {};
        if (!title) errors.title = 'Title is required.';
        if (!dateStr) errors.date = 'Date is required.';
        if (!startTimeStr) errors.start_time = 'Start time is required.';
        if (!endTimeStr) errors.end_time = 'End time is required.';
        await ack({ response_action: 'errors', errors });
        return;
      }

      const timezone = config.timezone || 'America/Los_Angeles';
      const [year, month, day] = dateStr.split('-').map(Number);
      const [startHour, startMinute] = startTimeStr.split(':').map(Number);
      const [endHour, endMinute] = endTimeStr.split(':').map(Number);

      const startDate = createDateInTimezone(year, month, day, startHour, startMinute, timezone);
      const endDate = createDateInTimezone(year, month, day, endHour, endMinute, timezone);

      if (endDate <= startDate) {
        await ack({
          response_action: 'errors',
          errors: { end_time: 'End time must be after start time.' },
        });
        return;
      }

      const eventData: UpdateEventData = {
        summary: title,
        description: description || undefined,
        start: startDate,
        end: endDate,
        location: location || undefined,
      };

      if (recurrenceStr && recurrenceStr.trim()) {
        eventData.recurrence = [recurrenceStr.trim()];
      }

      const updatedEvent = await updateCalendarEvent(config.calendarId!, eventId, eventData, config.timezone);

      const successView = buildSuccessModal(
        'Event Updated',
        `Event "${updatedEvent.summary}" has been updated successfully!`,
        updatedEvent.htmlLink
      );

      await ack({
        response_action: 'update',
        view: successView as any,
      });
    } catch (error) {
      console.error('Error updating event:', error);
      await ack({
        response_action: 'errors',
        errors: { title: `Failed to update event: ${error instanceof Error ? error.message : String(error)}` },
      });
    }
  });
}
