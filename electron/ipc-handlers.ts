import { ipcMain, dialog, app, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { validatePath, sanitizeFileName, safePathJoin } from './utils/pathValidation';
import {
  isValidTimeRange,
  isValidExportFormat,
  isValidPreferenceKey,
  isValidDateString,
  isValidEntryId,
  validateJournalEntry,
  validateExportMetadata,
} from './utils/inputValidation';

interface ThemeColors {
  background: string;
  text: string;
  accent: string;
  border: string;
  secondary: string;
  // Extended palette for richer themes
  cardBg?: string;        // Card/entry background
  cardBorder?: string;    // Card border color
  headerBg?: string;      // Header/nav background
  selected?: string;      // Selected/highlight color (e.g., green for tabletop)
  gold?: string;          // Gold/yellow accent (e.g., #ffd700 for tabletop)
  lightBg?: string;       // Light background variant
  darkBg?: string;        // Dark background variant
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
  // Extended styling properties
  cardBorderRadius?: string;
  cardBoxShadow?: string;
  cardBorderStyle?: 'solid' | 'inset' | 'outset' | 'dashed';
  badgeBorderRadius?: string;
  headerBorderRadius?: string;
  headerBoxShadow?: string;
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
    
    // Extract colors using regex patterns - comprehensive extraction
    // Look for body background and color
    const bodyBgMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*body\s*\{[^}]*background:\s*([^;]+);/i);
    const bodyColorMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*body\s*\{[^}]*color:\s*([^;]+);/i);
    
    // Look for accent colors (nav-button active, date-input focus, etc.)
    const accentMatch = cssContent.match(/(?:nav-button\.active|\.active|accent|primary)[^}]*color:\s*([^;]+);/i) ||
                       cssContent.match(/(?:border.*color|border-color):\s*([^;]+);/i);
    
    // Look for border colors
    const borderMatch = cssContent.match(/border(?:-bottom)?:\s*\d+px\s+(?:solid|dashed)\s+([^;]+);/i);
    
    // Extract extended palette colors - theme-agnostic patterns
    // Card/entry backgrounds (timeline-cell, journal-entry-item, etc.) - any theme
    const cardBgMatch = cssContent.match(/(?:timeline-cell|journal-entry-item|\.entry-item|\.period-entry-item)[^}]*background[^:]*:\s*([^;]+);/i) ||
                       cssContent.match(/\.timeline-cell\s*\{[^}]*background:\s*([^;]+);/i) ||
                       cssContent.match(/\.journal-entry-item\s*\{[^}]*background:\s*([^;]+);/i);
    
    // Selected/highlight colors (selected cells, active states) - any color, not just green
    const selectedMatch = cssContent.match(/\.selected[^}]*background[^:]*:\s*([^;]+);/i) ||
                         cssContent.match(/\.timeline-cell\.selected[^}]*background:\s*([^;]+);/i) ||
                         cssContent.match(/\.active[^}]*background[^:]*:\s*([^;]+);/i);
    
    // Gold/yellow accents (today, highlights) - look for any gold/yellow color, not just specific hex codes
    const goldMatch = cssContent.match(/(?:#ffd700|#ffed4e|#ffb347|#ffff00|gold|yellow)[^;]*/i) ||
                     cssContent.match(/\.today[^}]*background[^:]*:\s*([^;]+);/i);
    
    // Header/nav backgrounds - any theme
    const headerBgMatch = cssContent.match(/\.navigation-bar[^}]*background[^:]*:\s*([^;]+);/i) ||
                         cssContent.match(/\.navigation-bar-top-row[^}]*background:\s*([^;]+);/i) ||
                         cssContent.match(/\.nav-controls[^}]*background[^:]*:\s*([^;]+);/i);
    
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
    
    // Extract extended palette - all optional, with fallbacks (works for ANY theme)
    const cardBg = extractColor(cardBgMatch?.[1] || '') ?? undefined;
    
    // Extract selected color - try to get hex from match, or extract from background property
    // This works for any theme that has .selected or .active states
    let selected: string | undefined = undefined;
    if (selectedMatch) {
      const extracted = extractColor(selectedMatch[1] || '');
      selected = extracted ?? undefined;
      // If extraction failed, try to find any hex color in the matched line
      if (!selected && selectedMatch[0]) {
        const hexInMatch = selectedMatch[0].match(/#[0-9a-fA-F]{3,6}/i);
        if (hexInMatch) selected = hexInMatch[0];
      }
    }
    
    // Extract gold/yellow color - try to get from .today background or find gold hex
    // This works for any theme that uses gold/yellow for highlights
    let gold: string | undefined = undefined;
    if (goldMatch) {
      // If it's a background match, extract the color
      if (goldMatch[1]) {
        const extracted = extractColor(goldMatch[1]);
        gold = extracted ?? undefined;
      }
      // Otherwise, try to find hex color in the match
      if (!gold && goldMatch[0]) {
        const hexInMatch = goldMatch[0].match(/#[0-9a-fA-F]{3,6}/i);
        if (hexInMatch) gold = hexInMatch[0];
      }
    }
    
    const headerBg = extractColor(headerBgMatch?.[1] || '') ?? undefined;
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
    
    // Extract border radius - general and specific
    const borderRadiusMatch = cssContent.match(/\[data-theme=["']?[^"']*["']?\]\s*\*\s*\{[^}]*border-radius:\s*([^;]+);/i);
    const borderRadius = borderRadiusMatch?.[1]?.trim() || defaultStyles.borderRadius;
    
    // Extract card-specific border radius
    const cardBorderRadiusMatch = cssContent.match(/(?:\.timeline-cell|\.journal-entry-item|\.entry-item|\.period-entry-item)[^}]*border-radius:\s*([^;]+);/i);
    const cardBorderRadius = cardBorderRadiusMatch?.[1]?.trim() || borderRadius;
    
    // Extract badge border radius
    const badgeBorderRadiusMatch = cssContent.match(/(?:\.badge|\.tag|\.viewer-tag|\.entry-tag)[^}]*border-radius:\s*([^;]+);/i);
    const badgeBorderRadius = badgeBorderRadiusMatch?.[1]?.trim() || '12px'; // Default rounded
    
    // Extract header border radius
    const headerBorderRadiusMatch = cssContent.match(/\.navigation-bar[^}]*border-radius:\s*([^;]+);/i);
    const headerBorderRadius = headerBorderRadiusMatch?.[1]?.trim() || '0';
    
    // Extract box shadow - general and specific
    const boxShadowMatch = cssContent.match(/(?:\.navigation-bar|\.nav-button)[^}]*box-shadow:\s*([^;]+);/i);
    const boxShadow = boxShadowMatch?.[1]?.trim() || defaultStyles.boxShadow;
    
    // Extract card-specific box shadow
    const cardBoxShadowMatch = cssContent.match(/(?:\.timeline-cell|\.journal-entry-item|\.entry-item|\.period-entry-item)[^}]*box-shadow:\s*([^;]+);/i);
    const cardBoxShadow = cardBoxShadowMatch?.[1]?.trim() || boxShadow;
    
    // Extract header box shadow
    const headerBoxShadowMatch = cssContent.match(/\.navigation-bar[^}]*box-shadow:\s*([^;]+);/i);
    const headerBoxShadow = headerBoxShadowMatch?.[1]?.trim() || boxShadow;
    
    // Extract border style (inset/outset/solid) from cards
    const cardBorderStyleMatch = cssContent.match(/(?:\.timeline-cell|\.journal-entry-item|\.entry-item|\.period-entry-item)[^}]*border[^:]*:\s*[^}]*\s+(inset|outset|solid|dashed)/i);
    const cardBorderStyle = cardBorderStyleMatch?.[1]?.toLowerCase() as 'solid' | 'inset' | 'outset' | 'dashed' | undefined;
    
    return {
      colors: {
        background,
        text,
        accent,
        border,
        secondary,
        // Extended palette (all optional - will use fallbacks if not found)
        cardBg,
        headerBg,
        selected,
        gold,
      },
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      textShadow,
      borderRadius,
      boxShadow,
      // Extended styling properties
      cardBorderRadius,
      cardBoxShadow,
      cardBorderStyle,
      badgeBorderRadius,
      headerBorderRadius,
      headerBoxShadow,
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
    // Validate input
    if (!isValidDateString(date)) {
      return null;
    }
    if (!isValidTimeRange(timeRange)) {
      return null;
    }
    return getEntry(date, timeRange);
  });

  ipcMain.handle('get-entry-by-id', async (_event, id: number) => {
    // Validate input
    if (!isValidEntryId(id)) {
      return null;
    }
    const { getEntryById } = require('./database');
    return getEntryById(id);
  });

  ipcMain.handle('get-entry-versions', async (_event, entryId: number) => {
    // Validate input
    if (!isValidEntryId(entryId)) {
      return [];
    }
    return getEntryVersions(entryId);
  });

  ipcMain.handle('archive-entry', async (_event, id: number) => {
    // Validate input
    if (!isValidEntryId(id)) {
      return { success: false, error: 'Invalid entry ID' };
    }
    archiveEntry(id);
    return { success: true };
  });

  ipcMain.handle('unarchive-entry', async (_event, id: number) => {
    // Validate input
    if (!isValidEntryId(id)) {
      return { success: false, error: 'Invalid entry ID' };
    }
    unarchiveEntry(id);
    return { success: true };
  });

  ipcMain.handle('get-archived-entries', async () => {
    return getArchivedEntries();
  });

  ipcMain.handle('pin-entry', async (_event, id: number) => {
    // Validate input
    if (!isValidEntryId(id)) {
      return { success: false, error: 'Invalid entry ID' };
    }
    pinEntry(id);
    return { success: true };
  });

  ipcMain.handle('unpin-entry', async (_event, id: number) => {
    // Validate input
    if (!isValidEntryId(id)) {
      return { success: false, error: 'Invalid entry ID' };
    }
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
    // Validate input
    if (!isValidEntryId(entryId)) {
      return {
        success: false,
        error: 'invalid_entry_id',
        message: 'Invalid entry ID',
      };
    }
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

      // Generate unique filename with sanitization
      const fileExt = path.extname(sourcePath);
      const fileName = path.basename(sourcePath);
      const sanitizedFileName = sanitizeFileName(fileName);
      if (!sanitizedFileName) {
        return {
          success: false,
          error: 'invalid_filename',
          message: 'Invalid filename provided',
        };
      }
      
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const destFileName = `${entryId}-${uniqueId}${fileExt}`;
      const destPath = safePathJoin(attachmentsDir, destFileName);
      
      if (!destPath || !validatePath(destPath, attachmentsDir)) {
        return {
          success: false,
          error: 'invalid_path',
          message: 'Invalid file path detected',
        };
      }

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
    } catch (error: unknown) {
      console.error('Error adding attachment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add attachment';
      return {
        success: false,
        error: 'add_failed',
        message: errorMessage,
      };
    }
  });

  /**
   * Remove an attachment from an entry.
   */
  ipcMain.handle('remove-entry-attachment', async (_event, entryId: number, attachmentId: string) => {
    // Validate input
    if (!isValidEntryId(entryId)) {
      return {
        success: false,
        error: 'invalid_entry_id',
        message: 'Invalid entry ID',
      };
    }
    if (typeof attachmentId !== 'string' || attachmentId.trim() === '') {
      return {
        success: false,
        error: 'invalid_attachment_id',
        message: 'Invalid attachment ID',
      };
    }
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

      // Validate and delete file
      const userDataPath = app.getPath('userData');
      const attachmentsDir = path.join(userDataPath, 'attachments');
      
      if (!validatePath(attachment.filePath, attachmentsDir)) {
        return {
          success: false,
          error: 'invalid_path',
          message: 'Invalid attachment path detected',
        };
      }
      
      if (fs.existsSync(attachment.filePath)) {
        fs.unlinkSync(attachment.filePath);
      }

      // Remove from entry
      entry.attachments = attachments.filter((a: EntryAttachment) => a.id !== attachmentId);
      saveEntry(entry);

      return { success: true };
    } catch (error: unknown) {
      console.error('Error removing attachment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove attachment';
      return {
        success: false,
        error: 'remove_failed',
        message: errorMessage,
      };
    }
  });

  /**
   * Get attachment file path for opening.
   * Validates the path to prevent path traversal attacks.
   */
  ipcMain.handle('get-attachment-path', async (_event, entryId: number, attachmentId: string) => {
    // Validate input
    if (!isValidEntryId(entryId)) {
      return { success: false, error: 'invalid_entry_id' };
    }
    if (typeof attachmentId !== 'string' || attachmentId.trim() === '') {
      return { success: false, error: 'invalid_attachment_id' };
    }
    const { getEntryById } = require('./database');
    const entry = getEntryById(entryId);

    if (!entry || !entry.attachments) {
      return { success: false, error: 'not_found' };
    }

    const attachment = entry.attachments.find((a: EntryAttachment) => a.id === attachmentId);
    if (!attachment) {
      return { success: false, error: 'not_found' };
    }

    // Validate attachment path to prevent path traversal
    const userDataPath = app.getPath('userData');
    const attachmentsDir = path.join(userDataPath, 'attachments');
    
    if (!validatePath(attachment.filePath, attachmentsDir)) {
      return {
        success: false,
        error: 'invalid_path',
        message: 'Invalid attachment path detected',
      };
    }

    if (!fs.existsSync(attachment.filePath)) {
      return { success: false, error: 'not_found' };
    }

    return { success: true, path: attachment.filePath };
  });

  ipcMain.handle('get-entries-by-date-range', async (_event, date: string, timeRange: TimeRange) => {
    // Validate input
    if (!isValidDateString(date)) {
      return [];
    }
    if (!isValidTimeRange(timeRange)) {
      return [];
    }
    return getEntriesByDateAndRange(date, timeRange);
  });

  ipcMain.handle('save-entry', async (_event, entry: JournalEntry) => {
    try {
      // Validate input
      const validation = validateJournalEntry(entry);
      if (!validation.valid) {
        return {
          success: false,
          entry,
          error: validation.error || 'Invalid entry data',
        };
      }
      
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
    // Validate input
    if (!isValidEntryId(id)) {
      throw new Error('Invalid entry ID');
    }
    deleteEntry(id);
  });

  ipcMain.handle('delete-entry-by-date-range', async (_event, date: string, timeRange: TimeRange) => {
    // Validate input
    if (!isValidDateString(date)) {
      throw new Error('Invalid date string');
    }
    if (!isValidTimeRange(timeRange)) {
      throw new Error('Invalid time range');
    }
    deleteEntryByDateAndRange(date, timeRange);
  });

  ipcMain.handle('search-entries', async (_event, query: string) => {
    return searchEntries(query);
  });

  ipcMain.handle('get-entries-by-range', async (_event, range: TimeRange, value: number) => {
    // Validate input
    if (!isValidTimeRange(range)) {
      return [];
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return [];
    }
    return getEntriesByRange(range, value);
  });

  /**
   * Export all journal entries to a user-selected document file.
   * The renderer passes an export format and optional metadata; this handler opens a save dialog,
   * formats the content with metadata, and writes it to disk.
   */
  ipcMain.handle('export-entries', async (_event, format: ExportFormat, metadata?: ExportMetadata) => {
    // Validate input
    if (!isValidExportFormat(format)) {
      return {
        success: false,
        canceled: false,
        error: 'invalid_format',
        message: 'Invalid export format',
      };
    }
    
    // Validate metadata if provided
    if (metadata !== undefined) {
      const metadataValidation = validateExportMetadata(metadata);
      if (!metadataValidation.valid) {
        return {
          success: false,
          canceled: false,
          error: 'invalid_metadata',
          message: metadataValidation.error || 'Invalid export metadata',
        };
      }
    }
    
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
      
      // Verify file was written successfully
      if (!fs.existsSync(filePath)) {
        console.error('[Export] File was not created:', filePath);
        return { 
          success: false, 
          canceled: false, 
          error: 'write_failed', 
          message: 'File was not created. Check disk space and permissions.' 
        };
      }
      
      // Open the folder containing the exported file (non-blocking - don't fail export if this fails)
      try {
        shell.showItemInFolder(filePath);
      } catch (showError) {
        console.warn('[Export] Could not show file in folder (export still succeeded):', showError);
        // Don't fail the export if showing the file fails
      }
      
      return { success: true, canceled: false, path: filePath };
    } catch (error: unknown) {
      console.error('[Export] Error exporting entries:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      
      // Provide more specific error messages
      let userMessage = errorMessage;
      if (errorCode === 'ENOSPC') {
        userMessage = 'Not enough disk space to export file.';
      } else if (errorCode === 'EACCES' || errorCode === 'EPERM') {
        userMessage = 'Permission denied. Check file permissions.';
      } else if (errorCode === 'ENOENT') {
        userMessage = 'Directory does not exist.';
      } else if (errorMessage.includes('ENOSPC')) {
        userMessage = 'Not enough disk space to export file.';
      } else if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
        userMessage = 'Permission denied. Check file permissions.';
      }
      
      return { 
        success: false, 
        canceled: false, 
        error: 'write_failed', 
        message: userMessage,
        details: errorMessage 
      };
    }
  });

  // Preferences handlers
  ipcMain.handle('get-preference', async (_event, key: keyof Preferences) => {
    return getPreference(key);
  });

  ipcMain.handle('set-preference', async (event, key: keyof Preferences, value: Preferences[keyof Preferences]) => {
    // Validate input
    if (!isValidPreferenceKey(key)) {
      return {
        success: false,
        error: 'Invalid preference key',
      };
    }
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

  // Open external URL in the default browser
  ipcMain.handle('open-external-browser', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: unknown) {
      console.error('Error opening external URL in browser:', error);
      const errorMessage = error instanceof Error ? error.message : 'unknown_error';
      return { success: false, error: errorMessage };
    }
  });

  // Open external URL in a new BrowserWindow with specified dimensions
  ipcMain.handle('open-external-url', async (_event, url: string, width: number, height: number) => {
    try {
      // Determine icon path for AstroMonix window (same pattern as main.ts)
      const iconPath = path.join(__dirname, '../assets/astromonixlogo.png');
      
      const externalWindow = new BrowserWindow({
        width: width,
        height: height,
        ...(process.platform === 'win32' && fs.existsSync(iconPath) && {
          icon: iconPath,
        }),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
        },
        show: false,
      });

      externalWindow.loadURL(url);
      externalWindow.once('ready-to-show', () => {
        externalWindow.show();
      });

      externalWindow.on('closed', () => {
        // Window is already being destroyed
      });

      return { success: true };
    } catch (error) {
      console.error('[IPC] Error opening external URL:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
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
    } catch (error: unknown) {
      console.error('[IPC] ❌ Error refreshing main window theme:', error);
      const errorMessage = error instanceof Error ? error.message : 'unknown_error';
      return { success: false, error: errorMessage };
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
    } catch (error: unknown) {
      console.error('Error importing entries:', error);
      const importErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      event.sender.send('import-progress', {
        stage: 'error',
        progress: 0,
        message: `Import failed: ${importErrorMessage}`,
      });
      const readErrorMessage = error instanceof Error ? error.message : 'Failed to read file';
      return {
        success: false,
        canceled: false,
        error: 'read_failed',
        message: readErrorMessage,
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
    } catch (error: unknown) {
      console.error('Error backing up database:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        canceled: false,
        error: 'backup_failed',
        message: errorMessage,
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
    } catch (error: unknown) {
      console.error('Error restoring database:', error);
      const restoreErrorMessage = error instanceof Error ? error.message : 'Failed to restore database';
      
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
        message: restoreErrorMessage,
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
    } catch (error: unknown) {
      console.error('Error copying background image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        canceled: false,
        error: 'copy_failed',
        message: errorMessage,
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
    } catch (error: unknown) {
      console.error('Error clearing background image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear background image';
      return {
        success: false,
        error: 'clear_failed',
        message: errorMessage,
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
          // Validate theme file path to prevent path traversal
          const safePath = safePathJoin(customThemesDir, file);
          if (!safePath || !validatePath(safePath, customThemesDir)) {
            console.error(`[IPC] Invalid theme file path detected: ${file}`);
            continue;
          }
          
          const cssPath = safePath;
          const cssContent = fs.readFileSync(cssPath, 'utf-8');
          themes.push({ name: themeName, css: cssContent });
        } catch (error) {
          console.error(`[IPC] Error reading custom theme file ${file}:`, error);
        }
      }
      
      return { success: true, themes };
    } catch (error: unknown) {
      console.error('[IPC] Error getting custom themes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get custom themes';
      return {
        success: false,
        error: 'get_failed',
        message: errorMessage,
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
      
      // Validate and sanitize the background image path
      const safePath = safePathJoin(userDataPath, bgImage);
      if (!safePath || !validatePath(safePath, userDataPath)) {
        console.error('[IPC] Invalid background image path detected:', bgImage);
        return {
          success: false,
          error: 'invalid_path',
          message: 'Invalid background image path',
        };
      }
      
      const fullPath = safePath;
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
      } catch (readError: unknown) {
        console.error('[IPC] Error reading image file:', readError);
        const readErrorMessage = readError instanceof Error ? readError.message : 'Unknown error';
        return {
          success: false,
          error: 'read_failed',
          message: `Failed to read image file: ${readErrorMessage}`,
        };
      }
    } catch (error: unknown) {
      console.error('[IPC] Error getting background image path:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get background image path';
      return {
        success: false,
        error: 'get_path_failed',
        message: errorMessage,
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
        margin: 40,
        size: 'LETTER',
      });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);
      
      // Set font family from theme (PDFKit supports limited fonts, so we'll map common ones)
      // PDFKit built-in fonts: Helvetica, Courier, Times-Roman
      // Variants: Helvetica-Bold, Helvetica-Oblique, Courier-Bold, Courier-Oblique, Times-Bold, Times-Italic
      const fontFamily = themeStyles.fontFamily.toLowerCase();
      let pdfFont = 'Helvetica'; // Default
      if (fontFamily.includes('courier') || fontFamily.includes('mono')) {
        pdfFont = 'Courier';
      } else if (fontFamily.includes('times')) {
        pdfFont = 'Times-Roman';
      }
      
      // Helper function to get correct font variant names for PDFKit
      const getFontVariant = (baseFont: string, variant: 'bold' | 'oblique' | 'italic'): string => {
        if (baseFont === 'Times-Roman') {
          return variant === 'bold' ? 'Times-Bold' : 'Times-Italic';
        } else if (baseFont === 'Helvetica') {
          return variant === 'bold' ? 'Helvetica-Bold' : 'Helvetica-Oblique';
        } else if (baseFont === 'Courier') {
          return variant === 'bold' ? 'Courier-Bold' : 'Courier-Oblique';
        }
        return variant === 'bold' ? 'Helvetica-Bold' : 'Helvetica-Oblique';
      };
      
      // Helper function to convert hex to RGB
      const hexToRgb = (hex: string): [number, number, number] | null => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : null;
      };
      
      // Helper function to calculate relative luminance (for contrast calculation)
      const getLuminance = (r: number, g: number, b: number): number => {
        const [rs, gs, bs] = [r, g, b].map(val => {
          val = val / 255;
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };
      
      // Helper function to calculate contrast ratio between two colors
      const getContrastRatio = (color1: string, color2: string): number => {
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        if (!rgb1 || !rgb2) return 4.5; // Default to acceptable contrast
        
        const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
        const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
      };
      
      // Helper function to get readable text color for a background
      const getReadableTextColor = (bgColor: string, lightText: string = '#ffffff', darkText: string = '#000000'): string => {
        const bgRgb = hexToRgb(bgColor);
        if (!bgRgb) return darkText;
        
        const bgLum = getLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
        // If background is dark (luminance < 0.5), use light text, otherwise dark text
        return bgLum < 0.5 ? lightText : darkText;
      };
      
      // Helper function to lighten or darken a color
      const adjustColorBrightness = (hex: string, percent: number): string => {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;
        
        const [r, g, b] = rgb.map(val => {
          const newVal = Math.max(0, Math.min(255, val + (percent * 255 / 100)));
          return Math.round(newVal);
        });
        
        return `#${[r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('')}`;
      };
      
      // Calculate card background color - use theme's card color if available, otherwise adjust
      // This works for ANY theme - if cardBg is found, use it; otherwise create a contrasting variant
      let cardBgColor: string;
      if (colors.cardBg) {
        cardBgColor = colors.cardBg;
      } else {
        // Fallback: create a contrasting card background from theme background
        const bgLum = hexToRgb(colors.background) ? getLuminance(...hexToRgb(colors.background)!) : 0.5;
        cardBgColor = bgLum > 0.5 
          ? adjustColorBrightness(colors.background, -10) // Darken light backgrounds
          : adjustColorBrightness(colors.background, 10); // Lighten dark backgrounds
      }
      
      // Ensure card text is readable
      const cardTextColor = getReadableTextColor(cardBgColor, colors.text, colors.text);
      
      // Helper function to draw background on each page
      const drawPageBackground = () => {
        doc.fillColor(colors.background);
        doc.rect(0, 0, doc.page.width, doc.page.height);
        doc.fill();
        doc.fillColor(colors.text);
      };
      
      // Helper function to parse CSS border-radius to pixels
      const parseBorderRadius = (radius: string): number => {
        if (!radius || radius === '0' || radius === 'none') return 0;
        const match = radius.match(/(\d+(?:\.\d+)?)(?:px|rem|em)?/);
        if (match) {
          let value = parseFloat(match[1]);
          // Convert rem/em to pixels (assuming 16px base)
          if (radius.includes('rem') || radius.includes('em')) {
            value = value * 16;
          }
          return Math.round(value);
        }
        return 0;
      };
      
      // Helper function to parse box-shadow and apply visual effect
      const applyBoxShadow = (x: number, y: number, width: number, height: number, shadow: string) => {
        if (!shadow || shadow === 'none') return;
        
        // Parse box-shadow: offsetX offsetY blur spread color
        const shadowMatch = shadow.match(/(?:inset\s+)?(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]{3,6})/i);
        if (shadowMatch) {
          const offsetX = parseFloat(shadowMatch[1]);
          const offsetY = parseFloat(shadowMatch[2]);
          const blur = parseFloat(shadowMatch[3]);
          const color = shadowMatch[5];
          
          // Draw shadow as a slightly offset rectangle
          // PDFKit doesn't support blur, so we simulate with a darker/lighter rectangle
          let shadowColor = '#000000';
          let shadowAlpha = 0.3;
          
          if (color.includes('rgba')) {
            // Extract rgba values
            const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (rgbaMatch) {
              const r = parseInt(rgbaMatch[1]);
              const g = parseInt(rgbaMatch[2]);
              const b = parseInt(rgbaMatch[3]);
              shadowAlpha = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 0.3;
              shadowColor = `#${[r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
              }).join('')}`;
            }
          } else if (color.includes('#')) {
            shadowColor = color;
          }
          
          // Draw shadow rectangle (simplified - PDFKit doesn't support true blur)
          // Use a semi-transparent darker version for shadow effect
          const shadowRgb = hexToRgb(shadowColor);
          if (shadowRgb) {
            const darkerShadow = adjustColorBrightness(shadowColor, -30);
            doc.fillColor(darkerShadow);
            doc.rect(x + offsetX, y + offsetY, width, height);
            doc.fill();
          }
        }
      };
      
      // Helper function to draw a card/box with border, rounded corners, and shadows
      const drawCard = (x: number, y: number, width: number, height: number, padding: number = 0) => {
        const borderRadius = parseBorderRadius(themeStyles.cardBorderRadius || '0');
        
        // Apply box shadow if present (draw shadow first, behind the card)
        if (themeStyles.cardBoxShadow && themeStyles.cardBoxShadow !== 'none') {
          applyBoxShadow(x, y, width, height, themeStyles.cardBoxShadow);
        }
        
        // Card background - use theme's card color
        doc.fillColor(cardBgColor);
        if (borderRadius > 0) {
          // Use rounded rectangle if supported, otherwise use regular rect
          try {
            (doc as any).roundedRect(x, y, width, height, borderRadius);
          } catch {
            doc.rect(x, y, width, height);
          }
        } else {
          doc.rect(x, y, width, height);
        }
        doc.fill();
        
        // Card border - use theme border color or card border if available
        const borderColor = colors.border || adjustColorBrightness(cardBgColor, -20);
        doc.strokeColor(borderColor);
        
        // Apply border style (inset/outset effect by adjusting border position)
        let borderX = x;
        let borderY = y;
        let borderWidth = width;
        let borderHeight = height;
        
        if (themeStyles.cardBorderStyle === 'inset') {
          // Inset: border appears inside, create darker inner border
          borderX = x + 2;
          borderY = y + 2;
          borderWidth = width - 4;
          borderHeight = height - 4;
        } else if (themeStyles.cardBorderStyle === 'outset') {
          // Outset: border appears raised, create lighter outer border
          borderX = x - 1;
          borderY = y - 1;
          borderWidth = width + 2;
          borderHeight = height + 2;
        }
        
        if (borderRadius > 0) {
          try {
            (doc as any).roundedRect(borderX, borderY, borderWidth, borderHeight, borderRadius);
          } catch {
            doc.rect(borderX, borderY, borderWidth, borderHeight);
          }
        } else {
          doc.rect(borderX, borderY, borderWidth, borderHeight);
        }
        doc.stroke();
        
        return { x: x + padding, y: y + padding, width: width - (padding * 2), height: height - (padding * 2) };
      };
      
      // Helper function to get text width (using type assertion for PDFKit methods)
      const getTextWidth = (text: string): number => {
        return (doc as any).widthOfString(text) || text.length * 6; // Fallback estimate
      };
      
      // Helper function to draw a badge/tag with rounded corners and proper contrast
      const drawBadge = (x: number, y: number, text: string, bgColor: string, textColor: string) => {
        const padding = 6;
        const fontSize = 8;
        doc.fontSize(fontSize);
        doc.font(pdfFont);
        const textWidth = getTextWidth(text);
        const badgeWidth = textWidth + (padding * 2);
        const badgeHeight = fontSize + (padding * 2);
        const badgeRadius = parseBorderRadius(themeStyles.badgeBorderRadius || '12px');
        
        // Ensure badge text color has proper contrast
        const readableBadgeText = getContrastRatio(textColor, bgColor) >= 4.5 
          ? textColor 
          : getReadableTextColor(bgColor);
        
        // Badge background with rounded corners
        doc.fillColor(bgColor);
        if (badgeRadius > 0) {
          try {
            (doc as any).roundedRect(x, y, badgeWidth, badgeHeight, badgeRadius);
          } catch {
            doc.rect(x, y, badgeWidth, badgeHeight);
          }
        } else {
          doc.rect(x, y, badgeWidth, badgeHeight);
        }
        doc.fill();
        
        // Badge border for definition with rounded corners
        doc.strokeColor(adjustColorBrightness(bgColor, -20));
        if (badgeRadius > 0) {
          try {
            (doc as any).roundedRect(x, y, badgeWidth, badgeHeight, badgeRadius);
          } catch {
            doc.rect(x, y, badgeWidth, badgeHeight);
          }
        } else {
          doc.rect(x, y, badgeWidth, badgeHeight);
        }
        doc.stroke();
        
        // Badge text
        doc.fillColor(readableBadgeText);
        doc.text(text, x + padding, y + padding);
        
        return badgeWidth + 4; // Return width plus spacing
      };
      
      // Draw background on first page
      drawPageBackground();

      // Header section - styled like navigation bar with theme colors
      const headerY = doc.page.margins.top;
      const headerHeight = 80;
      const headerWidth = doc.page.width - (doc.page.margins.left * 2);
      const headerX = doc.page.margins.left;
      
      // Header background - use theme's header color if available, otherwise accent or adjusted background
      const headerBgColor = colors.headerBg || colors.accent || adjustColorBrightness(colors.background, -15);
      const headerTextColor = getReadableTextColor(headerBgColor);
      const headerRadius = parseBorderRadius(themeStyles.headerBorderRadius || '0');
      
      // Apply header box shadow if present
      if (themeStyles.headerBoxShadow && themeStyles.headerBoxShadow !== 'none') {
        applyBoxShadow(headerX, headerY, headerWidth, headerHeight, themeStyles.headerBoxShadow);
      }
      
      // Draw header background with rounded corners
      doc.fillColor(headerBgColor);
      if (headerRadius > 0) {
        try {
          (doc as any).roundedRect(headerX, headerY, headerWidth, headerHeight, headerRadius);
        } catch {
          doc.rect(headerX, headerY, headerWidth, headerHeight);
        }
      } else {
        doc.rect(headerX, headerY, headerWidth, headerHeight);
      }
      doc.fill();
      
      // Header border with rounded corners
      doc.strokeColor(colors.border || adjustColorBrightness(headerBgColor, -20));
      if (headerRadius > 0) {
        try {
          (doc as any).roundedRect(headerX, headerY, headerWidth, headerHeight, headerRadius);
        } catch {
          doc.rect(headerX, headerY, headerWidth, headerHeight);
        }
      } else {
        doc.rect(headerX, headerY, headerWidth, headerHeight);
      }
      doc.stroke();
      
      const headerPadding = 15;
      doc.y = headerY + headerPadding;
      
      const title = metadata?.projectTitle || metadata?.exportName || 'CalenRecall Storybook Export';
      doc.fontSize(24);
      doc.font(getFontVariant(pdfFont, 'bold'));
      doc.fillColor(headerTextColor);
      doc.text(title, headerX + headerPadding, doc.y, { align: 'center', width: headerWidth - (headerPadding * 2) });
      
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.font(pdfFont);
      doc.fillColor(adjustColorBrightness(headerTextColor, -20)); // Slightly dimmed for secondary text
      const exportDate = metadata?.exportDate || new Date().toISOString();
      doc.text(`Exported: ${exportDate}`, headerX + headerPadding, doc.y, { align: 'center', width: headerWidth - (headerPadding * 2) });
      
      // Metadata section - if provided (use theme colors)
      if (metadata && (metadata.author || metadata.organization || metadata.version || metadata.keywords)) {
        doc.y = headerY + headerHeight + 20;
        const metadataY = doc.y;
        const metadataHeight = 60;
        const metadataCard = drawCard(headerX, metadataY, headerWidth, metadataHeight, 12);
        doc.y = metadataCard.y;
        
        let metadataText: string[] = [];
        if (metadata.author) metadataText.push(`Author: ${metadata.author}`);
        if (metadata.organization) metadataText.push(`Organization: ${metadata.organization}`);
        if (metadata.version) metadataText.push(`Version: ${metadata.version}`);
        if (metadata.keywords && metadata.keywords.length > 0) {
          metadataText.push(`Keywords: ${metadata.keywords.join(', ')}`);
        }
        
        if (metadataText.length > 0) {
          doc.fontSize(9);
          doc.font(pdfFont);
          // Use readable text color for metadata
          const metadataTextColor = getReadableTextColor(cardBgColor, colors.text, colors.text);
          doc.fillColor(metadataTextColor);
          doc.text(metadataText.join(' • '), metadataCard.x, doc.y, { width: metadataCard.width, align: 'left' });
        }
        
        doc.y = metadataY + metadataHeight + 20;
      } else {
        doc.y = headerY + headerHeight + 20;
      }

      // Entries section - each entry as a card
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Check if we need a new page
        const cardPadding = 20;
        const estimatedCardHeight = 150; // Will adjust based on content
        if (doc.y + estimatedCardHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          drawPageBackground();
          doc.y = doc.page.margins.top;
        }
        
        const cardX = doc.page.margins.left;
        const cardY = doc.y;
        const cardWidth = doc.page.width - (doc.page.margins.left * 2);
        const cardStartY = cardY;
        
        // Estimate card height (will adjust later)
        const estimatedHeight = 200;
        const cardContent = drawCard(cardX, cardY, cardWidth, estimatedHeight, cardPadding);
        doc.y = cardContent.y;
        
        // Entry header section
        const timeStr = formatEntryTime(entry);
        const dateTimeStr = timeStr ? `${entry.date} ${timeStr}` : entry.date;
        
        // Title row - use accent or gold color for emphasis
        doc.fontSize(16);
        doc.font(getFontVariant(pdfFont, 'bold'));
        const titleColor = colors.gold || colors.accent || cardTextColor;
        // Ensure title color contrasts with card background
        const readableTitleColor = getContrastRatio(titleColor, cardBgColor) >= 4.5 
          ? titleColor 
          : getReadableTextColor(cardBgColor);
        doc.fillColor(readableTitleColor);
        const titleStartY = doc.y;
        doc.text(entry.title, cardContent.x, doc.y, { width: cardContent.width });
        const titleEndY = doc.y;
        const titleHeight = titleEndY - titleStartY;
        doc.y = titleEndY + 8; // Move down after title with spacing
        
        // Meta information row (date, time, time range)
        const metaY = doc.y;
        doc.fontSize(9);
        doc.font(pdfFont);
        
        // Date with accent or selected color (ensure contrast)
        const dateColor = colors.selected || colors.accent || cardTextColor;
        const readableDateColor = getContrastRatio(dateColor, cardBgColor) >= 4.5 
          ? dateColor 
          : getReadableTextColor(cardBgColor);
        doc.fillColor(readableDateColor);
        doc.text(dateTimeStr, cardContent.x, doc.y);
        
        // Time range badge - use theme colors with contrast
        const timeRangeX = cardContent.x + getTextWidth(dateTimeStr) + 10;
        const badgeBg = colors.border || adjustColorBrightness(cardBgColor, -15);
        const badgeTextColor = getReadableTextColor(badgeBg);
        const badgeText = entry.timeRange.toUpperCase();
        const badgeHeight = 20; // Height for badge
        drawBadge(timeRangeX, metaY - 2, badgeText, badgeBg, badgeTextColor);
        
        doc.y = metaY + badgeHeight + 8; // Proper spacing after meta row
        
        // Content section - use readable text color with proper spacing
        doc.fontSize(11);
        doc.font(pdfFont);
        doc.fillColor(cardTextColor);
        const contentY = doc.y;
        // Use PDFKit's text method which automatically handles wrapping and returns height
        // Store current Y, draw text, then calculate how much Y moved
        const contentStartY = doc.y;
        doc.text(entry.content, cardContent.x, doc.y, { width: cardContent.width, align: 'left' });
        const contentEndY = doc.y;
        const contentHeight = contentEndY - contentStartY;
        // Ensure minimum spacing
        doc.y = contentEndY + 12; // Move down after content
        
        // Tags section
        if (entry.tags && entry.tags.length > 0) {
          const tagsStartY = doc.y;
          let tagX = cardContent.x;
          const tagY = doc.y;
          
          doc.fontSize(8);
          doc.font(pdfFont);
          
          for (const tag of entry.tags) {
            // Use theme colors for tags - prefer selected/green, then accent, then gold
            let tagBg: string;
            if (colors.selected) {
              tagBg = adjustColorBrightness(colors.selected, 60); // Lighten green
            } else if (colors.gold) {
              tagBg = adjustColorBrightness(colors.gold, 70); // Lighten gold
            } else {
              tagBg = colors.accent || '#4a90e2';
              tagBg = adjustColorBrightness(tagBg, 80); // Lighten for background
            }
            const tagTextColor = getReadableTextColor(tagBg, '#ffffff', '#000000');
            const tagWidth = drawBadge(tagX, tagY, tag, tagBg, tagTextColor);
            tagX += tagWidth + 4;
            
            // Wrap to next line if needed
            if (tagX + 50 > cardContent.x + cardContent.width) {
              tagX = cardContent.x;
              doc.y += 25; // More spacing for wrapped tags
            }
          }
          
          // Ensure proper spacing after tags
          if (entry.tags && entry.tags.length > 0) {
            doc.y = Math.max(doc.y, tagsStartY + 25);
          }
        }
        
        // Redraw card with actual height (draw border over content area)
        const actualCardHeight = doc.y - cardStartY + cardPadding;
        doc.strokeColor(colors.border || '#e0e0e0');
        doc.rect(cardX, cardStartY, cardWidth, actualCardHeight);
        doc.stroke();
        
        // Spacing between cards
        doc.y += 20;
      }

      doc.end();

      stream.on('finish', () => {
        console.log('[Export] PDF file written successfully:', filePath);
        resolve();
      });
      stream.on('error', (err: Error) => {
        console.error('[Export] PDF stream error:', err);
        reject(err);
      });
      // PDFDocument errors are typically caught by the stream error handler or the try-catch block
    } catch (error) {
      console.error('[Export] PDF export error:', error);
      reject(error);
    }
  });
}

