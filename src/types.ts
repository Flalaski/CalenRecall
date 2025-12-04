export interface JournalEntry {
  id?: number;
  date: string; // ISO date string (YYYY-MM-DD) - canonical date for the time range
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'; // Time scale for this entry
  title: string;
  content: string;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
  tags?: string[];
}

export type TimeRange = 'decade' | 'year' | 'month' | 'week' | 'day';

export type ExportFormat = 'markdown' | 'text' | 'json' | 'rtf' | 'pdf' | 'dec';

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
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  showMinimap?: boolean;
  minimapPosition?: 'left' | 'right' | 'top' | 'bottom';
  minimapSize?: 'small' | 'medium' | 'large';
  restoreLastView?: boolean;
  lastViewedDate?: string;
  lastViewedMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
}

declare global {
  interface Window {
    electronAPI: {
      getEntries: (startDate: string, endDate: string) => Promise<JournalEntry[]>;
      getEntry: (date: string, timeRange: TimeRange) => Promise<JournalEntry | null>;
      getEntriesByDateRange: (date: string, timeRange: TimeRange) => Promise<JournalEntry[]>;
      saveEntry: (entry: JournalEntry) => Promise<void>;
      deleteEntry: (id: number) => Promise<void>;
      deleteEntryByDateRange: (date: string, timeRange: TimeRange) => Promise<void>;
      searchEntries: (query: string) => Promise<JournalEntry[]>;
      getEntriesByRange: (range: TimeRange, value: number) => Promise<JournalEntry[]>;
      exportEntries: (
        format: ExportFormat
      ) => Promise<{ success: boolean; canceled?: boolean; error?: string; path?: string }>;
      getPreference: <K extends keyof Preferences>(key: K) => Promise<Preferences[K]>;
      setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<{ success: boolean }>;
      getAllPreferences: () => Promise<Preferences>;
      resetPreferences: () => Promise<{ success: boolean }>;
      openPreferences: () => Promise<void>;
      closePreferencesWindow: () => Promise<void>;
    };
  }
}

