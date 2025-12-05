/**
 * Time Range Converter
 * 
 * Converts time ranges (decade, year, month, week, day) between different calendar systems.
 * Handles the fact that different calendars have different structures.
 */

import { CalendarSystem, CalendarDate, CALENDAR_INFO } from './types';
import { convertDate, dateToCalendarDate, calendarDateToDate, formatCalendarDate } from './calendarConverter';
import { dateToJDN, jdnToDate } from './julianDayUtils';
import { getWeekStart, getWeekEnd, getMonthStart, getMonthEnd, getYearStart, getYearEnd, getDecadeStart, getDecadeEnd } from '../dateUtils';
import { addDays, addWeeks, addMonths, addYears, getYear } from 'date-fns';

export interface TimeRangeBounds {
  start: CalendarDate;
  end: CalendarDate;
  startDate: Date;
  endDate: Date;
}

/**
 * Get the equivalent time range bounds in a target calendar
 * @param date Date in source calendar
 * @param timeRange Time range type
 * @param targetCalendar Target calendar system
 * @returns Bounds of the time range in target calendar
 */
export function getTimeRangeBoundsInCalendar(
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day',
  targetCalendar: CalendarSystem
): TimeRangeBounds {
  // First, get the bounds in Gregorian (our reference)
  let startDate: Date;
  let endDate: Date;

  switch (timeRange) {
    case 'decade':
      startDate = getDecadeStart(date);
      endDate = getDecadeEnd(date);
      break;
    case 'year':
      startDate = getYearStart(date);
      endDate = getYearEnd(date);
      break;
    case 'month':
      startDate = getMonthStart(date);
      endDate = getMonthEnd(date);
      break;
    case 'week':
      startDate = getWeekStart(date);
      endDate = getWeekEnd(date);
      break;
    case 'day':
      startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      endDate.setHours(23, 59, 59, 999);
      break;
  }

  // Convert bounds to target calendar
  const startCalendar = dateToCalendarDate(startDate, targetCalendar);
  const endCalendar = dateToCalendarDate(endDate, targetCalendar);

  return {
    start: startCalendar,
    end: endCalendar,
    startDate,
    endDate,
  };
}

/**
 * Get canonical date for a time range in a specific calendar
 * @param date Date in source calendar
 * @param timeRange Time range type
 * @param targetCalendar Target calendar system
 * @returns Canonical date in target calendar
 */
export function getCanonicalDateInCalendar(
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day',
  targetCalendar: CalendarSystem
): CalendarDate {
  // Get the canonical date in Gregorian first
  let canonicalDate: Date;

  switch (timeRange) {
    case 'decade':
      canonicalDate = getDecadeStart(date);
      break;
    case 'year':
      canonicalDate = getYearStart(date);
      break;
    case 'month':
      canonicalDate = getMonthStart(date);
      break;
    case 'week':
      canonicalDate = getWeekStart(date);
      break;
    case 'day':
      canonicalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      break;
  }

  // Convert to target calendar
  return dateToCalendarDate(canonicalDate, targetCalendar);
}

/**
 * Navigate to next/previous period in a calendar
 * @param date Current date
 * @param timeRange Time range type
 * @param direction 'next' or 'prev'
 * @param calendar Calendar system
 * @returns New date after navigation
 */
export function navigateInCalendar(
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day',
  direction: 'next' | 'prev',
  calendar: CalendarSystem
): Date {
  const multiplier = direction === 'next' ? 1 : -1;
  let newDate: Date;

  switch (timeRange) {
    case 'decade':
      newDate = addYears(date, multiplier * 10);
      break;
    case 'year':
      newDate = addYears(date, multiplier);
      break;
    case 'month':
      newDate = addMonths(date, multiplier);
      break;
    case 'week':
      newDate = addWeeks(date, multiplier);
      break;
    case 'day':
      newDate = addDays(date, multiplier);
      break;
  }

  return newDate;
}

/**
 * Get equivalent time range label in target calendar
 * @param date Date
 * @param timeRange Time range type
 * @param calendar Target calendar system
 * @returns Formatted label
 */
export function getTimeRangeLabelInCalendar(
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day',
  calendar: CalendarSystem
): string {
  const calendarDate = dateToCalendarDate(date, calendar);

  switch (timeRange) {
    case 'decade': {
      // For decade, show the decade range
      // Handle negative years correctly: year 0 = 1 BCE, year -1 = 2 BCE, etc.
      let decadeStart: number;
      let era: string;
      
      if (calendarDate.year <= 0) {
        // Convert to BCE: year 0 → 1 BCE, year -1 → 2 BCE, etc.
        const bceYear = Math.abs(calendarDate.year) + 1;
        decadeStart = Math.floor(bceYear / 10) * 10;
        era = 'BCE';
      } else {
        decadeStart = Math.floor(calendarDate.year / 10) * 10;
        // Get era from calendar info
        const calendarInfo = CALENDAR_INFO[calendar];
        era = calendarInfo?.eraName || '';
      }
      
      return `${decadeStart}s${era ? ' ' + era : ''}`;
    }
    case 'year': {
      // Handle negative years correctly
      let displayYear: number;
      let era: string;
      
      if (calendarDate.year <= 0) {
        // Convert to BCE: year 0 → 1 BCE, year -1 = 2 BCE, etc.
        displayYear = Math.abs(calendarDate.year) + 1;
        era = 'BCE';
      } else {
        displayYear = calendarDate.year;
        // Get era from calendar info
        const calendarInfo = CALENDAR_INFO[calendar];
        era = calendarInfo?.eraName || '';
      }
      
      return `${displayYear}${era ? ' ' + era : ''}`;
    }
    case 'month':
      // Include era in format string for negative years
      return formatCalendarDate(calendarDate, 'MMMM YYYY ERA');
    case 'week': {
      const weekStart = getWeekStart(date);
      const weekStartCal = dateToCalendarDate(weekStart, calendar);
      // Include era in format string for negative years
      return `Week of ${formatCalendarDate(weekStartCal, 'MMM D, YYYY ERA')}`;
    }
    case 'day':
      // Include era in format string for negative years
      return formatCalendarDate(calendarDate, 'EEEE, MMMM D, YYYY ERA');
    default:
      return formatCalendarDate(calendarDate, 'YYYY-MM-DD ERA');
  }
}

/**
 * Check if a calendar supports a specific time range well
 * Some calendars don't have traditional weeks or decades
 */
export function calendarSupportsTimeRange(
  calendar: CalendarSystem,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'
): boolean {
  // All calendars support day, month, year
  if (timeRange === 'day' || timeRange === 'month' || timeRange === 'year') {
    return true;
  }

  // Week support - some calendars don't have traditional weeks
  if (timeRange === 'week') {
    // Islamic calendar traditionally doesn't use weeks, but we can still support it
    // by using Gregorian weeks as reference
    return true; // We'll support it for all calendars
  }

  // Decade support - all calendars can support this conceptually
  if (timeRange === 'decade') {
    return true;
  }

  return true;
}

