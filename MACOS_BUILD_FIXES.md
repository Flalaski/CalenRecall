# macOS Build Stability Fixes

## Summary
Comprehensive fixes applied to ensure CalenRecall builds and runs stably on macOS.

## Changes Made

### 1. Enhanced Error Handling
- **Added try-catch blocks** around critical initialization:
  - Startup loading window creation
  - Database initialization with detailed error messages
  - IPC handler setup
  - Custom themes folder initialization

### 2. Improved Preload Path Resolution
- **Enhanced `getOptimizedWebPreferences()`** to:
  - Automatically resolve preload.js paths correctly for both dev and production
  - Check multiple alternative paths if primary path fails
  - Verify file exists before setting preload path
  - Provide detailed logging for debugging path issues

### 3. Database Initialization Robustness
- **Added comprehensive logging** for database initialization:
  - Platform detection
  - Node/Electron version logging
  - User data path logging
  - File existence verification
  - Better error messages for native module failures

- **Enhanced error handling** for better-sqlite3:
  - Check if module loads correctly
  - Provide helpful error messages for common issues (permissions, native module build)
  - Graceful handling of database file creation/access

### 4. Crash Reporting Improvements
- **Enhanced uncaught exception handler**:
  - Detailed error logging with stack traces
  - User-friendly error dialogs before app exit
  - Proper cleanup on crashes

- **Enhanced unhandled rejection handler**:
  - Detailed logging (doesn't exit app, allows recovery)

### 5. macOS Entitlements Updates
Added missing entitlements to `build/entitlements.mac.plist`:
- `com.apple.security.files.user-selected.read-write` - For file picker access
- `com.apple.security.files.downloads.read-write` - For downloads folder access
- `com.apple.security.network.client` - For network requests (if needed)

### 6. Path Resolution Fixes
- All file paths now use `path.join()` for cross-platform compatibility
- Preload script path resolution handles packaged app bundle structure
- Database paths properly use `app.getPath('userData')` which is cross-platform

## Testing Recommendations

### 1. Build and Test
```bash
npm run build
npm run dist:mac
```

### 2. Check Console Logs
If the app crashes, check the console output for:
- `[Main]` prefixed logs - Main process initialization
- `[Database Init]` prefixed logs - Database operations
- Error messages with `❌` indicators

### 3. Common Issues and Solutions

#### Issue: "Native module not found" or "Cannot find module better-sqlite3"
**Solution:**
```bash
npm run rebuild
# Or specifically:
npm run postinstall
```

#### Issue: Permission denied errors
**Solution:**
- Check file permissions on `~/Library/Application Support/CalenRecall/`
- Ensure the app has necessary entitlements (see entitlements.mac.plist)

#### Issue: Preload script not found
**Solution:**
- Verify `dist-electron/preload.js` exists after build
- Check console logs for alternative paths attempted

#### Issue: Database initialization fails
**Solution:**
- Check user data directory permissions
- Verify database file isn't locked by another process
- Check console for detailed error messages

### 4. Debug Mode
To get more detailed logs, run:
```bash
ELECTRON_ENABLE_LOGGING=1 npm run dev
```

Or for a built app:
```bash
/Applications/CalenRecall.app/Contents/MacOS/CalenRecall --enable-logging
```

## Files Modified
- `electron/main.ts` - Enhanced error handling, preload path resolution
- `electron/database.ts` - Improved initialization logging and error handling
- `build/entitlements.mac.plist` - Added file system and network entitlements

## Next Steps
1. Rebuild the application: `npm run build && npm run dist:mac`
2. Test the built application
3. If crashes occur, check console logs for specific error messages
4. Report any new issues with the console logs attached
