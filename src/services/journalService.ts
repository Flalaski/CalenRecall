import { JournalEntry, TimeRange } from '../types';
import { formatDate, getCanonicalDate, createDate } from '../utils/dateUtils';

export async function getEntryForDate(date: Date, timeRange: TimeRange): Promise<JournalEntry | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  const canonicalDate = getCanonicalDate(date, timeRange);
  const dateStr = formatDate(canonicalDate);
  return await window.electronAPI.getEntry(dateStr, timeRange);
}

export async function saveJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  const result = await window.electronAPI.saveEntry(entry);
  // Return the saved entry with ID (for new entries, the ID will be populated)
  return result.entry || entry;
}

export async function deleteJournalEntry(id: number): Promise<void> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  await window.electronAPI.deleteEntry(id);
}

export async function getEntriesForDate(date: Date, timeRange: TimeRange): Promise<JournalEntry[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  const canonicalDate = getCanonicalDate(date, timeRange);
  const dateStr = formatDate(canonicalDate);
  return await window.electronAPI.getEntriesByDateRange(dateStr, timeRange);
}

export async function searchJournalEntries(query: string): Promise<JournalEntry[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return await window.electronAPI.searchEntries(query);
}

export async function getEntriesForRange(
  range: TimeRange,
  date: Date
): Promise<JournalEntry[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  
  let value: number;
  
  switch (range) {
    case 'decade':
      const year = date.getFullYear();
      value = Math.floor(year / 10);
      break;
    case 'year':
      value = date.getFullYear();
      break;
    case 'month':
      value = date.getFullYear() * 12 + date.getMonth();
      break;
    case 'week':
      // Calculate week number based on Monday-based weeks
      // Use a reference Monday that works for all dates: January 1, 0001 was a Monday
      // (in proleptic Gregorian calendar)
      // Note: This uses Monday as the week start (weekStartsOn = 1) for consistency with database storage
      const weekStart = new Date(date);
      const dayOfWeek = weekStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6
      weekStart.setDate(weekStart.getDate() - daysToMonday);
      // Reference Monday: January 1, 0001 (works for all dates including negative years)
      const referenceMonday = createDate(1, 0, 1);
      value = Math.floor((weekStart.getTime() - referenceMonday.getTime()) / (1000 * 60 * 60 * 24 * 7));
      break;
    case 'day':
      // Use January 1, 0001 as reference (works for all dates in proleptic Gregorian calendar)
      const referenceDay = createDate(1, 0, 1);
      value = Math.floor((date.getTime() - referenceDay.getTime()) / (1000 * 60 * 60 * 24));
      break;
  }
  
  return await window.electronAPI.getEntriesByRange(range, value);
}

