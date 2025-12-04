import { useState, useEffect } from 'react';
import { Preferences } from '../types';
import './Preferences.css';

export default function PreferencesComponent() {
  const [preferences, setPreferences] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      const prefs = await window.electronAPI.getAllPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      
      // Save all preferences
      for (const [key, value] of Object.entries(preferences)) {
        await window.electronAPI.setPreference(key as keyof Preferences, value);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all preferences to default values?')) {
      try {
        if (!window.electronAPI) {
          throw new Error('Electron API not available');
        }
        await window.electronAPI.resetPreferences();
        await loadPreferences();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        console.error('Error resetting preferences:', error);
        alert('Failed to reset preferences. Please try again.');
      }
    }
  };

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
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
          <button
            className="preferences-button save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
          </button>
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
            <label htmlFor="defaultViewMode">Default View Mode</label>
            <select
              id="defaultViewMode"
              value={preferences.defaultViewMode || 'month'}
              onChange={(e) => updatePreference('defaultViewMode', e.target.value as Preferences['defaultViewMode'])}
            >
              <option value="decade">Decade</option>
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </div>

          <div className="preference-item">
            <label htmlFor="dateFormat">Date Format</label>
            <input
              id="dateFormat"
              type="text"
              value={preferences.dateFormat || 'MMMM d, yyyy'}
              onChange={(e) => updatePreference('dateFormat', e.target.value)}
              placeholder="MMMM d, yyyy"
            />
            <small>Examples: MMMM d, yyyy (January 1, 2024), MM/dd/yyyy (01/01/2024)</small>
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

