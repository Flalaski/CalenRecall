import { JournalEntry } from '../types';
import { parseISODate, formatDate, getWeekStart } from './dateUtils';
import type { EntryLookup } from './entryLookupUtils';

// Cache for entry colors to avoid recalculating
const entryColorCache = new Map<number, string>();

/**
 * Calculate entry color based on numerological calculation
 * This matches the crystal color calculation used in GlobalTimelineMinimap
 * Results are cached by entry ID to avoid recalculation
 */
export function calculateEntryColor(entry: JournalEntry): string {
  // Use cached color if available
  if (entry.id !== undefined && entryColorCache.has(entry.id)) {
    return entryColorCache.get(entry.id)!;
  }

  // Combine title and content for numerological calculation
  const text = (entry.title || '') + (entry.content || '');
  
  // Calculate numerological value from text (sum of character codes with weighting)
  let textValue = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Weight characters differently to create more variation
    textValue += charCode * (i % 3 + 1);
  }
  
  // Calculate time-based numerological value
  const entryDate = parseISODate(entry.date);
  const timeValue = entryDate.getFullYear() * 10000 + 
                    (entryDate.getMonth() + 1) * 100 + 
                    entryDate.getDate();
  
  // Add timeRange to the calculation for additional variation
  const timeRangeValue = entry.timeRange === 'decade' ? 1000 :
                        entry.timeRange === 'year' ? 2000 :
                        entry.timeRange === 'month' ? 3000 :
                        entry.timeRange === 'week' ? 4000 : 5000;
  
  // Combine all values for numerological calculation
  const combinedValue = (textValue + timeValue + timeRangeValue) % 360; // Use modulo 360 for hue
  
  // Calculate hue, saturation, and lightness with more variation
  // Increased base saturation and lightness for vibrant, visible colors
  const hue = combinedValue; // 0-360 degrees
  const saturation = 85 + (textValue % 15); // 85-100% saturation (very vibrant)
  const lightness = 50 + (timeValue % 20); // 50-70% lightness (brighter, more visible)
  
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  
  // Cache the color if entry has an ID
  if (entry.id !== undefined) {
    entryColorCache.set(entry.id, color);
  }
  
  return color;
}

/**
 * Clear the entry color cache (useful when entries are updated)
 */
export function clearEntryColorCache() {
  entryColorCache.clear();
}

/**
 * Clear color cache for a specific entry
 */
export function clearEntryColorCacheForEntry(entryId: number) {
  entryColorCache.delete(entryId);
}

/**
 * Get the primary entry color for a date/timeRange combination
 * If multiple entries exist, returns the color of the first one
 * 
 * OPTIMIZED: Use pre-filtered entries array instead of filtering here
 */
export function getEntryColorForDate(
  entries: JournalEntry[],
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'
): string | null {
  // If entries array is already filtered, just use the first one
  // Otherwise, find entries that match this date and timeRange
  let matchingEntries: JournalEntry[];
  
  if (entries.length > 0 && entries[0].timeRange === timeRange) {
    // Assume entries are already filtered - just check date match
    matchingEntries = entries.filter(entry => {
      if (entry.timeRange !== timeRange) return false;
      
      const entryDate = parseISODate(entry.date);
      
      switch (timeRange) {
        case 'day':
          return entryDate.toDateString() === date.toDateString();
        case 'week':
          // Check if date falls within the week of entry
          const weekStart = new Date(entryDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return date >= weekStart && date <= weekEnd;
        case 'month':
          return entryDate.getFullYear() === date.getFullYear() && 
                 entryDate.getMonth() === date.getMonth();
        case 'year':
          return entryDate.getFullYear() === date.getFullYear();
        case 'decade':
          const entryDecade = Math.floor(entryDate.getFullYear() / 10) * 10;
          const dateDecade = Math.floor(date.getFullYear() / 10) * 10;
          return entryDecade === dateDecade;
        default:
          return false;
      }
    });
  } else {
    matchingEntries = entries.filter(entry => {
      if (entry.timeRange !== timeRange) return false;
      
      const entryDate = parseISODate(entry.date);
      
      switch (timeRange) {
        case 'day':
          return entryDate.toDateString() === date.toDateString();
        case 'week':
          // Check if date falls within the week of entry
          const weekStart = new Date(entryDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return date >= weekStart && date <= weekEnd;
        case 'month':
          return entryDate.getFullYear() === date.getFullYear() && 
                 entryDate.getMonth() === date.getMonth();
        case 'year':
          return entryDate.getFullYear() === date.getFullYear();
        case 'decade':
          const entryDecade = Math.floor(entryDate.getFullYear() / 10) * 10;
          const dateDecade = Math.floor(date.getFullYear() / 10) * 10;
          return entryDecade === dateDecade;
        default:
          return false;
      }
    });
  }
  
  if (matchingEntries.length === 0) return null;
  
  // Return color of first matching entry (cached)
  return calculateEntryColor(matchingEntries[0]);
}

/**
 * Get entry color for a date using optimized lookup (faster)
 * OPTIMIZED: Uses pre-computed entry colors from context if available
 */
export function getEntryColorForDateOptimized(
  lookup: EntryLookup,
  date: Date,
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day',
  weekStartsOn: number = 0,
  entryColors?: Map<number, string>
): string | null {
  const dateStr = formatDate(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const decadeStart = Math.floor(year / 10) * 10;
  const weekStart = getWeekStart(date, weekStartsOn);
  const weekKey = formatDate(weekStart);

  let matchingEntry: JournalEntry | null = null;

  switch (timeRange) {
    case 'day': {
      const entries = lookup.byDateString.get(dateStr);
      matchingEntry = entries?.[0] || null;
      break;
    }
    case 'week': {
      const entries = lookup.byWeekStart.get(weekKey);
      matchingEntry = entries?.[0] || null;
      break;
    }
    case 'month': {
      const entries = lookup.byMonth.get(monthKey);
      matchingEntry = entries?.[0] || null;
      break;
    }
    case 'year': {
      const entries = lookup.byYear.get(year);
      matchingEntry = entries?.[0] || null;
      break;
    }
    case 'decade': {
      const entries = lookup.byDecade.get(decadeStart);
      matchingEntry = entries?.[0] || null;
      break;
    }
  }

  if (!matchingEntry) return null;
  
  // Use pre-computed color if available, otherwise calculate
  if (entryColors && matchingEntry.id !== undefined) {
    const precomputedColor = entryColors.get(matchingEntry.id);
    if (precomputedColor) {
      return precomputedColor;
    }
  }
  
  return calculateEntryColor(matchingEntry);
}

