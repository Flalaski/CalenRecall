import { useState, useEffect, useRef, useCallback } from 'react';
import TimelineView from './components/TimelineView';
import JournalEditor from './components/JournalEditor';
import EntryViewer from './components/EntryViewer';
import NavigationBar from './components/NavigationBar';
import GlobalTimelineMinimap from './components/GlobalTimelineMinimap';
import EntryEditModal from './components/EntryEditModal';
import SearchView from './components/SearchView';
import LoadingScreen from './components/LoadingScreen';
import BackgroundArt from './components/BackgroundArt';
import { TimeRange, JournalEntry, Preferences } from './types';
import { getEntryForDate } from './services/journalService';
import { playNewEntrySound } from './utils/audioUtils';
import { formatDateToISO, parseISODate } from './utils/dateUtils';
import { applyTheme, initializeTheme, applyFontSize } from './utils/themes';
import { useEntries } from './contexts/EntriesContext';
import './App.css';

function App() {
  const { setEntries, isLoading, setIsLoading } = useEntries();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<TimeRange>('month');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [backgroundImagePath, setBackgroundImagePath] = useState<string | null>(null);
  
  // Track if initial load has completed - after this, default view mode should NEVER be applied
  const initialLoadCompleteRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  // Track when an entry is being selected to prevent loadCurrentEntry from overwriting it
  const isSelectingEntryRef = useRef(false);
  // Cache background image path to avoid unnecessary reloads
  const backgroundImagePathRef = useRef<string | null>(null);
  // Track theme cleanup function for 'auto' theme listener
  const themeCleanupRef = useRef<(() => void) | null>(null);

  // SUPREME OPTIMIZATION: Preload all entries at startup
  useEffect(() => {
    if (initialLoadCompleteRef.current) {
      return;
    }

    const preloadAllEntries = async () => {
      try {
        setLoadingMessage('Loading all journal entries...');
        setLoadingProgress(5);
        
        if (window.electronAPI) {
          // Load all entries at once
          const allEntries = await window.electronAPI.getAllEntries();
          
          // Progressive loading simulation - show entries appearing on tree
          const totalEntries = allEntries.length;
          const batchSize = Math.max(1, Math.floor(totalEntries / 50)); // 50 batches
          
          for (let i = 0; i < totalEntries; i += batchSize) {
            const batch = allEntries.slice(0, i + batchSize);
            setEntries(batch);
            
            const progress = 10 + (i / totalEntries) * 70; // 10% to 80%
            setLoadingProgress(progress);
            
            // Small delay between batches to see progression
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Set all entries
          setEntries(allEntries);
          setLoadingProgress(85);
          setLoadingMessage('Indexing entries...');
          
          // Delay to show indexing
          await new Promise(resolve => setTimeout(resolve, 500));
          
          setLoadingProgress(95);
          setLoadingMessage('Finalizing timeline...');
          
          // Delay to show finalizing
          await new Promise(resolve => setTimeout(resolve, 500));
          
          setLoadingProgress(100);
          setLoadingMessage('Ready!');
          
          // Extended delay to admire the decorated infinity tree
          await new Promise(resolve => setTimeout(resolve, 2000));
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error preloading entries:', error);
        setIsLoading(false);
      }
    };

    preloadAllEntries();
  }, [setEntries, setIsLoading]);

  // Optimized function to update specific preference without full reload
  // Memoized with useCallback so IPC listener always has the latest version
  const updateSpecificPreference = useCallback(async (key: string, value: any) => {
    console.log('[App] updateSpecificPreference called:', key, value);
    if (key === 'theme') {
      // Clean up previous theme listener if it exists
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
        themeCleanupRef.current = null;
      }
      
      // Apply theme immediately (synchronous for instant feedback)
      const theme = (value || 'light') as any;
      console.log('[App] Applying theme:', theme);
      console.log('[App] Current document.documentElement:', document.documentElement);
      console.log('[App] Current data-theme attribute:', document.documentElement.getAttribute('data-theme'));
      
      // For 'auto' theme, use initializeTheme which applies theme and sets up listener
      // For other themes, just apply the theme directly
      if (theme === 'auto') {
        const cleanup = initializeTheme(theme);
        themeCleanupRef.current = cleanup;
      } else {
        applyTheme(theme);
      }
      
      // Force a reflow to ensure CSS is recalculated
      void document.documentElement.offsetHeight;
      
      // Verify and re-apply if needed after a short delay
      setTimeout(() => {
        const appliedTheme = document.documentElement?.getAttribute('data-theme');
        const expectedTheme = theme === 'auto' 
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;
        if (appliedTheme !== expectedTheme) {
          console.warn('[App] Theme verification failed! Expected:', expectedTheme, 'Got:', appliedTheme);
          console.log('[App] Force re-applying theme');
          if (theme === 'auto') {
            const cleanup = initializeTheme(theme);
            if (themeCleanupRef.current) {
              themeCleanupRef.current();
            }
            themeCleanupRef.current = cleanup;
          } else {
            applyTheme(theme);
          }
          void document.documentElement.offsetHeight;
        } else {
          console.log('[App] Theme verified successfully:', appliedTheme);
        }
      }, 50);
      
      console.log('[App] After theme application, data-theme attribute:', document.documentElement.getAttribute('data-theme'));
      
      // Update preferences state to trigger re-render
      setPreferences(prev => {
        console.log('[App] Updating preferences state, prev theme:', prev.theme, 'new theme:', value);
        return { ...prev, theme: value };
      });
    } else if (key === 'fontSize') {
      // Apply font size immediately (synchronous for instant feedback)
      applyFontSize(value);
      
      // Force a reflow to ensure CSS is recalculated
      void document.documentElement.offsetHeight;
      
      // Verify and re-apply if needed after a short delay
      setTimeout(() => {
        const appliedFontSize = document.documentElement?.getAttribute('data-font-size');
        const expectedFontSize = value || 'medium';
        if (appliedFontSize !== expectedFontSize) {
          console.warn('[App] Font size verification failed! Expected:', expectedFontSize, 'Got:', appliedFontSize);
          console.log('[App] Force re-applying font size');
          applyFontSize(value);
          void document.documentElement.offsetHeight;
        } else {
          console.log('[App] Font size verified successfully:', appliedFontSize);
        }
      }, 50);
      
      // Update preferences state
      setPreferences(prev => ({ ...prev, fontSize: value }));
    } else if (key === 'backgroundImage') {
      // Only reload background image if it actually changed
      const newPath = value || null;
      if (newPath !== backgroundImagePathRef.current) {
        backgroundImagePathRef.current = newPath;
        if (newPath) {
          // Load new background image
          window.electronAPI?.getBackgroundImagePath().then((bgResult) => {
            if (bgResult.success && bgResult.path) {
              setBackgroundImagePath(bgResult.path);
            } else {
              setBackgroundImagePath(null);
            }
          }).catch(() => {
            setBackgroundImagePath(null);
          });
        } else {
          setBackgroundImagePath(null);
        }
      }
      // Update preferences state
      setPreferences(prev => ({ ...prev, backgroundImage: value }));
    } else if (key === 'minimapCrystalUseDefaultColors') {
      // Update preferences state
      setPreferences(prev => ({ ...prev, minimapCrystalUseDefaultColors: value }));
      // Dispatch window event so GlobalTimelineMinimap can update immediately
      window.dispatchEvent(new CustomEvent('preferences-updated', { 
        detail: { key: 'minimapCrystalUseDefaultColors', value } 
      }));
    } else if (key === 'minimapSize') {
      // Update preferences state immediately for minimap size
      // This triggers a re-render which will apply the changes via props to GlobalTimelineMinimap
      console.log('[App] Updating minimap size:', value);
      setPreferences(prev => {
        const updated = { ...prev, minimapSize: value };
        console.log('[App] Preferences state updated with minimapSize:', updated.minimapSize);
        return updated;
      });
    } else if (key === 'showMinimap') {
      // Update preferences state immediately for show minimap toggle
      // This triggers a re-render which will show/hide the minimap
      console.log('[App] Updating show minimap:', value);
      setPreferences(prev => ({ ...prev, showMinimap: value }));
    } else if (key === 'weekStartsOn') {
      // Update preferences state immediately for week starts on
      // This triggers a re-render which will update all calendar views
      console.log('[App] Updating week starts on:', value);
      setPreferences(prev => ({ ...prev, weekStartsOn: value }));
    } else {
      // For all other preferences, update state (they may not need immediate UI updates)
      setPreferences(prev => ({ ...prev, [key]: value }));
    }
  }, [setBackgroundImagePath]);

  // Load preferences on startup - ONLY ONCE, on initial mount
  useEffect(() => {
    // Only run on the very first mount
    if (initialLoadCompleteRef.current) {
      return;
    }
    
    const loadPreferences = async () => {
      try {
        if (window.electronAPI) {
          const prefs = await window.electronAPI.getAllPreferences();
          setPreferences(prefs);
          
          // Restore last viewed position if enabled, otherwise use default view mode
          // This ONLY happens on initial load - never after user interaction
          if (prefs.restoreLastView && prefs.lastViewedDate && prefs.lastViewedMode) {
            const lastDate = new Date(prefs.lastViewedDate);
            const validTimeRanges: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
            const isValidDate = !isNaN(lastDate.getTime());
            const isValidMode = validTimeRanges.includes(prefs.lastViewedMode);
            
            if (isValidDate && isValidMode) {
              // Validate date is reasonable (not before year 1000 or after year 3000)
              const year = lastDate.getFullYear();
              if (year >= 1000 && year <= 3000) {
                setSelectedDate(lastDate);
                setViewMode(prefs.lastViewedMode);
              } else {
                // Date out of reasonable range, fall back to default (ONLY on initial load)
                if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                  setViewMode(prefs.defaultViewMode);
                }
              }
            } else {
              // Invalid date or mode, fall back to default (ONLY on initial load)
              if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                setViewMode(prefs.defaultViewMode);
              }
            }
          } else {
            // Apply default view mode (ONLY on initial load, before any user interaction)
            if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
              setViewMode(prefs.defaultViewMode);
            }
          }
          
          // Apply theme and font size
          // The applyTheme and applyFontSize functions have built-in retry logic for timing issues
          const theme = (prefs.theme || 'light') as any;
          const fontSize = prefs.fontSize || 'medium';
          const minimapSize = prefs.minimapSize || 'medium';
          
          console.log('[App] Loading preferences:', { theme, fontSize, minimapSize, showMinimap: prefs.showMinimap });
          
          // Apply immediately
          applyTheme(theme);
          initializeTheme(theme);
          applyFontSize(fontSize);
          
          // In built versions, sometimes the DOM isn't fully ready when React first renders
          // Apply again after DOM is ready to ensure it takes effect
          // The functions themselves have retry logic, but this ensures it works in built versions
          const applyPreferences = () => {
            console.log('[App] Applying preferences:', { theme, fontSize });
            applyTheme(theme);
            applyFontSize(fontSize);
            
            // Verify they were applied
            const appliedFontSize = document.documentElement?.getAttribute('data-font-size');
            const appliedTheme = document.documentElement?.getAttribute('data-theme');
            console.log('[App] Preferences applied - fontSize:', appliedFontSize, 'theme:', appliedTheme);
          };
          
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyPreferences);
          } else {
            // DOM is already ready, but apply again after a brief delay for built versions
            // This ensures CSS is loaded and styles are applied
            requestAnimationFrame(applyPreferences);
            
            // Additional retry for built versions where CSS might load asynchronously
            setTimeout(applyPreferences, 100);
            setTimeout(applyPreferences, 500);
          }

          // Load background image path
          if (window.electronAPI && prefs.backgroundImage) {
            const bgResult = await window.electronAPI.getBackgroundImagePath();
            if (bgResult.success && bgResult.path) {
              setBackgroundImagePath(bgResult.path);
            } else {
              setBackgroundImagePath(null);
            }
          } else {
            setBackgroundImagePath(null);
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setPreferencesLoaded(true);
        initialLoadCompleteRef.current = true; // Mark initial load as complete
      }
    };
    
    loadPreferences();
  }, []);

  // Set up IPC listener for preference updates from preferences window
  // This ensures the listener is always ready to receive updates
  // Use a ref to store the latest updateSpecificPreference function so the listener doesn't need to be recreated
  const updateSpecificPreferenceRef = useRef(updateSpecificPreference);
  
  // Keep the ref updated
  useEffect(() => {
    updateSpecificPreferenceRef.current = updateSpecificPreference;
  }, [updateSpecificPreference]);

  // Set up IPC listener IMMEDIATELY on mount, before anything else
  // This must be set up as early as possible to catch all messages
  useEffect(() => {
    const setupListener = () => {
      if (!window.electronAPI || !('onPreferenceUpdated' in window.electronAPI)) {
        console.warn('[App] IPC preference update listener not available, will retry');
        return false;
      }

      console.log('[App] Setting up IPC preference update listener');
      const handlePreferenceUpdate = (data: { key: string; value: any }) => {
        console.log('[App] ✅ Received preference update via IPC:', data);
        // Use the ref to get the latest version of updateSpecificPreference
        updateSpecificPreferenceRef.current(data.key, data.value);
        
        // For theme changes, verify it was applied correctly after a short delay
        // This catches cases where the theme wasn't applied due to timing issues
        if (data.key === 'theme') {
          setTimeout(() => {
            const appliedTheme = document.documentElement?.getAttribute('data-theme');
            const expectedTheme = data.value === 'auto' 
              ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
              : data.value;
            if (appliedTheme !== expectedTheme) {
              console.warn('[App] ⚠️ Theme mismatch detected! Expected:', expectedTheme, 'Got:', appliedTheme);
              console.log('[App] Re-applying theme to fix mismatch');
              // Re-apply using the ref to get the latest function
              updateSpecificPreferenceRef.current('theme', data.value);
            } else {
              console.log('[App] ✅ Theme verified correctly:', appliedTheme);
            }
          }, 300);
        }
      };
      
      (window.electronAPI as any).onPreferenceUpdated(handlePreferenceUpdate);
      console.log('[App] ✅ IPC preference update listener is now active');
      return true;
    };

    // Try to set up immediately
    if (!setupListener()) {
      // Retry after a short delay in case electronAPI isn't ready yet
      const retryTimer = setTimeout(() => {
        if (!setupListener()) {
          // Try one more time after a longer delay
          setTimeout(() => {
            setupListener();
          }, 500);
        }
      }, 100);
      return () => clearTimeout(retryTimer);
    }

    return () => {
      if (window.electronAPI && 'removePreferenceUpdatedListener' in window.electronAPI) {
        (window.electronAPI as any).removePreferenceUpdatedListener();
      }
    };
  }, []); // Empty deps - listener is set up once and uses ref for latest function

  // Check for theme changes when window gains focus or becomes visible (in case IPC message was missed)
  useEffect(() => {
    const checkAndApplyTheme = async () => {
      if (window.electronAPI) {
        try {
          const prefs = await window.electronAPI.getAllPreferences();
          const currentTheme = document.documentElement?.getAttribute('data-theme');
          const expectedTheme = prefs.theme === 'auto' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : prefs.theme || 'light';
          
          if (currentTheme !== expectedTheme) {
            console.log('[App] 🔄 Theme mismatch detected on focus/visibility, applying theme:', expectedTheme);
            updateSpecificPreferenceRef.current('theme', prefs.theme || 'light');
          }
        } catch (error) {
          console.error('[App] Error checking theme on focus/visibility:', error);
        }
      }
    };

    // Check when window gains focus
    window.addEventListener('focus', checkAndApplyTheme);
    // Check when window becomes visible (handles cases where preferences window was closed)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndApplyTheme();
      }
    });
    
    // Also periodically check for theme changes (every 2 seconds) as a safety net
    // This ensures theme changes are picked up even if IPC messages are missed
    const themeCheckInterval = setInterval(() => {
      checkAndApplyTheme();
    }, 2000);
    
    return () => {
      window.removeEventListener('focus', checkAndApplyTheme);
      document.removeEventListener('visibilitychange', checkAndApplyTheme);
      clearInterval(themeCheckInterval);
    };
  }, []);

  // Cleanup theme listener on unmount
  useEffect(() => {
    return () => {
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
        themeCleanupRef.current = null;
      }
    };
  }, []);

  // Listen for window events (fallback for same-window communication)
  useEffect(() => {
    const handleWindowEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string; value?: any }>;
      const key = customEvent.detail?.key;
      const value = customEvent.detail?.value;
      
      if (key) {
        updateSpecificPreference(key, value);
      } else {
        // Fallback to full refresh if no key specified
        if (window.electronAPI) {
          window.electronAPI.getAllPreferences().then(prefs => {
            setPreferences(prefs);
            const theme = (prefs.theme || 'light') as any;
            applyTheme(theme);
            applyFontSize(prefs.fontSize);
          }).catch(console.error);
        }
      }
    };
    
    window.addEventListener('preferences-updated', handleWindowEvent);
    document.addEventListener('preferences-updated', handleWindowEvent);
    
    return () => {
      window.removeEventListener('preferences-updated', handleWindowEvent);
      document.removeEventListener('preferences-updated', handleWindowEvent);
    };
  }, [updateSpecificPreference]);

  // Save last viewed position when date or view mode changes (if restoreLastView is enabled)
  // Use a ref to track if we're in the initial restore phase to avoid saving during restoration
  const isRestoringRef = useRef(true);
  
  useEffect(() => {
    // After preferences are loaded, allow saving
    if (preferencesLoaded) {
      // Small delay to ensure restoration has completed
      const timer = setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [preferencesLoaded]);

  useEffect(() => {
    // Only save if preferences are loaded, restore is enabled, and we're not in the restoration phase
    if (preferencesLoaded && !isRestoringRef.current && preferences.restoreLastView && window.electronAPI) {
      try {
        // Use formatDateToISO to handle negative years correctly
        const dateString = formatDateToISO(selectedDate);
        // Validate date string format (YYYY-MM-DD or -YYYY-MM-DD for negative years)
        if (/^-?\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          window.electronAPI.setPreference('lastViewedDate', dateString).catch(console.error);
          window.electronAPI.setPreference('lastViewedMode', viewMode).catch(console.error);
        }
      } catch (error) {
        console.error('Error saving last viewed position:', error);
      }
    }
  }, [selectedDate, viewMode, preferencesLoaded, preferences.restoreLastView]);

  // Load entry for current date/viewMode when they change
  useEffect(() => {
    if (!isNewEntry && !isEditing) {
      // In day view, don't auto-load an entry - user must click to select one
      if (viewMode === 'day') {
        // Only clear if we're not in the middle of selecting an entry
        if (!isSelectingEntryRef.current) {
          setSelectedEntry(null);
        }
      } else {
        loadCurrentEntry();
      }
    }
    // Reset the flag after the effect runs
    if (isSelectingEntryRef.current) {
      isSelectingEntryRef.current = false;
    }
  }, [selectedDate, viewMode, isNewEntry, isEditing]);

  const loadCurrentEntry = async () => {
    try {
      const entry = await getEntryForDate(selectedDate, viewMode);
      setSelectedEntry(entry);
    } catch (error) {
      console.error('Error loading entry:', error);
      setSelectedEntry(null);
    }
  };

  const handleTimePeriodSelect = (date: Date, newViewMode: TimeRange) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    // Clear selected entry when changing date/view in day view
    if (newViewMode === 'day') {
      setSelectedEntry(null);
    }
    setSelectedDate(date);
    setViewMode(newViewMode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const handleViewModeChange = (mode: TimeRange) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    // Clear selected entry when switching to day view
    if (mode === 'day') {
      setSelectedEntry(null);
    }
    setViewMode(mode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    hasUserInteractedRef.current = true; // Mark that user has interacted
    // Mark that we're selecting an entry to prevent loadCurrentEntry from overwriting it
    isSelectingEntryRef.current = true;
    // Navigate to the entry's date and time range, then select the entry
    // Parse date string to avoid timezone issues (YYYY-MM-DD or -YYYY-MM-DD format)
    const entryDate = parseISODate(entry.date);
    setSelectedDate(entryDate);
    setViewMode(entry.timeRange);
    setSelectedEntry(entry);
    setIsNewEntry(false);
    setIsEditing(false);
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setIsNewEntry(true);
    setIsEditing(true);
  };

  // Use ref to access current handleNewEntry in keyboard handler
  const handleNewEntryRef = useRef(handleNewEntry);
  
  // Keep ref updated
  useEffect(() => {
    handleNewEntryRef.current = handleNewEntry;
  }, [handleNewEntry]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.closest('input') || target.closest('textarea') || target.closest('[contenteditable="true"]'))
      ) {
        return;
      }

      // Handle Ctrl+F or Cmd+F for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Handle Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        return;
      }

      // Only handle Shift+Spacebar for new entry (when search is not open)
      if (e.key === ' ' && e.shiftKey && !showSearch) {
        e.preventDefault();
        playNewEntrySound();
        handleNewEntryRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSearch]); // Include showSearch in deps

  const handleEdit = () => {
    setIsEditing(true);
    setIsNewEntry(false);
  };

  const handleEntrySaved = async () => {
    // Reload the entry after saving
    setIsEditing(false);
    setIsNewEntry(false);
    
    // SUPREME OPTIMIZATION: Reload all entries to keep context in sync
    // This ensures the preloaded entries are always up-to-date
    if (window.electronAPI) {
      try {
        const allEntries = await window.electronAPI.getAllEntries();
        setEntries(allEntries);
      } catch (error) {
        console.error('Error reloading entries after save:', error);
      }
    }
    
    loadCurrentEntry();
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
  };

  const handleModalClose = () => {
    setEditingEntry(null);
  };

  const handleModalEntrySaved = () => {
    // Refresh the current view
    loadCurrentEntry();
    setEditingEntry(null);
  };

  // Show loading screen while entries are being preloaded or preferences are loading
  if (isLoading || !preferencesLoaded) {
    return <LoadingScreen progress={loadingProgress} message={loadingMessage} />;
  }

  return (
    <>
      <BackgroundArt 
        backgroundImage={backgroundImagePath || undefined}
        theme={preferences.theme}
      />
      <div className="app">
      <NavigationBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenPreferences={() => {
          if (window.electronAPI) {
            window.electronAPI.openPreferences();
          }
        }}
        onOpenSearch={() => setShowSearch(true)}
      />
      {preferences.showMinimap !== false && (
        <GlobalTimelineMinimap
          selectedDate={selectedDate}
          viewMode={viewMode}
          onTimePeriodSelect={handleTimePeriodSelect}
          onEntrySelect={handleEntrySelect}
          minimapSize={preferences.minimapSize || 'medium'}
          weekStartsOn={preferences.weekStartsOn ?? 0}
        />
      )}
      <div className="app-content">
        <div className="timeline-section">
          <TimelineView
            selectedDate={selectedDate}
            viewMode={viewMode}
            onTimePeriodSelect={handleTimePeriodSelect}
            onEntrySelect={handleEntrySelect}
            onEditEntry={handleEditEntry}
            weekStartsOn={preferences.weekStartsOn ?? 0}
          />
        </div>
        <div className="editor-section">
          {isEditing || isNewEntry ? (
            <JournalEditor
              date={selectedDate}
              viewMode={viewMode}
              selectedEntry={selectedEntry}
              isNewEntry={isNewEntry}
              onEntrySaved={handleEntrySaved}
              onCancel={() => {
                setIsEditing(false);
                setIsNewEntry(false);
                loadCurrentEntry();
              }}
            />
          ) : (
            <EntryViewer
              entry={selectedEntry}
              date={selectedDate}
              viewMode={viewMode}
              onEdit={handleEdit}
              onNewEntry={handleNewEntry}
              onEntrySelect={handleEntrySelect}
              onEditEntry={handleEditEntry}
              weekStartsOn={preferences.weekStartsOn ?? 0}
            />
          )}
        </div>
      </div>
      {editingEntry && (
        <EntryEditModal
          entry={editingEntry}
          isOpen={true}
          onClose={handleModalClose}
          onEntrySaved={handleModalEntrySaved}
          onEntryDuplicated={loadCurrentEntry}
        />
      )}
      {showSearch && (
        <div className="search-overlay">
          <SearchView
            onEntrySelect={handleEntrySelect}
            onClose={() => setShowSearch(false)}
          />
        </div>
      )}
      </div>
    </>
  );
}

export default App;

