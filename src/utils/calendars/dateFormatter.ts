/**
 * Date Formatter for Calendar Systems
 * 
 * Provides comprehensive date formatting for all calendar systems,
 * including month names, day names, and various format tokens.
 */

import { CalendarDate, CalendarSystem, CALENDAR_INFO } from './types';
import { calendarDateToDate } from './calendarConverter';
import { ISLAMIC_MONTH_NAMES_ARABIC } from './islamic';
import { HEBREW_MONTH_NAMES_HEBREW } from './hebrew';
import { PERSIAN_MONTH_NAMES_FARSI } from './persian';
import { ETHIOPIAN_MONTH_NAMES_GE_EZ } from './ethiopian';
import { COPTIC_MONTH_NAMES_NATIVE } from './coptic';
import { SAKA_MONTH_NAMES_DEVANAGARI } from './indianSaka';
import { BAHAI_MONTH_NAMES_ARABIC } from './bahai';
import { CHEROKEE_MONTH_NAMES_SYLLABARY } from './cherokee';
import { CHINESE_MONTH_NAMES_TRADITIONAL } from './chinese';
import { IROQUOIS_MOON_NAMES_MOHAWK } from './iroquois';

// Month names for different calendars
const MONTH_NAMES: Record<CalendarSystem, string[]> = {
  gregorian: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  julian: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  islamic: ['Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani', 'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'],
  hebrew: ['Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II'],
  persian: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'],
  chinese: ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
  ethiopian: ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miazia', 'Genbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'],
  coptic: ['Tout', 'Baba', 'Hator', 'Koiak', 'Tobi', 'Meshir', 'Paremhat', 'Paremoude', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Pi Kogi Enavot'],
  'indian-saka': ['Chaitra', 'Vaisakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadra', 'Ashwin', 'Kartika', 'Agrahayana', 'Pausha', 'Magha', 'Phalguna'],
  bahai: ['Ayyám-i-Há', 'Bahá', 'Jalál', 'Jamál', '‘Aẓamat', 'Núr', 'Raḥmat', 'Kalimát', 'Kamál', 'Asmá\'', '‘Izzat', 'Mashíyyat', '‘Ilm', 'Qudrat', 'Qawl', 'Masá\'il', 'Sharaf', 'Sulṭán', 'Mulk', '‘Alá\''],
  'thai-buddhist': ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  'mayan-tzolkin': ['Imix', 'Ik\'', 'Ak\'b\'al', 'K\'an', 'Chikchan', 'Kimi', 'Manik\'', 'Lamat', 'Muluk', 'Ok', 'Chuwen', 'Eb\'', 'B\'en', 'Ix', 'Men', 'K\'ib\'', 'Kab\'an', 'Etz\'nab\'', 'Kawak', 'Ajaw'],
  'mayan-haab': ['Pop', 'Wo\'', 'Sip', 'Sotz\'', 'Sek', 'Xul', 'Yaxk\'in', 'Mol', 'Ch\'en', 'Yax', 'Sak\'', 'Keh', 'Mak', 'K\'ank\'in', 'Muwan', 'Pax', 'K\'ayab\'', 'Kumk\'u', 'Wayeb\''],
  'mayan-longcount': [],
  cherokee: ['Cold Moon', 'Bony Moon', 'Windy Moon', 'Flower Moon', 'Planting Moon', 'Green Corn Moon', 'Ripe Corn Moon', 'Fruit Moon', 'Nut Moon', 'Harvest Moon', 'Trading Moon', 'Snow Moon'],
  iroquois: ['Midwinter Moon', 'Moon of the Crust', 'Maple Sugar Moon', 'Planting Moon', 'Strawberry Moon', 'Moon of the Green Corn', 'Full Harvest Moon', 'Moon of the Falling Leaves', 'Moon of the Hunter', 'Moon of the Changing Seasons', 'Cold Moon', 'Moon of the Long Snows', 'Moon of the Deep Snows'],
  'aztec-xiuhpohualli': ['Atlcahualo', 'Tlacaxipehualiztli', 'Tozoztontli', 'Huey Tozoztli', 'Toxcatl', 'Etzalcualiztli', 'Tecuilhuitontli', 'Huey Tecuilhuitl', 'Tlaxochimaco', 'Xocotlhuetzi', 'Ochpaniztli', 'Teotleco', 'Tepeilhuitl', 'Quecholli', 'Panquetzaliztli', 'Atemoztli', 'Tititl', 'Izcalli', 'Nemontemi']
};

// Abbreviated month names
export const MONTH_NAMES_SHORT: Record<CalendarSystem, string[]> = {
  gregorian: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  julian: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  islamic: ['Muh', 'Saf', 'Rab I', 'Rab II', 'Jum I', 'Jum II', 'Raj', 'Sha\'', 'Ram', 'Shaw', 'Dhu Q', 'Dhu H'],
  hebrew: ['Nis', 'Iyy', 'Siv', 'Tam', 'Av', 'Elu', 'Tis', 'Che', 'Kis', 'Tev', 'She', 'Ad1', 'Ad2'],
  persian: ['Far', 'Ord', 'Kho', 'Tir', 'Mor', 'Sha', 'Meh', 'Aba', 'Aza', 'Dey', 'Bah', 'Esf'],
  chinese: ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
  ethiopian: ['Mes', 'Tik', 'Hid', 'Tah', 'Tir', 'Yek', 'Meg', 'Mia', 'Gen', 'Sen', 'Ham', 'Neh', 'Pag'],
  coptic: ['Tou', 'Bab', 'Hat', 'Koi', 'Tob', 'Mes', 'Par', 'Par', 'Pas', 'Pao', 'Epi', 'Mes', 'PiK'],
  'indian-saka': ['Cha', 'Vai', 'Jye', 'Ash', 'Shr', 'Bha', 'Ash', 'Kar', 'Agr', 'Pau', 'Mag', 'Pha'],
  bahai: ['Ayy', 'Bah', 'Jal', 'Jam', 'Aẓa', 'Núr', 'Raḥ', 'Kal', 'Kam', 'Asm', 'Izz', 'Mas', 'Ilm', 'Qud', 'Qaw', 'Mas', 'Sha', 'Sul', 'Mul', 'Ala'],
  'thai-buddhist': ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  'mayan-tzolkin': ['Imi', 'Ik', 'Ak\'', 'K\'an', 'Chi', 'Kim', 'Man', 'Lam', 'Mul', 'Ok', 'Chu', 'Eb', 'B\'en', 'Ix', 'Men', 'K\'ib', 'Kab', 'Etz', 'Kaw', 'Aja'],
  'mayan-haab': ['Pop', 'Wo', 'Sip', 'Sot', 'Sek', 'Xul', 'Yax', 'Mol', 'Ch\'e', 'Yax', 'Sak', 'Keh', 'Mak', 'K\'an', 'Muw', 'Pax', 'K\'ay', 'Kum', 'Way'],
  'mayan-longcount': [],
  cherokee: ['Cold', 'Bony', 'Windy', 'Flower', 'Planting', 'Green Corn', 'Ripe Corn', 'Fruit', 'Nut', 'Harvest', 'Trading', 'Snow'],
  iroquois: ['Midwinter', 'Crust', 'Maple', 'Planting', 'Strawberry', 'Green Corn', 'Harvest', 'Falling Leaves', 'Hunter', 'Changing', 'Cold', 'Long Snows', 'Deep Snows'],
  'aztec-xiuhpohualli': ['Atlc', 'Tlac', 'Toz', 'Huey', 'Tox', 'Etz', 'Tec', 'Huey T', 'Tlax', 'Xoc', 'Och', 'Teot', 'Tepe', 'Que', 'Pan', 'Atem', 'Titi', 'Izca', 'Nemo']
};

// Native-script month names where available (uses script, not transliteration)
// Falls back to MONTH_NAMES for calendars without a separate native-script form
export const MONTH_NAMES_NATIVE: Record<CalendarSystem, string[]> = {
  gregorian: MONTH_NAMES.gregorian,
  julian: MONTH_NAMES.julian,
  islamic: ISLAMIC_MONTH_NAMES_ARABIC,
  hebrew: HEBREW_MONTH_NAMES_HEBREW,
  persian: PERSIAN_MONTH_NAMES_FARSI,
  chinese: CHINESE_MONTH_NAMES_TRADITIONAL,
  ethiopian: ETHIOPIAN_MONTH_NAMES_GE_EZ,
  coptic: COPTIC_MONTH_NAMES_NATIVE,
  'indian-saka': SAKA_MONTH_NAMES_DEVANAGARI,
  bahai: BAHAI_MONTH_NAMES_ARABIC,     // 20 entries incl. Ayyám-i-Há
  'thai-buddhist': MONTH_NAMES['thai-buddhist'], // already in native Thai script
  'mayan-tzolkin': MONTH_NAMES['mayan-tzolkin'],
  'mayan-haab': MONTH_NAMES['mayan-haab'],
  'mayan-longcount': [],
  cherokee: CHEROKEE_MONTH_NAMES_SYLLABARY,
  iroquois: IROQUOIS_MOON_NAMES_MOHAWK,
  'aztec-xiuhpohualli': MONTH_NAMES['aztec-xiuhpohualli'],
};

/**
 * Get a month name in the native script/orthography for a calendar system.
 * Falls back to the standard transliterated MONTH_NAMES when no native form exists.
 */
export function getNativeMonthName(calendar: CalendarSystem, month: number): string {
  const names = MONTH_NAMES_NATIVE[calendar];
  if (!names || names.length === 0 || month < 0 || month >= names.length) {
    return String(month + 1);
  }
  return names[month];
}

// Day of week names (using Gregorian week for most calendars)
const DAY_NAMES: string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Native-script day-of-week names per calendar system */
export const DAY_NAMES_NATIVE: Record<CalendarSystem, string[]> = {
  gregorian: DAY_NAMES,
  julian: DAY_NAMES,
  islamic: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  hebrew: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'],
  persian: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  chinese: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  ethiopian: ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'],
  coptic: ['ⲧⲕⲩⲣⲓⲁⲕⲏ', 'ⲡⲓⲥⲛⲁⲩ', 'ⲡⲓϣⲟⲙⲧ', 'ⲡⲓϥⲧⲟⲟⲩ', 'ⲡⲓϯⲟⲩ', 'ⲡⲓⲥⲟⲟⲩ', 'ⲡⲓϣⲁϣϥ'],
  'indian-saka': ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  bahai: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  'thai-buddhist': ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'],
  'mayan-tzolkin': DAY_NAMES,       // Tzolk'in uses 20 day-signs, not 7-day week
  'mayan-haab': DAY_NAMES,          // Haab' uses 20-day uinals, not 7-day week
  'mayan-longcount': DAY_NAMES,     // Long Count is positional, no week
  cherokee: ['ᎤᎾᏙᏓᏆᏍᎬ', 'ᎤᏃᏝᎥᏍᎬ', 'ᏔᎵᏁᎢᎦ', 'ᏦᎢᏁᎢᎦ', 'ᏅᎩᏁᎢᎦ', 'ᎯᏍᎩᏁᎢᎦ', 'ᎤᎾᏙᏓᏉᏅᎯ'],
  iroquois: DAY_NAMES,              // Haudenosaunee follow lunar cycles, not 7-day week
  'aztec-xiuhpohualli': DAY_NAMES,  // Xiuhpohualli uses veintenas (20-day periods)
};

/** Get the native-script name for a day of week */
export function getNativeDayName(calendar: CalendarSystem, dayOfWeek: number): string {
  const names = DAY_NAMES_NATIVE[calendar];
  if (!names || dayOfWeek < 0 || dayOfWeek > 6) return DAY_NAMES[dayOfWeek] || '';
  return names[dayOfWeek];
}

/**
 * Get day of week for a date (0 = Sunday, 6 = Saturday)
 * This uses the Gregorian calendar's week structure for most calendars
 */
function getDayOfWeek(date: CalendarDate): number {
  // Convert calendar date to Date object, then get day of week
  const jsDate = calendarDateToDate(date);
  return jsDate.getDay(); // 0 = Sunday, 6 = Saturday
}

/**
 * Format a calendar date according to the specified format string
 * 
 * Format tokens:
 * - YYYY: 4-digit year
 * - YY: 2-digit year
 * - MMMM: Full month name
 * - MMM: Abbreviated month name
 * - MM: 2-digit month (01-12)
 * - M: Month number (1-12)
 * - DD: 2-digit day (01-31)
 * - D: Day number (1-31)
 * - EEEE: Full day name
 * - EEE: Abbreviated day name
 * - E: Single letter day name
 */
export function formatCalendarDate(date: CalendarDate, format: string = 'YYYY-MM-DD'): string {
  const calendar = date.calendar;
  
  // Special handling for Mayan Long Count (positional notation)
  if (calendar === 'mayan-longcount') {
    // Decode all 5 components from CalendarDate fields
    // year = baktun, month = katun, day = tun * 400 + uinal * 20 + kin
    const baktun = date.year < 0 ? Math.abs(date.year) - 1 : date.year;
    const katun = Math.abs(date.month);
    const absDay = Math.abs(date.day);
    const tun = Math.floor(absDay / 400);
    const uinal = Math.floor((absDay % 400) / 20);
    const kin = absDay % 20;
    if (format.includes('.')) {
      return `${baktun}.${katun}.${tun}.${uinal}.${kin}`;
    }
    return `${baktun}.${katun}.${tun}.${uinal}.${kin}`;
  }
  
  const monthNames = MONTH_NAMES[calendar] || MONTH_NAMES.gregorian;
  const monthNamesShort = MONTH_NAMES_SHORT[calendar] || MONTH_NAMES_SHORT.gregorian;
  
  // Get month name (handle 1-based indexing and leap months)
  // For Chinese calendar: months 1-12 are regular, 13-24 are leap months
  // For other calendars with leap months, handle similarly
  let actualMonth = date.month;
  let isLeapMonth = false;
  
  if (calendar === 'chinese' && date.month > 12) {
    actualMonth = date.month - 12; // Convert leap month 13-24 to regular month 1-12
    isLeapMonth = true;
  } else if (calendar === 'hebrew' && date.month > 12) {
    actualMonth = date.month; // Hebrew uses month 12 (Adar I) and 13 (Adar II) directly
    isLeapMonth = true;
  }
  
  const monthIndex = actualMonth - 1;
  let monthName = monthIndex >= 0 && monthIndex < monthNames.length ? monthNames[monthIndex] : actualMonth.toString();
  let monthNameShort = monthIndex >= 0 && monthIndex < monthNamesShort.length ? monthNamesShort[monthIndex] : actualMonth.toString();
  
  // Add leap month indicator for Chinese calendar
  if (calendar === 'chinese' && isLeapMonth) {
    monthName = `闰${monthName}`; // "Leap" prefix in Chinese
    monthNameShort = `闰${monthNameShort}`;
  }
  
  // Get day of week
  const dayOfWeek = getDayOfWeek(date);
  const dayName = DAY_NAMES[dayOfWeek] || '';
  const dayNameShort = DAY_NAMES_SHORT[dayOfWeek] || '';
  
  // Format month
  const month2 = date.month.toString().padStart(2, '0');
  const month1 = date.month.toString();
  
  // Format day
  const day2 = date.day.toString().padStart(2, '0');
  const day1 = date.day.toString();
  
  // Determine era based on year and calendar epoch
  // Rule: If year <= 0, it's before the calendar's epoch, so show BCE
  //       If year >= 1, use the calendar's era name
  const calendarInfo = CALENDAR_INFO[calendar];
  let era: string;
  let displayYear: number;
  
  if (date.year <= 0) {
    // Year 0 or negative = before the calendar's epoch = BCE
    // Convert astronomical year to historical BCE year
    // For Gregorian/Julian: year 0 = 1 BCE, year -1 = 2 BCE
    // For other calendars: same conversion applies
    displayYear = Math.abs(date.year) + 1;
    era = 'BCE';
  } else {
    // Year 1 or later = at or after the calendar's epoch
    displayYear = date.year;
    era = calendarInfo?.eraName || '';
  }
  
  // Format year based on displayYear (which is always positive after conversion)
  // For BCE years, don't pad with zeros (e.g., "55 BCE" not "0055 BCE")
  // For CE years, pad to 4 digits for consistency
  const yearStr = displayYear.toString();
  const year4 = era === 'BCE' ? yearStr : yearStr.padStart(4, '0');
  const year2 = yearStr.slice(-2);
  
  // Replace format tokens in order (longest first to avoid conflicts)
  // Process character by character to handle single tokens correctly
  let result = '';
  let i = 0;
  
  while (i < format.length) {
    // Check for multi-character tokens first (longest first)
    if (format.substr(i, 4) === 'YYYY') {
      result += year4;
      i += 4;
    } else if (format.substr(i, 4) === 'EEEE') {
      result += dayName;
      i += 4;
    } else if (format.substr(i, 4) === 'MMMM') {
      result += monthName;
      i += 4;
    } else if (format.substr(i, 3) === 'MMM') {
      result += monthNameShort;
      i += 3;
    } else if (format.substr(i, 3) === 'EEE') {
      result += dayNameShort;
      i += 3;
    } else if (format.substr(i, 2) === 'YY') {
      result += year2;
      i += 2;
    } else if (format.substr(i, 2) === 'DD') {
      result += day2;
      i += 2;
    } else if (format.substr(i, 2) === 'MM') {
      result += month2;
      i += 2;
    } else if (format.substr(i, 3) === 'ERA') {
      result += era;
      i += 3;
    } else if (format[i] === 'M') {
      result += month1;
      i += 1;
    } else if (format[i] === 'D') {
      result += day1;
      i += 1;
    } else if (format[i] === 'E') {
      result += (dayNameShort.charAt(0) || 'S');
      i += 1;
    } else {
      result += format[i];
      i += 1;
    }
  }
  
  return result;
}

