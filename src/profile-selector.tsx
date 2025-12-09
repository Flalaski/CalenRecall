import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './profile-selector.css';

interface Profile {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  databasePath: string;
  isDefault: boolean;
  autoLoad?: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      getAllProfiles: () => Promise<Profile[]>;
      getCurrentProfile: () => Promise<Profile | null>;
      createProfile: (name: string) => Promise<Profile>;
      deleteProfile: (profileId: string) => Promise<{ success: boolean }>;
      renameProfile: (profileId: string, newName: string) => Promise<Profile>;
      switchProfile: (profileId: string) => Promise<{ success: boolean; profileId: string }>;
      openMainWindow: () => Promise<{ success: boolean }>;
      getAutoLoadProfileId: () => Promise<string | null>;
      setAutoLoadProfileId: (profileId: string | null) => Promise<{ success: boolean }>;
      onProfileSwitched: (callback: (data: { profileId: string }) => void) => void;
      removeProfileListeners: () => void;
    };
  }
}

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

  useEffect(() => {
    loadProfiles();
    
    // Listen for profile switch events
    window.electronAPI.onProfileSwitched((data) => {
      loadProfiles();
    });

    return () => {
      window.electronAPI.removeProfileListeners();
    };
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const allProfiles = await window.electronAPI.getAllProfiles();
      setProfiles(allProfiles);
      
      const current = await window.electronAPI.getCurrentProfile();
      setCurrentProfile(current);
      
      // Load auto-load profile ID
      const autoLoadId = await window.electronAPI.getAutoLoadProfileId();
      setAutoLoadProfileId(autoLoadId);
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
      if (currentProfile?.id !== profileId) {
        await window.electronAPI.switchProfile(profileId);
        // Wait a moment for the database to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Open main window
      try {
        await window.electronAPI.openMainWindow();
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
      await window.electronAPI.createProfile(newProfileName.trim());
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
      return;
    }

    try {
      setError(null);
      await window.electronAPI.deleteProfile(profile.id);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
      console.error('Error deleting profile:', err);
    }
  };

  const handleStartEdit = (profile: Profile) => {
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
      await window.electronAPI.renameProfile(editingProfile.id, editName.trim());
      setEditingProfile(null);
      setEditName('');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename profile');
      console.error('Error renaming profile:', err);
    }
  };

  const handleCancelEdit = () => {
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
            <button className="close-error" onClick={() => setError(null)}>×</button>
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
                <div className="profile-card-content">
                  <div className="profile-info">
                    {editingProfile?.id === profile.id ? (
                      <div className="edit-profile-form">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                          className="edit-input"
                        />
                        <div className="edit-actions">
                          <button onClick={handleSaveEdit} className="btn-save">Save</button>
                          <button onClick={handleCancelEdit} className="btn-cancel">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 
                          className={`profile-name ${currentProfile?.id === profile.id ? 'active-title' : 'clickable-title'}`}
                          onClick={() => handleSelectProfile(profile.id)}
                          title={currentProfile?.id === profile.id ? 'Currently active profile' : 'Click to load this profile'}
                        >
                          {profile.name}
                          {profile.isDefault && <span className="default-badge">Default</span>}
                          {currentProfile?.id === profile.id && <span className="active-badge">Active</span>}
                        </h3>
                        <p className="profile-meta">
                          Last used: {formatDate(profile.lastUsed)}
                        </p>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={autoLoadProfileId === profile.id}
                            onChange={async (e) => {
                              e.stopPropagation();
                              try {
                                const newValue = e.target.checked;
                                const newAutoLoadId = newValue ? profile.id : null;
                                
                                console.log('[Profile Selector] Setting auto-load profile:', { newValue, newAutoLoadId, profileId: profile.id });
                                
                                await window.electronAPI.setAutoLoadProfileId(newAutoLoadId);
                                
                                // Reload the auto-load status to ensure consistency
                                const updatedAutoLoadId = await window.electronAPI.getAutoLoadProfileId();
                                
                                console.log('[Profile Selector] Auto-load status after update:', { updatedAutoLoadId, profileId: profile.id });
                                
                                setAutoLoadProfileId(updatedAutoLoadId);
                              } catch (err) {
                                console.error('Error setting auto-load profile:', err);
                                setError('Failed to set auto-load profile');
                                // Reload to restore correct state
                                const autoLoadId = await window.electronAPI.getAutoLoadProfileId();
                                setAutoLoadProfileId(autoLoadId);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span style={{ fontSize: '0.9rem' }}>Auto-load on startup</span>
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
            onClick={() => setShowCreateDialog(true)}
            className="btn-create"
          >
            + Create New Profile
          </button>
        </div>

        {showCreateDialog && (
          <div className="modal-overlay" onClick={() => setShowCreateDialog(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Profile</h2>
              <p>Enter a name for your new profile. Each profile has its own separate database of entries.</p>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProfile();
                  if (e.key === 'Escape') setShowCreateDialog(false);
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

