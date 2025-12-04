/**
 * Shared modal block builders for event creation and configuration
 */

import { SlackBlock, InputBlock, ModalView, SelectOption } from './types';
import { CalendarEvent } from '../calendar';

/**
 * Build blocks for the create event modal
 */
export function buildCreateEventModalBlocks(): SlackBlock[] {
  return [
    {
      type: 'input',
      block_id: 'title',
      element: {
        type: 'plain_text_input',
        placeholder: { type: 'plain_text', text: 'Event title' },
        action_id: 'title_input',
      },
      label: { type: 'plain_text', text: 'Event Title' },
    },
    {
      type: 'input',
      block_id: 'description',
      element: {
        type: 'plain_text_input',
        multiline: true,
        placeholder: { type: 'plain_text', text: 'Event description' },
        action_id: 'description_input',
      },
      label: { type: 'plain_text', text: 'Description' },
      optional: true,
    },
    {
      type: 'input',
      block_id: 'date',
      element: {
        type: 'datepicker',
        placeholder: { type: 'plain_text', text: 'Select a date' },
        action_id: 'date_select',
      },
      label: { type: 'plain_text', text: 'Date' },
    },
    {
      type: 'input',
      block_id: 'start_time',
      element: {
        type: 'timepicker',
        placeholder: { type: 'plain_text', text: 'Select start time' },
        action_id: 'start_time_select',
      },
      label: { type: 'plain_text', text: 'Start Time' },
      hint: { type: 'plain_text', text: 'Type time directly (e.g., 09:30, 14:45) or use the picker' },
    },
    {
      type: 'input',
      block_id: 'end_time',
      element: {
        type: 'timepicker',
        placeholder: { type: 'plain_text', text: 'Select end time' },
        action_id: 'end_time_select',
      },
      label: { type: 'plain_text', text: 'End Time' },
      hint: { type: 'plain_text', text: 'Type time directly (e.g., 10:30, 15:45) or use the picker' },
    },
    {
      type: 'input',
      block_id: 'location',
      element: {
        type: 'plain_text_input',
        placeholder: { type: 'plain_text', text: 'Event location' },
        action_id: 'location_input',
      },
      label: { type: 'plain_text', text: 'Location' },
      optional: true,
    },
    buildRecurrenceSelectBlock(),
  ] as InputBlock[];
}

/**
 * Build blocks for the update event modal with pre-filled values
 */
export function buildUpdateEventModalBlocks(
  event: CalendarEvent,
  eventDate: string,
  startTime: string,
  endTime: string
): SlackBlock[] {
  return [
    {
      type: 'input',
      block_id: 'title',
      element: {
        type: 'plain_text_input',
        initial_value: event.summary,
        placeholder: { type: 'plain_text', text: 'Event title' },
        action_id: 'title_input',
      },
      label: { type: 'plain_text', text: 'Event Title' },
    },
    {
      type: 'input',
      block_id: 'description',
      element: {
        type: 'plain_text_input',
        multiline: true,
        initial_value: event.description || '',
        placeholder: { type: 'plain_text', text: 'Event description' },
        action_id: 'description_input',
      },
      label: { type: 'plain_text', text: 'Description' },
      optional: true,
    },
    {
      type: 'input',
      block_id: 'date',
      element: {
        type: 'datepicker',
        initial_date: eventDate,
        placeholder: { type: 'plain_text', text: 'Select a date' },
        action_id: 'date_select',
      },
      label: { type: 'plain_text', text: 'Date' },
    },
    {
      type: 'input',
      block_id: 'start_time',
      element: {
        type: 'timepicker',
        initial_time: startTime,
        placeholder: { type: 'plain_text', text: 'Select start time' },
        action_id: 'start_time_select',
      },
      label: { type: 'plain_text', text: 'Start Time' },
      hint: { type: 'plain_text', text: 'Type time directly (e.g., 09:30, 14:45) or use the picker' },
    },
    {
      type: 'input',
      block_id: 'end_time',
      element: {
        type: 'timepicker',
        initial_time: endTime,
        placeholder: { type: 'plain_text', text: 'Select end time' },
        action_id: 'end_time_select',
      },
      label: { type: 'plain_text', text: 'End Time' },
      hint: { type: 'plain_text', text: 'Type time directly (e.g., 10:30, 15:45) or use the picker' },
    },
    {
      type: 'input',
      block_id: 'location',
      element: {
        type: 'plain_text_input',
        initial_value: event.location || '',
        placeholder: { type: 'plain_text', text: 'Event location' },
        action_id: 'location_input',
      },
      label: { type: 'plain_text', text: 'Location' },
      optional: true,
    },
    {
      type: 'input',
      block_id: 'recurrence',
      element: {
        type: 'plain_text_input',
        placeholder: { type: 'plain_text', text: 'RRULE format (e.g., RRULE:FREQ=DAILY;COUNT=5)' },
        action_id: 'recurrence_input',
      },
      label: { type: 'plain_text', text: 'Recurrence (RRULE format)' },
      hint: { type: 'plain_text', text: 'Optional. Use RRULE format for recurring events. Leave empty to remove recurrence.' },
      optional: true,
    },
  ] as InputBlock[];
}

/**
 * Build blocks for the event search modal
 */
export function buildSearchEventModalBlocks(): SlackBlock[] {
  return [
    {
      type: 'input',
      block_id: 'search_keyword',
      element: {
        type: 'plain_text_input',
        placeholder: { type: 'plain_text', text: 'Search by event title' },
        action_id: 'keyword_input',
      },
      label: { type: 'plain_text', text: 'Search Keyword' },
      optional: true,
    },
    {
      type: 'input',
      block_id: 'start_date',
      element: {
        type: 'datepicker',
        placeholder: { type: 'plain_text', text: 'Start date' },
        action_id: 'start_date_select',
      },
      label: { type: 'plain_text', text: 'Start Date' },
      optional: true,
    },
    {
      type: 'input',
      block_id: 'end_date',
      element: {
        type: 'datepicker',
        placeholder: { type: 'plain_text', text: 'End date' },
        action_id: 'end_date_select',
      },
      label: { type: 'plain_text', text: 'End Date' },
      optional: true,
    },
  ] as InputBlock[];
}

/**
 * Build recurrence select block with standard options
 */
function buildRecurrenceSelectBlock(): InputBlock {
  const recurrenceOptions: SelectOption[] = [
    { text: { type: 'plain_text', text: 'Does not repeat' }, value: 'none' },
    { text: { type: 'plain_text', text: 'Daily' }, value: 'daily' },
    { text: { type: 'plain_text', text: 'Weekly on this day' }, value: 'weekly' },
    { text: { type: 'plain_text', text: 'Monthly on this weekday' }, value: 'monthly_weekday' },
    { text: { type: 'plain_text', text: 'Monthly on this date' }, value: 'monthly_date' },
    { text: { type: 'plain_text', text: 'Annually on this date' }, value: 'yearly' },
    { text: { type: 'plain_text', text: 'Every weekday (Mon-Fri)' }, value: 'weekday' },
  ];

  return {
    type: 'input',
    block_id: 'recurrence',
    element: {
      type: 'static_select',
      placeholder: { type: 'plain_text', text: 'Select recurrence' },
      action_id: 'recurrence_select',
      initial_option: recurrenceOptions[0],
      options: recurrenceOptions,
    },
    label: { type: 'plain_text', text: 'Recurrence' },
    optional: true,
  };
}

/**
 * Build event selection modal blocks (after search)
 */
export function buildEventSelectionBlocks(events: CalendarEvent[]): SlackBlock[] {
  const eventOptions: SelectOption[] = events.map((event) => ({
    text: {
      type: 'plain_text',
      text: `${event.summary} - ${event.start.toLocaleDateString()} ${event.start.toLocaleTimeString()}`,
    },
    value: event.id,
  }));

  return [
    {
      type: 'input',
      block_id: 'event_id',
      element: {
        type: 'static_select',
        placeholder: { type: 'plain_text', text: 'Select an event' },
        options: eventOptions,
        action_id: 'event_select',
      },
      label: { type: 'plain_text', text: 'Event' },
    },
  ] as InputBlock[];
}

/**
 * Build a success result modal view
 */
export function buildSuccessModal(
  title: string,
  message: string,
  htmlLink?: string
): ModalView {
  let text = `✅ ${message}`;
  if (htmlLink) {
    text += `\n<${htmlLink}|View in Google Calendar>`;
  }

  return {
    type: 'modal',
    callback_id: 'success_modal',
    title: { type: 'plain_text', text: title },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ],
  };
}


