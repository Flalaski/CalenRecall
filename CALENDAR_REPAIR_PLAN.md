# Calendar System Repair Plan

## Overview
This document outlines all steps needed to repair calendar conversion accuracy issues identified in the test suite. The test results show 140 failures out of 144 tests (97.2% failure rate), indicating systematic issues that need to be addressed.

## Critical Issues Summary

### 1. Hebrew Calendar - Infinite Recursion (CRITICAL)
**Status**: BLOCKING - Must be fixed first
**Error**: `RangeError: Maximum call stack size exceeded`
**Affected Tests**: All Hebrew calendar tests fail with stack overflow
**Root Cause**: Circular dependency in `getDaysInHebrewMonth` and `getDaysInHebrewYear` functions

### 2. Negative Year Handling
**Status**: HIGH PRIORITY
**Issue**: Many calendars show 365-day differences when handling negative years
**Affected Calendars**: 
- Gregorian (-100-7-4): 365 days off
- Julian (-100-7-4): 365 days off
- Thai Buddhist: 365 days off
- Cherokee: 365 days off
- Iroquois: 365 days off
- And many more...

**Root Cause**: Incorrect conversion between historical year numbering (no year 0) and astronomical year numbering (has year 0)

### 3. JDN Consistency Failures
**Status**: HIGH PRIORITY
**Issue**: Converting a date to JDN and back produces different JDN values
**Affected Calendars**: 
- Islamic: 6-day differences
- Persian: 13-day differences
- Indian Saka: Various differences
- Mayan calendars: Various differences
- And more...

### 4. Epoch Alignment Issues
**Status**: HIGH PRIORITY
**Issue**: Calendar epochs don't align correctly with Gregorian dates
**Examples**:
- Islamic Epoch: Expected JDN 1948439, got 1948437 (2 days off)
- Hebrew Epoch: Expected JDN 347997, got 348028 (31 days off)
- Modern Date (2024-1-1): Expected JDN 2460106, got 2460311 (205 days off!)
- Negative Year (-100-1-1): Expected JDN 1686042, got 1684901 (1141 days off!)

### 5. Round-Trip Conversion Failures
**Status**: MEDIUM PRIORITY
**Issue**: Converting A -> B -> A doesn't return to original date
**Affected**: Most calendars show JDN differences in round-trip tests

### 6. Invalid Day Validation
**Status**: LOW PRIORITY
**Issue**: Some calendars accept invalid days (e.g., day 31 in Chinese calendar, day 31 in Mayan Haab)
**Affected**: Chinese, Mayan Haab, Aztec Xiuhpohualli

---

## Repair Steps

### Phase 1: Fix Critical Hebrew Calendar Bug (BLOCKING)

#### Step 1.1: Fix Hebrew Calendar Infinite Recursion
**File**: `src/utils/calendars/hebrew.ts`
**Issue**: The `getDaysInHebrewMonth` function calls `getDaysInHebrewYear`, which may indirectly call back to `getDaysInHebrewMonth`, causing infinite recursion.

**Solution**:
1. Review the recursion guard mechanism - it exists but may not be working correctly
2. Ensure `calculateHebrewYearLength` never calls `getDaysInHebrewMonth`
3. Use molad-based calculations for year length instead of iterative month calculations
4. Add better caching and validation to prevent circular calls
5. Test with dates that previously caused stack overflow

**Expected Result**: All Hebrew calendar tests should complete without stack overflow errors

---

### Phase 2: Fix Negative Year Handling

#### Step 2.1: Verify JDN Utilities Handle Negative Years Correctly
**File**: `src/utils/calendars/julianDayUtils.ts`
**Issue**: Need to verify that `gregorianToJDN` and `julianToJDN` correctly handle the historical vs astronomical year numbering conversion.

**Current Logic**:
- Historical: -1 = 2 BCE, -100 = 101 BCE (no year 0)
- Astronomical: 0 = 1 BCE, -1 = 2 BCE, -99 = 100 BCE, -100 = 101 BCE
- Conversion: if year <= 0, add 1 to get astronomical year

**Action**: 
1. Verify the conversion logic is correct
2. Test with known reference dates:
   - Year 0 (1 BCE): Should be JDN 1721058
   - Year -100 (101 BCE): Should be JDN 1686042
3. Check that `jdnToGregorian` and `jdnToJulian` correctly convert back

#### Step 2.2: Fix All Calendar Converters to Use Correct Year Numbering
**Files**: All calendar converter files
**Issue**: Many calendars may be using incorrect year numbering when converting to/from JDN.

**Action**:
1. For each calendar converter:
   - Ensure `toJDN` correctly handles negative years
   - Ensure `fromJDN` correctly converts back to historical year numbering
   - Test with negative year dates
2. Calendars to fix:
   - Gregorian (already uses julianDayUtils, verify it's correct)
   - Julian (already uses julianDayUtils, verify it's correct)
   - Islamic
   - Persian
   - Chinese
   - Ethiopian
   - Coptic
   - Indian Saka
   - Thai Buddhist
   - Cherokee
   - Iroquois
   - And all others showing 365-day differences

**Expected Result**: All negative year tests should pass with JDN differences <= 1 day

---

### Phase 3: Fix JDN Consistency Issues

#### Step 3.1: Fix Islamic Calendar JDN Consistency
**File**: `src/utils/calendars/islamic.ts`
**Issue**: Converting dates shows JDN mismatches (e.g., -100-7-4: JDN 1912828 vs 1912822, 6 days off)

**Action**:
1. Review `islamicToJDN` function
2. Review `jdnToIslamic` function
3. Verify epoch calculation (AH 1 = July 16, 622 CE = JDN 1948439)
4. Test round-trip conversions
5. Check leap year calculations

#### Step 3.2: Fix Persian Calendar JDN Consistency
**File**: `src/utils/calendars/persian.ts`
**Issue**: JDN mismatches (e.g., -100-7-4: JDN 1911618 vs 1911605, 13 days off)

**Action**:
1. Review `persianToJDN` function
2. Review `jdnToPersian` function
3. Verify epoch calculation (SH 1 = March 19, 622 CE = JDN 1948318)
4. Test round-trip conversions
5. Check leap year calculations (Persian calendar has complex leap year rules)

#### Step 3.3: Fix Indian Saka Calendar JDN Consistency
**File**: `src/utils/calendars/indianSaka.ts`
**Issue**: Multiple JDN mismatches

**Action**:
1. Review conversion functions
2. Verify epoch calculation
3. Test round-trip conversions

#### Step 3.4: Fix Mayan Calendar JDN Consistency
**Files**: 
- `src/utils/calendars/mayanLongCount.ts`
- `src/utils/calendars/mayanTzolkin.ts`
- `src/utils/calendars/mayanHaab.ts`

**Issue**: JDN mismatches in all Mayan calendar types

**Action**:
1. Review each Mayan calendar converter
2. Verify epoch calculation (Mayan epoch = August 11, 3114 BCE = JDN 584283)
3. Test round-trip conversions
4. Verify Long Count calculations

#### Step 3.5: Fix Thai Buddhist Calendar JDN Consistency
**File**: `src/utils/calendars/thaiBuddhist.ts`
**Issue**: 365-day differences, indicating year numbering issue

**Action**:
1. Review year offset calculation (BE = CE + 543)
2. Verify it correctly handles negative years
3. Test round-trip conversions

#### Step 3.6: Fix Native American Calendar JDN Consistency
**Files**:
- `src/utils/calendars/cherokee.ts`
- `src/utils/calendars/iroquois.ts`

**Issue**: 365-day differences

**Action**:
1. Review year handling (these calendars may use Gregorian year numbering)
2. Verify negative year handling
3. Test round-trip conversions

---

### Phase 4: Fix Epoch Alignment

#### Step 4.1: Fix Islamic Epoch
**File**: `src/utils/calendars/islamic.ts`
**Issue**: Expected JDN 1948439, got 1948437 (2 days off)

**Action**:
1. Verify the epoch date: July 16, 622 CE
2. Calculate correct JDN for this date using `gregorianToJDN(622, 7, 16)`
3. Update epoch constant if needed
4. Verify AH 1, Muharram 1 corresponds to this JDN

#### Step 4.2: Fix Hebrew Epoch
**File**: `src/utils/calendars/hebrew.ts`
**Issue**: Expected JDN 347997, got 348028 (31 days off)

**Action**:
1. Verify the epoch date: October 7, 3761 BCE
2. Calculate correct JDN for this date
3. Update HEBREW_EPOCH constant
4. Verify AM 1, Tishrei 1 corresponds to this JDN

#### Step 4.3: Fix Modern Date JDN Calculation
**Issue**: January 1, 2024 CE: Expected JDN 2460106, got 2460311 (205 days off!)

**Action**:
1. This is a critical bug in the base JDN calculation
2. Verify `gregorianToJDN(2024, 1, 1)` returns correct value
3. Check if there's an off-by-one error or year calculation issue
4. Test with multiple modern dates

#### Step 4.4: Fix Negative Year JDN Calculation
**Issue**: January 1, 101 BCE (-100): Expected JDN 1686042, got 1684901 (1141 days off!)

**Action**:
1. This indicates a major issue with negative year handling
2. Verify the year numbering conversion
3. Test with multiple negative year dates
4. Check if the issue is in `gregorianToJDN` or in calendar-specific converters

#### Step 4.5: Fix Year Zero JDN Calculation
**Issue**: January 1, 1 BCE (year 0): Expected JDN 1721058, got 1721060 (2 days off)

**Action**:
1. Verify year 0 handling
2. Check astronomical vs historical year numbering
3. Test conversion both ways

---

### Phase 5: Fix Round-Trip Conversions

#### Step 5.1: Fix Round-Trip for All Calendars
**Action**: After fixing JDN consistency issues, test round-trip conversions:
1. Convert Gregorian date to target calendar
2. Convert back to Gregorian
3. Verify JDN difference is <= 1 day

**Calendars to test**:
- Islamic
- Hebrew (after fixing recursion)
- Persian
- Chinese
- Ethiopian
- Coptic
- Indian Saka
- Bahai
- Thai Buddhist
- Mayan calendars
- Native American calendars

---

### Phase 6: Fix Invalid Day Validation

#### Step 6.1: Add Day Validation to Chinese Calendar
**File**: `src/utils/calendars/chinese.ts`
**Issue**: Accepts invalid days (e.g., day 31)

**Action**:
1. Add validation in `toJDN` function
2. Check maximum days for each month based on lunar calendar rules
3. Throw error for invalid dates

#### Step 6.2: Add Day Validation to Mayan Haab
**File**: `src/utils/calendars/mayanHaab.ts`
**Issue**: Accepts invalid days (e.g., day 31 in 20-day months)

**Action**:
1. Add validation: Haab months have 20 days (except last month with 5)
2. Validate day range: 1-20 for most months, 1-5 for last month

#### Step 6.3: Add Day Validation to Aztec Xiuhpohualli
**File**: `src/utils/calendars/aztecXiuhpohualli.ts`
**Issue**: Accepts invalid days

**Action**:
1. Add validation: Xiuhpohualli months have 20 days
2. Validate day range: 1-20

---

## Testing Strategy

### After Each Phase:
1. Run the test suite: `npm run test:calendars`
2. Verify that the specific issues addressed in that phase are resolved
3. Check that no new issues were introduced
4. Document any remaining issues

### Final Verification:
1. All tests should pass (or have acceptable differences <= 1 day for known edge cases)
2. Round-trip conversions should work for all calendars
3. Known reference dates should match expected JDN values
4. Negative years should be handled correctly
5. No stack overflow errors

---

## Priority Order

1. **CRITICAL**: Fix Hebrew calendar infinite recursion (blocks all Hebrew tests)
2. **HIGH**: Fix negative year handling (affects many calendars)
3. **HIGH**: Fix modern date JDN calculation (205 days off is unacceptable)
4. **HIGH**: Fix negative year JDN calculation (1141 days off is critical)
5. **MEDIUM**: Fix epoch alignments
6. **MEDIUM**: Fix JDN consistency issues
7. **MEDIUM**: Fix round-trip conversions
8. **LOW**: Add invalid day validation

---

## Notes

- Work incrementally, one calendar at a time
- Test after each change
- Keep detailed notes of what was changed and why
- Reference authoritative sources for calendar algorithms:
  - "Calendrical Calculations" by Dershowitz & Reingold
  - "Astronomical Algorithms" by Jean Meeus
  - Official calendar specifications where available

---

## Files to Modify

1. `src/utils/calendars/hebrew.ts` - Fix recursion
2. `src/utils/calendars/julianDayUtils.ts` - Verify negative year handling
3. `src/utils/calendars/islamic.ts` - Fix JDN consistency and epoch
4. `src/utils/calendars/persian.ts` - Fix JDN consistency
5. `src/utils/calendars/indianSaka.ts` - Fix JDN consistency
6. `src/utils/calendars/mayanLongCount.ts` - Fix JDN consistency
7. `src/utils/calendars/mayanTzolkin.ts` - Fix JDN consistency
8. `src/utils/calendars/mayanHaab.ts` - Fix JDN consistency and validation
9. `src/utils/calendars/thaiBuddhist.ts` - Fix negative year handling
10. `src/utils/calendars/cherokee.ts` - Fix negative year handling
11. `src/utils/calendars/iroquois.ts` - Fix negative year handling
12. `src/utils/calendars/chinese.ts` - Add day validation
13. `src/utils/calendars/aztecXiuhpohualli.ts` - Add day validation
14. All other calendar files showing issues in test results

---

## Success Criteria

- Test suite passes with >= 95% pass rate
- All critical bugs (stack overflow, major JDN errors) are fixed
- Round-trip conversions work for all calendars
- Known reference dates match expected JDN values
- Negative years are handled correctly
- No regressions introduced

