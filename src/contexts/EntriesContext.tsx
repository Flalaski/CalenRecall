import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { JournalEntry } from '../types';
import { buildEntryLookup, addEntryToLookup, removeEntryFromLookup, updateEntryInLookup, type EntryLookup } from '../utils/entryLookupUtils';
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
    // Early return if entries array is empty
    if (entries.length === 0) {
      if (lookupRef.current === null) {
        // Create empty lookup structure
        const emptyLookup = buildEntryLookup([], 0);
        lookupRef.current = emptyLookup;
        return emptyLookup;
      }
      return lookupRef.current;
    }
    
    // Create a simple hash from entry IDs and dates to detect changes
    // Use a more efficient hash calculation for large arrays
    let entriesHash: string;
    if (entries.length > 1000) {
      // For large arrays, use a faster hash (first 10 + last 10 + length)
      const first = entries.slice(0, 10).map(e => `${e.id || 'new'}-${e.date}`).join('|');
      const last = entries.slice(-10).map(e => `${e.id || 'new'}-${e.date}`).join('|');
      entriesHash = `${first}|...|${last}|${entries.length}`;
    } else {
      entriesHash = entries.map(e => `${e.id || 'new'}-${e.date}`).join('|');
    }
    
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

  // OPTIMIZATION: Incremental lookup mutation — add entry to lookup in O(1)
  // instead of triggering full O(n) rebuild on every mutation.
  // Mutates lookupRef.current in-place, then syncs hash refs so useMemo returns it directly.
  const addEntry = useCallback((entry: JournalEntry) => {
    // Mutate lookup in-place (O(1))
    if (lookupRef.current) {
      addEntryToLookup(lookupRef.current, entry, 0);
    }
    setEntries(prev => {
      const next = [...prev, entry];
      // Sync hash refs so useMemo returns existing (already-mutated) lookup
      prevEntriesLengthRef.current = next.length;
      prevEntriesHashRef.current = next.length > 1000
        ? `${next.slice(0,10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|...|${next.slice(-10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|${next.length}`
        : next.map(e => `${e.id || 'new'}-${e.date}`).join('|');
      return next;
    });
  }, []);

  const updateEntry = useCallback((updatedEntry: JournalEntry) => {
    // Find old entry to remove from lookup, then add updated
    if (lookupRef.current) {
      const oldEntry = lookupRef.current.byDateString.get(updatedEntry.date)
        ?.find(e => e.id === updatedEntry.id);
      if (oldEntry) {
        updateEntryInLookup(lookupRef.current, oldEntry, updatedEntry, 0);
      } else {
        // Fallback: old entry not found in byDateString, try removing by ID
        removeEntryFromLookup(lookupRef.current, updatedEntry.id!);
        addEntryToLookup(lookupRef.current, updatedEntry, 0);
      }
    }
    setEntries(prev => {
      const next = prev.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry);
      // Sync hash refs
      prevEntriesLengthRef.current = next.length;
      prevEntriesHashRef.current = next.length > 1000
        ? `${next.slice(0,10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|...|${next.slice(-10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|${next.length}`
        : next.map(e => `${e.id || 'new'}-${e.date}`).join('|');
      return next;
    });
  }, []);

  const removeEntry = useCallback((entryId: number) => {
    // Remove from lookup in-place (O(1))
    if (lookupRef.current) {
      removeEntryFromLookup(lookupRef.current, entryId);
    }
    setEntries(prev => {
      const next = prev.filter(entry => entry.id !== entryId);
      // Sync hash refs
      prevEntriesLengthRef.current = next.length;
      prevEntriesHashRef.current = next.length > 1000
        ? `${next.slice(0,10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|...|${next.slice(-10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|${next.length}`
        : next.map(e => `${e.id || 'new'}-${e.date}`).join('|');
      return next;
    });
  }, []);

  // Listen for saved entry events — use incremental update instead of full reload
  useEffect(() => {
    const handleEntrySaved = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      // If we have saved entry data, update the lookup incrementally (O(1))
      if (detail?.entry) {
        const entry = detail.entry as JournalEntry;
        if (entry.id) {
          // Check if this is an update or new entry by looking in current entries
          setEntries(prev => {
            const exists = prev.some(e => e.id === entry.id);
            if (exists) {
              // Update existing — mutate lookup in-place
              if (lookupRef.current) {
                // Find old version
                const oldEntry = prev.find(e => e.id === entry.id);
                if (oldEntry) {
                  updateEntryInLookup(lookupRef.current, oldEntry, entry, 0);
                }
              }
              const next = prev.map(e => e.id === entry.id ? entry : e);
              prevEntriesLengthRef.current = next.length;
              prevEntriesHashRef.current = next.length > 1000
                ? `${next.slice(0,10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|...|${next.slice(-10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|${next.length}`
                : next.map(e => `${e.id || 'new'}-${e.date}`).join('|');
              return next;
            } else {
              // New entry — add to lookup in-place
              if (lookupRef.current) {
                addEntryToLookup(lookupRef.current, entry, 0);
              }
              const next = [...prev, entry];
              prevEntriesLengthRef.current = next.length;
              prevEntriesHashRef.current = next.length > 1000
                ? `${next.slice(0,10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|...|${next.slice(-10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|${next.length}`
                : next.map(e => `${e.id || 'new'}-${e.date}`).join('|');
              return next;
            }
          });
        }
        return;
      }
      
      // Deleted entry — remove from lookup in-place
      if (detail?.deleted && detail?.entryId) {
        if (lookupRef.current) {
          removeEntryFromLookup(lookupRef.current, detail.entryId);
        }
        setEntries(prev => {
          const next = prev.filter(e => e.id !== detail.entryId);
          prevEntriesLengthRef.current = next.length;
          prevEntriesHashRef.current = next.length > 1000
            ? `${next.slice(0,10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|...|${next.slice(-10).map(e=>`${e.id||'new'}-${e.date}`).join('|')}|${next.length}`
            : next.map(e => `${e.id || 'new'}-${e.date}`).join('|');
          return next;
        });
        return;
      }
      
      // Fallback: no detail data — do full reload (legacy support)
      try {
        if (window.electronAPI) {
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

  // OPTIMIZATION: Memoize context value to prevent unnecessary re-renders
  // Only recreate when actual values change
  const contextValue = useMemo(() => ({
    entries,
    setEntries,
    addEntry,
    updateEntry,
    removeEntry,
    isLoading,
    setIsLoading,
    entryLookup,
    entryColors,
  }), [entries, isLoading, entryLookup, entryColors, addEntry, updateEntry, removeEntry]);

  return (
    <EntriesContext.Provider value={contextValue}>
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

