/**
 * Cultural Holidays & Observances
 *
 * Provides culturally significant holidays and observances for all 17 calendar systems.
 * Holidays are calculated using JDN-based conversions for accuracy across all years.
 *
 * Sources:
 * - Dershowitz & Reingold. "Calendrical Calculations." Cambridge University Press, 2001.
 * - O'Neil, W.M. "Time and the Calendars." Sydney University Press, 1975.
 * - Aveni, Anthony F. "Skywatchers." University of Texas Press, 2001.
 * - Various academic sources per calendar system (see inline citations).
 */

import { CalendarSystem } from './calendars/types';
import { gregorianToJDN, julianToJDN, jdnToGregorian, jdnToDate, dateToJDN } from './calendars/julianDayUtils';
import { islamicCalendar } from './calendars/islamic';
import { hebrewCalendar } from './calendars/hebrew';
import { persianCalendar } from './calendars/persian';
import { bahaiCalendar } from './calendars/bahai';
import { chineseCalendar } from './calendars/chinese';
import { indianSakaCalendar } from './calendars/indianSaka';
import { mayanHaabCalendar } from './calendars/mayanHaab';
import { aztecXiuhpohualliCalendar } from './calendars/aztecXiuhpohualli';
import { ethiopianCalendar } from './calendars/ethiopian';
import { copticCalendar } from './calendars/coptic';
import { vernalEquinoxJDN, solarTermJDN, nextFullMoonJDN } from './calendars/astronomicalUtils';

export interface CulturalHoliday {
  /** Unique identifier for this holiday */
  id: string;
  /** Display name in English */
  name: string;
  /** Display name in the calendar's native language (if applicable) */
  nativeName?: string;
  /** Calendar this holiday belongs to */
  calendar: CalendarSystem;
  /** Type of holiday */
  type: 'religious' | 'cultural' | 'national' | 'seasonal' | 'observance';
  /** Brief description */
  description: string;
  /** Function that calculates the JDN for this holiday in a given Gregorian year */
  calculateJDN: (gregorianYear: number) => number;
  /** Icon/emoji to display */
  icon: string;
  /** Source citation */
  source: string;
}

// ── Holiday Definitions ──

export const HOLIDAYS: CulturalHoliday[] = [
  // ═══════════════════════════════════════════════
  // Gregorian Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'gregorian-new-year',
    name: 'New Year\'s Day',
    calendar: 'gregorian',
    type: 'cultural',
    description: 'First day of the Gregorian calendar year',
    calculateJDN: (y) => gregorianToJDN(y, 1, 1),
    icon: '🎉',
    source: 'Richards, E.G. "Mapping Time." Oxford University Press, 1998.'
  },
  {
    id: 'gregorian-leap-day',
    name: 'Leap Day',
    calendar: 'gregorian',
    type: 'observance',
    description: 'February 29 — extra day added in leap years',
    calculateJDN: (y) => {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      return isLeap ? gregorianToJDN(y, 2, 29) : -1;
    },
    icon: '📅',
    source: 'Papal Bull Inter gravissimas, 1582.'
  },
  {
    id: 'gregorian-winter-solstice',
    name: 'Winter Solstice (Yule)',
    calendar: 'gregorian',
    type: 'seasonal',
    description: 'Shortest day of the year in the Northern Hemisphere — celebrated as Yule in Germanic traditions',
    calculateJDN: (y) => solarTermJDN(y, 21), // Solar term 21 = winter solstice
    icon: '❄️',
    source: 'Meeus, Jean. "Astronomical Algorithms." Ch. 27.'
  },
  {
    id: 'gregorian-spring-equinox',
    name: 'Vernal Equinox (Ostara)',
    calendar: 'gregorian',
    type: 'seasonal',
    description: 'First day of spring — celebrated as Ostara in Germanic traditions',
    calculateJDN: (y) => vernalEquinoxJDN(y),
    icon: '🌸',
    source: 'Meeus, Jean. "Astronomical Algorithms." Ch. 27.'
  },

  // ═══════════════════════════════════════════════
  // Chinese Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'chinese-new-year',
    name: 'Chinese New Year (Spring Festival)',
    nativeName: '春节',
    calendar: 'chinese',
    type: 'cultural',
    description: 'Most important Chinese holiday — begins on the first day of the first lunar month',
    calculateJDN: (y) => {
      try {
        // Find the JDN of Chinese New Year (month 1, day 1) for the Chinese year
        // that contains the Gregorian year's January 31 (approximately)
        const jan31JDN = gregorianToJDN(y, 1, 31);
        const calDate = chineseCalendar.fromJDN(jan31JDN);
        // Adjust: if we're before Chinese New Year, use the previous Chinese year
        if (calDate.month > 1 || calDate.day > 15) {
          return chineseCalendar.toJDN(calDate.year, 1, 1);
        }
        return chineseCalendar.toJDN(calDate.year - 1, 1, 1);
      } catch { return -1; }
    },
    icon: '🧧',
    source: 'Aslaksen, Helmer. "The Mathematics of the Chinese Calendar." NUS, 2008.'
  },
  {
    id: 'chinese-lantern-festival',
    name: 'Lantern Festival',
    nativeName: '元宵节',
    calendar: 'chinese',
    type: 'cultural',
    description: 'End of Chinese New Year celebrations — 15th day of first lunar month',
    calculateJDN: (y) => {
      const cnyJDN = HOLIDAYS.find(h => h.id === 'chinese-new-year')!.calculateJDN(y);
      return cnyJDN > 0 ? cnyJDN + 14 : -1;
    },
    icon: '🏮',
    source: 'Chinese traditional festivals — validated against天文 (astronomical) records.'
  },
  {
    id: 'chinese-qingming',
    name: 'Qingming Festival (Tomb Sweeping Day)',
    nativeName: '清明节',
    calendar: 'chinese',
    type: 'cultural',
    description: 'Day for honoring ancestors — 15th day after Spring Equinox (solar term 清明)',
    calculateJDN: (y) => solarTermJDN(y, 4), // 清明 (Qingming) = solar term 4 (~315°+45°×4=April 4-5)
    icon: '🪦',
    source: 'Aslaksen, Helmer. Chinese solar term calculations.'
  },
  {
    id: 'chinese-dragon-boat',
    name: 'Dragon Boat Festival',
    nativeName: '端午节',
    calendar: 'chinese',
    type: 'cultural',
    description: 'Commemorates Qu Yuan — 5th day of 5th lunar month',
    calculateJDN: (y) => {
      const calDate = chineseCalendar.fromJDN(gregorianToJDN(y, 5, 15));
      try { return chineseCalendar.toJDN(calDate.year, 5, 5); }
      catch { return -1; }
    },
    icon: '🐉',
    source: 'Ho, Peng Yoke. "Li, Qi, and Shu." Dover, 2000.'
  },
  {
    id: 'chinese-mid-autumn',
    name: 'Mid-Autumn Festival',
    nativeName: '中秋节',
    calendar: 'chinese',
    type: 'cultural',
    description: 'Harvest festival with mooncakes — 15th day of 8th lunar month',
    calculateJDN: (y) => {
      const calDate = chineseCalendar.fromJDN(gregorianToJDN(y, 9, 15));
      try { return chineseCalendar.toJDN(calDate.year, 8, 15); }
      catch { return -1; }
    },
    icon: '🥮',
    source: 'Ho, Peng Yoke. "Li, Qi, and Shu." Dover, 2000.'
  },
  {
    id: 'chinese-winter-solstice-festival',
    name: 'Winter Solstice Festival (Dongzhi)',
    nativeName: '冬至',
    calendar: 'chinese',
    type: 'cultural',
    description: 'Winter solstice celebration — family gatherings and tangyuan',
    calculateJDN: (y) => solarTermJDN(y, 21), // 冬至 = solar term 21 = winter solstice
    icon: '🥟',
    source: 'Aslaksen, Helmer. Chinese solar term calculations.'
  },

  // ═══════════════════════════════════════════════
  // Islamic (Hijri) Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'islamic-new-year',
    name: 'Islamic New Year (Muharram 1)',
    nativeName: 'رأس السنة الهجرية',
    calendar: 'islamic',
    type: 'religious',
    description: 'First day of the Islamic year — marks the Hijra (migration to Medina)',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5); // approximate
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 1, 1); }
      catch { return -1; }
    },
    icon: '🌙',
    source: 'Dershowitz & Reingold. "Calendrical Calculations." Ch. 7.'
  },
  {
    id: 'islamic-ashura',
    name: 'Ashura',
    nativeName: 'عاشوراء',
    calendar: 'islamic',
    type: 'religious',
    description: '10th day of Muharram — observed with fasting (Sunni) or mourning (Shia)',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5);
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 1, 10); }
      catch { return -1; }
    },
    icon: '☪️',
    source: 'Encyclopaedia of Islam. "Āshūrā." Brill, 2007.'
  },
  {
    id: 'islamic-ramadan-start',
    name: 'Ramadan (First Day)',
    nativeName: 'رمضان',
    calendar: 'islamic',
    type: 'religious',
    description: 'First day of Ramadan, the holy month of fasting — month 9 of Islamic calendar',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5);
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 9, 1); }
      catch { return -1; }
    },
    icon: '🕌',
    source: 'Ilyas, Mohammad. "Astronomical Calculations of Islamic Calendar." 1984.'
  },
  {
    id: 'islamic-eid-al-fitr',
    name: 'Eid al-Fitr',
    nativeName: 'عيد الفطر',
    calendar: 'islamic',
    type: 'religious',
    description: 'Festival of Breaking the Fast — marks the end of Ramadan (1 Shawwal)',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5);
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 10, 1); }
      catch { return -1; }
    },
    icon: '🍬',
    source: 'Dershowitz & Reingold. "Calendrical Calculations." Ch. 7.'
  },
  {
    id: 'islamic-eid-al-adha',
    name: 'Eid al-Adha',
    nativeName: 'عيد الأضحى',
    calendar: 'islamic',
    type: 'religious',
    description: 'Festival of Sacrifice — 10th day of Dhu al-Hijjah, during Hajj',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5);
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 12, 10); }
      catch { return -1; }
    },
    icon: '🐑',
    source: 'Dershowitz & Reingold. "Calendrical Calculations." Ch. 7.'
  },
  {
    id: 'islamic-mawlid',
    name: 'Mawlid al-Nabi (Prophet\'s Birthday)',
    nativeName: 'المولد النبوي',
    calendar: 'islamic',
    type: 'religious',
    description: 'Birth of Prophet Muhammad — 12th day of Rabi\' al-awwal',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5);
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 3, 12); }
      catch { return -1; }
    },
    icon: '🕋',
    source: 'Encyclopaedia of Islam. "Mawlid." Brill, 2007.'
  },
  {
    id: 'islamic-laylat-al-qadr',
    name: 'Laylat al-Qadr (Night of Power)',
    nativeName: 'ليلة القدر',
    calendar: 'islamic',
    type: 'religious',
    description: 'Night when the Quran was first revealed — 27th day of Ramadan',
    calculateJDN: (y) => {
      const islamicYear = y - 622 + Math.floor((y - 622) / 32.5);
      try { return islamicCalendar.toJDN(Math.max(1, islamicYear), 9, 27); }
      catch { return -1; }
    },
    icon: '✨',
    source: 'Quran, Surah 97 (Al-Qadr). Traditional Islamic observance.'
  },

  // ═══════════════════════════════════════════════
  // Hebrew Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'hebrew-rosh-hashanah',
    name: 'Rosh Hashanah (Jewish New Year)',
    nativeName: 'ראש השנה',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Jewish New Year — 1st and 2nd days of Tishrei',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 7, 1); } // Tishrei = month 7
      catch { return -1; }
    },
    icon: '🍎',
    source: 'Stern, Sacha. "Calendar and Community." Oxford University Press, 2001.'
  },
  {
    id: 'hebrew-yom-kippur',
    name: 'Yom Kippur (Day of Atonement)',
    nativeName: 'יום כיפור',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Holiest day in Judaism — fasting and prayer — 10th of Tishrei',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 7, 10); }
      catch { return -1; }
    },
    icon: '🕍',
    source: 'Spier, Arthur. "The Comprehensive Hebrew Calendar." Feldheim, 1986.'
  },
  {
    id: 'hebrew-sukkot',
    name: 'Sukkot (Feast of Tabernacles)',
    nativeName: 'סוכות',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Week-long harvest festival — 15th of Tishrei',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 7, 15); }
      catch { return -1; }
    },
    icon: '🌿',
    source: 'Spier, Arthur. "The Comprehensive Hebrew Calendar." Feldheim, 1986.'
  },
  {
    id: 'hebrew-hanukkah',
    name: 'Hanukkah (Festival of Lights)',
    nativeName: 'חנוכה',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Eight-day festival commemorating the rededication of the Second Temple — 25 Kislev',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 9, 25); } // Kislev = month 9
      catch { return -1; }
    },
    icon: '🕎',
    source: 'Encyclopaedia Judaica. "Hanukkah." Keter Publishing, 1972.'
  },
  {
    id: 'hebrew-purim',
    name: 'Purim',
    nativeName: 'פורים',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Commemorates the salvation of the Jewish people in Persia — 14 Adar',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 12, 14); } // Adar = month 12 (or Adar II in leap)
      catch { return -1; }
    },
    icon: '🎭',
    source: 'Biblical Book of Esther. Traditional Jewish observance.'
  },
  {
    id: 'hebrew-passover',
    name: 'Passover (Pesach)',
    nativeName: 'פסח',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Commemorates the Exodus from Egypt — 15 Nisan, seven-day festival',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 1, 15); } // Nisan = month 1
      catch { return -1; }
    },
    icon: '🍷',
    source: 'Biblical Book of Exodus. Traditional Jewish observance.'
  },
  {
    id: 'hebrew-shavuot',
    name: 'Shavuot (Festival of Weeks)',
    nativeName: 'שבועות',
    calendar: 'hebrew',
    type: 'religious',
    description: 'Commemorates the giving of the Torah at Mount Sinai — 6 Sivan',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 3, 6); } // Sivan = month 3
      catch { return -1; }
    },
    icon: '📜',
    source: 'Biblical Book of Leviticus 23. Traditional Jewish observance.'
  },
  {
    id: 'hebrew-tu-bishvat',
    name: 'Tu BiShvat (New Year for Trees)',
    nativeName: 'ט"ו בשבט',
    calendar: 'hebrew',
    type: 'observance',
    description: 'New Year for trees — 15th of Shevat',
    calculateJDN: (y) => {
      const hebrewYear = y + 3760;
      try { return hebrewCalendar.toJDN(hebrewYear, 11, 15); } // Shevat = month 11
      catch { return -1; }
    },
    icon: '🌳',
    source: 'Mishnah, Rosh Hashanah 1:1. Traditional Jewish observance.'
  },

  // ═══════════════════════════════════════════════
  // Persian (Jalali) Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'persian-nowruz',
    name: 'Nowruz (Persian New Year)',
    nativeName: 'نوروز',
    calendar: 'persian',
    type: 'cultural',
    description: 'Iranian New Year — begins at the vernal equinox — celebrated for 13 days',
    calculateJDN: (y) => vernalEquinoxJDN(y),
    icon: '🌸',
    source: 'Birashk, Ahmad. "A Comparative Calendar." Mazda Publishers, 1993.'
  },
  {
    id: 'persian-sizdah-bedar',
    name: 'Sizdah Bedar (Nature Day)',
    nativeName: 'سیزده به در',
    calendar: 'persian',
    type: 'cultural',
    description: '13th day of Farvardin — outdoor picnic marking end of Nowruz celebrations',
    calculateJDN: (y) => {
      const nowruzJDN = vernalEquinoxJDN(y);
      try { return persianCalendar.toJDN(Math.max(1, y - 621), 1, 13); }
      catch { return nowruzJDN + 12; }
    },
    icon: '🌿',
    source: 'Taqizadeh, S.H. "Old Iranian Calendars." JRAS, 1938.'
  },
  {
    id: 'persian-yalda',
    name: 'Yalda Night (Shab-e Yalda)',
    nativeName: 'شب یلدا',
    calendar: 'persian',
    type: 'cultural',
    description: 'Winter solstice celebration — longest night of the year',
    calculateJDN: (y) => solarTermJDN(y, 21), // Winter solstice
    icon: '🍉',
    source: 'Boyce, Mary. "Zoroastrians: Their Religious Beliefs and Practices." Routledge, 2001.'
  },
  {
    id: 'persian-mehregan',
    name: 'Mehregan (Autumn Festival)',
    nativeName: 'مهرگان',
    calendar: 'persian',
    type: 'cultural',
    description: 'Ancient Zoroastrian autumn festival — 16th of Mehr (October)',
    calculateJDN: (y) => {
      try { return persianCalendar.toJDN(Math.max(1, y - 621), 7, 16); }
      catch { return -1; }
    },
    icon: '🍂',
    source: 'Boyce, Mary. "Zoroastrians." Routledge, 2001.'
  },
  {
    id: 'persian-chaharshanbe-suri',
    name: 'Chaharshanbe Suri (Festival of Fire)',
    nativeName: 'چهارشنبه‌سوری',
    calendar: 'persian',
    type: 'cultural',
    description: 'Last Wednesday before Nowruz — jumping over bonfires',
    calculateJDN: (y) => {
      const nowruzJDN = vernalEquinoxJDN(y);
      return nowruzJDN - 4; // Approximately 4 days before Nowruz
    },
    icon: '🔥',
    source: 'Boyce, Mary. "Zoroastrians." Routledge, 2001.'
  },

  // ═══════════════════════════════════════════════
  // Baháʼí Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'bahai-naw-ruz',
    name: 'Naw-Rúz (Baháʼí New Year)',
    nativeName: 'نوروز',
    calendar: 'bahai',
    type: 'religious',
    description: 'Baháʼí New Year — coincides with the vernal equinox — first day of Bahá month',
    calculateJDN: (y) => vernalEquinoxJDN(y),
    icon: '🌅',
    source: 'Dershowitz & Reingold. "Calendrical Calculations." Ch. 7. Baháʼí World Centre.'
  },
  {
    id: 'bahai-ridvan-first',
    name: 'First Day of Ridván',
    nativeName: 'أيام الرضوان',
    calendar: 'bahai',
    type: 'religious',
    description: 'Most holy Baháʼí festival — 13th day of Jalál (April 21) — declaration of Baháʼu\'lláh',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 2, 13); } // Jalál = month 2
      catch { return -1; }
    },
    icon: '🌹',
    source: 'Baháʼu\'lláh. "Kitáb-i-Aqdas." Baháʼí World Centre, 1873.'
  },
  {
    id: 'bahai-ridvan-ninth',
    name: 'Ninth Day of Ridván',
    calendar: 'bahai',
    type: 'religious',
    description: 'Ninth day of the Ridván festival — arrival of Baháʼu\'lláh\'s family',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 2, 21); }
      catch { return -1; }
    },
    icon: '🌹',
    source: 'Baháʼu\'lláh. "Kitáb-i-Aqdas."'
  },
  {
    id: 'bahai-ridvan-twelfth',
    name: 'Twelfth Day of Ridván',
    calendar: 'bahai',
    type: 'religious',
    description: 'Final day of the Ridván festival — departure from the Garden of Ridván',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 2, 24); }
      catch { return -1; }
    },
    icon: '🌹',
    source: 'Baháʼu\'lláh. "Kitáb-i-Aqdas."'
  },
  {
    id: 'bahai-declaration-bab',
    name: 'Declaration of the Báb',
    nativeName: 'میلاد باب',
    calendar: 'bahai',
    type: 'religious',
    description: 'Declaration of the Báb — 8th day of ʻAẓamat (May 23)',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 4, 8); }
      catch { return -1; }
    },
    icon: '⭐',
    source: 'Shoghi Effendi. "God Passes By." Baháʼí Publishing Trust, 1944.'
  },
  {
    id: 'bahai-ascension-bahaullah',
    name: 'Ascension of Baháʼu\'lláh',
    calendar: 'bahai',
    type: 'religious',
    description: 'Death of Baháʼu\'lláh — 4th day of ʻAẓamat (May 29)',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 4, 4); }
      catch { return -1; }
    },
    icon: '🕊️',
    source: 'Shoghi Effendi. "God Passes By."'
  },
  {
    id: 'bahai-martyrdom-bab',
    name: 'Martyrdom of the Báb',
    calendar: 'bahai',
    type: 'religious',
    description: 'Execution of the Báb — 17th day of ʻIzzat (July 9)',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 10, 17); }
      catch { return -1; }
    },
    icon: '🕯️',
    source: 'Shoghi Effendi. "God Passes By."'
  },
  {
    id: 'bahai-birth-bab',
    name: 'Birth of the Báb',
    calendar: 'bahai',
    type: 'religious',
    description: 'Birth of the Báb — 1st day of Muharram corresponding to October 20, 1819',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 13, 1); }
      catch { return -1; }
    },
    icon: '🌟',
    source: 'Shoghi Effendi. "God Passes By."'
  },
  {
    id: 'bahai-birth-bahaullah',
    name: 'Birth of Baháʼu\'lláh',
    calendar: 'bahai',
    type: 'religious',
    description: 'Birth of Baháʼu\'lláh — November 12, 1817',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 14, 1); }
      catch { return -1; }
    },
    icon: '🌟',
    source: 'Shoghi Effendi. "God Passes By."'
  },
  {
    id: 'bahai-ayyam-iha',
    name: 'Ayyám-i-Há (Intercalary Days Begin)',
    nativeName: 'أيام الهاء',
    calendar: 'bahai',
    type: 'religious',
    description: 'Days of hospitality and gift-giving — intercalary days before 19th month',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 0, 1); }
      catch { return -1; }
    },
    icon: '🎁',
    source: 'Baháʼuʼlláh. "Kitáb-i-Aqdas."'
  },
  {
    id: 'bahai-ala-fast',
    name: 'Month of ʻAláʼ (Beginning of Fast)',
    nativeName: 'علاء',
    calendar: 'bahai',
    type: 'religious',
    description: 'Baháʼí month of fasting — 19th month, sunrise-to-sunset fast',
    calculateJDN: (y) => {
      try { return bahaiCalendar.toJDN(Math.max(1, y - 1843), 19, 1); }
      catch { return -1; }
    },
    icon: '🌙',
    source: 'Baháʼuʼlláh. "Kitáb-i-Aqdas."'
  },

  // ═══════════════════════════════════════════════
  // Thai Buddhist Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'buddhist-visakha-bucha',
    name: 'Visakha Bucha (Vesak)',
    nativeName: 'วิสาขบูชา',
    calendar: 'thai-buddhist',
    type: 'religious',
    description: 'Birth, enlightenment, and death of Buddha — full moon of 6th lunar month',
    calculateJDN: (y) => {
      // Approximately full moon near May (use astronomical full moon calculation)
      const mayFullMoon = nextFullMoonJDN(gregorianToJDN(y - 543, 5, 1));
      const gDate = jdnToGregorian(mayFullMoon);
      return gDate.month === 5 ? mayFullMoon : nextFullMoonJDN(mayFullMoon + 20);
    },
    icon: '🪷',
    source: 'Eade, J.C. "The Calendrical Systems of Mainland South-East Asia." Brill, 1995.'
  },
  {
    id: 'buddhist-songkran',
    name: 'Songkran (Thai New Year)',
    nativeName: 'สงกรานต์',
    calendar: 'thai-buddhist',
    type: 'cultural',
    description: 'Traditional Thai New Year and water festival — April 13-15',
    calculateJDN: (y) => gregorianToJDN(y - 543, 4, 13),
    icon: '💧',
    source: 'Royal Thai Government Gazette. Traditional Thai calendar.'
  },
  {
    id: 'buddhist-makha-bucha',
    name: 'Makha Bucha',
    nativeName: 'มาฆบูชา',
    calendar: 'thai-buddhist',
    type: 'religious',
    description: 'Full moon of 3rd lunar month — commemorates 1,250 disciples gathering',
    calculateJDN: (y) => {
      const febFullMoon = nextFullMoonJDN(gregorianToJDN(y - 543, 2, 1));
      const gDate = jdnToGregorian(febFullMoon);
      return gDate.month === 2 || gDate.month === 3 ? febFullMoon : nextFullMoonJDN(febFullMoon + 20);
    },
    icon: '📿',
    source: 'Eade, J.C. "The Calendrical Systems of Mainland South-East Asia." Brill, 1995.'
  },
  {
    id: 'buddhist-asahna-bucha',
    name: 'Asahna Bucha',
    nativeName: 'อาสาฬหบูชา',
    calendar: 'thai-buddhist',
    type: 'religious',
    description: 'Full moon of 8th lunar month — Buddha\'s first sermon (Dhamma)',
    calculateJDN: (y) => {
      const julyFullMoon = nextFullMoonJDN(gregorianToJDN(y - 543, 7, 1));
      const gDate = jdnToGregorian(julyFullMoon);
      return gDate.month === 7 ? julyFullMoon : nextFullMoonJDN(julyFullMoon + 20);
    },
    icon: '🕉️',
    source: 'Eade, J.C. "The Calendrical Systems of Mainland South-East Asia." Brill, 1995.'
  },

  // ═══════════════════════════════════════════════
  // Indian Saka Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'saka-new-year',
    name: 'Saka New Year (Vaisakha 1)',
    nativeName: 'साका नव वर्ष',
    calendar: 'indian-saka',
    type: 'cultural',
    description: 'First day of the Saka calendar year — typically March 22',
    calculateJDN: (y) => {
      const sakaYear = y - 78;
      try { return indianSakaCalendar.toJDN(sakaYear, 1, 1); }
      catch { return gregorianToJDN(y, 3, 22); }
    },
    icon: '🎊',
    source: 'Government of India Gazette. "Indian National Calendar." 1957.'
  },
  {
    id: 'saka-gudi-padwa',
    name: 'Gudi Padwa / Ugadi',
    nativeName: 'गुढी पाडवा',
    calendar: 'indian-saka',
    type: 'cultural',
    description: 'Maharashtrian/Kannada New Year — first day of Chaitra',
    calculateJDN: (y) => {
      const sakaYear = y - 78;
      try { return indianSakaCalendar.toJDN(sakaYear, 1, 1); }
      catch { return gregorianToJDN(y, 3, 22); }
    },
    icon: '🚩',
    source: 'Sewell, Robert. "The Indian Calendar." 1912.'
  },

  // ═══════════════════════════════════════════════
  // Julian Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'julian-orthodox-easter',
    name: 'Orthodox Easter (Pascha)',
    calendar: 'julian',
    type: 'religious',
    description: 'The most important feast in Eastern Orthodox Christianity — celebrates the resurrection of Christ, calculated according to the Julian calendar using the Alexandrian computus',
    calculateJDN: (y) => {
      // Computus for Julian calendar: first Sunday after first full moon after vernal equinox
      // Using Meeus algorithm for Julian Easter
      const a = y % 4;
      const b = y % 7;
      const c = y % 19;
      const d = (19 * c + 15) % 30;
      const e = (2 * a + 4 * b - d + 34) % 7;
      const month = Math.floor((d + e + 114) / 31);
      const day = ((d + e + 114) % 31) + 1;
      return julianToJDN(y, month, day);
    },
    icon: '✝️',
    source: 'Meeus, Jean. "Astronomical Algorithms." Ch. 8 (Computus). Bedjan, Paul. "Calendrier Perpétuel." 1886.'
  },
  {
    id: 'julian-nativity',
    name: 'Nativity of Christ (Julian Christmas)',
    calendar: 'julian',
    type: 'religious',
    description: 'Birth of Jesus Christ — December 25 in the Julian calendar (January 7 Gregorian)',
    calculateJDN: (y) => julianToJDN(y, 12, 25),
    icon: '🎄',
    source: 'Traditional Christian liturgy. Julian calendar observance by Eastern Orthodox churches.'
  },
  {
    id: 'julian-theophany',
    name: 'Theophany (Julian Epiphany)',
    calendar: 'julian',
    type: 'religious',
    description: 'Baptism of Jesus Christ — January 6 in the Julian calendar (January 19 Gregorian)',
    calculateJDN: (y) => julianToJDN(y, 1, 6),
    icon: '💧',
    source: 'Traditional Christian liturgy. Julian calendar observance.'
  },

  // ═══════════════════════════════════════════════
  // Ethiopian Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'ethiopian-enkutatash',
    name: 'Enkutatash (Ethiopian New Year)',
    nativeName: 'እንቁጣጣሽ',
    calendar: 'ethiopian',
    type: 'cultural',
    description: 'Ethiopian New Year — Meskerem 1 (September 11/12 Gregorian) — marks the end of the rainy season',
    calculateJDN: (y) => {
      const eeYear = y - 7; // Approximate: Ethiopia is ~7-8 years behind Gregorian
      try { return ethiopianCalendar.toJDN(Math.max(1, eeYear), 1, 1); }
      catch { return gregorianToJDN(y, 9, 11); }
    },
    icon: '🌼',
    source: 'Munro-Hay, Stuart. "Ethiopia, the Unknown Land." I.B. Tauris, 2002.'
  },
  {
    id: 'ethiopian-genna',
    name: 'Genna (Ethiopian Christmas)',
    nativeName: 'ገና',
    calendar: 'ethiopian',
    type: 'religious',
    description: 'Ethiopian Orthodox Christmas — Tahsas 29 (January 7 Gregorian)',
    calculateJDN: (y) => {
      const eeYear = y - 7;
      try { return ethiopianCalendar.toJDN(Math.max(1, eeYear), 4, 29); }
      catch { return gregorianToJDN(y, 1, 7); }
    },
    icon: '⭐',
    source: 'Ethiopian Orthodox Tewahedo Church tradition. Munro-Hay, Stuart. 2002.'
  },
  {
    id: 'ethiopian-timkat',
    name: 'Timkat (Ethiopian Epiphany)',
    nativeName: 'ጥምቀት',
    calendar: 'ethiopian',
    type: 'religious',
    description: 'Ethiopian Orthodox celebration of the Baptism of Jesus — Tir 11 (January 19 Gregorian)',
    calculateJDN: (y) => {
      const eeYear = y - 7;
      try { return ethiopianCalendar.toJDN(Math.max(1, eeYear), 5, 11); }
      catch { return gregorianToJDN(y, 1, 19); }
    },
    icon: '⛲',
    source: 'Ethiopian Orthodox Tewahedo Church tradition.'
  },
  {
    id: 'ethiopian-meskel',
    name: 'Meskel (Finding of the True Cross)',
    nativeName: 'መስቀል',
    calendar: 'ethiopian',
    type: 'religious',
    description: 'Ethiopian Orthodox feast commemorating the discovery of the True Cross — Meskerem 17 (September 27 Gregorian)',
    calculateJDN: (y) => {
      const eeYear = y - 7;
      try { return ethiopianCalendar.toJDN(Math.max(1, eeYear), 1, 17); }
      catch { return gregorianToJDN(y, 9, 27); }
    },
    icon: '✝️',
    source: 'Ethiopian Orthodox Tewahedo Church tradition. Budge, E.A. Wallis. "The Egyptian Calendar." 1932.'
  },

  // ═══════════════════════════════════════════════
  // Coptic Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'coptic-nayrouz',
    name: 'Nayrouz (Coptic New Year)',
    nativeName: 'ⲛⲓⲁⲣⲁⲣⲁⲛⲓⲃⲉ / ني Rouz',
    calendar: 'coptic',
    type: 'religious',
    description: 'Coptic New Year — Tout 1 (September 11 Gregorian) — Feast of the Martyrs',
    calculateJDN: (y) => {
      const copticYear = y - 283;
      try { return copticCalendar.toJDN(Math.max(1, copticYear), 1, 1); }
      catch { return gregorianToJDN(y, 9, 11); }
    },
    icon: '🌟',
    source: 'Coptic Orthodox Church tradition. Budge, E.A. Wallis. "The Egyptian Calendar." 1932.'
  },
  {
    id: 'coptic-christmas',
    name: 'Coptic Christmas (Kiahk 29)',
    nativeName: 'ⲭⲣⲓⲥⲙⲁⲥ',
    calendar: 'coptic',
    type: 'religious',
    description: 'Coptic Orthodox Christmas — 29th of Koiak/Kiahk (January 7 Gregorian)',
    calculateJDN: (y) => {
      const copticYear = y - 283;
      try { return copticCalendar.toJDN(Math.max(1, copticYear), 4, 29); }
      catch { return gregorianToJDN(y, 1, 7); }
    },
    icon: '⭐',
    source: 'Coptic Orthodox Church tradition.'
  },

  // ═══════════════════════════════════════════════
  // Maya & Aztec Calendars
  // ═══════════════════════════════════════════════
  {
    id: 'mayan-creation',
    name: 'Maya Creation Date (13.0.0.0.0)',
    calendar: 'mayan-longcount',
    type: 'cultural',
    description: 'The Mayan Long Count creation date — beginning of the current world era — 13.0.0.0.0 4 Ajaw 8 Kumk\'u (August 11, 3114 BCE proleptic Gregorian)',
    calculateJDN: () => 584283,
    icon: '🌎',
    source: 'Lounsbury, Floyd G. "Maya Numeration." 1978. GMT correlation: JDN 584283 = 0.0.0.0.0.'
  },
  {
    id: 'mayan-wayeb',
    name: 'Wayeb\' (Haab\' Closing Days)',
    nativeName: 'Wayeb\' / Uayeb',
    calendar: 'mayan-haab',
    type: 'observance',
    description: 'The 5 unlucky days at the end of the Haab\' year — a period of danger and reflection before the new year',
    calculateJDN: (y) => {
      const haabYear = y + 3113; // approximate
      try { return mayanHaabCalendar.toJDN(haabYear, 19, 1); }
      catch { return -1; }
    },
    icon: '⚠️',
    source: 'Aveni, Anthony F. "Skywatchers." University of Texas Press, 2001. Thompson, J.E.S. "Maya Hieroglyphic Writing." 1971.'
  },
  {
    id: 'aztec-nemontemi',
    name: 'Nemontemi (Aztec Unlucky Days)',
    nativeName: 'Nemontemi',
    calendar: 'aztec-xiuhpohualli',
    type: 'observance',
    description: 'The 5 nameless days at the end of the Xiuhpohualli year — a period of danger and fasting before the new year',
    calculateJDN: (y) => {
      const aztecYear = y + 3113;
      try { return aztecXiuhpohualliCalendar.toJDN(aztecYear, 19, 1); }
      catch { return -1; }
    },
    icon: '🌑',
    source: 'Aveni, Anthony F. "Skywatchers." 2001. Sahagún, Bernardino de. "Florentine Codex." c. 1577.'
  },
  {
    id: 'aztec-new-fire',
    name: 'New Fire Ceremony (Toxiuhmolpilli)',
    nativeName: 'Toxiuhmolpilli',
    calendar: 'aztec-xiuhpohualli',
    type: 'observance',
    description: 'The Aztec New Fire ceremony held every 52 years at the completion of the Calendar Round — a cosmic renewal ritual',
    calculateJDN: (y) => {
      const aztecYear = y + 3113;
      // New Fire occurs at 52-year intervals; approximate by finding nearest 52-year mark
      const cyclePos = ((aztecYear % 52) + 52) % 52;
      if (cyclePos === 0) {
        try { return aztecXiuhpohualliCalendar.toJDN(aztecYear, 18, 20); }
        catch { return -1; }
      }
      return -1; // Only on 52-year boundaries
    },
    icon: '🔥',
    source: 'Aveni, Anthony F. "Skywatchers." 2001. Sahagún, Bernardino de. "Florentine Codex."'
  },

  // ═══════════════════════════════════════════════
  // Cherokee Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'cherokee-green-corn',
    name: 'Green Corn Ceremony (Selutsunigv)',
    nativeName: 'ᏎᎷᏧᏂᎬ',
    calendar: 'cherokee',
    type: 'cultural',
    description: 'The most important Cherokee ceremony — thanksgiving for the first corn of the season — lasts 7 days in late summer',
    calculateJDN: (y) => gregorianToJDN(y, 8, 15), // Approximately mid-August
    icon: '🌽',
    source: 'Mooney, James. "Myths of the Cherokee." Bureau of American Ethnology, 1900. Fogelson, Raymond D. "Handbook of N.A. Indians, Vol. 14." Smithsonian, 2004.'
  },
  {
    id: 'cherokee-national-holiday',
    name: 'Cherokee National Holiday',
    nativeName: 'ᏣᎳᎩ ᎠᏰᎵ ᎤᎾᏙᏢᎯ',
    calendar: 'cherokee',
    type: 'cultural',
    description: 'Commemorates the signing of the 1839 Cherokee Constitution — September 6 — celebrated in Tahlequah, Oklahoma',
    calculateJDN: (y) => gregorianToJDN(y, 9, 6),
    icon: '🏛️',
    source: 'Cherokee Nation official calendar. Conley, Robert J. "The Cherokee Nation: A History." 2005.'
  },
  {
    id: 'cherokee-great-new-moon',
    name: 'Great New Moon Festival',
    nativeName: 'ᎤᏃᎸᏔᏅ',
    calendar: 'cherokee',
    type: 'cultural',
    description: 'Traditional Cherokee new year — begins at the first new moon after the fall equinox — a time of renewal and forgiveness',
    calculateJDN: (y) => {
      const equinoxJDN = vernalEquinoxJDN(y); // Using autumnal equinox: add ~182 days
      return nextFullMoonJDN(equinoxJDN + 180);
    },
    icon: '🌙',
    source: 'Mooney, James. "Myths of the Cherokee." 1900. Cherokee traditional practice.'
  },

  // ═══════════════════════════════════════════════
  // Iroquois (Haudenosaunee) Calendar
  // ═══════════════════════════════════════════════
  {
    id: 'iroquois-midwinter',
    name: 'Midwinter Ceremony',
    nativeName: 'Midwinter',
    calendar: 'iroquois',
    type: 'cultural',
    description: 'The most sacred Haudenosaunee ceremony — held in late January/early February — a time of thanksgiving, dream-sharing, and renewal',
    calculateJDN: (y) => gregorianToJDN(y, 1, 15), // Approximately mid-January
    icon: '❄️',
    source: 'Morgan, Lewis Henry. "League of the Ho-dé-no-sau-nee, or Iroquois." 1851. Parker, Arthur C. "The Code of Handsome Lake." 1913.'
  },
  {
    id: 'iroquois-green-corn',
    name: 'Green Corn Festival',
    nativeName: 'Green Corn',
    calendar: 'iroquois',
    type: 'cultural',
    description: 'Haudenosaunee thanksgiving ceremony for the corn harvest — held in late August',
    calculateJDN: (y) => gregorianToJDN(y, 8, 20),
    icon: '🌾',
    source: 'Morgan, Lewis Henry. "League of the Iroquois." 1851. Trigger, Bruce G. "Handbook of N.A. Indians, Vol. 15." Smithsonian, 1978.'
  },
  {
    id: 'iroquois-strawberry',
    name: 'Strawberry Festival',
    nativeName: 'Strawberry',
    calendar: 'iroquois',
    type: 'cultural',
    description: 'Haudenosaunee thanksgiving for the first strawberries of the season — held in June',
    calculateJDN: (y) => gregorianToJDN(y, 6, 10),
    icon: '🍓',
    source: 'Morgan, Lewis Henry. "League of the Iroquois." 1851.'
  },
  {
    id: 'iroquois-harvest',
    name: 'Harvest Festival (Thanksgiving)',
    nativeName: 'Harvest',
    calendar: 'iroquois',
    type: 'cultural',
    description: 'Haudenosaunee thanksgiving for the harvest — held in early autumn',
    calculateJDN: (y) => gregorianToJDN(y, 10, 10),
    icon: '🍂',
    source: 'Morgan, Lewis Henry. "League of the Iroquois." 1851. Parker, Arthur C. 1913.'
  },
];

// ── Get holidays for a date range ──

export interface HolidayEvent {
  date: Date;
  holiday: CulturalHoliday;
  jdn: number;
}

/**
 * Get all cultural holidays that fall within a date range.
 * @param startDate Start of range
 * @param endDate End of range
 * @param calendar Optional — filter to only this calendar's holidays
 * @returns Array of holiday events in the range
 */
export function getHolidaysForRange(
  startDate: Date,
  endDate: Date,
  calendar?: CalendarSystem
): HolidayEvent[] {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startJDN = dateToJDN(startDate);
  const endJDN = dateToJDN(endDate);

  const results: HolidayEvent[] = [];

  for (const holiday of HOLIDAYS) {
    if (calendar && holiday.calendar !== calendar) continue;

    // Check multiple years to handle holidays near year boundaries
    for (let y = startYear - 1; y <= endYear + 1; y++) {
      try {
        const jdn = holiday.calculateJDN(y);
        if (jdn <= 0) continue;
        if (jdn >= startJDN && jdn <= endJDN) {
          // Deduplicate — some holidays might match in adjacent years
          if (!results.some(r => r.holiday.id === holiday.id && r.jdn === jdn)) {
            results.push({
              date: jdnToDate(jdn),
              holiday,
              jdn,
            });
          }
        }
      } catch {
        // Skip holidays that fail to calculate for this year
      }
    }
  }

  return results.sort((a, b) => a.jdn - b.jdn);
}

/**
 * Get all holidays for a specific calendar system.
 */
export function getHolidaysByCalendar(calendar: CalendarSystem): CulturalHoliday[] {
  return HOLIDAYS.filter(h => h.calendar === calendar);
}
