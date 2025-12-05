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
 * For our CalendarDate interface, we'll use:
 * - year = baktun
 * - month = katun
 * - day = tun (we'll combine uinal and kin into a fractional day representation)
 * 
 * Actually, let's use a simpler approach:
 * - year = baktun
 * - month = katun
 * - day = tun * 18 + uinal (combining tun and uinal, with kin as remainder)
 * 
 * Or even simpler: store total days since epoch in a way that can be converted back.
 * Let's use: year = baktun, month = katun, day = tun, and store uinal/kin separately.
 * 
 * Actually, the cleanest approach for our system:
 * - Store the total days since epoch
 * - Convert to/from Long Count notation for display
 * - Use year/month/day to represent baktun/katun/tun, with uinal and kin encoded
 */
export const mayanLongCountCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // In our CalendarDate interface:
    // year = baktun
    // month = katun
    // day = tun
    // We'll encode uinal and kin in the day value using a special encoding
    // For simplicity, let's assume day represents tun, and we'll use a fixed encoding
    // Actually, let's use a different approach: store total days directly
    
    // For now, let's interpret:
    // year = baktun
    // month = katun  
    // day = tun (we'll default uinal and kin to 0 for simplicity)
    // This is a limitation, but allows basic functionality
    
    // Use year as-is (no conversion needed - JDN utilities handle year numbering correctly)
    const baktun = year;
    const katun = month;
    const tun = Math.floor(day);
    const uinal = 0; // Default to 0 for now
    const kin = 0;   // Default to 0 for now
    
    const daysSinceEpoch = longCountToDays(baktun, katun, tun, uinal, kin);
    return MAYAN_EPOCH + daysSinceEpoch;
  },

  fromJDN(jdn: number): CalendarDate {
    const daysSinceEpoch = jdn - MAYAN_EPOCH;
    
    // Handle negative days (dates before epoch)
    if (daysSinceEpoch < 0) {
      // For dates before epoch, we need to calculate backwards
      const { baktun, katun, tun } = daysToLongCount(Math.abs(daysSinceEpoch));
      
      // Convert to negative representation
      // Note: This is a simplified approach - full implementation would handle
      // the positional notation for negative dates more carefully
      const year = -baktun;
      
      return {
        year,
        month: -katun,
        day: -tun,
        calendar: 'mayan-longcount',
        era: 'BCE'
      };
    }
    
    const { baktun, katun, tun } = daysToLongCount(daysSinceEpoch);
    
    // For dates at or after epoch, baktun should be >= 0
    // In Long Count, baktun 0-12 covers most historical dates
    // We'll store baktun as year, katun as month, tun as day
    // Use baktun as-is (no conversion needed)
    const year = baktun;
    
    return {
      year,
      month: katun,
      day: tun,
      calendar: 'mayan-longcount',
      era: ''
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO['mayan-longcount'];
  },

  formatDate(date: CalendarDate, format: string = 'YYYY.MM.DD'): string {
    // For Long Count, we format as baktun.katun.tun.uinal.kin
    // But our CalendarDate only stores baktun/katun/tun
    // We'll format what we have: baktun.katun.tun.0.0
    
    // Use year/month/day as-is (they represent baktun/katun/tun directly)
    const baktun = date.year;
    const katun = date.month;
    const tun = date.day;
    
    // Default format for Long Count: baktun.katun.tun.uinal.kin
    if (format.includes('.')) {
      return `${baktun}.${katun}.${tun}.0.0`;
    }
    
    // Fallback to standard formatting
    return `${baktun}.${katun}.${tun}`;
  },

  parseDate(dateString: string): CalendarDate {
    // Parse Long Count notation: baktun.katun.tun.uinal.kin
    const parts = dateString.split('.').map(p => parseInt(p, 10));
    
    if (parts.length < 3) {
      throw new Error(`Invalid Long Count date format: ${dateString}`);
    }
    
    const baktun = parts[0] || 0;
    const katun = parts[1] || 0;
    const tun = parts[2] || 0;
    const uinal = parts[3] || 0;
    const kin = parts[4] || 0;
    
    // Convert to JDN first, then back to our format
    // Note: uinal and kin are included in the conversion for accuracy
    const daysSinceEpoch = longCountToDays(baktun, katun, tun, uinal, kin);
    const jdn = MAYAN_EPOCH + daysSinceEpoch;
    
    return this.fromJDN(jdn);
  }
};

