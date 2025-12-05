/**
 * Mayan Long Count Calendar Converter
 * 
 * The Mayan Long Count is a linear count of days from a fixed epoch.
 * It uses a positional notation system:
 * - Baktun: 144,000 days (20 katuns)
 * - Katun: 7,200 days (20 tuns)
 * - Tun: 360 days (18 uinals)
 * - Uinal: 20 days
 * - Kin: 1 day
 * 
 * Epoch: August 11, 3114 BCE (Gregorian) = JDN 584283
 * This is the same epoch as the other Mayan calendars (GMT correlation).
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';

// GMT correlation constant: JDN of Mayan epoch (August 11, 3114 BCE)
const MAYAN_EPOCH = 584283;

// Long Count units in days
const KIN_PER_UINAL = 20;
const UINAL_PER_TUN = 18;
const TUN_PER_KATUN = 20;
const KATUN_PER_BAKTUN = 20;

const DAYS_PER_UINAL = KIN_PER_UINAL; // 20
const DAYS_PER_TUN = UINAL_PER_TUN * DAYS_PER_UINAL; // 360
const DAYS_PER_KATUN = TUN_PER_KATUN * DAYS_PER_TUN; // 7,200
const DAYS_PER_BAKTUN = KATUN_PER_BAKTUN * DAYS_PER_KATUN; // 144,000

/**
 * Convert Long Count components (baktun, katun, tun, uinal, kin) to total days since epoch
 */
function longCountToDays(baktun: number, katun: number, tun: number, uinal: number, kin: number): number {
  return baktun * DAYS_PER_BAKTUN +
         katun * DAYS_PER_KATUN +
         tun * DAYS_PER_TUN +
         uinal * DAYS_PER_UINAL +
         kin;
}

/**
 * Convert total days since epoch to Long Count components
 */
function daysToLongCount(days: number): { baktun: number; katun: number; tun: number; uinal: number; kin: number } {
  let remainingDays = days;
  
  const baktun = Math.floor(remainingDays / DAYS_PER_BAKTUN);
  remainingDays = remainingDays % DAYS_PER_BAKTUN;
  
  const katun = Math.floor(remainingDays / DAYS_PER_KATUN);
  remainingDays = remainingDays % DAYS_PER_KATUN;
  
  const tun = Math.floor(remainingDays / DAYS_PER_TUN);
  remainingDays = remainingDays % DAYS_PER_TUN;
  
  const uinal = Math.floor(remainingDays / DAYS_PER_UINAL);
  remainingDays = remainingDays % DAYS_PER_UINAL;
  
  const kin = remainingDays;
  
  return { baktun, katun, tun, uinal, kin };
}

/**
 * Convert Long Count date to JDN
 * 
 * For our CalendarDate interface, we encode all 5 components:
 * - year = baktun
 * - month = katun
 * - day = tun * 400 + uinal * 20 + kin
 *   This encoding allows us to store all components in the day field:
 *   - tun: floor(day / 400)
 *   - uinal: floor((day % 400) / 20)
 *   - kin: day % 20
 * 
 * This allows full Long Count representation while working within the CalendarDate interface.
 */
export const mayanLongCountCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // Decode components from CalendarDate format
    const baktun = year;
    const katun = month;
    
    // Decode tun, uinal, kin from day field
    // day = tun * 400 + uinal * 20 + kin
    const tun = Math.floor(day / 400);
    const remainingAfterTun = day % 400;
    const uinal = Math.floor(remainingAfterTun / 20);
    const kin = remainingAfterTun % 20;
    
    // Validate components
    if (uinal >= 18) {
      throw new Error(`Invalid uinal: ${uinal} (must be 0-17)`);
    }
    if (kin >= 20) {
      throw new Error(`Invalid kin: ${kin} (must be 0-19)`);
    }
    
    const daysSinceEpoch = longCountToDays(baktun, katun, tun, uinal, kin);
    return MAYAN_EPOCH + daysSinceEpoch;
  },

  fromJDN(jdn: number): CalendarDate {
    const daysSinceEpoch = jdn - MAYAN_EPOCH;
    
    // Handle negative days (dates before epoch)
    if (daysSinceEpoch < 0) {
      // For dates before epoch, calculate components
      // Long Count doesn't traditionally use negative numbers, but we'll represent
      // pre-epoch dates by working backwards from epoch
      const absDays = Math.abs(daysSinceEpoch);
      const { baktun, katun, tun, uinal, kin } = daysToLongCount(absDays);
      
      // Return negative representation for pre-epoch dates
      // Encode tun, uinal, kin in day field
      const encodedDay = tun * 400 + uinal * 20 + kin;
      
      return {
        year: -baktun,
        month: -katun,
        day: -encodedDay,
        calendar: 'mayan-longcount',
        era: 'BCE'
      };
    }
    
    // Normal case: dates at or after epoch
    const { baktun, katun, tun, uinal, kin } = daysToLongCount(daysSinceEpoch);
    
    // Encode tun, uinal, kin in day field
    // day = tun * 400 + uinal * 20 + kin
    const encodedDay = tun * 400 + uinal * 20 + kin;
    
    return {
      year: baktun,
      month: katun,
      day: encodedDay,
      calendar: 'mayan-longcount',
      era: ''
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO['mayan-longcount'];
  },

  formatDate(date: CalendarDate, format: string = 'YYYY.MM.DD'): string {
    // Decode all 5 components from CalendarDate format
    const baktun = date.year;
    const katun = date.month;
    
    // Decode tun, uinal, kin from day field
    const absDay = Math.abs(date.day);
    const tun = Math.floor(absDay / 400);
    const remainingAfterTun = absDay % 400;
    const uinal = Math.floor(remainingAfterTun / 20);
    const kin = remainingAfterTun % 20;
    
    // Handle negative dates (before epoch)
    const signPrefix = date.day < 0 ? '-' : '';
    
    // Default format for Long Count: baktun.katun.tun.uinal.kin
    if (format.includes('.')) {
      return `${signPrefix}${baktun}.${katun}.${tun}.${uinal}.${kin}`;
    }
    
    // Fallback to standard formatting
    return `${signPrefix}${baktun}.${katun}.${tun}.${uinal}.${kin}`;
  },

  parseDate(dateString: string): CalendarDate {
    // Parse Long Count notation: baktun.katun.tun.uinal.kin
    // Also handle negative dates: -baktun.katun.tun.uinal.kin
    const trimmed = dateString.trim();
    const isNegative = trimmed.startsWith('-');
    const parts = (isNegative ? trimmed.substring(1) : trimmed)
      .split('.')
      .map(p => parseInt(p.trim(), 10));
    
    if (parts.length < 3) {
      throw new Error(`Invalid Long Count date format: ${dateString} (need at least baktun.katun.tun)`);
    }
    
    const baktun = (parts[0] || 0) * (isNegative ? -1 : 1);
    const katun = (parts[1] || 0) * (isNegative ? -1 : 1);
    const tun = parts[2] || 0;
    const uinal = parts[3] || 0;
    const kin = parts[4] || 0;
    
    // Validate components
    if (uinal < 0 || uinal >= 18) {
      throw new Error(`Invalid uinal: ${uinal} (must be 0-17)`);
    }
    if (kin < 0 || kin >= 20) {
      throw new Error(`Invalid kin: ${kin} (must be 0-19)`);
    }
    
    // Convert to JDN first, then back to our format
    // Note: uinal and kin are included in the conversion for accuracy
    const daysSinceEpoch = longCountToDays(Math.abs(baktun), Math.abs(katun), tun, uinal, kin);
    const jdn = MAYAN_EPOCH + (isNegative ? -daysSinceEpoch : daysSinceEpoch);
    
    return this.fromJDN(jdn);
  }
};

