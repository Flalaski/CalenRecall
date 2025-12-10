import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './profile-selector.css';
import './themes.css';
import { initializeTheme, type ThemeName } from './utils/themes';
import { initializeSoundEffectsCache } from './utils/audioUtils';

interface Profile {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  databasePath: string;
  isDefault: boolean;
  autoLoad?: boolean;
  hasPassword?: boolean;
}

type ArchiveExportElectronAPI = {
  getAllProfiles: () => Promise<Profile[]>;
  exportProfileArchive: (profileId: string, archiveFormat?: 'zip' | '7z', password?: string) => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; path?: string }>;
  verifyProfilePassword: (profileId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  profileHasPassword: (profileId: string) => Promise<{ hasPassword: boolean }>;
  closeWindow: () => Promise<void>;
};

const getAPI = (): ArchiveExportElectronAPI => {
  return window.electronAPI as unknown as ArchiveExportElectronAPI;
};

function ArchiveExport() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  // Get archive format from window variable set by main process
  const [archiveFormat, setArchiveFormat] = useState<'zip' | '7z'>(() => {
    return (window as any).__archiveFormat || 'zip';
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const themeCleanupRef = React.useRef<(() => void) | null>(null);

  // Initialize theme
  useEffect(() => {
    const initialTheme: ThemeName = 'aero';
    const cleanup = initializeTheme(initialTheme);
    themeCleanupRef.current = cleanup;
    initializeSoundEffectsCache();

    return () => {
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
      }
    };
  }, []);

  // Load profiles
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setLoading(true);
        const api = getAPI();
        const allProfiles = await api.getAllProfiles();
        setProfiles(allProfiles);
        if (allProfiles.length > 0) {
          setSelectedProfileId(allProfiles[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, []);

  const handleExport = useCallback(async () => {
    if (!selectedProfileId) {
      setError('Please select a profile');
      return;
    }

    const api = getAPI();
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) {
      setError('Selected profile not found');
      return;
    }

    // Check if profile has password
    const hasPasswordResult = await api.profileHasPassword(profile.id);
    const hasPassword = hasPasswordResult.hasPassword;

    if (hasPassword) {
      // Show password dialog
      setShowPasswordDialog(true);
      setPasswordInput('');
      setPasswordError(null);
      return;
    }

    // No password, proceed with export
    await performExport();
  }, [selectedProfileId, archiveFormat, profiles]);

  const performExport = useCallback(async (password?: string) => {
    if (!selectedProfileId) return;

    try {
      setExporting(true);
      setError(null);
      const api = getAPI();
      const result = await api.exportProfileArchive(selectedProfileId, archiveFormat, password);

      if (result.success) {
        // Success - close window
        await api.closeWindow();
      } else if (!result.canceled) {
        // Check if password is required
        if (result.error === 'password_required') {
          // Show password dialog
          setShowPasswordDialog(true);
          setPasswordInput('');
          setPasswordError(null);
        } else {
          setError(result.error || result.message || 'Export failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [selectedProfileId, archiveFormat]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!selectedProfileId || !passwordInput) {
      setPasswordError('Please enter a password');
      return;
    }

    try {
      const api = getAPI();
      const result = await api.verifyProfilePassword(selectedProfileId, passwordInput);

      if (result.success) {
        // Password verified, proceed with export
        setShowPasswordDialog(false);
        setPasswordInput('');
        setPasswordError(null);
        await performExport(passwordInput);
      } else {
        setPasswordError(result.error || 'Incorrect password');
        setPasswordInput('');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to verify password');
      setPasswordInput('');
    }
  }, [selectedProfileId, passwordInput, performExport]);

  const handleCancel = useCallback(async () => {
    const api = getAPI();
    await api.closeWindow();
  }, []);

  if (loading) {
    return (
      <div className="profile-selector-container" data-theme="aero">
        <div className="profile-selector-content">
          <h1>Export Archive</h1>
          <p>Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-selector-container" data-theme="aero">
      <div className="profile-selector-content">
        <h1>Export Profile Archive</h1>
        <p>Select a profile to export as a compressed archive.</p>

        {error && (
          <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="profile-select">Profile:</label>
          <select
            id="profile-select"
            value={selectedProfileId || ''}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            disabled={exporting}
          >
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name} {profile.hasPassword ? '🔒' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Archive Format:</label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                value="zip"
                checked={archiveFormat === 'zip'}
                onChange={(e) => setArchiveFormat(e.target.value as 'zip')}
                disabled={exporting}
              />
              ZIP
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                value="7z"
                checked={archiveFormat === '7z'}
                onChange={(e) => setArchiveFormat(e.target.value as '7z')}
                disabled={exporting}
              />
              7Z
            </label>
          </div>
        </div>

        <div className="button-group" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancel}
            disabled={exporting}
            style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !selectedProfileId}
            style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>

        {showPasswordDialog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--card-bg, white)',
                padding: '2rem',
                borderRadius: '8px',
                minWidth: '300px',
                maxWidth: '500px',
              }}
            >
              <h2 style={{ marginTop: 0 }}>Enter Password</h2>
              <p>This profile is password-protected. Enter the password to create an encrypted archive.</p>
              
              {passwordError && (
                <div style={{ color: 'red', marginBottom: '1rem' }}>
                  {passwordError}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="password-input">Password:</label>
                <input
                  id="password-input"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordSubmit();
                    } else if (e.key === 'Escape') {
                      setShowPasswordDialog(false);
                      setPasswordInput('');
                      setPasswordError(null);
                    }
                  }}
                  autoFocus
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowPasswordDialog(false);
                    setPasswordInput('');
                    setPasswordError(null);
                  }}
                  style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!passwordInput}
                  style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Initialize the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ArchiveExport />);
}

