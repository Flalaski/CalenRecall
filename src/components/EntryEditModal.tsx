import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange, Preferences } from '../types';
import { formatDate, getCanonicalDate, formatTime } from '../utils/dateUtils';
import { saveJournalEntry, deleteJournalEntry } from '../services/journalService';
import { playSaveSound, playCancelSound, playDeleteSound, playAddSound, playRemoveSound } from '../utils/audioUtils';
import './EntryEditModal.css';

interface EntryEditModalProps {
  entry: JournalEntry;
  isOpen: boolean;
  onClose: () => void;
  onEntrySaved?: () => void;
  onEntryDuplicated?: () => void;
}

export default function EntryEditModal({
  entry,
  isOpen,
  onClose,
  onEntrySaved,
  onEntryDuplicated,
}: EntryEditModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({});

  useEffect(() => {
    if (isOpen && entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setTags(entry.tags || []);
      setTagInput('');
    }
  }, [isOpen, entry]);

  // Load preferences for time format
  useEffect(() => {
    const loadPreferences = async () => {
      if (window.electronAPI) {
        const prefs = await window.electronAPI.getAllPreferences();
        setPreferences(prefs);
      }
    };
    loadPreferences();
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
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

    playSaveSound();
    setSaving(true);

    try {
      const updatedEntry: JournalEntry = {
        ...entry,
        title: title.trim() || entry.title,
        content: content.trim(),
        tags: tags,
        updatedAt: new Date().toISOString(),
      };

      await saveJournalEntry(updatedEntry);

      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger a custom event to refresh calendar and list
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));

      // Notify parent
      if (onEntrySaved) {
        onEntrySaved();
      }

      onClose();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry.id) {
      alert('Cannot delete entry: entry ID not found');
      return;
    }

    playDeleteSound();
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await deleteJournalEntry(entry.id);
      // Trigger a custom event to refresh calendar and list
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
      // Notify parent
      if (onEntrySaved) {
        onEntrySaved();
      }
      onClose();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      playAddSound();
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    playRemoveSound();
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleDuplicate = async () => {
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
      
      onClose();
    } catch (error) {
      console.error('Error duplicating entry:', error);
      alert('Failed to duplicate entry. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const formatEntryTime = (entry: JournalEntry): string | null => {
    const timeFormat = preferences.timeFormat || '12h';
    return formatTime(entry.hour, entry.minute, entry.second, timeFormat);
  };

  const formatEntryDate = (entry: JournalEntry): string => {
    const [entryYearStr, entryMonthStr, entryDayStr] = entry.date.split('-');
    const entryDate = new Date(
      parseInt(entryYearStr, 10),
      parseInt(entryMonthStr, 10) - 1,
      parseInt(entryDayStr, 10)
    );
    
    let dateStr: string;
    switch (entry.timeRange) {
      case 'decade':
        const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
        dateStr = `${decadeStart}s`;
        break;
      case 'year':
        dateStr = formatDate(entryDate, 'yyyy');
        break;
      case 'month':
        dateStr = formatDate(entryDate, 'MMMM yyyy');
        break;
      case 'week':
        dateStr = `Week of ${formatDate(entryDate, 'MMM d, yyyy')}`;
        break;
      case 'day':
        dateStr = formatDate(entryDate, 'MMM d, yyyy');
        break;
      default:
        dateStr = formatDate(entryDate, 'MMM d, yyyy');
    }
    
    // Append time if available
    // Append time if available (only for day entries)
    if (entry.timeRange === 'day') {
      const timeStr = formatEntryTime(entry);
      if (timeStr) {
        return `${dateStr} at ${timeStr}`;
      }
    }
    return dateStr;
  };

  if (!isOpen) return null;

  return (
    <div className="entry-edit-modal-overlay" onClick={onClose}>
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
            <small className="entry-date-display">
              Date: {formatEntryDate(entry)}
            </small>
            <small>Created: {formatDate(new Date(entry.createdAt), 'MMM d, yyyy')}</small>
            {entry.updatedAt !== entry.createdAt && (
              <small>Updated: {formatDate(new Date(entry.updatedAt), 'MMM d, yyyy')}</small>
            )}
          </div>
        </div>

        <div className="modal-content">
          <input
            type="text"
            className="modal-title-input"
            placeholder="Entry title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            autoFocus
          />

          <textarea
            className="modal-content-input"
            placeholder="Write your journal entry here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyPress}
          />

          <div className="modal-tags-section">
            <div className="modal-tags-input-container">
              <input
                type="text"
                className="modal-tag-input"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag();
                  }
                }}
              />
              <button className="modal-add-tag-button" onClick={handleAddTag}>Add</button>
            </div>
            <div className="modal-tags-list">
              {tags.map((tag, idx) => (
                <span key={idx} className="modal-tag">
                  {tag}
                  <button className="modal-tag-remove" onClick={() => handleRemoveTag(tag)}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            <button className="modal-duplicate-button" onClick={handleDuplicate} title="Duplicate this entry">
              Duplicate
            </button>
            <button className="modal-delete-button" onClick={handleDelete}>
              Delete Entry
            </button>
          </div>
          <div className="modal-footer-actions">
            <button
              className="modal-cancel-button"
              onClick={() => {
                playCancelSound();
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              className="modal-save-button"
              onClick={handleSave}
              disabled={saving || (!title.trim() && !content.trim())}
            >
              {saving ? 'Saving...' : 'Save (Ctrl+Enter)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

