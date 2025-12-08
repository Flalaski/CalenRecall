# Logger Migration Guide

This guide explains how to migrate from `console.*` statements to the new centralized logger utilities.

## Overview

Two logger utilities have been created:
- **`electron/utils/logger.ts`** - For Electron main process
- **`src/utils/logger.ts`** - For React renderer process

## Benefits

1. **Environment-aware logging** - Debug logs only in development
2. **Consistent formatting** - Timestamps and context in all logs
3. **Performance** - No logging overhead in production
4. **Centralized control** - Easy to disable/enable logging

## Migration Steps

### Step 1: Import the Logger

**Electron (main process):**
```typescript
import { logger } from './utils/logger';
```

**React (renderer process):**
```typescript
import { logger } from './utils/logger';
```

### Step 2: Replace Console Statements

#### Before:
```typescript
console.log('Application started');
console.error('Error occurred', error);
console.warn('Warning message');
console.debug('Debug info', data);
```

#### After:
```typescript
logger.log('Application started', undefined, 'App');
logger.error('Error occurred', error, 'App');
logger.warn('Warning message', undefined, 'App');
logger.debug('Debug info', data, 'App');
```

### Step 3: Add Context (Optional but Recommended)

Context helps identify where logs come from:

```typescript
// Good - with context
logger.log('Entry saved', { entryId: 123 }, 'Database');
logger.error('Failed to save', error, 'IPC');

// Also good - without context
logger.log('Application started');
logger.error('Critical error', error);
```

## API Reference

### Methods

#### `logger.log(message, data?, context?)`
Logs an info message. Shown in development and production.

```typescript
logger.log('User logged in', { userId: 123 }, 'Auth');
```

#### `logger.error(message, error?, context?)`
Logs an error. Always shown, even in production.

```typescript
logger.error('Database connection failed', error, 'Database');
```

#### `logger.warn(message, data?, context?)`
Logs a warning. Shown in development and production.

```typescript
logger.warn('Deprecated API used', { api: 'oldMethod' }, 'API');
```

#### `logger.debug(message, data?, context?)`
Logs debug information. Only shown in development or when `DEBUG=true`.

```typescript
logger.debug('State updated', { state }, 'Component');
```

### Log Levels

Logs are filtered by level:
- `ERROR` (0) - Always shown
- `WARN` (1) - Shown in production
- `INFO` (2) - Shown in production
- `DEBUG` (3) - Only in development

## Examples

### Database Operations

**Before:**
```typescript
console.log('[Database] Saving entry:', entry);
try {
  saveEntry(entry);
  console.log('[Database] Entry saved successfully');
} catch (error) {
  console.error('[Database] Error saving entry:', error);
}
```

**After:**
```typescript
logger.debug('Saving entry', entry, 'Database');
try {
  saveEntry(entry);
  logger.log('Entry saved successfully', { entryId: entry.id }, 'Database');
} catch (error) {
  logger.error('Error saving entry', error, 'Database');
}
```

### IPC Handlers

**Before:**
```typescript
ipcMain.handle('save-entry', async (event, entry) => {
  console.log('[IPC] save-entry called');
  try {
    const result = saveEntry(entry);
    return { success: true, entry: result };
  } catch (error) {
    console.error('[IPC] Error:', error);
    return { success: false, error: error.message };
  }
});
```

**After:**
```typescript
import { logger } from './utils/logger';

ipcMain.handle('save-entry', async (event, entry) => {
  logger.debug('save-entry called', { entryId: entry.id }, 'IPC');
  try {
    const result = saveEntry(entry);
    logger.log('Entry saved via IPC', { entryId: result.id }, 'IPC');
    return { success: true, entry: result };
  } catch (error) {
    logger.error('Error in save-entry handler', error, 'IPC');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});
```

### React Components

**Before:**
```typescript
useEffect(() => {
  console.log('Component mounted');
  return () => {
    console.log('Component unmounted');
  };
}, []);
```

**After:**
```typescript
import { logger } from '../utils/logger';

useEffect(() => {
  logger.debug('Component mounted', undefined, 'MyComponent');
  return () => {
    logger.debug('Component unmounted', undefined, 'MyComponent');
  };
}, []);
```

## Configuration

### Environment Variables

**Electron:**
- `NODE_ENV=development` - Enables debug logging
- `DEBUG=true` - Forces debug logging even in production

**React (Vite):**
- `VITE_DEBUG=true` - Enables debug logging

### Programmatic Configuration

```typescript
import { configureLogger, LogLevel } from './utils/logger';

// Set minimum log level
configureLogger({ level: LogLevel.WARN });

// Disable console logging (useful for tests)
configureLogger({ enableConsole: false });
```

## Migration Checklist

- [ ] Import logger in files that use console.*
- [ ] Replace `console.log()` with `logger.log()`
- [ ] Replace `console.error()` with `logger.error()`
- [ ] Replace `console.warn()` with `logger.warn()`
- [ ] Replace `console.debug()` with `logger.debug()`
- [ ] Add context parameter where helpful
- [ ] Test that logs work correctly in development
- [ ] Verify logs are suppressed in production builds

## Priority Files for Migration

Based on the audit, these files have the most console statements:

1. `electron/ipc-handlers.ts` - 84 console statements
2. `electron/database.ts` - 92 console statements
3. `electron/main.ts` - 26 console statements
4. `src/components/LoadingScreen.tsx` - Multiple console statements
5. `src/utils/audioUtils.ts` - Many console.debug statements

## Notes

- **Error logs** are always shown (even in production) - this is intentional for debugging production issues
- **Debug logs** are automatically suppressed in production builds
- **Context** is optional but highly recommended for easier debugging
- **Data parameter** is optional - use it for structured logging

## Testing

After migration, verify:
1. Logs appear correctly in development
2. Debug logs are suppressed in production
3. Error logs still appear in production
4. No performance impact from logging

---

**Next Steps:** Start migrating high-priority files, beginning with `electron/ipc-handlers.ts` and `electron/database.ts`.

