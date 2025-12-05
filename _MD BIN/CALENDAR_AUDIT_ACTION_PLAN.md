# Calendar Audit Action Plan

**Date**: December 2024  
**Status**: Audit Complete - Action Items Identified

## Overview

Following the comprehensive calendar authenticity audit, this document outlines specific action items and verification tasks for calendars requiring additional work.

## Priority 1: High Priority Actions

### 1. Chinese Calendar Accuracy Verification ⚠️
**Status**: ✅ Test Script Created - Ready for Execution

**Action Items**:
- [x] Create test cases with known Chinese calendar dates from authoritative sources
- [x] Verify Chinese New Year dates for multiple years (2020-2024)
- [x] Verify intercalary (leap) month placements
- [x] Create comprehensive test script
- [x] Document reference dates
- [ ] **Run verification tests** (`npm run test:chinese`)
- [ ] Review test results and fix any discrepancies
- [ ] Compare with authoritative sources (e.g., Hong Kong Observatory, astronomical almanacs)
- [ ] Verify 60-year sexagenary cycle implementation (if applicable)

**Test Cases Created**:
- ✅ Chinese New Year dates for 5 recent years (2020-2024)
- ✅ Known intercalary months (2023, 2020, 2017)
- ✅ All 24 solar term (jieqi) dates for 2024
- ✅ Traditional festival dates
- ✅ Round-trip conversion tests

**Files Created**:
- ✅ `_MD BIN/CHINESE_CALENDAR_REFERENCE_DATES.md` - Reference dates
- ✅ `scripts/verify-chinese-calendar.ts` - Test script
- ✅ `_MD BIN/CHINESE_CALENDAR_VERIFICATION_STATUS.md` - Status document

**Resources**:
- Hong Kong Observatory calendar
- "Calendrical Calculations" Chapter 19
- Astronomical almanacs

**Next Step**: Run `npm run test:chinese` to execute verification tests

---

### 2. Cherokee Calendar Cultural Verification ⚠️
**Status**: **REQUIRES CULTURAL EXPERT CONSULTATION**

**Action Items**:
- [ ] Identify Cherokee cultural experts or organizations to contact
- [ ] Prepare questions about:
  - Accuracy of month name mappings to Gregorian months
  - Cultural appropriateness of current implementation
  - Preferred representation of the calendar
  - Historical context and authenticity
- [ ] Document expert feedback
- [ ] Update implementation based on expert guidance (if needed)
- [ ] Add appropriate disclaimers/notes based on findings

**Questions for Experts**:
1. Is the 12-month Gregorian adaptation historically accurate?
2. Are the month name mappings correct?
3. Is this representation culturally respectful and appropriate?
4. What would be the preferred way to represent the Cherokee calendar?

**Contact Options**:
- Cherokee Nation Cultural Resources
- Museum of the Cherokee Indian
- Academic experts in Cherokee culture

---

## Priority 2: Medium Priority Improvements

### 3. Mayan Long Count Encoding Verification ⚠️
**Status**: Encoding scheme needs verification

**Action Items**:
- [ ] Verify that encoding all 5 components (baktun, katun, tun, uinal, kin) in year/month/day fields works correctly
- [ ] Test formatting and parsing with all component values
- [ ] Verify edge cases (maximum values, negative dates)
- [ ] Compare encoding scheme with standard Mayan Long Count representations
- [ ] Document encoding scheme clearly in code comments
- [ ] Test round-trip conversions for complex Long Count dates

**Test Cases**:
- Classic period dates (e.g., 9.15.0.0.0)
- Modern dates (e.g., 13.0.0.0.0 - end of baktun 2012)
- Maximum/minimum component values
- Negative dates (before epoch)

---

### 4. Iroquois Calendar Lunar Implementation ⚠️
**Status**: Currently uses approximation

**Action Items**:
- [ ] Research authentic Iroquois/Haudenosaunee calendar implementation
- [ ] Determine if actual lunar calculations are needed or if approximation is acceptable
- [ ] Consult cultural resources if available
- [ ] Consider implementing actual lunar cycle calculations if more authentic
- [ ] Document cultural context and implementation approach

**Research Questions**:
- How did the traditional Iroquois calendar work?
- Was it truly based on lunar observations or approximate?
- What is the cultural significance of the 13-moon structure?

---

## Priority 3: Verification Tasks

### 5. Epoch JDN Verification Script
**Action Items**:
- [ ] Create verification script to calculate all epoch JDNs
- [ ] Compare calculated values with documented values
- [ ] Verify against authoritative sources
- [ ] Document any discrepancies

**Epochs to Verify**:
- Gregorian: January 1, 1 CE
- Julian: January 1, 1 CE
- Islamic: July 16, 622 CE (Julian)
- Hebrew: October 7, 3761 BCE (Julian)
- Persian: March 19, 622 CE (Gregorian)
- Ethiopian: August 29, 8 CE (Julian)
- Coptic: August 29, 284 CE (Julian)
- Indian-Saka: March 22, 78 CE (Gregorian)
- Baháʼí: March 21, 1844 CE (Gregorian) - uses vernal equinox
- Thai Buddhist: Year offset +543
- Mayan/Aztec: August 11, 3114 BCE (Gregorian)

---

### 6. Month Name Verification
**Action Items**:
- [ ] Verify spelling/orthography for all calendar month names
- [ ] Check native script representations (Arabic, Hebrew, Chinese, etc.)
- [ ] Verify transliteration accuracy
- [ ] Update documentation with native names

**Calendars to Verify**:
- Islamic (Arabic names)
- Hebrew (Hebrew script)
- Chinese (Chinese characters)
- Persian (Persian script)
- Ethiopian (Ge'ez/Amharic)
- Coptic (Coptic script)
- Indian-Saka (Sanskrit/Hindi)
- All Mayan calendars (orthography)
- Aztec (Nahuatl)

---

### 7. Round-Trip Conversion Testing
**Action Items**:
- [ ] Create comprehensive round-trip test suite
- [ ] Test conversions: Calendar A → JDN → Calendar B → JDN → Calendar A
- [ ] Verify exact round-trips (where applicable)
- [ ] Document acceptable tolerances for approximations
- [ ] Test edge cases (leap years, epoch boundaries, negative years)

---

## Priority 4: Documentation Improvements

### 8. Algorithm Documentation
**Action Items**:
- [ ] Document algorithms used for each calendar
- [ ] Cite authoritative sources
- [ ] Document approximations and their reasons
- [ ] Add references to "Calendrical Calculations" where applicable
- [ ] Document cultural considerations

---

### 9. Known Reference Dates Database
**Action Items**:
- [ ] Compile known reference dates from authoritative sources
- [ ] Create test database of verified dates
- [ ] Include dates for all calendars
- [ ] Document sources for each reference date
- [ ] Use for ongoing verification

---

## Implementation Notes

### Approximation Acceptability

Some calendars intentionally use approximations:
- **Islamic Calendar**: Arithmetic 30-year cycle is widely accepted standard (though astronomical observation is traditional)
- **Persian Calendar**: 33-year arithmetic cycle is common approximation (though astronomical equinox is more accurate)
- **Hebrew Calendar**: Simplified year length heuristic is acceptable for most purposes (full molad calculation is complex)
- **Iroquois Calendar**: Approximation may be acceptable depending on traditional usage

### Cultural Sensitivity

- All implementations should respect cultural significance
- Consult experts when possible
- Document cultural context clearly
- Be transparent about approximations

---

## Progress Tracking

**Completed**:
- ✅ Comprehensive audit of all 17 calendars
- ✅ Documentation of all findings
- ✅ Identification of action items

**In Progress**:
- ⏳ Creating verification scripts
- ⏳ Researching reference dates

**Pending**:
- ⏳ Chinese calendar verification
- ⏳ Cherokee calendar expert consultation
- ⏳ Mayan Long Count encoding verification
- ⏳ Iroquois calendar research

---

## Timeline Recommendations

1. **Immediate** (Next Session):
   - Create epoch verification script
   - Begin Chinese calendar reference date collection
   - Draft questions for Cherokee calendar experts

2. **Short-term** (Next Week):
   - Complete Chinese calendar verification
   - Contact Cherokee cultural resources
   - Verify Mayan Long Count encoding

3. **Medium-term** (Next Month):
   - Complete cultural consultations
   - Implement any needed improvements
   - Create comprehensive test suite

4. **Ongoing**:
   - Monitor calendar accuracy
   - Update documentation as needed
   - Maintain reference date database

---

## References

- "Calendrical Calculations: The Ultimate Edition" by Dershowitz & Reingold
- "Astronomical Algorithms" by Jean Meeus
- US Naval Observatory Astronomical Applications
- Various cultural and academic resources (to be identified)

---

**Last Updated**: December 2024

