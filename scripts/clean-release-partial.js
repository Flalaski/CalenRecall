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

// Kill processes that might be locking files
if (os.platform() === 'win32') {
  try {
    execSync('taskkill /F /IM electron.exe >nul 2>&1', { stdio: 'ignore', timeout: 3000 });
  } catch (e) {
    // Ignore errors
  }
  sleepSync(2000);
}

// Clean only the win-unpacked directory (not the entire release folder)
// This allows us to keep the NSIS installer while cleaning up for the portable build
const winUnpackedPath = path.join(releasePath, 'win-unpacked');
if (fs.existsSync(winUnpackedPath)) {
  console.log('Cleaning win-unpacked directory between builds...');
  try {
    execSync(`rmdir /s /q "${winUnpackedPath}"`, { stdio: 'ignore', timeout: 10000 });
    console.log('win-unpacked directory cleaned successfully.');
  } catch (e) {
    console.error('Failed to clean win-unpacked directory:', e.message);
    process.exit(1);
  }
  // Wait for Windows to release file handles
  sleepSync(3000);
} else {
  console.log('win-unpacked directory does not exist, nothing to clean.');
}

process.exit(0);

