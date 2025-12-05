#!/usr/bin/env node

/**
 * Automatic date-based versioning system
 * 
 * Generates versions in format: YYYY.MM.DD.BUILD
 * - If same day as last build: increments build number
 * - If new day: resets build number to 1
 * 
 * Stores build info in .build-info.json to ensure consistent incrementing
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const buildInfoPath = path.join(__dirname, '..', '.build-info.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get current date
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const currentDate = `${year}.${month}.${day}`;

// Read or create build info
let buildInfo = {
  lastBuildDate: null,
  lastBuildNumber: 0,
  lastVersion: null
};

if (fs.existsSync(buildInfoPath)) {
  try {
    buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  } catch (e) {
    // If file is corrupted, start fresh
    console.warn('Warning: Could not read .build-info.json, starting fresh');
  }
}

// Determine new version
let newVersion;
let buildNumber;

if (buildInfo.lastBuildDate === currentDate) {
  // Same day - increment build number
  buildNumber = buildInfo.lastBuildNumber + 1;
  newVersion = `${currentDate}.${buildNumber}`;
} else {
  // New day - reset to build 1
  buildNumber = 1;
  newVersion = `${currentDate}.${buildNumber}`;
}

// Update package.json
const oldVersion = packageJson.version;
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Update build info
buildInfo.lastBuildDate = currentDate;
buildInfo.lastBuildNumber = buildNumber;
buildInfo.lastVersion = newVersion;
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2) + '\n');

// Output
console.log(`Version updated: ${oldVersion} -> ${newVersion}`);
console.log(`Build date: ${currentDate}, Build number: ${buildNumber}`);

