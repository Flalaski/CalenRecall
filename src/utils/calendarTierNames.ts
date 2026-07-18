/**
 * Calendar Tier Names
 * 
 * Provides calendar-specific names for time period tiers (decade, year, month, week, day)
 * to ensure accurate representation across different calendar systems.
 */

import { CalendarSystem } from './calendars/types';

export type TimeTier = 'decade' | 'year' | 'month' | 'week' | 'day';

interface TierNames {
  decade: string;
  year: string;
  month: string;
  week: string;
  day: string;
}

/**
 * Get calendar-specific names for time period tiers
 */
export function getCalendarTierNames(calendar: CalendarSystem): TierNames {
  const tierNames: Record<CalendarSystem, TierNames> = {
    gregorian: {
      decade: 'Decade',
      year: 'Year',
      month: 'Month',
      week: 'Week',
      day: 'Day',
    },
    julian: {
      decade: 'Decade',
      year: 'Year',
      month: 'Month',
      week: 'Week',
      day: 'Day',
    },
    islamic: {
      decade: 'عقد', // Aqd (decade/period of 10 years)
      year: 'سنة', // Sanah (year)
      month: 'شهر', // Shahr (month)
      week: 'أسبوع', // Usbu' (week)
      day: 'يوم', // Yawm (day)
    },
    hebrew: {
      decade: 'עשור', // Asor (decade)
      year: 'שנה', // Shanah (year)
      month: 'חודש', // Chodesh (month)
      week: 'שבוע', // Shavua (week)
      day: 'יום', // Yom (day)
    },
    persian: {
      decade: 'دهه', // Dahe (decade)
      year: 'سال', // Sāl (year)
      month: 'ماه', // Māh (month)
      week: 'هفته', // Hafte (week)
      day: 'روز', // Ruz (day)
    },
    chinese: {
      decade: '十年', // Shí nián (ten years)
      year: '年', // Nián (year)
      month: '月', // Yuè (month)
      week: '星期', // Xīngqī (week)
      day: '日', // Rì (day)
    },
    ethiopian: {
      decade: 'Decade', // No specific term, using approximate
      year: 'ዓመት', // Amät (year)
      month: 'ወር', // Wer (month)
      week: 'ሳምንት', // Samint (week)
      day: 'ቀን', // Qen (day)
    },
    coptic: {
      decade: 'Decade',
      year: 'ⲣⲟⲙⲡⲉ', // Rompe (year)
      month: 'ⲁⲃⲟⲧ', // Abot (month) — corrected from previously incorrect 'epagomenā' (intercalary days)
      week: 'ⲥⲁⲃⲃⲁⲧⲟⲛ', // Sabbaton (week, from Greek σάββατον)
      day: 'ⲉϩⲟⲟⲩ', // Ehoou (day)
    },
    'indian-saka': {
      decade: 'दशक', // Dashak (decade)
      year: 'वर्ष', // Varsha (year)
      month: 'मास', // Māsa (month)
      week: 'सप्ताह', // Saptāh (week)
      day: 'दिन', // Din (day)
    },
    bahai: {
      decade: 'Váḥid', // 19-year cycle (closest to decade concept)
      year: 'Year', // Váḥid cycle year
      month: 'Month', // 19 months in a year
      week: 'Week', // 7-day week
      day: 'Day',
    },
    'thai-buddhist': {
      decade: 'ทศวรรษ', // Totsawat (decade)
      year: 'ปี', // Pī (year)
      month: 'เดือน', // Deuan (month)
      week: 'สัปดาห์', // Saptā (week)
      day: 'วัน', // Wan (day)
    },
    'mayan-tzolkin': {
      decade: 'K\'atun', // 20-year period (closest equivalent)
      year: 'Tun', // 360-day period
      month: 'Uinal', // 20-day period
      week: 'Trecena', // 13-day period in Tzolk'in calendar
      day: 'Kin', // Day
    },
    'mayan-haab': {
      decade: 'K\'atun', // 20-year period
      year: 'Haab\'', // 365-day year
      month: 'Uinal', // 20-day period (18 uinals + 5 days)
      week: 'Trecena', // 13-day cycle used across Mayan calendars
      day: 'Kin', // Day
    },
    'mayan-longcount': {
      decade: 'K\'atun', // 20-tun period (7,200 days)
      year: 'Tun', // 360-day period
      month: 'Uinal', // 20-day period
      week: 'Trecena', // 13-day cycle used across Mayan calendars
      day: 'Kin', // Day
    },
    cherokee: {
      decade: 'ᏍᎪᎯᏧᏈ (Decade)',
      year: 'ᏧᏈ (Year)',
      month: 'ᏗᎧᏁᏍᎩ (Moon)',
      week: 'ᎯᎸᏍᎩᏴ (Week)',
      day: 'ᎢᎦ (Day)',
    },
    iroquois: {
      decade: 'Decade',
      year: 'Kashehta (Year)',
      month: 'Eniá:ken (Moon)',
      week: 'Week',
      day: 'Ohneká:ron (Day)',
    },
    'aztec-xiuhpohualli': {
      decade: 'Xiuhmolpilli', // 52-year cycle (closest to decade concept)
      year: 'Xiuhpohualli', // 365-day year
      month: 'Veintena', // 20-day period (18 veintenas + 5 nemontemi)
      week: 'Trecena', // 13-day cycle (shared Mesoamerican concept)
      day: 'Tonalli', // Day
    },
  };

  return tierNames[calendar];
}

/**
 * Get a specific tier name for a calendar
 */
export function getTierName(calendar: CalendarSystem, tier: TimeTier): string {
  return getCalendarTierNames(calendar)[tier];
}

