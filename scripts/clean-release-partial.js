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

// Function to find processes locking a file/folder (Windows only)
function findLockingProcesses(targetPath) {
  if (os.platform() !== 'win32') {
    return [];
  }
  
  try {
    // Use PowerShell to find processes with open handles to the path
    const psCmd = `powershell -Command "Get-Process | ForEach-Object { try { $_.Path } catch {} } | Where-Object { $_ -like '*${targetPath.replace(/\\/g, '\\\\')}*' }"`;
    const result = execSync(psCmd, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
    return result.split('\n').filter(line => line.trim().length > 0);
  } catch (e) {
    // If PowerShell fails, try using handle.exe (Sysinternals tool) if available
    try {
      const handleCmd = `handle "${targetPath}" 2>nul`;
      const result = execSync(handleCmd, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
      return result.split('\n').filter(line => line.includes('pid:'));
    } catch (e2) {
      return [];
    }
  }
}

// Function to close file explorer windows that might have the folder open
function closeExplorerWindows(targetPath) {
  if (os.platform() !== 'win32') {
    return;
  }
  
  try {
    // Use PowerShell to close Explorer windows showing the target path
    const psCmd = `powershell -Command "$shell = New-Object -ComObject Shell.Application; $shell.Windows() | Where-Object { $_.LocationURL -like '*${targetPath.replace(/\\/g, '/')}*' } | ForEach-Object { $_.Quit() }"`;
    execSync(psCmd, { stdio: 'ignore', timeout: 5000 });
  } catch (e) {
    // Ignore errors - Explorer might not have the folder open
  }
}

// Function to unlock and remove app.asar file
function unlockAndRemoveAppAsar(appAsarPath) {
  if (!fs.existsSync(appAsarPath)) {
    return true;
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
    appAsarPath = renamedPath;
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

// Main execution
(function main() {
  if (os.platform() !== 'win32') {
    console.log('This script is Windows-only.');
    process.exit(0);
  }

  try {
    // Kill processes that might be locking files
    console.log('Killing processes that might lock files...');
    try {
      execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
      execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
      // Also try to kill any processes using the release directory
      execSync('wmic process where "name like \'%%electron%%\' or name like \'%%node%%\'" delete >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
    } catch (e) {
      // Ignore errors if processes don't exist
    }
    sleepSync(2000);

    // Clean only the win-unpacked directory (not the entire release folder)
    // This allows us to keep the NSIS installer while cleaning up for the portable build
    const winUnpackedPath = path.join(releasePath, 'win-unpacked');
    
    if (!fs.existsSync(winUnpackedPath)) {
      console.log('win-unpacked directory does not exist, nothing to clean.');
      process.exit(0);
    }

    console.log('Cleaning win-unpacked directory between builds...');
    
    // Try to close Explorer windows that might have the folder open
    closeExplorerWindows(winUnpackedPath);
    sleepSync(1000);
    
    // Check for processes locking the folder
    const lockingProcesses = findLockingProcesses(winUnpackedPath);
    if (lockingProcesses.length > 0) {
      console.warn('Warning: Found processes that might be locking the folder:');
      lockingProcesses.forEach(proc => console.warn(`  - ${proc}`));
      console.warn('Attempting to continue anyway...');
    }
    
    // CRITICAL: Remove app.asar first - this is often the file causing locks
    const appAsarPath = path.join(winUnpackedPath, 'resources', 'app.asar');
    if (fs.existsSync(appAsarPath)) {
      console.log('Removing app.asar file first to prevent file locks...');
      unlockAndRemoveAppAsar(appAsarPath);
      sleepSync(2000);
    }
    
    // Try taking ownership first to unlock files
    try {
      console.log('Taking ownership of win-unpacked directory...');
      execSync(`takeown /f "${winUnpackedPath}" /r /d y >nul 2>&1`, { timeout: 10000 });
      execSync(`icacls "${winUnpackedPath}" /grant Administrators:F /t /q >nul 2>&1`, { timeout: 10000 });
      sleepSync(1000);
    } catch (e) {
      // Continue even if takeown fails
    }
    
    // Strategy 1: Try renaming first (Windows often releases locks on rename)
    const renamedPath = winUnpackedPath + '.deleteme.' + Date.now();
    let targetPath = winUnpackedPath;
    try {
      fs.renameSync(winUnpackedPath, renamedPath);
      targetPath = renamedPath;
      console.log('Renamed directory to release file locks...');
      sleepSync(1000);
    } catch (e) {
      // Rename failed, continue with direct deletion
    }
    
    // Strategy 2: Try Windows command-line removal
    try {
      execSync(`rmdir /s /q "${targetPath}"`, { stdio: 'ignore', timeout: 10000 });
      console.log('win-unpacked directory cleaned successfully using Windows rmdir.');
    } catch (e) {
      // If that fails, try Node.js removal with retries
      console.log('Windows rmdir failed, trying Node.js removal with retries...');
      const maxRetries = 5;
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            // Kill processes again before retry
            try {
              execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
              execSync('taskkill /F /IM node.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
            } catch (killErr) {
              // Ignore
            }
            sleepSync(1000 * attempt);
          }
          
          // Try removal with modern API
          try {
            fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
            console.log('win-unpacked directory cleaned successfully using Node.js fs.rmSync.');
            break;
          } catch (e2) {
            // If maxRetries option not available, try without it
            try {
              fs.rmSync(targetPath, { recursive: true, force: true });
              console.log('win-unpacked directory cleaned successfully using Node.js fs.rmSync (fallback).');
              break;
            } catch (e3) {
              lastError = e3;
              if (attempt < maxRetries) {
                console.log(`Removal attempt ${attempt} failed: ${e3.code || e3.message}, retrying...`);
              }
            }
          }
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            console.log(`Removal attempt ${attempt} failed: ${error.code || error.message}, retrying...`);
          }
        }
      }
      
      if (lastError && fs.existsSync(targetPath)) {
        console.error('Failed to clean win-unpacked directory after multiple attempts.');
        console.error('Error:', lastError.message);
        console.error('');
        console.error('The folder may be locked by:');
        console.error('1. A file explorer window viewing the release folder');
        console.error('2. An antivirus scanning the folder');
        console.error('3. Windows Search Indexer indexing the folder');
        console.error('4. A code editor (VS Code/Cursor) with the folder open');
        console.error('5. The application itself still running');
        console.error('');
        console.error('Please:');
        console.error('1. Close any Explorer windows viewing the release folder');
        console.error('2. Close any code editors that may have the folder open');
        console.error('3. Wait a few seconds and try running the build again');
        process.exit(1);
      }
    }
    
    // Wait for Windows to release file handles
    console.log('Waiting for Windows to release file handles...');
    sleepSync(3000);
    
    // Verify removal
    if (fs.existsSync(winUnpackedPath)) {
      console.warn('Warning: win-unpacked directory still exists after cleanup attempt.');
      console.warn('The build may continue, but you may encounter issues.');
    } else {
      console.log('win-unpacked directory cleaned successfully.');
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

