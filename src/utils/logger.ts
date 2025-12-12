/**
 * Performance-optimized logger utility
 * Removes console statements in production builds
 */
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

export const logger = {
  log: isDevelopment ? console.log.bind(console) : () => {},
  warn: isDevelopment ? console.warn.bind(console) : () => {},
  error: console.error.bind(console), // Always log errors
  debug: isDevelopment ? console.debug.bind(console) : () => {},
  info: isDevelopment ? console.info.bind(console) : () => {},
  
  // Group methods for better organization
  group: isDevelopment ? console.group.bind(console) : () => {},
  groupEnd: isDevelopment ? console.groupEnd.bind(console) : () => {},
  groupCollapsed: isDevelopment ? console.groupCollapsed.bind(console) : () => {},
  
  // Performance timing
  time: isDevelopment ? console.time.bind(console) : () => {},
  timeEnd: isDevelopment ? console.timeEnd.bind(console) : () => {},
  
  // Table for structured data
  table: isDevelopment ? console.table.bind(console) : () => {},
};

// Export default for convenience
export default logger;
