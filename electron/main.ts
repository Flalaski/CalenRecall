import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';
import { initDatabase, getAllPreferences, setPreference, closeDatabase } from './database';
import { setupIpcHandlers, setMainWindow, setMenuUpdateCallback } from './ipc-handlers';

// Load environment variables from .env file (if it exists)
// This allows configuration without hardcoding values
config();

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

interface ThemeInfo {
  name: string;
  displayName: string;
}

/**
 * Initialize the custom themes folder in AppData
 * Creates the folder if it doesn't exist and copies template files
 */
function initializeCustomThemesFolder() {
  try {
    const userDataPath = app.getPath('userData');
    const customThemesDir = path.join(userDataPath, 'themes');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(customThemesDir)) {
      fs.mkdirSync(customThemesDir, { recursive: true });
      console.log(`[Main] Created custom themes directory: ${customThemesDir}`);
    }
    
    // Get the path to the template file (in src/themes/theme-template.css)
    let templateSourcePath: string | null = null;
    const possibleTemplatePaths = [
      path.join(__dirname, '../../src/themes/theme-template.css'),
      path.join(process.cwd(), 'src/themes/theme-template.css'),
      path.resolve(__dirname, '../../src/themes/theme-template.css'),
    ];
    
    if (isDev) {
      for (const testPath of possibleTemplatePaths) {
        if (fs.existsSync(testPath)) {
          templateSourcePath = testPath;
          break;
        }
      }
    } else {
      // In production, try packaged locations
      const prodPaths = [
        path.join(process.resourcesPath || '', 'src/themes/theme-template.css'),
        path.join(app.getAppPath(), 'src/themes/theme-template.css'),
        path.join(__dirname, '../src/themes/theme-template.css'),
        ...possibleTemplatePaths,
      ];
      for (const testPath of prodPaths) {
        if (fs.existsSync(testPath)) {
          templateSourcePath = testPath;
          break;
        }
      }
    }
    
    // Copy template if it doesn't exist in custom themes folder
    const templateDestPath = path.join(customThemesDir, 'theme-template.css');
    if (templateSourcePath && fs.existsSync(templateSourcePath) && !fs.existsSync(templateDestPath)) {
      fs.copyFileSync(templateSourcePath, templateDestPath);
      console.log(`[Main] Copied theme template to: ${templateDestPath}`);
    }
    
    // Create README with instructions
    const readmePath = path.join(customThemesDir, 'README.txt');
    if (!fs.existsSync(readmePath)) {
      const readmeContent = `CalenRecall Custom Themes
==========================

This folder is where you can add your own custom themes for CalenRecall.

HOW TO CREATE A CUSTOM THEME:
----------------------------

1. Copy the file "theme-template.css" to create a new theme file.
2. Rename it to something descriptive, like "my-custom-theme.css"
3. Open the file in a text editor.
4. Replace "your-theme-name" throughout the file with your theme identifier (use lowercase, hyphens for spaces, e.g., "my-custom-theme").
5. Replace all the placeholder colors (e.g., #your-background-color) with your actual color values.
6. Save the file.
7. Restart CalenRecall - your theme will appear in the theme list!

IMPORTANT NOTES:
---------------

- Theme filenames must end in .css
- Theme identifiers (the "your-theme-name" part) must be lowercase and use hyphens, not spaces
- Do not use these names: "light", "dark", "auto", "template", or "example"
- Make sure to style all the component classes listed in the template to ensure your theme works correctly
- Test your theme thoroughly before sharing it with others

THEME STRUCTURE:
--------------

Each theme CSS file should target elements using:
  [data-theme="your-theme-name"] .component-class { ... }

Refer to the template file for all the component classes you need to style.

If you have questions or want to share your themes, visit the CalenRecall community!

Happy theming!
`;
      fs.writeFileSync(readmePath, readmeContent, 'utf-8');
      console.log(`[Main] Created README.txt in custom themes directory`);
    }
    
    return customThemesDir;
  } catch (error) {
    console.error('[Main] Error initializing custom themes folder:', error);
    return null;
  }
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
  'aero': { displayName: 'Aero' },
  'galactic-basic': { displayName: 'Galactic Basic' },
  'the-real-world': { displayName: 'The Real World' },
  'scholar': { displayName: 'Scholar' },
  'archive': { displayName: 'Archive' },
  'librarians-study': { displayName: 'Librarian\'s Study' },
  'research': { displayName: 'Research' },
  'manuscript-room': { displayName: 'Manuscript Room' },
  'reading-room': { displayName: 'Reading Room' },
  'temple-of-light': { displayName: 'Temple of Light' },
  'temple-of-darkness': { displayName: 'Temple of Darkness' },
  'kallisti': { displayName: 'Kallisti' },
  'tabletop': { displayName: 'Tabletop' },
  'football': { displayName: 'Football' },
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
  
  // Start with all built-in themes from metadata (since CSS files may be bundled)
  const discoveredThemes: ThemeInfo[] = [];
  const processedNames = new Set<string>(['light', 'dark', 'auto']); // Skip core themes
  
  // Add all themes from THEME_METADATA (these are the built-in themes we know about)
  for (const [themeName, metadata] of Object.entries(THEME_METADATA)) {
    if (!processedNames.has(themeName)) {
      processedNames.add(themeName);
      discoveredThemes.push({
        name: themeName,
        displayName: metadata.displayName,
      });
      console.log(`[Main] Added built-in theme from metadata: ${themeName} -> ${metadata.displayName}`);
    }
  }
  
  // Also try to discover themes from file system (for themes not in metadata)
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
    console.log(`[Main] Themes directory not found in filesystem (using metadata only). Tried paths:`, possiblePaths);
    // Don't return early - use metadata-based themes
  } else {
  
    try {
      // Read themes directory to find any additional themes not in metadata
      const files = fs.readdirSync(themesDir);
      console.log(`[Main] Found ${files.length} files in themes directory`);
      
      for (const file of files) {
        // Only process .css files
        if (!file.endsWith('.css')) {
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
          continue;
        }
        
        // Skip if already processed (from metadata)
        if (processedNames.has(themeName)) {
          continue;
        }
        
        processedNames.add(themeName);
        
        // Use metadata if available, otherwise format the name
        const displayName = THEME_METADATA[themeName]?.displayName || formatDisplayName(themeName + '.css');
        
        console.log(`[Main] Discovered additional theme from filesystem: ${themeName} -> ${displayName}`);
        discoveredThemes.push({
          name: themeName,
          displayName: displayName,
        });
      }
      
      console.log(`[Main] Total themes from filesystem: ${discoveredThemes.filter(t => !THEME_METADATA[t.name]).length}`);
    } catch (error) {
      console.error('[Main] Error discovering themes from filesystem:', error);
      if (error instanceof Error) {
        console.error('[Main] Error stack:', error.stack);
      }
    }
  }
  
  // Also check custom themes folder in AppData
  try {
    const userDataPath = app.getPath('userData');
    const customThemesDir = path.join(userDataPath, 'themes');
    
    if (fs.existsSync(customThemesDir)) {
      const customFiles = fs.readdirSync(customThemesDir);
      console.log(`[Main] Found ${customFiles.length} files in custom themes directory`);
      
      for (const file of customFiles) {
        // Only process .css files
        if (!file.endsWith('.css')) {
          continue;
        }
        
        // Extract theme name from filename
        const themeName = file.replace(/\.css$/, '');
        
        // Skip template/example files and core themes
        if (themeName.includes('template') || 
            themeName.includes('example') || 
            themeName === 'README' ||
            ['light', 'dark', 'auto'].includes(themeName)) {
          continue;
        }
        
        // Avoid duplicates (built-in themes take precedence)
        if (processedNames.has(themeName)) {
          console.log(`[Main] Skipping duplicate custom theme (built-in exists): ${themeName}`);
          continue;
        }
        processedNames.add(themeName);
        
        // Use metadata if available, otherwise format the name
        const displayName = THEME_METADATA[themeName]?.displayName || formatDisplayName(themeName + '.css');
        
        console.log(`[Main] Discovered custom theme: ${themeName} -> ${displayName}`);
        discoveredThemes.push({
          name: themeName,
          displayName: displayName,
        });
      }
    }
  } catch (error) {
    console.error('[Main] Error reading custom themes directory:', error);
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
  
  console.log(`[Main] Creating menu with ${themes.length} themes:`, themes.map(t => t.name));
  
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
          label: 'New Entry',
          accelerator: process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu-new-entry');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Import',
          submenu: [
            {
              label: 'Import from JSON...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-import', 'json');
                }
              },
            },
            {
              label: 'Import from Markdown...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-import', 'markdown');
                }
              },
            },
          ],
        },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as Markdown...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'markdown');
                }
              },
            },
            {
              label: 'Export as Text...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'text');
                }
              },
            },
            {
              label: 'Export as JSON...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'json');
                }
              },
            },
            {
              label: 'Export as RTF...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'rtf');
                }
              },
            },
            {
              label: 'Export as PDF...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'pdf');
                }
              },
            },
            {
              label: 'Export as CSV...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'csv');
                }
              },
            },
            {
              label: 'Export as Decades...',
              click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('menu-export', 'dec');
                }
              },
            },
          ],
        },
        { type: 'separator' },
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
      label: 'Sound',
      submenu: [
        {
          label: 'Enable Sound Effects',
          type: 'checkbox',
          checked: getAllPreferences().soundEffectsEnabled !== false,
          click: () => {
            const currentPrefs = getAllPreferences();
            const newValue = !(currentPrefs.soundEffectsEnabled !== false);
            setPreference('soundEffectsEnabled', newValue);
            // Notify the renderer process about the change
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('preference-updated', { key: 'soundEffectsEnabled', value: newValue });
            }
            // Update the menu to reflect the change
            updateMenu();
          },
        },
      ],
    },
    {
      label: 'Themes',
      submenu: themeMenuItems,
    },
    {
      label: 'Extra Links',
      submenu: [
        {
          label: 'Show AstroMonix.xyz Toolbar Button',
          type: 'checkbox',
          checked: getAllPreferences().showAstromonixToolbarButton === true,
          click: () => {
            const currentPrefs = getAllPreferences();
            const newValue = !(currentPrefs.showAstromonixToolbarButton === true);
            setPreference('showAstromonixToolbarButton', newValue);
            // Notify the renderer process about the change
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('preference-updated', { key: 'showAstromonixToolbarButton', value: newValue });
            }
            // Update the menu to reflect the change
            updateMenu();
          },
        },
      ],
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
        { type: 'separator' },
        {
          label: 'Open AppData Folder',
          click: async () => {
            const userDataPath = app.getPath('userData');
            try {
              await shell.openPath(userDataPath);
            } catch (error) {
              console.error('Failed to open AppData folder:', error);
            }
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
  
  // Initialize custom themes folder (creates folder and copies template if needed)
  initializeCustomThemesFolder();
  
  // Setup IPC handlers
  setupIpcHandlers();
  
  // Register menu update callback with IPC handlers
  setMenuUpdateCallback(() => {
    updateMenu();
  });
  
  // Create application menu (will be updated after window loads to include custom themes)
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
  
  // Handle menu update requests (called when preferences change or themes are added)
  ipcMain.handle('update-application-menu', () => {
    console.log('[Main] Menu update requested via IPC');
    updateMenu();
  });
  
  createWindow();
  
  // Update menu after a delay to ensure custom themes folder is fully initialized
  // This gives time for the folder to be created and any templates to be copied
  setTimeout(() => {
    console.log('[Main] Updating menu after initialization to include custom themes');
    updateMenu();
  }, 1000);

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

