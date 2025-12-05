# Calendar Audit - Next Steps Guide

**Date**: December 2024  
**Purpose**: Clear guide for next steps after comprehensive audit

## Current Status

✅ **Audit Complete**: All 17 calendars systematically reviewed  
✅ **Documentation Complete**: Comprehensive findings documented  
✅ **Tools Created**: Verification scripts ready to use  
⚠️ **Issues Identified**: Specific problems documented with fix strategies

## Immediate Next Steps

### Priority 1: Fix Chinese Calendar Issues

**Status**: Issues identified, ready to fix  
**Test Command**: `npm run test:chinese`

#### Issue 1.1: Year Boundary Detection
- **Problem**: Dates near Chinese New Year showing wrong year
- **Location**: `src/utils/calendars/chinese.ts` - `fromJDN()` function
- **Fix Strategy**: Review year determination logic, improve New Year transition handling
- **Documentation**: `_MD BIN/CHINESE_CALENDAR_ISSUES.md`

#### Issue 1.2: Leap Month Detection
- **Problem**: Leap months not detected/encoded correctly
- **Location**: `src/utils/calendars/chinese.ts` - `calculateChineseYear()` function
- **Fix Strategy**: Review solar term logic, verify leap month encoding
- **Documentation**: `_MD BIN/CHINESE_CALENDAR_ISSUES.md`

**After Fixes**: Re-run `npm run test:chinese` to verify improvements

---

### Priority 2: Research Julian Epoch Discrepancy

**Status**: Research plan created  
**Issue**: 2-day difference in epoch JDN  
**Documentation**: `_MD BIN/JULIAN_EPOCH_RESEARCH.md`

**Research Questions**:
1. Which is correct: JDN 1721424 or 1721426 for January 1, 1 CE?
2. Should Julian and Gregorian match at year 1 CE?
3. Is the formula constant (-32083) correct?

**Resources to Check**:
- "Calendrical Calculations" by Dershowitz & Reingold
- "Astronomical Algorithms" by Jean Meeus
- US Naval Observatory calculations
- Other calendar conversion libraries

---

### Priority 3: Cultural Verification

#### Cherokee Calendar
**Status**: Expert questions prepared  
**Documentation**: `_MD BIN/CHEROKEE_CALENDAR_EXPERT_QUESTIONS.md`

**Action Items**:
1. Contact Cherokee cultural resources
2. Send prepared questions
3. Review feedback
4. Update implementation if needed

**Potential Contacts**:
- Cherokee Nation Cultural Resource Center
- Museum of the Cherokee Indian
- Academic experts in Cherokee culture

#### Iroquois Calendar
**Status**: Research needed  
**Action Items**:
1. Research traditional Iroquois calendar implementation
2. Determine if approximation is acceptable
3. Consider lunar calculation improvements
4. Document findings

---

### Priority 4: Additional Verification

#### Mayan Long Count Encoding
**Status**: Verification plan created  
**Documentation**: `_MD BIN/MAYAN_LONG_COUNT_VERIFICATION.md`

**Action Items**:
1. Create test cases with all 5 components
2. Verify encoding scheme works correctly
3. Test formatting and parsing
4. Document encoding scheme clearly

#### Month Name Verification
**Action Items**:
1. Verify spelling/orthography for all calendars
2. Check native script representations
3. Verify transliteration accuracy
4. Update documentation

---

## Verification Commands

### Run All Tests
```bash
# Epoch verification
npm run test:epochs

# Chinese calendar verification
npm run test:chinese

# Full calendar accuracy tests
npm run test:calendars
```

### After Making Fixes
1. Run relevant test command
2. Review test results
3. Fix any new issues
4. Re-run tests until all pass
5. Update documentation

---

## Documentation Reference

### Core Audit Documents
- `CALENDAR_AUTHENTICITY_AUDIT.md` - Complete findings (17 calendars)
- `CALENDAR_AUDIT_ACTION_PLAN.md` - Action items
- `AUDIT_FINAL_REPORT.md` - Executive summary

### Chinese Calendar
- `CHINESE_CALENDAR_REFERENCE_DATES.md` - Reference dates
- `CHINESE_CALENDAR_TEST_RESULTS.md` - Test results
- `CHINESE_CALENDAR_ISSUES.md` - Issue analysis

### Research Documents
- `JULIAN_EPOCH_RESEARCH.md` - Julian epoch research plan
- `CHEROKEE_CALENDAR_EXPERT_QUESTIONS.md` - Expert questions
- `MAYAN_LONG_COUNT_VERIFICATION.md` - Verification plan

---

## Recommended Workflow

### For Fixing Issues
1. Read issue documentation
2. Review relevant code
3. Understand the problem
4. Make incremental fixes
5. Test after each fix
6. Document changes

### For Research Tasks
1. Review research document
2. Consult authoritative sources
3. Document findings
4. Make recommendations
5. Update implementation if needed

### For Cultural Verification
1. Review prepared questions
2. Contact experts
3. Document feedback
4. Update implementation carefully
5. Respect cultural sensitivity

---

## Progress Tracking

### Completed ✅
- [x] Comprehensive audit of all 17 calendars
- [x] Epoch verification script and tests
- [x] Chinese calendar test script
- [x] Complete documentation
- [x] Issue identification

### In Progress ⏳
- [ ] Chinese calendar fixes
- [ ] Julian epoch research
- [ ] Leap month detection fix

### Pending 📋
- [ ] Cherokee expert consultation
- [ ] Mayan Long Count verification
- [ ] Iroquois calendar research
- [ ] Month name verification

---

## Success Criteria

### Chinese Calendar
- ✅ All 40 tests passing
- ✅ Year boundaries correct
- ✅ Leap months detected correctly
- ✅ Round-trip conversions working

### Julian Epoch
- ✅ Correct JDN verified
- ✅ Documentation updated
- ✅ Formula validated

### Cultural Verification
- ✅ Expert feedback received
- ✅ Implementation updated (if needed)
- ✅ Cultural sensitivity maintained

---

## Notes

- Take incremental "baby steps" approach
- Test after each change
- Document all findings
- Maintain cultural sensitivity
- Verify before confirming correctness

---

**Last Updated**: December 2024  
**Status**: Ready for next phase of work

