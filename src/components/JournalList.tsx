import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { getEntriesForRange } from '../services/journalService';
import { formatDate, parseISODate } from '../utils/dateUtils';
import { playNewEntrySound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
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
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'timeRange'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Apply filters and sorting when entries or filter settings change
  useEffect(() => {
    let filtered = [...entries];

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(entry => 
        entry.tags && entry.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Sort entries
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'timeRange':
          const timeRangeOrder: Record<TimeRange, number> = {
            decade: 0,
            year: 1,
            month: 2,
            week: 3,
            day: 4,
          };
          comparison = timeRangeOrder[a.timeRange] - timeRangeOrder[b.timeRange];
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredEntries(filtered);
  }, [entries, selectedTags, sortBy, sortOrder]);

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

  // Get all unique tags from entries
  const allTags = Array.from(new Set(entries.flatMap(entry => entry.tags || [])));

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
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
          <>
            {(allTags.length > 0 || entries.length > 1) && (
              <div className="journal-list-controls">
                {allTags.length > 0 && (
                  <div className="journal-list-filter">
                    <label>Filter by tags:</label>
                    <div className="journal-list-tags">
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          className={`journal-entry-filter-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                          onClick={() => handleTagToggle(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                      {selectedTags.length > 0 && (
                        <button className="journal-entry-clear-filters" onClick={clearFilters}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {entries.length > 1 && (
                  <div className="journal-list-sort">
                    <label>Sort by:</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'timeRange')}>
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                      <option value="timeRange">Time Range</option>
                    </select>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}>
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            {filteredEntries.length === 0 && entries.length > 0 ? (
              <div className="journal-list-empty">
                <p>No entries match the selected filters.</p>
                <button className="clear-filters-button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="journal-entries">
                {filteredEntries.map((entry) => (
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

