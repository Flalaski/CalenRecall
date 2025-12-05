/**
 * Coptic Calendar Converter
 * 
 * The Coptic calendar is a solar calendar with 13 months, used by the Coptic Orthodox Church.
 * It is based on the ancient Egyptian calendar.
 * 
 * Key features:
 * - 13 months: 12 months of 30 days + 1 month of 5-6 days
 * - Year begins on August 29 (Julian) or August 30 in leap years
 * - Epoch: August 29, 284 CE (Julian) = Tout 1, 1 AM (Anno Martyrum)
 * - Leap years: Every 4 years (same as Julian calendar)
 * 
 * Algorithm based on "Calendrical Calculations" by Dershowitz & Reingold
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

// Coptic epoch: August 29, 284 CE (Julian) = Tout 1, 1 AM
// Note: August 29, 284 CE in Julian calendar
// Using Julian calendar conversion: JDN = 1825030
const COPTIC_EPOCH = 1825030;

/**
 * Check if a Coptic year is a leap year
 * Same rule as Julian calendar: every 4 years
 */
export function isCopticLeapYear(year: number): boolean {
  return year % 4 === 0;
}

/**
 * Get number of days in a Coptic year
 */
export function getDaysInCopticYear(year: number): number {
  return isCopticLeapYear(year) ? 366 : 365;
}

/**
 * Get number of days in a Coptic month
 */
export function getDaysInCopticMonth(year: number, month: number): number {
  if (month <= 12) {
    return 30;
  } else {
    // Month 13 (Pi Kogi Enavot)
    return isCopticLeapYear(year) ? 6 : 5;
  }
}

/**
 * Convert Coptic date to Julian Day Number
 * @param year Coptic year (AM - Anno Martyrum)
 * @param month Month (1-13)
 * @param day Day (1-30, or 1-5/6 for month 13)
 * @returns Julian Day Number
 */
export function copticToJDN(year: number, month: number, day: number): number {
  // Handle negative years (before epoch)
  if (year < 1) {
    // For negative years, calculate days before epoch
    // Work backwards: calculate total days from year down to 0 (inclusive)
    let totalDaysInYears = 0;
    for (let y = year; y <= 0; y++) {
      const isLeap = (y % 4 === 0);
      totalDaysInYears += isLeap ? 366 : 365;
    }
    
    // Calculate days in the target year up to this date
    let daysInYear = day - 1;
    for (let m = 1; m < month; m++) {
      daysInYear += getDaysInCopticMonth(year, m);
    }
    
    // Days before epoch = total days in all years from year to 0, minus days remaining in target year
    const daysBeforeEpoch = totalDaysInYears - daysInYear;
    
    return COPTIC_EPOCH - daysBeforeEpoch;
  }
  
  // Normal case: year >= 1
  // Calculate days since Coptic epoch
  let days = day - 1;
  
  // Add days from previous months in this year
  for (let m = 1; m < month; m++) {
    days += getDaysInCopticMonth(year, m);
  }
  
  // Add days from previous years
  const leapYears = Math.floor((year - 1) / 4);
  const daysInYears = (year - 1) * 365 + leapYears;
  
  return COPTIC_EPOCH + daysInYears + days;
}

/**
 * Convert Julian Day Number to Coptic date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-13), and day
 */
export function jdnToCoptic(jdn: number): { year: number; month: number; day: number } {
  const days = jdn - COPTIC_EPOCH;
  
  // Handle dates before epoch (negative years)
  if (days < 0) {
    // Work backwards from epoch
    let remainingDays = -days;
    let year = 0;
    
    // Find the year by working backwards
    while (remainingDays > 0) {
      const isLeap = (year % 4 === 0);
      const yearLength = isLeap ? 366 : 365;
      if (remainingDays > yearLength) {
        remainingDays -= yearLength;
        year--;
      } else {
        // Found the year, now find month and day
        let month = 1;
        let day = remainingDays + 1;
        
        for (let m = 1; m <= 13; m++) {
          const monthDays = getDaysInCopticMonth(year, m);
          if (day <= monthDays) {
            month = m;
            break;
          }
          day -= monthDays;
        }
        
        return { year, month, day };
      }
    }
    
    // Should not reach here, but return year 0, month 1, day 1 as fallback
    return { year: 0, month: 1, day: 1 };
  }
  
  // Normal case: days >= 0 (year >= 1)
  // Approximate year
  let year = Math.floor(days / 365.25) + 1;
  
  // Refine year calculation
  while (true) {
    const leapYears = Math.floor((year - 1) / 4);
    const daysInYears = (year - 1) * 365 + leapYears;
    
    if (days < daysInYears) {
      year--;
      continue;
    }
    
    const remainingDays = days - daysInYears;
    
    // Calculate month and day
    let month = 1;
    let day = remainingDays + 1;
    
    for (let m = 1; m <= 13; m++) {
      const monthDays = getDaysInCopticMonth(year, m);
      if (day <= monthDays) {
        month = m;
        break;
      }
      day -= monthDays;
    }
    
    return { year, month, day };
  }
}

/**
 * Coptic Calendar Converter Implementation
 */
export const copticCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    return copticToJDN(year, month, day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToCoptic(jdn);
    return {
      year,
      month,
      day,
      calendar: 'coptic',
      era: 'AM'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO.coptic;
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter which has Coptic month names
    const { formatCalendarDate } = require('./dateFormatter');
    return formatCalendarDate(date, format);
  },
  
  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    
    if (month < 1 || month > 13 || day < 1 || day > 30) {
      return null;
    }
    
    // Validate day against month length
    if (day > getDaysInCopticMonth(year, month)) {
      return null;
    }
    
    return {
      year,
      month,
      day,
      calendar: 'coptic',
      era: 'AM'
    };
  }
};

