import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { formatDate, getWeekStart, getMonthStart, getYearStart, getDecadeStart } from '../utils/dateUtils';
import './EntryViewer.css';

interface EntryViewerProps {
  entry: JournalEntry | null;
  date: Date;
  viewMode: TimeRange;
  onEdit: () => void;
  onNewEntry: () => void;
  onEntrySelect: (entry: JournalEntry) => void;
}

export default function EntryViewer({
  entry,
  date,
  viewMode,
  onEdit,
  onNewEntry,
  onEntrySelect,
}: EntryViewerProps) {
  const [periodEntries, setPeriodEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPeriodEntries();
  }, [date, viewMode]);

  useEffect(() => {
    const handleEntrySaved = () => {
      loadPeriodEntries();
    };
    window.addEventListener('journalEntrySaved', handleEntrySaved);
    return () => {
      window.removeEventListener('journalEntrySaved', handleEntrySaved);
    };
  }, [date, viewMode]);

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
      console.error('Error loading period entries:', error);
      setPeriodEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = () => {
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

  const getNewEntryButtonText = (): string => {
    const timeRangeLabel = getTimeRangeLabel(viewMode);
    return `+ New Entry for this ${timeRangeLabel}`;
  };

  // If a specific entry is selected, show it
  if (entry) {
    return (
      <div className="entry-viewer">
        <div className="viewer-header">
          <div className="header-top">
            <h3>{getDateLabel()}</h3>
            <div className="header-actions">
              <button className="edit-button" onClick={onEdit}>
                Edit
              </button>
              <button className="new-entry-button-header" onClick={onNewEntry}>
                {getNewEntryButtonText()}
              </button>
            </div>
          </div>
          <div className="entry-meta">
            <span className="time-range-badge-viewer">{getTimeRangeLabel(entry.timeRange)}</span>
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
          <button className="new-entry-button-header" onClick={onNewEntry}>
            {getNewEntryButtonText()}
          </button>
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
          <div className="period-entries-list">
            {periodEntries.map((periodEntry) => (
              <div
                key={`${periodEntry.date}-${periodEntry.timeRange}`}
                className="period-entry-item"
                onClick={() => onEntrySelect(periodEntry)}
              >
                <div className="period-entry-header">
                  <div className="period-entry-title-row">
                    <span className="period-entry-title">{periodEntry.title}</span>
                    <span
                      className="period-entry-badge"
                      style={{ backgroundColor: getTimeRangeColor(periodEntry.timeRange) }}
                    >
                      {getTimeRangeLabel(periodEntry.timeRange)}
                    </span>
                  </div>
                  <div className="period-entry-meta">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

