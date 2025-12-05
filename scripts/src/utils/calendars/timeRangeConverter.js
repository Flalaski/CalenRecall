"use strict";
/**
 * Time Range Converter
 *
 * Converts time ranges (decade, year, month, week, day) between different calendar systems.
 * Handles the fact that different calendars have different structures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeRangeBoundsInCalendar = getTimeRangeBoundsInCalendar;
exports.getCanonicalDateInCalendar = getCanonicalDateInCalendar;
exports.navigateInCalendar = navigateInCalendar;
exports.getTimeRangeLabelInCalendar = getTimeRangeLabelInCalendar;
exports.calendarSupportsTimeRange = calendarSupportsTimeRange;
const types_1 = require("./types");
const calendarConverter_1 = require("./calendarConverter");
const dateUtils_1 = require("../dateUtils");
const date_fns_1 = require("date-fns");
/**
 * Get the equivalent time range bounds in a target calendar
 * @param date Date in source calendar
 * @param timeRange Time range type
 * @param targetCalendar Target calendar system
 * @returns Bounds of the time range in target calendar
 */
function getTimeRangeBoundsInCalendar(date, timeRange, targetCalendar) {
    // First, get the bounds in Gregorian (our reference)
    let startDate;
    let endDate;
    switch (timeRange) {
        case 'decade':
            startDate = (0, dateUtils_1.getDecadeStart)(date);
            endDate = (0, dateUtils_1.getDecadeEnd)(date);
            break;
        case 'year':
            startDate = (0, dateUtils_1.getYearStart)(date);
            endDate = (0, dateUtils_1.getYearEnd)(date);
            break;
        case 'month':
            startDate = (0, dateUtils_1.getMonthStart)(date);
            endDate = (0, dateUtils_1.getMonthEnd)(date);
            break;
        case 'week':
            startDate = (0, dateUtils_1.getWeekStart)(date);
            endDate = (0, dateUtils_1.getWeekEnd)(date);
            break;
        case 'day':
            startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            endDate.setHours(23, 59, 59, 999);
            break;
    }
    // Convert bounds to target calendar
    const startCalendar = (0, calendarConverter_1.dateToCalendarDate)(startDate, targetCalendar);
    const endCalendar = (0, calendarConverter_1.dateToCalendarDate)(endDate, targetCalendar);
    return {
        start: startCalendar,
        end: endCalendar,
        startDate,
        endDate,
    };
}
/**
 * Get canonical date for a time range in a specific calendar
 * @param date Date in source calendar
 * @param timeRange Time range type
 * @param targetCalendar Target calendar system
 * @returns Canonical date in target calendar
 */
function getCanonicalDateInCalendar(date, timeRange, targetCalendar) {
    // Get the canonical date in Gregorian first
    let canonicalDate;
    switch (timeRange) {
        case 'decade':
            canonicalDate = (0, dateUtils_1.getDecadeStart)(date);
            break;
        case 'year':
            canonicalDate = (0, dateUtils_1.getYearStart)(date);
            break;
        case 'month':
            canonicalDate = (0, dateUtils_1.getMonthStart)(date);
            break;
        case 'week':
            canonicalDate = (0, dateUtils_1.getWeekStart)(date);
            break;
        case 'day':
            canonicalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            break;
    }
    // Convert to target calendar
    return (0, calendarConverter_1.dateToCalendarDate)(canonicalDate, targetCalendar);
}
/**
 * Navigate to next/previous period in a calendar
 * @param date Current date
 * @param timeRange Time range type
 * @param direction 'next' or 'prev'
 * @param calendar Calendar system
 * @returns New date after navigation
 */
function navigateInCalendar(date, timeRange, direction, calendar) {
    const multiplier = direction === 'next' ? 1 : -1;
    let newDate;
    switch (timeRange) {
        case 'decade':
            newDate = (0, date_fns_1.addYears)(date, multiplier * 10);
            break;
        case 'year':
            newDate = (0, date_fns_1.addYears)(date, multiplier);
            break;
        case 'month':
            newDate = (0, date_fns_1.addMonths)(date, multiplier);
            break;
        case 'week':
            newDate = (0, date_fns_1.addWeeks)(date, multiplier);
            break;
        case 'day':
            newDate = (0, date_fns_1.addDays)(date, multiplier);
            break;
    }
    return newDate;
}
/**
 * Get equivalent time range label in target calendar
 * @param date Date
 * @param timeRange Time range type
 * @param calendar Target calendar system
 * @returns Formatted label
 */
function getTimeRangeLabelInCalendar(date, timeRange, calendar) {
    const calendarDate = (0, calendarConverter_1.dateToCalendarDate)(date, calendar);
    switch (timeRange) {
        case 'decade': {
            // For decade, show the decade range
            // Handle negative years correctly: year 0 = 1 BCE, year -1 = 2 BCE, etc.
            let decadeStart;
            let era;
            if (calendarDate.year <= 0) {
                // Convert to BCE: year 0 → 1 BCE, year -1 → 2 BCE, etc.
                const bceYear = Math.abs(calendarDate.year) + 1;
                decadeStart = Math.floor(bceYear / 10) * 10;
                era = 'BCE';
            }
            else {
                decadeStart = Math.floor(calendarDate.year / 10) * 10;
                // Get era from calendar info
                const calendarInfo = types_1.CALENDAR_INFO[calendar];
                era = calendarInfo?.eraName || '';
            }
            return `${decadeStart}s${era ? ' ' + era : ''}`;
        }
        case 'year': {
            // Handle negative years correctly
            let displayYear;
            let era;
            if (calendarDate.year <= 0) {
                // Convert to BCE: year 0 → 1 BCE, year -1 = 2 BCE, etc.
                displayYear = Math.abs(calendarDate.year) + 1;
                era = 'BCE';
            }
            else {
                displayYear = calendarDate.year;
                // Get era from calendar info
                const calendarInfo = types_1.CALENDAR_INFO[calendar];
                era = calendarInfo?.eraName || '';
            }
            return `${displayYear}${era ? ' ' + era : ''}`;
        }
        case 'month':
            // Include era in format string for negative years
            return (0, calendarConverter_1.formatCalendarDate)(calendarDate, 'MMMM YYYY ERA');
        case 'week': {
            const weekStart = (0, dateUtils_1.getWeekStart)(date);
            const weekStartCal = (0, calendarConverter_1.dateToCalendarDate)(weekStart, calendar);
            // Include era in format string for negative years
            return `Week of ${(0, calendarConverter_1.formatCalendarDate)(weekStartCal, 'MMM D, YYYY ERA')}`;
        }
        case 'day':
            // Include era in format string for negative years
            return (0, calendarConverter_1.formatCalendarDate)(calendarDate, 'EEEE, MMMM D, YYYY ERA');
        default:
            return (0, calendarConverter_1.formatCalendarDate)(calendarDate, 'YYYY-MM-DD ERA');
    }
}
/**
 * Check if a calendar supports a specific time range well
 * Some calendars don't have traditional weeks or decades
 */
function calendarSupportsTimeRange(calendar, timeRange) {
    // All calendars support day, month, year
    if (timeRange === 'day' || timeRange === 'month' || timeRange === 'year') {
        return true;
    }
    // Week support - some calendars don't have traditional weeks
    if (timeRange === 'week') {
        // Islamic calendar traditionally doesn't use weeks, but we can still support it
        // by using Gregorian weeks as reference
        return true; // We'll support it for all calendars
    }
    // Decade support - all calendars can support this conceptually
    if (timeRange === 'decade') {
        return true;
    }
    return true;
}
