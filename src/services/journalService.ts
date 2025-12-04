import { JournalEntry, TimeRange } from '../types';
import { formatDate, getCanonicalDate } from '../utils/dateUtils';

export async function getEntryForDate(date: Date, timeRange: TimeRange): Promise<JournalEntry | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  const canonicalDate = getCanonicalDate(date, timeRange);
  const dateStr = formatDate(canonicalDate);
  return await window.electronAPI.getEntry(dateStr, timeRange);
}

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  await window.electronAPI.saveEntry(entry);
}

export async function deleteJournalEntry(date: Date, timeRange: TimeRange): Promise<void> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  const canonicalDate = getCanonicalDate(date, timeRange);
  const dateStr = formatDate(canonicalDate);
  await window.electronAPI.deleteEntry(dateStr, timeRange);
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
      const weekStart = new Date(date);
      const dayOfWeek = weekStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6
      weekStart.setDate(weekStart.getDate() - daysToMonday);
      // First Monday after epoch (Jan 5, 1970 was a Monday)
      const firstMonday = new Date(1970, 0, 5);
      value = Math.floor((weekStart.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7));
      break;
    case 'day':
      const epochDay = new Date(1970, 0, 1);
      value = Math.floor((date.getTime() - epochDay.getTime()) / (1000 * 60 * 60 * 24));
      break;
  }
  
  return await window.electronAPI.getEntriesByRange(range, value);
}

