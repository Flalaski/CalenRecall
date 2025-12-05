import { ipcMain, dialog, app } from 'electron';
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

export function setupIpcHandlers() {
  ipcMain.handle('get-entries', async (_event, startDate: string, endDate: string) => {
    return getEntries(startDate, endDate);
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

  ipcMain.handle('set-preference', async (_event, key: keyof Preferences, value: any) => {
    setPreference(key, value);
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
   * Import journal entries from a file.
   * Supports JSON and Markdown formats.
   */
  ipcMain.handle('import-entries', async (_event, format: 'json' | 'markdown') => {
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
      const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
      const entries = parseImportContent(content, format);

      if (entries.length === 0) {
        return { success: false, canceled: false, error: 'no_entries', message: 'No entries found in file' };
      }

      // Save all entries
      let imported = 0;
      let skipped = 0;
      for (const entry of entries) {
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
      }

      return {
        success: true,
        canceled: false,
        imported,
        skipped,
        total: entries.length,
      };
    } catch (error: any) {
      console.error('Error importing entries:', error);
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

