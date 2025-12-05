/**
 * Baháʼí Calendar Converter
 * 
 * The Baháʼí calendar (Badíʿ calendar) has:
 * - 19 months of 19 days each (361 days)
 * - 4 or 5 intercalary days (Ayyám-i-Há) between months 18 and 19
 * - New Year (Naw-Rúz) on the vernal equinox (March 20/21)
 * - Epoch: March 21, 1844 CE (approximately)
 * 
 * For simplicity, we approximate Naw-Rúz as March 21 for most years.
 * The exact date varies slightly based on the astronomical vernal equinox.
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian, isGregorianLeapYear } from './julianDayUtils';

// Baháʼí epoch: March 21, 1844 CE (JDN = 2394647)
const BAHAI_EPOCH = 2394647;

// Baháʼí month names (19 months)
const BAHAI_MONTH_NAMES = [
  'Bahá', 'Jalál', 'Jamál', '‘Aẓamat', 'Núr', 'Raḥmat', 'Kalimát', 'Kamál', 'Asmá\'', 
  '‘Izzat', 'Mashíyyat', '‘Ilm', 'Qudrat', 'Qawl', 'Masá\'il', 'Sharaf', 'Sulṭán', 'Mulk', '‘Alá\''
];

/**
 * Calculate the approximate date of Naw-Rúz (vernal equinox) for a given Baháʼí year
 * This is a simplified calculation - the actual date varies slightly
 */
function getNawRuzJDN(bahaiYear: number): number {
  // Naw-Rúz is approximately March 21, but can be March 20 or 21
  // For simplicity, we use March 21 for most years
  const gregorianYear = 1844 + bahaiYear - 1;
  
  // Simple approximation: March 21, but check if it's a leap year
  // In practice, the exact date is determined astronomically
  return gregorianToJDN(gregorianYear, 3, 21);
}

/**
 * Check if a Baháʼí year has 5 intercalary days (leap year)
 * This follows the same pattern as Gregorian leap years
 */
function isBahaiLeapYear(bahaiYear: number): boolean {
  const gregorianYear = 1844 + bahaiYear - 1;
  return isGregorianLeapYear(gregorianYear);
}

export const bahaiCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // Handle negative years (before epoch)
    if (year < 1) {
      // For negative years, calculate days before epoch
      // Work backwards: calculate total days from year down to 0 (inclusive)
      let totalDaysInYears = 0;
      for (let y = year; y <= 0; y++) {
        const intercalaryDays = isBahaiLeapYear(y) ? 5 : 4;
        totalDaysInYears += 19 * 19 + intercalaryDays; // 361 + 4 or 5
      }
      
      // Calculate days in the target year up to this date
      let daysInYear = 0;
      if (month <= 18) {
        daysInYear = (month - 1) * 19 + (day - 1);
      } else if (month === 19) {
        const intercalaryDays = isBahaiLeapYear(year) ? 5 : 4;
        daysInYear = 18 * 19 + intercalaryDays + (day - 1);
      }
      
      // Days before epoch = total days in all years from year to 0, minus days remaining in target year
      const intercalaryDays = isBahaiLeapYear(year) ? 5 : 4;
      const totalDaysInYear = 19 * 19 + intercalaryDays;
      const daysBeforeEpoch = totalDaysInYears - (totalDaysInYear - daysInYear);
      
      return BAHAI_EPOCH - daysBeforeEpoch;
    }
    
    // Normal case: year >= 1
    // Get the JDN of Naw-Rúz for this Baháʼí year
    const nawRuzJDN = getNawRuzJDN(year);
    
    // Calculate days since Naw-Rúz
    let daysSinceNawRuz = 0;
    
    // Add days from completed months (months 1-18, each with 19 days)
    if (month <= 18) {
      daysSinceNawRuz = (month - 1) * 19 + (day - 1);
    } else if (month === 19) {
      // Month 19 is 'Alá' - comes after Ayyám-i-Há
      const intercalaryDays = isBahaiLeapYear(year) ? 5 : 4;
      daysSinceNawRuz = 18 * 19 + intercalaryDays + (day - 1);
    } else {
      // Invalid month
      throw new Error(`Invalid Baháʼí month: ${month}`);
    }
    
    return nawRuzJDN + daysSinceNawRuz;
  },

  fromJDN(jdn: number): CalendarDate {
    // Handle dates before epoch (negative years)
    if (jdn < BAHAI_EPOCH) {
      // Work backwards from epoch
      let remainingDays = BAHAI_EPOCH - jdn;
      let bahaiYear = 0;
      
      // Find the year by working backwards
      while (remainingDays > 0) {
        const intercalaryDays = isBahaiLeapYear(bahaiYear) ? 5 : 4;
        const yearLength = 19 * 19 + intercalaryDays; // 361 + 4 or 5
        if (remainingDays > yearLength) {
          remainingDays -= yearLength;
          bahaiYear--;
        } else {
          // Found the year, now find month and day
          const intercalaryDays = isBahaiLeapYear(bahaiYear) ? 5 : 4;
          let month: number;
          let day: number;
          
          if (remainingDays < 18 * 19) {
            // Regular month
            month = Math.floor(remainingDays / 19) + 1;
            day = (remainingDays % 19) + 1;
          } else if (remainingDays < 18 * 19 + intercalaryDays) {
            // Ayyám-i-Há (intercalary days) - represent as month 19
            month = 19;
            day = remainingDays - 18 * 19 + 1;
          } else {
            // Month 19 ('Alá')
            month = 19;
            day = remainingDays - (18 * 19 + intercalaryDays) + 1;
          }
          
          return {
            year: bahaiYear,
            month,
            day,
            calendar: 'bahai',
            era: 'BE'
          };
        }
      }
      
      // Should not reach here, but return year 0, month 1, day 1 as fallback
      return { year: 0, month: 1, day: 1, calendar: 'bahai', era: 'BE' };
    }
    
    // Normal case: jdn >= BAHAI_EPOCH (year >= 1)
    // Find the Baháʼí year by finding which Naw-Rúz this JDN falls after
    let bahaiYear = 1;
    let nawRuzJDN = getNawRuzJDN(bahaiYear);
    
    // Find the correct year
    while (jdn >= nawRuzJDN + (isBahaiLeapYear(bahaiYear) ? 366 : 365)) {
      bahaiYear++;
      nawRuzJDN = getNawRuzJDN(bahaiYear);
    }
    
    // If before Naw-Rúz, it's the previous year
    if (jdn < nawRuzJDN) {
      bahaiYear--;
      nawRuzJDN = getNawRuzJDN(bahaiYear);
    }
    
    // Calculate days since Naw-Rúz
    const daysSinceNawRuz = jdn - nawRuzJDN;
    const intercalaryDays = isBahaiLeapYear(bahaiYear) ? 5 : 4;
    const totalDaysInYear = 19 * 19 + intercalaryDays; // 361 + 4 or 5
    
    if (daysSinceNawRuz < 0 || daysSinceNawRuz >= totalDaysInYear) {
      // This shouldn't happen, but handle edge cases
      throw new Error(`Invalid JDN for Baháʼí calendar: ${jdn}`);
    }
    
    let month: number;
    let day: number;
    
    // Check if it's in the intercalary days (Ayyám-i-Há)
    if (daysSinceNawRuz >= 18 * 19 && daysSinceNawRuz < 18 * 19 + intercalaryDays) {
      // This is Ayyám-i-Há - we'll represent it as month 18.5 or handle specially
      // For simplicity, we'll use month 19 and adjust the day
      month = 19;
      day = daysSinceNawRuz - 18 * 19 + 1;
    } else if (daysSinceNawRuz < 18 * 19) {
      // Regular month (1-18)
      month = Math.floor(daysSinceNawRuz / 19) + 1;
      day = (daysSinceNawRuz % 19) + 1;
    } else {
      // Month 19 ('Alá')
      month = 19;
      day = daysSinceNawRuz - (18 * 19 + intercalaryDays) + 1;
    }
    
    return {
      year: bahaiYear,
      month,
      day,
      calendar: 'bahai',
      era: 'BE'
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO.bahai;
  },

  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    const monthName = date.month <= 19 ? BAHAI_MONTH_NAMES[date.month - 1] : '';
    return format
      .replace(/YYYY/g, date.year.toString())
      .replace(/YY/g, date.year.toString().slice(-2))
      .replace(/MMMM/g, monthName)
      .replace(/MMM/g, monthName.substring(0, 3))
      .replace(/MM/g, date.month.toString().padStart(2, '0'))
      .replace(/\bM\b/g, date.month.toString())
      .replace(/DD/g, date.day.toString().padStart(2, '0'))
      .replace(/\bD\b/g, date.day.toString())
      .replace(/ERA/g, date.era || 'BE');
  },

  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 19 || day < 1 || day > 19) {
      return null;
    }

    return {
      year,
      month,
      day,
      calendar: 'bahai',
      era: 'BE'
    };
  }
};

