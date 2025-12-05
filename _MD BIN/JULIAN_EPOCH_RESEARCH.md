# Julian Calendar Epoch Research

**Date**: December 2024  
**Issue**: 2-day discrepancy in Julian calendar epoch JDN

## The Problem

**Expected**: JDN 1721426 (January 1, 1 CE)  
**Calculated**: JDN 1721424 (from julianToJDN formula)  
**Difference**: -2 days

## Analysis

### Formulas Used

**Gregorian Calendar** (from `julianDayUtils.ts:31-32`):
```typescript
return day + Math.floor((153 * m + 2) / 5) + 365 * y + 
       Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
```

**Julian Calendar** (from `julianDayUtils.ts:154-155`):
```typescript
return day + Math.floor((153 * m + 2) / 5) + 365 * y + 
       Math.floor(y / 4) - 32083;
```

### Key Differences

1. Gregorian uses: `- 32045`
2. Julian uses: `- 32083`
3. Difference in constant: 38 days

### Historical Context

- For dates **before 1582**, Julian and Gregorian calendars should match (Gregorian didn't exist)
- January 1, 1 CE should theoretically give the **same JDN** in both calendars
- Our formulas give:
  - Gregorian (1, 1, 1): JDN 1721426
  - Julian (1, 1, 1): JDN 1721424
  - Difference: 2 days

## Questions to Research

1. **Which is correct?**
   - Is JDN 1721424 or 1721426 the correct JDN for January 1, 1 CE?
   - Should Julian and Gregorian match at year 1 CE?

2. **Formula Verification**
   - Is the Julian formula (-32083) correct?
   - Is the Gregorian formula (-32045) correct?
   - Should they produce the same result for dates before 1582?

3. **Authoritative Sources**
   - What does "Calendrical Calculations" say?
   - What do other authoritative sources say?

## Possible Explanations

1. **Proleptic Calendar Difference**
   - Gregorian formula may be calculating proleptic Gregorian (back-projected)
   - Julian formula calculates actual Julian calendar
   - For dates before 1582, proleptic Gregorian = Julian

2. **Formula Error**
   - One of the formulas may have an error in the constant
   - The Julian formula constant might need adjustment

3. **Convention Difference**
   - Different sources may use slightly different epoch definitions
   - Time-of-day differences (midnight vs noon)

## Next Steps

1. Research authoritative sources (Calendrical Calculations, Meeus)
2. Verify formulas against multiple sources
3. Check if round-trip conversions work correctly
4. Determine which value should be used as the standard

## References to Check

- "Calendrical Calculations" by Dershowitz & Reingold
- "Astronomical Algorithms" by Jean Meeus
- US Naval Observatory calculations
- Other calendar conversion libraries

---

**Status**: Research needed  
**Priority**: Medium (implementation works, but epoch value needs verification)

