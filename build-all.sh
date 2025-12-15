#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the script's directory (project root)
cd "$SCRIPT_DIR" || exit 1

echo "========================================"
echo "CalenRecall - Building All macOS Releases"
echo "========================================"
echo "Working directory: $(pwd)"
echo ""

# Kill any running Electron or Node processes to prevent file locks
echo "Closing any running Electron/Node processes..."
pkill -f electron > /dev/null 2>&1
pkill -f node > /dev/null 2>&1
sleep 3

# Clean release folder and locked files
echo "Cleaning previous build files..."
npm run clean:release
if [ -d "node_modules/better-sqlite3/build" ]; then
    rm -rf "node_modules/better-sqlite3/build" > /dev/null 2>&1
fi
sleep 2
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo ""
fi

echo "Setting consistent release version..."
npm run version:auto

echo "Building application (includes rebuilding native dependencies for Electron)..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed"
    exit 1
fi
echo ""

echo "Creating macOS distribution (both DMG and ZIP)..."
# Kill any processes that might have started during build
pkill -f electron > /dev/null 2>&1
pkill -f node > /dev/null 2>&1
sleep 5
npm run dist:mac:current
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Distribution build failed"
    echo "Check the output above for details."
    exit 1
fi
echo ""

echo "========================================"
echo "Build completed successfully!"
echo "========================================"
echo ""
echo "Release files are in the 'release' folder."
echo ""

# Open the release folder
if [ -d "release" ]; then
    open release
fi
