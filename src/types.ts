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

declare global {
  interface Window {
    electronAPI: {
      getEntries: (startDate: string, endDate: string) => Promise<JournalEntry[]>;
      getEntry: (date: string, timeRange: TimeRange) => Promise<JournalEntry | null>;
      saveEntry: (entry: JournalEntry) => Promise<void>;
      deleteEntry: (date: string, timeRange: TimeRange) => Promise<void>;
      searchEntries: (query: string) => Promise<JournalEntry[]>;
      getEntriesByRange: (range: TimeRange, value: number) => Promise<JournalEntry[]>;
    };
  }
}

