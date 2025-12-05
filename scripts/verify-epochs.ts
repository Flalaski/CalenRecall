/**
 * Epoch Verification Script
 * 
 * Systematically verifies all calendar epoch JDN calculations
 * against documented values and cross-references multiple sources.
 * 
 * Run with: npm run test:epochs
 * Or: npx ts-node --project scripts/tsconfig.json scripts/verify-epochs.ts
 */

import { gregorianToJDN, julianToJDN } from '../src/utils/calendars/julianDayUtils';
import { getCalendarEpoch } from '../src/utils/calendars/epochUtils';

interface EpochVerification {
  calendar: string;
  documentedJDN: number;
  calculatedJDN: number;
  source: string;
  description: string;
  match: boolean;
  difference?: number;
}

/**
 * Documented epoch JDNs from code and authoritative sources
 */
const DOCUMENTED_EPOCHS: Array<{
  calendar: string;
  jdn: number;
  source: string;
  description: string;
}> = [
  {
    calendar: 'gregorian',
    jdn: 1721426,
    source: 'Calendrical Calculations',
    description: 'January 1, 1 CE (Gregorian)'
  },
  {
    calendar: 'julian',
    jdn: 1721426,
    source: 'Calendrical Calculations',
    description: 'January 1, 1 CE (Julian) - same as Gregorian for year 1'
  },
  {
    calendar: 'islamic',
    jdn: 1948439,
    source: 'Calendrical Calculations',
    description: 'July 16, 622 CE (Julian) - Hijra - start of Islamic calendar'
  },
  {
    calendar: 'hebrew',
    jdn: 347997,
    source: 'Calendrical Calculations',
    description: 'October 7, 3761 BCE (Julian) - Creation - start of Hebrew calendar'
  },
  {
    calendar: 'persian',
    jdn: 1948318,
    source: 'Calendrical Calculations',
    description: 'March 19, 622 CE (Gregorian) - Nowruz - start of Persian calendar'
  },
  {
    calendar: 'ethiopian',
    jdn: 1724221,
    source: 'Calendrical Calculations',
    description: 'August 29, 8 CE (Julian) - Meskerem 1, 1 EE'
  },
  {
    calendar: 'coptic',
    jdn: 1825030,
    source: 'Calendrical Calculations',
    description: 'August 29, 284 CE (Julian) - Tout 1, 1 AM'
  },
  {
    calendar: 'indian-saka',
    jdn: 1749630,
    source: 'Implementation code',
    description: 'March 22, 78 CE (Gregorian) - Chaitra 1, 1 Saka'
  },
  {
    calendar: 'bahai',
    jdn: 2394647,
    source: 'Implementation code',
    description: 'March 21, 1844 CE (Gregorian) - Naw-Rúz (approximate, uses equinox)'
  },
  {
    calendar: 'mayan-tzolkin',
    jdn: 584283,
    source: 'GMT Correlation',
    description: 'August 11, 3114 BCE (Gregorian) - Mayan epoch'
  },
  {
    calendar: 'mayan-haab',
    jdn: 584283,
    source: 'GMT Correlation',
    description: 'August 11, 3114 BCE (Gregorian) - Mayan epoch'
  },
  {
    calendar: 'mayan-longcount',
    jdn: 584283,
    source: 'GMT Correlation',
    description: 'August 11, 3114 BCE (Gregorian) - Mayan epoch'
  },
  {
    calendar: 'aztec-xiuhpohualli',
    jdn: 584283,
    source: 'GMT Correlation',
    description: 'August 11, 3114 BCE (Gregorian) - Aztec epoch'
  }
];

/**
 * Verify epoch calculations
 */
function verifyEpochs(): EpochVerification[] {
  const results: EpochVerification[] = [];

  for (const documented of DOCUMENTED_EPOCHS) {
    const calculatedJDN = getCalendarEpoch(documented.calendar as any);
    const match = calculatedJDN === documented.jdn;
    const difference = match ? 0 : calculatedJDN - documented.jdn;

    results.push({
      calendar: documented.calendar,
      documentedJDN: documented.jdn,
      calculatedJDN,
      source: documented.source,
      description: documented.description,
      match,
      difference: match ? undefined : difference
    });
  }

  return results;
}

/**
 * Verify epoch dates by calculating JDNs from source dates
 */
function verifyEpochDates(): void {
  console.log('\n=== Direct Date to JDN Verification ===\n');

  // Gregorian/Julian epoch
  const gregorianJDN = gregorianToJDN(1, 1, 1);
  console.log(`Gregorian epoch (1-1-1): ${gregorianJDN} (expected: 1721426) ${gregorianJDN === 1721426 ? '✅' : '❌'}`);

  const julianJDN = julianToJDN(1, 1, 1);
  console.log(`Julian epoch (1-1-1): ${julianJDN} (expected: 1721426) ${julianJDN === 1721426 ? '✅' : '❌'}`);

  // Islamic epoch: July 16, 622 CE (Julian)
  const islamicJDN = julianToJDN(622, 7, 16);
  console.log(`Islamic epoch (622-7-16 Julian): ${islamicJDN} (expected: 1948439) ${islamicJDN === 1948439 ? '✅' : '❌'}`);

  // Hebrew epoch: October 7, 3761 BCE (Julian) = October 7, -3760 (astronomical)
  const hebrewJDN = julianToJDN(-3760, 10, 7);
  console.log(`Hebrew epoch (-3760-10-7 Julian): ${hebrewJDN} (expected: 347997) ${hebrewJDN === 347997 ? '✅' : '❌'}`);

  // Persian epoch: March 19, 622 CE (Gregorian)
  const persianJDN = gregorianToJDN(622, 3, 19);
  console.log(`Persian epoch (622-3-19 Gregorian): ${persianJDN} (expected: 1948318) ${persianJDN === 1948318 ? '✅' : '❌'}`);

  // Ethiopian epoch: August 29, 8 CE (Julian)
  const ethiopianJDN = julianToJDN(8, 8, 29);
  console.log(`Ethiopian epoch (8-8-29 Julian): ${ethiopianJDN} (expected: 1724221) ${ethiopianJDN === 1724221 ? '✅' : '❌'}`);

  // Coptic epoch: August 29, 284 CE (Julian)
  const copticJDN = julianToJDN(284, 8, 29);
  console.log(`Coptic epoch (284-8-29 Julian): ${copticJDN} (expected: 1825030) ${copticJDN === 1825030 ? '✅' : '❌'}`);

  // Indian-Saka epoch: March 22, 78 CE (Gregorian)
  const sakaJDN = gregorianToJDN(78, 3, 22);
  console.log(`Indian-Saka epoch (78-3-22 Gregorian): ${sakaJDN} (expected: 1749630) ${sakaJDN === 1749630 ? '✅' : '❌'}`);

  // Baháʼí epoch: March 21, 1844 CE (Gregorian) - approximate
  const bahaiJDN = gregorianToJDN(1844, 3, 21);
  console.log(`Baháʼí epoch (1844-3-21 Gregorian, approx): ${bahaiJDN} (expected: 2394647) ${bahaiJDN === 2394647 ? '✅' : '❌'}`);

  // Mayan/Aztec epoch: August 11, 3114 BCE (Gregorian) = August 11, -3113 (astronomical)
  const mayanJDN = gregorianToJDN(-3113, 8, 11);
  console.log(`Mayan epoch (-3113-8-11 Gregorian): ${mayanJDN} (expected: 584283) ${mayanJDN === 584283 ? '✅' : '❌'}`);
}

/**
 * Main verification function
 */
function main() {
  console.log('='.repeat(60));
  console.log('Calendar Epoch Verification');
  console.log('='.repeat(60));

  // Verify using epochUtils function
  console.log('\n=== Epoch Function Verification ===\n');
  const results = verifyEpochs();

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.match ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.calendar.padEnd(25)} JDN: ${result.calculatedJDN.toString().padStart(7)} (expected: ${result.documentedJDN})`);
    if (!result.match) {
      console.log(`  Difference: ${result.difference} days`);
      failed++;
    } else {
      passed++;
    }
  }

  // Verify by calculating from source dates
  verifyEpochDates();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some epochs did not match. Please review discrepancies.');
    process.exit(1);
  } else {
    console.log('\n✅ All epochs verified successfully!');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { verifyEpochs, verifyEpochDates };

