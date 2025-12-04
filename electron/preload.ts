import { contextBridge, ipcRenderer } from 'electron';
import { JournalEntry, TimeRange } from './types';

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
});

