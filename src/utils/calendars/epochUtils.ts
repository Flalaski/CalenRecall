/**
 * Epoch Utilities for Calendar Systems
 * 
 * Handles epoch calculations and negative year support for each calendar system.
 * Each calendar has its own epoch (year 1, month 1, day 1) which corresponds
 * to a specific Julian Day Number.
 */

import { CalendarSystem, CALENDAR_INFO } from './types';
import { gregorianToJDN, julianToJDN } from './julianDayUtils';

/**
 * Get the epoch JDN for a calendar system
 * This is the JDN of year 1, month 1, day 1 in that calendar
 */
export function getCalendarEpoch(calendar: CalendarSystem): number {
  const eraStart = CALENDAR_INFO[calendar].eraStart;
  
  switch (calendar) {
    case 'gregorian':
      // Gregorian year 1, January 1 = JDN 1721424
      return gregorianToJDN(1, 1, 1);
    
    case 'julian':
      // Julian year 1, January 1 = JDN 1721424 (same as Gregorian for year 1)
      return julianToJDN(1, 1, 1);
    
    case 'islamic':
      // Islamic year 1, Muharram 1 = July 16, 622 CE (Julian) = JDN 1948439
      return 1948439;
    
    case 'hebrew':
      // Hebrew year 1 AM, Tishrei 1 = October 7, 3761 BCE (Julian) = JDN 347997
      return 347997;
    
    case 'persian':
      // Persian year 1 SH, Farvardin 1 = March 19, 622 CE (Gregorian) = JDN 1948318
      return 1948318;
    
    case 'chinese':
      // Chinese calendar is complex - using approximate epoch
      // Year 1 of Chinese calendar (traditionally starts around 2697 BCE, but varies)
      // For simplicity, using a modern reference point
      return gregorianToJDN(1900, 2, 5); // Approximate
    
    case 'ethiopian':
      // Ethiopian year 1 EE, Meskerem 1 = August 29, 8 CE (Julian) = JDN 1724221
      return 1724221;
    
    case 'coptic':
      // Coptic year 1 AM, Tout 1 = August 29, 284 CE (Julian) = JDN 1825030
      return 1825030;
    
    case 'indian-saka':
      // Saka year 1, Chaitra 1 = March 22, 78 CE (Gregorian) = JDN 1749630
      return 1749630;
    
    case 'bahai':
      // Baháʼí year 1 BE, Naw-Rúz = March 21, 1844 CE (Gregorian) = JDN 2394647
      return 2394647;
    
    case 'thai-buddhist':
      // Thai Buddhist year 1 BE = 544 BCE (Gregorian) = January 1, 544 BCE
      // But since it's just Gregorian + 543, year 1 BE = 544 BCE Gregorian
      return gregorianToJDN(-543, 1, 1);
    
    case 'mayan-tzolkin':
    case 'mayan-haab':
    case 'mayan-longcount':
    case 'aztec-xiuhpohualli':
      // Mayan/Aztec epoch: August 11, 3114 BCE (Gregorian) = JDN 584283
      return 584283;
    
    case 'cherokee':
    case 'iroquois':
      // These are adaptations that align with Gregorian
      // Year 1 = 1 CE (Gregorian)
      return gregorianToJDN(1, 1, 1);
    
    default:
      // Default to Gregorian epoch
      return gregorianToJDN(1, 1, 1);
  }
}

/**
 * Check if a year is valid for a calendar system
 * Some calendars don't support years before their epoch
 */
export function isValidCalendarYear(calendar: CalendarSystem, year: number): boolean {
  // Most calendars support negative years (before year 1)
  // But some calendars have specific constraints
  return true; // For now, allow all years
}

/**
 * Get the era designation for a year in a calendar
 * Returns the era name (e.g., "CE", "AH", "AM") and whether it's before the epoch
 */
export function getEraForYear(calendar: CalendarSystem, year: number): {
  era: string;
  isBeforeEpoch: boolean;
  displayYear: number;
} {
  const info = CALENDAR_INFO[calendar];
  const eraName = info.eraName || '';
  
  if (year < 1) {
    // Year is before the epoch
    return {
      era: eraName,
      isBeforeEpoch: true,
      displayYear: year // Negative year
    };
  } else {
    return {
      era: eraName,
      isBeforeEpoch: false,
      displayYear: year
    };
  }
}

/**
 * Format a year with its era designation
 */
export function formatYearWithEra(calendar: CalendarSystem, year: number): string {
  const { era, isBeforeEpoch, displayYear } = getEraForYear(calendar, year);
  
  if (isBeforeEpoch) {
    // For negative years, show as negative with era
    return `${displayYear} ${era}`.trim();
  } else {
    return `${displayYear} ${era}`.trim();
  }
}

