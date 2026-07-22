/**
 * Unit tests for journalService
 * Tests the data access layer wrapping window.electronAPI IPC calls.
 */

import { getEntryForDate, saveJournalEntry, deleteJournalEntry, searchJournalEntries, getEntriesForRange } from '../journalService';
import { JournalEntry } from '../../types';

// Mock window.electronAPI
const mockElectronAPI = {
  getEntry: jest.fn(),
  saveEntry: jest.fn(),
  deleteEntry: jest.fn(),
  searchEntries: jest.fn(),
  getEntriesByRange: jest.fn(),
  getAllEntries: jest.fn(),
};

beforeEach(() => {
  (global as any).window = {};
  (global as any).window.electronAPI = mockElectronAPI;
  jest.clearAllMocks();
});

afterEach(() => {
  delete (global as any).window.electronAPI;
});

describe('getEntryForDate', () => {
  it('calls electronAPI.getEntry with correct parameters', async () => {
    mockElectronAPI.getEntry.mockResolvedValue({ id: 1, date: '2024-01-15', timeRange: 'day' });
    
    const result = await getEntryForDate(new Date(2024, 0, 15), 'day');
    
    expect(mockElectronAPI.getEntry).toHaveBeenCalledWith('2024-01-15', 'day');
    expect(result).toEqual({ id: 1, date: '2024-01-15', timeRange: 'day' });
  });

  it('throws when electronAPI is not available', async () => {
    delete (global as any).window.electronAPI;
    
    await expect(getEntryForDate(new Date(2024, 0, 15), 'day')).rejects.toThrow('Electron API not available');
  });

  it('returns null when no entry exists', async () => {
    mockElectronAPI.getEntry.mockResolvedValue(null);
    
    const result = await getEntryForDate(new Date(2024, 0, 15), 'day');
    expect(result).toBeNull();
  });
});

describe('saveJournalEntry', () => {
  it('calls electronAPI.saveEntry with the entry', async () => {
    const entry: JournalEntry = {
      date: '2024-01-15',
      timeRange: 'day',
      title: 'Test',
      content: 'Content',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    
    mockElectronAPI.saveEntry.mockResolvedValue({ entry: { ...entry, id: 1 } });
    
    const result = await saveJournalEntry(entry);
    expect(mockElectronAPI.saveEntry).toHaveBeenCalledWith(entry);
    expect(result.id).toBe(1);
  });

  it('returns raw entry when result has no entry field', async () => {
    const entry: JournalEntry = {
      date: '2024-01-15',
      timeRange: 'day',
      title: 'Test',
      content: 'Content',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    
    mockElectronAPI.saveEntry.mockResolvedValue({ success: true });
    
    const result = await saveJournalEntry(entry);
    expect(result).toEqual(entry);
  });
});

describe('deleteJournalEntry', () => {
  it('calls electronAPI.deleteEntry with the entry ID', async () => {
    mockElectronAPI.deleteEntry.mockResolvedValue(undefined);
    
    await deleteJournalEntry(42);
    expect(mockElectronAPI.deleteEntry).toHaveBeenCalledWith(42);
  });

  it('throws when electronAPI is not available', async () => {
    delete (global as any).window.electronAPI;
    await expect(deleteJournalEntry(42)).rejects.toThrow('Electron API not available');
  });
});

describe('searchJournalEntries', () => {
  it('calls electronAPI.searchEntries with the query', async () => {
    mockElectronAPI.searchEntries.mockResolvedValue([{ id: 1, title: 'Test' }]);
    
    const result = await searchJournalEntries('test');
    expect(mockElectronAPI.searchEntries).toHaveBeenCalledWith('test');
    expect(result).toHaveLength(1);
  });
});

describe('getEntriesForRange', () => {
  it('calls electronAPI.getEntriesByRange with decade params', async () => {
    mockElectronAPI.getEntriesByRange.mockResolvedValue([]);
    
    await getEntriesForRange('decade', new Date(2024, 0, 15));
    
    expect(mockElectronAPI.getEntriesByRange).toHaveBeenCalled();
    const call = mockElectronAPI.getEntriesByRange.mock.calls[0];
    expect(call[0]).toBe('decade');
    expect(typeof call[1]).toBe('number');
  });

  it('calls electronAPI.getEntriesByRange with year params', async () => {
    mockElectronAPI.getEntriesByRange.mockResolvedValue([]);
    
    await getEntriesForRange('year', new Date(2024, 5, 15));
    
    expect(mockElectronAPI.getEntriesByRange).toHaveBeenCalledWith('year', 2024);
  });

  it('calls electronAPI.getEntriesByRange with month params', async () => {
    mockElectronAPI.getEntriesByRange.mockResolvedValue([]);
    
    await getEntriesForRange('month', new Date(2024, 0, 15));
    
    expect(mockElectronAPI.getEntriesByRange).toHaveBeenCalledWith('month', 2024 * 12 + 0);
  });
});
