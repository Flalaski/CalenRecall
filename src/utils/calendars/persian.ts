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
  // Handle negative years and year 0 by normalizing to positive cycle position
  let normalizedYear = year;
  if (year < 1) {
    // For negative years and year 0, find equivalent position in cycle
    // Year 0 should be treated as position 33 (the position before 1)
    if (year === 0) {
      normalizedYear = 33; // Treat year 0 as position 33 in cycle
    } else {
      const cycles = Math.ceil(Math.abs(year) / 33);
      normalizedYear = year + (cycles * 33);
      // Ensure it's positive
      while (normalizedYear < 1) {
        normalizedYear += 33;
      }
    }
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
  // Handle negative years and year 0 (before epoch)
  if (year < 1) {
    // For negative years and year 0, calculate days before epoch
    // Epoch is start of year 1, so we need days from start of year 'year' to start of year 1
    // Year 0 is treated as the year immediately before year 1
    
    // Calculate days in the target year up to this date
    let daysInYear = day - 1;
    for (let m = 1; m < month; m++) {
      daysInYear += getDaysInPersianMonth(year, m);
    }
    
    // Calculate total days from start of year 'year' to start of epoch (start of year 1)
    // If year is 0, we need to include year 0's days. If year < 0, we need years from 'year' to -1, plus year 0
    let totalDaysInYears = 0;
    if (year === 0) {
      // Year 0 is the year immediately before epoch
      // Calculate the length of year 0
      const isLeap = isPersianLeapYear(0);
      totalDaysInYears = isLeap ? 366 : 365;
    } else {
      // Years from 'year' to -1 (inclusive), plus year 0
      for (let y = year; y <= -1; y++) {
        const isLeap = isPersianLeapYear(y);
        totalDaysInYears += isLeap ? 366 : 365;
      }
      // Add year 0
      const isLeap0 = isPersianLeapYear(0);
      totalDaysInYears += isLeap0 ? 366 : 365;
    }
    
    // Days before epoch = total days from start of year 'year' to start of epoch, minus days from start of year to date
    // For year 0-1-1: daysInYear = 0, totalDaysInYears = 365/366, so daysBeforeEpoch = 365/366
    // This means year 0-1-1 is 365/366 days before the epoch
    const daysBeforeEpoch = totalDaysInYears - daysInYear;
    
    // Ensure we don't return the epoch itself for year 0
    if (daysBeforeEpoch === 0 && year === 0) {
      // This shouldn't happen, but if it does, year 0-1-1 should be 365 days before epoch
      return PERSIAN_EPOCH - 365;
    }
    
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
  
  // Handle dates before epoch (negative years and year 0)
  if (days < 0) {
    // Work backwards from epoch
    // Epoch is start of year 1, so days < 0 means we're in year 0 or a negative year
    let remainingDays = -days;
    let year = 0; // Start from year 0 (the year immediately before epoch)
    
    // Find the year by working backwards
    while (remainingDays > 0) {
      const isLeap = isPersianLeapYear(year);
      const yearLength = isLeap ? 366 : 365;
      if (remainingDays > yearLength) {
        remainingDays -= yearLength;
        year--;
      } else if (remainingDays === yearLength) {
        // Exactly at the start of this year (end of previous year)
        // Return the first day of this year
        return { year, month: 1, day: 1 };
      } else {
        // Found the year
        // remainingDays now represents days from the date to the end of the year (before epoch)
        // We need to convert this to days from the start of the year to the date
        const isLeapYear = isPersianLeapYear(year);
        const yearLength2 = isLeapYear ? 366 : 365;
        const daysFromStartOfYear = yearLength2 - remainingDays;
        
        // Now find month and day from daysFromStartOfYear
        let month = 1;
        let day = daysFromStartOfYear; // 0-based day offset
        
        for (let m = 1; m <= 12; m++) {
          const monthDays = getDaysInPersianMonth(year, m);
          if (day < monthDays) {
            month = m;
            break;
          }
          day -= monthDays;
        }
        
        // Convert to 1-based day
        return { year, month, day: day + 1 };
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

