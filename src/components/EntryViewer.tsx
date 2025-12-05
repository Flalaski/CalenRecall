import { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { formatDate, getWeekStart, getWeekEnd, getMonthStart, getYearStart, getDecadeStart, parseISODate } from '../utils/dateUtils';
import { playEditSound, playNewEntrySound, playAddSound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
import { saveJournalEntry, deleteJournalEntry } from '../services/journalService';
import './EntryViewer.css';

interface EntryViewerProps {
  entry: JournalEntry | null;
  date: Date;
  viewMode: TimeRange;
  onEdit: () => void;
  onNewEntry: () => void;
  onEntrySelect: (entry: JournalEntry) => void;
  onEditEntry?: (entry: JournalEntry) => void;
  onEntryDuplicated?: () => void;
}

export default function EntryViewer({
  entry,
  date,
  viewMode,
  onEdit,
  onNewEntry,
  onEntrySelect,
  onEditEntry,
  onEntryDuplicated,
}: EntryViewerProps) {
  const { calendar } = useCalendar();
  const [periodEntries, setPeriodEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'timeRange'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [linkedEntries, setLinkedEntries] = useState<JournalEntry[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadPeriodEntries();
    // Clear bulk selection when changing date/view
    setSelectedEntryIds(new Set());
    setBulkEditMode(false);
  }, [date, viewMode]);

  const loadLinkedEntries = useCallback(async () => {
    if (!entry?.linkedEntries || entry.linkedEntries.length === 0) {
      setLinkedEntries([]);
      return;
    }

    setLoadingLinked(true);
    try {
      // Batch load all linked entries in parallel instead of sequentially
      if (window.electronAPI) {
        const linkedEntriesPromises = entry.linkedEntries.map(id => 
          window.electronAPI.getEntryById(id)
        );
        const loaded = await Promise.all(linkedEntriesPromises);
        // Filter out null/undefined entries
        setLinkedEntries(loaded.filter((entry): entry is JournalEntry => entry !== null));
      } else {
        setLinkedEntries([]);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading linked entries:', error);
      }
      setLinkedEntries([]);
    } finally {
      setLoadingLinked(false);
    }
  }, [entry?.linkedEntries]);

  useEffect(() => {
    const handleEntrySaved = () => {
      loadPeriodEntries();
      if (entry?.id) {
        loadLinkedEntries();
      }
    };
    window.addEventListener('journalEntrySaved', handleEntrySaved);
    return () => {
      window.removeEventListener('journalEntrySaved', handleEntrySaved);
    };
  }, [date, viewMode, entry?.id, loadLinkedEntries]);

  // Load linked entries when entry changes
  useEffect(() => {
    if (entry?.id && entry.linkedEntries && entry.linkedEntries.length > 0) {
      loadLinkedEntries();
    } else {
      setLinkedEntries([]);
    }
  }, [entry?.id, entry?.linkedEntries, loadLinkedEntries]);

  const loadPeriodEntries = async () => {
    if (!window.electronAPI) return;
    
    setLoading(true);
    try {
      // Determine which entries to load based on viewMode
      // For month view: load month and week entries
      // For week view: load week entries
      // For year view: load year, month, and week entries
      // For decade view: load decade, year, month, and week entries
      // For day view: load day entries (but those are shown in calendar cells)
      
      let startDate: Date;
      let endDate: Date;
      
      switch (viewMode) {
        case 'decade':
          startDate = getDecadeStart(date);
          endDate = new Date(startDate.getFullYear() + 9, 11, 31);
          break;
        case 'year':
          startDate = getYearStart(date);
          endDate = new Date(startDate.getFullYear(), 11, 31);
          break;
        case 'month':
          startDate = getMonthStart(date);
          endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          break;
        case 'week':
          startDate = getWeekStart(date);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          break;
        case 'day':
          startDate = date;
          endDate = date;
          break;
        default:
          startDate = date;
          endDate = date;
      }
      
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      
      const allEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
      
      // Filter entries based on viewMode - exclude day entries (they're shown in calendar)
      const filteredEntries = allEntries.filter(e => {
        if (viewMode === 'month') {
          // Show month and week entries
          return e.timeRange === 'month' || e.timeRange === 'week';
        } else if (viewMode === 'week') {
          // Show week entries
          return e.timeRange === 'week';
        } else if (viewMode === 'year') {
          // Show year, month, and week entries
          return e.timeRange === 'year' || e.timeRange === 'month' || e.timeRange === 'week';
        } else if (viewMode === 'decade') {
          // Show decade, year, month, and week entries
          return e.timeRange === 'decade' || e.timeRange === 'year' || e.timeRange === 'month' || e.timeRange === 'week';
        } else {
          // Day view - no period entries to show
          return false;
        }
      });
      
      // Sort by timeRange priority (decade > year > month > week) and then by date
      const timeRangeOrder: Record<TimeRange, number> = {
        decade: 0,
        year: 1,
        month: 2,
        week: 3,
        day: 4,
      };
      
      filteredEntries.sort((a, b) => {
        const orderDiff = timeRangeOrder[a.timeRange] - timeRangeOrder[b.timeRange];
        if (orderDiff !== 0) return orderDiff;
        return a.date.localeCompare(b.date);
      });
      
      setPeriodEntries(filteredEntries);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading period entries:', error);
      }
      setPeriodEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Memoize filtered and sorted entries to avoid recalculating on every render
  const filteredEntries = useMemo(() => {
    let filtered = [...periodEntries];

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

    return filtered;
  }, [periodEntries, selectedTags, sortBy, sortOrder]);

  // Memoize entries with IDs for bulk edit operations
  const filteredEntriesWithIds = useMemo(() => {
    return filteredEntries.filter(entry => entry.id !== undefined);
  }, [filteredEntries]);

  const getDateLabel = () => {
    // Use calendar-aware formatting
    try {
      return getTimeRangeLabelInCalendar(date, viewMode, calendar);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error formatting date in calendar:', e);
      }
      // Fallback to Gregorian formatting
      switch (viewMode) {
        case 'decade':
          const decadeStart = Math.floor(date.getFullYear() / 10) * 10;
          return `${decadeStart}s`;
        case 'year':
          return formatDate(date, 'yyyy');
        case 'month':
          return formatDate(date, 'MMMM yyyy');
        case 'week':
          return `Week of ${formatDate(date, 'MMM d, yyyy')}`;
        case 'day':
          return formatDate(date, 'EEEE, MMMM d, yyyy');
        default:
          return formatDate(date, 'MMMM d, yyyy');
      }
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

  const getTimeRangeColor = (timeRange: TimeRange): string => {
    switch (timeRange) {
      case 'decade': return '#9c27b0';
      case 'year': return '#2196f3';
      case 'month': return '#ff9800';
      case 'week': return '#4caf50';
      case 'day': return '#f44336';
      default: return '#999';
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
          const weekStart = getWeekStart(entryDate);
          const weekEnd = getWeekEnd(entryDate);
          if (weekStart.getMonth() === weekEnd.getMonth()) {
            return `Week of ${formatDate(weekStart, 'MMM d')} - ${formatDate(weekEnd, 'd, yyyy')}`;
          } else {
            return `Week of ${formatDate(weekStart, 'MMM d')} - ${formatDate(weekEnd, 'MMM d, yyyy')}`;
          }
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

  // Get all unique tags from period entries
  const allTags = Array.from(new Set(periodEntries.flatMap(entry => entry.tags || [])));

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
      loadPeriodEntries();
      
      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
    } catch (error) {
      console.error('Error deleting entries:', error);
      alert(`Failed to delete entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePeriodEntryClick = (periodEntry: JournalEntry, event?: React.MouseEvent) => {
    // In bulk edit mode, clicking should toggle selection instead of selecting the entry
    if (bulkEditMode) {
      event?.stopPropagation();
      toggleEntrySelection(periodEntry.id);
      return;
    }
    onEntrySelect(periodEntry);
  };

  const handleDuplicate = async () => {
    if (!entry) return;

    playAddSound();
    
    try {
      // Create a new entry with the same content but without ID
      const duplicatedEntry: JournalEntry = {
        date: entry.date,
        timeRange: entry.timeRange,
        title: `${entry.title} (Copy)`,
        content: entry.content,
        tags: entry.tags ? [...entry.tags] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveJournalEntry(duplicatedEntry);
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
      
      if (onEntryDuplicated) {
        onEntryDuplicated();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error duplicating entry:', error);
      }
      alert('Failed to duplicate entry. Please try again.');
    }
  };

  // If a specific entry is selected, show it
  if (entry) {
    return (
      <div className="entry-viewer">
        <div className="viewer-header">
          <div className="header-top">
            <h3>{getDateLabel()}</h3>
            <div className="header-actions">
              <button className="edit-button" onClick={() => {
                playEditSound();
                onEdit();
              }}>
                Edit
              </button>
              <button className="duplicate-button" onClick={handleDuplicate} title="Duplicate this entry">
                Duplicate
              </button>
              <button className="new-entry-button-header" onClick={() => {
                playNewEntrySound();
                onNewEntry();
              }}>
                {getNewEntryButtonText()}
              </button>
            </div>
          </div>
          <div className="entry-meta">
            <span className="time-range-badge-viewer">{getTimeRangeLabel(entry.timeRange)}</span>
            <small className="entry-date-display">Date: {formatEntryDate(entry)}</small>
            <small>Created: {formatDate(new Date(entry.createdAt), 'MMM d, yyyy')}</small>
            {entry.updatedAt !== entry.createdAt && (
              <small>Updated: {formatDate(new Date(entry.updatedAt), 'MMM d, yyyy')}</small>
            )}
          </div>
        </div>
        
        <div className="viewer-content">
          <div className="viewer-title">{entry.title}</div>
          <div className="viewer-text">{entry.content}</div>
          {entry.tags && entry.tags.length > 0 && (
            <div className="viewer-tags">
              {entry.tags.map((tag, idx) => (
                <span key={idx} className="viewer-tag">{tag}</span>
              ))}
            </div>
          )}
          {linkedEntries.length > 0 && (
            <div className="viewer-linked-entries">
              <h4>Linked Entries</h4>
              <div className="linked-entries-list">
                {linkedEntries.map((linkedEntry) => (
                  <div
                    key={linkedEntry.id}
                    className="linked-entry-item"
                    onClick={() => onEntrySelect(linkedEntry)}
                  >
                    <div className="linked-entry-title">{linkedEntry.title}</div>
                    <div className="linked-entry-meta">
                      <span className="linked-entry-date">{formatEntryDate(linkedEntry)}</span>
                      <span className="linked-entry-time-range">{getTimeRangeLabel(linkedEntry.timeRange)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show list of period entries
  return (
    <div className="entry-viewer">
      <div className="viewer-header">
        <div className="header-top">
          <h3>{getDateLabel()}</h3>
          <div className="header-actions">
            {periodEntries.length > 0 && (
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
            <button className="new-entry-button-header" onClick={() => {
              playNewEntrySound();
              onNewEntry();
            }}>
              {getNewEntryButtonText()}
            </button>
          </div>
        </div>
      </div>
      
      <div className="viewer-content">
        {loading ? (
          <div className="viewer-loading">Loading entries...</div>
        ) : periodEntries.length === 0 ? (
          <div className="viewer-empty">
            <p>No {viewMode === 'month' ? 'month or week' : viewMode === 'year' ? 'year, month, or week' : viewMode === 'decade' ? 'decade, year, month, or week' : viewMode} entries for this period.</p>
            <p className="hint">Click "+ New Entry" to create one.</p>
          </div>
        ) : (
          <Fragment>
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
            {(allTags.length > 0 || periodEntries.length > 1) && !bulkEditMode && (
              <div className="period-entries-controls">
                {allTags.length > 0 && (
                  <div className="period-entries-filter">
                    <label>Filter by tags:</label>
                    <div className="period-entries-tags">
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          className={`period-entry-filter-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                          onClick={() => handleTagToggle(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                      {selectedTags.length > 0 && (
                        <button className="period-entry-clear-filters" onClick={clearFilters}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {periodEntries.length > 1 && (
                  <div className="period-entries-sort">
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
            {filteredEntries.length === 0 && periodEntries.length > 0 ? (
              <div className="viewer-empty">
                <p>No entries match the selected filters.</p>
                <button className="clear-filters-button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="period-entries-list">
                {filteredEntries.map((periodEntry) => (
              <div
                key={periodEntry.id || `${periodEntry.date}-${periodEntry.timeRange}-${periodEntry.createdAt}`}
                className={`period-entry-item ${bulkEditMode && periodEntry.id !== undefined && selectedEntryIds.has(periodEntry.id) ? 'bulk-selected' : ''} ${bulkEditMode ? 'bulk-edit-mode' : ''}`}
                onClick={(e) => handlePeriodEntryClick(periodEntry, e)}
              >
                {bulkEditMode && periodEntry.id !== undefined && (
                  <div className="entry-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.has(periodEntry.id)}
                      onChange={() => toggleEntrySelection(periodEntry.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="period-entry-content-wrapper">
                <div className="period-entry-header">
                  <div className="period-entry-title-row">
                    <span className="period-entry-title">{periodEntry.title}</span>
                    <div className="period-entry-actions">
                      {onEditEntry && (
                        <button
                          className="period-entry-edit-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playEditSound();
                            onEditEntry(periodEntry);
                          }}
                          title="Edit entry"
                        >
                          Edit
                        </button>
                      )}
                      <span
                        className="period-entry-badge"
                        style={{ backgroundColor: getTimeRangeColor(periodEntry.timeRange) }}
                      >
                        {getTimeRangeLabel(periodEntry.timeRange)}
                      </span>
                    </div>
                  </div>
                  <div className="period-entry-meta">
                    <span className="period-entry-date">
                      Date: {formatEntryDate(periodEntry)}
                    </span>
                    <span className="period-entry-date">
                      Created: {formatDate(new Date(periodEntry.createdAt), 'MMM d, yyyy')}
                    </span>
                    {periodEntry.updatedAt !== periodEntry.createdAt && (
                      <span className="period-entry-date">
                        Updated: {formatDate(new Date(periodEntry.updatedAt), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="period-entry-content">{periodEntry.content}</div>
                {periodEntry.tags && periodEntry.tags.length > 0 && (
                  <div className="period-entry-tags">
                    {periodEntry.tags.map((tag, idx) => (
                      <span key={idx} className="period-entry-tag">{tag}</span>
                    ))}
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>
            )}
          </Fragment>
        )}
      </div>
    </div>
  );
}

