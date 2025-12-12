import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import TimelineView from './components/TimelineView';
import JournalEditor from './components/JournalEditor';
import EntryViewer from './components/EntryViewer';
import NavigationBar from './components/NavigationBar';
// Lazy load heavy components for better initial load performance
const GlobalTimelineMinimap = lazy(() => import('./components/GlobalTimelineMinimap'));
const SearchView = lazy(() => import('./components/SearchView'));
import EntryEditModal from './components/EntryEditModal';
import ExportMetadataModal from './components/ExportMetadataModal';
import LoadingScreen from './components/LoadingScreen';
import BackgroundArt from './components/BackgroundArt';
import { TimeRange, JournalEntry, Preferences, ExportFormat, ExportMetadata } from './types';
import { getEntryForDate } from './services/journalService';
import { playNewEntrySound, initializeSoundEffectsCache, updateSoundEffectsCache, playNavigationJourneySound, playModeSelectionSound } from './utils/audioUtils';
import { formatDateToISO, parseISODate, createDate } from './utils/dateUtils';
import { applyTheme, initializeTheme, applyFontSize } from './utils/themes';
import { useEntries } from './contexts/EntriesContext';
import { useCalendar } from './contexts/CalendarContext';
import { initializeWindowStateTracker } from './utils/windowStateTracker';
import { differenceInDays, differenceInYears, differenceInMonths, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import './App.css';

function App() {
  const { setEntries, isLoading, setIsLoading } = useEntries();
  const { setCalendar } = useCalendar();
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
  const [totalEntryCount, setTotalEntryCount] = useState<number | undefined>(undefined);
  const [backgroundImagePath, setBackgroundImagePath] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<ExportFormat | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [currentProfile, setCurrentProfile] = useState<{ name: string; id: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesMessage, setShowUnsavedChangesMessage] = useState(false);
  const unsavedChangesMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if initial load has completed - after this, default view mode should NEVER be applied
  const initialLoadCompleteRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  // Track when an entry is being selected to prevent loadCurrentEntry from overwriting it
  const isSelectingEntryRef = useRef(false);
  // Cache background image path to avoid unnecessary reloads
  const backgroundImagePathRef = useRef<string | null>(null);
  // Track theme cleanup function for 'auto' theme listener
  const themeCleanupRef = useRef<(() => void) | null>(null);

  // Initialize window state tracker to prevent flickering during maximize/fullscreen
  useEffect(() => {
    const cleanup = initializeWindowStateTracker();
    return cleanup;
  }, []);

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
          // Get total entry count first (fast query) for crystal size calculation
          const count = await (window.electronAPI as any).getEntryCount();
          setTotalEntryCount(count);
          
          // Load all entries at once
          const allEntries = await window.electronAPI.getAllEntries();
          
          // OPTIMIZATION: Set entries only once at the end to avoid rebuilding lookup structure 50+ times
          // Progressive visual updates are handled by LoadingScreen using progress percentage and totalEntryCount
          // This prevents expensive entryLookup and entryColors rebuilds during loading
          
          // OPTIMIZATION: Set entries immediately without artificial delays
          // Use requestIdleCallback for non-critical UI updates during loading
          setEntries(allEntries);
          setLoadingProgress(90);
          setLoadingMessage('Indexing entries...');
          
          // Use requestIdleCallback to allow browser to schedule indexing work
          // This prevents blocking the main thread
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              setLoadingProgress(95);
              setLoadingMessage('Finalizing timeline...');
              
              requestIdleCallback(() => {
                setLoadingProgress(100);
                setLoadingMessage('Ready!');
                
                // Give animations time to finish and let users appreciate the visualization
                // This allows the infinity symbol rotation, crystal animations, and final state to be visible
                // MAX_ANIMATION_DELAY (1s) + ornamentAppear duration (0.6s) + buffer for appreciation = 3s
                setTimeout(() => {
                  setIsLoading(false);
                }, 3000); // 3 seconds to see the concluding visualization and have a moment with it
              }, { timeout: 100 });
            }, { timeout: 100 });
          } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(() => {
              setLoadingProgress(95);
              setLoadingMessage('Finalizing timeline...');
              setTimeout(() => {
                setLoadingProgress(100);
                setLoadingMessage('Ready!');
                setTimeout(() => {
                  setIsLoading(false);
                }, 3000); // 3 seconds to see the concluding visualization and have a moment with it
              }, 200);
            }, 200);
          }
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
        console.log('[App] Full preferences object:', updated);
        return updated;
      });
      
      // Also reload preferences from database to ensure we have the latest value
      // This is a backup in case the state update doesn't propagate correctly
      if (window.electronAPI) {
        window.electronAPI.getAllPreferences().then(prefs => {
          console.log('[App] Reloaded preferences from database, minimapSize:', prefs.minimapSize);
          if (prefs.minimapSize !== value) {
            console.warn('[App] ⚠️ Minimap size mismatch! Expected:', value, 'Got from DB:', prefs.minimapSize);
            // Force update with database value
            setPreferences(prev => ({ ...prev, minimapSize: prefs.minimapSize || value }));
          }
        }).catch(err => {
          console.error('[App] Error reloading preferences:', err);
        });
      }
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
    } else if (key === 'soundEffectsEnabled') {
      // Update preferences state and sound effects cache
      console.log('[App] Updating sound effects enabled:', value, 'type:', typeof value);
      setPreferences(prev => ({ ...prev, soundEffectsEnabled: value }));
      // Explicitly handle boolean values
      // If value is explicitly false, disable sounds
      // If value is true, enable sounds
      // If value is undefined/null, enable sounds (default to enabled)
      let enabled: boolean;
      if (value === false) {
        enabled = false;
      } else if (value === true) {
        enabled = true;
      } else {
        // undefined, null, or any other value - default to enabled
        enabled = true;
      }
      console.log('[App] Setting sound effects cache to:', enabled, '(value was:', value, ')');
      updateSoundEffectsCache(enabled);
      
      // Re-initialize the cache from the database to ensure it's in sync
      // This ensures the change takes effect immediately
      console.log('[App] Re-initializing sound effects cache from database...');
      initializeSoundEffectsCache().then(() => {
        console.log('[App] ✅ Sound effects cache re-initialized');
      }).catch((error) => {
        console.error('[App] Error re-initializing sound effects cache:', error);
      });
    } else if (key === 'calendar') {
      // Update CalendarContext when calendar preference changes
      console.log('[App] Updating calendar:', value);
      setCalendar(value as any);
      // Also update preferences state
      setPreferences(prev => ({ ...prev, calendar: value }));
    } else {
      // For all other preferences, update state (they may not need immediate UI updates)
      setPreferences(prev => ({ ...prev, [key]: value }));
    }
  }, [setBackgroundImagePath, setCalendar]);

  // Load current profile on startup
  useEffect(() => {
    const loadCurrentProfile = async () => {
      try {
        if (window.electronAPI && (window.electronAPI as any).getCurrentProfile) {
          const profile = await (window.electronAPI as any).getCurrentProfile();
          if (profile) {
            setCurrentProfile({ name: profile.name, id: profile.id });
          }
        }
      } catch (error) {
        console.error('Error loading current profile:', error);
      }
    };
    
    loadCurrentProfile();
    
    // Listen for profile switch events
    if (window.electronAPI && (window.electronAPI as any).onProfileSwitched) {
      (window.electronAPI as any).onProfileSwitched(() => {
        loadCurrentProfile();
      });
    }
    
    return () => {
      if (window.electronAPI && (window.electronAPI as any).removeProfileListeners) {
        (window.electronAPI as any).removeProfileListeners();
      }
    };
  }, []);

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
          
          // Initialize sound effects cache
          initializeSoundEffectsCache();
          
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

  // Check for preference changes when window gains focus or becomes visible (in case IPC message was missed)
  useEffect(() => {
    const checkAndApplyPreferences = async () => {
      if (window.electronAPI) {
        try {
          const prefs = await window.electronAPI.getAllPreferences();
          
          // Check theme
          const currentTheme = document.documentElement?.getAttribute('data-theme');
          const expectedTheme = prefs.theme === 'auto' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : prefs.theme || 'light';
          
          if (currentTheme !== expectedTheme) {
            console.log('[App] 🔄 Theme mismatch detected on focus/visibility, applying theme:', expectedTheme);
            updateSpecificPreferenceRef.current('theme', prefs.theme || 'light');
          }
          
          // Check minimapSize
          const currentMinimapSize = preferences.minimapSize || 'medium';
          const expectedMinimapSize = prefs.minimapSize || 'medium';
          
          if (currentMinimapSize !== expectedMinimapSize) {
            console.log('[App] 🔄 Minimap size mismatch detected on focus/visibility, current:', currentMinimapSize, 'expected:', expectedMinimapSize);
            updateSpecificPreferenceRef.current('minimapSize', expectedMinimapSize);
          }
        } catch (error) {
          console.error('[App] Error checking preferences on focus/visibility:', error);
        }
      }
    };

    // Check when window gains focus
    window.addEventListener('focus', checkAndApplyPreferences);
    // Check when window becomes visible (handles cases where preferences window was closed)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndApplyPreferences();
      }
    });
    
    // Also periodically check for preference changes (every 2 seconds) as a safety net
    // This ensures preference changes are picked up even if IPC messages are missed
    const preferenceCheckInterval = setInterval(() => {
      checkAndApplyPreferences();
    }, 2000);
    
    return () => {
      window.removeEventListener('focus', checkAndApplyPreferences);
      clearInterval(preferenceCheckInterval);
    };
  }, [preferences.minimapSize, updateSpecificPreferenceRef]);

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

  // Export handlers - defined outside useEffect so they're accessible in render
  const handleExportConfirm = useCallback(async (metadata: ExportMetadata, format: ExportFormat) => {
    try {
      setShowExportModal(false);
      if (window.electronAPI) {
        const result = await window.electronAPI.exportEntries(format, metadata);
        if (result.success) {
          console.log('Export successful:', result.path);
        } else if (!result.canceled) {
          const errorMsg = result.error || 'Unknown error';
          console.error('Export failed:', errorMsg);
          // Show user-friendly error message
          alert(`Export failed: ${errorMsg}`);
        }
      }
      setPendingExportFormat(null);
    } catch (error) {
      console.error('Error exporting:', error);
      setPendingExportFormat(null);
    }
  }, []);

  const handleExportCancel = useCallback(() => {
    setShowExportModal(false);
    setPendingExportFormat(null);
  }, []);

  // Listen for menu messages from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleMenuNewEntry = () => {
      playNewEntrySound();
      handleNewEntryRef.current();
    };

    const handleMenuImport = async (format: 'json' | 'markdown') => {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.importEntries(format);
          if (result.success) {
            // Reload entries after successful import
            const allEntries = await window.electronAPI.getAllEntries();
            setEntries(allEntries);
            // Show success message (you could add a toast notification here)
            console.log(`Import successful: ${result.imported} entries imported${result.skipped ? `, ${result.skipped} skipped` : ''}`);
          } else if (!result.canceled) {
            console.error('Import failed:', result.error);
          }
        }
      } catch (error) {
        console.error('Error handling import:', error);
      }
    };

    const handleMenuExport = async (format: ExportFormat) => {
      try {
        if (window.electronAPI) {
          // Get entry count for the modal
          const allEntries = await window.electronAPI.getAllEntries();
          setEntryCount(allEntries.length);
          
          if (allEntries.length === 0) {
            console.log('No entries to export');
            return;
          }
          
          // Show metadata modal first
          setPendingExportFormat(format);
          setShowExportModal(true);
        }
      } catch (error) {
        console.error('Error handling export:', error);
      }
    };

    // Set up menu message listeners
    if (window.electronAPI.onMenuNewEntry) {
      window.electronAPI.onMenuNewEntry(handleMenuNewEntry);
    }
    if (window.electronAPI.onMenuImport) {
      window.electronAPI.onMenuImport(handleMenuImport);
    }
    if (window.electronAPI.onMenuExport) {
      window.electronAPI.onMenuExport(handleMenuExport);
    }

    return () => {
      if (window.electronAPI.removeMenuListeners) {
        window.electronAPI.removeMenuListeners();
      }
    };
  }, [setEntries]);

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

  // Debounced navigation refs to prevent excessive re-renders during rapid navigation
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDateRef = useRef<Date | null>(null);
  const pendingViewModeRef = useRef<TimeRange | null>(null);
  const rafIdRef = useRef<number | null>(null);
  
  // EXTREME PERFORMANCE: Minimal delay for instant response
  // Reduced to 0ms for maximum responsiveness (year 2000 computer speed)
  // Lower values = faster response, Higher values = more batching/smoother
  const INDICATOR_MOVEMENT_DELAY = 0; // ms - EXTREME PERFORMANCE: Instant response
  const lastUpdateTimeRef = useRef<number>(0); // Track time between updates to detect dragging
  const rapidUpdateThreshold = 50; // ms - if updates come faster than this, we're dragging

  // Helper function to show unsaved changes message with inactivity timer
  const showUnsavedChangesMessageWithTimer = useCallback(() => {
    setShowUnsavedChangesMessage(true);
    // Clear any existing timeout
    if (unsavedChangesMessageTimeoutRef.current) {
      clearTimeout(unsavedChangesMessageTimeoutRef.current);
    }
    // Set new timeout to hide message after 369ms of inactivity
    unsavedChangesMessageTimeoutRef.current = setTimeout(() => {
      setShowUnsavedChangesMessage(false);
      unsavedChangesMessageTimeoutRef.current = null;
    }, 369);
  }, []);

  // Debounced date change handler for smooth navigation
  const handleDateChange = useCallback((date: Date) => {
    // Prevent navigation if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
    
    // Debounced date change for smooth navigation
    pendingDateRef.current = date;
    
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    // EXTREME PERFORMANCE: Instant update (no debounce delay)
    rafIdRef.current = requestAnimationFrame(() => {
      if (pendingDateRef.current) {
        setSelectedDate(pendingDateRef.current);
        pendingDateRef.current = null;
      }
      navigationTimeoutRef.current = null;
      rafIdRef.current = null;
    });
  }, [hasUnsavedChanges, showUnsavedChangesMessageWithTimer]);

  const handleTimePeriodSelect = useCallback((date: Date, newViewMode: TimeRange) => {
    // Prevent navigation if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
    
    hasUserInteractedRef.current = true; // Mark that user has interacted
    // Clear selected entry when changing date/view in day view
    if (newViewMode === 'day') {
      setSelectedEntry(null);
    }
    
    // Store pending updates
    pendingDateRef.current = date;
    pendingViewModeRef.current = newViewMode;
    
    // Detect if this is a rapid update (drag operation)
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const isRapidUpdate = timeSinceLastUpdate < rapidUpdateThreshold;
    lastUpdateTimeRef.current = now;
    
    // Clear any existing timeout/RAF
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // For rapid updates (dragging), update immediately for perfect frame sync with audio blips
    // For normal updates, use debounce for batching
    if (isRapidUpdate) {
      // Immediate update via RAF for smooth frame-aligned rendering
      rafIdRef.current = requestAnimationFrame(() => {
        if (pendingDateRef.current && pendingViewModeRef.current) {
          setViewMode(pendingViewModeRef.current);
          setSelectedDate(pendingDateRef.current);
          setIsEditing(false);
          setIsNewEntry(false);
          pendingDateRef.current = null;
          pendingViewModeRef.current = null;
        }
        rafIdRef.current = null;
      });
    } else {
      // EXTREME PERFORMANCE: Instant update (no debounce delay)
      rafIdRef.current = requestAnimationFrame(() => {
        if (pendingDateRef.current && pendingViewModeRef.current) {
          setViewMode(pendingViewModeRef.current);
          setSelectedDate(pendingDateRef.current);
          setIsEditing(false);
          setIsNewEntry(false);
          pendingDateRef.current = null;
          pendingViewModeRef.current = null;
        }
        navigationTimeoutRef.current = null;
        rafIdRef.current = null;
      });
    }
  }, [hasUnsavedChanges, showUnsavedChangesMessageWithTimer]);

  const handleViewModeChange = (mode: TimeRange) => {
    // Prevent navigation if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
    
    hasUserInteractedRef.current = true; // Mark that user has interacted
    // Clear selected entry when switching to day view
    if (mode === 'day') {
      setSelectedEntry(null);
    }
    setViewMode(mode);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  // Ref to track if entry navigation is in progress
  const isEntryNavigatingRef = useRef(false);
  const entryNavigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Navigate to entry with animated steps, similar to navigation bar
  const navigateToEntryWithSteps = useCallback((entry: JournalEntry) => {
    // Prevent multiple simultaneous navigations
    if (isEntryNavigatingRef.current) {
      return;
    }
    
    isEntryNavigatingRef.current = true;
    
    const targetDate = parseISODate(entry.date);
    const targetViewMode = entry.timeRange;
    const startDate = new Date(selectedDate);
    const timeDiff = Math.abs(differenceInDays(startDate, targetDate));
    const isFuture = targetDate > startDate;
    
    // For very large jumps (more than 1000 years), jump to within 1000 years first
    const MAX_ANIMATED_DAYS = 365000; // ~1000 years
    let actualStartDate = new Date(startDate);
    
    if (timeDiff > MAX_ANIMATED_DAYS) {
      const yearsDiff = differenceInYears(targetDate, startDate);
      const yearsToJump = isFuture 
        ? yearsDiff - 1000
        : yearsDiff + 1000;
      
      actualStartDate = addYears(startDate, yearsToJump);
      actualStartDate = createDate(actualStartDate.getFullYear(), 0, 1);
      
      // Jump immediately to the jump point
      setSelectedDate(actualStartDate);
    }
    
    interface NavigationStep {
      date: Date;
      viewMode: TimeRange;
    }
    
    interface Checkpoint {
      date: Date;
      viewMode: TimeRange;
      distance: number;
    }
    
    // Create checkpoints at regular intervals
    const createCheckpoints = (start: Date, target: Date, isFuture: boolean): Checkpoint[] => {
      const checkpoints: Checkpoint[] = [];
      const totalDays = Math.abs(differenceInDays(start, target));
      
      let checkpointInterval: number;
      let viewModeForCheckpoints: TimeRange;
      
      if (totalDays > 365000) {
        checkpointInterval = 182500;
        viewModeForCheckpoints = 'decade';
      } else if (totalDays > 36500) {
        checkpointInterval = 18250;
        viewModeForCheckpoints = 'decade';
      } else if (totalDays > 3650) {
        checkpointInterval = 1825;
        viewModeForCheckpoints = 'year';
      } else if (totalDays > 365) {
        checkpointInterval = 90;
        viewModeForCheckpoints = 'month';
      } else if (totalDays > 30) {
        checkpointInterval = 14;
        viewModeForCheckpoints = 'week';
      } else {
        checkpointInterval = 7;
        viewModeForCheckpoints = 'day';
      }
      
      let currentCheckpointDate = new Date(start);
      let distance = 0;
      
      while (distance < totalDays) {
        checkpoints.push({
          date: new Date(currentCheckpointDate),
          viewMode: viewModeForCheckpoints,
          distance: distance
        });
        
        if (isFuture) {
          currentCheckpointDate = addDays(currentCheckpointDate, checkpointInterval);
        } else {
          currentCheckpointDate = addDays(currentCheckpointDate, -checkpointInterval);
        }
        distance += checkpointInterval;
      }
      
      // Always add final target as last checkpoint
      checkpoints.push({
        date: new Date(target),
        viewMode: targetViewMode,
        distance: totalDays
      });
      
      return checkpoints;
    };
    
    const checkpoints = createCheckpoints(actualStartDate, targetDate, isFuture);
    let checkpointIndex = 0;
    let currentViewMode = viewMode;
    let animatedCurrentDate = new Date(actualStartDate);
    const totalJourneyDays = Math.abs(differenceInDays(actualStartDate, targetDate));
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };
    
    const bellCurveMultiplier = (progress: number): number => {
      const sigma = 0.25;
      const center = 0.5;
      const exponent = -Math.pow((progress - center) / sigma, 2) / 2;
      const bellValue = Math.exp(exponent);
      return 0.1 + (bellValue * 0.9);
    };
    
    const calculateStepsToCheckpoint = (
      from: Date,
      to: Date,
      targetViewMode: TimeRange,
      overallProgress: number
    ): NavigationStep[] => {
      const steps: NavigationStep[] = [];
      let current = new Date(from);
      const daysToCheckpoint = Math.abs(differenceInDays(current, to));
      const bellMultiplier = bellCurveMultiplier(overallProgress);
      
      if (daysToCheckpoint > 365) {
        const yearsToCheckpoint = Math.abs(differenceInYears(to, current));
        const baseStepSize = Math.max(1, Math.floor(yearsToCheckpoint / 22));
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 9)));
        
        while (Math.abs(differenceInYears(current, to)) > dynamicStepSize) {
          if (isFuture) {
            current = addYears(current, dynamicStepSize);
          } else {
            current = addYears(current, -dynamicStepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'year' });
        }
      } else if (daysToCheckpoint > 30) {
        const monthsToCheckpoint = Math.abs(differenceInMonths(to, current));
        const baseStepSize = Math.max(1, Math.floor(monthsToCheckpoint / 22));
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 7)));
        
        while (Math.abs(differenceInMonths(current, to)) > dynamicStepSize) {
          if (isFuture) {
            current = addMonths(current, dynamicStepSize);
          } else {
            current = addMonths(current, -dynamicStepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'month' });
        }
      } else if (daysToCheckpoint > 7) {
        const weeksToCheckpoint = Math.floor(daysToCheckpoint / 7);
        const baseStepSize = Math.max(1, Math.floor(weeksToCheckpoint / 22));
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 4)));
        
        let weeksStepped = 0;
        while (weeksStepped < weeksToCheckpoint) {
          const stepSize = Math.min(dynamicStepSize, weeksToCheckpoint - weeksStepped);
          if (isFuture) {
            current = addWeeks(current, stepSize);
          } else {
            current = addWeeks(current, -stepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'week' });
          weeksStepped += stepSize;
        }
      } else {
        const baseStepSize = 1;
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 2)));
        
        let daysStepped = 0;
        while (daysStepped < daysToCheckpoint) {
          const stepSize = Math.min(dynamicStepSize, daysToCheckpoint - daysStepped);
          if (isFuture) {
            current = addDays(current, stepSize);
          } else {
            current = addDays(current, -stepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'day' });
          daysStepped += stepSize;
        }
      }
      
      // Add final checkpoint step
      steps.push({ date: new Date(to), viewMode: targetViewMode });
      
      return steps;
    };
    
    let currentSegmentSteps: NavigationStep[] = [];
    let segmentStepIndex = 0;
    
    const executeStep = () => {
      try {
        // If we've completed all checkpoints, finish and select entry
        if (checkpointIndex >= checkpoints.length) {
          // Final step - ensure we're at target with correct view mode
          if (currentViewMode !== targetViewMode) {
            playModeSelectionSound();
            setViewMode(targetViewMode);
          }
          setSelectedDate(targetDate);
          
          // Select the entry after navigation completes
          setTimeout(() => {
            setSelectedEntry(entry);
            setIsNewEntry(false);
            setIsEditing(false);
            isEntryNavigatingRef.current = false;
          }, 50);
          return;
        }
        
        // If we've completed current segment, calculate next segment
        if (segmentStepIndex >= currentSegmentSteps.length) {
          const nextCheckpoint = checkpoints[checkpointIndex];
          
          if (!nextCheckpoint) {
            setSelectedDate(targetDate);
            checkpointIndex = checkpoints.length;
            timeoutId = setTimeout(executeStep, 0);
            return;
          }
          
          const daysTraveled = Math.abs(differenceInDays(actualStartDate, animatedCurrentDate));
          const overallProgress = Math.min(1, daysTraveled / totalJourneyDays);
          
          currentSegmentSteps = calculateStepsToCheckpoint(
            animatedCurrentDate,
            nextCheckpoint.date,
            nextCheckpoint.viewMode,
            overallProgress
          );
          segmentStepIndex = 0;
          checkpointIndex++;
        }
        
        // Execute current step
        const step = currentSegmentSteps[segmentStepIndex];
        segmentStepIndex++;
        animatedCurrentDate = new Date(step.date);
        
        const totalProgress = checkpointIndex / checkpoints.length;
        
        // Play sound
        playNavigationJourneySound(step.viewMode);
        
        // Update view mode if it changed
        if (step.viewMode !== currentViewMode) {
          if (step.viewMode === 'day') {
            playModeSelectionSound();
          }
          setViewMode(step.viewMode);
          currentViewMode = step.viewMode;
        }
        
        // Update date
        setSelectedDate(step.date);
        
        // Calculate dynamic delay
        const baseDelays: Record<TimeRange, number> = {
          decade: 12,
          year: 10,
          month: 6,
          week: 4,
          day: 2
        };
        
        const baseDelay = baseDelays[step.viewMode] || 6;
        const momentumFactor = 1 + (1 - easeOutCubic(totalProgress)) * 1.5;
        const delay = Math.max(1, baseDelay / momentumFactor);
        
        // Continue animation
        timeoutId = setTimeout(executeStep, delay);
      } catch (error) {
        console.error('Error during entry navigation:', error);
        isEntryNavigatingRef.current = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };
    
    // Initialize first segment
    if (checkpoints.length > 0) {
      const firstCheckpoint = checkpoints[0];
      currentSegmentSteps = calculateStepsToCheckpoint(
        actualStartDate,
        firstCheckpoint.date,
        firstCheckpoint.viewMode,
        0
      );
      checkpointIndex = 1;
    }
    
    // Start animation
    executeStep();
  }, [selectedDate, viewMode]);
  
  const handleEntrySelect = (entry: JournalEntry) => {
    // Prevent navigation if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
    
    hasUserInteractedRef.current = true;
    isSelectingEntryRef.current = true;
    
    // Clear any existing navigation
    if (entryNavigationTimeoutRef.current) {
      clearTimeout(entryNavigationTimeoutRef.current);
      entryNavigationTimeoutRef.current = null;
    }
    
    // Navigate with animated steps
    navigateToEntryWithSteps(entry);
  };

  const handleNewEntry = () => {
    // Prevent creating new entry if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
    
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

      // Handle Ctrl+N or Cmd+N for new entry
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        playNewEntrySound();
        handleNewEntryRef.current();
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
    // Prevent editing if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
    setIsEditing(true);
    setIsNewEntry(false);
  };

  const handleEntrySaved = async () => {
    // Reload the entry after saving
    setIsEditing(false);
    setIsNewEntry(false);
    setHasUnsavedChanges(false); // Clear unsaved changes flag after saving
    // Clear timeout and hide message
    if (unsavedChangesMessageTimeoutRef.current) {
      clearTimeout(unsavedChangesMessageTimeoutRef.current);
      unsavedChangesMessageTimeoutRef.current = null;
    }
    setShowUnsavedChangesMessage(false); // Hide message if visible
    
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
    // Prevent editing if there are unsaved changes
    if (hasUnsavedChanges) {
      showUnsavedChangesMessageWithTimer();
      return;
    }
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
    return <LoadingScreen progress={loadingProgress} message={loadingMessage} totalEntryCount={totalEntryCount} />;
  }

  return (
    <>
      <BackgroundArt 
        backgroundImage={backgroundImagePath || undefined}
        theme={preferences.theme}
      />
      <div className="app">
      {currentProfile && (
        <div className="profile-name-display">
          {currentProfile.name}
        </div>
      )}
      <NavigationBar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onOpenPreferences={() => {
          if (window.electronAPI) {
            window.electronAPI.openPreferences();
          }
        }}
        onOpenSearch={() => setShowSearch(true)}
      />
      {preferences.showMinimap !== false && (
        <Suspense fallback={null}>
          <GlobalTimelineMinimap
            key={`minimap-${preferences.minimapSize || 'medium'}`}
            selectedDate={selectedDate}
            viewMode={viewMode}
            onTimePeriodSelect={handleTimePeriodSelect}
            onEntrySelect={handleEntrySelect}
            minimapSize={preferences.minimapSize || 'medium'}
            weekStartsOn={preferences.weekStartsOn ?? 0}
          />
        </Suspense>
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
                setHasUnsavedChanges(false);
                // Clear timeout and hide message
                if (unsavedChangesMessageTimeoutRef.current) {
                  clearTimeout(unsavedChangesMessageTimeoutRef.current);
                  unsavedChangesMessageTimeoutRef.current = null;
                }
                setShowUnsavedChangesMessage(false); // Hide message if visible
                loadCurrentEntry();
              }}
              onUnsavedChangesChange={setHasUnsavedChanges}
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
          <Suspense fallback={<div className="search-loading">Loading search...</div>}>
            <SearchView
              onEntrySelect={handleEntrySelect}
              onClose={() => setShowSearch(false)}
            />
          </Suspense>
        </div>
      )}
      {showExportModal && pendingExportFormat && (
        <ExportMetadataModal
          isOpen={showExportModal}
          format={pendingExportFormat}
          onClose={handleExportCancel}
          onConfirm={handleExportConfirm}
          entryCount={entryCount}
        />
      )}
      {showUnsavedChangesMessage && (
        <div className="unsaved-changes-message">
          <div className="unsaved-changes-content">
            <span className="unsaved-changes-icon">⚠️</span>
            <span className="unsaved-changes-text">You have unsaved changes. Finish or cancel your entry to continue</span>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default App;

