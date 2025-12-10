/**
 * Entry Density Awareness
 * Calculates entry density in timeline regions for enhanced haptic feedback
 */

import { JournalEntry } from '../../types';
import { filterEntriesByDateRange } from '../entryFilterUtils';

export interface EntryDensityInfo {
  density: number; // 0-1, normalized density
  resistanceMultiplier: number; // Resistance multiplier near entries
  blipVolumeMultiplier: number; // Audio volume multiplier
  hasEntries: boolean;
}

/**
 * Calculate entry density in a range around a position
 */
export function getEntryDensity(
  entries: JournalEntry[],
  centerDate: Date,
  viewMode: 'decade' | 'year' | 'month' | 'week' | 'day',
  rangePercent: number = 0.1 // 10% of timeline range
): EntryDensityInfo {
  if (entries.length === 0) {
    return {
      density: 0,
      resistanceMultiplier: 1.0,
      blipVolumeMultiplier: 1.0,
      hasEntries: false,
    };
  }

  // Calculate date range based on view mode and range percent
  let rangeStart: Date;
  let rangeEnd: Date;
  
  const rangeMs = getTimeRangeForViewMode(centerDate, viewMode) * rangePercent;
  rangeStart = new Date(centerDate.getTime() - rangeMs / 2);
  rangeEnd = new Date(centerDate.getTime() + rangeMs / 2);

  // Filter entries in range
  const entriesInRange = filterEntriesByDateRange(entries, rangeStart, rangeEnd);
  
  // Calculate normalized density (0-1)
  // Normalize based on maximum expected entries in that range
  const maxExpectedEntries = getMaxExpectedEntriesForViewMode(viewMode, rangePercent);
  const density = Math.min(1.0, entriesInRange.length / maxExpectedEntries);

  // Calculate resistance multiplier (more entries = more resistance)
  // Range: 1.0 (no entries) to 1.5 (maximum density)
  const resistanceMultiplier = 1.0 + (density * 0.5);

  // Calculate volume multiplier (more entries = louder blips)
  // Range: 0.8 (no entries) to 1.3 (maximum density)
  const blipVolumeMultiplier = 0.8 + (density * 0.5);

  return {
    density,
    resistanceMultiplier,
    blipVolumeMultiplier,
    hasEntries: entriesInRange.length > 0,
  };
}

/**
 * Get time range in milliseconds for a view mode
 */
function getTimeRangeForViewMode(centerDate: Date, viewMode: string): number {
  const year = centerDate.getFullYear();
  
  switch (viewMode) {
    case 'decade':
      return 10 * 365.25 * 24 * 60 * 60 * 1000; // ~10 years
    case 'year':
      return 365.25 * 24 * 60 * 60 * 1000; // ~1 year
    case 'month':
      return 30 * 24 * 60 * 60 * 1000; // ~30 days
    case 'week':
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'day':
      return 24 * 60 * 60 * 1000; // 1 day
    default:
      return 30 * 24 * 60 * 60 * 1000; // Default to month
  }
}

/**
 * Get maximum expected entries for a view mode and range
 */
function getMaxExpectedEntriesForViewMode(viewMode: string, rangePercent: number): number {
  // Estimated maximum entries based on view mode
  // These are rough estimates for normalization
  const baseMaxEntries = {
    'decade': 100,
    'year': 50,
    'month': 30,
    'week': 15,
    'day': 5,
  }[viewMode] || 30;

  // Scale by range percent
  return Math.max(1, baseMaxEntries * rangePercent);
}

/**
 * Get entry density at a specific timeline position
 */
export function getEntryDensityAtPosition(
  entries: JournalEntry[],
  timelinePosition: number, // 0-1
  startDate: Date,
  endDate: Date,
  viewMode: 'decade' | 'year' | 'month' | 'week' | 'day',
  rangePercent: number = 0.05 // 5% of timeline range
): EntryDensityInfo {
  // Calculate center date from position
  const totalTime = endDate.getTime() - startDate.getTime();
  const centerTime = startDate.getTime() + (timelinePosition * totalTime);
  const centerDate = new Date(centerTime);

  // Calculate actual range based on timeline span
  const rangeMs = totalTime * rangePercent;
  const rangeStart = new Date(centerDate.getTime() - rangeMs / 2);
  const rangeEnd = new Date(centerDate.getTime() + rangeMs / 2);

  // Filter entries in range
  const entriesInRange = filterEntriesByDateRange(entries, rangeStart, rangeEnd);

  // Calculate density (normalize by timeline span and expected density)
  const maxExpectedEntries = getMaxExpectedEntriesForViewMode(viewMode, rangePercent);
  const density = Math.min(1.0, entriesInRange.length / maxExpectedEntries);

  // Calculate multipliers
  const resistanceMultiplier = 1.0 + (density * 0.4); // Up to 40% more resistance
  const blipVolumeMultiplier = 0.85 + (density * 0.4); // Up to 40% louder

  return {
    density,
    resistanceMultiplier,
    blipVolumeMultiplier,
    hasEntries: entriesInRange.length > 0,
  };
}

