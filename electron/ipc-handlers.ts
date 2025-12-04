import { ipcMain, dialog } from 'electron';
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
} from './database';
import { JournalEntry, TimeRange, ExportFormat } from './types';

export function setupIpcHandlers() {
  ipcMain.handle('get-entries', async (_event, startDate: string, endDate: string) => {
    return getEntries(startDate, endDate);
  });

  ipcMain.handle('get-entry', async (_event, date: string, timeRange: TimeRange) => {
    return getEntry(date, timeRange);
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
    const year = new Date(entry.date).getFullYear();
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

