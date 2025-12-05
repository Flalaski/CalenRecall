# Epoch Verification Issues Found

**Date**: December 2024  
**Status**: Issues Identified - Fixes in Progress

## Issues Discovered

### 1. Julian Calendar Epoch ⚠️
**Issue**: Returns JDN 1721424, expected 1721426 (2-day difference)

**Analysis**:
- Julian calendar formula gives different result than Gregorian at year 1
- For dates before 1582, Julian and Gregorian should match (since Gregorian didn't exist)
- The 2-day difference suggests the Julian formula may need adjustment
- Need to verify which is correct: formula result or documented value

**Action**: Verify correct JDN for Julian calendar epoch (January 1, 1 CE)

---

### 2. Mayan Long Count Epoch ❌
**Issue**: Returns JDN 1721426 (Gregorian epoch), expected 584283

**Root Cause**:
- `epochUtils.ts` doesn't have explicit case for `'mayan-longcount'`
- Falls through to default case which returns Gregorian epoch
- Should return 584283 like other Mayan calendars

**Fix Required**: Add explicit case for `'mayan-longcount'` in `epochUtils.ts`

---

### 3. Islamic Calendar Epoch ⚠️
**Issue**: Direct calculation gives JDN 1948440, expected 1948439 (1-day difference)

**Analysis**:
- May be due to time-of-day (JDN represents noon)
- Or Julian calendar conversion subtlety
- Need to verify correct epoch date

**Action**: Verify if 1948439 or 1948440 is correct

---

### 4. Hebrew Calendar Epoch ⚠️
**Issue**: Direct calculation gives JDN 347998, expected 347997 (1-day difference)

**Analysis**:
- Similar to Islamic - may be time-of-day or conversion issue
- Need to verify correct epoch date

**Action**: Verify if 347997 or 347998 is correct

---

## Verification Notes

The 1-day differences for Islamic and Hebrew epochs may be acceptable due to:
- JDN represents noon (midday)
- Epoch dates may be specified as midnight vs noon
- Different sources may use slightly different conventions

The 2-day difference for Julian and the wrong epoch for Mayan Long Count need to be fixed.

---

## Next Steps

1. Fix Mayan Long Count epoch (clear bug)
2. Research and verify correct Julian epoch JDN
3. Verify Islamic and Hebrew epoch dates with authoritative sources
4. Update epochUtils.ts with corrections
5. Re-run verification script

---

**Last Updated**: December 2024

