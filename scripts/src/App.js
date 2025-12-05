"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const TimelineView_1 = __importDefault(require("./components/TimelineView"));
const JournalEditor_1 = __importDefault(require("./components/JournalEditor"));
const EntryViewer_1 = __importDefault(require("./components/EntryViewer"));
const NavigationBar_1 = __importDefault(require("./components/NavigationBar"));
const GlobalTimelineMinimap_1 = __importDefault(require("./components/GlobalTimelineMinimap"));
const EntryEditModal_1 = __importDefault(require("./components/EntryEditModal"));
const journalService_1 = require("./services/journalService");
const audioUtils_1 = require("./utils/audioUtils");
const dateUtils_1 = require("./utils/dateUtils");
require("./App.css");
function App() {
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(new Date());
    const [viewMode, setViewMode] = (0, react_1.useState)('month');
    const [selectedEntry, setSelectedEntry] = (0, react_1.useState)(null);
    const [isNewEntry, setIsNewEntry] = (0, react_1.useState)(false);
    const [isEditing, setIsEditing] = (0, react_1.useState)(false);
    const [preferences, setPreferences] = (0, react_1.useState)({});
    const [preferencesLoaded, setPreferencesLoaded] = (0, react_1.useState)(false);
    const [editingEntry, setEditingEntry] = (0, react_1.useState)(null);
    // Track if initial load has completed - after this, default view mode should NEVER be applied
    const initialLoadCompleteRef = (0, react_1.useRef)(false);
    const hasUserInteractedRef = (0, react_1.useRef)(false);
    // Load preferences on startup - ONLY ONCE, on initial mount
    (0, react_1.useEffect)(() => {
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
                        const validTimeRanges = ['decade', 'year', 'month', 'week', 'day'];
                        const isValidDate = !isNaN(lastDate.getTime());
                        const isValidMode = validTimeRanges.includes(prefs.lastViewedMode);
                        if (isValidDate && isValidMode) {
                            // Validate date is reasonable (not before year 1000 or after year 3000)
                            const year = lastDate.getFullYear();
                            if (year >= 1000 && year <= 3000) {
                                setSelectedDate(lastDate);
                                setViewMode(prefs.lastViewedMode);
                            }
                            else {
                                // Date out of reasonable range, fall back to default (ONLY on initial load)
                                if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                                    setViewMode(prefs.defaultViewMode);
                                }
                            }
                        }
                        else {
                            // Invalid date or mode, fall back to default (ONLY on initial load)
                            if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                                setViewMode(prefs.defaultViewMode);
                            }
                        }
                    }
                    else {
                        // Apply default view mode (ONLY on initial load, before any user interaction)
                        if (prefs.defaultViewMode && !hasUserInteractedRef.current) {
                            setViewMode(prefs.defaultViewMode);
                        }
                    }
                    // Apply theme
                    const theme = prefs.theme || 'light';
                    document.documentElement.setAttribute('data-theme', theme);
                    // Handle auto theme
                    if (theme === 'auto') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                        // Listen for system theme changes
                        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                        });
                    }
                    // Apply font size
                    if (prefs.fontSize) {
                        document.documentElement.setAttribute('data-font-size', prefs.fontSize);
                    }
                }
            }
            catch (error) {
                console.error('Error loading preferences:', error);
            }
            finally {
                setPreferencesLoaded(true);
                initialLoadCompleteRef.current = true; // Mark initial load as complete
            }
        };
        loadPreferences();
        // Check for preference updates periodically (when preferences window closes)
        // NOTE: Do NOT reset viewMode to default - default view mode only applies on initial load
        const interval = setInterval(() => {
            if (window.electronAPI) {
                window.electronAPI.getAllPreferences().then(prefs => {
                    setPreferences(prefs);
                    // NEVER reset viewMode - user's current view should always be preserved
                    // Default view mode is ONLY applied on the very first load, never after
                    const theme = prefs.theme || 'light';
                    document.documentElement.setAttribute('data-theme', theme);
                    // Handle auto theme
                    if (theme === 'auto') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                    }
                    if (prefs.fontSize) {
                        document.documentElement.setAttribute('data-font-size', prefs.fontSize);
                    }
                }).catch(console.error);
            }
        }, 1000);
        return () => clearInterval(interval);
        // Empty dependency array - this effect ONLY runs once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Save last viewed position when date or view mode changes (if restoreLastView is enabled)
    // Use a ref to track if we're in the initial restore phase to avoid saving during restoration
    const isRestoringRef = (0, react_1.useRef)(true);
    (0, react_1.useEffect)(() => {
        // After preferences are loaded, allow saving
        if (preferencesLoaded) {
            // Small delay to ensure restoration has completed
            const timer = setTimeout(() => {
                isRestoringRef.current = false;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [preferencesLoaded]);
    (0, react_1.useEffect)(() => {
        // Only save if preferences are loaded, restore is enabled, and we're not in the restoration phase
        if (preferencesLoaded && !isRestoringRef.current && preferences.restoreLastView && window.electronAPI) {
            try {
                // Use formatDateToISO to handle negative years correctly
                const dateString = (0, dateUtils_1.formatDateToISO)(selectedDate);
                // Validate date string format (YYYY-MM-DD or -YYYY-MM-DD for negative years)
                if (/^-?\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                    window.electronAPI.setPreference('lastViewedDate', dateString).catch(console.error);
                    window.electronAPI.setPreference('lastViewedMode', viewMode).catch(console.error);
                }
            }
            catch (error) {
                console.error('Error saving last viewed position:', error);
            }
        }
    }, [selectedDate, viewMode, preferencesLoaded, preferences.restoreLastView]);
    // Load entry for current date/viewMode when they change
    (0, react_1.useEffect)(() => {
        if (!isNewEntry && !isEditing) {
            loadCurrentEntry();
        }
    }, [selectedDate, viewMode, isNewEntry, isEditing]);
    const loadCurrentEntry = async () => {
        try {
            const entry = await (0, journalService_1.getEntryForDate)(selectedDate, viewMode);
            setSelectedEntry(entry);
        }
        catch (error) {
            console.error('Error loading entry:', error);
            setSelectedEntry(null);
        }
    };
    const handleTimePeriodSelect = (date, newViewMode) => {
        hasUserInteractedRef.current = true; // Mark that user has interacted
        setSelectedDate(date);
        setViewMode(newViewMode);
        setIsEditing(false);
        setIsNewEntry(false);
    };
    const handleViewModeChange = (mode) => {
        hasUserInteractedRef.current = true; // Mark that user has interacted
        setViewMode(mode);
        setIsEditing(false);
        setIsNewEntry(false);
    };
    const handleEntrySelect = (entry) => {
        hasUserInteractedRef.current = true; // Mark that user has interacted
        // Navigate to the entry's date and time range, then select the entry
        // Parse date string to avoid timezone issues (YYYY-MM-DD or -YYYY-MM-DD format)
        const entryDate = (0, dateUtils_1.parseISODate)(entry.date);
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
    const handleNewEntryRef = (0, react_1.useRef)(handleNewEntry);
    // Keep ref updated
    (0, react_1.useEffect)(() => {
        handleNewEntryRef.current = handleNewEntry;
    }, [handleNewEntry]);
    // Handle keyboard shortcut for New Entry button (Shift+Spacebar)
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
            // Don't handle keys if user is typing in an input, textarea, or contenteditable element
            const target = e.target;
            if (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                (target.closest('input') || target.closest('textarea') || target.closest('[contenteditable="true"]'))) {
                return;
            }
            // Only handle Shift+Spacebar
            if (e.key !== ' ' || !e.shiftKey) {
                return;
            }
            // Prevent default behavior
            e.preventDefault();
            // Trigger New Entry button - use ref to get current handleNewEntry
            (0, audioUtils_1.playNewEntrySound)();
            handleNewEntryRef.current();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Empty deps - we use ref to access current values
    const handleEdit = () => {
        setIsEditing(true);
        setIsNewEntry(false);
    };
    const handleEntrySaved = () => {
        // Reload the entry after saving
        setIsEditing(false);
        setIsNewEntry(false);
        loadCurrentEntry();
    };
    const handleEditEntry = (entry) => {
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
    if (!preferencesLoaded) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }
    return (<div className="app">
      {preferences.showMinimap !== false && (<GlobalTimelineMinimap_1.default selectedDate={selectedDate} viewMode={viewMode} onTimePeriodSelect={handleTimePeriodSelect} onEntrySelect={handleEntrySelect} minimapSize={preferences.minimapSize || 'medium'}/>)}
      <NavigationBar_1.default viewMode={viewMode} onViewModeChange={handleViewModeChange} selectedDate={selectedDate} onDateChange={setSelectedDate} onOpenPreferences={() => {
            if (window.electronAPI) {
                window.electronAPI.openPreferences();
            }
        }}/>
      <div className="app-content">
        <div className="timeline-section">
          <TimelineView_1.default selectedDate={selectedDate} viewMode={viewMode} onTimePeriodSelect={handleTimePeriodSelect} onEntrySelect={handleEntrySelect} onEditEntry={handleEditEntry}/>
        </div>
        <div className="editor-section">
          {isEditing || isNewEntry ? (<JournalEditor_1.default date={selectedDate} viewMode={viewMode} selectedEntry={selectedEntry} isNewEntry={isNewEntry} onEntrySaved={handleEntrySaved} onCancel={() => {
                setIsEditing(false);
                setIsNewEntry(false);
                loadCurrentEntry();
            }}/>) : (<EntryViewer_1.default entry={selectedEntry} date={selectedDate} viewMode={viewMode} onEdit={handleEdit} onNewEntry={handleNewEntry} onEntrySelect={handleEntrySelect} onEditEntry={handleEditEntry}/>)}
        </div>
      </div>
      {editingEntry && (<EntryEditModal_1.default entry={editingEntry} isOpen={true} onClose={handleModalClose} onEntrySaved={handleModalEntrySaved}/>)}
    </div>);
}
exports.default = App;
