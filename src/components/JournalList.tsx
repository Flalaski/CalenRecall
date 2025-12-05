import { useState, useEffect, useMemo } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { deleteJournalEntry } from '../services/journalService';
import { formatDate, parseISODate } from '../utils/dateUtils';
import { playNewEntrySound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { useEntries } from '../contexts/EntriesContext';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
import { filterEntriesForRange } from '../utils/entryFilterUtils';
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
  const { entries: allEntries } = useEntries();
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<number | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'timeRange'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());

  // OPTIMIZATION: Filter entries from global context instead of querying database
  const entries = useMemo(() => {
    return filterEntriesForRange(allEntries, viewMode, selectedDate);
  }, [allEntries, viewMode, selectedDate]);

  useEffect(() => {
    setSelectedEntryId(undefined);
    // Clear bulk selection when changing date/view
    setSelectedEntryIds(new Set());
    setBulkEditMode(false);
  }, [selectedDate, viewMode]);

  // Removed loadEntries - now using EntriesContext with memoized filtering

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

  // Memoize entries with IDs for bulk edit operations
  const filteredEntriesWithIds = useMemo(() => {
    return filteredEntries.filter(entry => entry.id !== undefined);
  }, [filteredEntries]);

  const handleEntryClick = (entry: JournalEntry, event?: React.MouseEvent) => {
    // In bulk edit mode, clicking should toggle selection instead of selecting the entry
    if (bulkEditMode) {
      event?.stopPropagation();
      toggleEntrySelection(entry.id);
      return;
    }
    setSelectedEntryId(entry.id);
    onEntrySelect(entry);
  };

  const toggleEntrySelection = (entryId: number | undefined) => {
    if (entryId === undefined) return;
    setSelectedEntryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntryIds.size === filteredEntriesWithIds.length && filteredEntriesWithIds.length > 0) {
      // Deselect all
      setSelectedEntryIds(new Set());
    } else {
      // Select all visible entries that have IDs
      const allIds = new Set(filteredEntriesWithIds.map(entry => entry.id!));
      setSelectedEntryIds(allIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntryIds.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? 'entry' : 'entries'}? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete all selected entries
      const deletePromises = Array.from(selectedEntryIds).map(id => 
        deleteJournalEntry(id)
      );
      await Promise.all(deletePromises);
      
      // Clear selection and exit bulk edit mode
      setSelectedEntryIds(new Set());
      setBulkEditMode(false);
      
      // Reload entries
      loadEntries();
      
      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
    } catch (error) {
      console.error('Error deleting entries:', error);
      alert(`Failed to delete entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  // Loading is handled at app level via EntriesContext
  // Entries are preloaded, so no need for component-level loading state

  return (
    <div className="journal-list">
      <div className="journal-list-header">
        <h3>Journal Entries</h3>
        <div className="journal-list-header-actions">
          {entries.length > 0 && (
            <button 
              className={`bulk-edit-toggle-button ${bulkEditMode ? 'active' : ''}`}
              onClick={() => {
                setBulkEditMode(!bulkEditMode);
                if (bulkEditMode) {
                  setSelectedEntryIds(new Set());
                }
              }}
              title={bulkEditMode ? 'Exit bulk edit mode' : 'Enter bulk edit mode'}
            >
              {bulkEditMode ? 'Cancel' : 'Bulk Edit'}
            </button>
          )}
          <button className="new-entry-button" onClick={() => {
            playNewEntrySound();
            onNewEntry();
          }}>
            {getNewEntryButtonText()}
          </button>
        </div>
      </div>
      <div className="journal-list-content">
        {entries.length === 0 ? (
          <div className="journal-list-empty">
            <p>No journal entries for this {getTimeRangeLabel(viewMode).toLowerCase()}.</p>
            <p className="hint">Click "New Entry" to create one.</p>
          </div>
        ) : (
          <>
            {bulkEditMode && selectedEntryIds.size > 0 && (
              <div className="bulk-edit-actions">
                <span className="bulk-edit-selected-count">
                  {selectedEntryIds.size} {selectedEntryIds.size === 1 ? 'entry' : 'entries'} selected
                </span>
                <button 
                  className="bulk-delete-button"
                  onClick={handleBulkDelete}
                >
                  Delete Selected
                </button>
              </div>
            )}
            {(allTags.length > 0 || entries.length > 1) && !bulkEditMode && (
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
            {bulkEditMode && filteredEntriesWithIds.length > 0 && (
              <div className="bulk-edit-select-all">
                <label className="bulk-edit-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedEntryIds.size === filteredEntriesWithIds.length && filteredEntriesWithIds.length > 0}
                    onChange={toggleSelectAll}
                  />
                  <span>Select All ({filteredEntriesWithIds.length})</span>
                </label>
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
                className={`journal-entry-item ${!bulkEditMode && selectedEntryId === entry.id ? 'selected' : ''} ${bulkEditMode && entry.id !== undefined && selectedEntryIds.has(entry.id) ? 'bulk-selected' : ''} ${bulkEditMode ? 'bulk-edit-mode' : ''}`}
                onClick={(e) => handleEntryClick(entry, e)}
              >
                {bulkEditMode && entry.id !== undefined && (
                  <div className="entry-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.has(entry.id)}
                      onChange={() => toggleEntrySelection(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="entry-item-content">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

