import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears,
  getWeek, getYear, getMonth, differenceInDays, isSameDay } from 'date-fns';
import { gregorianToJDN, jdnToDate } from './calendars/julianDayUtils';

/**
 * Safely formats a date to ISO date string (YYYY-MM-DD) that works with negative years.
 * This replaces toISOString() which doesn't work for dates before year 0.
 * Supports proleptic Gregorian calendar dates from -9999 to 9999.
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  const day = date.getDate();
  
  // Format year with sign for negative years (ISO 8601 format: -YYYY-MM-DD)
  const yearStr = year < 0 
    ? `-${String(Math.abs(year)).padStart(4, '0')}` 
    : String(year).padStart(4, '0');
  
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Safely creates a Date object from year, month, and day.
 * Properly handles negative years and years around 0 AD by using JDN calculations.
 * @param year Year (can be negative for BCE dates)
 * @param month Month (0-11, JavaScript standard)
 * @param day Day (1-31)
 * @returns Date object
 */
export function createDate(year: number, month: number, day: number): Date {
  // For years far from 0, use normal Date constructor
  // JavaScript Date can handle years from -271821 to 275760, but behavior
  // around year 0 is unreliable, so we use JDN for years near 0
  if (year >= -100 && year <= 3000) {
    // For years near 0, use JDN-based calculation for accuracy
    if (year < 1 || (year >= 0 && year <= 100)) {
      const jdn = gregorianToJDN(year, month + 1, day); // month is 1-indexed in gregorianToJDN
      return jdnToDate(jdn);
    }
    // For normal positive years, use standard constructor
    try {
      const date = new Date(year, month, day);
      // Verify the date was created correctly
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    } catch (e) {
      // Fall through to JDN method if Date constructor fails
    }
  }
  
  // Use JDN for all other cases (very negative years, very positive years, or if Date constructor failed)
  const jdn = gregorianToJDN(year, month + 1, day); // month is 1-indexed in gregorianToJDN
  return jdnToDate(jdn);
}

/**
 * Parses an ISO date string (YYYY-MM-DD or -YYYY-MM-DD) to a Date object.
 * Handles negative years correctly by using safe date creation.
 */
export function parseISODate(dateStr: string): Date {
  // Handle negative years: -YYYY-MM-DD format
  const isNegative = dateStr.startsWith('-');
  const cleanDateStr = isNegative ? dateStr.substring(1) : dateStr;
  const [yearStr, monthStr, dayStr] = cleanDateStr.split('-');
  
  const year = isNegative ? -parseInt(yearStr, 10) : parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed month
  const day = parseInt(dayStr, 10);
  
  return createDate(year, month, day);
}

export function formatDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  // For ISO date format (yyyy-MM-dd), use formatDateToISO to handle negative years correctly
  if (formatStr === 'yyyy-MM-dd') {
    return formatDateToISO(date);
  }
  return format(date, formatStr);
}

export function getWeekStart(date: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Date {
  return startOfWeek(date, { weekStartsOn });
}

export function getWeekEnd(date: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Date {
  return endOfWeek(date, { weekStartsOn });
}

export function getMonthStart(date: Date): Date {
  return startOfMonth(date);
}

export function getMonthEnd(date: Date): Date {
  return endOfMonth(date);
}

export function getYearStart(date: Date): Date {
  return startOfYear(date);
}

export function getYearEnd(date: Date): Date {
  return endOfYear(date);
}

export function getDecadeStart(date: Date): Date {
  const year = getYear(date);
  const decadeStart = Math.floor(year / 10) * 10;
  return createDate(decadeStart, 0, 1);
}

export function getDecadeEnd(date: Date): Date {
  const year = getYear(date);
  const decadeEnd = Math.floor(year / 10) * 10 + 9;
  return createDate(decadeEnd, 11, 31);
}

export function getDaysInMonth(date: Date): Date[] {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  const days: Date[] = [];
  let current = new Date(start);
  
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  
  return days;
}

export function getDaysInWeek(date: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Date[] {
  const start = getWeekStart(date, weekStartsOn);
  const days: Date[] = [];
  
  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }
  
  return days;
}

/**
 * Get weekday labels based on weekStartsOn preference
 * Returns an array of weekday abbreviations starting with the specified day
 */
export function getWeekdayLabels(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): string[] {
  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const labels: string[] = [];
  
  // Start from weekStartsOn and wrap around
  for (let i = 0; i < 7; i++) {
    const index = (weekStartsOn + i) % 7;
    labels.push(allDays[index]);
  }
  
  return labels;
}

/**
 * Get full weekday names based on weekStartsOn preference
 */
export function getWeekdayNames(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): string[] {
  const allDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const names: string[] = [];
  
  // Start from weekStartsOn and wrap around
  for (let i = 0; i < 7; i++) {
    const index = (weekStartsOn + i) % 7;
    names.push(allDays[index]);
  }
  
  return names;
}

export function getMonthsInYear(date: Date): Date[] {
  const year = getYear(date);
  const months: Date[] = [];
  
  for (let i = 0; i < 12; i++) {
    months.push(createDate(year, i, 1));
  }
  
  return months;
}

export function getYearsInDecade(date: Date): Date[] {
  const decadeStart = Math.floor(getYear(date) / 10) * 10;
  const years: Date[] = [];
  
  for (let i = 0; i < 10; i++) {
    years.push(createDate(decadeStart + i, 0, 1));
  }
  
  return years;
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// Get canonical date for a time range (the date used to store entries)
export function getCanonicalDate(date: Date, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day', weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Date {
  switch (timeRange) {
    case 'decade':
      return getDecadeStart(date);
    case 'year':
      return getYearStart(date);
    case 'month':
      return getMonthStart(date);
    case 'week':
      return getWeekStart(date, weekStartsOn);
    case 'day':
      return createDate(date.getFullYear(), date.getMonth(), date.getDate());
    default:
      return date;
  }
}

// Tropical zodiac color scheme
// Each sign has a primary color for month titles
const zodiacColors: { [key: string]: string } = {
  'aries': '#FF4444',      // Red (March 21 - April 19)
  'taurus': '#4CAF50',     // Green (April 20 - May 20)
  'gemini': '#FFD700',     // Gold/Yellow (May 21 - June 20)
  'cancer': '#C0C0C0',     // Silver (June 21 - July 22)
  'leo': '#FFA500',        // Orange/Gold (July 23 - August 22)
  'virgo': '#8B4513',      // Brown (August 23 - September 22)
  'libra': '#FF69B4',      // Pink (September 23 - October 22)
  'scorpio': '#8B0000',    // Dark Red (October 23 - November 21)
  'sagittarius': '#9370DB', // Purple (November 22 - December 21)
  'capricorn': '#2F4F2F',   // Dark Green (December 22 - January 19)
  'aquarius': '#4169E1',    // Blue (January 20 - February 18)
  'pisces': '#20B2AA',      // Sea Green (February 19 - March 20)
};

// Get zodiac sign for a given date (tropical zodiac)
function getZodiacSign(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  return 'pisces'; // February 19 - March 20
}

// Get zodiac color for a date (for month titles)
export function getZodiacColor(date: Date): string {
  const sign = getZodiacSign(date);
  return zodiacColors[sign];
}

// Get gradient color for a day, interpolating between zodiac signs
// This creates a smooth rainbow gradient throughout the year
export function getZodiacGradientColor(date: Date): string {
  const year = date.getFullYear();
  
  // Calculate day of year (1-365/366)
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Define zodiac periods by day of year (using March 21 as start of Aries = day 80)
  // Adjust for leap years if needed
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInYear = isLeapYear ? 366 : 365;
  
  const zodiacPeriods = [
    { sign: 'aries', startDay: 80, endDay: 110 },      // March 21 - April 19
    { sign: 'taurus', startDay: 110, endDay: 141 },     // April 20 - May 20
    { sign: 'gemini', startDay: 141, endDay: 172 },     // May 21 - June 20
    { sign: 'cancer', startDay: 172, endDay: 203 },     // June 21 - July 22
    { sign: 'leo', startDay: 203, endDay: 235 },       // July 23 - August 22
    { sign: 'virgo', startDay: 235, endDay: 266 },      // August 23 - September 22
    { sign: 'libra', startDay: 266, endDay: 296 },      // September 23 - October 22
    { sign: 'scorpio', startDay: 296, endDay: 326 },    // October 23 - November 21
    { sign: 'sagittarius', startDay: 326, endDay: 356 }, // November 22 - December 21
    { sign: 'capricorn', startDay: 356, endDay: 20 },   // December 22 - January 19 (wraps)
    { sign: 'aquarius', startDay: 20, endDay: 51 },     // January 20 - February 18
    { sign: 'pisces', startDay: 51, endDay: 80 },       // February 19 - March 20
  ];
  
  // Find which period this day falls into
  let currentPeriod = zodiacPeriods[0];
  let nextPeriod = zodiacPeriods[1];
  
  for (let i = 0; i < zodiacPeriods.length; i++) {
    const period = zodiacPeriods[i];
    const nextIdx = (i + 1) % zodiacPeriods.length;
    const next = zodiacPeriods[nextIdx];
    
    let inPeriod = false;
    if (period.startDay > period.endDay) {
      // Wraps around year (Capricorn: Dec 22 - Jan 19)
      inPeriod = dayOfYear >= period.startDay || dayOfYear < period.endDay;
    } else {
      inPeriod = dayOfYear >= period.startDay && dayOfYear < period.endDay;
    }
    
    if (inPeriod) {
      currentPeriod = period;
      nextPeriod = next;
      break;
    }
  }
  
  // Calculate position within the period (0 to 1)
  let position: number;
  if (currentPeriod.startDay > currentPeriod.endDay) {
    // Wraps around year
    const periodLength = (daysInYear - currentPeriod.startDay) + currentPeriod.endDay;
    if (dayOfYear >= currentPeriod.startDay) {
      position = (dayOfYear - currentPeriod.startDay) / periodLength;
    } else {
      position = ((daysInYear - currentPeriod.startDay) + dayOfYear) / periodLength;
    }
  } else {
    const periodLength = currentPeriod.endDay - currentPeriod.startDay;
    position = (dayOfYear - currentPeriod.startDay) / periodLength;
  }
  
  // Clamp position to 0-1
  position = Math.max(0, Math.min(1, position));
  
  // Interpolate between current and next sign colors
  const currentColor = zodiacColors[currentPeriod.sign];
  const nextColor = zodiacColors[nextPeriod.sign];
  
  const currentRgb = hexToRgb(currentColor);
  const nextRgb = hexToRgb(nextColor);
  
  if (!currentRgb || !nextRgb) return currentColor;
  
  const r = Math.round(currentRgb.r + (nextRgb.r - currentRgb.r) * position);
  const g = Math.round(currentRgb.g + (nextRgb.g - currentRgb.g) * position);
  const b = Math.round(currentRgb.b + (nextRgb.b - currentRgb.b) * position);
  
  return rgbToHex(r, g, b);
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Get zodiac gradient color for a year within its decade
// This cycles through all 12 zodiac signs over the 10-year decade period
export function getZodiacGradientColorForYear(year: number): string {
  // Get the decade start (e.g., 2020 for years 2020-2029)
  const decadeStart = Math.floor(year / 10) * 10;
  
  // Calculate position within decade (0-9 for the 10 years)
  const yearPosition = year - decadeStart;
  
  // Map the 10-year period to cycle through 12 zodiac signs
  // Each year gets approximately 1.2 signs worth of the cycle
  // We'll create a smooth gradient that cycles through all 12 signs
  const zodiacSigns = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
  ];
  
  // Calculate position in the zodiac cycle (0-1, cycling through all 12 signs)
  // Year 0 of decade maps to start of Aries, Year 9 maps near end of cycle
  const cyclePosition = (yearPosition / 10) * 12; // 0 to 10.8 (slightly more than one full cycle)
  
  // Find which zodiac period this falls into
  const signIndex = Math.floor(cyclePosition) % 12;
  const nextSignIndex = (signIndex + 1) % 12;
  
  // Position within the current sign period (0-1)
  const positionInSign = cyclePosition - Math.floor(cyclePosition);
  
  // Get colors for current and next signs
  const currentColor = zodiacColors[zodiacSigns[signIndex]];
  const nextColor = zodiacColors[zodiacSigns[nextSignIndex]];
  
  // Interpolate between the two colors
  const currentRgb = hexToRgb(currentColor);
  const nextRgb = hexToRgb(nextColor);
  
  if (!currentRgb || !nextRgb) return currentColor;
  
  const r = Math.round(currentRgb.r + (nextRgb.r - currentRgb.r) * positionInSign);
  const g = Math.round(currentRgb.g + (nextRgb.g - currentRgb.g) * positionInSign);
  const b = Math.round(currentRgb.b + (nextRgb.b - currentRgb.b) * positionInSign);
  
  return rgbToHex(r, g, b);
}

// Get zodiac color for a decade (uses the middle year of the decade)
export function getZodiacColorForDecade(decadeStart: number): string {
  // Use year 5 (middle of the decade) as representative
  const middleYear = decadeStart + 5;
  return getZodiacGradientColorForYear(middleYear);
}

/**
 * Formats time from hour, minute, second values
 * @param hour Hour (0-23)
 * @param minute Minute (0-59), optional
 * @param second Second (0-59), optional
 * @param timeFormat '12h' for AM/PM format, '24h' for 24-hour format (default: '12h')
 * @returns Formatted time string (e.g., "02:30:45 PM" or "14:30:45")
 */
export function formatTime(
  hour: number | undefined | null,
  minute: number | undefined | null,
  second: number | undefined | null,
  timeFormat: '12h' | '24h' = '12h'
): string | null {
  if (hour === undefined || hour === null) {
    return null;
  }

  const h = hour;
  const m = minute !== undefined && minute !== null ? minute : 0;
  const s = second !== undefined && second !== null ? second : 0;

  if (timeFormat === '12h') {
    // 12-hour format with AM/PM
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    const hourStr = String(hour12).padStart(2, '0');
    const minuteStr = String(m).padStart(2, '0');
    const secondStr = String(s).padStart(2, '0');
    return `${hourStr}:${minuteStr}:${secondStr} ${period}`;
  } else {
    // 24-hour format
    const hourStr = String(h).padStart(2, '0');
    const minuteStr = String(m).padStart(2, '0');
    const secondStr = String(s).padStart(2, '0');
    return `${hourStr}:${minuteStr}:${secondStr}`;
  }
}

