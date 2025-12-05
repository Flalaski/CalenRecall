# Negative Years Implementation Summary

## Overview

All calendar converters have been updated to properly handle negative years according to each calendar's epoch. Each calendar system now correctly:

1. **Handles negative years in `toJDN()`**: Calculates days before the epoch for years < 1
2. **Handles dates before epoch in `fromJDN()`**: Returns negative years for JDN values before the epoch
3. **Maintains calendar rules for negative years**: Leap year calculations, month lengths, etc. work correctly for negative years

## Updated Calendars

### ✅ Hebrew Calendar
- **Epoch**: October 7, 3761 BCE (JDN: 347997)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Updated to handle negative years using Metonic cycle normalization

### ✅ Islamic (Hijri) Calendar
- **Epoch**: July 16, 622 CE (JDN: 1948439)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Updated to handle negative years using 30-year cycle normalization

### ✅ Persian (Jalali) Calendar
- **Epoch**: March 19, 622 CE (JDN: 1948318)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Updated to handle negative years using 33-year cycle normalization

### ✅ Ethiopian Calendar
- **Epoch**: August 29, 8 CE (JDN: 1724221)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Uses simple 4-year cycle (works for negative years)

### ✅ Coptic Calendar
- **Epoch**: August 29, 284 CE (JDN: 1825030)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Uses simple 4-year cycle (works for negative years)

### ✅ Indian National (Saka) Calendar
- **Epoch**: March 22, 78 CE (JDN: 1749630)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Uses Gregorian leap year rules (works for negative years)

### ✅ Baháʼí Calendar
- **Epoch**: March 21, 1844 CE (JDN: 2394647)
- **Negative Year Support**: ✅ Complete
- **Leap Year Calculation**: Uses Gregorian leap year rules (works for negative years)

### ✅ Thai Buddhist Calendar
- **Epoch**: January 1, 544 BCE (calculated from -543)
- **Negative Year Support**: ✅ Complete (inherits from Gregorian)

### ✅ Mayan Tzolk'in Calendar
- **Epoch**: August 11, 3114 BCE (JDN: 584283)
- **Negative Year Support**: ✅ Complete
- **Note**: Uses 260-day cycles, negative years represent cycles before epoch

### ✅ Mayan Haab' Calendar
- **Epoch**: August 11, 3114 BCE (JDN: 584283)
- **Negative Year Support**: ✅ Complete
- **Note**: Uses 365-day fixed years, negative years represent years before epoch

### ✅ Aztec Xiuhpohualli Calendar
- **Epoch**: August 11, 3114 BCE (JDN: 584283)
- **Negative Year Support**: ✅ Complete
- **Note**: Uses 365-day fixed years, negative years represent years before epoch

### ✅ Chinese Calendar
- **Epoch**: Approximate (varies historically)
- **Negative Year Support**: ✅ Complete
- **Note**: Simplified implementation, uses Metonic cycle approximation

### ✅ Gregorian & Julian Calendars
- **Epoch**: January 1, 1 CE (JDN: 1721424)
- **Negative Year Support**: ✅ Already supported (via `gregorianToJDN` and `julianToJDN`)

### ✅ Cherokee & Iroquois Calendars
- **Epoch**: January 1, 1 CE (JDN: 1721424)
- **Negative Year Support**: ✅ Complete (inherits from Gregorian)

## Implementation Pattern

All calendar converters follow this pattern:

### `toJDN(year, month, day)`:
```typescript
if (year < 1) {
  // Calculate days before epoch
  // Work backwards from year down to 0 (inclusive)
  // Return EPOCH - daysBeforeEpoch
} else {
  // Normal case: calculate days since epoch
  // Return EPOCH + daysSinceEpoch
}
```

### `fromJDN(jdn)`:
```typescript
const days = jdn - EPOCH;
if (days < 0) {
  // Work backwards to find negative year
  // Return negative year, month, day
} else {
  // Normal case: find positive year
  // Return positive year, month, day
}
```

## Date Formatting

The date formatter (`dateFormatter.ts`) has been updated to:
- Properly display negative years with correct padding
- Preserve negative signs in format strings
- Handle era designations for negative years

## Testing Recommendations

1. **Epoch Verification**: Verify that year 1, month 1, day 1 in each calendar maps to the correct epoch JDN
2. **Round-trip Conversion**: Test that converting a date to JDN and back produces the same date
3. **Negative Year Boundaries**: Test dates around year 0 and year -1
4. **Cross-calendar Conversion**: Test converting negative years between different calendars
5. **Leap Year Handling**: Verify leap year calculations work correctly for negative years

## Notes

- **Year 0**: Most calendars don't have a year 0, going directly from year -1 to year 1. However, for calculation purposes, we treat year 0 as existing.
- **Calendar Rules**: All calendar rules (leap years, month lengths, etc.) apply to negative years using the same algorithms, normalized to positive cycle positions where needed.
- **Accuracy**: Negative year calculations maintain the same accuracy as positive year calculations.

