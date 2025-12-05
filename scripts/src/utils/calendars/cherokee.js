"use strict";
/**
 * Cherokee Calendar Converter
 *
 * The Cherokee calendar is a lunar calendar that was adapted to align with
 * the 12-month Gregorian calendar. Each month retains traditional Cherokee
 * names and cultural significance.
 *
 * Traditional month names are preserved while mapping to Gregorian months
 * for practical use. This is an approximation that honors the traditional
 * naming while providing compatibility with modern date systems.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cherokeeCalendar = void 0;
const types_1 = require("./types");
const julianDayUtils_1 = require("./julianDayUtils");
/**
 * Cherokee Calendar Converter Implementation
 *
 * Maps directly to Gregorian calendar structure (12 months)
 * but uses traditional Cherokee month names
 */
exports.cherokeeCalendar = {
    toJDN(year, month, day) {
        // Cherokee calendar uses the same structure as Gregorian
        return (0, julianDayUtils_1.gregorianToJDN)(year, month, day);
    },
    fromJDN(jdn) {
        // Convert from JDN using Gregorian structure
        const { year, month, day } = (0, julianDayUtils_1.jdnToGregorian)(jdn);
        return {
            year,
            month,
            day,
            calendar: 'cherokee',
            era: 'CE'
        };
    },
    getInfo() {
        return types_1.CALENDAR_INFO.cherokee;
    },
    formatDate(date, format = 'YYYY-MM-DD') {
        // Use the comprehensive formatter which has Cherokee month names
        const { formatCalendarDate } = require('./dateFormatter');
        return formatCalendarDate(date, format);
    },
    parseDate(dateStr) {
        // Parse as Gregorian format (same structure)
        const match = dateStr.match(/^(-?\d{4})-(\d{2})-(\d{2})$/);
        if (!match)
            return null;
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }
        return {
            year,
            month,
            day,
            calendar: 'cherokee',
            era: 'CE'
        };
    }
};
