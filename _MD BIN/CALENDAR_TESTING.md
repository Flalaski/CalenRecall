# Calendar Accuracy Testing

This document describes the comprehensive test suite for verifying the accuracy and alignment of all calendar systems in CalenRecall.

## Overview

The calendar tester (`scripts/test-calendar-accuracy.ts`) performs comprehensive validation of all 17 calendar systems to ensure:

1. **JDN Consistency**: Converting a date to JDN and back produces the same date
2. **Cross-Calendar Alignment**: The same JDN produces equivalent dates in different calendars
3. **Round-Trip Conversions**: Converting A → B → A returns to the original date
4. **Known Reference Dates**: Historical dates convert correctly
5. **Era Designations**: Negative years show BCE, positive years show correct era
6. **Formatting and Parsing**: Dates can be formatted and parsed correctly
7. **Edge Cases**: Leap years, epoch boundaries, extreme dates

## Running the Tests

### Prerequisites

The test suite requires TypeScript compilation. Ensure you have the project dependencies installed:

```bash
npm install
```

### Run Tests

```bash
npm run test:calendars
```

This will:
1. Compile the TypeScript test file
2. Execute all test suites
3. Display a summary of passed/failed tests

### Manual Execution

If you prefer to run the tests manually:

```bash
# Compile TypeScript
tsc scripts/test-calendar-accuracy.ts --outDir scripts --module commonjs --target ES2020 --esModuleInterop --skipLibCheck

# Run the compiled JavaScript
node scripts/test-calendar-accuracy.js
```

## Test Suites

### 1. JDN Consistency Test

Verifies that converting a date to Julian Day Number (JDN) and back produces the same date. This is the fundamental test for calendar accuracy.

**Test Cases:**
- Various dates across different years (1, 100, 1000, 2024)
- Leap year dates (February 29)
- Negative years (year 0, -100)
- Epoch boundaries

**Tolerance:** 1 day for approximations (especially lunisolar calendars)

### 2. Cross-Calendar Alignment Test

Verifies that the same JDN produces equivalent dates when converted to different calendars. This ensures all calendars are synchronized.

**Reference Dates Tested:**
- Gregorian Epoch (January 1, 1 CE)
- Islamic Epoch (July 16, 622 CE)
- Hebrew Epoch (October 7, 3761 BCE)
- Persian Epoch (March 19, 622 CE)
- Mayan Epoch (August 11, 3114 BCE)
- Modern dates (2024)
- Leap year dates
- Negative year dates

**Tolerance:** 1-2 days for lunisolar calendars (Chinese, Hebrew)

### 3. Round-Trip Conversion Test

Converts dates through multiple calendars and back to the original, verifying that the conversion chain is consistent.

**Test Pattern:** A → B → A

**Test Dates:**
- Modern dates (2024)
- Historical dates (100 CE)
- Negative years (0, -100 BCE)

### 4. Known Reference Dates Test

Validates that known historical dates have the correct JDN values.

**Reference Dates:**
- Gregorian Epoch: JDN 1721426
- Islamic Epoch: JDN 1948439
- Hebrew Epoch: JDN 347997
- Persian Epoch: JDN 1948318
- Mayan Epoch: JDN 584283
- Modern Date (2024-01-01): JDN 2460106

### 5. Era Designation Test

Verifies that:
- Negative years (≤ 0) display "BCE"
- Positive years (≥ 1) display the calendar's era name (CE, AH, AM, etc.)

**Test Cases:**
- Year -100: Should show "BCE"
- Year 0: Should show "BCE"
- Year 1: Should show "CE" (for Gregorian)
- Year 622: Should show "CE" (for Gregorian)

### 6. Formatting and Parsing Test

Tests that dates can be:
- Formatted to strings correctly
- Parsed back from strings
- Round-trip through format/parse cycle

**Format Tested:** `YYYY-MM-DD`

### 7. Edge Cases Test

Tests special scenarios:
- **Leap Years**: February 29 in leap and non-leap years
- **Century Leap Years**: 2000 (leap) vs 1900 (not leap in Gregorian)
- **Epoch Boundaries**: Dates at calendar epochs
- **Extreme Dates**: Very old and very future dates

## Expected Results

### All Tests Should Pass

The test suite is designed to validate that all calendar systems are:
- **Accurate**: Dates convert correctly
- **Synchronized**: Same JDN = same date across calendars
- **Consistent**: Round-trip conversions work
- **Complete**: All calendars handle edge cases

### Known Tolerances

Some calendars use approximations and may have small tolerances:

- **Lunisolar Calendars** (Chinese, Hebrew): ±1-2 days tolerance
  - These calendars require astronomical calculations for exact accuracy
  - The current implementation uses Metonic cycle approximations

- **Mayan Calendars**: Exact (based on fixed cycles)

- **Solar Calendars** (Gregorian, Julian, Persian, etc.): Exact (within 1 day)

## Interpreting Results

### Passed Tests (✓)

All tests passed - the calendar system is functioning correctly.

### Failed Tests (✗)

Failed tests indicate potential issues:

1. **JDN Mismatch**: The calendar converter may have a bug in `toJDN` or `fromJDN`
2. **Cross-Calendar Misalignment**: Calendars may not be properly synchronized
3. **Round-Trip Failure**: Conversion logic may be incorrect
4. **Era Designation Error**: Date formatter may not be handling negative years correctly

### Common Issues

1. **Leap Year Calculations**: Verify leap year rules are correct
2. **Epoch Dates**: Ensure epoch JDNs are accurate
3. **Negative Year Handling**: Check astronomical vs. historical year numbering
4. **Month/Day Validation**: Ensure month and day ranges are correct

## Adding New Tests

To add new test cases:

1. **Add Reference Dates**: Update `REFERENCE_DATES` array with known dates
2. **Add Test Cases**: Add specific test cases to relevant test methods
3. **Add Edge Cases**: Include new edge cases in `testEdgeCases()`

Example:

```typescript
const newReferenceDate: ReferenceDate = {
  name: 'Historical Event',
  gregorian: { year: 1066, month: 10, day: 14 },
  jdn: 2110703, // Calculate using gregorianToJDN
  description: 'Battle of Hastings'
};
```

## Maintenance

### When to Run Tests

- After implementing a new calendar
- After modifying calendar conversion logic
- After fixing calendar-related bugs
- Before releasing a new version

### Updating Reference Dates

If you discover more accurate JDN values for reference dates, update the `REFERENCE_DATES` array in the test file.

## Future Enhancements

Potential improvements to the test suite:

1. **Performance Testing**: Measure conversion speed
2. **Stress Testing**: Test with very large date ranges
3. **Visualization**: Generate charts showing calendar alignment
4. **Regression Testing**: Compare results across versions
5. **External Validation**: Compare against known calendar conversion libraries

## References

- **Julian Day Number**: Astronomical standard for date conversion
- **Calendrical Calculations**: Dershowitz & Reingold (reference for algorithms)
- **GMT Correlation**: Goodman-Martinez-Thompson correlation for Mayan calendars

