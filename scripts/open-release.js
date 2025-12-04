const { exec } = require('child_process');
const path = require('path');
const os = require('os');

const releasePath = path.join(__dirname, '..', 'release');

if (os.platform() === 'win32') {
  // Windows: use explorer
  exec(`explorer "${releasePath}"`, (error) => {
    if (error) {
      console.error('Failed to open release folder:', error);
    } else {
      console.log(`Opened release folder: ${releasePath}`);
    }
  });
} else if (os.platform() === 'darwin') {
  // macOS: use open
  exec(`open "${releasePath}"`, (error) => {
    if (error) {
      console.error('Failed to open release folder:', error);
    } else {
      console.log(`Opened release folder: ${releasePath}`);
    }
  });
} else {
  // Linux: use xdg-open
  exec(`xdg-open "${releasePath}"`, (error) => {
    if (error) {
      console.error('Failed to open release folder:', error);
    } else {
      console.log(`Opened release folder: ${releasePath}`);
    }
  });
}

