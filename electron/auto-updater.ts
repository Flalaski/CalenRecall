import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';

const UPDATE_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours

function sendToAllWindows(channel: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send(channel, ...args);
    }
  });
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function resolveFeedUrl(): string | null {
  const explicitUrl = process.env.CALENRECALL_UPDATE_URL || process.env.UPDATE_BASE_URL;
  if (explicitUrl) {
    return normalizeUrl(explicitUrl);
  }

  const owner = process.env.GITHUB_OWNER || process.env.GH_OWNER;
  const repo = process.env.GITHUB_REPO || process.env.GH_REPO;

  if (owner && repo) {
    return `https://github.com/${owner}/${repo}/releases/latest/download/`;
  }

  return null;
}

export function initAutoUpdater(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) {
    console.log('[Update] Skipping auto-update in development');
    return;
  }

  const feedUrl = resolveFeedUrl();
  if (!feedUrl) {
    console.log('[Update] Auto-update disabled: no feed URL configured');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (error: Error) => {
    console.error('[Update] Error:', error);
    sendToAllWindows('update-error', error.message);
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[Update] Checking for updates...');
    sendToAllWindows('update-checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log(`[Update] Update available: ${info.version}`);
    sendToAllWindows('update-available', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Update] No updates available');
    sendToAllWindows('update-not-available');
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    const percent = typeof progress.percent === 'number' ? progress.percent.toFixed(1) : '0';
    console.log(`[Update] Downloading: ${percent}% (${progress.transferred}/${progress.total} bytes)`);
    sendToAllWindows('update-download-progress', progress.percent);
  });

  autoUpdater.on('update-downloaded', async (info: UpdateDownloadedEvent) => {
    sendToAllWindows('update-downloaded', info.version);
    
    const hostWindow = getWindow();
    const result = hostWindow
      ? await dialog.showMessageBox(hostWindow, {
          type: 'info',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update ready',
          message: `CalenRecall ${info.version} is ready to install.`,
          detail: 'Restart now to apply the update, or choose Later to keep working.',
        })
      : await dialog.showMessageBox({
          type: 'info',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update ready',
          message: `CalenRecall ${info.version} is ready to install.`,
          detail: 'Restart now to apply the update, or choose Later to keep working.',
        });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
      channel: 'latest',
    });
  } catch (error) {
    console.error('[Update] Failed to configure feed URL:', error);
    return;
  }

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error: Error) => {
      console.error('[Update] Check failed:', error);
    });
  };

  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_INTERVAL_MS);
}

export function manualCheckForUpdates(): void {
  if (!app.isPackaged) {
    console.log('[Update] Manual check skipped in development');
    return;
  }
  
  autoUpdater.checkForUpdates().catch((error: Error) => {
    console.error('[Update] Manual check failed:', error);
  });
}
