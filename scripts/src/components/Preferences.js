"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PreferencesComponent;
const react_1 = require("react");
const audioUtils_1 = require("../utils/audioUtils");
const types_1 = require("../utils/calendars/types");
const HotkeyDiagram_1 = __importDefault(require("./HotkeyDiagram"));
const package_json_1 = __importDefault(require("../../package.json"));
require("./Preferences.css");
function PreferencesComponent() {
    const [preferences, setPreferences] = (0, react_1.useState)({});
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [exportFormat, setExportFormat] = (0, react_1.useState)('markdown');
    const [isExporting, setIsExporting] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        loadPreferences();
        // Apply theme on load
        const applyTheme = async () => {
            if (window.electronAPI) {
                const prefs = await window.electronAPI.getAllPreferences();
                const theme = prefs.theme || 'light';
                document.documentElement.setAttribute('data-theme', theme);
                if (theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                }
                if (prefs.fontSize) {
                    document.documentElement.setAttribute('data-font-size', prefs.fontSize);
                }
            }
        };
        applyTheme();
    }, []);
    const loadPreferences = async () => {
        try {
            if (!window.electronAPI) {
                throw new Error('Electron API not available');
            }
            const prefs = await window.electronAPI.getAllPreferences();
            setPreferences(prefs);
            // Initialize export format from any stored preference in future (for now default)
        }
        catch (error) {
            console.error('Error loading preferences:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleReset = async () => {
        (0, audioUtils_1.playResetSound)();
        if (confirm('Are you sure you want to reset all preferences to default values?')) {
            try {
                if (!window.electronAPI) {
                    throw new Error('Electron API not available');
                }
                await window.electronAPI.resetPreferences();
                await loadPreferences();
            }
            catch (error) {
                console.error('Error resetting preferences:', error);
                alert('Failed to reset preferences. Please try again.');
            }
        }
    };
    const updatePreference = (key, value) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
        // Auto-save immediately
        if (window.electronAPI) {
            window.electronAPI.setPreference(key, value).then(() => {
                // Apply theme and font size immediately if changed
                if (key === 'theme') {
                    const theme = value || 'light';
                    document.documentElement.setAttribute('data-theme', theme);
                    if (theme === 'auto') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                    }
                }
                if (key === 'fontSize') {
                    document.documentElement.setAttribute('data-font-size', value);
                }
            }).catch(error => {
                console.error('Error auto-saving preference:', error);
            });
        }
    };
    const handleExport = async () => {
        if (!window.electronAPI || isExporting)
            return;
        (0, audioUtils_1.playExportSound)();
        try {
            setIsExporting(true);
            const result = await window.electronAPI.exportEntries(exportFormat);
            if (!result.success && !result.canceled) {
                console.error('Export failed:', result.error);
                alert('Export failed. Please try again.');
            }
        }
        catch (error) {
            console.error('Error during export:', error);
            alert('Export failed. Please try again.');
        }
        finally {
            setIsExporting(false);
        }
    };
    if (loading) {
        return (<div className="preferences-container">
        <div className="preferences-loading">Loading preferences...</div>
      </div>);
    }
    return (<div className="preferences-container">
      <div className="preferences-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/icon.png" alt="CalenRecall" style={{ width: '32px', height: '32px' }}/>
          <h1>Preferences</h1>
        </div>
        <div className="preferences-actions">
          <span className="auto-save-indicator">Auto-saved</span>
          <button className="preferences-button reset-button" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="preferences-content">
        <HotkeyDiagram_1.default />
        
        <div className="preferences-section">
          <h2>General</h2>
          <div className="preference-item">
            <label>
              <input type="checkbox" checked={preferences.restoreLastView === true} onChange={(e) => updatePreference('restoreLastView', e.target.checked)}/>
              Restore last viewed position on startup
            </label>
            <small>When enabled, the app will automatically restore the date and view mode you were last viewing when you restart the app.</small>
          </div>

          <div className="preference-item">
            <label htmlFor="defaultViewMode">Default View Mode</label>
            <select id="defaultViewMode" value={preferences.defaultViewMode || 'month'} onChange={(e) => updatePreference('defaultViewMode', e.target.value)} disabled={preferences.restoreLastView === true}>
              <option value="decade">Decade</option>
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
            {preferences.restoreLastView === true && (<small>Disabled when "Restore last viewed position" is enabled.</small>)}
          </div>

          <div className="preference-item">
            <label htmlFor="defaultCalendar">Default Calendar</label>
            <select id="defaultCalendar" value={preferences.defaultCalendar || 'gregorian'} onChange={(e) => updatePreference('defaultCalendar', e.target.value)}>
              {Object.entries(types_1.CALENDAR_INFO)
            .filter(([key]) => ['gregorian', 'julian', 'islamic', 'hebrew', 'persian', 'ethiopian', 'coptic', 'indian-saka', 'cherokee', 'iroquois', 'thai-buddhist', 'bahai', 'mayan-tzolkin', 'mayan-haab', 'mayan-longcount', 'aztec-xiuhpohualli', 'chinese'].includes(key))
            .map(([key, info]) => (<option key={key} value={key}>
                    {info.name} {info.eraName ? `(${info.eraName})` : ''}
                  </option>))}
            </select>
            <small>Select the default calendar system for displaying dates. You can also change this from the navigation bar.</small>
          </div>

          <div className="preference-item">
            <label htmlFor="dateFormat">Date Format</label>
            <input id="dateFormat" type="text" value={preferences.dateFormat || 'yyyy-MM-dd'} onChange={(e) => updatePreference('dateFormat', e.target.value)} placeholder="MMMM d, yyyy"/>
            <small>Examples: yyyy-MM-dd (2024-01-01), MMMM d, yyyy (January 1, 2024), MM/dd/yyyy (01/01/2024)</small>
          </div>

          <div className="preference-item">
            <label htmlFor="weekStartsOn">Week Starts On</label>
            <select id="weekStartsOn" value={preferences.weekStartsOn ?? 1} onChange={(e) => updatePreference('weekStartsOn', parseInt(e.target.value))}>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </div>
        </div>

        <div className="preferences-section">
          <h2>Appearance</h2>
          <div className="preference-item">
            <label htmlFor="theme">Theme</label>
            <select id="theme" value={preferences.theme || 'light'} onChange={(e) => updatePreference('theme', e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="preference-item">
            <label htmlFor="fontSize">Font Size</label>
            <select id="fontSize" value={preferences.fontSize || 'medium'} onChange={(e) => updatePreference('fontSize', e.target.value)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        <div className="preferences-section">
          <h2>Timeline Minimap</h2>
          <div className="preference-item">
            <label>
              <input type="checkbox" checked={preferences.showMinimap !== false} onChange={(e) => updatePreference('showMinimap', e.target.checked)}/>
              Show Minimap
            </label>
          </div>

          {preferences.showMinimap !== false && (<>
              <div className="preference-item">
                <label htmlFor="minimapSize">Minimap Size</label>
                <select id="minimapSize" value={preferences.minimapSize || 'medium'} onChange={(e) => updatePreference('minimapSize', e.target.value)}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </>)}
        </div>

        <div className="preferences-section">
          <h2>Editor</h2>
          <div className="preference-item">
            <label>
              <input type="checkbox" checked={preferences.autoSave !== false} onChange={(e) => updatePreference('autoSave', e.target.checked)}/>
              Auto-save entries
            </label>
          </div>

          {preferences.autoSave !== false && (<div className="preference-item">
              <label htmlFor="autoSaveInterval">Auto-save Interval (seconds)</label>
              <input id="autoSaveInterval" type="number" min="5" max="300" value={preferences.autoSaveInterval || 30} onChange={(e) => updatePreference('autoSaveInterval', parseInt(e.target.value))}/>
              <small>How often to auto-save (5-300 seconds)</small>
            </div>)}
        </div>

        <div className="preferences-section">
          <h2>Export / Storybook</h2>
          <div className="preference-item export-toolbar">
            <label>Export all entries as</label>
            <div className="export-controls">
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} disabled={isExporting}>
                <option value="markdown">Markdown (.md)</option>
                <option value="text">Plain text (.txt)</option>
                <option value="json">JSON (.json)</option>
                <option value="rtf">Rich Text (.rtf)</option>
                <option value="pdf">PDF (.pdf)</option>
                <option value="dec">Decades summary (.dec)</option>
              </select>
              <button className="preferences-button save-button" onClick={handleExport} disabled={isExporting}>
                {isExporting ? 'Exporting…' : 'Export Storybook'}
              </button>
            </div>
            <small>
              Exports all journal entries into a single document file. Choose the format you prefer,
              then save it to your filesystem.
            </small>
          </div>
        </div>

        <div className="preferences-section">
          <h2>Window</h2>
          <div className="preference-item">
            <label htmlFor="windowWidth">Default Window Width</label>
            <input id="windowWidth" type="number" min="800" max="3840" value={preferences.windowWidth || 2400} onChange={(e) => updatePreference('windowWidth', parseInt(e.target.value))}/>
            <small>Window width in pixels (800-3840)</small>
          </div>

          <div className="preference-item">
            <label htmlFor="windowHeight">Default Window Height</label>
            <input id="windowHeight" type="number" min="600" max="2160" value={preferences.windowHeight || 800} onChange={(e) => updatePreference('windowHeight', parseInt(e.target.value))}/>
            <small>Window height in pixels (600-2160)</small>
          </div>
          <small className="preference-note">Note: Window position and size are saved automatically when you move or resize the window.</small>
        </div>

        <div className="preferences-section">
          <h2>About</h2>
          <div className="preference-item about-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
              <img src="/icon.png" alt="CalenRecall" style={{ width: '64px', height: '64px', borderRadius: '8px' }}/>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>CalenRecall</h3>
                <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                  A calendar journal for recalling memories across decades, years, months, weeks, and days
                </p>
              </div>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                <strong>Version:</strong> {package_json_1.default.version || 'Unknown'}
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#999' }}>
                All your journaling history is stored locally on your device.
              </p>
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666', fontWeight: '600' }}>
                  Credits
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>
                  Created by <strong>Cory F. Mahler</strong>
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>
                  <a href="https://flalaski.com" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90e2', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                    Flalaski.com
                  </a>
                </p>
                <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
                  <a href="https://github.com/flalaski/CalenRecall" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90e2', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                    GitHub Repository
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
