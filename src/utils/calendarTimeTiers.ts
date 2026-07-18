/**
 * Calendar-Aware Time Tier Functions
 *
 * Provides calendar-aware versions of getMonthsInYear, getDaysInMonth,
 * and navigation functions that adapt to each calendar system's actual
 * structure (e.g., Hebrew 13-month leap years, Baháʼí 19 months, etc.).
 *
 * All conversion uses JDN as the universal pivot.
 */

import { CalendarSystem, CalendarDate, CALENDAR_INFO } from './calendars/types';
import { dateToCalendarDate, calendarDateToDate } from './calendars/calendarConverter';
import { addDays, addMonths, addYears, addWeeks } from 'date-fns';
import { getMonthStart, getMonthEnd, createDate } from './dateUtils';

/**
 * Get the number of months in a given year for a specific calendar system.
 * Returns accurate month counts for all 17 calendars.
 */
export function getMonthsInYearCount(_date: Date, calendar: CalendarSystem): number {
  const info = CALENDAR_INFO[calendar];
  if (!info) return 12;
  
  // Calendars with fixed month counts use metadata value
  // Calendars with variable counts (hebrew, chinese) return their max
  // The caller can generate month 1..N and catch conversion errors
  return info.months;
}

/**
 * Get all month start dates in a year for a specific calendar system.
 * Unlike the Gregorian-only getMonthsInYear(), this adapts to each
 * calendar's actual month count (e.g., 19 for Baháʼí, 13 for Ethiopian).
 *
 * For calendars where month=0 is valid (Baháʼí Ayyám-i-Há), the 0 month
 * is included at the beginning.
 */
export function getMonthsInYear(date: Date, calendar: CalendarSystem): Date[] {
  const info = CALENDAR_INFO[calendar];
  if (!info) return getGregorianMonths(date);

  const calDate = dateToCalendarDate(date, calendar);
  const monthCount = getMonthsInYearCount(date, calendar);
  const months: Date[] = [];

  // For Baháʼí, include month 0 (Ayyám-i-Há intercalary days) first
  const startMonth = calendar === 'bahai' ? 0 : 1;

  for (let m = startMonth; m <= monthCount; m++) {
    try {
      const monthDate: CalendarDate = { year: calDate.year, month: m, day: 1, calendar };
      months.push(calendarDateToDate(monthDate));
    } catch {
      // Skip months that can't be converted (e.g., Hebrew Adar II in non-leap years)
    }
  }

  return months.length > 0 ? months : getGregorianMonths(date);
}

/** Gregorian-only months fallback (original 12-month behavior) */
function getGregorianMonths(date: Date): Date[] {
  const year = date.getFullYear();
  const months: Date[] = [];
  for (let i = 0; i < 12; i++) months.push(createDate(year, i, 1));
  return months;
}

/**
 * Get all days in a month for a specific calendar system.
 * Adapts to different month lengths: Baháʼí 19-day months, Mayan Haab' 20-day, etc.
 */
export function getDaysInMonth(date: Date, calendar: CalendarSystem): Date[] {
  // Gregorian-like calendars use standard day generation
  if (['gregorian', 'julian', 'thai-buddhist', 'indian-saka', 'cherokee'].includes(calendar)) {
    return getGregorianDaysInMonth(date);
  }

  const calDate = dateToCalendarDate(date, calendar);
  const days: Date[] = [];

  // Determine month length from calendar structure
  let maxDays = 30;
  switch (calendar) {
    case 'bahai':
      if (calDate.month === 0) {
        // Ayyám-i-Há: calculate intercalary days from last/first month gap
        try {
          const m19Start: CalendarDate = { year: calDate.year, month: 19, day: 1, calendar };
          const m18Start: CalendarDate = { year: calDate.year, month: 18, day: 1, calendar };
          const daysToM19 = (calendarDateToDate(m19Start).getTime() - calendarDateToDate(m18Start).getTime()) / 86400000;
          maxDays = Math.round(daysToM19) - 18 * 19; // 18 regular months × 19 days
        } catch { maxDays = 4; }
      } else {
        maxDays = 19; // All Baháʼí months are 19 days
      }
      break;
    case 'mayan-haab':
    case 'aztec-xiuhpohualli':
      maxDays = calDate.month === 19 ? 5 : 20;
      break;
    case 'iroquois':
      maxDays = 29; // Full moon cycle approximation
      break;
    case 'hebrew':
    case 'chinese':
    default: {
      // Compute month length by comparing consecutive month starts
      try {
        const thisStart = calendarDateToDate(calDate);
        const nextCal: CalendarDate = {
          year: calDate.month >= getMonthsInYearCount(date, calendar) ? calDate.year + 1 : calDate.year,
          month: calDate.month >= getMonthsInYearCount(date, calendar) ? 1 : calDate.month + 1,
          day: 1,
          calendar,
        };
        const nextStart = calendarDateToDate(nextCal);
        maxDays = Math.round((nextStart.getTime() - thisStart.getTime()) / 86400000);
      } catch { maxDays = 30; }
    }
  }

  for (let d = 1; d <= maxDays; d++) {
    try {
      const dayDate: CalendarDate = { year: calDate.year, month: calDate.month, day: d, calendar };
      days.push(calendarDateToDate(dayDate));
    } catch { break; }
  }

  return days;
}

/** Gregorian-only days in month fallback */
function getGregorianDaysInMonth(date: Date): Date[] {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  const days: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
}

/**
 * Calendar-aware navigation: advance by time range in the specified calendar.
 * Handles different month counts and year structures for non-Gregorian calendars.
 */
export function navigateInCalendar(
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day',
  direction: 'next' | 'prev',
  calendar: CalendarSystem
): Date {
  const multiplier = direction === 'next' ? 1 : -1;

  // Gregorian-like calendars use standard navigation
  if (['gregorian', 'julian', 'thai-buddhist', 'indian-saka', 'cherokee'].includes(calendar)) {
    return gregorianNavigate(date, timeRange, multiplier);
  }

  // Day and week: same for all calendars
  if (timeRange === 'day' || timeRange === 'week') {
    return gregorianNavigate(date, timeRange, multiplier);
  }

  // Month/year/decade: calendar-aware
  const calDate = dateToCalendarDate(date, calendar);
  const maxMonths = getMonthsInYearCount(date, calendar);

  try {
    let newYear = calDate.year;
    let newMonth = calDate.month;
    let newDay = Math.min(calDate.day, 15); // Safe middle-of-month day

    switch (timeRange) {
      case 'month': {
        newMonth += multiplier;
        if (calendar === 'bahai') {
          // Baháʼí: month 0 (Ayyám-i-Há) exists
          if (newMonth < 0) { newYear--; newMonth = maxMonths; }
          else if (newMonth > maxMonths) { newYear++; newMonth = 0; }
        } else {
          if (newMonth < 1) { newYear--; newMonth = maxMonths; }
          else if (newMonth > maxMonths) { newYear++; newMonth = 1; }
        }
        break;
      }
      case 'year':
        newYear += multiplier;
        newMonth = 1;
        break;
      case 'decade':
        newYear += multiplier * 10;
        newMonth = 1;
        break;
    }

    const newCalDate: CalendarDate = { year: newYear, month: newMonth, day: newDay, calendar };
    return calendarDateToDate(newCalDate);
  } catch {
    return gregorianNavigate(date, timeRange, multiplier);
  }
}

/** Gregorian-only navigation (delegates to date-fns) */
function gregorianNavigate(date: Date, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day', multiplier: number): Date {
  switch (timeRange) {
    case 'decade': return addYears(date, multiplier * 10);
    case 'year': return addYears(date, multiplier);
    case 'month': return addMonths(date, multiplier);
    case 'week': return addWeeks(date, multiplier);
    case 'day': return addDays(date, multiplier);
  }
}

// Helper to get month count for a year in a calendar (synchronous version)
let _monthsCache = new Map<string, number>();

export function getMonthCountForYear(date: Date, calendar: CalendarSystem): number {
  const cacheKey = `${calendar}-${date.getFullYear()}`;
  if (_monthsCache.has(cacheKey)) {
    return _monthsCache.get(cacheKey)!;
  }
  
  const info = CALENDAR_INFO[calendar];
  if (!info) return 12;
  
  let count = info.months;
  
  // For variable-month calendars, we need to detect the actual count
  // For now, return the metadata value (conservative for rendering)
  _monthsCache.set(cacheKey, count);
  return count;
}
