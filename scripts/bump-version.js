#!/usr/bin/env node

/**
 * Version bump helper script
 * 
 * Usage:
 *   node scripts/bump-version.js patch   - Bump patch version (1.0.0 -> 1.0.1)
 *   node scripts/bump-version.js minor   - Bump minor version (1.0.0 -> 1.1.0)
 *   node scripts/bump-version.js major   - Bump major version (1.0.0 -> 2.0.0)
 *   node scripts/bump-version.js         - Show current version
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const versionType = process.argv[2];

if (!versionType) {
  console.log(`Current version: ${packageJson.version}`);
  process.exit(0);
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
    default:
      throw new Error(`Invalid version type: ${type}. Use 'major', 'minor', or 'patch'`);
  }
  
  return parts.join('.');
}

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error(`Error: Invalid version type "${versionType}". Use 'major', 'minor', or 'patch'`);
  process.exit(1);
}

const oldVersion = packageJson.version;
const newVersion = bumpVersion(oldVersion, versionType);

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version bumped: ${oldVersion} -> ${newVersion}`);
console.log(`\nNext steps:`);
console.log(`  1. Update CHANGELOG.md with the changes for version ${newVersion}`);
console.log(`  2. Commit the changes: git add package.json CHANGELOG.md && git commit -m "Bump version to ${newVersion}"`);
console.log(`  3. Create a git tag: git tag -a v${newVersion} -m "Version ${newVersion}"`);
console.log(`  4. Build your release: npm run dist:win:pack`);

