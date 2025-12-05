export interface JournalEntry {
  id?: number;
  date: string; // ISO date string (YYYY-MM-DD) - canonical date for the time range
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'; // Time scale for this entry
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

export type ExportFormat = 'markdown' | 'text' | 'json' | 'rtf' | 'pdf' | 'dec';

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
  fontSize?: 'small' | 'medium' | 'large';
  showMinimap?: boolean;
  minimapPosition?: 'left' | 'right' | 'top' | 'bottom';
  minimapSize?: 'small' | 'medium' | 'large';
  restoreLastView?: boolean;
  lastViewedDate?: string;
  lastViewedMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
  defaultCalendar?: string; // Calendar system (e.g., 'gregorian', 'islamic', 'hebrew')
  showMultipleCalendars?: boolean; // Show date in multiple calendars simultaneously
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
      saveEntry: (entry: JournalEntry) => Promise<void>;
      deleteEntry: (id: number) => Promise<void>;
      deleteEntryByDateRange: (date: string, timeRange: TimeRange) => Promise<void>;
      searchEntries: (query: string) => Promise<JournalEntry[]>;
      getEntriesByRange: (range: TimeRange, value: number) => Promise<JournalEntry[]>;
      getAllEntries: () => Promise<JournalEntry[]>;
      exportEntries: (
        format: ExportFormat
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
    };
  }
}

