import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './profile-selector.css';
import './themes.css';
import { initializeTheme, type ThemeName } from './utils/themes';
import { 
  playSaveSound, 
  playNewEntrySound, 
  playDeleteSound, 
  playEditSound, 
  playCancelSound, 
  playAddSound,
  playModeSelectionSound,
  playCalendarSelectionSound,
  initializeSoundEffectsCache,
  updateSoundEffectsCache
} from './utils/audioUtils';

interface Profile {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  databasePath: string;
  isDefault: boolean;
  autoLoad?: boolean;
}

interface ProfileDetails extends Profile {
  entryCount?: number;
  defaultExportMetadata?: any;
  preferences?: any;
  databaseSize?: number; // Total disk usage size of the profile in bytes (includes database, WAL files, and all files in profile directory)
  firstEntryDate?: string | null;
  lastEntryDate?: string | null;
}

// Type for profile selector's electronAPI - extends base type with profile-specific methods
type ProfileSelectorElectronAPI = {
  // Profile management methods (available in profile selector window)
  getAllProfiles: () => Promise<Profile[]>;
  getCurrentProfile: () => Promise<Profile | null>;
  getProfileDetails: (profileId: string) => Promise<ProfileDetails | null>;
  createProfile: (name: string) => Promise<Profile>;
  deleteProfile: (profileId: string) => Promise<{ success: boolean }>;
  renameProfile: (profileId: string, newName: string) => Promise<Profile>;
  switchProfile: (profileId: string) => Promise<{ success: boolean; profileId: string }>;
  openMainWindow: () => Promise<{ success: boolean }>;
  getAutoLoadProfileId: () => Promise<string | null>;
  setAutoLoadProfileId: (profileId: string | null) => Promise<{ success: boolean }>;
  onProfileSwitched: (callback: (data: { profileId: string }) => void) => void;
  removeProfileListeners: () => void;
  // Preference methods (may be available if database is initialized)
  getAllPreferences?: () => Promise<any>;
  setPreference?: (key: string, value: any) => Promise<{ success: boolean }>;
  onPreferenceUpdated?: (callback: (data: { key: string; value: any }) => void) => void;
  removePreferenceUpdatedListener?: () => void;
};

// Type assertion helper for profile selector window
const getProfileSelectorAPI = (): ProfileSelectorElectronAPI => {
  return window.electronAPI as unknown as ProfileSelectorElectronAPI;
};

function ProfileSelector() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [autoLoadProfileId, setAutoLoadProfileId] = useState<string | null>(null);
  const [profileDetails, setProfileDetails] = useState<Map<string, ProfileDetails>>(new Map());
  const [theme, setTheme] = useState<ThemeName>('aero');
  const themeCleanupRef = React.useRef<(() => void) | null>(null);

  // Load theme from profile selector's own localStorage (independent from profile preferences)
  const loadProfileSelectorTheme = (): ThemeName => {
    const savedTheme = localStorage.getItem('profileSelectorTheme') as ThemeName | null;
    return savedTheme || 'aero';
  };

  // Save theme to profile selector's own localStorage
  const saveProfileSelectorTheme = (themeName: ThemeName) => {
    localStorage.setItem('profileSelectorTheme', themeName);
  };

  // Handle theme change - updates both state and localStorage, and applies the theme
  const handleThemeChange = (newTheme: ThemeName) => {
    setTheme(newTheme);
    saveProfileSelectorTheme(newTheme);
    
    // Clean up previous theme listener
    if (themeCleanupRef.current) {
      themeCleanupRef.current();
      themeCleanupRef.current = null;
    }
    
    // Apply new theme
    const cleanup = initializeTheme(newTheme);
    themeCleanupRef.current = cleanup;
  };

  // Initialize theme on mount - only from profile selector's own storage
  useEffect(() => {
    const initialTheme = loadProfileSelectorTheme();
    setTheme(initialTheme);
    
    // Apply theme and set up auto theme listener if needed
    const cleanup = initializeTheme(initialTheme);
    themeCleanupRef.current = cleanup;
    
    return () => {
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
      }
    };
  }, []);

  // Listen for preference updates from main window (but ignore theme updates)
  useEffect(() => {
    const api = getProfileSelectorAPI();
    if (!api.onPreferenceUpdated) {
      return;
    }

    const handlePreferenceUpdate = (data: { key: string; value: any }) => {
      // Ignore theme updates - profile selector has its own independent theme
      if (data.key === 'theme') {
        return; // Do nothing - profile selector theme is independent
      } else if (data.key === 'soundEffectsEnabled') {
        // Update sound effects cache when preference changes
        const enabled = data.value !== false;
        updateSoundEffectsCache(enabled);
      }
    };

    api.onPreferenceUpdated(handlePreferenceUpdate);

    return () => {
      if (api.removePreferenceUpdatedListener) {
        api.removePreferenceUpdatedListener();
      }
    };
  }, []);


  useEffect(() => {
    // Initialize sound effects cache
    initializeSoundEffectsCache();
    
    loadProfiles();
    
    // Listen for profile switch events
    const api = getProfileSelectorAPI();
    api.onProfileSwitched(() => {
      loadProfiles();
    });

    return () => {
      api.removeProfileListeners();
    };
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const api = getProfileSelectorAPI();
      const allProfiles = await api.getAllProfiles();
      setProfiles(allProfiles);
      
      const current = await api.getCurrentProfile();
      setCurrentProfile(current);
      
      // Load auto-load profile ID
      const autoLoadId = await api.getAutoLoadProfileId();
      setAutoLoadProfileId(autoLoadId);
      
      // Load entry counts for all profiles (lightweight operation)
      const detailsMap = new Map<string, ProfileDetails>();
      for (const profile of allProfiles) {
        try {
          const details = await api.getProfileDetails(profile.id);
          if (details) {
            detailsMap.set(profile.id, details);
          }
        } catch (err) {
          console.error(`Error loading details for profile ${profile.id}:`, err);
        }
      }
      setProfileDetails(detailsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
      console.error('Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfile = async (profileId: string) => {
    try {
      setError(null);
      
      // Only switch if it's a different profile
      const api = getProfileSelectorAPI();
      if (currentProfile?.id !== profileId) {
        playModeSelectionSound(); // Play sound when switching to a different profile
        await api.switchProfile(profileId);
        // Wait a moment for the database to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        playCalendarSelectionSound(); // Play sound when opening main window with same profile
      }
      
      // Open main window
      try {
        await api.openMainWindow();
      } catch (err) {
        console.error('Error opening main window:', err);
        setError('Failed to open main window. Please restart the application.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch profile');
      console.error('Error switching profile:', err);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name cannot be empty');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const api = getProfileSelectorAPI();
      await api.createProfile(newProfileName.trim());
      playNewEntrySound(); // Play creation sound
      setNewProfileName('');
      setShowCreateDialog(false);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
      console.error('Error creating profile:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (profile.isDefault) {
      setError('Cannot delete the default profile');
      return;
    }

    if (!confirm(`Are you sure you want to delete the profile "${profile.name}"?\n\nThis will permanently delete all entries, templates, and preferences in this profile.`)) {
      playCancelSound(); // Play cancel sound if user cancels deletion
      return;
    }

    try {
      setError(null);
      playDeleteSound(); // Play delete sound
      const api = getProfileSelectorAPI();
      await api.deleteProfile(profile.id);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
      console.error('Error deleting profile:', err);
    }
  };

  const handleStartEdit = (profile: Profile) => {
    playEditSound(); // Play edit sound when entering edit mode
    setEditingProfile(profile);
    setEditName(profile.name);
  };

  const handleSaveEdit = async () => {
    if (!editingProfile || !editName.trim()) {
      setError('Profile name cannot be empty');
      return;
    }

    try {
      setError(null);
      const api = getProfileSelectorAPI();
      await api.renameProfile(editingProfile.id, editName.trim());
      playSaveSound(); // Play save sound
      setEditingProfile(null);
      setEditName('');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename profile');
      console.error('Error renaming profile:', err);
    }
  };

  const handleCancelEdit = () => {
    playCancelSound(); // Play cancel sound
    setEditingProfile(null);
    setEditName('');
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    }
    return `${kb.toFixed(2)} KB`;
  };

  const getProfileDetail = (profile: Profile): ProfileDetails | undefined => {
    return profileDetails.get(profile.id);
  };

  if (loading) {
    return (
      <div className="profile-selector">
        <div className="profile-selector-container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading profiles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-selector">
      <div className="profile-selector-container">
        <div className="profile-selector-header">
          <div className="logo-container">
            <div className="logo-wrapper">
              <img 
                src="./icon.png" 
                alt="CalenRecall Logo" 
                className="profile-logo"
              />
              <div className="logo-glow"></div>
              <div className="logo-shine"></div>
            </div>
          </div>
          <h1>CalenRecall</h1>
          <p className="subtitle">Select or create a profile to continue</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button className="close-error" onClick={() => {
              playCancelSound(); // Play cancel sound when dismissing error
              setError(null);
            }}>×</button>
          </div>
        )}

        <div className="profiles-list">
          {profiles.length === 0 ? (
            <div className="no-profiles">
              <p>No profiles found. Create your first profile to get started.</p>
            </div>
          ) : (
            profiles.map((profile) => (
              <div
                key={profile.id}
                className={`profile-card ${currentProfile?.id === profile.id ? 'active' : ''}`}
              >
                {editingProfile?.id === profile.id ? (
                  <div className="profile-header-edit">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit();
                        }
                        if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                      className="edit-input-header"
                    />
                    <div className="edit-actions-header">
                      <button onClick={handleSaveEdit} className="btn-save">Save</button>
                      <button onClick={handleCancelEdit} className="btn-cancel">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-header">
                    <h2 
                      className={`profile-name-header ${currentProfile?.id === profile.id ? 'active-title' : 'clickable-title'}`}
                      onClick={() => handleSelectProfile(profile.id)}
                      title={currentProfile?.id === profile.id ? 'Currently active profile' : 'Click to load this profile'}
                    >
                      {profile.name}
                      {profile.isDefault && <span className="default-badge">Default</span>}
                      {currentProfile?.id === profile.id && <span className="active-badge">Active</span>}
                    </h2>
                  </div>
                )}
                <div className="profile-card-content">
                  <div className="profile-info">
                    {editingProfile?.id !== profile.id && (
                      <>
                        <div className="profile-meta-group">
                          <p className="profile-meta">
                            Last used: {formatDate(profile.lastUsed)}
                          </p>
                          {(() => {
                            const details = getProfileDetail(profile);
                            return (
                              <>
                                {details?.entryCount !== undefined && (
                                  <p className="profile-meta">
                                    Entries: {details.entryCount.toLocaleString()}
                                  </p>
                                )}
                                {details?.databaseSize && (
                                  <p className="profile-meta">
                                    Size: {formatFileSize(details.databaseSize)}
                                  </p>
                                )}
                                {details?.firstEntryDate && (
                                  <p className="profile-meta">
                                    First: {formatDate(details.firstEntryDate)}
                                  </p>
                                )}
                                {details?.lastEntryDate && (
                                  <p className="profile-meta">
                                    Last: {formatDate(details.lastEntryDate)}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        
                        {(() => {
                          const details = getProfileDetail(profile);
                          const metadata = details?.defaultExportMetadata;
                          if (!metadata) return null;
                          
                          return (
                            <div className="profile-metadata-section">
                              {metadata.projectTitle && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Project:</span>
                                  <span className="metadata-value">{metadata.projectTitle}</span>
                                </div>
                              )}
                              {metadata.author && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Author:</span>
                                  <span className="metadata-value">{metadata.author}</span>
                                </div>
                              )}
                              {metadata.organization && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Organization:</span>
                                  <span className="metadata-value">{metadata.organization}</span>
                                </div>
                              )}
                              {metadata.purpose && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Purpose:</span>
                                  <span className="metadata-value">{metadata.purpose}</span>
                                </div>
                              )}
                              {metadata.exportPurpose && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Export Purpose:</span>
                                  <span className="metadata-value">{metadata.exportPurpose}</span>
                                </div>
                              )}
                              {metadata.description && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Description:</span>
                                  <span className="metadata-value">{metadata.description}</span>
                                </div>
                              )}
                              {metadata.version && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Version:</span>
                                  <span className="metadata-value">{metadata.version}</span>
                                </div>
                              )}
                              {metadata.classification && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Classification:</span>
                                  <span className="metadata-value">{metadata.classification}</span>
                                </div>
                              )}
                              {metadata.keywords && metadata.keywords.length > 0 && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Keywords:</span>
                                  <span className="metadata-value">{Array.isArray(metadata.keywords) ? metadata.keywords.join(', ') : metadata.keywords}</span>
                                </div>
                              )}
                              {metadata.copyright && (
                                <div className="metadata-item">
                                  <span className="metadata-label">Copyright:</span>
                                  <span className="metadata-value">{metadata.copyright}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        
                        <label className="auto-load-label">
                          <input
                            type="checkbox"
                            className="auto-load-checkbox"
                            checked={autoLoadProfileId === profile.id}
                            onChange={async (e) => {
                              e.stopPropagation();
                              playCalendarSelectionSound(); // Play selection sound for checkbox toggle
                              try {
                                const newValue = e.target.checked;
                                const newAutoLoadId = newValue ? profile.id : null;
                                
                                console.log('[Profile Selector] Setting auto-load profile:', { newValue, newAutoLoadId, profileId: profile.id });
                                
                                const api = getProfileSelectorAPI();
                                await api.setAutoLoadProfileId(newAutoLoadId);
                                
                                // Reload the auto-load status to ensure consistency
                                const updatedAutoLoadId = await api.getAutoLoadProfileId();
                                
                                console.log('[Profile Selector] Auto-load status after update:', { updatedAutoLoadId, profileId: profile.id });
                                
                                setAutoLoadProfileId(updatedAutoLoadId);
                              } catch (err) {
                                console.error('Error setting auto-load profile:', err);
                                setError('Failed to set auto-load profile');
                                // Reload to restore correct state
                                const api = getProfileSelectorAPI();
                                const autoLoadId = await api.getAutoLoadProfileId();
                                setAutoLoadProfileId(autoLoadId);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="auto-load-text">Auto-load on startup</span>
                        </label>
                      </>
                    )}
                  </div>
                  <div className="profile-actions">
                    {editingProfile?.id !== profile.id && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProfile(profile.id);
                          }}
                          className="btn-primary"
                          title={currentProfile?.id === profile.id ? 'Open main window' : 'Load this profile'}
                        >
                          {currentProfile?.id === profile.id ? 'Open' : 'Load'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(profile);
                          }}
                          className="btn-secondary"
                          title="Rename profile"
                        >
                          ✏️
                        </button>
                        {!profile.isDefault && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(profile);
                            }}
                            className="btn-danger"
                            title="Delete profile"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="profile-selector-footer">
          <button
            onClick={() => {
              playAddSound(); // Play add sound when opening create dialog
              setShowCreateDialog(true);
            }}
            className="btn-create"
          >
            + Create New Profile
          </button>
        </div>

        {showCreateDialog && (
          <div className="modal-overlay" onClick={() => {
            playCancelSound(); // Play cancel sound when closing dialog via overlay
            setShowCreateDialog(false);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Profile</h2>
              <p>Enter a name for your new profile. Each profile has its own separate database of entries.</p>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProfile();
                  if (e.key === 'Escape') {
                    playCancelSound(); // Play cancel sound on Escape
                    setShowCreateDialog(false);
                  }
                }}
                placeholder="Profile name"
                autoFocus
                className="create-input"
              />
              <div className="modal-actions">
                <button
                  onClick={handleCreateProfile}
                  className="btn-primary"
                  disabled={creating || !newProfileName.trim()}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    playCancelSound(); // Play cancel sound
                    setShowCreateDialog(false);
                    setNewProfileName('');
                  }}
                  className="btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Initialize React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ProfileSelector />);
}

