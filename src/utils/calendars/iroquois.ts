/**
 * Iroquois (Haudenosaunee) Calendar Converter
 * 
 * The Iroquois calendar is a lunisolar calendar with 13 moons per year.
 * Each moon corresponds to a full moon cycle and is associated with
 * specific energies, purposes, and natural phenomena.
 * 
 * IMPROVED IMPLEMENTATION:
 * This implementation uses actual full moon cycles to determine the 13 moons,
 * which is more accurate to the traditional calendar than simple approximations.
 * Each moon begins at a full moon and lasts until the next full moon.
 * 
 * The calendar year is determined by finding 13 consecutive full moons
 * within a solar year period. The year typically begins near the winter solstice
 * or spring equinox, depending on the specific Haudenosaunee community.
 * 
 * Note: Different Haudenosaunee communities may have variations in moon names
 * and the exact start of the year. This implementation uses a standard approach
 * based on full moon cycles.
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';
import { nextFullMoonJDN, vernalEquinoxJDN } from './astronomicalUtils';

// Cache for Iroquois year data to avoid recalculation
interface IroquoisYearData {
  year: number;
  startJDN: number; // First full moon of the year
  moons: IroquoisMoonData[];
}

interface IroquoisMoonData {
  moonNumber: number; // 1-13
  startJDN: number;   // Full moon date (start of moon)
  endJDN: number;     // Next full moon date (end of moon)
  length: number;     // Days in moon
}

const iroquoisYearCache = new Map<number, IroquoisYearData>();

/**
 * Calculate Iroquois year start (first full moon near spring equinox)
 * The Iroquois year typically begins near the spring equinox
 * 
 * @param year Gregorian year
 * @returns Julian Day Number of the first full moon of the Iroquois year
 */
function iroquoisYearStartJDN(year: number): number {
  // Find spring equinox (vernal equinox) for the year
  const springEquinox = vernalEquinoxJDN(year);
  
  // Find the first full moon on or after the spring equinox
  // This is the start of the Iroquois year
  const firstFullMoon = nextFullMoonJDN(springEquinox - 1);
  
  return firstFullMoon;
}

/**
 * Calculate all 13 moons for an Iroquois year
 * @param year Gregorian year
 * @returns Iroquois year data with all moons
 */
function calculateIroquoisYear(year: number): IroquoisYearData {
  // Check cache first
  if (iroquoisYearCache.has(year)) {
    return iroquoisYearCache.get(year)!;
  }
  
  const startJDN = iroquoisYearStartJDN(year);
  const moons: IroquoisMoonData[] = [];
  
  // Calculate 13 consecutive full moons
  let currentFullMoon = startJDN;
  
  for (let moonNum = 1; moonNum <= 13; moonNum++) {
    // Get the next full moon after the current one (add 1 day to ensure we get the NEXT full moon)
    const nextFullMoon = nextFullMoonJDN(currentFullMoon + 1);
    const moonLength = nextFullMoon - currentFullMoon;
    
    // Safety check: ensure moon length is positive
    if (moonLength <= 0) {
      // Fallback: use approximate synodic month length
      const SYNODIC_MONTH = 29.53058867;
      const fallbackNextFullMoon = Math.round(currentFullMoon + SYNODIC_MONTH);
      const fallbackLength = fallbackNextFullMoon - currentFullMoon;
      
      moons.push({
        moonNumber: moonNum,
        startJDN: currentFullMoon,
        endJDN: fallbackNextFullMoon,
        length: fallbackLength
      });
      
      currentFullMoon = fallbackNextFullMoon;
    } else {
      moons.push({
        moonNumber: moonNum,
        startJDN: currentFullMoon,
        endJDN: nextFullMoon,
        length: moonLength
      });
      
      currentFullMoon = nextFullMoon;
    }
  }
  
  const yearData: IroquoisYearData = {
    year,
    startJDN,
    moons
  };
  
  // Cache the result
  iroquoisYearCache.set(year, yearData);
  
  return yearData;
}

/**
 * Convert Gregorian date to Iroquois 13-moon calendar
 * Uses actual full moon cycles
 */
function gregorianToIroquois(year: number, month: number, day: number): { year: number; moon: number; day: number } {
  const jdn = gregorianToJDN(year, month, day);
  
  // Find which Iroquois year this date belongs to
  // Check current year and previous year (since Iroquois year may start in previous Gregorian year)
  let iroquoisYear = year;
  let yearData = calculateIroquoisYear(iroquoisYear);
  
  // If date is before the year start, it belongs to previous Iroquois year
  if (jdn < yearData.startJDN) {
    iroquoisYear = year - 1;
    yearData = calculateIroquoisYear(iroquoisYear);
  }
  
  // Check if date is after the 13th moon (might belong to next Iroquois year)
  const lastMoon = yearData.moons[yearData.moons.length - 1];
  if (jdn >= lastMoon.endJDN) {
    // Check next year
    const nextYearData = calculateIroquoisYear(iroquoisYear + 1);
    if (jdn >= nextYearData.startJDN) {
      iroquoisYear = iroquoisYear + 1;
      yearData = nextYearData;
    }
  }
  
  // Find which moon this date falls in
  let targetMoon: IroquoisMoonData | null = null;
  for (const moon of yearData.moons) {
    if (jdn >= moon.startJDN && jdn < moon.endJDN) {
      targetMoon = moon;
      break;
    }
  }
  
  // If not found in current year, check if it's in the transition period
  if (!targetMoon) {
    // Might be in the last day of the 13th moon or first day of next year
    const lastMoon = yearData.moons[yearData.moons.length - 1];
    if (jdn >= lastMoon.startJDN && jdn < lastMoon.endJDN) {
      targetMoon = lastMoon;
    } else {
      // Check next year
      const nextYearData = calculateIroquoisYear(iroquoisYear + 1);
      if (jdn >= nextYearData.startJDN && jdn < nextYearData.moons[0].endJDN) {
        iroquoisYear = iroquoisYear + 1;
        yearData = nextYearData;
        targetMoon = yearData.moons[0];
      }
    }
  }
  
  if (!targetMoon) {
    // Fallback: use approximation
    const { year: fallbackYear, month: fallbackMonth, day: fallbackDay } = jdnToGregorian(jdn);
    const isLeap = (fallbackYear % 4 === 0 && fallbackYear % 100 !== 0) || (fallbackYear % 400 === 0);
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dayOfYear = fallbackDay;
    for (let i = 0; i < fallbackMonth - 1; i++) {
      dayOfYear += daysInMonth[i];
    }
    const daysPerMoon = Math.floor(365.25 / 13);
    const moon = Math.min(13, Math.floor((dayOfYear - 1) / daysPerMoon) + 1);
    const dayInMoon = ((dayOfYear - 1) % daysPerMoon) + 1;
    return { year: fallbackYear, moon, day: dayInMoon };
  }
  
  // Calculate day within the moon
  const dayInMoon = jdn - targetMoon.startJDN + 1;
  
  return {
    year: iroquoisYear,
    moon: targetMoon.moonNumber,
    day: dayInMoon
  };
}

/**
 * Convert Iroquois 13-moon date to Gregorian
 * Uses actual full moon cycles
 */
function iroquoisToGregorian(year: number, moon: number, day: number): { year: number; month: number; day: number } {
  const yearData = calculateIroquoisYear(year);
  
  // Validate moon number
  if (moon < 1 || moon > 13) {
    throw new Error(`Invalid Iroquois moon: ${moon} (must be 1-13)`);
  }
  
  // Get the moon data
  const moonData = yearData.moons[moon - 1];
  if (!moonData) {
    throw new Error(`Moon ${moon} not found in Iroquois year ${year}`);
  }
  
  // Calculate JDN for the day within the moon
  const jdn = moonData.startJDN + day - 1;
  
  // Validate day is within moon bounds
  if (jdn >= moonData.endJDN) {
    throw new Error(`Day ${day} exceeds moon ${moon} length (max ${moonData.length} days)`);
  }
  
  // Convert to Gregorian
  return jdnToGregorian(jdn);
}

/**
 * Iroquois Calendar Converter Implementation
 */
export const iroquoisCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // month is actually "moon" (1-13) in Iroquois calendar
    const gregorian = iroquoisToGregorian(year, month, day);
    return gregorianToJDN(gregorian.year, gregorian.month, gregorian.day);
  },
  
  fromJDN(jdn: number): CalendarDate {
    const { year, month, day } = jdnToGregorian(jdn);
    const iroquois = gregorianToIroquois(year, month, day);
    return {
      year: iroquois.year,
      month: iroquois.moon, // Store as "moon" but use month field
      day: iroquois.day,
      calendar: 'iroquois',
      era: 'CE'
    };
  },
  
  getInfo(): CalendarInfo {
    return CALENDAR_INFO.iroquois;
  },
  
  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    // Use the comprehensive formatter which has Iroquois moon names
    const { formatCalendarDate } = require('./dateFormatter');
    return formatCalendarDate(date, format);
  },
  
  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1], 10);
    const moon = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    
    if (moon < 1 || moon > 13 || day < 1 || day > 31) {
      return null;
    }
    
    return {
      year,
      month: moon, // Store moon in month field
      day,
      calendar: 'iroquois',
      era: 'CE'
    };
  }
};

