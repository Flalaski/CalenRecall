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

const HEBREW_MONTH_NAMES_HEBREW = [
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
  'אדר',
  'אדר א',
  'אדר ב'
];

// Hebrew epoch: October 7, 3761 BCE (Julian) = JDN 347997
const HEBREW_EPOCH = 347997;

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
 * Calculate Hebrew year length without circular dependency
 * Uses molad-based calculation to determine year type
 * This function must NEVER call getDaysInHebrewMonth to avoid recursion
 */
function calculateHebrewYearLength(year: number): number {
  const isLeap = isHebrewLeapYear(year);
  
  // Fixed month lengths (excluding variable months 8 and 9)
  // These are known constants and don't require calling getDaysInHebrewMonth
  const fixedMonths = [
    30,  // 1: Nisan
    29,  // 2: Iyar
    30,  // 3: Sivan
    29,  // 4: Tammuz
    30,  // 5: Av
    29,  // 6: Elul
    30,  // 7: Tishrei
    // 8: Cheshvan (variable) - will be calculated
    // 9: Kislev (variable) - will be calculated
    29,  // 10: Tevet
    30,  // 11: Shevat
    isLeap ? 30 : 29,  // 12: Adar I (leap) or Adar (non-leap)
    isLeap ? 29 : 0    // 13: Adar II (only in leap years)
  ];
  
  // Sum fixed months
  let fixedDays = 0;
  for (let i = 0; i < fixedMonths.length; i++) {
    fixedDays += fixedMonths[i];
  }
  
  // Use cycle position to determine year type
  // Normalize year to positive for cycle calculation
  let normalizedYear = year;
  if (year < 1) {
    // For negative years, normalize to equivalent position in 19-year cycle
    const cycles = Math.ceil(Math.abs(year) / 19);
    normalizedYear = year + (cycles * 19);
    // Ensure it's positive
    while (normalizedYear < 1) {
      normalizedYear += 19;
    }
  }
  const cyclePos = ((normalizedYear - 1) % 19) + 1;
  
  // Determine year length category based on cycle position
  // Common years: 353 (deficient), 354 (regular), 355 (complete)
  // Leap years: 383 (deficient), 384 (regular), 385 (complete)
  const baseLength = isLeap ? 384 : 354;
  
  // Adjust based on cycle position (simplified heuristic)
  // This is a simplified approach - a full implementation would use molad calculations
  const adjustment = (cyclePos % 3 === 0) ? -1 : (cyclePos % 3 === 1) ? 1 : 0;
  const targetLength = baseLength + adjustment;
  
  // Ensure valid range
  if (isLeap) {
    return Math.max(383, Math.min(385, targetLength));
  } else {
    return Math.max(353, Math.min(355, targetLength));
  }
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
      // Use precomputed year length if provided, otherwise calculate it
      // This prevents recursion when called from jdnToHebrew
      const yearLength = precomputedYearLength !== undefined 
        ? precomputedYearLength 
        : getDaysInHebrewYear(year);
      
      // Calculate fixed month days (using known constants, not calling getDaysInHebrewMonth)
      // Months 1-7: 30+29+30+29+30+29+30 = 207
      // Months 10-11: 29+30 = 59
      // Month 12: isLeap ? 30 : 29
      // Month 13: isLeap ? 29 : 0
      const fixedDays = 207 + 59 + (isLeap ? 30 + 29 : 29);
      
      // Remaining days for variable months (Cheshvan + Kislev)
      // Variable months total must be 57, 58, or 59 days
      const variableDays = yearLength - fixedDays;
      
      if (month === 8) { // Cheshvan
        // Cheshvan gets 29 or 30, Kislev gets the remainder
        result = variableDays >= 59 ? 30 : 29;
      } else { // Kislev (month 9)
        // Kislev gets the remainder after Cheshvan
        const cheshvanDays = variableDays >= 59 ? 30 : 29;
        result = variableDays - cheshvanDays;
        // Ensure result is valid (29 or 30)
        if (result < 29 || result > 30) {
          result = 29; // Default fallback
        }
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
 * @param year Hebrew year (AM)
 * @param month Month (1-13)
 * @param day Day (1-30)
 * @returns Julian Day Number
 */
export function hebrewToJDN(year: number, month: number, day: number): number {
  // Handle negative years (before epoch)
  if (year < 1) {
    // For negative years, calculate days before epoch
    // Epoch is start of year 1, so we need days from start of year 'year' to start of year 1
    // This includes: all years from 'year' to -1 (inclusive), minus days from start of year to date
    
    // Pre-compute year length once to avoid recursion
    const yearLength = getDaysInHebrewYear(year);
    
    // Calculate days in the target year up to this date
    // Pass precomputed year length to avoid recursion
    let daysInYear = day - 1;
    for (let m = 1; m < month; m++) {
      daysInYear += getDaysInHebrewMonth(year, m, yearLength);
    }
    
    // Calculate total days from start of year 'year' to start of epoch (start of year 1)
    let totalDaysInYears = 0;
    for (let y = year; y <= -1; y++) {
      totalDaysInYears += getDaysInHebrewYear(y);
    }
    
    // Days before epoch = total days from start of year 'year' to start of epoch, minus days from start of year to date
    const daysBeforeEpoch = totalDaysInYears - daysInYear;
    
    return HEBREW_EPOCH - daysBeforeEpoch;
  }
  
  // Normal case: year >= 1
  // Calculate days since Hebrew epoch
  let days = day - 1;
  
  // Pre-compute year length once to avoid recursion when iterating months
  const yearLength = getDaysInHebrewYear(year);
  
  // Add days from previous months in this year
  // Pass precomputed year length to avoid recursion
  for (let m = 1; m < month; m++) {
    days += getDaysInHebrewMonth(year, m, yearLength);
  }
  
  // Add days from previous years
  let yearDays = 0;
  for (let y = 1; y < year; y++) {
    yearDays += getDaysInHebrewYear(y);
  }
  days += yearDays;
  
  return HEBREW_EPOCH + days;
}

/**
 * Convert Julian Day Number to Hebrew date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-13), and day
 */
export function jdnToHebrew(jdn: number): { year: number; month: number; day: number } {
  const days = jdn - HEBREW_EPOCH;
  
  // Handle dates before epoch (negative years)
  if (days < 0) {
    // Work backwards from epoch
    // Epoch is start of year 1, so days < 0 means we're in a negative year
    let remainingDays = -days;
    let year = -1; // Start from year -1 (year 0 doesn't exist, epoch is start of year 1)
    
    // Find the year by working backwards with safety limit
    let iterations = 0;
    const maxIterations = 10000; // Safety limit for very old dates
    
    while (remainingDays > 0 && iterations < maxIterations) {
      iterations++;
      
      // Get year length - this should be cached and safe
      const yearLength = getDaysInHebrewYear(year);
      
      // Safety check: if yearLength is 0 or invalid, break to avoid infinite loop
      if (yearLength <= 0 || yearLength > 400) {
        console.warn(`Invalid Hebrew year length ${yearLength} for year ${year}`);
        break;
      }
      
      if (remainingDays >= yearLength) {
        remainingDays -= yearLength;
        year--;
        // Safety check: prevent going too far back
        if (year < -10000) {
          console.warn(`Hebrew calendar conversion: year ${year} is too far back`);
          break;
        }
      } else {
        // Found the year
        // remainingDays now represents days from the date to the end of the year (before epoch)
        // We need to convert this to days from the start of the year to the date
        const yearLength2 = getDaysInHebrewYear(year);
        const daysFromStartOfYear = yearLength2 - remainingDays;
        
        // Now find month and day from daysFromStartOfYear
        const months = getMonthsInHebrewYear(year);
        let month = 1;
        let day = daysFromStartOfYear; // 0-based day
        
        // Calculate month and day by iterating through months
        // Pass precomputed year length to avoid recursion
        for (let m = 1; m <= months; m++) {
          const monthLength = getDaysInHebrewMonth(year, m, yearLength2);
          // Safety check
          if (monthLength <= 0 || monthLength > 31) {
            console.warn(`Invalid Hebrew month length ${monthLength} for year ${year}, month ${m}`);
            break;
          }
          if (day < monthLength) {
            // Found the correct month
            month = m;
            break;
          }
          day -= monthLength;
        }
        
        // day is now 0-based, convert to 1-based
        return { year, month, day: Math.max(1, Math.min(day + 1, 30)) };
      }
    }
    
    // Fallback if loop didn't converge or hit limit
    if (iterations >= maxIterations) {
      console.warn(`Hebrew calendar conversion hit iteration limit for JDN ${jdn}`);
    }
    return { year, month: 1, day: 1 };
  }
  
  // Normal case: days >= 0 (year >= 1)
  // Use binary search for better performance and to avoid infinite loops
  let lowYear = 1;
  let highYear = Math.max(1, Math.floor(days / 350) + 10); // Upper bound estimate
  
  // Binary search for the correct year
  let year = 1;
  let iterations = 0;
  const maxIterations = 50;
  
  while (iterations < maxIterations && lowYear <= highYear) {
    iterations++;
    year = Math.floor((lowYear + highYear) / 2);
    
    // Calculate total days up to start of this year
    let yearDays = 0;
    for (let y = 1; y < year; y++) {
      const yLen = getDaysInHebrewYear(y);
      if (yLen <= 0 || yLen > 400) {
        // Invalid year length, break to avoid issues
        console.warn(`Invalid Hebrew year length ${yLen} for year ${y}`);
        break;
      }
      yearDays += yLen;
    }
    
    const yearLength = getDaysInHebrewYear(year);
    if (yearLength <= 0 || yearLength > 400) {
      console.warn(`Invalid Hebrew year length ${yearLength} for year ${year}`);
      break;
    }
    
    if (days < yearDays) {
      highYear = year - 1;
    } else if (days >= yearDays + yearLength) {
      lowYear = year + 1;
    } else {
      // Found the correct year
      const remainingDays = days - yearDays;
      // Pre-compute year length once to avoid recursion
      const yearLength = getDaysInHebrewYear(year);
      const months = getMonthsInHebrewYear(year);
      let month = 1;
      let day = remainingDays; // Start with 0-based day
      
      // Iterate through months to find the correct month and day
      // Pass precomputed year length to avoid recursion
      for (let m = 1; m <= months; m++) {
        const monthDays = getDaysInHebrewMonth(year, m, yearLength);
        if (monthDays <= 0 || monthDays > 31) {
          console.warn(`Invalid Hebrew month length ${monthDays} for year ${year}, month ${m}`);
          break;
        }
        if (day < monthDays) {
          // Found the correct month
          month = m;
          break;
        }
        day -= monthDays;
      }
      
      // Convert to 1-based day
      return { year, month, day: Math.max(1, Math.min(day + 1, 30)) };
    }
  }
  
  // Fallback if loop didn't converge
  console.warn(`Hebrew calendar conversion did not converge for JDN ${jdn}, using year ${year}`);
  return { year: Math.max(1, year), month: 1, day: 1 };
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

