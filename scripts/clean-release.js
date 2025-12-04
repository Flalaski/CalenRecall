const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const releasePath = path.join(__dirname, '..', 'release');

function sleepSync(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Busy wait
  }
}

function killProcesses() {
  if (os.platform() === 'win32') {
    try {
      // Kill Electron processes
      execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
    } catch (e) {
      // Ignore errors if processes don't exist
    }
    // Use JavaScript sleep instead of timeout command
    sleepSync(1000);
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
    sleepSync(1000);
  } catch (e) {
    // Rename failed, continue with direct deletion
  }

  // Strategy 3: Try multiple deletion methods with retries
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.unlinkSync(appAsarPath);
      console.log('Successfully removed app.asar.');
      return true;
    } catch (e) {
      if (attempt < maxRetries) {
        try {
          execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
          execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
        } catch (killErr) {
          // Ignore
        }
        sleepSync(500 * attempt);
      } else {
        try {
          execSync(`del /f /q "${appAsarPath}"`, { stdio: 'ignore', timeout: 5000 });
          return true;
        } catch (delErr) {
          return false;
        }
      }
    }
  }
  
  return false;
}

function removeDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  // On Windows, specifically target app.asar first if it exists
  if (os.platform() === 'win32') {
    const appAsarPath = path.join(dirPath, 'resources', 'app.asar');
    if (fs.existsSync(appAsarPath)) {
      console.log('Removing app.asar file first to prevent file locks...');
      unlockAndRemoveAppAsar(appAsarPath);
      sleepSync(2000); // Wait after removing app.asar
    }
  }

  // On Windows, if we get EBUSY errors, try Windows command first (it's more reliable)
  if (os.platform() === 'win32') {
    // Try Windows rmdir command first - it handles locks better
    try {
      console.log('Attempting Windows command-line removal...');
      execSync(`rmdir /s /q "${dirPath}"`, { stdio: 'ignore', timeout: 10000 });
      console.log('Windows command-line removal succeeded.');
      return; // Success
    } catch (e) {
      // Windows command failed, continue with Node.js method
      console.log('Windows command-line removal failed, trying Node.js method...');
    }
  }

  // Try to remove directory with retries using Node.js API
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait before retry (except first attempt)
      if (attempt > 1) {
        // Kill processes that might be locking files
        try {
          if (os.platform() === 'win32') {
            // Kill Electron processes
            execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
          }
        } catch (e) {
          // Ignore errors
        }
        // Use JavaScript sleep - shorter wait
        sleepSync(1000);
      }
      
      // Try removal with modern API (Node 14.14.0+)
      try {
        fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        return; // Success
      } catch (e) {
        // If maxRetries option not available, try without it
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
          return; // Success
        } catch (e2) {
          // Fallback for older Node versions
          if (fs.rmdirSync) {
            fs.rmdirSync(dirPath, { recursive: true });
            return; // Success
          }
          throw e2;
        }
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(`Removal attempt ${attempt} failed: ${error.code || error.message}, retrying...`);
      }
    }
  }
  
  // All retries failed - try Windows command one more time as last resort
  if (os.platform() === 'win32' && lastError) {
    console.log('Attempting Windows command-line removal as last resort...');
    try {
      // Kill processes first
      try {
        execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
        sleepSync(2000);
      } catch (e) {
        // Ignore
      }
      // Use rmdir with /s /q which is more aggressive on Windows
      execSync(`rmdir /s /q "${dirPath}"`, { stdio: 'ignore', timeout: 10000 });
      console.log('Windows command-line removal succeeded.');
      return; // Success
    } catch (e) {
      console.error('Windows command-line removal also failed.');
    }
  }
  
  // All retries failed
  console.error(`Failed to remove ${dirPath} after ${maxRetries} attempts:`, lastError.message);
  console.error('The file may be locked by another process. Please:');
  console.error('1. Close any Explorer windows viewing the release folder');
  console.error('2. Close any running instances of the application');
  console.error('3. Try running the build again');
  throw lastError;
}

// Main execution
(function main() {
  try {
    // Kill processes first (but don't kill ourselves!)
    killProcesses();
    
    // Remove release directory
    if (fs.existsSync(releasePath)) {
      console.log('Cleaning release directory...');
      
      // On Windows, clean specific electron-builder subdirectories first (they're often locked)
      if (os.platform() === 'win32') {
        const subdirs = ['win-unpacked', 'win-ia32-unpacked', 'win-x64-unpacked'];
        for (const subdir of subdirs) {
          const subdirPath = path.join(releasePath, subdir);
          if (fs.existsSync(subdirPath)) {
            console.log(`Cleaning ${subdir} directory...`);
            try {
              // Kill processes that might be locking files
              execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
              execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
              sleepSync(1000);
              
              // CRITICAL: Remove app.asar first - this is the file causing locks
              const appAsarPath = path.join(subdirPath, 'resources', 'app.asar');
              if (fs.existsSync(appAsarPath)) {
                console.log(`  Removing app.asar from ${subdir}...`);
                unlockAndRemoveAppAsar(appAsarPath);
                sleepSync(2000); // Wait after removing app.asar
              }
              
              // Try taking ownership first to unlock files
              try {
                execSync(`takeown /f "${subdirPath}" /r /d y >nul 2>&1`, { timeout: 10000 });
                execSync(`icacls "${subdirPath}" /grant Administrators:F /t /q >nul 2>&1`, { timeout: 10000 });
                sleepSync(1000);
              } catch (e) {
                // Continue even if takeown fails
              }
              
              execSync(`rmdir /s /q "${subdirPath}"`, { stdio: 'ignore', timeout: 10000 });
            } catch (e) {
              // Continue - will try again with full cleanup
            }
          }
        }
        // Wait longer after cleaning subdirectories to ensure handles are released
        sleepSync(3000);
      }
      
      removeDirectory(releasePath);
      console.log('Release directory cleaned successfully.');
      
      // Wait a moment to ensure Windows releases all file handles
      // This is critical - Windows needs time to release file locks
      if (os.platform() === 'win32') {
        console.log('Waiting for Windows to release file handles...');
        // Kill processes one more time before waiting
        try {
          execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
          execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
          // Also try to kill any processes that might have the release folder open
          try {
            const psCmd = `powershell -Command "Get-Process | Where-Object {$_.Path -like '*electron*' -or $_.Path -like '*node*'} | Stop-Process -Force -ErrorAction SilentlyContinue"`;
            execSync(psCmd, { stdio: 'ignore', timeout: 5000 });
          } catch (psErr) {
            // Ignore PowerShell errors
          }
        } catch (e) {
          // Ignore errors
        }
        sleepSync(8000); // Increased wait time to ensure handles are fully released
      }
    } else {
      console.log('Release directory does not exist, nothing to clean.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();

