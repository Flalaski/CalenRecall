import { contextBridge, ipcRenderer } from 'electron';
import { JournalEntry, TimeRange } from './types';

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
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Journal entry operations
  getEntries: (startDate: string, endDate: string): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-entries', startDate, endDate),
  
  getEntry: (date: string, timeRange: TimeRange): Promise<JournalEntry | null> =>
    ipcRenderer.invoke('get-entry', date, timeRange),
  
  saveEntry: (entry: JournalEntry): Promise<void> =>
    ipcRenderer.invoke('save-entry', entry),
  
  deleteEntry: (date: string, timeRange: TimeRange): Promise<void> =>
    ipcRenderer.invoke('delete-entry', date, timeRange),
  
  searchEntries: (query: string): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('search-entries', query),
  
  getEntriesByRange: (range: TimeRange, value: number): Promise<JournalEntry[]> =>
    ipcRenderer.invoke('get-entries-by-range', range, value),
  
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
});

