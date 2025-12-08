/**
 * Jest setup file for React Testing Library
 * This file runs before each test file
 */

import '@testing-library/jest-dom';

// Mock Electron API for tests
global.window = global.window || {};
(global.window as any).electronAPI = {
  getAllEntries: jest.fn(),
  getEntry: jest.fn(),
  saveEntry: jest.fn(),
  deleteEntry: jest.fn(),
  getAllPreferences: jest.fn(),
  setPreference: jest.fn(),
  getPreference: jest.fn(),
  openPreferences: jest.fn(),
  onPreferenceUpdated: jest.fn(),
  removePreferenceUpdatedListener: jest.fn(),
  onMenuNewEntry: jest.fn(),
  onMenuImport: jest.fn(),
  onMenuExport: jest.fn(),
  removeMenuListeners: jest.fn(),
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

