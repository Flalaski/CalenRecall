"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JournalList;
const react_1 = require("react");
const journalService_1 = require("../services/journalService");
const dateUtils_1 = require("../utils/dateUtils");
const audioUtils_1 = require("../utils/audioUtils");
require("./JournalList.css");
function JournalList({ selectedDate, viewMode, onEntrySelect, onNewEntry, }) {
    const { calendar } = useCalendar();
    const [entries, setEntries] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [selectedEntryId, setSelectedEntryId] = (0, react_1.useState)();
    (0, react_1.useEffect)(() => {
        loadEntries();
        setSelectedEntryId(undefined);
    }, [selectedDate, viewMode]);
    (0, react_1.useEffect)(() => {
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
            const loadedEntries = await (0, journalService_1.getEntriesForRange)(viewMode, selectedDate);
            console.log('JournalList: Loaded entries:', loadedEntries.length, loadedEntries);
            setEntries(loadedEntries);
        }
        catch (error) {
            console.error('Error loading entries:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleEntryClick = (entry) => {
        setSelectedEntryId(entry.id);
        onEntrySelect(entry);
    };
    const getTimeRangeLabel = (timeRange) => {
        switch (timeRange) {
            case 'decade': return 'Decade';
            case 'year': return 'Year';
            case 'month': return 'Month';
            case 'week': return 'Week';
            case 'day': return 'Day';
            default: return '';
        }
    };
    const formatEntryDate = (entry) => {
        const entryDate = (0, dateUtils_1.parseISODate)(entry.date);
        // Use calendar-aware formatting
        try {
            return getTimeRangeLabelInCalendar(entryDate, entry.timeRange, calendar);
        }
        catch (e) {
            console.error('Error formatting entry date in calendar:', e);
            // Fallback to Gregorian formatting
            switch (entry.timeRange) {
                case 'decade':
                    const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
                    return `${decadeStart}s`;
                case 'year':
                    return (0, dateUtils_1.formatDate)(entryDate, 'yyyy');
                case 'month':
                    return (0, dateUtils_1.formatDate)(entryDate, 'MMMM yyyy');
                case 'week':
                    return `Week of ${(0, dateUtils_1.formatDate)(entryDate, 'MMM d, yyyy')}`;
                case 'day':
                    return (0, dateUtils_1.formatDate)(entryDate, 'MMM d, yyyy');
                default:
                    return (0, dateUtils_1.formatDate)(entryDate, 'MMM d, yyyy');
            }
        }
    };
    const getNewEntryButtonText = () => {
        const timeRangeLabel = getTimeRangeLabel(viewMode);
        return `+ New Entry for this ${timeRangeLabel}`;
    };
    if (loading) {
        return (<div className="journal-list">
        <div className="journal-list-loading">Loading entries...</div>
      </div>);
    }
    return (<div className="journal-list">
      <div className="journal-list-header">
        <h3>Journal Entries</h3>
        <button className="new-entry-button" onClick={() => {
            (0, audioUtils_1.playNewEntrySound)();
            onNewEntry();
        }}>
          {getNewEntryButtonText()}
        </button>
      </div>
      <div className="journal-list-content">
        {entries.length === 0 ? (<div className="journal-list-empty">
            <p>No journal entries for this {getTimeRangeLabel(viewMode).toLowerCase()}.</p>
            <p className="hint">Click "New Entry" to create one.</p>
          </div>) : (<div className="journal-entries">
            {entries.map((entry) => (<div key={entry.id} className={`journal-entry-item ${selectedEntryId === entry.id ? 'selected' : ''}`} onClick={() => handleEntryClick(entry)}>
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
                {entry.tags && entry.tags.length > 0 && (<div className="entry-item-tags">
                    {entry.tags.map((tag, idx) => (<span key={idx} className="entry-tag">{tag}</span>))}
                  </div>)}
              </div>))}
          </div>)}
      </div>
    </div>);
}
