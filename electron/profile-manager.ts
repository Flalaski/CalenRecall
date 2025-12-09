import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';

/**
 * Profile interface representing a database profile
 */
export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  databasePath: string;
  isDefault: boolean;
  autoLoad?: boolean;
}

/**
 * Profiles metadata structure stored in profiles.json
 */
interface ProfilesMetadata {
  profiles: Profile[];
  currentProfileId: string;
  autoLoadProfileId?: string;
}

/**
 * Get the path to the profiles metadata file
 */
function getProfilesMetadataPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'profiles.json');
}

/**
 * Sanitize a profile name to create a valid profile ID
 */
function sanitizeProfileId(name: string): string {
  // Convert to lowercase, replace spaces/special chars with hyphens
  let id = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  
  // Ensure it's not empty
  if (!id) {
    id = 'profile';
  }
  
  return id;
}

/**
 * Validate that a profile path is safe and within userData directory
 */
function validateProfilePath(profilePath: string, userDataPath: string): boolean {
  try {
    const fullPath = path.resolve(userDataPath, profilePath);
    const userDataResolved = path.resolve(userDataPath);
    
    // Ensure path is within userData directory
    return fullPath.startsWith(userDataResolved);
  } catch {
    return false;
  }
}

/**
 * Configure database with optimal settings
 */
function configureDatabase(database: Database.Database): void {
  try {
    // Enable WAL mode for better concurrency and durability
    database.exec('PRAGMA journal_mode = WAL');
    
    // Set synchronous to FULL to ensure data is written to disk immediately
    database.exec('PRAGMA synchronous = FULL');
    
    // Set busy_timeout to prevent locking issues
    database.exec('PRAGMA busy_timeout = 5000');
    
    // Ensure foreign keys are enabled
    database.exec('PRAGMA foreign_keys = ON');
  } catch (error) {
    console.error('[Profile Manager] Error configuring database:', error);
    throw error;
  }
}

/**
 * Create the default database schema
 */
function createTables(database: Database.Database): void {
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
}

/**
 * Create the default profile
 */
function createDefaultProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: 'default',
    name: 'Default',
    createdAt: now,
    lastUsed: now,
    databasePath: 'profiles/default/calenrecall.db',
    isDefault: true,
  };
}

/**
 * Load profiles metadata from disk
 */
function loadProfilesMetadata(): ProfilesMetadata | null {
  const metadataPath = getProfilesMetadataPath();
  
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(data) as ProfilesMetadata;
  } catch (error) {
    console.error('[Profile Manager] Error loading profiles metadata:', error);
    return null;
  }
}

/**
 * Save profiles metadata to disk
 */
function saveProfilesMetadata(metadata: ProfilesMetadata): void {
  const metadataPath = getProfilesMetadataPath();
  const userDataPath = app.getPath('userData');
  
  // Ensure userData directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  try {
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('[Profile Manager] Error saving profiles metadata:', error);
    throw error;
  }
}

/**
 * Get all profiles
 */
export function getAllProfiles(): Profile[] {
  const metadata = loadProfilesMetadata();
  
  if (!metadata || !metadata.profiles || metadata.profiles.length === 0) {
    // Return default profile if none exist
    return [createDefaultProfile()];
  }
  
  return metadata.profiles;
}

/**
 * Get a specific profile by ID
 */
export function getProfile(profileId: string): Profile | null {
  const profiles = getAllProfiles();
  return profiles.find(p => p.id === profileId) || null;
}

/**
 * Get the current active profile ID
 */
export function getCurrentProfileId(): string {
  const metadata = loadProfilesMetadata();
  
  if (!metadata) {
    return 'default';
  }
  
  // Validate that current profile exists
  const currentProfile = metadata.profiles.find(p => p.id === metadata.currentProfileId);
  if (!currentProfile) {
    return 'default';
  }
  
  return metadata.currentProfileId;
}

/**
 * Set the current active profile ID
 */
export function setCurrentProfileId(profileId: string): void {
  const metadata = loadProfilesMetadata();
  const profiles = metadata ? metadata.profiles : [createDefaultProfile()];
  
  // Validate profile exists
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }
  
  // Update last used timestamp
  profile.lastUsed = new Date().toISOString();
  
  // Save metadata (preserve autoLoadProfileId)
  const updatedMetadata: ProfilesMetadata = {
    profiles,
    currentProfileId: profileId,
    autoLoadProfileId: metadata?.autoLoadProfileId,
  };
  
  saveProfilesMetadata(updatedMetadata);
}

/**
 * Create a new profile
 */
export function createProfile(name: string): Profile {
  if (!name || name.trim().length === 0) {
    throw new Error('Profile name cannot be empty');
  }
  
  const id = sanitizeProfileId(name);
  const metadata = loadProfilesMetadata();
  const profiles = metadata ? metadata.profiles : [];
  
  // Check for duplicate ID
  if (profiles.some(p => p.id === id)) {
    throw new Error(`Profile with name "${name}" already exists`);
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join('profiles', id, 'calenrecall.db');
  const fullDbPath = path.join(userDataPath, dbPath);
  
  // Validate path
  if (!validateProfilePath(dbPath, userDataPath)) {
    throw new Error(`Invalid profile path: ${dbPath}`);
  }
  
  // Create profile directory
  const profileDir = path.dirname(fullDbPath);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  
  // Initialize database for new profile
  let tempDb: Database.Database | null = null;
  try {
    tempDb = new Database(fullDbPath);
    configureDatabase(tempDb);
    createTables(tempDb);
  } catch (error) {
    console.error('[Profile Manager] Error creating profile database:', error);
    throw new Error(`Failed to create profile database: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (tempDb) {
      tempDb.close();
    }
  }
  
  const now = new Date().toISOString();
  const profile: Profile = {
    id,
    name: name.trim(),
    createdAt: now,
    lastUsed: now,
    databasePath: dbPath,
    isDefault: false,
  };
  
  // Add to profiles list
  const updatedProfiles = [...profiles, profile];
  const currentProfileId = metadata?.currentProfileId || 'default';
  
  const updatedMetadata: ProfilesMetadata = {
    profiles: updatedProfiles,
    currentProfileId,
    autoLoadProfileId: metadata?.autoLoadProfileId,
  };
  
  saveProfilesMetadata(updatedMetadata);
  
  console.log(`[Profile Manager] Created profile: ${profile.id} (${profile.name})`);
  
  return profile;
}

/**
 * Delete a profile
 */
export function deleteProfile(profileId: string): void {
  if (profileId === 'default') {
    throw new Error('Cannot delete default profile');
  }
  
  const metadata = loadProfilesMetadata();
  if (!metadata) {
    throw new Error('No profiles found');
  }
  
  const profile = metadata.profiles.find(p => p.id === profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }
  
  // Delete profile directory
  const userDataPath = app.getPath('userData');
  const profileDir = path.join(userDataPath, path.dirname(profile.databasePath));
  
  if (fs.existsSync(profileDir)) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      console.log(`[Profile Manager] Deleted profile directory: ${profileDir}`);
    } catch (error) {
      console.error('[Profile Manager] Error deleting profile directory:', error);
      throw new Error(`Failed to delete profile directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Remove from profiles list
  const updatedProfiles = metadata.profiles.filter(p => p.id !== profileId);
  
  // If deleted profile was current, switch to default
  const newCurrentProfileId = metadata.currentProfileId === profileId 
    ? 'default' 
    : metadata.currentProfileId;
  
  // If deleted profile was auto-load, clear auto-load
  const newAutoLoadProfileId = metadata.autoLoadProfileId === profileId
    ? undefined
    : metadata.autoLoadProfileId;
  
  const updatedMetadata: ProfilesMetadata = {
    profiles: updatedProfiles,
    currentProfileId: newCurrentProfileId,
    autoLoadProfileId: newAutoLoadProfileId,
  };
  
  saveProfilesMetadata(updatedMetadata);
  
  console.log(`[Profile Manager] Deleted profile: ${profileId}`);
}

/**
 * Rename a profile
 */
export function renameProfile(profileId: string, newName: string): Profile {
  if (!newName || newName.trim().length === 0) {
    throw new Error('Profile name cannot be empty');
  }
  
  const metadata = loadProfilesMetadata();
  if (!metadata) {
    throw new Error('No profiles found');
  }
  
  const profile = metadata.profiles.find(p => p.id === profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }
  
  // Update profile name
  profile.name = newName.trim();
  
  const updatedMetadata: ProfilesMetadata = {
    profiles: metadata.profiles,
    currentProfileId: metadata.currentProfileId,
    autoLoadProfileId: metadata.autoLoadProfileId,
  };
  
  saveProfilesMetadata(updatedMetadata);
  
  console.log(`[Profile Manager] Renamed profile ${profileId} to "${newName}"`);
  
  return profile;
}

/**
 * Check if migration from old database structure is needed
 */
export function needsMigration(): boolean {
  const userDataPath = app.getPath('userData');
  const oldDbPath = path.join(userDataPath, 'calenrecall.db');
  const profilesPath = getProfilesMetadataPath();
  
  // If old database exists but profiles.json doesn't, need migration
  return fs.existsSync(oldDbPath) && !fs.existsSync(profilesPath);
}

/**
 * Check if original database still exists (recovery scenario)
 */
export function hasOriginalDatabase(): boolean {
  const userDataPath = app.getPath('userData');
  const oldDbPath = path.join(userDataPath, 'calenrecall.db');
  return fs.existsSync(oldDbPath);
}

/**
 * Get the path to the original database (for recovery)
 */
export function getOriginalDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'calenrecall.db');
}

/**
 * Recover data from orphaned WAL file
 * This function checks if there's a WAL file in the root directory that wasn't moved
 * and merges it with the profile database
 */
export function recoverFromOrphanedWAL(profileId: string): boolean {
  const userDataPath = app.getPath('userData');
  const walPath = path.join(userDataPath, 'calenrecall.db-wal');
  const shmPath = path.join(userDataPath, 'calenrecall.db-shm');
  
  // Check if orphaned WAL file exists
  if (!fs.existsSync(walPath)) {
    console.log('[Profile Manager] No orphaned WAL file found');
    return false;
  }
  
  console.log('[Profile Manager] ⚠️ Found orphaned WAL file - attempting recovery...');
  
  const profile = getProfile(profileId);
  if (!profile) {
    console.error('[Profile Manager] Profile not found for WAL recovery');
    return false;
  }
  
  const profileDbPath = path.join(userDataPath, profile.databasePath);
  
  if (!fs.existsSync(profileDbPath)) {
    console.error('[Profile Manager] Profile database not found for WAL recovery');
    return false;
  }
  
  try {
    // Open the profile database
    const profileDb = new Database(profileDbPath);
    
    // Get entry count before recovery
    const beforeCount = (profileDb.prepare('SELECT COUNT(*) as count FROM journal_entries').get() as { count: number } | undefined)?.count || 0;
    console.log(`[Profile Manager] Profile database has ${beforeCount} entries before WAL recovery`);
    
    // Copy WAL files to profile location
    const profileWalPath = `${profileDbPath}-wal`;
    const profileShmPath = `${profileDbPath}-shm`;
    
    console.log(`[Profile Manager] Copying WAL file from ${walPath} to ${profileWalPath}`);
    fs.copyFileSync(walPath, profileWalPath);
    
    if (fs.existsSync(shmPath)) {
      console.log(`[Profile Manager] Copying SHM file from ${shmPath} to ${profileShmPath}`);
      fs.copyFileSync(shmPath, profileShmPath);
    }
    
    // Close and reopen to pick up WAL file
    profileDb.close();
    
    // Reopen database - it should now see the WAL file
    const recoveredDb = new Database(profileDbPath);
    
    // Checkpoint WAL to merge all data into main database
    console.log('[Profile Manager] Checkpointing WAL to merge all data...');
    recoveredDb.exec('PRAGMA wal_checkpoint(FULL)');
    
    // Get entry count after recovery
    const afterCount = (recoveredDb.prepare('SELECT COUNT(*) as count FROM journal_entries').get() as { count: number } | undefined)?.count || 0;
    console.log(`[Profile Manager] Profile database has ${afterCount} entries after WAL recovery`);
    
    recoveredDb.close();
    
    // Remove orphaned WAL files from root (they're now in profile location)
    try {
      fs.unlinkSync(walPath);
      console.log('[Profile Manager] Removed orphaned WAL file from root');
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
        console.log('[Profile Manager] Removed orphaned SHM file from root');
      }
    } catch (cleanupError) {
      console.warn('[Profile Manager] Could not remove orphaned WAL files:', cleanupError);
    }
    
    if (afterCount > beforeCount) {
      console.log(`[Profile Manager] ✅ Successfully recovered ${afterCount - beforeCount} entries from orphaned WAL file!`);
      return true;
    } else {
      console.log('[Profile Manager] No additional entries found in WAL file');
      return false;
    }
  } catch (error) {
    console.error('[Profile Manager] ❌ Error recovering from orphaned WAL:', error);
    return false;
  }
}

/**
 * Get database creation date from file stats or first entry
 */
function getDatabaseCreationInfo(dbPath: string): { createdAt: string; name: string } {
  try {
    // Get file creation time
    const stats = fs.statSync(dbPath);
    const fileCreated = stats.birthtime || stats.mtime;
    
    // Try to get first entry date from database
    let firstEntryDate: string | null = null;
    try {
      const tempDb = new Database(dbPath);
      const firstEntry = tempDb.prepare(`
        SELECT MIN(created_at) as first_date FROM journal_entries
      `).get() as { first_date: string | null } | undefined;
      tempDb.close();
      
      if (firstEntry?.first_date) {
        firstEntryDate = firstEntry.first_date;
      }
    } catch (dbError) {
      console.warn('[Profile Manager] Could not read first entry date:', dbError);
    }
    
    // Use first entry date if available, otherwise use file creation date
    const creationDate = firstEntryDate ? new Date(firstEntryDate) : fileCreated;
    
    // Format date for profile name (e.g., "Journal 2024-01-15")
    const dateStr = creationDate.toISOString().split('T')[0];
    const year = creationDate.getFullYear();
    const month = creationDate.toLocaleString('default', { month: 'long' });
    
    // Create a meaningful name based on creation date
    const profileName = `Journal ${year}-${String(creationDate.getMonth() + 1).padStart(2, '0')}-${String(creationDate.getDate()).padStart(2, '0')}`;
    
    return {
      createdAt: creationDate.toISOString(),
      name: profileName,
    };
  } catch (error) {
    console.warn('[Profile Manager] Error getting database creation info:', error);
    // Fallback to current date
    const now = new Date();
    return {
      createdAt: now.toISOString(),
      name: `Journal ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    };
  }
}

/**
 * Migrate existing database to profiles system
 */
export function migrateToProfiles(): void {
  if (!needsMigration()) {
    console.log('[Profile Manager] No migration needed');
    return;
  }
  
  console.log('[Profile Manager] Starting migration to profiles system...');
  
  const userDataPath = app.getPath('userData');
  const oldDbPath = path.join(userDataPath, 'calenrecall.db');
  
  if (!fs.existsSync(oldDbPath)) {
    console.log('[Profile Manager] No existing database found, skipping migration');
    return;
  }
  
  // Verify database has entries before migration
  let entryCount = 0;
  try {
    const tempDb = new Database(oldDbPath);
    const countResult = tempDb.prepare(`
      SELECT COUNT(*) as count FROM journal_entries
    `).get() as { count: number } | undefined;
    tempDb.close();
    entryCount = countResult?.count || 0;
    console.log(`[Profile Manager] Found ${entryCount} entries in existing database`);
  } catch (dbError) {
    console.warn('[Profile Manager] Could not verify entry count:', dbError);
  }
  
  // Get database creation info to name the profile
  const creationInfo = getDatabaseCreationInfo(oldDbPath);
  console.log('[Profile Manager] Database creation info:', creationInfo);
  
  // Sanitize profile name
  const profileId = sanitizeProfileId(creationInfo.name);
  const profileDir = path.join(userDataPath, 'profiles', profileId);
  const newDbPath = path.join(profileDir, 'calenrecall.db');
  
  // Check if target already exists (shouldn't happen, but be safe)
  if (fs.existsSync(newDbPath)) {
    console.warn(`[Profile Manager] Target database already exists: ${newDbPath}`);
    console.warn('[Profile Manager] This might indicate a previous migration. Checking entry count...');
    try {
      const existingDb = new Database(newDbPath);
      const existingCount = (existingDb.prepare(`
        SELECT COUNT(*) as count FROM journal_entries
      `).get() as { count: number } | undefined)?.count || 0;
      existingDb.close();
      console.log(`[Profile Manager] Existing profile database has ${existingCount} entries`);
      
      if (existingCount < entryCount) {
        console.warn(`[Profile Manager] Existing database has fewer entries (${existingCount} vs ${entryCount}). Using original database.`);
        // Backup the existing one and use the original
        const backupPath = `${newDbPath}.backup-${Date.now()}`;
        fs.renameSync(newDbPath, backupPath);
        console.log(`[Profile Manager] Backed up existing database to: ${backupPath}`);
      } else {
        console.log('[Profile Manager] Existing database has same or more entries. Skipping migration.');
        // Create profile metadata pointing to existing database
        const existingProfile: Profile = {
          id: profileId,
          name: creationInfo.name,
          createdAt: creationInfo.createdAt,
          lastUsed: new Date().toISOString(),
          databasePath: `profiles/${profileId}/calenrecall.db`,
          isDefault: true,
        };
        
        const profilesData: ProfilesMetadata = {
          profiles: [existingProfile],
          currentProfileId: profileId,
          autoLoadProfileId: undefined, // No auto-load on migration
        };
        
        saveProfilesMetadata(profilesData);
        return;
      }
    } catch (checkError) {
      console.error('[Profile Manager] Error checking existing database:', checkError);
      // Continue with migration
    }
  }
  
  try {
    // Create profile directory
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    
    // CRITICAL: Checkpoint WAL before moving to ensure all data is in main database
    console.log(`[Profile Manager] Checkpointing WAL to ensure all data is in main database...`);
    try {
      const tempDb = new Database(oldDbPath);
      // Checkpoint WAL - this merges all WAL changes into the main database
      tempDb.exec('PRAGMA wal_checkpoint(FULL)');
      tempDb.close();
      console.log(`[Profile Manager] ✅ WAL checkpointed - all data merged into main database`);
    } catch (checkpointError) {
      console.warn(`[Profile Manager] ⚠️ Could not checkpoint WAL (database may not be in WAL mode):`, checkpointError);
      // Continue anyway - might not be in WAL mode
    }
    
    // Move database file and associated WAL files
    console.log(`[Profile Manager] Moving database from ${oldDbPath} to ${newDbPath}`);
    fs.renameSync(oldDbPath, newDbPath);
    console.log(`[Profile Manager] ✅ Moved main database file`);
    
    // Also move WAL files if they exist (SQLite WAL mode files)
    const walFiles = [
      { old: `${oldDbPath}-wal`, new: `${newDbPath}-wal` },
      { old: `${oldDbPath}-shm`, new: `${newDbPath}-shm` },
    ];
    
    for (const walFile of walFiles) {
      if (fs.existsSync(walFile.old)) {
        try {
          fs.renameSync(walFile.old, walFile.new);
          console.log(`[Profile Manager] ✅ Moved ${path.basename(walFile.old)} file`);
        } catch (walError) {
          console.warn(`[Profile Manager] Could not move ${path.basename(walFile.old)}:`, walError);
        }
      }
    }
    
    // Verify the moved database has entries
    try {
      const movedDb = new Database(newDbPath);
      const movedCount = (movedDb.prepare(`
        SELECT COUNT(*) as count FROM journal_entries
      `).get() as { count: number } | undefined)?.count || 0;
      movedDb.close();
      console.log(`[Profile Manager] ✅ Verified moved database has ${movedCount} entries`);
      
      if (movedCount !== entryCount) {
        console.warn(`[Profile Manager] ⚠️ Entry count mismatch: expected ${entryCount}, got ${movedCount}`);
      }
    } catch (verifyError) {
      console.error('[Profile Manager] Could not verify moved database:', verifyError);
    }
    
    // Create profile based on creation metadata
    const migratedProfile: Profile = {
      id: profileId,
      name: creationInfo.name,
      createdAt: creationInfo.createdAt,
      lastUsed: new Date().toISOString(),
      databasePath: `profiles/${profileId}/calenrecall.db`,
      isDefault: true, // First profile is always default
    };
    
    // Create profiles.json
    const profilesData: ProfilesMetadata = {
      profiles: [migratedProfile],
      currentProfileId: profileId,
      autoLoadProfileId: undefined, // No auto-load on migration
    };
    
    saveProfilesMetadata(profilesData);
    
    console.log(`[Profile Manager] ✅ Successfully migrated to profiles system as "${creationInfo.name}"`);
    console.log(`[Profile Manager] Database location: ${newDbPath}`);
  } catch (error) {
    console.error('[Profile Manager] ❌ Migration failed:', error);
    
    // Try to restore old database if migration failed
    if (fs.existsSync(newDbPath) && !fs.existsSync(oldDbPath)) {
      try {
        fs.renameSync(newDbPath, oldDbPath);
        console.log('[Profile Manager] Restored old database location');
        
        // Also restore WAL files
        const walFiles = [
          { old: `${newDbPath}-wal`, new: `${oldDbPath}-wal` },
          { old: `${newDbPath}-shm`, new: `${oldDbPath}-shm` },
        ];
        
        for (const walFile of walFiles) {
          if (fs.existsSync(walFile.old)) {
            try {
              fs.renameSync(walFile.old, walFile.new);
            } catch (walError) {
              console.warn(`[Profile Manager] Could not restore ${path.basename(walFile.old)}:`, walError);
            }
          }
        }
      } catch (restoreError) {
        console.error('[Profile Manager] Failed to restore old database:', restoreError);
      }
    }
    
    throw error;
  }
}

/**
 * Verify that a profile's database is valid
 */
export function verifyProfileDatabase(profileId: string): boolean {
  const profile = getProfile(profileId);
  if (!profile) {
    return false;
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, profile.databasePath);
  
  if (!fs.existsSync(dbPath)) {
    return false;
  }
  
  // Try to open and verify database
  try {
    const testDb = new Database(dbPath);
    const tables = testDb.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as Array<{ name: string }>;
    testDb.close();
    
    // Verify expected tables exist
    const tableNames = tables.map(t => t.name);
    return tableNames.includes('journal_entries') && 
           tableNames.includes('preferences');
  } catch {
    return false;
  }
}

/**
 * Get the profile ID that should be auto-loaded on startup
 */
export function getAutoLoadProfileId(): string | null {
  const metadata = loadProfilesMetadata();
  if (!metadata) {
    return null;
  }
  
  // If autoLoadProfileId is set, verify the profile still exists
  if (metadata.autoLoadProfileId) {
    const profile = metadata.profiles.find(p => p.id === metadata.autoLoadProfileId);
    if (profile) {
      return metadata.autoLoadProfileId;
    } else {
      // Profile was deleted, clear auto-load
      const updatedMetadata: ProfilesMetadata = {
        profiles: metadata.profiles,
        currentProfileId: metadata.currentProfileId,
        autoLoadProfileId: undefined, // Clear auto-load since profile doesn't exist
      };
      saveProfilesMetadata(updatedMetadata);
      return null;
    }
  }
  
  return null;
}

/**
 * Set the profile ID that should be auto-loaded on startup
 */
export function setAutoLoadProfileId(profileId: string | null): void {
  const metadata = loadProfilesMetadata();
  const profiles = metadata ? metadata.profiles : [createDefaultProfile()];
  const currentProfileId = metadata?.currentProfileId || 'default';
  
  // If profileId is provided, verify it exists
  if (profileId !== null) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) {
      throw new Error(`Profile "${profileId}" not found`);
    }
  }
  
  const updatedMetadata: ProfilesMetadata = {
    profiles,
    currentProfileId,
    autoLoadProfileId: profileId || undefined,
  };
  
  saveProfilesMetadata(updatedMetadata);
  
  if (profileId) {
    console.log(`[Profile Manager] Set auto-load profile: ${profileId}`);
  } else {
    console.log(`[Profile Manager] Cleared auto-load profile`);
  }
}

/**
 * Profile details interface with additional metadata
 */
export interface ProfileDetails extends Profile {
  entryCount?: number;
  defaultExportMetadata?: any; // ExportMetadata from preferences
  preferences?: any; // Partial preferences from database
  databaseSize?: number; // Database file size in bytes
  firstEntryDate?: string | null; // Date of first entry
  lastEntryDate?: string | null; // Date of last entry
}

/**
 * Get detailed information about a profile including preferences and export metadata
 */
export function getProfileDetails(profileId: string): ProfileDetails | null {
  const profile = getProfile(profileId);
  if (!profile) {
    return null;
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, profile.databasePath);
  
  const details: ProfileDetails = {
    ...profile,
  };
  
  // Try to get additional details from the database
  if (fs.existsSync(dbPath)) {
    try {
      // Get database file size
      const stats = fs.statSync(dbPath);
      details.databaseSize = stats.size;
      
      // Open database to get entry counts and preferences
      const tempDb = new Database(dbPath);
      
      try {
        // Get entry count
        const entryCountResult = tempDb.prepare(`
          SELECT COUNT(*) as count FROM journal_entries
        `).get() as { count: number } | undefined;
        details.entryCount = entryCountResult?.count || 0;
        
        // Get first and last entry dates
        const firstEntry = tempDb.prepare(`
          SELECT MIN(date) as first_date FROM journal_entries
        `).get() as { first_date: string | null } | undefined;
        details.firstEntryDate = firstEntry?.first_date || null;
        
        const lastEntry = tempDb.prepare(`
          SELECT MAX(date) as last_date FROM journal_entries
        `).get() as { last_date: string | null } | undefined;
        details.lastEntryDate = lastEntry?.last_date || null;
        
        // Get default export metadata from preferences
        // This contains all project properties and export fields
        const exportMetadataRow = tempDb.prepare(`
          SELECT value FROM preferences WHERE key = 'defaultExportMetadata'
        `).get() as { value: string } | undefined;
        
        if (exportMetadataRow?.value) {
          try {
            details.defaultExportMetadata = JSON.parse(exportMetadataRow.value);
          } catch {
            // Ignore parse errors
          }
        }
      } finally {
        tempDb.close();
      }
    } catch (error) {
      console.error(`[Profile Manager] Error getting profile details for ${profileId}:`, error);
      // Return basic profile info even if we can't get details
    }
  }
  
  return details;
}

