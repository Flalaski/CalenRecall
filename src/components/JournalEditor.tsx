import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { formatDate, getCanonicalDate } from '../utils/dateUtils';
import { getEntryForDate, saveJournalEntry, deleteJournalEntry } from '../services/journalService';
import './JournalEditor.css';

interface JournalEditorProps {
  date: Date;
  viewMode: TimeRange;
  selectedEntry?: JournalEntry | null;
  isNewEntry?: boolean;
  onEntrySaved?: () => void;
  onCancel?: () => void;
}

export default function JournalEditor({
  date,
  viewMode,
  selectedEntry: propSelectedEntry,
  isNewEntry = false,
  onEntrySaved,
  onCancel,
}: JournalEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (propSelectedEntry) {
      // Load the selected entry
      setTitle(propSelectedEntry.title);
      setContent(propSelectedEntry.content);
      setTags(propSelectedEntry.tags || []);
      setCurrentEntry(propSelectedEntry);
      setLoading(false);
    } else if (isNewEntry) {
      // Clear for new entry
      setTitle('');
      setContent('');
      setTags([]);
      setCurrentEntry(null);
      setLoading(false);
    } else {
      // Load entry for current date/viewMode
      loadEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, viewMode, propSelectedEntry, isNewEntry]);

  const loadEntry = async () => {
    setLoading(true);
    try {
      const existingEntry = await getEntryForDate(date, viewMode);
      setCurrentEntry(existingEntry);
      if (existingEntry) {
        setTitle(existingEntry.title);
        setContent(existingEntry.content);
        setTags(existingEntry.tags || []);
      } else {
        setTitle('');
        setContent('');
        setTags([]);
      }
    } catch (error) {
      console.error('Error loading entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('handleSave called', { title, content, hasTitle: !!title.trim(), hasContent: !!content.trim() });
    
    if (!title.trim() && !content.trim()) {
      alert('Please enter a title or content before saving.');
      return;
    }

    setSaving(true);
    try {
      const canonicalDate = getCanonicalDate(date, viewMode);
      const defaultTitle = getDefaultTitle();
      
      const entry: JournalEntry = {
        date: formatDate(canonicalDate),
        timeRange: viewMode,
        title: title.trim() || defaultTitle,
        content: content.trim(),
        tags: tags,
        createdAt: currentEntry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('Saving entry:', entry);
      await saveJournalEntry(entry);
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
    } catch (error) {
      console.error('Error saving entry:', error);
      alert(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
    } finally {
      setSaving(false);
    }
  };

  const getDefaultTitle = (): string => {
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
        return formatDate(date, 'MMMM d, yyyy');
      default:
        return formatDate(date, 'MMMM d, yyyy');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await deleteJournalEntry(date, viewMode);
      setCurrentEntry(null);
      setTitle('');
      setContent('');
      setTags([]);
      setCurrentEntry(null);
      // Trigger a custom event to refresh calendar and list
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
      // Notify parent
      if (onEntrySaved) {
        onEntrySaved();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
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

  if (loading) {
    return (
      <div className="journal-editor-inline">
        <div className="editor-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="journal-editor-inline">
      <div className="editor-header">
        <div className="header-top">
          <h3>{getDateLabel()}</h3>
        </div>
        {currentEntry && (
          <div className="entry-meta">
            <small>Created: {formatDate(new Date(currentEntry.createdAt), 'MMM d, yyyy')}</small>
            {currentEntry.updatedAt !== currentEntry.createdAt && (
              <small>Updated: {formatDate(new Date(currentEntry.updatedAt), 'MMM d, yyyy')}</small>
            )}
          </div>
        )}
      </div>
      
      <div className="editor-content">
        <input
          type="text"
          className="title-input"
          placeholder={`${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} entry title...`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        
        <textarea
          className="content-input"
          placeholder={`Write your ${viewMode} journal entry here...`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        
        <div className="tags-section">
          <div className="tags-input-container">
            <input
              type="text"
              className="tag-input"
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddTag();
                }
              }}
            />
            <button className="add-tag-button" onClick={handleAddTag}>Add</button>
          </div>
          <div className="tags-list">
            {tags.map((tag, idx) => (
              <span key={idx} className="tag">
                {tag}
                <button className="tag-remove" onClick={() => handleRemoveTag(tag)}>×</button>
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="editor-footer">
        {currentEntry && (
          <button className="delete-button" onClick={handleDelete}>
            Delete Entry
          </button>
        )}
        <div className="footer-actions">
          {onCancel && (
            <button className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving || (!title.trim() && !content.trim())}
          >
            {saving ? 'Saving...' : 'Save (Ctrl+Enter)'}
          </button>
        </div>
      </div>
    </div>
  );
}

