// Test JDN calculations
function gregorianToJDN(year, month, day) {
  // Convert from historical year numbering to astronomical year numbering
  // Historical: -1 = 2 BCE, -100 = 101 BCE (no year 0)
  // Astronomical: 0 = 1 BCE, -1 = 2 BCE, -99 = 100 BCE, -100 = 101 BCE
  // Conversion: if year < 0, add 1; if year = 0, it's already astronomical
  let astronomicalYear = year;
  if (year < 0) {
    astronomicalYear = year + 1;
  }
  
  const a = Math.floor((14 - month) / 12);
  const y = astronomicalYear + 4800 - a;
  const m = month + 12 * a - 3;
  
  // Gregorian calendar formula (uses astronomical year numbering)
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + 
         Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

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
  
  let year = y - 4800 + Math.floor((m + 2) / 12);
  const month = (m + 2) % 12 + 1;
  const day = d + 1;
  
  // Convert from astronomical year numbering to historical year numbering
  if (year <= 0) {
    year = year - 1;
  }
  
  return { year, month, day };
}

// Test cases from the test file
const testCases = [
  { year: 1, month: 1, day: 1, expected: 1721426, name: '1 CE' },
  { year: 0, month: 1, day: 1, expected: 1721058, name: '1 BCE (year 0)' },
  { year: -100, month: 1, day: 1, expected: 1686042, name: '101 BCE (year -100)' },
  { year: 2024, month: 1, day: 1, expected: 2460106, name: '2024 CE' },
  { year: 2024, month: 2, day: 29, expected: 2460136, name: '2024-02-29 (leap)' },
  { year: 2000, month: 1, day: 1, expected: 2451545, name: '2000 CE (known reference)' },
  { year: 622, month: 7, day: 16, expected: 1948439, name: '622-07-16 (Islamic epoch)' }
];

console.log('Testing JDN calculations:\n');
let passed = 0;
let failed = 0;

for (const test of testCases) {
  const actual = gregorianToJDN(test.year, test.month, test.day);
  const diff = actual - test.expected;
  const status = diff === 0 ? '✓' : '✗';
  
  if (diff === 0) {
    passed++;
    console.log(`${status} ${test.name}: got ${actual}, expected ${test.expected}, diff: ${diff}`);
  } else {
    failed++;
    // Show round-trip test
    const roundTrip = jdnToGregorian(actual);
    console.log(`${status} ${test.name}:`);
    console.log(`  Input: ${test.year}-${test.month}-${test.day}`);
    console.log(`  Got JDN: ${actual}, Expected: ${test.expected}, Diff: ${diff}`);
    console.log(`  Round-trip: ${roundTrip.year}-${roundTrip.month}-${roundTrip.day}`);
  }
}

console.log(`\nSummary: ${passed} passed, ${failed} failed`);

