"use strict";
/**
 * Islamic (Hijri) Calendar Converter
 *
 * A purely lunar calendar with 12 months of 29-30 days each.
 * The year is approximately 354-355 days, causing it to drift relative to solar calendars.
 *
 * Era: Starts from 622 CE (Hijra - migration of Muhammad from Mecca to Medina)
 * Era designation: AH (Anno Hegirae)
 *
 * Algorithm based on "Calendrical Calculations" by Dershowitz & Reingold
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.islamicCalendar = void 0;
exports.islamicToJDN = islamicToJDN;
exports.jdnToIslamic = jdnToIslamic;
exports.isIslamicLeapYear = isIslamicLeapYear;
exports.getDaysInIslamicMonth = getDaysInIslamicMonth;
const types_1 = require("./types");
const ISLAMIC_MONTH_NAMES = [
    'Muharram',
    'Safar',
    'Rabi\' al-awwal',
    'Rabi\' al-thani',
    'Jumada al-awwal',
    'Jumada al-thani',
    'Rajab',
    'Sha\'ban',
    'Ramadan',
    'Shawwal',
    'Dhu al-Qi\'dah',
    'Dhu al-Hijjah'
];
const ISLAMIC_MONTH_NAMES_ARABIC = [
    'محرم',
    'صفر',
    'ربيع الأول',
    'ربيع الآخر',
    'جمادى الأولى',
    'جمادى الآخرة',
    'رجب',
    'شعبان',
    'رمضان',
    'شوال',
    'ذو القعدة',
    'ذو الحجة'
];
/**
 * Convert Islamic (Hijri) date to Julian Day Number
 * @param year Islamic year (AH)
 * @param month Month (1-12)
 * @param day Day (1-30)
 * @returns Julian Day Number
 */
function islamicToJDN(year, month, day) {
    // Islamic epoch: July 16, 622 CE (Julian calendar)
    // The epoch JDN 1948439 represents the start of July 16, 622 CE (midnight)
    // This is the standard Islamic calendar epoch used in "Calendrical Calculations"
    const ISLAMIC_EPOCH = 1948439;
    // Handle negative years (before epoch)
    if (year < 1) {
        // For negative years, calculate days before epoch
        // Work backwards: calculate total days from year down to 0 (inclusive)
        let totalDaysInYears = 0;
        for (let y = year; y <= 0; y++) {
            const isLeap = isIslamicLeapYear(y);
            totalDaysInYears += isLeap ? 355 : 354;
        }
        // Calculate days in the target year up to this date
        const isLeap = isIslamicLeapYear(year);
        const monthLengths = isLeap
            ? [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30]
            : [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
        let daysInYear = day - 1;
        for (let m = 1; m < month; m++) {
            daysInYear += monthLengths[m - 1];
        }
        // Days before epoch = total days in all years from year to 0, minus days remaining in target year
        const daysBeforeEpoch = totalDaysInYears - daysInYear;
        return ISLAMIC_EPOCH - daysBeforeEpoch;
    }
    // Normal case: year >= 1
    // Calculate days since Islamic epoch using 30-year cycle
    const cycle30 = Math.floor((year - 1) / 30);
    const yearInCycle = ((year - 1) % 30) + 1;
    // Calculate leap years in completed cycles and current cycle
    const leapYears = cycle30 * 11 +
        (yearInCycle >= 2 ? 1 : 0) + (yearInCycle >= 5 ? 1 : 0) + (yearInCycle >= 7 ? 1 : 0) +
        (yearInCycle >= 10 ? 1 : 0) + (yearInCycle >= 13 ? 1 : 0) + (yearInCycle >= 16 ? 1 : 0) +
        (yearInCycle >= 18 ? 1 : 0) + (yearInCycle >= 21 ? 1 : 0) + (yearInCycle >= 24 ? 1 : 0) +
        (yearInCycle >= 26 ? 1 : 0) + (yearInCycle >= 29 ? 1 : 0);
    const daysInYears = (year - 1) * 354 + leapYears;
    // Calculate days in months
    const isLeap = isIslamicLeapYear(year);
    const monthLengths = isLeap
        ? [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30]
        : [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    let daysInMonths = 0;
    for (let m = 1; m < month; m++) {
        daysInMonths += monthLengths[m - 1];
    }
    return ISLAMIC_EPOCH + daysInYears + daysInMonths + (day - 1);
}
/**
 * Convert Julian Day Number to Islamic (Hijri) date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-12), and day
 */
function jdnToIslamic(jdn) {
    // Islamic epoch: July 16, 622 CE (Julian calendar)
    // The epoch JDN 1948439 represents the start of July 16, 622 CE (midnight)
    // This is the standard Islamic calendar epoch used in "Calendrical Calculations"
    const ISLAMIC_EPOCH = 1948439;
    // Days since Islamic epoch
    const days = jdn - ISLAMIC_EPOCH;
    // Handle dates before epoch (negative years)
    if (days < 0) {
        // Work backwards from epoch
        let remainingDays = -days;
        let year = 0;
        // Find the year by working backwards
        while (remainingDays > 0) {
            const isLeap = isIslamicLeapYear(year);
            const yearLength = isLeap ? 355 : 354;
            if (remainingDays > yearLength) {
                remainingDays -= yearLength;
                year--;
            }
            else {
                // Found the year, now find month and day
                const isLeapYear = isIslamicLeapYear(year);
                const monthLengths = isLeapYear
                    ? [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30]
                    : [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
                let month = 1;
                let day = remainingDays + 1;
                for (let m = 0; m < 12; m++) {
                    if (day <= monthLengths[m]) {
                        month = m + 1;
                        break;
                    }
                    day -= monthLengths[m];
                }
                return { year, month, day };
            }
        }
        // Should not reach here, but return year 0, month 1, day 1 as fallback
        return { year: 0, month: 1, day: 1 };
    }
    // Normal case: days >= 0 (year >= 1)
    // Approximate year (354.36667 days per year on average)
    let year = Math.floor(days / 354.36667) + 1;
    // Refine year calculation using 30-year cycle
    // In a 30-year cycle, there are 11 leap years (years 2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29)
    const cycle30 = (year - 1) % 30;
    const leapYears = Math.floor((year - 1) / 30) * 11 +
        (cycle30 >= 2 ? 1 : 0) + (cycle30 >= 5 ? 1 : 0) + (cycle30 >= 7 ? 1 : 0) +
        (cycle30 >= 10 ? 1 : 0) + (cycle30 >= 13 ? 1 : 0) + (cycle30 >= 16 ? 1 : 0) +
        (cycle30 >= 18 ? 1 : 0) + (cycle30 >= 21 ? 1 : 0) + (cycle30 >= 24 ? 1 : 0) +
        (cycle30 >= 26 ? 1 : 0) + (cycle30 >= 29 ? 1 : 0);
    const daysInYears = (year - 1) * 354 + leapYears;
    // Calculate remaining days
    let remainingDays = days - daysInYears;
    // Adjust if we overshot
    if (remainingDays < 0) {
        year--;
        const prevCycle30 = (year - 1) % 30;
        const prevLeapYears = Math.floor((year - 1) / 30) * 11 +
            (prevCycle30 >= 2 ? 1 : 0) + (prevCycle30 >= 5 ? 1 : 0) + (prevCycle30 >= 7 ? 1 : 0) +
            (prevCycle30 >= 10 ? 1 : 0) + (prevCycle30 >= 13 ? 1 : 0) + (prevCycle30 >= 16 ? 1 : 0) +
            (prevCycle30 >= 18 ? 1 : 0) + (prevCycle30 >= 21 ? 1 : 0) + (prevCycle30 >= 24 ? 1 : 0) +
            (prevCycle30 >= 26 ? 1 : 0) + (prevCycle30 >= 29 ? 1 : 0);
        remainingDays = days - ((year - 1) * 354 + prevLeapYears);
    }
    // Determine if current year is a leap year
    const isLeapYear = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29].includes((year - 1) % 30 + 1);
    // Calculate month
    let month = 1;
    let day = remainingDays + 1;
    // Islamic months alternate 30/29 days, except in leap years
    const monthLengths = isLeapYear
        ? [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30] // Last month has 30 days in leap year
        : [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    for (let i = 0; i < 12; i++) {
        if (day <= monthLengths[i]) {
            month = i + 1;
            break;
        }
        day -= monthLengths[i];
    }
    return { year, month, day };
}
/**
 * Check if an Islamic year is a leap year
 * @param year Islamic year (AH)
 * @returns true if leap year
 */
function isIslamicLeapYear(year) {
    // In 30-year cycle, leap years are: 2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29
    // Handle negative years by normalizing to positive cycle position
    let normalizedYear = year;
    if (year < 1) {
        // For negative years, find equivalent position in cycle
        const cycles = Math.ceil(Math.abs(year) / 30);
        normalizedYear = year + (cycles * 30);
    }
    const position = ((normalizedYear - 1) % 30) + 1;
    return [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29].includes(position);
}
/**
 * Get number of days in an Islamic month
 * @param year Islamic year (AH)
 * @param month Month (1-12)
 * @returns Number of days in the month
 */
function getDaysInIslamicMonth(year, month) {
    const isLeap = isIslamicLeapYear(year);
    // Months alternate 30/29, except last month in leap year
    if (month === 12 && isLeap) {
        return 30;
    }
    return (month % 2 === 1) ? 30 : 29;
}
/**
 * Islamic Calendar Converter Implementation
 */
exports.islamicCalendar = {
    toJDN(year, month, day) {
        return islamicToJDN(year, month, day);
    },
    fromJDN(jdn) {
        const { year, month, day } = jdnToIslamic(jdn);
        return {
            year,
            month,
            day,
            calendar: 'islamic',
            era: 'AH'
        };
    },
    getInfo() {
        return types_1.CALENDAR_INFO.islamic;
    },
    formatDate(date, format = 'YYYY-MM-DD') {
        const year = date.year.toString().padStart(4, '0');
        const month = date.month.toString().padStart(2, '0');
        const day = date.day.toString().padStart(2, '0');
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('MMMM', ISLAMIC_MONTH_NAMES[date.month - 1])
            .replace('MMM', ISLAMIC_MONTH_NAMES[date.month - 1].substring(0, 3))
            .replace('ERA', date.era || 'AH');
    },
    parseDate(dateStr) {
        // Simple parser for YYYY-MM-DD format
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match)
            return null;
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (month < 1 || month > 12 || day < 1 || day > 30) {
            return null;
        }
        return {
            year,
            month,
            day,
            calendar: 'islamic',
            era: 'AH'
        };
    }
};
