# CalenRecall

A self-contained calendar journal application for Windows that helps you recall memories across decades, years, months, weeks, and days. All your journaling history is stored locally on your device.

## Features

- **Multiple Time Views**: Navigate through decades, years, months, weeks, or days with intuitive calendar grids
- **Hierarchical Entry System**: 
  - Day entries appear in calendar day cells
  - Week entries shown in month view's side panel, grouped by week
  - Month entries displayed in year view's month cells
  - Year entries displayed in decade view's year cells
  - All period entries (week/month/year/decade) listed in the right panel for easy access
- **Global Timeline Minimap**: Interactive visual overview of your entire timeline featuring:
  - Drag-to-navigate through time periods
  - Visual indicators for entries at different time scales
  - Smooth zooming between time scales (decade → year → month → week → day)
  - Color-coded time scale indicators
  - Entry clustering for dense time periods
  - Real-time position updates as you navigate
- **Preferences System**: Comprehensive settings including:
  - Default view mode, date format, week start day
  - Theme (light/dark/auto) and font size
  - Timeline minimap visibility and size
  - Auto-save settings
  - Window size and position (automatically saved)
- **Local Storage**: All data is stored locally using SQLite - your privacy is protected
- **Rich Journal Entries**: Create entries with titles, content, and tags at any time scale
- **Visual Indicators**: See which dates have entries at a glance with color-coded badges
- **Search & Recall**: Find past entries easily
- **Self-Contained**: Distribute as a single Windows installer

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Python (for building native modules like better-sqlite3 on Windows)
- Visual Studio Build Tools (for Windows native module compilation)

### Setup

1. Install dependencies:
```bash
npm install
```

**Note**: On Windows, you may need to install build tools for native modules:
- Install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools) or
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)

2. Run in development mode:
```bash
npm run dev
```

This will start both the Vite dev server (on port 5173) and Electron.

### Building

Build the application for production:
```bash
npm run build
```

This compiles both the React frontend and Electron backend.

**Note**: The build process includes automatic cleanup of previous release files and will open the release folder when complete.

Create a Windows distribution:

**Option 1: Installer (NSIS) - Recommended for distribution**
```bash
npm run dist:win:installer
```
This creates an installer (.exe) that users can run to install the application.

**Option 2: Portable executable (standalone .exe)**
```bash
npm run dist:win:portable
```
This creates a portable `.exe` file that can be run directly without installation.

**Option 3: Both installer and portable**
```bash
npm run dist:win
```

**Using Batch Files (Windows):**

For convenience, you can also use the provided batch files:

- `build-release.bat` - Builds portable .exe only
- `build-installer.bat` - Builds installer .exe only  
- `build-all.bat` - Builds both installer and portable

Simply double-click the batch file or run it from the command line. The batch files will:
1. Check and install dependencies if needed
2. Build the application
3. Create the distribution files
4. Open the `release` folder when complete

All builds are created in the `release` directory, and the folder will automatically open in Windows Explorer when the build completes. The applications are self-contained and don't require any additional dependencies.

### Version Management

CalenRecall uses [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

#### Bumping Versions

**Option 1: Using npm scripts (recommended)**
```bash
npm run version:patch   # 1.0.0 -> 1.0.1 (bug fixes)
npm run version:minor   # 1.0.0 -> 1.1.0 (new features)
npm run version:major   # 1.0.0 -> 2.0.0 (breaking changes)
npm run version:show    # Display current version
```

**Option 2: Using the helper script**
```bash
node scripts/bump-version.js patch   # 1.0.0 -> 1.0.1
node scripts/bump-version.js minor   # 1.0.0 -> 1.1.0
node scripts/bump-version.js major   # 1.0.0 -> 2.0.0
node scripts/bump-version.js         # Show current version
```

#### Release Workflow

When creating a new release:

1. **Bump the version:**
   ```bash
   npm run version:patch  # or minor/major as appropriate
   ```

2. **Update CHANGELOG.md** with the changes for the new version

3. **Commit the changes:**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Bump version to X.Y.Z"
   ```

4. **Create a git tag:**
   ```bash
   git tag -a vX.Y.Z -m "Version X.Y.Z"
   git push origin main --tags
   ```

5. **Build the release:**
   ```bash
   npm run dist:win:pack  # or use build-all.bat
   ```

The version in `package.json` is automatically used by electron-builder for the build artifacts.

### Project Structure

```
CalenRecall/
├── electron/          # Electron main process
│   ├── main.ts        # Main entry point and window management
│   ├── preload.ts     # Preload script (IPC bridge)
│   ├── database.ts    # SQLite database operations and preferences
│   ├── ipc-handlers.ts # IPC message handlers
│   └── types.ts       # Shared TypeScript types
├── src/               # React frontend
│   ├── components/    # React components
│   │   ├── TimelineView.tsx      # Calendar grid views
│   │   ├── EntryViewer.tsx       # Right panel entry display
│   │   ├── JournalEditor.tsx     # Entry editing interface
│   │   ├── GlobalTimelineMinimap.tsx # Top timeline overview
│   │   ├── NavigationBar.tsx     # Date navigation and view controls
│   │   └── Preferences.tsx       # Preferences window
│   ├── services/      # API service layer
│   └── utils/         # Utility functions (date formatting, etc.)
└── assets/            # Application assets (icons, etc.)
```

## Technology Stack

- **Electron**: Desktop application framework
- **React**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool
- **better-sqlite3**: Local database storage
- **date-fns**: Date manipulation utilities

## Data Storage

All journal entries and preferences are stored in a SQLite database located in the application's user data directory:
- Windows: `%APPDATA%\calenrecall\calenrecall.db`

The database includes:
- **journal_entries**: All your journal entries with support for multiple time scales (decade, year, month, week, day)
- **preferences**: Application settings and user preferences

Your data never leaves your device.

## Troubleshooting

### Build Issues

If you encounter issues building native modules (like `better-sqlite3`):
1. Ensure you have Python installed and accessible in your PATH
2. Install Visual Studio Build Tools with C++ workload
3. Run `npm run rebuild` to rebuild native modules

### Database Location

If you need to backup or restore your data, the database is located at:
- Windows: `%APPDATA%\calenrecall\calenrecall.db`

Simply copy this file to backup your entire journal history.

## Usage

### Creating Entries

You can create journal entries at different time scales:
- **Day entries**: Specific to a single day
- **Week entries**: Apply to an entire week (Monday-Sunday)
- **Month entries**: Apply to all days in a month
- **Year entries**: Apply to all days in a year
- **Decade entries**: Apply to all years in a decade

### Viewing Entries

- **Day entries** appear directly in calendar day cells
- **Week entries** are shown in the side panel when viewing month view, grouped by week
- **Month entries** appear in year view's month cells
- **Year entries** appear in decade view's year cells
- All period entries are also listed in the right panel for easy browsing and access

### Navigating with the Timeline Minimap

The timeline minimap at the top of the window provides quick navigation:
- **Drag horizontally** to move through time periods
- **Drag vertically** to zoom between time scales (decade ↔ year ↔ month ↔ week ↔ day)
- **Click on segments** to jump to specific time periods
- **Click on entry indicators** (colored gems) to view or navigate to entries
- Entry indicators cluster together when multiple entries exist in the same time period

### Preferences

Access preferences by clicking the gear icon (⚙️) in the navigation bar. You can configure:
- Default view mode and date format
- Theme and appearance settings
- Timeline minimap visibility and size
- Auto-save behavior
- Window preferences (size and position are saved automatically)

## License

MIT

