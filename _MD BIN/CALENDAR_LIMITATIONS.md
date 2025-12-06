# Calendar System Limitations and Approximations

This document details known limitations, approximations, and areas requiring additional verification for CalenRecall's calendar implementations.

**Last Updated**: December 2024  
**Status**: Comprehensive audit complete, some items require ongoing verification

---

## Overview

CalenRecall implements 17 calendar systems with varying levels of complexity. Most calendars are fully verified and accurate. Some calendars use documented approximations for efficiency, and a few require additional verification or expert consultation.

### Verification Status Summary

- **✅ Fully Verified**: 13 calendars (76%)
- **⚠️ Needs Additional Work**: 4 calendars (24%)
  - Chinese: Reference date verification needed
  - Mayan Long Count: Encoding scheme verification needed
  - Cherokee: Cultural expert consultation required
  - Iroquois: Research and potential improvement needed
- **⚠️ Research Needed**: 1 issue
  - Julian epoch: 2-day discrepancy to research

---

## Documented Limitations by Calendar

### 1. Gregorian Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Foundation calendar, fully accurate

---

### 2. Julian Calendar
**Status**: ⚠️ Epoch Research Needed  
**Limitations**: 
- **Epoch Discrepancy**: 2-day difference in epoch JDN calculation
  - Current implementation: JDN 1721424 for January 1, 1 CE
  - Alternative calculation: JDN 1721426 for January 1, 1 CE
  - **Impact**: Minor, affects dates near epoch
  - **Action**: Research authoritative sources to determine correct value

**Notes**: 
- Algorithm is correct, but epoch constant needs verification
- See `JULIAN_EPOCH_RESEARCH.md` for research plan

---

### 3. Islamic (Hijri) Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Uses standard 30-year cycle algorithm

---

### 4. Hebrew (Jewish) Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Complex Metonic cycle correctly implemented

---

### 5. Persian (Jalali/Solar Hijri) Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Accurate leap year cycle implementation

---

### 6. Chinese Lunisolar Calendar
**Status**: ⚠️ Needs Accuracy Verification  
**Limitations**:
- **Year Boundary Detection**: Dates near Chinese New Year may show incorrect year
  - **Location**: `fromJDN()` function in `chinese.ts`
  - **Impact**: Medium - affects dates around New Year transition
  - **Action**: Review year determination logic, improve New Year transition handling

- **Leap Month Detection**: Leap months may not be detected/encoded correctly
  - **Location**: `calculateChineseYear()` function in `chinese.ts`
  - **Impact**: Medium - affects dates in leap months
  - **Action**: Review solar term logic, verify leap month encoding

- **Astronomical Calculations**: Uses approximations for efficiency
  - **Impact**: Low - minor variations from true astronomical calculations
  - **Acceptable**: Documented approximation for performance

**Notes**:
- Chinese calendar is astronomically-based and complex
- Some approximations are necessary for computational efficiency
- See `CHINESE_CALENDAR_ISSUES.md` for detailed analysis

---

### 7. Ethiopian Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Accurate implementation with 13-month structure

---

### 8. Coptic Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Accurate implementation with 13-month structure

---

### 9. Indian National (Saka) Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Accurate leap year cycle implementation

---

### 10. Baháʼí Calendar
**Status**: ✅ Fully Verified  
**Limitations**: 
- **Astronomical Calculations**: Uses approximations for intercalary days
  - **Impact**: Low - minor variations from true astronomical calculations
  - **Acceptable**: Documented approximation for performance

**Notes**: 
- 19-month structure correctly implemented
- Intercalary day calculations use approximations

---

### 11. Thai Buddhist Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: Simple offset from Gregorian, fully accurate

---

### 12. Mayan Tzolk'in Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: 260-day cycle correctly implemented

---

### 13. Mayan Haab' Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: 365-day cycle correctly implemented

---

### 14. Mayan Long Count Calendar
**Status**: ⚠️ Encoding Verification Needed  
**Limitations**:
- **Encoding Scheme**: Encoding/decoding scheme needs comprehensive verification
  - **Location**: `mayanLongCount.ts`
  - **Impact**: Medium - affects date representation
  - **Action**: Create test cases with all 5 components, verify encoding works correctly

**Notes**:
- Epoch bug was fixed (missing case statement)
- Encoding scheme needs verification with comprehensive test cases
- See `MAYAN_LONG_COUNT_VERIFICATION.md` for verification plan

---

### 15. Cherokee Calendar
**Status**: ⚠️ Cultural Expert Consultation Required  
**Limitations**:
- **Cultural Authenticity**: Requires verification by Cherokee cultural experts
  - **Impact**: Low - modern adaptation, not traditional calendar
  - **Action**: Contact Cherokee cultural resources for verification
  - **Status**: Questions prepared, awaiting expert consultation

**Notes**:
- This is a modern adaptation using traditional month names
- Not a traditional Cherokee calendar system
- See `CHEROKEE_CALENDAR_EXPERT_QUESTIONS.md` for prepared questions

---

### 16. Iroquois (Haudenosaunee) Calendar
**Status**: ⚠️ Uses Approximation  
**Limitations**:
- **Lunar Calculations**: Uses approximations for lunar month calculations
  - **Impact**: Low - acceptable for general use
  - **Action**: Research traditional Iroquois calendar implementation for potential improvements

**Notes**:
- 13-moon structure correctly implemented
- Lunar calculations use approximations
- Traditional implementation may vary by community

---

### 17. Aztec Xiuhpohualli Calendar
**Status**: ✅ Fully Verified  
**Limitations**: None  
**Notes**: 365-day cycle with 18 months correctly implemented

---

## General Limitations

### Negative Years
- **Status**: ✅ Supported
- **Limitations**: Some calendars may have limited support for very ancient dates
- **Notes**: Most calendars support negative years for historical dates

### Very Large Date Ranges
- **Status**: ⚠️ May have precision issues
- **Limitations**: Some calculations may lose precision for dates far from epoch
- **Impact**: Low - affects dates thousands of years from epoch
- **Notes**: Most calendars handle reasonable date ranges accurately

### Astronomical Calendars
- **Status**: ⚠️ Use approximations
- **Calendars Affected**: Chinese, Baháʼí
- **Limitations**: True astronomical calculations would require real-time astronomical data
- **Impact**: Low - minor variations from true astronomical dates
- **Acceptable**: Documented approximations for computational efficiency

### Cultural Calendars
- **Status**: ⚠️ Some require expert verification
- **Calendars Affected**: Cherokee, Iroquois
- **Limitations**: Modern adaptations may not match traditional usage
- **Impact**: Low - modern adaptations are acceptable for general use
- **Action**: Ongoing consultation with cultural experts

---

## Known Issues

### Priority 1: Critical Issues

1. **Chinese Calendar Year Boundary** (Medium Priority)
   - Dates near Chinese New Year showing wrong year
   - Needs fix in `fromJDN()` function
   - See `CHINESE_CALENDAR_ISSUES.md`

2. **Chinese Calendar Leap Month** (Medium Priority)
   - Leap months not detected/encoded correctly
   - Needs fix in `calculateChineseYear()` function
   - See `CHINESE_CALENDAR_ISSUES.md`

### Priority 2: Research Needed

3. **Julian Epoch Discrepancy** (Low Priority)
   - 2-day difference in epoch JDN
   - Research needed to determine correct value
   - See `JULIAN_EPOCH_RESEARCH.md`

### Priority 3: Verification Needed

4. **Mayan Long Count Encoding** (Medium Priority)
   - Encoding scheme needs comprehensive verification
   - Create test cases with all 5 components
   - See `MAYAN_LONG_COUNT_VERIFICATION.md`

5. **Cherokee Cultural Verification** (Low Priority)
   - Expert consultation needed
   - Questions prepared, awaiting response
   - See `CHEROKEE_CALENDAR_EXPERT_QUESTIONS.md`

---

## Acceptable Approximations

The following approximations are documented and acceptable:

1. **Chinese Calendar**: Astronomical calculations use approximations for efficiency
2. **Baháʼí Calendar**: Intercalary day calculations use approximations
3. **Iroquois Calendar**: Lunar calculations use approximations
4. **All Calendars**: Some precision may be lost for dates very far from epoch

These approximations are:
- Documented in code and documentation
- Acceptable for general use
- May be improved in future versions

---

## Verification Commands

Test calendar accuracy using:

```bash
# Epoch verification
npm run test:epochs

# Chinese calendar verification
npm run test:chinese

# Full calendar accuracy tests
npm run test:calendars
```

---

## Reporting Issues

If you discover calendar accuracy issues:

1. Note the calendar system and date
2. Compare with authoritative sources
3. Check if it's a documented limitation
4. Report with:
   - Calendar system
   - Date in question
   - Expected vs. actual result
   - Source of expected result

---

## Future Improvements

### Planned Fixes
- Chinese calendar year boundary detection
- Chinese calendar leap month detection
- Julian epoch research and correction

### Planned Enhancements
- Improved astronomical calculations (optional high-precision mode)
- Enhanced cultural calendar accuracy
- Additional calendar systems

### Research Areas
- Traditional Iroquois calendar implementation
- Cherokee calendar traditional usage
- Month name orthography verification

---

## Conclusion

CalenRecall's calendar implementations are:
- **76% fully verified** (13/17 calendars)
- **24% need additional work** (4 calendars)
- **All limitations documented** and transparent
- **All approximations acceptable** for general use

The calendar systems are suitable for:
- ✅ General journaling
- ✅ Historical research (with noted limitations)
- ✅ Cultural and religious date tracking
- ✅ Multi-calendar date conversion

Not recommended for:
- ⚠️ High-precision astronomical calculations (use specialized tools)
- ⚠️ Critical historical research without verification
- ⚠️ Legal or official date requirements (verify with authoritative sources)

---

**For detailed technical information**, see:
- `CALENDAR_AUTHENTICITY_AUDIT.md` - Complete audit findings
- `AUDIT_FINAL_REPORT.md` - Executive summary
- `AUDIT_NEXT_STEPS.md` - Action items and priorities

**Last Updated**: December 2024  
**Version**: 2025.12.05.5

