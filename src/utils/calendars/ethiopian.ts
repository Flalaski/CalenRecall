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


/** Native Ge'ez (Ethiopic) month names */
export const ETHIOPIAN_MONTH_NAMES_GE_EZ = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

// Ethiopian epoch: August 29, 8 CE (Julian) = Meskerem 1, 1 EE
// JDN of August 29, 8 CE (Julian) = 1724221
const ETHIOPIAN_EPOCH = 1724221;

/**
 * Check if an Ethiopian year is a leap year.
 * CORRECT RULE (D&R): the 6-day Pagume falls in years where year mod 4 === 3
 * — the Ethiopian leap year PRECEDES the Julian leap year. (Verified: 2015 EE
 * had Pagume 6 on 2023-09-11; 2015 % 4 === 3.) The previous `% 4 === 0` rule
 * shifted the leap day by one year within every 4-year cycle.
 */
export function isEthiopianLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
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
 * Convert Ethiopian date to Julian Day Number.
 * Closed-form Dershowitz & Reingold arithmetic (§4 Coptic/Ethiopic family):
 * works proleptically for all years (including <= 0) with no iteration.
 * @param year Ethiopian year (EE)
 * @param month Month (1-13)
 * @param day Day (1-30, or 1-5/6 for month 13)
 * @returns Julian Day Number
 */
export function ethiopianToJDN(year: number, month: number, day: number): number {
  return (
    ETHIOPIAN_EPOCH - 1 +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * (month - 1) +
    day
  );
}

/**
 * Convert Julian Day Number to Ethiopian date.
 * Closed-form inverse (no loops; proleptic for dates before the epoch).
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-13), and day
 */
export function jdnToEthiopian(jdn: number): { year: number; month: number; day: number } {
  const year = Math.floor((4 * (jdn - ETHIOPIAN_EPOCH) + 1463) / 1461);
  const month = Math.floor((jdn - ethiopianToJDN(year, 1, 1)) / 30) + 1;
  const day = jdn + 1 - ethiopianToJDN(year, month, 1);
  return { year, month, day };
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
    // Basic formatting — month names handled by comprehensive formatter
    const monthStr = String(date.month).padStart(2, '0');
    const dayStr = String(date.day).padStart(2, '0');
    return format
      .replace(/YYYY/g, date.year.toString())
      .replace(/YY/g, date.year.toString().slice(-2))
      .replace(/MM/g, monthStr)
      .replace(/DD/g, dayStr)
      .replace(/ERA/g, date.era || '');
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

