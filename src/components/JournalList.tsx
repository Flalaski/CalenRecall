import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { getEntriesForRange } from '../services/journalService';
import { formatDate, parseISODate } from '../utils/dateUtils';
import { playNewEntrySound } from '../utils/audioUtils';
import './JournalList.css';

interface JournalListProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onEntrySelect: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

export default function JournalList({
  selectedDate,
  viewMode,
  onEntrySelect,
  onNewEntry,
}: JournalListProps) {
  const { calendar } = useCalendar();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | undefined>();

  useEffect(() => {
    loadEntries();
    setSelectedEntryId(undefined);
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const handleEntrySaved = () => {
      console.log('JournalList: journalEntrySaved event received, reloading entries');
      loadEntries();
    };
    window.addEventListener('journalEntrySaved', handleEntrySaved);
    return () => {
      window.removeEventListener('journalEntrySaved', handleEntrySaved);
    };
  }, [selectedDate, viewMode]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      console.log('JournalList: Loading entries for', { viewMode, selectedDate: selectedDate.toISOString() });
      const loadedEntries = await getEntriesForRange(viewMode, selectedDate);
      console.log('JournalList: Loaded entries:', loadedEntries.length, loadedEntries);
      setEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntryClick = (entry: JournalEntry) => {
    setSelectedEntryId(entry.id);
    onEntrySelect(entry);
  };

  const getTimeRangeLabel = (timeRange: TimeRange): string => {
    switch (timeRange) {
      case 'decade': return 'Decade';
      case 'year': return 'Year';
      case 'month': return 'Month';
      case 'week': return 'Week';
      case 'day': return 'Day';
      default: return '';
    }
  };

  const formatEntryDate = (entry: JournalEntry): string => {
    const entryDate = parseISODate(entry.date);
    // Use calendar-aware formatting
    try {
      return getTimeRangeLabelInCalendar(entryDate, entry.timeRange, calendar);
    } catch (e) {
      console.error('Error formatting entry date in calendar:', e);
      // Fallback to Gregorian formatting
      switch (entry.timeRange) {
        case 'decade':
          const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
          return `${decadeStart}s`;
        case 'year':
          return formatDate(entryDate, 'yyyy');
        case 'month':
          return formatDate(entryDate, 'MMMM yyyy');
        case 'week':
          return `Week of ${formatDate(entryDate, 'MMM d, yyyy')}`;
        case 'day':
          return formatDate(entryDate, 'MMM d, yyyy');
        default:
          return formatDate(entryDate, 'MMM d, yyyy');
      }
    }
  };

  const getNewEntryButtonText = (): string => {
    const timeRangeLabel = getTimeRangeLabel(viewMode);
    return `+ New Entry for this ${timeRangeLabel}`;
  };

  if (loading) {
    return (
      <div className="journal-list">
        <div className="journal-list-loading">Loading entries...</div>
      </div>
    );
  }

  return (
    <div className="journal-list">
      <div className="journal-list-header">
        <h3>Journal Entries</h3>
        <button className="new-entry-button" onClick={() => {
          playNewEntrySound();
          onNewEntry();
        }}>
          {getNewEntryButtonText()}
        </button>
      </div>
      <div className="journal-list-content">
        {entries.length === 0 ? (
          <div className="journal-list-empty">
            <p>No journal entries for this {getTimeRangeLabel(viewMode).toLowerCase()}.</p>
            <p className="hint">Click "New Entry" to create one.</p>
          </div>
        ) : (
          <div className="journal-entries">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`journal-entry-item ${selectedEntryId === entry.id ? 'selected' : ''}`}
                onClick={() => handleEntryClick(entry)}
              >
                <div className="entry-item-header">
                  <div className="entry-item-title">{entry.title}</div>
                  <div className="entry-item-meta">
                    <span className="entry-time-range">{getTimeRangeLabel(entry.timeRange)}</span>
                    <span className="entry-date">{formatEntryDate(entry)}</span>
                  </div>
                </div>
                <div className="entry-item-preview">
                  {entry.content.substring(0, 100)}
                  {entry.content.length > 100 && '...'}
                </div>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="entry-item-tags">
                    {entry.tags.map((tag, idx) => (
                      <span key={idx} className="entry-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

