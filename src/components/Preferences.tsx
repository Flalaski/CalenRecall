import { useState, useEffect } from 'react';
import { Preferences, ExportFormat } from '../types';
import { playResetSound, playExportSound } from '../utils/audioUtils';
import { CALENDAR_INFO } from '../utils/calendars/types';
import { AVAILABLE_THEMES, applyTheme, initializeTheme, applyFontSize } from '../utils/themes';
import HotkeyDiagram from './HotkeyDiagram';
import ImportProgressModal from './ImportProgressModal';
import packageJson from '../../package.json';
import './Preferences.css';

export default function PreferencesComponent() {
  const [preferences, setPreferences] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const [importFormat, setImportFormat] = useState<'json' | 'markdown'>('json');
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({
    isOpen: false,
    progress: 0,
    message: '',
    total: undefined as number | undefined,
    imported: undefined as number | undefined,
    skipped: undefined as number | undefined,
  });

  useEffect(() => {
    loadPreferences();
    
    // Apply theme on load
    const setupTheme = async () => {
      if (window.electronAPI) {
        const prefs = await window.electronAPI.getAllPreferences();
        const theme = (prefs.theme || 'light') as any;
        applyTheme(theme);
        
        // Initialize theme with system preference listener for 'auto' theme
        const cleanup = initializeTheme(theme);
        
        applyFontSize(prefs.fontSize);
        
        return cleanup;
      }
      return () => {};
    };
    
    let cleanup: (() => void) | undefined;
    setupTheme().then(fn => cleanup = fn);
    
    // Set up import progress listener
    if (window.electronAPI && window.electronAPI.onImportProgress) {
      window.electronAPI.onImportProgress((progress) => {
        setImportProgress({
          isOpen: true,
          progress: progress.progress,
          message: progress.message,
          total: progress.total,
          imported: progress.imported,
          skipped: progress.skipped,
        });
        
        // Close modal when complete or error
        if (progress.stage === 'complete' || progress.stage === 'error') {
          setTimeout(() => {
            setImportProgress(prev => ({ ...prev, isOpen: false }));
          }, 2000);
        }
      });
    }
    
    return () => {
      if (cleanup) cleanup();
      if (window.electronAPI && window.electronAPI.removeImportProgressListener) {
        window.electronAPI.removeImportProgressListener();
      }
    };
  }, []);

  const loadPreferences = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      const prefs = await window.electronAPI.getAllPreferences();
      console.log('[Preferences] Loaded all preferences:', prefs);
      console.log('[Preferences] backgroundImage value:', prefs.backgroundImage);
      setPreferences(prefs);

      // Load background image preview
      if (prefs.backgroundImage) {
        console.log('[Preferences] Loading background image preview for:', prefs.backgroundImage);
        try {
          const bgResult = await window.electronAPI.getBackgroundImagePath();
          console.log('[Preferences] Background image path result:', bgResult);
          if (bgResult.success && bgResult.path) {
            setBackgroundImagePreview(bgResult.path);
            console.log('[Preferences] Background image preview set to:', bgResult.path);
          } else {
            setBackgroundImagePreview(null);
            console.warn('[Preferences] Failed to get background image path:', bgResult.error || bgResult.message);
          }
        } catch (error) {
          console.error('[Preferences] Error loading background image preview:', error);
          setBackgroundImagePreview(null);
        }
      } else {
        console.log('[Preferences] No backgroundImage preference found');
        setBackgroundImagePreview(null);
      }

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
    
    // Apply theme and font size immediately if changed (before save for instant feedback)
    if (key === 'theme') {
      const theme = (value as any) || 'light';
      applyTheme(theme);
    }
    if (key === 'fontSize') {
      applyFontSize(value as string);
    }
    
    // Note: We don't dispatch window events here because Preferences is in a separate BrowserWindow.
    // The IPC handler in electron/ipc-handlers.ts will send an IPC message to the main window
    // when setPreference is called, which will trigger the update in GlobalTimelineMinimap.
    
    // Auto-save immediately (after applying changes for instant feedback)
    if (window.electronAPI) {
      window.electronAPI.setPreference(key, value)
        .then(() => {
          console.log('[Preferences] Preference saved successfully:', key, value);
          // For theme changes, explicitly force the main window to refresh
          if (key === 'theme') {
            // Give the preference save a moment to complete
            setTimeout(() => {
              console.log('[Preferences] 🔄 Forcing main window theme refresh...');
              if (window.electronAPI && 'refreshMainWindowTheme' in window.electronAPI) {
                (window.electronAPI as any).refreshMainWindowTheme()
                  .then((result: { success: boolean; error?: string }) => {
                    if (result.success) {
                      console.log('[Preferences] ✅ Main window theme refresh successful');
                    } else {
                      console.error('[Preferences] ❌ Main window theme refresh failed:', result.error);
                    }
                  })
                  .catch((error: any) => {
                    console.error('[Preferences] ❌ Error calling refreshMainWindowTheme:', error);
                  });
              } else {
                console.warn('[Preferences] ⚠️ refreshMainWindowTheme not available, falling back to IPC messages');
              }
            }, 100);
          }
        })
        .catch(error => {
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

  const handleImport = async () => {
    if (!window.electronAPI || isImporting) return;
    playExportSound();
    try {
      setIsImporting(true);
      setImportProgress({
        isOpen: true,
        progress: 0,
        message: 'Starting import...',
        total: undefined,
        imported: undefined,
        skipped: undefined,
      });
      
      const result = await window.electronAPI.importEntries(importFormat);
      
      if (result.success) {
        // Progress modal will show completion message and close automatically
        // Refresh the main window after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (!result.canceled) {
        console.error('Import failed:', result.error, result.message);
        setImportProgress(prev => ({
          ...prev,
          message: `Import failed: ${result.message || result.error || 'Unknown error'}`,
        }));
        setTimeout(() => {
          setImportProgress(prev => ({ ...prev, isOpen: false }));
        }, 3000);
      } else {
        // User canceled
        setImportProgress(prev => ({ ...prev, isOpen: false }));
      }
    } catch (error) {
      console.error('Error during import:', error);
      setImportProgress(prev => ({
        ...prev,
        message: 'Import failed. Please try again.',
      }));
      setTimeout(() => {
        setImportProgress(prev => ({ ...prev, isOpen: false }));
      }, 3000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBackup = async () => {
    if (!window.electronAPI || isBackingUp) return;
    playExportSound();
    try {
      setIsBackingUp(true);
      const result = await window.electronAPI.backupDatabase();
      if (result.success) {
        alert(`Backup successful! Saved to: ${result.path}`);
      } else if (!result.canceled) {
        console.error('Backup failed:', result.error, result.message);
        alert(`Backup failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error during backup:', error);
      alert('Backup failed. Please try again.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!window.electronAPI || isRestoring) return;
    playExportSound();
    try {
      setIsRestoring(true);
      const result = await window.electronAPI.restoreDatabase();
      if (result.success) {
        alert('Database restored successfully! The application will now reload.');
        // Refresh the main window
        window.location.reload();
      } else if (!result.canceled) {
        console.error('Restore failed:', result.error, result.message);
        alert(`Restore failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error during restore:', error);
      alert('Restore failed. Please try again.');
    } finally {
      setIsRestoring(false);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="./icon.png" 
            alt="CalenRecall" 
            style={{ width: '32px', height: '32px' }}
          />
          <h1>Preferences</h1>
        </div>
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
        <HotkeyDiagram />
        
        <div className="preferences-section">
          <h2>Appearance</h2>
          <div className="preference-item">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={preferences.theme || 'light'}
              onChange={(e) => updatePreference('theme', e.target.value as Preferences['theme'])}
            >
              {AVAILABLE_THEMES.map(theme => (
                <option key={theme.name} value={theme.name}>
                  {theme.displayName}
                </option>
              ))}
            </select>
            <small>
              {AVAILABLE_THEMES.find(t => t.name === (preferences.theme || 'light'))?.description || ''}
            </small>
          </div>

          <div className="preference-item">
            <label htmlFor="fontSize">Font Size</label>
            <select
              id="fontSize"
              value={preferences.fontSize || 'medium'}
              onChange={(e) => updatePreference('fontSize', e.target.value as Preferences['fontSize'])}
            >
              <option value="xxxSmall">XXX Small</option>
              <option value="xxSmall">XX Small</option>
              <option value="xSmall">X Small</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xLarge">X Large</option>
              <option value="xxLarge">XX Large</option>
              <option value="xxxLarge">XXX Large</option>
            </select>
          </div>

          <div className="preference-item">
            <label>Background Image</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {preferences.backgroundImage ? (
                <>
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>
                    Custom image set
                  </span>
                  <button
                    className="preferences-button"
                    onClick={async () => {
                      if (window.electronAPI) {
                        console.log('[Preferences] Clearing background image...');
                        const result = await window.electronAPI.clearBackgroundImage();
                        console.log('[Preferences] Clear result:', result);
                        if (result.success) {
                          await loadPreferences();
                          // Trigger a preference update event so App.tsx picks up the change
                          window.dispatchEvent(new CustomEvent('preferences-updated'));
                        } else {
                          alert(`Failed to clear background image: ${result.message || result.error}`);
                        }
                      }
                    }}
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span style={{ fontSize: '0.9rem', color: '#666' }}>
                  Using default theme background
                </span>
              )}
              <button
                className="preferences-button"
                onClick={async () => {
                  if (window.electronAPI) {
                    console.log('[Preferences] Selecting background image...');
                    const result = await window.electronAPI.selectBackgroundImage();
                    console.log('[Preferences] Select result:', result);
                    if (result.success) {
                      console.log('[Preferences] Image selection successful, reloading preferences...');
                      // Small delay to ensure preference is saved to database
                      await new Promise(resolve => setTimeout(resolve, 200));
                      await loadPreferences();
                      console.log('[Preferences] Preferences reloaded after image selection');
                      // Trigger a preference update event so App.tsx picks up the change
                      // Use a small delay to ensure database write is complete
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('preferences-updated'));
                      }, 100);
                    } else if (!result.canceled) {
                      alert(`Failed to set background image: ${result.message || result.error}`);
                    } else {
                      console.log('[Preferences] Image selection was canceled');
                    }
                  }
                }}
              >
                {preferences.backgroundImage ? 'Change Image' : 'Select Image'}
              </button>
            </div>
            {backgroundImagePreview && (
              <div style={{ 
                marginTop: '12px', 
                padding: '8px', 
                border: '1px solid #e0e0e0', 
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
                display: 'inline-block'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>Preview:</div>
                <img 
                  src={backgroundImagePreview} 
                  alt="Background preview" 
                  style={{ 
                    maxWidth: '200px', 
                    maxHeight: '150px', 
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('[Preferences] Failed to load background image preview:', backgroundImagePreview);
                    console.error('[Preferences] Image error:', e);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('[Preferences] Background image preview loaded successfully:', backgroundImagePreview);
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px', wordBreak: 'break-all' }}>
                  {preferences.backgroundImage}
                </div>
              </div>
            )}
            <small>
              {preferences.backgroundImage
                ? 'A custom background image is set. Clear it to use the default theme background.'
                : 'Select a custom background image, or leave empty to use the default theme background.'}
            </small>
          </div>

          <div className="preference-item">
            <label>
              <input
                type="checkbox"
                checked={preferences.minimapCrystalUseDefaultColors !== false}
                onChange={(e) => updatePreference('minimapCrystalUseDefaultColors', e.target.checked)}
              />
              Use calculated numerological colors for minimap crystals
            </label>
            <small>When enabled, minimap crystals use calculated numerological colors (default behavior). When disabled, crystals use the theme's entry indicator color.</small>
          </div>

        </div>

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
            <label htmlFor="defaultCalendar">Default Calendar</label>
            <select
              id="defaultCalendar"
              value={preferences.defaultCalendar || 'gregorian'}
              onChange={(e) => updatePreference('defaultCalendar', e.target.value)}
            >
              {Object.entries(CALENDAR_INFO)
                .filter(([key]) => ['gregorian', 'julian', 'islamic', 'hebrew', 'persian', 'ethiopian', 'coptic', 'indian-saka', 'cherokee', 'iroquois', 'thai-buddhist', 'bahai', 'mayan-tzolkin', 'mayan-haab', 'mayan-longcount', 'aztec-xiuhpohualli', 'chinese'].includes(key))
                .map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name} {info.eraName ? `(${info.eraName})` : ''}
                  </option>
                ))}
            </select>
            <small>Select the default calendar system for displaying dates. You can also change this from the navigation bar.</small>
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
                  <option value="xxxSmall">XXX Small</option>
                  <option value="xxSmall">XX Small</option>
                  <option value="xSmall">X Small</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="xLarge">X Large</option>
                  <option value="xxLarge">XX Large</option>
                  <option value="xxxLarge">XXX Large</option>
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
                <option value="csv">CSV (.csv)</option>
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
          <h2>Import Entries</h2>
          <div className="preference-item export-toolbar">
            <label>Import entries from</label>
            <div className="export-controls">
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as 'json' | 'markdown')}
                disabled={isImporting}
              >
                <option value="json">JSON (.json)</option>
                <option value="markdown">Markdown (.md)</option>
              </select>
              <button
                className="preferences-button save-button"
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? 'Importing…' : 'Import Entries'}
              </button>
            </div>
            <small>
              Import journal entries from a JSON or Markdown file. Entries with IDs will be skipped to avoid duplicates.
              The main window will refresh after a successful import.
            </small>
          </div>
        </div>

        <div className="preferences-section">
          <h2>Backup & Restore</h2>
          <div className="preference-item export-toolbar">
            <label>Database Backup</label>
            <div className="export-controls">
              <button
                className="preferences-button save-button"
                onClick={handleBackup}
                disabled={isBackingUp}
              >
                {isBackingUp ? 'Backing up…' : 'Backup Database'}
              </button>
            </div>
            <small>
              Create a backup of your entire database. This saves all your journal entries and preferences to a file.
            </small>
          </div>
          <div className="preference-item export-toolbar">
            <label>Database Restore</label>
            <div className="export-controls">
              <button
                className="preferences-button save-button"
                onClick={handleRestore}
                disabled={isRestoring}
              >
                {isRestoring ? 'Restoring…' : 'Restore Database'}
              </button>
            </div>
            <small>
              Restore your database from a backup file. This will replace your current database with the backup.
              Make sure you have a current backup before restoring.
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
              value={preferences.windowWidth || 2400}
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

        <div className="preferences-section">
          <h2>About</h2>
          <div className="preference-item about-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
              <img 
                src="./icon.png" 
                alt="CalenRecall" 
                style={{ width: '64px', height: '64px', borderRadius: '8px' }}
              />
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>CalenRecall</h3>
                <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                  A calendar journal for recalling memories across decades, years, months, weeks, and days
                </p>
              </div>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                <strong>Version:</strong> {packageJson.version || 'Unknown'}
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
                  <a 
                    href="https://flalaski.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#4a90e2', textDecoration: 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Flalaski.com
                  </a>
                </p>
                <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
                  <a 
                    href="https://github.com/flalaski/CalenRecall" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#4a90e2', textDecoration: 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    GitHub Repository
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ImportProgressModal
        isOpen={importProgress.isOpen}
        progress={importProgress.progress}
        message={importProgress.message}
        total={importProgress.total}
        imported={importProgress.imported}
        skipped={importProgress.skipped}
      />
    </div>
  );
}

