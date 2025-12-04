import { useState, useEffect } from 'react';
import TimelineView from './components/TimelineView';
import JournalEditor from './components/JournalEditor';
import EntryViewer from './components/EntryViewer';
import NavigationBar from './components/NavigationBar';
import GlobalTimelineMinimap from './components/GlobalTimelineMinimap';
import PreferencesComponent from './components/Preferences';
import { TimeRange, JournalEntry } from './types';
import { getEntryForDate } from './services/journalService';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<TimeRange>('month');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Check if we're in preferences mode (for preferences window)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#/preferences') {
      setShowPreferences(true);
    }
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

  // If showing preferences, render only preferences component
  if (showPreferences) {
    return <PreferencesComponent />;
  }

  return (
    <div className="app">
      <GlobalTimelineMinimap
        selectedDate={selectedDate}
        viewMode={viewMode}
        onTimePeriodSelect={handleTimePeriodSelect}
        onEntrySelect={handleEntrySelect}
      />
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

