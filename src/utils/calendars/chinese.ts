/**
 * Chinese Lunisolar Calendar Converter
 * 
 * IMPORTANT CULTURAL NOTE:
 * The Chinese calendar is a complex lunisolar calendar that is still actively used
 * for traditional festivals and cultural observances. This implementation uses
 * accurate astronomical calculations to properly honor the cultural significance
 * of this calendar system.
 * 
 * The Chinese calendar:
 * - Uses lunar months based on actual new moon observations
 * - Adds intercalary (leap) months to align with solar year
 * - Uses 24 solar terms (jieqi) to determine leap months
 * - Year starts on the second new moon after winter solstice
 * 
 * IMPLEMENTATION:
 * This implementation uses accurate astronomical calculations:
 * - Calculates actual new moon dates using lunar longitude
 * - Calculates 24 solar terms (jieqi) based on solar longitude
 * - Determines leap months based on solar terms (month with no solar term)
 * - Calculates Chinese New Year as second new moon after winter solstice
 * 
 * Reference: "Calendrical Calculations" by Dershowitz & Reingold, Chapter 19
 *            "Astronomical Algorithms" by Jean Meeus
 */

import { CalendarConverter, CalendarDate, CalendarInfo } from './types';
import { CALENDAR_INFO } from './types';
import { gregorianToJDN, jdnToGregorian } from './julianDayUtils';
import { 
  newMoonJDN, 
  nextNewMoonJDN, 
  previousNewMoonJDN,
  solarTermJDN,
  solarTerm,
  winterSolsticeJDN
} from './astronomicalUtils';

// Chinese month names (12 regular months)
const CHINESE_MONTH_NAMES = [
  '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'
];

// Chinese month names (traditional)
const CHINESE_MONTH_NAMES_TRADITIONAL = [
  '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'
];

/**
 * Chinese calendar year data structure
 */
interface ChineseYearData {
  year: number;
  newYearJDN: number;  // Chinese New Year date
  months: ChineseMonthData[];
  isLeapYear: boolean;
}

/**
 * Chinese calendar month data structure
 */
interface ChineseMonthData {
  monthNumber: number;  // 1-12 (regular month number)
  isLeap: boolean;       // true if this is a leap month
  startJDN: number;      // New moon date (start of month)
  endJDN: number;        // Next new moon date (end of month)
  length: number;        // Days in month
  solarTerms: number[];  // Solar term numbers (0-23) that fall in this month
}

// Cache for calculated Chinese years (to avoid recalculation)
const chineseYearCache = new Map<number, ChineseYearData>();

/**
 * Calculate Chinese New Year JDN for a given Chinese year
 * Chinese New Year = second new moon after winter solstice
 * 
 * @param chineseYear Chinese year number
 * @returns Julian Day Number of Chinese New Year
 */
function chineseNewYearJDN(chineseYear: number): number {
  // Chinese calendar years are continuous and don't have a fixed Gregorian epoch
  // We need to find the Gregorian year that contains this Chinese year's New Year
  // Chinese New Year typically falls in late January to mid-February
  
  // For calculation purposes, we'll use the Chinese year number directly
  // as an approximate Gregorian year, then refine based on actual New Year date
  // This works because Chinese years roughly align with Gregorian years
  
  // Start with Chinese year as approximate Gregorian year
  // Chinese year 126 would be approximately 126 CE
  let approximateGregorianYear = chineseYear;
  
  // Find winter solstice for the Gregorian year before Chinese New Year
  // Chinese New Year is in Jan-Feb, so we need previous year's winter solstice
  const winterSolsticeYear = approximateGregorianYear - 1;
  const winterSolstice = winterSolsticeJDN(winterSolsticeYear);
  
  // Find first new moon after winter solstice
  const firstNewMoon = nextNewMoonJDN(winterSolstice);
  
  // Find second new moon after winter solstice (this is Chinese New Year)
  const secondNewMoon = nextNewMoonJDN(firstNewMoon);
  
  // Verify the New Year falls in the expected Gregorian year
  // If it falls in the previous Gregorian year, adjust
  const { year: actualGregorianYear } = jdnToGregorian(secondNewMoon);
  if (actualGregorianYear < approximateGregorianYear) {
    // New Year fell in previous Gregorian year, recalculate with that year
    const adjustedWinterSolstice = winterSolsticeJDN(actualGregorianYear - 1);
    const adjustedFirstNewMoon = nextNewMoonJDN(adjustedWinterSolstice);
    return nextNewMoonJDN(adjustedFirstNewMoon);
  }
  
  return secondNewMoon;
}

/**
 * Calculate all lunar months for a Chinese year
 * @param chineseYear Chinese year number
 * @returns Array of month data for the year
 */
function calculateChineseYear(chineseYear: number): ChineseYearData {
  // Check cache first
  if (chineseYearCache.has(chineseYear)) {
    return chineseYearCache.get(chineseYear)!;
  }
  
  const newYearJDN = chineseNewYearJDN(chineseYear);
  const months: ChineseMonthData[] = [];
  
  // Calculate all new moons for this year
  // Start from Chinese New Year and find subsequent new moons
  let currentNewMoon = newYearJDN;
  let monthNumber = 1;
  let hasLeapMonth = false;
  
  // Calculate next year's Chinese New Year to know when to stop
  const nextYearNewYear = chineseNewYearJDN(chineseYear + 1);
  
  // Calculate solar terms for the year
  // Use the Gregorian year that contains Chinese New Year for solar term calculation
  const { year: gregorianYearOfNewYear } = jdnToGregorian(newYearJDN);
  const solarTerms: number[] = [];
  for (let term = 0; term < 24; term++) {
    solarTerms.push(solarTermJDN(gregorianYearOfNewYear, term));
  }
  
  // Process months until we reach next year
  while (currentNewMoon < nextYearNewYear && monthNumber <= 13) {
    const nextNewMoon = nextNewMoonJDN(currentNewMoon);
    const monthLength = nextNewMoon - currentNewMoon;
    
    // Determine which solar terms fall in this month
    const termsInMonth: number[] = [];
    for (let term = 0; term < 24; term++) {
      const termJDN = solarTerms[term];
      if (termJDN >= currentNewMoon && termJDN < nextNewMoon) {
        termsInMonth.push(term);
      }
    }
    
    // Check if this month has no solar term (leap month)
    const isLeap = termsInMonth.length === 0;
    
    // If this is a leap month, it takes the number of the previous regular month
    // Otherwise, use the current month number
    const actualMonthNumber = isLeap ? monthNumber - 1 : monthNumber;
    
    months.push({
      monthNumber: actualMonthNumber,
      isLeap: isLeap,
      startJDN: currentNewMoon,
      endJDN: nextNewMoon,
      length: monthLength,
      solarTerms: termsInMonth
    });
    
    if (isLeap) {
      hasLeapMonth = true;
    } else {
      monthNumber++;
    }
    
    currentNewMoon = nextNewMoon;
  }
  
  const yearData: ChineseYearData = {
    year: chineseYear,
    newYearJDN: newYearJDN,
    months: months,
    isLeapYear: hasLeapMonth
  };
  
  // Cache the result
  chineseYearCache.set(chineseYear, yearData);
  
  return yearData;
}

/**
 * Get Chinese year data, calculating if necessary
 */
function getChineseYearData(chineseYear: number): ChineseYearData {
  return calculateChineseYear(chineseYear);
}

export const chineseCalendar: CalendarConverter = {
  toJDN(year: number, month: number, day: number): number {
    // month: 1-12 (regular) or 13+ for leap months
    // day: 1-29 or 1-30
    
    const isLeapMonth = month > 12;
    const actualMonth = isLeapMonth ? month - 12 : month;
    
    // Validate month
    if (actualMonth < 1 || actualMonth > 12) {
      throw new Error(`Invalid Chinese month: ${month}`);
    }
    
    // Get year data
    const yearData = getChineseYearData(year);
    
    // Find the target month in the year data
    let targetMonth: ChineseMonthData | null = null;
    let monthIndex = 0;
    
    for (let i = 0; i < yearData.months.length; i++) {
      const m = yearData.months[i];
      if (m.monthNumber === actualMonth && m.isLeap === isLeapMonth) {
        targetMonth = m;
        monthIndex = i;
        break;
      }
    }
    
    // If month not found, it might be a leap month that doesn't exist
    if (!targetMonth) {
      // Check if there's a regular month with this number
      const regularMonth = yearData.months.find(m => m.monthNumber === actualMonth && !m.isLeap);
      if (regularMonth && isLeapMonth) {
        throw new Error(`Leap month ${actualMonth} does not exist in Chinese year ${year}`);
      }
      throw new Error(`Month ${month} not found in Chinese year ${year}`);
    }
    
    // Validate day
    if (day < 1 || day > targetMonth.length) {
      throw new Error(`Invalid day ${day} for Chinese month ${month} (valid range: 1-${targetMonth.length})`);
    }
    
    // Calculate JDN: start of month + (day - 1)
    return targetMonth.startJDN + (day - 1);
  },

  fromJDN(jdn: number): CalendarDate {
    // Find which Chinese year this JDN falls in
    // Start with approximate year based on epoch
    const AVERAGE_LUNAR_YEAR = 354.37; // Approximate for initial guess
    const CHINESE_EPOCH_APPROX = gregorianToJDN(1900, 2, 5);
    const daysSinceEpoch = jdn - CHINESE_EPOCH_APPROX;
    const approximateYears = Math.floor(daysSinceEpoch / AVERAGE_LUNAR_YEAR);
    let chineseYear = 1900 + approximateYears;
    
    // Refine year by checking Chinese New Year dates
    let yearData = getChineseYearData(chineseYear);
    
    // If before this year's New Year, go back a year
    while (jdn < yearData.newYearJDN) {
      chineseYear--;
      yearData = getChineseYearData(chineseYear);
    }
    
    // If after next year's New Year, go forward a year
    const nextYearData = getChineseYearData(chineseYear + 1);
    while (jdn >= nextYearData.newYearJDN) {
      chineseYear++;
      yearData = getChineseYearData(chineseYear);
      const nextYearData2 = getChineseYearData(chineseYear + 1);
      if (jdn >= nextYearData2.newYearJDN) {
        chineseYear++;
        yearData = getChineseYearData(chineseYear);
      } else {
        break;
      }
    }
    
    // Now find which month this JDN falls in
    let foundMonth: ChineseMonthData | null = null;
    for (const month of yearData.months) {
      if (jdn >= month.startJDN && jdn < month.endJDN) {
        foundMonth = month;
        break;
      }
    }
    
    // If not found in this year, check next year (edge case at year boundary)
    if (!foundMonth) {
      const nextYearData2 = getChineseYearData(chineseYear + 1);
      for (const month of nextYearData2.months) {
        if (jdn >= month.startJDN && jdn < month.endJDN) {
          foundMonth = month;
          chineseYear++;
          yearData = nextYearData2;
          break;
        }
      }
    }
    
    if (!foundMonth) {
      // Fallback: use approximate calculation
      // This shouldn't happen, but handle edge cases
      const daysInYear = jdn - yearData.newYearJDN;
      let month = 1;
      let day = 1;
      let cumulativeDays = 0;
      
      for (const m of yearData.months) {
        if (cumulativeDays + m.length > daysInYear) {
          month = m.isLeap ? m.monthNumber + 12 : m.monthNumber;
          day = daysInYear - cumulativeDays + 1;
          break;
        }
        cumulativeDays += m.length;
      }
      
      return {
        year: chineseYear,
        month: month,
        day: day,
        calendar: 'chinese',
        era: 'CE'
      };
    }
    
    // Calculate day within month
    const day = jdn - foundMonth.startJDN + 1;
    const month = foundMonth.isLeap ? foundMonth.monthNumber + 12 : foundMonth.monthNumber;
    
    return {
      year: chineseYear,
      month: month,
      day: day,
      calendar: 'chinese',
      era: 'CE'
    };
  },

  getInfo(): CalendarInfo {
    return CALENDAR_INFO.chinese;
  },

  formatDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
    const isLeapMonth = date.month > 12;
    const actualMonth = isLeapMonth ? date.month - 12 : date.month;
    const monthName = actualMonth <= 12 ? CHINESE_MONTH_NAMES[actualMonth - 1] : '';
    const monthNameFull = actualMonth <= 12 ? CHINESE_MONTH_NAMES_TRADITIONAL[actualMonth - 1] : '';
    
    let monthDisplay = monthName;
    if (isLeapMonth) {
      monthDisplay = `闰${monthName}`; // "Leap" prefix
    }
    
    return format
      .replace(/YYYY/g, date.year.toString())
      .replace(/YY/g, date.year.toString().slice(-2))
      .replace(/MMMM/g, monthNameFull || monthDisplay)
      .replace(/MMM/g, monthDisplay)
      .replace(/MM/g, date.month.toString().padStart(2, '0'))
      .replace(/\bM\b/g, date.month.toString())
      .replace(/DD/g, date.day.toString().padStart(2, '0'))
      .replace(/\bD\b/g, date.day.toString())
      .replace(/ERA/g, date.era || 'CE');
  },

  parseDate(dateStr: string): CalendarDate | null {
    const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    // Month can be 1-12 (regular) or 13-24 (leap months, though simplified)
    if (month < 1 || month > 24 || day < 1 || day > 30) {
      return null;
    }

    return {
      year,
      month,
      day,
      calendar: 'chinese',
      era: 'CE'
    };
  }
};

