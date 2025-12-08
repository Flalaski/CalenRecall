export interface JournalEntry {
  id?: number;
  date: string; // ISO date string (YYYY-MM-DD) - canonical date for the time range
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'; // Time scale for this entry
  hour?: number | null; // Optional hour (0-23), null when cleared
  minute?: number | null; // Optional minute (0-59), null when cleared
  second?: number | null; // Optional second (0-59), null when cleared
  title: string;
  content: string;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
  tags?: string[];
  linkedEntries?: number[]; // Array of entry IDs this entry is linked to
  archived?: boolean; // Whether this entry is archived
  pinned?: boolean; // Whether this entry is pinned/favorited
  attachments?: EntryAttachment[]; // Array of file attachments
}

export interface EntryAttachment {
  id: string; // Unique identifier for the attachment
  fileName: string; // Original file name
  filePath: string; // Path where file is stored
  fileSize: number; // File size in bytes
  mimeType: string; // MIME type of the file
  createdAt: string; // When attachment was added
}

export type TimeRange = 'decade' | 'year' | 'month' | 'week' | 'day';

export type ExportFormat = 'markdown' | 'text' | 'json' | 'rtf' | 'pdf' | 'dec' | 'csv';

export interface ExportMetadata {
  // Project/Export Identity
  projectTitle?: string; // Title of the export/project
  exportName?: string; // Name for this specific export
  
  // Identity
  author?: string; // Author/creator name
  organization?: string; // Organization or institution
  department?: string; // Department or division
  contactEmail?: string; // Contact email address
  contactPhone?: string; // Contact phone number
  website?: string; // Website URL
  
  // Context
  description?: string; // Description of the export/project
  purpose?: string; // Purpose of the export
  exportPurpose?: 'personal' | 'academic' | 'professional' | 'publication' | 'backup' | 'archive' | 'research' | 'legal' | 'other'; // Type of purpose
  context?: string; // Additional context information
  background?: string; // Background information
  
  // Versioning
  version?: string; // Version number
  versionDate?: string; // Version date
  
  // Classification
  classification?: 'public' | 'internal' | 'confidential' | 'private' | 'restricted'; // Sensitivity/classification level
  keywords?: string[]; // Keywords/tags for the export
  subject?: string; // Subject category
  
  // Legal/Copyright
  copyright?: string; // Copyright notice
  license?: string; // License information
  rights?: string; // Rights statement
  
  // Dates
  dateRangeStart?: string; // Start date of exported content (ISO date)
  dateRangeEnd?: string; // End date of exported content (ISO date)
  exportDate?: string; // Export creation date (ISO datetime)
  
  // References
  relatedDocuments?: string; // Related documents or references
  citation?: string; // Citation information
  source?: string; // Source information
  
  // Notes
  notes?: string; // Additional notes about the export
  instructions?: string; // Instructions for use
  acknowledgments?: string; // Acknowledgments
  
  // Thematic Construct
  exportTheme?: string; // Theme name to use as a thematic construct for the export
}

export interface EntryVersion {
  id: number;
  entryId: number;
  date: string;
  timeRange: TimeRange;
  title: string;
  content: string;
  tags: string[];
  linkedEntries: number[];
  createdAt: string;
  versionCreatedAt: string;
}

export interface EntryTemplate {
  id?: number;
  name: string;
  title?: string;
  content: string;
  tags?: string[];
  timeRange?: TimeRange;
  createdAt: string;
  updatedAt: string;
}

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
  theme?: string; // Theme name - dynamically discovered from themes folder
  fontSize?: 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';
  showMinimap?: boolean;
  minimapPosition?: 'left' | 'right' | 'top' | 'bottom';
  minimapSize?: 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';
  minimapCrystalUseDefaultColors?: boolean; // Override minimap crystal theming to always use default colors
  restoreLastView?: boolean;
  lastViewedDate?: string;
  lastViewedMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
  defaultCalendar?: string; // Calendar system (e.g., 'gregorian', 'islamic', 'hebrew')
  showMultipleCalendars?: boolean; // Show date in multiple calendars simultaneously
  backgroundImage?: string; // Path to custom background image, or empty for procedural art
  timeFormat?: '12h' | '24h'; // Time format: 12-hour (AM/PM) or 24-hour
  defaultExportFormat?: ExportFormat; // Default export format to use when exporting entries
  defaultExportMetadata?: ExportMetadata; // Default export metadata to use for all exports
  soundEffectsEnabled?: boolean; // Whether sound effects are enabled
  showAstromonixToolbarButton?: boolean; // Whether to show the AstroMonix toolbar button in day view
}

declare global {
  interface Window {
    electronAPI: {
      getEntries: (startDate: string, endDate: string) => Promise<JournalEntry[]>;
      getEntry: (date: string, timeRange: TimeRange) => Promise<JournalEntry | null>;
      getEntryById: (id: number) => Promise<JournalEntry | null>;
      getEntryVersions: (entryId: number) => Promise<EntryVersion[]>;
      archiveEntry: (id: number) => Promise<{ success: boolean }>;
      unarchiveEntry: (id: number) => Promise<{ success: boolean }>;
      getArchivedEntries: () => Promise<JournalEntry[]>;
      pinEntry: (id: number) => Promise<{ success: boolean }>;
      unpinEntry: (id: number) => Promise<{ success: boolean }>;
      getPinnedEntries: () => Promise<JournalEntry[]>;
      getAllTemplates: () => Promise<EntryTemplate[]>;
      getTemplate: (id: number) => Promise<EntryTemplate | null>;
      saveTemplate: (template: EntryTemplate) => Promise<{ success: boolean }>;
      deleteTemplate: (id: number) => Promise<{ success: boolean }>;
      addEntryAttachment: (entryId: number) => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; attachment?: EntryAttachment }>;
      removeEntryAttachment: (entryId: number, attachmentId: string) => Promise<{ success: boolean; error?: string; message?: string }>;
      getAttachmentPath: (entryId: number, attachmentId: string) => Promise<{ success: boolean; error?: string; path?: string }>;
      getEntriesByDateRange: (date: string, timeRange: TimeRange) => Promise<JournalEntry[]>;
      saveEntry: (entry: JournalEntry) => Promise<{ success: boolean; entry: JournalEntry }>;
      deleteEntry: (id: number) => Promise<void>;
      deleteEntryByDateRange: (date: string, timeRange: TimeRange) => Promise<void>;
      searchEntries: (query: string) => Promise<JournalEntry[]>;
      getEntriesByRange: (range: TimeRange, value: number) => Promise<JournalEntry[]>;
      getAllEntries: () => Promise<JournalEntry[]>;
      exportEntries: (
        format: ExportFormat,
        metadata?: ExportMetadata
      ) => Promise<{ success: boolean; canceled?: boolean; error?: string; path?: string }>;
      importEntries: (
        format: 'json' | 'markdown'
      ) => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; imported?: number; skipped?: number; total?: number }>;
      backupDatabase: () => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; path?: string }>;
      restoreDatabase: () => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string }>;
      getPreference: <K extends keyof Preferences>(key: K) => Promise<Preferences[K]>;
      setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<{ success: boolean }>;
      getAllPreferences: () => Promise<Preferences>;
      resetPreferences: () => Promise<{ success: boolean }>;
      openPreferences: () => Promise<void>;
      closePreferencesWindow: () => Promise<void>;
      onImportProgress: (callback: (progress: { stage: string; progress: number; message: string; total?: number; imported?: number; skipped?: number }) => void) => void;
      removeImportProgressListener: () => void;
      selectBackgroundImage: () => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; path?: string; fullPath?: string }>;
      clearBackgroundImage: () => Promise<{ success: boolean; error?: string; message?: string }>;
      getBackgroundImagePath: () => Promise<{ success: boolean; error?: string; message?: string; path?: string | null }>;
      onPreferenceUpdated: (callback: (data: { key: string; value: any }) => void) => void;
      removePreferenceUpdatedListener: () => void;
      onMenuNewEntry: (callback: () => void) => void;
      onMenuImport: (callback: (format: 'json' | 'markdown') => void) => void;
      onMenuExport: (callback: (format: ExportFormat) => void) => void;
      removeMenuListeners: () => void;
      openExternalUrl: (url: string, width: number, height: number) => Promise<{ success: boolean; error?: string }>;
      openExternalBrowser: (url: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

