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


/** Native Coptic script month names (Unicode Coptic block: U+2C80–U+2CFF) */
export const COPTIC_MONTH_NAMES_NATIVE = [
  'Ⲑⲱⲟⲩⲧ', 'Ⲡⲁⲟⲡⲓ', 'Ⲁⲑⲱⲣ', 'Ⲕⲟⲓⲁⲕ', 'Ⲧⲱⲃⲓ', 'Ⲙⲉϣⲓⲣ',
  'Ⲡⲁⲣⲉⲙϩⲁⲧ', 'Ⲡⲁⲣⲙⲟⲩⲧⲉ', 'Ⲡⲁϣⲟⲛⲥ', 'Ⲡⲁⲱⲛⲓ',
  'Ⲉⲡⲓⲡ', 'Ⲙⲉⲥⲱⲣⲓ', 'Ⲡⲓⲕⲟⲩϫⲓ ⲛ̀ⲁⲃⲟⲧ'
];

// Coptic epoch: August 29, 284 CE (Julian) = Tout 1, 1 AM
// Note: August 29, 284 CE in Julian calendar
// Using Julian calendar conversion: JDN = 1825030
const COPTIC_EPOCH = 1825030;

/**
 * Check if a Coptic year is a leap year.
 * CORRECT RULE (D&R): the 6-day Pi Kogi Enavot falls in years where
 * year mod 4 === 3 — the Coptic leap year PRECEDES the Julian leap year.
 * (Verified: Nayrouz 2023 fell on Sep 12 because year 1739 was leap;
 * 1739 % 4 === 3.) The previous `% 4 === 0` rule shifted the leap day by
 * one year within every 4-year cycle.
 */
export function isCopticLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
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
 * Convert Coptic date to Julian Day Number.
 * Closed-form Dershowitz & Reingold arithmetic (§4): works proleptically
 * for all years (including <= 0) with no iteration.
 * @param year Coptic year (AM - Anno Martyrum)
 * @param month Month (1-13)
 * @param day Day (1-30, or 1-5/6 for month 13)
 * @returns Julian Day Number
 */
export function copticToJDN(year: number, month: number, day: number): number {
  return (
    COPTIC_EPOCH - 1 +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * (month - 1) +
    day
  );
}

/**
 * Convert Julian Day Number to Coptic date.
 * Closed-form inverse (no loops; proleptic for dates before the epoch).
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-13), and day
 */
export function jdnToCoptic(jdn: number): { year: number; month: number; day: number } {
  const year = Math.floor((4 * (jdn - COPTIC_EPOCH) + 1463) / 1461);
  const month = Math.floor((jdn - copticToJDN(year, 1, 1)) / 30) + 1;
  const day = jdn + 1 - copticToJDN(year, month, 1);
  return { year, month, day };
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

