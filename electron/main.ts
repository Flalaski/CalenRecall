import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initDatabase, getAllPreferences, setPreference, closeDatabase } from './database';
import { setupIpcHandlers, setMainWindow, setMenuUpdateCallback } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

interface ThemeInfo {
  name: string;
  displayName: string;
}

// Theme metadata matching src/utils/themes.ts
const THEME_METADATA: Record<string, { displayName: string }> = {
  'light': { displayName: 'Light' },
  'dark': { displayName: 'Dark' },
  'auto': { displayName: 'Auto (System)' },
  'classic-light': { displayName: 'Classic Light' },
  'classic-dark': { displayName: 'Classic Dark' },
  'high-contrast': { displayName: 'High Contrast' },
  'terminal': { displayName: 'Terminal' },
  'bios': { displayName: 'BIOS' },
  'forest': { displayName: 'Forest' },
  'ocean': { displayName: 'Ocean' },
  'sunset': { displayName: 'Sunset' },
  'red-rock': { displayName: 'Red Rock' },
  'australian-desert': { displayName: 'Australian Desert' },
  'hot-spring': { displayName: 'Hot Spring' },
  'NEON': { displayName: 'NEON' },
  'vegas80s': { displayName: 'Vegas 80s' },
  'modern-minimal': { displayName: 'Modern Minimal' },
  'modern-minimal-oled': { displayName: 'Modern Minimal OLED' },
  'on-screen': { displayName: 'ON SCREEN' },
  'elite': { displayName: 'Elite' },
  'journeyman': { displayName: 'Journeyman' },
  'aero-glass': { displayName: 'Aero Glass' },
  'galactic-basic': { displayName: 'Galactic Basic' },
  'the-real-world': { displayName: 'The Real World' },
  'scholar': { displayName: 'Scholar' },
  'archive': { displayName: 'Archive' },
  'librarians-study': { displayName: 'Librarian\'s Study' },
  'research': { displayName: 'Research' },
  'manuscript-room': { displayName: 'Manuscript Room' },
  'reading-room': { displayName: 'Reading Room' },
  'temple': { displayName: 'Temple' },
};

/**
 * Convert a filename to a display name
 * Examples: "modern-minimal.css" -> "Modern Minimal", "high-contrast.css" -> "High Contrast"
 */
function formatDisplayName(filename: string): string {
  // Remove .css extension
  const name = filename.replace(/\.css$/, '');
  
  // Split by hyphens and capitalize each word
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Discover all available themes
 * Dynamically reads the themes directory to find all CSS files
 */
function discoverThemes(): ThemeInfo[] {
  // Core themes that are always available (handled in index.css)
  const coreThemes: ThemeInfo[] = [
    { name: 'light', displayName: THEME_METADATA['light']?.displayName || 'Light' },
    { name: 'dark', displayName: THEME_METADATA['dark']?.displayName || 'Dark' },
    { name: 'auto', displayName: THEME_METADATA['auto']?.displayName || 'Auto (System)' },
  ];
  
  // Determine themes directory path
  // In dev: src/themes/ relative to project root
  // In production: check multiple possible locations
  let themesDir: string | null = null;
  const possiblePaths: string[] = [];
  
  if (isDev) {
    // Development: themes are in src/themes/ relative to dist-electron/
    possiblePaths.push(
      path.join(__dirname, '../../src/themes'),
      path.join(process.cwd(), 'src/themes'),
      path.resolve(__dirname, '../../src/themes')
    );
  } else {
    // Production: try multiple paths
    possiblePaths.push(
      path.join(__dirname, '../../src/themes'),           // Source directory
      path.join(process.resourcesPath || '', 'src/themes'), // Resources (packaged)
      path.join(app.getAppPath(), 'src/themes'),          // App path
      path.join(__dirname, '../src/themes'),              // Relative to dist-electron
      path.join(process.cwd(), 'src/themes')              // Current working directory
    );
  }
  
  // Find the first existing path
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      themesDir = testPath;
      console.log(`[Main] Found themes directory: ${themesDir}`);
      break;
    }
  }
  
  if (!themesDir) {
    console.error(`[Main] Themes directory not found. Tried paths:`, possiblePaths);
    console.error(`[Main] __dirname: ${__dirname}`);
    console.error(`[Main] process.cwd(): ${process.cwd()}`);
    console.error(`[Main] app.getAppPath(): ${app.getAppPath()}`);
    return coreThemes; // Return only core themes if directory not found
  }
  
  const discoveredThemes: ThemeInfo[] = [];
  const processedNames = new Set<string>();
  
  try {
    // Read themes directory
    const files = fs.readdirSync(themesDir);
    console.log(`[Main] Found ${files.length} files in themes directory`);
    
    for (const file of files) {
      // Only process .css files
      if (!file.endsWith('.css')) {
        console.log(`[Main] Skipping non-CSS file: ${file}`);
        continue;
      }
      
      // Extract theme name from filename (e.g., "temple.css" -> "temple")
      const themeName = file.replace(/\.css$/, '');
      
      // Skip template/example files
      if (themeName.includes('template') || 
          themeName.includes('example') || 
          themeName === 'README' ||
          themeName === 'COMPONENT_CLASSES' ||
          themeName === 'THEME_EXPANSION_STATUS') {
        console.log(`[Main] Skipping template/example file: ${file}`);
        continue;
      }
      
      // Skip core themes (already handled)
      if (['light', 'dark', 'auto'].includes(themeName)) {
        console.log(`[Main] Skipping core theme: ${themeName}`);
        continue;
      }
      
      // Avoid duplicates
      if (processedNames.has(themeName)) {
        console.log(`[Main] Skipping duplicate: ${themeName}`);
        continue;
      }
      processedNames.add(themeName);
      
      // Use metadata if available, otherwise format the name
      const displayName = THEME_METADATA[themeName]?.displayName || formatDisplayName(themeName + '.css');
      
      console.log(`[Main] Discovered theme: ${themeName} -> ${displayName}`);
      discoveredThemes.push({
        name: themeName,
        displayName: displayName,
      });
    }
    
    console.log(`[Main] Total discovered themes: ${discoveredThemes.length}`);
  } catch (error) {
    console.error('[Main] Error discovering themes:', error);
    if (error instanceof Error) {
      console.error('[Main] Error stack:', error.stack);
    }
  }
  
  // Sort discovered themes alphabetically by display name
  const sortedThemes = discoveredThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));
  
  return [...coreThemes, ...sortedThemes];
}

function createWindow() {
  // Load preferences for window size/position
  // Note: Database must be initialized before calling getAllPreferences
  const prefs = getAllPreferences();
  
  mainWindow = new BrowserWindow({
    width: prefs.windowWidth || 2400,
    height: prefs.windowHeight || 800,
    x: prefs.windowX,
    y: prefs.windowY,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    ...(process.platform === 'win32' && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
  });
  
  // Register main window with IPC handlers so it can receive preference updates
  setMainWindow(mainWindow);

  // Handle external links - open in custom browser window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only handle http/https URLs (external links)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Create browser window with custom dimensions
      // 33% wider and twice as tall (assuming default ~800x600)
      const browserWidth = Math.floor(800 * 1.33); // ~1064px
      const browserHeight = 600 * 2; // 1200px
      
      const browserWindow = new BrowserWindow({
        width: browserWidth,
        height: browserHeight,
        minWidth: 400,
        minHeight: 300,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
        ...(process.platform === 'win32' && {
          icon: path.join(__dirname, '../assets/icon.png'),
        }),
      });
      
      browserWindow.loadURL(url);
      
      return { action: 'deny' }; // Prevent default handling
    }
    return { action: 'allow' }; // Allow other URLs
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Apply preferences when window is fully loaded (especially important for built versions)
  mainWindow.webContents.once('did-finish-load', () => {
    // Send a message to the renderer to ensure preferences are applied
    // This handles cases where preferences weren't applied during initial load
    const currentPrefs = getAllPreferences();
    console.log('[Main] Window finished loading, ensuring preferences are applied:', {
      fontSize: currentPrefs.fontSize,
      minimapSize: currentPrefs.minimapSize,
      theme: currentPrefs.theme
    });
    
    // Send preference update events to ensure they're applied
    if (currentPrefs.fontSize) {
      mainWindow?.webContents.send('preference-updated', { key: 'fontSize', value: currentPrefs.fontSize });
    }
    if (currentPrefs.minimapSize) {
      mainWindow?.webContents.send('preference-updated', { key: 'minimapSize', value: currentPrefs.minimapSize });
    }
    if (currentPrefs.theme) {
      mainWindow?.webContents.send('preference-updated', { key: 'theme', value: currentPrefs.theme });
    }
  });

  // Save window position/size on move/resize
  mainWindow.on('moved', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      setPreference('windowX', x);
      setPreference('windowY', y);
    }
  });

  mainWindow.on('resized', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      setPreference('windowWidth', width);
      setPreference('windowHeight', height);
    }
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
    mainWindow = null;
  });

  // Ensure window is properly destroyed on close
  mainWindow.on('close', (event) => {
    // On macOS, keep the app running even when all windows are closed
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createMenu() {
  const themes = discoverThemes();
  const currentTheme = getAllPreferences().theme || 'light';
  
  // Build theme menu items
  const themeMenuItems: Electron.MenuItemConstructorOptions[] = themes.map(theme => ({
    label: theme.displayName,
    type: 'radio',
    checked: theme.name === currentTheme,
    click: () => {
      setPreference('theme', theme.name);
      // Notify the renderer process about the theme change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
      }
      // Update the menu to reflect the change
      updateMenu();
    },
  }));
  
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'delete', label: 'Delete' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Select All' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
          click: () => {
            createPreferencesWindow();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
    {
      label: 'Themes',
      submenu: themeMenuItems,
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: 'Minimize' },
        { role: 'close', label: 'Close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About CalenRecall',
          click: () => {
            createAboutWindow();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Update the menu to reflect current theme selection
 * This is called when theme changes to update the radio button state
 */
function updateMenu() {
  createMenu();
}

function createPreferencesWindow() {
  if (preferencesWindow) {
    preferencesWindow.focus();
    return;
  }

  preferencesWindow = new BrowserWindow({
    width: 600,
    height: Math.floor(700 * 1.33), // 33% taller: ~931px
    minWidth: 500,
    minHeight: 500,
    parent: mainWindow || undefined,
    modal: true,
    resizable: true,
    title: 'Preferences - CalenRecall',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    ...(process.platform === 'win32' && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
  });

  // Handle external links in preferences window
  preferencesWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only handle http/https URLs (external links)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Create browser window with custom dimensions
      // 33% wider and twice as tall (assuming default ~800x600)
      const browserWidth = Math.floor(800 * 1.33); // ~1064px
      const browserHeight = 600 * 2; // 1200px
      
      const browserWindow = new BrowserWindow({
        width: browserWidth,
        height: browserHeight,
        minWidth: 400,
        minHeight: 300,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
        ...(process.platform === 'win32' && {
          icon: path.join(__dirname, '../assets/icon.png'),
        }),
      });
      
      browserWindow.loadURL(url);
      
      return { action: 'deny' }; // Prevent default handling
    }
    return { action: 'allow' }; // Allow other URLs
  });

  if (isDev) {
    preferencesWindow.loadURL('http://localhost:5173/preferences.html');
  } else {
    preferencesWindow.loadFile(path.join(__dirname, '../dist/preferences.html'));
  }

  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });

  // Ensure window is properly destroyed on close
  preferencesWindow.on('close', (event) => {
    // Allow normal close behavior
    preferencesWindow = null;
  });
}

function createAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  // Calculate optimal window size based on content
  // Content: 800px max-width + 40px padding each side = 880px width
  // Height: Allow scrolling, start with reasonable default
  aboutWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    maxWidth: 1200, // Allow resizing wider if needed
    maxHeight: undefined, // No max height limit - allow scrolling
    parent: mainWindow || undefined,
    modal: false,
    resizable: true,
    title: 'About CalenRecall',
    show: false, // Hide initially until we size it
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    ...(process.platform === 'win32' && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
  });

  // Handle external links in about window
  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only handle http/https URLs (external links)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Create browser window with custom dimensions
      // 33% wider and twice as tall (assuming default ~800x600)
      const browserWidth = Math.floor(800 * 1.33); // ~1064px
      const browserHeight = 600 * 2; // 1200px
      
      const browserWindow = new BrowserWindow({
        width: browserWidth,
        height: browserHeight,
        minWidth: 400,
        minHeight: 300,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
        ...(process.platform === 'win32' && {
          icon: path.join(__dirname, '../assets/icon.png'),
        }),
      });
      
      browserWindow.loadURL(url);
      
      return { action: 'deny' }; // Prevent default handling
    }
    return { action: 'allow' }; // Allow other URLs
  });

  if (isDev) {
    aboutWindow.loadURL('http://localhost:5173/about.html');
  } else {
    aboutWindow.loadFile(path.join(__dirname, '../dist/about.html'));
  }

  // Auto-size window to fit content after page loads
  aboutWindow.webContents.once('did-finish-load', () => {
    if (!aboutWindow) return;
    
    // Wait for layout to settle, then measure and resize
    setTimeout(() => {
      if (!aboutWindow) return;
      
      aboutWindow.webContents.executeJavaScript(`
        (function() {
          const container = document.querySelector('.about-container');
          const content = document.querySelector('.about-content');
          
          if (!container || !content) {
            return { width: 900, height: 700 };
          }
          
          // Get the scroll height which gives natural content size
          const body = document.body;
          const html = document.documentElement;
          
          // Get the actual content height - use scrollHeight for full content
          const contentHeight = Math.max(
            container.scrollHeight || 0,
            container.offsetHeight || 0,
            body.scrollHeight || 0,
            body.offsetHeight || 0,
            html.scrollHeight || 0,
            html.offsetHeight || 0,
            content.scrollHeight || 0
          );
          
          // Calculate optimal width: content max-width (800px) + container padding (40px each side) = 880px
          // Add a bit more for window chrome and comfort
          const optimalWidth = 900;
          
          // For height, allow scrolling - set a reasonable viewport height
          // but ensure minimum height for readability
          // Max viewport height: ~90% of screen height to ensure window fits
          const screenHeight = window.screen.availHeight;
          const maxViewportHeight = Math.floor(screenHeight * 0.85);
          
          // Use content height if it's reasonable, otherwise use a good default
          const optimalHeight = Math.min(
            Math.max(700, Math.ceil(contentHeight + 100)), // Content height + padding
            maxViewportHeight // But cap at screen size
          );
          
          return {
            width: optimalWidth,
            height: optimalHeight
          };
        })();
      `).then((size: { width: number; height: number }) => {
        if (aboutWindow && size) {
          const width = size.width || 900;
          const height = size.height || 700;
          
          aboutWindow.setSize(width, height, false);
          
          // Center the window
          if (mainWindow && !mainWindow.isDestroyed()) {
            const [mainX, mainY] = mainWindow.getPosition();
            const [mainWidth, mainHeight] = mainWindow.getSize();
            const x = mainX + Math.floor((mainWidth - width) / 2);
            const y = mainY + Math.floor((mainHeight - height) / 2);
            aboutWindow.setPosition(x, y, false);
          } else {
            aboutWindow.center();
          }
          
          aboutWindow.show();
        }
      }).catch((error) => {
        console.error('Error auto-sizing About window:', error);
        // Show with default size if measurement fails
        if (aboutWindow) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const [mainX, mainY] = mainWindow.getPosition();
            const [mainWidth, mainHeight] = mainWindow.getSize();
            aboutWindow.setPosition(
              mainX + Math.floor((mainWidth - 900) / 2),
              mainY + Math.floor((mainHeight - 700) / 2),
              false
            );
          }
          aboutWindow.show();
        }
      });
    }, 300); // Wait longer for styles to fully apply
  });

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  // Ensure window is properly destroyed on close
  aboutWindow.on('close', (event) => {
    // Allow normal close behavior
    aboutWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  initDatabase();
  
  // Setup IPC handlers
  setupIpcHandlers();
  
  // Register menu update callback with IPC handlers
  setMenuUpdateCallback(() => {
    updateMenu();
  });
  
  // Create application menu
  createMenu();
  
  // Handle opening preferences window
  ipcMain.handle('open-preferences', () => {
    createPreferencesWindow();
  });
  
  // Handle closing preferences window
  ipcMain.handle('close-preferences-window', () => {
    if (preferencesWindow) {
      preferencesWindow.close();
    }
  });
  
  // Handle menu update requests (called when preferences change)
  ipcMain.handle('update-application-menu', () => {
    updateMenu();
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Track if app is quitting to prevent multiple cleanup calls
let isQuitting = false;

// Cleanup function to release all resources
function cleanup() {
  if (isQuitting) {
    return; // Prevent multiple cleanup calls
  }
  isQuitting = true;

  console.log('Cleaning up application resources...');

  // Close database connection first (before destroying windows)
  closeDatabase();

  // Close all windows
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(window => {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  });

  // Remove IPC handlers to prevent memory leaks
  ipcMain.removeAllListeners();

  console.log('Cleanup completed');
}

// Handle application quit - cleanup before quitting
app.on('before-quit', () => {
  if (!isQuitting) {
    cleanup();
  }
});

app.on('will-quit', () => {
  if (!isQuitting) {
    cleanup();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Trigger cleanup before quitting
    cleanup();
    app.quit();
  }
});

// Handle app termination signals (SIGTERM, SIGINT, etc.)
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  cleanup();
  process.exit(1);
});

