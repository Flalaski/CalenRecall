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

/**
 * Compute a change-detection hash for an entries array.
 * For large arrays, samples first 10 + last 10 + length (fast, adequate).
 */
function computeEntriesHash(list: JournalEntry[]): string {
  if (list.length > 1000) {
    const first = list.slice(0, 10).map(e => `${e.id || 'new'}-${e.date}`).join('|');
    const last = list.slice(-10).map(e => `${e.id || 'new'}-${e.date}`).join('|');
    return `${first}|...|${last}|${list.length}`;
  }
  return list.map(e => `${e.id || 'new'}-${e.date}`).join('|');
}

export function EntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use ref to track previous entries length to avoid unnecessary rebuilds
  const prevEntriesLengthRef = useRef<number>(0);
  const prevEntriesHashRef = useRef<string>('');

  // Store previous lookup in ref to maintain stability
  const lookupRef = useRef<EntryLookup | null>(null);

  // Always-current entries array for event handlers / incremental mutations.
  // Synced on every commit; mutation helpers also update it eagerly so
  // back-to-back mutations (before React commits) see the latest data.
  const entriesRef = useRef<JournalEntry[]>([]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Sync hash refs so the entryLookup useMemo recognizes `next` as already
  // reflected in lookupRef (mutated incrementally) and skips a full rebuild.
  const syncHashRefs = useCallback((next: JournalEntry[]) => {
    prevEntriesLengthRef.current = next.length;
    prevEntriesHashRef.current = computeEntriesHash(next);
  }, []);

  // STALE-MEMO FIX: after mutating the lookup in place, shallow-clone it so
  // its reference changes. Consumers key useMemo/useCallback on the lookup
  // reference — without this bump, incremental mutations left memoized view
  // data (year/decade pixel maps, entry lists) permanently stale.
  const bumpLookup = useCallback(() => {
    if (lookupRef.current) {
      lookupRef.current = { ...lookupRef.current };
    }
  }, []);
  
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
    const entriesHash = computeEntriesHash(entries);
    
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
  // Mutates lookupRef.current in-place, bumps its reference so consumer memos
  // recompute, then syncs hash refs so useMemo skips the full rebuild.
  const addEntry = useCallback((entry: JournalEntry) => {
    // Mutate lookup in-place (O(1)), then bump reference for memo invalidation
    if (lookupRef.current) {
      addEntryToLookup(lookupRef.current, entry, 0);
      bumpLookup();
    }
    const next = [...entriesRef.current, entry];
    entriesRef.current = next;
    syncHashRefs(next);
    setEntries(next);
  }, [bumpLookup, syncHashRefs]);

  const updateEntry = useCallback((updatedEntry: JournalEntry) => {
    // Find the old version from the authoritative entries list — works for
    // every tier. (The previous byDateString-only search missed week/month/
    // year/decade entries and entries whose date changed, forcing an O(n)
    // full-map scan fallback.)
    if (lookupRef.current) {
      const oldEntry = entriesRef.current.find(e => e.id === updatedEntry.id);
      if (oldEntry) {
        updateEntryInLookup(lookupRef.current, oldEntry, updatedEntry, 0);
      } else {
        // Fallback: old entry unknown — remove by ID scan, then add
        removeEntryFromLookup(lookupRef.current, updatedEntry.id!);
        addEntryToLookup(lookupRef.current, updatedEntry, 0);
      }
      bumpLookup();
    }
    const next = entriesRef.current.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry);
    entriesRef.current = next;
    syncHashRefs(next);
    setEntries(next);
  }, [bumpLookup, syncHashRefs]);

  const removeEntry = useCallback((entryId: number) => {
    // Targeted O(1) removal using the entry object as a hint (falls back to
    // a full scan inside removeEntryFromLookup only if the hint is stale)
    if (lookupRef.current) {
      const entryHint = entriesRef.current.find(e => e.id === entryId);
      removeEntryFromLookup(lookupRef.current, entryId, entryHint, 0);
      bumpLookup();
    }
    const next = entriesRef.current.filter(entry => entry.id !== entryId);
    entriesRef.current = next;
    syncHashRefs(next);
    setEntries(next);
  }, [bumpLookup, syncHashRefs]);

  // Listen for saved entry events — use incremental update instead of full reload
  useEffect(() => {
    const handleEntrySaved = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      // If we have saved entry data, update the lookup incrementally (O(1)).
      // NOTE: lookup mutations happen OUTSIDE setEntries — updater functions
      // can be double-invoked (React StrictMode), which previously added the
      // entry to the lookup twice.
      if (detail?.entry) {
        const entry = detail.entry as JournalEntry;
        if (entry.id) {
          const prev = entriesRef.current;
          const oldEntry = prev.find(en => en.id === entry.id);
          if (lookupRef.current) {
            if (oldEntry) {
              updateEntryInLookup(lookupRef.current, oldEntry, entry, 0);
            } else {
              addEntryToLookup(lookupRef.current, entry, 0);
            }
            bumpLookup();
          }
          const next = oldEntry
            ? prev.map(en => (en.id === entry.id ? entry : en))
            : [...prev, entry];
          entriesRef.current = next;
          syncHashRefs(next);
          setEntries(next);
        }
        return;
      }
      
      // Deleted entry — targeted removal via entry hint
      if (detail?.deleted && detail?.entryId) {
        const prev = entriesRef.current;
        if (lookupRef.current) {
          const entryHint = prev.find(en => en.id === detail.entryId);
          removeEntryFromLookup(lookupRef.current, detail.entryId, entryHint, 0);
          bumpLookup();
        }
        const next = prev.filter(en => en.id !== detail.entryId);
        entriesRef.current = next;
        syncHashRefs(next);
        setEntries(next);
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
  }, [bumpLookup, syncHashRefs]);

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

