/**
 * Cherokee Calendar Converter
 * 
 * The Cherokee calendar is a lunar calendar that was adapted to align with
 * the 12-month Gregorian calendar. Each month retains traditional Cherokee
 * names and cultural significance.
 * 
 * Traditional month names are preserved while mapping to Gregorian months
 * for practical use. This is an approximation that honors the traditional
 * naming while providing compatibility with modern date systems.
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

/**
 * Cherokee Calendar Converter Implementation
 * 
 * Maps directly to Gregorian calendar structure (12 months)
 * but uses traditional Cherokee month names
 */
export const cherokeeCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // Cherokee calendar uses the same structure as Gregorian
    return gregorianToJDN(year, month, day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    // Convert from JDN using Gregorian structure
    const { year, month, day } = jdnToGregorian(jdn);
    return {
      year,
      month,
      day,
      calendar: 'cherokee',
      era: 'CE'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO.cherokee;
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter which has Cherokee month names
    const { formatCalendarDate } = require('./dateFormatter');
    return formatCalendarDate(date, format);
  },
  
  parseDate(dateStr: string): CalendarDate | null {
    // Parse as Gregorian format (same structure)
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
      calendar: 'cherokee',
      era: 'CE'
    };
  }
};

