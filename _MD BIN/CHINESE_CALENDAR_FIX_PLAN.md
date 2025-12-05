# Chinese Calendar Fix Plan

**Date**: December 2024  
**Status**: Ready to Implement

## Issues to Fix

### Issue 1: Leap Month Detection
**Problem**: Leap months are not being detected correctly.

**Root Cause**: According to Chinese calendar rules, a leap month is a lunar month that does NOT contain a "major solar term" (中气 - zhōngqì). The major solar terms are the odd-numbered ones (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23).

**Current Code**: Checks if a month has ANY solar term (line 164: `termsInMonth.length === 0`)

**Fix Needed**: Check if a month has NO major (odd-numbered) solar term instead.

### Issue 2: Year Boundary Detection
**Problem**: Dates near Chinese New Year showing wrong year.

**Root Cause**: The year determination logic in `fromJDN` may have edge cases around the New Year transition.

**Fix Needed**: Improve year boundary handling, especially for dates exactly on Chinese New Year.

## Fix Strategy

### Fix 1: Update Leap Month Detection Logic

Change from:
```typescript
const isLeap = termsInMonth.length === 0;
```

To:
```typescript
// Check if this month has no major solar term (leap month)
// Major solar terms are odd-numbered (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23)
const hasMajorSolarTerm = termsInMonth.some(term => term % 2 === 1);
const isLeap = !hasMajorSolarTerm;
```

### Fix 2: Improve Year Boundary Handling

Improve the logic in `fromJDN` to better handle dates exactly on Chinese New Year and dates just before/after.

## Implementation Steps

1. Fix leap month detection logic
2. Test with known leap month dates
3. Review and improve year boundary logic
4. Test with Chinese New Year dates
5. Re-run all tests
6. Document fixes

