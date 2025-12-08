import { ipcMain, dialog, app, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

interface ThemeColors {
  background: string;
  text: string;
  accent: string;
  border: string;
  secondary: string;
}

interface ThemeStyles {
  colors: ThemeColors;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
  textShadow: string;
  borderRadius: string;
  boxShadow: string;
}
import {
  getEntries,
  getEntry,
  getEntryById,
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
  flushDatabase,
} from './database';
import { EntryVersion } from './types';
import { JournalEntry, TimeRange, ExportFormat, EntryAttachment, ExportMetadata } from './types';
import { EntryTemplate, getAllTemplates, getTemplate, saveTemplate, deleteTemplate } from './database';

let mainWindowRef: Electron.BrowserWindow | null = null;
let menuUpdateCallback: (() => void) | null = null;

/**
 * Extract full styling from a theme CSS file
 * Returns comprehensive theme styling for use in exports
 */
function extractThemeStyles(themeName: string): ThemeStyles {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // Try to find theme CSS file
  let themePath: string | null = null;
  
  // First try built-in themes
  const builtInPaths = [
    path.join(__dirname, '../../src/themes', `${themeName}.css`),
    path.join(process.cwd(), 'src/themes', `${themeName}.css`),
  ];
  
  for (const testPath of builtInPaths) {
    if (fs.existsSync(testPath)) {
      themePath = testPath;
      break;
    }
  }
  
  // If not found, try custom themes in userData
  if (!themePath) {
    const userDataPath = app.getPath('userData');
    const customThemePath = path.join(userDataPath, 'themes', `${themeName}.css`);
    if (fs.existsSync(customThemePath)) {
      themePath = customThemePath;
    }
  }
  
  // Default styling (light theme)
  const defaultColors: ThemeColors = {
    background: '#ffffff',
    text: '#000000',
    accent: '#007bff',
    border: '#e0e0e0',
    secondary: '#666666',
  };
  
  const defaultStyles: ThemeStyles = {
    colors: defaultColors,
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    letterSpacing: 'normal',
    lineHeight: '1.6',
    textShadow: 'none',
    borderRadius: '0',
    boxShadow: 'none',
  };
  
  if (!themePath || !fs.existsSync(themePath)) {
    console.log(`[Export] Theme file not found for ${themeName}, using defaults`);
    return defaultStyles;
  }
  
  try {
    const cssContent = fs.readFileSync(themePath, 'utf-8');
    
    // Extract colors using regex patterns
    // Look for body background and color
    const bodyBgMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*body\s*\{[^}]*background:\s*([^;]+);/i);
    const bodyColorMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*body\s*\{[^}]*color:\s*([^;]+);/i);
    
    // Look for accent colors (nav-button active, date-input focus, etc.)
    const accentMatch = cssContent.match(/(?:nav-button\.active|\.active|accent|primary)[^}]*color:\s*([^;]+);/i) ||
                       cssContent.match(/(?:border.*color|border-color):\s*([^;]+);/i);
    
    // Look for border colors
    const borderMatch = cssContent.match(/border(?:-bottom)?:\s*\d+px\s+(?:solid|dashed)\s+([^;]+);/i);
    
    // Helper to extract hex/rgb from CSS value
    const extractColor = (value: string): string | null => {
      if (!value) return null;
      value = value.trim();
      
      // Hex color
      const hexMatch = value.match(/#[0-9a-fA-F]{3,6}/);
      if (hexMatch) return hexMatch[0];
      
      // RGB/RGBA
      const rgbMatch = value.match(/rgba?\([^)]+\)/);
      if (rgbMatch) {
        // Convert rgba to hex if possible (simplified)
        const rgba = rgbMatch[0].match(/\d+/g);
        if (rgba && rgba.length >= 3) {
          const r = parseInt(rgba[0]);
          const g = parseInt(rgba[1]);
          const b = parseInt(rgba[2]);
          return `#${[r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('')}`;
        }
      }
      
      return null;
    };
    
    const background = extractColor(bodyBgMatch?.[1] || '') || defaultColors.background;
    const text = extractColor(bodyColorMatch?.[1] || '') || defaultColors.text;
    const accent = extractColor(accentMatch?.[1] || '') || defaultColors.accent;
    const border = extractColor(borderMatch?.[1] || '') || defaultColors.border;
    const secondary = defaultColors.secondary;
    
    // Extract font family from body or root theme selector
    const fontFamilyMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*(?:body|)\s*\{[^}]*font-family:\s*([^;]+);/i) ||
                            cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\{[^}]*font-family:\s*([^;]+);/i);
    const fontFamily = fontFamilyMatch?.[1]?.trim().replace(/['"]/g, '') || defaultStyles.fontFamily;
    
    // Extract font size
    const fontSizeMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*(?:body|)\s*\{[^}]*font-size:\s*([^;]+);/i) ||
                         cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\{[^}]*font-size:\s*([^;]+);/i);
    const fontSize = fontSizeMatch?.[1]?.trim() || defaultStyles.fontSize;
    
    // Extract font weight
    const fontWeightMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*(?:body|)\s*\{[^}]*font-weight:\s*([^;]+);/i) ||
                           cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\{[^}]*font-weight:\s*([^;]+);/i);
    const fontWeight = fontWeightMatch?.[1]?.trim() || defaultStyles.fontWeight;
    
    // Extract letter spacing
    const letterSpacingMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*(?:body|)\s*\{[^}]*letter-spacing:\s*([^;]+);/i) ||
                              cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\{[^}]*letter-spacing:\s*([^;]+);/i);
    const letterSpacing = letterSpacingMatch?.[1]?.trim() || defaultStyles.letterSpacing;
    
    // Extract line height
    const lineHeightMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*(?:body|)\s*\{[^}]*line-height:\s*([^;]+);/i) ||
                           cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\{[^}]*line-height:\s*([^;]+);/i);
    const lineHeight = lineHeightMatch?.[1]?.trim() || defaultStyles.lineHeight;
    
    // Extract text shadow (from h1, h2, or headings)
    const textShadowMatch = cssContent.match(/(?:h1|h2|h3|\.date-label|\.viewer-title)[^}]*text-shadow:\s*([^;]+);/i);
    const textShadow = textShadowMatch?.[1]?.trim() || defaultStyles.textShadow;
    
    // Extract border radius
    const borderRadiusMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\*\s*\{[^}]*border-radius:\s*([^;]+);/i);
    const borderRadius = borderRadiusMatch?.[1]?.trim() || defaultStyles.borderRadius;
    
    // Extract box shadow (from navigation or key elements)
    const boxShadowMatch = cssContent.match(/(?:\.navigation-bar|\.nav-button)[^}]*box-shadow:\s*([^;]+);/i);
    const boxShadow = boxShadowMatch?.[1]?.trim() || defaultStyles.boxShadow;
    
    return {
      colors: {
        background,
        text,
        accent,
        border,
        secondary,
      },
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      textShadow,
      borderRadius,
      boxShadow,
    };
  } catch (error) {
    console.error(`[Export] Error extracting styles from theme ${themeName}:`, error);
    return defaultStyles;
  }
}

/**
 * Extract colors from a theme CSS file (backward compatibility)
 * Returns a color palette for use in exports
 */
function extractThemeColors(themeName: string): ThemeColors {
  return extractThemeStyles(themeName).colors;
}

export function setMainWindow(window: Electron.BrowserWindow | null) {
  mainWindowRef = window;
}

export function setMenuUpdateCallback(callback: (() => void) | null) {
  menuUpdateCallback = callback;
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
      console.log('═══════════════════════════════════════════════════════════');
      console.log('[IPC] 📥 save-entry handler RECEIVED entry from renderer');
      console.log('[IPC] Entry Details:', {
        id: entry.id,
        date: entry.date,
        timeRange: entry.timeRange,
        timeFields: {
          hour: entry.hour,
          hourType: typeof entry.hour,
          minute: entry.minute,
          minuteType: typeof entry.minute,
          second: entry.second,
          secondType: typeof entry.second,
        },
        title: entry.title,
        contentLength: entry.content?.length || 0,
        hasTags: !!entry.tags,
        tagsCount: entry.tags?.length || 0,
      });
      console.log('[IPC] Full Entry JSON:', JSON.stringify(entry, null, 2));
      console.log('═══════════════════════════════════════════════════════════');
      
      // Save entry to database and get back the entry with ID (for new entries)
      const savedEntry = saveEntry(entry);
      
      // CRITICAL: Explicitly flush database to disk immediately after save
      // This ensures data is persisted even if the program closes unexpectedly
      console.log('[IPC] 🔄 Flushing database to disk after save...');
      try {
        flushDatabase();
        console.log('[IPC] ✅ Database flushed to disk - data is now persistent');
        
        // Additional verification: Read back the entry to confirm it's saved with time values
        if (savedEntry.id) {
          const verifyEntry = getEntryById(savedEntry.id);
          if (verifyEntry) {
            console.log('[IPC] ✅✅✅ VERIFICATION: Entry read back from database:', {
              id: verifyEntry.id,
              hour: verifyEntry.hour,
              minute: verifyEntry.minute,
              second: verifyEntry.second,
              hourType: typeof verifyEntry.hour,
              minuteType: typeof verifyEntry.minute,
              secondType: typeof verifyEntry.second,
            });
            if (verifyEntry.hour !== savedEntry.hour || verifyEntry.minute !== savedEntry.minute || verifyEntry.second !== savedEntry.second) {
              console.error('[IPC] ❌❌❌ MISMATCH: Time values in database do not match what was saved!', {
                saved: { hour: savedEntry.hour, minute: savedEntry.minute, second: savedEntry.second },
                retrieved: { hour: verifyEntry.hour, minute: verifyEntry.minute, second: verifyEntry.second }
              });
            }
          } else {
            console.warn('[IPC] ⚠️ WARNING: Could not verify entry after save (entry not found)');
          }
        }
      } catch (flushError) {
        console.error('[IPC] ❌ Error flushing database:', flushError);
        // Don't fail the save - data might still be saved, just not flushed yet
      }
      
      console.log('[IPC] ✅ save-entry handler COMPLETED - database.saveEntry() called and flushed');
      console.log('═══════════════════════════════════════════════════════════');
      return { success: true, entry: savedEntry };
    } catch (error) {
      console.error('═══════════════════════════════════════════════════════════');
      console.error('[IPC] ❌❌❌ ERROR in save-entry handler:', error);
      console.error('[IPC] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error('═══════════════════════════════════════════════════════════');
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
   * The renderer passes an export format and optional metadata; this handler opens a save dialog,
   * formats the content with metadata, and writes it to disk.
   */
  ipcMain.handle('export-entries', async (_event, format: ExportFormat, metadata?: ExportMetadata) => {
    const entries = getAllEntries();
    console.log('[Export] Retrieved entries for export:', entries.length);
    if (entries.length > 0) {
      console.log('[Export] First entry time values:', {
        id: entries[0].id,
        date: entries[0].date,
        hour: entries[0].hour,
        minute: entries[0].minute,
        second: entries[0].second
      });
    }

    if (!entries.length) {
      return { success: false, canceled: false, error: 'no_entries' };
    }

    // Suggest filename based on metadata or default to current date/time
    let defaultBaseName: string;
    if (metadata?.exportName) {
      defaultBaseName = metadata.exportName;
    } else if (metadata?.projectTitle) {
      defaultBaseName = metadata.projectTitle;
    } else {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      defaultBaseName = `CalenRecall-Storybook-${timestamp}`;
    }

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
      // Set export date if not provided
      const finalMetadata: ExportMetadata = {
        ...metadata,
        exportDate: metadata?.exportDate || new Date().toISOString(),
      };

      if (format === 'pdf') {
        await exportEntriesAsPdf(entries, filePath, finalMetadata);
      } else {
        const content = formatExportContent(entries, format, finalMetadata);
        fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
      }
      
      // Open the folder containing the exported file
      shell.showItemInFolder(filePath);
      
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
    console.log('[IPC] set-preference called:', key, value, 'type:', typeof value);
    setPreference(key, value);
    
    // Notify main window of preference changes that need immediate UI updates
    // This allows the main window to update immediately without waiting for window events
    // Use type assertion to check string keys since TypeScript can't narrow keyof types
    const keyStr = key as string;
    // Send notification for theme, fontSize, minimapCrystalUseDefaultColors, backgroundImage, minimapSize, showMinimap, weekStartsOn, and soundEffectsEnabled
    if (keyStr === 'theme' || keyStr === 'fontSize' || keyStr === 'minimapCrystalUseDefaultColors' || keyStr === 'backgroundImage' || keyStr === 'minimapSize' || keyStr === 'showMinimap' || keyStr === 'weekStartsOn' || keyStr === 'soundEffectsEnabled') {
      console.log('[IPC] Preference', keyStr, 'is in notification list, will send to main window');
      // Send to main window if it exists and is not the sender
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        // Only send if the sender is not the main window (i.e., it's the preferences window)
        if (senderWindow !== mainWindowRef) {
          console.log('[IPC] 📤 Sending preference-updated to main window:', keyStr, value, 'type:', typeof value);
          try {
            // Send immediately
            const sent = mainWindowRef.webContents.send('preference-updated', { key: keyStr, value });
            console.log('[IPC] ✅ Message sent (send returns void, but no error thrown)');
            if (keyStr === 'soundEffectsEnabled') {
              console.log('[IPC] 🔊 Sound effects preference update sent - value:', value, 'type:', typeof value);
            }
            
            // For theme, fontSize, and minimapSize changes, send multiple fallback messages to ensure it's received
            // This handles cases where the listener might not be ready or there are timing issues
            if (keyStr === 'theme' || keyStr === 'fontSize' || keyStr === 'minimapSize') {
              // Send fallback messages for critical UI updates
              const sendFallback = (delay: number) => {
                setTimeout(() => {
                  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                    console.log(`[IPC] 📤 Sending fallback preference-updated for ${keyStr} (${delay}ms):`, value);
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
              
              // Send multiple fallbacks at different intervals
              sendFallback(50);
              sendFallback(100);
              sendFallback(200);
              
              // For theme changes, send additional fallbacks and use direct JavaScript execution
              if (keyStr === 'theme') {
                // Update the application menu to reflect the new theme selection
                if (menuUpdateCallback) {
                  try {
                    menuUpdateCallback();
                    console.log('[IPC] ✅ Application menu updated for theme change');
                  } catch (error) {
                    console.error('[IPC] ❌ Error updating application menu:', error);
                  }
                }
                
                sendFallback(300);
                sendFallback(500);
                sendFallback(1000);
                
                // Also try executing JavaScript directly as a last resort for theme
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
              } else if (keyStr === 'fontSize') {
                // For font size, also try direct JavaScript execution as a fallback
                setTimeout(() => {
                  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                    try {
                      console.log('[IPC] 🔧 Attempting direct font size application via executeJavaScript');
                      mainWindowRef.webContents.executeJavaScript(`
                        (function() {
                          try {
                            const fontSize = '${value}';
                            document.documentElement.setAttribute('data-font-size', fontSize);
                            void document.documentElement.offsetHeight; // Force reflow
                            console.log('[IPC] ✅ Direct font size application complete:', fontSize);
                            return true;
                          } catch (e) {
                            console.error('[IPC] ❌ Error in direct font size application:', e);
                            return false;
                          }
                        })();
                      `).then((result) => {
                        console.log('[IPC] ✅ executeJavaScript completed for fontSize:', result);
                      }).catch((err) => {
                        console.error('[IPC] ❌ executeJavaScript failed for fontSize:', err);
                      });
                    } catch (error) {
                      console.error('[IPC] ❌ Error calling executeJavaScript for fontSize:', error);
                    }
                  }
                }, 150);
              } else if (keyStr === 'minimapSize') {
                // For minimapSize, send additional fallbacks to ensure it's received
                sendFallback(300);
                sendFallback(500);
                console.log('[IPC] ✅ Sent additional fallback messages for minimapSize');
              }
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
   * Get all custom theme CSS files from AppData/themes directory.
   * Returns an array of theme objects with name and CSS content.
   */
  ipcMain.handle('get-custom-themes', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const customThemesDir = path.join(userDataPath, 'themes');
      
      if (!fs.existsSync(customThemesDir)) {
        return { success: true, themes: [] };
      }
      
      const files = fs.readdirSync(customThemesDir);
      const themes: Array<{ name: string; css: string }> = [];
      
      for (const file of files) {
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
        
        try {
          const cssPath = path.join(customThemesDir, file);
          const cssContent = fs.readFileSync(cssPath, 'utf-8');
          themes.push({ name: themeName, css: cssContent });
        } catch (error) {
          console.error(`[IPC] Error reading custom theme file ${file}:`, error);
        }
      }
      
      return { success: true, themes };
    } catch (error: any) {
      console.error('[IPC] Error getting custom themes:', error);
      return {
        success: false,
        error: 'get_failed',
        message: error.message || 'Failed to get custom themes',
        themes: [],
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
 * Format time values from entry (hour, minute, second) as a readable time string.
 * Returns formatted time like "10:30:00" or "10:30" if seconds are 0, or empty string if no hour.
 */
function formatEntryTime(entry: JournalEntry): string {
  if (entry.hour === null || entry.hour === undefined) {
    return '';
  }
  
  const hour = entry.hour;
  const minute = entry.minute !== null && entry.minute !== undefined ? entry.minute : 0;
  const second = entry.second !== null && entry.second !== undefined ? entry.second : 0;
  
  // Format as HH:MM:SS or HH:MM if seconds are 0
  if (second === 0) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

/**
 * Render all entries into a single string according to the chosen export format.
 * For binary formats like PDF, see exportEntriesAsPdf instead.
 */
function formatExportContent(entries: JournalEntry[], format: ExportFormat, metadata?: ExportMetadata): string {
  switch (format) {
    case 'json':
      return formatAsJson(entries, metadata);
    case 'text':
      return formatAsPlainText(entries, metadata);
    case 'rtf':
      return formatAsRtf(entries, metadata);
    case 'dec':
      return formatAsDecades(entries, metadata);
    case 'csv':
      return formatAsCsv(entries, metadata);
    case 'markdown':
    default:
      return formatAsMarkdown(entries, metadata);
  }
}

function formatAsJson(entries: JournalEntry[], metadata?: ExportMetadata): string {
  const exportData = {
    metadata: metadata || {},
    exportedAt: metadata?.exportDate || new Date().toISOString(),
    entryCount: entries.length,
    entries: entries,
  };
  return JSON.stringify(exportData, null, 2);
}

function formatAsMarkdown(entries: JournalEntry[], metadata?: ExportMetadata): string {
  const lines: string[] = [];
  
  // Get theme styles if theme is specified
  const themeName = metadata?.exportTheme || getPreference('theme') || 'light';
  const themeStyles = extractThemeStyles(themeName);
  const colors = themeStyles.colors;
  
  // Add HTML/CSS styling for theme (many markdown renderers support embedded HTML)
  if (metadata?.exportTheme) {
    lines.push('<!DOCTYPE html>');
    lines.push('<html>');
    lines.push('<head>');
    lines.push('<meta charset="UTF-8">');
    lines.push('<style>');
    lines.push(`body {`);
    lines.push(`  background-color: ${colors.background};`);
    lines.push(`  color: ${colors.text};`);
    lines.push(`  font-family: ${themeStyles.fontFamily};`);
    lines.push(`  font-size: ${themeStyles.fontSize};`);
    lines.push(`  font-weight: ${themeStyles.fontWeight};`);
    lines.push(`  letter-spacing: ${themeStyles.letterSpacing};`);
    lines.push(`  line-height: ${themeStyles.lineHeight};`);
    lines.push(`  max-width: 800px;`);
    lines.push(`  margin: 0 auto;`);
    lines.push(`  padding: 2rem;`);
    if (themeStyles.boxShadow !== 'none') {
      lines.push(`  box-shadow: ${themeStyles.boxShadow};`);
    }
    lines.push(`}`);
    lines.push(`h1, h2, h3 {`);
    lines.push(`  color: ${colors.text};`);
    lines.push(`  font-family: ${themeStyles.fontFamily};`);
    if (themeStyles.textShadow !== 'none') {
      lines.push(`  text-shadow: ${themeStyles.textShadow};`);
    }
    lines.push(`}`);
    lines.push(`h1 { border-bottom: 2px solid ${colors.accent}; padding-bottom: 0.5rem; }`);
    lines.push(`h2 { border-bottom: 1px solid ${colors.border}; padding-bottom: 0.3rem; margin-top: 2rem; }`);
    lines.push(`code { background-color: ${colors.border}; padding: 0.2rem 0.4rem; border-radius: ${themeStyles.borderRadius === '0' ? '3px' : themeStyles.borderRadius}; }`);
    lines.push(`pre { background-color: ${colors.border}; padding: 1rem; border-radius: ${themeStyles.borderRadius === '0' ? '5px' : themeStyles.borderRadius}; overflow-x: auto; }`);
    lines.push(`blockquote { border-left: 4px solid ${colors.accent}; padding-left: 1rem; margin-left: 0; color: ${colors.secondary}; }`);
    lines.push(`a { color: ${colors.accent}; }`);
    lines.push(`hr { border: none; border-top: 1px solid ${colors.border}; margin: 2rem 0; }`);
    lines.push(`strong { color: ${colors.text}; font-weight: ${themeStyles.fontWeight === '400' ? '600' : themeStyles.fontWeight}; }`);
    lines.push(`.entry-separator { border-top: 1px solid ${colors.border}; margin: 2rem 0; }`);
    lines.push(`p { line-height: ${themeStyles.lineHeight}; }`);
    lines.push(`</style>`);
    lines.push(`</head>`);
    lines.push(`<body>`);
    lines.push('');
  }
  
  // Title
  const title = metadata?.projectTitle || metadata?.exportName || 'CalenRecall Storybook Export';
  lines.push(`# ${title}`);
  lines.push('');
  
  // Metadata section
  if (metadata) {
    if (metadata.description) {
      lines.push(metadata.description);
      lines.push('');
    }
    
    if (metadata.author || metadata.organization) {
      lines.push('## Metadata');
      lines.push('');
      if (metadata.author) lines.push(`**Author:** ${metadata.author}`);
      if (metadata.organization) lines.push(`**Organization:** ${metadata.organization}`);
      if (metadata.department) lines.push(`**Department:** ${metadata.department}`);
      if (metadata.contactEmail) lines.push(`**Email:** ${metadata.contactEmail}`);
      if (metadata.contactPhone) lines.push(`**Phone:** ${metadata.contactPhone}`);
      if (metadata.website) lines.push(`**Website:** ${metadata.website}`);
      if (metadata.version) lines.push(`**Version:** ${metadata.version}`);
      if (metadata.versionDate) lines.push(`**Version Date:** ${metadata.versionDate}`);
      if (metadata.purpose) lines.push(`**Purpose:** ${metadata.purpose}`);
      if (metadata.exportPurpose) lines.push(`**Export Purpose:** ${metadata.exportPurpose}`);
      if (metadata.classification) lines.push(`**Classification:** ${metadata.classification}`);
      if (metadata.subject) lines.push(`**Subject:** ${metadata.subject}`);
      if (metadata.keywords && metadata.keywords.length > 0) {
        lines.push(`**Keywords:** ${metadata.keywords.join(', ')}`);
      }
      if (metadata.dateRangeStart || metadata.dateRangeEnd) {
        const range = [metadata.dateRangeStart, metadata.dateRangeEnd].filter(Boolean).join(' to ');
        lines.push(`**Date Range:** ${range}`);
      }
      lines.push('');
    }
    
    if (metadata.context || metadata.background) {
      lines.push('## Context');
      lines.push('');
      if (metadata.context) {
        lines.push(metadata.context);
        lines.push('');
      }
      if (metadata.background) {
        lines.push(metadata.background);
        lines.push('');
      }
    }
    
    if (metadata.copyright || metadata.license || metadata.rights) {
      lines.push('## Legal & Rights');
      lines.push('');
      if (metadata.copyright) lines.push(`**Copyright:** ${metadata.copyright}`);
      if (metadata.license) lines.push(`**License:** ${metadata.license}`);
      if (metadata.rights) {
        lines.push('');
        lines.push(metadata.rights);
      }
      lines.push('');
    }
    
    if (metadata.relatedDocuments || metadata.citation || metadata.source) {
      lines.push('## References');
      lines.push('');
      if (metadata.relatedDocuments) lines.push(metadata.relatedDocuments);
      if (metadata.citation) lines.push(`**Citation:** ${metadata.citation}`);
      if (metadata.source) lines.push(`**Source:** ${metadata.source}`);
      lines.push('');
    }
    
    if (metadata.notes || metadata.instructions || metadata.acknowledgments) {
      if (metadata.notes) {
        lines.push('## Notes');
        lines.push('');
        lines.push(metadata.notes);
        lines.push('');
      }
      if (metadata.instructions) {
        lines.push('## Instructions');
        lines.push('');
        lines.push(metadata.instructions);
        lines.push('');
      }
      if (metadata.acknowledgments) {
        lines.push('## Acknowledgments');
        lines.push('');
        lines.push(metadata.acknowledgments);
        lines.push('');
      }
    }
  }
  
  // Export info
  lines.push('---');
  lines.push('');
  lines.push(`**Exported at:** ${metadata?.exportDate || new Date().toISOString()}`);
  if (entries.length > 0) {
    lines.push(`**Entries:** ${entries.length}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Entries
  for (const entry of entries) {
    const timeStr = formatEntryTime(entry);
    console.log('[Export Markdown] Entry time values:', {
      id: entry.id,
      date: entry.date,
      hour: entry.hour,
      minute: entry.minute,
      second: entry.second,
      formattedTime: timeStr
    });
    const dateTimeStr = timeStr ? `${entry.date} ${timeStr}` : entry.date;
    lines.push(`## ${dateTimeStr} (${entry.timeRange}) — ${entry.title}`);
    if (entry.tags && entry.tags.length > 0) {
      lines.push(`**Tags:** ${entry.tags.join(', ')}`);
    }
    lines.push('');
    lines.push(entry.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Close HTML tags if theme styling was added
  if (metadata?.exportTheme) {
    lines.push('');
    lines.push('</body>');
    lines.push('</html>');
  }

  return lines.join('\n');
}

function formatAsPlainText(entries: JournalEntry[], metadata?: ExportMetadata): string {
  const lines: string[] = [];
  
  const title = metadata?.projectTitle || metadata?.exportName || 'CalenRecall Storybook Export';
  lines.push('='.repeat(title.length + 4));
  lines.push(`  ${title}`);
  lines.push('='.repeat(title.length + 4));
  lines.push('');
  
  // Metadata
  if (metadata) {
    if (metadata.description) {
      lines.push(metadata.description);
      lines.push('');
    }
    
    lines.push('METADATA');
    lines.push('-'.repeat(50));
    if (metadata.author) lines.push(`Author: ${metadata.author}`);
    if (metadata.organization) lines.push(`Organization: ${metadata.organization}`);
    if (metadata.department) lines.push(`Department: ${metadata.department}`);
    if (metadata.contactEmail) lines.push(`Email: ${metadata.contactEmail}`);
    if (metadata.contactPhone) lines.push(`Phone: ${metadata.contactPhone}`);
    if (metadata.website) lines.push(`Website: ${metadata.website}`);
    if (metadata.version) lines.push(`Version: ${metadata.version}`);
    if (metadata.versionDate) lines.push(`Version Date: ${metadata.versionDate}`);
    if (metadata.purpose) lines.push(`Purpose: ${metadata.purpose}`);
    if (metadata.exportPurpose) lines.push(`Export Purpose: ${metadata.exportPurpose}`);
    if (metadata.classification) lines.push(`Classification: ${metadata.classification}`);
    if (metadata.subject) lines.push(`Subject: ${metadata.subject}`);
    if (metadata.keywords && metadata.keywords.length > 0) {
      lines.push(`Keywords: ${metadata.keywords.join(', ')}`);
    }
    if (metadata.dateRangeStart || metadata.dateRangeEnd) {
      const range = [metadata.dateRangeStart, metadata.dateRangeEnd].filter(Boolean).join(' to ');
      lines.push(`Date Range: ${range}`);
    }
    if (metadata.copyright) lines.push(`Copyright: ${metadata.copyright}`);
    if (metadata.license) lines.push(`License: ${metadata.license}`);
    if (metadata.citation) lines.push(`Citation: ${metadata.citation}`);
    if (metadata.source) lines.push(`Source: ${metadata.source}`);
    lines.push('');
    
    if (metadata.context || metadata.background) {
      lines.push('CONTEXT');
      lines.push('-'.repeat(50));
      if (metadata.context) {
        lines.push(metadata.context);
        lines.push('');
      }
      if (metadata.background) {
        lines.push(metadata.background);
        lines.push('');
      }
    }
    
    if (metadata.rights) {
      lines.push('RIGHTS');
      lines.push('-'.repeat(50));
      lines.push(metadata.rights);
      lines.push('');
    }
    
    if (metadata.relatedDocuments) {
      lines.push('RELATED DOCUMENTS');
      lines.push('-'.repeat(50));
      lines.push(metadata.relatedDocuments);
      lines.push('');
    }
    
    if (metadata.notes || metadata.instructions || metadata.acknowledgments) {
      if (metadata.notes) {
        lines.push('NOTES');
        lines.push('-'.repeat(50));
        lines.push(metadata.notes);
        lines.push('');
      }
      if (metadata.instructions) {
        lines.push('INSTRUCTIONS');
        lines.push('-'.repeat(50));
        lines.push(metadata.instructions);
        lines.push('');
      }
      if (metadata.acknowledgments) {
        lines.push('ACKNOWLEDGMENTS');
        lines.push('-'.repeat(50));
        lines.push(metadata.acknowledgments);
        lines.push('');
      }
    }
  }
  
  lines.push('EXPORT INFORMATION');
  lines.push('-'.repeat(50));
  lines.push(`Exported at: ${metadata?.exportDate || new Date().toISOString()}`);
  if (entries.length > 0) {
    lines.push(`Entries: ${entries.length}`);
  }
  lines.push('');
  lines.push('='.repeat(50));
  lines.push('');
  
  // Entries
  for (const entry of entries) {
    const timeStr = formatEntryTime(entry);
    const dateTimeStr = timeStr ? `${entry.date} ${timeStr}` : entry.date;
    lines.push(`${dateTimeStr} [${entry.timeRange}] - ${entry.title}`);
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
 * Convert hex color to RTF color format (RGB values 0-255)
 */
function hexToRtfColor(hex: string): string {
  const match = hex.match(/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (!match) return '0 0 0'; // Default to black
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `${r} ${g} ${b}`;
}

/**
 * Very simple RTF export aimed at a typewriter-style, monospaced look.
 * We keep formatting minimal for broad compatibility.
 */
function formatAsRtf(entries: JournalEntry[], metadata?: ExportMetadata): string {
  // Get theme colors if theme is specified
  const themeName = metadata?.exportTheme || getPreference('theme') || 'light';
  const colors = extractThemeColors(themeName);
  
  // RTF color table format: {\colortbl;\redR\greenG\blueB;...}
  // Index 0 is auto/default, index 1+ are our colors
  const textColor = hexToRtfColor(colors.text).split(' ');
  const accentColor = hexToRtfColor(colors.accent).split(' ');
  const secondaryColor = hexToRtfColor(colors.secondary).split(' ');
  
  const header = [
    '{\\rtf1\\ansi',
    '{\\fonttbl{\\f0\\fmodern Courier New;}}',
    `{\\colortbl;\\red${textColor[0]}\\green${textColor[1]}\\blue${textColor[2]};\\red${accentColor[0]}\\green${accentColor[1]}\\blue${accentColor[2]};\\red${secondaryColor[0]}\\green${secondaryColor[1]}\\blue${secondaryColor[2]};}`,
    '\\f0\\fs22',
    '\\cf1', // Use text color (index 1, 0 is default/auto)
  ];

  const body: string[] = [];
  const title = metadata?.projectTitle || metadata?.exportName || 'CalenRecall Storybook Export';
  body.push(`\\cf1\\b ${escapeRtf(title)} \\b0\\par`); // Use text color
  body.push('\\par');
  
  // Metadata
  if (metadata) {
    if (metadata.description) {
      body.push(`${escapeRtf(metadata.description)}\\par`);
      body.push('\\par');
    }
    
    body.push('\\b METADATA \\b0\\par');
    if (metadata.author) body.push(`Author: ${escapeRtf(metadata.author)}\\par`);
    if (metadata.organization) body.push(`Organization: ${escapeRtf(metadata.organization)}\\par`);
    if (metadata.department) body.push(`Department: ${escapeRtf(metadata.department)}\\par`);
    if (metadata.contactEmail) body.push(`Email: ${escapeRtf(metadata.contactEmail)}\\par`);
    if (metadata.contactPhone) body.push(`Phone: ${escapeRtf(metadata.contactPhone)}\\par`);
    if (metadata.website) body.push(`Website: ${escapeRtf(metadata.website)}\\par`);
    if (metadata.version) body.push(`Version: ${escapeRtf(metadata.version)}\\par`);
    if (metadata.versionDate) body.push(`Version Date: ${escapeRtf(metadata.versionDate)}\\par`);
    if (metadata.purpose) body.push(`Purpose: ${escapeRtf(metadata.purpose)}\\par`);
    if (metadata.exportPurpose) body.push(`Export Purpose: ${escapeRtf(metadata.exportPurpose)}\\par`);
    if (metadata.classification) body.push(`Classification: ${escapeRtf(metadata.classification)}\\par`);
    if (metadata.subject) body.push(`Subject: ${escapeRtf(metadata.subject)}\\par`);
    if (metadata.keywords && metadata.keywords.length > 0) {
      body.push(`Keywords: ${escapeRtf(metadata.keywords.join(', '))}\\par`);
    }
    if (metadata.dateRangeStart || metadata.dateRangeEnd) {
      const range = [metadata.dateRangeStart, metadata.dateRangeEnd].filter(Boolean).join(' to ');
      body.push(`Date Range: ${escapeRtf(range)}\\par`);
    }
    if (metadata.copyright) body.push(`Copyright: ${escapeRtf(metadata.copyright)}\\par`);
    if (metadata.license) body.push(`License: ${escapeRtf(metadata.license)}\\par`);
    body.push('\\par');
    
    if (metadata.context || metadata.background) {
      body.push('\\b CONTEXT \\b0\\par');
      if (metadata.context) {
        const contextLines = metadata.context.split(/\r?\n/);
        for (const line of contextLines) {
          body.push(`${escapeRtf(line)}\\par`);
        }
        body.push('\\par');
      }
      if (metadata.background) {
        const bgLines = metadata.background.split(/\r?\n/);
        for (const line of bgLines) {
          body.push(`${escapeRtf(line)}\\par`);
        }
        body.push('\\par');
      }
    }
    
    if (metadata.rights) {
      body.push('\\b RIGHTS \\b0\\par');
      const rightsLines = metadata.rights.split(/\r?\n/);
      for (const line of rightsLines) {
        body.push(`${escapeRtf(line)}\\par`);
      }
      body.push('\\par');
    }
    
    if (metadata.relatedDocuments) {
      body.push('\\b RELATED DOCUMENTS \\b0\\par');
      const docLines = metadata.relatedDocuments.split(/\r?\n/);
      for (const line of docLines) {
        body.push(`${escapeRtf(line)}\\par`);
      }
      body.push('\\par');
    }
    
    if (metadata.notes || metadata.instructions || metadata.acknowledgments) {
      if (metadata.notes) {
        body.push('\\b NOTES \\b0\\par');
        const notesLines = metadata.notes.split(/\r?\n/);
        for (const line of notesLines) {
          body.push(`${escapeRtf(line)}\\par`);
        }
        body.push('\\par');
      }
      if (metadata.instructions) {
        body.push('\\b INSTRUCTIONS \\b0\\par');
        const instLines = metadata.instructions.split(/\r?\n/);
        for (const line of instLines) {
          body.push(`${escapeRtf(line)}\\par`);
        }
        body.push('\\par');
      }
      if (metadata.acknowledgments) {
        body.push('\\b ACKNOWLEDGMENTS \\b0\\par');
        const ackLines = metadata.acknowledgments.split(/\r?\n/);
        for (const line of ackLines) {
          body.push(`${escapeRtf(line)}\\par`);
        }
        body.push('\\par');
      }
    }
  }
  
  body.push('\\b EXPORT INFORMATION \\b0\\par');
  body.push(`Exported at: ${escapeRtf(metadata?.exportDate || new Date().toISOString())}\\par`);
  if (entries.length > 0) {
    body.push(`Entries: ${entries.length}\\par`);
  }
  body.push('\\par');

  for (const entry of entries) {
    const timeStr = formatEntryTime(entry);
    const dateTimeStr = timeStr ? `${entry.date} ${timeStr}` : entry.date;
    const titleLine = `${dateTimeStr} (${entry.timeRange}) - ${entry.title}`;
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
function formatAsDecades(entries: JournalEntry[], metadata?: ExportMetadata): string {
  const lines: string[] = [];
  const title = metadata?.projectTitle || metadata?.exportName || 'CalenRecall Decades Export';
  lines.push(title);
  lines.push(`Exported at: ${metadata?.exportDate || new Date().toISOString()}`);
  if (metadata?.author) lines.push(`Author: ${metadata.author}`);
  if (metadata?.organization) lines.push(`Organization: ${metadata.organization}`);
  if (metadata?.version) lines.push(`Version: ${metadata.version}`);
  if (metadata?.purpose) lines.push(`Purpose: ${metadata.purpose}`);
  if (metadata?.classification) lines.push(`Classification: ${metadata.classification}`);
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
        const timeStr = formatEntryTime(entry);
        const dateTimeStr = timeStr ? `${entry.date} ${timeStr}` : entry.date;
        lines.push(
          `    * ${dateTimeStr} [${entry.timeRange}] ${entry.title}`
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
function formatAsCsv(entries: JournalEntry[], metadata?: ExportMetadata): string {
  const lines: string[] = [];
  
  // Metadata comments at top
  if (metadata) {
    const escapeCsvField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };
    
    lines.push('# Export Metadata');
    const title = metadata.projectTitle || metadata.exportName || 'CalenRecall Storybook Export';
    lines.push(`# Title: ${escapeCsvField(title)}`);
    if (metadata.author) lines.push(`# Author: ${escapeCsvField(metadata.author)}`);
    if (metadata.organization) lines.push(`# Organization: ${escapeCsvField(metadata.organization)}`);
    if (metadata.version) lines.push(`# Version: ${escapeCsvField(metadata.version)}`);
    if (metadata.exportDate) lines.push(`# Export Date: ${escapeCsvField(metadata.exportDate)}`);
    if (metadata.purpose) lines.push(`# Purpose: ${escapeCsvField(metadata.purpose)}`);
    if (metadata.classification) lines.push(`# Classification: ${escapeCsvField(metadata.classification)}`);
    lines.push('#');
  }
  
  // CSV header
  lines.push('Date,Time,Time Range,Title,Content,Tags,Created At,Updated At');
  
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
    const timeStr = formatEntryTime(entry);
    const time = escapeCsvField(timeStr);
    const timeRange = escapeCsvField(entry.timeRange);
    const title = escapeCsvField(entry.title);
    const content = escapeCsvField(entry.content);
    const tags = escapeCsvField((entry.tags || []).join('; '));
    const createdAt = escapeCsvField(entry.createdAt);
    const updatedAt = escapeCsvField(entry.updatedAt);
    
    lines.push(`${date},${time},${timeRange},${title},${content},${tags},${createdAt},${updatedAt}`);
  }
  
  return lines.join('\n');
}

/**
 * Generate a PDF storybook using pdfkit.
 */
async function exportEntriesAsPdf(entries: JournalEntry[], filePath: string, metadata?: ExportMetadata): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Get theme styles if theme is specified
      const themeName = metadata?.exportTheme || getPreference('theme') || 'light';
      const themeStyles = extractThemeStyles(themeName);
      const colors = themeStyles.colors;
      
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'LETTER',
      });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);
      
      // Set font family from theme (PDFKit supports limited fonts, so we'll map common ones)
      const fontFamily = themeStyles.fontFamily.toLowerCase();
      let pdfFont = 'Helvetica'; // Default
      if (fontFamily.includes('courier') || fontFamily.includes('mono')) {
        pdfFont = 'Courier';
      } else if (fontFamily.includes('times')) {
        pdfFont = 'Times-Roman';
      }
      // Note: PDFKit doesn't support custom fonts like 'Antonio' directly, but we can use Helvetica-Bold for emphasis
      
      // Helper function to draw background on each page
      const drawPageBackground = () => {
        // Draw a rectangle covering the entire page as background
        (doc as any).fillColor(colors.background);
        (doc as any).rect(0, 0, doc.page.width, doc.page.height);
        (doc as any).fill();
        // Reset fill color to text color for subsequent content
        (doc as any).fillColor(colors.text);
      };
      
      // Draw background on first page
      drawPageBackground();

      const title = metadata?.projectTitle || metadata?.exportName || 'CalenRecall Storybook Export';
      doc.fontSize(20);
      doc.font(`${pdfFont}-Bold`);
      (doc as any).fillColor(colors.text);
      doc.text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      (doc as any).fillColor(colors.secondary);
      doc.text(`Exported at: ${metadata?.exportDate || new Date().toISOString()}`, { align: 'center' });
      
      // Add metadata section
      if (metadata) {
        doc.moveDown();
        let metadataLines: string[] = [];
        if (metadata.author) metadataLines.push(`Author: ${metadata.author}`);
        if (metadata.organization) metadataLines.push(`Organization: ${metadata.organization}`);
        if (metadata.department) metadataLines.push(`Department: ${metadata.department}`);
        if (metadata.version) metadataLines.push(`Version: ${metadata.version}`);
        if (metadata.purpose) metadataLines.push(`Purpose: ${metadata.purpose}`);
        if (metadata.exportPurpose) metadataLines.push(`Export Purpose: ${metadata.exportPurpose}`);
        if (metadata.classification) metadataLines.push(`Classification: ${metadata.classification}`);
        if (metadata.keywords && metadata.keywords.length > 0) {
          metadataLines.push(`Keywords: ${metadata.keywords.join(', ')}`);
        }
        if (metadata.copyright) metadataLines.push(`Copyright: ${metadata.copyright}`);
        if (metadata.license) metadataLines.push(`License: ${metadata.license}`);
        
        if (metadataLines.length > 0) {
          doc.fontSize(9);
          (doc as any).fillColor(colors.secondary);
          doc.text(metadataLines.join(' | '), { align: 'center' });
        }
        
        if (metadata.description) {
          doc.moveDown();
          doc.fontSize(10);
          doc.font(pdfFont);
          (doc as any).fillColor(colors.text);
          doc.text(metadata.description, { align: 'left' });
        }
        
        if (metadata.context || metadata.background) {
          doc.moveDown();
          if (metadata.context) {
            doc.fontSize(9);
            doc.font(`${pdfFont}-Oblique`);
            (doc as any).fillColor(colors.accent);
            doc.text('Context:', { align: 'left' });
            doc.fontSize(9);
            doc.font(pdfFont);
            (doc as any).fillColor(colors.text);
            doc.text(metadata.context, { align: 'left' });
          }
          if (metadata.background) {
            doc.moveDown(0.5);
            doc.fontSize(9);
            doc.font(`${pdfFont}-Oblique`);
            (doc as any).fillColor(colors.accent);
            doc.text('Background:', { align: 'left' });
            doc.fontSize(9);
            doc.font(pdfFont);
            (doc as any).fillColor(colors.text);
            doc.text(metadata.background, { align: 'left' });
          }
        }
      }
      
      doc.moveDown(2);

      for (const entry of entries) {
        const timeStr = formatEntryTime(entry);
        const dateTimeStr = timeStr ? `${entry.date} ${timeStr}` : entry.date;
        const titleLine = `${dateTimeStr} (${entry.timeRange}) — ${entry.title}`;
        doc.fontSize(14).font('Helvetica-Bold');
        (doc as any).fillColor(colors.text);
        doc.text(titleLine);

        if (entry.tags && entry.tags.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10);
          doc.font(`${pdfFont}-Oblique`);
          (doc as any).fillColor(colors.accent);
          doc.text(`Tags: ${entry.tags.join(', ')}`);
        }

        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.font(pdfFont); // Use theme font
        (doc as any).fillColor(colors.text);
        doc.text(entry.content, { align: 'left' });
        doc.moveDown(1);

        // Add a separator using theme border color
        doc.moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor(colors.border)
          .stroke();

        doc.moveDown(1);

        // Start a new page if we're near the bottom
        if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
          doc.addPage();
          // Draw background on new page
          drawPageBackground();
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

