"use strict";
/**
 * Iroquois (Haudenosaunee) Calendar Converter
 *
 * The Iroquois calendar is a lunisolar calendar with 13 moons per year.
 * Each moon corresponds to a full moon cycle and is associated with
 * specific energies, purposes, and natural phenomena.
 *
 * This implementation approximates the 13-moon structure by mapping
 * to the Gregorian calendar while preserving the 13-moon concept.
 * Each "moon" is approximately 28 days (lunar cycle).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.iroquoisCalendar = void 0;
const types_1 = require("./types");
const julianDayUtils_1 = require("./julianDayUtils");
/**
 * Convert Gregorian date to Iroquois 13-moon calendar
 *
 * The Iroquois calendar has 13 moons of approximately 28 days each.
 * We approximate this by dividing the year into 13 periods.
 */
function gregorianToIroquois(year, month, day) {
    // Calculate day of year (1-365/366)
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dayOfYear = day;
    for (let i = 0; i < month - 1; i++) {
        dayOfYear += daysInMonth[i];
    }
    // Divide year into 13 moons (approximately 28 days each)
    // Total days: 365 or 366
    // 13 moons × 28 days = 364 days
    // We'll use 13 periods of ~28 days, with the last period having extra days
    const daysPerMoon = Math.floor(365.25 / 13); // ~28.1 days
    const moon = Math.min(13, Math.floor((dayOfYear - 1) / daysPerMoon) + 1);
    const dayInMoon = ((dayOfYear - 1) % daysPerMoon) + 1;
    return { year, moon, day: dayInMoon };
}
/**
 * Convert Iroquois 13-moon date to Gregorian
 */
function iroquoisToGregorian(year, moon, day) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysPerMoon = Math.floor(365.25 / 13); // ~28.1 days
    // Calculate day of year
    const dayOfYear = (moon - 1) * daysPerMoon + day;
    // Convert day of year to month and day
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let remainingDays = dayOfYear;
    let month = 1;
    for (let i = 0; i < 12; i++) {
        if (remainingDays <= daysInMonth[i]) {
            month = i + 1;
            break;
        }
        remainingDays -= daysInMonth[i];
    }
    return { year, month, day: remainingDays };
}
/**
 * Iroquois Calendar Converter Implementation
 */
exports.iroquoisCalendar = {
    toJDN(year, month, day) {
        // month is actually "moon" (1-13) in Iroquois calendar
        const gregorian = iroquoisToGregorian(year, month, day);
        return (0, julianDayUtils_1.gregorianToJDN)(gregorian.year, gregorian.month, gregorian.day);
    },
    fromJDN(jdn) {
        const { year, month, day } = (0, julianDayUtils_1.jdnToGregorian)(jdn);
        const iroquois = gregorianToIroquois(year, month, day);
        return {
            year: iroquois.year,
            month: iroquois.moon, // Store as "moon" but use month field
            day: iroquois.day,
            calendar: 'iroquois',
            era: 'CE'
        };
    },
    getInfo() {
        return types_1.CALENDAR_INFO.iroquois;
    },
    formatDate(date, format = 'YYYY-MM-DD') {
        // Use the comprehensive formatter which has Iroquois moon names
        const { formatCalendarDate } = require('./dateFormatter');
        return formatCalendarDate(date, format);
    },
    parseDate(dateStr) {
        const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
        if (!match)
            return null;
        const year = parseInt(match[1], 10);
        const moon = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (moon < 1 || moon > 13 || day < 1 || day > 31) {
            return null;
        }
        return {
            year,
            month: moon, // Store moon in month field
            day,
            calendar: 'iroquois',
            era: 'CE'
        };
    }
};
