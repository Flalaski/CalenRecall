import { contextBridge, ipcRenderer } from 'electron';
import { JournalEntry, TimeRange, ExportFormat, EntryVersion, EntryAttachment, ExportMetadata } from './types';
import { EntryTemplate } from './database';

export interface Preferences {
  defaultViewMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
  windowWidth?: number;
  windowHeight?: number;
  windowX?: number;
  windowY?: number;
  dateFormat?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  autoSave?: boolean;
  autoSaveInterval?: number;
  theme?: string; // Theme name (e.g., 'light', 'dark', 'auto', 'elite', 'journeyman', etc.)
  fontSize?: 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';
  showMinimap?: boolean;
  minimapPosition?: 'left' | 'right' | 'top' | 'bottom';
  minimapSize?: 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';
  restoreLastView?: boolean;
  lastViewedDate?: string;
  lastViewedMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
  defaultCalendar?: string; // Calendar system (e.g., 'gregorian', 'islamic', 'hebrew')
  showMultipleCalendars?: boolean; // Show date in multiple calendars simultaneously
  backgroundImage?: string; // Path to custom background image, or empty for procedural art
  enableProceduralArt?: boolean; // Enable procedural background art (default: true)
  timeFormat?: '12h' | '24h'; // Time format: 12-hour (AM/PM) or 24-hour
  defaultExportFormat?: ExportFormat; // Default export format to use when exporting entries
  defaultExportMetadata?: ExportMetadata; // Default export metadata to use for all exports
  soundEffectsEnabled?: boolean; // Whether sound effects are enabled
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Journal entry operations
  getEntries: (startDate: string, endDate: string): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-entries', startDate, endDate),
  
  getEntry: (date: string, timeRange: TimeRange): Promise<JournalEntry | null> =>
    ipcRenderer.invoke('get-entry', date, timeRange),
  
  getEntryById: (id: number): Promise<JournalEntry | null> =>
    ipcRenderer.invoke('get-entry-by-id', id),
  
  getEntryVersions: (entryId: number): Promise<EntryVersion[]> =>
    ipcRenderer.invoke('get-entry-versions', entryId),
  
  archiveEntry: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('archive-entry', id),
  
  unarchiveEntry: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('unarchive-entry', id),
  
  getArchivedEntries: (): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-archived-entries'),
  
  pinEntry: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('pin-entry', id),
  
  unpinEntry: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('unpin-entry', id),
  
  getPinnedEntries: (): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-pinned-entries'),
  
  // Template operations
  getAllTemplates: (): Promise<EntryTemplate[]> =>
    ipcRenderer.invoke('get-all-templates'),
  
  getTemplate: (id: number): Promise<EntryTemplate | null> =>
    ipcRenderer.invoke('get-template', id),
  
  saveTemplate: (template: EntryTemplate): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-template', template),
  
  deleteTemplate: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('delete-template', id),
  
  // Attachment operations
  addEntryAttachment: (entryId: number): Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; attachment?: EntryAttachment }> =>
    ipcRenderer.invoke('add-entry-attachment', entryId),
  
  removeEntryAttachment: (entryId: number, attachmentId: string): Promise<{ success: boolean; error?: string; message?: string }> =>
    ipcRenderer.invoke('remove-entry-attachment', entryId, attachmentId),
  
  getAttachmentPath: (entryId: number, attachmentId: string): Promise<{ success: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke('get-attachment-path', entryId, attachmentId),
  
  saveEntry: (entry: JournalEntry): Promise<{ success: boolean; entry: JournalEntry }> =>
    ipcRenderer.invoke('save-entry', entry),
  
  deleteEntry: (id: number): Promise<void> =>
    ipcRenderer.invoke('delete-entry', id),
  
  deleteEntryByDateRange: (date: string, timeRange: TimeRange): Promise<void> =>
    ipcRenderer.invoke('delete-entry-by-date-range', date, timeRange),
  
  getEntriesByDateRange: (date: string, timeRange: TimeRange): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-entries-by-date-range', date, timeRange),
  
  searchEntries: (query: string): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('search-entries', query),
  
  getEntriesByRange: (range: TimeRange, value: number): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-entries-by-range', range, value),
  
  getAllEntries: (): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-all-entries'),

  // Export operations
  exportEntries: (format: ExportFormat, metadata?: ExportMetadata): Promise<{ success: boolean; canceled?: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke('export-entries', format, metadata),
  
  // Import operations
  importEntries: (format: 'json' | 'markdown'): Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; imported?: number; skipped?: number; total?: number }> =>
    ipcRenderer.invoke('import-entries', format),
  
  // Backup/Restore operations
  backupDatabase: (): Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; path?: string }> =>
    ipcRenderer.invoke('backup-database'),
  
  restoreDatabase: (): Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string }> =>
    ipcRenderer.invoke('restore-database'),
  
  // Preferences operations
  getPreference: <K extends keyof Preferences>(key: K): Promise<Preferences[K]> =>
    ipcRenderer.invoke('get-preference', key),
  
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('set-preference', key, value),
  
  getAllPreferences: (): Promise<Preferences> =>
    ipcRenderer.invoke('get-all-preferences'),
  
  resetPreferences: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('reset-preferences'),
  
  // Window operations
  openPreferences: (): Promise<void> =>
    ipcRenderer.invoke('open-preferences'),
  
  closePreferencesWindow: (): Promise<void> =>
    ipcRenderer.invoke('close-preferences-window'),
  
  // Import progress listener
  onImportProgress: (callback: (progress: { stage: string; progress: number; message: string; total?: number; imported?: number; skipped?: number }) => void) => {
    ipcRenderer.on('import-progress', (_event, progress) => callback(progress));
  },
  
  removeImportProgressListener: () => {
    ipcRenderer.removeAllListeners('import-progress');
  },

  // Background image operations
  selectBackgroundImage: (): Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; path?: string; fullPath?: string }> =>
    ipcRenderer.invoke('select-background-image'),

  clearBackgroundImage: (): Promise<{ success: boolean; error?: string; message?: string }> =>
    ipcRenderer.invoke('clear-background-image'),

  getBackgroundImagePath: (): Promise<{ success: boolean; error?: string; message?: string; path?: string | null }> =>
    ipcRenderer.invoke('get-background-image-path'),

  // Listen for preference updates from main process
  onPreferenceUpdated: (callback: (data: { key: string; value: any }) => void) => {
    ipcRenderer.on('preference-updated', (_event, data) => callback(data));
  },

  removePreferenceUpdatedListener: () => {
    ipcRenderer.removeAllListeners('preference-updated');
  },

  // Force main window to refresh theme (called from preferences window)
  refreshMainWindowTheme: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('refresh-main-window-theme'),

  // Get custom themes from AppData/themes directory
  getCustomThemes: (): Promise<{ success: boolean; error?: string; message?: string; themes?: Array<{ name: string; css: string }> }> =>
    ipcRenderer.invoke('get-custom-themes'),

  // Menu message listeners
  onMenuNewEntry: (callback: () => void) => {
    ipcRenderer.on('menu-new-entry', () => callback());
  },

  onMenuImport: (callback: (format: 'json' | 'markdown') => void) => {
    ipcRenderer.on('menu-import', (_event, format) => callback(format));
  },

  onMenuExport: (callback: (format: ExportFormat) => void) => {
    ipcRenderer.on('menu-export', (_event, format) => callback(format));
  },

  removeMenuListeners: () => {
    ipcRenderer.removeAllListeners('menu-new-entry');
    ipcRenderer.removeAllListeners('menu-import');
    ipcRenderer.removeAllListeners('menu-export');
  },
});

