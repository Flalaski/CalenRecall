/**
 * Mayan Tzolk'in Calendar Converter
 * 
 * The Tzolk'in is a 260-day cycle calendar:
 * - 20 day names × 13 numbers = 260 days
 * - Day names: Imix, Ik', Ak'b'al, K'an, Chikchan, Kimi, Manik', Lamat, Muluk, Ok,
 *   Chuwen, Eb', B'en, Ix, Men, K'ib', Kab'an, Etz'nab', Kawak, Ajaw
 * - Numbers: 1-13 (repeating)
 * 
 * The cycle repeats every 260 days.
 * 
 * Correlation constant (GMT): 584283 (JDN of August 11, 3114 BCE)
 * This is the Mayan epoch (0.0.0.0.0 in Long Count)
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';

// GMT correlation constant: JDN of Mayan epoch (August 11, 3114 BCE)
const MAYAN_EPOCH = 584283;

// Tzolk'in day names (20 names)
const TZOLKIN_DAY_NAMES = [
  'Imix', 'Ik\'', 'Ak\'b\'al', 'K\'an', 'Chikchan', 'Kimi', 'Manik\'', 'Lamat', 'Muluk', 'Ok',
  'Chuwen', 'Eb\'', 'B\'en', 'Ix', 'Men', 'K\'ib\'', 'Kab\'an', 'Etz\'nab\'', 'Kawak', 'Ajaw'
];

/**
 * Convert Tzolk'in date to day number in the 260-day cycle
 * @param number The number (1-13)
 * @param dayNameIndex The index of the day name (0-19)
 * @returns Day number in cycle (0-259)
 */
function tzolkinToDayNumber(number: number, dayNameIndex: number): number {
  // The Tzolk'in combines a 13-day cycle (numbers) with a 20-day cycle (names)
  // To find the position in the 260-day cycle, we use modular arithmetic
  // The formula: position = (number - 1 + (dayNameIndex * 13)) % 260
  // But we need to find the actual position where this combination occurs
  
  // Find the position where this combination occurs
  for (let pos = 0; pos < 260; pos++) {
    const posNumber = (pos % 13) + 1;
    const posDayNameIndex = pos % 20;
    if (posNumber === number && posDayNameIndex === dayNameIndex) {
      return pos;
    }
  }
  return 0; // Should never reach here
}

/**
 * Convert day number in 260-day cycle to Tzolk'in date
 * @param dayNumber Day number in cycle (0-259)
 * @returns Object with number (1-13) and dayNameIndex (0-19)
 */
function dayNumberToTzolkin(dayNumber: number): { number: number; dayNameIndex: number } {
  const number = (dayNumber % 13) + 1;
  const dayNameIndex = dayNumber % 20;
  return { number, dayNameIndex };
}

export const mayanTzolkinCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // In Tzolk'in, "year" is actually the cycle number, "month" is the day name index (1-20),
    // and "day" is the number (1-13)
    // For simplicity, we'll use: year = cycle number, month = day name index, day = number
    
    const dayNameIndex = month - 1; // Convert to 0-based
    const number = day;
    
    // Calculate the day number in the 260-day cycle
    const dayNumber = tzolkinToDayNumber(number, dayNameIndex);
    
    // Handle negative years (before epoch)
    if (year < 1) {
      // For negative years, calculate days before epoch
      // Year -1 means 1 cycle before epoch, year -2 means 2 cycles before, etc.
      // If we're at year -1, dayNumber 0, we need 1 cycle (260 days) to reach epoch
      // If we're at year -1, dayNumber 100, we need 100 days to reach epoch
      // So: days before epoch = (Math.abs(year) - 1) * 260 + (260 - dayNumber)
      const cyclesBefore = Math.abs(year) - 1;
      const daysInCurrentCycle = 260 - dayNumber;
      const totalDays = cyclesBefore * 260 + daysInCurrentCycle;
      
      return MAYAN_EPOCH - totalDays;
    }
    
    // Normal case: year >= 1
    // Calculate total days: (year - 1) * 260 + dayNumber
    const totalDays = (year - 1) * 260 + dayNumber;
    
    return MAYAN_EPOCH + totalDays;
  },

  fromJDN(jdn: number): CalendarDate {
    // Calculate days since Mayan epoch
    const daysSinceEpoch = jdn - MAYAN_EPOCH;
    
    // Handle dates before epoch (negative years)
    if (daysSinceEpoch < 0) {
      // Work backwards from epoch
      const absDays = Math.abs(daysSinceEpoch);
      // If absDays = 260, we're at the start of year -1 (1 cycle before epoch)
      // If absDays = 1, we're at day 259 of year -1
      // So: cycle = Math.ceil(absDays / 260) - 1, but we need to handle the day number correctly
      const cycle = Math.ceil(absDays / 260) - 1;
      const dayNumber = absDays % 260 === 0 ? 0 : 260 - (absDays % 260);
      
      // Convert day number to Tzolk'in components
      const { number, dayNameIndex } = dayNumberToTzolkin(dayNumber === 260 ? 0 : dayNumber);
      
      return {
        year: -(cycle + 1), // Negative cycle number (year -1 = 1 cycle before epoch)
        month: dayNameIndex + 1, // Day name index (1-based)
        day: number, // Number (1-13)
        calendar: 'mayan-tzolkin',
        era: ''
      };
    }
    
    // Normal case: daysSinceEpoch >= 0 (year >= 1)
    // Calculate which 260-day cycle we're in
    const cycle = Math.floor(daysSinceEpoch / 260);
    const dayNumber = daysSinceEpoch % 260;
    
    // Convert day number to Tzolk'in components
    const { number, dayNameIndex } = dayNumberToTzolkin(dayNumber);
    
    return {
      year: cycle + 1, // Cycle number (1-based)
      month: dayNameIndex + 1, // Day name index (1-based)
      day: number, // Number (1-13)
      calendar: 'mayan-tzolkin',
      era: ''
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO['mayan-tzolkin'];
  },

  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    const dayName = TZOLKIN_DAY_NAMES[date.month - 1] || '';
    return format
      .replace(/YYYY/g, date.year.toString())
      .replace(/YY/g, date.year.toString().slice(-2))
      .replace(/MMMM/g, dayName)
      .replace(/MMM/g, dayName.substring(0, 3))
      .replace(/MM/g, date.month.toString().padStart(2, '0'))
      .replace(/\bM\b/g, date.month.toString())
      .replace(/DD/g, date.day.toString().padStart(2, '0'))
      .replace(/\bD\b/g, date.day.toString())
      .replace(/ERA/g, date.era || '');
  },

  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 20 || day < 1 || day > 13) {
      return null;
    }

    return {
      year,
      month,
      day,
      calendar: 'mayan-tzolkin',
      era: ''
    };
  }
};

