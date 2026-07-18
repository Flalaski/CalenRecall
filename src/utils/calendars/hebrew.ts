/**
 * Hebrew (Jewish) Calendar Converter
 * 
 * A lunisolar calendar with 12-13 months per year.
 * Uses a 19-year Metonic cycle to align lunar months with solar years.
 * 
 * Era: Starts from 3761 BCE (Anno Mundi - Year of the World)
 * Era designation: AM (Anno Mundi)
 * 
 * Algorithm based on "Calendrical Calculations" by Dershowitz & Reingold
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';

const HEBREW_MONTH_NAMES = [
  'Nisan',
  'Iyar',
  'Sivan',
  'Tammuz',
  'Av',
  'Elul',
  'Tishrei',
  'Cheshvan',
  'Kislev',
  'Tevet',
  'Shevat',
  'Adar',
  'Adar I',  // Leap month
  'Adar II'  // Regular Adar in leap years
];

/** Native Hebrew month names (incl. leap month variants) */
export const HEBREW_MONTH_NAMES_HEBREW = [
  'ניסן',
  'אייר',
  'סיוון',
  'תמוז',
  'אב',
  'אלול',
  'תשרי',
  'חשוון',
  'כסלו',
  'טבת',
  'שבט',
  'אדר א׳',   // Leap month (Adar I)
  'אדר ב׳',   // Regular Adar in leap years (Adar II)
];

// Hebrew epoch: 1 Tishrei 1 AM = R.D. −1373427 (Dershowitz & Reingold) =
// JDN 347998 in the standard noon-JDN convention used by julianDayUtils.
// Empirically anchored against modern Rosh Hashanah dates (5784 → 2023-09-16,
// 5785 → 2024-10-03, 5786 → 2025-09-23). The previously-documented 347997
// came from an off-by-one in proleptic negative-year Julian conversion.
const HEBREW_EPOCH = 347998;

/** True modulo (result always in [0, b) even for negative a) */
function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/**
 * Days elapsed from the Hebrew epoch to the molad-based new year of `year`,
 * including the molad zaken / Monday-Wednesday-Friday postponement folded in.
 * Canonical `hebrew-calendar-elapsed-days` from Dershowitz & Reingold,
 * "Calendrical Calculations" (4th ed., §8.2).
 * 1 lunar month = 29 days 12 h 793 parts (25920 parts/day, 13753 parts excess
 * per month); months elapsed = ⌊(235·year − 234) / 19⌋ via the Metonic cycle.
 */
function hebrewCalendarElapsedDays(year: number): number {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  let days = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  if (mod(3 * (days + 1), 7) < 3) {
    days += 1; // postponement: molad on Sun/Wed/Fri (lo ADU rosh)
  }
  return days;
}

/**
 * Additional new-year delays (dechiyot) preventing invalid year lengths
 * (D&R `hebrew-new-year-delay`).
 */
function hebrewNewYearDelay(year: number): number {
  const ny0 = hebrewCalendarElapsedDays(year - 1);
  const ny1 = hebrewCalendarElapsedDays(year);
  const ny2 = hebrewCalendarElapsedDays(year + 1);
  if (ny2 - ny1 === 356) return 2; // next year would be too long
  if (ny1 - ny0 === 382) return 1; // previous year would be too short
  return 0;
}

/**
 * JDN of 1 Tishrei (Rosh Hashanah) of the given Hebrew year.
 * Works proleptically for year <= 0 (continuous arithmetic).
 */
export function hebrewNewYearJDN(year: number): number {
  return HEBREW_EPOCH + hebrewCalendarElapsedDays(year) + hebrewNewYearDelay(year);
}

/**
 * Check if a Hebrew year is a leap year
 * @param year Hebrew year (AM)
 * @returns true if leap year
 */
export function isHebrewLeapYear(year: number): boolean {
  // In 19-year Metonic cycle, leap years are: 3, 6, 8, 11, 14, 17, 19
  // Handle negative years by normalizing to positive cycle position
  let normalizedYear = year;
  if (year < 1) {
    // For negative years, find equivalent position in cycle
    // Add enough cycles to make it positive
    const cycles = Math.ceil(Math.abs(year) / 19);
    normalizedYear = year + (cycles * 19);
  }
  const position = ((normalizedYear - 1) % 19) + 1;
  // Leap years in 19-year cycle: 3, 6, 8, 11, 14, 17, 19
  return [3, 6, 8, 11, 14, 17, 19].includes(position);
}

/**
 * Get the number of months in a Hebrew year
 * @param year Hebrew year (AM)
 * @returns 12 or 13
 */
export function getMonthsInHebrewYear(year: number): number {
  return isHebrewLeapYear(year) ? 13 : 12;
}

// Cache for year lengths to avoid circular recursion
const yearLengthCache = new Map<number, number>();

/**
 * Calculate Hebrew year length via molad arithmetic:
 * the exact span between consecutive Rosh Hashanah dates.
 * (Replaces the previous `cyclePos % 3` heuristic, which accumulated
 * ~3 years of drift by the modern era — found in granular audit 2026-07-17.)
 */
function calculateHebrewYearLength(year: number): number {
  return hebrewNewYearJDN(year + 1) - hebrewNewYearJDN(year);
}

/**
 * Get the number of days in a Hebrew year
 * @param year Hebrew year (AM)
 * @returns Number of days (353-355 for common years, 383-385 for leap years)
 */
export function getDaysInHebrewYear(year: number): number {
  // Check cache first
  if (yearLengthCache.has(year)) {
    return yearLengthCache.get(year)!;
  }
  
  const length = calculateHebrewYearLength(year);
  yearLengthCache.set(year, length);
  return length;
}

/**
 * Get the number of days in a Hebrew month
 * @param year Hebrew year (AM)
 * @param month Month (1-13)
 * @returns Number of days (29 or 30)
 */
// Cache for month lengths to prevent recursion
const monthLengthCache = new Map<string, number>();
// Recursion guard to prevent infinite loops - track all months being calculated
const calculatingMonths = new Set<string>();

/**
 * Get the number of days in a Hebrew month
 * @param year Hebrew year (AM)
 * @param month Month (1-13)
 * @param precomputedYearLength Optional precomputed year length to avoid recursion
 * @returns Number of days (29 or 30)
 */
export function getDaysInHebrewMonth(year: number, month: number, precomputedYearLength?: number): number {
  // Check cache first to prevent recursion
  const cacheKey = `${year}-${month}`;
  if (monthLengthCache.has(cacheKey)) {
    return monthLengthCache.get(cacheKey)!;
  }
  
  // Recursion guard - if we're already calculating this specific month, return default to break recursion
  if (calculatingMonths.has(cacheKey)) {
    // Return default value to break recursion
    const isLeap = isHebrewLeapYear(year);
    if (month === 8 || month === 9) {
      return 29; // Default for variable months
    }
    if (month === 12) {
      return isLeap ? 30 : 29;
    }
    if (month === 13) {
      return 29; // Adar II
    }
    // Fixed months: odd months (1,3,5,7,11) = 30, even months (2,4,6,10) = 29
    return (month % 2 === 1) ? 30 : 29;
  }
  
  // Mark as calculating (per-month tracking only - don't use global flag to allow parallel calculations)
  calculatingMonths.add(cacheKey);
  
  try {
    const isLeap = isHebrewLeapYear(year);
    
    // Month lengths (can vary for Cheshvan and Kislev)
    const monthLengths: Record<number, number | 'variable'> = {
      1: 30,   // Nisan
      2: 29,   // Iyar
      3: 30,   // Sivan
      4: 29,   // Tammuz
      5: 30,   // Av
      6: 29,   // Elul
      7: 30,   // Tishrei
      8: 'variable', // Cheshvan (29 or 30)
      9: 'variable', // Kislev (29 or 30)
      10: 29,  // Tevet
      11: 30,  // Shevat
      12: isLeap ? 30 : 29, // Adar I (leap) or Adar (non-leap)
      13: 29   // Adar II (only in leap years)
    };
    
    const length = monthLengths[month];
    let result: number;
    
    if (length === 'variable') {
      // Canonical rules (D&R): year length mod 10 encodes the year type.
      // 355/385 ("complete")  → Cheshvan 30, Kislev 30
      // 354/384 ("regular")   → Cheshvan 29, Kislev 30
      // 353/383 ("deficient") → Cheshvan 29, Kislev 29
      // (The previous remainder-split produced an invalid 29/29 for regular years.)
      const yearLength = precomputedYearLength !== undefined 
        ? precomputedYearLength 
        : getDaysInHebrewYear(year);
      
      if (month === 8) { // Cheshvan
        result = mod(yearLength, 10) === 5 ? 30 : 29;
      } else { // Kislev (month 9)
        result = mod(yearLength, 10) === 3 ? 29 : 30;
      }
    } else {
      result = length;
    }
    
    // Cache the result
    monthLengthCache.set(cacheKey, result);
    return result;
  } finally {
    // Always remove from calculating set
    calculatingMonths.delete(cacheKey);
  }
}

/**
 * Convert Hebrew date to Julian Day Number
 * Month numbering is ecclesiastical (1 = Nisan), but the AM YEAR begins at
 * 1 Tishrei (month 7) — so Tishrei..Adar of a given AM year come BEFORE
 * Nisan..Elul of that same year. (The previous implementation started the
 * year at Nisan, mis-attributing half of every year.)
 * @param year Hebrew year (AM)
 * @param month Month (1-13, 1 = Nisan)
 * @param day Day (1-30)
 * @returns Julian Day Number
 */
export function hebrewToJDN(year: number, month: number, day: number): number {
  let jdn = hebrewNewYearJDN(year) + day - 1;
  const yearLength = getDaysInHebrewYear(year);
  const lastMonth = getMonthsInHebrewYear(year);
  
  if (month < 7) {
    // Months Tishrei(7)..end of year come first, then Nisan(1)..month-1
    for (let m = 7; m <= lastMonth; m++) {
      jdn += getDaysInHebrewMonth(year, m, yearLength);
    }
    for (let m = 1; m < month; m++) {
      jdn += getDaysInHebrewMonth(year, m, yearLength);
    }
  } else {
    for (let m = 7; m < month; m++) {
      jdn += getDaysInHebrewMonth(year, m, yearLength);
    }
  }
  
  return jdn;
}

/**
 * Convert Julian Day Number to Hebrew date
 * O(1) year estimate from the mean year length (35975351/98496 days),
 * refined by at most a few new-year comparisons — no year-by-year scanning.
 * Works proleptically for dates before the epoch (continuous arithmetic).
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-13, 1 = Nisan), and day
 */
export function jdnToHebrew(jdn: number): { year: number; month: number; day: number } {
  // Mean Hebrew year = 235 lunations / 19 = 35975351/98496 days ≈ 365.2468
  let year = Math.floor(((jdn - HEBREW_EPOCH) * 98496) / 35975351) + 1;
  while (hebrewNewYearJDN(year) > jdn) year--;
  while (hebrewNewYearJDN(year + 1) <= jdn) year++;
  
  const yearLength = getDaysInHebrewYear(year);
  const lastMonth = getMonthsInHebrewYear(year);
  
  // Walk months in civil order: Tishrei(7)..lastMonth, then Nisan(1)..Elul(6)
  let monthStart = hebrewNewYearJDN(year);
  const civilOrder: number[] = [];
  for (let m = 7; m <= lastMonth; m++) civilOrder.push(m);
  for (let m = 1; m <= 6; m++) civilOrder.push(m);
  
  for (const m of civilOrder) {
    const monthLength = getDaysInHebrewMonth(year, m, yearLength);
    if (jdn < monthStart + monthLength) {
      return { year, month: m, day: jdn - monthStart + 1 };
    }
    monthStart += monthLength;
  }
  
  // Unreachable if year search is correct; clamp defensively
  return { year, month: 6, day: 29 };
}

/**
 * Hebrew Calendar Converter Implementation
 */
export const hebrewCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    return hebrewToJDN(year, month, day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToHebrew(jdn);
    return {
      year,
      month,
      day,
      calendar: 'hebrew',
      era: 'AM'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO.hebrew;
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    const year = date.year.toString().padStart(4, '0');
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('MMMM', HEBREW_MONTH_NAMES[date.month - 1] || '')
      .replace('MMM', (HEBREW_MONTH_NAMES[date.month - 1] || '').substring(0, 3))
      .replace('ERA', date.era || 'AM');
  },
  
  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    
    const maxMonth = getMonthsInHebrewYear(year);
    if (month < 1 || month > maxMonth || day < 1 || day > 30) {
      return null;
    }
    
    return {
      year,
      month,
      day,
      calendar: 'hebrew',
      era: 'AM'
    };
  }
};

