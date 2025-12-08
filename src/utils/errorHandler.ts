/**
 * Centralized error handling utilities.
 * Provides user-friendly error messages and error reporting.
 */

/**
 * User-friendly error messages for common error types.
 */
export const ErrorMessages = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  DATABASE_ERROR: 'Database operation failed. Please try again.',
  FILE_NOT_FOUND: 'The requested file could not be found.',
  PERMISSION_DENIED: 'Permission denied. Please check file permissions.',
  INVALID_INPUT: 'Invalid input provided. Please check your data.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

/**
 * Error types for categorization.
 */
export type ErrorType = 
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_INPUT'
  | 'UNKNOWN_ERROR';

/**
 * User-friendly error information.
 */
export interface UserError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  details?: string;
}

/**
 * Converts an error to a user-friendly error message.
 * 
 * @param error - The error to convert
 * @param defaultType - Default error type if cannot be determined
 * @returns User-friendly error information
 * 
 * @example
 * ```typescript
 * try {
 *   await saveEntry(entry);
 * } catch (error) {
 *   const userError = toUserError(error, 'DATABASE_ERROR');
 *   showErrorNotification(userError.message);
 * }
 * ```
 */
export function toUserError(error: unknown, defaultType: ErrorType = 'UNKNOWN_ERROR'): UserError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Categorize error based on message content
    let type: ErrorType = defaultType;
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      type = 'NETWORK_ERROR';
    } else if (message.includes('database') || message.includes('sqlite') || message.includes('query')) {
      type = 'DATABASE_ERROR';
    } else if (message.includes('not found') || message.includes('enoent')) {
      type = 'FILE_NOT_FOUND';
    } else if (message.includes('permission') || message.includes('eacces') || message.includes('eperm')) {
      type = 'PERMISSION_DENIED';
    } else if (message.includes('invalid') || message.includes('validation')) {
      type = 'INVALID_INPUT';
    }
    
    return {
      type,
      message: ErrorMessages[type],
      originalError: error,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
  
  // Handle non-Error objects
  const errorString = String(error);
  return {
    type: defaultType,
    message: ErrorMessages[defaultType],
    details: process.env.NODE_ENV === 'development' ? errorString : undefined,
  };
}

/**
 * Logs an error with appropriate level based on environment.
 * 
 * @param error - The error to log
 * @param context - Additional context about where the error occurred
 */
export function logError(error: unknown, context?: string): void {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    if (context) {
      console.error(`[Error] ${context}:`, error);
    } else {
      console.error('[Error]:', error);
    }
  } else {
    // In production, you might want to send to an error reporting service
    // Example: Sentry.captureException(error, { extra: { context } });
    if (error instanceof Error) {
      console.error(`[Error]${context ? ` ${context}` : ''}: ${error.message}`);
    }
  }
}

/**
 * Handles an error and returns user-friendly information.
 * Combines error conversion and logging.
 * 
 * @param error - The error to handle
 * @param context - Additional context about where the error occurred
 * @returns User-friendly error information
 */
export function handleError(error: unknown, context?: string): UserError {
  const userError = toUserError(error);
  logError(error, context);
  return userError;
}

