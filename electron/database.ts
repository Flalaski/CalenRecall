import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { JournalEntry } from './types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

let db: Database.Database | null = null;

function checkColumnExists(database: Database.Database, tableName: string, columnName: string): boolean {
  try {
    const result = database.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return result.some(col => col.name === columnName);
  } catch {
    return false;
  }
}

function checkTableExists(database: Database.Database, tableName: string): boolean {
  try {
    const result = database.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(tableName);
    return result !== undefined;
  } catch {
    return false;
  }
}

function migrateDatabase(database: Database.Database) {
  const tableExists = checkTableExists(database, 'journal_entries');
  
  if (!tableExists) {
    // Table doesn't exist, will be created by CREATE TABLE IF NOT EXISTS
    return;
  }
  
  // Check if time_range column exists
  const hasTimeRange = checkColumnExists(database, 'journal_entries', 'time_range');
  
  if (!hasTimeRange) {
    // Migrate existing database
    try {
      // Add time_range column with default value
      // Note: SQLite requires DEFAULT when adding NOT NULL to existing table
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN time_range TEXT NOT NULL DEFAULT 'day';
      `);
      
      // Ensure all existing entries have time_range = 'day'
      database.exec(`
        UPDATE journal_entries SET time_range = 'day' WHERE time_range IS NULL OR time_range = '';
      `);
      
      // Create non-unique index on (date, time_range)
      // This allows multiple entries per date/time_range combination
      try {
        database.exec(`
          CREATE INDEX IF NOT EXISTS idx_date_time_range ON journal_entries(date, time_range);
        `);
      } catch (e) {
        console.log('Note: Index may already exist');
      }
      
      // Create index on time_range if it doesn't exist
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_time_range ON journal_entries(time_range);
      `);
      
      console.log('Database migrated successfully: Added time_range column');
    } catch (error) {
      console.error('Migration error:', error);
      throw error; // Re-throw to prevent using broken database
    }
  }
}

export function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'calenrecall.db');
  
  db = new Database(dbPath);
  
  const tableExists = checkTableExists(db, 'journal_entries');
  const hasTimeRange = tableExists ? checkColumnExists(db, 'journal_entries', 'time_range') : false;
  
  // Check if there's an old unique constraint on (date, time_range) or just 'date'
  let hasOldUniqueConstraint = false;
  if (tableExists) {
    try {
      // Check if there's a unique constraint in the table definition
      const createTableSql = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='journal_entries'
      `).get() as { sql: string } | undefined;
      
      if (createTableSql?.sql) {
        const sql = createTableSql.sql.toLowerCase();
        // Check if there's UNIQUE(date, time_range) or UNIQUE(date) - both need to be removed
        if (sql.includes('unique(date, time_range)') || sql.includes('unique(date,time_range)') || 
            (sql.includes('unique(date)') && !sql.includes('unique(date, time_range)'))) {
          hasOldUniqueConstraint = true;
          console.log('Detected old unique constraint on date/time_range columns');
        }
      }
      
      // Also check for unique indexes (including the specific one we used to create)
      const indexes = db.prepare(`
        SELECT name, sql FROM sqlite_master 
        WHERE type='index' AND tbl_name='journal_entries' AND (sql LIKE '%UNIQUE%' OR name = 'idx_date_time_range')
      `).all() as Array<{ name: string; sql: string | null }>;
      
      for (const idx of indexes) {
        // Check if it's the unique index on date/time_range or if it's named idx_date_time_range
        if (idx.name === 'idx_date_time_range' || 
            (idx.sql && idx.sql.toLowerCase().includes('unique') && 
             idx.sql.toLowerCase().includes('date') && idx.sql.toLowerCase().includes('time_range'))) {
          hasOldUniqueConstraint = true;
          console.log(`Detected unique index: ${idx.name}`);
          break;
        }
      }
    } catch (e) {
      console.log('Could not check for old constraints:', e);
    }
  }
  
  // If table exists but doesn't have time_range, or has old unique constraint, migrate it
  if (tableExists && (!hasTimeRange || hasOldUniqueConstraint)) {
    try {
      if (hasOldUniqueConstraint) {
        console.log('Recreating table to fix unique constraint issue');
        // Backup entries
        const oldEntries = db.prepare('SELECT * FROM journal_entries').all() as any[];
        // Drop and recreate
        db.exec('DROP TABLE IF EXISTS journal_entries');
        // Recreate with new schema
        createTables(db);
        // Restore entries
        if (oldEntries.length > 0) {
          const insertStmt = db.prepare(`
            INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const entry of oldEntries) {
            insertStmt.run(
              entry.date,
              entry.time_range || 'day',
              entry.title,
              entry.content,
              entry.tags || null,
              entry.created_at,
              entry.updated_at
            );
          }
        }
        console.log('Database recreated with correct schema');
      } else {
        migrateDatabase(db);
      }
    } catch (error) {
      console.error('Migration failed, recreating database:', error);
      // Backup old data if possible, then recreate
      try {
        // Try to backup entries
        const oldEntries = db.prepare('SELECT * FROM journal_entries').all() as any[];
        // Drop and recreate
        db.exec('DROP TABLE IF EXISTS journal_entries');
        // Recreate with new schema
        createTables(db);
        // Restore entries with time_range = 'day'
        if (oldEntries.length > 0) {
          const insertStmt = db.prepare(`
            INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const entry of oldEntries) {
            insertStmt.run(
              entry.date,
              entry.time_range || 'day',
              entry.title,
              entry.content,
              entry.tags || null,
              entry.created_at,
              entry.updated_at
            );
          }
        }
        console.log('Database recreated with new schema');
      } catch (recreateError) {
        console.error('Failed to recreate database:', recreateError);
        throw recreateError;
      }
    }
  } else {
    // Table exists and has time_range - always check for and remove unique constraint
    if (tableExists && hasTimeRange) {
      // Always check for and remove any unique constraints/indexes on date/time_range
      try {
        // First, try to drop the specific unique index if it exists
        try {
          db.exec(`DROP INDEX IF EXISTS idx_date_time_range`);
          console.log('Dropped idx_date_time_range index if it existed');
        } catch (e) {
          // Ignore if it doesn't exist
        }
        
        // Check for any other unique indexes on date/time_range
        const indexes = db.prepare(`
          SELECT name, sql FROM sqlite_master 
          WHERE type='index' AND tbl_name='journal_entries' AND sql LIKE '%UNIQUE%'
        `).all() as Array<{ name: string; sql: string | null }>;
        
        for (const idx of indexes) {
          if (idx.sql && idx.sql.toLowerCase().includes('date') && idx.sql.toLowerCase().includes('time_range')) {
            console.log(`Dropping unique index: ${idx.name}`);
            db.exec(`DROP INDEX IF EXISTS ${idx.name}`);
          }
        }
        
        // Check table definition for UNIQUE constraint - if found, recreate table
        const createTableSql = db.prepare(`
          SELECT sql FROM sqlite_master WHERE type='table' AND name='journal_entries'
        `).get() as { sql: string } | undefined;
        
        if (createTableSql?.sql) {
          const sql = createTableSql.sql.toLowerCase();
          // Check for UNIQUE constraint in table definition (various formats)
          if (sql.includes('unique(date, time_range)') || sql.includes('unique(date,time_range)') ||
              sql.match(/unique\s*\(\s*date\s*,\s*time_range\s*\)/i)) {
            console.log('Table has UNIQUE constraint in definition - recreating table');
            // Backup entries
            const oldEntries = db.prepare('SELECT * FROM journal_entries').all() as any[];
            // Drop and recreate
            db.exec('DROP TABLE IF EXISTS journal_entries');
            // Recreate with new schema
            createTables(db);
            // Restore entries
            if (oldEntries.length > 0) {
              const insertStmt = db.prepare(`
                INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `);
              for (const entry of oldEntries) {
                insertStmt.run(
                  entry.date,
                  entry.time_range || 'day',
                  entry.title,
                  entry.content,
                  entry.tags || null,
                  entry.created_at,
                  entry.updated_at
                );
              }
            }
            console.log('Database recreated without unique constraint');
          }
        }
      } catch (e) {
        console.log('Note: Could not check/remove unique constraints:', e);
      }
    } else {
      // Create tables with new schema (if they don't exist)
      createTables(db);
    }
  }
  
  return db;
}

function createTables(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time_range TEXT NOT NULL DEFAULT 'day',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_date ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_time_range ON journal_entries(time_range);
    CREATE INDEX IF NOT EXISTS idx_created_at ON journal_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_date_time_range ON journal_entries(date, time_range);
    
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  
  // Remove any old unique constraints/indexes
  // SQLite doesn't support DROP CONSTRAINT directly, so we check indexes
  try {
    const indexes = database.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='journal_entries' AND sql LIKE '%UNIQUE%'
    `).all() as Array<{ name: string }>;
    
    for (const idx of indexes) {
      // Drop any unique indexes (we now allow multiple entries per date/time_range)
      console.log(`Dropping old unique index: ${idx.name}`);
      database.exec(`DROP INDEX IF EXISTS ${idx.name}`);
    }
  } catch (e) {
    console.log('Note: Could not check/remove old indexes:', e);
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

/**
 * Get all journal entries in the database, ordered chronologically.
 * This is used for full-archive exports (\"storybook\" export).
 */
export function getAllEntries(): JournalEntry[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM journal_entries
    ORDER BY date ASC, time_range ASC, created_at ASC
  `);

  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    date: row.date,
    timeRange: row.time_range || 'day',
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getEntries(startDate: string, endDate: string): JournalEntry[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);
  
  const rows = stmt.all(startDate, endDate) as any[];
  return rows.map(row => ({
    id: row.id,
    date: row.date,
    timeRange: row.time_range || 'day', // Default to 'day' for backward compatibility
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getEntry(date: string, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'): JournalEntry | null {
  // For backward compatibility, return the first entry found
  const entries = getEntriesByDateAndRange(date, timeRange);
  return entries.length > 0 ? entries[0] : null;
}

export function getEntriesByDateAndRange(date: string, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'): JournalEntry[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM journal_entries WHERE date = ? AND time_range = ? ORDER BY created_at DESC');
  const rows = stmt.all(date, timeRange) as any[];
  
  return rows.map(row => ({
    id: row.id,
    date: row.date,
    timeRange: row.time_range || 'day',
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function saveEntry(entry: JournalEntry): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  try {
    console.log('saveEntry called with:', { id: entry.id, date: entry.date, timeRange: entry.timeRange, title: entry.title });
    
    // If entry has an ID, update that specific entry
    if (entry.id) {
      console.log('Updating existing entry by ID');
      const stmt = database.prepare(`
        UPDATE journal_entries 
        SET title = ?, content = ?, tags = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(
        entry.title,
        entry.content,
        JSON.stringify(entry.tags || []),
        now,
        entry.id
      );
      console.log('Entry updated successfully');
    } else {
      // If no ID, always insert a new entry (allows multiple entries per date/timeRange)
      console.log('Inserting new entry');
      const stmt = database.prepare(`
        INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        entry.date,
        entry.timeRange,
        entry.title,
        entry.content,
        JSON.stringify(entry.tags || []),
        entry.createdAt || now,
        now
      );
      console.log('Entry inserted successfully');
    }
  } catch (error: any) {
    console.error('Error in saveEntry:', error);
    throw error;
  }
}

function fixDatabaseSchema(database: Database.Database): void {
  console.log('Fixing database schema...');
  
  // Backup all entries
  const oldEntries = database.prepare('SELECT * FROM journal_entries').all() as any[];
  console.log(`Backing up ${oldEntries.length} entries`);
  
  // Drop the old table
  database.exec('DROP TABLE IF EXISTS journal_entries');
  
  // Recreate with correct schema
  createTables(database);
  
  // Restore entries
  if (oldEntries.length > 0) {
    const insertStmt = database.prepare(`
      INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of oldEntries) {
      insertStmt.run(
        entry.date,
        entry.time_range || 'day',
        entry.title,
        entry.content,
        entry.tags || null,
        entry.created_at,
        entry.updated_at
      );
    }
    console.log(`Restored ${oldEntries.length} entries`);
  }
  
  console.log('Database schema fixed successfully');
}

export function deleteEntry(id: number): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM journal_entries WHERE id = ?');
  stmt.run(id);
}

export function deleteEntryByDateAndRange(date: string, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM journal_entries WHERE date = ? AND time_range = ?');
  stmt.run(date, timeRange);
}

export function searchEntries(query: string): JournalEntry[] {
  const database = getDatabase();
  const searchTerm = `%${query}%`;
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY date DESC
  `);
  
  const rows = stmt.all(searchTerm, searchTerm) as any[];
  return rows.map(row => ({
    id: row.id,
    date: row.date,
    timeRange: row.time_range || 'day',
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getEntriesByRange(range: 'decade' | 'year' | 'month' | 'week' | 'day', value: number): JournalEntry[] {
  const database = getDatabase();
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let canonicalDate: Date;
  
  switch (range) {
    case 'decade':
      const decadeStart = Math.floor(value / 10) * 10;
      startDate = new Date(decadeStart, 0, 1);
      endDate = new Date(decadeStart + 9, 11, 31);
      canonicalDate = startDate;
      break;
    case 'year':
      startDate = new Date(value, 0, 1);
      endDate = new Date(value, 11, 31);
      canonicalDate = startDate;
      break;
    case 'month':
      const year = Math.floor(value / 12);
      const month = value % 12;
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
      canonicalDate = startDate;
      break;
    case 'week':
      // For week, value is week number since epoch (Monday-based weeks)
      const epoch = new Date(1970, 0, 1);
      // Get to the first Monday (Jan 5, 1970 was a Monday)
      const firstMonday = new Date(1970, 0, 5);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(weekStart.getDate() + (value * 7));
      startDate = new Date(weekStart);
      endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      canonicalDate = startDate;
      break;
    case 'day':
      const dayDate = new Date(1970, 0, 1);
      dayDate.setDate(dayDate.getDate() + value);
      startDate = dayDate;
      endDate = new Date(dayDate);
      canonicalDate = startDate;
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
      canonicalDate = startDate;
  }
  
  // Get all entries in the date range
  const allEntries = getEntries(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );
  
  // Filter entries to show all relevant entries for this time range
  // Show entries at the current level AND entries at more specific levels within this range
  return allEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    
    // Always show entries at the current time range level
    if (entry.timeRange === range) {
      return true;
    }
    
    // For day view: show all entries that contain this day
    if (range === 'day') {
      // Check if entry's time range contains this day
      const dayDate = startDate;
      if (entry.timeRange === 'day') {
        return entry.date === formatDate(dayDate);
      } else if (entry.timeRange === 'week') {
        // Check if day is in the entry's week
        const entryWeekStart = new Date(entryDate);
        const dayOfWeek = entryWeekStart.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        entryWeekStart.setDate(entryWeekStart.getDate() - daysToMonday);
        const entryWeekEnd = new Date(entryWeekStart);
        entryWeekEnd.setDate(entryWeekEnd.getDate() + 6);
        return dayDate >= entryWeekStart && dayDate <= entryWeekEnd;
      } else if (entry.timeRange === 'month') {
        // Check if day is in the entry's month
        return dayDate.getFullYear() === entryDate.getFullYear() && 
               dayDate.getMonth() === entryDate.getMonth();
      } else if (entry.timeRange === 'year') {
        return dayDate.getFullYear() === entryDate.getFullYear();
      } else if (entry.timeRange === 'decade') {
        const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
        const dayDecade = Math.floor(dayDate.getFullYear() / 10) * 10;
        return decadeStart === dayDecade;
      }
    }
    
    // For week view: show week entries for this week, plus day entries within this week
    if (range === 'week') {
      if (entry.timeRange === 'day') {
        return entryDate >= startDate && entryDate <= endDate;
      } else if (entry.timeRange === 'week') {
        return entry.date === formatDate(startDate);
      }
    }
    
    // For month view: show month entries for this month, plus week/day entries within this month
    if (range === 'month') {
      if (entry.timeRange === 'day' || entry.timeRange === 'week') {
        return entryDate >= startDate && entryDate <= endDate;
      } else if (entry.timeRange === 'month') {
        return entry.date === formatDate(startDate);
      }
    }
    
    // For year view: show year entries for this year, plus month/week/day entries within this year
    if (range === 'year') {
      if (entry.timeRange === 'day' || entry.timeRange === 'week' || entry.timeRange === 'month') {
        return entryDate >= startDate && entryDate <= endDate;
      } else if (entry.timeRange === 'year') {
        return entry.date === formatDate(startDate);
      }
    }
    
    // For decade view: show all entries within the decade
    if (range === 'decade') {
      return entryDate >= startDate && entryDate <= endDate;
    }
    
    return false;
  });
}

// Preferences functions
export interface Preferences {
  defaultViewMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
  windowWidth?: number;
  windowHeight?: number;
  windowX?: number;
  windowY?: number;
  dateFormat?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  autoSave?: boolean;
  autoSaveInterval?: number; // in seconds
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  showMinimap?: boolean;
  minimapPosition?: 'left' | 'right' | 'top' | 'bottom';
  minimapSize?: 'small' | 'medium' | 'large';
  restoreLastView?: boolean;
  lastViewedDate?: string;
  lastViewedMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
}

const DEFAULT_PREFERENCES: Preferences = {
  defaultViewMode: 'month',
  windowWidth: 1200,
  windowHeight: 800,
  dateFormat: 'yyyy-MM-dd',
  weekStartsOn: 1, // Monday
  autoSave: true,
  autoSaveInterval: 30,
  theme: 'light',
  fontSize: 'medium',
  showMinimap: true,
  minimapPosition: 'top',
  minimapSize: 'medium',
  restoreLastView: false,
};

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT value FROM preferences WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  
  if (!row) {
    return DEFAULT_PREFERENCES[key];
  }
  
  try {
    return JSON.parse(row.value) as Preferences[K];
  } catch {
    return row.value as Preferences[K];
  }
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO preferences (key, value)
    VALUES (?, ?)
  `);
  stmt.run(key, JSON.stringify(value));
}

export function getAllPreferences(): Preferences {
  const database = getDatabase();
  const stmt = database.prepare('SELECT key, value FROM preferences');
  const rows = stmt.all() as Array<{ key: string; value: string }>;
  
  const prefs: Preferences = { ...DEFAULT_PREFERENCES };
  
  for (const row of rows) {
    const key = row.key as keyof Preferences;
    if (key in DEFAULT_PREFERENCES) {
      try {
        const parsedValue = JSON.parse(row.value);
        (prefs as any)[key] = parsedValue;
      } catch {
        // If JSON parsing fails, try to use the raw value
        // This handles cases where the value might be stored as a plain string
        const rawValue = row.value;
        // Try to infer the correct type based on the default value
        const defaultValue = DEFAULT_PREFERENCES[key];
        if (typeof defaultValue === 'number') {
          (prefs as any)[key] = parseFloat(rawValue) || defaultValue;
        } else if (typeof defaultValue === 'boolean') {
          (prefs as any)[key] = rawValue === 'true';
        } else {
          (prefs as any)[key] = rawValue;
        }
      }
    }
  }
  
  return prefs;
}

export function resetPreferences(): void {
  const database = getDatabase();
  database.exec('DELETE FROM preferences');
}

/**
 * Close the database connection and release all resources.
 * This should be called when the application is shutting down.
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    } finally {
      db = null;
    }
  }
}

