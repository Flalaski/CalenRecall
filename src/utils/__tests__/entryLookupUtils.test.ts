/**
 * Unit tests for entryLookupUtils
 * Tests the O(1) entry lookup map structures and optimized accessors.
 */

import {
  buildEntryLookup,
  hasEntryForDateOptimized,
  getDayEntriesOptimized,
  getEntriesWithTimeOptimized,
  addEntryToLookup,
  removeEntryFromLookup,
  getMonthEntriesOptimized,
  getAllEntriesForYearOptimized,
  hasAnyEntriesForYear,
} from '../entryLookupUtils';
import { JournalEntry } from '../../types';

function createEntry(overrides: Partial<JournalEntry> & { date: string }): JournalEntry {
  return {
    id: Math.floor(Math.random() * 10000),
    timeRange: 'day',
    title: 'Test Entry',
    content: 'Test content',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildEntryLookup', () => {
  it('builds an empty lookup for empty array', () => {
    const lookup = buildEntryLookup([], 0);
    expect(lookup.byDateString.size).toBe(0);
    expect(lookup.byMonth.size).toBe(0);
    expect(lookup.byYear.size).toBe(0);
    expect(lookup.byWeekStart.size).toBe(0);
    expect(lookup.byDecade.size).toBe(0);
    expect(lookup.hasEntryDates.size).toBe(0);
    expect(lookup.hasMonthEntryMonths.size).toBe(0);
    expect(lookup.hasYearEntryYears.size).toBe(0);
  });

  it('indexes a single day entry by date string', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);

    expect(lookup.byDateString.get('2024-01-15')).toHaveLength(1);
    expect(lookup.byDateString.get('2024-01-15')![0].id).toBe(entry.id);
    expect(lookup.hasEntryDates.has('2024-01-15')).toBe(true);
  });

  it('indexes month entries by month key', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'month' });
    const lookup = buildEntryLookup([entry], 0);

    const monthKey = '2024-01';
    expect(lookup.byMonth.get(monthKey)).toHaveLength(1);
    expect(lookup.hasMonthEntryMonths.has(monthKey)).toBe(true);
  });

  it('indexes year entries by year', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'year' });
    const lookup = buildEntryLookup([entry], 0);

    expect(lookup.byYear.get(2024)).toHaveLength(1);
    expect(lookup.hasYearEntryYears.has(2024)).toBe(true);
  });

  it('indexes decade entries by decade', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'decade' });
    const lookup = buildEntryLookup([entry], 0);

    expect(lookup.byDecade.get(2020)).toHaveLength(1);
  });

  it('handles multiple entries on the same date', () => {
    const entry1 = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const entry2 = createEntry({ date: '2024-01-15', timeRange: 'day', id: 2 });
    const lookup = buildEntryLookup([entry1, entry2], 0);

    expect(lookup.byDateString.get('2024-01-15')).toHaveLength(2);
  });

  it('indexes day entries in byDayForYear', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    expect(lookup.byDayForYear.get(2024)).toHaveLength(1);
  });

  it('indexes entries across different time ranges', () => {
    const dayEntry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const monthEntry = createEntry({ date: '2024-01-01', timeRange: 'month', id: 2 });
    const yearEntry = createEntry({ date: '2024-06-15', timeRange: 'year', id: 3 });

    const lookup = buildEntryLookup([dayEntry, monthEntry, yearEntry], 0);

    expect(lookup.byDateString.get('2024-01-15')).toHaveLength(1);
    expect(lookup.byMonth.get('2024-01')).toHaveLength(1);
    expect(lookup.byYear.get(2024)).toHaveLength(1);
  });
});

describe('hasEntryForDateOptimized', () => {
  it('returns false for empty lookup', () => {
    const lookup = buildEntryLookup([], 0);
    expect(hasEntryForDateOptimized(lookup, new Date(2024, 0, 15), 0)).toBe(false);
  });

  it('returns true when a day entry exists', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasEntryForDateOptimized(lookup, new Date(2024, 0, 15), 0)).toBe(true);
  });

  it('returns false when no entry exists', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasEntryForDateOptimized(lookup, new Date(2024, 0, 16), 0)).toBe(false);
  });

  it('detects month-level entries', () => {
    const entry = createEntry({ date: '2024-01-01', timeRange: 'month' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasEntryForDateOptimized(lookup, new Date(2024, 0, 15), 0)).toBe(true);
  });

  it('detects year-level entries', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'year' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasEntryForDateOptimized(lookup, new Date(2024, 0, 1), 0)).toBe(true);
  });

  it('detects decade-level entries', () => {
    const entry = createEntry({ date: '2025-06-15', timeRange: 'decade' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasEntryForDateOptimized(lookup, new Date(2024, 0, 1), 0)).toBe(true);
  });
});

describe('addEntryToLookup / removeEntryFromLookup', () => {
  it('adds a day entry to lookup incrementally', () => {
    const lookup = buildEntryLookup([], 0);
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });

    addEntryToLookup(lookup, entry, 0);
    expect(lookup.byDateString.get('2024-01-15')).toHaveLength(1);
    expect(lookup.hasEntryDates.has('2024-01-15')).toBe(true);
  });

  it('removes a day entry from lookup incrementally', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const lookup = buildEntryLookup([entry], 0);

    removeEntryFromLookup(lookup, entry.id!);
    expect(lookup.byDateString.get('2024-01-15')).toBeUndefined();
    expect(lookup.hasEntryDates.has('2024-01-15')).toBe(false);
  });

  it('preserves other entries when removing one', () => {
    const entry1 = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const entry2 = createEntry({ date: '2024-01-16', timeRange: 'day', id: 2 });
    const lookup = buildEntryLookup([entry1, entry2], 0);

    removeEntryFromLookup(lookup, entry1.id!);
    expect(lookup.byDateString.get('2024-01-16')).toHaveLength(1);
    expect(lookup.byDateString.get('2024-01-15')).toBeUndefined();
  });

  it('handles removing from all map types', () => {
    const dayEntry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const monthEntry = createEntry({ date: '2024-01-01', timeRange: 'month', id: 2 });
    const lookup = buildEntryLookup([dayEntry, monthEntry], 0);

    removeEntryFromLookup(lookup, dayEntry.id!);
    expect(lookup.byDateString.get('2024-01-15')).toBeUndefined();
    expect(lookup.byMonth.get('2024-01')).toHaveLength(1);
  });
});

describe('getDayEntriesOptimized', () => {
  it('returns empty array for date with no entries', () => {
    const lookup = buildEntryLookup([], 0);
    expect(getDayEntriesOptimized(lookup, new Date(2024, 0, 15))).toEqual([]);
  });

  it('returns day entries for a date', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    const entries = getDayEntriesOptimized(lookup, new Date(2024, 0, 15));
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(entry.id);
  });
});

describe('getEntriesWithTimeOptimized', () => {
  it('returns empty array for date with no timed entries', () => {
    const lookup = buildEntryLookup([], 0);
    expect(getEntriesWithTimeOptimized(lookup, new Date(2024, 0, 15))).toEqual([]);
  });

  it('returns day entries that have a time set', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', hour: 14, minute: 30 });
    const lookup = buildEntryLookup([entry], 0);
    const timed = getEntriesWithTimeOptimized(lookup, new Date(2024, 0, 15));
    expect(timed).toHaveLength(1);
  });

  it('filters out entries without time', () => {
    const entry1 = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1, hour: 14, minute: 30 });
    const entry2 = createEntry({ date: '2024-01-15', timeRange: 'day', id: 2 });
    const lookup = buildEntryLookup([entry1, entry2], 0);
    const timed = getEntriesWithTimeOptimized(lookup, new Date(2024, 0, 15));
    expect(timed).toHaveLength(1);
  });
});

describe('getMonthEntriesOptimized', () => {
  it('returns month entries for a given month', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'month' });
    const lookup = buildEntryLookup([entry], 0);
    const entries = getMonthEntriesOptimized(lookup, 2024, 0);
    expect(entries).toHaveLength(1);
  });
});

describe('getAllEntriesForYearOptimized', () => {
  it('returns year-range entries for a given year', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'year' });
    const lookup = buildEntryLookup([entry], 0);
    const entries = getAllEntriesForYearOptimized(lookup, 2024);
    expect(entries).toHaveLength(1);
  });

  it('returns day entries via byDayForYear index', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    const entries = getAllEntriesForYearOptimized(lookup, 2024);
    expect(entries).toHaveLength(1);
  });
});

describe('hasAnyEntriesForYear', () => {
  it('returns false for year with no entries', () => {
    const lookup = buildEntryLookup([], 0);
    expect(hasAnyEntriesForYear(lookup, 2024)).toBe(false);
  });

  it('returns true for year with day entries', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasAnyEntriesForYear(lookup, 2024)).toBe(true);
  });

  it('returns true for year with year entries', () => {
    const entry = createEntry({ date: '2024-06-15', timeRange: 'year' });
    const lookup = buildEntryLookup([entry], 0);
    expect(hasAnyEntriesForYear(lookup, 2024)).toBe(true);
  });
});

describe('Edge cases', () => {
  it('handles entries with ID of 0', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 0 });
    const lookup = buildEntryLookup([entry], 0);
    expect(lookup.byDateString.get('2024-01-15')).toHaveLength(1);
  });

  it('handles entries across century boundary', () => {
    const entry = createEntry({ date: '1999-12-31', timeRange: 'day' });
    const lookup = buildEntryLookup([entry], 0);
    expect(lookup.byDateString.get('1999-12-31')).toHaveLength(1);
    expect(lookup.byDayForYear.get(1999)).toHaveLength(1);
  });

  it('handles very large entry arrays', () => {
    const entries: JournalEntry[] = [];
    for (let i = 0; i < 1000; i++) {
      const day = (i % 28) + 1;
      const month = (i % 12) + 1;
      entries.push(createEntry({
        date: `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        timeRange: 'day',
        id: i,
      }));
    }
    const lookup = buildEntryLookup(entries, 0);
    expect(lookup.byDateString.size).toBeGreaterThan(0);
    expect(lookup.byDayForYear.get(2024)).toHaveLength(1000);
  });
});
