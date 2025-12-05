"use strict";
/**
 * Chinese Lunisolar Calendar Converter
 *
 * The Chinese calendar is a complex lunisolar calendar that:
 * - Uses lunar months (29-30 days, alternating)
 * - Adds intercalary (leap) months to align with solar year
 * - Uses 24 solar terms (jieqi) to determine leap months
 * - Year starts on the second new moon after winter solstice
 *
 * This is a simplified implementation. A full implementation would require:
 * - Astronomical calculations for new moons
 * - Solar term calculations (24 jieqi)
 * - Complex rules for leap month placement
 *
 * For now, we use an approximation based on the Metonic cycle (19-year cycle)
 * similar to the Hebrew calendar, but with Chinese month names.
 *
 * Note: This is an approximation. For production use, consider using
 * astronomical libraries or lookup tables for accurate conversions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chineseCalendar = void 0;
const types_1 = require("./types");
const julianDayUtils_1 = require("./julianDayUtils");
// Chinese month names (12 regular months)
const CHINESE_MONTH_NAMES = [
    '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'
];
// Chinese month names (traditional)
const CHINESE_MONTH_NAMES_TRADITIONAL = [
    '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'
];
/**
 * Simplified Chinese calendar epoch
 * Using a common reference: February 5, 1900 CE (approximate start of a Chinese year)
 * This is an approximation - actual Chinese New Year dates vary
 */
const CHINESE_EPOCH_APPROX = (0, julianDayUtils_1.gregorianToJDN)(1900, 2, 5);
/**
 * Average length of a Chinese lunar month (in days)
 * Alternates between 29 and 30 days
 */
const AVERAGE_LUNAR_MONTH = 29.53058867;
/**
 * Average length of a Chinese year (12 lunar months)
 */
const AVERAGE_LUNAR_YEAR = 12 * AVERAGE_LUNAR_MONTH; // ~354.37 days
/**
 * Metonic cycle: 19 solar years ≈ 235 lunar months
 * This is used to approximate the Chinese calendar
 */
const METONIC_CYCLE_YEARS = 19;
const METONIC_CYCLE_MONTHS = 235;
/**
 * Check if a Chinese year is a leap year (has 13 months)
 * Simplified: approximately 7 leap years per 19-year cycle
 */
function isChineseLeapYear(chineseYear) {
    // Simplified leap year pattern (approximation)
    // In a 19-year cycle, years 3, 6, 9, 11, 14, 17, 19 typically have leap months
    const cyclePosition = ((chineseYear - 1) % METONIC_CYCLE_YEARS) + 1;
    const leapYearsInCycle = [3, 6, 9, 11, 14, 17, 19];
    return leapYearsInCycle.includes(cyclePosition);
}
/**
 * Get the number of months in a Chinese year
 */
function getMonthsInYear(chineseYear) {
    return isChineseLeapYear(chineseYear) ? 13 : 12;
}
/**
 * Get the number of days in a Chinese month
 * Simplified: alternates between 29 and 30 days
 */
function getDaysInMonth(chineseYear, month, isLeapMonth) {
    // Simplified: odd months typically have 30 days, even months have 29
    // This is a rough approximation
    const baseDays = (month % 2 === 1) ? 30 : 29;
    // Adjust for leap months (they're typically shorter)
    if (isLeapMonth) {
        return baseDays === 30 ? 29 : 29;
    }
    return baseDays;
}
exports.chineseCalendar = {
    toJDN(year, month, day) {
        // In the simplified implementation:
        // - year: Chinese year number
        // - month: 1-12 (regular) or 13+ for leap months
        // - day: 1-29 or 1-30
        const isLeapMonth = month > 12;
        const actualMonth = isLeapMonth ? month - 12 : month;
        if (actualMonth < 1 || actualMonth > 12) {
            throw new Error(`Invalid Chinese month: ${month}`);
        }
        // Validate day against actual month length
        const maxDays = getDaysInMonth(year, actualMonth, isLeapMonth);
        if (day < 1 || day > maxDays) {
            throw new Error(`Invalid Chinese day: ${day} (month ${month} has ${maxDays} days)`);
        }
        // Handle negative years (before epoch)
        if (year < 1) {
            // For negative years, calculate days before epoch
            // Work backwards: calculate total days from year down to 0 (inclusive)
            let totalDaysInYears = 0;
            for (let y = year; y <= 0; y++) {
                const monthsInYear = getMonthsInYear(y);
                for (let m = 1; m <= monthsInYear; m++) {
                    const isLeap = m > 12;
                    const actualM = isLeap ? m - 12 : m;
                    totalDaysInYears += getDaysInMonth(y, actualM, isLeap);
                }
            }
            // Calculate days in the target year up to this date
            let daysInYear = day - 1;
            if (isLeapMonth) {
                for (let m = 1; m < actualMonth; m++) {
                    daysInYear += getDaysInMonth(year, m, false);
                }
                daysInYear += getDaysInMonth(year, actualMonth, true);
            }
            else {
                for (let m = 1; m < actualMonth; m++) {
                    daysInYear += getDaysInMonth(year, m, false);
                }
            }
            // Days before epoch = total days in all years from year to 0, minus days remaining in target year
            const monthsInYear = getMonthsInYear(year);
            let totalDaysInTargetYear = 0;
            for (let m = 1; m <= monthsInYear; m++) {
                const isLeap = m > 12;
                const actualM = isLeap ? m - 12 : m;
                totalDaysInTargetYear += getDaysInMonth(year, actualM, isLeap);
            }
            const daysBeforeEpoch = totalDaysInYears - (totalDaysInTargetYear - daysInYear);
            return CHINESE_EPOCH_APPROX - daysBeforeEpoch;
        }
        // Normal case: year >= 1
        // Calculate approximate JDN
        // Start from epoch and add years, months, and days
        let jdn = CHINESE_EPOCH_APPROX;
        // Add years (approximate)
        const yearsSinceEpoch = year - 1900;
        jdn += Math.round(yearsSinceEpoch * AVERAGE_LUNAR_YEAR);
        // Add months
        // For leap months, we need to determine which regular month it follows
        if (isLeapMonth) {
            // Leap month typically comes after the month with the same number
            // Add all regular months up to and including the month before the leap month
            for (let m = 1; m < actualMonth; m++) {
                jdn += getDaysInMonth(year, m, false);
            }
            // Add the leap month
            jdn += getDaysInMonth(year, actualMonth, true);
        }
        else {
            // Add all regular months before this month
            for (let m = 1; m < actualMonth; m++) {
                jdn += getDaysInMonth(year, m, false);
            }
            // Check if there's a leap month before this month
            if (isChineseLeapYear(year)) {
                // Simplified: assume leap month is around month 6-7
                // This is a rough approximation
                const leapMonthPosition = 6; // Approximate
                if (actualMonth > leapMonthPosition) {
                    jdn += getDaysInMonth(year, leapMonthPosition, true);
                }
            }
        }
        // Add days
        jdn += day - 1;
        return jdn;
    },
    fromJDN(jdn) {
        // Calculate approximate Chinese date from JDN
        const daysSinceEpoch = jdn - CHINESE_EPOCH_APPROX;
        // Approximate year
        const approximateYears = Math.floor(daysSinceEpoch / AVERAGE_LUNAR_YEAR);
        let chineseYear = 1900 + approximateYears;
        // Refine the year by checking if we're before or after the new year
        // This is simplified - actual calculation would need new moon dates
        let remainingDays = daysSinceEpoch - Math.floor(approximateYears * AVERAGE_LUNAR_YEAR);
        // Adjust year if needed
        while (remainingDays < 0) {
            chineseYear--;
            remainingDays += Math.round(AVERAGE_LUNAR_YEAR);
        }
        // Calculate month and day
        let month = 1;
        let day = 1;
        let isLeapMonth = false;
        let daysRemaining = remainingDays;
        // Iterate through months to find the correct one
        for (let m = 1; m <= 12; m++) {
            const daysInRegularMonth = getDaysInMonth(chineseYear, m, false);
            if (daysRemaining < daysInRegularMonth) {
                month = m;
                day = Math.floor(daysRemaining) + 1;
                isLeapMonth = false;
                break;
            }
            daysRemaining -= daysInRegularMonth;
            // Check for leap month after this regular month
            // Simplified: assume leap month is after month 6 in leap years
            if (isChineseLeapYear(chineseYear) && m === 6) {
                const daysInLeapMonth = getDaysInMonth(chineseYear, 6, true);
                if (daysRemaining < daysInLeapMonth) {
                    month = 12 + 6; // Leap month 6 (represented as month 18)
                    day = Math.floor(daysRemaining) + 1;
                    isLeapMonth = true;
                    break;
                }
                daysRemaining -= daysInLeapMonth;
            }
        }
        // If we haven't found the month yet, it might be in the next year
        // This shouldn't happen with the current logic, but handle edge cases
        if (daysRemaining >= AVERAGE_LUNAR_YEAR) {
            chineseYear++;
            daysRemaining -= Math.round(AVERAGE_LUNAR_YEAR);
            // Recalculate month and day for the new year
            for (let m = 1; m <= 12; m++) {
                const daysInRegularMonth = getDaysInMonth(chineseYear, m, false);
                if (daysRemaining < daysInRegularMonth) {
                    month = m;
                    day = Math.floor(daysRemaining) + 1;
                    isLeapMonth = false;
                    break;
                }
                daysRemaining -= daysInRegularMonth;
            }
        }
        return {
            year: chineseYear,
            month: month,
            day,
            calendar: 'chinese',
            era: 'CE'
        };
    },
    getInfo() {
        return types_1.CALENDAR_INFO.chinese;
    },
    formatDate(date, format = 'YYYY-MM-DD') {
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
    parseDate(dateStr) {
        const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
        if (!match)
            return null;
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
