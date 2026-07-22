/**
 * Unit tests for entryFilterUtils
 * Tests entry filtering utilities matching the actual exported API.
 */

import {
  getDateRangeForView,
  filterEntriesByDateRange,
  filterEntriesForDate,
  filterEntriesForRange,
  hasEntryForDate,
} from '../entryFilterUtils';
import { JournalEntry } from '../../types';

function createEntry(overrides: Partial<JournalEntry> & { date: string }): JournalEntry {
  return {
    id: Math.floor(Math.random() * 10000),
    timeRange: 'day' as const,
    title: 'Test Entry',
    content: 'Test content',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getDateRangeForView', () => {
  it('returns decade bounds', () => {
    const { startDate, endDate } = getDateRangeForView(new Date(2024, 5, 15), 'decade');
    expect(startDate.getFullYear()).toBe(2020);
    expect(endDate.getFullYear()).toBe(2029);
  });

  it('returns year bounds', () => {
    const { startDate, endDate } = getDateRangeForView(new Date(2024, 5, 15), 'year');
    expect(startDate.getFullYear()).toBe(2024);
    expect(startDate.getMonth()).toBe(0);
    expect(endDate.getFullYear()).toBe(2024);
    expect(endDate.getMonth()).toBe(11);
  });

  it('returns month bounds', () => {
    const { startDate, endDate } = getDateRangeForView(new Date(2024, 0, 15), 'month');
    expect(startDate.getMonth()).toBe(0);
    expect(startDate.getDate()).toBe(1);
    expect(endDate.getMonth()).toBe(0);
    expect(endDate.getDate()).toBe(31);
  });
});

describe('filterEntriesByDateRange', () => {
  const entries: JournalEntry[] = [
    createEntry({ date: '2024-01-15', id: 1 }),
    createEntry({ date: '2024-02-15', id: 2 }),
    createEntry({ date: '2024-03-15', id: 3 }),
  ];

  it('filters entries within date range', () => {
    const result = filterEntriesByDateRange(entries, new Date(2024, 0, 1), new Date(2024, 1, 28));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it('returns all entries for full year range', () => {
    const result = filterEntriesByDateRange(entries, new Date(2024, 0, 1), new Date(2024, 11, 31));
    expect(result).toHaveLength(3);
  });

  it('returns empty for no entries in range', () => {
    const result = filterEntriesByDateRange(entries, new Date(2025, 0, 1), new Date(2025, 11, 31));
    expect(result).toHaveLength(0);
  });
});

describe('filterEntriesForDate', () => {
  it('finds day entries matching a specific date', () => {
    const entries = [createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 })];
    const result = filterEntriesForDate(entries, new Date(2024, 0, 15), 'day');
    expect(result).toHaveLength(1);
  });

  it('excludes day entries on non-matching dates', () => {
    const entries = [createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 })];
    const result = filterEntriesForDate(entries, new Date(2024, 0, 16), 'day');
    expect(result).toHaveLength(0);
  });

  it('includes month entries in month view', () => {
    const entries = [createEntry({ date: '2024-01-01', timeRange: 'month', id: 1 })];
    const result = filterEntriesForDate(entries, new Date(2024, 0, 15), 'month');
    expect(result).toHaveLength(1);
  });

  it('includes month entries in day view', () => {
    const entries = [createEntry({ date: '2024-01-01', timeRange: 'month', id: 1 })];
    const result = filterEntriesForDate(entries, new Date(2024, 0, 15), 'day');
    expect(result).toHaveLength(1);
  });
});

describe('filterEntriesForRange', () => {
  it('filters day entries for a day range', () => {
    const entries = [createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 })];
    const result = filterEntriesForRange(entries, 'day', new Date(2024, 0, 15));
    expect(result).toHaveLength(1);
  });

  it('filters year entries for a year range', () => {
    const entries = [createEntry({ date: '2024-06-15', timeRange: 'year', id: 1 })];
    const result = filterEntriesForRange(entries, 'year', new Date(2024, 0, 1));
    expect(result).toHaveLength(1);
  });
});

describe('hasEntryForDate', () => {
  it('returns true when day entry exists', () => {
    const entries = [createEntry({ date: '2024-01-15', timeRange: 'day' })];
    expect(hasEntryForDate(entries, new Date(2024, 0, 15))).toBe(true);
  });

  it('returns false when no entry exists', () => {
    const entries = [createEntry({ date: '2024-01-15', timeRange: 'day' })];
    expect(hasEntryForDate(entries, new Date(2024, 0, 16))).toBe(false);
  });

  it('detects month-level entries', () => {
    const entries = [createEntry({ date: '2024-01-01', timeRange: 'month' })];
    expect(hasEntryForDate(entries, new Date(2024, 0, 15))).toBe(true);
  });
});
