# Calendar Fix Plan

## Overview
This document outlines the steps needed to fix all calendar conversion issues identified in the test suite. The test results show 140 failed tests out of 144 total tests (97.2% failure rate).

## Critical Issues Summary

### 1. Hebrew Calendar - Stack Overflow (CRITICAL)
- **Issue**: Maximum call stack size exceeded errors for all Hebrew calendar operations
- **Root Cause**: Infinite recursion between `getDaysInHebrewMonth` and `getDaysInHebrewYear`
- **Impact**: Hebrew calendar is completely unusable
- **Priority**: P0 (Critical)

### 2. Negative Year Handling (HIGH)
- **Issue**: Many calendars show 365-day offsets when handling negative years (BCE dates)
- **Affected Calendars**: Gregorian, Julian, Cherokee, Iroquois, Thai Buddhist, Mayan calendars
- **Root Cause**: Incorrect year offset calculations when converting negative years
- **Impact**: Historical dates before year 0 are incorrect
- **Priority**: P1 (High)

### 3. JDN Consistency Issues (HIGH)
- **Issue**: Round-trip conversions don't produce the same JDN
- **Affected Calendars**: Islamic, Persian, Indian Saka, Thai Buddhist, Mayan calendars
- **Root Cause**: Incorrect epoch calculations or date conversion logic
- **Impact**: Date conversions are inaccurate
- **Priority**: P1 (High)

### 4. Epoch Alignment Issues (MEDIUM)
- **Issue**: Calendar epochs don't align correctly with reference dates
- **Affected Calendars**: Islamic, Hebrew, Persian, Mayan Long Count
- **Root Cause**: Incorrect epoch JDN values or conversion formulas
- **Impact**: Historical dates are offset by days/months
- **Priority**: P2 (Medium)

### 5. Chinese Calendar Issues (MEDIUM)
- **Issue**: Invalid day errors and massive JDN differences (672877 days)
- **Root Cause**: Chinese calendar uses a complex lunisolar system that may not be correctly implemented
- **Impact**: Chinese calendar conversions are completely wrong
- **Priority**: P2 (Medium)

### 6. Known Reference Date Mismatches (MEDIUM)
- **Issue**: Reference dates don't match expected JDNs
- **Affected**: Islamic Epoch, Hebrew Epoch, Modern Date, Leap Year Date, Negative Year, Year Zero
- **Root Cause**: Incorrect JDN calculations for these specific dates
- **Impact**: Reference dates are incorrect
- **Priority**: P2 (Medium)

## Fix Steps

### Phase 1: Critical Fixes (Hebrew Calendar)

#### Step 1.1: Fix Hebrew Calendar Recursion
**File**: `src/utils/calendars/hebrew.ts`

**Problem**: The `getDaysInHebrewMonth` function calls `getDaysInHebrewYear`, which may indirectly call back to `getDaysInHebrewMonth`, causing infinite recursion.

**Solution**:
1. Refactor `calculateHebrewYearLength` to use molad-based calculations without calling `getDaysInHebrewMonth`
2. Ensure `getDaysInHebrewMonth` uses cached year lengths and never calls `getDaysInHebrewYear` recursively
3. Implement proper molad (lunar conjunction) calculations for accurate Hebrew calendar dates
4. Add better recursion guards and validation

**Implementation Details**:
- Use the algorithm from "Calendrical Calculations" by Dershowitz & Reingold
- Calculate molad times directly without recursive dependencies
- Cache all intermediate calculations
- Add explicit checks to prevent circular calls

**Test**: Verify Hebrew calendar conversions work for all test dates without stack overflow

---

### Phase 2: Negative Year Handling

#### Step 2.1: Fix Gregorian/Julian Negative Year Conversion
**Files**: 
- `src/utils/calendars/julianDayUtils.ts`
- `src/utils/calendars/calendarConverter.ts` (gregorian/julian converters)

**Problem**: Negative years show 365-day offsets in round-trip conversions

**Solution**:
1. Verify `gregorianToJDN` and `julianToJDN` handle negative years correctly
2. Verify `jdnToGregorian` and `jdnToJulian` return correct negative years
3. Check that year 0 is handled correctly (astronomical vs historical numbering)
4. Ensure era designations (BCE/CE) are correctly applied

**Implementation Details**:
- Review the year numbering system: astronomical (has year 0) vs historical (no year 0)
- Ensure consistent handling: year 0 = 1 BCE, year -1 = 2 BCE, etc.
- Test with known reference dates for negative years

**Test**: Verify round-trip conversions for negative years produce same JDN

#### Step 2.2: Fix Cherokee/Iroquois Negative Year Handling
**Files**: 
- `src/utils/calendars/cherokee.ts`
- `src/utils/calendars/iroquois.ts`

**Problem**: These calendars show 365-day offsets for negative years

**Solution**:
1. These calendars are based on Gregorian, so they should use the same JDN conversion
2. Verify they're correctly delegating to Gregorian JDN functions
3. Check era handling for negative years

**Test**: Verify negative year conversions match Gregorian

#### Step 2.3: Fix Thai Buddhist Negative Year Handling
**File**: `src/utils/calendars/thaiBuddhist.ts`

**Problem**: Thai Buddhist calendar shows 365-day offsets for negative years

**Solution**:
1. Thai Buddhist = Gregorian + 543 years
2. Verify the year offset calculation handles negative years correctly
3. Ensure BCE dates are converted properly (negative Gregorian years)

**Implementation Details**:
- For year Y in Thai Buddhist: Gregorian year = Y - 543
- For negative Thai Buddhist years, ensure the conversion is correct
- Test with reference dates

**Test**: Verify Thai Buddhist conversions for negative years

---

### Phase 3: JDN Consistency Fixes

#### Step 3.1: Fix Islamic Calendar Epoch and Conversions
**File**: `src/utils/calendars/islamic.ts`

**Problems**:
- Islamic epoch shows 350-day difference
- Round-trip conversions show 82-275 day differences
- Negative year conversions show 130-133 day differences

**Solution**:
1. Verify Islamic epoch JDN: July 16, 622 CE = JDN 1948439 (not 1948437)
2. Fix the epoch constant if incorrect
3. Review the Islamic calendar conversion algorithm
4. Ensure proper handling of negative Islamic years (before Hijra)

**Implementation Details**:
- Islamic calendar uses a pure lunar system (12 months, 354-355 days/year)
- Verify the epoch date and JDN calculation
- Use algorithm from "Calendrical Calculations"
- Test with known Islamic dates

**Test**: Verify Islamic epoch matches reference, round-trips work correctly

#### Step 3.2: Fix Persian Calendar Epoch and Conversions
**File**: `src/utils/calendars/persian.ts`

**Problems**:
- Persian epoch shows 357-day difference
- Round-trip conversions show 156-518 day differences
- Negative year conversions show 210 day differences

**Solution**:
1. Verify Persian epoch JDN: March 19, 622 CE = JDN 1948318
2. Fix the epoch constant if incorrect
3. Review Persian calendar conversion algorithm (solar calendar with leap years)
4. Ensure proper handling of negative Persian years

**Implementation Details**:
- Persian calendar is solar with 12 months
- Uses a 33-year cycle for leap years
- Verify the epoch and conversion formulas

**Test**: Verify Persian epoch matches reference, round-trips work correctly

#### Step 3.3: Fix Indian Saka Calendar Conversions
**File**: `src/utils/calendars/indianSaka.ts`

**Problems**:
- JDN mismatches of 13-523 days
- Round-trip conversions show 161-523 day differences

**Solution**:
1. Verify Indian Saka epoch and conversion algorithm
2. Indian Saka = Gregorian - 78 years (approximately)
3. Ensure proper handling of negative years
4. Review the calendar's leap year rules

**Test**: Verify Indian Saka conversions match expected JDNs

#### Step 3.4: Fix Mayan Calendar Conversions
**Files**: 
- `src/utils/calendars/mayanLongCount.ts`
- `src/utils/calendars/mayanTzolkin.ts`
- `src/utils/calendars/mayanHaab.ts`

**Problems**:
- Mayan Long Count shows 68-263 day differences
- Mayan Tzolkin shows 365-day differences
- Mayan Haab shows 365-day differences

**Solution**:
1. Verify Mayan epoch: August 11, 3114 BCE = JDN 584283
2. Fix Mayan Long Count conversion algorithm
3. Fix Tzolkin and Haab conversions (they're cyclical, not linear)
4. Ensure proper handling of negative years

**Implementation Details**:
- Mayan Long Count is a linear count of days
- Tzolkin is a 260-day cycle
- Haab is a 365-day cycle (not a year count)
- These need special handling as they're not traditional calendars

**Test**: Verify Mayan conversions match expected JDNs

---

### Phase 4: Epoch Alignment Fixes

#### Step 4.1: Fix Hebrew Calendar Epoch
**File**: `src/utils/calendars/hebrew.ts`

**Problem**: Hebrew epoch shows JDN 348028 instead of expected 347997 (31-day difference)

**Solution**:
1. Verify Hebrew epoch: October 7, 3761 BCE = JDN 347997
2. Fix the HEBREW_EPOCH constant
3. Ensure the conversion algorithms use the correct epoch

**Test**: Verify Hebrew epoch matches reference JDN

#### Step 4.2: Fix Islamic Calendar Epoch
**File**: `src/utils/calendars/islamic.ts`

**Problem**: Islamic epoch shows JDN 1948437 instead of expected 1948439 (2-day difference)

**Solution**:
1. Verify Islamic epoch: July 16, 622 CE = JDN 1948439
2. Fix the epoch constant
3. Ensure conversion algorithms use correct epoch

**Test**: Verify Islamic epoch matches reference JDN

#### Step 4.3: Fix Modern Date Reference
**Problem**: January 1, 2024 shows JDN 2460311 instead of expected 2460106 (205-day difference)

**Solution**:
1. Verify the JDN calculation for January 1, 2024
2. Check if there's an error in the Gregorian to JDN conversion
3. This suggests a fundamental issue with JDN calculations

**Test**: Verify modern date JDN matches reference

#### Step 4.4: Fix Leap Year Date Reference
**Problem**: February 29, 2024 shows JDN 2460370 instead of expected 2460136 (234-day difference)

**Solution**:
1. Verify leap year handling in JDN calculations
2. Ensure February 29, 2024 is correctly identified as valid
3. Check the JDN calculation for this specific date

**Test**: Verify leap year date JDN matches reference

#### Step 4.5: Fix Negative Year Reference
**Problem**: January 1, 101 BCE shows JDN 1684901 instead of expected 1686042 (1141-day difference)

**Solution**:
1. This is a major discrepancy suggesting fundamental issues with negative year handling
2. Verify the JDN calculation for negative years
3. Check if there's an off-by-one error or year numbering issue

**Test**: Verify negative year JDN matches reference

#### Step 4.6: Fix Year Zero Reference
**Problem**: January 1, 1 BCE (year 0) shows JDN 1721060 instead of expected 1721058 (2-day difference)

**Solution**:
1. Verify year 0 handling in JDN calculations
2. Ensure the transition from year -1 to year 0 to year 1 is correct
3. Check for off-by-one errors

**Test**: Verify year zero JDN matches reference

---

### Phase 5: Chinese Calendar Fixes

#### Step 5.1: Fix Chinese Calendar Implementation
**File**: `src/utils/calendars/chinese.ts`

**Problems**:
- Invalid day errors (day 31 in month 12)
- Massive JDN differences (672877 days = ~1842 years)
- Round-trip conversions completely wrong

**Solution**:
1. Chinese calendar is a complex lunisolar calendar
2. Months have variable lengths (29 or 30 days)
3. Years have variable lengths (12 or 13 months)
4. Need to implement proper Chinese calendar algorithm
5. Consider using a library or reference implementation

**Implementation Details**:
- Chinese calendar requires astronomical calculations
- Months are based on lunar cycles
- Leap months are inserted to align with solar year
- This is a complex implementation that may require significant work

**Test**: Verify Chinese calendar conversions are reasonable (may need to relax accuracy requirements)

---

### Phase 6: Ethiopian/Coptic Calendar Fixes

#### Step 6.1: Fix Ethiopian Calendar Conversions
**File**: `src/utils/calendars/ethiopian.ts`

**Problems**:
- 111-112 day differences in conversions
- Round-trip conversions show 108-112 day differences

**Solution**:
1. Ethiopian calendar = Coptic calendar + 8 years
2. Verify the epoch and conversion algorithm
3. Ensure proper handling of negative years

**Test**: Verify Ethiopian conversions match expected JDNs

#### Step 6.2: Fix Coptic Calendar Conversions
**File**: `src/utils/calendars/coptic.ts`

**Problems**:
- 111-112 day differences in conversions
- Round-trip conversions show 108-112 day differences

**Solution**:
1. Coptic calendar epoch: August 29, 284 CE
2. Verify the epoch JDN
3. Ensure proper conversion algorithm
4. Coptic calendar is solar with 13 months

**Test**: Verify Coptic conversions match expected JDNs

---

### Phase 7: Baha'i Calendar Fixes

#### Step 7.1: Fix Baha'i Calendar Conversions
**File**: `src/utils/calendars/bahai.ts`

**Problems**:
- 4-day difference in leap year date conversion
- 365-day difference in negative year conversion

**Solution**:
1. Baha'i calendar = Gregorian - 1844 years (approximately)
2. Verify the epoch and conversion algorithm
3. Baha'i calendar has 19 months of 19 days each (361 days) + intercalary days
4. Ensure proper handling of leap years and negative years

**Test**: Verify Baha'i conversions match expected JDNs

---

### Phase 8: Validation and Testing

#### Step 8.1: Create Comprehensive Test Suite
**File**: `scripts/test-calendar-accuracy.js` (already exists, enhance it)

**Tasks**:
1. Add more test cases for edge cases
2. Add tests for each calendar's epoch
3. Add tests for known historical dates
4. Add performance tests for large date ranges
5. Add tests for negative year boundaries

#### Step 8.2: Fix Test Reference Dates
**File**: `scripts/test-calendar-accuracy.js`

**Problem**: Some reference dates may have incorrect expected JDNs

**Solution**:
1. Verify all reference date JDNs using authoritative sources
2. Update reference dates if needed
3. Use multiple sources to verify JDN values

#### Step 8.3: Add Regression Tests
**Tasks**:
1. Create unit tests for each calendar converter
2. Add integration tests for cross-calendar conversions
3. Add tests for specific bug fixes
4. Ensure all tests pass before marking issues as fixed

---

## Implementation Order

1. **Phase 1** (Critical): Fix Hebrew calendar recursion - blocks all Hebrew calendar usage
2. **Phase 2** (High): Fix negative year handling - affects many calendars
3. **Phase 4** (High): Fix epoch alignments - fundamental accuracy issues
4. **Phase 3** (High): Fix JDN consistency - affects round-trip conversions
5. **Phase 6** (Medium): Fix Ethiopian/Coptic calendars
6. **Phase 7** (Medium): Fix Baha'i calendar
7. **Phase 5** (Low): Fix Chinese calendar - complex, may need significant work
8. **Phase 8** (Ongoing): Validation and testing throughout

## Success Criteria

- All 144 tests pass (currently 4 pass, 140 fail)
- Hebrew calendar works without stack overflow
- Negative year conversions are accurate (within 1 day)
- Round-trip conversions produce same JDN (within 1 day tolerance)
- Epoch dates match reference JDNs exactly
- Known reference dates match expected JDNs exactly

## Notes

- Some calendars may have inherent limitations (e.g., Chinese calendar requires astronomical calculations)
- Tolerance of 1 day may be acceptable for some calendars due to approximations
- Focus on fixing the most critical issues first (Hebrew, negative years, epochs)
- Test incrementally after each fix to ensure no regressions

