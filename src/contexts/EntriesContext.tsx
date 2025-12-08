import { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { JournalEntry } from '../types';
import { buildEntryLookup, type EntryLookup } from '../utils/entryLookupUtils';
import { calculateEntryColor } from '../utils/entryColorUtils';

interface EntriesContextType {
  entries: JournalEntry[];
  setEntries: (entries: JournalEntry[]) => void;
  addEntry: (entry: JournalEntry) => void;
  updateEntry: (entry: JournalEntry) => void;
  removeEntry: (entryId: number) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  // Stable lookup structure that persists across renders
  entryLookup: EntryLookup;
  // Pre-computed entry colors by entry ID
  entryColors: Map<number, string>;
}

const EntriesContext = createContext<EntriesContextType | undefined>(undefined);

export function EntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use ref to track previous entries length to avoid unnecessary rebuilds
  const prevEntriesLengthRef = useRef<number>(0);
  const prevEntriesHashRef = useRef<string>('');

  // Store previous lookup in ref to maintain stability
  const lookupRef = useRef<EntryLookup | null>(null);
  
  // Build stable lookup structure - only rebuild when entries actually change
  const entryLookup = useMemo(() => {
    // Create a simple hash from entry IDs and dates to detect changes
    const entriesHash = entries.map(e => `${e.id || 'new'}-${e.date}`).join('|');
    
    // Only rebuild if entries actually changed (not just reference)
    if (entriesHash === prevEntriesHashRef.current && 
        entries.length === prevEntriesLengthRef.current && 
        lookupRef.current !== null) {
      // Return previous lookup if entries haven't changed
      return lookupRef.current;
    }
    
    prevEntriesHashRef.current = entriesHash;
    prevEntriesLengthRef.current = entries.length;
    
    // Build new lookup and store in ref
    const newLookup = buildEntryLookup(entries, 0); // Default weekStartsOn to 0, can be overridden in components
    lookupRef.current = newLookup;
    return newLookup;
  }, [entries]);

  // Pre-compute entry colors for all entries - do this once when lookup is built
  const entryColors = useMemo(() => {
    const colorMap = new Map<number, string>();
    for (const entry of entries) {
      if (entry.id !== undefined) {
        // Calculate and cache color for this entry
        colorMap.set(entry.id, calculateEntryColor(entry));
      }
    }
    return colorMap;
  }, [entries]);

  const addEntry = (entry: JournalEntry) => {
    setEntries(prev => [...prev, entry]);
  };

  const updateEntry = (updatedEntry: JournalEntry) => {
    setEntries(prev => 
      prev.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry)
    );
  };

  const removeEntry = (entryId: number) => {
    setEntries(prev => prev.filter(entry => entry.id !== entryId));
  };

  // Reload entries from database when a new entry is saved
  useEffect(() => {
    const handleEntrySaved = async () => {
      try {
        if (window.electronAPI) {
          // Reload all entries from database to ensure we have the latest data
          const allEntries = await window.electronAPI.getAllEntries();
          setEntries(allEntries);
        }
      } catch (error) {
        console.error('Error reloading entries after save:', error);
      }
    };

    window.addEventListener('journalEntrySaved', handleEntrySaved);
    
    return () => {
      window.removeEventListener('journalEntrySaved', handleEntrySaved);
    };
  }, []);

  return (
    <EntriesContext.Provider
      value={{
        entries,
        setEntries,
        addEntry,
        updateEntry,
        removeEntry,
        isLoading,
        setIsLoading,
        entryLookup,
        entryColors,
      }}
    >
      {children}
    </EntriesContext.Provider>
  );
}

export function useEntries() {
  const context = useContext(EntriesContext);
  if (context === undefined) {
    throw new Error('useEntries must be used within an EntriesProvider');
  }
  return context;
}

