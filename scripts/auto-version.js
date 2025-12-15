#!/usr/bin/env node

/**
 * Automatic date-based versioning system
 * 
 * Generates versions in format: YYYY.MM.DD-BUILD (semver pre-release)
 * - If same day as last build: increments build number
 * - If new day: resets build number to 1
 * 
 * Stores build info in .build-info.json to ensure consistent incrementing
 */

const fs = require('fs');
const path = require('path');
let semver;
try {
  semver = require('semver');
} catch (e) {
  // Fallback minimal validator if semver isn't installed
  semver = {
    valid: (v) => /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(v)
  };
}

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const buildInfoPath = path.join(__dirname, '..', '.build-info.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// If FREEZE_VERSION is set, keep current version and exit
if (process.env.FREEZE_VERSION === '1' || String(process.env.FREEZE_VERSION).toLowerCase() === 'true') {
  console.log(`Version frozen. Keeping existing version: ${packageJson.version}`);
  process.exit(0);
}

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

// If an explicit version is provided, use it
const argIndex = process.argv.indexOf('--set');
const cliSetVersion = argIndex !== -1 ? process.argv[argIndex + 1] : null;
const explicitVersion = process.env.RELEASE_VERSION || cliSetVersion || null;

if (explicitVersion) {
  if (!semver.valid(explicitVersion)) {
    console.error(`Error: RELEASE_VERSION is not valid semver: "${explicitVersion}"`);
    process.exit(1);
  }
  const oldVersion = packageJson.version;
  packageJson.version = explicitVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  // Do not update build-info when explicitly setting version
  console.log(`Version set explicitly: ${oldVersion} -> ${explicitVersion}`);
  process.exit(0);
}

if (buildInfo.lastBuildDate === currentDate) {
  // Same day - increment build number
  buildNumber = buildInfo.lastBuildNumber + 1;
  // Use semver pre-release dash to make it valid for electron-updater
  newVersion = `${currentDate}-${buildNumber}`;
} else {
  // New day - reset to build 1
  buildNumber = 1;
  newVersion = `${currentDate}-${buildNumber}`;
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

