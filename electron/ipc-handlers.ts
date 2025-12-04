import { ipcMain } from 'electron';
import {
  getEntries,
  getEntry,
  saveEntry,
  deleteEntry,
  searchEntries,
  getEntriesByRange,
  getPreference,
  setPreference,
  getAllPreferences,
  resetPreferences,
  Preferences,
} from './database';
import { JournalEntry, TimeRange } from './types';

export function setupIpcHandlers() {
  ipcMain.handle('get-entries', async (_event, startDate: string, endDate: string) => {
    return getEntries(startDate, endDate);
  });

  ipcMain.handle('get-entry', async (_event, date: string, timeRange: TimeRange) => {
    return getEntry(date, timeRange);
  });

  ipcMain.handle('save-entry', async (_event, entry: JournalEntry) => {
    try {
      console.log('IPC save-entry handler called');
      saveEntry(entry);
      console.log('IPC save-entry completed');
      return { success: true };
    } catch (error) {
      console.error('IPC save-entry error:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-entry', async (_event, date: string, timeRange: TimeRange) => {
    deleteEntry(date, timeRange);
  });

  ipcMain.handle('search-entries', async (_event, query: string) => {
    return searchEntries(query);
  });

  ipcMain.handle('get-entries-by-range', async (_event, range: TimeRange, value: number) => {
    return getEntriesByRange(range, value);
  });

  // Preferences handlers
  ipcMain.handle('get-preference', async (_event, key: keyof Preferences) => {
    return getPreference(key);
  });

  ipcMain.handle('set-preference', async (_event, key: keyof Preferences, value: any) => {
    setPreference(key, value);
    return { success: true };
  });

  ipcMain.handle('get-all-preferences', async () => {
    return getAllPreferences();
  });

  ipcMain.handle('reset-preferences', async () => {
    resetPreferences();
    return { success: true };
  });
}

