const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const releasePath = path.join(__dirname, '..', 'release');
let winUnpackedPath = path.join(releasePath, 'win-unpacked');

function sleepSync(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Busy wait
  }
}

// Function to specifically unlock and remove app.asar file
function unlockAndRemoveAppAsar(appAsarPath) {
  if (!fs.existsSync(appAsarPath)) {
    return true; // Already gone
  }

  console.log(`Attempting to unlock and remove app.asar: ${appAsarPath}`);
  
  // Strategy 1: Try to take ownership and grant permissions
  try {
    console.log('Taking ownership of app.asar...');
    execSync(`takeown /f "${appAsarPath}" /d y >nul 2>&1`, { timeout: 10000 });
    execSync(`icacls "${appAsarPath}" /grant Administrators:F /q >nul 2>&1`, { timeout: 10000 });
    sleepSync(1000);
  } catch (e) {
    // Continue even if takeown fails
  }

  // Strategy 2: Try renaming first (Windows often releases locks on rename)
  const renamedPath = appAsarPath + '.deleteme.' + Date.now();
  try {
    fs.renameSync(appAsarPath, renamedPath);
    appAsarPath = renamedPath; // Update path for deletion
    console.log('Renamed app.asar to release file lock...');
    sleepSync(1000);
  } catch (e) {
    // Rename failed, continue with direct deletion
  }

  // Strategy 3: Try multiple deletion methods with retries
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try Node.js fs.unlinkSync first
      fs.unlinkSync(appAsarPath);
      console.log('Successfully removed app.asar using Node.js fs.unlinkSync.');
      return true;
    } catch (e) {
      if (attempt < maxRetries) {
        // Kill processes that might be locking it
        try {
          execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
          execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
          // Also try to kill processes using the file
          try {
            // Use PowerShell to find processes locking the file
            const psCmd = `powershell -Command "Get-Process | Where-Object {$_.Path -like '*electron*' -or $_.Path -like '*node*'} | Stop-Process -Force -ErrorAction SilentlyContinue"`;
            execSync(psCmd, { stdio: 'ignore', timeout: 5000 });
          } catch (psErr) {
            // Ignore PowerShell errors
          }
        } catch (killErr) {
          // Ignore kill errors
        }
        sleepSync(500 * attempt); // Exponential backoff
      } else {
        // Last attempt: try Windows del command
        try {
          execSync(`del /f /q "${appAsarPath}"`, { stdio: 'ignore', timeout: 5000 });
          console.log('Successfully removed app.asar using Windows del command.');
          return true;
        } catch (delErr) {
          console.warn(`Failed to remove app.asar after ${maxRetries} attempts.`);
          return false;
        }
      }
    }
  }
  
  return false;
}

// Main execution
(function main() {
  if (os.platform() !== 'win32') {
    // Only needed on Windows
    process.exit(0);
  }

  try {
    console.log('Performing pre-build cleanup to ensure file handles are released...');
    
    // Aggressively kill any processes that might lock files
    try {
      execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
      execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
      // Also try to kill any processes using the release directory
      execSync('wmic process where "name like \'%%electron%%\' or name like \'%%node%%\'" delete >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
    } catch (e) {
      // Ignore errors if processes don't exist
    }
    
    sleepSync(2000);
    
    // Strategy: Move the entire release directory instead of deleting it
    // This often releases file locks better than deletion
    if (fs.existsSync(releasePath)) {
      const timestamp = Date.now();
      const movedPath = releasePath + '.old.' + timestamp;
      
      // Check if win-unpacked exists and is causing issues
      if (fs.existsSync(winUnpackedPath)) {
        console.log('Moving release directory to release file locks...');
        try {
          // Try to move the entire release directory
          fs.renameSync(releasePath, movedPath);
          console.log('Successfully moved release directory.');
          // Now delete it in the background (Windows will eventually release locks)
          setTimeout(() => {
            try {
              execSync(`rmdir /s /q "${movedPath}"`, { stdio: 'ignore', timeout: 30000 });
            } catch (e) {
              // Ignore - will be cleaned up later
            }
          }, 5000);
          // Exit early since we moved it
          console.log('Pre-build cleanup completed.');
          process.exit(0);
        } catch (e) {
          // Move failed, continue with deletion strategy
          console.log('Move failed, trying deletion strategy...');
        }
      }
    }
    
    // Specifically target the win-unpacked directory if it exists
    if (fs.existsSync(winUnpackedPath)) {
      console.log('Removing win-unpacked directory to prevent file lock issues...');
      
      try {
        // CRITICAL: First, specifically target and remove app.asar file
        // This is the file that's causing the lock issue
        const appAsarPath = path.join(winUnpackedPath, 'resources', 'app.asar');
        if (fs.existsSync(appAsarPath)) {
          const appAsarRemoved = unlockAndRemoveAppAsar(appAsarPath);
          if (!appAsarRemoved) {
            console.warn('Warning: Could not remove app.asar file. It may still be locked.');
            console.warn('Attempting to continue with directory removal...');
          }
          // Wait a bit after removing app.asar
          sleepSync(2000);
        }
        
        // Strategy 1: Use Windows takeown and icacls to unlock remaining files
        try {
          console.log('Taking ownership of remaining files in win-unpacked...');
          execSync(`takeown /f "${winUnpackedPath}" /r /d y >nul 2>&1`, { timeout: 10000 });
          execSync(`icacls "${winUnpackedPath}" /grant Administrators:F /t /q >nul 2>&1`, { timeout: 10000 });
          sleepSync(1000);
        } catch (e) {
          // Continue even if takeown fails
        }
        
        // Strategy 2: Try renaming first (Windows often releases locks on rename)
        const renamedPath = winUnpackedPath + '.deleteme.' + Date.now();
        try {
          fs.renameSync(winUnpackedPath, renamedPath);
          winUnpackedPath = renamedPath; // Update path for deletion
          console.log('Renamed directory to release file locks...');
          sleepSync(1000);
        } catch (e) {
          // Rename failed, continue with direct deletion
        }
        
        // Strategy 3: Try Windows command-line removal
        try {
          execSync(`rmdir /s /q "${winUnpackedPath}"`, { stdio: 'ignore', timeout: 10000 });
          console.log('Successfully removed using Windows rmdir.');
        } catch (e) {
          // If that fails, try Node.js removal with retries
          try {
            fs.rmSync(winUnpackedPath, { recursive: true, force: true, maxRetries: 15, retryDelay: 300 });
            console.log('Successfully removed using Node.js fs.rmSync.');
          } catch (e2) {
            // Last resort - try without maxRetries for older Node versions
            try {
              fs.rmSync(winUnpackedPath, { recursive: true, force: true });
              console.log('Successfully removed using Node.js fs.rmSync (fallback).');
            } catch (e3) {
              console.warn('Warning: Could not fully remove win-unpacked directory.');
              console.warn('The directory may still be locked. Please:');
              console.warn('1. Close any Explorer windows viewing the release folder');
              console.warn('2. Close any code editors (VS Code/Cursor) that may have the folder open');
              console.warn('3. Check if antivirus is scanning the file');
              console.warn('4. Try running the build again');
              // Don't throw - let electron-builder try anyway
            }
          }
        }
      } catch (error) {
        console.warn('Error during directory removal:', error.message);
      }
    }
    
    // Final wait to ensure Windows releases all file handles
    console.log('Waiting for Windows to release all file handles...');
    // Kill processes one more time before final wait
    try {
      execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
      execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
      // Also try PowerShell to kill any remaining processes
      try {
        const psCmd = `powershell -Command "Get-Process | Where-Object {$_.Path -like '*electron*' -or $_.Path -like '*node*'} | Stop-Process -Force -ErrorAction SilentlyContinue"`;
        execSync(psCmd, { stdio: 'ignore', timeout: 5000 });
      } catch (psErr) {
        // Ignore PowerShell errors
      }
    } catch (e) {
      // Ignore errors
    }
    sleepSync(5000); // Longer wait to ensure all handles are released
    
    // Verify that app.asar is gone if win-unpacked still exists
    const appAsarPath = path.join(releasePath, 'win-unpacked', 'resources', 'app.asar');
    if (fs.existsSync(appAsarPath)) {
      console.warn('Warning: app.asar still exists after cleanup. Attempting one more removal...');
      unlockAndRemoveAppAsar(appAsarPath);
      sleepSync(2000);
    }
    
    console.log('Pre-build cleanup completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during pre-build cleanup:', error.message);
    // Don't exit with error - let electron-builder try anyway
    process.exit(0);
  }
})();


