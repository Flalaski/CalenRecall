import { useState } from 'react';
import CalendarView from './components/CalendarView';
import JournalEditor from './components/JournalEditor';
import JournalList from './components/JournalList';
import NavigationBar from './components/NavigationBar';
import { TimeRange, JournalEntry } from './types';
import { getCanonicalDate } from './utils/dateUtils';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<TimeRange>('month');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);

  const handleTimePeriodSelect = (date: Date, newViewMode: TimeRange) => {
    setSelectedDate(date);
    setViewMode(newViewMode);
    setSelectedEntry(null);
    setIsNewEntry(false);
  };

  const handleViewModeChange = (mode: TimeRange) => {
    setViewMode(mode);
    setSelectedEntry(null);
    setIsNewEntry(false);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setIsNewEntry(false);
    // Update selectedDate to match the entry's date
    const entryDate = new Date(entry.date);
    setSelectedDate(entryDate);
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setIsNewEntry(true);
  };

  const handleEntrySaved = () => {
    // Clear selection after saving
    setSelectedEntry(null);
    setIsNewEntry(false);
  };

  return (
    <div className="app">
      <NavigationBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <div className="app-content">
        <div className="calendar-section">
          <CalendarView
            selectedDate={selectedDate}
            viewMode={viewMode}
            onTimePeriodSelect={handleTimePeriodSelect}
          />
        </div>
        <div className="journal-list-section">
          <JournalList
            selectedDate={selectedDate}
            viewMode={viewMode}
            onEntrySelect={handleEntrySelect}
            onNewEntry={handleNewEntry}
          />
        </div>
        <div className="journal-section">
          <JournalEditor
            date={selectedDate}
            viewMode={viewMode}
            selectedEntry={selectedEntry}
            isNewEntry={isNewEntry}
            onEntrySaved={handleEntrySaved}
          />
        </div>
      </div>
    </div>
  );
}

export default App;

