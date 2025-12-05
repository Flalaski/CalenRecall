# Chinese Calendar Implementation Issues

**Date**: December 2024  
**Status**: Issues Identified - Needs Investigation and Fixes

## Summary

After running comprehensive verification tests, 4 main issues were identified in the Chinese calendar implementation:

1. **Chinese Year Boundary Detection** (High Priority)
2. **Leap Month Detection** (High Priority)
3. **Date Offsets** (Low Priority)
4. **Leap Month Round-Trip Failures** (Medium Priority)

## Issue 1: Chinese Year Boundary Detection

### Problem
The implementation incorrectly determines Chinese years near the New Year boundary. Dates that should be the first day of a Chinese year (month 1, day 1) are showing as the previous year's last months (23/24).

### Examples
```
Gregorian: 2023-01-22 → Expected: 2023-1-1 → Actual: 2022-23-2
Gregorian: 2022-02-01 → Expected: 2022-1-1 → Actual: 2021-24-1
Gregorian: 2020-01-25 → Expected: 2020-1-1 → Actual: 2019-24-2
```

### Likely Root Cause
Issue in `fromJDN` function when determining which Chinese year a JDN belongs to. The logic may:
- Not correctly handle the transition period around Chinese New Year (late January to mid-February)
- Use incorrect logic for determining if a date is before or after New Year
- Have issues with the refinement loop that checks Chinese New Year dates

### Location in Code
- `src/utils/calendars/chinese.ts`
- Function: `fromJDN(jdn: number)`
- Specifically: Year determination logic (lines ~258-301)

### Fix Strategy
1. Review the year determination logic in `fromJDN`
2. Improve the logic for finding the correct Chinese year
3. Add more precise checks for Chinese New Year dates
4. Test with dates just before and after New Year

## Issue 2: Leap Month Detection

### Problem
Leap months are not being detected correctly. Dates that should be in leap months are showing as regular months. The implementation should encode leap months as month + 12 (e.g., leap month 2 = month 14), but this isn't happening.

### Examples
```
Gregorian: 2023-03-22 → Expected: 2023 month 14 (leap 2) → Actual: 2023 month 2 (regular)
Gregorian: 2020-05-23 → Expected: 2020 month 16 (leap 4) → Actual: 2020 month 4 (regular)
Gregorian: 2017-07-23 → Expected: 2017 month 18 (leap 6) → Actual: 2017 month 6 (regular)
```

### Likely Root Cause
The leap month calculation logic in `calculateChineseYear` may:
- Not correctly identify which months should be leap months
- Have issues with the solar term logic (leap month = month with no solar term)
- Not correctly encode leap months as month + 12 in the returned date structure

### Location in Code
- `src/utils/calendars/chinese.ts`
- Function: `calculateChineseYear(chineseYear: number)`
- Specifically: Leap month detection logic (lines ~163-180)

### Fix Strategy
1. Review solar term logic for determining leap months
2. Verify that months with no solar terms are correctly identified as leap
3. Ensure leap months are correctly encoded (month + 12) in date structure
4. Test with known leap month dates

## Issue 3: Date Offsets (1 Day Differences)

### Problem
Some dates are off by 1 day from expected values. This could be due to time-of-day differences, timezone issues, or rounding in astronomical calculations.

### Examples
```
Gregorian: 2021-02-12 → Expected: 2021-1-1 → Actual: 2021-1-2 (off by 1 day)
Double Ninth Festival: Expected 9th day → Got 10th day (off by 1 day)
```

### Likely Root Cause
- Time-of-day differences (midnight vs noon)
- Timezone handling
- Rounding in astronomical calculations
- Precision issues in new moon calculations

### Location in Code
- Astronomical calculations in `astronomicalUtils.ts`
- New moon calculations
- Solar term calculations

### Fix Strategy
1. Review time-of-day handling
2. Check for timezone issues
3. Verify astronomical calculation precision
4. Consider allowing ±1 day tolerance for some calculations

## Issue 4: Leap Month Round-Trip Failures

### Problem
Cannot perform round-trip conversions for leap months because the implementation doesn't recognize them when converting back from JDN. This is related to Issue 2.

### Examples
```
Attempting round-trip for 2023 leap month 2:
Error: "Leap month 2 does not exist in Chinese year 2023"
```

### Likely Root Cause
Since leap months aren't detected correctly (Issue 2), they can't be round-tripped. When converting a leap month date to JDN and back, the system doesn't recognize it as a leap month.

### Fix Strategy
1. Fix Issue 2 (leap month detection) first
2. Then verify round-trip conversions work
3. Test with known leap month dates

## Implementation Notes

### Current Implementation Strengths
- ✅ Solar term calculations are accurate (100% pass rate)
- ✅ Regular month conversions work correctly
- ✅ Basic calendar structure is sound
- ✅ Astronomical calculations are generally good

### Areas Needing Work
- ⚠️ Year boundary detection logic
- ⚠️ Leap month detection and encoding
- ⚠️ Date precision/offset handling

## Debugging Steps

### Step 1: Verify Chinese New Year Calculation
1. Check `chineseNewYearJDN` function
2. Verify it correctly calculates Chinese New Year as second new moon after winter solstice
3. Test with known Chinese New Year dates

### Step 2: Debug Year Determination
1. Add logging to `fromJDN` year determination logic
2. Trace through the year refinement loop
3. Check JDN values for Chinese New Year dates

### Step 3: Debug Leap Month Detection
1. Add logging to `calculateChineseYear` leap month logic
2. Verify solar term calculations for each month
3. Check which months have no solar terms
4. Verify leap month encoding

### Step 4: Test Incrementally
1. Fix one issue at a time
2. Re-run tests after each fix
3. Add more test cases as needed

## References

- Test Results: `_MD BIN/CHINESE_CALENDAR_TEST_RESULTS.md`
- Reference Dates: `_MD BIN/CHINESE_CALENDAR_REFERENCE_DATES.md`
- Implementation: `src/utils/calendars/chinese.ts`
- Astronomical Utils: `src/utils/calendars/astronomicalUtils.ts`

---

**Status**: Issues identified, ready for investigation and fixes

