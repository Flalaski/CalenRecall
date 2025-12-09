const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');

// This script can be run with: node scripts/check-database-status.js
// But it needs electron, so we'll create a simpler version

console.log('=== Database Status Check ===\n');

// Try to get user data path
let userDataPath;
try {
  // If running in Electron context
  userDataPath = app.getPath('userData');
} catch (e) {
  // If running standalone, try common paths
  const os = require('os');
  const platform = process.platform;
  if (platform === 'win32') {
    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CalenRecall');
  } else if (platform === 'darwin') {
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'CalenRecall');
  } else {
    userDataPath = path.join(os.homedir(), '.config', 'CalenRecall');
  }
}

console.log(`User Data Path: ${userDataPath}\n`);

// Check original database location
const originalDbPath = path.join(userDataPath, 'calenrecall.db');
console.log(`Original DB Path: ${originalDbPath}`);
console.log(`Exists: ${fs.existsSync(originalDbPath)}`);

if (fs.existsSync(originalDbPath)) {
  try {
    const stats = fs.statSync(originalDbPath);
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Modified: ${stats.mtime.toISOString()}`);
    
    const db = new Database(originalDbPath);
    const count = db.prepare('SELECT COUNT(*) as count FROM journal_entries').get();
    console.log(`Entries: ${count.count}`);
    db.close();
  } catch (e) {
    console.log(`Error reading: ${e.message}`);
  }
}

console.log('\n--- Profile Databases ---\n');

// Check profiles.json
const profilesPath = path.join(userDataPath, 'profiles.json');
console.log(`Profiles metadata: ${profilesPath}`);
console.log(`Exists: ${fs.existsSync(profilesPath)}`);

if (fs.existsSync(profilesPath)) {
  try {
    const profilesData = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
    console.log(`Current Profile ID: ${profilesData.currentProfileId}`);
    console.log(`Total Profiles: ${profilesData.profiles.length}\n`);
    
    for (const profile of profilesData.profiles) {
      console.log(`Profile: ${profile.name} (${profile.id})`);
      const profileDbPath = path.join(userDataPath, profile.databasePath);
      console.log(`  Path: ${profileDbPath}`);
      console.log(`  Exists: ${fs.existsSync(profileDbPath)}`);
      
      if (fs.existsSync(profileDbPath)) {
        try {
          const stats = fs.statSync(profileDbPath);
          console.log(`  Size: ${stats.size} bytes`);
          console.log(`  Modified: ${stats.mtime.toISOString()}`);
          
          const db = new Database(profileDbPath);
          const count = db.prepare('SELECT COUNT(*) as count FROM journal_entries').get();
          console.log(`  Entries: ${count.count}`);
          
          // Get date range
          const dateRange = db.prepare(`
            SELECT MIN(date) as min_date, MAX(date) as max_date 
            FROM journal_entries
          `).get();
          if (dateRange.min_date) {
            console.log(`  Date Range: ${dateRange.min_date} to ${dateRange.max_date}`);
          }
          
          db.close();
        } catch (e) {
          console.log(`  Error reading: ${e.message}`);
        }
      }
      console.log('');
    }
  } catch (e) {
    console.log(`Error reading profiles.json: ${e.message}`);
  }
}

// Check profiles directory
const profilesDir = path.join(userDataPath, 'profiles');
console.log(`\n--- Profiles Directory ---\n`);
console.log(`Path: ${profilesDir}`);
console.log(`Exists: ${fs.existsSync(profilesDir)}`);

if (fs.existsSync(profilesDir)) {
  try {
    const entries = fs.readdirSync(profilesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const profileDir = path.join(profilesDir, entry.name);
        const dbPath = path.join(profileDir, 'calenrecall.db');
        console.log(`\nProfile Directory: ${entry.name}`);
        console.log(`  DB Path: ${dbPath}`);
        console.log(`  DB Exists: ${fs.existsSync(dbPath)}`);
        
        if (fs.existsSync(dbPath)) {
          try {
            const stats = fs.statSync(dbPath);
            console.log(`  Size: ${stats.size} bytes`);
            
            const db = new Database(dbPath);
            const count = db.prepare('SELECT COUNT(*) as count FROM journal_entries').get();
            console.log(`  Entries: ${count.count}`);
            db.close();
          } catch (e) {
            console.log(`  Error: ${e.message}`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`Error reading profiles directory: ${e.message}`);
  }
}

console.log('\n=== End of Status Check ===');

