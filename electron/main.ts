import { app, BrowserWindow, ipcMain, Menu, shell, screen, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { initDatabase, getAllPreferences, setPreference, closeDatabase, switchProfile, getCurrentProfile, Preferences } from './database';
import { setupIpcHandlers, setMainWindow, setProfileSelectorWindow, setPreferencesWindow, setMenuUpdateCallback, setImportProgressWindow, setCreateImportProgressWindowCallback } from './ipc-handlers';
import { getAutoLoadProfileId, setAutoLoadProfileId, getCurrentProfileId, getProfile } from './profile-manager';

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;
let profileSelectorWindow: BrowserWindow | null = null;
let importProgressWindow: BrowserWindow | null = null;
let startupLoadingWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Load environment variables from .env file (if it exists) - only in development
// This allows configuration without hardcoding values during development
if (isDev) {
  try {
    // Use require instead of import to allow conditional loading
    const dotenv = require('dotenv');
    dotenv.config();
    console.log('[Main] Loaded environment variables from .env file');
  } catch (error) {
    // dotenv is optional - only needed in development
    console.log('[Main] dotenv not available (this is normal in production builds)');
  }
}

/**
 * Get optimized webPreferences for GPU-accelerated rendering
 * These settings maximize hardware acceleration efficiency:
 * - enableWebGPU: Enables WebGPU API for modern GPU compute (Electron 28+)
 * - experimentalFeatures: Enables experimental Chrome features that may improve performance
 * - backgroundThrottling: Disabled to prevent throttling during animations
 * - offscreen: false (default) - on-screen rendering for better performance
 * - Additional optimizations for smooth animations and transforms
 */
function getOptimizedWebPreferences(preloadPath?: string): Electron.WebPreferences {
  const basePreferences: Electron.WebPreferences = {
    nodeIntegration: false,
    contextIsolation: true,
    backgroundThrottling: false, // Prevent throttling during animations/transforms
    // GPU acceleration optimizations
    // Hardware acceleration is enabled by default when app.disableHardwareAcceleration() is not called
    // WebGL is enabled by default in Electron
    // offscreen: false is the default (on-screen rendering for better performance)
    // Note: enableWebGPU requires Electron 28+ and may not be available in all versions
    // We check for availability before setting experimental features
  };

  // Add preload if provided
  if (preloadPath) {
    basePreferences.preload = preloadPath;
  }

  // Enable WebGPU if available (Electron 28+)
  // WebGPU provides better GPU utilization than WebGL for modern applications
  try {
    // Check if we're on a version that supports enableWebGPU
    const electronVersion = process.versions.electron;
    const majorVersion = parseInt(electronVersion.split('.')[0], 10);
    if (majorVersion >= 28) {
      // enableWebGPU is available in Electron 28+
      (basePreferences as any).enableWebGPU = true;
      console.log('[Main] WebGPU enabled for better GPU utilization');
    }
  } catch (error) {
    // Silently fail if version check fails
    console.log('[Main] Could not enable WebGPU (may not be available in this Electron version)');
  }

  return basePreferences;
}

/**
 * Read hardware acceleration preference from database before app.whenReady()
 * This is necessary because hardware acceleration must be set before the app is ready.
 * Returns true (enabled) by default if the preference cannot be read.
 */
function readHardwareAccelerationPreference(): boolean {
  try {
    const userDataPath = app.getPath('userData');
    const profilesPath = path.join(userDataPath, 'profiles.json');
    
    // Check if profiles.json exists
    if (!fs.existsSync(profilesPath)) {
      console.log('[Main] Profiles file not found, defaulting hardware acceleration to enabled');
      return true;
    }
    
    // Read profiles.json to get current profile
    const profilesData = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    const currentProfileId = profilesData.currentProfileId || profilesData.profiles?.[0]?.id;
    
    if (!currentProfileId) {
      console.log('[Main] No current profile found, defaulting hardware acceleration to enabled');
      return true;
    }
    
    // Find the profile
    const profile = profilesData.profiles?.find((p: any) => p.id === currentProfileId);
    if (!profile || !profile.databasePath) {
      console.log('[Main] Profile database path not found, defaulting hardware acceleration to enabled');
      return true;
    }
    
    // Resolve database path (may be relative to userData)
    const databasePath = path.isAbsolute(profile.databasePath) 
      ? profile.databasePath 
      : path.join(userDataPath, profile.databasePath);
    
    if (!fs.existsSync(databasePath)) {
      console.log('[Main] Database file not found, defaulting hardware acceleration to enabled');
      return true;
    }
    
    // Open database and read preference
    const db = new Database(databasePath, { readonly: true });
    try {
      const stmt = db.prepare('SELECT value FROM preferences WHERE key = ?');
      const row = stmt.get('hardwareAcceleration') as { value: string } | undefined;
      
      if (row) {
        const value = JSON.parse(row.value);
        console.log(`[Main] Read hardware acceleration preference: ${value}`);
        return value === true;
      } else {
        console.log('[Main] Hardware acceleration preference not found in database, defaulting to enabled');
        return true;
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('[Main] Error reading hardware acceleration preference, defaulting to enabled:', error);
    return true;
  }
}

// Read hardware acceleration preference and apply it
// This must be done BEFORE app.whenReady()
const hardwareAccelerationEnabled = readHardwareAccelerationPreference();

if (!hardwareAccelerationEnabled) {
  // Disable hardware acceleration to fix flickering issues on AMD GPUs
  // Known issue: Electron apps can experience visual flickering/glitches when
  // maximizing or entering fullscreen on systems with AMD GPUs due to hardware
  // acceleration conflicts. Disabling it resolves the issue at the cost of
  // slightly reduced rendering performance (usually negligible for this app).
  app.disableHardwareAcceleration();
  console.log('[Main] Hardware acceleration disabled (per user preference or default)');
} else {
  console.log('[Main] Hardware acceleration enabled (per user preference)');
}

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

function createStartupLoadingWindow() {
  if (startupLoadingWindow) {
    return startupLoadingWindow;
  }

  console.log('[Main] Creating startup loading window...');

  // Calculate window position (center of screen)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const windowWidth = 216;
  const windowHeight = 369;
  const x = Math.floor((screenWidth - windowWidth) / 2);
  const y = Math.floor((screenHeight - windowHeight) / 2);
  
  console.log('[Main] Startup loading window position:', { x, y, screenWidth, screenHeight, windowWidth, windowHeight });

  startupLoadingWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false, // Frameless for a cleaner look
    transparent: true, // Allow transparency
    backgroundColor: '#1a1a2e', // Set background color for transparent windows (matches HTML gradient start)
    alwaysOnTop: true,
    skipTaskbar: true, // Don't show in taskbar
    title: 'CalenRecall - Starting...',
    webPreferences: getOptimizedWebPreferences(),
    ...(process.platform === 'win32' && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
    show: true, // Show immediately
    center: true, // Center the window on screen
  });
  
  // Window is already set to show: true, so it should appear immediately
  // Just ensure it's on top and focused
  if (startupLoadingWindow && !startupLoadingWindow.isDestroyed()) {
    startupLoadingWindow.focus();
    startupLoadingWindow.moveTop();
  }

  let loadingHtmlPath = isDev 
    ? path.join(__dirname, '../../startup-loading.html')
    : path.join(__dirname, '../dist/startup-loading.html');
  
  console.log('[Main] Loading startup loading HTML from:', loadingHtmlPath);
  console.log('[Main] File exists:', fs.existsSync(loadingHtmlPath));
  
  // Verify file exists before loading
  if (!fs.existsSync(loadingHtmlPath)) {
    console.error('[Main] Startup loading HTML file not found at:', loadingHtmlPath);
    // Try alternative paths
    const altPaths = [
      path.join(process.cwd(), 'startup-loading.html'),
      path.join(app.getAppPath(), 'startup-loading.html'),
      path.join(__dirname, '../../dist/startup-loading.html'),
    ];
    
    let foundPath = null;
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        foundPath = altPath;
        console.log('[Main] Found startup loading HTML at alternative path:', foundPath);
        break;
      }
    }
    
    if (!foundPath) {
      console.error('[Main] Could not find startup loading HTML file anywhere');
      // Show fallback content immediately
      if (startupLoadingWindow && !startupLoadingWindow.isDestroyed()) {
        startupLoadingWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; font-family: sans-serif; font-size: 18px; gap: 20px;"><div style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.1); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div><div>Starting...</div></div>';
          const style = document.createElement('style');
          style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
          document.head.appendChild(style);
        `);
      }
      return startupLoadingWindow;
    }
    
    loadingHtmlPath = foundPath;
  }
  
  startupLoadingWindow.loadFile(loadingHtmlPath).catch((error) => {
    console.error('[Main] Error loading startup loading HTML:', error);
    // Try to show a basic message even if HTML fails to load
    if (startupLoadingWindow && !startupLoadingWindow.isDestroyed()) {
      startupLoadingWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a2e; color: white; font-family: sans-serif; font-size: 18px;">CalenRecall - Starting...</div>';
      `);
    }
  });

  startupLoadingWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] Startup loading window failed to load:', errorCode, errorDescription, validatedURL);
    // Show fallback content if HTML fails to load
    if (startupLoadingWindow && !startupLoadingWindow.isDestroyed()) {
      startupLoadingWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; font-family: sans-serif; font-size: 18px; gap: 20px;"><div style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.1); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div><div>Starting...</div></div>';
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      `).then(() => {
        if (startupLoadingWindow && !startupLoadingWindow.isDestroyed()) {
          startupLoadingWindow.center();
          startupLoadingWindow.show();
          startupLoadingWindow.focus();
          startupLoadingWindow.moveTop();
        }
      });
    }
  });

  startupLoadingWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Startup loading HTML finished loading successfully');
    // Window is already shown, no need to show again
  });

  // Note: ready-to-show handler is already set above to show the window immediately

  startupLoadingWindow.on('closed', () => {
    startupLoadingWindow = null;
  });

  return startupLoadingWindow;
}

function closeStartupLoadingWindow() {
  if (startupLoadingWindow && !startupLoadingWindow.isDestroyed()) {
    startupLoadingWindow.close();
    startupLoadingWindow = null;
    console.log('[Main] Startup loading window closed');
  }
}

function createProfileSelectorWindow() {
  if (profileSelectorWindow) {
    profileSelectorWindow.focus();
    return;
  }

  console.log('[Main] Creating profile selector window...');

  // Golden ratio: width / height = 1.618
  // Width is twice the original (900 * 2 = 1800)
  // Height = width / 1.618 = 1800 / 1.618 ≈ 1112
  const defaultWidth = 1800;
  const defaultHeight = Math.round(defaultWidth / 1.618); // 1112
  
  profileSelectorWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth: 600,
    minHeight: 500,
    resizable: true,
    alwaysOnTop: true, // Show on top when first loads
    title: 'CalenRecall - Select Profile',
    webPreferences: getOptimizedWebPreferences(path.join(__dirname, 'preload.js')),
    ...(process.platform === 'win32' && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
    show: false, // Don't show until ready and sized
  });
  
  // Register the profile selector window with IPC handlers so it can receive preference updates
  setProfileSelectorWindow(profileSelectorWindow);

  // Wait a bit to ensure IPC handlers are fully registered
  setTimeout(() => {
    if (profileSelectorWindow && !profileSelectorWindow.isDestroyed()) {
      if (isDev) {
        profileSelectorWindow.loadURL('http://localhost:5173/profile-selector.html');
      } else {
        profileSelectorWindow.loadFile(path.join(__dirname, '../dist/profile-selector.html'));
      }

      // Auto-size window to fit content after page loads
      profileSelectorWindow.webContents.once('did-finish-load', () => {
        if (!profileSelectorWindow) return;
        
        // Wait for layout to settle, then measure and resize
        setTimeout(() => {
          if (!profileSelectorWindow) return;
          
          profileSelectorWindow.webContents.executeJavaScript(`
            (function() {
              const container = document.querySelector('.profile-selector-container');
              const body = document.body;
              const html = document.documentElement;
              
              if (!container) {
                // Golden ratio: width / height = 1.618
                const defaultWidth = 1800;
                const defaultHeight = Math.round(defaultWidth / 1.618); // 1112
                return { width: defaultWidth, height: defaultHeight };
              }
              
              // Get the actual content dimensions
              // Default width is 1800px (twice the original 900px)
              const defaultWidth = 1800;
              const contentWidth = container.offsetWidth || container.scrollWidth || defaultWidth;
              const optimalWidth = Math.max(defaultWidth, Math.ceil(contentWidth + 40));
              
              // Get content height - use scrollHeight to include all content
              const contentHeight = Math.max(
                container.scrollHeight || 0,
                container.offsetHeight || 0,
                body.scrollHeight || 0,
                body.offsetHeight || 0,
                html.scrollHeight || 0,
                html.offsetHeight || 0
              );
              
              // Calculate optimal height using golden ratio: height = width / 1.618
              const goldenRatio = 1.618;
              const goldenRatioHeight = Math.round(optimalWidth / goldenRatio);
              
              // Ensure minimum height for readability, but prefer golden ratio
              const screenHeight = window.screen.availHeight;
              const maxViewportHeight = Math.floor(screenHeight * 0.85);
              
              // Use golden ratio height, but ensure it fits content and screen
              const optimalHeight = Math.min(
                Math.max(goldenRatioHeight, Math.ceil(contentHeight + 100)), // Golden ratio or content + padding, whichever is larger
                maxViewportHeight // But cap at screen size
              );
              
              return {
                width: optimalWidth,
                height: optimalHeight
              };
            })();
          `).then((size: { width: number; height: number }) => {
            if (profileSelectorWindow && size) {
              // Use golden ratio if size is provided, otherwise use defaults
              const defaultWidth = 1800;
              const defaultHeight = Math.round(defaultWidth / 1.618); // 1112
              const width = size.width || defaultWidth;
              // Maintain golden ratio: height = width / 1.618
              const height = size.height || Math.round(width / 1.618);
              
              profileSelectorWindow.setSize(width, height, false);
              
              // Position in upper center of screen
              const primaryDisplay = screen.getPrimaryDisplay();
              const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
              
              // Calculate position: center horizontally, upper portion vertically
              // Position at 15% from top of screen (upper center)
              const x = Math.floor((screenWidth - width) / 2);
              const y = Math.floor(screenHeight * 0.15);
              
              profileSelectorWindow.setPosition(x, y, false);
              profileSelectorWindow.show();
              profileSelectorWindow.focus(); // Bring to front
              // Disable always-on-top after initial display so window can be moved behind others
              profileSelectorWindow.setAlwaysOnTop(false);
              console.log('[Main] Profile selector window shown and positioned');
              
              // Close startup loading window now that profile selector is ready
              closeStartupLoadingWindow();
            }
          }).catch((error) => {
            console.error('Error auto-sizing Profile Selector window:', error);
            // Show with default size and position if measurement fails
            if (profileSelectorWindow) {
              const primaryDisplay = screen.getPrimaryDisplay();
              const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
              
              // Golden ratio: width / height = 1.618
              const width = 1800;
              const height = Math.round(width / 1.618); // 1112
              const x = Math.floor((screenWidth - width) / 2);
              const y = Math.floor(screenHeight * 0.15);
              
              profileSelectorWindow.setSize(width, height, false);
              profileSelectorWindow.setPosition(x, y, false);
              profileSelectorWindow.show();
              profileSelectorWindow.focus(); // Bring to front
              // Disable always-on-top after initial display so window can be moved behind others
              profileSelectorWindow.setAlwaysOnTop(false);
              
              // Close startup loading window now that profile selector is ready
              closeStartupLoadingWindow();
            }
          });
        }, 300); // Wait for styles to fully apply
      });
    }
  }, 100);

  profileSelectorWindow.on('closed', () => {
    setProfileSelectorWindow(null);
    profileSelectorWindow = null;
  });

  // Listen for profile selection to open main window
  ipcMain.once('profile-selected', () => {
    if (profileSelectorWindow) {
      profileSelectorWindow.close();
    }
    createWindow();
  });
}

function createWindow() {
  // Load preferences for window size/position
  // Note: Database must be initialized before calling getAllPreferences
  const prefs = getAllPreferences();
  
  // Golden ratio: width / height = 1.618
  // Keep the width from preferences or use default, then calculate height
  const defaultWidth = 2400;
  const width = prefs.windowWidth || defaultWidth;
  // If there's a saved height preference, use it; otherwise calculate golden ratio height
  const goldenRatioHeight = Math.round(width / 1.618);
  const height = prefs.windowHeight || goldenRatioHeight;
  
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: prefs.windowX,
    y: prefs.windowY,
    minWidth: 800,
    minHeight: 600,
    webPreferences: getOptimizedWebPreferences(path.join(__dirname, 'preload.js')),
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
        webPreferences: getOptimizedWebPreferences(),
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

  // Apply fullscreen preference if set
  if (prefs.fullScreen === true) {
    console.log('[Main] Applying fullscreen preference');
    mainWindow.setFullScreen(true);
  }

  // Apply preferences when window is fully loaded (especially important for built versions)
  mainWindow.webContents.once('did-finish-load', () => {
    // Send a message to the renderer to ensure preferences are applied
    // This handles cases where preferences weren't applied during initial load
    const currentPrefs = getAllPreferences();
    console.log('[Main] Window finished loading, ensuring preferences are applied:', {
      fontSize: currentPrefs.fontSize,
      minimapSize: currentPrefs.minimapSize,
      theme: currentPrefs.theme,
      fullScreen: currentPrefs.fullScreen
    });
    
    // Update menu to reflect theme from current profile's database
    updateMenu();
    
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

  // Save fullscreen state when it changes
  mainWindow.on('enter-full-screen', () => {
    console.log('[Main] Window entered fullscreen');
    setPreference('fullScreen', true);
  });

  mainWindow.on('leave-full-screen', () => {
    console.log('[Main] Window left fullscreen');
    setPreference('fullScreen', false);
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
  
  // Get current profile and auto-load status
  const currentProfile = getCurrentProfile();
  const autoLoadProfileId = getAutoLoadProfileId();
  const isAutoLoadEnabled = !!(currentProfile && autoLoadProfileId === currentProfile.id);
  
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
      // Also notify the profile selector window if it exists
      if (profileSelectorWindow && !profileSelectorWindow.isDestroyed()) {
        console.log('[Main] 📤 Sending theme update to profile selector window from menu:', theme.name);
        profileSelectorWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
        // Send fallback messages to ensure it's received
        setTimeout(() => {
          if (profileSelectorWindow && !profileSelectorWindow.isDestroyed()) {
            profileSelectorWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
          }
        }, 50);
        setTimeout(() => {
          if (profileSelectorWindow && !profileSelectorWindow.isDestroyed()) {
            profileSelectorWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
          }
        }, 100);
      }
      // Also notify the preferences window if it exists
      if (preferencesWindow && !preferencesWindow.isDestroyed()) {
        console.log('[Main] 📤 Sending theme update to preferences window from menu:', theme.name);
        preferencesWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
        // Send fallback messages to ensure it's received
        setTimeout(() => {
          if (preferencesWindow && !preferencesWindow.isDestroyed()) {
            preferencesWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
          }
        }, 50);
        setTimeout(() => {
          if (preferencesWindow && !preferencesWindow.isDestroyed()) {
            preferencesWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
          }
        }, 100);
        setTimeout(() => {
          if (preferencesWindow && !preferencesWindow.isDestroyed()) {
            preferencesWindow.webContents.send('preference-updated', { key: 'theme', value: theme.name });
          }
        }, 200);
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
          label: 'Manage Profiles...',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+P' : 'Ctrl+Shift+P',
          click: () => {
            createProfileSelectorWindow();
          },
        },
        {
          label: 'Auto-load This Profile on Startup',
          type: 'checkbox',
          checked: isAutoLoadEnabled,
          enabled: currentProfile !== null,
          click: async () => {
            try {
              const profile = getCurrentProfile();
              if (!profile) {
                console.warn('[Main] No current profile to set auto-load');
                return;
              }
              
              const currentAutoLoadId = getAutoLoadProfileId();
              const newAutoLoadId = currentAutoLoadId === profile.id ? null : profile.id;
              
              console.log(`[Main] Toggling auto-load: ${currentAutoLoadId} -> ${newAutoLoadId}`);
              setAutoLoadProfileId(newAutoLoadId);
              
              // Notify preferences window if it's open
              if (preferencesWindow && !preferencesWindow.isDestroyed()) {
                const updatedAutoLoadId = getAutoLoadProfileId();
                const isAutoLoad = updatedAutoLoadId === profile.id;
                preferencesWindow.webContents.send('auto-load-profile-updated', { 
                  enabled: isAutoLoad,
                  profileId: profile.id 
                });
              }
              
              // Update the menu to reflect the change
              updateMenu();
            } catch (error) {
              console.error('[Main] Error toggling auto-load profile:', error);
            }
          },
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
        { type: 'separator' },
        {
          label: 'Hardware Acceleration',
          type: 'checkbox',
          checked: getAllPreferences().hardwareAcceleration === true,
          click: () => {
            const currentPrefs = getAllPreferences();
            const newValue = !(currentPrefs.hardwareAcceleration === true);
            setPreference('hardwareAcceleration', newValue);
            console.log(`[Main] Hardware acceleration preference set to: ${newValue}`);
            
            // Show dialog to inform user that restart is required
            const dialogOptions = {
              type: 'info' as const,
              title: 'Restart Required',
              message: 'Hardware acceleration setting changed',
              detail: `Hardware acceleration has been ${newValue ? 'enabled' : 'disabled'}. The application will restart now for the change to take effect.`,
              buttons: ['OK'],
            };
            
            if (mainWindow && !mainWindow.isDestroyed()) {
              dialog.showMessageBox(mainWindow, dialogOptions).then(() => {
                // Restart the application
                app.relaunch();
                app.exit(0);
              });
            } else {
              // If no main window, show dialog without parent
              dialog.showMessageBox(dialogOptions).then(() => {
                // Restart the application
                app.relaunch();
                app.exit(0);
              });
            }
          },
        },
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
    width: 1440,
    height: 1000,
    minWidth: 800,
    minHeight: 600,
    parent: mainWindow || undefined,
    modal: true,
    resizable: true,
    title: 'Preferences - CalenRecall',
    webPreferences: getOptimizedWebPreferences(path.join(__dirname, 'preload.js')),
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
        webPreferences: getOptimizedWebPreferences(),
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

  // Register the preferences window with IPC handlers so it can receive preference updates
  setPreferencesWindow(preferencesWindow);

  preferencesWindow.on('closed', () => {
    setPreferencesWindow(null);
    preferencesWindow = null;
  });

  // Ensure window is properly destroyed on close
  preferencesWindow.on('close', (event) => {
    // Allow normal close behavior
    setPreferencesWindow(null);
    preferencesWindow = null;
  });
}

function createImportProgressWindow() {
  // If window already exists, just focus it
  if (importProgressWindow && !importProgressWindow.isDestroyed()) {
    importProgressWindow.focus();
    return importProgressWindow;
  }

  // Calculate window position (center of screen)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const windowWidth = 700;
  const windowHeight = 400;
  const x = Math.floor((screenWidth - windowWidth) / 2);
  const y = Math.floor((screenHeight - windowHeight) / 2);

  importProgressWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: 'Import Progress - CalenRecall',
    webPreferences: getOptimizedWebPreferences(path.join(__dirname, 'preload.js')),
    ...(process.platform === 'win32' && {
      icon: path.join(__dirname, '../assets/icon.png'),
    }),
  });

  // Register with IPC handlers so it can receive progress updates
  setImportProgressWindow(importProgressWindow);

  if (isDev) {
    importProgressWindow.loadURL('http://localhost:5173/import-progress.html');
  } else {
    importProgressWindow.loadFile(path.join(__dirname, '../dist/import-progress.html'));
  }

  importProgressWindow.on('closed', () => {
    importProgressWindow = null;
    setImportProgressWindow(null);
  });

  // Prevent closing during active import (user can still force close)
  importProgressWindow.on('close', (event) => {
    // Allow normal close - we'll handle cleanup in the import handler
    // The window will auto-close when import completes
  });

  return importProgressWindow;
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
    webPreferences: getOptimizedWebPreferences(path.join(__dirname, 'preload.js')),
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
        webPreferences: getOptimizedWebPreferences(),
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
  // Show startup loading window IMMEDIATELY - before any other initialization
  // This ensures the user sees the loading screen right away
  // Create synchronously so it appears immediately
  createStartupLoadingWindow();
  console.log('[Main] Startup loading window created');
  
  // Now do initialization in the background (window is already visible)
  // Initialize database (this will handle migration to profiles if needed)
  // The initDatabase function will automatically migrate existing users
  // Note: We initialize with no profile ID first, which will use the current/default profile
  initDatabase();
  
  // Initialize custom themes folder (creates folder and copies template if needed)
  initializeCustomThemesFolder();
  
  // Setup IPC handlers - MUST be called before creating any windows
  console.log('[Main] About to setup IPC handlers...');
  try {
    setupIpcHandlers();
  
  // Register callback to create import progress window
  setCreateImportProgressWindowCallback(() => createImportProgressWindow());
    console.log('[Main] ✅ IPC handlers setup completed successfully');
    
    // Verify critical handlers are registered
    const handlers = (ipcMain as any).listeners?.('get-all-profiles') || [];
    console.log('[Main] Verified get-all-profiles handler registered:', handlers.length > 0);
    
    // Verify critical password recovery handlers
    console.log('[Main] Verifying critical password recovery handlers...');
    // Note: We can't directly check if handlers exist, but the setupIpcHandlers function
    // should have logged their registration. If those logs don't appear, registration failed.
  } catch (error) {
    console.error('[Main] ❌ Error setting up IPC handlers:', error);
    console.error('[Main] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
  
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

  // Handle profile selection - open main window
  ipcMain.handle('open-main-window', () => {
    if (profileSelectorWindow) {
      profileSelectorWindow.close();
    }
    // Close existing main window if it exists to prevent multiple windows
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Main] Closing existing main window before opening new profile');
      mainWindow.close();
      mainWindow = null;
    }
    createWindow();
    // Update menu to reflect theme from new profile's database
    updateMenu();
    return { success: true };
  });
  
  // Check for auto-load profile and load it, otherwise show profile selector
  const autoLoadProfileId = getAutoLoadProfileId();
  console.log(`[Main] Checking for auto-load profile...`);
  console.log(`[Main] Auto-load profile ID: ${autoLoadProfileId || 'none'}`);
  
  if (autoLoadProfileId) {
    console.log(`[Main] ✅ Auto-load profile found: ${autoLoadProfileId}`);
    try {
      // Switch to the auto-load profile
      console.log(`[Main] Switching to auto-load profile: ${autoLoadProfileId}`);
      switchProfile(autoLoadProfileId);
      console.log(`[Main] Successfully switched to profile: ${autoLoadProfileId}`);
      // Open main window directly
      createWindow();
      // Update menu to reflect theme from auto-loaded profile's database
      updateMenu();
      console.log(`[Main] ✅ Auto-load complete - main window opened`);
      
      // Close startup loading window now that main window is ready
      closeStartupLoadingWindow();
    } catch (error) {
      console.error('[Main] ❌ Error auto-loading profile:', error);
      // Fall back to showing profile selector if auto-load fails
      createProfileSelectorWindow();
    }
  } else {
    console.log(`[Main] No auto-load profile set - showing profile selector`);
    // Show profile selector window if no auto-load profile is set
    createProfileSelectorWindow();
  }
  
  // Update menu after a delay to ensure custom themes folder is fully initialized
  // This gives time for the folder to be created and any templates to be copied
  setTimeout(() => {
    console.log('[Main] Updating menu after initialization to include custom themes');
    updateMenu();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // If no windows, show profile selector first
      createProfileSelectorWindow();
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

