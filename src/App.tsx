import { useState, useEffect } from 'react';
import TimelineView from './components/TimelineView';
import JournalEditor from './components/JournalEditor';
import EntryViewer from './components/EntryViewer';
import NavigationBar from './components/NavigationBar';
import GlobalTimelineMinimap from './components/GlobalTimelineMinimap';
import { TimeRange, JournalEntry, Preferences } from './types';
import { getEntryForDate } from './services/journalService';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<TimeRange>('month');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load preferences on startup
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (window.electronAPI) {
          const prefs = await window.electronAPI.getAllPreferences();
          setPreferences(prefs);
          
          // Apply default view mode
          if (prefs.defaultViewMode) {
            setViewMode(prefs.defaultViewMode);
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
      }
    };
    
    loadPreferences();
    
    // Listen for preference changes
    const handlePreferenceChange = () => {
      loadPreferences();
    };
    
    // Check for preference updates periodically (when preferences window closes)
    const interval = setInterval(() => {
      if (window.electronAPI) {
        window.electronAPI.getAllPreferences().then(prefs => {
          setPreferences(prefs);
          if (prefs.defaultViewMode && prefs.defaultViewMode !== viewMode) {
            setViewMode(prefs.defaultViewMode);
          }
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
  }, []);

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
    setSelectedDate(date);
    setViewMode(newViewMode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const handleViewModeChange = (mode: TimeRange) => {
    setViewMode(mode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setIsNewEntry(false);
    setIsEditing(false);
    // Update selectedDate to match the entry's date
    const entryDate = new Date(entry.date);
    setSelectedDate(entryDate);
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setIsNewEntry(true);
    setIsEditing(true);
  };

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

  if (!preferencesLoaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <div className="app">
      {preferences.showMinimap !== false && (
        <GlobalTimelineMinimap
          selectedDate={selectedDate}
          viewMode={viewMode}
          onTimePeriodSelect={handleTimePeriodSelect}
          onEntrySelect={handleEntrySelect}
        />
      )}
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
      />
      <div className="app-content">
        <div className="timeline-section">
          <TimelineView
            selectedDate={selectedDate}
            viewMode={viewMode}
            onTimePeriodSelect={handleTimePeriodSelect}
            onEntrySelect={handleEntrySelect}
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
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

