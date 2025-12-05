"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EntryEditModal;
const react_1 = require("react");
const dateUtils_1 = require("../utils/dateUtils");
const journalService_1 = require("../services/journalService");
const audioUtils_1 = require("../utils/audioUtils");
require("./EntryEditModal.css");
function EntryEditModal({ entry, isOpen, onClose, onEntrySaved, }) {
    const [title, setTitle] = (0, react_1.useState)('');
    const [content, setContent] = (0, react_1.useState)('');
    const [tags, setTags] = (0, react_1.useState)([]);
    const [tagInput, setTagInput] = (0, react_1.useState)('');
    const [saving, setSaving] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (isOpen && entry) {
            setTitle(entry.title);
            setContent(entry.content);
            setTags(entry.tags || []);
            setTagInput('');
        }
    }, [isOpen, entry]);
    // Close modal on Escape key
    (0, react_1.useEffect)(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);
    const handleSave = async () => {
        if (!title.trim() && !content.trim()) {
            alert('Please enter a title or content before saving.');
            return;
        }
        (0, audioUtils_1.playSaveSound)();
        setSaving(true);
        try {
            const updatedEntry = {
                ...entry,
                title: title.trim() || entry.title,
                content: content.trim(),
                tags: tags,
                updatedAt: new Date().toISOString(),
            };
            await (0, journalService_1.saveJournalEntry)(updatedEntry);
            // Small delay to ensure database write completes
            await new Promise(resolve => setTimeout(resolve, 100));
            // Trigger a custom event to refresh calendar and list
            window.dispatchEvent(new CustomEvent('journalEntrySaved'));
            // Notify parent
            if (onEntrySaved) {
                onEntrySaved();
            }
            onClose();
        }
        catch (error) {
            console.error('Error saving entry:', error);
            alert(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async () => {
        if (!entry.id) {
            alert('Cannot delete entry: entry ID not found');
            return;
        }
        (0, audioUtils_1.playDeleteSound)();
        if (!confirm('Are you sure you want to delete this entry?')) {
            return;
        }
        try {
            await (0, journalService_1.deleteJournalEntry)(entry.id);
            // Trigger a custom event to refresh calendar and list
            window.dispatchEvent(new CustomEvent('journalEntrySaved'));
            // Notify parent
            if (onEntrySaved) {
                onEntrySaved();
            }
            onClose();
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
    const formatEntryDate = (entry) => {
        const [entryYearStr, entryMonthStr, entryDayStr] = entry.date.split('-');
        const entryDate = new Date(parseInt(entryYearStr, 10), parseInt(entryMonthStr, 10) - 1, parseInt(entryDayStr, 10));
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
    };
    if (!isOpen)
        return null;
    return (<div className="entry-edit-modal-overlay" onClick={onClose}>
      <div className="entry-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-top">
            <h3>Edit Entry</h3>
            <button className="modal-close-button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="modal-entry-meta">
            <span className="time-range-badge-viewer">{entry.timeRange.charAt(0).toUpperCase() + entry.timeRange.slice(1)}</span>
            <small className="entry-date-display">Date: {formatEntryDate(entry)}</small>
            <small>Created: {(0, dateUtils_1.formatDate)(new Date(entry.createdAt), 'MMM d, yyyy')}</small>
            {entry.updatedAt !== entry.createdAt && (<small>Updated: {(0, dateUtils_1.formatDate)(new Date(entry.updatedAt), 'MMM d, yyyy')}</small>)}
          </div>
        </div>

        <div className="modal-content">
          <input type="text" className="modal-title-input" placeholder="Entry title..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyPress} autoFocus/>

          <textarea className="modal-content-input" placeholder="Write your journal entry here..." value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={handleKeyPress}/>

          <div className="modal-tags-section">
            <div className="modal-tags-input-container">
              <input type="text" className="modal-tag-input" placeholder="Add a tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyPress={(e) => {
            if (e.key === 'Enter') {
                handleAddTag();
            }
        }}/>
              <button className="modal-add-tag-button" onClick={handleAddTag}>Add</button>
            </div>
            <div className="modal-tags-list">
              {tags.map((tag, idx) => (<span key={idx} className="modal-tag">
                  {tag}
                  <button className="modal-tag-remove" onClick={() => handleRemoveTag(tag)}>×</button>
                </span>))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-delete-button" onClick={handleDelete}>
            Delete Entry
          </button>
          <div className="modal-footer-actions">
            <button className="modal-cancel-button" onClick={() => {
            (0, audioUtils_1.playCancelSound)();
            onClose();
        }}>
              Cancel
            </button>
            <button className="modal-save-button" onClick={handleSave} disabled={saving || (!title.trim() && !content.trim())}>
              {saving ? 'Saving...' : 'Save (Ctrl+Enter)'}
            </button>
          </div>
        </div>
      </div>
    </div>);
}
