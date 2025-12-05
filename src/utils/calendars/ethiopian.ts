/**
 * Ethiopian Calendar Converter
 * 
 * The Ethiopian calendar is a solar calendar with 13 months.
 * It is based on the Coptic calendar but with different month names.
 * 
 * Key features:
 * - 13 months: 12 months of 30 days + 1 month of 5-6 days
 * - Year begins on September 11 (Gregorian) or September 12 in leap years
 * - Epoch: August 29, 8 CE (Julian) = Meskerem 1, 1 EE
 * - Leap years: Every 4 years (same as Julian calendar)
 * 
 * Algorithm based on "Calendrical Calculations" by Dershowitz & Reingold
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

// Ethiopian epoch: August 29, 8 CE (Julian) = Meskerem 1, 1 EE
// JDN of August 29, 8 CE (Julian) = 1724221
const ETHIOPIAN_EPOCH = 1724221;

/**
 * Check if an Ethiopian year is a leap year
 * Same rule as Julian calendar: every 4 years
 */
export function isEthiopianLeapYear(year: number): boolean {
  return year % 4 === 0;
}

/**
 * Get number of days in an Ethiopian year
 */
export function getDaysInEthiopianYear(year: number): number {
  return isEthiopianLeapYear(year) ? 366 : 365;
}

/**
 * Get number of days in an Ethiopian month
 */
export function getDaysInEthiopianMonth(year: number, month: number): number {
  if (month <= 12) {
    return 30;
  } else {
    // Month 13 (Pagume)
    return isEthiopianLeapYear(year) ? 6 : 5;
  }
}

/**
 * Convert Ethiopian date to Julian Day Number
 * @param year Ethiopian year (EE)
 * @param month Month (1-13)
 * @param day Day (1-30, or 1-5/6 for month 13)
 * @returns Julian Day Number
 */
export function ethiopianToJDN(year: number, month: number, day: number): number {
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
      daysInYear += getDaysInEthiopianMonth(year, m);
    }
    
    // Days before epoch = total days in all years from year to 0, minus days remaining in target year
    const daysBeforeEpoch = totalDaysInYears - daysInYear;
    
    return ETHIOPIAN_EPOCH - daysBeforeEpoch;
  }
  
  // Normal case: year >= 1
  // Calculate days since Ethiopian epoch
  let days = day - 1;
  
  // Add days from previous months in this year
  for (let m = 1; m < month; m++) {
    days += getDaysInEthiopianMonth(year, m);
  }
  
  // Add days from previous years
  const leapYears = Math.floor((year - 1) / 4);
  const daysInYears = (year - 1) * 365 + leapYears;
  
  return ETHIOPIAN_EPOCH + daysInYears + days;
}

/**
 * Convert Julian Day Number to Ethiopian date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-13), and day
 */
export function jdnToEthiopian(jdn: number): { year: number; month: number; day: number } {
  const days = jdn - ETHIOPIAN_EPOCH;
  
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
        // Found the year
        // remainingDays represents how many days BEFORE the epoch we are, within this year
        // If remainingDays equals yearLength, we're at the START of the year (first day)
        if (remainingDays === yearLength) {
          return { year, month: 1, day: 1 };
        }
        
        // If remainingDays is 1, we're 1 day before epoch = last day of the year
        if (remainingDays === 1) {
          const lastMonth = 13;
          const lastDay = getDaysInEthiopianMonth(year, lastMonth);
          return { year, month: lastMonth, day: lastDay };
        }
        
        // Otherwise, calculate day of year
        // remainingDays tells us how many days before epoch, so:
        // day of year = yearLength - remainingDays + 1
        // (if remainingDays = yearLength-1, we're 1 day into the year)
        let dayOfYear = yearLength - remainingDays + 1;
        
        // Now find month and day
        let month = 1;
        let day = dayOfYear;
        
        for (let m = 1; m <= 13; m++) {
          const monthDays = getDaysInEthiopianMonth(year, m);
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
      const monthDays = getDaysInEthiopianMonth(year, m);
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
 * Ethiopian Calendar Converter Implementation
 */
export const ethiopianCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    return ethiopianToJDN(year, month, day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToEthiopian(jdn);
    return {
      year,
      month,
      day,
      calendar: 'ethiopian',
      era: 'EE'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO.ethiopian;
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter which has Ethiopian month names
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
    if (day > getDaysInEthiopianMonth(year, month)) {
      return null;
    }
    
    return {
      year,
      month,
      day,
      calendar: 'ethiopian',
      era: 'EE'
    };
  }
};

