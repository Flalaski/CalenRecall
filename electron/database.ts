import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { JournalEntry, TimeRange, ExportFormat, ExportMetadata } from './types';
import {
  getAllProfiles,
  getProfile,
  getCurrentProfileId,
  setCurrentProfileId,
  migrateToProfiles,
  verifyProfileDatabase,
  needsMigration as checkNeedsMigration,
  hasOriginalDatabase,
  getOriginalDatabasePath,
  recoverFromOrphanedWAL,
  type Profile,
} from './profile-manager';
import {
  JournalEntryRow,
  EntryVersionRow,
  PreferenceRow,
  EntryTemplateRow,
  TableInfoRow,
  SynchronousPragma,
  JournalModePragma,
  SqliteMasterRow,
  TimeFields,
} from './database-types';

/**
 * Safely formats a date to ISO date string (YYYY-MM-DD) that works with negative years.
 * This replaces toISOString() which doesn't work for dates before year 0.
 * Supports proleptic Gregorian calendar dates from -9999 to 9999.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  const day = date.getDate();
  
  // Format year with sign for negative years (ISO 8601 format: -YYYY-MM-DD)
  const yearStr = year < 0 
    ? `-${String(Math.abs(year)).padStart(4, '0')}` 
    : String(year).padStart(4, '0');
  
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD or -YYYY-MM-DD) to a Date object.
 * Handles negative years correctly by parsing as local date.
 */
export function parseISODate(dateStr: string): Date {
  // Handle negative years: -YYYY-MM-DD format
  const isNegative = dateStr.startsWith('-');
  const cleanDateStr = isNegative ? dateStr.substring(1) : dateStr;
  const [yearStr, monthStr, dayStr] = cleanDateStr.split('-');
  
  const year = isNegative ? -parseInt(yearStr, 10) : parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed month
  const day = parseInt(dayStr, 10);
  
  return new Date(year, month, day);
}

/**
 * Convert a Gregorian date to Julian Day Number
 * Simple implementation for database use
 */
function gregorianToJDN(year: number, month: number, day: number): number {
  // Handle negative years (BC dates)
  if (year < 0) {
    year = year + 1;
  }
  
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  
  // Gregorian calendar formula
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + 
         Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/**
 * Calculate JDN from an ISO date string
 */
function calculateJDNFromDateString(dateStr: string): number | null {
  try {
    const date = parseISODate(dateStr);
    return gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  } catch (e) {
    console.error('Error calculating JDN from date string:', e);
    return null;
  }
}

/**
 * Helper function to extract time fields from a database row.
 * Ensures consistent handling: hour can be null, minute/second default to 0 if null/undefined.
 * 
 * @param row - Database row with time fields
 * @returns Extracted time fields with proper defaults
 */
function extractTimeFields(row: JournalEntryRow): TimeFields {
  return {
    hour: row.hour !== null && row.hour !== undefined ? row.hour : null,
    minute: row.minute !== null && row.minute !== undefined ? row.minute : 0,
    second: row.second !== null && row.second !== undefined ? row.second : 0,
  };
}

let db: Database.Database | null = null;
let currentProfile: Profile | null = null;

function checkColumnExists(database: Database.Database, tableName: string, columnName: string): boolean {
  try {
    const result = database.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
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
  
  // Check if JDN column exists and add it if missing
  const hasJDN = checkColumnExists(database, 'journal_entries', 'jdn');
  if (!hasJDN) {
    try {
      // Add JDN column (nullable, will be computed from date)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN jdn INTEGER;
      `);
      
      // Compute JDN for existing entries from their date strings
      // This will be done lazily when entries are accessed, or can be done here
      // For now, we'll leave it null and compute on-the-fly when needed
      
      // Create index on JDN for faster lookups
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_jdn ON journal_entries(jdn);
      `);
      
      console.log('Database migrated successfully: Added JDN column');
    } catch (error) {
      console.error('JDN migration error:', error);
      // Don't throw - JDN is optional, system can work without it
    }
  }

  // Check if linked_entries column exists and add it if missing
  const hasLinkedEntries = checkColumnExists(database, 'journal_entries', 'linked_entries');
  if (!hasLinkedEntries) {
    try {
      // Add linked_entries column (nullable, stores JSON array of entry IDs)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN linked_entries TEXT;
      `);
      
      console.log('Database migrated successfully: Added linked_entries column');
    } catch (error) {
      console.error('Linked entries migration error:', error);
      // Don't throw - linked entries is optional
    }
  }

  // Check if archived column exists and add it if missing
  const hasArchived = checkColumnExists(database, 'journal_entries', 'archived');
  if (!hasArchived) {
    try {
      // Add archived column (defaults to 0/false)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN archived INTEGER DEFAULT 0;
      `);
      
      console.log('Database migrated successfully: Added archived column');
    } catch (error) {
      console.error('Archived migration error:', error);
      // Don't throw - archived is optional
    }
  }

  // Check if pinned column exists and add it if missing
  const hasPinned = checkColumnExists(database, 'journal_entries', 'pinned');
  if (!hasPinned) {
    try {
      // Add pinned column (defaults to 0/false)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN pinned INTEGER DEFAULT 0;
      `);
      
      console.log('Database migrated successfully: Added pinned column');
    } catch (error) {
      console.error('Pinned migration error:', error);
      // Don't throw - pinned is optional
    }
  }

  // Check if attachments column exists and add it if missing
  const hasAttachments = checkColumnExists(database, 'journal_entries', 'attachments');
  if (!hasAttachments) {
    try {
      // Add attachments column (stores JSON array of attachment metadata)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN attachments TEXT;
      `);
      
      console.log('Database migrated successfully: Added attachments column');
    } catch (error) {
      console.error('Attachments migration error:', error);
      // Don't throw - attachments is optional
    }
  }

  // Check if time columns exist and add them if missing
  const hasHour = checkColumnExists(database, 'journal_entries', 'hour');
  if (!hasHour) {
    try {
      // Add hour column (nullable, 0-23)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN hour INTEGER;
      `);
      
      console.log('Database migrated successfully: Added hour column');
    } catch (error) {
      console.error('Hour migration error:', error);
      // Don't throw - time fields are optional
    }
  }

  const hasMinute = checkColumnExists(database, 'journal_entries', 'minute');
  if (!hasMinute) {
    try {
      // Add minute column (nullable, 0-59)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN minute INTEGER;
      `);
      
      console.log('Database migrated successfully: Added minute column');
    } catch (error) {
      console.error('Minute migration error:', error);
      // Don't throw - time fields are optional
    }
  }

  const hasSecond = checkColumnExists(database, 'journal_entries', 'second');
  if (!hasSecond) {
    try {
      // Add second column (nullable, 0-59)
      database.exec(`
        ALTER TABLE journal_entries ADD COLUMN second INTEGER;
      `);
      
      console.log('Database migrated successfully: Added second column');
    } catch (error) {
      console.error('Second migration error:', error);
      // Don't throw - time fields are optional
    }
  }
}

/**
 * Initializes the SQLite database connection for a specific profile.
 * Creates the database file if it doesn't exist and runs migrations.
 * Configures database for optimal performance and data integrity.
 * 
 * @param profileId - Optional profile ID to initialize. If not provided, uses current profile.
 * @returns The database instance
 * @throws Error if database initialization fails
 * 
 * @example
 * ```typescript
 * try {
 *   const db = initDatabase('default');
 *   console.log('Database initialized successfully');
 * } catch (error) {
 *   console.error('Failed to initialize database:', error);
 * }
 * ```
 */
export function initDatabase(profileId?: string) {
  // Migrate existing users to profiles system if needed
  if (checkNeedsMigration()) {
    console.log('[Database Init] Migrating to profiles system...');
    migrateToProfiles();
  }
  
  // Determine which profile to use
  const targetProfileId = profileId || getCurrentProfileId();
  const profile = getProfile(targetProfileId);
  
  if (!profile) {
    throw new Error(`Profile not found: ${targetProfileId}`);
  }
  
  // If already connected to this profile, return existing connection
  if (db && currentProfile?.id === profile.id) {
    return db;
  }
  
  // Close existing connection if switching profiles
  if (db) {
    console.log(`[Database Init] Closing connection to profile: ${currentProfile?.id}`);
    try {
      flushDatabase();
      closeDatabase();
    } catch (error) {
      console.warn('[Database Init] Error closing previous connection:', error);
    }
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, profile.databasePath);
  
  // Validate path
  const userDataResolved = path.resolve(userDataPath);
  const dbPathResolved = path.resolve(dbPath);
  if (!dbPathResolved.startsWith(userDataResolved)) {
    throw new Error(`Invalid profile path: ${profile.databasePath}`);
  }
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  console.log(`[Database Init] Initializing database for profile: ${profile.id} (${profile.name})`);
  console.log(`[Database Init] Database path: ${dbPath}`);
  
  // Verify database file exists
  if (!fs.existsSync(dbPath)) {
    console.error(`[Database Init] ❌ Database file does not exist: ${dbPath}`);
    
    // CRITICAL: Check if original database still exists (migration might have failed)
    if (hasOriginalDatabase()) {
      const originalDbPath = getOriginalDatabasePath();
      console.error(`[Database Init] ⚠️ Original database still exists at: ${originalDbPath}`);
      console.error(`[Database Init] This suggests migration did not complete. Attempting recovery...`);
      
      // Try to recover by running migration again
      try {
        migrateToProfiles();
        
        // Re-check if database now exists
        if (fs.existsSync(dbPath)) {
          console.log(`[Database Init] ✅ Recovery successful - database now exists`);
        } else {
          throw new Error(`Recovery failed - database still missing after migration retry`);
        }
      } catch (recoveryError) {
        console.error(`[Database Init] ❌ Recovery failed:`, recoveryError);
        throw new Error(`Database file not found and recovery failed. Original database may still exist at: ${originalDbPath}`);
      }
    } else {
      throw new Error(`Database file not found: ${dbPath}. Original database also not found.`);
    }
  }
  
  // Check database file size and modification time
  try {
    const stats = fs.statSync(dbPath);
    console.log(`[Database Init] Database file size: ${stats.size} bytes`);
    console.log(`[Database Init] Database file modified: ${stats.mtime.toISOString()}`);
    
    // Warn if database is suspiciously small (likely empty)
    if (stats.size < 1000) {
      console.warn(`[Database Init] ⚠️ Database file is very small (${stats.size} bytes) - may be empty or corrupted`);
    }
  } catch (statsError) {
    console.warn('[Database Init] Could not get database file stats:', statsError);
  }
  
  // Open database - better-sqlite3 will create an empty database if file doesn't exist
  // So we MUST check file exists first (which we did above)
  db = new Database(dbPath);
  currentProfile = profile;
  
  // Verify database has entries - CRITICAL CHECK
  try {
    // First check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'
    `).get();
    
    if (!tableExists) {
      console.error(`[Database Init] ❌ Database exists but journal_entries table is missing!`);
      console.error(`[Database Init] This database appears to be empty or corrupted.`);
      
      // Check if original database still exists
      if (hasOriginalDatabase()) {
        const originalDbPath = getOriginalDatabasePath();
        console.error(`[Database Init] ⚠️ Original database still exists - attempting recovery...`);
        db.close();
        
        migrateToProfiles();
        
        // Re-open database
        db = new Database(dbPath);
        currentProfile = profile;
        const retryTableExists = db.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'
        `).get();
        
        if (!retryTableExists) {
          throw new Error(`Database is empty. Original database may still exist at: ${originalDbPath}`);
        }
      } else {
        throw new Error(`Database is empty and original database not found. Data may be lost.`);
      }
    }
    
    const entryCount = db.prepare('SELECT COUNT(*) as count FROM journal_entries').get() as { count: number } | undefined;
    let count = entryCount?.count || 0;
    console.log(`[Database Init] Database contains ${count} journal entries`);
    
    // CRITICAL: Check for orphaned WAL file in root directory
    const userDataPath = app.getPath('userData');
    const orphanedWalPath = path.join(userDataPath, 'calenrecall.db-wal');
    
    if (fs.existsSync(orphanedWalPath)) {
      console.warn(`[Database Init] ⚠️ Found orphaned WAL file in root directory!`);
      console.warn(`[Database Init] This likely contains recent entries that weren't migrated.`);
      console.warn(`[Database Init] Attempting to recover data from orphaned WAL...`);
      
      db.close();
      const recovered = recoverFromOrphanedWAL(profile.id);
      db = new Database(dbPath);
      currentProfile = profile;
      
      if (recovered) {
        // Re-count entries after recovery
        const newCount = (db.prepare('SELECT COUNT(*) as count FROM journal_entries').get() as { count: number } | undefined)?.count || 0;
        console.log(`[Database Init] ✅ After WAL recovery: ${newCount} entries (was ${count})`);
        count = newCount;
      }
    }
    
    if (count === 0) {
      console.warn(`[Database Init] ⚠️ WARNING: Database has 0 entries!`);
      
      // Check if original database still exists
      if (hasOriginalDatabase()) {
        const originalDbPath = getOriginalDatabasePath();
        console.warn(`[Database Init] ⚠️ Original database still exists - data may not have been migrated`);
        console.warn(`[Database Init] Original database path: ${originalDbPath}`);
      }
    }
  } catch (countError) {
    console.error('[Database Init] ❌ Could not count entries:', countError);
    // Don't throw - might be a new database, but log the error
  }
  
  // CRITICAL: Ensure robust persistence - force synchronous writes and enable WAL mode
  console.log('[Database Init] Configuring database for robust persistence...');
  try {
    // Enable WAL mode for better concurrency and durability
    // Use exec for PRAGMA statements in better-sqlite3
    db.exec('PRAGMA journal_mode = WAL');
    console.log('[Database Init] ✅ WAL mode enabled');
    
    // Set synchronous to FULL (2) to ensure data is written to disk immediately
    // This is critical for preventing data loss if the program closes unexpectedly
    db.exec('PRAGMA synchronous = FULL');
    console.log('[Database Init] ✅ Synchronous mode set to FULL');
    
    // Additional: Set busy_timeout to prevent locking issues
    db.exec('PRAGMA busy_timeout = 5000');
    
    // Ensure foreign keys are enabled (if needed)
    db.exec('PRAGMA foreign_keys = ON');
    
    // Verify settings were applied
    const syncResult = db.prepare('PRAGMA synchronous').get() as SynchronousPragma | undefined;
    const journalResult = db.prepare('PRAGMA journal_mode').get() as JournalModePragma | undefined;
    console.log('[Database Init] Verified settings - synchronous:', syncResult?.synchronous, 'journal_mode:', journalResult?.journal_mode);
    
    console.log('[Database Init] ✅ Database persistence settings configured');
  } catch (error) {
    console.error('[Database Init] ⚠️ Warning: Could not configure database pragmas:', error);
    // Continue anyway - better-sqlite3 defaults are usually safe
  }
  
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
      `).all() as Array<Pick<SqliteMasterRow, 'name' | 'sql'>>;
      
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
        const oldEntries = db.prepare('SELECT * FROM journal_entries').all() as JournalEntryRow[];
        // Drop and recreate
        db.exec('DROP TABLE IF EXISTS journal_entries');
        // Recreate with new schema
        createTables(db);
        // Restore entries WITH TIME FIELDS
        if (oldEntries.length > 0) {
          const insertStmt = db.prepare(`
            INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at, hour, minute, second, jdn, linked_entries, archived, pinned, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const entry of oldEntries) {
            // Calculate JDN for the entry
            const jdn = entry.jdn !== null && entry.jdn !== undefined 
              ? entry.jdn 
              : calculateJDNFromDateString(entry.date);
            
            insertStmt.run(
              entry.date,
              entry.time_range || 'day',
              entry.title,
              entry.content,
              entry.tags || null,
              entry.created_at,
              entry.updated_at,
              entry.hour !== null && entry.hour !== undefined ? entry.hour : null,
              entry.minute !== null && entry.minute !== undefined ? entry.minute : 0,
              entry.second !== null && entry.second !== undefined ? entry.second : 0,
              jdn,
              entry.linked_entries || null,
              entry.archived || 0,
              entry.pinned || 0,
              entry.attachments || null
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
        const oldEntries = db.prepare('SELECT * FROM journal_entries').all() as JournalEntryRow[];
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
    // Table exists and has time_range - check for time columns and migrate if needed
    if (tableExists && hasTimeRange) {
      // ALWAYS run migration to ensure time columns (hour, minute, second) exist
      migrateDatabase(db);
      
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
            const oldEntries = db.prepare('SELECT * FROM journal_entries').all() as JournalEntryRow[];
            // Drop and recreate
            db.exec('DROP TABLE IF EXISTS journal_entries');
            // Recreate with new schema
            createTables(db);
        // Restore entries WITH TIME FIELDS
        if (oldEntries.length > 0) {
          const insertStmt = db.prepare(`
            INSERT INTO journal_entries (date, time_range, title, content, tags, created_at, updated_at, hour, minute, second, jdn, linked_entries, archived, pinned, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const entry of oldEntries) {
            // Calculate JDN for the entry
            const jdn = entry.jdn !== null && entry.jdn !== undefined 
              ? entry.jdn 
              : calculateJDNFromDateString(entry.date);
            
            insertStmt.run(
              entry.date,
              entry.time_range || 'day',
              entry.title,
              entry.content,
              entry.tags || null,
              entry.created_at,
              entry.updated_at,
              entry.hour !== null && entry.hour !== undefined ? entry.hour : null,
              entry.minute !== null && entry.minute !== undefined ? entry.minute : 0,
              entry.second !== null && entry.second !== undefined ? entry.second : 0,
              jdn,
              entry.linked_entries || null,
              entry.archived || 0,
              entry.pinned || 0,
              entry.attachments || null
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
  
  // Final verification: Ensure time columns exist
  const hasHourFinal = checkColumnExists(db, 'journal_entries', 'hour');
  const hasMinuteFinal = checkColumnExists(db, 'journal_entries', 'minute');
  const hasSecondFinal = checkColumnExists(db, 'journal_entries', 'second');
  console.log('[Database Init] Final time columns check:', { hasHour: hasHourFinal, hasMinute: hasMinuteFinal, hasSecond: hasSecondFinal });
  
  if (!hasHourFinal || !hasMinuteFinal || !hasSecondFinal) {
    console.error('[Database Init] WARNING: Time columns are missing! Running emergency migration...');
    migrateDatabase(db);
  }
  
  return db;
}

function createTables(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      jdn INTEGER,
      time_range TEXT NOT NULL DEFAULT 'day',
      hour INTEGER,
      minute INTEGER,
      second INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      linked_entries TEXT,
      archived INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      attachments TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_date ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_jdn ON journal_entries(jdn);
    CREATE INDEX IF NOT EXISTS idx_time_range ON journal_entries(time_range);
    CREATE INDEX IF NOT EXISTS idx_created_at ON journal_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_date_time_range ON journal_entries(date, time_range);
    
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS entry_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      tags TEXT,
      time_range TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS entry_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time_range TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      linked_entries TEXT,
      created_at TEXT NOT NULL,
      version_created_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_entry_versions_entry_id ON entry_versions(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_versions_created_at ON entry_versions(version_created_at);
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
 * Explicitly flush all pending database writes to disk.
 * This ensures data persistence even if the application closes unexpectedly.
 * Should be called after critical save operations.
 */
export function flushDatabase(): void {
  const database = getDatabase();
  try {
    console.log('[Database] 🔄 Explicitly flushing database to disk...');
    database.exec('PRAGMA wal_checkpoint(FULL)');
    console.log('[Database] ✅ Database flush completed - all data persisted to disk');
  } catch (error) {
    console.error('[Database] ❌ Error flushing database:', error);
    throw error;
  }
}

/**
 * Get the path to the database file for the current profile.
 */
export function getDatabasePath(): string {
  if (!currentProfile) {
    // Fallback to default if no profile is set
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'profiles', 'default', 'calenrecall.db');
  }
  
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, currentProfile.databasePath);
}

/**
 * Get the current active profile.
 */
export function getCurrentProfile(): Profile | null {
  return currentProfile;
}

/**
 * Switch to a different profile.
 * This will close the current database connection and open a new one.
 * 
 * @param profileId - The ID of the profile to switch to
 * @throws Error if profile not found or switch fails
 */
export function switchProfile(profileId: string): void {
  if (currentProfile?.id === profileId) {
    console.log(`[Database] Already on profile: ${profileId}`);
    return; // Already on this profile
  }
  
  console.log(`[Database] Switching from profile ${currentProfile?.id || 'none'} to ${profileId}`);
  
  // Validate profile exists
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }
  
  // Verify profile database is valid
  if (!verifyProfileDatabase(profileId)) {
    throw new Error(`Profile "${profileId}" database is invalid or corrupted`);
  }
  
  // Flush and close current database
  if (db) {
    try {
      flushDatabase();
      closeDatabase();
    } catch (error) {
      console.error('[Database] Error closing current database:', error);
      throw new Error(`Failed to close current database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Update current profile ID in metadata
  setCurrentProfileId(profileId);
  
  // Initialize new profile database
  initDatabase(profileId);
  
  console.log(`[Database] ✅ Successfully switched to profile: ${profileId}`);
}


/**
 * Get all journal entries in the database, ordered chronologically.
 * This is used for full-archive exports (\"storybook\" export).
 */
export function getEntryCount(includeArchived: boolean = false): number {
  const database = getDatabase();
  const whereClause = includeArchived ? '' : 'WHERE archived = 0';
  const stmt = database.prepare(`SELECT COUNT(*) as count FROM journal_entries ${whereClause}`);
  const result = stmt.get() as { count: number } | undefined;
  return result?.count || 0;
}

export function getAllEntries(includeArchived: boolean = false): JournalEntry[] {
  const database = getDatabase();
  const whereClause = includeArchived ? '' : 'WHERE archived = 0';
  const stmt = database.prepare(`
    SELECT * FROM journal_entries
    ${whereClause}
    ORDER BY date ASC, time_range ASC, created_at ASC
  `);

  const rows = stmt.all() as JournalEntryRow[];
  return rows.map(row => {
    const timeFields = extractTimeFields(row);
    return {
      id: row.id,
      date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange,
      hour: timeFields.hour,
      minute: timeFields.minute,
      second: timeFields.second,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
      archived: row.archived === 1,
      pinned: row.pinned === 1,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function getEntries(startDate: string, endDate: string, includeArchived: boolean = false): JournalEntry[] {
  const database = getDatabase();
  const archivedClause = includeArchived ? '' : 'AND archived = 0';
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE date >= ? AND date <= ? ${archivedClause}
    ORDER BY date DESC
  `);
  
  const rows = stmt.all(startDate, endDate) as JournalEntryRow[];
  return rows.map(row => {
    const timeFields = extractTimeFields(row);
    return {
      id: row.id,
      date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange, // Default to 'day' for backward compatibility
      hour: timeFields.hour,
      minute: timeFields.minute,
      second: timeFields.second,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function getEntry(date: string, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'): JournalEntry | null {
  // For backward compatibility, return the first entry found
  const entries = getEntriesByDateAndRange(date, timeRange);
  return entries.length > 0 ? entries[0] : null;
}

export function getEntryById(id: number): JournalEntry | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM journal_entries WHERE id = ?');
  const row = stmt.get(id) as JournalEntryRow | undefined;
  
  if (!row) {
    return null;
  }
  
  const timeFields = extractTimeFields(row);
  console.log('getEntryById - retrieved time values:', { 
    rowHour: row.hour, 
    rowMinute: row.minute, 
    rowSecond: row.second,
    extracted: timeFields
  });
  
  return {
    id: row.id,
    date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange,
    hour: timeFields.hour,
    minute: timeFields.minute,
    second: timeFields.second,
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
    archived: row.archived === 1,
    pinned: row.pinned === 1,
    attachments: row.attachments ? JSON.parse(row.attachments) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EntryVersion {
  id: number;
  entryId: number;
  date: string;
  timeRange: TimeRange;
  title: string;
  content: string;
  tags: string[];
  linkedEntries: number[];
  createdAt: string;
  versionCreatedAt: string;
}

export function getEntryVersions(entryId: number): EntryVersion[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM entry_versions 
    WHERE entry_id = ? 
    ORDER BY version_created_at DESC
  `);
  const rows = stmt.all(entryId) as EntryVersionRow[];
  
  return rows.map(row => ({
    id: row.id,
    entryId: row.entry_id,
    date: row.date,
    timeRange: (row.time_range || 'day') as TimeRange,
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
    createdAt: row.created_at,
    versionCreatedAt: row.version_created_at,
  }));
}

export function getEntriesByDateAndRange(date: string, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day', includeArchived: boolean = false): JournalEntry[] {
  const database = getDatabase();
  const archivedClause = includeArchived ? '' : 'AND archived = 0';
  const stmt = database.prepare(`SELECT * FROM journal_entries WHERE date = ? AND time_range = ? ${archivedClause} ORDER BY created_at DESC`);
  const rows = stmt.all(date, timeRange) as JournalEntryRow[];
  
  return rows.map(row => {
    const timeFields = extractTimeFields(row);
    return {
      id: row.id,
      date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange,
      hour: timeFields.hour,
      minute: timeFields.minute,
      second: timeFields.second,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
      archived: row.archived === 1,
      pinned: row.pinned === 1,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function saveEntry(entry: JournalEntry): JournalEntry {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[Database] 🗄️ saveEntry FUNCTION CALLED');
  console.log('[Database] Entry received:', {
    id: entry.id,
    date: entry.date,
    timeRange: entry.timeRange,
    title: entry.title,
    contentLength: entry.content?.length || 0,
    timeFields: {
      hour: entry.hour,
      hourType: typeof entry.hour,
      minute: entry.minute,
      minuteType: typeof entry.minute,
      second: entry.second,
      secondType: typeof entry.second,
    },
    hasTags: !!entry.tags,
    tagsCount: entry.tags?.length || 0,
    archived: entry.archived,
    pinned: entry.pinned,
  });
  console.log('[Database] Full Entry JSON:', JSON.stringify(entry, null, 2));
  console.log('═══════════════════════════════════════════════════════════');
  
  const database = getDatabase();
  // Use formatDate for created_at/updated_at to ensure consistency
  // For current timestamp, we can use ISO string since it's always "now" (positive year)
  const now = new Date().toISOString();
  
  try {
    // Verify time columns exist
    const tableInfo = database.prepare('PRAGMA table_info(journal_entries)').all() as TableInfoRow[];
    const hasHour = tableInfo.some(col => col.name === 'hour');
    const hasMinute = tableInfo.some(col => col.name === 'minute');
    const hasSecond = tableInfo.some(col => col.name === 'second');
    console.log('[Database] ✅ Schema check - Time columns exist:', { hasHour, hasMinute, hasSecond });
    
    if (!hasHour || !hasMinute || !hasSecond) {
      console.error('[Database] ❌ WARNING: Time columns missing! Running emergency migration...');
      migrateDatabase(database);
    }
    
    // Calculate JDN from date string
    const jdn = calculateJDNFromDateString(entry.date);
    
    // If entry has an ID, update that specific entry
    if (entry.id) {
      console.log('Updating existing entry by ID');
      
      // Save current version before updating
      const currentEntry = getEntryById(entry.id);
      if (currentEntry) {
        const versionStmt = database.prepare(`
          INSERT INTO entry_versions (entry_id, date, time_range, title, content, tags, linked_entries, created_at, version_created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        versionStmt.run(
          currentEntry.id,
          currentEntry.date,
          currentEntry.timeRange,
          currentEntry.title,
          currentEntry.content,
          JSON.stringify(currentEntry.tags || []),
          JSON.stringify(currentEntry.linkedEntries || []),
          currentEntry.createdAt,
          now
        );
      }
      
      // PROFESSIONAL TIME SAVE: Explicitly process each time field
      // Handle hour: can be null if not set
      let dbHour: number | null = null;
      if (entry.hour !== undefined && entry.hour !== null) {
        const h = Number(entry.hour);
        if (!isNaN(h) && h >= 0 && h <= 23) {
          dbHour = h;
        }
      }
      
      // Handle minute: must be 0-59, default to 0 if not valid
      let dbMinute: number = 0;
      if (entry.minute !== undefined && entry.minute !== null) {
        const m = Number(entry.minute);
        if (!isNaN(m) && m >= 0 && m <= 59) {
          dbMinute = m;
        }
      }
      
      // Handle second: must be 0-59, default to 0 if not valid
      let dbSecond: number = 0;
      if (entry.second !== undefined && entry.second !== null) {
        const s = Number(entry.second);
        if (!isNaN(s) && s >= 0 && s <= 59) {
          dbSecond = s;
        }
      }
      
      console.log('[Database] UPDATE - Processing time values:', {
        received: { hour: entry.hour, minute: entry.minute, second: entry.second },
        processed: { hour: dbHour, minute: dbMinute, second: dbSecond },
        types: {
          hourReceived: typeof entry.hour,
          minuteReceived: typeof entry.minute,
          secondReceived: typeof entry.second
        }
      });
      
      // CRITICAL: Use explicit transaction to ensure atomicity and immediate persistence
      const transaction = database.transaction(() => {
        const stmt = database.prepare(`
          UPDATE journal_entries 
          SET title = ?, content = ?, tags = ?, linked_entries = ?, archived = ?, pinned = ?, attachments = ?, updated_at = ?, jdn = ?, hour = ?, minute = ?, second = ?
          WHERE id = ?
        `);
        
        // Log exactly what we're updating
        console.log('[Database] UPDATE - Binding values:', {
          id: entry.id,
          hour: dbHour,
          minute: dbMinute,
          second: dbSecond,
          hourType: typeof dbHour,
          minuteType: typeof dbMinute,
          secondType: typeof dbSecond,
        });
        
        stmt.run(
          entry.title || '',
          entry.content || '',
          JSON.stringify(entry.tags || []),
          JSON.stringify(entry.linkedEntries || []),
          entry.archived ? 1 : 0,
          entry.pinned ? 1 : 0,
          JSON.stringify(entry.attachments || []),
          now,
          jdn,
          dbHour,
          dbMinute,
          dbSecond,
          entry.id
        );
      });
      
      // Execute transaction - this commits immediately
      transaction();
      console.log('[Database] ✅ UPDATE transaction committed');
      
      // CRITICAL: Force database to flush to disk immediately
      // This ensures data is persisted even if the program closes unexpectedly
      try {
        // Use exec for WAL checkpoint as it doesn't return a value
        database.exec('PRAGMA wal_checkpoint(FULL)');
        console.log('[Database] ✅ WAL checkpoint executed - data flushed to disk');
      } catch (checkpointError) {
        console.warn('[Database] ⚠️ WAL checkpoint warning (non-critical):', checkpointError);
      }
      
      // Verify the save by reading back the entry
      console.log('[Database] ✅ UPDATE statement executed. Verifying saved values...');
      const verifyStmt = database.prepare('SELECT hour, minute, second FROM journal_entries WHERE id = ?');
      const verifyRow = verifyStmt.get(entry.id) as Pick<JournalEntryRow, 'hour' | 'minute' | 'second'> | undefined;
      console.log('[Database] ✅✅✅ VERIFIED: Entry updated successfully. Values in database:', { 
        hour: verifyRow?.hour, 
        minute: verifyRow?.minute, 
        second: verifyRow?.second,
        hourType: typeof verifyRow?.hour,
        minuteType: typeof verifyRow?.minute,
        secondType: typeof verifyRow?.second,
      });
      console.log('[Database] Update operation COMPLETE for entry ID:', entry.id);
    } else {
      // If no ID, always insert a new entry (allows multiple entries per date/timeRange)
      console.log('[Database] INSERT - Inserting new entry');
      
      // PROFESSIONAL TIME SAVE: Explicitly process each time field
      // Handle hour: can be null if not set
      let dbHour: number | null = null;
      if (entry.hour !== undefined && entry.hour !== null) {
        const h = Number(entry.hour);
        if (!isNaN(h) && h >= 0 && h <= 23) {
          dbHour = h;
        }
      }
      
      // Handle minute: must be 0-59, default to 0 if not valid
      let dbMinute: number = 0;
      if (entry.minute !== undefined && entry.minute !== null) {
        const m = Number(entry.minute);
        if (!isNaN(m) && m >= 0 && m <= 59) {
          dbMinute = m;
        }
      }
      
      // Handle second: must be 0-59, default to 0 if not valid
      let dbSecond: number = 0;
      if (entry.second !== undefined && entry.second !== null) {
        const s = Number(entry.second);
        if (!isNaN(s) && s >= 0 && s <= 59) {
          dbSecond = s;
        }
      }
      
      console.log('[Database] INSERT - Processing time values:', {
        received: { hour: entry.hour, minute: entry.minute, second: entry.second },
        processed: { hour: dbHour, minute: dbMinute, second: dbSecond },
        types: {
          hourReceived: typeof entry.hour,
          minuteReceived: typeof entry.minute,
          secondReceived: typeof entry.second
        }
      });
      
      // CRITICAL: Use explicit transaction to ensure atomicity and immediate persistence
      const transaction = database.transaction(() => {
        const stmt = database.prepare(`
          INSERT INTO journal_entries (date, jdn, time_range, hour, minute, second, title, content, tags, linked_entries, archived, pinned, attachments, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Log exactly what we're inserting
        console.log('[Database] INSERT - Binding values:', {
          date: entry.date || '',
          jdn: jdn,
          timeRange: entry.timeRange || 'day',
          hour: dbHour,
          minute: dbMinute,
          second: dbSecond,
          hourType: typeof dbHour,
          minuteType: typeof dbMinute,
          secondType: typeof dbSecond,
        });
        
        stmt.run(
          entry.date || '',
          jdn,
          entry.timeRange || 'day',
          dbHour,
          dbMinute,
          dbSecond,
          entry.title || '',
          entry.content || '',
          JSON.stringify(entry.tags || []),
          JSON.stringify(entry.linkedEntries || []),
          entry.archived ? 1 : 0,
          entry.pinned ? 1 : 0,
          JSON.stringify(entry.attachments || []),
          entry.createdAt || now,
          now
        );
      });
      
      // Execute transaction - this commits immediately
      transaction();
      console.log('[Database] ✅ INSERT transaction committed');
      
      // CRITICAL: Force database to flush to disk immediately
      // This ensures data is persisted even if the program closes unexpectedly
      try {
        // Use exec for WAL checkpoint as it doesn't return a value
        database.exec('PRAGMA wal_checkpoint(FULL)');
        console.log('[Database] ✅ WAL checkpoint executed - data flushed to disk');
      } catch (checkpointError) {
        console.warn('[Database] ⚠️ WAL checkpoint warning (non-critical):', checkpointError);
      }
      
      // Get the inserted entry ID and verify the save
      console.log('[Database] ✅ INSERT statement executed. Verifying saved values...');
      const lastInsertId = database.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      if (lastInsertId) {
        const verifyStmt = database.prepare('SELECT hour, minute, second FROM journal_entries WHERE id = ?');
        const verifyRow = verifyStmt.get(lastInsertId.id) as Pick<JournalEntryRow, 'hour' | 'minute' | 'second'> | undefined;
        console.log('[Database] ✅✅✅ VERIFIED: Entry inserted successfully. Values in database:', { 
          id: lastInsertId.id,
          hour: verifyRow?.hour, 
          minute: verifyRow?.minute, 
          second: verifyRow?.second,
          hourType: typeof verifyRow?.hour,
          minuteType: typeof verifyRow?.minute,
          secondType: typeof verifyRow?.second,
        });
        console.log('[Database] Insert operation COMPLETE for new entry ID:', lastInsertId.id);
        
        // Return entry with the new ID
        return { ...entry, id: lastInsertId.id };
      }
      // Fallback: return entry as-is if ID retrieval fails
      return entry;
    }
    
    // For updates, return the entry with existing ID
    return entry;
  } catch (error: unknown) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('[Database] ❌❌❌ ERROR in saveEntry:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Database] Error details:', {
      message: errorMessage,
      stack: errorStack,
      entryId: entry.id,
      entryDate: entry.date,
    });
    console.error('═══════════════════════════════════════════════════════════');
    throw error;
  }
  console.log('[Database] ✅ saveEntry function completed successfully');
  console.log('═══════════════════════════════════════════════════════════');
}

function fixDatabaseSchema(database: Database.Database): void {
  console.log('Fixing database schema...');
  
  // Backup all entries
  const oldEntries = database.prepare('SELECT * FROM journal_entries').all() as JournalEntryRow[];
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

export function archiveEntry(id: number): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE journal_entries SET archived = 1, updated_at = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

export function unarchiveEntry(id: number): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE journal_entries SET archived = 0, updated_at = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

export function getArchivedEntries(): JournalEntry[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE archived = 1
    ORDER BY date DESC, created_at DESC
  `);
  
  const rows = stmt.all() as JournalEntryRow[];
  return rows.map(row => {
    const timeFields = extractTimeFields(row);
    return {
      id: row.id,
      date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange,
      hour: timeFields.hour,
      minute: timeFields.minute,
      second: timeFields.second,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
      archived: true,
      pinned: row.pinned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function pinEntry(id: number): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE journal_entries SET pinned = 1, updated_at = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

export function unpinEntry(id: number): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE journal_entries SET pinned = 0, updated_at = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

export function getPinnedEntries(): JournalEntry[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE pinned = 1 AND archived = 0
    ORDER BY date DESC, created_at DESC
  `);
  
  const rows = stmt.all() as JournalEntryRow[];
  return rows.map(row => {
    const timeFields = extractTimeFields(row);
    return {
      id: row.id,
      date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange,
      hour: timeFields.hour,
      minute: timeFields.minute,
      second: timeFields.second,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
      archived: row.archived === 1,
      pinned: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export interface EntryTemplate {
  id?: number;
  name: string;
  title?: string;
  content: string;
  tags?: string[];
  timeRange?: TimeRange;
  createdAt: string;
  updatedAt: string;
}

export function getAllTemplates(): EntryTemplate[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM entry_templates
    ORDER BY name ASC
  `);
  
  const rows = stmt.all() as EntryTemplateRow[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    title: row.title || '',
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    timeRange: row.time_range as TimeRange | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getTemplate(id: number): EntryTemplate | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM entry_templates WHERE id = ?');
  const row = stmt.get(id) as EntryTemplateRow | undefined;
  
  if (!row) {
    return null;
  }
  
  return {
    id: row.id,
    name: row.name,
    title: row.title || '',
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    timeRange: row.time_range as TimeRange | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveTemplate(template: EntryTemplate): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  
  if (template.id) {
    const stmt = database.prepare(`
      UPDATE entry_templates 
      SET name = ?, title = ?, content = ?, tags = ?, time_range = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      template.name,
      template.title || null,
      template.content,
      JSON.stringify(template.tags || []),
      template.timeRange || null,
      now,
      template.id
    );
  } else {
    const stmt = database.prepare(`
      INSERT INTO entry_templates (name, title, content, tags, time_range, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      template.name,
      template.title || null,
      template.content,
      JSON.stringify(template.tags || []),
      template.timeRange || null,
      template.createdAt || now,
      now
    );
  }
}

export function deleteTemplate(id: number): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM entry_templates WHERE id = ?');
  stmt.run(id);
}

export function deleteEntryByDateAndRange(date: string, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM journal_entries WHERE date = ? AND time_range = ?');
  stmt.run(date, timeRange);
}

export function searchEntries(query: string, includeArchived: boolean = false): JournalEntry[] {
  const database = getDatabase();
  const searchTerm = `%${query}%`;
  const archivedClause = includeArchived ? '' : 'AND archived = 0';
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE (title LIKE ? OR content LIKE ?) ${archivedClause}
    ORDER BY date DESC
  `);
  
  const rows = stmt.all(searchTerm, searchTerm) as JournalEntryRow[];
  return rows.map(row => {
    const timeFields = extractTimeFields(row);
    return {
      id: row.id,
      date: row.date,
      timeRange: (row.time_range || 'day') as TimeRange,
      hour: timeFields.hour,
      minute: timeFields.minute,
      second: timeFields.second,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
      archived: row.archived === 1,
      pinned: row.pinned === 1,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
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
      // For week, value is week number since a reference Monday (Monday-based weeks)
      // Use a reference Monday that works for all dates: January 1, 0001 was a Monday
      // (in proleptic Gregorian calendar)
      const referenceMonday = new Date(1, 0, 1); // January 1, 0001 (Monday)
      const weekStart = new Date(referenceMonday);
      weekStart.setDate(weekStart.getDate() + (value * 7));
      startDate = new Date(weekStart);
      endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      canonicalDate = startDate;
      break;
    case 'day':
      // For day, value is day number since a reference date
      // Use January 1, 0001 as reference (works for all dates in proleptic Gregorian calendar)
      const referenceDay = new Date(1, 0, 1);
      const dayDate = new Date(referenceDay);
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
    formatDate(startDate),
    formatDate(endDate)
  );
  
  // Filter entries to show all relevant entries for this time range
  // Show entries at the current level AND entries at more specific levels within this range
  return allEntries.filter(entry => {
    const entryDate = parseISODate(entry.date);
    
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
// Preferences interface - exported for use in other modules
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
  theme?: string; // Theme name (e.g., 'light', 'dark', 'auto', 'elite', 'journeyman', etc.)
  fontSize?: 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';
  showMinimap?: boolean;
  minimapPosition?: 'left' | 'right' | 'top' | 'bottom';
  minimapSize?: 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';
  restoreLastView?: boolean;
  lastViewedDate?: string;
  lastViewedMode?: 'decade' | 'year' | 'month' | 'week' | 'day';
  defaultCalendar?: string; // Calendar system (e.g., 'gregorian', 'islamic', 'hebrew')
  showMultipleCalendars?: boolean; // Show date in multiple calendars simultaneously
  backgroundImage?: string; // Path to custom background image, or empty for procedural art
  enableProceduralArt?: boolean; // Enable procedural background art (default: true)
  minimapCrystalUseDefaultColors?: boolean; // Override minimap crystal theming to always use default colors
  timeFormat?: '12h' | '24h'; // Time format: 12-hour (AM/PM) or 24-hour
  defaultExportFormat?: ExportFormat; // Default export format to use when exporting entries
  defaultExportMetadata?: ExportMetadata; // Default export metadata to use for all exports
  soundEffectsEnabled?: boolean; // Whether sound effects are enabled
  showAstromonixToolbarButton?: boolean; // Whether to show the AstroMonix toolbar button in day view
}

const DEFAULT_PREFERENCES: Preferences = {
  defaultViewMode: 'month',
  windowWidth: 2400,
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
  backgroundImage: undefined,
  enableProceduralArt: true,
  soundEffectsEnabled: true,
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
  const jsonValue = JSON.stringify(value);
  stmt.run(key, jsonValue);
  console.log(`[Database] Set preference: ${key} = ${jsonValue}`);
}

export function getAllPreferences(): Preferences {
  const database = getDatabase();
  const stmt = database.prepare('SELECT key, value FROM preferences');
  const rows = stmt.all() as PreferenceRow[];
  
  console.log(`[Database] Loading preferences from database: ${rows.length} rows found`);
  rows.forEach(row => {
    console.log(`[Database] Preference: ${row.key} = ${row.value}`);
  });
  
  const prefs: Preferences = { ...DEFAULT_PREFERENCES };
  
  // Valid size values (for fontSize and minimapSize)
  const validSizes: Array<Preferences['fontSize']> = [
    'xxxSmall', 'xxSmall', 'xSmall', 'small', 'medium', 
    'large', 'xLarge', 'xxLarge', 'xxxLarge'
  ];
  
  // Helper function to validate and fix size values
  const validateSize = (key: string, value: unknown, defaultValue: Preferences['fontSize']): Preferences['fontSize'] => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    const sizeStr = String(value).trim();
    if (validSizes.includes(sizeStr as Preferences['fontSize'])) {
      return sizeStr as Preferences['fontSize'];
    } else {
      // Invalid size - reset to default and update database
      console.warn(`Invalid ${key} value found: "${value}". Resetting to default.`);
      setPreference(key as 'fontSize' | 'minimapSize', defaultValue);
      return defaultValue;
    }
  };
  
  for (const row of rows) {
    const key = row.key as keyof Preferences;
    // Include all keys from the database, not just those in DEFAULT_PREFERENCES
    // This allows for new preferences to be added without updating DEFAULT_PREFERENCES immediately
    try {
      const parsedValue = JSON.parse(row.value);
      
      // Validate size values if they're being set
      if (key === 'fontSize') {
        prefs.fontSize = validateSize('fontSize', parsedValue, DEFAULT_PREFERENCES.fontSize!);
      } else if (key === 'minimapSize') {
        prefs.minimapSize = validateSize('minimapSize', parsedValue, DEFAULT_PREFERENCES.minimapSize!);
      } else {
        // Type-safe assignment for known preference keys
        const typedKey = key as keyof Preferences;
        (prefs as Record<string, unknown>)[typedKey] = parsedValue;
      }
    } catch {
      // If JSON parsing fails, try to use the raw value
      // This handles cases where the value might be stored as a plain string
      const rawValue = row.value;
      
      // Special handling for size values - validate them
      if (key === 'fontSize') {
        prefs.fontSize = validateSize('fontSize', rawValue, DEFAULT_PREFERENCES.fontSize!);
      } else if (key === 'minimapSize') {
        prefs.minimapSize = validateSize('minimapSize', rawValue, DEFAULT_PREFERENCES.minimapSize!);
      } else {
        // Try to infer the correct type based on the default value (if it exists)
        const defaultValue = DEFAULT_PREFERENCES[key];
        const typedKey = key as keyof Preferences;
        if (defaultValue !== undefined) {
          if (typeof defaultValue === 'number') {
            (prefs as Record<string, unknown>)[typedKey] = parseFloat(rawValue) || defaultValue;
          } else if (typeof defaultValue === 'boolean') {
            (prefs as Record<string, unknown>)[typedKey] = rawValue === 'true';
          } else {
            (prefs as Record<string, unknown>)[typedKey] = rawValue;
          }
        } else {
          // If no default exists, try to infer type from the value itself
          // For strings, use as-is; for empty strings, use undefined
          if (rawValue === '' || rawValue === 'null') {
            (prefs as Record<string, unknown>)[typedKey] = undefined;
          } else {
            (prefs as Record<string, unknown>)[typedKey] = rawValue;
          }
        }
      }
    }
  }
  
  console.log(`[Database] Final preferences object:`, {
    fontSize: prefs.fontSize,
    minimapSize: prefs.minimapSize,
    theme: prefs.theme,
    showMinimap: prefs.showMinimap
  });
  
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
      // CRITICAL: Flush all pending writes to disk before closing
      console.log('[Database] Flushing database to disk before close...');
      try {
        db.exec('PRAGMA wal_checkpoint(FULL)');
        console.log('[Database] ✅ Final WAL checkpoint completed - all data flushed to disk');
      } catch (checkpointError) {
        console.warn('[Database] ⚠️ Final checkpoint warning (non-critical):', checkpointError);
      }
      
      db.close();
      console.log('[Database] ✅ Database connection closed');
    } catch (error) {
      console.error('[Database] ❌ Error closing database:', error);
    } finally {
      db = null;
    }
  }
}

