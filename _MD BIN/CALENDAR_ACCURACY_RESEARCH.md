# Calendar Accuracy Research & Implementation Plan

## Overview
This document tracks research and implementation of accurate, culturally respectful calendar algorithms to replace approximations.

## Priority: High (Approximations Found)

### 1. Chinese Lunisolar Calendar
**Current Status**: Uses simplified Metonic cycle approximation
**Issues**: 
- Approximates lunar months as alternating 29/30 days
- Uses simplified leap year pattern
- Does not calculate actual new moons or solar terms (jieqi)
- Epoch is approximate (February 5, 1900 CE)

**Required Implementation**:
- Astronomical calculations for new moon dates
- Calculation of 24 solar terms (jieqi) 
- Proper determination of leap months based on solar terms
- Accurate Chinese New Year calculation (second new moon after winter solstice)
- Reference: "Calendrical Calculations" by Dershowitz & Reingold, Chapter 19

**Cultural Considerations**:
- Chinese calendar is still actively used for traditional festivals
- Must respect the astronomical basis of the calendar
- Leap month placement follows specific rules based on solar terms

### 2. Baha'i Calendar
**Current Status**: Approximates Naw-Rúz (vernal equinox) as March 21
**Issues**:
- Does not calculate actual astronomical vernal equinox
- Naw-Rúz can be March 20 or 21 depending on equinox timing

**Required Implementation**:
- Astronomical calculation of vernal equinox for each year
- Proper determination of Naw-Rúz date
- Reference: "Calendrical Calculations" by Dershowitz & Reingold, Chapter 7

**Cultural Considerations**:
- Baha'i calendar is actively used by Baha'i community
- Naw-Rúz is a holy day - accuracy is important

### 3. Cherokee Calendar
**Current Status**: Maps directly to Gregorian calendar
**Issues**:
- Comment says "approximation" but implementation is actually correct
- Cherokee calendar was historically adapted to align with Gregorian months
- This appears to be culturally appropriate

**Action**: Review with Cherokee cultural experts to confirm appropriateness

### 4. Mayan Long Count
**Current Status**: Basic implementation, defaults uinal and kin to 0
**Issues**:
- Does not fully support uinal and kin components in year/month/day interface
- Comment mentions "simplified approach" for negative dates

**Required Implementation**:
- Full support for all Long Count components
- Proper handling of negative dates
- Reference: "Calendrical Calculations" by Dershowitz & Reingold, Chapter 12

**Cultural Considerations**:
- Mayan calendars are of great cultural significance
- Long Count is a precise astronomical calendar
- Must respect the positional notation system

## Priority: Medium (Epoch Verification Needed)

### 5. Ethiopian Calendar
**Current Status**: Epoch verified correct (JDN 1724221)
**Issues**: 
- Test shows 111-day alignment difference
- May be calculation issue, not epoch issue

**Action**: Review calculation logic for negative years and year boundaries

### 6. Coptic Calendar  
**Current Status**: Epoch verified correct (JDN 1825030)
**Issues**:
- Test shows 111-day alignment difference
- May be calculation issue, not epoch issue

**Action**: Review calculation logic for negative years and year boundaries

## Implementation Strategy

1. **Phase 1**: Research authoritative sources
   - "Calendrical Calculations" by Dershowitz & Reingold (primary reference)
   - Astronomical calculation libraries/algorithms
   - Cultural expert consultation where possible

2. **Phase 2**: Implement accurate algorithms
   - Start with Chinese calendar (most complex)
   - Then Baha'i calendar (simpler, but important)
   - Then Mayan Long Count (completeness)
   - Fix Ethiopian/Coptic calculation issues

3. **Phase 3**: Testing and validation
   - Compare with authoritative sources
   - Test round-trip conversions
   - Verify cultural accuracy

4. **Phase 4**: Documentation
   - Document algorithms used
   - Cite sources
   - Note any limitations or approximations

## References

- Dershowitz, Nachum, and Edward Reingold. "Calendrical Calculations: The Ultimate Edition." Cambridge University Press, 2018.
- US Naval Observatory Astronomical Applications Department
- International Astronomical Union standards

## Notes

- All implementations should prioritize accuracy over simplicity
- Cultural sensitivity is paramount - consult experts when possible
- Document any remaining approximations and their reasons
- Provide context about cultural significance in code comments

