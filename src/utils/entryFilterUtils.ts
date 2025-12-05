import { JournalEntry, TimeRange } from '../types';
import { parseISODate, formatDate, getCanonicalDate, getWeekStart, getWeekEnd } from './dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';

/**
 * Calculate the date range needed for a view mode and selected date.
 * This determines which entries could be visible in the view.
 */
export function getDateRangeForView(selectedDate: Date, viewMode: TimeRange): { startDate: Date; endDate: Date } {
  let startDate: Date;
  let endDate: Date;

  switch (viewMode) {
    case 'decade': {
      const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
      startDate = new Date(decadeStart, 0, 1);
      endDate = new Date(decadeStart + 9, 11, 31);
      break;
    }
    case 'year': {
      startDate = new Date(selectedDate.getFullYear(), 0, 1);
      endDate = new Date(selectedDate.getFullYear(), 11, 31);
      break;
    }
    case 'month': {
      startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      break;
    }
    case 'week': {
      startDate = getWeekStart(selectedDate);
      endDate = getWeekEnd(selectedDate);
      // Expand to include full month(s) to catch month entries
      const weekStartMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const weekEndMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      if (weekStartMonth < startDate) startDate = weekStartMonth;
      if (weekEndMonth > endDate) endDate = weekEndMonth;
      break;
    }
    case 'day': {
      // Load entries for the full month to catch month/week entries
      startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      break;
    }
    default: {
      startDate = selectedDate;
      endDate = selectedDate;
    }
  }

  return { startDate, endDate };
}

/**
 * Filter entries that fall within a date range.
 * This is used for views that need entries in a specific date range.
 */
export function filterEntriesByDateRange(
  entries: JournalEntry[],
  startDate: Date,
  endDate: Date
): JournalEntry[] {
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  return entries.filter(entry => {
    // Simple string comparison for date range (works for ISO dates)
    return entry.date >= startDateStr && entry.date <= endDateStr;
  });
}

/**
 * Filter entries for a specific date and view mode.
 * This handles the logic of which entries should appear for a given date
 * based on the entry's timeRange.
 */
export function filterEntriesForDate(
  entries: JournalEntry[],
  date: Date,
  viewMode: TimeRange
): JournalEntry[] {
  const dateStr = formatDate(date);
  const checkYear = date.getFullYear();
  const checkMonth = date.getMonth();
  const checkDay = date.getDate();

  return entries.filter(entry => {
    const entryDate = parseISODate(entry.date);
    const entryYear = entryDate.getFullYear();
    const entryMonth = entryDate.getMonth();
    const entryDay = entryDate.getDate();

    // For decade view, show year entries in their year cells
    if (viewMode === 'decade') {
      if (entry.timeRange === 'year') {
        return entryYear === checkYear;
      }
      if (entry.timeRange === 'decade') {
        const entryDecade = Math.floor(entryYear / 10) * 10;
        const checkDecade = Math.floor(checkYear / 10) * 10;
        return entryDecade === checkDecade;
      }
      return false;
    }

    // For year view, show month entries in their month cells
    if (viewMode === 'year') {
      if (entry.timeRange === 'month') {
        return entryYear === checkYear && entryMonth === checkMonth;
      }
      if (entry.timeRange === 'year') {
        return entryYear === checkYear;
      }
      return false;
    }

    // For month view, show week and day entries
    if (viewMode === 'month') {
      if (entry.timeRange === 'day') {
        return entryYear === checkYear && entryMonth === checkMonth && entryDay === checkDay;
      }
      if (entry.timeRange === 'week') {
        const entryWeekStart = getWeekStart(entryDate);
        const checkWeekStart = getWeekStart(date);
        return isSameDay(entryWeekStart, checkWeekStart);
      }
      if (entry.timeRange === 'month') {
        return entryYear === checkYear && entryMonth === checkMonth;
      }
      return false;
    }

    // For week view, show day entries
    if (viewMode === 'week') {
      if (entry.timeRange === 'day') {
        return entryYear === checkYear && entryMonth === checkMonth && entryDay === checkDay;
      }
      if (entry.timeRange === 'week') {
        const entryWeekStart = getWeekStart(entryDate);
        const checkWeekStart = getWeekStart(date);
        return isSameDay(entryWeekStart, checkWeekStart);
      }
      if (entry.timeRange === 'month') {
        return entryYear === checkYear && entryMonth === checkMonth;
      }
      return false;
    }

    // For day view, show only day entries
    if (viewMode === 'day') {
      if (entry.timeRange === 'day') {
        return entryYear === checkYear && entryMonth === checkMonth && entryDay === checkDay;
      }
      // Also show week/month entries that include this day
      if (entry.timeRange === 'week') {
        const entryWeekStart = getWeekStart(entryDate);
        const entryWeekEnd = getWeekEnd(entryDate);
        return date >= entryWeekStart && date <= entryWeekEnd;
      }
      if (entry.timeRange === 'month') {
        return entryYear === checkYear && entryMonth === checkMonth;
      }
      return false;
    }

    return false;
  });
}

/**
 * Filter entries for a timeRange and date (used by JournalList).
 * This matches the logic of getEntriesForRange but works with cached entries.
 */
export function filterEntriesForRange(
  entries: JournalEntry[],
  range: TimeRange,
  date: Date
): JournalEntry[] {
  let targetValue: number;
  let targetYear: number;
  let targetMonth: number;
  let targetWeekStart: Date;

  switch (range) {
    case 'decade': {
      targetYear = date.getFullYear();
      targetValue = Math.floor(targetYear / 10);
      break;
    }
    case 'year': {
      targetYear = date.getFullYear();
      targetValue = targetYear;
      break;
    }
    case 'month': {
      targetYear = date.getFullYear();
      targetMonth = date.getMonth();
      targetValue = targetYear * 12 + targetMonth;
      break;
    }
    case 'week': {
      targetWeekStart = getWeekStart(date);
      // Reference Monday: January 1, 0001
      const referenceMonday = new Date(1, 0, 1);
      targetValue = Math.floor((targetWeekStart.getTime() - referenceMonday.getTime()) / (1000 * 60 * 60 * 24 * 7));
      break;
    }
    case 'day': {
      const referenceDay = new Date(1, 0, 1);
      targetValue = Math.floor((date.getTime() - referenceDay.getTime()) / (1000 * 60 * 60 * 24));
      break;
    }
  }

  return entries.filter(entry => {
    const entryDate = parseISODate(entry.date);
    let entryValue: number;

    switch (entry.timeRange) {
      case 'decade': {
        const entryYear = entryDate.getFullYear();
        entryValue = Math.floor(entryYear / 10);
        break;
      }
      case 'year': {
        entryValue = entryDate.getFullYear();
        break;
      }
      case 'month': {
        const entryYear = entryDate.getFullYear();
        const entryMonth = entryDate.getMonth();
        entryValue = entryYear * 12 + entryMonth;
        break;
      }
      case 'week': {
        const entryWeekStart = getWeekStart(entryDate);
        const referenceMonday = new Date(1, 0, 1);
        entryValue = Math.floor((entryWeekStart.getTime() - referenceMonday.getTime()) / (1000 * 60 * 60 * 24 * 7));
        break;
      }
      case 'day': {
        const referenceDay = new Date(1, 0, 1);
        entryValue = Math.floor((entryDate.getTime() - referenceDay.getTime()) / (1000 * 60 * 60 * 24));
        break;
      }
    }

    return entry.timeRange === range && entryValue === targetValue;
  });
}

/**
 * Check if a date has any entries (used by CalendarView).
 * This efficiently checks if any entry applies to a given date.
 */
export function hasEntryForDate(
  entries: JournalEntry[],
  date: Date
): boolean {
  const dateStr = formatDate(date);
  const checkYear = date.getFullYear();
  const checkMonth = date.getMonth();
  const checkDay = date.getDate();

  return entries.some(entry => {
    const entryDate = parseISODate(entry.date);
    const entryYear = entryDate.getFullYear();
    const entryMonth = entryDate.getMonth();
    const entryDay = entryDate.getDate();

    if (entry.timeRange === 'day') {
      return entry.date === dateStr;
    } else if (entry.timeRange === 'month') {
      // Mark all days in the month
      return entryYear === checkYear && entryMonth === checkMonth;
    } else if (entry.timeRange === 'week') {
      // Mark all days in the week
      const entryWeekStart = getWeekStart(entryDate);
      const checkWeekStart = getWeekStart(date);
      return isSameDay(entryWeekStart, checkWeekStart);
    } else if (entry.timeRange === 'year') {
      return entryYear === checkYear;
    } else if (entry.timeRange === 'decade') {
      const entryDecade = Math.floor(entryYear / 10) * 10;
      const checkDecade = Math.floor(checkYear / 10) * 10;
      return entryDecade === checkDecade;
    }
    return false;
  });
}

