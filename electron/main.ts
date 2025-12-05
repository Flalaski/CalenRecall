import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { initDatabase, getAllPreferences, setPreference, closeDatabase } from './database';
import { setupIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
  // Content: 600px max-width + 40px padding each side = 680px width
  // Estimated height: ~440px based on content structure
  aboutWindow = new BrowserWindow({
    width: 680,
    height: 480,
    minWidth: 500,
    minHeight: 400,
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
            return { width: 680, height: 520 };
          }
          
          // Get the scroll height which gives natural content size
          const body = document.body;
          const html = document.documentElement;
          
          // Get the actual content height
          const containerHeight = Math.max(
            container.scrollHeight,
            container.offsetHeight,
            body.scrollHeight,
            body.offsetHeight,
            html.scrollHeight,
            html.offsetHeight
          );
          
          // Add extra padding to ensure nothing is cut off
          const contentRect = content.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate total height including all padding and margins
          // Get the bottom of the content element
          const contentBottom = contentRect.bottom;
          const containerTop = containerRect.top;
          
          // Calculate needed height: distance from container top to content bottom
          // plus container bottom padding (40px) plus extra margin for safety
          const totalHeight = Math.max(
            containerHeight,
            containerRect.height,
            contentBottom - containerTop + 40 + 30 // container padding + safety margin
          );
          
          // Width is fixed: 600px content + 80px container padding = 680px
          return {
            width: 680,
            height: Math.ceil(totalHeight)
          };
        })();
      `).then((size: { width: number; height: number }) => {
        if (aboutWindow && size) {
          // Clamp to reasonable bounds, but allow more height
          const width = 680;
          const height = Math.max(450, Math.min(700, size.height));
          
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
              mainX + Math.floor((mainWidth - 680) / 2),
              mainY + Math.floor((mainHeight - 480) / 2),
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

