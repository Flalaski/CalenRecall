#!/bin/bash
#===============================================================================
# CalenRecall macOS .pkg Installer Builder
#
# Creates a flat .pkg installer from the electron-builder .app output.
# Analogous to installer.iss for Windows — meant for distribution outside
# the Mac App Store.
#
# Prerequisites:
#   - macOS 12+ build machine
#   - Xcode Command Line Tools installed (xcode-select --install)
#   - A release .app in release/ (run "npm run dist:mac:dmg" first)
#   - (Optional) Developer ID Application + Installer certificates for signing
#
# Usage:
#   ./build/mac-installer.sh              # Build .pkg from existing .app
#   ./build/mac-installer.sh --sign       # Also sign with Developer ID Installer
#   ./build/mac-installer.sh --notarize   # Sign + notarize (requires credentials)
#
# Output:
#   release/CalenRecall-${version}-${arch}.pkg
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# --- Parse arguments ---
FLAG_SIGN=false
FLAG_NOTARIZE=false
for arg in "$@"; do
  case "$arg" in
    --sign) FLAG_SIGN=true ;;
    --notarize) FLAG_NOTARIZE=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

echo "========================================"
echo "CalenRecall - macOS .pkg Installer Builder"
echo "========================================"
echo ""

# --- Locate the .app bundle ---
APP_BUNDLE=$(find release -maxdepth 3 -name "*.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_BUNDLE" ]; then
  echo "❌ No .app bundle found in release/."
  echo "   Run 'npm run dist:mac:dmg' first to build the app."
  exit 1
fi
echo "📦 App bundle: $APP_BUNDLE"

# --- Extract version ---
VERSION=$(node -p "require('./package.json').version")
ARCH=$(echo "$APP_BUNDLE" | grep -oE 'arm64|x64' || echo "universal")
PKG_NAME="CalenRecall-${VERSION}-${ARCH}.pkg"
PKG_OUTPUT="release/$PKG_NAME"

echo "📌 Version: $VERSION"
echo "📌 Architecture: $ARCH"
echo "📌 Output: $PKG_OUTPUT"
echo ""

# --- If --sign or --notarize, sign the .app first ---
if [ "$FLAG_SIGN" = true ] || [ "$FLAG_NOTARIZE" = true ]; then
  DEV_ID_APP=${DEV_ID_APP:-"Developer ID Application: Your Name"}
  echo "🔏 Signing .app bundle with: $DEV_ID_APP"
  codesign --deep --force --options runtime \
    --sign "$DEV_ID_APP" \
    --entitlements "$SCRIPT_DIR/entitlements.mac.plist" \
    "$APP_BUNDLE"
  echo "   ✅ App signed"
  echo ""
fi

# --- Build the .pkg using pkgbuild + productbuild ---
echo "🔨 Building component package..."
COMPONENT_PKG=$(mktemp /tmp/calenrecall-component-XXXXXX.pkg)
pkgbuild \
  --root "$APP_BUNDLE" \
  --identifier "com.calenrecall.app" \
  --version "$VERSION" \
  --install-location "/Applications/CalenRecall.app" \
  "$COMPONENT_PKG"
echo "   ✅ Component package created"

echo ""
echo "🔨 Building distribution package..."
if [ -f "$SCRIPT_DIR/Distribution.xml" ]; then
  productbuild \
    --distribution "$SCRIPT_DIR/Distribution.xml" \
    --package-path "$(dirname "$COMPONENT_PKG")" \
    --resources "$SCRIPT_DIR" \
    "$PKG_OUTPUT"
else
  # Fallback: no Distribution.xml
  productbuild \
    --package "$COMPONENT_PKG" \
    "$PKG_OUTPUT"
fi
echo "   ✅ Distribution package created"

# Clean up temp component
rm -f "$COMPONENT_PKG"

# --- Sign the .pkg (Developer ID Installer) ---
if [ "$FLAG_SIGN" = true ] || [ "$FLAG_NOTARIZE" = true ]; then
  DEV_ID_INSTALLER=${DEV_ID_INSTALLER:-"Developer ID Installer: Your Name"}
  echo ""
  echo "🔏 Signing .pkg with: $DEV_ID_INSTALLER"
  productsign --sign "$DEV_ID_INSTALLER" "$PKG_OUTPUT" "${PKG_OUTPUT}.signed"
  mv "${PKG_OUTPUT}.signed" "$PKG_OUTPUT"
  echo "   ✅ .pkg signed"
fi

# --- Notarize (implies signing) ---
if [ "$FLAG_NOTARIZE" = true ]; then
  echo ""
  echo "📤 Submitting .pkg for notarization..."
  node scripts/notarize.js --appPath "$APP_BUNDLE"
  echo "   ✅ Notarization complete"
fi

echo ""
echo "========================================"
echo "✅ .pkg installer created!"
echo "   $PKG_OUTPUT"
echo "========================================"

# Open release folder
open release
