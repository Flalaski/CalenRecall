# Chinese Calendar Implementation Plan

## Current Status: Approximation-Based Implementation

### Current Approximations

The current Chinese calendar implementation (`src/utils/calendars/chinese.ts`) uses several approximations that do not accurately represent the traditional Chinese lunisolar calendar:

#### 1. **Lunar Month Approximation**
- **Current**: Alternates between 29 and 30 days based on month parity
- **Reality**: Lunar months vary in length (29-30 days) based on actual new moon observations
- **Impact**: Dates can be off by 1-2 days, especially over long periods

#### 2. **Leap Month Determination**
- **Current**: Uses simplified pattern (years 3, 6, 9, 11, 14, 17, 19 in 19-year cycle)
- **Reality**: Leap months are determined by the relationship between lunar months and solar terms (jieqi)
- **Impact**: Leap months may occur in wrong years or wrong positions within the year

#### 3. **Epoch Approximation**
- **Current**: February 5, 1900 CE (approximate start of a Chinese year)
- **Reality**: Chinese New Year dates vary each year based on astronomical calculations
- **Impact**: All dates are offset from actual Chinese calendar dates

#### 4. **Solar Terms (Jieqi)**
- **Current**: Not calculated at all
- **Reality**: 24 solar terms divide the year based on solar longitude (15° intervals)
- **Impact**: Cannot accurately determine leap months or Chinese New Year

#### 5. **New Moon Calculations**
- **Current**: Not calculated
- **Reality**: Lunar months begin at actual new moon (when Moon and Sun have same ecliptic longitude)
- **Impact**: Month boundaries are incorrect

### Cultural Significance

The Chinese calendar is:
- Still actively used for traditional festivals (Chinese New Year, Mid-Autumn Festival, etc.)
- Based on astronomical observations, not arbitrary rules
- Culturally significant - accuracy is important for respecting traditions
- Used for determining auspicious dates and traditional holidays

## Required Implementation

### Phase 1: Astronomical Foundation

#### 1.1 New Moon Calculation
- Implement accurate new moon calculation using:
  - Mean lunar longitude
  - Lunar anomaly
  - Equation of center for the Moon
  - Reference: Meeus "Astronomical Algorithms" Chapter 47-49
- Function: `newMoonJDN(year, month)` - find new moon for a given month
- Function: `nextNewMoon(jdn)` - find next new moon after a given date

#### 1.2 Solar Terms (Jieqi) Calculation
- Implement calculation of 24 solar terms based on solar longitude
- Each term is 15° of solar longitude (360° / 24)
- Terms start at 315° (立春 - Start of Spring)
- Function: `solarTermJDN(year, term)` - find date when a solar term occurs
- Function: `getSolarTerm(jdn)` - get which solar term a date falls in
- **Note**: Partial implementation exists in `astronomicalUtils.ts` but needs refinement

### Phase 2: Chinese Calendar Core Logic

#### 2.1 Chinese New Year Calculation
- Chinese New Year = second new moon after winter solstice
- Winter solstice = solar term 21 (冬至 - Dōngzhì, ~270°)
- Algorithm:
  1. Find winter solstice for year Y (solar term 21)
  2. Find first new moon after winter solstice
  3. Find second new moon after winter solstice
  4. Second new moon = Chinese New Year for year Y+1

#### 2.2 Lunar Month Determination
- Each lunar month begins at a new moon
- Month length = days until next new moon (29 or 30 days)
- Store actual new moon dates for accurate month boundaries

#### 2.3 Leap Month Determination
- A leap month occurs when a lunar month contains no solar term
- Algorithm:
  1. For each lunar month, check which solar terms fall within it
  2. If a month has no solar term, it's a leap month
  3. Leap month takes the number of the previous regular month
  4. Example: If month 6 has no solar term, it becomes leap month 6 (闰六月)

#### 2.4 Year Structure
- Chinese year has 12 or 13 lunar months
- Regular years: 12 months
- Leap years: 13 months (one leap month)
- Year length: ~354 days (regular) or ~384 days (leap year)

### Phase 3: Conversion Functions

#### 3.1 Chinese Date to JDN
- Input: Chinese year, month (with leap indicator), day
- Algorithm:
  1. Find Chinese New Year for the given year
  2. Count lunar months from New Year to target month
  3. Add days within the target month
  4. Return JDN

#### 3.2 JDN to Chinese Date
- Input: JDN
- Algorithm:
  1. Find which Chinese year this JDN falls in (by checking Chinese New Year dates)
  2. Find which lunar month (by checking new moon dates)
  3. Calculate day within month
  4. Determine if month is leap month (check solar terms)

### Phase 4: Data Structures

#### 4.1 Chinese Year Data
```typescript
interface ChineseYear {
  year: number;
  newYearJDN: number;  // Chinese New Year date
  months: ChineseMonth[];
  isLeapYear: boolean;
}

interface ChineseMonth {
  monthNumber: number;  // 1-12
  isLeap: boolean;
  startJDN: number;     // New moon date
  endJDN: number;        // Next new moon date
  length: number;        // Days in month
  solarTerms: number[];  // Solar term numbers in this month
}
```

#### 4.2 Caching Strategy
- Cache calculated Chinese years to avoid recalculation
- Cache new moon dates for common date ranges
- Cache solar term dates for efficiency

## Implementation Steps

### Step 1: Enhance Astronomical Utilities
- [ ] Improve `newMoonJDN()` in `astronomicalUtils.ts` with accurate lunar calculations
- [ ] Refine `solarTermJDN()` to use accurate solar longitude calculations
- [ ] Add `winterSolsticeJDN(year)` function
- [ ] Test astronomical functions against authoritative sources

### Step 2: Implement Chinese New Year Calculation
- [ ] Create `chineseNewYearJDN(year)` function
- [ ] Test against known Chinese New Year dates (e.g., 2020-2030)
- [ ] Verify accuracy against Chinese calendar references

### Step 3: Implement Lunar Month Calculation
- [ ] Create function to calculate all lunar months for a Chinese year
- [ ] Determine month lengths based on actual new moon dates
- [ ] Test month boundaries

### Step 4: Implement Leap Month Logic
- [ ] Create function to determine if a month is a leap month
- [ ] Test leap month placement against known leap years
- [ ] Verify against historical Chinese calendar data

### Step 5: Rewrite Conversion Functions
- [ ] Rewrite `toJDN()` using accurate calculations
- [ ] Rewrite `fromJDN()` using accurate calculations
- [ ] Test round-trip conversions
- [ ] Test edge cases (leap months, year boundaries, negative years)

### Step 6: Testing and Validation
- [ ] Compare with authoritative Chinese calendar sources
- [ ] Test against known dates (Chinese New Year dates, festivals)
- [ ] Verify cultural accuracy
- [ ] Performance testing

## References

1. **Primary Reference**: Dershowitz, Nachum, and Edward Reingold. "Calendrical Calculations: The Ultimate Edition." Cambridge University Press, 2018. Chapter 19.

2. **Astronomical Calculations**: Meeus, Jean. "Astronomical Algorithms." Willmann-Bell, 1998.
   - Chapter 25: Solar Coordinates
   - Chapter 47-49: Lunar Calculations

3. **Chinese Calendar Sources**:
   - Hong Kong Observatory: Chinese Calendar
   - Time and Date: Chinese Calendar
   - Academic papers on Chinese calendar algorithms

## Testing Strategy

### Test Cases
1. **Chinese New Year Dates** (2000-2050)
   - Verify against official Chinese calendar
   - Check leap year patterns

2. **Leap Month Years**
   - Known leap years: 2001, 2004, 2006, 2009, 2012, 2014, 2017, 2020, 2023, 2025, 2028
   - Verify leap month placement

3. **Round-Trip Conversions**
   - Convert Chinese date → JDN → Chinese date
   - Verify accuracy for all dates

4. **Edge Cases**
   - Year boundaries
   - Leap month boundaries
   - Negative years (before epoch)

## Estimated Complexity

- **Astronomical calculations**: Medium complexity
- **Chinese calendar logic**: High complexity (many edge cases)
- **Testing**: Extensive (need authoritative sources)
- **Total effort**: Significant (2-3 weeks of focused work)

## Notes

- This is a complex implementation requiring careful attention to astronomical accuracy
- Cultural sensitivity is paramount - consult Chinese calendar experts if possible
- Consider using established libraries if available (e.g., ChineseLunisolarCalendar libraries)
- Document all approximations and their sources
- Provide clear error messages for invalid dates

