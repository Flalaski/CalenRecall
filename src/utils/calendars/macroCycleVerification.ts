/**
 * Macro Cycle Verification Tests
 * 
 * This file contains verification tests against known reference dates
 * to ensure accuracy of macro cycle calculations.
 * 
 * Reference sources:
 * - Chinese Sexagenary Cycle: Traditional Chinese calendar calculations
 * - Mayan Long Count: GMT correlation (JDN 584283 = Aug 11, 3114 BCE)
 * - Metonic Cycle: Standard Hebrew calendar algorithm
 * - Hindu Yuga: Traditional calculation (Kali Yuga starts 3102 BCE)
 */

import { gregorianToJDN } from './julianDayUtils';
import { 
  getChineseSexagenaryCycle, 
  getMayanLongCountCycles, 
  getMetonicCycle,
  getMayanCalendarRound,
  getHinduYugaCycle
} from './macroCycleUtils';

/**
 * Verification test results
 */
export interface VerificationResult {
  cycle: string;
  test: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

/**
 * Verify Chinese Sexagenary Cycle
 * Known reference: 1984 = 甲子 (Jiazi, position 1)
 * 2024 = 甲辰 (Jiachen, position 41)
 */
export function verifyChineseSexagenaryCycle(): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  // Test 1: 1984 should be 甲子 (Jiazi) - position 1
  const cycle1984 = getChineseSexagenaryCycle(1984);
  results.push({
    cycle: 'Chinese Sexagenary',
    test: '1984 should be 甲子 (Jiazi)',
    expected: '甲子',
    actual: cycle1984.combined,
    passed: cycle1984.combined === '甲子' && cycle1984.cyclePosition === 1,
    notes: `Position: ${cycle1984.cyclePosition}, Branch: ${cycle1984.branchEnglish}`
  });
  
  // Test 2: 2024 should be 甲辰 (Jiachen) - position 41
  const cycle2024 = getChineseSexagenaryCycle(2024);
  results.push({
    cycle: 'Chinese Sexagenary',
    test: '2024 should be 甲辰 (Jiachen)',
    expected: '甲辰',
    actual: cycle2024.combined,
    passed: cycle2024.combined === '甲辰' && cycle2024.cyclePosition === 41,
    notes: `Position: ${cycle2024.cyclePosition}, Branch: ${cycle2024.branchEnglish}`
  });
  
  // Test 3: 1985 should be 乙丑 (Yichou) - position 2
  const cycle1985 = getChineseSexagenaryCycle(1985);
  results.push({
    cycle: 'Chinese Sexagenary',
    test: '1985 should be 乙丑 (Yichou)',
    expected: '乙丑',
    actual: cycle1985.combined,
    passed: cycle1985.combined === '乙丑' && cycle1985.cyclePosition === 2,
    notes: `Position: ${cycle1985.cyclePosition}`
  });
  
  return results;
}

/**
 * Verify Mayan Long Count
 * Known reference: Dec 21, 2012 = 13.0.0.0.0 (end of 13th Baktun)
 * Aug 11, 3114 BCE = 0.0.0.0.0 (epoch)
 */
export function verifyMayanLongCount(): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  // Test 1: Dec 21, 2012 should be Baktun 13, Katun 0
  const jdn2012 = gregorianToJDN(2012, 12, 21);
  const cycles2012 = getMayanLongCountCycles(jdn2012);
  results.push({
    cycle: 'Mayan Long Count',
    test: 'Dec 21, 2012 should be Baktun 13',
    expected: 'Baktun 13',
    actual: `Baktun ${cycles2012.baktun}`,
    passed: cycles2012.baktun === 13 && cycles2012.katun === 0,
    notes: `Baktun: ${cycles2012.baktun}, Katun: ${cycles2012.katun}, Tun: ${cycles2012.tun}`
  });
  
  // Test 2: Epoch (Aug 11, 3114 BCE) should be 0.0.0.0.0
  const jdnEpoch = gregorianToJDN(-3113, 8, 11); // -3113 = 3114 BCE (year 0 doesn't exist)
  const cyclesEpoch = getMayanLongCountCycles(jdnEpoch);
  results.push({
    cycle: 'Mayan Long Count',
    test: 'Epoch (Aug 11, 3114 BCE) should be 0.0.0.0.0',
    expected: 'Baktun 0, Katun 0',
    actual: `Baktun ${cyclesEpoch.baktun}, Katun ${cyclesEpoch.katun}`,
    passed: cyclesEpoch.baktun === 0 && cyclesEpoch.katun === 0 && cyclesEpoch.tun === 0,
    notes: `Baktun: ${cyclesEpoch.baktun}, Katun: ${cyclesEpoch.katun}, Tun: ${cyclesEpoch.tun}`
  });
  
  // Test 3: Current date (2024) should be in Baktun 13
  const jdn2024 = gregorianToJDN(2024, 1, 1);
  const cycles2024 = getMayanLongCountCycles(jdn2024);
  results.push({
    cycle: 'Mayan Long Count',
    test: '2024 should be in Baktun 13',
    expected: 'Baktun 13',
    actual: `Baktun ${cycles2024.baktun}`,
    passed: cycles2024.baktun === 13,
    notes: `Baktun: ${cycles2024.baktun}, Katun: ${cycles2024.katun}, Global Katun: ${cycles2024.katunCycleGlobal}`
  });
  
  return results;
}

/**
 * Verify Metonic Cycle
 * Hebrew year 1 AM = 3761 BCE
 * Leap years in 19-year cycle: positions 3, 6, 8, 11, 14, 17, 19
 */
export function verifyMetonicCycle(): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  // Test 1: Hebrew year 1 (3761 BCE) should be position 1
  const metonic1 = getMetonicCycle(1, true); // Hebrew year 1
  results.push({
    cycle: 'Metonic Cycle',
    test: 'Hebrew year 1 should be position 1',
    expected: 'Position 1',
    actual: `Position ${metonic1.cyclePosition}`,
    passed: metonic1.cyclePosition === 1,
    notes: `Is leap year: ${metonic1.isLeapYear}`
  });
  
  // Test 2: Hebrew year 3 should be a leap year (position 3)
  const metonic3 = getMetonicCycle(3, true);
  results.push({
    cycle: 'Metonic Cycle',
    test: 'Hebrew year 3 should be leap year (position 3)',
    expected: 'Leap year, position 3',
    actual: `${metonic3.isLeapYear ? 'Leap' : 'Common'} year, position ${metonic3.cyclePosition}`,
    passed: metonic3.isLeapYear && metonic3.cyclePosition === 3,
    notes: `Cycle number: ${metonic3.cycleNumber}`
  });
  
  // Test 3: Hebrew year 19 should be a leap year (position 19)
  const metonic19 = getMetonicCycle(19, true);
  results.push({
    cycle: 'Metonic Cycle',
    test: 'Hebrew year 19 should be leap year (position 19)',
    expected: 'Leap year, position 19',
    actual: `${metonic19.isLeapYear ? 'Leap' : 'Common'} year, position ${metonic19.cyclePosition}`,
    passed: metonic19.isLeapYear && metonic19.cyclePosition === 19,
    notes: `Cycle number: ${metonic19.cycleNumber}`
  });
  
  // Test 4: Hebrew year 20 should be position 1 (start of new cycle)
  const metonic20 = getMetonicCycle(20, true);
  results.push({
    cycle: 'Metonic Cycle',
    test: 'Hebrew year 20 should be position 1 (new cycle)',
    expected: 'Position 1',
    actual: `Position ${metonic20.cyclePosition}`,
    passed: metonic20.cyclePosition === 1,
    notes: `Cycle number: ${metonic20.cycleNumber}`
  });
  
  return results;
}

/**
 * Verify Mayan Calendar Round
 * Calendar Round = 52 years (18,980 days)
 */
export function verifyMayanCalendarRound(): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  // Test 1: Epoch should be round 0, year 0
  const jdnEpoch = gregorianToJDN(-3113, 8, 11);
  const roundEpoch = getMayanCalendarRound(jdnEpoch);
  results.push({
    cycle: 'Mayan Calendar Round',
    test: 'Epoch should be round 0, year 0',
    expected: 'Round 0, Year 0',
    actual: `Round ${roundEpoch.roundNumber}, Year ${roundEpoch.yearsIntoRound}`,
    passed: roundEpoch.roundNumber === 0 && roundEpoch.yearsIntoRound === 0,
    notes: `Days into round: ${roundEpoch.daysIntoRound}`
  });
  
  // Test 2: After 52 years, should be round 1
  const jdn52Years = gregorianToJDN(-3061, 8, 11); // 52 years after epoch
  const round52 = getMayanCalendarRound(jdn52Years);
  results.push({
    cycle: 'Mayan Calendar Round',
    test: '52 years after epoch should be round 1',
    expected: 'Round 1, Year 0',
    actual: `Round ${round52.roundNumber}, Year ${round52.yearsIntoRound}`,
    passed: round52.roundNumber === 1 && round52.yearsIntoRound === 0,
    notes: `Days into round: ${round52.daysIntoRound}`
  });
  
  return results;
}

/**
 * Verify Hindu Yuga Cycles
 * Kali Yuga started: 3102 BCE (astronomical year -3101)
 * Current Yuga: Kali Yuga
 */
export function verifyHinduYugaCycles(): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  // Test 1: Year 3102 BCE should be start of Kali Yuga
  const yuga3102 = getHinduYugaCycle(-3101); // -3101 = 3102 BCE
  results.push({
    cycle: 'Hindu Yuga',
    test: '3102 BCE should be start of Kali Yuga',
    expected: 'Kali Yuga, year 0',
    actual: `${yuga3102.yugaType} Yuga, year ${yuga3102.yearsIntoYuga}`,
    passed: yuga3102.yugaType === 'Kali' && yuga3102.yearsIntoYuga === 0 && yuga3102.mahayugaNumber === 0,
    notes: `Mahayuga: ${yuga3102.mahayugaNumber}, Is Kali: ${yuga3102.isKaliYuga}`
  });
  
  // Test 2: Year 2024 should be in Kali Yuga
  const yuga2024 = getHinduYugaCycle(2024);
  results.push({
    cycle: 'Hindu Yuga',
    test: '2024 should be in Kali Yuga',
    expected: 'Kali Yuga',
    actual: `${yuga2024.yugaType} Yuga`,
    passed: yuga2024.yugaType === 'Kali' && yuga2024.mahayugaNumber === 0,
    notes: `Years into Yuga: ${yuga2024.yearsIntoYuga.toLocaleString()}, Mahayuga: ${yuga2024.mahayugaNumber}`
  });
  
  // Test 3: Years into Kali Yuga should be approximately 5126 (2024 + 3102)
  const expectedYears = 2024 + 3102;
  const actualYears = yuga2024.yearsIntoYuga;
  const difference = Math.abs(actualYears - expectedYears);
  results.push({
    cycle: 'Hindu Yuga',
    test: `Years into Kali Yuga should be ~${expectedYears}`,
    expected: `~${expectedYears} years`,
    actual: `${actualYears} years`,
    passed: difference < 2, // Allow small difference due to year boundary
    notes: `Difference: ${difference} years`
  });
  
  return results;
}

/**
 * Run all verification tests
 */
export function runAllVerificationTests(): {
  allPassed: boolean;
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    byCycle: Record<string, { total: number; passed: number }>;
  };
} {
  const allResults: VerificationResult[] = [
    ...verifyChineseSexagenaryCycle(),
    ...verifyMayanLongCount(),
    ...verifyMetonicCycle(),
    ...verifyMayanCalendarRound(),
    ...verifyHinduYugaCycles()
  ];
  
  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;
  
  const byCycle: Record<string, { total: number; passed: number }> = {};
  allResults.forEach(result => {
    if (!byCycle[result.cycle]) {
      byCycle[result.cycle] = { total: 0, passed: 0 };
    }
    byCycle[result.cycle].total++;
    if (result.passed) {
      byCycle[result.cycle].passed++;
    }
  });
  
  return {
    allPassed: failed === 0,
    results: allResults,
    summary: {
      total: allResults.length,
      passed,
      failed,
      byCycle
    }
  };
}

