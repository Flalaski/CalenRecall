/**
 * Input validation utilities for IPC handlers.
 * Validates user input before processing to prevent errors and security issues.
 */

import { JournalEntry, TimeRange, ExportFormat, ExportMetadata } from '../types';
import type { Preferences } from '../database';

/**
 * Valid time range values
 */
const VALID_TIME_RANGES: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];

/**
 * Valid export formats
 */
const VALID_EXPORT_FORMATS: ExportFormat[] = ['markdown', 'text', 'json', 'rtf', 'pdf', 'dec', 'csv'];

/**
 * Valid preference keys
 */
const VALID_PREFERENCE_KEYS: Array<keyof Preferences> = [
  'defaultViewMode',
  'windowWidth',
  'windowHeight',
  'windowX',
  'windowY',
  'dateFormat',
  'weekStartsOn',
  'autoSave',
  'autoSaveInterval',
  'theme',
  'fontSize',
  'showMinimap',
  'minimapPosition',
  'minimapSize',
  'minimapCrystalUseDefaultColors',
  'restoreLastView',
  'lastViewedDate',
  'lastViewedMode',
  'defaultCalendar',
  'showMultipleCalendars',
  'backgroundImage',
  'timeFormat',
  'defaultExportFormat',
  'defaultExportMetadata',
  'soundEffectsEnabled',
  'showAstromonixToolbarButton',
  'fullScreen',
];

/**
 * Validates a time range value
 * 
 * @param timeRange - The time range to validate
 * @returns True if valid, false otherwise
 */
export function isValidTimeRange(timeRange: unknown): timeRange is TimeRange {
  return typeof timeRange === 'string' && VALID_TIME_RANGES.includes(timeRange as TimeRange);
}

/**
 * Validates an export format
 * 
 * @param format - The export format to validate
 * @returns True if valid, false otherwise
 */
export function isValidExportFormat(format: unknown): format is ExportFormat {
  return typeof format === 'string' && VALID_EXPORT_FORMATS.includes(format as ExportFormat);
}

/**
 * Validates a preference key
 * 
 * @param key - The preference key to validate
 * @returns True if valid, false otherwise
 */
export function isValidPreferenceKey(key: unknown): key is keyof Preferences {
  return typeof key === 'string' && VALID_PREFERENCE_KEYS.includes(key as keyof Preferences);
}

/**
 * Validates a date string (ISO format: YYYY-MM-DD or -YYYY-MM-DD)
 * 
 * @param dateStr - The date string to validate
 * @returns True if valid, false otherwise
 */
export function isValidDateString(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') {
    return false;
  }
  
  // Match ISO date format: YYYY-MM-DD or -YYYY-MM-DD (for negative years)
  const dateRegex = /^-?\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  
  // Try to parse the date
  try {
    const parts = dateStr.replace(/^-/, '').split('-');
    const year = dateStr.startsWith('-') ? -parseInt(parts[0], 10) : parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    // Basic validation
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    
    // Check reasonable year range
    if (year < -9999 || year > 9999) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates an entry ID
 * 
 * @param id - The ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidEntryId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

/**
 * Validates a journal entry object
 * 
 * @param entry - The entry to validate
 * @returns Validation result with error message if invalid
 */
export function validateJournalEntry(entry: unknown): { valid: boolean; error?: string } {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, error: 'Entry must be an object' };
  }
  
  const e = entry as Partial<JournalEntry>;
  
  // Validate required fields
  if (!e.date || typeof e.date !== 'string') {
    return { valid: false, error: 'Entry must have a valid date string' };
  }
  
  if (!isValidDateString(e.date)) {
    return { valid: false, error: 'Entry date must be in ISO format (YYYY-MM-DD)' };
  }
  
  if (!e.timeRange || !isValidTimeRange(e.timeRange)) {
    return { valid: false, error: 'Entry must have a valid timeRange' };
  }
  
  if (!e.title || typeof e.title !== 'string') {
    return { valid: false, error: 'Entry must have a title' };
  }
  
  if (e.content === undefined || typeof e.content !== 'string') {
    return { valid: false, error: 'Entry must have content' };
  }
  
  // Validate optional fields
  if (e.hour !== undefined && e.hour !== null) {
    if (typeof e.hour !== 'number' || e.hour < 0 || e.hour > 23) {
      return { valid: false, error: 'Hour must be between 0 and 23' };
    }
  }
  
  if (e.minute !== undefined && e.minute !== null) {
    if (typeof e.minute !== 'number' || e.minute < 0 || e.minute > 59) {
      return { valid: false, error: 'Minute must be between 0 and 59' };
    }
  }
  
  if (e.second !== undefined && e.second !== null) {
    if (typeof e.second !== 'number' || e.second < 0 || e.second > 59) {
      return { valid: false, error: 'Second must be between 0 and 59' };
    }
  }
  
  // Validate tags
  if (e.tags !== undefined && !Array.isArray(e.tags)) {
    return { valid: false, error: 'Tags must be an array' };
  }
  
  if (e.tags && e.tags.some(tag => typeof tag !== 'string')) {
    return { valid: false, error: 'All tags must be strings' };
  }
  
  // Validate linked entries
  if (e.linkedEntries !== undefined && !Array.isArray(e.linkedEntries)) {
    return { valid: false, error: 'Linked entries must be an array' };
  }
  
  if (e.linkedEntries && e.linkedEntries.some(id => typeof id !== 'number')) {
    return { valid: false, error: 'All linked entry IDs must be numbers' };
  }
  
  return { valid: true };
}

/**
 * Validates export metadata
 * 
 * @param metadata - The metadata to validate
 * @returns Validation result with error message if invalid
 */
export function validateExportMetadata(metadata: unknown): { valid: boolean; error?: string } {
  if (metadata === undefined || metadata === null) {
    return { valid: true }; // Metadata is optional
  }
  
  if (typeof metadata !== 'object') {
    return { valid: false, error: 'Export metadata must be an object' };
  }
  
  const m = metadata as Partial<ExportMetadata>;
  
  // Validate exportPurpose if provided
  if (m.exportPurpose !== undefined) {
    const validPurposes = ['personal', 'academic', 'professional', 'publication', 'backup', 'archive', 'research', 'legal', 'other'];
    if (!validPurposes.includes(m.exportPurpose)) {
      return { valid: false, error: 'Invalid exportPurpose value' };
    }
  }
  
  // Validate classification if provided
  if (m.classification !== undefined) {
    const validClassifications = ['public', 'internal', 'confidential', 'private', 'restricted'];
    if (!validClassifications.includes(m.classification)) {
      return { valid: false, error: 'Invalid classification value' };
    }
  }
  
  // Validate keywords if provided
  if (m.keywords !== undefined && !Array.isArray(m.keywords)) {
    return { valid: false, error: 'Keywords must be an array' };
  }
  
  if (m.keywords && m.keywords.some(keyword => typeof keyword !== 'string')) {
    return { valid: false, error: 'All keywords must be strings' };
  }
  
  return { valid: true };
}

