# Testing Setup Guide

This guide explains the testing infrastructure that has been set up for CalenRecall.

## Overview

The project now includes:
- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **ts-jest** - TypeScript support for Jest
- **jest-environment-jsdom** - DOM environment for React tests

## Installation

Dependencies have been added to `package.json`. Run:

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

Tests should be placed in one of these locations:
- `src/**/__tests__/**/*.test.{ts,tsx}` - React/renderer tests
- `electron/**/__tests__/**/*.test.ts` - Electron/main process tests
- `src/**/*.spec.{ts,tsx}` - Alternative naming convention
- `electron/**/*.spec.ts` - Alternative naming convention

## Example Tests

### Unit Test (Utility Function)

**File:** `src/utils/__tests__/errorHandler.test.ts`

```typescript
import { toUserError, ErrorMessages } from '../errorHandler';

describe('errorHandler', () => {
  it('should convert network errors', () => {
    const error = new Error('Network request failed');
    const userError = toUserError(error);
    
    expect(userError.type).toBe('NETWORK_ERROR');
    expect(userError.message).toBe(ErrorMessages.NETWORK_ERROR);
  });
});
```

### Component Test (React)

**File:** `src/components/__tests__/ErrorBoundary.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
```

### Electron Main Process Test

**File:** `electron/utils/__tests__/pathValidation.test.ts`

```typescript
import { validatePath } from '../pathValidation';

describe('pathValidation', () => {
  it('should validate paths within allowed directory', () => {
    const baseDir = '/allowed/path';
    const validPath = '/allowed/path/file.txt';
    
    expect(validatePath(validPath, baseDir)).toBe(true);
  });
});
```

## Test Configuration

### Jest Config (`jest.config.js`)

- **Preset:** `ts-jest` for TypeScript support
- **Environment:** `jsdom` for React component tests
- **Coverage:** Configured to collect from `src/` and `electron/`
- **Module Mapping:** `@/` alias mapped to `src/`

### Setup File (`src/setupTests.ts`)

- Imports `@testing-library/jest-dom` for DOM matchers
- Mocks Electron API for renderer tests
- Suppresses React warnings in test output

## Writing Tests

### Best Practices

1. **Descriptive test names:**
   ```typescript
   // Good
   it('should save entry to database when valid entry provided', () => {
   
   // Bad
   it('should work', () => {
   ```

2. **Arrange-Act-Assert pattern:**
   ```typescript
   it('should calculate date correctly', () => {
     // Arrange
     const date = new Date('2024-01-15');
     
     // Act
     const result = formatDate(date);
     
     // Assert
     expect(result).toBe('2024-01-15');
   });
   ```

3. **Test one thing per test:**
   ```typescript
   // Good - separate tests
   it('should validate email format', () => { ... });
   it('should reject empty email', () => { ... });
   
   // Bad - multiple assertions in one test
   it('should validate email', () => {
     expect(validateEmail('test@example.com')).toBe(true);
     expect(validateEmail('')).toBe(false);
   });
   ```

4. **Use meaningful assertions:**
   ```typescript
   // Good
   expect(userError.message).toBe(ErrorMessages.NETWORK_ERROR);
   
   // Less clear
   expect(userError.message).toBeTruthy();
   ```

## Mocking

### Mock Electron API

The setup file already mocks `window.electronAPI`. In tests:

```typescript
import { window } from 'global';

(window.electronAPI.getAllEntries as jest.Mock).mockResolvedValue([
  { id: 1, title: 'Test Entry' }
]);
```

### Mock Modules

```typescript
jest.mock('../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));
```

## Coverage Goals

Current coverage thresholds are set to 0% (no minimum required). As tests are added, increase thresholds:

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

## Priority Areas for Testing

Based on the audit, these areas should be tested first:

1. **Path Validation** ✅ (tests created)
   - `validatePath()`
   - `sanitizeFileName()`
   - `safePathJoin()`

2. **Error Handling** ✅ (tests created)
   - `toUserError()`
   - `handleError()`

3. **Error Boundary** ✅ (tests created)
   - Error catching
   - Fallback UI
   - Recovery

4. **Database Operations** (needs tests)
   - `saveEntry()`
   - `getEntry()`
   - `deleteEntry()`

5. **Calendar Conversions** (needs tests)
   - Date conversions
   - Epoch calculations
   - Leap year handling

6. **IPC Handlers** (needs tests)
   - Request/response handling
   - Error handling
   - Input validation

## Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- errorHandler

# Run tests in a specific file
npm test -- pathValidation.test.ts

# Run tests with verbose output
npm test -- --verbose
```

## Continuous Integration

To add tests to CI/CD:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test -- --coverage --ci
```

## Next Steps

1. ✅ Test infrastructure set up
2. ✅ Example tests created
3. ⏳ Add tests for database operations
4. ⏳ Add tests for calendar conversions
5. ⏳ Add tests for IPC handlers
6. ⏳ Increase coverage thresholds

---

**Status:** Test infrastructure ready. Example tests demonstrate the setup. Ready for test development.

