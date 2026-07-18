/**
 * Centralized logging utility for Electron main process.
 * Provides environment-aware logging that can be disabled in production.
 * 
 * @example
 * ```typescript
 * import { logger } from './utils/logger';
 * 
 * logger.log('Application started');
 * logger.error('Failed to load database', error);
 * logger.debug('Debug information', { data });
 * ```
 */

import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEBUG_ENABLED = process.env.DEBUG === 'true' || isDev;

/**
 * Logging levels for filtering
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean;
  filePath?: string;
}

const defaultConfig: LoggerConfig = {
  level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 * 
 * @param newConfig - Logger configuration
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Format log message with timestamp and context
 */
function formatMessage(level: string, message: string, context?: string): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : '';
  return `${timestamp} [${level}]${contextStr} ${message}`;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return level <= config.level && config.enableConsole;
}

/**
 * Logger object with different log levels
 */
export const logger = {
  /**
   * Log an error message
   * Always logged, even in production
   * 
   * @param message - Error message
   * @param error - Optional error object
   * @param context - Optional context (e.g., module name)
   */
  error: (message: string, error?: unknown, context?: string): void => {
    if (shouldLog(LogLevel.ERROR)) {
      const formatted = formatMessage('ERROR', message, context);
      if (error instanceof Error) {
        console.error(formatted, error);
      } else if (error) {
        console.error(formatted, error);
      } else {
        console.error(formatted);
      }
    }
  },

  /**
   * Log a warning message
   * 
   * @param message - Warning message
   * @param data - Optional additional data
   * @param context - Optional context
   */
  warn: (message: string, data?: unknown, context?: string): void => {
    if (shouldLog(LogLevel.WARN)) {
      const formatted = formatMessage('WARN', message, context);
      if (data !== undefined) {
        console.warn(formatted, data);
      } else {
        console.warn(formatted);
      }
    }
  },

  /**
   * Log an info message
   * 
   * @param message - Info message
   * @param data - Optional additional data
   * @param context - Optional context
   */
  log: (message: string, data?: unknown, context?: string): void => {
    if (shouldLog(LogLevel.INFO)) {
      const formatted = formatMessage('INFO', message, context);
      if (data !== undefined) {
        console.log(formatted, data);
      } else {
        console.log(formatted);
      }
    }
  },

  /**
   * Log a debug message
   * Only logged in development or when DEBUG=true
   * 
   * @param message - Debug message
   * @param data - Optional additional data
   * @param context - Optional context
   */
  debug: (message: string, data?: unknown, context?: string): void => {
    if (DEBUG_ENABLED && shouldLog(LogLevel.DEBUG)) {
      const formatted = formatMessage('DEBUG', message, context);
      if (data !== undefined) {
        console.debug(formatted, data);
      } else {
        console.debug(formatted);
      }
    }
  },

  /**
   * Log with a specific level
   * 
   * @param level - Log level
   * @param message - Message to log
   * @param data - Optional additional data
   * @param context - Optional context
   */
  logLevel: (level: LogLevel, message: string, data?: unknown, context?: string): void => {
    switch (level) {
      case LogLevel.ERROR:
        logger.error(message, data as Error, context);
        break;
      case LogLevel.WARN:
        logger.warn(message, data, context);
        break;
      case LogLevel.INFO:
        logger.log(message, data, context);
        break;
      case LogLevel.DEBUG:
        logger.debug(message, data, context);
        break;
    }
  },

  /**
   * Log a performance timing event.
   * Forwards to all open renderer windows via IPC for live display.
   *
   * @param label - Span label
   * @param elapsed - Duration in ms
   * @param budget - Budget threshold in ms
   * @param overBudget - Whether the span exceeded its budget
   */
  perf: (label: string, elapsed: number, budget: number, overBudget: boolean): void => {
    if (!shouldLog(LogLevel.DEBUG)) return;
    const icon = overBudget ? '⚠️ OVER-BUDGET' : '[PERF]';
    const pct = budget === Infinity ? '' : ` (${(elapsed / budget * 100).toFixed(0)}%)`;
    const formatted = formatMessage(overBudget ? 'WARN' : 'INFO', `${icon} ${label}: ${elapsed.toFixed(2)}ms${pct}`, 'PerfTrail');
    console.log(formatted);

    // Forward to renderer windows for live display
    try {
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: any) => {
        if (!win.isDestroyed()) {
          win.webContents.send('perf-trail-update', {
            label,
            elapsed,
            budget,
            overBudget,
            timestamp: new Date().toISOString(),
          });
        }
      });
    } catch { /* ignore — may not be in Electron context */ }
  },
};

