#!/usr/bin/env node

/**
 * Fixes artifact names after electron-builder build
 * 
 * electron-builder incorrectly sanitizes 4-part version numbers (YYYY.MM.DD.BUILD)
 * This script renames artifacts to use the correct version from package.json
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const releaseDir = path.join(__dirname, '..', 'release');

// Read package.json to get the correct version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const correctVersion = packageJson.version;
const productName = packageJson.build.productName || packageJson.name;

console.log(`Fixing artifact names in ${releaseDir}`);
console.log(`Correct version: ${correctVersion}`);
console.log(`Product name: ${productName}`);
console.log('');

let renamedCount = 0;

// Read all files in release directory
if (!fs.existsSync(releaseDir)) {
  console.log(`Release directory does not exist: ${releaseDir}`);
  process.exit(0);
}

const files = fs.readdirSync(releaseDir, { withFileTypes: true });

// Find and rename files
files.forEach(dirent => {
  if (dirent.isFile()) {
    const file = path.join(releaseDir, dirent.name);
    const basename = dirent.name;
    
    // Handle blockmap files that might be missing architecture (e.g., CalenRecall-2025.12.11.6.blockmap)
    if (basename.endsWith('.blockmap') && !basename.includes('.exe.blockmap')) {
      // Blockmap file is missing .exe part, try to fix it
      const blockmapMatch = basename.match(/^(.+)-(\d{4}\.\d{2}\.\d{2}\.\d+)\.blockmap$/);
      if (blockmapMatch && blockmapMatch[2] === correctVersion) {
        // Try to find corresponding exe file to determine architecture
        const possibleExe = `${blockmapMatch[1]}-${correctVersion}-x64.exe`;
        if (fs.existsSync(path.join(releaseDir, possibleExe))) {
          const newBasename = `${blockmapMatch[1]}-${correctVersion}-x64.exe.blockmap`;
          const newPath = path.join(releaseDir, newBasename);
          try {
            if (!fs.existsSync(newPath)) {
              fs.renameSync(file, newPath);
              console.log(`Renamed: ${basename} -> ${newBasename}`);
              renamedCount++;
            }
          } catch (error) {
            console.error(`Error renaming ${basename}:`, error.message);
          }
        }
      }
      // Continue processing as normal file
    }
    
    // Skip if already correct
    if (basename.includes(`-${correctVersion}-`) && basename !== 'latest.yml') {
      return;
    }
    
    // Check if the filename starts with product name
    if (basename.startsWith(`${productName}-`)) {
      // Handle compound extensions like .exe.blockmap
      let ext = '';
      let baseWithoutExt = basename;
      if (basename.endsWith('.exe.blockmap')) {
        ext = 'exe.blockmap';
        baseWithoutExt = basename.slice(0, -'.exe.blockmap'.length);
      } else {
        const extMatch = basename.match(/\.([a-z]+)$/i);
        ext = extMatch ? extMatch[1] : '';
        baseWithoutExt = extMatch ? basename.slice(0, -extMatch[0].length) : basename;
      }
      
      // Extract architecture if present (x64, arm64, ia32)
      const archMatch = baseWithoutExt.match(/-((?:x64|arm64|ia32))$/i);
      const arch = archMatch ? archMatch[1] : '';
      const baseWithoutArch = archMatch ? baseWithoutExt.slice(0, -archMatch[0].length) : baseWithoutExt;
      
      // The remaining part should be productName-oldVersion
      if (baseWithoutArch.startsWith(`${productName}-`)) {
        const oldVersionPart = baseWithoutArch.slice(productName.length + 1);
        
        // Only rename if it doesn't match the correct version
        if (oldVersionPart !== correctVersion) {
          // Reconstruct filename with correct version
          let newBasename = `${productName}-${correctVersion}`;
          if (arch) {
            newBasename += `-${arch}`;
          }
          if (ext) {
            if (ext === 'exe.blockmap') {
              // For .exe.blockmap, add .exe before .blockmap
              newBasename += `.exe.blockmap`;
            } else {
              newBasename += `.${ext}`;
            }
          }
          
          const newPath = path.join(releaseDir, newBasename);
          
          try {
            if (fs.existsSync(file)) {
              // Don't overwrite if target already exists
              if (fs.existsSync(newPath) && file !== newPath) {
                console.log(`Skipped: ${basename} (target already exists: ${newBasename})`);
                return;
              }
              
              fs.renameSync(file, newPath);
              console.log(`Renamed: ${basename} -> ${newBasename}`);
              renamedCount++;
            }
          } catch (error) {
            console.error(`Error renaming ${basename}:`, error.message);
          }
        }
      }
    }
    
    // Special handling for latest.yml - update version in content
    if (basename === 'latest.yml') {
      try {
        let content = fs.readFileSync(file, 'utf8');
        const versionMatch = content.match(/^version:\s*(.+)$/m);
        
        if (versionMatch && versionMatch[1] !== correctVersion) {
          content = content.replace(/^version:\s*.+$/m, `version: ${correctVersion}`);
          
          // Also update any file references in the yml - replace version in productName-version-arch.ext pattern
          const escapedProductName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const fileRefPattern = new RegExp(`(${escapedProductName}-)[\\d\\.\\-]+(-x64|-arm64|-ia32)(\\.exe|\\.blockmap)`, 'g');
          content = content.replace(fileRefPattern, `$1${correctVersion}$2$3`);
          
          fs.writeFileSync(file, content, 'utf8');
          console.log(`Updated version in latest.yml: ${versionMatch[1]} -> ${correctVersion}`);
          renamedCount++;
        }
      } catch (error) {
        console.error(`Error updating latest.yml:`, error.message);
      }
    }
  }
});

if (renamedCount > 0) {
  console.log(`\nFixed ${renamedCount} file(s).`);
} else {
  console.log('No files needed renaming.');
}
