"use strict";
/**
 * Thai Buddhist Calendar Converter
 *
 * The Thai Buddhist calendar is identical to the Gregorian calendar
 * except the year is offset by +543 years (BE = Buddhist Era).
 *
 * Example: 2025 CE = 2568 BE
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.thaiBuddhistCalendar = void 0;
const types_1 = require("./types");
const julianDayUtils_1 = require("./julianDayUtils");
exports.thaiBuddhistCalendar = {
    toJDN(year, month, day) {
        // Convert Buddhist Era year to Gregorian year
        const gregorianYear = year - 543;
        return (0, julianDayUtils_1.gregorianToJDN)(gregorianYear, month, day);
    },
    fromJDN(jdn) {
        const { year, month, day } = (0, julianDayUtils_1.jdnToGregorian)(jdn);
        // Convert Gregorian year to Buddhist Era year
        const buddhistYear = year + 543;
        return {
            year: buddhistYear,
            month,
            day,
            calendar: 'thai-buddhist',
            era: 'BE'
        };
    },
    getInfo() {
        return types_1.CALENDAR_INFO['thai-buddhist'];
    },
    formatDate(date, format = 'YYYY-MM-DD') {
        // Use the comprehensive formatter
        return format
            .replace(/YYYY/g, date.year.toString())
            .replace(/YY/g, date.year.toString().slice(-2))
            .replace(/MM/g, date.month.toString().padStart(2, '0'))
            .replace(/\bM\b/g, date.month.toString())
            .replace(/DD/g, date.day.toString().padStart(2, '0'))
            .replace(/\bD\b/g, date.day.toString())
            .replace(/ERA/g, date.era || 'BE');
    },
    parseDate(dateStr) {
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
            calendar: 'thai-buddhist',
            era: 'BE'
        };
    }
};
