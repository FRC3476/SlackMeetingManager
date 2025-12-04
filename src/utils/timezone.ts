import { DateTime } from 'luxon';

/**
 * Convert a scheduled time in a specific timezone to UTC for cron scheduling.
 * This ensures cron jobs fire at the correct local time regardless of server timezone.
 * 
 * @param hours - Hour in 24-hour format (0-23) in the target timezone
 * @param minutes - Minutes (0-59)
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @param dayOfWeek - Optional day of week (0-6, Sunday = 0) for weekly schedules
 * @returns Object with UTC hours, minutes, and optionally adjusted dayOfWeek
 */
export function convertScheduleToUTC(
  hours: number,
  minutes: number,
  timezone: string,
  dayOfWeek?: number
): { hours: number; minutes: number; dayOfWeek?: number } {
  // Create a DateTime representing the scheduled time in the target timezone
  let scheduledTime: DateTime;
  
  if (dayOfWeek !== undefined) {
    // When dayOfWeek is specified, we need to use that specific day for accurate conversion
    // Find the next occurrence of that day of week (cron format: 0-6, Sunday = 0)
    const now = DateTime.now().setZone(timezone);
    
    // Convert cron day (0-6, Sunday=0) to Luxon weekday (1-7, Monday=1)
    // Cron: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // Luxon: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    const luxonWeekday = (dayOfWeek === 0 ? 7 : dayOfWeek) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    
    // Find the next occurrence of this weekday (or today if it's the same day)
    let targetDate = now.set({ weekday: luxonWeekday });
    
    // If we went backwards in time, add a week to get the next occurrence
    if (targetDate < now) {
      targetDate = targetDate.plus({ weeks: 1 });
    }
    
    // Set the time
    scheduledTime = targetDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
  } else {
    // For non-weekly schedules (daily, etc.), use today
    const now = DateTime.now().setZone(timezone);
    scheduledTime = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
  }
  
  // Convert to UTC
  const utcTime = scheduledTime.toUTC();
  
  const result: { hours: number; minutes: number; dayOfWeek?: number } = {
    hours: utcTime.hour,
    minutes: utcTime.minute,
  };
  
  // If a day of week was specified, return the UTC day of week
  if (dayOfWeek !== undefined) {
    // Convert Luxon weekday to cron format
    const cronDay = utcTime.weekday % 7; // 0 = Sunday in cron
    result.dayOfWeek = cronDay;
  }
  
  return result;
}

/**
 * Get the current time in a specific timezone as a Luxon DateTime object.
 * 
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns DateTime object in the specified timezone
 */
export function getCurrentTimeInZone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
}

/**
 * Format a Date object for logging, showing both the time in a specific timezone and UTC.
 * Useful for debugging timezone-related issues.
 * 
 * @param date - JavaScript Date object to format
 * @param timezone - IANA timezone string for the local time display
 * @returns Formatted string like "2024-01-15 09:00:00 PST (17:00:00 UTC)"
 */
export function formatTimeForLogging(date: Date, timezone: string): string {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  const utcDt = dt.toUTC();
  
  const localStr = dt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
  const utcStr = utcDt.toFormat('HH:mm:ss');
  
  return `${localStr} (${utcStr} UTC)`;
}

/**
 * Get the start and end of day in a specific timezone.
 * Returns JavaScript Date objects representing midnight and end of day in that timezone.
 * 
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns Object with start, end, and today Date objects
 */
export function getDayBoundsInTimezone(timezone: string): { start: Date; end: Date; today: Date } {
  const now = DateTime.now().setZone(timezone);
  const startOfDay = now.startOf('day');
  const endOfDay = now.endOf('day');
  
  return {
    start: startOfDay.toJSDate(),
    end: endOfDay.toJSDate(),
    today: startOfDay.toJSDate(),
  };
}

/**
 * Create a Date object from date and time components in a specific timezone.
 * This is useful when parsing user input that represents a time in their local timezone.
 * 
 * @param year - Full year (e.g., 2024)
 * @param month - Month (1-12, NOT 0-11 like JavaScript Date)
 * @param day - Day of month (1-31)
 * @param hour - Hour in 24-hour format (0-23)
 * @param minute - Minutes (0-59)
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns JavaScript Date object representing that time
 */
export function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: timezone }
  );
  return dt.toJSDate();
}

/**
 * Get week boundaries (start and end) in a specific timezone, with optional offset.
 * 
 * @param timezone - IANA timezone string
 * @param weekOffset - Number of weeks to offset (0 = this week, 1 = next week, -1 = last week)
 * @returns Object with start and end Date objects for the week
 */
export function getWeekBoundsInTimezone(
  timezone: string,
  weekOffset: number = 0
): { start: Date; end: Date } {
  const now = DateTime.now().setZone(timezone);
  const targetWeek = now.plus({ weeks: weekOffset });
  const startOfWeek = targetWeek.startOf('week'); // Monday
  const endOfWeek = startOfWeek.plus({ days: 7 });
  
  return {
    start: startOfWeek.toJSDate(),
    end: endOfWeek.toJSDate(),
  };
}

/**
 * Check if an event date falls within the current week (Monday-Sunday) in a specific timezone.
 * 
 * @param eventDate - The event's start date to check
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns true if the event falls within the current week (Monday 00:00 to Sunday 23:59:59)
 */
export function isEventInCurrentWeek(eventDate: Date, timezone: string): boolean {
  const { start: weekStart, end: weekEnd } = getWeekBoundsInTimezone(timezone, 0);
  const eventDateTime = DateTime.fromJSDate(eventDate).setZone(timezone);
  const weekStartDateTime = DateTime.fromJSDate(weekStart).setZone(timezone);
  const weekEndDateTime = DateTime.fromJSDate(weekEnd).setZone(timezone);
  
  return eventDateTime >= weekStartDateTime && eventDateTime < weekEndDateTime;
}
