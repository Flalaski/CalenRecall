/**
 * Error Reporting System — CalenRecall
 *
 * Lightweight, privacy-respecting error capture for production.
 * Logs errors to a rotating local database table, surfaces them in-app
 * via a notification badge, and optionally exports them for debugging.
 *
 * In development, errors are logged verbosely to console.
 * In production, errors are anonymized and stored locally only.
 * No data is sent to external servers.
 */

import { handleError, toUserError, type UserError } from './errorHandler';

// ── Types ──

export interface CapturedError {
  id: string;
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
  message: string;
  /** Stack trace (anonymized in production) */
  stack?: string;
  /** Component name where the error occurred */
  component?: string;
  /** Operation being performed when error occurred */
  operation?: string;
  /** Whether user has dismissed this error */
  dismissed: boolean;
  /** User-friendly message */
  userMessage: string;
  /** Count of how many times this error has occurred (deduplication) */
  occurrenceCount: number;
  /** Last time this error occurred */
  lastOccurrence: string;
}

export interface ErrorReportOptions {
  severity?: 'error' | 'warning' | 'info';
  component?: string;
  operation?: string;
  /** Show a user-facing notification */
  notifyUser?: boolean;
}

// ── Constants ──

const MAX_STORED_ERRORS = 100;
const STORAGE_KEY = 'calenrecall-error-log';
const PRODUCTION = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

// ── Error Capture ──

let capturedErrors: CapturedError[] = [];
let listeners: Array<(errors: CapturedError[]) => void> = [];

// Load from localStorage on init
try {
  const stored = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY);
  if (stored) {
    capturedErrors = JSON.parse(stored);
  }
} catch {
  capturedErrors = [];
}

/**
 * Generate a stable error ID from a message and source.
 * Used for deduplication.
 */
function generateErrorId(message: string, source: string): string {
  // Simple stable hash
  let hash = 0;
  const str = `${source}:${message}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

/**
 * Anonymize a stack trace for privacy in production builds.
 * Removes file paths and line numbers, keeping only function names.
 */
function anonymizeStack(stack?: string): string | undefined {
  if (!stack || !PRODUCTION) return stack;

  return stack
    .split('\n')
    .map(line => {
      // Match "at functionName (file:line:col)" pattern
      const match = line.match(/^\s*at\s+(.+?)\s+\(/);
      if (match) {
        return `at ${match[1]}`;
      }
      // Match "at file:line:col" pattern
      if (line.includes('at ')) {
        return 'at <anonymous>';
      }
      return line;
    })
    .filter(line => !line.includes('node_modules') && !line.includes('<anonymous>'))
    .join('\n');
}

/**
 * Capture an error and store it in the local log.
 */
export function captureError(
  error: Error | unknown,
  source: string,
  options: ErrorReportOptions = {}
): CapturedError {
  const {
    severity = 'error',
    component,
    operation,
    notifyUser = PRODUCTION,
  } = options;

  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message || String(error);
  const errorId = generateErrorId(message, source);
  const now = new Date().toISOString();

  // Check for existing duplicate
  const existingIdx = capturedErrors.findIndex(e => e.id === errorId && !e.dismissed);
  let captured: CapturedError;

  if (existingIdx >= 0) {
    // Increment occurrence count
    captured = {
      ...capturedErrors[existingIdx],
      lastOccurrence: now,
      occurrenceCount: capturedErrors[existingIdx].occurrenceCount + 1,
      stack: anonymizeStack(err.stack) || capturedErrors[existingIdx].stack,
    };
    capturedErrors[existingIdx] = captured;
  } else {
    const userError: UserError = toUserError(err);

    captured = {
      id: errorId,
      timestamp: now,
      severity,
      source,
      message,
      stack: anonymizeStack(err.stack),
      component,
      operation,
      dismissed: false,
      userMessage: userError.message,
      occurrenceCount: 1,
      lastOccurrence: now,
    };

    capturedErrors.unshift(captured);

    // Trim to max size
    if (capturedErrors.length > MAX_STORED_ERRORS) {
      capturedErrors = capturedErrors.slice(0, MAX_STORED_ERRORS);
    }
  }

  // Persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capturedErrors));
  } catch {
    // Storage full — trim further
    capturedErrors = capturedErrors.slice(0, 50);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(capturedErrors));
    } catch {
      // Give up
    }
  }

  // Notify listeners
  notifyListeners();

  // Log to console
  handleError(error, source);

  // Show user notification if requested
  if (notifyUser && severity === 'error') {
    showErrorNotification(captured.userMessage);
  }

  return captured;
}

/**
 * Show a non-intrusive error notification to the user.
 */
function showErrorNotification(message: string): void {
  const existing = document.querySelector('.error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="error-toast-icon">⚠</div>
    <div class="error-toast-message">${message}</div>
    <button class="error-toast-close" aria-label="Dismiss error">×</button>
  `;
  document.body.appendChild(toast);

  // Auto-dismiss after 8 seconds
  const autoDismiss = setTimeout(() => {
    toast.classList.add('error-toast-dismissing');
    setTimeout(() => toast.remove(), 300);
  }, 8000);

  toast.querySelector('.error-toast-close')?.addEventListener('click', () => {
    clearTimeout(autoDismiss);
    toast.remove();
  });
}

// ── Queries ──

/**
 * Get all captured errors.
 */
export function getCapturedErrors(): CapturedError[] {
  return [...capturedErrors];
}

/**
 * Get count of active (non-dismissed) errors.
 */
export function getActiveErrorCount(): number {
  return capturedErrors.filter(e => !e.dismissed).length;
}

/**
 * Get errors filtered by severity.
 */
export function getErrorsBySeverity(severity: 'error' | 'warning' | 'info'): CapturedError[] {
  return capturedErrors.filter(e => e.severity === severity && !e.dismissed);
}

/**
 * Get errors for a specific component.
 */
export function getErrorsByComponent(component: string): CapturedError[] {
  return capturedErrors.filter(e => e.component === component && !e.dismissed);
}

// ── Actions ──

/**
 * Dismiss a specific error.
 */
export function dismissError(errorId: string): void {
  const error = capturedErrors.find(e => e.id === errorId);
  if (error) {
    error.dismissed = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(capturedErrors));
    } catch {}
    notifyListeners();
  }
}

/**
 * Dismiss all errors.
 */
export function dismissAllErrors(): void {
  capturedErrors.forEach(e => { e.dismissed = true; });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capturedErrors));
  } catch {}
  notifyListeners();
}

/**
 * Clear all errors permanently.
 */
export function clearAllErrors(): void {
  capturedErrors = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  notifyListeners();
}

/**
 * Export errors as JSON for debugging.
 */
export function exportErrors(): string {
  return JSON.stringify(capturedErrors, null, 2);
}

// ── Subscriptions ──

export function subscribeToErrors(listener: (errors: CapturedError[]) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyListeners(): void {
  const snapshot = [...capturedErrors];
  listeners.forEach(l => l(snapshot));
}

// ── Error Boundary Integration ──

/**
 * Create a React error boundary handler that captures errors.
 * Returns an object with componentDidCatch-equivalent methods.
 */
export function createErrorBoundaryHandler(componentName: string) {
  return {
    capture(error: Error, errorInfo: { componentStack?: string }) {
      captureError(error, componentName, {
        severity: 'error',
        component: componentName,
        notifyUser: true,
      });
    },
  };
}

// ── Singleton Error Handler ──

/**
 * Initialize global error handlers for uncaught exceptions and rejections.
 */
export function initGlobalErrorHandlers(): () => void {
  const handleGlobalError = (event: ErrorEvent) => {
    captureError(event.error || event.message, 'global', {
      severity: 'error',
      notifyUser: true,
    });
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    captureError(event.reason || 'Unhandled Promise rejection', 'promise', {
      severity: 'error',
      notifyUser: true,
    });
  };

  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleRejection);

  return () => {
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}

// ── Error Toast Styles (injected once) ──

export function injectErrorToastStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('error-toast-styles')) return;

  const style = document.createElement('style');
  style.id = 'error-toast-styles';
  style.textContent = `
    .error-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      max-width: 400px;
      background: #2d1b1b;
      border: 1px solid #ff4444;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      z-index: 10000;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      animation: error-toast-in 0.3s ease-out;
      font-size: 0.9em;
      color: #e0e0e0;
    }
    .error-toast-dismissing {
      animation: error-toast-out 0.3s ease-in forwards;
    }
    @keyframes error-toast-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes error-toast-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    .error-toast-icon {
      font-size: 1.2em;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .error-toast-message {
      flex: 1;
      line-height: 1.4;
    }
    .error-toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: #999;
      font-size: 1.2em;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .error-toast-close:hover {
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}
