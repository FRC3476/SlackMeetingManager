import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { DateTime } from 'luxon';
import { getDayBoundsInTimezone as getDayBoundsLuxon } from './utils/timezone';

export interface CalendarEvent {
  id: string;
  recurringEventId?: string;  // Base recurring event ID (for recurring event instances)
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  htmlLink?: string;
}

let auth: any = null;
let serviceAccountEmail: string | null = null;

// Initialize Google Calendar authentication
export async function initializeCalendarAuth(): Promise<void> {
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'config/service-account.json';
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    // Use JSON from environment variable (Cloud Run)
    const credentials = JSON.parse(serviceAccountJson);
    serviceAccountEmail = credentials.client_email || null;
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  } else if (fs.existsSync(serviceAccountPath)) {
    // Use JSON file (local development)
    const serviceAccountData = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    serviceAccountEmail = serviceAccountData.client_email || null;
    auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  } else {
    // Try to use default credentials (Cloud Run service account)
    auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }
}

// Get calendar service
function getCalendarService() {
  if (!auth) {
    throw new Error('Calendar auth not initialized. Call initializeCalendarAuth() first.');
  }
  return google.calendar({ version: 'v3', auth });
}

// Verify calendar access and permissions
export async function verifyCalendarAccess(calendarId: string): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    const calendar = getCalendarService();
    // Try to get calendar metadata to verify access
    await calendar.calendars.get({
      calendarId,
    });
    return { hasAccess: true };
  } catch (error: any) {
    console.error('Calendar access verification failed:', error);
    if (error.code === 403) {
      return { 
        hasAccess: false, 
        error: `Permission denied. Service account needs "Make changes to events" or "Make changes AND manage sharing" permission on calendar "${calendarId}".` 
      };
    } else if (error.code === 404) {
      return { 
        hasAccess: false, 
        error: `Calendar not found: "${calendarId}". Please verify the calendar ID is correct.` 
      };
    }
    return { 
      hasAccess: false, 
      error: error.message || 'Unknown error verifying calendar access' 
    };
  }
}

// Fetch events from calendar
export async function fetchWeeklyEvents(
  calendarId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CalendarEvent[]> {
  const calendar = getCalendarService();
  const timeMin = startDate || new Date();
  const timeMax = endDate || new Date(timeMin.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events: CalendarEvent[] = (response.data.items || []).map((event: any) => ({
      id: event.id || '',
      recurringEventId: event.recurringEventId || undefined,
      summary: event.summary || 'Untitled Event',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      htmlLink: event.htmlLink || undefined,
    }));

    return events;
  } catch (error) {
    console.error('Error fetching weekly events:', error);
    throw error;
  }
}

// Helper function to get start and end of day in a specific timezone
// Now uses Luxon for reliable timezone handling
function getDayBoundsInTimezone(timezone: string = 'UTC'): { start: Date; end: Date; today: Date } {
  return getDayBoundsLuxon(timezone);
}

// Fetch today's events
export async function fetchTodaysEvents(calendarId: string, timezone?: string): Promise<CalendarEvent[]> {
  const calendar = getCalendarService();
  const tz = timezone || 'UTC';
  
  // Get start and end of today in the specified timezone
  const { start: startOfDay, end: endOfDay, today } = getDayBoundsInTimezone(tz);
  
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  console.log(`Fetching today's events (timezone: ${tz})`);
  console.log(`  Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events: CalendarEvent[] = (response.data.items || []).map((event: any) => ({
      id: event.id || '',
      recurringEventId: event.recurringEventId || undefined,
      summary: event.summary || 'Untitled Event',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      htmlLink: event.htmlLink || undefined,
    }));

    // Filter to only events that are actually today in the target timezone
    const todayEvents = events.filter(event => {
      // Format event start date in the target timezone
      const eventFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const eventParts = eventFormatter.formatToParts(event.start);
      const eventYear = parseInt(eventParts.find(p => p.type === 'year')!.value);
      const eventMonth = parseInt(eventParts.find(p => p.type === 'month')!.value) - 1;
      const eventDay = parseInt(eventParts.find(p => p.type === 'day')!.value);
      
      return eventYear === todayYear && eventMonth === todayMonth && eventDay === todayDate;
    });

    console.log(`  Found ${events.length} events in API response, ${todayEvents.length} are actually today`);
    
    return todayEvents;
  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    throw error;
  }
}

// Fetch tomorrow's events
export async function fetchTomorrowsEvents(calendarId: string, timezone?: string): Promise<CalendarEvent[]> {
  const calendar = getCalendarService();
  const tz = timezone || 'UTC';
  
  // Get start and end of tomorrow in the specified timezone
  const now = DateTime.now().setZone(tz);
  const tomorrow = now.plus({ days: 1 });
  const startOfTomorrow = tomorrow.startOf('day');
  const endOfTomorrow = tomorrow.endOf('day');
  
  const tomorrowYear = startOfTomorrow.year;
  const tomorrowMonth = startOfTomorrow.month - 1; // Convert to 0-based for comparison
  const tomorrowDate = startOfTomorrow.day;

  console.log(`Fetching tomorrow's events (timezone: ${tz})`);
  console.log(`  Date range: ${startOfTomorrow.toJSDate().toISOString()} to ${endOfTomorrow.toJSDate().toISOString()}`);

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: startOfTomorrow.toJSDate().toISOString(),
      timeMax: endOfTomorrow.toJSDate().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events: CalendarEvent[] = (response.data.items || []).map((event: any) => ({
      id: event.id || '',
      recurringEventId: event.recurringEventId || undefined,
      summary: event.summary || 'Untitled Event',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      htmlLink: event.htmlLink || undefined,
    }));

    // Filter to only events that are actually tomorrow in the target timezone
    const tomorrowEvents = events.filter(event => {
      // Format event start date in the target timezone
      const eventFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const eventParts = eventFormatter.formatToParts(event.start);
      const eventYear = parseInt(eventParts.find(p => p.type === 'year')!.value);
      const eventMonth = parseInt(eventParts.find(p => p.type === 'month')!.value) - 1;
      const eventDay = parseInt(eventParts.find(p => p.type === 'day')!.value);
      
      return eventYear === tomorrowYear && eventMonth === tomorrowMonth && eventDay === tomorrowDate;
    });

    console.log(`  Found ${events.length} events in API response, ${tomorrowEvents.length} are actually tomorrow`);
    
    return tomorrowEvents;
  } catch (error) {
    console.error('Error fetching tomorrow\'s events:', error);
    throw error;
  }
}

// Format event for display
export function formatEventTime(event: CalendarEvent, timezone?: string): string {
  const start = event.start;
  const end = event.end;
  
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timezone && { timeZone: timezone }),
  };
  
  const startStr = start.toLocaleTimeString('en-US', options);
  const endStr = end.toLocaleTimeString('en-US', options);
  
  return `${startStr} - ${endStr}`;
}

export function formatEventDate(event: CalendarEvent, timezone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(timezone && { timeZone: timezone }),
  };
  
  return event.start.toLocaleDateString('en-US', options);
}

// Helper function to format date in a specific timezone
function formatDateTimeInTimezone(date: Date, timezone: string): string {
  // Convert to the specified timezone and format as YYYY-MM-DDTHH:mm:ss
  // The timezone parameter tells Google Calendar what timezone this represents
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.toFormat("yyyy-MM-dd'T'HH:mm:ss");
}

// Create a new calendar event
export interface CreateEventData {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  recurrence?: string[];
}

export async function createCalendarEvent(
  calendarId: string,
  eventData: CreateEventData,
  timezone?: string
): Promise<CalendarEvent> {
  const calendar = getCalendarService();

  const tz = timezone || 'UTC';
  const event: any = {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: formatDateTimeInTimezone(eventData.start, tz),
      timeZone: tz,
    },
    end: {
      dateTime: formatDateTimeInTimezone(eventData.end, tz),
      timeZone: tz,
    },
  };

  if (eventData.location) {
    event.location = eventData.location;
  }

  if (eventData.recurrence && eventData.recurrence.length > 0) {
    event.recurrence = eventData.recurrence;
  }

  try {
    // For resource calendars, we may need to use sendUpdates parameter
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      sendUpdates: 'none', // Don't send email notifications
      conferenceDataVersion: 0,
    });

    const createdEvent = response.data;
    return {
      id: createdEvent.id || '',
      recurringEventId: (createdEvent as any).recurringEventId || undefined,
      summary: createdEvent.summary || 'Untitled Event',
      description: createdEvent.description || undefined,
      start: new Date(createdEvent.start?.dateTime || createdEvent.start?.date || ''),
      end: new Date(createdEvent.end?.dateTime || createdEvent.end?.date || ''),
      location: createdEvent.location || undefined,
      htmlLink: createdEvent.htmlLink || undefined,
    };
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    console.error('Calendar ID:', calendarId);
    console.error('Error details:', JSON.stringify(error.response?.data || error.message, null, 2));
    
    // Provide more helpful error messages
    if (error.code === 403) {
      const accountEmail = serviceAccountEmail || auth?.credentials?.client_email || 'service account';
      throw new Error(`Permission denied. Please ensure the service account (${accountEmail}) has "Make changes to events" permission on calendar "${calendarId}". For resource calendars, try "Make changes AND manage sharing" permission.`);
    } else if (error.code === 404) {
      throw new Error(`Calendar not found: "${calendarId}". Please verify the calendar ID is correct.`);
    }
    
    throw error;
  }
}

// Update an existing calendar event
export interface UpdateEventData {
  summary?: string;
  description?: string;
  start?: Date;
  end?: Date;
  location?: string;
  recurrence?: string[];
}

export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  eventData: UpdateEventData,
  timezone?: string
): Promise<CalendarEvent> {
  const calendar = getCalendarService();

  // First, get the existing event to preserve fields not being updated
  const existingEvent = await getEventById(calendarId, eventId);

  const tz = timezone || 'UTC';
  const event: any = {
    summary: eventData.summary !== undefined ? eventData.summary : existingEvent.summary,
    description: eventData.description !== undefined ? eventData.description : existingEvent.description,
    start: {
      dateTime: formatDateTimeInTimezone(eventData.start || existingEvent.start, tz),
      timeZone: tz,
    },
    end: {
      dateTime: formatDateTimeInTimezone(eventData.end || existingEvent.end, tz),
      timeZone: tz,
    },
  };

  if (eventData.location !== undefined) {
    event.location = eventData.location;
  } else if (existingEvent.location) {
    event.location = existingEvent.location;
  }

  if (eventData.recurrence !== undefined) {
    event.recurrence = eventData.recurrence;
  }

  try {
    const response = await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });

    const updatedEvent = response.data;
    return {
      id: updatedEvent.id || '',
      recurringEventId: (updatedEvent as any).recurringEventId || undefined,
      summary: updatedEvent.summary || 'Untitled Event',
      description: updatedEvent.description || undefined,
      start: new Date(updatedEvent.start?.dateTime || updatedEvent.start?.date || ''),
      end: new Date(updatedEvent.end?.dateTime || updatedEvent.end?.date || ''),
      location: updatedEvent.location || undefined,
      htmlLink: updatedEvent.htmlLink || undefined,
    };
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
}

// Get a single event by ID
export async function getEventById(calendarId: string, eventId: string): Promise<CalendarEvent> {
  const calendar = getCalendarService();

  try {
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    const event = response.data;
    return {
      id: event.id || '',
      recurringEventId: (event as any).recurringEventId || undefined,
      summary: event.summary || 'Untitled Event',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      htmlLink: event.htmlLink || undefined,
    };
  } catch (error) {
    console.error('Error fetching event by ID:', error);
    throw error;
  }
}

// Search events by query and date range
export async function searchEvents(
  calendarId: string,
  query?: string,
  maxResults: number = 20,
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  const calendar = getCalendarService();

  const params: any = {
    calendarId,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  };

  if (query) {
    params.q = query;
  }

  if (timeMin) {
    params.timeMin = timeMin.toISOString();
  } else {
    params.timeMin = new Date().toISOString();
  }

  if (timeMax) {
    params.timeMax = timeMax.toISOString();
  }

  try {
    const response = await calendar.events.list(params);

    const events: CalendarEvent[] = (response.data.items || []).map((event: any) => ({
      id: event.id || '',
      recurringEventId: event.recurringEventId || undefined,
      summary: event.summary || 'Untitled Event',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      htmlLink: event.htmlLink || undefined,
    }));

    return events;
  } catch (error) {
    console.error('Error searching events:', error);
    throw error;
  }
}

