"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JournalEditor;
const react_1 = require("react");
const dateUtils_1 = require("../utils/dateUtils");
const journalService_1 = require("../services/journalService");
const audioUtils_1 = require("../utils/audioUtils");
const CalendarContext_1 = require("../contexts/CalendarContext");
const timeRangeConverter_1 = require("../utils/calendars/timeRangeConverter");
require("./JournalEditor.css");
function JournalEditor({ date, viewMode, selectedEntry: propSelectedEntry, isNewEntry = false, onEntrySaved, onCancel, }) {
    const { calendar } = (0, CalendarContext_1.useCalendar)();
    const [title, setTitle] = (0, react_1.useState)('');
    const [content, setContent] = (0, react_1.useState)('');
    const [tags, setTags] = (0, react_1.useState)([]);
    const [tagInput, setTagInput] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [currentEntry, setCurrentEntry] = (0, react_1.useState)(null);
    const [showConfirmDialog, setShowConfirmDialog] = (0, react_1.useState)(false);
    const [originalTitle, setOriginalTitle] = (0, react_1.useState)('');
    const [originalContent, setOriginalContent] = (0, react_1.useState)('');
    const [originalTags, setOriginalTags] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (propSelectedEntry) {
            // Load the selected entry
            setTitle(propSelectedEntry.title);
            setContent(propSelectedEntry.content);
            setTags(propSelectedEntry.tags || []);
            setOriginalTitle(propSelectedEntry.title);
            setOriginalContent(propSelectedEntry.content);
            setOriginalTags(propSelectedEntry.tags || []);
            setCurrentEntry(propSelectedEntry);
            setLoading(false);
        }
        else if (isNewEntry) {
            // Clear for new entry
            setTitle('');
            setContent('');
            setTags([]);
            setOriginalTitle('');
            setOriginalContent('');
            setOriginalTags([]);
            setCurrentEntry(null);
            setLoading(false);
        }
        else {
            // Load entry for current date/viewMode
            loadEntry();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, viewMode, propSelectedEntry, isNewEntry]);
    const loadEntry = async () => {
        setLoading(true);
        try {
            const existingEntry = await (0, journalService_1.getEntryForDate)(date, viewMode);
            setCurrentEntry(existingEntry);
            if (existingEntry) {
                setTitle(existingEntry.title);
                setContent(existingEntry.content);
                setTags(existingEntry.tags || []);
                setOriginalTitle(existingEntry.title);
                setOriginalContent(existingEntry.content);
                setOriginalTags(existingEntry.tags || []);
            }
            else {
                setTitle('');
                setContent('');
                setTags([]);
                setOriginalTitle('');
                setOriginalContent('');
                setOriginalTags([]);
            }
        }
        catch (error) {
            console.error('Error loading entry:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSave = async () => {
        console.log('handleSave called', { title, content, hasTitle: !!title.trim(), hasContent: !!content.trim() });
        if (!title.trim() && !content.trim()) {
            alert('Please enter a title or content before saving.');
            return;
        }
        (0, audioUtils_1.playSaveSound)();
        setSaving(true);
        try {
            const defaultTitle = getDefaultTitle();
            // If editing an existing entry, preserve its original date and timeRange
            // Otherwise, calculate canonical date from current date/viewMode for new entries
            let entryDate;
            let entryTimeRange;
            if (currentEntry?.id) {
                // Preserve original date and timeRange when editing existing entry
                entryDate = currentEntry.date;
                entryTimeRange = currentEntry.timeRange;
            }
            else {
                // Calculate canonical date for new entries
                const canonicalDate = (0, dateUtils_1.getCanonicalDate)(date, viewMode);
                entryDate = (0, dateUtils_1.formatDate)(canonicalDate);
                entryTimeRange = viewMode;
            }
            const entry = {
                id: currentEntry?.id, // Preserve ID if editing existing entry
                date: entryDate,
                timeRange: entryTimeRange,
                title: title.trim() || defaultTitle,
                content: content.trim(),
                tags: tags,
                createdAt: currentEntry?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            console.log('Saving entry:', entry);
            await (0, journalService_1.saveJournalEntry)(entry);
            console.log('Entry saved successfully');
            setCurrentEntry(entry);
            // Small delay to ensure database write completes
            await new Promise(resolve => setTimeout(resolve, 100));
            // Trigger a custom event to refresh calendar and list
            window.dispatchEvent(new CustomEvent('journalEntrySaved'));
            console.log('journalEntrySaved event dispatched');
            // Clear form after saving if it was a new entry
            if (isNewEntry) {
                setTitle('');
                setContent('');
                setTags([]);
                setCurrentEntry(null);
            }
            // Notify parent
            if (onEntrySaved) {
                onEntrySaved();
            }
        }
        catch (error) {
            console.error('Error saving entry:', error);
            alert(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
        }
        finally {
            setSaving(false);
        }
    };
    const getDefaultTitle = () => {
        // Use calendar-aware formatting
        try {
            return (0, timeRangeConverter_1.getTimeRangeLabelInCalendar)(date, viewMode, calendar);
        }
        catch (e) {
            console.error('Error formatting date in calendar:', e);
            // Fallback to Gregorian formatting
            switch (viewMode) {
                case 'decade':
                    const decadeStart = Math.floor(date.getFullYear() / 10) * 10;
                    return `${decadeStart}s`;
                case 'year':
                    return (0, dateUtils_1.formatDate)(date, 'yyyy');
                case 'month':
                    return (0, dateUtils_1.formatDate)(date, 'MMMM yyyy');
                case 'week':
                    return `Week of ${(0, dateUtils_1.formatDate)(date, 'MMM d, yyyy')}`;
                case 'day':
                    return (0, dateUtils_1.formatDate)(date, 'MMMM d, yyyy');
                default:
                    return (0, dateUtils_1.formatDate)(date, 'MMMM d, yyyy');
            }
        }
    };
    const handleDelete = async () => {
        if (!currentEntry || !currentEntry.id) {
            alert('Cannot delete entry: entry ID not found');
            return;
        }
        (0, audioUtils_1.playDeleteSound)();
        if (!confirm('Are you sure you want to delete this entry?')) {
            return;
        }
        try {
            await (0, journalService_1.deleteJournalEntry)(currentEntry.id);
            setCurrentEntry(null);
            setTitle('');
            setContent('');
            setTags([]);
            // Trigger a custom event to refresh calendar and list
            window.dispatchEvent(new CustomEvent('journalEntrySaved'));
            // Notify parent
            if (onEntrySaved) {
                onEntrySaved();
            }
        }
        catch (error) {
            console.error('Error deleting entry:', error);
            alert('Failed to delete entry. Please try again.');
        }
    };
    const handleAddTag = () => {
        const tag = tagInput.trim();
        if (tag && !tags.includes(tag)) {
            (0, audioUtils_1.playAddSound)();
            setTags([...tags, tag]);
            setTagInput('');
        }
    };
    const handleRemoveTag = (tagToRemove) => {
        (0, audioUtils_1.playRemoveSound)();
        setTags(tags.filter(tag => tag !== tagToRemove));
    };
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSave();
        }
    };
    // Handle cancel with confirmation if needed
    const handleCancel = (0, react_1.useCallback)(() => {
        const titleChanged = title.trim() !== originalTitle.trim();
        const contentChanged = content.trim() !== originalContent.trim();
        const tagsChanged = JSON.stringify(tags.sort()) !== JSON.stringify(originalTags.sort());
        const hasChanges = titleChanged || contentChanged || tagsChanged;
        if (hasChanges) {
            setShowConfirmDialog(true);
        }
        else {
            (0, audioUtils_1.playCancelSound)();
            if (onCancel) {
                onCancel();
            }
        }
    }, [title, content, tags, originalTitle, originalContent, originalTags, onCancel]);
    // Confirm discard changes
    const handleConfirmDiscard = (0, react_1.useCallback)(() => {
        (0, audioUtils_1.playCancelSound)();
        setShowConfirmDialog(false);
        if (onCancel) {
            onCancel();
        }
    }, [onCancel]);
    // Cancel discard confirmation
    const handleCancelDiscard = (0, react_1.useCallback)(() => {
        setShowConfirmDialog(false);
    }, []);
    // Handle ESC key to cancel/edit
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
            // Don't handle ESC if confirmation dialog is open (it will handle its own ESC)
            if (showConfirmDialog) {
                return;
            }
            // Don't handle ESC if user is typing in an input, textarea, or contenteditable element
            const target = e.target;
            if (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                (target.closest('input') || target.closest('textarea') || target.closest('[contenteditable="true"]'))) {
                return;
            }
            // Handle ESC key
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showConfirmDialog, handleCancel]);
    // Handle Enter and ESC in confirmation dialog
    (0, react_1.useEffect)(() => {
        if (!showConfirmDialog)
            return;
        const handleDialogKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmDiscard();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelDiscard();
            }
        };
        window.addEventListener('keydown', handleDialogKeyDown);
        return () => {
            window.removeEventListener('keydown', handleDialogKeyDown);
        };
    }, [showConfirmDialog, handleConfirmDiscard, handleCancelDiscard]);
    const getDateLabel = () => {
        // Use calendar-aware formatting
        try {
            return (0, timeRangeConverter_1.getTimeRangeLabelInCalendar)(date, viewMode, calendar);
        }
        catch (e) {
            console.error('Error formatting date in calendar:', e);
            // Fallback to Gregorian formatting
            switch (viewMode) {
                case 'decade':
                    const decadeStart = Math.floor(date.getFullYear() / 10) * 10;
                    return `${decadeStart}s`;
                case 'year':
                    return (0, dateUtils_1.formatDate)(date, 'yyyy');
                case 'month':
                    return (0, dateUtils_1.formatDate)(date, 'MMMM yyyy');
                case 'week':
                    return `Week of ${(0, dateUtils_1.formatDate)(date, 'MMM d, yyyy')}`;
                case 'day':
                    return (0, dateUtils_1.formatDate)(date, 'EEEE, MMMM d, yyyy');
                default:
                    return (0, dateUtils_1.formatDate)(date, 'MMMM d, yyyy');
            }
        }
    };
    if (loading) {
        return (<div className="journal-editor-inline">
        <div className="editor-loading">Loading...</div>
      </div>);
    }
    return (<div className="journal-editor-inline">
      <div className="editor-header">
        <div className="header-top">
          <h3>{getDateLabel()}</h3>
        </div>
        {currentEntry && (<div className="entry-meta">
            <small>Created: {(0, dateUtils_1.formatDate)(new Date(currentEntry.createdAt), 'MMM d, yyyy')}</small>
            {currentEntry.updatedAt !== currentEntry.createdAt && (<small>Updated: {(0, dateUtils_1.formatDate)(new Date(currentEntry.updatedAt), 'MMM d, yyyy')}</small>)}
          </div>)}
      </div>
      
      <div className="editor-content">
        <input type="text" className="title-input" placeholder={`${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} entry title...`} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyPress}/>
        
        <textarea className="content-input" placeholder={`Write your ${viewMode} journal entry here...`} value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={handleKeyPress}/>
        
        <div className="tags-section">
          <div className="tags-input-container">
            <input type="text" className="tag-input" placeholder="Add a tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyPress={(e) => {
            if (e.key === 'Enter') {
                handleAddTag();
            }
        }}/>
            <button className="add-tag-button" onClick={handleAddTag}>Add</button>
          </div>
          <div className="tags-list">
            {tags.map((tag, idx) => (<span key={idx} className="tag">
                {tag}
                <button className="tag-remove" onClick={() => handleRemoveTag(tag)}>×</button>
              </span>))}
          </div>
        </div>
      </div>
      
      <div className="editor-footer">
        {currentEntry && (<button className="delete-button" onClick={handleDelete}>
            Delete Entry
          </button>)}
        <div className="footer-actions">
          {onCancel && (<button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>)}
          <button className="save-button" onClick={handleSave} disabled={saving || (!title.trim() && !content.trim())}>
            {saving ? 'Saving...' : 'Save (Ctrl+Enter)'}
          </button>
        </div>
      </div>
      
      {showConfirmDialog && (<div className="confirm-dialog-overlay" onClick={handleCancelDiscard}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Discard changes?</h4>
            <p>You have unsaved changes. Are you sure you want to discard them?</p>
            <div className="confirm-dialog-buttons">
              <button className="confirm-button" onClick={handleConfirmDiscard}>
                Discard (Enter)
              </button>
              <button className="cancel-button" onClick={handleCancelDiscard}>
                Cancel (ESC)
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
