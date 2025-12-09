import React, { useState, useEffect, useCallback } from 'react';
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
  hasPassword?: boolean;
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
  exportProfileDatabase: (profileId: string) => Promise<{ success: boolean; canceled?: boolean; error?: string; message?: string; path?: string }>;
  deleteProfile: (profileId: string) => Promise<{ success: boolean }>;
  renameProfile: (profileId: string, newName: string) => Promise<Profile>;
  switchProfile: (profileId: string) => Promise<{ success: boolean; profileId: string }>;
  openMainWindow: () => Promise<{ success: boolean }>;
  getAutoLoadProfileId: () => Promise<string | null>;
  setAutoLoadProfileId: (profileId: string | null) => Promise<{ success: boolean }>;
  onProfileSwitched: (callback: (data: { profileId: string }) => void) => void;
  removeProfileListeners: () => void;
  // Password management methods
  setProfilePassword: (profileId: string, password: string, generateRecovery?: boolean) => Promise<{ success: boolean; recoveryKey?: string | null }>;
  verifyProfilePassword: (profileId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  changeProfilePassword: (profileId: string, oldPassword: string, newPassword: string, generateNewRecovery?: boolean) => Promise<{ success: boolean; recoveryKey?: string | null }>;
  removeProfilePassword: (profileId: string, password: string) => Promise<{ success: boolean }>;
  profileHasPassword: (profileId: string) => Promise<{ hasPassword: boolean }>;
  recoverProfilePassword: (profileId: string, recoveryKey: string, newPassword: string) => Promise<{ success: boolean; recoveryKey: string | null }>;
  profileHasRecoveryKey: (profileId: string) => Promise<{ hasRecoveryKey: boolean }>;
  copyToClipboard: (text: string) => Promise<{ success: boolean }>;
  saveRecoveryKeyToFile: (recoveryKey: string, profileName: string) => Promise<{ success: boolean; canceled?: boolean; path?: string }>;
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
  const themeCleanupRef = React.useRef<(() => void) | null>(null);
  // Password-related state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordProfileId, setPasswordProfileId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPasswordManagement, setShowPasswordManagement] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showRecoveryKey, setShowRecoveryKey] = useState<string | null>(null); // Profile ID for which to show recovery key
  const [recoveryKeyToShow, setRecoveryKeyToShow] = useState<string | null>(null); // The actual recovery key to display
  const [showRecoveryDialog, setShowRecoveryDialog] = useState<string | null>(null); // Profile ID for recovery
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<Profile | null>(null);
  const [deleteExportPassword, setDeleteExportPassword] = useState('');
  const [deleteExportPasswordError, setDeleteExportPasswordError] = useState<string | null>(null);
  const newProfileNameInputRef = React.useRef<HTMLInputElement>(null);

  // Load theme from profile selector's own localStorage (independent from profile preferences)
  const loadProfileSelectorTheme = (): ThemeName => {
    const savedTheme = localStorage.getItem('profileSelectorTheme') as ThemeName | null;
    return savedTheme || 'aero';
  };

  // Save theme to profile selector's own localStorage
  const saveProfileSelectorTheme = (themeName: ThemeName) => {
    localStorage.setItem('profileSelectorTheme', themeName);
  };

  // Handle theme change - updates localStorage and applies the theme
  const handleThemeChange = useCallback((newTheme: ThemeName) => {
    saveProfileSelectorTheme(newTheme);
    
    // Clean up previous theme listener
    if (themeCleanupRef.current) {
      themeCleanupRef.current();
      themeCleanupRef.current = null;
    }
    
    // Apply new theme
    const cleanup = initializeTheme(newTheme);
    themeCleanupRef.current = cleanup;
  }, []);

  // Initialize theme on mount - only from profile selector's own storage
  useEffect(() => {
    const initialTheme = loadProfileSelectorTheme();
    
    // Apply theme and set up auto theme listener if needed
    const cleanup = initializeTheme(initialTheme);
    themeCleanupRef.current = cleanup;
    
    return () => {
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
      }
    };
  }, []);

  // Listen for theme updates from Electron menu - profile selector has its own independent theme stored in localStorage
  useEffect(() => {
    const api = getProfileSelectorAPI();
    if (!api.onPreferenceUpdated) {
      return;
    }

    const handlePreferenceUpdate = (data: { key: string; value: any }) => {
      if (data.key === 'theme') {
        // When theme is changed from Electron menu, update profile selector's own localStorage theme
        // This keeps the profile selector theme independent from profile preferences
        const newTheme = (data.value || 'aero') as ThemeName;
        handleThemeChange(newTheme);
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
  }, [handleThemeChange]);

  // Focus the new profile name input when the create dialog opens
  useEffect(() => {
    if (showCreateDialog && newProfileNameInputRef.current) {
      // Use a timeout to ensure the DOM is ready and animations have started
      const timeoutId = setTimeout(() => {
        if (newProfileNameInputRef.current) {
          newProfileNameInputRef.current.focus();
          newProfileNameInputRef.current.select();
        }
      }, 150); // Slightly longer delay to ensure modal animation starts first
      return () => clearTimeout(timeoutId);
    }
  }, [showCreateDialog]);

  // Automatically copy recovery key to clipboard when recovery key dialog opens
  useEffect(() => {
    if (showRecoveryKey && recoveryKeyToShow) {
      const api = getProfileSelectorAPI();
      api.copyToClipboard(recoveryKeyToShow).then(() => {
        setCopySuccess(true);
        playSaveSound();
        // Reset copy success indicator after 2 seconds
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch((err) => {
        console.error('Failed to copy recovery key to clipboard:', err);
        // Don't show error to user, just log it - the key is still visible in the dialog
      });
    }
  }, [showRecoveryKey, recoveryKeyToShow]);


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
      
      const api = getProfileSelectorAPI();
      
      // Check if profile has password
      const hasPasswordResult = await api.profileHasPassword(profileId);
      if (hasPasswordResult.hasPassword) {
        // Show password dialog
        setPasswordProfileId(profileId);
        setPasswordInput('');
        setPasswordError(null);
        setShowPasswordDialog(true);
        return;
      }
      
      // No password, proceed normally
      await proceedWithProfileSwitch(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch profile');
      console.error('Error switching profile:', err);
    }
  };

  const proceedWithProfileSwitch = async (profileId: string) => {
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

  const handlePasswordSubmit = async () => {
    if (!passwordProfileId || !passwordInput) {
      setPasswordError('Please enter a password');
      return;
    }

    try {
      setPasswordError(null);
      const api = getProfileSelectorAPI();
      const result = await api.verifyProfilePassword(passwordProfileId, passwordInput);
      
      if (result.success) {
        setShowPasswordDialog(false);
        setPasswordInput('');
        await proceedWithProfileSwitch(passwordProfileId);
      } else {
        setPasswordError(result.error || 'Incorrect password');
        setPasswordInput('');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to verify password');
      console.error('Error verifying password:', err);
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

    // Show delete confirmation dialog with export option
    setShowDeleteConfirmation(profile);
    setDeleteExportPassword('');
    setDeleteExportPasswordError(null);
  };

  const handleDeleteConfirmationCancel = () => {
    playCancelSound();
    setShowDeleteConfirmation(null);
    setDeleteExportPassword('');
    setDeleteExportPasswordError(null);
  };

  const handleDeleteConfirmationDelete = async (exportFirst: boolean) => {
    const profile = showDeleteConfirmation;
    if (!profile) return;

    const api = getProfileSelectorAPI();

    // Check if profile has password - required for both export and deletion
    const hasPasswordResult = await api.profileHasPassword(profile.id);
    const hasPassword = hasPasswordResult.hasPassword;

    if (hasPassword) {
      // Require password for any operation on password-protected profile
      if (!deleteExportPassword) {
        setDeleteExportPasswordError(exportFirst 
          ? 'Password required to export encrypted profile' 
          : 'Password required to delete encrypted profile');
        return;
      }

      // Verify password
      const verifyResult = await api.verifyProfilePassword(profile.id, deleteExportPassword);
      if (!verifyResult.success) {
        setDeleteExportPasswordError(verifyResult.error || 'Incorrect password');
        setDeleteExportPassword('');
        return;
      }
    }

    // If export is requested, handle it first
    if (exportFirst) {
      // Export the database
      try {
        setDeleteExportPasswordError(null);
        const exportResult = await api.exportProfileDatabase(profile.id);
        if (!exportResult.success) {
          if (exportResult.canceled) {
            // User canceled export, cancel deletion too
            handleDeleteConfirmationCancel();
            return;
          }
          setDeleteExportPasswordError(exportResult.error || exportResult.message || 'Failed to export database');
          return;
        }
        // Export successful, proceed with deletion
      } catch (err) {
        setDeleteExportPasswordError(err instanceof Error ? err.message : 'Failed to export database');
        return;
      }
    } else {
      // Delete without export - show additional warning for password-protected profiles
      if (hasPassword) {
        const confirmMessage = `⚠️ SECURITY WARNING ⚠️\n\n` +
          `You are about to permanently delete a password-protected profile without exporting its data.\n\n` +
          `This profile may contain sensitive or important information. Once deleted, this data cannot be recovered.\n\n` +
          `Are you absolutely sure you want to proceed?`;
        
        if (!confirm(confirmMessage)) {
          playCancelSound();
          return;
        }
      }
    }

    // Proceed with deletion
    try {
      setError(null);
      playDeleteSound(); // Play delete sound
      await api.deleteProfile(profile.id);
      setShowDeleteConfirmation(null);
      setDeleteExportPassword('');
      setDeleteExportPasswordError(null);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
      console.error('Error deleting profile:', err);
      setShowDeleteConfirmation(null);
      setDeleteExportPassword('');
      setDeleteExportPasswordError(null);
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

  const handleSetPassword = async () => {
    if (!showPasswordManagement) return;
    
    if (!newPassword || newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const api = getProfileSelectorAPI();
      await api.setProfilePassword(showPasswordManagement, newPassword);
      playSaveSound();
      setShowPasswordManagement(null);
      setNewPassword('');
      setConfirmPassword('');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    }
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
                      {profile.hasPassword && <span className="default-badge" style={{ marginLeft: '8px' }}>🔒 Locked</span>}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPasswordManagement(profile.id);
                            setOldPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                          }}
                          className="btn-secondary"
                          title="Manage password"
                        >
                          🔒
                        </button>
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <h2>Create New Profile</h2>
              <p>Enter a name for your new profile. Each profile has its own separate database of entries.</p>
              <div style={{ position: 'relative', zIndex: 1002 }}>
                <input
                  ref={newProfileNameInputRef}
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateProfile();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      playCancelSound(); // Play cancel sound on Escape
                      setShowCreateDialog(false);
                    }
                  }}
                  placeholder="Profile name"
                  autoFocus
                  className="create-input"
                />
              </div>
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

        {showPasswordDialog && passwordProfileId && (
          <div className="modal-overlay" onClick={() => {
            playCancelSound();
            setShowPasswordDialog(false);
            setPasswordInput('');
            setPasswordError(null);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Enter Password</h2>
              <p>This profile is password protected. Please enter the password to continue.</p>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                  if (e.key === 'Escape') {
                    playCancelSound();
                    setShowPasswordDialog(false);
                    setPasswordInput('');
                    setPasswordError(null);
                  }
                }}
                placeholder="Password"
                autoFocus
                className="create-input"
              />
              {passwordError && (
                <div className="error-message" style={{ marginTop: '10px', marginBottom: '10px' }}>
                  {passwordError}
                </div>
              )}
              <div style={{ marginTop: '10px', marginBottom: '10px', fontSize: '0.9em' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const api = getProfileSelectorAPI();
                    const hasRecovery = await api.profileHasRecoveryKey(passwordProfileId!);
                    if (hasRecovery.hasRecoveryKey) {
                      setShowPasswordDialog(false);
                      setShowRecoveryDialog(passwordProfileId);
                      setRecoveryKeyInput('');
                      setRecoveryNewPassword('');
                      setRecoveryConfirmPassword('');
                    } else {
                      setPasswordError('No recovery key available for this profile');
                    }
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#007bff', 
                    cursor: 'pointer', 
                    textDecoration: 'underline',
                    padding: 0,
                    fontSize: 'inherit'
                  }}
                >
                  Forgot password? Use recovery key
                </button>
              </div>
              <div className="modal-actions">
                <button
                  onClick={handlePasswordSubmit}
                  className="btn-primary"
                  disabled={!passwordInput.trim()}
                >
                  Unlock
                </button>
                <button
                  onClick={() => {
                    playCancelSound();
                    setShowPasswordDialog(false);
                    setPasswordInput('');
                    setPasswordError(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showPasswordManagement && (() => {
          const profile = profiles.find(p => p.id === showPasswordManagement);
          if (!profile) return null;
          
          const hasPassword = !!profile.hasPassword;
          
          return (
            <div className="modal-overlay" onClick={() => {
              playCancelSound();
              setShowPasswordManagement(null);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Manage Password - {profile.name}</h2>
                {hasPassword ? (
                  <>
                    <p>Change or remove the password for this profile.</p>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Current Password:</label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Current password"
                        className="create-input"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>New Password (leave empty to remove):</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (optional)"
                        className="create-input"
                        style={{ width: '100%' }}
                      />
                    </div>
                    {newPassword && (
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Confirm New Password:</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="create-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                    <div style={{ marginBottom: '15px', fontSize: '0.9em', color: '#666' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          setShowRecoveryDialog(profile.id);
                          setRecoveryKeyInput('');
                          setRecoveryNewPassword('');
                          setRecoveryConfirmPassword('');
                        }}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#007bff', 
                          cursor: 'pointer', 
                          textDecoration: 'underline',
                          padding: 0,
                          fontSize: 'inherit'
                        }}
                      >
                        Forgot password? Use recovery key
                      </button>
                    </div>
                    <div className="modal-actions">
                      <button
                        onClick={async () => {
                          try {
                            const api = getProfileSelectorAPI();
                            if (newPassword) {
                              // Change password - require confirmation
                              if (!confirmPassword) {
                                setError('Please confirm the new password');
                                return;
                              }
                              if (newPassword !== confirmPassword) {
                                setError('New passwords do not match');
                                return;
                              }
                              const result = await api.changeProfilePassword(profile.id, oldPassword, newPassword, true);
                              playSaveSound();
                              // Show recovery key if generated
                              if (result.recoveryKey) {
                                setRecoveryKeyToShow(result.recoveryKey);
                                setShowRecoveryKey(profile.id);
                                setShowPasswordManagement(null);
                              } else {
                                setShowPasswordManagement(null);
                              }
                            } else {
                              // Remove password
                              await api.removeProfilePassword(profile.id, oldPassword);
                              playSaveSound();
                              setShowPasswordManagement(null);
                            }
                            setOldPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            await loadProfiles();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to update password');
                          }
                        }}
                        className="btn-primary"
                        disabled={!!(!oldPassword || (newPassword && (!confirmPassword || newPassword !== confirmPassword)))}
                      >
                        {newPassword ? 'Change Password' : 'Remove Password'}
                      </button>
                      <button
                        onClick={() => {
                          playCancelSound();
                          setShowPasswordManagement(null);
                          setOldPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Set a password to protect this profile.</p>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter password"
                        className="create-input"
                        style={{ width: '100%' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPassword && confirmPassword && newPassword === confirmPassword) {
                            handleSetPassword();
                          }
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Confirm Password:</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="create-input"
                        style={{ width: '100%' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPassword && confirmPassword && newPassword === confirmPassword) {
                            handleSetPassword();
                          }
                        }}
                      />
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <div className="error-message" style={{ marginTop: '10px', marginBottom: '10px', fontSize: '0.9em' }}>
                        Passwords do not match
                      </div>
                    )}
                    <div className="modal-actions">
                      <button
                        onClick={async () => {
                          // Require password confirmation
                          if (!newPassword) {
                            setError('Please enter a password');
                            return;
                          }
                          if (!confirmPassword) {
                            setError('Please confirm the password');
                            return;
                          }
                          if (newPassword !== confirmPassword) {
                            setError('Passwords do not match');
                            return;
                          }

                          try {
                            const api = getProfileSelectorAPI();
                            const result = await api.setProfilePassword(profile.id, newPassword, true);
                            playSaveSound();
                            
                            // Show recovery key
                            if (result.recoveryKey) {
                              setRecoveryKeyToShow(result.recoveryKey);
                              setShowRecoveryKey(profile.id);
                              setShowPasswordManagement(null);
                              setNewPassword('');
                              setConfirmPassword('');
                            } else {
                              setShowPasswordManagement(null);
                            }
                            await loadProfiles();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to set password');
                          }
                        }}
                        className="btn-primary"
                        disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                      >
                        Set Password
                      </button>
                      <button
                        onClick={() => {
                          playCancelSound();
                          setShowPasswordManagement(null);
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {showRecoveryDialog && (() => {
          const profile = profiles.find(p => p.id === showRecoveryDialog);
          if (!profile) return null;
          
          return (
            <div className="modal-overlay" onClick={() => {
              playCancelSound();
              setShowRecoveryDialog(null);
              setRecoveryKeyInput('');
              setRecoveryNewPassword('');
              setRecoveryConfirmPassword('');
            }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Recover Password - {profile.name}</h2>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  Enter your recovery key to reset the password for this profile.
                </p>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Recovery Key:</label>
                  <input
                    type="text"
                    value={recoveryKeyInput}
                    onChange={(e) => {
                      // Remove spaces for easier pasting
                      setRecoveryKeyInput(e.target.value.replace(/\s/g, ''));
                    }}
                    placeholder="Enter recovery key"
                    className="create-input"
                    style={{ width: '100%', fontFamily: 'monospace' }}
                    autoFocus
                  />
                  <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                    Paste your recovery key here (spaces will be removed automatically)
                  </small>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>New Password:</label>
                  <input
                    type="password"
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="create-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Confirm New Password:</label>
                  <input
                    type="password"
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="create-input"
                    style={{ width: '100%' }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && recoveryKeyInput && recoveryNewPassword && recoveryConfirmPassword && recoveryNewPassword === recoveryConfirmPassword) {
                        if (!recoveryKeyInput) {
                          setError('Please enter the recovery key');
                          return;
                        }
                        if (!recoveryNewPassword) {
                          setError('Please enter a new password');
                          return;
                        }
                        if (!recoveryConfirmPassword) {
                          setError('Please confirm the new password');
                          return;
                        }
                        if (recoveryNewPassword !== recoveryConfirmPassword) {
                          setError('Passwords do not match');
                          return;
                        }

                        try {
                          setError(null);
                          const api = getProfileSelectorAPI();
                          const result = await api.recoverProfilePassword(profile.id, recoveryKeyInput, recoveryNewPassword);
                          playSaveSound();
                          
                        // Show new recovery key
                        if (result.recoveryKey) {
                          setRecoveryKeyToShow(result.recoveryKey);
                          setShowRecoveryKey(profile.id);
                          setShowRecoveryDialog(null);
                          setRecoveryKeyInput('');
                          setRecoveryNewPassword('');
                          setRecoveryConfirmPassword('');
                        } else {
                          setShowRecoveryDialog(null);
                        }
                          await loadProfiles();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to recover password. Please check your recovery key.');
                        }
                      }
                    }}
                  />
                </div>
                {recoveryNewPassword && recoveryConfirmPassword && recoveryNewPassword !== recoveryConfirmPassword && (
                  <div className="error-message" style={{ marginTop: '10px', marginBottom: '10px', fontSize: '0.9em' }}>
                    Passwords do not match
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    onClick={async () => {
                      if (!recoveryKeyInput) {
                        setError('Please enter the recovery key');
                        return;
                      }
                      if (!recoveryNewPassword) {
                        setError('Please enter a new password');
                        return;
                      }
                      if (!recoveryConfirmPassword) {
                        setError('Please confirm the new password');
                        return;
                      }
                      if (recoveryNewPassword !== recoveryConfirmPassword) {
                        setError('Passwords do not match');
                        return;
                      }

                      try {
                        setError(null);
                        const api = getProfileSelectorAPI();
                        const result = await api.recoverProfilePassword(profile.id, recoveryKeyInput, recoveryNewPassword);
                        playSaveSound();
                        
                        // Show new recovery key
                        if (result.recoveryKey) {
                          setRecoveryKeyToShow(result.recoveryKey);
                          setShowRecoveryKey(profile.id);
                          setShowRecoveryDialog(null);
                          setRecoveryKeyInput('');
                          setRecoveryNewPassword('');
                          setRecoveryConfirmPassword('');
                        } else {
                          setShowRecoveryDialog(null);
                        }
                        await loadProfiles();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to recover password. Please check your recovery key.');
                      }
                    }}
                    className="btn-primary"
                    disabled={!recoveryKeyInput || !recoveryNewPassword || !recoveryConfirmPassword || recoveryNewPassword !== recoveryConfirmPassword}
                  >
                    Recover Password
                  </button>
                  <button
                    onClick={() => {
                      playCancelSound();
                      setShowRecoveryDialog(null);
                      setRecoveryKeyInput('');
                      setRecoveryNewPassword('');
                      setRecoveryConfirmPassword('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {showRecoveryKey && recoveryKeyToShow && (() => {
          const profile = profiles.find(p => p.id === showRecoveryKey);
          const profileName = profile?.name || 'Profile';
          
          return (
            <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                <h2>🔐 Recovery Key Generated</h2>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ marginBottom: '15px', color: '#666' }}>
                    <strong>IMPORTANT:</strong> Save this recovery key in a safe place. You can use it to reset your password if you forget it.
                  </p>
                  <div style={{ 
                    backgroundColor: '#f5f5f5', 
                    border: '2px solid #ddd', 
                    borderRadius: '8px', 
                    padding: '15px', 
                    marginBottom: '15px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    wordBreak: 'break-all',
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                    <div style={{ 
                      position: 'absolute', 
                      top: '5px', 
                      right: '5px', 
                      fontSize: '10px', 
                      color: '#999',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      Recovery Key
                    </div>
                    <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#333' }}>
                      {recoveryKeyToShow}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.9em', color: '#d32f2f', marginTop: '10px' }}>
                    ⚠️ This key will only be shown once. Make sure to save it now!
                  </p>
                </div>
                <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    onClick={async () => {
                      try {
                        const api = getProfileSelectorAPI();
                        await api.copyToClipboard(recoveryKeyToShow);
                        setCopySuccess(true);
                        playSaveSound();
                        setTimeout(() => setCopySuccess(false), 2000);
                      } catch (err) {
                        setError('Failed to copy to clipboard');
                      }
                    }}
                    className="btn-primary"
                    style={{ minWidth: '120px' }}
                  >
                    {copySuccess ? '✓ Copied!' : '📋 Copy Key'}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const api = getProfileSelectorAPI();
                        const result = await api.saveRecoveryKeyToFile(recoveryKeyToShow, profileName);
                        if (result.success && !result.canceled) {
                          playSaveSound();
                          setError(null);
                          // Optionally show success message
                        } else if (result.canceled) {
                          // User canceled, do nothing
                        } else {
                          setError('Failed to save recovery key to file');
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to save recovery key to file');
                      }
                    }}
                    className="btn-secondary"
                    style={{ minWidth: '120px' }}
                  >
                    💾 Save to File
                  </button>
                  <button
                    onClick={() => {
                      playCancelSound();
                      setShowRecoveryKey(null);
                      setRecoveryKeyToShow(null);
                      setCopySuccess(false);
                    }}
                    className="btn-secondary"
                    style={{ minWidth: '120px' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {showDeleteConfirmation && (() => {
          const profile = showDeleteConfirmation;
          const hasPassword = !!profile.hasPassword;
          
          return (
            <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <h2>Delete Profile - {profile.name}</h2>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  Are you sure you want to delete this profile? This will permanently delete all entries, templates, and preferences.
                </p>
                <p style={{ marginBottom: '20px', color: '#d32f2f', fontWeight: 'bold' }}>
                  ⚠️ This action cannot be undone. ⚠️
                </p>
                {hasPassword && (
                  <>
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '15px', 
                      backgroundColor: '#fff3cd', 
                      border: '1px solid #ffc107', 
                      borderRadius: '5px' 
                    }}>
                      <p style={{ margin: 0, color: '#856404', fontWeight: 'bold', marginBottom: '10px' }}>
                        🔒 Password-Protected Profile
                      </p>
                      <p style={{ margin: 0, color: '#856404', fontSize: '0.9em' }}>
                        This profile is password-protected and may contain sensitive information. A password is required to delete this profile. (So back off, buddy!)
                      </p>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Password Required:
                      </label>
                      <input
                        type="password"
                        value={deleteExportPassword}
                        onChange={(e) => {
                          setDeleteExportPassword(e.target.value);
                          setDeleteExportPasswordError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && deleteExportPassword) {
                            handleDeleteConfirmationDelete(true);
                          }
                          if (e.key === 'Escape') {
                            handleDeleteConfirmationCancel();
                          }
                        }}
                        placeholder="Enter profile password"
                        className="create-input"
                        style={{ width: '100%' }}
                        autoFocus
                      />
                      {deleteExportPasswordError && (
                        <div className="error-message" style={{ marginTop: '10px', fontSize: '0.9em' }}>
                          {deleteExportPasswordError}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleDeleteConfirmationDelete(true)}
                    className="btn-primary"
                    disabled={hasPassword && !deleteExportPassword}
                    title={hasPassword && !deleteExportPassword ? 'Password required' : 'Export database and delete profile'}
                  >
                    💾 Export & Delete
                  </button>
                  <button
                    onClick={() => handleDeleteConfirmationDelete(false)}
                    className="btn-danger"
                    disabled={hasPassword && !deleteExportPassword}
                    title={hasPassword && !deleteExportPassword ? 'Password required to delete encrypted profile' : 'Delete profile without exporting (not recommended for password-protected profiles)'}
                  >
                    🗑️ Delete Without Export
                  </button>
                  <button
                    onClick={handleDeleteConfirmationCancel}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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

