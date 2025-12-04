# CalenRecall

A self-contained calendar journal application for Windows that helps you recall memories across decades, years, months, weeks, and days. All your journaling history is stored locally on your device.

## Features

- **Multiple Time Views**: Navigate through decades, years, months, weeks, or days
- **Local Storage**: All data is stored locally using SQLite - your privacy is protected
- **Rich Journal Entries**: Create entries with titles, content, and tags
- **Visual Indicators**: See which dates have entries at a glance
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

### Project Structure

```
CalenRecall/
├── electron/          # Electron main process
│   ├── main.ts        # Main entry point
│   ├── preload.ts     # Preload script (IPC bridge)
│   ├── database.ts    # SQLite database operations
│   └── ipc-handlers.ts # IPC message handlers
├── src/               # React frontend
│   ├── components/    # React components
│   ├── services/      # API service layer
│   └── utils/         # Utility functions
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

All journal entries are stored in a SQLite database located in the application's user data directory:
- Windows: `%APPDATA%\calenrecall\calenrecall.db`

Your data never leaves your device.

## License

MIT

