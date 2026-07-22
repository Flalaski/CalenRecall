/**
 * Unit tests for entryColorUtils
 * Tests color-coded entry indicator calculations.
 */

import { calculateEntryColor, getEntryColorForDateOptimized } from '../entryColorUtils';
import { buildEntryLookup } from '../entryLookupUtils';
import { JournalEntry } from '../../types';

function createEntry(overrides: Partial<JournalEntry> & { date: string }): JournalEntry {
  return {
    id: Math.floor(Math.random() * 10000),
    timeRange: 'day',
    title: 'Test',
    content: 'Content',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateEntryColor', () => {
  it('returns a valid color string', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const color = calculateEntryColor(entry);
    expect(typeof color).toBe('string');
    expect(color.length).toBeGreaterThan(0);
  });

  it('returns different colors for different time ranges', () => {
    const dayEntry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const monthEntry = createEntry({ date: '2024-01-01', timeRange: 'month' });
    
    const dayColor = calculateEntryColor(dayEntry);
    const monthColor = calculateEntryColor(monthEntry);
    
    // Day and month entries should have different colors
    expect(dayColor).not.toBe(monthColor);
  });

  it('returns consistent colors for same entry', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 42 });
    const color1 = calculateEntryColor(entry);
    const color2 = calculateEntryColor(entry);
    expect(color1).toBe(color2);
  });

  it('handles entries with different tags', () => {
    const entry1 = createEntry({ date: '2024-01-15', timeRange: 'day', tags: ['important'] });
    const entry2 = createEntry({ date: '2024-01-15', timeRange: 'day', tags: ['personal'] });
    
    // Different tags may produce different colors
    const color1 = calculateEntryColor(entry1);
    const color2 = calculateEntryColor(entry2);
    expect(typeof color1).toBe('string');
    expect(typeof color2).toBe('string');
  });

  it('handles entries without tags', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day' });
    const color = calculateEntryColor(entry);
    expect(typeof color).toBe('string');
  });

  it('handles pinned entries differently', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', pinned: true });
    const color = calculateEntryColor(entry);
    expect(typeof color).toBe('string');
    expect(color).toBeTruthy();
  });
});

describe('getEntryColorForDateOptimized', () => {
  it('returns null for date with no entries', () => {
    const lookup = buildEntryLookup([], 0);
    const colors = new Map<number, string>();
    const result = getEntryColorForDateOptimized(lookup, new Date(2024, 0, 15), 'day', 0, colors);
    expect(result).toBeNull();
  });

  it('returns color for a date with a day entry', () => {
    const entry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const lookup = buildEntryLookup([entry], 0);
    const colors = new Map<number, string>();
    colors.set(entry.id!, calculateEntryColor(entry));
    
    const result = getEntryColorForDateOptimized(lookup, new Date(2024, 0, 15), 'day', 0, colors);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('prefers day-level color over month-level', () => {
    const dayEntry = createEntry({ date: '2024-01-15', timeRange: 'day', id: 1 });
    const monthEntry = createEntry({ date: '2024-01-01', timeRange: 'month', id: 2 });
    const lookup = buildEntryLookup([dayEntry, monthEntry], 0);
    const colors = new Map<number, string>();
    colors.set(1, '#ff0000');
    colors.set(2, '#00ff00');
    
    const result = getEntryColorForDateOptimized(lookup, new Date(2024, 0, 15), 'day', 0, colors);
    expect(result).toBe('#ff0000');
  });
});
