import { JournalEntry, TimeRange } from '../types';
import { parseISODate, formatDate, getWeekStart, createDate } from './dateUtils';

/** Day-of-week type used for weekStartsOn parameter */
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Optimized entry lookup structures for fast O(1) lookups
 * instead of O(n) filtering operations
 */
export interface EntryLookup {
  // Day entries indexed by date string (YYYY-MM-DD)
  byDateString: Map<string, JournalEntry[]>;
  // Month entries indexed by "YYYY-MM"
  byMonth: Map<string, JournalEntry[]>;
  // Year entries indexed by year number
  byYear: Map<number, JournalEntry[]>;
  // Week entries indexed by week start date string
  byWeekStart: Map<string, JournalEntry[]>;
  // Decade entries indexed by decade start year
  byDecade: Map<number, JournalEntry[]>;
  // All entries with time information, indexed by date string
  byDateWithTime: Map<string, JournalEntry[]>;
  // DAY entries indexed by year (for O(1) year lookup instead of scanning all dates)
  byDayForYear: Map<number, JournalEntry[]>;
  // DAY entries indexed by YYYY-MM (for O(1) month lookup instead of scanning all dates)
  byDayForMonth: Map<string, JournalEntry[]>;
  // WEEK entries indexed by year (for O(1) year lookup instead of scanning all week starts)
  byWeekForYear: Map<number, JournalEntry[]>;
  // Set of date strings that have any entry
  hasEntryDates: Set<string>;
  // Set of month strings (YYYY-MM) that have month entries
  hasMonthEntryMonths: Set<string>;
  // Set of years that have year entries
  hasYearEntryYears: Set<number>;
  // Set of week start strings that have week entries
  hasWeekEntryWeeks: Set<string>;
  // Set of decades that have decade entries
  hasDecadeEntryDecades: Set<number>;
}

/**
 * Build optimized lookup structures from entries
 * This is O(n) once, then lookups are O(1)
 * 
 * OPTIMIZED for thousands of entries:
 * - Uses entry.date string directly (already ISO format) instead of parsing/reformatting
 * - Only parses dates when necessary (for week calculations)
 * - Pre-allocates arrays to reduce memory allocations
 */
export function buildEntryLookup(entries: JournalEntry[], weekStartsOn: WeekStartDay = 0): EntryLookup {
  const lookup: EntryLookup = {
    byDateString: new Map(),
    byMonth: new Map(),
    byYear: new Map(),
    byWeekStart: new Map(),
    byDecade: new Map(),
    byDateWithTime: new Map(),
    byDayForYear: new Map(),
    byDayForMonth: new Map(),
    byWeekForYear: new Map(),
    hasEntryDates: new Set(),
    hasMonthEntryMonths: new Set(),
    hasYearEntryYears: new Set(),
    hasWeekEntryWeeks: new Set(),
    hasDecadeEntryDecades: new Set(),
  };

  // Cache for parsed dates to avoid re-parsing the same date string
  const dateCache = new Map<string, Date>();
  
  // Helper to get or parse date (with caching)
  const getCachedDate = (dateStr: string): Date => {
    if (!dateCache.has(dateStr)) {
      dateCache.set(dateStr, parseISODate(dateStr));
    }
    return dateCache.get(dateStr)!;
  };

  // Pre-allocate arrays for common date strings to reduce allocations
  // Process entries in batches to optimize memory usage
  for (const entry of entries) {
    // Use entry.date directly (it's already in ISO format YYYY-MM-DD)
    const dateStr = entry.date;
    
    // Extract year and month from date string for faster processing
    // Format: YYYY-MM-DD or -YYYY-MM-DD
    const isNegative = dateStr.startsWith('-');
    const cleanDateStr = isNegative ? dateStr.substring(1) : dateStr;
    const [yearStr, monthStr] = cleanDateStr.split('-');
    const entryYear = isNegative ? -parseInt(yearStr, 10) : parseInt(yearStr, 10);
    const monthKey = `${entryYear}-${monthStr}`;
    const decadeStart = Math.floor(entryYear / 10) * 10;

    switch (entry.timeRange) {
      case 'day': {
        // Index by date string (use entry.date directly - already formatted)
        let dayEntries = lookup.byDateString.get(dateStr);
        if (!dayEntries) {
          dayEntries = [];
          lookup.byDateString.set(dateStr, dayEntries);
        }
        dayEntries.push(entry);
        lookup.hasEntryDates.add(dateStr);

        // Index by year for O(1) year lookups
        let dayByYear = lookup.byDayForYear.get(entryYear);
        if (!dayByYear) {
          dayByYear = [];
          lookup.byDayForYear.set(entryYear, dayByYear);
        }
        dayByYear.push(entry);

        // Index by month key for O(1) month lookups
        let dayByMonth = lookup.byDayForMonth.get(monthKey);
        if (!dayByMonth) {
          dayByMonth = [];
          lookup.byDayForMonth.set(monthKey, dayByMonth);
        }
        dayByMonth.push(entry);

        // Track entries with time
        if (entry.hour !== undefined && entry.hour !== null) {
          let timeEntries = lookup.byDateWithTime.get(dateStr);
          if (!timeEntries) {
            timeEntries = [];
            lookup.byDateWithTime.set(dateStr, timeEntries);
          }
          timeEntries.push(entry);
        }
        break;
      }
      case 'week': {
        // Only parse date for week calculations (needed for week start calculation)
        const entryDate = getCachedDate(dateStr);
        const weekStart = getWeekStart(entryDate, weekStartsOn);
        const weekKey = formatDate(weekStart);
        let weekEntries = lookup.byWeekStart.get(weekKey);
        if (!weekEntries) {
          weekEntries = [];
          lookup.byWeekStart.set(weekKey, weekEntries);
        }
        weekEntries.push(entry);
        lookup.hasWeekEntryWeeks.add(weekKey);

        // Index by year for O(1) year lookups (week belongs to its start-date year)
        const weekYear = weekStart.getFullYear();
        let weekByYear = lookup.byWeekForYear.get(weekYear);
        if (!weekByYear) {
          weekByYear = [];
          lookup.byWeekForYear.set(weekYear, weekByYear);
        }
        weekByYear.push(entry);
        break;
      }
      case 'month': {
        let monthEntries = lookup.byMonth.get(monthKey);
        if (!monthEntries) {
          monthEntries = [];
          lookup.byMonth.set(monthKey, monthEntries);
        }
        monthEntries.push(entry);
        lookup.hasMonthEntryMonths.add(monthKey);
        break;
      }
      case 'year': {
        let yearEntries = lookup.byYear.get(entryYear);
        if (!yearEntries) {
          yearEntries = [];
          lookup.byYear.set(entryYear, yearEntries);
        }
        yearEntries.push(entry);
        lookup.hasYearEntryYears.add(entryYear);
        break;
      }
      case 'decade': {
        let decadeEntries = lookup.byDecade.get(decadeStart);
        if (!decadeEntries) {
          decadeEntries = [];
          lookup.byDecade.set(decadeStart, decadeEntries);
        }
        decadeEntries.push(entry);
        lookup.hasDecadeEntryDecades.add(decadeStart);
        break;
      }
    }
  }

  return lookup;
}

/**
 * Check if a date has any entries (optimized O(1) lookup)
 */
export function hasEntryForDateOptimized(
  lookup: EntryLookup,
  date: Date,
  weekStartsOn: WeekStartDay = 0
): boolean {
  const dateStr = formatDate(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const decadeStart = Math.floor(year / 10) * 10;
  const weekStart = getWeekStart(date, weekStartsOn);
  const weekKey = formatDate(weekStart);

  // Check day entries
  if (lookup.hasEntryDates.has(dateStr)) {
    return true;
  }

  // Check week entries
  if (lookup.hasWeekEntryWeeks.has(weekKey)) {
    return true;
  }

  // Check month entries
  if (lookup.hasMonthEntryMonths.has(monthKey)) {
    return true;
  }

  // Check year entries
  if (lookup.hasYearEntryYears.has(year)) {
    return true;
  }

  // Check decade entries
  if (lookup.hasDecadeEntryDecades.has(decadeStart)) {
    return true;
  }

  return false;
}

/**
 * Get entries for a specific date (optimized)
 */
export function getEntriesForDateOptimized(
  lookup: EntryLookup,
  date: Date,
  viewMode: TimeRange,
  _weekStartsOn: WeekStartDay = 0
): JournalEntry[] {
  const dateStr = formatDate(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const results: JournalEntry[] = [];

  switch (viewMode) {
    case 'decade': {
      // Show year entries
      const yearEntries = lookup.byYear.get(year) || [];
      results.push(...yearEntries);
      break;
    }
    case 'year': {
      // Show month entries
      const monthEntries = lookup.byMonth.get(monthKey) || [];
      results.push(...monthEntries);
      break;
    }
    case 'month':
    case 'week':
    case 'day': {
      // Show day entries
      const dayEntries = lookup.byDateString.get(dateStr) || [];
      results.push(...dayEntries);
      break;
    }
  }

  return results;
}

/**
 * Get day entries for a date (optimized)
 */
export function getDayEntriesOptimized(
  lookup: EntryLookup,
  date: Date
): JournalEntry[] {
  const dateStr = formatDate(date);
  return lookup.byDateString.get(dateStr) || [];
}

/**
 * Get entries with time for a date (optimized)
 */
export function getEntriesWithTimeOptimized(
  lookup: EntryLookup,
  date: Date
): JournalEntry[] {
  const dateStr = formatDate(date);
  return lookup.byDateWithTime.get(dateStr) || [];
}

/**
 * Get month entries for a month (optimized)
 */
export function getMonthEntriesOptimized(
  lookup: EntryLookup,
  year: number,
  month: number
): JournalEntry[] {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  return lookup.byMonth.get(monthKey) || [];
}

/**
 * Quick O(1) check if a year has ANY entries across all tiers
 * Much faster than calling getAllEntriesForYearOptimized when you only need existence
 */
export function hasAnyEntriesForYear(
  lookup: EntryLookup,
  year: number,
  excludeDayEntries: boolean = false
): boolean {
  const decadeStart = Math.floor(year / 10) * 10;
  
  // Check decade entries (apply to all years in the decade)
  if (lookup.hasDecadeEntryDecades.has(decadeStart)) return true;
  // Check year entries
  if (lookup.hasYearEntryYears.has(year)) return true;
  // Check month entries for any month in this year
  for (let month = 0; month < 12; month++) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (lookup.hasMonthEntryMonths.has(monthKey)) return true;
  }
  // Check day entries for this year (skip if excludeDayEntries is true)
  if (!excludeDayEntries && lookup.byDayForYear.has(year)) return true;
  // Check week entries for this year (skip if excludeDayEntries is true)
  if (!excludeDayEntries && lookup.byWeekForYear.has(year)) return true;
  
  return false;
}

/**
 * Extract year, month key, and decade start from an entry's date string.
 * Avoids Date parsing for day/month/year/decade entries (uses string splitting).
 * Shared between buildEntryLookup and incremental mutation functions.
 */
function extractEntryDateParts(entry: JournalEntry): { entryYear: number; monthKey: string; decadeStart: number; dateStr: string } {
  const dateStr = entry.date;
  const isNegative = dateStr.startsWith('-');
  const cleanDateStr = isNegative ? dateStr.substring(1) : dateStr;
  const [yearStr, monthStr] = cleanDateStr.split('-');
  const entryYear = isNegative ? -parseInt(yearStr, 10) : parseInt(yearStr, 10);
  const monthKey = `${entryYear}-${monthStr}`;
  const decadeStart = Math.floor(entryYear / 10) * 10;
  return { entryYear, monthKey, decadeStart, dateStr };
}

/**
 * Add a single entry to an existing EntryLookup in-place (O(1)).
 * Avoids full O(n) rebuild when adding one entry.
 * Mutates the lookup directly — caller should trigger React re-render via setState.
 */
export function addEntryToLookup(
  lookup: EntryLookup,
  entry: JournalEntry,
  weekStartsOn: WeekStartDay = 0
): void {
  const { entryYear, monthKey, decadeStart, dateStr } = extractEntryDateParts(entry);

  switch (entry.timeRange) {
    case 'day': {
      // Index by date string
      let dayEntries = lookup.byDateString.get(dateStr);
      if (!dayEntries) {
        dayEntries = [];
        lookup.byDateString.set(dateStr, dayEntries);
      }
      dayEntries.push(entry);
      lookup.hasEntryDates.add(dateStr);

      // Index by year
      let dayByYear = lookup.byDayForYear.get(entryYear);
      if (!dayByYear) {
        dayByYear = [];
        lookup.byDayForYear.set(entryYear, dayByYear);
      }
      dayByYear.push(entry);

      // Index by month key
      let dayByMonth = lookup.byDayForMonth.get(monthKey);
      if (!dayByMonth) {
        dayByMonth = [];
        lookup.byDayForMonth.set(monthKey, dayByMonth);
      }
      dayByMonth.push(entry);

      // Track entries with time
      if (entry.hour !== undefined && entry.hour !== null) {
        let timeEntries = lookup.byDateWithTime.get(dateStr);
        if (!timeEntries) {
          timeEntries = [];
          lookup.byDateWithTime.set(dateStr, timeEntries);
        }
        timeEntries.push(entry);
      }
      break;
    }
    case 'week': {
      const entryDate = parseISODate(dateStr);
      const weekStart = getWeekStart(entryDate, weekStartsOn);
      const weekKey = formatDate(weekStart);
      let weekEntries = lookup.byWeekStart.get(weekKey);
      if (!weekEntries) {
        weekEntries = [];
        lookup.byWeekStart.set(weekKey, weekEntries);
      }
      weekEntries.push(entry);
      lookup.hasWeekEntryWeeks.add(weekKey);

      // Index by year
      const weekYear = weekStart.getFullYear();
      let weekByYear = lookup.byWeekForYear.get(weekYear);
      if (!weekByYear) {
        weekByYear = [];
        lookup.byWeekForYear.set(weekYear, weekByYear);
      }
      weekByYear.push(entry);
      break;
    }
    case 'month': {
      let monthEntries = lookup.byMonth.get(monthKey);
      if (!monthEntries) {
        monthEntries = [];
        lookup.byMonth.set(monthKey, monthEntries);
      }
      monthEntries.push(entry);
      lookup.hasMonthEntryMonths.add(monthKey);
      break;
    }
    case 'year': {
      let yearEntries = lookup.byYear.get(entryYear);
      if (!yearEntries) {
        yearEntries = [];
        lookup.byYear.set(entryYear, yearEntries);
      }
      yearEntries.push(entry);
      lookup.hasYearEntryYears.add(entryYear);
      break;
    }
    case 'decade': {
      let decadeEntries = lookup.byDecade.get(decadeStart);
      if (!decadeEntries) {
        decadeEntries = [];
        lookup.byDecade.set(decadeStart, decadeEntries);
      }
      decadeEntries.push(entry);
      lookup.hasDecadeEntryDecades.add(decadeStart);
      break;
    }
  }
}

/**
 * Remove an entry by ID from a specific keyed bucket. Returns true if found.
 * Cleans up empty buckets (and their companion Set key when provided).
 */
function removeByIdFromBucket<K>(
  map: Map<K, JournalEntry[]>,
  key: K,
  entryId: number,
  companionSet?: Set<K>
): boolean {
  const arr = map.get(key);
  if (!arr) return false;
  const idx = arr.findIndex(e => e.id === entryId);
  if (idx === -1) return false;
  arr.splice(idx, 1);
  if (arr.length === 0) {
    map.delete(key);
    companionSet?.delete(key);
  }
  return true;
}

/**
 * Targeted O(1) removal when the entry object is known — computes the exact
 * bucket keys from the entry instead of scanning every map/key. Returns false
 * if the entry wasn't found where expected (stale hint) so the caller can
 * fall back to the full scan.
 */
function removeEntryTargeted(
  lookup: EntryLookup,
  entry: JournalEntry,
  weekStartsOn: WeekStartDay
): boolean {
  if (entry.id === undefined) return false;
  const entryId = entry.id;
  const { entryYear, monthKey, decadeStart, dateStr } = extractEntryDateParts(entry);
  switch (entry.timeRange) {
    case 'day': {
      if (!removeByIdFromBucket(lookup.byDateString, dateStr, entryId, lookup.hasEntryDates)) return false;
      removeByIdFromBucket(lookup.byDayForYear, entryYear, entryId);
      removeByIdFromBucket(lookup.byDayForMonth, monthKey, entryId);
      removeByIdFromBucket(lookup.byDateWithTime, dateStr, entryId);
      return true;
    }
    case 'week': {
      const weekStart = getWeekStart(parseISODate(dateStr), weekStartsOn);
      if (!removeByIdFromBucket(lookup.byWeekStart, formatDate(weekStart), entryId, lookup.hasWeekEntryWeeks)) return false;
      removeByIdFromBucket(lookup.byWeekForYear, weekStart.getFullYear(), entryId);
      return true;
    }
    case 'month':
      return removeByIdFromBucket(lookup.byMonth, monthKey, entryId, lookup.hasMonthEntryMonths);
    case 'year':
      return removeByIdFromBucket(lookup.byYear, entryYear, entryId, lookup.hasYearEntryYears);
    case 'decade':
      return removeByIdFromBucket(lookup.byDecade, decadeStart, entryId, lookup.hasDecadeEntryDecades);
    default:
      return false;
  }
}

/**
 * Remove a single entry from an existing EntryLookup.
 * FAST PATH: when `entryHint` is provided (the entry object being removed),
 * its exact bucket keys are computed and removal is O(1). Without a hint —
 * or if the hint is stale — falls back to scanning all Maps/Sets (O(n)).
 * If a Map key becomes empty after removal, the key is cleaned up.
 */
export function removeEntryFromLookup(
  lookup: EntryLookup,
  entryId: number,
  entryHint?: JournalEntry,
  weekStartsOn: WeekStartDay = 0
): void {
  // Targeted O(1) removal when the entry object is known
  if (entryHint && entryHint.id === entryId) {
    if (removeEntryTargeted(lookup, entryHint, weekStartsOn)) return;
    // Hint was stale (entry not in expected buckets) — fall through to scan
  }

  // Helper to remove entry by ID from an array, return true if found
  const removeFromArray = (arr: JournalEntry[]): boolean => {
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx !== -1) {
      arr.splice(idx, 1);
      return true;
    }
    return false;
  };

  // Helper to remove entry from a Map<string, JournalEntry[]>
  const removeFromStringMap = (map: Map<string, JournalEntry[]>, sets?: Set<string>): boolean => {
    for (const [key, arr] of map.entries()) {
      if (removeFromArray(arr)) {
        if (arr.length === 0) {
          map.delete(key);
          sets?.delete(key);
        }
        return true;
      }
    }
    return false;
  };

  // Helper to remove entry from a Map<number, JournalEntry[]>
  const removeFromNumberMap = (map: Map<number, JournalEntry[]>, sets?: Set<number>): boolean => {
    for (const [key, arr] of map.entries()) {
      if (removeFromArray(arr)) {
        if (arr.length === 0) {
          map.delete(key);
          sets?.delete(key);
        }
        return true;
      }
    }
    return false;
  };

  // Search through all indexed Maps — returns true once found (single entry has one timeRange)
  if (removeFromStringMap(lookup.byDateString, lookup.hasEntryDates)) return;
  if (removeFromStringMap(lookup.byDateWithTime)) return;
  if (removeFromStringMap(lookup.byMonth, lookup.hasMonthEntryMonths)) return;
  if (removeFromStringMap(lookup.byWeekStart, lookup.hasWeekEntryWeeks)) return;
  if (removeFromNumberMap(lookup.byYear, lookup.hasYearEntryYears)) return;
  if (removeFromNumberMap(lookup.byDecade, lookup.hasDecadeEntryDecades)) return;
  // Also remove from year-indexed day/week maps
  if (removeFromNumberMap(lookup.byDayForYear)) return;
  if (removeFromStringMap(lookup.byDayForMonth)) return;
  if (removeFromNumberMap(lookup.byWeekForYear)) return;
}

/**
 * Update an entry in the lookup (remove old + add new).
 * More efficient than full rebuild when editing a single entry.
 * Passes the old entry as a removal hint so the removal is targeted O(1)
 * instead of a full-map scan.
 */
export function updateEntryInLookup(
  lookup: EntryLookup,
  oldEntry: JournalEntry,
  newEntry: JournalEntry,
  weekStartsOn: WeekStartDay = 0
): void {
  if (oldEntry.id !== undefined) {
    removeEntryFromLookup(lookup, oldEntry.id, oldEntry, weekStartsOn);
  }
  addEntryToLookup(lookup, newEntry, weekStartsOn);
}

/**
 * Get all entries for a year (including day, week, month, year, and decade entries)
 * OPTIMIZED: Uses lookup structure instead of O(n) filtering
 * 
 * @param excludeDayEntries - If true, skip loading day entries (useful for decade/year views)
 */
export function getAllEntriesForYearOptimized(
  lookup: EntryLookup,
  year: number,
  weekStartsOn: WeekStartDay = 0,
  excludeDayEntries: boolean = false
): JournalEntry[] {
  const results: JournalEntry[] = [];
  const decadeStart = Math.floor(year / 10) * 10;

  // Add year entries
  const yearEntries = lookup.byYear.get(year);
  if (yearEntries) {
    results.push(...yearEntries);
  }

  // Add decade entries
  const decadeEntries = lookup.byDecade.get(decadeStart);
  if (decadeEntries) {
    results.push(...decadeEntries);
  }

  // Add month entries for this year
  for (let month = 0; month < 12; month++) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthEntries = lookup.byMonth.get(monthKey);
    if (monthEntries) {
      results.push(...monthEntries);
    }
  }

  // Add day entries for this year via O(1) year-indexed map (instead of scanning all dates)
  if (!excludeDayEntries) {
    const dayEntries = lookup.byDayForYear.get(year);
    if (dayEntries) {
      results.push(...dayEntries);
    }
  }

  // Add week entries for this year via O(1) year-indexed map (instead of scanning all week starts)
  const weekEntries = lookup.byWeekForYear.get(year);
  if (weekEntries) {
    results.push(...weekEntries);
  }

  // CORRECTNESS: a week starting in late December of the previous year can
  // overlap the first days of this year — byWeekForYear attributes it to its
  // start year, so check that single candidate week explicitly (O(1)).
  if (lookup.byWeekStart.size > 0) {
    const jan1WeekStart = getWeekStart(createDate(year, 0, 1), weekStartsOn);
    if (jan1WeekStart.getFullYear() < year) {
      const crossYearWeekEntries = lookup.byWeekStart.get(formatDate(jan1WeekStart));
      if (crossYearWeekEntries) {
        results.push(...crossYearWeekEntries);
      }
    }
  }

  return results;
}

/**
 * Get all entries for a month (including day, week, month, year, and decade entries)
 * OPTIMIZED: Uses lookup structure instead of O(n) filtering
 */
export function getAllEntriesForMonthOptimized(
  lookup: EntryLookup,
  year: number,
  month: number,
  weekStartsOn: WeekStartDay = 0
): JournalEntry[] {
  const results: JournalEntry[] = [];
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const decadeStart = Math.floor(year / 10) * 10;

  // Add month entries
  const monthEntries = lookup.byMonth.get(monthKey);
  if (monthEntries) {
    results.push(...monthEntries);
  }

  // Add year entries (apply to all months in the year)
  const yearEntries = lookup.byYear.get(year);
  if (yearEntries) {
    results.push(...yearEntries);
  }

  // Add decade entries (apply to all years in the decade)
  const decadeEntries = lookup.byDecade.get(decadeStart);
  if (decadeEntries) {
    results.push(...decadeEntries);
  }

  // Add day entries for this month via O(1) month-indexed map (instead of scanning all dates)
  const dayEntries = lookup.byDayForMonth.get(monthKey);
  if (dayEntries) {
    results.push(...dayEntries);
  }

  // Add week entries that overlap with this month
  // OPTIMIZATION: Derive the ≤6 candidate week-start keys directly (a month
  // overlaps at most 6 weeks) instead of scanning EVERY week key in the
  // dataset with a Date parse per key — previously O(total weeks) per month,
  // ×12 per year-view computation. Each candidate is one O(1) Map lookup.
  // CORRECTNESS FIX: also catches weeks starting in late December of the
  // previous year that overlap this month — the old year-scoped scan skipped
  // them (`weekYear !== year`), so their entries never appeared in January.
  if (lookup.byWeekStart.size > 0) {
    // createDate is century-safe (plain `new Date(50, 0, 1)` maps year 50 → 1950)
    const monthStart = createDate(year, month, 1);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); // roll back to the last day of `month`
    const cursor = getWeekStart(monthStart, weekStartsOn);
    while (cursor <= monthEnd) {
      const weekEntryList = lookup.byWeekStart.get(formatDate(cursor));
      if (weekEntryList) {
        results.push(...weekEntryList);
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return results;
}

/**
 * Filter entries by date range using lookup structure
 * OPTIMIZED: More efficient than O(n) filtering for large entry sets
 * 
 * Note: For very large ranges, this may still need to iterate through many entries.
 * For best performance, use this only when the range is reasonably small (e.g., a month or year).
 * 
 * @param excludeDayEntries - If true, skip loading day entries (useful for decade/year views)
 */
export function filterEntriesByDateRangeOptimized(
  lookup: EntryLookup,
  startDate: Date,
  endDate: Date,
  _weekStartsOn: WeekStartDay = 0,
  excludeDayEntries: boolean = false
): JournalEntry[] {
  const results: JournalEntry[] = [];
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();

  // Helper to check if a date string is in range
  const isInRange = (dateStr: string): boolean => {
    return dateStr >= startDateStr && dateStr <= endDateStr;
  };

  // Add day entries in range (skip if excludeDayEntries is true)
  if (!excludeDayEntries) {
    for (const [dateStr, entries] of lookup.byDateString.entries()) {
      if (isInRange(dateStr)) {
        results.push(...entries);
      }
    }
  }

  // Add week entries that overlap with range
  for (const [weekKey, entries] of lookup.byWeekStart.entries()) {
    const weekStart = parseISODate(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    if (weekStart <= endDate && weekEnd >= startDate) {
      results.push(...entries);
    }
  }

  // Add month entries that overlap with range
  for (let year = startYear; year <= endYear; year++) {
    const startMonthForYear = year === startYear ? startMonth : 0;
    const endMonthForYear = year === endYear ? endMonth : 11;

    for (let month = startMonthForYear; month <= endMonthForYear; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthEntries = lookup.byMonth.get(monthKey);
      if (monthEntries) {
        results.push(...monthEntries);
      }
    }
  }

  // Add year entries in range
  for (let year = startYear; year <= endYear; year++) {
    const yearEntries = lookup.byYear.get(year);
    if (yearEntries) {
      results.push(...yearEntries);
    }
  }

  // Add decade entries that overlap with range
  const startDecade = Math.floor(startYear / 10) * 10;
  const endDecade = Math.floor(endYear / 10) * 10;
  for (let decade = startDecade; decade <= endDecade; decade += 10) {
    const decadeEntries = lookup.byDecade.get(decade);
    if (decadeEntries) {
      results.push(...decadeEntries);
    }
  }

  return results;
}
