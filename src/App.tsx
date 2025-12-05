import { useState, useEffect, useRef } from 'react';
import TimelineView from './components/TimelineView';
import JournalEditor from './components/JournalEditor';
import EntryViewer from './components/EntryViewer';
import NavigationBar from './components/NavigationBar';
import GlobalTimelineMinimap from './components/GlobalTimelineMinimap';
import EntryEditModal from './components/EntryEditModal';
import SearchView from './components/SearchView';
import { TimeRange, JournalEntry, Preferences } from './types';
import { getEntryForDate } from './services/journalService';
import { playNewEntrySound } from './utils/audioUtils';
import { formatDateToISO, parseISODate } from './utils/dateUtils';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<TimeRange>('month');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  
  // Track if initial load has completed - after this, default view mode should NEVER be applied
  const initialLoadCompleteRef = useRef(false);
  const hasUserInteractedRef = useRef(false);

  // Load preferences on startup - ONLY ONCE, on initial mount
  useEffect(() => {
    // Only run on the very first mount
    if (initialLoadCompleteRef.current) {
      return;
    }
    
    const loadPreferences = async () => {
      try {
        if (window.electronAPI) {
          const prefs = await window.electronAPI.getAllPreferences();
          setPreferences(prefs);
          
          // Restore last viewed position if enabled, otherwise use default view mode
          // This ONLY happens on initial load - never after user interaction
          if (prefs.restoreLastView && prefs.lastViewedDate && prefs.lastViewedMode) {
            const lastDate = new Date(prefs.lastViewedDate);
            const validTimeRanges: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
            const isValidDate = !isNaN(lastDate.getTime());
            const isValidMode = validTimeRanges.includes(prefs.lastViewedMode);
            
            if (isValidDate && isValidMode) {
              // Validate date is reasonable (not before year 1000 or after year 3000)
              const year = lastDate.getFullYear();
              if (year >= 1000 && year <= 3000) {
                setSelectedDate(lastDate);
                setViewMode(prefs.lastViewedMode);
              } else {
                // Date out of reasonable range, fall back to default (ONLY on initial load)
                if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                  setViewMode(prefs.defaultViewMode);
                }
              }
            } else {
              // Invalid date or mode, fall back to default (ONLY on initial load)
              if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                setViewMode(prefs.defaultViewMode);
              }
            }
          } else {
            // Apply default view mode (ONLY on initial load, before any user interaction)
            if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
              setViewMode(prefs.defaultViewMode);
            }
          }
          
          // Apply theme
          const theme = prefs.theme || 'light';
          document.documentElement.setAttribute('data-theme', theme);
          
          // Handle auto theme
          if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            
            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
              document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            });
          }
          
          // Apply font size
          if (prefs.fontSize) {
            document.documentElement.setAttribute('data-font-size', prefs.fontSize);
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setPreferencesLoaded(true);
        initialLoadCompleteRef.current = true; // Mark initial load as complete
      }
    };
    
    loadPreferences();
    
    // Check for preference updates periodically (when preferences window closes)
    // NOTE: Do NOT reset viewMode to default - default view mode only applies on initial load
    const interval = setInterval(() => {
      if (window.electronAPI) {
        window.electronAPI.getAllPreferences().then(prefs => {
          setPreferences(prefs);
          // NEVER reset viewMode - user's current view should always be preserved
          // Default view mode is ONLY applied on the very first load, never after
          const theme = prefs.theme || 'light';
          document.documentElement.setAttribute('data-theme', theme);
          
          // Handle auto theme
          if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
          }
          if (prefs.fontSize) {
            document.documentElement.setAttribute('data-font-size', prefs.fontSize);
          }
        }).catch(console.error);
      }
    }, 1000);
    
    return () => clearInterval(interval);
    // Empty dependency array - this effect ONLY runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save last viewed position when date or view mode changes (if restoreLastView is enabled)
  // Use a ref to track if we're in the initial restore phase to avoid saving during restoration
  const isRestoringRef = useRef(true);
  
  useEffect(() => {
    // After preferences are loaded, allow saving
    if (preferencesLoaded) {
      // Small delay to ensure restoration has completed
      const timer = setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [preferencesLoaded]);

  useEffect(() => {
    // Only save if preferences are loaded, restore is enabled, and we're not in the restoration phase
    if (preferencesLoaded && !isRestoringRef.current && preferences.restoreLastView && window.electronAPI) {
      try {
        // Use formatDateToISO to handle negative years correctly
        const dateString = formatDateToISO(selectedDate);
        // Validate date string format (YYYY-MM-DD or -YYYY-MM-DD for negative years)
        if (/^-?\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          window.electronAPI.setPreference('lastViewedDate', dateString).catch(console.error);
          window.electronAPI.setPreference('lastViewedMode', viewMode).catch(console.error);
        }
      } catch (error) {
        console.error('Error saving last viewed position:', error);
      }
    }
  }, [selectedDate, viewMode, preferencesLoaded, preferences.restoreLastView]);

  // Load entry for current date/viewMode when they change
  useEffect(() => {
    if (!isNewEntry && !isEditing) {
      loadCurrentEntry();
    }
  }, [selectedDate, viewMode, isNewEntry, isEditing]);

  const loadCurrentEntry = async () => {
    try {
      const entry = await getEntryForDate(selectedDate, viewMode);
      setSelectedEntry(entry);
    } catch (error) {
      console.error('Error loading entry:', error);
      setSelectedEntry(null);
    }
  };

  const handleTimePeriodSelect = (date: Date, newViewMode: TimeRange) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    setSelectedDate(date);
    setViewMode(newViewMode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const handleViewModeChange = (mode: TimeRange) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    setViewMode(mode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    // Navigate to the entry's date and time range, then select the entry
    // Parse date string to avoid timezone issues (YYYY-MM-DD or -YYYY-MM-DD format)
    const entryDate = parseISODate(entry.date);
    setSelectedDate(entryDate);
    setViewMode(entry.timeRange);
    setSelectedEntry(entry);
    setIsNewEntry(false);
    setIsEditing(false);
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setIsNewEntry(true);
    setIsEditing(true);
  };

  // Use ref to access current handleNewEntry in keyboard handler
  const handleNewEntryRef = useRef(handleNewEntry);
  
  // Keep ref updated
  useEffect(() => {
    handleNewEntryRef.current = handleNewEntry;
  }, [handleNewEntry]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.closest('input') || target.closest('textarea') || target.closest('[contenteditable="true"]'))
      ) {
        return;
      }

      // Handle Ctrl+F or Cmd+F for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Handle Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        return;
      }

      // Only handle Shift+Spacebar for new entry (when search is not open)
      if (e.key === ' ' && e.shiftKey && !showSearch) {
        e.preventDefault();
        playNewEntrySound();
        handleNewEntryRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSearch]); // Include showSearch in deps

  const handleEdit = () => {
    setIsEditing(true);
    setIsNewEntry(false);
  };

  const handleEntrySaved = () => {
    // Reload the entry after saving
    setIsEditing(false);
    setIsNewEntry(false);
    loadCurrentEntry();
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
  };

  const handleModalClose = () => {
    setEditingEntry(null);
  };

  const handleModalEntrySaved = () => {
    // Refresh the current view
    loadCurrentEntry();
    setEditingEntry(null);
  };

  if (!preferencesLoaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <div className="app">
      <NavigationBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenPreferences={() => {
          if (window.electronAPI) {
            window.electronAPI.openPreferences();
          }
        }}
        onOpenSearch={() => setShowSearch(true)}
      />
      {preferences.showMinimap !== false && (
        <GlobalTimelineMinimap
          selectedDate={selectedDate}
          viewMode={viewMode}
          onTimePeriodSelect={handleTimePeriodSelect}
          onEntrySelect={handleEntrySelect}
          minimapSize={preferences.minimapSize || 'medium'}
        />
      )}
      <div className="app-content">
        <div className="timeline-section">
          <TimelineView
            selectedDate={selectedDate}
            viewMode={viewMode}
            onTimePeriodSelect={handleTimePeriodSelect}
            onEntrySelect={handleEntrySelect}
            onEditEntry={handleEditEntry}
          />
        </div>
        <div className="editor-section">
          {isEditing || isNewEntry ? (
            <JournalEditor
              date={selectedDate}
              viewMode={viewMode}
              selectedEntry={selectedEntry}
              isNewEntry={isNewEntry}
              onEntrySaved={handleEntrySaved}
              onCancel={() => {
                setIsEditing(false);
                setIsNewEntry(false);
                loadCurrentEntry();
              }}
            />
          ) : (
            <EntryViewer
              entry={selectedEntry}
              date={selectedDate}
              viewMode={viewMode}
              onEdit={handleEdit}
              onNewEntry={handleNewEntry}
              onEntrySelect={handleEntrySelect}
              onEditEntry={handleEditEntry}
              onEntryDuplicated={loadCurrentEntry}
            />
          )}
        </div>
      </div>
      {editingEntry && (
        <EntryEditModal
          entry={editingEntry}
          isOpen={true}
          onClose={handleModalClose}
          onEntrySaved={handleModalEntrySaved}
          onEntryDuplicated={loadCurrentEntry}
        />
      )}
      {showSearch && (
        <div className="search-overlay">
          <SearchView
            onEntrySelect={handleEntrySelect}
            onClose={() => setShowSearch(false)}
          />
        </div>
      )}
    </div>
  );
}

export default App;

