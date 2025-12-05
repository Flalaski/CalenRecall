"use strict";
/**
 * Universal Calendar Converter
 *
 * Provides a unified interface for converting dates between different calendar systems.
 * All conversions go through Julian Day Number (JDN) as the universal reference.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCalendarConverter = registerCalendarConverter;
exports.getCalendarConverter = getCalendarConverter;
exports.convertDate = convertDate;
exports.dateToCalendarDate = dateToCalendarDate;
exports.calendarDateToDate = calendarDateToDate;
exports.formatCalendarDate = formatCalendarDate;
exports.parseCalendarDate = parseCalendarDate;
const julianDayUtils_1 = require("./julianDayUtils");
const islamic_1 = require("./islamic");
const hebrew_1 = require("./hebrew");
const julianDayUtils_2 = require("./julianDayUtils");
const dateFormatter_1 = require("./dateFormatter");
const cherokee_1 = require("./cherokee");
const iroquois_1 = require("./iroquois");
const persian_1 = require("./persian");
const ethiopian_1 = require("./ethiopian");
const coptic_1 = require("./coptic");
const indianSaka_1 = require("./indianSaka");
const thaiBuddhist_1 = require("./thaiBuddhist");
const bahai_1 = require("./bahai");
const mayanTzolkin_1 = require("./mayanTzolkin");
const mayanHaab_1 = require("./mayanHaab");
const mayanLongCount_1 = require("./mayanLongCount");
const aztecXiuhpohualli_1 = require("./aztecXiuhpohualli");
const chinese_1 = require("./chinese");
// Registry of calendar converters
const calendarConverters = {
    gregorian: {
        toJDN(year, month, day) {
            return (0, julianDayUtils_1.gregorianToJDN)(year, month, day);
        },
        fromJDN(jdn) {
            const { year, month, day } = (0, julianDayUtils_1.jdnToGregorian)(jdn);
            // Set era correctly: BCE for negative years and year 0, CE for positive years
            const era = year <= 0 ? 'BCE' : 'CE';
            return { year, month, day, calendar: 'gregorian', era };
        },
        getInfo() {
            return {
                name: 'Gregorian',
                nativeName: 'Gregorian',
                type: 'solar',
                months: 12,
                daysInYear: { min: 365, max: 366 },
                eraStart: 1,
                eraName: 'CE'
            };
        },
        formatDate(date, format = 'YYYY-MM-DD') {
            const year = date.year.toString().padStart(4, '0');
            const month = date.month.toString().padStart(2, '0');
            const day = date.day.toString().padStart(2, '0');
            return format
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day);
        },
        parseDate(dateStr) {
            const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
            if (!match)
                return null;
            return {
                year: parseInt(match[1], 10),
                month: parseInt(match[2], 10),
                day: parseInt(match[3], 10),
                calendar: 'gregorian',
                era: 'CE'
            };
        }
    },
    julian: {
        toJDN(year, month, day) {
            return (0, julianDayUtils_2.julianToJDN)(year, month, day);
        },
        fromJDN(jdn) {
            const { year, month, day } = (0, julianDayUtils_2.jdnToJulian)(jdn);
            // Set era correctly: BCE for negative years and year 0, CE for positive years
            const era = year <= 0 ? 'BCE' : 'CE';
            return { year, month, day, calendar: 'julian', era };
        },
        getInfo() {
            return {
                name: 'Julian',
                nativeName: 'Julian',
                type: 'solar',
                months: 12,
                daysInYear: { min: 365, max: 366 },
                eraStart: 1,
                eraName: 'CE'
            };
        },
        formatDate(date, format = 'YYYY-MM-DD') {
            const year = date.year.toString().padStart(4, '0');
            const month = date.month.toString().padStart(2, '0');
            const day = date.day.toString().padStart(2, '0');
            return format
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day);
        },
        parseDate(dateStr) {
            const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
            if (!match)
                return null;
            return {
                year: parseInt(match[1], 10),
                month: parseInt(match[2], 10),
                day: parseInt(match[3], 10),
                calendar: 'julian',
                era: 'CE'
            };
        }
    },
    islamic: islamic_1.islamicCalendar,
    hebrew: hebrew_1.hebrewCalendar,
    cherokee: cherokee_1.cherokeeCalendar,
    iroquois: iroquois_1.iroquoisCalendar,
    persian: persian_1.persianCalendar,
    ethiopian: ethiopian_1.ethiopianCalendar,
    coptic: coptic_1.copticCalendar,
    'indian-saka': indianSaka_1.indianSakaCalendar,
    'thai-buddhist': thaiBuddhist_1.thaiBuddhistCalendar,
    bahai: bahai_1.bahaiCalendar,
    'mayan-tzolkin': mayanTzolkin_1.mayanTzolkinCalendar,
    'mayan-haab': mayanHaab_1.mayanHaabCalendar,
    'mayan-longcount': mayanLongCount_1.mayanLongCountCalendar,
    'aztec-xiuhpohualli': aztecXiuhpohualli_1.aztecXiuhpohualliCalendar,
    chinese: chinese_1.chineseCalendar
};
/**
 * Register a calendar converter
 */
function registerCalendarConverter(calendar, converter) {
    calendarConverters[calendar] = converter;
}
/**
 * Get a calendar converter
 */
function getCalendarConverter(calendar) {
    return calendarConverters[calendar] || null;
}
/**
 * Convert a date from one calendar system to another
 * @param date Source date
 * @param toCalendar Target calendar system
 * @returns Converted date in target calendar
 */
function convertDate(date, toCalendar) {
    const fromConverter = getCalendarConverter(date.calendar);
    const toConverter = getCalendarConverter(toCalendar);
    if (!fromConverter || !toConverter) {
        throw new Error(`Calendar converter not available for ${date.calendar} or ${toCalendar}`);
    }
    // Convert to JDN
    const jdn = fromConverter.toJDN(date.year, date.month, date.day);
    // Convert from JDN to target calendar
    return toConverter.fromJDN(jdn);
}
/**
 * Convert a JavaScript Date to a calendar date
 * @param date Date object (assumed to be Gregorian)
 * @param calendar Target calendar system
 * @returns Calendar date
 */
function dateToCalendarDate(date, calendar) {
    const jdn = (0, julianDayUtils_1.dateToJDN)(date);
    const converter = getCalendarConverter(calendar);
    if (!converter) {
        throw new Error(`Calendar converter not available for ${calendar}`);
    }
    return converter.fromJDN(jdn);
}
/**
 * Convert a calendar date to a JavaScript Date
 * @param date Calendar date
 * @returns Date object (in Gregorian calendar)
 */
function calendarDateToDate(date) {
    const converter = getCalendarConverter(date.calendar);
    if (!converter) {
        throw new Error(`Calendar converter not available for ${date.calendar}`);
    }
    const jdn = converter.toJDN(date.year, date.month, date.day);
    return (0, julianDayUtils_1.jdnToDate)(jdn);
}
/**
 * Format a calendar date as a string
 * @param date Calendar date
 * @param format Format string (default: 'YYYY-MM-DD')
 * @returns Formatted date string
 */
function formatCalendarDate(date, format = 'YYYY-MM-DD') {
    // Use the comprehensive formatter for all calendars
    return (0, dateFormatter_1.formatCalendarDate)(date, format);
}
/**
 * Parse a date string in a specific calendar format
 * @param dateStr Date string
 * @param calendar Calendar system
 * @returns Parsed calendar date or null if invalid
 */
function parseCalendarDate(dateStr, calendar) {
    const converter = getCalendarConverter(calendar);
    if (!converter) {
        return null;
    }
    return converter.parseDate(dateStr);
}
