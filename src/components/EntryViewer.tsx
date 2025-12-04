import { JournalEntry, TimeRange } from '../types';
import { formatDate } from '../utils/dateUtils';
import './EntryViewer.css';

interface EntryViewerProps {
  entry: JournalEntry | null;
  date: Date;
  viewMode: TimeRange;
  onEdit: () => void;
  onNewEntry: () => void;
}

export default function EntryViewer({
  entry,
  date,
  viewMode,
  onEdit,
  onNewEntry,
}: EntryViewerProps) {
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
                + New Entry
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

  return (
    <div className="entry-viewer">
      <div className="viewer-header">
        <div className="header-top">
          <h3>{getDateLabel()}</h3>
          <button className="new-entry-button-header" onClick={onNewEntry}>
            + New Entry
          </button>
        </div>
      </div>
      <div className="viewer-empty">
        <p>No journal entry for this {getTimeRangeLabel(viewMode).toLowerCase()}.</p>
        <p className="hint">Click "+ New Entry" to create one.</p>
      </div>
    </div>
  );
}

