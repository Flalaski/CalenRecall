/**
 * Jest setup file for React Testing Library
 * This file runs before each test file
 */

import '@testing-library/jest-dom';

// Mock Electron API for tests — complete surface matching electron/preload.ts
global.window = global.window || {};
(global.window as any).electronAPI = {
  // Journal entry operations
  getAllEntries: jest.fn(),
  getEntries: jest.fn(),
  getEntry: jest.fn(),
  getEntryById: jest.fn(),
  getEntryVersions: jest.fn(),
  getEntriesByDateRange: jest.fn(),
  getEntriesByRange: jest.fn(),
  getEntriesByJdnRange: jest.fn(),
  getEntryCount: jest.fn(),
  getEntryCountByJdnRange: jest.fn(),
  saveEntry: jest.fn(),
  deleteEntry: jest.fn(),
  deleteEntryByDateRange: jest.fn(),
  searchEntries: jest.fn(),
  archiveEntry: jest.fn(),
  unarchiveEntry: jest.fn(),
  getArchivedEntries: jest.fn(),
  pinEntry: jest.fn(),
  unpinEntry: jest.fn(),
  getPinnedEntries: jest.fn(),

  // Templates
  getAllTemplates: jest.fn(),
  getTemplate: jest.fn(),
  saveTemplate: jest.fn(),
  deleteTemplate: jest.fn(),

  // Attachments
  addEntryAttachment: jest.fn(),
  removeEntryAttachment: jest.fn(),
  getAttachmentPath: jest.fn(),

  // Export / Import
  exportEntries: jest.fn(),
  exportEntriesFromProfile: jest.fn(),
  importEntries: jest.fn(),

  // Backup / Restore
  backupDatabase: jest.fn(),
  restoreDatabase: jest.fn(),

  // Preferences
  getPreference: jest.fn(),
  setPreference: jest.fn(),
  getAllPreferences: jest.fn(),
  resetPreferences: jest.fn(),

  // Window operations
  openPreferences: jest.fn(),
  closePreferencesWindow: jest.fn(),
  registerLayerToggles: jest.fn(),
  closeImportProgress: jest.fn(),

  // Import progress
  onImportProgress: jest.fn(),
  removeImportProgressListener: jest.fn(),

  // Background image
  selectBackgroundImage: jest.fn(),
  clearBackgroundImage: jest.fn(),
  getBackgroundImagePath: jest.fn(),

  // Preference listeners
  onPreferenceUpdated: jest.fn(),
  removePreferenceUpdatedListener: jest.fn(),
  onAutoLoadProfileUpdated: jest.fn(),
  removeAutoLoadProfileUpdatedListener: jest.fn(),

  // Theme
  refreshMainWindowTheme: jest.fn(),
  getCustomThemes: jest.fn(),

  // Menu listeners
  onMenuNewEntry: jest.fn(),
  onMenuImport: jest.fn(),
  onMenuExport: jest.fn(),
  removeMenuListeners: jest.fn(),

  // External
  openExternalUrl: jest.fn(),
  openExternalBrowser: jest.fn(),

  // Calendar sync
  startCalendarAuth: jest.fn(),
  getPendingCalendarAuth: jest.fn(),
  getCalendarAuthResult: jest.fn(),
  getGoogleCalendarConfigStatus: jest.fn(),
  saveGoogleOAuthClientId: jest.fn(),
  listCalendarAccounts: jest.fn(),
  disconnectCalendarAccount: jest.fn(),
  listRemoteCalendars: jest.fn(),
  setRemoteCalendarSelected: jest.fn(),
  getRemoteEvents: jest.fn(),
  runCalendarSync: jest.fn(),
  getCalendarSyncStatus: jest.fn(),

  // Profile management
  getAllProfiles: jest.fn(),
  getCurrentProfile: jest.fn(),
  getProfile: jest.fn(),
  getProfileDetails: jest.fn(),
  createProfile: jest.fn(),
  exportProfileDatabase: jest.fn(),
  exportProfileArchive: jest.fn(),
  deleteProfile: jest.fn(),
  renameProfile: jest.fn(),
  switchProfile: jest.fn(),

  // Profile listeners
  onProfileSwitched: jest.fn(),
  onProfileCreated: jest.fn(),
  onProfileDeleted: jest.fn(),
  onProfileRenamed: jest.fn(),
  removeProfileListeners: jest.fn(),

  // Main window / auto-load
  openMainWindow: jest.fn(),
  getAutoLoadProfileId: jest.fn(),
  setAutoLoadProfileId: jest.fn(),

  // Password management
  setProfilePassword: jest.fn(),
  verifyProfilePassword: jest.fn(),
  changeProfilePassword: jest.fn(),
  removeProfilePassword: jest.fn(),
  profileHasPassword: jest.fn(),
  recoverProfilePassword: jest.fn(),
  profileHasRecoveryKey: jest.fn(),

  // Password listeners
  onProfilePasswordSet: jest.fn(),
  onProfilePasswordChanged: jest.fn(),
  onProfilePasswordRemoved: jest.fn(),
  onProfilePasswordRecovered: jest.fn(),

  // Clipboard / recovery key file
  copyToClipboard: jest.fn(),
  saveRecoveryKeyToFile: jest.fn(),

  // Window close / perf
  closeWindow: jest.fn(),
  logToMain: jest.fn(),

  // Update event listeners
  onUpdateChecking: jest.fn(),
  onUpdateAvailable: jest.fn(),
  onUpdateNotAvailable: jest.fn(),
  onUpdateDownloadProgress: jest.fn(),
  onUpdateDownloaded: jest.fn(),
  onUpdateError: jest.fn(),
  checkForUpdates: jest.fn(),
};

// Suppress console errors in tests (optional - remove if you want to see them)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: validateDOMNesting'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

