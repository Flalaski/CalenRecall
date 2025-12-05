# Chinese Calendar Verification Test Results

**Date**: December 2024  
**Test Command**: `npm run test:chinese`  
**Status**: ⚠️ **Issues Found**

## Test Summary

**Total Tests**: 40  
**Passed**: 30 (75.0%)  
**Failed**: 10 (25.0%)

## Test Results by Category

### ✅ Test 1: Chinese New Year Dates (1/5 passed - 20%)
- ✅ 2024: Correct
- ❌ 2023: Expected 2023-1-1, got 2022-23-2
- ❌ 2022: Expected 2022-1-1, got 2021-24-1
- ❌ 2021: Expected 2021-1-1, got 2021-1-2 (off by 1 day)
- ❌ 2020: Expected 2020-1-1, got 2019-24-2

**Issue**: Chinese year determination is incorrect near year boundaries. Dates that should be Chinese New Year (month 1, day 1) are showing as the previous year's month 23/24.

### ❌ Test 2: Intercalary (Leap) Months (0/3 passed - 0%)
- ❌ 2023 Leap Month 2: Expected Month 14 (Leap), got Month 2 (Regular)
- ❌ 2020 Leap Month 4: Expected Month 16 (Leap), got Month 4 (Regular)
- ❌ 2017 Leap Month 6: Expected Month 18 (Leap), got Month 6 (Regular)

**Issue**: Leap months are not being detected. The implementation shows regular months instead of leap months (month + 12 encoding).

### ✅ Test 3: Solar Terms (24/24 passed - 100%)
All 24 solar terms for 2024 match correctly (with ±1 day tolerance where applicable).

**Status**: ✅ **Excellent** - Solar term calculations are accurate.

### ⚠️ Test 4: Traditional Festivals (3/4 passed - 75%)
- ✅ Lantern Festival 2024: Correct
- ✅ Dragon Boat Festival 2024: Correct
- ✅ Mid-Autumn Festival 2024: Correct
- ❌ Double Ninth Festival 2024: Expected 2024-9-9, got 2024-9-10 (off by 1 day)

**Status**: Mostly correct, one date is off by 1 day.

### ⚠️ Test 5: Round-Trip Conversions (2/4 passed - 50%)
- ✅ Regular month round-trip: Works correctly
- ✅ Regular month round-trip: Works correctly
- ❌ Leap month round-trip (2023): Error - "Leap month 2 does not exist in Chinese year 2023"
- ❌ Leap month round-trip (2020): Error - "Leap month 4 does not exist in Chinese year 2020"

**Issue**: Round-trip conversions fail for leap months because the implementation doesn't recognize them when converting back.

## Key Issues Identified

### Issue 1: Chinese Year Boundary Detection ⚠️
**Severity**: High  
**Description**: The implementation incorrectly determines Chinese years near the New Year boundary. Dates that are Chinese New Year are showing as the previous year's last months (23/24).

**Examples**:
- 2023-01-22 (should be 2023-1-1) → shows as 2022-23-2
- 2022-02-01 (should be 2022-1-1) → shows as 2021-24-1

**Root Cause**: Likely an issue in `fromJDN` when determining which Chinese year a date belongs to, especially around the New Year transition.

### Issue 2: Leap Month Detection ⚠️
**Severity**: High  
**Description**: Leap months are not being detected or encoded correctly. Dates that should be in leap months are showing as regular months.

**Examples**:
- 2023-03-22 (should be 2023 leap month 2, month 14) → shows as 2023 month 2 (regular)
- 2020-05-23 (should be 2020 leap month 4, month 16) → shows as 2020 month 4 (regular)

**Root Cause**: The leap month calculation logic in `calculateChineseYear` may not be correctly identifying which months should be leap months, or the encoding (month + 12) is not being applied correctly.

### Issue 3: Date Offsets (1 day differences) ⚠️
**Severity**: Low  
**Description**: Some dates are off by 1 day from expected values.

**Examples**:
- 2021-02-12 (should be 2021-1-1) → got 2021-1-2
- Double Ninth Festival: Expected 9th day, got 10th day

**Root Cause**: Could be time-of-day differences, timezone issues, or rounding in astronomical calculations.

### Issue 4: Leap Month Round-Trip Failures ⚠️
**Severity**: Medium  
**Description**: Cannot perform round-trip conversions for leap months because the implementation doesn't recognize them when converting back from JDN.

**Root Cause**: Related to Issue 2 - if leap months aren't detected during `fromJDN`, they can't be round-tripped.

## Strengths

✅ **Solar Term Calculations**: Excellent accuracy - all 24 solar terms match correctly  
✅ **Regular Month Conversions**: Round-trip conversions work correctly for regular months  
✅ **Basic Calendar Structure**: The calendar structure and month encoding is sound

## Recommendations

### Priority 1: Fix Chinese Year Boundary Detection
- Review `fromJDN` logic for determining Chinese year
- Ensure proper handling of dates around Chinese New Year
- Test with dates just before and after New Year

### Priority 2: Fix Leap Month Detection
- Review `calculateChineseYear` leap month calculation
- Verify solar term logic for determining leap months
- Ensure month encoding (month + 12 for leap) is applied correctly
- Test with known leap month dates

### Priority 3: Investigate 1-Day Offsets
- Review time-of-day handling in calculations
- Check for timezone issues
- Verify astronomical calculation precision

### Priority 4: Add More Test Cases
- Add tests for edge cases (year boundaries, month boundaries)
- Add tests for more historical dates
- Add tests for leap month edge cases

## Next Steps

1. **Investigate Issues**: Review Chinese calendar implementation code
2. **Fix Year Boundary**: Correct Chinese year determination logic
3. **Fix Leap Months**: Correct leap month detection and encoding
4. **Re-run Tests**: Verify fixes with test script
5. **Expand Tests**: Add more test cases once core issues are fixed

---

**Test Run Date**: December 2024  
**Test Script**: `scripts/verify-chinese-calendar.ts`  
**Reference Dates**: `_MD BIN/CHINESE_CALENDAR_REFERENCE_DATES.md`

