import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { initDatabase, getAllPreferences, setPreference } from './database';
import { setupIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  // Load preferences for window size/position
  const prefs = getAllPreferences();
  
  mainWindow = new BrowserWindow({
    width: prefs.windowWidth || 1200,
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
}

function createPreferencesWindow() {
  if (preferencesWindow) {
    preferencesWindow.focus();
    return;
  }

  preferencesWindow = new BrowserWindow({
    width: 600,
    height: 700,
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

  if (isDev) {
    preferencesWindow.loadURL('http://localhost:5173/preferences.html');
  } else {
    preferencesWindow.loadFile(path.join(__dirname, '../dist/preferences.html'));
  }

  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  initDatabase();
  
  // Setup IPC handlers
  setupIpcHandlers();
  
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

