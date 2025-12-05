/**
 * Universal Calendar Converter
 * 
 * Provides a unified interface for converting dates between different calendar systems.
 * All conversions go through Julian Day Number (JDN) as the universal reference.
 */

import { CalendarSystem, CalendarDate, CalendarConverter } from './types';
import { dateToJDN, jdnToDate, gregorianToJDN, jdnToGregorian } from './julianDayUtils';
import { islamicCalendar } from './islamic';
import { hebrewCalendar } from './hebrew';
import { julianToJDN, jdnToJulian } from './julianDayUtils';
import { formatCalendarDate as formatCalendarDateComprehensive } from './dateFormatter';
import { cherokeeCalendar } from './cherokee';
import { iroquoisCalendar } from './iroquois';
import { persianCalendar } from './persian';
import { ethiopianCalendar } from './ethiopian';
import { copticCalendar } from './coptic';
import { indianSakaCalendar } from './indianSaka';
import { thaiBuddhistCalendar } from './thaiBuddhist';
import { bahaiCalendar } from './bahai';
import { mayanTzolkinCalendar } from './mayanTzolkin';
import { mayanHaabCalendar } from './mayanHaab';
import { mayanLongCountCalendar } from './mayanLongCount';
import { aztecXiuhpohualliCalendar } from './aztecXiuhpohualli';
import { chineseCalendar } from './chinese';

// Registry of calendar converters
const calendarConverters: Partial<Record<CalendarSystem, CalendarConverter>> = {
  gregorian: {
    toJDN(year: number, month: number, day: number): number {
      return gregorianToJDN(year, month, day);
    },
    fromJDN(jdn: number): CalendarDate {
      const { year, month, day } = jdnToGregorian(jdn);
      // Set era correctly: BCE for negative years and year 0, CE for positive years
      const era = year <= 0 ? 'BCE' : 'CE';
      return { year, month, day, calendar: 'gregorian', era };
    },
    getInfo() {
      return {
        name: 'Gregorian',
        nativeName: 'Gregorian',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 1,
        eraName: 'CE'
      };
    },
    formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
      const year = date.year.toString().padStart(4, '0');
      const month = date.month.toString().padStart(2, '0');
      const day = date.day.toString().padStart(2, '0');
      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
    },
    parseDate(dateStr: string): CalendarDate | null {
      const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
        calendar: 'gregorian',
        era: 'CE'
      };
    }
  },
  julian: {
    toJDN(year: number, month: number, day: number): number {
      return julianToJDN(year, month, day);
    },
    fromJDN(jdn: number): CalendarDate {
      const { year, month, day } = jdnToJulian(jdn);
      // Set era correctly: BCE for negative years and year 0, CE for positive years
      const era = year <= 0 ? 'BCE' : 'CE';
      return { year, month, day, calendar: 'julian', era };
    },
    getInfo() {
      return {
        name: 'Julian',
        nativeName: 'Julian',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 1,
        eraName: 'CE'
      };
    },
    formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
      const year = date.year.toString().padStart(4, '0');
      const month = date.month.toString().padStart(2, '0');
      const day = date.day.toString().padStart(2, '0');
      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
    },
    parseDate(dateStr: string): CalendarDate | null {
      const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
        calendar: 'julian',
        era: 'CE'
      };
    }
  },
  islamic: islamicCalendar,
  hebrew: hebrewCalendar,
  cherokee: cherokeeCalendar,
  iroquois: iroquoisCalendar,
  persian: persianCalendar,
  ethiopian: ethiopianCalendar,
  coptic: copticCalendar,
  'indian-saka': indianSakaCalendar,
  'thai-buddhist': thaiBuddhistCalendar,
  bahai: bahaiCalendar,
  'mayan-tzolkin': mayanTzolkinCalendar,
  'mayan-haab': mayanHaabCalendar,
  'mayan-longcount': mayanLongCountCalendar,
  'aztec-xiuhpohualli': aztecXiuhpohualliCalendar,
  chinese: chineseCalendar
};

/**
 * Register a calendar converter
 */
export function registerCalendarConverter(calendar: CalendarSystem, converter: CalendarConverter): void {
  calendarConverters[calendar] = converter;
}

/**
 * Get a calendar converter
 */
export function getCalendarConverter(calendar: CalendarSystem): CalendarConverter | null {
  return calendarConverters[calendar] || null;
}

/**
 * Convert a date from one calendar system to another
 * @param date Source date
 * @param toCalendar Target calendar system
 * @returns Converted date in target calendar
 */
export function convertDate(date: CalendarDate, toCalendar: CalendarSystem): CalendarDate {
  const fromConverter = getCalendarConverter(date.calendar);
  const toConverter = getCalendarConverter(toCalendar);
  
  if (!fromConverter || !toConverter) {
    throw new Error(`Calendar converter not available for ${date.calendar} or ${toCalendar}`);
  }
  
  // Convert to JDN
  const jdn = fromConverter.toJDN(date.year, date.month, date.day);
  
  // Convert from JDN to target calendar
  return toConverter.fromJDN(jdn);
}

/**
 * Convert a JavaScript Date to a calendar date
 * @param date Date object (assumed to be Gregorian)
 * @param calendar Target calendar system
 * @returns Calendar date
 */
export function dateToCalendarDate(date: Date, calendar: CalendarSystem): CalendarDate {
  const jdn = dateToJDN(date);
  const converter = getCalendarConverter(calendar);
  
  if (!converter) {
    throw new Error(`Calendar converter not available for ${calendar}`);
  }
  
  return converter.fromJDN(jdn);
}

/**
 * Convert a calendar date to a JavaScript Date
 * @param date Calendar date
 * @returns Date object (in Gregorian calendar)
 */
export function calendarDateToDate(date: CalendarDate): Date {
  const converter = getCalendarConverter(date.calendar);
  
  if (!converter) {
    throw new Error(`Calendar converter not available for ${date.calendar}`);
  }
  
  const jdn = converter.toJDN(date.year, date.month, date.day);
  return jdnToDate(jdn);
}

/**
 * Format a calendar date as a string
 * @param date Calendar date
 * @param format Format string (default: 'YYYY-MM-DD')
 * @returns Formatted date string
 */
export function formatCalendarDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
  // Use the comprehensive formatter for all calendars
  return formatCalendarDateComprehensive(date, format);
}

/**
 * Parse a date string in a specific calendar format
 * @param dateStr Date string
 * @param calendar Calendar system
 * @returns Parsed calendar date or null if invalid
 */
export function parseCalendarDate(dateStr: string, calendar: CalendarSystem): CalendarDate | null {
  const converter = getCalendarConverter(calendar);
  
  if (!converter) {
    return null;
  }
  
  return converter.parseDate(dateStr);
}

