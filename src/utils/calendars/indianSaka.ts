/**
 * Indian National Calendar (Saka Samvat) Converter
 * 
 * The Indian National Calendar is a solar calendar used officially in India.
 * It is based on the Saka era.
 * 
 * Key features:
 * - 12 months: Chaitra through Phalguna
 * - Year begins on Chaitra 1, which is March 22 (or March 21 in leap years)
 * - Epoch: March 22, 78 CE (Gregorian) = Chaitra 1, 1 Saka
 * - Leap years: Same as Gregorian calendar (every 4 years, except century years)
 * 
 * Algorithm based on standard Saka calendar conversion methods
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';

// Saka epoch: March 22, 78 CE (Gregorian) = Chaitra 1, 1 Saka
// JDN of March 22, 78 CE = 1749630 (calculated)
const SAKA_EPOCH = 1749630;

/**
 * Check if a Saka year is a leap year
 * Same rule as Gregorian calendar
 */
export function isSakaLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get number of days in a Saka year
 */
export function getDaysInSakaYear(year: number): number {
  return isSakaLeapYear(year) ? 366 : 365;
}

/**
 * Get number of days in a Saka month
 */
export function getDaysInSakaMonth(year: number, month: number): number {
  const monthLengths = [
    31, // Chaitra
    31, // Vaisakha
    31, // Jyeshtha
    31, // Ashadha
    31, // Shravana
    31, // Bhadra
    30, // Ashwin
    30, // Kartika
    30, // Agrahayana
    30, // Pausha
    30, // Magha
    isSakaLeapYear(year) ? 31 : 30  // Phalguna
  ];
  
  return monthLengths[month - 1];
}

/**
 * Convert Saka date to Julian Day Number
 * @param year Saka year
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @returns Julian Day Number
 */
export function sakaToJDN(year: number, month: number, day: number): number {
  // Handle negative years (before epoch)
  if (year < 1) {
    // For negative years, calculate days before epoch
    // Work backwards: calculate total days from year down to 0 (inclusive)
    let totalDaysInYears = 0;
    for (let y = year; y <= 0; y++) {
      totalDaysInYears += getDaysInSakaYear(y);
    }
    
    // Calculate days in the target year up to this date
    let daysInYear = day - 1;
    for (let m = 1; m < month; m++) {
      daysInYear += getDaysInSakaMonth(year, m);
    }
    
    // Days before epoch = total days in all years from year to 0, minus days remaining in target year
    const daysBeforeEpoch = totalDaysInYears - daysInYear;
    
    return SAKA_EPOCH - daysBeforeEpoch;
  }
  
  // Normal case: year >= 1
  // Calculate days since Saka epoch
  let days = day - 1;
  
  // Add days from previous months in this year
  for (let m = 1; m < month; m++) {
    days += getDaysInSakaMonth(year, m);
  }
  
  // Add days from previous years
  let totalDays = 0;
  for (let y = 1; y < year; y++) {
    totalDays += getDaysInSakaYear(y);
  }
  
  return SAKA_EPOCH + totalDays + days;
}

/**
 * Convert Julian Day Number to Saka date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-12), and day
 */
export function jdnToSaka(jdn: number): { year: number; month: number; day: number } {
  const days = jdn - SAKA_EPOCH;
  
  // Handle dates before epoch (negative years)
  if (days < 0) {
    // Work backwards from epoch
    let remainingDays = -days;
    let year = 0;
    
    // Find the year by working backwards
    while (remainingDays > 0) {
      const yearLength = getDaysInSakaYear(year);
      if (remainingDays > yearLength) {
        remainingDays -= yearLength;
        year--;
      } else {
        // Found the year, now find month and day
        let month = 1;
        let day = remainingDays + 1;
        
        for (let m = 1; m <= 12; m++) {
          const monthDays = getDaysInSakaMonth(year, m);
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
    let totalDays = 0;
    for (let y = 1; y < year; y++) {
      totalDays += getDaysInSakaYear(y);
    }
    
    if (days < totalDays) {
      year--;
      continue;
    }
    
    const remainingDays = days - totalDays;
    
    // Calculate month and day
    let month = 1;
    let day = remainingDays + 1;
    
    for (let m = 1; m <= 12; m++) {
      const monthDays = getDaysInSakaMonth(year, m);
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
 * Indian National (Saka) Calendar Converter Implementation
 */
export const indianSakaCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    return sakaToJDN(year, month, day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToSaka(jdn);
    return {
      year,
      month,
      day,
      calendar: 'indian-saka',
      era: 'Saka'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO['indian-saka'];
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter which has Saka month names
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
    if (day > getDaysInSakaMonth(year, month)) {
      return null;
    }
    
    return {
      year,
      month,
      day,
      calendar: 'indian-saka',
      era: 'Saka'
    };
  }
};

