# Calendar Fix Steps - Detailed Action Plan

## Quick Reference: Test Results Summary
- **Total Tests**: 144
- **Passed**: 4 (2.8%)
- **Failed**: 140 (97.2%)
- **Critical Issues**: Hebrew calendar stack overflow, negative year handling, epoch misalignments

---

## STEP 1: Fix Hebrew Calendar Stack Overflow (CRITICAL - P0)

### 1.1: Analyze Recursion Problem
**File**: `src/utils/calendars/hebrew.ts`
- [ ] Identify exact recursion path causing stack overflow
- [ ] Document which functions call which
- [ ] Identify the circular dependency

**Current Issue**: `getDaysInHebrewMonth` → `getDaysInHebrewYear` → `calculateHebrewYearLength` → (indirectly) → `getDaysInHebrewMonth`

### 1.2: Implement Molad-Based Calculation
**File**: `src/utils/calendars/hebrew.ts`
- [ ] Implement direct molad (lunar conjunction) calculation
- [ ] Remove dependency on `getDaysInHebrewMonth` from year length calculation
- [ ] Use algorithm from "Calendrical Calculations" (Dershowitz & Reingold)
- [ ] Calculate year type (deficient/regular/complete) directly from molad

**Key Functions to Modify**:
- `calculateHebrewYearLength()` - must NOT call `getDaysInHebrewMonth`
- `getDaysInHebrewMonth()` - use cached year length, never call `getDaysInHebrewYear` recursively
- `getDaysInHebrewYear()` - use `calculateHebrewYearLength` only

### 1.3: Add Recursion Guards
**File**: `src/utils/calendars/hebrew.ts`
- [ ] Enhance existing recursion guards
- [ ] Add explicit checks before any function calls
- [ ] Add logging for debugging (remove after fix verified)

### 1.4: Test Hebrew Calendar
- [ ] Test with date: 100-6-15 (currently fails)
- [ ] Test with date: 1000-12-31 (currently fails)
- [ ] Test with date: 2024-2-29 (currently fails)
- [ ] Test with date: 0-1-1 (currently fails)
- [ ] Test with date: -100-7-4 (currently fails)
- [ ] Verify no stack overflow errors
- [ ] Verify JDN consistency (round-trip produces same JDN)

**Expected Result**: All Hebrew calendar tests pass without stack overflow

---

## STEP 2: Fix Negative Year Handling (HIGH - P1)

### 2.1: Verify JDN Calculations for Negative Years
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Test `gregorianToJDN(-100, 1, 1)` - should return JDN 1686042
- [ ] Test `gregorianToJDN(0, 1, 1)` - should return JDN 1721058
- [ ] Test `jdnToGregorian(1686042)` - should return year -100
- [ ] Test `jdnToGregorian(1721058)` - should return year 0
- [ ] Verify year numbering: 0 = 1 BCE, -1 = 2 BCE, -100 = 101 BCE

**Current Issue**: Negative years show 365-day offsets, suggesting year offset error

### 2.2: Fix Gregorian Negative Year Conversion
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Review `gregorianToJDN` formula for negative years
- [ ] Review `jdnToGregorian` formula for negative years
- [ ] Ensure consistent astronomical year numbering
- [ ] Fix any off-by-one errors in year calculations

**Test Cases**:
- [ ] Round-trip: -100-7-4 → JDN → -100-7-4 (currently shows -99-7-4)
- [ ] Round-trip: 0-1-1 → JDN → 0-1-1 (currently shows different JDN)
- [ ] Known reference: -100-1-1 = JDN 1686042 (currently 1684901)

### 2.3: Fix Julian Negative Year Conversion
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Review `julianToJDN` formula for negative years
- [ ] Review `jdnToJulian` formula for negative years
- [ ] Ensure consistent with Gregorian year numbering

**Test Cases**:
- [ ] Round-trip: -100-7-4 → JDN → -100-7-4 (currently shows -99-7-4)

### 2.4: Fix Cherokee Calendar Negative Years
**File**: `src/utils/calendars/cherokee.ts`
- [ ] Verify Cherokee uses Gregorian JDN conversion
- [ ] Ensure negative years are handled correctly
- [ ] Test round-trip conversions for negative years

**Test Cases**:
- [ ] Round-trip: -100-7-4 → JDN → -100-7-4 (currently shows -99-7-4)

### 2.5: Fix Iroquois Calendar Negative Years
**File**: `src/utils/calendars/iroquois.ts`
- [ ] Verify Iroquois uses Gregorian JDN conversion
- [ ] Ensure negative years are handled correctly
- [ ] Test round-trip conversions for negative years

**Test Cases**:
- [ ] Round-trip: -100-7-4 → JDN → -100-7-4 (currently shows -99-7-4)

### 2.6: Fix Thai Buddhist Negative Years
**File**: `src/utils/calendars/thaiBuddhist.ts`
- [ ] Review year offset calculation: Thai Buddhist = Gregorian + 543
- [ ] For negative Thai Buddhist years: Gregorian = Thai Buddhist - 543
- [ ] Ensure negative year conversion is correct
- [ ] Test with negative years

**Test Cases**:
- [ ] Round-trip: -100-7-4 → JDN → -100-7-4 (currently shows -99-7-4)

**Expected Result**: All negative year conversions produce correct JDNs (within 1 day)

---

## STEP 3: Fix Epoch Alignments (HIGH - P1)

### 3.1: Fix Hebrew Calendar Epoch
**File**: `src/utils/calendars/hebrew.ts`
- [ ] Verify Hebrew epoch: October 7, 3761 BCE = JDN 347997
- [ ] Current constant: `HEBREW_EPOCH = 347997` (correct)
- [ ] Check if conversion algorithm uses epoch correctly
- [ ] Test: Hebrew year 1, month 1, day 1 should = JDN 347997

**Current Issue**: Hebrew epoch test shows JDN 348028 instead of 347997 (31-day difference)

### 3.2: Fix Islamic Calendar Epoch
**File**: `src/utils/calendars/islamic.ts`
- [ ] Verify Islamic epoch: July 16, 622 CE = JDN 1948439
- [ ] Check current epoch constant
- [ ] Update if incorrect
- [ ] Test: Islamic year 1, month 1, day 1 should = JDN 1948439

**Current Issue**: Shows JDN 1948437 instead of 1948439 (2-day difference)

### 3.3: Fix Modern Date Reference
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Verify: January 1, 2024 = JDN 2460106
- [ ] Test `gregorianToJDN(2024, 1, 1)` - should return 2460106
- [ ] Current shows 2460311 (205-day difference - major error!)
- [ ] This suggests fundamental issue with JDN calculation

**Action**: This is a critical bug - investigate immediately

### 3.4: Fix Leap Year Date Reference
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Verify: February 29, 2024 = JDN 2460136
- [ ] Test `gregorianToJDN(2024, 2, 29)` - should return 2460136
- [ ] Current shows 2460370 (234-day difference)
- [ ] Verify leap year detection works correctly

### 3.5: Fix Negative Year Reference
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Verify: January 1, 101 BCE (year -100) = JDN 1686042
- [ ] Test `gregorianToJDN(-100, 1, 1)` - should return 1686042
- [ ] Current shows 1684901 (1141-day difference - major error!)
- [ ] This confirms negative year handling is broken

### 3.6: Fix Year Zero Reference
**File**: `src/utils/calendars/julianDayUtils.ts`
- [ ] Verify: January 1, 1 BCE (year 0) = JDN 1721058
- [ ] Test `gregorianToJDN(0, 1, 1)` - should return 1721058
- [ ] Current shows 1721060 (2-day difference)
- [ ] Check for off-by-one errors

**Expected Result**: All epoch and reference dates match expected JDNs exactly

---

## STEP 4: Fix JDN Consistency Issues (HIGH - P1)

### 4.1: Fix Islamic Calendar Round-Trips
**File**: `src/utils/calendars/islamic.ts`
- [ ] Review Islamic calendar conversion algorithm
- [ ] Ensure `islamicToJDN` and `jdnToIslamic` are inverse functions
- [ ] Test round-trip conversions
- [ ] Fix any discrepancies

**Current Issues**:
- Round-trip shows 82-275 day differences
- Negative year conversions show 130-133 day differences

### 4.2: Fix Persian Calendar Round-Trips
**File**: `src/utils/calendars/persian.ts`
- [ ] Review Persian calendar conversion algorithm
- [ ] Verify epoch: March 19, 622 CE = JDN 1948318
- [ ] Ensure `persianToJDN` and `jdnToPersian` are inverse functions
- [ ] Test round-trip conversions

**Current Issues**:
- Round-trip shows 156-518 day differences
- Negative year conversions show 210 day differences

### 4.3: Fix Indian Saka Calendar Round-Trips
**File**: `src/utils/calendars/indianSaka.ts`
- [ ] Review Indian Saka calendar conversion algorithm
- [ ] Verify epoch and conversion formulas
- [ ] Ensure round-trip conversions work

**Current Issues**:
- JDN mismatches of 13-523 days
- Round-trip shows 161-523 day differences

### 4.4: Fix Mayan Long Count Round-Trips
**File**: `src/utils/calendars/mayanLongCount.ts`
- [ ] Review Mayan Long Count conversion algorithm
- [ ] Verify epoch: August 11, 3114 BCE = JDN 584283
- [ ] Ensure `mayanLongCountToJDN` and `jdnToMayanLongCount` are inverse
- [ ] Test round-trip conversions

**Current Issues**:
- Round-trip shows 68-263 day differences
- Negative year conversions show 98 day differences

### 4.5: Fix Mayan Tzolkin Calendar
**File**: `src/utils/calendars/mayanTzolkin.ts`
- [ ] Review Tzolkin calendar (260-day cycle)
- [ ] Tzolkin is cyclical, not linear - needs special handling
- [ ] Ensure conversion to/from JDN works correctly
- [ ] Test round-trip conversions

**Current Issues**:
- Shows 365-day differences (suggests year offset error)

### 4.6: Fix Mayan Haab Calendar
**File**: `src/utils/calendars/mayanHaab.ts`
- [ ] Review Haab calendar (365-day cycle)
- [ ] Haab is cyclical, not linear - needs special handling
- [ ] Ensure conversion to/from JDN works correctly
- [ ] Test round-trip conversions

**Current Issues**:
- Shows 365-day differences (suggests year offset error)
- Invalid day errors (day 31 in month 12)

### 4.7: Fix Aztec Xiuhpohualli Calendar
**File**: `src/utils/calendars/aztecXiuhpohualli.ts`
- [ ] Review Aztec calendar (similar to Mayan Haab)
- [ ] Ensure conversion to/from JDN works correctly
- [ ] Test round-trip conversions

**Current Issues**:
- Shows 365-day differences
- Invalid day errors

**Expected Result**: All round-trip conversions produce same JDN (within 1 day tolerance)

---

## STEP 5: Fix Ethiopian/Coptic Calendars (MEDIUM - P2)

### 5.1: Fix Ethiopian Calendar
**File**: `src/utils/calendars/ethiopian.ts`
- [ ] Review Ethiopian calendar conversion algorithm
- [ ] Ethiopian = Coptic + 8 years
- [ ] Verify epoch and conversion formulas
- [ ] Test round-trip conversions

**Current Issues**:
- 111-112 day differences in conversions
- Round-trip shows 108-112 day differences

### 5.2: Fix Coptic Calendar
**File**: `src/utils/calendars/coptic.ts`
- [ ] Review Coptic calendar conversion algorithm
- [ ] Verify epoch: August 29, 284 CE
- [ ] Ensure conversion formulas are correct
- [ ] Test round-trip conversions

**Current Issues**:
- 111-112 day differences in conversions
- Round-trip shows 108-112 day differences

**Expected Result**: Ethiopian and Coptic conversions accurate within 1 day

---

## STEP 6: Fix Baha'i Calendar (MEDIUM - P2)

### 6.1: Fix Baha'i Calendar Conversions
**File**: `src/utils/calendars/bahai.ts`
- [ ] Review Baha'i calendar conversion algorithm
- [ ] Baha'i calendar has 19 months of 19 days (361 days) + intercalary days
- [ ] Verify epoch and conversion formulas
- [ ] Test round-trip conversions

**Current Issues**:
- 4-day difference in leap year date conversion
- 365-day difference in negative year conversion

**Expected Result**: Baha'i conversions accurate within 1 day

---

## STEP 7: Fix Chinese Calendar (LOW - P3)

### 7.1: Review Chinese Calendar Implementation
**File**: `src/utils/calendars/chinese.ts`
- [ ] Chinese calendar is complex lunisolar calendar
- [ ] Requires astronomical calculations
- [ ] Consider using a library or reference implementation
- [ ] May need to relax accuracy requirements

**Current Issues**:
- Invalid day errors (day 31 in month 12)
- Massive JDN differences (672877 days = ~1842 years)
- Round-trip conversions completely wrong

**Note**: This may require significant work or using an external library

**Expected Result**: Chinese calendar conversions reasonable (may need relaxed accuracy)

---

## STEP 8: Validation and Testing

### 8.1: Run Full Test Suite
- [ ] Run `npm run test:calendars`
- [ ] Document all remaining failures
- [ ] Prioritize remaining issues

### 8.2: Verify Reference Dates
- [ ] Verify all reference date JDNs using authoritative sources
- [ ] Update test file if reference dates are incorrect
- [ ] Use multiple sources to verify JDN values

### 8.3: Add Unit Tests
- [ ] Create unit tests for each calendar converter
- [ ] Test edge cases (leap years, epoch boundaries, negative years)
- [ ] Test round-trip conversions
- [ ] Test known historical dates

### 8.4: Performance Testing
- [ ] Test conversions for large date ranges
- [ ] Test conversions for very old dates (negative years)
- [ ] Ensure no performance regressions

### 8.5: Documentation
- [ ] Document any limitations or approximations
- [ ] Document accuracy tolerances for each calendar
- [ ] Update calendar descriptions if needed

**Expected Result**: All tests pass, documentation complete

---

## Testing Checklist

After each fix, verify:

### Hebrew Calendar
- [ ] No stack overflow errors
- [ ] JDN consistency tests pass
- [ ] Round-trip conversions work
- [ ] Epoch date matches reference

### Negative Years
- [ ] Gregorian negative years work
- [ ] Julian negative years work
- [ ] Cherokee/Iroquois negative years work
- [ ] Thai Buddhist negative years work
- [ ] All calendars handle negative years correctly

### Epochs
- [ ] Hebrew epoch = JDN 347997
- [ ] Islamic epoch = JDN 1948439
- [ ] Persian epoch = JDN 1948318
- [ ] Mayan epoch = JDN 584283
- [ ] Modern date (2024-1-1) = JDN 2460106
- [ ] Leap year date (2024-2-29) = JDN 2460136
- [ ] Negative year (-100-1-1) = JDN 1686042
- [ ] Year zero (0-1-1) = JDN 1721058

### Round-Trips
- [ ] All calendars: A → JDN → A produces same JDN (within 1 day)
- [ ] Cross-calendar: A → B → A produces same JDN (within 1 day)
- [ ] Negative years round-trip correctly

---

## Success Criteria

- ✅ All 144 tests pass (currently 4 pass, 140 fail)
- ✅ Hebrew calendar works without stack overflow
- ✅ Negative year conversions accurate (within 1 day)
- ✅ Round-trip conversions produce same JDN (within 1 day)
- ✅ Epoch dates match reference JDNs exactly
- ✅ Known reference dates match expected JDNs exactly
- ✅ No performance regressions
- ✅ Documentation complete

---

## Notes

1. **Priority Order**: Fix Hebrew first (blocks all Hebrew usage), then negative years (affects many calendars), then epochs (fundamental accuracy), then round-trips
2. **Testing**: Test incrementally after each fix to catch regressions early
3. **Tolerance**: 1-day tolerance acceptable for some calendars due to approximations
4. **Chinese Calendar**: May require significant work or external library - consider deferring
5. **Reference Dates**: Verify all reference JDNs using authoritative sources before fixing

