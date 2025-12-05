/**
 * Debug script for Chinese calendar issues
 */

import { gregorianToJDN, jdnToGregorian } from '../src/utils/calendars/julianDayUtils';
import { getCalendarConverter } from '../src/utils/calendars/calendarConverter';

const converter = getCalendarConverter('chinese');

// Test Chinese New Year dates
const testDates = [
  { gregorian: { year: 2024, month: 2, day: 10 }, expected: { year: 2024, month: 1, day: 1 } },
  { gregorian: { year: 2023, month: 1, day: 22 }, expected: { year: 2023, month: 1, day: 1 } },
  { gregorian: { year: 2022, month: 2, day: 1 }, expected: { year: 2022, month: 1, day: 1 } },
  { gregorian: { year: 2021, month: 2, day: 12 }, expected: { year: 2021, month: 1, day: 1 } },
  { gregorian: { year: 2020, month: 1, day: 25 }, expected: { year: 2020, month: 1, day: 1 } },
];

console.log('=== Chinese New Year Debug ===\n');

for (const test of testDates) {
  const jdn = gregorianToJDN(test.gregorian.year, test.gregorian.month, test.gregorian.day);
  const chineseDate = converter!.fromJDN(jdn);
  
  console.log(`Gregorian: ${test.gregorian.year}-${test.gregorian.month}-${test.gregorian.day} (JDN: ${jdn})`);
  console.log(`Expected: ${test.expected.year}-${test.expected.month}-${test.expected.day}`);
  console.log(`Actual: ${chineseDate.year}-${chineseDate.month}-${chineseDate.day}`);
  console.log(`Match: ${chineseDate.year === test.expected.year && chineseDate.month === test.expected.month && chineseDate.day === test.expected.day ? 'YES' : 'NO'}`);
  console.log('');
}

// Test leap months
const leapTests = [
  { gregorian: { year: 2023, month: 3, day: 22 }, expected: { year: 2023, month: 14, day: 1 } },
  { gregorian: { year: 2020, month: 5, day: 23 }, expected: { year: 2020, month: 16, day: 1 } },
];

console.log('=== Leap Month Debug ===\n');

for (const test of leapTests) {
  const jdn = gregorianToJDN(test.gregorian.year, test.gregorian.month, test.gregorian.day);
  const chineseDate = converter!.fromJDN(jdn);
  
  console.log(`Gregorian: ${test.gregorian.year}-${test.gregorian.month}-${test.gregorian.day} (JDN: ${jdn})`);
  console.log(`Expected: ${test.expected.year}-${test.expected.month}-${test.expected.day} (leap)`);
  console.log(`Actual: ${chineseDate.year}-${chineseDate.month}-${chineseDate.day}`);
  console.log(`Is Leap: ${chineseDate.month > 12 ? 'YES' : 'NO'}`);
  console.log('');
}

