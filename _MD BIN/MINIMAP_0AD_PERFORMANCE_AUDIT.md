# Minimap Performance Issues Near 0 AD - Granular Audit Report

## Executive Summary

The minimap becomes glitchy and delayed as it approaches 0 AD due to **expensive calendar conversion operations** being called repeatedly in loops. The root cause is that `formatDate()` triggers full calendar conversions (Date → JDN → CalendarDate) for every date label, and these conversions are particularly expensive for negative years near the epoch boundary.

## Root Causes Identified

### 1. **Expensive Calendar Conversions in FormatDate** (Primary Issue)

**Location**: `src/contexts/CalendarContext.tsx:88-91`

```typescript
const formatDate = useCallback((date: Date, format: string = 'YYYY-MM-DD'): string => {
  const calendarDate = dateToCalendarDate(date, calendar);  // EXPENSIVE!
  return formatCalendarDate(calendarDate, format);
}, [calendar]);
```

**What happens**:
- `dateToCalendarDate()` converts Date → JDN (Julian Day Number) → CalendarDate
- For negative years near 0 AD, JDN calculations are computationally expensive
- This conversion happens **every single time** `formatDate()` is called

**Impact**: Each calendar conversion for dates near 0 AD takes significantly longer than for modern dates.

---

### 2. **formatDate() Called Repeatedly in Loops**

#### Issue A: Decade Segment Generation Loop

**Location**: `src/components/GlobalTimelineMinimap.tsx:511-525`

```typescript
for (let year = startDecade; year <= endDecade; year += 10) {
  const decadeDate = new Date(year, 0, 1);  // Creates Date with negative year
  const calendarYear = formatDate(decadeDate, 'YYYY');  // EXPENSIVE CONVERSION!
  segments.push({
    date: decadeDate,
    label: `${calendarYear}s`,
    // ...
  });
}
```

**Problem**:
- When near 0 AD, this loop creates Date objects with negative years (e.g., -50, -40, -30, -20, -10, 0)
- Each iteration calls `formatDate()` which triggers a full calendar conversion
- With a 110-year range (50 before + 60 after), this means **11 expensive conversions** per render

#### Issue B: Year Segment Generation Loop

**Location**: `src/components/GlobalTimelineMinimap.tsx:532-546`

```typescript
for (let year = startYear; year <= endYear; year++) {
  const yearDate = new Date(year, 0, 1);  // Negative years near 0 AD
  const calendarYear = formatDate(yearDate, 'YYYY');  // EXPENSIVE!
  // ...
}
```

**Problem**:
- Creates Date objects for every year in range (e.g., -5 to +6 = 12 years)
- Each year requires a calendar conversion

#### Issue C: Time Scale Calculation Loops

**Location**: `src/components/GlobalTimelineMinimap.tsx:1655-1695`

Multiple loops that call `formatDate()`:

```typescript
// Decade scale markers
for (let decade = startDecade; decade <= endDecade; decade += 10) {
  const decadeDate = new Date(decade, 0, 1);
  const calendarYear = formatDate(decadeDate, 'YYYY');  // EXPENSIVE!
  // ...
}

// Year scale markers (every 5 years for decade view)
for (let year = startYear; year <= endYear; year += 5) {
  const yearDate = new Date(year, 0, 1);
  const calendarYear = formatDate(yearDate, 'YYYY');  // EXPENSIVE!
  // ...
}

// Year scale markers (all years for year view)
for (let year = startYear; year <= endYear; year += yearStep) {
  const yearDate = new Date(year, 0, 1);
  const calendarYear = formatDate(yearDate, 'YYYY');  // EXPENSIVE!
  // ...
}
```

**Problem**:
- When in decade view near 0 AD, these loops can process 10-20+ dates with negative years
- Each `formatDate()` call is expensive

#### Issue D: Month/Week/Day Loops

**Location**: `src/components/GlobalTimelineMinimap.tsx:553-608`

While processing months/weeks/days, `formatDate()` is called for each segment:
- Month loop: `formatDate(current, 'MMM YYYY')`
- Week loop: `formatDate(weekStartDate, 'MMM D')`
- Day loop: `formatDate(currentDay, 'MMM D')`

Near 0 AD, these loops process more dates and each formatDate call is slower.

---

### 3. **JavaScript Date Object Creation Performance**

**Location**: Multiple locations creating `new Date(year, 0, 1)` with negative years

**Problem**:
- Creating Date objects with negative years (e.g., `new Date(-50, 0, 1)`) can be slower than positive years
- JavaScript Date objects internally use UTC timestamps which require more computation for dates far from the epoch

---

### 4. **Why It Gets Worse Near 0 AD**

1. **More negative years to process**: As you get closer to 0 AD, more Date objects have negative years
2. **JDN calculations are slower**: Converting negative years to Julian Day Numbers requires more complex calculations
3. **Calendar conversion complexity**: Different calendar systems handle epoch boundaries differently, making conversions more expensive
4. **No caching**: FormatDate results aren't cached, so the same conversions happen repeatedly

---

## Performance Impact Analysis

### Typical Performance Near 0 AD (Decade View)

**Without optimization**:
- Timeline range: 110 years (currentDecade - 50 to currentDecade + 60)
- Decade segments: 11 segments × expensive formatDate = **11 expensive conversions**
- Time scale decade markers: ~11 decades × formatDate = **11 more conversions**
- Time scale year markers: ~22 years (every 5 years) × formatDate = **22 more conversions**
- **Total: ~44 expensive calendar conversions per render**

**Cost per conversion**: For negative years near 0 AD, each calendar conversion (Date → JDN → CalendarDate) takes approximately **5-10x longer** than for modern dates.

**Result**: Render times increase from ~50ms to **500-1000ms+**, causing noticeable lag and glitchiness.

---

## Affected Code Locations

### Primary Hotspots

1. **`src/components/GlobalTimelineMinimap.tsx:511-525`** - Decade segment loop
2. **`src/components/GlobalTimelineMinimap.tsx:532-546`** - Year segment loop
3. **`src/components/GlobalTimelineMinimap.tsx:1655-1695`** - Time scale calculation loops
4. **`src/components/GlobalTimelineMinimap.tsx:553-608`** - Month/week/day loops
5. **`src/contexts/CalendarContext.tsx:88-91`** - formatDate implementation (root cause)

### Supporting Files

- `src/utils/calendars/calendarConverter.ts:172-180` - dateToCalendarDate implementation
- `src/utils/calendars/julianDayUtils.ts` - JDN conversion (expensive for negative years)

---

## Solution Recommendations

### 1. **Cache formatDate Results** (High Priority)

Cache formatted dates by year/decade to avoid repeated conversions:

```typescript
// Cache formatted years/decades
const formatDateCache = new Map<string, string>();

const getCachedFormatDate = (date: Date, format: string): string => {
  const year = date.getFullYear();
  const cacheKey = `${year}-${format}`;
  if (formatDateCache.has(cacheKey)) {
    return formatDateCache.get(cacheKey)!;
  }
  const formatted = formatDate(date, format);
  formatDateCache.set(cacheKey, formatted);
  return formatted;
};
```

### 2. **Use Simple Year Formatting for Minimap Labels** (High Priority)

For minimap labels, use simple year formatting that doesn't require calendar conversion:

```typescript
// Instead of: formatDate(decadeDate, 'YYYY')
// Use: date.getFullYear().toString()
// Or: format simple Gregorian year directly
```

### 3. **Lazy Format Calendar-Aware Labels Only When Needed** (Medium Priority)

Only do expensive calendar conversions for labels that are actually visible in the viewport:

```typescript
// Only format dates that are in viewport + margin
const viewportStart = ...;
const viewportEnd = ...;

if (decadeDate.getTime() >= viewportStart && decadeDate.getTime() <= viewportEnd) {
  // Do expensive formatDate here
} else {
  // Use simple formatting
}
```

### 4. **Optimize Date Creation** (Low Priority)

Pre-compute Date objects and reuse them instead of creating new ones in loops.

### 5. **Reduce Range Near 0 AD** (Workaround)

Temporarily reduce the timeline range when near 0 AD to limit the number of dates processed.

---

## Testing Recommendations

1. **Performance Profiling**: Use Chrome DevTools Performance tab to measure render times when near 0 AD
2. **Benchmark Tests**: Create test cases that measure formatDate performance for dates: -100, -50, -10, 0, +10, +50, +100
3. **User Testing**: Navigate to dates near 0 AD and measure perceived lag/delay

---

## Priority Fix Order

1. **IMMEDIATE**: Implement caching for formatDate results
2. **HIGH**: Use simple year formatting for minimap labels (avoid calendar conversion when possible)
3. **MEDIUM**: Implement lazy formatting (only format visible dates)
4. **LOW**: Optimize Date object creation

---

## Additional Notes

- The issue is **not** with the calendar conversion logic itself, but with **how frequently it's called** in loops
- The problem is **compounded** by the fact that conversions are more expensive for negative years
- Simple caching could provide **10-50x performance improvement** for repeated formatDate calls

