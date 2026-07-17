/**
 * PerfTrail Budget & Throttle Constants
 *
 * Central registry for all span budgets and throttle intervals.
 * Imported by both the frontend and Electron PerfTrail instances.
 */

/** Default budgets (ms) per span label */
export const DEFAULT_BUDGETS: Record<string, number> = {
  // App lifecycle
  'app-init': 5000,
  'load-entries': 3000,

  // Navigation
  'nav-today': 50,
  'nav-arrow': 50,
  'nav-date-input': 100,

  // Calendar views
  'calendar-render': 500,
  'calendar-month-render': 400,
  'calendar-week-render': 300,
  'calendar-convert': 100,

  // Minimap
  'minimap-render': 300,
  'minimap-drag': 100,
  'minimap-crystal-update': 200,

  // Entries
  'entry-save': 500,
  'entry-delete': 300,
  'entry-load': 200,
  'entry-autosave': 300,

  // Search
  'search-entries': 1000,

  // Export / Import
  'export-entries': 10000,
  'import-entries': 10000,
  'export-format-md': 3000,
  'export-format-pdf': 5000,
  'export-format-json': 2000,
  'archive-create': 8000,

  // Astronomy
  'astronomy-calc': 200,
  'astronomy-new-moon': 300,
  'astronomy-solar-term': 300,

  // Themes & visuals
  'theme-apply': 200,
  'background-art': 1000,
  'bg-color-extract': 2000,
  'procedural-art-gen': 1500,

  // Animation
  'animation-frame': 33,
  'lava-lamp-frame': 50,

  // IPC (renderer side)
  'ipc-invoke': 100,
  'ipc-save-entry': 500,
  'ipc-search': 1000,
  'ipc-export': 10000,
  'ipc-import': 10000,
  'ipc-backup': 8000,
  'ipc-get-all-entries': 3000,

  // Database (Electron side)
  'db-query': 50,
  'db-write': 100,

  // Profile
  'profile-switch': 2000,
  'password-verify': 200,

  // Preferences
  'prefs-save': 500,
};

/** Default throttle intervals (ms) per label */
export const DEFAULT_THROTTLES: Record<string, number> = {
  '_default': 500,
  'animation-frame': 3000,
  'fps': 5000,
  'ipc-invoke': 1000,
  'ipc-query': 1000,
  'db-query': 1000,
  'db-write': 1000,
  '__overbudget__': 1000,
};

/** Maximum history entries */
export const MAX_HISTORY = 200;
