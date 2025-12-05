/**
 * Thai Buddhist Calendar Converter
 * 
 * The Thai Buddhist calendar is identical to the Gregorian calendar
 * except the year is offset by +543 years (BE = Buddhist Era).
 * 
 * Example: 2025 CE = 2568 BE
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

export const thaiBuddhistCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // Convert Buddhist Era year to Gregorian year
    const gregorianYear = year - 543;
    return gregorianToJDN(gregorianYear, month, day);
  },

  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToGregorian(jdn);
    // Convert Gregorian year to Buddhist Era year
    const buddhistYear = year + 543;
    return {
      year: buddhistYear,
      month,
      day,
      calendar: 'thai-buddhist',
      era: 'BE'
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO['thai-buddhist'];
  },

  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter
    return format
      .replace(/YYYY/g, date.year.toString())
      .replace(/YY/g, date.year.toString().slice(-2))
      .replace(/MM/g, date.month.toString().padStart(2, '0'))
      .replace(/\bM\b/g, date.month.toString())
      .replace(/DD/g, date.day.toString().padStart(2, '0'))
      .replace(/\bD\b/g, date.day.toString())
      .replace(/ERA/g, date.era || 'BE');
  },

  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return {
      year,
      month,
      day,
      calendar: 'thai-buddhist',
      era: 'BE'
    };
  }
};

