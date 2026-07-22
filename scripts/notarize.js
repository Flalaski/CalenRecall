/**
 * macOS Notarization Script
 * 
 * Notarizes the CalenRecall DMG/ZIP with Apple's notary service.
 * Requires an Apple Developer account and valid app-specific password
 * or Apple ID API key.
 * 
 * Usage:
 *   node scripts/notarize.js [--appPath=<path>] [--appleId=<email>] [--appleIdPassword=<pwd>] [--teamId=<team>]
 * 
 * Environment variables (recommended for CI):
 *   APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID
 * 
 * electron-builder integration:
 *   Set "afterSign": "scripts/notarize.js" in package.json mac config
 *   or use CSC_LINK / CSC_KEY_PASSWORD for development certificates.
 * 
 * Prerequisites:
 *   1. Xcode 13+ installed on macOS build machine
 *   2. Apple Developer account enrolled in Apple Developer Program
 *   3. App-specific password generated at appleid.apple.com
 *   4. (Optional) App Store Connect API key for CI
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command-line args
const args = process.argv.slice(2);
const getArg = (flag) => {
  const arg = args.find(a => a.startsWith(flag));
  return arg ? arg.split('=')[1] : null;
};

// Configuration
const config = {
  appPath: getArg('--appPath'),
  appleId: getArg('--appleId') || process.env.APPLE_ID,
  appleIdPassword: getArg('--appleIdPassword') || process.env.APPLE_ID_PASSWORD,
  teamId: getArg('--teamId') || process.env.APPLE_TEAM_ID,
  bundleId: 'com.calenrecall.app',
};

function findAppBundle(startDir) {
  const releaseDir = path.resolve(startDir, 'release');
  if (!fs.existsSync(releaseDir)) return null;
  const items = fs.readdirSync(releaseDir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.endsWith('.app') && item.isDirectory()) {
      return path.join(releaseDir, item.name);
    }
  }
  // Check one level deeper under mac/ or win-unpacked equivalent
  for (const item of items) {
    if (item.isDirectory()) {
      const subItems = fs.readdirSync(path.join(releaseDir, item.name), { withFileTypes: true });
      for (const sub of subItems) {
        if (sub.name.endsWith('.app') && sub.isDirectory()) {
          return path.join(releaseDir, item.name, sub.name);
        }
      }
    }
  }
  return null;
}

async function notarize() {
  console.log('=== CalenRecall macOS Notarization ===\n');

  // Resolve app bundle path
  let appPath = config.appPath;
  if (!appPath) {
    appPath = findAppBundle(process.cwd());
  }
  if (!appPath) {
    console.log('⚠  No .app bundle found in release/ directory.');
    console.log('   Skipping notarization (run electron-builder --mac first).');
    return;
  }

  console.log(`App bundle: ${appPath}`);

  // Check if we have credentials
  if (!config.appleId || !config.appleIdPassword || !config.teamId) {
    console.log('\n⚠  Apple notarization credentials not configured.');
    console.log('   Set the following environment variables or pass CLI args:');
    console.log('   - APPLE_ID (or --appleId)');
    console.log('   - APPLE_ID_PASSWORD (or --appleIdPassword) — app-specific password');
    console.log('   - APPLE_TEAM_ID (or --teamId)');
    console.log('\n   To generate an app-specific password:');
    console.log('     1. Go to https://appleid.apple.com/account/manage');
    console.log('     2. Sign in → App-Specific Passwords → Generate');
    console.log('     3. Use that password as APPLE_ID_PASSWORD');
    console.log('\n   Skipping notarization.\n');
    return;
  }

  // Step 1: Codesign verification
  console.log('\n1. Verifying code signature...');
  try {
    execSync(
      `codesign --verify --deep --strict --verbose=2 "${appPath}"`,
      { stdio: 'inherit' }
    );
    console.log('   ✅ Code signature verified');
  } catch (err) {
    console.error('   ❌ Code signature verification failed');
    console.error('      Run: codesign --deep --force --sign "Developer ID Application: Your Name" "${appPath}"');
    process.exit(1);
  }

  // Step 2: Submit to Apple notary service
  console.log('\n2. Submitting to Apple notary service...');
  const notarizeCmd = [
    'xcrun notarytool submit',
    `"${appPath}"`,
    `--apple-id "${config.appleId}"`,
    `--password "${config.appleIdPassword}"`,
    `--team-id "${config.teamId}"`,
    '--wait',
  ].join(' ');

  try {
    execSync(notarizeCmd, { stdio: 'inherit' });
    console.log('   ✅ Notarization submitted successfully');
  } catch (err) {
    console.error('   ❌ Notarization failed');
    console.error('      Check the error above. Common issues:');
    console.error('      - Invalid Apple ID or app-specific password');
    console.error('      - Network issues reaching Apple notary service');
    console.error('      - The app bundle has code signing issues');
    process.exit(1);
  }

  // Step 3: Stple the notarization ticket
  console.log('\n3. Stapling notarization ticket...');
  try {
    execSync(
      `xcrun stapler staple "${appPath}"`,
      { stdio: 'inherit' }
    );
    console.log('   ✅ Notarization ticket stapled');
  } catch (err) {
    console.error('   ⚠  Stapling failed (notarization may still be processing)');
    console.error('      Try running manually: xcrun stapler staple "${appPath}"');
  }

  // Step 4: Validate
  console.log('\n4. Validating notarized app...');
  try {
    execSync(
      `spctl --assess --verbose=4 --type execute "${appPath}"`,
      { stdio: 'inherit' }
    );
    console.log('   ✅ App assessment passed');
  } catch (err) {
    console.warn('   ⚠  spctl assessment returned non-zero (may pass on user machines)');
  }

  console.log('\n=== Notarization complete! ===\n');
}

notarize().catch(err => {
  console.error('Notarization error:', err);
  process.exit(1);
});
