/**
 * Event service - fetches calendar events with attendance data
 * Consolidates the repeated pattern of fetching events and their attendees
 */

import { CalendarEvent } from '../calendar';
import { getAttendees, getAttendanceKey } from '../attendance';
import { getUserCache } from '../userCache';
import { EventWithAttendance } from '../blocks/types';

/**
 * Fetch attendance data for a list of events in parallel
 * Returns events enriched with attendance information
 */
export async function fetchEventsWithAttendance(
  events: CalendarEvent[],
  timezone: string | undefined
): Promise<EventWithAttendance[]> {
  const userCache = getUserCache();
  
  // Generate attendance keys for all events
  const attendanceKeys = events.map(event => getAttendanceKey(event, timezone));
  
  // Fetch all attendees in parallel
  const attendeePromises = attendanceKeys.map(key => getAttendees(key, userCache));
  const allAttendees = await Promise.all(attendeePromises);
  
  // Combine events with their attendance data
  return events.map((event, index) => ({
    event,
    attendanceKey: attendanceKeys[index],
    attending: allAttendees[index].attending,
    notAttending: allAttendees[index].notAttending,
  }));
}

/**
 * Fetch attendance data for a single event
 */
export async function fetchEventWithAttendance(
  event: CalendarEvent,
  timezone: string | undefined
): Promise<EventWithAttendance> {
  const userCache = getUserCache();
  const attendanceKey = getAttendanceKey(event, timezone);
  const { attending, notAttending } = await getAttendees(attendanceKey, userCache);
  
  return {
    event,
    attendanceKey,
    attending,
    notAttending,
  };
}

/**
 * Group events by date (using the event's start date string)
 */
export function groupEventsByDate(
  eventsWithAttendance: EventWithAttendance[]
): Map<string, EventWithAttendance[]> {
  const eventsByDate = new Map<string, EventWithAttendance[]>();
  
  for (const eventData of eventsWithAttendance) {
    const dateKey = eventData.event.start.toDateString();
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(eventData);
  }
  
  return eventsByDate;
}

/**
 * Get sorted date keys from grouped events
 */
export function getSortedDateKeys(eventsByDate: Map<string, EventWithAttendance[]>): string[] {
  return Array.from(eventsByDate.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
}



