import { createContext, useContext, useState, ReactNode } from 'react';
import { JournalEntry } from '../types';

interface EntriesContextType {
  entries: JournalEntry[];
  setEntries: (entries: JournalEntry[]) => void;
  addEntry: (entry: JournalEntry) => void;
  updateEntry: (entry: JournalEntry) => void;
  removeEntry: (entryId: number) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const EntriesContext = createContext<EntriesContextType | undefined>(undefined);

export function EntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

