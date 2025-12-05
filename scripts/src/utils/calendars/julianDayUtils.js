"use strict";
/**
 * Julian Day Number (JDN) Utilities
 *
 * JDN is a continuous count of days since January 1, 4713 BCE (proleptic Julian calendar).
 * It serves as a universal reference point for converting between all calendar systems.
 *
 * Based on algorithms from:
 * - "Calendrical Calculations" by Dershowitz & Reingold
 * - "Astronomical Algorithms" by Jean Meeus
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gregorianToJDN = gregorianToJDN;
exports.jdnToGregorian = jdnToGregorian;
exports.dateToJDN = dateToJDN;
exports.jdnToDate = jdnToDate;
exports.jdnToDayOfWeek = jdnToDayOfWeek;
exports.isGregorianLeapYear = isGregorianLeapYear;
exports.isJulianLeapYear = isJulianLeapYear;
exports.jdnToJulian = jdnToJulian;
exports.julianToJDN = julianToJDN;
/**
 * Convert a Gregorian date to Julian Day Number
 * @param year Year (can be negative for BC dates, where -1 = 2 BCE, 0 = 1 BCE)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @returns Julian Day Number
 */
function gregorianToJDN(year, month, day) {
    // Convert from historical year numbering to astronomical year numbering
    // Historical: 1 = 1 CE, 0 = 1 BCE, -1 = 2 BCE, -100 = 101 BCE (no year 0 in historical)
    // Astronomical: 1 = 1 CE, 0 = 1 BCE, -1 = 2 BCE, -100 = 101 BCE (has year 0)
    // The numbering is the same, so we use the year as-is
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    // Gregorian calendar formula (uses astronomical year numbering)
    // Formula from "Calendrical Calculations" by Dershowitz & Reingold
    return day + Math.floor((153 * m + 2) / 5) + 365 * y +
        Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}
/**
 * Convert Julian Day Number to Gregorian date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-12), and day
 */
function jdnToGregorian(jdn) {
    const j = jdn + 32044;
    const g = Math.floor(j / 146097);
    const dg = j % 146097;
    const c = Math.floor((Math.floor(dg / 36524) + 1) * 3 / 4);
    const dc = dg - c * 36524;
    const b = Math.floor(dc / 1461);
    const db = dc % 1461;
    const a = Math.floor((Math.floor(db / 365) + 1) * 3 / 4);
    const da = db - a * 365;
    const y = g * 400 + c * 100 + b * 4 + a;
    const m = Math.floor((da * 5 + 308) / 153) - 2;
    const d = da - Math.floor((m + 4) * 153 / 5) + 122;
    // Result is in astronomical year numbering (year 0 = 1 BCE)
    // Convert to historical year numbering (year 0 = 1 BCE, same mapping)
    // So no conversion needed - the numbering is the same
    const year = y - 4800 + Math.floor((m + 2) / 12);
    const month = (m + 2) % 12 + 1;
    const day = d + 1;
    return { year, month, day };
}
/**
 * Convert a JavaScript Date object to Julian Day Number
 * @param date Date object
 * @returns Julian Day Number
 */
function dateToJDN(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    return gregorianToJDN(year, month, day);
}
/**
 * Convert Julian Day Number to JavaScript Date object
 * @param jdn Julian Day Number
 * @returns Date object (local time, midnight)
 */
function jdnToDate(jdn) {
    const { year, month, day } = jdnToGregorian(jdn);
    return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
}
/**
 * Get the day of the week from JDN
 * @param jdn Julian Day Number
 * @returns Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
function jdnToDayOfWeek(jdn) {
    return (jdn + 1) % 7;
}
/**
 * Check if a year is a leap year in the Gregorian calendar
 * @param year Year to check
 * @returns true if leap year
 */
function isGregorianLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
/**
 * Check if a year is a leap year in the Julian calendar
 * @param year Year to check
 * @returns true if leap year
 */
function isJulianLeapYear(year) {
    return year % 4 === 0;
}
/**
 * Convert Julian Day Number to Julian calendar date
 * @param jdn Julian Day Number
 * @returns Object with year, month (1-12), and day
 */
function jdnToJulian(jdn) {
    const j = jdn + 1402;
    const k = Math.floor((j - 1) / 1461);
    const l = j - 1461 * k;
    const n = Math.floor((l - 1) / 365) - Math.floor(l / 1461);
    const i = l - 365 * n + 30;
    const j2 = Math.floor((80 * i) / 2447);
    const day = i - Math.floor((2447 * j2) / 80);
    const i2 = Math.floor(j2 / 11);
    const month = j2 + 2 - 12 * i2;
    // Result is in astronomical year numbering (year 0 = 1 BCE)
    // Convert to historical year numbering (same mapping, no conversion needed)
    const year = 4 * k + n + i2 - 4716;
    return { year, month, day };
}
/**
 * Convert Julian calendar date to Julian Day Number
 * @param year Year (can be negative for BC dates)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @returns Julian Day Number
 */
function julianToJDN(year, month, day) {
    // Convert from historical year numbering to astronomical year numbering
    // Historical: 1 = 1 CE, 0 = 1 BCE, -1 = 2 BCE, -100 = 101 BCE
    // Astronomical: 1 = 1 CE, 0 = 1 BCE, -1 = 2 BCE, -100 = 101 BCE
    // The numbering is the same, so we use the year as-is
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    // Julian calendar formula (simpler than Gregorian)
    return day + Math.floor((153 * m + 2) / 5) + 365 * y +
        Math.floor(y / 4) - 32083;
}
