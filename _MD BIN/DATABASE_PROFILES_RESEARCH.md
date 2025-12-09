# Database Profiles Research
## Safe and Reliable Methods for Multiple Database Management

**Date:** 2024  
**Purpose:** Research robust methods for implementing database profiles in CalenRecall, allowing users to create and manage multiple separate databases of information.

---

## Executive Summary

This document explores safe, reliable, and robust methods for implementing database profiles in CalenRecall. The goal is to allow users to create multiple isolated databases, each containing their own journal entries, preferences, and templates, while maintaining data integrity, security, and performance.

**Key Findings:**
- **Recommended Approach:** Separate SQLite database files per profile (File-Based Isolation)
- **Alternative Approaches:** Single database with profile column, SQLite ATTACH DATABASE
- **Critical Considerations:** Data isolation, migration, backup/restore, profile switching, and security

---

## Current Architecture

### Current Implementation
- **Database:** SQLite using `better-sqlite3`
- **Location:** `app.getPath('userData')/calenrecall.db`
- **Structure:** Single database file containing:
  - `journal_entries` table
  - `preferences` table
  - `entry_templates` table
  - `entry_versions` table
- **Initialization:** Database initialized once at app startup
- **Connection:** Single global database connection (`let db: Database.Database | null = null`)

### Current Data Flow
1. App starts → `initDatabase()` called in `main.ts`
2. Database connection established and stored in module-level variable
3. All database operations use this single connection
4. IPC handlers in `ipc-handlers.ts` call database functions
5. Renderer process communicates via IPC

---

## Approach 1: File-Based Isolation (RECOMMENDED)

### Overview
Each profile has its own separate SQLite database file. This provides complete data isolation and is the most straightforward approach.

### Implementation Strategy

#### Profile Structure
```
userData/
├── profiles/
│   ├── default/
│   │   ├── calenrecall.db
│   │   └── attachments/ (if stored separately)
│   ├── work/
│   │   ├── calenrecall.db
│   │   └── attachments/
│   └── personal/
│       ├── calenrecall.db
│       └── attachments/
└── profiles.json (metadata about all profiles)
```

#### Profile Metadata File (`profiles.json`)
```json
{
  "profiles": [
    {
      "id": "default",
      "name": "Default",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsed": "2024-01-15T10:30:00Z",
      "databasePath": "profiles/default/calenrecall.db",
      "isDefault": true
    },
    {
      "id": "work",
      "name": "Work",
      "createdAt": "2024-01-10T00:00:00Z",
      "lastUsed": "2024-01-15T09:00:00Z",
      "databasePath": "profiles/work/calenrecall.db",
      "isDefault": false
    }
  ],
  "currentProfileId": "default"
}
```

### Advantages
1. **Complete Data Isolation:** Each profile's data is completely separate
2. **Simple Implementation:** No schema changes needed
3. **Easy Backup/Restore:** Copy entire profile directory
4. **No Cross-Contamination Risk:** Impossible to accidentally access wrong profile's data
5. **Independent Migration:** Each database can be migrated independently
6. **Performance:** No overhead from filtering by profile
7. **Portability:** Easy to move/export individual profiles

### Disadvantages
1. **Multiple Database Connections:** Need to manage connection lifecycle
2. **Profile Switching:** Must close current connection, open new one
3. **Storage Overhead:** Each profile has its own database file (minimal)
4. **Code Complexity:** Need to pass profile context to database functions

### Security Considerations
1. **File System Permissions:** Ensure profile directories have appropriate permissions
2. **Path Validation:** Strictly validate profile paths to prevent directory traversal
3. **Profile ID Validation:** Sanitize profile IDs to prevent injection
4. **Access Control:** Consider encryption for sensitive profiles (optional)

### Implementation Details

#### Database Module Changes
```typescript
// Current: Single global connection
let db: Database.Database | null = null;

// New: Profile-aware connection management
interface ProfileContext {
  id: string;
  name: string;
  dbPath: string;
}

let currentProfile: ProfileContext | null = null;
let db: Database.Database | null = null;

export function initDatabase(profileId?: string): Database.Database {
  const profile = profileId 
    ? getProfile(profileId) 
    : getDefaultProfile();
  
  if (db && currentProfile?.id === profile.id) {
    return db; // Already connected to this profile
  }
  
  // Close existing connection if switching profiles
  if (db) {
    closeDatabase();
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, profile.dbPath);
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(dbPath);
  currentProfile = profile;
  
  // Configure database (WAL mode, etc.)
  configureDatabase(db);
  
  // Run migrations
  migrateDatabase(db);
  
  return db;
}

export function switchProfile(profileId: string): void {
  if (currentProfile?.id === profileId) {
    return; // Already on this profile
  }
  
  // Flush current database
  if (db) {
    flushDatabase();
    closeDatabase();
  }
  
  // Initialize new profile
  initDatabase(profileId);
  
  // Notify renderer process
  if (mainWindow) {
    mainWindow.webContents.send('profile-switched', { profileId });
  }
}
```

#### Profile Management Functions
```typescript
export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  databasePath: string;
  isDefault: boolean;
}

export function getAllProfiles(): Profile[] {
  const profilesPath = getProfilesMetadataPath();
  if (!fs.existsSync(profilesPath)) {
    return [createDefaultProfile()];
  }
  
  const data = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
  return data.profiles;
}

export function createProfile(name: string): Profile {
  const id = sanitizeProfileId(name);
  const profiles = getAllProfiles();
  
  // Check for duplicate ID
  if (profiles.some(p => p.id === id)) {
    throw new Error(`Profile with ID "${id}" already exists`);
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join('profiles', id, 'calenrecall.db');
  const fullDbPath = path.join(userDataPath, dbPath);
  
  // Create profile directory
  const profileDir = path.dirname(fullDbPath);
  fs.mkdirSync(profileDir, { recursive: true });
  
  // Initialize database for new profile
  const tempDb = new Database(fullDbPath);
  configureDatabase(tempDb);
  createTables(tempDb);
  tempDb.close();
  
  const profile: Profile = {
    id,
    name,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    databasePath: dbPath,
    isDefault: false,
  };
  
  // Add to profiles list
  const profilesData = {
    profiles: [...profiles, profile],
    currentProfileId: profilesData?.currentProfileId || 'default',
  };
  
  saveProfilesMetadata(profilesData);
  
  return profile;
}

export function deleteProfile(profileId: string): void {
  if (profileId === 'default') {
    throw new Error('Cannot delete default profile');
  }
  
  const profiles = getAllProfiles();
  const profile = profiles.find(p => p.id === profileId);
  
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }
  
  // If currently using this profile, switch to default
  if (currentProfile?.id === profileId) {
    switchProfile('default');
  }
  
  // Delete profile directory
  const userDataPath = app.getPath('userData');
  const profileDir = path.join(userDataPath, path.dirname(profile.databasePath));
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  
  // Remove from profiles list
  const updatedProfiles = profiles.filter(p => p.id !== profileId);
  const profilesData = {
    profiles: updatedProfiles,
    currentProfileId: currentProfile?.id === profileId ? 'default' : currentProfile?.id || 'default',
  };
  
  saveProfilesMetadata(profilesData);
}
```

### Migration Strategy
1. **Existing Users:** On first launch with profiles feature:
   - Detect existing `calenrecall.db` in userData root
   - Create "default" profile
   - Move existing database to `profiles/default/calenrecall.db`
   - Create `profiles.json` with default profile entry

2. **New Users:** Start with default profile structure

### Backup and Restore
```typescript
export function backupProfile(profileId: string, backupPath: string): void {
  const profile = getProfile(profileId);
  const userDataPath = app.getPath('userData');
  const profileDir = path.join(userDataPath, path.dirname(profile.databasePath));
  
  // Create backup directory
  fs.mkdirSync(backupPath, { recursive: true });
  
  // Copy database file
  const dbPath = path.join(userDataPath, profile.databasePath);
  const backupDbPath = path.join(backupPath, 'calenrecall.db');
  fs.copyFileSync(dbPath, backupDbPath);
  
  // Copy attachments if they exist
  const attachmentsDir = path.join(profileDir, 'attachments');
  if (fs.existsSync(attachmentsDir)) {
    const backupAttachmentsDir = path.join(backupPath, 'attachments');
    fs.cpSync(attachmentsDir, backupAttachmentsDir, { recursive: true });
  }
  
  // Include profile metadata
  const profileMetadata = {
    profile,
    backupDate: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(backupPath, 'profile-metadata.json'),
    JSON.stringify(profileMetadata, null, 2)
  );
}

export function restoreProfile(backupPath: string, profileName: string): Profile {
  // Validate backup
  const dbPath = path.join(backupPath, 'calenrecall.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error('Invalid backup: database file not found');
  }
  
  // Create new profile
  const profile = createProfile(profileName);
  const userDataPath = app.getPath('userData');
  const targetDbPath = path.join(userDataPath, profile.databasePath);
  
  // Restore database
  fs.copyFileSync(dbPath, targetDbPath);
  
  // Restore attachments if they exist
  const backupAttachmentsDir = path.join(backupPath, 'attachments');
  if (fs.existsSync(backupAttachmentsDir)) {
    const profileDir = path.dirname(targetDbPath);
    const targetAttachmentsDir = path.join(profileDir, 'attachments');
    fs.cpSync(backupAttachmentsDir, targetAttachmentsDir, { recursive: true });
  }
  
  // Re-initialize database to ensure schema is correct
  const tempDb = new Database(targetDbPath);
  migrateDatabase(tempDb);
  tempDb.close();
  
  return profile;
}
```

---

## Approach 2: Single Database with Profile Column

### Overview
Keep a single database file but add a `profile_id` column to all tables. Filter all queries by the current profile.

### Implementation Strategy

#### Schema Changes
```sql
-- Add profile_id to all tables
ALTER TABLE journal_entries ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE preferences ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE entry_templates ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE entry_versions ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default';

-- Create indexes
CREATE INDEX idx_journal_entries_profile_id ON journal_entries(profile_id);
CREATE INDEX idx_preferences_profile_id ON preferences(profile_id);
CREATE INDEX idx_entry_templates_profile_id ON entry_templates(profile_id);
```

### Advantages
1. **Single Connection:** Only one database connection needed
2. **No Profile Switching Overhead:** Just change context variable
3. **Simpler Connection Management:** No need to close/reopen connections
4. **Atomic Operations:** Can perform cross-profile operations if needed (future feature)

### Disadvantages
1. **Data Mixing Risk:** Higher risk of accidentally accessing wrong profile's data
2. **Query Complexity:** All queries must filter by profile_id
3. **Migration Complexity:** Need to migrate existing data to add profile_id
4. **Backup Complexity:** Cannot easily backup individual profiles
5. **Performance:** Additional index overhead on every query
6. **Schema Changes:** Requires migration of existing database

### Security Considerations
1. **Query Injection:** Must ensure profile_id is always properly parameterized
2. **Context Validation:** Strictly validate current profile context
3. **Default Profile:** Ensure default profile_id is always set

### Implementation Example
```typescript
let currentProfileId: string = 'default';

export function setCurrentProfile(profileId: string): void {
  // Validate profile exists
  if (!profileExists(profileId)) {
    throw new Error(`Profile "${profileId}" does not exist`);
  }
  currentProfileId = profileId;
  
  // Notify renderer
  if (mainWindow) {
    mainWindow.webContents.send('profile-switched', { profileId });
  }
}

export function getEntries(startDate: string, endDate: string): JournalEntry[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM journal_entries 
    WHERE profile_id = ? AND date >= ? AND date <= ?
    ORDER BY date DESC
  `);
  
  const rows = stmt.all(currentProfileId, startDate, endDate) as JournalEntryRow[];
  // ... rest of implementation
}
```

---

## Approach 3: SQLite ATTACH DATABASE

### Overview
Use SQLite's `ATTACH DATABASE` feature to attach multiple database files to a single connection, allowing queries across profiles if needed.

### Implementation Strategy

```typescript
let db: Database.Database | null = null;
let attachedDatabases: Map<string, string> = new Map(); // profileId -> alias

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData');
  const mainDbPath = path.join(userDataPath, 'calenrecall.db');
  
  db = new Database(mainDbPath);
  configureDatabase(db);
  
  // Attach all profile databases
  const profiles = getAllProfiles();
  for (const profile of profiles) {
    const profileDbPath = path.join(userDataPath, profile.databasePath);
    if (fs.existsSync(profileDbPath)) {
      const alias = `profile_${profile.id}`;
      db.exec(`ATTACH DATABASE '${profileDbPath}' AS ${alias}`);
      attachedDatabases.set(profile.id, alias);
    }
  }
  
  return db;
}

export function getEntries(profileId: string, startDate: string, endDate: string): JournalEntry[] {
  const database = getDatabase();
  const alias = attachedDatabases.get(profileId);
  if (!alias) {
    throw new Error(`Profile "${profileId}" not attached`);
  }
  
  const stmt = database.prepare(`
    SELECT * FROM ${alias}.journal_entries 
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);
  
  const rows = stmt.all(startDate, endDate) as JournalEntryRow[];
  // ... rest of implementation
}
```

### Advantages
1. **Single Connection:** One database connection
2. **Cross-Profile Queries:** Can query across profiles if needed
3. **Isolation:** Each profile still has its own database file

### Disadvantages
1. **Complexity:** More complex query syntax with aliases
2. **Performance:** Attaching many databases may have overhead
3. **Connection Limits:** SQLite has limits on attached databases
4. **Error Handling:** More complex error handling for missing databases

---

## Comparison Matrix

| Feature | File-Based Isolation | Single DB + Column | ATTACH DATABASE |
|---------|---------------------|-------------------|-----------------|
| **Data Isolation** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good | ⭐⭐⭐⭐ Very Good |
| **Implementation Complexity** | ⭐⭐⭐⭐ Simple | ⭐⭐⭐ Moderate | ⭐⭐ Complex |
| **Performance** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐ Good |
| **Backup/Restore** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐ Difficult | ⭐⭐⭐ Good |
| **Migration Complexity** | ⭐⭐⭐⭐ Simple | ⭐⭐ Complex | ⭐⭐⭐ Moderate |
| **Security** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good | ⭐⭐⭐⭐ Very Good |
| **Profile Switching** | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Very Good |
| **Code Changes Required** | ⭐⭐⭐ Moderate | ⭐⭐⭐⭐ Extensive | ⭐⭐⭐ Moderate |

---

## Recommended Approach: File-Based Isolation

### Rationale
1. **Best Data Isolation:** Complete separation prevents any cross-contamination
2. **Simplest Mental Model:** Each profile = one database file (easy to understand)
3. **Easiest Backup:** Copy directory = complete backup
4. **Future-Proof:** Easy to add features like profile encryption, cloud sync per profile
5. **User Trust:** Users can see and verify their data is separate

### Implementation Phases

#### Phase 1: Core Infrastructure
1. Create profile management system
2. Implement profile metadata storage (`profiles.json`)
3. Refactor database initialization to be profile-aware
4. Add profile switching functionality
5. Migrate existing users to default profile

#### Phase 2: UI Integration
1. Add profile selector to UI
2. Create profile management dialog (create, delete, rename)
3. Add profile switching confirmation
4. Show current profile indicator

#### Phase 3: Advanced Features
1. Profile backup/restore UI
2. Profile export/import
3. Profile settings (optional encryption, etc.)
4. Profile statistics

### Critical Implementation Details

#### 1. Profile ID Sanitization
```typescript
function sanitizeProfileId(name: string): string {
  // Convert to lowercase, replace spaces/special chars with hyphens
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'profile';
}
```

#### 2. Path Validation
```typescript
function validateProfilePath(profilePath: string, userDataPath: string): boolean {
  const fullPath = path.resolve(userDataPath, profilePath);
  const userDataResolved = path.resolve(userDataPath);
  
  // Ensure path is within userData directory
  return fullPath.startsWith(userDataResolved);
}
```

#### 3. Connection Lifecycle Management
```typescript
// Ensure database is properly closed before switching
export function switchProfile(profileId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Flush and close current database
      if (db) {
        flushDatabase();
        closeDatabase();
        db = null;
        currentProfile = null;
      }
      
      // Small delay to ensure file handles are released
      setTimeout(() => {
        try {
          initDatabase(profileId);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 100);
    } catch (error) {
      reject(error);
    }
  });
}
```

#### 4. Error Handling
```typescript
export function initDatabase(profileId?: string): Database.Database {
  try {
    const profile = profileId ? getProfile(profileId) : getDefaultProfile();
    
    // Validate profile exists
    if (!profile) {
      throw new Error(`Profile not found: ${profileId || 'default'}`);
    }
    
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, profile.databasePath);
    
    // Validate path
    if (!validateProfilePath(profile.databasePath, userDataPath)) {
      throw new Error(`Invalid profile path: ${profile.databasePath}`);
    }
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Open database
    db = new Database(dbPath);
    currentProfile = profile;
    
    // Configure and migrate
    configureDatabase(db);
    migrateDatabase(db);
    
    return db;
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error);
    
    // Fallback to default profile if current profile fails
    if (profileId && profileId !== 'default') {
      console.warn('[Database] Falling back to default profile');
      return initDatabase('default');
    }
    
    throw error;
  }
}
```

---

## Security Best Practices

### 1. Input Validation
- **Profile IDs:** Sanitize and validate all profile IDs
- **File Paths:** Never trust user-provided paths, always validate
- **SQL Injection:** Use parameterized queries (already done with better-sqlite3)

### 2. File System Security
- **Permissions:** Set appropriate file permissions on profile directories
- **Path Traversal:** Prevent directory traversal attacks
- **Symlink Attacks:** Consider resolving symlinks (better-sqlite3 handles this)

### 3. Data Protection
- **Encryption at Rest:** Optional feature for sensitive profiles
- **Backup Encryption:** Encrypt backups if they contain sensitive data
- **Access Control:** Consider password protection for profiles (future feature)

### 4. Error Handling
- **Silent Failures:** Never silently fail on profile operations
- **User Feedback:** Always inform users of profile operation results
- **Logging:** Log all profile operations for debugging

---

## Migration Strategy for Existing Users

### Step 1: Detection
```typescript
function needsMigration(): boolean {
  const userDataPath = app.getPath('userData');
  const oldDbPath = path.join(userDataPath, 'calenrecall.db');
  const profilesPath = path.join(userDataPath, 'profiles.json');
  
  // If old database exists but profiles.json doesn't, need migration
  return fs.existsSync(oldDbPath) && !fs.existsSync(profilesPath);
}
```

### Step 2: Migration
```typescript
function migrateToProfiles(): void {
  const userDataPath = app.getPath('userData');
  const oldDbPath = path.join(userDataPath, 'calenrecall.db');
  const defaultProfileDir = path.join(userDataPath, 'profiles', 'default');
  const newDbPath = path.join(defaultProfileDir, 'calenrecall.db');
  
  // Create default profile directory
  fs.mkdirSync(defaultProfileDir, { recursive: true });
  
  // Move database file
  fs.renameSync(oldDbPath, newDbPath);
  
  // Create profiles.json
  const profilesData = {
    profiles: [{
      id: 'default',
      name: 'Default',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      databasePath: 'profiles/default/calenrecall.db',
      isDefault: true,
    }],
    currentProfileId: 'default',
  };
  
  fs.writeFileSync(
    path.join(userDataPath, 'profiles.json'),
    JSON.stringify(profilesData, null, 2)
  );
  
  console.log('[Migration] Successfully migrated to profiles system');
}
```

### Step 3: Verification
```typescript
function verifyMigration(): boolean {
  const userDataPath = app.getPath('userData');
  const newDbPath = path.join(userDataPath, 'profiles', 'default', 'calenrecall.db');
  
  if (!fs.existsSync(newDbPath)) {
    return false;
  }
  
  // Try to open and verify database
  try {
    const testDb = new Database(newDbPath);
    const tables = testDb.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    testDb.close();
    
    // Verify expected tables exist
    const tableNames = tables.map((t: any) => t.name);
    return tableNames.includes('journal_entries') && 
           tableNames.includes('preferences');
  } catch {
    return false;
  }
}
```

---

## Testing Considerations

### Unit Tests
1. Profile creation/deletion
2. Profile switching
3. Data isolation (entries from one profile not visible in another)
4. Migration from old database
5. Backup/restore functionality

### Integration Tests
1. Full workflow: create profile → add entries → switch profile → verify isolation
2. Error scenarios: invalid profile ID, missing database, corrupted profile
3. Concurrent access: multiple windows (if supported)

### Edge Cases
1. Profile name with special characters
2. Very long profile names
3. Profile with no entries
4. Switching profiles during save operation
5. Database file locked (another process)
6. Disk full scenario

---

## Performance Considerations

### File-Based Isolation
- **Connection Overhead:** Minimal - SQLite connections are lightweight
- **File I/O:** Each profile has its own file, but SQLite handles this efficiently
- **Memory:** Each connection uses minimal memory (~1-2MB)
- **Startup Time:** Slightly longer if checking multiple profiles, but negligible

### Optimization Strategies
1. **Lazy Profile Loading:** Only initialize profiles when needed
2. **Connection Pooling:** Not needed for SQLite (single-threaded)
3. **Caching:** Cache profile metadata to avoid repeated file reads
4. **Background Operations:** Perform profile operations in background threads if needed

---

## Future Enhancements

### Phase 4: Advanced Features
1. **Profile Encryption:** Optional encryption for sensitive profiles
2. **Cloud Sync per Profile:** Sync individual profiles to cloud storage
3. **Profile Templates:** Create new profiles from templates
4. **Profile Sharing:** Export/import profiles between users
5. **Profile Statistics:** Show entry counts, date ranges per profile
6. **Profile Search:** Search across all profiles (with permission)
7. **Profile Merge:** Merge two profiles together

### Phase 5: Enterprise Features
1. **Profile Permissions:** Password-protected profiles
2. **Profile Locking:** Auto-lock profiles after inactivity
3. **Audit Logging:** Log all profile access and changes
4. **Profile Quotas:** Limit storage per profile

---

## Conclusion

**Recommended Approach:** File-Based Isolation (Approach 1)

This approach provides the best balance of:
- **Security:** Complete data isolation
- **Simplicity:** Easy to understand and implement
- **Reliability:** Robust error handling and recovery
- **Maintainability:** Clear separation of concerns
- **User Trust:** Transparent data storage

**Implementation Priority:**
1. ✅ Core profile infrastructure
2. ✅ Profile switching
3. ✅ UI integration
4. ✅ Migration for existing users
5. ⏳ Advanced features (backup, export, etc.)

**Estimated Implementation Time:**
- Phase 1 (Core): 2-3 days
- Phase 2 (UI): 1-2 days
- Phase 3 (Advanced): 2-3 days
- **Total:** 5-8 days

---

## References

1. SQLite Documentation: https://www.sqlite.org/docs.html
2. better-sqlite3 Documentation: https://github.com/WiseLibs/better-sqlite3
3. Electron Security Best Practices: https://www.electronjs.org/docs/latest/tutorial/security
4. File System Security: https://owasp.org/www-community/vulnerabilities/Path_Traversal

---

**Document Status:** Complete  
**Last Updated:** 2024  
**Next Steps:** Review with team, create implementation plan, begin Phase 1

