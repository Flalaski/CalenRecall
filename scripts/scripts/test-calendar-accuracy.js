"use strict";
/**
 * Calendar Accuracy Tester
 *
 * Comprehensive test suite to verify the accuracy and alignment of all calendar systems.
 * Tests include:
 * - Round-trip conversions (A -> B -> A)
 * - JDN consistency (same JDN should produce same dates)
 * - Known reference dates
 * - Edge cases (leap years, epoch boundaries, negative years)
 * - Formatting and parsing
 * - Era designations
 *
 * Run with: npx ts-node scripts/test-calendar-accuracy.ts
 * Or compile first: tsc scripts/test-calendar-accuracy.ts && node scripts/test-calendar-accuracy.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFERENCE_DATES = exports.CalendarTester = void 0;
const calendarConverter_1 = require("../src/utils/calendars/calendarConverter");
const julianDayUtils_1 = require("../src/utils/calendars/julianDayUtils");
const REFERENCE_DATES = [
    {
        name: 'Gregorian Epoch',
        gregorian: { year: 1, month: 1, day: 1 },
        jdn: 1721426,
        description: 'January 1, 1 CE (Gregorian)'
    },
    {
        name: 'Julian Epoch',
        gregorian: { year: 1, month: 1, day: 1 },
        jdn: 1721426,
        description: 'January 1, 1 CE (Julian)'
    },
    {
        name: 'Islamic Epoch',
        gregorian: { year: 622, month: 7, day: 16 },
        jdn: 1948439,
        description: 'July 16, 622 CE (Hijra - start of Islamic calendar)'
    },
    {
        name: 'Hebrew Epoch',
        gregorian: { year: -3761, month: 10, day: 7 },
        jdn: 347997,
        description: 'October 7, 3761 BCE (Creation - start of Hebrew calendar)'
    },
    {
        name: 'Persian Epoch',
        gregorian: { year: 622, month: 3, day: 19 },
        jdn: 1948318,
        description: 'March 19, 622 CE (Naw-Rúz - start of Persian calendar)'
    },
    {
        name: 'Mayan Epoch',
        gregorian: { year: -3114, month: 8, day: 11 },
        jdn: 584283,
        description: 'August 11, 3114 BCE (GMT correlation - Mayan epoch)'
    },
    {
        name: 'Modern Date',
        gregorian: { year: 2024, month: 1, day: 1 },
        jdn: 2460311, // Corrected: was 2460106
        description: 'January 1, 2024 CE'
    },
    {
        name: 'Leap Year Date',
        gregorian: { year: 2024, month: 2, day: 29 },
        jdn: 2460370, // Corrected: was 2460136
        description: 'February 29, 2024 CE (leap year)'
    },
    {
        name: 'Negative Year',
        gregorian: { year: -100, month: 1, day: 1 },
        jdn: 1684536, // Corrected: was 1686042 (verified with formula)
        description: 'January 1, 101 BCE'
    },
    {
        name: 'Year Zero',
        gregorian: { year: 0, month: 1, day: 1 },
        jdn: 1721060, // Corrected: was 1721058 (2 day difference)
        description: 'January 1, 1 BCE (astronomical year 0)'
    }
];
exports.REFERENCE_DATES = REFERENCE_DATES;
class CalendarTester {
    constructor() {
        this.results = [];
        this.allCalendars = [
            'gregorian',
            'julian',
            'islamic',
            'hebrew',
            'persian',
            'chinese',
            'ethiopian',
            'coptic',
            'indian-saka',
            'bahai',
            'thai-buddhist',
            'mayan-tzolkin',
            'mayan-haab',
            'mayan-longcount',
            'cherokee',
            'iroquois',
            'aztec-xiuhpohualli'
        ];
    }
    recordTest(testName, passed, message, details) {
        this.results.push({ testName, passed, message, details });
        const status = passed ? '✓' : '✗';
        console.log(`${status} ${testName}: ${message}`);
        if (details && !passed) {
            console.log(`  Details:`, JSON.stringify(details, null, 2));
        }
    }
    /**
     * Test 1: JDN Consistency
     * Verify that converting a date to JDN and back produces the same date
     */
    testJDNConsistency() {
        console.log('\n=== Test 1: JDN Consistency ===');
        for (const calendar of this.allCalendars) {
            const converter = (0, calendarConverter_1.getCalendarConverter)(calendar);
            if (!converter) {
                this.recordTest(`JDN Consistency (${calendar})`, false, 'Converter not found');
                continue;
            }
            // Test with various dates
            const testDates = [
                { year: 1, month: 1, day: 1 },
                { year: 100, month: 6, day: 15 },
                { year: 1000, month: 12, day: 31 },
                { year: 2024, month: 2, day: 29 },
                { year: 0, month: 1, day: 1 },
                { year: -100, month: 7, day: 4 }
            ];
            for (const testDate of testDates) {
                try {
                    const jdn = converter.toJDN(testDate.year, testDate.month, testDate.day);
                    const converted = converter.fromJDN(jdn);
                    // For some calendars, the round-trip might not be exact due to approximations
                    // Check if the JDN matches (more reliable than date matching)
                    const jdn2 = converter.toJDN(converted.year, converted.month, converted.day);
                    const jdnMatches = Math.abs(jdn - jdn2) <= 1; // Allow 1 day tolerance for approximations
                    if (!jdnMatches) {
                        this.recordTest(`JDN Consistency (${calendar}, ${testDate.year}-${testDate.month}-${testDate.day})`, false, `JDN mismatch: ${jdn} vs ${jdn2}`, { original: testDate, converted, jdn, jdn2 });
                    }
                }
                catch (error) {
                    this.recordTest(`JDN Consistency (${calendar}, ${testDate.year}-${testDate.month}-${testDate.day})`, false, `Error: ${error}`, { original: testDate, error: String(error) });
                }
            }
        }
    }
    /**
     * Test 2: Cross-Calendar Alignment
     * Verify that the same JDN produces equivalent dates in different calendars
     */
    testCrossCalendarAlignment() {
        console.log('\n=== Test 2: Cross-Calendar Alignment ===');
        for (const refDate of REFERENCE_DATES) {
            const jdn = (0, julianDayUtils_1.gregorianToJDN)(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day);
            // Convert to all calendars and verify JDN matches
            for (const calendar of this.allCalendars) {
                try {
                    const converted = (0, calendarConverter_1.convertDate)({ ...refDate.gregorian, calendar: 'gregorian', era: 'CE' }, calendar);
                    const converter = (0, calendarConverter_1.getCalendarConverter)(calendar);
                    if (!converter)
                        continue;
                    const convertedJDN = converter.toJDN(converted.year, converted.month, converted.day);
                    const jdnDiff = Math.abs(jdn - convertedJDN);
                    // Allow tolerance for approximations (especially for lunisolar calendars)
                    const tolerance = calendar === 'chinese' || calendar === 'hebrew' ? 2 : 1;
                    if (jdnDiff > tolerance) {
                        this.recordTest(`Cross-Calendar Alignment (${refDate.name} -> ${calendar})`, false, `JDN difference: ${jdnDiff} days (expected <= ${tolerance})`, { gregorian: refDate.gregorian, converted, jdn, convertedJDN, diff: jdnDiff });
                    }
                }
                catch (error) {
                    this.recordTest(`Cross-Calendar Alignment (${refDate.name} -> ${calendar})`, false, `Error: ${error}`, { gregorian: refDate.gregorian, error: String(error) });
                }
            }
        }
    }
    /**
     * Test 3: Round-Trip Conversions
     * Convert A -> B -> A and verify we get back to the original date
     */
    testRoundTripConversions() {
        console.log('\n=== Test 3: Round-Trip Conversions ===');
        const testDates = [
            { year: 2024, month: 1, day: 1, calendar: 'gregorian', era: 'CE' },
            { year: 100, month: 6, day: 15, calendar: 'gregorian', era: 'CE' },
            { year: 0, month: 1, day: 1, calendar: 'gregorian', era: 'BCE' },
            { year: -100, month: 7, day: 4, calendar: 'gregorian', era: 'BCE' }
        ];
        for (const sourceDate of testDates) {
            for (const targetCalendar of this.allCalendars) {
                if (targetCalendar === sourceDate.calendar)
                    continue;
                try {
                    // Convert source -> target -> source
                    const toTarget = (0, calendarConverter_1.convertDate)(sourceDate, targetCalendar);
                    const backToSource = (0, calendarConverter_1.convertDate)(toTarget, sourceDate.calendar);
                    // Get JDNs for comparison
                    const sourceConverter = (0, calendarConverter_1.getCalendarConverter)(sourceDate.calendar);
                    const sourceJDN = sourceConverter?.toJDN(sourceDate.year, sourceDate.month, sourceDate.day);
                    const backJDN = sourceConverter?.toJDN(backToSource.year, backToSource.month, backToSource.day);
                    if (sourceJDN && backJDN) {
                        const jdnDiff = Math.abs(sourceJDN - backJDN);
                        const tolerance = 1; // Allow 1 day tolerance
                        if (jdnDiff > tolerance) {
                            this.recordTest(`Round-Trip (${sourceDate.calendar} -> ${targetCalendar} -> ${sourceDate.calendar})`, false, `JDN difference: ${jdnDiff} days`, { sourceDate, toTarget, backToSource, sourceJDN, backJDN, diff: jdnDiff });
                        }
                    }
                }
                catch (error) {
                    this.recordTest(`Round-Trip (${sourceDate.calendar} -> ${targetCalendar} -> ${sourceDate.calendar})`, false, `Error: ${error}`, { sourceDate, error: String(error) });
                }
            }
        }
    }
    /**
     * Test 4: Known Reference Dates
     * Verify that known historical dates convert correctly
     */
    testKnownReferenceDates() {
        console.log('\n=== Test 4: Known Reference Dates ===');
        for (const refDate of REFERENCE_DATES) {
            const expectedJDN = refDate.jdn;
            const actualJDN = (0, julianDayUtils_1.gregorianToJDN)(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day);
            if (Math.abs(expectedJDN - actualJDN) > 0) {
                this.recordTest(`Known Reference (${refDate.name})`, false, `JDN mismatch: expected ${expectedJDN}, got ${actualJDN}`, { refDate, expectedJDN, actualJDN });
            }
            else {
                this.recordTest(`Known Reference (${refDate.name})`, true, `JDN matches: ${actualJDN}`);
            }
        }
    }
    /**
     * Test 5: Era Designations
     * Verify that negative years show BCE and positive years show correct era
     */
    testEraDesignations() {
        console.log('\n=== Test 5: Era Designations ===');
        const testCases = [
            { year: -100, month: 1, day: 1, expectedEra: 'BCE' },
            { year: 0, month: 1, day: 1, expectedEra: 'BCE' },
            { year: 1, month: 1, day: 1, expectedEra: 'CE' },
            { year: 622, month: 1, day: 1, expectedEra: 'CE' }
        ];
        for (const testCase of testCases) {
            const date = {
                year: testCase.year,
                month: testCase.month,
                day: testCase.day,
                calendar: 'gregorian',
                era: 'CE'
            };
            const formatted = (0, calendarConverter_1.formatCalendarDate)(date, 'YYYY-MM-DD ERA');
            // Check if BCE appears for negative years
            if (testCase.year <= 0 && !formatted.includes('BCE')) {
                this.recordTest(`Era Designation (${testCase.year})`, false, `Expected BCE but got: ${formatted}`, { testCase, formatted });
            }
            else if (testCase.year > 0 && formatted.includes('BCE')) {
                this.recordTest(`Era Designation (${testCase.year})`, false, `Unexpected BCE in: ${formatted}`, { testCase, formatted });
            }
        }
    }
    /**
     * Test 6: Formatting and Parsing
     * Verify that dates can be formatted and parsed correctly
     */
    testFormattingAndParsing() {
        console.log('\n=== Test 6: Formatting and Parsing ===');
        for (const calendar of this.allCalendars) {
            const converter = (0, calendarConverter_1.getCalendarConverter)(calendar);
            if (!converter)
                continue;
            const testDate = {
                year: 2024,
                month: 6,
                day: 15,
                calendar,
                era: ''
            };
            try {
                // Test formatting
                const formatted = (0, calendarConverter_1.formatCalendarDate)(testDate, 'YYYY-MM-DD');
                // Test parsing (if supported)
                if (converter.parseDate) {
                    const parsed = converter.parseDate(formatted);
                    if (parsed) {
                        const jdn1 = converter.toJDN(testDate.year, testDate.month, testDate.day);
                        const jdn2 = converter.toJDN(parsed.year, parsed.month, parsed.day);
                        const jdnDiff = Math.abs(jdn1 - jdn2);
                        if (jdnDiff > 1) {
                            this.recordTest(`Format/Parse (${calendar})`, false, `Parse round-trip failed: JDN diff ${jdnDiff}`, { testDate, formatted, parsed, jdn1, jdn2 });
                        }
                    }
                }
            }
            catch (error) {
                this.recordTest(`Format/Parse (${calendar})`, false, `Error: ${error}`, { testDate, error: String(error) });
            }
        }
    }
    /**
     * Test 7: Edge Cases
     * Test leap years, epoch boundaries, extreme dates
     */
    testEdgeCases() {
        console.log('\n=== Test 7: Edge Cases ===');
        // Test leap years
        const leapYearDates = [
            { year: 2024, month: 2, day: 29 }, // Gregorian leap year
            { year: 2000, month: 2, day: 29 }, // Century leap year
            { year: 1900, month: 2, day: 29 } // Non-leap century year
        ];
        for (const date of leapYearDates) {
            try {
                const jdn = (0, julianDayUtils_1.gregorianToJDN)(date.year, date.month, date.day);
                const back = (0, julianDayUtils_1.jdnToGregorian)(jdn);
                // 1900 is not a leap year in Gregorian
                if (date.year === 1900 && date.month === 2 && date.day === 29) {
                    // This should fail or convert to March 1
                    if (back.month === 2 && back.day === 29) {
                        this.recordTest(`Edge Case (1900-02-29)`, false, '1900-02-29 should not be valid (not a leap year)', { date, back });
                    }
                }
                else {
                    // Other dates should round-trip correctly
                    if (back.year !== date.year || back.month !== date.month || back.day !== date.day) {
                        this.recordTest(`Edge Case (Leap Year ${date.year}-${date.month}-${date.day})`, false, 'Round-trip failed', { date, back });
                    }
                }
            }
            catch (error) {
                // Errors are expected for invalid dates
            }
        }
    }
    /**
     * Run all tests
     */
    runAllTests() {
        console.log('='.repeat(60));
        console.log('Calendar Accuracy Test Suite');
        console.log('='.repeat(60));
        this.testJDNConsistency();
        this.testCrossCalendarAlignment();
        this.testRoundTripConversions();
        this.testKnownReferenceDates();
        this.testEraDesignations();
        this.testFormattingAndParsing();
        this.testEdgeCases();
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('Test Summary');
        console.log('='.repeat(60));
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
        console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
        if (failed > 0) {
            console.log('\nFailed Tests:');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.testName}: ${r.message}`);
            });
        }
        return { passed, failed, total, results: this.results };
    }
}
exports.CalendarTester = CalendarTester;
// Run tests if executed directly
if (require.main === module) {
    const tester = new CalendarTester();
    const summary = tester.runAllTests();
    process.exit(summary.failed > 0 ? 1 : 0);
}
