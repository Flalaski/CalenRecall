import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import {
  getEntries,
  getEntry,
  getEntriesByDateAndRange,
  saveEntry,
  deleteEntry,
  deleteEntryByDateAndRange,
  searchEntries,
  getEntriesByRange,
  getAllEntries,
  getPreference,
  setPreference,
  getAllPreferences,
  resetPreferences,
  Preferences,
  parseISODate,
  getDatabasePath,
  getEntryVersions,
  archiveEntry,
  unarchiveEntry,
  getArchivedEntries,
  pinEntry,
  unpinEntry,
  getPinnedEntries,
} from './database';
import { EntryVersion } from './types';
import { JournalEntry, TimeRange, ExportFormat, EntryAttachment } from './types';
import { EntryTemplate, getAllTemplates, getTemplate, saveTemplate, deleteTemplate } from './database';

let mainWindowRef: Electron.BrowserWindow | null = null;

export function setMainWindow(window: Electron.BrowserWindow | null) {
  mainWindowRef = window;
}

export function setupIpcHandlers() {
  ipcMain.handle('get-entries', async (_event, startDate: string, endDate: string) => {
    return getEntries(startDate, endDate);
  });

  ipcMain.handle('get-all-entries', async () => {
    return getAllEntries();
  });

  ipcMain.handle('get-entry', async (_event, date: string, timeRange: TimeRange) => {
    return getEntry(date, timeRange);
  });

  ipcMain.handle('get-entry-by-id', async (_event, id: number) => {
    const { getEntryById } = require('./database');
    return getEntryById(id);
  });

  ipcMain.handle('get-entry-versions', async (_event, entryId: number) => {
    return getEntryVersions(entryId);
  });

  ipcMain.handle('archive-entry', async (_event, id: number) => {
    archiveEntry(id);
    return { success: true };
  });

  ipcMain.handle('unarchive-entry', async (_event, id: number) => {
    unarchiveEntry(id);
    return { success: true };
  });

  ipcMain.handle('get-archived-entries', async () => {
    return getArchivedEntries();
  });

  ipcMain.handle('pin-entry', async (_event, id: number) => {
    pinEntry(id);
    return { success: true };
  });

  ipcMain.handle('unpin-entry', async (_event, id: number) => {
    unpinEntry(id);
    return { success: true };
  });

  ipcMain.handle('get-pinned-entries', async () => {
    return getPinnedEntries();
  });

  ipcMain.handle('get-all-templates', async () => {
    return getAllTemplates();
  });

  ipcMain.handle('get-template', async (_event, id: number) => {
    return getTemplate(id);
  });

  ipcMain.handle('save-template', async (_event, template: EntryTemplate) => {
    saveTemplate(template);
    return { success: true };
  });

  ipcMain.handle('delete-template', async (_event, id: number) => {
    deleteTemplate(id);
    return { success: true };
  });

  /**
   * Add an attachment to an entry.
   * Copies the file to the attachments directory and updates the entry.
   */
  ipcMain.handle('add-entry-attachment', async (_event, entryId: number) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select File to Attach',
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
      ],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const sourcePath = filePaths[0];
    const { getEntryById, saveEntry } = require('./database');
    const entry = getEntryById(entryId);

    if (!entry) {
      return { success: false, error: 'entry_not_found', message: 'Entry not found' };
    }

    try {
      // Create attachments directory in user data
      const userDataPath = app.getPath('userData');
      const attachmentsDir = path.join(userDataPath, 'attachments');
      if (!fs.existsSync(attachmentsDir)) {
        fs.mkdirSync(attachmentsDir, { recursive: true });
      }

      // Generate unique filename
      const fileExt = path.extname(sourcePath);
      const fileName = path.basename(sourcePath);
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const destFileName = `${entryId}-${uniqueId}${fileExt}`;
      const destPath = path.join(attachmentsDir, destFileName);

      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      const stats = fs.statSync(destPath);

      // Get MIME type
      const mimeType = getMimeType(fileExt);

      // Create attachment metadata
      const attachment: EntryAttachment = {
        id: uniqueId,
        fileName: fileName,
        filePath: destPath,
        fileSize: stats.size,
        mimeType: mimeType,
        createdAt: new Date().toISOString(),
      };

      // Add to entry
      const attachments = entry.attachments || [];
      attachments.push(attachment);
      entry.attachments = attachments;
      saveEntry(entry);

      return { success: true, attachment };
    } catch (error: any) {
      console.error('Error adding attachment:', error);
      return {
        success: false,
        error: 'add_failed',
        message: error.message || 'Failed to add attachment',
      };
    }
  });

  /**
   * Remove an attachment from an entry.
   */
  ipcMain.handle('remove-entry-attachment', async (_event, entryId: number, attachmentId: string) => {
    const { getEntryById, saveEntry } = require('./database');
    const entry = getEntryById(entryId);

    if (!entry) {
      return { success: false, error: 'entry_not_found', message: 'Entry not found' };
    }

    try {
      const attachments = entry.attachments || [];
      const attachment = attachments.find((a: EntryAttachment) => a.id === attachmentId);

      if (!attachment) {
        return { success: false, error: 'attachment_not_found', message: 'Attachment not found' };
      }

      // Delete file
      if (fs.existsSync(attachment.filePath)) {
        fs.unlinkSync(attachment.filePath);
      }

      // Remove from entry
      entry.attachments = attachments.filter((a: EntryAttachment) => a.id !== attachmentId);
      saveEntry(entry);

      return { success: true };
    } catch (error: any) {
      console.error('Error removing attachment:', error);
      return {
        success: false,
        error: 'remove_failed',
        message: error.message || 'Failed to remove attachment',
      };
    }
  });

  /**
   * Get attachment file path for opening.
   */
  ipcMain.handle('get-attachment-path', async (_event, entryId: number, attachmentId: string) => {
    const { getEntryById } = require('./database');
    const entry = getEntryById(entryId);

    if (!entry || !entry.attachments) {
      return { success: false, error: 'not_found' };
    }

    const attachment = entry.attachments.find((a: EntryAttachment) => a.id === attachmentId);
    if (!attachment || !fs.existsSync(attachment.filePath)) {
      return { success: false, error: 'not_found' };
    }

    return { success: true, path: attachment.filePath };
  });

  ipcMain.handle('get-entries-by-date-range', async (_event, date: string, timeRange: TimeRange) => {
    return getEntriesByDateAndRange(date, timeRange);
  });

  ipcMain.handle('save-entry', async (_event, entry: JournalEntry) => {
    try {
      console.log('IPC save-entry handler called');
      saveEntry(entry);
      console.log('IPC save-entry completed');
      return { success: true };
    } catch (error) {
      console.error('IPC save-entry error:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-entry', async (_event, id: number) => {
    deleteEntry(id);
  });

  ipcMain.handle('delete-entry-by-date-range', async (_event, date: string, timeRange: TimeRange) => {
    deleteEntryByDateAndRange(date, timeRange);
  });

  ipcMain.handle('search-entries', async (_event, query: string) => {
    return searchEntries(query);
  });

  ipcMain.handle('get-entries-by-range', async (_event, range: TimeRange, value: number) => {
    return getEntriesByRange(range, value);
  });

  /**
   * Export all journal entries to a user-selected document file.
   * The renderer passes an export format; this handler opens a save dialog,
   * formats the content, and writes it to disk.
   */
  ipcMain.handle('export-entries', async (_event, format: ExportFormat) => {
    const entries = getAllEntries();

    if (!entries.length) {
      return { success: false, canceled: false, error: 'no_entries' };
    }

    // Suggest filename based on current date/time and format
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const defaultBaseName = `CalenRecall-Storybook-${timestamp}`;

    const filters =
      format === 'markdown'
        ? [{ name: 'Markdown', extensions: ['md'] }]
        : format === 'text'
        ? [{ name: 'Text', extensions: ['txt'] }]
        : format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : format === 'rtf'
        ? [{ name: 'Rich Text', extensions: ['rtf'] }]
        : format === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : format === 'csv'
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'Decades Export', extensions: ['dec'] }];

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Storybook',
      defaultPath: `${defaultBaseName}.${filters[0].extensions[0]}`,
      filters,
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Ensure directory exists (defensive; dialog should only return existing dirs)
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      return { success: false, canceled: false, error: 'invalid_directory' };
    }

    try {
      if (format === 'pdf') {
        await exportEntriesAsPdf(entries, filePath);
      } else {
        const content = formatExportContent(entries, format);
        fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
      }
      return { success: true, canceled: false, path: filePath };
    } catch (error: any) {
      console.error('Error exporting entries:', error);
      return { success: false, canceled: false, error: 'write_failed' };
    }
  });

  // Preferences handlers
  ipcMain.handle('get-preference', async (_event, key: keyof Preferences) => {
    return getPreference(key);
  });

  ipcMain.handle('set-preference', async (event, key: keyof Preferences, value: any) => {
    setPreference(key, value);
    
    // Notify main window of preference changes that need immediate UI updates
    // This allows the main window to update immediately without waiting for window events
    // Use type assertion to check string keys since TypeScript can't narrow keyof types
    const keyStr = key as string;
    // Send notification for theme, fontSize, minimapCrystalUseDefaultColors, backgroundImage, minimapSize, and showMinimap
    if (keyStr === 'theme' || keyStr === 'fontSize' || keyStr === 'minimapCrystalUseDefaultColors' || keyStr === 'backgroundImage' || keyStr === 'minimapSize' || keyStr === 'showMinimap') {
      // Send to main window if it exists and is not the sender
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        // Only send if the sender is not the main window (i.e., it's the preferences window)
        if (senderWindow !== mainWindowRef) {
          console.log('[IPC] 📤 Sending preference-updated to main window:', keyStr, value);
          try {
            // Send immediately
            const sent = mainWindowRef.webContents.send('preference-updated', { key: keyStr, value });
            console.log('[IPC] ✅ Message sent (send returns void, but no error thrown)');
            
            // For theme changes, send multiple fallback messages to ensure it's received
            // This handles cases where the listener might not be ready or there are timing issues
            if (keyStr === 'theme') {
              // Send after short delays as fallbacks - more aggressive for theme changes
              const sendFallback = (delay: number) => {
                setTimeout(() => {
                  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                    console.log(`[IPC] 📤 Sending fallback preference-updated for theme (${delay}ms):`, value);
                    try {
                      mainWindowRef.webContents.send('preference-updated', { key: keyStr, value });
                      console.log(`[IPC] ✅ Fallback message sent at ${delay}ms`);
                    } catch (err) {
                      console.error(`[IPC] ❌ Error sending fallback at ${delay}ms:`, err);
                    }
                  } else {
                    console.log(`[IPC] ⚠️ Main window not available at ${delay}ms, skipping fallback`);
                  }
                }, delay);
              };
              
              // Send multiple fallbacks at different intervals to ensure message is received
              sendFallback(50);
              sendFallback(100);
              sendFallback(200);
              sendFallback(300);
              sendFallback(500);
              sendFallback(1000);
              
              // Also try executing JavaScript directly as a last resort
              setTimeout(() => {
                if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                  try {
                    console.log('[IPC] 🔧 Attempting direct theme application via executeJavaScript');
                    mainWindowRef.webContents.executeJavaScript(`
                      (function() {
                        try {
                          const theme = '${value}';
                          const themeToApply = theme === 'auto' 
                            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                            : theme;
                          document.documentElement.setAttribute('data-theme', themeToApply);
                          void document.documentElement.offsetHeight; // Force reflow
                          console.log('[IPC] ✅ Direct theme application complete:', themeToApply);
                          return true;
                        } catch (e) {
                          console.error('[IPC] ❌ Error in direct theme application:', e);
                          return false;
                        }
                      })();
                    `).then((result) => {
                      console.log('[IPC] ✅ executeJavaScript completed:', result);
                    }).catch((err) => {
                      console.error('[IPC] ❌ executeJavaScript failed:', err);
                    });
                  } catch (error) {
                    console.error('[IPC] ❌ Error calling executeJavaScript:', error);
                  }
                }
              }, 150);
            }
          } catch (error) {
            console.error('[IPC] Error sending preference-updated message:', error);
          }
        } else {
          console.log('[IPC] Sender is main window, not sending notification');
        }
      } else {
        console.log('[IPC] Main window not available or destroyed');
      }
    }
    
    return { success: true };
  });

  ipcMain.handle('get-all-preferences', async () => {
    return getAllPreferences();
  });

  ipcMain.handle('reset-preferences', async () => {
    resetPreferences();
    return { success: true };
  });

  /**
   * Force the main window to refresh its theme from preferences
   * This is called directly from the preferences window to ensure reliable communication
   */
  ipcMain.handle('refresh-main-window-theme', async () => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      console.log('[IPC] Main window not available for theme refresh');
      return { success: false, error: 'main_window_not_available' };
    }

    try {
      const prefs = getAllPreferences();
      const theme = prefs.theme || 'light';
      console.log('[IPC] 🔄 Forcing main window theme refresh to:', theme);
      
      // Method 1: Send IPC message
      mainWindowRef.webContents.send('preference-updated', { key: 'theme', value: theme });
      
      // Method 2: Direct JavaScript execution as backup
      const themeToApply = theme === 'auto' 
        ? (mainWindowRef.webContents.getURL().includes('localhost') 
            ? 'dark' // Default for dev, will be resolved by JS
            : 'dark')
        : theme;
      
      await mainWindowRef.webContents.executeJavaScript(`
        (function() {
          try {
            const theme = '${theme}';
            const themeToApply = theme === 'auto' 
              ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
              : theme;
            
            // Apply theme directly
            document.documentElement.setAttribute('data-theme', themeToApply);
            void document.documentElement.offsetHeight; // Force reflow
            
            // Also trigger the update function if it exists
            if (window.electronAPI && window.electronAPI.onPreferenceUpdated) {
              // The listener should handle this, but we can also manually trigger
              console.log('[IPC] ✅ Theme refreshed via executeJavaScript:', themeToApply);
            }
            
            return { success: true, theme: themeToApply };
          } catch (e) {
            console.error('[IPC] ❌ Error refreshing theme:', e);
            return { success: false, error: e.message };
          }
        })();
      `);
      
      console.log('[IPC] ✅ Main window theme refresh completed');
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] ❌ Error refreshing main window theme:', error);
      return { success: false, error: error.message || 'unknown_error' };
    }
  });

  /**
   * Import journal entries from a file.
   * Supports JSON and Markdown formats.
   * Sends progress updates via IPC events.
   */
  ipcMain.handle('import-entries', async (event, format: 'json' | 'markdown') => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Entries',
      filters:
        format === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = filePaths[0];

    try {
      // Send progress: Reading file
      event.sender.send('import-progress', { stage: 'reading', progress: 0, message: 'Reading file...' });
      
      const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
      
      // Send progress: Parsing content
      event.sender.send('import-progress', { stage: 'parsing', progress: 25, message: 'Parsing entries...' });
      
      const entries = parseImportContent(content, format);

      if (entries.length === 0) {
        return { success: false, canceled: false, error: 'no_entries', message: 'No entries found in file' };
      }

      // Send progress: Starting import
      event.sender.send('import-progress', { stage: 'importing', progress: 30, message: `Importing ${entries.length} entries...`, total: entries.length, imported: 0, skipped: 0 });

      // Save all entries with progress updates
      let imported = 0;
      let skipped = 0;
      const total = entries.length;
      const progressInterval = Math.max(1, Math.floor(total / 50)); // Update every 2% or at least every entry
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        try {
          // Don't import entries with IDs (they're duplicates)
          if (!entry.id) {
            saveEntry(entry);
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error('Error importing entry:', error);
          skipped++;
        }
        
        // Send progress update periodically
        if (i % progressInterval === 0 || i === entries.length - 1) {
          const progress = 30 + Math.floor((i / total) * 70); // 30-100%
          event.sender.send('import-progress', {
            stage: 'importing',
            progress,
            message: `Imported ${imported} entries${skipped > 0 ? `, skipped ${skipped}` : ''}...`,
            total,
            imported,
            skipped,
          });
        }
      }

      // Send completion
      event.sender.send('import-progress', {
        stage: 'complete',
        progress: 100,
        message: `Import complete! Imported ${imported} entries${skipped > 0 ? `, skipped ${skipped} duplicates` : ''}.`,
        total,
        imported,
        skipped,
      });

      return {
        success: true,
        canceled: false,
        imported,
        skipped,
        total: entries.length,
      };
    } catch (error: any) {
      console.error('Error importing entries:', error);
      event.sender.send('import-progress', {
        stage: 'error',
        progress: 0,
        message: `Import failed: ${error.message || 'Unknown error'}`,
      });
      return {
        success: false,
        canceled: false,
        error: 'read_failed',
        message: error.message || 'Failed to read file',
      };
    }
  });

  /**
   * Backup the database to a user-selected location.
   */
  ipcMain.handle('backup-database', async () => {
    const dbPath = getDatabasePath();
    
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'database_not_found', message: 'Database file not found' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFileName = `calenrecall-backup-${timestamp}.db`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Backup Database',
      defaultPath: defaultFileName,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    try {
      fs.copyFileSync(dbPath, filePath);
      return { success: true, canceled: false, path: filePath };
    } catch (error: any) {
      console.error('Error backing up database:', error);
      return {
        success: false,
        canceled: false,
        error: 'backup_failed',
        message: error.message || 'Failed to backup database',
      };
    }
  });

  /**
   * Restore the database from a backup file.
   */
  ipcMain.handle('restore-database', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Restore Database from Backup',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const backupPath = filePaths[0];
    const dbPath = getDatabasePath();

    // Confirm restore
    const response = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confirm Restore',
      message: 'Restoring will replace your current database with the backup.',
      detail: 'This action cannot be undone. Make sure you have a current backup before proceeding.',
      buttons: ['Cancel', 'Restore'],
      defaultId: 0,
      cancelId: 0,
    });

    if (response.response === 0) {
      return { success: false, canceled: true };
    }

    try {
      // Close current database connection
      const { closeDatabase } = require('./database');
      closeDatabase();

      // Copy backup to database location
      fs.copyFileSync(backupPath, dbPath);

      // Reinitialize database
      const { initDatabase } = require('./database');
      initDatabase();

      return { success: true, canceled: false };
    } catch (error: any) {
      console.error('Error restoring database:', error);
      
      // Try to reinitialize database even if restore failed
      try {
        const { initDatabase } = require('./database');
        initDatabase();
      } catch (initError) {
        console.error('Error reinitializing database after restore failure:', initError);
      }

      return {
        success: false,
        canceled: false,
        error: 'restore_failed',
        message: error.message || 'Failed to restore database',
      };
    }
  });

  /**
   * Select a background image file.
   * Copies the image to user data directory and returns the path.
   */
  ipcMain.handle('select-background-image', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Background Image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const sourcePath = filePaths[0];

    try {
      // Create backgrounds directory in user data
      const userDataPath = app.getPath('userData');
      const backgroundsDir = path.join(userDataPath, 'backgrounds');
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true });
      }

      // Generate unique filename
      const fileExt = path.extname(sourcePath);
      const uniqueId = `bg-${Date.now()}`;
      const destFileName = `${uniqueId}${fileExt}`;
      const destPath = path.join(backgroundsDir, destFileName);

      // Copy file
      console.log('[IPC] Copying background image from:', sourcePath);
      console.log('[IPC] To:', destPath);
      fs.copyFileSync(sourcePath, destPath);
      console.log('[IPC] File copied successfully');

      // Verify file was copied
      if (!fs.existsSync(destPath)) {
        console.error('[IPC] File copy verification failed - file does not exist at destination');
        return {
          success: false,
          canceled: false,
          error: 'copy_verification_failed',
          message: 'File was copied but verification failed',
        };
      }

      // Save path as preference (store relative path from userData)
      const relativePath = path.relative(userDataPath, destPath);
      console.log('[IPC] Relative path:', relativePath);
      setPreference('backgroundImage', relativePath);
      console.log('[IPC] Preference saved');

      return {
        success: true,
        path: relativePath,
        fullPath: destPath,
      };
    } catch (error: any) {
      console.error('Error copying background image:', error);
      return {
        success: false,
        canceled: false,
        error: 'copy_failed',
        message: error.message || 'Failed to copy background image',
      };
    }
  });

  /**
   * Clear the background image preference.
   */
  ipcMain.handle('clear-background-image', async () => {
    try {
      setPreference('backgroundImage', '');
      return { success: true };
    } catch (error: any) {
      console.error('Error clearing background image:', error);
      return {
        success: false,
        error: 'clear_failed',
        message: error.message || 'Failed to clear background image',
      };
    }
  });

  /**
   * Get the background image as a data URL (base64 encoded).
   * This avoids security restrictions with file:// URLs in Electron's renderer process.
   */
  ipcMain.handle('get-background-image-path', async () => {
    try {
      const bgImage = getPreference('backgroundImage');
      console.log('[IPC] get-background-image-path - preference value:', bgImage);
      if (!bgImage || typeof bgImage !== 'string' || bgImage.trim() === '') {
        console.log('[IPC] No background image preference set');
        return { success: true, path: null };
      }
      const userDataPath = app.getPath('userData');
      console.log('[IPC] User data path:', userDataPath);
      const fullPath = path.join(userDataPath, bgImage);
      console.log('[IPC] Full path:', fullPath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.error('[IPC] Background image file does not exist:', fullPath);
        return {
          success: false,
          error: 'file_not_found',
          message: `Background image file not found: ${fullPath}`,
        };
      }
      
      // Read the file and convert to base64 data URL
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        const fileExt = path.extname(fullPath).toLowerCase();
        
        // Determine MIME type from extension
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
          '.svg': 'image/svg+xml',
        };
        
        const mimeType = mimeTypes[fileExt] || 'image/jpeg';
        const base64 = fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        console.log('[IPC] Converted image to data URL, size:', dataUrl.length, 'chars');
        return { success: true, path: dataUrl };
      } catch (readError: any) {
        console.error('[IPC] Error reading image file:', readError);
        return {
          success: false,
          error: 'read_failed',
          message: `Failed to read image file: ${readError.message || 'Unknown error'}`,
        };
      }
    } catch (error: any) {
      console.error('[IPC] Error getting background image path:', error);
      return {
        success: false,
        error: 'get_path_failed',
        message: error.message || 'Failed to get background image path',
      };
    }
  });
}

/**
 * Get MIME type from file extension.
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Parse imported content based on format.
 */
function parseImportContent(content: string, format: 'json' | 'markdown'): JournalEntry[] {
  switch (format) {
    case 'json':
      return parseJsonImport(content);
    case 'markdown':
      return parseMarkdownImport(content);
    default:
      return [];
  }
}

/**
 * Parse JSON import format.
 * Expects an array of JournalEntry objects.
 */
function parseJsonImport(content: string): JournalEntry[] {
  try {
    const data = JSON.parse(content);
    
    // Handle array of entries
    if (Array.isArray(data)) {
      return data.map(entry => ({
        date: entry.date,
        timeRange: entry.timeRange || 'day',
        title: entry.title || '',
        content: entry.content || '',
        tags: entry.tags || [],
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString(),
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing JSON import:', error);
    return [];
  }
}

/**
 * Parse Markdown import format.
 * Expects entries in the format:
 * ## YYYY-MM-DD (timeRange) — Title
 * **Tags:** tag1, tag2
 * 
 * Content here
 * 
 * ---
 */
function parseMarkdownImport(content: string): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const lines = content.split('\n');
  
  let currentEntry: Partial<JournalEntry> | null = null;
  let inContent = false;
  let contentLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for entry header: ## YYYY-MM-DD (timeRange) — Title
    const headerMatch = line.match(/^##\s+(-?\d{4}-\d{2}-\d{2})\s+\((\w+)\)\s+—\s+(.+)$/);
    if (headerMatch) {
      // Save previous entry if exists
      if (currentEntry && contentLines.length > 0) {
        entries.push({
          date: currentEntry.date!,
          timeRange: currentEntry.timeRange!,
          title: currentEntry.title || '',
          content: contentLines.join('\n').trim(),
          tags: currentEntry.tags || [],
          createdAt: currentEntry.createdAt || new Date().toISOString(),
          updatedAt: currentEntry.updatedAt || new Date().toISOString(),
        });
      }
      
      // Start new entry
      currentEntry = {
        date: headerMatch[1],
        timeRange: headerMatch[2] as TimeRange,
        title: headerMatch[3],
        tags: [],
      };
      contentLines = [];
      inContent = false;
      continue;
    }
    
    // Check for tags line: **Tags:** tag1, tag2
    if (currentEntry && line.match(/^\*\*Tags:\*\*/)) {
      const tagsText = line.replace(/^\*\*Tags:\*\*\s*/, '');
      currentEntry.tags = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
      continue;
    }
    
    // Check for separator (end of entry)
    if (line.trim() === '---') {
      if (currentEntry && contentLines.length > 0) {
        entries.push({
          date: currentEntry.date!,
          timeRange: currentEntry.timeRange!,
          title: currentEntry.title || '',
          content: contentLines.join('\n').trim(),
          tags: currentEntry.tags || [],
          createdAt: currentEntry.createdAt || new Date().toISOString(),
          updatedAt: currentEntry.updatedAt || new Date().toISOString(),
        });
      }
      currentEntry = null;
      contentLines = [];
      inContent = false;
      continue;
    }
    
    // Skip header lines and empty lines at start
    if (!currentEntry) {
      continue;
    }
    
    // Skip empty lines before content starts
    if (!inContent && line.trim() === '') {
      continue;
    }
    
    // Collect content
    inContent = true;
    contentLines.push(line);
  }
  
  // Save last entry if exists
  if (currentEntry && contentLines.length > 0) {
    entries.push({
      date: currentEntry.date!,
      timeRange: currentEntry.timeRange!,
      title: currentEntry.title || '',
      content: contentLines.join('\n').trim(),
      tags: currentEntry.tags || [],
      createdAt: currentEntry.createdAt || new Date().toISOString(),
      updatedAt: currentEntry.updatedAt || new Date().toISOString(),
    });
  }
  
  return entries;
}

/**
 * Render all entries into a single string according to the chosen export format.
 * For binary formats like PDF, see exportEntriesAsPdf instead.
 */
function formatExportContent(entries: JournalEntry[], format: ExportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(entries, null, 2);
    case 'text':
      return formatAsPlainText(entries);
    case 'rtf':
      return formatAsRtf(entries);
    case 'dec':
      return formatAsDecades(entries);
    case 'csv':
      return formatAsCsv(entries);
    case 'markdown':
    default:
      return formatAsMarkdown(entries);
  }
}

function formatAsMarkdown(entries: JournalEntry[]): string {
  const lines: string[] = [];
  lines.push('# CalenRecall Storybook Export');
  lines.push('');
  lines.push(`Exported at: ${new Date().toISOString()}`);
  lines.push('');

  for (const entry of entries) {
    lines.push(`## ${entry.date} (${entry.timeRange}) — ${entry.title}`);
    if (entry.tags && entry.tags.length > 0) {
      lines.push(`**Tags:** ${entry.tags.join(', ')}`);
    }
    lines.push('');
    lines.push(entry.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function formatAsPlainText(entries: JournalEntry[]): string {
  const lines: string[] = [];
  lines.push('CalenRecall Storybook Export');
  lines.push(`Exported at: ${new Date().toISOString()}`);
  lines.push('');

  for (const entry of entries) {
    lines.push(`${entry.date} [${entry.timeRange}] - ${entry.title}`);
    if (entry.tags && entry.tags.length > 0) {
      lines.push(`Tags: ${entry.tags.join(', ')}`);
    }
    lines.push('');
    lines.push(entry.content);
    lines.push('');
    lines.push('------------------------------------------------------------');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Very simple RTF export aimed at a typewriter-style, monospaced look.
 * We keep formatting minimal for broad compatibility.
 */
function formatAsRtf(entries: JournalEntry[]): string {
  const header = [
    '{\\rtf1\\ansi',
    '{\\fonttbl{\\f0\\fmodern Courier New;}}',
    '\\f0\\fs22',
  ];

  const body: string[] = [];
  body.push('\\b CalenRecall Storybook Export \\b0\\par');
  body.push(`Exported at: ${escapeRtf(new Date().toISOString())}\\par`);
  body.push('\\par');

  for (const entry of entries) {
    const titleLine = `${entry.date} (${entry.timeRange}) - ${entry.title}`;
    body.push(`\\b ${escapeRtf(titleLine)} \\b0\\par`);

    if (entry.tags && entry.tags.length > 0) {
      const tagsText = `Tags: ${entry.tags.join(', ')}`;
      body.push(`\\i ${escapeRtf(tagsText)} \\i0\\par`);
    }

    body.push('\\par');

    const contentLines = entry.content.split(/\\r?\\n/);
    for (const line of contentLines) {
      body.push(`${escapeRtf(line)}\\par`);
    }

    body.push('\\par');
    body.push('------------------------------------------------------------\\par');
    body.push('\\par');
  }

  body.push('}'); // close rtf

  return [...header, ...body].join('\n');
}

function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
}

/**
 * Compact .dec (\"decades\") export – groups entries by decade and year.
 */
function formatAsDecades(entries: JournalEntry[]): string {
  const lines: string[] = [];
  lines.push('CalenRecall Decades Export');
  lines.push(`Exported at: ${new Date().toISOString()}`);
  lines.push('');

  // Group by decade and year
  const byDecade: Map<string, Map<string, JournalEntry[]>> = new Map();

  for (const entry of entries) {
    const year = parseISODate(entry.date).getFullYear();
    const decadeStart = Math.floor(year / 10) * 10;
    const decadeKey = `${decadeStart}s`;
    const yearKey = `${year}`;

    if (!byDecade.has(decadeKey)) {
      byDecade.set(decadeKey, new Map());
    }
    const decadeMap = byDecade.get(decadeKey)!;

    if (!decadeMap.has(yearKey)) {
      decadeMap.set(yearKey, []);
    }
    decadeMap.get(yearKey)!.push(entry);
  }

  const sortedDecades = Array.from(byDecade.keys()).sort();

  for (const decade of sortedDecades) {
    lines.push(`=== ${decade} ===`);
    const yearMap = byDecade.get(decade)!;
    const sortedYears = Array.from(yearMap.keys()).sort();

    for (const year of sortedYears) {
      lines.push(`  -- ${year} --`);
      const yearEntries = yearMap.get(year)!;
      for (const entry of yearEntries) {
        lines.push(
          `    * ${entry.date} [${entry.timeRange}] ${entry.title}`
        );
      }
      lines.push('');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format entries as CSV (Comma-Separated Values).
 * Escapes commas, quotes, and newlines in content.
 */
function formatAsCsv(entries: JournalEntry[]): string {
  // CSV header
  const lines: string[] = [];
  lines.push('Date,Time Range,Title,Content,Tags,Created At,Updated At');
  
  // Helper function to escape CSV fields
  const escapeCsvField = (field: string): string => {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
  
  for (const entry of entries) {
    const date = escapeCsvField(entry.date);
    const timeRange = escapeCsvField(entry.timeRange);
    const title = escapeCsvField(entry.title);
    const content = escapeCsvField(entry.content);
    const tags = escapeCsvField((entry.tags || []).join('; '));
    const createdAt = escapeCsvField(entry.createdAt);
    const updatedAt = escapeCsvField(entry.updatedAt);
    
    lines.push(`${date},${timeRange},${title},${content},${tags},${createdAt},${updatedAt}`);
  }
  
  return lines.join('\n');
}

/**
 * Generate a PDF storybook using pdfkit.
 */
async function exportEntriesAsPdf(entries: JournalEntry[], filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(20).text('CalenRecall Storybook Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Exported at: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown(2);

      for (const entry of entries) {
        const titleLine = `${entry.date} (${entry.timeRange}) — ${entry.title}`;
        doc.fontSize(14).font('Helvetica-Bold').text(titleLine);

        if (entry.tags && entry.tags.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica-Oblique').text(`Tags: ${entry.tags.join(', ')}`);
        }

        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text(entry.content, { align: 'left' });
        doc.moveDown(1);

        // Add a subtle separator
        doc.moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor('#cccccc')
          .stroke();

        doc.moveDown(1);

        // Start a new page if we're near the bottom
        if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
          doc.addPage();
        }
      }

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
}

