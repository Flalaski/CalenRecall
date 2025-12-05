/**
 * Cherokee Calendar Converter
 * 
 * CULTURAL NOTE:
 * The Cherokee calendar historically used lunar months and seasonal observations.
 * In the 19th century, it was adapted to align with the 12-month Gregorian
 * calendar structure while preserving traditional Cherokee month names and
 * their cultural significance.
 * 
 * This implementation maps Cherokee month names to the Gregorian calendar
 * structure, which reflects the historical adaptation. However, we should
 * consult with Cherokee cultural experts to ensure this representation is
 * accurate and respectful.
 * 
 * Traditional month names are preserved while mapping to Gregorian months
 * for practical use. This reflects the historical adaptation of the calendar.
 * 
 * TODO: Consult with Cherokee cultural experts to verify accuracy and
 * appropriateness of this implementation.
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

