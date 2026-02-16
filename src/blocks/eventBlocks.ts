/**
 * Shared Slack Block Kit builders for event-related messages
 * Used by announcements, reminders, calendar views, and meeting start notifications
 */

import { CalendarEvent, formatEventTime, formatEventDate } from '../calendar';
import { SlackBlock, SectionBlock, ActionsBlock, DividerBlock, HeaderBlock } from './types';
import { htmlToMrkdwn } from '../utils/htmlToMrkdwn';

export interface AttendanceData {
  attending: string[];
  notAttending: string[];
}

export interface EventDisplayOptions {
  /** Show the date in the event text (default: false, used for single-day views) */
  showDate?: boolean;
  /** Prefix for the event title (e.g., "🔔 " for reminders) */
  titlePrefix?: string;
  /** Show detailed attendance with bullet points (default: false, inline list) */
  detailedAttendance?: boolean;
}

/**
 * Build attendance text showing who is attending/not attending
 */
export function buildAttendanceText(
  attending: string[],
  notAttending: string[],
  detailed: boolean = false
): string {
  let text = '';

  if (detailed) {
    // Detailed format with bullet points (for calendar/today views)
    if (attending.length > 0) {
      text += `\n✅ *Attending (${attending.length}):*\n`;
      attending.forEach(name => {
        text += `  • ${name}\n`;
      });
    } else {
      text += `\n✅ *Attending:* _No one yet_\n`;
    }

    if (notAttending.length > 0) {
      text += `\n❌ *Not Attending (${notAttending.length}):*\n`;
      notAttending.forEach(name => {
        text += `  • ${name}\n`;
      });
    }
  } else {
    // Inline format (for announcements/reminders)
    if (attending.length > 0) {
      text += `\n✅ *Attending:* ${attending.join(', ')}`;
    } else {
      text += `\n✅ *Attending:* _No one yet_`;
    }

    if (notAttending.length > 0) {
      text += `\n❌ *Not Attending:* ${notAttending.join(', ')}`;
    }
  }

  return text;
}

/**
 * Build the event text content (title, time, location, description, attendance)
 */
export function buildEventText(
  event: CalendarEvent,
  attendance: AttendanceData,
  timezone: string | undefined,
  options: EventDisplayOptions = {}
): string {
  const { showDate = false, titlePrefix = '', detailedAttendance = false } = options;
  const timeStr = formatEventTime(event, timezone);
  const locationStr = event.location ? `📍 ${event.location}` : '';

  let eventText = `${titlePrefix}*${event.summary}*\n`;
  
  if (showDate) {
    const dateStr = formatEventDate(event, timezone);
    eventText += `📅 ${dateStr}\n`;
  }
  
  eventText += `🕐 ${timeStr}\n`;
  
  if (locationStr) {
    eventText += `${locationStr}\n`;
  }
  
  if (event.description) {
    eventText += `\n${htmlToMrkdwn(event.description)}\n`;
  }

  eventText += buildAttendanceText(attendance.attending, attendance.notAttending, detailedAttendance);

  return eventText;
}

/**
 * Build a section block with event information
 */
export function buildEventSection(
  event: CalendarEvent,
  attendance: AttendanceData,
  timezone: string | undefined,
  options: EventDisplayOptions = {}
): SectionBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: buildEventText(event, attendance, timezone, options),
    },
  };
}

/**
 * Build attendance action buttons (Attending / Not Attending)
 */
export function buildAttendanceButtons(attendanceKey: string): ActionsBlock {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Attending',
          emoji: true,
        },
        action_id: 'attending',
        value: attendanceKey,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '❌ Not Attending',
          emoji: true,
        },
        action_id: 'not_attending',
        value: attendanceKey,
      },
    ],
  };
}

/**
 * Build "Not Attending Any" button for batch operations
 */
export function buildNotAttendingAnyButton(allAttendanceKeys: string[]): ActionsBlock {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '❌ Not Attending Any',
          emoji: true,
        },
        action_id: 'not_attending_any',
        value: allAttendanceKeys.join(','),
        style: 'danger',
      },
    ],
  };
}

/**
 * Build "Attending All" button for batch operations
 */
export function buildAttendingAllButton(allAttendanceKeys: string[]): ActionsBlock {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Attending All',
          emoji: true,
        },
        action_id: 'attending_all',
        value: allAttendanceKeys.join(','),
        style: 'primary',
      },
    ],
  };
}

/**
 * Build a complete event block with section, buttons, and divider
 */
export function buildEventWithButtons(
  event: CalendarEvent,
  attendanceKey: string,
  attendance: AttendanceData,
  timezone: string | undefined,
  options: EventDisplayOptions = {}
): SlackBlock[] {
  return [
    buildEventSection(event, attendance, timezone, options),
    buildAttendanceButtons(attendanceKey),
    { type: 'divider' } as DividerBlock,
  ];
}

/**
 * Build a date header block
 */
export function buildDateHeader(dateStr: string): HeaderBlock {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: dateStr,
    },
  };
}

/**
 * Build a divider block
 */
export function buildDivider(): DividerBlock {
  return { type: 'divider' };
}

/**
 * Build an intro section block with markdown text
 */
export function buildIntroSection(text: string): SectionBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text,
    },
  };
}



