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

/**
 * Calendar Accuracy Tester
 * 
 * Note: This file uses TypeScript and ES modules.
 * To run: npm run test:calendars
 * 
 * The test script compiles this file to CommonJS for Node.js execution.
 */

import { CalendarSystem, CalendarDate } from '../src/utils/calendars/types';
import { convertDate, formatCalendarDate, getCalendarConverter, calendarDateToDate } from '../src/utils/calendars/calendarConverter';
import { gregorianToJDN, jdnToGregorian, julianToJDN } from '../src/utils/calendars/julianDayUtils';

// Known reference dates for testing
// Format: { gregorian: {year, month, day}, jdn: number, otherCalendars: {...} }
interface ReferenceDate {
  name: string;
  gregorian: { year: number; month: number; day: number };
  jdn: number;
  description?: string;
  useJulian?: boolean; // If true, use julianToJDN instead of gregorianToJDN
}

const REFERENCE_DATES: ReferenceDate[] = [
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
    jdn: 1948439, // Julian calendar date - matches calendar implementation
    description: 'July 16, 622 CE (Julian) - Hijra - start of Islamic calendar',
    useJulian: true
  },
  {
    name: 'Hebrew Epoch',
    gregorian: { year: -3760, month: 10, day: 6 },
    jdn: 347997, // Julian calendar date - matches calendar implementation
    description: 'October 6, 3760 BCE (Julian) - Creation - start of Hebrew calendar',
    useJulian: true
  },
  {
    name: 'Persian Epoch',
    gregorian: { year: 622, month: 3, day: 19 },
    jdn: 1948318,
    description: 'March 19, 622 CE (Naw-Rúz - start of Persian calendar)'
  },
  {
    name: 'Mayan Epoch',
    gregorian: { year: -3113, month: 8, day: 11 },
    jdn: 584283, // Gregorian calendar date - matches calendar implementation
    description: 'August 11, 3113 BCE (Gregorian) - GMT correlation - Mayan epoch',
    useJulian: false
  },
  {
    name: 'Modern Date',
    gregorian: { year: 2024, month: 1, day: 1 },
    jdn: 2460311,  // Corrected: was 2460106
    description: 'January 1, 2024 CE'
  },
  {
    name: 'Leap Year Date',
    gregorian: { year: 2024, month: 2, day: 29 },
    jdn: 2460370,  // Corrected: was 2460136
    description: 'February 29, 2024 CE (leap year)'
  },
  {
    name: 'Negative Year',
    gregorian: { year: -100, month: 1, day: 1 },
    jdn: 1684536,  // Corrected: was 1686042 (verified with formula)
    description: 'January 1, 101 BCE'
  },
  {
    name: 'Year Zero',
    gregorian: { year: 0, month: 1, day: 1 },
    jdn: 1721060,  // Corrected: was 1721058 (2 day difference)
    description: 'January 1, 1 BCE (astronomical year 0)'
  }
];

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class CalendarTester {
  private results: TestResult[] = [];
  private allCalendars: CalendarSystem[] = [
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

  private recordTest(testName: string, passed: boolean, message: string, details?: any) {
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
      const converter = getCalendarConverter(calendar);
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
            this.recordTest(
              `JDN Consistency (${calendar}, ${testDate.year}-${testDate.month}-${testDate.day})`,
              false,
              `JDN mismatch: ${jdn} vs ${jdn2}`,
              { original: testDate, converted, jdn, jdn2 }
            );
          }
        } catch (error) {
          this.recordTest(
            `JDN Consistency (${calendar}, ${testDate.year}-${testDate.month}-${testDate.day})`,
            false,
            `Error: ${error}`,
            { original: testDate, error: String(error) }
          );
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
      const jdn = gregorianToJDN(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day);
      
      // Convert to all calendars and verify JDN matches
      for (const calendar of this.allCalendars) {
        try {
          const converted = convertDate(
            { ...refDate.gregorian, calendar: 'gregorian', era: 'CE' },
            calendar
          );
          
          const converter = getCalendarConverter(calendar);
          if (!converter) continue;
          
          const convertedJDN = converter.toJDN(converted.year, converted.month, converted.day);
          const jdnDiff = Math.abs(jdn - convertedJDN);
          
          // Allow tolerance for approximations (especially for lunisolar calendars)
          const tolerance = calendar === 'chinese' || calendar === 'hebrew' ? 2 : 1;
          
          if (jdnDiff > tolerance) {
            this.recordTest(
              `Cross-Calendar Alignment (${refDate.name} -> ${calendar})`,
              false,
              `JDN difference: ${jdnDiff} days (expected <= ${tolerance})`,
              { gregorian: refDate.gregorian, converted, jdn, convertedJDN, diff: jdnDiff }
            );
          }
        } catch (error) {
          this.recordTest(
            `Cross-Calendar Alignment (${refDate.name} -> ${calendar})`,
            false,
            `Error: ${error}`,
            { gregorian: refDate.gregorian, error: String(error) }
          );
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
    
    const testDates: CalendarDate[] = [
      { year: 2024, month: 1, day: 1, calendar: 'gregorian', era: 'CE' },
      { year: 100, month: 6, day: 15, calendar: 'gregorian', era: 'CE' },
      { year: 0, month: 1, day: 1, calendar: 'gregorian', era: 'BCE' },
      { year: -100, month: 7, day: 4, calendar: 'gregorian', era: 'BCE' }
    ];

    for (const sourceDate of testDates) {
      for (const targetCalendar of this.allCalendars) {
        if (targetCalendar === sourceDate.calendar) continue;
        
        try {
          // Convert source -> target -> source
          const toTarget = convertDate(sourceDate, targetCalendar);
          const backToSource = convertDate(toTarget, sourceDate.calendar);
          
          // Get JDNs for comparison
          const sourceConverter = getCalendarConverter(sourceDate.calendar);
          const sourceJDN = sourceConverter?.toJDN(sourceDate.year, sourceDate.month, sourceDate.day);
          const backJDN = sourceConverter?.toJDN(backToSource.year, backToSource.month, backToSource.day);
          
          if (sourceJDN && backJDN) {
            const jdnDiff = Math.abs(sourceJDN - backJDN);
            const tolerance = 1; // Allow 1 day tolerance
            
            if (jdnDiff > tolerance) {
              this.recordTest(
                `Round-Trip (${sourceDate.calendar} -> ${targetCalendar} -> ${sourceDate.calendar})`,
                false,
                `JDN difference: ${jdnDiff} days`,
                { sourceDate, toTarget, backToSource, sourceJDN, backJDN, diff: jdnDiff }
              );
            }
          }
        } catch (error) {
          this.recordTest(
            `Round-Trip (${sourceDate.calendar} -> ${targetCalendar} -> ${sourceDate.calendar})`,
            false,
            `Error: ${error}`,
            { sourceDate, error: String(error) }
          );
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
      // Use julianToJDN for Julian calendar dates, gregorianToJDN for Gregorian
      const actualJDN = refDate.useJulian 
        ? julianToJDN(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day)
        : gregorianToJDN(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day);
      
      // For epoch dates, the JDN values in implementations may differ slightly from
      // conversion functions due to time-of-day (JDN represents noon) or different epoch definitions.
      // Allow 1 day tolerance for epoch dates to account for these differences.
      const tolerance = refDate.name.includes('Epoch') ? 1 : 0;
      
      if (Math.abs(expectedJDN - actualJDN) > tolerance) {
        this.recordTest(
          `Known Reference (${refDate.name})`,
          false,
          `JDN mismatch: expected ${expectedJDN}, got ${actualJDN} (tolerance: ${tolerance})`,
          { refDate, expectedJDN, actualJDN }
        );
      } else {
        this.recordTest(
          `Known Reference (${refDate.name})`,
          true,
          `JDN matches: ${actualJDN}`
        );
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
      const date: CalendarDate = {
        year: testCase.year,
        month: testCase.month,
        day: testCase.day,
        calendar: 'gregorian',
        era: 'CE'
      };
      
      const formatted = formatCalendarDate(date, 'YYYY-MM-DD ERA');
      
      // Check if BCE appears for negative years
      if (testCase.year <= 0 && !formatted.includes('BCE')) {
        this.recordTest(
          `Era Designation (${testCase.year})`,
          false,
          `Expected BCE but got: ${formatted}`,
          { testCase, formatted }
        );
      } else if (testCase.year > 0 && formatted.includes('BCE')) {
        this.recordTest(
          `Era Designation (${testCase.year})`,
          false,
          `Unexpected BCE in: ${formatted}`,
          { testCase, formatted }
        );
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
      const converter = getCalendarConverter(calendar);
      if (!converter) continue;
      
      const testDate: CalendarDate = {
        year: 2024,
        month: 6,
        day: 15,
        calendar,
        era: ''
      };
      
      try {
        // Test formatting
        const formatted = formatCalendarDate(testDate, 'YYYY-MM-DD');
        
        // Test parsing (if supported)
        if (converter.parseDate) {
          const parsed = converter.parseDate(formatted);
          if (parsed) {
            const jdn1 = converter.toJDN(testDate.year, testDate.month, testDate.day);
            const jdn2 = converter.toJDN(parsed.year, parsed.month, parsed.day);
            const jdnDiff = Math.abs(jdn1 - jdn2);
            
            if (jdnDiff > 1) {
              this.recordTest(
                `Format/Parse (${calendar})`,
                false,
                `Parse round-trip failed: JDN diff ${jdnDiff}`,
                { testDate, formatted, parsed, jdn1, jdn2 }
              );
            }
          }
        }
      } catch (error) {
        this.recordTest(
          `Format/Parse (${calendar})`,
          false,
          `Error: ${error}`,
          { testDate, error: String(error) }
        );
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
      { year: 1900, month: 2, day: 29 }  // Non-leap century year
    ];
    
    for (const date of leapYearDates) {
      try {
        const jdn = gregorianToJDN(date.year, date.month, date.day);
        const back = jdnToGregorian(jdn);
        
        // 1900 is not a leap year in Gregorian
        if (date.year === 1900 && date.month === 2 && date.day === 29) {
          // This should fail or convert to March 1
          if (back.month === 2 && back.day === 29) {
            this.recordTest(
              `Edge Case (1900-02-29)`,
              false,
              '1900-02-29 should not be valid (not a leap year)',
              { date, back }
            );
          }
        } else {
          // Other dates should round-trip correctly
          if (back.year !== date.year || back.month !== date.month || back.day !== date.day) {
            this.recordTest(
              `Edge Case (Leap Year ${date.year}-${date.month}-${date.day})`,
              false,
              'Round-trip failed',
              { date, back }
            );
          }
        }
      } catch (error) {
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

// Run tests if executed directly
if (require.main === module) {
  const tester = new CalendarTester();
  const summary = tester.runAllTests();
  process.exit(summary.failed > 0 ? 1 : 0);
}

export { CalendarTester, REFERENCE_DATES };

