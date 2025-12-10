import { useState, useEffect, useCallback, useRef } from 'react';
import { JournalEntry, TimeRange, Preferences } from '../types';
import { formatDate, getCanonicalDate, isToday } from '../utils/dateUtils';
import { getEntryForDate, saveJournalEntry, deleteJournalEntry } from '../services/journalService';
import { playSaveSound, playCancelSound, playDeleteSound, playAddSound, playRemoveSound, playTimeInputSound, playTimeFieldFocusSound, playTimeIncrementSound, playTabSound, playTypingSound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
import './JournalEditor.css';

interface JournalEditorProps {
  date: Date;
  viewMode: TimeRange;
  selectedEntry?: JournalEntry | null;
  isNewEntry?: boolean;
  onEntrySaved?: () => void;
  onCancel?: () => void;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

export default function JournalEditor({
  date,
  viewMode,
  selectedEntry: propSelectedEntry,
  isNewEntry = false,
  onEntrySaved,
  onCancel,
  onUnsavedChangesChange,
}: JournalEditorProps) {
  const { calendar } = useCalendar();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [hour, setHour] = useState<number | undefined>(undefined);
  const [minute, setMinute] = useState<number | undefined>(undefined);
  const [second, setSecond] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const [originalHour, setOriginalHour] = useState<number | undefined>(undefined);
  const [originalMinute, setOriginalMinute] = useState<number | undefined>(undefined);
  const [originalSecond, setOriginalSecond] = useState<number | undefined>(undefined);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Load preferences for time format
  useEffect(() => {
    const loadPreferences = async () => {
      if (window.electronAPI) {
        const prefs = await window.electronAPI.getAllPreferences();
        setPreferences(prefs);
      }
    };
    loadPreferences();

    // Listen for preference updates
    if (window.electronAPI && window.electronAPI.onPreferenceUpdated) {
      const handlePreferenceUpdate = (data: { key: string; value: any }) => {
        if (data.key === 'timeFormat') {
          const newTimeFormat = data.value || '12h';
          setPreferences(prev => ({ ...prev, timeFormat: newTimeFormat }));
          
          // Convert current hour when format changes
          if (hour !== undefined && hour !== null) {
            // Get the stored 24-hour value from currentEntry if available
            const storedHour24 = currentEntry?.hour;
            
            if (newTimeFormat === '12h') {
              // Converting to 12-hour: use stored 24-hour value or convert current
              if (storedHour24 !== undefined && storedHour24 !== null) {
                const hour12 = storedHour24 === 0 ? 12 : (storedHour24 > 12 ? storedHour24 - 12 : storedHour24);
                setHour(hour12);
                setAmPm(storedHour24 >= 12 ? 'PM' : 'AM');
              } else {
                // No stored value, convert current hour assuming it's in old format
                const oldFormat = preferences.timeFormat || '12h';
                if (oldFormat === '24h') {
                  // Was 24-hour, convert to 12-hour
                  const hour12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
                  setHour(hour12);
                  setAmPm(hour >= 12 ? 'PM' : 'AM');
                }
              }
            } else {
              // Converting to 24-hour: convert current 12-hour value to 24-hour
              if (storedHour24 !== undefined && storedHour24 !== null) {
                setHour(storedHour24);
              } else {
                // Convert from 12-hour to 24-hour
                const hour24 = amPm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
                setHour(hour24);
              }
            }
          }
        } else {
          setPreferences(prev => ({ ...prev, [data.key]: data.value }));
        }
      };

      window.electronAPI.onPreferenceUpdated(handlePreferenceUpdate);
      return () => {
        if (window.electronAPI && window.electronAPI.removePreferenceUpdatedListener) {
          window.electronAPI.removePreferenceUpdatedListener();
        }
      };
    }
  }, [hour, amPm, currentEntry, preferences.timeFormat]);

  // Convert 24-hour to 12-hour format for display
  const getDisplayHour = (hour24: number | undefined | null): number | undefined => {
    if (hour24 === undefined || hour24 === null) return undefined;
    const timeFormat = preferences.timeFormat || '12h';
    if (timeFormat === '12h') {
      if (hour24 === 0) return 12;
      if (hour24 > 12) return hour24 - 12;
      return hour24;
    }
    return hour24;
  };

  // Convert 12-hour display hour + AM/PM to 24-hour format
  const convertTo24Hour = (hour12: number | undefined, amPmValue: 'AM' | 'PM'): number | undefined => {
    if (hour12 === undefined || hour12 === null) return undefined;
    const timeFormat = preferences.timeFormat || '12h';
    if (timeFormat === '12h') {
      if (amPmValue === 'AM') {
        return hour12 === 12 ? 0 : hour12;
      } else {
        return hour12 === 12 ? 12 : hour12 + 12;
      }
    }
    return hour12;
  };

  useEffect(() => {
    if (propSelectedEntry) {
      // Load the selected entry
      setTitle(propSelectedEntry.title);
      setContent(propSelectedEntry.content);
      setTags(propSelectedEntry.tags || []);
      // Always preserve time fields as foundational entry data
      // Convert null to undefined for UI state
      const hour24: number | undefined = (propSelectedEntry.hour !== null && propSelectedEntry.hour !== undefined) ? propSelectedEntry.hour : undefined;
      const minuteValue: number | undefined = (propSelectedEntry.minute !== null && propSelectedEntry.minute !== undefined) ? propSelectedEntry.minute : undefined;
      const secondValue: number | undefined = (propSelectedEntry.second !== null && propSelectedEntry.second !== undefined) ? propSelectedEntry.second : undefined;
      
      // Only display time fields in UI for day entries
      // But always preserve them in original state for saving
      if (propSelectedEntry.timeRange === 'day' && viewMode === 'day') {
        const timeFormat = preferences.timeFormat || '12h';
        if (timeFormat === '12h' && hour24 !== undefined) {
          setHour(getDisplayHour(hour24));
          setAmPm(hour24 >= 12 ? 'PM' : 'AM');
        } else {
          setHour(hour24);
          setAmPm(hour24 !== undefined && hour24 >= 12 ? 'PM' : 'AM');
        }
        setMinute(minuteValue);
        setSecond(secondValue);
      } else {
        // Clear UI state for non-day entries (time inputs not shown)
        // But preserve original values for saving
        setHour(undefined);
        setMinute(undefined);
        setSecond(undefined);
        setAmPm('AM');
      }
      // Always preserve original time fields for all entry types
      // This ensures time is saved as foundational entry data
      setOriginalHour(hour24);
      setOriginalMinute(minuteValue);
      setOriginalSecond(secondValue);
      setOriginalTitle(propSelectedEntry.title);
      setOriginalContent(propSelectedEntry.content);
      setOriginalTags(propSelectedEntry.tags || []);
      setCurrentEntry(propSelectedEntry);
      setLoading(false);
    } else if (isNewEntry) {
      // Clear for new entry
      setTitle('');
      setContent('');
      setTags([]);
      
      // If creating a day entry for today, automatically set time to "now"
      if (viewMode === 'day' && isToday(date)) {
        const now = new Date();
        const hour24 = now.getHours();
        const minute = now.getMinutes();
        const second = now.getSeconds();
        
        const timeFormat = preferences.timeFormat || '12h';
        if (timeFormat === '12h') {
          // Convert to 12-hour format
          const hour12 = hour24 === 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
          setHour(hour12);
          setAmPm(hour24 >= 12 ? 'PM' : 'AM');
        } else {
          // Use 24-hour format directly
          setHour(hour24);
        }
        setMinute(minute);
        setSecond(second);
        setOriginalHour(hour24);
        setOriginalMinute(minute);
        setOriginalSecond(second);
      } else {
        // For non-day entries or entries not for today, clear time fields
        setHour(undefined);
        setMinute(undefined);
        setSecond(undefined);
        setAmPm('AM');
        setOriginalHour(undefined);
        setOriginalMinute(undefined);
        setOriginalSecond(undefined);
      }
      
      setOriginalTitle('');
      setOriginalContent('');
      setOriginalTags([]);
      setCurrentEntry(null);
      setLoading(false);
    } else {
      // Load entry for current date/viewMode
      loadEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, viewMode, propSelectedEntry, isNewEntry, preferences.timeFormat]);

  const loadEntry = async () => {
    setLoading(true);
    try {
      const existingEntry = await getEntryForDate(date, viewMode);
      setCurrentEntry(existingEntry);
      if (existingEntry) {
        setTitle(existingEntry.title);
        setContent(existingEntry.content);
        setTags(existingEntry.tags || []);
        // Always preserve time fields as foundational entry data
        // Convert null to undefined for UI state (null comes from database, undefined is for empty state)
        const hour24: number | undefined = (existingEntry.hour !== null && existingEntry.hour !== undefined) ? existingEntry.hour : undefined;
        const minuteValue: number | undefined = (existingEntry.minute !== null && existingEntry.minute !== undefined) ? existingEntry.minute : undefined;
        const secondValue: number | undefined = (existingEntry.second !== null && existingEntry.second !== undefined) ? existingEntry.second : undefined;
        
        // Only display time fields in UI for day entries in day view mode
        // But always preserve them in original state for saving
        if (viewMode === 'day' && existingEntry.timeRange === 'day') {
          const timeFormat = preferences.timeFormat || '12h';
          if (timeFormat === '12h' && hour24 !== undefined) {
            setHour(getDisplayHour(hour24));
            setAmPm(hour24 >= 12 ? 'PM' : 'AM');
          } else {
            setHour(hour24);
            setAmPm(hour24 !== undefined && hour24 >= 12 ? 'PM' : 'AM');
          }
          setMinute(minuteValue);
          setSecond(secondValue);
        } else {
          // Clear UI state for non-day entries (time inputs not shown)
          // But preserve original values for saving
          setHour(undefined);
          setMinute(undefined);
          setSecond(undefined);
          setAmPm('AM');
        }
        // Always preserve original time fields for all entry types
        // This ensures time is saved as foundational entry data
        setOriginalHour(hour24);
        setOriginalMinute(minuteValue);
        setOriginalSecond(secondValue);
        setOriginalTitle(existingEntry.title);
        setOriginalContent(existingEntry.content);
        setOriginalTags(existingEntry.tags || []);
      } else {
        setTitle('');
        setContent('');
        setTags([]);
        
        // If in day view mode and the date is today, automatically set time to "now"
        if (viewMode === 'day' && isToday(date)) {
          const now = new Date();
          const hour24 = now.getHours();
          const minute = now.getMinutes();
          const second = now.getSeconds();
          
          const timeFormat = preferences.timeFormat || '12h';
          if (timeFormat === '12h') {
            // Convert to 12-hour format
            const hour12 = hour24 === 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
            setHour(hour12);
            setAmPm(hour24 >= 12 ? 'PM' : 'AM');
          } else {
            // Use 24-hour format directly
            setHour(hour24);
          }
          setMinute(minute);
          setSecond(second);
          setOriginalHour(hour24);
          setOriginalMinute(minute);
          setOriginalSecond(second);
        } else {
          // For non-day entries or entries not for today, clear time fields
          setHour(undefined);
          setMinute(undefined);
          setSecond(undefined);
          setAmPm('AM');
          setOriginalHour(undefined);
          setOriginalMinute(undefined);
          setOriginalSecond(undefined);
        }
        
        setOriginalTitle('');
        setOriginalContent('');
        setOriginalTags([]);
      }
    } catch (error) {
      console.error('Error loading entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultTitle = useCallback((): string => {
    // Use calendar-aware formatting
    try {
      return getTimeRangeLabelInCalendar(date, viewMode, calendar);
    } catch (e) {
      console.error('Error formatting date in calendar:', e);
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
          return formatDate(date, 'MMMM d, yyyy');
        default:
          return formatDate(date, 'MMMM d, yyyy');
      }
    }
  }, [date, viewMode, calendar]);


  const handleSave = async () => {
    // CRITICAL: Prevent multiple simultaneous saves using ref (synchronous check)
    if (isSavingRef.current || saving) {
      console.warn('[JournalEditor] ⚠️ Save already in progress, ignoring duplicate call');
      return;
    }
    
    // Set ref immediately to prevent duplicate calls
    isSavingRef.current = true;
    
    // VERBOSE LOGGING - Always show when save is triggered
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[JournalEditor] 🚀 handleSave FUNCTION CALLED');
    console.log('[JournalEditor] Entry State:', {
      title: title,
      contentLength: content.length,
      contentPreview: content.substring(0, 100),
      hour: hour,
      minute: minute,
      second: second,
      amPm: amPm,
      viewMode: viewMode,
      hasCurrentEntry: !!currentEntry,
      currentEntryId: currentEntry?.id,
      currentEntryHour: currentEntry?.hour,
      currentEntryMinute: currentEntry?.minute,
      currentEntrySecond: currentEntry?.second,
    });
    console.log('═══════════════════════════════════════════════════════════');
    
    if (!title.trim() && !content.trim()) {
      console.warn('[JournalEditor] ❌ Save blocked: No title or content');
      isSavingRef.current = false; // Reset ref if save is blocked
      alert('Please enter a title or content before saving.');
      return;
    }
    
    // Cancel any pending auto-save to prevent duplicate saves
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    
    // Prevent auto-save from running during manual save
    setSaving(true);
    
    playSaveSound();
    try {
      const defaultTitle = getDefaultTitle();
      
      // If editing an existing entry, preserve its original date and timeRange
      // Otherwise, calculate canonical date from current date/viewMode for new entries
      let entryDate: string;
      let entryTimeRange: TimeRange;
      
      if (currentEntry?.id) {
        // Preserve original date and timeRange when editing existing entry
        entryDate = currentEntry.date;
        entryTimeRange = currentEntry.timeRange;
      } else {
        // Calculate canonical date for new entries
        const canonicalDate = getCanonicalDate(date, viewMode);
        entryDate = formatDate(canonicalDate);
        entryTimeRange = viewMode;
      }
      
      // PROFESSIONAL TIME SAVE: Always process and include time fields explicitly
      // Step 1: Get raw values from state
      const rawHour = hour;
      const rawMinute = minute;
      const rawSecond = second;
      
      // Step 2: Convert hour to 24-hour format if provided
      let finalHour: number | null = null;
      if (rawHour !== undefined && rawHour !== null && !isNaN(rawHour)) {
        const converted = convertTo24Hour(rawHour, amPm);
        if (converted !== undefined && converted !== null && !isNaN(converted)) {
          finalHour = converted;
        }
      }
      
      // Step 3: Process minute - use state value or default to 0
      let finalMinute: number = 0;
      if (rawMinute !== undefined && rawMinute !== null && !isNaN(rawMinute)) {
        finalMinute = rawMinute;
      }
      
      // Step 4: Process second - use state value or default to 0
      let finalSecond: number = 0;
      if (rawSecond !== undefined && rawSecond !== null && !isNaN(rawSecond)) {
        finalSecond = rawSecond;
      }
      
      // Step 5: Build entry with time fields ALWAYS included (never undefined)
      const entry: JournalEntry = {
        id: currentEntry?.id,
        date: entryDate,
        timeRange: entryTimeRange,
        // CRITICAL: Time fields must always be present in entry object
        // Use null for hour if not set, 0 for minute/second if not set
        hour: finalHour,
        minute: finalMinute,
        second: finalSecond,
        title: title.trim() || defaultTitle,
        content: content.trim(),
        tags: tags || [],
        createdAt: currentEntry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Preserve other fields
        linkedEntries: currentEntry?.linkedEntries || [],
        archived: currentEntry?.archived || false,
        pinned: currentEntry?.pinned || false,
        attachments: currentEntry?.attachments || [],
      };
      
      // VERBOSE LOGGING - Time processing
      console.log('[JournalEditor] ⏰ Time Processing Step:');
      console.log('  Raw State Values:', { hour: rawHour, minute: rawMinute, second: rawSecond, amPm: amPm });
      console.log('  After Conversion:', { hour: finalHour, minute: finalMinute, second: finalSecond });
      console.log('  Final Entry Time Fields:', { hour: entry.hour, minute: entry.minute, second: entry.second });

      // VERBOSE LOGGING - Complete entry object
      console.log('[JournalEditor] 📦 Complete Entry Object Being Saved:');
      console.log(JSON.stringify(entry, null, 2));
      console.log('[JournalEditor] Entry Summary:', {
        id: entry.id,
        date: entry.date,
        timeRange: entry.timeRange,
        timeFields: {
          hour: entry.hour,
          hourType: typeof entry.hour,
          minute: entry.minute,
          minuteType: typeof entry.minute,
          second: entry.second,
          secondType: typeof entry.second,
        },
        title: entry.title,
        contentLength: entry.content.length,
        tagsCount: entry.tags?.length || 0,
        hasLinkedEntries: !!entry.linkedEntries,
        archived: entry.archived,
        pinned: entry.pinned,
      });
      
      console.log('[JournalEditor] 🔄 Calling saveJournalEntry IPC...');
      try {
        const savedEntry = await saveJournalEntry(entry);
        console.log('[JournalEditor] ✅ saveJournalEntry IPC call COMPLETED successfully');
        
        // Verify entry was saved with time
        if (savedEntry.hour !== null && savedEntry.hour !== undefined) {
          console.log('[JournalEditor] ✅✅✅ Entry saved WITH TIME:', `${savedEntry.hour}:${String(savedEntry.minute).padStart(2, '0')}:${String(savedEntry.second).padStart(2, '0')}`);
        } else if (savedEntry.minute !== 0 || savedEntry.second !== 0) {
          console.log('[JournalEditor] ⚠️ Entry saved with minute/second but no hour:', `--:${savedEntry.minute}:${savedEntry.second}`);
        } else {
          console.log('[JournalEditor] ℹ️ Entry saved without time fields (all null/zero)');
        }
        
        // CRITICAL: Use the saved entry with ID (for new entries, ID will now be populated)
        console.log('[JournalEditor] 📝 Saved entry ID:', savedEntry.id);
        setCurrentEntry(savedEntry);
      } catch (saveError) {
        console.error('[JournalEditor] ❌❌❌ ERROR saving entry:', saveError);
        throw saveError;
      }
      
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger a custom event to refresh calendar and list
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
      console.log('[JournalEditor] journalEntrySaved event dispatched');
      
      // Clear form after saving if it was a new entry
      if (isNewEntry) {
        setTitle('');
        setContent('');
        setTags([]);
        setHour(undefined);
        setMinute(undefined);
        setSecond(undefined);
        setCurrentEntry(null);
        // Reset original values for new entry
        setOriginalTitle('');
        setOriginalContent('');
        setOriginalTags([]);
        setOriginalHour(undefined);
        setOriginalMinute(undefined);
        setOriginalSecond(undefined);
      } else {
        // Update original values to match saved entry
        setOriginalTitle(title);
        setOriginalContent(content);
        setOriginalTags([...tags]);
        const currentHour24 = hour !== undefined && hour !== null ? convertTo24Hour(hour, amPm) : undefined;
        setOriginalHour(currentHour24);
        setOriginalMinute(minute);
        setOriginalSecond(second);
      }
      
      // Notify parent
      if (onEntrySaved) {
        onEntrySaved();
      }
      
      // Notify parent that there are no unsaved changes
      if (onUnsavedChangesChange) {
        onUnsavedChangesChange(false);
      }
    } catch (error) {
      console.error('═══════════════════════════════════════════════════════════');
      console.error('[JournalEditor] ❌❌❌ ERROR in handleSave:', error);
      console.error('[JournalEditor] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorObject: error
      });
      console.error('═══════════════════════════════════════════════════════════');
      alert(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
    } finally {
      console.log('[JournalEditor] ✅ handleSave function completed (finally block)');
      setSaving(false);
      isSavingRef.current = false; // Reset ref when save completes
    }
  };


  const handleDelete = async () => {
    if (!currentEntry || !currentEntry.id) {
      alert('Cannot delete entry: entry ID not found');
      return;
    }

    playDeleteSound();
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await deleteJournalEntry(currentEntry.id);
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
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      playAddSound();
      const newTags = [...tags, tag];
      setTags(newTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    playRemoveSound();
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Tab') {
      playTabSound();
    } else {
      // Play context-aware typing sound for printable keys
      // Skip for modifier keys and special shortcuts
      if (e.key.length === 1 || ['Backspace', 'Delete', 'Enter'].includes(e.key)) {
        playTypingSound({
          key: e.key,
          char: e.key.length === 1 ? e.key : undefined,
          isShift: e.shiftKey,
          isCtrl: e.ctrlKey,
          isAlt: e.altKey,
        });
      }
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    const titleChanged = title.trim() !== originalTitle.trim();
    const contentChanged = content.trim() !== originalContent.trim();
    const tagsChanged = JSON.stringify(tags.sort()) !== JSON.stringify(originalTags.sort());
    // Compare in 24-hour format for change detection
    const currentHour24 = hour !== undefined && hour !== null ? convertTo24Hour(hour, amPm) : undefined;
    const hourChanged = currentHour24 !== originalHour;
    const minuteChanged = minute !== originalMinute;
    const secondChanged = second !== originalSecond;
    return titleChanged || contentChanged || tagsChanged || hourChanged || minuteChanged || secondChanged;
  }, [title, content, tags, hour, minute, second, amPm, originalTitle, originalContent, originalTags, originalHour, originalMinute, originalSecond]);

  // Notify parent when unsaved changes status changes
  useEffect(() => {
    if (onUnsavedChangesChange) {
      const hasChanges = hasUnsavedChanges();
      onUnsavedChangesChange(hasChanges);
    }
  }, [title, content, tags, hour, minute, second, amPm, originalTitle, originalContent, originalTags, originalHour, originalMinute, originalSecond, onUnsavedChangesChange, hasUnsavedChanges]);

  // Handle cancel with confirmation if needed
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowConfirmDialog(true);
    } else {
      playCancelSound();
      if (onCancel) {
        onCancel();
      }
    }
  }, [hasUnsavedChanges, onCancel]);

  // Confirm discard changes
  const handleConfirmDiscard = useCallback(() => {
    playCancelSound();
    setShowConfirmDialog(false);
    // Notify parent that there are no unsaved changes
    if (onUnsavedChangesChange) {
      onUnsavedChangesChange(false);
    }
    if (onCancel) {
      onCancel();
    }
  }, [onCancel, onUnsavedChangesChange]);

  // Cancel discard confirmation
  const handleCancelDiscard = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  // Handle ESC key to cancel/edit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle ESC if confirmation dialog is open (it will handle its own ESC)
      if (showConfirmDialog) {
        return;
      }

      // Handle ESC key to cancel entry - works even when typing in inputs
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
  useEffect(() => {
    if (!showConfirmDialog) return;

    const handleDialogKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmDiscard();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelDiscard();
      }
    };

    window.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeyDown);
    };
  }, [showConfirmDialog, handleConfirmDiscard, handleCancelDiscard]);

  // Focus title input when creating a new entry
  useEffect(() => {
    if (isNewEntry && !loading && titleInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 0);
    }
  }, [isNewEntry, loading]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Handle "now" button - set current local time
  const handleSetNow = () => {
    playAddSound(); // Play add sound for setting current time
    const now = new Date();
    const hour24 = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    
    const timeFormat = preferences.timeFormat || '12h';
    if (timeFormat === '12h') {
      // Convert to 12-hour format
      const hour12 = hour24 === 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
      setHour(hour12);
      setAmPm(hour24 >= 12 ? 'PM' : 'AM');
    } else {
      // Use 24-hour format directly
      setHour(hour24);
    }
    setMinute(minute);
    setSecond(second);
  };

  const getDateLabel = () => {
    // Use calendar-aware formatting
    try {
      return getTimeRangeLabelInCalendar(date, viewMode, calendar);
    } catch (e) {
      console.error('Error formatting date in calendar:', e);
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
        {viewMode === 'day' && (
          <div className="time-inputs-section">
            <label className="time-label">Time (optional):</label>
            <div className="time-inputs">
              <div className="time-input-group">
                <label htmlFor="hour-input">Hour</label>
                <input
                  id="hour-input"
                  type="number"
                  className="time-input"
                  min={(preferences.timeFormat || '12h') === '12h' ? 1 : 0}
                  max={(preferences.timeFormat || '12h') === '12h' ? 12 : 23}
                  placeholder="--"
                  value={hour !== undefined && hour !== null ? hour : ''}
                  onFocus={() => playTimeFieldFocusSound()}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '' || inputValue === null) {
                      setHour(undefined);
                      return;
                    }
                    const parsed = parseInt(inputValue, 10);
                    if (isNaN(parsed)) {
                      return; // Invalid input, don't update
                    }
                    const timeFormat = preferences.timeFormat || '12h';
                    const maxVal = timeFormat === '12h' ? 12 : 23;
                    const minVal = timeFormat === '12h' ? 1 : 0;
                    if (parsed >= minVal && parsed <= maxVal) {
                      setHour(parsed);
                      playTimeInputSound();
                      console.log('[JournalEditor] Hour state updated to:', parsed);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      playTimeIncrementSound(e.key === 'ArrowUp' ? 'up' : 'down');
                    } else if (e.key === 'Tab') {
                      playTabSound();
                    }
                  }}
                />
              </div>
              {(preferences.timeFormat || '12h') === '12h' && (
                <div className="time-input-group time-input-group-ampm">
                  <label htmlFor="ampm-input">AM/PM</label>
                  <select
                    id="ampm-input"
                    className="time-input"
                    value={amPm}
                    onFocus={() => playTimeFieldFocusSound()}
                    onChange={(e) => {
                      setAmPm(e.target.value as 'AM' | 'PM');
                      playTimeInputSound();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        playTabSound();
                      }
                    }}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              )}
              <div className="time-input-group">
                <label htmlFor="minute-input">Minute</label>
                <input
                  id="minute-input"
                  type="number"
                  className="time-input"
                  min="0"
                  max="59"
                  placeholder="--"
                  value={minute !== undefined && minute !== null ? minute : ''}
                  onFocus={() => playTimeFieldFocusSound()}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '' || inputValue === null) {
                      setMinute(undefined);
                      return;
                    }
                    const parsed = parseInt(inputValue, 10);
                    if (isNaN(parsed)) {
                      return; // Invalid input, don't update
                    }
                    if (parsed >= 0 && parsed <= 59) {
                      setMinute(parsed);
                      playTimeInputSound();
                      console.log('[JournalEditor] Minute state updated to:', parsed);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      playTimeIncrementSound(e.key === 'ArrowUp' ? 'up' : 'down');
                    } else if (e.key === 'Tab') {
                      playTabSound();
                    }
                  }}
                />
              </div>
              <div className="time-input-group">
                <label htmlFor="second-input">Second</label>
                <input
                  id="second-input"
                  type="number"
                  className="time-input"
                  min="0"
                  max="59"
                  placeholder="--"
                  value={second !== undefined && second !== null ? second : ''}
                  onFocus={() => playTimeFieldFocusSound()}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '' || inputValue === null) {
                      setSecond(undefined);
                      return;
                    }
                    const parsed = parseInt(inputValue, 10);
                    if (isNaN(parsed)) {
                      return; // Invalid input, don't update
                    }
                    if (parsed >= 0 && parsed <= 59) {
                      setSecond(parsed);
                      playTimeInputSound();
                      console.log('[JournalEditor] Second state updated to:', parsed);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      playTimeIncrementSound(e.key === 'ArrowUp' ? 'up' : 'down');
                    } else if (e.key === 'Tab') {
                      playTabSound();
                    }
                  }}
                />
              </div>
            </div>
            <div className="time-buttons">
              <button
                type="button"
                className="clear-time-button"
                onClick={() => {
                  playRemoveSound();
                  setHour(undefined);
                  setMinute(undefined);
                  setSecond(undefined);
                  setAmPm('AM');
                }}
                title="Clear time"
              >
                Clear
              </button>
              <button
                type="button"
                className="now-time-button"
                onClick={handleSetNow}
                title="Set to current time"
              >
                Now
              </button>
            </div>
          </div>
        )}
        
        <input
          ref={titleInputRef}
          type="text"
          className="title-input"
          placeholder={`${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} entry title...`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            // Typing sound is handled in onKeyDown for better key context
          }}
          onKeyDown={handleKeyPress}
        />
        
        <textarea
          className="content-input"
          placeholder={`Write your ${viewMode} journal entry here...`}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            // Typing sound is handled in onKeyDown for better key context
          }}
          onKeyDown={handleKeyPress}
        />
        
        <div className="tags-section">
          <div className="tags-input-container">
            <input
              type="text"
              className="tag-input"
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                // Typing sound is handled in onKeyDown for better key context
              }}
              onKeyDown={(e) => {
                // Play context-aware typing sound for printable keys
                if (e.key.length === 1 || ['Backspace', 'Delete', 'Enter'].includes(e.key)) {
                  playTypingSound({
                    key: e.key,
                    char: e.key.length === 1 ? e.key : undefined,
                    isShift: e.shiftKey,
                    isCtrl: e.ctrlKey,
                    isAlt: e.altKey,
                  });
                }
                
                // Handle Enter key for tag input
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSave();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddTag();
                }
              }}
            />
            <button type="button" className="add-tag-button" onClick={handleAddTag}>Add</button>
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
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          )}
          <button
            className="save-button"
            onClick={() => {
              console.log('[JournalEditor] 🔘 SAVE BUTTON CLICKED');
              console.log('[JournalEditor] Button click - current state:', {
                saving: saving,
                hasTitle: !!title.trim(),
                hasContent: !!content.trim(),
                hour: hour,
                minute: minute,
                second: second
              });
              handleSave();
            }}
            disabled={saving || (!title.trim() && !content.trim())}
          >
            {saving ? 'Saving...' : 'Save (Ctrl+Enter)'}
          </button>
        </div>
      </div>
      
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay" onClick={handleCancelDiscard}>
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
        </div>
      )}
    </div>
  );
}

