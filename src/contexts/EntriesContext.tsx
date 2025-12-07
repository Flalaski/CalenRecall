import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

