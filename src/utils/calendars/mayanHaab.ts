/**
 * Mayan Haab' Calendar Converter
 * 
 * The Haab' is a 365-day solar calendar:
 * - 18 months of 20 days each = 360 days
 * - 5 nameless days (Wayeb') at the end = 365 days total
 * - No leap years (fixed 365-day year)
 * 
 * Month names: Pop, Wo', Sip, Sotz', Sek, Xul, Yaxk'in, Mol, Ch'en, Yax,
 * Sak', Keh, Mak, K'ank'in, Muwan, Pax, K'ayab', Kumk'u, Wayeb'
 * 
 * Correlation constant (GMT): 584283 (JDN of August 11, 3114 BCE)
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';

// GMT correlation constant: JDN of Mayan epoch (August 11, 3114 BCE)
const MAYAN_EPOCH = 584283;

// Haab' month names (18 months + Wayeb')
const HAAB_MONTH_NAMES = [
  'Pop', 'Wo\'', 'Sip', 'Sotz\'', 'Sek', 'Xul', 'Yaxk\'in', 'Mol', 'Ch\'en', 'Yax',
  'Sak\'', 'Keh', 'Mak', 'K\'ank\'in', 'Muwan', 'Pax', 'K\'ayab\'', 'Kumk\'u', 'Wayeb\''
];

export const mayanHaabCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // In Haab', year is the year number, month is 1-19 (18 regular months + Wayeb'),
    // day is 1-20 (or 1-5 for Wayeb')
    
    // Clamp month to valid range
    month = Math.max(1, Math.min(19, month));
    
    // Validate and clamp day against actual month length
    const maxDays = month === 19 ? 5 : 20;
    day = Math.max(1, Math.min(maxDays, day));
    
    // Handle negative years (before epoch)
    if (year < 1) {
      // For negative years, calculate days before epoch
      // Epoch is start of year 1, so we need days from start of year 'year' to start of year 1
      // This includes: all years from 'year' to -1 (inclusive), minus days from start of year to date
      const totalYears = Math.abs(year); // From year to -1 inclusive
      const totalDaysInYears = totalYears * 365;
      
      // Calculate days in the target year up to this date
      let daysInYear = 0;
      if (month === 19) {
        // Wayeb' days (days 361-365 of the year)
        daysInYear = 18 * 20 + (day - 1);
      } else {
        // Regular month
        daysInYear = (month - 1) * 20 + (day - 1);
      }
      
      // Days before epoch = total days from start of year 'year' to start of epoch, minus days from start of year to date
      const daysBeforeEpoch = totalDaysInYears - daysInYear;
      
      return MAYAN_EPOCH - daysBeforeEpoch;
    }
    
    // Normal case: year >= 1
    // Calculate days since epoch
    // (year - 1) * 365 + (month - 1) * 20 + (day - 1)
    // But Wayeb' is special: it's days 361-365 of the year
    let daysSinceEpoch = (year - 1) * 365;
    
    if (month === 19) {
      // Wayeb' days (days 361-365 of the year)
      daysSinceEpoch += 18 * 20 + (day - 1);
    } else {
      // Regular month
      daysSinceEpoch += (month - 1) * 20 + (day - 1);
    }
    
    return MAYAN_EPOCH + daysSinceEpoch;
  },

  fromJDN(jdn: number): CalendarDate {
    // Calculate days since Mayan epoch
    const daysSinceEpoch = jdn - MAYAN_EPOCH;
    
    // Handle dates before epoch (negative years)
    if (daysSinceEpoch < 0) {
      // Work backwards from epoch
      // Epoch is start of year 1, so daysSinceEpoch < 0 means we're in a negative year
      const absDays = Math.abs(daysSinceEpoch);
      
      // Calculate year: if absDays = 365, we're at the start of year -1
      // So year = -Math.floor((absDays - 1) / 365) - 1, or simpler: year = -Math.ceil(absDays / 365)
      // But we need to handle the case when absDays is exactly a multiple of 365
      const year = absDays % 365 === 0 ? -(absDays / 365) : -Math.ceil(absDays / 365);
      
      // Calculate days from start of year to date
      // If absDays = 365, we're at day 1 of year -1
      // If absDays = 364, we're at day 2 of year -1
      // So dayOfYear = 365 - ((absDays - 1) % 365)
      const remainder = (absDays - 1) % 365;
      const dayOfYear = 365 - remainder;
      
      let month: number;
      let day: number;
      
      if (dayOfYear <= 18 * 20) {
        // Regular month (days 1-360)
        month = Math.floor((dayOfYear - 1) / 20) + 1;
        day = ((dayOfYear - 1) % 20) + 1;
      } else {
        // Wayeb' (days 361-365)
        month = 19;
        day = dayOfYear - 18 * 20;
      }
      
      return {
        year,
        month,
        day,
        calendar: 'mayan-haab',
        era: ''
      };
    }
    
    // Normal case: daysSinceEpoch >= 0 (year >= 1)
    // Calculate which 365-day year we're in
    const year = Math.floor(daysSinceEpoch / 365) + 1;
    const dayOfYear = (daysSinceEpoch % 365) + 1;
    
    let month: number;
    let day: number;
    
    if (dayOfYear <= 18 * 20) {
      // Regular month (days 1-360)
      month = Math.floor((dayOfYear - 1) / 20) + 1;
      day = ((dayOfYear - 1) % 20) + 1;
    } else {
      // Wayeb' (days 361-365)
      month = 19;
      day = dayOfYear - 18 * 20;
    }
    
    return {
      year,
      month,
      day,
      calendar: 'mayan-haab',
      era: ''
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO['mayan-haab'];
  },

  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    const monthName = date.month <= 19 ? HAAB_MONTH_NAMES[date.month - 1] : '';
    return format
      .replace(/YYYY/g, date.year.toString())
      .replace(/YY/g, date.year.toString().slice(-2))
      .replace(/MMMM/g, monthName)
      .replace(/MMM/g, monthName.substring(0, 3))
      .replace(/MM/g, date.month.toString().padStart(2, '0'))
      .replace(/\bM\b/g, date.month.toString())
      .replace(/DD/g, date.day.toString().padStart(2, '0'))
      .replace(/\bD\b/g, date.day.toString())
      .replace(/ERA/g, date.era || '');
  },

  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 19) {
      return null;
    }
    
    if (month === 19 && (day < 1 || day > 5)) {
      return null; // Wayeb' has only 5 days
    }
    
    if (month < 19 && (day < 1 || day > 20)) {
      return null; // Regular months have 20 days
    }

    return {
      year,
      month,
      day,
      calendar: 'mayan-haab',
      era: ''
    };
  }
};

