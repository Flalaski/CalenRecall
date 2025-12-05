/**
 * Persian (Jalali/Solar Hijri) Calendar Converter
 * 
 * The Persian calendar is a solar calendar used in Iran and Afghanistan.
 * It is one of the most accurate solar calendars, with an error of only
 * one day accumulating over 5,000 years.
 * 
 * Key features:
 * - Year begins on Nowruz (vernal equinox, typically March 20/21)
 * - 12 months: first 6 have 31 days, next 5 have 30 days, last has 29/30
 * - Leap years based on 33-year cycle (8 leap years per 33 years)
 * - Epoch: March 19, 622 CE (Gregorian) = Farvardin 1, 1 SH
 * 
 * Algorithm based on "Calendrical Calculations" by Dershowitz & Reingold
 * and the 33-year cycle method for leap year determination.
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

// Persian epoch: March 19, 622 CE (Gregorian) = Farvardin 1, 1 SH
// JDN of March 19, 622 CE = 1948318 (calculated using gregorianToJDN)
// Note: Nowruz (Persian New Year) is the vernal equinox, which can vary
// This implementation uses the standard epoch date
const PERSIAN_EPOCH = 1948318;

/**
 * Check if a Persian year is a leap year
 * Uses the 33-year cycle: 8 leap years per 33 years
 * Leap years occur in positions: 1, 5, 9, 13, 17, 22, 26, 30 of the cycle
 */
export function isPersianLeapYear(year: number): boolean {
  // In 33-year cycle, leap years are at positions: 1, 5, 9, 13, 17, 22, 26, 30
  // Handle negative years by normalizing to positive cycle position
  let normalizedYear = year;
  if (year < 1) {
    // For negative years, find equivalent position in cycle
    const cycles = Math.ceil(Math.abs(year) / 33);
    normalizedYear = year + (cycles * 33);
  }
  const cyclePosition = ((normalizedYear - 1) % 33) + 1;
  const leapPositions = [1, 5, 9, 13, 17, 22, 26, 30];
  return leapPositions.includes(cyclePosition);
}

/**
 * Get number of days in a Persian year
 */
export function getDaysInPersianYear(year: number): number {
  return isPersianLeapYear(year) ? 366 : 365;
}

/**
 * Get number of days in a Persian month
 */
export function getDaysInPersianMonth(year: number, month: number): number {
  if (month <= 6) {
    return 31;
  } else if (month <= 11) {
    return 30;
  } else {
    // Month 12 (Esfand)
    return isPersianLeapYear(year) ? 30 : 29;
  }
}

/**
 * Convert Persian (Jalali) date to Julian Day Number
 * @param year Persian year (SH - Solar Hijri)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @returns Julian Day Number
 */
export function persianToJDN(year: number, month: number, day: number): number {
  // Handle negative years (before epoch)
  if (year < 1) {
    // For negative years, calculate days before epoch
    // Work backwards: calculate total days from year down to 0 (inclusive)
    let totalDaysInYears = 0;
    for (let y = year; y <= 0; y++) {
      const isLeap = isPersianLeapYear(y);
      totalDaysInYears += isLeap ? 366 : 365;
    }
    
    // Calculate days in the target year up to this date
    let daysInYear = day - 1;
    for (let m = 1; m < month; m++) {
      daysInYear += getDaysInPersianMonth(year, m);
    }
    
    // Days before epoch = total days in all years from year to 0, minus days remaining in target year
    const daysBeforeEpoch = totalDaysInYears - daysInYear;
    
    return PERSIAN_EPOCH - daysBeforeEpoch;
  }
  
  // Normal case: year >= 1
  // Calculate days since Persian epoch
  let days = day - 1;
  
  // Add days from previous months in this year
  for (let m = 1; m < month; m++) {
    days += getDaysInPersianMonth(year, m);
  }
  
  // Add days from previous years
  // Use 33-year cycle: 8 leap years per 33 years = 365.2424... days per year average
  const cycles = Math.floor((year - 1) / 33);
  const yearsInCycle = ((year - 1) % 33) + 1;
  
  // Calculate leap years in completed cycles
  const leapYearsInCycles = cycles * 8;
  
  // Calculate leap years in current cycle
  const leapPositions = [1, 5, 9, 13, 17, 22, 26, 30];
  let leapYearsInCurrentCycle = 0;
  for (let i = 0; i < yearsInCycle; i++) {
    if (leapPositions.includes(i + 1)) {
      leapYearsInCurrentCycle++;
    }
  }
  
  const totalLeapYears = leapYearsInCycles + leapYearsInCurrentCycle;
  const totalDays = (year - 1) * 365 + totalLeapYears + days;
  
  return PERSIAN_EPOCH + totalDays;
}

/**
 * Convert Julian Day Number to Persian (Jalali) date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-12), and day
 */
export function jdnToPersian(jdn: number): { year: number; month: number; day: number } {
  const days = jdn - PERSIAN_EPOCH;
  
  // Handle dates before epoch (negative years)
  if (days < 0) {
    // Work backwards from epoch
    let remainingDays = -days;
    let year = 0;
    
    // Find the year by working backwards
    while (remainingDays > 0) {
      const isLeap = isPersianLeapYear(year);
      const yearLength = isLeap ? 366 : 365;
      if (remainingDays > yearLength) {
        remainingDays -= yearLength;
        year--;
      } else {
        // Found the year, now find month and day
        let month = 1;
        let day = remainingDays + 1;
        
        for (let m = 1; m <= 12; m++) {
          const monthDays = getDaysInPersianMonth(year, m);
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
  // Approximate year using 33-year cycle
  // Average days per year = (33 * 365 + 8) / 33 = 365.2424...
  let year = Math.floor(days / 365.2424) + 1;
  
  // Refine year calculation
  while (true) {
    // Calculate days up to start of this year
    const cycles = Math.floor((year - 1) / 33);
    const yearsInCycle = ((year - 1) % 33) + 1;
    
    const leapYearsInCycles = cycles * 8;
    const leapPositions = [1, 5, 9, 13, 17, 22, 26, 30];
    let leapYearsInCurrentCycle = 0;
    for (let i = 0; i < yearsInCycle; i++) {
      if (leapPositions.includes(i + 1)) {
        leapYearsInCurrentCycle++;
      }
    }
    
    const totalLeapYears = leapYearsInCycles + leapYearsInCurrentCycle;
    const daysInYears = (year - 1) * 365 + totalLeapYears;
    
    if (days < daysInYears) {
      year--;
      continue;
    }
    
    const remainingDays = days - daysInYears;
    
    // Calculate month and day
    let month = 1;
    let day = remainingDays + 1;
    
    for (let m = 1; m <= 12; m++) {
      const monthDays = getDaysInPersianMonth(year, m);
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
 * Persian Calendar Converter Implementation
 */
export const persianCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    return persianToJDN(year, month, day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToPersian(jdn);
    return {
      year,
      month,
      day,
      calendar: 'persian',
      era: 'SH'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO.persian;
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter which has Persian month names
    const { formatCalendarDate } = require('./dateFormatter');
    return formatCalendarDate(date, format);
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
    
    // Validate day against month length
    if (day > getDaysInPersianMonth(year, month)) {
      return null;
    }
    
    return {
      year,
      month,
      day,
      calendar: 'persian',
      era: 'SH'
    };
  }
};

