# CalenRecall — Full Project Audit Report

**Audit Date:** 2026-07-17  
**Version Audited:** 2026.01.14-5  
**Platform:** Windows (primary), macOS (target)  
**License:** MIT

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview & Architecture](#2-project-overview--architecture)
3. [Technology Stack](#3-technology-stack)
4. [Directory Structure Analysis](#4-directory-structure-analysis)
5. [Electron Backend Audit](#5-electron-backend-audit)
6. [React Frontend Audit](#6-react-frontend-audit)
7. [Calendar System Deep-Dive](#7-calendar-system-deep-dive)
8. [Performance Architecture](#8-performance-architecture)
9. [Theme System](#9-theme-system)
10. [Build & Release Pipeline](#10-build--release-pipeline)
11. [Testing Coverage](#11-testing-coverage)
12. [Security Analysis](#12-security-analysis)
13. [Known Limitations & Risks](#13-known-limitations--risks)
14. [Recommendations](#14-recommendations)

---

## 1. Executive Summary

**CalenRecall** is a self-contained, offline-first desktop calendar journaling application built with **Electron + React + TypeScript + SQLite**. It enables users to write journal entries at five hierarchical time scales (day → week → month → year → decade), navigate through an interactive timeline minimap, and view dates across **17 different calendar systems** from cultures worldwide.

The project demonstrates **exceptional architectural maturity** with:
- Clean Electron main/renderer separation via context isolation + IPC
- A sophisticated multi-calendar engine with Julian Day Number (JDN) as universal pivot
- An aggressive performance optimization subsystem (task scheduler, animation manager, virtual renderer, refresh-rate detection)
- A 37-theme engine with custom theme support
- Profile-isolated SQLite databases with optional password protection
- A comprehensive export/import pipeline (7 export formats)
- An early-stage online calendar sync system (Google Calendar OAuth2 + PKCE)

**Estimated project scope:** ~30,000–45,000 lines of TypeScript/CSS across ~120+ source files.

### Strengths
| Aspect | Assessment |
|--------|-----------|
| Architecture | Excellent separation of concerns (main/preload/renderer) |
| Calendar Engine | World-class: 17 calendars, JDN pivot, astronomical calculations |
| Performance | Sophisticated: task scheduler, GPU optimizations, display-refresh detection |
| Theming | Extensive: 37 themes with custom loader |
| Data Model | Well-designed: normalized tables, versioning, WAL mode |

### Weaknesses
| Aspect | Assessment |
|--------|-----------|
| Test Coverage | Minimal: only 2 test files found |
| Error Reporting | None in production — console-only |
| Accessibility | Partial: high-contrast theme exists but no ARIA audit |
| Documentation | Good technical docs, sparse inline code comments in some modules |
| Online Sync | Early-stage — only Google OAuth scaffold exists |

---

## 2. Project Overview & Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Shell                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Main Process (electron/main.ts)          │   │
│  │  • Window management (7 window types)                │   │
│  │  • IPC handler registry                              │   │
│  │  • GPU/performance configuration                     │   │
│  │  • Auto-updater (electron-updater)                   │   │
│  │  • Menu construction                                 │   │
│  │  • OAuth callback server (calendar sync)             │   │
│  └──────────┬───────────────────────────────────────────┘   │
│             │ IPC (contextBridge)                           │
│  ┌──────────▼───────────────────────────────────────────┐   │
│  │            Preload (electron/preload.ts)               │   │
│  │  • Exposes ~80 API methods via window.electronAPI     │   │
│  │  • Type-safe interface (Preferences generic)          │   │
│  └──────────┬───────────────────────────────────────────┘   │
│             │                                              │
│  ┌──────────▼───────────────────────────────────────────┐   │
│  │          Renderer (React SPA via Vite)                │   │
│  │  • App.tsx — main orchestrator                        │   │
│  │  • Contexts: CalendarContext, EntriesContext           │   │
│  │  • Components: 20+ TSX components                     │   │
│  │  • Services: journalService (data access layer)        │   │
│  │  • Utils: calendars, themes, audio, performance        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              SQLite Database (better-sqlite3)                │
│  • Profile-isolated databases                               │
│  • WAL mode (write-ahead logging)                          │
│  • Tables: journal_entries, entry_versions, preferences,    │
│    entry_templates, calendar_accounts, remote_calendars,    │
│    remote_events, calendar_sync_state                       │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Window Rendering
The app uses **8 distinct Vite entry points** (multi-page application pattern):
| Entry Point | Path | Purpose |
|-------------|------|---------|
| Main | `index.html` → `App.tsx` | Primary journal UI |
| Preferences | `preferences.html` → `preferences.tsx` | Settings dialog |
| About | `about.html` → `about.tsx` | App info |
| Profile Selector | `profile-selector.html` → `profile-selector.tsx` | Profile management |
| Import Progress | `import-progress.html` → (inline) | Import feedback |
| Startup Loading | `startup-loading.html` → (inline) | Splash screen |
| Archive Export | `archive-export.html` → `archive-export.tsx` | Batch export UI |
| Export Profile Selector | `export-profile-selector.html` → `export-profile-selector.tsx` | Profile-based export |

---

## 3. Technology Stack

### Core
| Technology | Version | Purpose |
|-----------|---------|---------|
| Electron | ^39.2.5 | Desktop shell |
| React | ^18.2.0 | UI framework |
| TypeScript | ^5.3.3 | Language |
| Vite | ^7.2.7 | Bundler (HMR dev, esbuild minify prod) |
| better-sqlite3 | ^12.5.0 | SQLite3 bindings (native module) |
| date-fns | ^3.0.0 | Date manipulation |

### Key Dependencies
| Package | Purpose |
|---------|---------|
| pdfkit ^0.14.0 | PDF export generation |
| archiver ^7.0.1 | Archive/backup creation |
| electron-updater ^6.1.8 | Auto-update via GitHub releases |
| electron-rebuild ^3.7.2 | Rebuild native modules per Electron version |
| @fontsource/* (8x) | Bundled offline fonts (Inter, Noto Sans variants, Antonio, Bebas Neue) |
| concurrently ^8.2.2 | Dev script parallelization |
| sharp ^0.34.5 | Icon generation / image processing |
| semver ^7.6.3 | Version comparison |

### Dev & Test
| Package | Purpose |
|---------|---------|
| Jest ^29.7.0 | Test runner |
| ts-jest ^29.1.1 | TypeScript Jest transformer |
| @testing-library/react ^14.1.2 | React component testing |
| @testing-library/jest-dom ^6.1.5 | DOM matchers |
| ts-node ^10.9.2 | Script execution |

---

## 4. Directory Structure Analysis

```
b:\Coding\CalenRecall\
├── electron/                    # Main process (backend)
│   ├── main.ts                  # App entry, window mgmt, GPU config (~400+ lines)
│   ├── preload.ts               # IPC bridge (~400+ lines, 80+ methods)
│   ├── ipc-handlers.ts          # All IPC handler registrations (~2000+ lines)
│   ├── database.ts              # Database layer (~2000+ lines)
│   ├── database-types.ts        # Raw DB row type definitions
│   ├── profile-manager.ts       # Multi-profile & password system
│   ├── auto-updater.ts          # electron-updater integration
│   ├── types.ts                 # Backend type definitions
│   ├── pdfkit.d.ts              # Type declarations for pdfkit
│   ├── tsconfig.json            # Electron TypeScript config
│   └── utils/
│       ├── inputValidation.ts   # Input sanitization
│       ├── jsonCache.ts         # JSON parse caching
│       ├── logger.ts            # Structured logging
│       ├── passwordUtils.ts     # Password hashing & recovery keys
│       ├── pathValidation.ts    # Path traversal protection
│       └── __tests__/
│
├── src/                         # Renderer process (frontend)
│   ├── main.tsx                 # React entry, global tooltip system
│   ├── App.tsx                  # Main app component (~500+ lines)
│   ├── App.css                  # App layout styles
│   ├── index.css                # Global reset styles
│   ├── fonts.css                # Font imports
│   ├── performance-mode.css     # Extreme performance mode styles
│   ├── types.ts                 # Frontend type definitions
│   ├── setupTests.ts            # Jest setup
│   │
│   ├── components/              # React components (20+)
│   │   ├── TimelineView.tsx     # Main calendar timeline
│   │   ├── CalendarView.tsx     # Grid-based calendar view
│   │   ├── NavigationBar.tsx    # Date navigation & mode selector
│   │   ├── JournalEditor.tsx    # Rich text entry editor
│   │   ├── JournalList.tsx      # Entry listing panel
│   │   ├── EntryViewer.tsx      # Read-only entry display
│   │   ├── EntryEditModal.tsx   # Modal entry editor
│   │   ├── GlobalTimelineMinimap.tsx  # Interactive timeline minimap
│   │   ├── SearchView.tsx       # Full-text search UI
│   │   ├── BackgroundArt.tsx    # Procedural/custom background
│   │   ├── LoadingScreen.tsx    # Animated startup loader
│   │   ├── UpdateBanner.tsx     # Update notification
│   │   ├── ExportMetadataModal.tsx  # Export metadata dialog
│   │   ├── ErrorBoundary.tsx    # React error boundary
│   │   ├── HotkeyDiagram.tsx    # Keyboard shortcut reference
│   │   ├── CalendarCell.tsx     # Individual day cell
│   │   ├── ImportProgressModal.tsx  # Import progress UI
│   │   ├── Preferences.tsx      # (loaded via preferences.html)
│   │   ├── About.tsx            # (loaded via about.html)
│   │   └── __tests__/
│   │       └── ErrorBoundary.test.tsx
│   │
│   ├── contexts/
│   │   ├── CalendarContext.tsx   # Calendar system state provider
│   │   └── EntriesContext.tsx    # Global entry state & lookup cache
│   │
│   ├── services/
│   │   └── journalService.ts    # Data access layer (IPC wrapper)
│   │
│   ├── hooks/
│   │   ├── useDisplayRefreshRate.ts  # Monitor refresh detection
│   │   └── usePerformanceOptimized.ts  # Performance hooks
│   │
│   ├── themes/                  # 37 CSS theme files
│   │   ├── README.md            # Theme creation guide
│   │   ├── COMPONENT_CLASSES.md # All styleable component classes
│   │   ├── THEME_EXPANSION_STATUS.md
│   │   ├── theme-template.css   # Template for custom themes
│   │   ├── example-custom-theme.css
│   │   └── *.css (37 theme files)
│   │
│   ├── utils/
│   │   ├── calendars/           # CALENDAR ENGINE (~30 files)
│   │   │   ├── types.ts              # CalendarSystem union type (17 values)
│   │   │   ├── calendarConverter.ts   # Universal JDN-based converter
│   │   │   ├── julianDayUtils.ts      # Core JDN algorithms
│   │   │   ├── astronomicalUtils.ts   # Solar longitudes, moon phases
│   │   │   ├── calendarDescriptions.ts # Rich cultural descriptions
│   │   │   ├── dateFormatter.ts       # Multi-calendar date formatting
│   │   │   ├── epochUtils.ts          # Epoch/era calculations
│   │   │   ├── timeRangeConverter.ts  # Time range utilities
│   │   │   ├── dateEntryConfig.ts     # Calendar-specific input configs
│   │   │   ├── fontUtils.ts           # Script-specific font support
│   │   │   ├── macroCycles.md         # Multi-year cycle documentation
│   │   │   ├── macroCycleUtils.ts     # Cycle calculations
│   │   │   ├── macroCycleVerification.ts
│   │   │   ├── macroCycleAccuracy.md
│   │   │   ├── ACCURACY_FRAMEWORK.md
│   │   │   ├── CALENDAR_ACCURACY_STATUS.md
│   │   │   ├── CULTURAL_VERIFICATION_STATUS.md
│   │   │   ├── RESEARCH_SOURCES.md
│   │   │   ├── IMPROVEMENT_LOG.md
│   │   │   └── [calendar].ts (17 individual calendar files)
│   │   │
│   │   ├── performance/         # Performance subsystem
│   │   │   ├── animationManager.ts    # Compositor-optimized animations
│   │   │   ├── taskScheduler.ts       # Adaptive frame-budget scheduler
│   │   │   ├── virtualRenderer.ts     # Intersection Observer virtual list
│   │   │   ├── displayRefreshRate.ts  # Monitor Hz detection
│   │   │   └── styleBatcher.ts        # CSS batch updates
│   │   │
│   │   ├── astronomicalEvents.ts      # Solstice/equinox/moon phase helpers
│   │   ├── audioUtils.ts              # Web Audio API sound effects
│   │   ├── backgroundColorExtractor.ts
│   │   ├── calendarTierNames.ts
│   │   ├── customThemeLoader.ts       # Loads custom themes from AppData
│   │   ├── dateUtils.ts               # Core date helpers (ISO, negative years)
│   │   ├── dragBehavior/              # Minimap drag interaction
│   │   ├── entryColorUtils.ts         # Color-coded entry indicators
│   │   ├── entryFilterUtils.ts        # Entry filtering
│   │   ├── entryLookupUtils.ts        # O(1) lookup structures
│   │   ├── errorHandler.ts            # Error handling utilities
│   │   ├── lavaLampArt.ts             # Lava lamp procedural art variant
│   │   ├── logger.ts                  # Dev-only console wrapper
│   │   ├── proceduralArt.ts           # Procedural background generator
│   │   ├── themeLoader.ts             # CSS theme file loader
│   │   ├── themes.ts                  # Theme metadata & apply logic
│   │   ├── windowStateTracker.ts      # Fullscreen/maximize flicker prevention
│   │   └── __tests__/
│   │       └── errorHandler.test.ts
│   │
│   └── themes.css               # Aggregated theme imports
│
├── scripts/                     # Build & utility scripts
│   ├── auto-version.js          # Auto-increment version
│   ├── bump-version.js          # Version bump utility
│   ├── check-database-status.js # DB health check
│   ├── clean-release.js         # Release folder cleanup
│   ├── clean-release-partial.js # Partial cleanup (for incremental builds)
│   ├── fix-artifact-names.js    # Rename build artifacts
│   ├── generate-boundary-test-profile.js  # Test data generator
│   ├── generate-icon.js         # Icon generation (sharp)
│   ├── open-release.js          # Open release folder
│   ├── pre-build-cleanup.js     # Pre-build preparation
│   ├── test-calendar-accuracy.ts # Calendar accuracy verification
│   ├── verify-epochs.ts         # Epoch verification
│   ├── verify-chinese-calendar.ts
│   ├── debug-chinese-calendar.ts
│   └── scripts/
│       └── test-calendar-accuracy.js
│
├── assets/
│   ├── icon.svg                 # App icon (vector)
│   ├── icon.png                 # App icon (raster 32x32)
│   ├── icon-512.png             # App icon (512x512)
│   ├── icon-1024.png            # App icon (1024x1024)
│   ├── astromonixlogo.png       # AstroMonix logo
│   ├── README.md                # Asset notes
│   └── URL_PARAMETER_SYSTEM.md  # URL parameter documentation (?theme=, ?date=, etc.)
│
├── dist-electron/               # Compiled Electron code output
├── dist/                        # Vite build output
├── release/                     # electron-builder output (installers, portable)
├── public/assets/               # Static assets
├── _MD BIN/                     # Miscellaneous notes & benchmarks
│
├── build/                       # macOS entitlements
│   └── entitlements.mac.plist
│
├── build-all.bat / .sh          # Cross-platform build scripts
├── build-installer.bat / .sh
├── build-release.bat / .sh
├── test-calendars.bat           # Calendar test launcher
├── test-jdn.bat / .js           # JDN test
│
├── package.json                 # Project manifest (~200 lines)
├── tsconfig.json                # Frontend TypeScript config
├── tsconfig.node.json           # Node/Vite TypeScript config
├── vite.config.ts               # Vite configuration
├── jest.config.js               # Jest configuration
└── *.md (documentation files)   # 10+ documentation files
```

---

## 5. Electron Backend Audit

### 5.1 Main Process (`electron/main.ts`)

**Purpose:** Application lifecycle, window management, GPU configuration.

**Key features:**
- Creates **8 window types**: main, preferences, about, profile-selector, import-progress, startup-loading, archive-export, export-profile-selector
- **GPU acceleration optimization** — reads hardware acceleration preference from SQLite **before** `app.whenReady()`, sets `--enable-webgpu`, `--enable-gpu-rasterization`, `--enable-zero-copy`
- **Extreme performance mode** — aggressive Chromium CLI flags: `--disable-renderer-backgrounding`, `--js-flags="--max-old-space-size=4096"`, `--enable-features=ThreadedScrolling`
- **Cross-platform adaptations** — macOS title bar integration, Windows DPI awareness
- **Auto-updater** integration with GitHub Releases feed

**Notable patterns:**
- Uses a `readHardwareAccelerationPreference()` function that opens the SQLite DB in readonly mode before `app.whenReady()` — clever workaround for chicken-and-egg problem
- `getOptimizedWebPreferences()` dynamically constructs WebPreferences with conditional WebGPU support based on Electron version detection

### 5.2 Preload (`electron/preload.ts`)

**Purpose:** Secure IPC bridge between main and renderer.

**API Surface:** Exposes ~80 methods via `contextBridge.exposeInMainWorld('electronAPI', {...})`

**Method categories:**

| Category | Count | Examples |
|----------|-------|---------|
| Entry CRUD | 18 | `getEntries`, `saveEntry`, `deleteEntry`, `archiveEntry` |
| Entry queries | 6 | `searchEntries`, `getAllEntries`, `getEntryCount` |
| Templates | 4 | `getAllTemplates`, `saveTemplate` |
| Attachments | 3 | `addEntryAttachment`, `removeEntryAttachment` |
| Export/Import | 4 | `exportEntries`, `importEntries` |
| Backup/Restore | 2 | `backupDatabase`, `restoreDatabase` |
| Preferences | 5 | `getPreference`, `setPreference`, `resetPreferences` |
| Calendar Sync | 10+ | `listCalendarAccounts`, `syncCalendar`, `authCalendar` |
| Profile Management | 12 | `createProfile`, `deleteProfile`, `verifyProfilePassword` |
| Updates | 7 | `checkForUpdates`, `onUpdateAvailable` |
| Window/System | 6 | `openPreferences`, `setFullScreen`, `getAppVersion` |
| Other | 3 | `onProfileSwitched`, `onPreferenceUpdated` |

**Security:** All IPC goes through `ipcRenderer.invoke` (request/response) — no `send` methods, minimizing event-based attack surface.

### 5.3 IPC Handlers (`electron/ipc-handlers.ts`)

**Purpose:** All `ipcMain.handle()` registrations — the largest file in the project.

**Key subsystems:**
- **Entry management**: CRUD with validation, versioning, archive/pin
- **Export pipeline**: 7 formats (Markdown, Text, JSON, RTF, PDF, DEC, CSV) using archiver/PDFKit
- **Import pipeline**: JSON and Markdown import with progress reporting
- **Calendar sync**: OAuth2 + PKCE flow with localhost callback server for Google Calendar
- **Theme operations**: Live theme reload from custom theme files
- **Database operations**: Backup/restore with file dialogs

**Notable:**
- Uses `PKCE` (Proof Key for Code Exchange) for OAuth — no client secret needed
- Runs a **temporary HTTP server on localhost** for OAuth callback, avoiding custom protocol registration
- Token encryption via `safeStorage.encryptString()` / `crypto`
- 3-second timeout for OAuth flow

### 5.4 Database Layer (`electron/database.ts`)

**Purpose:** SQLite data access, migrations, query building.

**Schema (8 tables):**

| Table | Purpose |
|-------|---------|
| `journal_entries` | Core entries with date, time_range, title, content, tags, linked_entries, attachments, archived/pinned flags, JDN index |
| `entry_versions` | Version history for each entry (snapshot on every update) |
| `preferences` | Key-value preference store (JSON values) |
| `entry_templates` | Reusable entry templates |
| `calendar_accounts` | OAuth-connected calendar accounts |
| `remote_calendars` | Synced remote calendars per account |
| `remote_events` | Cached remote calendar events |
| `calendar_sync_state` | Sync tokens and state for incremental sync |

**Indices:** Created on `date`, `jdn`, `time_range`, `archived`, `pinned`, `entry_id`, `account_id`, `provider_calendar_id`, `provider_event_id`.

**Pragmas:** `WAL`, `synchronous = FULL`, `busy_timeout = 5000`, `foreign_keys = ON`

**Notable patterns:**
- JDN (Julian Day Number) stored alongside ISO date strings for efficient range queries
- `extractTimeFields()` helper for consistent null handling
- `formatDate()` handles negative years where `toISOString()` fails
- Template system supports pre-filled title, content, tags, and timeRange

### 5.5 Profile Manager (`electron/profile-manager.ts`)

**Purpose:** Multi-profile isolation with password protection.

**Features:**
- Profile metadata stored in `profiles.json` (userData directory)
- Passwords stored separately in `passwords.json` with `0600` permissions
- Password hashing via PBKDF2/similar (in `passwordUtils.ts`)
- Recovery key generation (forgotten password recovery)
- Migration system from single-database to multi-profile
- Orphaned WAL recovery
- Profile name sanitization and path validation (path traversal protection)

### 5.6 Auto-Updater (`electron/auto-updater.ts`)

- Uses `electron-updater` configured for GitHub Releases
- 6-hour check interval
- Environment-based feed URL resolution (`CALENRECALL_UPDATE_URL`, `GITHUB_OWNER`/`GITHUB_REPO`)
- Graceful skip in development mode
- Rich dialog on update download completion

### 5.7 Security Analysis (Backend)

| Aspect | Status | Notes |
|--------|--------|-------|
| Context Isolation | ✅ | `contextIsolation: true` |
| Node Integration | ✅ | `nodeIntegration: false` |
| Input Validation | ✅ | `inputValidation.ts` with type guards |
| Path Traversal | ✅ | `pathValidation.ts` — path normalization + directory containment check |
| CSP | ✅ | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'` |
| Token Encryption | ✅ | `safeStorage` + encrypted SQLite blobs |
| Password Storage | ✅ | Separate hashed file, restrictive permissions |
| CSRF (OAuth) | ✅ | PKCE + state parameter |
| Production Logging | ⚠️ | Console only; no structured production logging |

---

## 6. React Frontend Audit

### 6.1 Component Architecture

```
App.tsx (orchestrator)
├── BackgroundArt
├── LoadingScreen (startup)
├── NavigationBar
│   └── (date input, mode selector, calendar picker)
├── TimelineView
│   ├── CalendarView
│   │   └── CalendarCell (day cells, entry indicators)
│   └── JournalList (entry listing)
├── GlobalTimelineMinimap (lazy loaded, portal)
│   └── Crystal renderings (entry visualization)
├── JournalEditor / EntryEditModal
├── EntryViewer
├── SearchView (lazy loaded)
├── ExportMetadataModal
├── UpdateBanner
└── ErrorBoundary (wraps app)
```

### 6.2 State Management

Two React Contexts:
- **`CalendarContext`** — Calendar system selection, date conversion functions, preference persistence
- **`EntriesContext`** — Entry array + pre-built `EntryLookup` (O(1) lookup structure) + `entryColors` map

No external state management library — pure React Context + hooks, which is appropriate for this complexity level.

### 6.3 Data Flow

```
User Action → Component → IPC (window.electronAPI.*) → Main Process → SQLite
                  ↑                                                          │
                  └───────────── IPC Response ───────────────────────────────┘
```

The `journalService.ts` layer wraps IPC calls with canonical date calculations.

### 6.4 Entry Lookup System (`entryLookupUtils.ts`)

A **critical optimization**: all entries are indexed at startup into `Map`/`Set` structures for O(1) lookups:
- `byDateString: Map<string, JournalEntry[]>` — day entries by date
- `byMonth: Map<string, JournalEntry[]>` — month entries by "YYYY-MM"
- `byYear: Map<number, JournalEntry[]>` — year entries
- `byWeekStart: Map<string, JournalEntry[]>` — week entries by week start date
- `byDecade: Map<number, JournalEntry[]>` — decade entries
- `hasEntryDates: Set<string>` — boolean existence check (fast)
- Plus month/year/week/decade presence sets

This structure is built once on load and **only rebuilt when entries actually change** (hash-based diff in `EntriesContext`).

### 6.5 Global Timeline Minimap

The **most visually complex component**:
- Interactive canvas spanning from 9999 BCE to 9999 CE
- Entry "crystals" rendered as polygons (sides determined by numerological analysis of entry content)
- Drag-to-navigate with adaptive thresholds
- Zoom between time scales (decade → year → month → week → day)
- Color-coded time scale indicators
- Audio feedback (slider noise, movement flow sounds)
- Portal-rendered overlay

### 6.6 Loading Screen

Animated SVG loading sequence with:
- Rotating infinity symbol
- Step-by-step progress (load → index → finalize → ready)
- 3-second "appreciation pause" after 100% for visual enjoyment

### 6.7 Global Tooltip System (`main.tsx`)

A custom tooltip system that:
- Replaces native `title` attributes with a single shared overlay
- Tracks `pointerover`/`pointermove`/`pointerout` events
- Prevents native tooltips from showing
- Supports keyboard focus tooltips

---

## 7. Calendar System Deep-Dive

### 7.1 Architecture

```
                    ┌─────────────────────────────────┐
                    │  Universal Calendar Converter    │
                    │  (calendarConverter.ts)          │
                    └──────────┬──────────────────────┘
                               │ JDN pivot
                               ▼
                    ┌─────────────────────────────────┐
                    │  Julian Day Number (JDN)         │
                    │  (julianDayUtils.ts)             │
                    │  Continuous day count since      │
                    │  January 1, 4713 BCE             │
                    └──────┬──────┬──────┬────────────┘
                           │      │      │
              ┌────────────┘      │      └────────────┐
              ▼                   ▼                   ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │ Calendar A → JDN  │  │ Calendar B → JDN  │  │ ... 17 calendars│
    │ JDN → Calendar A  │  │ JDN → Calendar B  │  │                  │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 7.2 The 17 Calendar Systems

| # | Calendar | Type | File | Era Start | Accuracy |
|---|----------|------|------|-----------|----------|
| 1 | Gregorian | Solar | `julianDayUtils.ts` | 1 CE | ✅ Verified |
| 2 | Julian | Solar | `julianDayUtils.ts` | 1 CE | ✅ Verified* |
| 3 | Islamic (Hijri) | Lunar | `islamic.ts` | 622 CE (AH) | ✅ Verified |
| 4 | Hebrew | Lunisolar | `hebrew.ts` | 3761 BCE (AM) | ✅ Verified |
| 5 | Persian (Jalali) | Solar | `persian.ts` | 622 CE (SH) | ✅ Verified |
| 6 | Chinese (农历) | Lunisolar | `chinese.ts` | Continuous | ⚠️ Partial |
| 7 | Ethiopian | Solar (13mo) | `ethiopian.ts` | 8 CE (EE) | ✅ Verified |
| 8 | Coptic | Solar (13mo) | `coptic.ts` | 284 CE (AM) | ✅ Verified |
| 9 | Indian Saka | Solar | `indianSaka.ts` | 78 CE (Saka) | ✅ Verified |
| 10 | Baháʼí | Solar (19mo) | `bahai.ts` | 1844 CE (BE) | ✅ Verified |
| 11 | Thai Buddhist | Solar | `thaiBuddhist.ts` | 543 BCE (BE) | ✅ Verified |
| 12 | Mayan Tzolk'in | Sacred (260d) | `mayanTzolkin.ts` | 3114 BCE | ✅ Verified |
| 13 | Mayan Haab' | Solar (365d) | `mayanHaab.ts` | 3114 BCE | ✅ Verified |
| 14 | Mayan Long Count | Linear | `mayanLongCount.ts` | 3114 BCE | ✅ Verified |
| 15 | Cherokee | Seasonal | `cherokee.ts` | N/A | ⚠️ Partial |
| 16 | Iroquois | Lunar (13mo) | `iroquois.ts` | N/A | ⚠️ Partial |
| 17 | Aztec Xiuhpohualli | Solar (365d) | `aztecXiuhpohualli.ts` | ~1428 CE | ✅ Verified |

*\*Julian has documented historical limitations (pre-8 CE month lengths, leap year errors)*

### 7.3 Astronomical Calculations (`astronomicalUtils.ts`)

Based on **Jean Meeus' "Astronomical Algorithms"** :
- True solar longitude calculation (used for Chinese solar terms, Baháʼí Naw-Rúz)
- Vernal equinox estimation (accuracy-critical for Persian and Baháʼí calendars)
- New moon estimation (lunar phase for Chinese/Hebrew months)
- Solstice/Equinox calculation (4 per year)
- Moon phase calculation (new, first quarter, full, last quarter)

### 7.4 Accuracy & Cultural Verification

The project has **exceptional documentation** of its calendar accuracy:
- `ACCURACY_FRAMEWORK.md` — Defines the methodology
- `CALENDAR_ACCURACY_STATUS.md` — Per-calendar status with sources and dates
- `CULTURAL_VERIFICATION_STATUS.md` — Notes that cultural community consultation is pending
- `RESEARCH_SOURCES.md` — Full academic bibliography (Dershowitz & Reingold, Meeus, Bickerman, etc.)
- `IMPROVEMENT_LOG.md` — Chronological improvement tracking

**Key philosophy:** Technical accuracy (algorithms verified ✅) is distinguished from **cultural verification** (community consultation ⚠️ pending).

### 7.5 JDN Implementation Details (`julianDayUtils.ts`)

- Implements **proleptic Gregorian** and **proleptic Julian** calendars
- Supports dates from **9999 BCE to 9999 CE**
- Handles **negative years** correctly (astronomical year numbering where 0 = 1 BCE)
- Uses reference JDN 2440588 (Unix epoch) for JavaScript Date construction to avoid browser limitations with ancient dates
- Based on Dershowitz & Reingold's "Calendrical Calculations" algorithms

### 7.6 Macro Cycles (`macroCycles.md`)

Documentation for multi-year cycles for year/decade views:
- Chinese 60-year Sexagenary Cycle (干支)
- Mayan Baktun (144,000 days / ~394 years)
- Mayan Katun (7,200 days / ~19.7 years)
- Metonic Cycle (19 years — Hebrew leap year cycle)
- Mayan Calendar Round (52 years)
- Hindu Yuga Cycles (4,320,000-year Mahayuga)

---

## 8. Performance Architecture

The project contains a **sophisticated performance subsystem** that rivals professional-grade applications:

### 8.1 Task Scheduler (`taskScheduler.ts`)
- **Adaptive frame budgeting** — auto-detects monitor refresh rate (60/120/144/240 Hz)
- **Priority queues**: critical → high → normal → low
- **PerformanceObserver** integration for real-time frame timing analysis
- Rolling 60-frame history for adaptive budget adjustment
- 20% margin for overhead

### 8.2 Animation Manager (`animationManager.ts`)
- **Compositor-optimized**: only transform/opacity properties (avoids layout thrashing)
- **Concurrency limiter**: max 10 simultaneous animations
- **will-change** management (set before animation, cleared after)
- CSS keyframe injection (avoids JS animation overhead)
- Queue for overflow animations

### 8.3 Virtual Renderer (`virtualRenderer.ts`)
- **IntersectionObserver**-based visibility detection
- **Overscan** support (render extra items outside viewport)
- **RAF-throttled** scroll listener
- Zero-copy item cache
- Generic `<T>` type support

### 8.4 Display Refresh Rate Detector (`displayRefreshRate.ts`)
- Samples 60 animation frames
- Rounds to common rates (60, 75, 120, 144, 165, 240, 360)
- Re-detects on visibility change (monitor switch)

### 8.5 Style Batcher (`styleBatcher.ts`)
- Batches CSS style updates
- Uses `requestAnimationFrame` for synchronized updates

### 8.6 Electron-level Optimizations
- `backgroundThrottling: false` — prevents throttling during animations
- `v8CacheOptions: 'code'` — caches compiled V8 code
- `spellcheck: false` — saves resources
- WebGPU enablement (Electron 28+)
- GPU rasterization and zero-copy flags
- Extreme performance CLI switches

---

## 9. Theme System

### 9.1 Architecture

37 CSS themes loaded via:
1. `src/themes/` — CSS files per theme
2. `src/themes.css` — Aggregated `@import` statements
3. `src/utils/themeLoader.ts` — Imports all theme CSS
4. `src/utils/customThemeLoader.ts` — Loads user themes from AppData
5. `src/utils/themes.ts` — Metadata and `applyTheme()` logic

### 9.2 Theme Categories

| Category | Themes |
|----------|--------|
| **Standard** | Light, Dark, Auto (system), Classic Light, Classic Dark, High Contrast, Terminal, BIOS |
| **Nature** | Forest, Ocean, Sunset, Red Rock, Australian Desert, Hot Spring |
| **Retro** | NEON (80s), Vegas 80s |
| **Modern** | Modern Minimal, Modern Minimal OLED, Aero (glassmorphism) |
| **Academic** | Scholar, Archive, Librarian's Study, Research, Manuscript Room, Reading Room |
| **Gaming/Sci-Fi** | ON SCREEN (LCARS), Elite (Dangerous), Journeyman, Temple of Light, Temple of Darkness, Kallisti (Eris), Galactic Basic, Stellar Echo, Out There, The Real World, Football |
| **Special** | Tabletop (board game) |

### 9.3 Custom Theme Support
- User themes stored in AppData directory
- Auto-discovery via filesystem scan
- Template provided (`theme-template.css`)
- Component class catalog (`COMPONENT_CLASSES.md`) — ensures complete coverage

---

## 10. Build & Release Pipeline

### 10.1 Dev Workflow
```
npm run dev
  ├── npm run rebuild (electron-rebuild better-sqlite3)
  ├── npm run build:electron (tsc -p electron)
  └── concurrently
      ├── vite (HMR dev server on :5173)
      ├── tsc -p electron --watch (watch mode)
      └── wait-on :5173 && electron .
```

### 10.2 Build Pipeline
```
npm run build
  ├── npm run rebuild
  ├── npm run build:react (vite build → dist/)
  └── npm run build:electron (tsc → dist-electron/)

npm run dist
  ├── npm run version:auto
  ├── npm run build
  ├── npm run clean:release
  ├── electron-builder
  └── node scripts/fix-artifact-names.js
```

### 10.3 Distribution Targets

| Script | Target | Format |
|--------|--------|--------|
| `dist:win` | Windows x64 | NSIS installer + portable |
| `dist:win:installer` | Windows x64 | NSIS installer |
| `dist:win:portable` | Windows x64 | Portable .exe |
| `dist:mac` | macOS | DMG + ZIP |
| `dist:mac:universal` | macOS | Universal binary (x64+arm64) |
| `dist:mac:dmg` | macOS | DMG |
| `dist:mac:zip` | macOS | ZIP |

### 10.4 Release Scripts

| Script | Purpose |
|--------|---------|
| `auto-version.js` | Auto-increment based on date (YYYY.MM.DD-N) |
| `bump-version.js` | Manual version bump |
| `clean-release.js` | Deep clean of release artifacts |
| `clean-release-partial.js` | Partial clean (incremental build support) |
| `fix-artifact-names.js` | Rename Electron output to standardized names |
| `pre-build-cleanup.js` | Kill processes, remove build artifacts |
| `open-release.js` | Open release folder in Explorer/Finder |
| `generate-icon.js` | Generate PNG icons from SVG via sharp |

### 10.5 Build Configuration (`package.json` `"build"` key)
- Windows: NSIS installer + portable, per-machine installation
- macOS: DMG + ZIP, hardened runtime with entitlements
- Linux: Not currently targeted
- Publishing: GitHub Releases (via electron-updater)

---

## 11. Testing Coverage

### Current State: **MINIMAL** ⚠️

| Area | Files | Type |
|------|-------|------|
| React Components | `ErrorBoundary.test.tsx` (1 test) | Jest |
| Utils | `errorHandler.test.ts` (1 test) | Jest |
| Calendar Scripts | 3 TypeScript verification scripts | Manual/Integration |
| JDN Test | `test-jdn.js` | Manual |

### Test Infrastructure
- **Jest** configured with `ts-jest`, `jsdom` environment
- **@testing-library/react** available
- **Identity-obj-proxy** for CSS mocking
- Coverage thresholds set to 0% (effectively disabled)
- Test roots: `src/` and `electron/`

### Verification Scripts (not Jest)
| Script | Purpose |
|--------|---------|
| `test-calendar-accuracy.ts` | Tests calendar conversions against reference dates |
| `verify-epochs.ts` | Verifies epoch calculations |
| `verify-chinese-calendar.ts` | Chinese calendar-specific verification |
| `debug-chinese-calendar.ts` | Debugging utility for Chinese calendar |

---

## 12. Security Analysis

### 12.1 Strengths
- **Context isolation**: Renderer cannot access Node.js APIs
- **Input validation**: Dedicated `inputValidation.ts` with type guards (`isValidDateString`, `isValidEntryId`, `validateJournalEntry`)
- **Path traversal protection**: `pathValidation.ts` normalizes paths and validates they stay within `userData`
- **CSP**: Content Security Policy restricts to `'self'` with minimal `unsafe-inline` for scripts/styles
- **Password security**: Separate `passwords.json` with `0600` permissions; recovery key system
- **OAuth security**: PKCE flow (no client secret in code); temporary localhost callback server (no custom protocol)
- **Token encryption**: `safeStorage` (OS-level encryption) for OAuth tokens

### 12.2 Weaknesses
- **No production error reporting**: Errors logged only to console
- **CSP allows `unsafe-inline`**: For scripts and styles (required by React)
- **No audit logging**: No record of export/delete operations
- **No input rate limiting**: Search/export could be abused locally
- **Attachments**: File attachments stored locally without encryption

---

## 13. Known Limitations & Risks

### Critical
| # | Issue | Impact | Mitigation |
|---|-------|--------|------------|
| 1 | **Near-zero test coverage** | Regressions likely | Manual testing only |
| 2 | **No CI/CD pipeline** | Build validation manual | N/A |
| 3 | **No production error reporting** | Silent failures | Console checking |

### Moderate
| # | Issue | Impact | Mitigation |
|---|-------|--------|------------|
| 4 | **2 test files only** | Architecture QA risk | Incremental test addition needed |
| 5 | **Cultural calendars unverified** | May not match community expectations | Documented; consultation planned |
| 6 | **Julian calendar pre-8 CE** | Historical inaccuracy for ancient dates | Documented limitation |
| 7 | **macOS/Linux untested** | Platform-specific bugs likely | Windows-focused for now |
| 8 | **Online sync early stage** | Only Google OAuth scaffold; no actual sync | Planned for follow-up |
| 9 | **Large dataset performance** | 10k+ entries may cause 3-5s initial load | Loading screen mitigates UX |
| 10 | **Export metadata modal** | Not integrated with profile-specific exports | Workaround: set in preferences |

### Minor
| # | Issue |
|---|-------|
| 11 | Font files bundled (increases app size) — necessary for offline use |
| 12 | `unsafe-inline` in CSP — required for React/theme system |
| 13 | No keyboard navigation audit for accessibility |
| 14 | No i18n/l10n support |
| 15 | No Linux build target |

---

## 14. Recommendations

### Priority 1 (High Risk)
1. **Increase test coverage** — Start with core calendar conversion tests, then critical IPC handlers
2. **Set up CI pipeline** — GitHub Actions for TypeScript compilation, lint, and test execution
3. **Add production error tracking** — Integrate Sentry or file-based error logging

### Priority 2 (Medium Risk)
4. **Complete calendar cultural verification** — Reach out to communities for the 5 priority calendars
5. **Add keyboard accessibility audit** — Ensure all features are keyboard-navigable
6. **Implement remaining OAuth sync** — Complete the actual Google Calendar sync, then Microsoft/CalDAV
7. **Add backup automation** — Automatic periodic backups with retention

### Priority 3 (Low Risk / Polish)
8. **Expand test coverage to 30%+** — Focus on IPC handlers and calendar conversions
9. **Add i18n foundation** — Extract strings for future translation
10. **Linux build target** — Electron supports Linux; configuration is straightforward
11. **Add E2E tests** — Playwright or Spectron for full Electron integration tests
12. **Performance benchmarks** — Automated performance regression detection for the optimization subsystems

---

## Appendix A: File Count & Size Estimates

| Directory | Files (approx) | Est. Lines |
|-----------|---------------|------------|
| `electron/` | 12 + utils | ~7,000 |
| `src/components/` | ~30 (TSX+CSS) | ~8,000 |
| `src/contexts/` | 2 | ~400 |
| `src/services/` | 1 | ~100 |
| `src/hooks/` | 2 | ~200 |
| `src/utils/calendars/` | ~30 | ~6,000 |
| `src/utils/performance/` | 5 | ~800 |
| `src/utils/` (other) | ~15 | ~3,000 |
| `src/themes/` | 37+ CSS | ~5,000 |
| `scripts/` | ~15 | ~1,500 |
| **Total** | **~150** | **~32,000** |

## Appendix B: Key Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | User-facing project overview, features, setup |
| `ALPHA_NOTES.md` | Alpha release notes, known limitations, testing focus |
| `CALENDAR_ACCURACY_SYSTEM.md` | Calendar accuracy framework overview |
| `CALENDAR_ACCURACY_IMPROVEMENTS.md` | Historical context improvement analysis |
| `ONLINE_CALENDAR_SYNC_IMPLEMENTATION_PLAN.md` | Online sync roadmap |
| `EVOLUTION OF CALENDARS...html` | External reference document on calendar history |
| `assets/URL_PARAMETER_SYSTEM.md` | URL parameter API for UI customization |
| `src/themes/README.md` | Theme creation guide |
| `src/themes/COMPONENT_CLASSES.md` | All styleable CSS classes |
| `src/themes/THEME_EXPANSION_STATUS.md` | Status of theme development |
| `src/utils/calendars/ACCURACY_FRAMEWORK.md` | Calendar accuracy methodology |
| `src/utils/calendars/CALENDAR_ACCURACY_STATUS.md` | Per-calendar accuracy verification status |
| `src/utils/calendars/CULTURAL_VERIFICATION_STATUS.md` | Cultural consultation status |
| `src/utils/calendars/RESEARCH_SOURCES.md` | Complete academic bibliography |
| `src/utils/calendars/IMPROVEMENT_LOG.md` | Chronological improvement tracking |
| `src/utils/calendars/macroCycles.md` | Multi-year cultural cycle documentation |
| `src/utils/calendars/macroCycleAccuracy.md` | Macro cycle accuracy verification |

---

*Report generated by automated project audit. All findings based on static code analysis of the b:\Coding\CalenRecall workspace at the time of audit.*
