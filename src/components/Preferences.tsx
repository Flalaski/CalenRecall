import { useState, useEffect } from 'react';
import { Preferences, ExportFormat } from '../types';
import { playResetSound, playExportSound } from '../utils/audioUtils';
import './Preferences.css';

export default function PreferencesComponent() {
  const [preferences, setPreferences] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
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
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    playResetSound();
    if (confirm('Are you sure you want to reset all preferences to default values?')) {
      try {
        if (!window.electronAPI) {
          throw new Error('Electron API not available');
        }
        await window.electronAPI.resetPreferences();
        await loadPreferences();
      } catch (error) {
        console.error('Error resetting preferences:', error);
        alert('Failed to reset preferences. Please try again.');
      }
    }
  };

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    
    // Auto-save immediately
    if (window.electronAPI) {
      window.electronAPI.setPreference(key, value).then(() => {
        // Apply theme and font size immediately if changed
        if (key === 'theme') {
          const theme = value as string || 'light';
          document.documentElement.setAttribute('data-theme', theme);
          if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
          }
        }
        if (key === 'fontSize') {
          document.documentElement.setAttribute('data-font-size', value as string);
        }
      }).catch(error => {
        console.error('Error auto-saving preference:', error);
      });
    }
  };

  const handleExport = async () => {
    if (!window.electronAPI || isExporting) return;
    playExportSound();
    try {
      setIsExporting(true);
      const result = await window.electronAPI.exportEntries(exportFormat);
      if (!result.success && !result.canceled) {
        console.error('Export failed:', result.error);
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during export:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="preferences-container">
        <div className="preferences-loading">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="preferences-container">
      <div className="preferences-header">
        <h1>Preferences</h1>
        <div className="preferences-actions">
          <span className="auto-save-indicator">Auto-saved</span>
          <button
            className="preferences-button reset-button"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="preferences-content">
        <div className="preferences-section">
          <h2>General</h2>
          <div className="preference-item">
            <label>
              <input
                type="checkbox"
                checked={preferences.restoreLastView === true}
                onChange={(e) => updatePreference('restoreLastView', e.target.checked)}
              />
              Restore last viewed position on startup
            </label>
            <small>When enabled, the app will automatically restore the date and view mode you were last viewing when you restart the app.</small>
          </div>

          <div className="preference-item">
            <label htmlFor="defaultViewMode">Default View Mode</label>
            <select
              id="defaultViewMode"
              value={preferences.defaultViewMode || 'month'}
              onChange={(e) => updatePreference('defaultViewMode', e.target.value as Preferences['defaultViewMode'])}
              disabled={preferences.restoreLastView === true}
            >
              <option value="decade">Decade</option>
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
            {preferences.restoreLastView === true && (
              <small>Disabled when "Restore last viewed position" is enabled.</small>
            )}
          </div>

          <div className="preference-item">
            <label htmlFor="dateFormat">Date Format</label>
            <input
              id="dateFormat"
              type="text"
              value={preferences.dateFormat || 'yyyy-MM-dd'}
              onChange={(e) => updatePreference('dateFormat', e.target.value)}
              placeholder="MMMM d, yyyy"
            />
            <small>Examples: yyyy-MM-dd (2024-01-01), MMMM d, yyyy (January 1, 2024), MM/dd/yyyy (01/01/2024)</small>
          </div>

          <div className="preference-item">
            <label htmlFor="weekStartsOn">Week Starts On</label>
            <select
              id="weekStartsOn"
              value={preferences.weekStartsOn ?? 1}
              onChange={(e) => updatePreference('weekStartsOn', parseInt(e.target.value) as Preferences['weekStartsOn'])}
            >
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
            <select
              id="theme"
              value={preferences.theme || 'light'}
              onChange={(e) => updatePreference('theme', e.target.value as Preferences['theme'])}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="preference-item">
            <label htmlFor="fontSize">Font Size</label>
            <select
              id="fontSize"
              value={preferences.fontSize || 'medium'}
              onChange={(e) => updatePreference('fontSize', e.target.value as Preferences['fontSize'])}
            >
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
              <input
                type="checkbox"
                checked={preferences.showMinimap !== false}
                onChange={(e) => updatePreference('showMinimap', e.target.checked)}
              />
              Show Minimap
            </label>
          </div>

          {preferences.showMinimap !== false && (
            <>
              <div className="preference-item">
                <label htmlFor="minimapSize">Minimap Size</label>
                <select
                  id="minimapSize"
                  value={preferences.minimapSize || 'medium'}
                  onChange={(e) => updatePreference('minimapSize', e.target.value as Preferences['minimapSize'])}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="preferences-section">
          <h2>Editor</h2>
          <div className="preference-item">
            <label>
              <input
                type="checkbox"
                checked={preferences.autoSave !== false}
                onChange={(e) => updatePreference('autoSave', e.target.checked)}
              />
              Auto-save entries
            </label>
          </div>

          {preferences.autoSave !== false && (
            <div className="preference-item">
              <label htmlFor="autoSaveInterval">Auto-save Interval (seconds)</label>
              <input
                id="autoSaveInterval"
                type="number"
                min="5"
                max="300"
                value={preferences.autoSaveInterval || 30}
                onChange={(e) => updatePreference('autoSaveInterval', parseInt(e.target.value))}
              />
              <small>How often to auto-save (5-300 seconds)</small>
            </div>
          )}
        </div>

        <div className="preferences-section">
          <h2>Export / Storybook</h2>
          <div className="preference-item export-toolbar">
            <label>Export all entries as</label>
            <div className="export-controls">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                disabled={isExporting}
              >
                <option value="markdown">Markdown (.md)</option>
                <option value="text">Plain text (.txt)</option>
                <option value="json">JSON (.json)</option>
                <option value="rtf">Rich Text (.rtf)</option>
                <option value="pdf">PDF (.pdf)</option>
                <option value="dec">Decades summary (.dec)</option>
              </select>
              <button
                className="preferences-button save-button"
                onClick={handleExport}
                disabled={isExporting}
              >
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
            <input
              id="windowWidth"
              type="number"
              min="800"
              max="3840"
              value={preferences.windowWidth || 1200}
              onChange={(e) => updatePreference('windowWidth', parseInt(e.target.value))}
            />
            <small>Window width in pixels (800-3840)</small>
          </div>

          <div className="preference-item">
            <label htmlFor="windowHeight">Default Window Height</label>
            <input
              id="windowHeight"
              type="number"
              min="600"
              max="2160"
              value={preferences.windowHeight || 800}
              onChange={(e) => updatePreference('windowHeight', parseInt(e.target.value))}
            />
            <small>Window height in pixels (600-2160)</small>
          </div>
          <small className="preference-note">Note: Window position and size are saved automatically when you move or resize the window.</small>
        </div>
      </div>
    </div>
  );
}

