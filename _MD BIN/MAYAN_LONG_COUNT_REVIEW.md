# Mayan Long Count Calendar Implementation Review

## Status: ⚠️ PARTIAL IMPLEMENTATION - NEEDS COMPLETION

### Current Implementation

The Mayan Long Count calendar (`src/utils/calendars/mayanLongCount.ts`) provides basic functionality but has limitations.

#### Current Features
- ✅ Basic Long Count structure (baktun, katun, tun, uinal, kin)
- ✅ Epoch correctly set (August 11, 3114 BCE, JDN 584283 - GMT correlation)
- ✅ Conversion functions (toJDN, fromJDN)
- ✅ Parsing and formatting functions

#### Limitations

##### 1. **Incomplete Component Storage**
- **Issue**: The `CalendarDate` interface (year/month/day) doesn't fully represent all 5 Long Count components
- **Current**: Stores baktun as year, katun as month, tun as day
- **Missing**: Uinal and kin components default to 0
- **Impact**: Cannot represent full Long Count dates accurately

##### 2. **Negative Date Handling**
- **Issue**: Comment mentions "simplified approach" for negative dates
- **Current**: Uses negative values for components before epoch
- **Concern**: Long Count positional notation may not handle negatives correctly
- **Impact**: Dates before epoch may not be culturally accurate

##### 3. **Formatting Limitations**
- **Issue**: Format function always outputs uinal and kin as 0
- **Current**: `formatDate()` returns `baktun.katun.tun.0.0`
- **Impact**: Cannot display full Long Count dates

### Long Count Structure

The Mayan Long Count uses a positional notation system:
- **Baktun**: 144,000 days (20 katuns)
- **Katun**: 7,200 days (20 tuns)
- **Tun**: 360 days (18 uinals)
- **Uinal**: 20 days
- **Kin**: 1 day

**Epoch**: August 11, 3114 BCE (GMT correlation, JDN 584283)

### Required Improvements

#### 1. **Full Component Support**

**Option A: Extend CalendarDate Interface**
- Add optional fields for uinal and kin
- Modify all calendar converters to handle extended format
- **Pros**: Accurate representation
- **Cons**: Requires changes to core types

**Option B: Use Extended Format String**
- Store full Long Count in a special format string
- Parse/format functions handle full representation
- **Pros**: No core type changes
- **Cons**: Less integrated with other calendars

**Option C: Store Days Since Epoch**
- Store total days since epoch internally
- Convert to/from Long Count for display
- **Pros**: Simple internal representation
- **Cons**: Requires conversion for every operation

**Recommendation**: Option C (store days, convert for display) - simplest and most accurate

#### 2. **Accurate Negative Date Handling**

Long Count dates before epoch require careful handling:
- Long Count uses positional notation (no negative numbers)
- Dates before epoch should be represented differently
- May need to use a different epoch or notation system

**Research Needed**:
- How did the Maya represent dates before the epoch?
- Are there historical examples of pre-epoch dates?
- Should we use a different representation?

#### 3. **Complete Formatting**

- Support full Long Count notation: `baktun.katun.tun.uinal.kin`
- Handle all 5 components correctly
- Support different formatting styles

#### 4. **Validation**

- Validate Long Count components (e.g., uinal < 18, kin < 20)
- Handle overflow correctly (e.g., 20 kin = 1 uinal)
- Validate date ranges

### Implementation Plan

#### Phase 1: Internal Representation
- [ ] Store days since epoch internally
- [ ] Convert to Long Count components for display
- [ ] Convert from Long Count components for input

#### Phase 2: Full Component Support
- [ ] Update `toJDN()` to accept all 5 components
- [ ] Update `fromJDN()` to return all 5 components
- [ ] Update `parseDate()` to parse full Long Count notation
- [ ] Update `formatDate()` to display all components

#### Phase 3: Negative Date Handling
- [ ] Research pre-epoch date representation
- [ ] Implement appropriate handling
- [ ] Test with historical dates

#### Phase 4: Validation and Testing
- [ ] Add component validation
- [ ] Test round-trip conversions
- [ ] Test edge cases (epoch boundaries, component overflow)
- [ ] Verify against authoritative sources

### Code Structure

#### Recommended Changes

```typescript
// Store days since epoch internally
toJDN(baktun: number, katun: number, tun: number, uinal: number, kin: number): number {
  const daysSinceEpoch = longCountToDays(baktun, katun, tun, uinal, kin);
  return MAYAN_EPOCH + daysSinceEpoch;
}

fromJDN(jdn: number): { baktun: number; katun: number; tun: number; uinal: number; kin: number } {
  const daysSinceEpoch = jdn - MAYAN_EPOCH;
  return daysToLongCount(daysSinceEpoch);
}

// For CalendarDate interface compatibility
// Use year=baktun, month=katun, day=tun
// Store uinal and kin separately or in extended format
```

### Cultural Considerations

- ✅ Epoch uses correct GMT correlation (JDN 584283)
- ✅ Long Count structure is accurate
- ⚠️ Need to verify negative date handling is culturally appropriate
- ⚠️ Need to ensure component representation is accurate

### Testing Strategy

#### Test Cases
1. **Epoch Date**: August 11, 3114 BCE = 0.0.0.0.0
2. **Known Dates**: 
   - December 21, 2012 = 13.0.0.0.0 (end of 13th baktun)
   - Current date Long Count representation
3. **Component Overflow**: 
   - 20 kin = 1 uinal
   - 18 uinal = 1 tun
   - etc.
4. **Round-Trip**: Long Count → JDN → Long Count

### References

- Dershowitz & Reingold, "Calendrical Calculations", Chapter 12
- Thompson, J. Eric S., "Maya Hieroglyphic Writing"
- Lounsbury, Floyd G., "Maya Numeration, Computation, and Calendrical Astronomy"
- GMT correlation constant: JDN 584283

## Conclusion

**Status**: ⚠️ **PARTIAL IMPLEMENTATION - NEEDS COMPLETION**

The implementation provides basic functionality but needs:
1. Full support for all 5 Long Count components
2. Proper handling of negative dates (pre-epoch)
3. Complete formatting and parsing
4. Validation and testing

**Priority**: Medium (functional but incomplete)

