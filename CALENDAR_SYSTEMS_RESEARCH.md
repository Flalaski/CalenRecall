# Calendar Systems Research & Integration Plan

## Executive Summary

This document provides comprehensive research on Earth's cultural calendar systems that could be integrated into CalenRecall as synchronized alternatives. The goal is to enable users to view and enter dates in their preferred calendar system while maintaining accurate database synchronization across all calendars.

## Core Principle: Julian Day Number (JDN) as Universal Reference

**Recommendation**: Use Julian Day Number (JDN) as the universal internal storage format. JDN is a continuous count of days since January 1, 4713 BCE (proleptic Julian calendar), providing a unique, unambiguous reference point for all calendar systems.

### Benefits:
- Single source of truth for date storage
- Eliminates ambiguity in date conversions
- Supports dates far into past and future
- Standard in astronomy and historical research
- Enables accurate bidirectional conversion between any calendars

## Major Calendar Systems

### 1. Solar Calendars (Based on Solar Year)

#### **Gregorian Calendar** (Current Default)
- **Structure**: 365/366 days, 12 months
- **Leap Year Rule**: Every 4 years, except century years unless divisible by 400
- **Era**: AD/CE (Anno Domini/Common Era)
- **Status**: ✅ Currently implemented
- **Integration**: Already in use as primary calendar

#### **Julian Calendar**
- **Structure**: 365/366 days, 12 months
- **Leap Year Rule**: Every 4 years (simpler than Gregorian)
- **Era**: AD/CE
- **Historical Use**: Used from 45 BCE to 1582 CE
- **Integration Priority**: High (historical accuracy)
- **Conversion**: Well-established algorithms

#### **Persian (Solar Hijri / Jalali) Calendar**
- **Structure**: 12 months (first 6 have 31 days, next 5 have 30, last has 29/30)
- **New Year**: Nowruz (vernal equinox, ~March 20-21)
- **Era**: Starts 622 CE (Hijra)
- **Accuracy**: Highly accurate, based on astronomical observations
- **Usage**: Iran, Afghanistan
- **Integration Priority**: High (major cultural calendar)
- **Conversion**: Requires precise equinox calculations

#### **Ethiopian Calendar**
- **Structure**: 13 months (12 months of 30 days + 1 month of 5/6 days)
- **New Year**: Enkutatash (September 11/12)
- **Era**: ~7-8 years behind Gregorian
- **Usage**: Ethiopia, Eritrea
- **Integration Priority**: Medium
- **Conversion**: Straightforward offset calculation

#### **Coptic Calendar**
- **Structure**: Similar to Ethiopian (13 months)
- **Era**: Starts 284 CE (Era of Martyrs)
- **Usage**: Coptic Orthodox Church
- **Integration Priority**: Medium
- **Conversion**: Similar to Ethiopian

#### **Indian National Calendar (Saka Samvat)**
- **Structure**: 12 months, solar-based
- **New Year**: Chaitra 1 (around March 22)
- **Era**: Starts 78 CE
- **Usage**: Official calendar in India (alongside Gregorian)
- **Integration Priority**: High (major population)
- **Conversion**: Well-documented algorithms

#### **Baháʼí Calendar**
- **Structure**: 19 months of 19 days + 4-5 intercalary days = 365/366 days
- **New Year**: Vernal equinox (March 20-21)
- **Era**: Starts 1844 CE (Baháʼí Era)
- **Usage**: Baháʼí Faith worldwide
- **Integration Priority**: Medium
- **Conversion**: Requires equinox calculation

### 2. Lunar Calendars (Based on Lunar Months)

#### **Islamic (Hijri) Calendar**
- **Structure**: 12 lunar months (29-30 days each) = 354/355 days
- **New Year**: Muharram 1
- **Era**: Starts 622 CE (Hijra)
- **Drift**: ~11 days earlier each year relative to solar calendars
- **Usage**: Muslim communities worldwide
- **Integration Priority**: Very High (1.8+ billion people)
- **Conversion**: Complex due to lunar observation variations
- **Note**: Some regions use astronomical calculations, others use actual moon sighting

#### **Umm al-Qura Calendar**
- **Structure**: Variant of Islamic calendar
- **Usage**: Saudi Arabia (official)
- **Integration Priority**: Medium (specific variant)
- **Conversion**: Similar to Hijri with regional variations

### 3. Lunisolar Calendars (Combine Lunar Months with Solar Years)

#### **Hebrew (Jewish) Calendar**
- **Structure**: 12-13 months (leap years add Adar II)
- **New Year**: Rosh Hashanah (Tishrei 1, Sept-Oct)
- **Era**: Starts 3761 BCE (Anno Mundi)
- **Leap Year Cycle**: 19-year Metonic cycle
- **Usage**: Jewish communities worldwide
- **Integration Priority**: Very High (major cultural calendar)
- **Conversion**: Complex but well-documented algorithms

#### **Chinese Calendar**
- **Structure**: 12-13 lunar months, 60-year cycle (Ganzhi)
- **New Year**: Chinese New Year (varies Jan 21 - Feb 20)
- **Era**: Multiple eras (currently using Common Era)
- **Usage**: China, Taiwan, diaspora communities
- **Integration Priority**: Very High (1.4+ billion people)
- **Conversion**: Complex due to astronomical calculations
- **Note**: Uses solar terms (24 jieqi) for agricultural timing

#### **Hindu Calendars** (Multiple Systems)
- **Vikram Samvat**: Lunar calendar, starts 57 BCE
- **Shaka Samvat**: Solar calendar, starts 78 CE
- **Bengali Calendar**: Solar, used in Bangladesh/West Bengal
- **Tamil Calendar**: Solar, used in Tamil Nadu
- **Usage**: India, Nepal, diaspora
- **Integration Priority**: High (major population)
- **Conversion**: Multiple systems require separate handling

#### **Buddhist Calendars**
- **Thai Buddhist Calendar**: Gregorian + 543 years
- **Burmese Calendar**: Lunisolar
- **Sri Lankan Calendar**: Lunisolar
- **Usage**: Southeast Asia
- **Integration Priority**: Medium
- **Conversion**: Varies by country

### 4. Unique/Ancient Calendar Systems

#### **Mayan Calendars**
- **Tzolk'in**: 260-day ritual cycle (20 periods × 13 days)
- **Haab'**: 365-day solar calendar (18 months × 20 days + 5 days)
- **Long Count**: Linear count of days from August 11, 3114 BCE
- **Usage**: Historical/ceremonial (some modern Maya communities)
- **Integration Priority**: Low-Medium (cultural/historical interest)
- **Conversion**: Well-documented but specialized

#### **Celtic Calendar** (Coligny Calendar)
- **Structure**: Lunisolar, months divided into "bright" and "dark" fortnights
- **New Year**: Samhain (around November 1)
- **Usage**: Historical/reconstructionist
- **Integration Priority**: Low (historical interest)
- **Conversion**: Complex, based on archaeological reconstruction

#### **Yoruba Calendar**
- **Structure**: 4-day week (deities) + 7-day week (business), 13 months
- **New Year**: Ifá festival (last moon of May/first moon of June)
- **Usage**: Yoruba people (Nigeria, Benin)
- **Integration Priority**: Low-Medium
- **Conversion**: Complex dual-week system

#### **Borana Calendar**
- **Structure**: Lunar-stellar, 12 months of 29.5 days
- **Usage**: Borana Oromo (Ethiopia, Kenya)
- **Integration Priority**: Low
- **Conversion**: Requires stellar observations

## Integration Strategy

### Phase 1: Core Infrastructure (High Priority)

1. **Implement JDN Conversion System**
   - Create `julianDayUtils.ts` with JDN conversion functions
   - Convert between JDN and Gregorian dates
   - Store dates internally as JDN in database

2. **Database Schema Enhancement**
   ```sql
   -- Add calendar system preference
   ALTER TABLE preferences ADD COLUMN default_calendar TEXT DEFAULT 'gregorian';
   
   -- Add calendar metadata to entries (optional, for display)
   -- Dates still stored as JDN internally
   ```

3. **Core Calendar Systems (Phase 1)**
   - ✅ Gregorian (already implemented)
   - Islamic (Hijri) - Very High Priority
   - Hebrew (Jewish) - Very High Priority
   - Chinese - Very High Priority
   - Persian (Jalali) - High Priority

### Phase 2: Additional Major Calendars

4. **Solar Calendars**
   - Julian (historical accuracy)
   - Ethiopian
   - Indian National (Saka)
   - Coptic

5. **Regional Calendars**
   - Thai Buddhist
   - Various Hindu calendars
   - Baháʼí

### Phase 3: Specialized/Historical Calendars

6. **Historical/Alternative**
   - Mayan calendars
   - Celtic calendar
   - Other cultural calendars

## Technical Implementation

### 1. Date Storage Architecture

**Current**: Dates stored as ISO strings (YYYY-MM-DD) in TEXT field
**Proposed**: Dual storage system

```typescript
interface JournalEntry {
  id?: number;
  // Primary storage: JDN (Julian Day Number) - universal reference
  jdn: number;  // e.g., 2460000
  
  // Display date in user's preferred calendar (computed/cached)
  date: string; // ISO date string (YYYY-MM-DD or -YYYY-MM-DD)
  
  // Calendar system used for display
  displayCalendar?: CalendarSystem;
  
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day';
  // ... rest of fields
}

type CalendarSystem = 
  | 'gregorian'
  | 'julian'
  | 'islamic'      // Hijri
  | 'hebrew'       // Jewish
  | 'persian'      // Jalali/Solar Hijri
  | 'chinese'
  | 'ethiopian'
  | 'coptic'
  | 'indian-saka'
  | 'bahai'
  | 'thai-buddhist'
  | 'mayan-tzolkin'
  | 'mayan-haab'
  | 'mayan-longcount';
```

### 2. Conversion Library Structure

```
src/utils/calendars/
├── julianDayUtils.ts      # Core JDN conversion
├── gregorian.ts           # Gregorian calendar (already exists)
├── julian.ts              # Julian calendar
├── islamic.ts             # Islamic/Hijri calendar
├── hebrew.ts              # Hebrew/Jewish calendar
├── persian.ts             # Persian/Jalali calendar
├── chinese.ts             # Chinese calendar
├── ethiopian.ts           # Ethiopian calendar
├── coptic.ts              # Coptic calendar
├── indian.ts              # Indian calendars
├── bahai.ts               # Baháʼí calendar
├── mayan.ts               # Mayan calendars
└── calendarConverter.ts   # Main conversion interface
```

### 3. Conversion Interface

```typescript
// Universal conversion through JDN
function convertDate(
  date: Date | number,  // Date object or JDN
  fromCalendar: CalendarSystem,
  toCalendar: CalendarSystem
): Date | number {
  // Convert to JDN first
  const jdn = toJDN(date, fromCalendar);
  // Then convert from JDN to target calendar
  return fromJDN(jdn, toCalendar);
}

// Calendar-specific conversion functions
function gregorianToJDN(year: number, month: number, day: number): number
function jdnToGregorian(jdn: number): { year: number; month: number; day: number }
function islamicToJDN(year: number, month: number, day: number): number
function jdnToIslamic(jdn: number): { year: number; month: number; day: number }
// ... etc for each calendar
```

### 4. User Interface Integration

- **Calendar Selector**: Dropdown in preferences to choose default calendar
- **Date Display**: Show dates in selected calendar format
- **Date Input**: Accept dates in selected calendar format
- **Multi-Calendar View**: Optional view showing same date in multiple calendars
- **Calendar Info**: Show calendar name, era, and year in UI

## Recommended Libraries & Resources

### JavaScript/TypeScript Libraries

1. **moment-jalaali** - Persian calendar support
2. **moment-hijri** - Islamic calendar support
3. **@hebcal/core** - Hebrew calendar (comprehensive)
4. **chinese-calendar** - Chinese calendar conversion
5. **julian-day** - JDN calculations

### Reference Implementations

1. **Rosetta Calendar** (rosettacalendar.com) - Multi-calendar display
2. **Calendar Converter** (freewww.com) - 11 calendar systems
3. **HuTime** (hutime.org) - Calendar conversion tools and data

### Algorithm Sources

1. **"Calendrical Calculations"** by Dershowitz & Reingold (book)
2. **Astronomical Algorithms** by Jean Meeus (book)
3. **US Naval Observatory** - Calendar conversion algorithms
4. **ICU (International Components for Unicode)** - Calendar implementations

## Implementation Challenges

### 1. Lunar Calendar Variations
- **Problem**: Some Islamic communities use actual moon sighting vs. calculated
- **Solution**: Support both modes, allow user preference

### 2. Astronomical Events
- **Problem**: Some calendars depend on equinoxes/solstices (Persian, Baháʼí)
- **Solution**: Use precise astronomical calculations or lookup tables

### 3. Regional Variations
- **Problem**: Same calendar system may have regional differences
- **Solution**: Support variants (e.g., Umm al-Qura vs. standard Hijri)

### 4. Historical Accuracy
- **Problem**: Calendar reforms and transitions (Julian → Gregorian)
- **Solution**: Support both calendars with transition dates

### 5. Performance
- **Problem**: Complex calculations for some calendars
- **Solution**: Cache conversions, use lookup tables where possible

## Database Migration Strategy

### Step 1: Add JDN Column
```sql
ALTER TABLE journal_entries ADD COLUMN jdn INTEGER;
-- Calculate JDN for existing dates
UPDATE journal_entries SET jdn = gregorian_to_jdn(date);
```

### Step 2: Make JDN Primary Date Storage
```sql
-- Keep date column for backward compatibility (computed from JDN)
-- JDN becomes source of truth
```

### Step 3: Add Calendar Preferences
```sql
ALTER TABLE preferences ADD COLUMN default_calendar TEXT DEFAULT 'gregorian';
ALTER TABLE preferences ADD COLUMN show_multiple_calendars BOOLEAN DEFAULT 0;
```

## Priority Ranking for Implementation

### Tier 1: Very High Priority (Major Global Calendars)
1. ✅ Gregorian (implemented)
2. Islamic (Hijri) - 1.8+ billion users
3. Hebrew (Jewish) - Major cultural calendar
4. Chinese - 1.4+ billion users
5. Persian (Jalali) - Major regional calendar

### Tier 2: High Priority (Significant Populations)
6. Julian - Historical accuracy
7. Indian National (Saka) - 1.3+ billion users
8. Ethiopian - Regional importance
9. Thai Buddhist - Regional importance

### Tier 3: Medium Priority (Cultural/Regional)
10. Coptic - Religious calendar
11. Baháʼí - Religious calendar
12. Various Hindu calendars - Regional importance

### Tier 4: Low Priority (Historical/Specialized)
13. Mayan calendars - Historical/cultural interest
14. Celtic calendar - Historical interest
15. Other specialized calendars

## Testing Requirements

1. **Conversion Accuracy**: Test conversions against known reference dates
2. **Bidirectional**: Ensure A→B→A conversions return to original date
3. **Edge Cases**: Leap years, month boundaries, era transitions
4. **Performance**: Conversion speed for bulk operations
5. **Cultural Accuracy**: Verify with native calendar users

## Next Steps

1. **Research Phase**: Review existing calendar conversion libraries
2. **Prototype**: Implement JDN system and one additional calendar (Islamic recommended)
3. **Database Design**: Finalize schema changes
4. **UI Design**: Design calendar selector and display formats
5. **Implementation**: Phase 1 calendars (Islamic, Hebrew, Chinese, Persian)
6. **Testing**: Comprehensive conversion testing
7. **Documentation**: User guide for calendar features

## References

- Rosetta Calendar: https://rosettacalendar.com/
- Calendar Converter: https://www.freewww.com/apps/calendarconverter/
- HuTime: https://www.hutime.org/basicdata/calendar/
- Dershowitz & Reingold: "Calendrical Calculations" (4th ed.)
- Jean Meeus: "Astronomical Algorithms"
- Wikipedia: Individual calendar system articles
- ICU (International Components for Unicode): Calendar implementations

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: Research Complete - Ready for Implementation Planning

