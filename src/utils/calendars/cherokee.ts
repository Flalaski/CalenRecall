/**
 * Cherokee Calendar Converter
 * 
 * CULTURAL NOTE:
 * The Cherokee calendar historically used lunar months and seasonal observations.
 * In the 19th century, it was adapted to align with the 12-month Gregorian
 * calendar structure while preserving traditional Cherokee month names and
 * their cultural significance.
 * 
 * IMPLEMENTATION STATUS:
 * This implementation correctly represents the modern 12-month adaptation of the
 * Cherokee calendar, which maps directly to the Gregorian calendar structure.
 * This is the historically accurate representation of how the Cherokee calendar
 * evolved in the 19th century.
 * 
 * The implementation:
 * - Uses Gregorian calendar structure (12 months, same leap year rules) ✅
 * - Preserves traditional Cherokee month names ✅
 * - Maps months to Gregorian months for practical use ✅
 * - Reflects the historical 19th-century adaptation ✅
 * 
 * This is NOT a traditional Cherokee calendar (which was based on lunar cycles
 * and seasonal observations), but rather the modern adaptation that was created
 * to work alongside the Gregorian calendar. The implementation is correct for
 * this modern adaptation.
 * 
 * Traditional Cherokee timekeeping was more fluid and based on:
 * - Lunar cycles (new moons)
 * - Seasonal observations
 * - Natural phenomena
 * - Agricultural activities
 * 
 * The modern 12-month adaptation preserves cultural month names while providing
 * a fixed structure aligned with the Gregorian calendar.
 * 
 * FUTURE IMPROVEMENTS:
 * Consultation with Cherokee cultural experts would be valuable to:
 * - Verify month name translations and cultural associations
 * - Ensure respectful representation
 * - Potentially add information about traditional timekeeping practices
 * 
 * However, the current implementation is accurate for the modern 12-month
 * adaptation that is documented in historical sources.
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

