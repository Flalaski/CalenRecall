/**
 * Calendar Descriptions and History
 * 
 * Provides detailed descriptions, history, and contextual information
 * for each calendar system supported by the application.
 */

import { CalendarSystem } from './types';

export interface CalendarDescription {
  definition: string;
  history: string;
  notes?: string;
}

export const CALENDAR_DESCRIPTIONS: Record<CalendarSystem, CalendarDescription> = {
  gregorian: {
    definition: 'A solar calendar system introduced by Pope Gregory XIII in 1582 as a refinement of the Julian calendar. It is the most widely used civil calendar in the world today.',
    history: 'The Gregorian calendar was introduced to correct the drift of the Julian calendar, which had accumulated about 10 days of error since its introduction. The reform adjusted the leap year rule and removed 10 days from October 1582. It was gradually adopted by different countries over the following centuries, with some nations not adopting it until the 20th century.',
    notes: 'The calendar uses a 400-year cycle with 97 leap years. Century years are only leap years if divisible by 400.'
  },
  julian: {
    definition: 'A solar calendar system introduced by Julius Caesar in 46 BCE, replacing the Roman calendar. It was the predominant calendar in the Roman world and later in Europe until the adoption of the Gregorian calendar.',
    history: 'The Julian calendar was implemented in 45 BCE and standardized the year to 365.25 days by adding a leap day every four years. It remained in use throughout the Roman Empire and was adopted by the Christian church. Many Eastern Orthodox churches still use the Julian calendar for calculating Easter and other religious holidays.',
    notes: 'The Julian calendar has a simpler leap year rule than the Gregorian: every year divisible by 4 is a leap year. This causes it to drift about one day every 128 years relative to the solar year.'
  },
  islamic: {
    definition: 'A purely lunar calendar used by Muslims worldwide to determine religious observances. The calendar consists of 12 lunar months totaling approximately 354 or 355 days.',
    history: 'The Islamic calendar (Hijri calendar) began in 622 CE when the Prophet Muhammad migrated from Mecca to Medina (the Hijra). It is used for religious purposes throughout the Islamic world. The calendar is based on actual lunar observations, though mathematical calculations are also used.',
    notes: 'Because the Islamic year is about 11 days shorter than the solar year, Islamic dates shift earlier each year relative to the Gregorian calendar. The calendar uses a 30-year cycle with 11 leap years.'
  },
  hebrew: {
    definition: 'A lunisolar calendar used for Jewish religious observances and as the official calendar of Israel. It combines lunar months with solar years through intercalation.',
    history: 'The Hebrew calendar has ancient origins, with its current form developing over centuries. The era (Anno Mundi) is calculated from the traditional date of creation, 3761 BCE. The calendar uses a 19-year Metonic cycle to synchronize lunar and solar cycles, adding an extra month (Adar II) in 7 out of every 19 years.',
    notes: 'The Hebrew calendar determines the start of months based on the new moon, and years can have 12 or 13 months. The calendar is used to determine Jewish holidays and religious observances.'
  },
  persian: {
    definition: 'A solar calendar used in Iran and Afghanistan, also known as the Jalali calendar or Solar Hijri calendar. It is based on astronomical observations of the vernal equinox.',
    history: 'The modern Persian calendar was developed by a group of astronomers including Omar Khayyam in 1079 CE during the Seljuk period. It replaced earlier Persian calendars and is more accurate than the Gregorian calendar in tracking the solar year. The calendar era begins with the Hijra in 622 CE.',
    notes: 'The Persian calendar determines leap years based on the actual timing of the vernal equinox, making it more accurate than fixed-cycle calendars. It is the official calendar of Iran and Afghanistan.'
  },
  chinese: {
    definition: 'A lunisolar calendar system (农历, nónglì) used in China and other East Asian countries for traditional festivals, cultural events, and agricultural planning. It combines lunar months (月, yuè) with 24 solar terms (节气, jiéqì) to align lunar cycles with the solar year. The calendar divides time into traditional periods: months are divided into three ten-day periods (旬, xún), and years are organized in a 60-year sexagenary cycle (干支, gānzhī) combining 10 heavenly stems (天干, tiāngān) and 12 earthly branches (地支, dìzhī).',
    history: 'The Chinese calendar has been in use for over 3,000 years, with its origins in the Shang Dynasty. The calendar uses a 60-year sexagenary cycle (干支纪年) combining 10 heavenly stems and 12 earthly branches, with each year receiving a unique name from this cycle. It determines months by lunar phases (new moon to new moon) and years by solar terms, with intercalary months (闰月, rùnyuè) added approximately every 2-3 years to keep the calendar aligned with seasons. The 24 solar terms (二十四节气) divide the year based on the sun\'s position and guide agricultural activities.',
    notes: 'The Chinese calendar is still actively used alongside the Gregorian calendar in China for traditional holidays like Chinese New Year (春节, Chūnjié) and the Mid-Autumn Festival (中秋节, Zhōngqiūjié). Each year is associated with one of 12 zodiac animals (生肖, shēngxiào) in a repeating cycle. Months are divided into three ten-day periods: 上旬 (shàngxún, days 1-10), 中旬 (zhōngxún, days 11-20), and 下旬 (xiàxún, days 21-30). The calendar uses continuous year numbering rather than era-based dating.'
  },
  ethiopian: {
    definition: 'A solar calendar used in Ethiopia and Eritrea, similar to the Coptic calendar but with different month names and era. The year has 13 months, with 12 months of 30 days and a 13th month of 5 or 6 days.',
    history: 'The Ethiopian calendar is based on the ancient Coptic calendar but uses different month names in Ge\'ez and Amharic. The calendar era is about 7-8 years behind the Gregorian calendar due to different calculations of the date of the Annunciation. It is the official calendar of Ethiopia.',
    notes: 'Ethiopian New Year falls on September 11 (or September 12 in leap years) in the Gregorian calendar. The calendar is used for both civil and religious purposes in Ethiopia.'
  },
  coptic: {
    definition: 'A solar calendar used by the Coptic Orthodox Church, based on the ancient Egyptian calendar. It has 13 months: 12 months of 30 days each, plus a 13th month of 5 or 6 days.',
    history: 'The Coptic calendar is derived from the ancient Egyptian calendar and was reformed in the 3rd century CE. The era (Anno Martyrum) begins in 284 CE, the year Diocletian became Roman emperor. The calendar is used by Coptic Christians for religious observances.',
    notes: 'The Coptic calendar is still used by the Coptic Orthodox Church to determine religious holidays. Coptic New Year (Nayrouz) falls on September 11 in the Gregorian calendar (September 12 in leap years).'
  },
  'indian-saka': {
    definition: 'The official civil calendar of India, also known as the Saka Samvat. It is a solar calendar with 12 months, used alongside the Gregorian calendar for official purposes.',
    history: 'The Saka era is believed to have begun in 78 CE, possibly marking the beginning of the Saka kingdom in western India. The Indian National Calendar was officially adopted in 1957 CE for use alongside the Gregorian calendar. It uses the same leap year rules as the Gregorian calendar.',
    notes: 'The Saka calendar is used for official purposes in India, appearing on government documents and calendars. The calendar year begins in March/April, corresponding to the traditional Indian new year.'
  },
  bahai: {
    definition: 'A solar calendar used by followers of the Baháʼí Faith. The calendar has 19 months of 19 days each, plus 4 or 5 intercalary days, totaling 365 or 366 days per year.',
    history: 'The Baháʼí calendar was established by the Báb, the forerunner of Baháʼu\'lláh, in the mid-19th century. The calendar era begins in 1844 CE, the year the Báb declared his mission. The calendar is used by Baháʼís worldwide for religious observances and community activities.',
    notes: 'The Baháʼí calendar year begins at the vernal equinox (March 20 or 21). Each month is named after an attribute of God, and the calendar includes holy days and periods of fasting.'
  },
  'thai-buddhist': {
    definition: 'A solar calendar used in Thailand, based on the Buddhist era. It is essentially the Gregorian calendar with years numbered from the traditional date of the Buddha\'s death (543 BCE).',
    history: 'The Thai Buddhist calendar was introduced in Thailand in the 19th century, replacing earlier calendar systems. The Buddhist era (BE) is calculated by adding 543 years to the Gregorian year. The calendar uses the same structure and leap year rules as the Gregorian calendar.',
    notes: 'The Thai Buddhist calendar is used alongside the Gregorian calendar in Thailand. Years are often written with both BE and CE designations. The calendar is used for both civil and religious purposes.'
  },
  'mayan-tzolkin': {
    definition: 'A 260-day sacred calendar cycle used by the Maya civilization. It consists of 20 day names combined with 13 numbers, creating a 260-day cycle that repeats continuously.',
    history: 'The Tzolk\'in calendar was one of the most important calendar systems used by the Maya, dating back to at least 500 BCE. It was used for religious ceremonies, divination, and determining auspicious dates. The 260-day cycle has no direct astronomical basis but may relate to human gestation periods or agricultural cycles.',
    notes: 'The Tzolk\'in calendar is still used by some Maya communities today for traditional ceremonies. It runs independently of other calendar cycles and combines with the Haab\' calendar to create the Calendar Round (52-year cycle).'
  },
  'mayan-haab': {
    definition: 'A 365-day solar calendar used by the Maya civilization, consisting of 18 months of 20 days each, plus a 5-day period called Wayeb\' at the end of the year.',
    history: 'The Haab\' calendar was the Maya civil calendar, used alongside the Tzolk\'in for everyday purposes. It dates back to the Pre-Classic period of Maya civilization. Unlike the Tzolk\'in, the Haab\' approximates the solar year but does not account for leap years, causing it to drift over long periods.',
    notes: 'The Haab\' calendar combines with the Tzolk\'in to form the Calendar Round, a 52-year cycle (18,980 days). The Wayeb\' period was considered unlucky and dangerous.'
  },
  'mayan-longcount': {
    definition: 'A linear calendar system used by the Maya to record dates over long periods. It counts days from a fixed starting point (the Maya creation date, August 11, 3114 BCE in the Gregorian calendar).',
    history: 'The Long Count calendar was developed by the Maya to record historical events and astronomical cycles over thousands of years. It uses a base-20 (vigesimal) numbering system with modifications. The calendar was used on monuments and codices to record dates of significant events.',
    notes: 'The Long Count calendar is written using periods of days: baktuns (144,000 days), katuns (7,200 days), tuns (360 days), uinals (20 days), and kins (1 day). The famous "end date" of December 21, 2012, was simply the completion of a baktun cycle.'
  },
  cherokee: {
    definition: 'A 12-month calendar system adapted from traditional Cherokee seasonal observations, aligned with the Gregorian calendar structure for practical use.',
    history: 'Traditional Cherokee timekeeping was based on lunar cycles and seasonal observations. The modern 12-month adaptation preserves Cherokee month names and cultural associations while aligning with the Gregorian calendar for contemporary use. Each month reflects traditional Cherokee seasonal activities and natural cycles.',
    notes: 'The Cherokee calendar months are named after natural phenomena, agricultural activities, and seasonal changes important to Cherokee culture. This adaptation allows the calendar to be used alongside the Gregorian calendar while maintaining cultural significance.'
  },
  iroquois: {
    definition: 'A 13-moon calendar system used by the Haudenosaunee (Iroquois) Confederacy, based on lunar cycles. Each moon represents approximately 28 days, totaling about 364 days per year.',
    history: 'The Iroquois calendar is based on the observation of 13 lunar cycles per solar year, which is closer to the actual relationship between lunar and solar cycles than the 12-month system. Each moon is named after natural phenomena, agricultural activities, or cultural events. The calendar reflects the deep connection between the Haudenosaunee people and natural cycles.',
    notes: 'The 13-moon calendar aligns more closely with natural cycles than 12-month calendars. Each moon has cultural and spiritual significance, and the calendar is used for traditional ceremonies and community activities. The calendar requires periodic adjustment to align with the solar year.'
  },
  'aztec-xiuhpohualli': {
    definition: 'A 365-day solar calendar used by the Aztec civilization, consisting of 18 months of 20 days each, plus a 5-day period called Nemontemi. The calendar was part of a complex calendrical system.',
    history: 'The Xiuhpohualli was one of two main calendar cycles used by the Aztecs, dating to the Post-Classic period (c. 1325-1521 CE). It was used alongside the 260-day Tonalpohualli calendar. The calendar was essential for agricultural planning, religious ceremonies, and historical record-keeping. The 5-day Nemontemi period was considered dangerous and unlucky.',
    notes: 'The Xiuhpohualli combines with the Tonalpohualli to create a 52-year cycle called the Calendar Round. The calendar does not account for leap years, causing it to drift over time. Each of the 18 months had specific religious and agricultural significance.'
  }
};

