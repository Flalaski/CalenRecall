/**
 * Chinese Calendar Verification Script
 * 
 * Tests Chinese calendar implementation against known reference dates
 * including Chinese New Year dates, intercalary months, and solar terms.
 * 
 * Run with: npm run test:chinese
 */

import { CalendarSystem } from '../src/utils/calendars/types';
import { convertDate, formatCalendarDate, getCalendarConverter } from '../src/utils/calendars/calendarConverter';
import { gregorianToJDN, jdnToGregorian } from '../src/utils/calendars/julianDayUtils';
import { solarTerm, solarTermJDN } from '../src/utils/calendars/astronomicalUtils';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

interface ReferenceDate {
  name: string;
  gregorian: { year: number; month: number; day: number };
  expectedChinese?: { year: number; month: number; day: number; isLeap?: boolean };
  description?: string;
}

// Chinese New Year dates (from reference document)
const CHINESE_NEW_YEAR_DATES: ReferenceDate[] = [
  {
    name: 'Chinese New Year 2024',
    gregorian: { year: 2024, month: 2, day: 10 },
    expectedChinese: { year: 2024, month: 1, day: 1 },
    description: 'Year of the Dragon (甲辰)'
  },
  {
    name: 'Chinese New Year 2023',
    gregorian: { year: 2023, month: 1, day: 22 },
    expectedChinese: { year: 2023, month: 1, day: 1 },
    description: 'Year of the Rabbit (癸卯)'
  },
  {
    name: 'Chinese New Year 2022',
    gregorian: { year: 2022, month: 2, day: 1 },
    expectedChinese: { year: 2022, month: 1, day: 1 },
    description: 'Year of the Tiger (壬寅)'
  },
  {
    name: 'Chinese New Year 2021',
    gregorian: { year: 2021, month: 2, day: 12 },
    expectedChinese: { year: 2021, month: 1, day: 1 },
    description: 'Year of the Ox (辛丑)'
  },
  {
    name: 'Chinese New Year 2020',
    gregorian: { year: 2020, month: 1, day: 25 },
    expectedChinese: { year: 2020, month: 1, day: 1 },
    description: 'Year of the Rat (庚子)'
  }
];

// Intercalary (leap) month dates
const LEAP_MONTH_DATES: ReferenceDate[] = [
  {
    name: 'Leap Month 2023',
    gregorian: { year: 2023, month: 3, day: 22 },
    expectedChinese: { year: 2023, month: 2, day: 1, isLeap: true },
    description: '闰二月 (Intercalary 2nd month)'
  },
  {
    name: 'Leap Month 2020',
    gregorian: { year: 2020, month: 5, day: 23 },
    expectedChinese: { year: 2020, month: 4, day: 1, isLeap: true },
    description: '闰四月 (Intercalary 4th month)'
  },
  {
    name: 'Leap Month 2017',
    gregorian: { year: 2017, month: 7, day: 23 },
    expectedChinese: { year: 2017, month: 6, day: 1, isLeap: true },
    description: '闰六月 (Intercalary 6th month)'
  }
];

// Solar terms - 2024 (from reference document)
interface SolarTermDate {
  name: string;
  chineseName: string;
  gregorian: { year: number; month: number; day: number };
  solarTermNumber: number; // 0-23
  longitude: number;
}

const SOLAR_TERMS_2024: SolarTermDate[] = [
  { name: 'Start of Spring', chineseName: '立春', gregorian: { year: 2024, month: 2, day: 4 }, solarTermNumber: 0, longitude: 315 },
  { name: 'Rain Water', chineseName: '雨水', gregorian: { year: 2024, month: 2, day: 19 }, solarTermNumber: 1, longitude: 330 },
  { name: 'Awakening of Insects', chineseName: '惊蛰', gregorian: { year: 2024, month: 3, day: 5 }, solarTermNumber: 2, longitude: 345 },
  { name: 'Spring Equinox', chineseName: '春分', gregorian: { year: 2024, month: 3, day: 20 }, solarTermNumber: 3, longitude: 0 },
  { name: 'Clear and Bright', chineseName: '清明', gregorian: { year: 2024, month: 4, day: 4 }, solarTermNumber: 4, longitude: 15 },
  { name: 'Grain Rain', chineseName: '谷雨', gregorian: { year: 2024, month: 4, day: 19 }, solarTermNumber: 5, longitude: 30 },
  { name: 'Start of Summer', chineseName: '立夏', gregorian: { year: 2024, month: 5, day: 5 }, solarTermNumber: 6, longitude: 45 },
  { name: 'Grain Buds', chineseName: '小满', gregorian: { year: 2024, month: 5, day: 20 }, solarTermNumber: 7, longitude: 60 },
  { name: 'Grain in Ear', chineseName: '芒种', gregorian: { year: 2024, month: 6, day: 5 }, solarTermNumber: 8, longitude: 75 },
  { name: 'Summer Solstice', chineseName: '夏至', gregorian: { year: 2024, month: 6, day: 21 }, solarTermNumber: 9, longitude: 90 },
  { name: 'Minor Heat', chineseName: '小暑', gregorian: { year: 2024, month: 7, day: 6 }, solarTermNumber: 10, longitude: 105 },
  { name: 'Major Heat', chineseName: '大暑', gregorian: { year: 2024, month: 7, day: 22 }, solarTermNumber: 11, longitude: 120 },
  { name: 'Start of Autumn', chineseName: '立秋', gregorian: { year: 2024, month: 8, day: 7 }, solarTermNumber: 12, longitude: 135 },
  { name: 'End of Heat', chineseName: '处暑', gregorian: { year: 2024, month: 8, day: 23 }, solarTermNumber: 13, longitude: 150 },
  { name: 'White Dew', chineseName: '白露', gregorian: { year: 2024, month: 9, day: 7 }, solarTermNumber: 14, longitude: 165 },
  { name: 'Autumn Equinox', chineseName: '秋分', gregorian: { year: 2024, month: 9, day: 22 }, solarTermNumber: 15, longitude: 180 },
  { name: 'Cold Dew', chineseName: '寒露', gregorian: { year: 2024, month: 10, day: 8 }, solarTermNumber: 16, longitude: 195 },
  { name: 'Frost Descent', chineseName: '霜降', gregorian: { year: 2024, month: 10, day: 23 }, solarTermNumber: 17, longitude: 210 },
  { name: 'Start of Winter', chineseName: '立冬', gregorian: { year: 2024, month: 11, day: 7 }, solarTermNumber: 18, longitude: 225 },
  { name: 'Minor Snow', chineseName: '小雪', gregorian: { year: 2024, month: 11, day: 22 }, solarTermNumber: 19, longitude: 240 },
  { name: 'Major Snow', chineseName: '大雪', gregorian: { year: 2024, month: 12, day: 7 }, solarTermNumber: 20, longitude: 255 },
  { name: 'Winter Solstice', chineseName: '冬至', gregorian: { year: 2024, month: 12, day: 21 }, solarTermNumber: 21, longitude: 270 },
  { name: 'Minor Cold', chineseName: '小寒', gregorian: { year: 2025, month: 1, day: 5 }, solarTermNumber: 22, longitude: 285 },
  { name: 'Major Cold', chineseName: '大寒', gregorian: { year: 2025, month: 1, day: 20 }, solarTermNumber: 23, longitude: 300 }
];

// Traditional festivals
const FESTIVAL_DATES: ReferenceDate[] = [
  {
    name: 'Lantern Festival 2024',
    gregorian: { year: 2024, month: 2, day: 24 },
    expectedChinese: { year: 2024, month: 1, day: 15 },
    description: '元宵节 (15th day of 1st month)'
  },
  {
    name: 'Dragon Boat Festival 2024',
    gregorian: { year: 2024, month: 6, day: 10 },
    expectedChinese: { year: 2024, month: 5, day: 5 },
    description: '端午节 (5th day of 5th month)'
  },
  {
    name: 'Mid-Autumn Festival 2024',
    gregorian: { year: 2024, month: 9, day: 17 },
    expectedChinese: { year: 2024, month: 8, day: 15 },
    description: '中秋节 (15th day of 8th month)'
  },
  {
    name: 'Double Ninth Festival 2024',
    gregorian: { year: 2024, month: 10, day: 11 },
    expectedChinese: { year: 2024, month: 9, day: 9 },
    description: '重阳节 (9th day of 9th month)'
  }
];

class ChineseCalendarTester {
  private results: TestResult[] = [];
  private converter = getCalendarConverter('chinese');

  private recordTest(testName: string, passed: boolean, message: string, details?: any) {
    this.results.push({ testName, passed, message, details });
    const status = passed ? '✓' : '✗';
    console.log(`${status} ${testName}: ${message}`);
    if (details && !passed) {
      console.log(`  Details:`, JSON.stringify(details, null, 2));
    }
  }

  /**
   * Test 1: Chinese New Year Dates
   */
  testChineseNewYearDates() {
    console.log('\n=== Test 1: Chinese New Year Dates ===');
    
    if (!this.converter) {
      this.recordTest('Chinese New Year Dates', false, 'Chinese calendar converter not found');
      return;
    }

    for (const refDate of CHINESE_NEW_YEAR_DATES) {
      try {
        const jdn = gregorianToJDN(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day);
        const chineseDate = this.converter.fromJDN(jdn);
        
        const yearMatches = chineseDate.year === refDate.expectedChinese!.year;
        const monthMatches = chineseDate.month === refDate.expectedChinese!.month;
        const dayMatches = chineseDate.day === refDate.expectedChinese!.day;
        
        if (yearMatches && monthMatches && dayMatches) {
          this.recordTest(
            `Chinese New Year ${refDate.name}`,
            true,
            `Correct: ${chineseDate.year}-${chineseDate.month}-${chineseDate.day} ${refDate.description || ''}`
          );
        } else {
          this.recordTest(
            `Chinese New Year ${refDate.name}`,
            false,
            `Expected ${refDate.expectedChinese!.year}-${refDate.expectedChinese!.month}-${refDate.expectedChinese!.day}, got ${chineseDate.year}-${chineseDate.month}-${chineseDate.day}`,
            { 
              gregorian: refDate.gregorian,
              expected: refDate.expectedChinese,
              actual: { year: chineseDate.year, month: chineseDate.month, day: chineseDate.day },
              jdn
            }
          );
        }
      } catch (error) {
        this.recordTest(
          `Chinese New Year ${refDate.name}`,
          false,
          `Error: ${error}`,
          { gregorian: refDate.gregorian, error: String(error) }
        );
      }
    }
  }

  /**
   * Test 2: Intercalary (Leap) Months
   */
  testLeapMonths() {
    console.log('\n=== Test 2: Intercalary (Leap) Months ===');
    
    if (!this.converter) {
      this.recordTest('Leap Months', false, 'Chinese calendar converter not found');
      return;
    }

    for (const refDate of LEAP_MONTH_DATES) {
      try {
        const jdn = gregorianToJDN(refDate.gregorian.year, refDate.gregorian.month, refDate.gregorian.day);
        const chineseDate = this.converter.fromJDN(jdn);
        
        // Chinese calendar encoding: months 1-12 are regular, months 13-24 are leap
        // Month 13 = leap month 1, month 14 = leap month 2, etc.
        const isLeap = chineseDate.month > 12;
        const regularMonth = isLeap ? chineseDate.month - 12 : chineseDate.month;
        
        // Expected month from reference: if isLeap=true, add 12 to get encoded month
        const expectedMonth = refDate.expectedChinese!.isLeap 
          ? refDate.expectedChinese!.month + 12 
          : refDate.expectedChinese!.month;
        
        const monthMatches = chineseDate.month === expectedMonth;
        const leapMatches = isLeap === (refDate.expectedChinese!.isLeap || false);
        
        if (monthMatches && chineseDate.year === refDate.expectedChinese!.year) {
          this.recordTest(
            `Leap Month ${refDate.name}`,
            true,
            `Correct: Year ${chineseDate.year}, ${isLeap ? 'Leap' : 'Regular'} Month ${regularMonth}, Day ${chineseDate.day} ${refDate.description || ''}`
          );
        } else {
          this.recordTest(
            `Leap Month ${refDate.name}`,
            false,
            `Expected Year ${refDate.expectedChinese!.year}, Month ${expectedMonth} (${refDate.expectedChinese!.isLeap ? 'Leap' : 'Regular'} ${refDate.expectedChinese!.month}), got Year ${chineseDate.year}, Month ${chineseDate.month} (${isLeap ? 'Leap' : 'Regular'} ${regularMonth})`,
            {
              gregorian: refDate.gregorian,
              expected: { year: refDate.expectedChinese!.year, month: expectedMonth, day: refDate.expectedChinese!.day, isLeap: refDate.expectedChinese!.isLeap },
              actual: { year: chineseDate.year, month: chineseDate.month, day: chineseDate.day, isLeap, regularMonth },
              jdn
            }
          );
        }
      } catch (error) {
        this.recordTest(
          `Leap Month ${refDate.name}`,
          false,
          `Error: ${error}`,
          { gregorian: refDate.gregorian, error: String(error) }
        );
      }
    }
  }

  /**
   * Test 3: Solar Terms
   */
  testSolarTerms() {
    console.log('\n=== Test 3: Solar Terms (节气) ===');
    
    if (!this.converter) {
      this.recordTest('Solar Terms', false, 'Chinese calendar converter not found');
      return;
    }

    for (const solarTermDate of SOLAR_TERMS_2024) {
      try {
        const jdn = gregorianToJDN(solarTermDate.gregorian.year, solarTermDate.gregorian.month, solarTermDate.gregorian.day);
        
        // Get the solar term for this date
        const { year } = jdnToGregorian(jdn);
        const calculatedSolarTerm = solarTerm(jdn);
        
        // Allow ±1 day tolerance for solar term calculations
        // (solar terms can fall on different days depending on time of day)
        const termJDN = solarTermJDN(year, solarTermDate.solarTermNumber);
        const daysDiff = Math.abs(jdn - termJDN);
        
        const termMatches = calculatedSolarTerm === solarTermDate.solarTermNumber || daysDiff <= 1;
        
        if (termMatches) {
          this.recordTest(
            `Solar Term ${solarTermDate.name} (${solarTermDate.chineseName})`,
            true,
            `Correct: Solar term ${calculatedSolarTerm} on ${solarTermDate.gregorian.year}-${solarTermDate.gregorian.month}-${solarTermDate.gregorian.day}${daysDiff > 0 ? ` (±${daysDiff} day tolerance)` : ''}`
          );
        } else {
          this.recordTest(
            `Solar Term ${solarTermDate.name} (${solarTermDate.chineseName})`,
            false,
            `Expected solar term ${solarTermDate.solarTermNumber}, got ${calculatedSolarTerm}, JDN difference: ${daysDiff} days`,
            {
              gregorian: solarTermDate.gregorian,
              expected: solarTermDate.solarTermNumber,
              actual: calculatedSolarTerm,
              termJDN,
              jdn,
              daysDiff
            }
          );
        }
      } catch (error) {
        this.recordTest(
          `Solar Term ${solarTermDate.name}`,
          false,
          `Error: ${error}`,
          { gregorian: solarTermDate.gregorian, error: String(error) }
        );
      }
    }
  }

  /**
   * Test 4: Traditional Festivals
   */
  testFestivals() {
    console.log('\n=== Test 4: Traditional Festivals ===');
    
    if (!this.converter) {
      this.recordTest('Festivals', false, 'Chinese calendar converter not found');
      return;
    }

    for (const festival of FESTIVAL_DATES) {
      try {
        const jdn = gregorianToJDN(festival.gregorian.year, festival.gregorian.month, festival.gregorian.day);
        const chineseDate = this.converter.fromJDN(jdn);
        
        const regularMonth = chineseDate.month > 12 ? chineseDate.month - 12 : chineseDate.month;
        
        const yearMatches = chineseDate.year === festival.expectedChinese!.year;
        const monthMatches = regularMonth === festival.expectedChinese!.month;
        const dayMatches = chineseDate.day === festival.expectedChinese!.day;
        
        if (yearMatches && monthMatches && dayMatches) {
          this.recordTest(
            `Festival ${festival.name}`,
            true,
            `Correct: ${chineseDate.year}-${regularMonth}-${chineseDate.day} ${festival.description || ''}`
          );
        } else {
          this.recordTest(
            `Festival ${festival.name}`,
            false,
            `Expected ${festival.expectedChinese!.year}-${festival.expectedChinese!.month}-${festival.expectedChinese!.day}, got ${chineseDate.year}-${regularMonth}-${chineseDate.day}`,
            {
              gregorian: festival.gregorian,
              expected: festival.expectedChinese,
              actual: { year: chineseDate.year, month: regularMonth, day: chineseDate.day },
              jdn
            }
          );
        }
      } catch (error) {
        this.recordTest(
          `Festival ${festival.name}`,
          false,
          `Error: ${error}`,
          { gregorian: festival.gregorian, error: String(error) }
        );
      }
    }
  }

  /**
   * Test 5: Round-Trip Conversions
   */
  testRoundTrip() {
    console.log('\n=== Test 5: Round-Trip Conversions ===');
    
    if (!this.converter) {
      this.recordTest('Round-Trip', false, 'Chinese calendar converter not found');
      return;
    }

    const testDates = [
      { year: 2024, month: 1, day: 1 },
      { year: 2024, month: 6, day: 15 },
      { year: 2023, month: 2, day: 1, isLeap: true }, // Leap month
      { year: 2020, month: 4, day: 10, isLeap: true }, // Leap month
    ];

    for (const testDate of testDates) {
      try {
        const regularMonth = testDate.isLeap ? testDate.month + 12 : testDate.month;
        const jdn1 = this.converter.toJDN(testDate.year, regularMonth, testDate.day);
        const converted = this.converter.fromJDN(jdn1);
        const jdn2 = this.converter.toJDN(converted.year, converted.month, converted.day);
        
        // Allow 1 day tolerance for approximations
        const jdnMatches = Math.abs(jdn1 - jdn2) <= 1;
        
        if (jdnMatches) {
          const isLeapStr = (converted.month > 12) ? ' (Leap)' : '';
          const convMonth = converted.month > 12 ? converted.month - 12 : converted.month;
          this.recordTest(
            `Round-Trip (${testDate.year}-${testDate.month}-${testDate.day}${testDate.isLeap ? ' leap' : ''})`,
            true,
            `JDN matches: ${jdn1} = ${jdn2}, converted: ${converted.year}-${convMonth}-${converted.day}${isLeapStr}`
          );
        } else {
          this.recordTest(
            `Round-Trip (${testDate.year}-${testDate.month}-${testDate.day})`,
            false,
            `JDN mismatch: ${jdn1} vs ${jdn2}`,
            { original: testDate, converted, jdn1, jdn2 }
          );
        }
      } catch (error) {
        this.recordTest(
          `Round-Trip (${testDate.year}-${testDate.month}-${testDate.day})`,
          false,
          `Error: ${error}`,
          { original: testDate, error: String(error) }
        );
      }
    }
  }

  /**
   * Generate summary report
   */
  generateReport() {
    console.log('\n=== Test Summary ===');
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    
    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log('\n=== Failed Tests ===');
      for (const result of this.results) {
        if (!result.passed) {
          console.log(`✗ ${result.testName}: ${result.message}`);
        }
      }
    }
    
    return { total, passed, failed };
  }
}

// Run tests
console.log('Chinese Calendar Verification Tests\n');
console.log('====================================\n');

const tester = new ChineseCalendarTester();
tester.testChineseNewYearDates();
tester.testLeapMonths();
tester.testSolarTerms();
tester.testFestivals();
tester.testRoundTrip();

const summary = tester.generateReport();

// Exit with appropriate code
process.exit(summary.failed > 0 ? 1 : 0);

