/**
 * Performance-optimized logger utility
 * Removes console statements in production builds
 */
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

/**
 * Format a timing entry with color-coded console styling.
 * Uses %c for styling, falls back to plain text when console.group is unavailable.
 */
function formatTiming(label: string, elapsed: number, budget: number, overBudget: boolean): void {
  if (!isDevelopment) return;
  const icon = overBudget ? '⚠️' : '⏱️';
  const pct = budget === Infinity ? '' : ` (${(elapsed / budget * 100).toFixed(0)}% of ${budget}ms)`;
  try {
    console.log(
      `%c${icon} [Perf] %c${label}%c ${elapsed.toFixed(2)}ms${pct}`,
      `color:${overBudget ? '#f90' : '#6cf'}`,
      'font-weight:bold',
      'color:#888'
    );
  } catch {
    console.log(`${icon} [Perf] ${label}: ${elapsed.toFixed(2)}ms${pct}`);
  }
}

function formatPerfError(source: string, message: string, ctx: string): void {
  if (!isDevelopment) return;
  try {
    console.log(
      `%c❌ [${source}]%c ${message}%c | ${ctx}`,
      'color:#f44;font-weight:bold',
      'color:#fff;font-weight:bold',
      'color:#888'
    );
  } catch {
    console.log(`❌ [${source}] ${message} | ${ctx}`);
  }
}

function formatCheckpoint(label: string, data: string): void {
  if (!isDevelopment) return;
  try {
    console.log(
      `%c◆ [CP] %c${label}%c ${data}`,
      'color:#c9f',
      'font-weight:bold',
      'color:#888'
    );
  } catch {
    console.log(`◆ [CP] ${label} ${data}`);
  }
}

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

  // ── PerfTrail integration ──
  perf: formatTiming,
  perfError: formatPerfError,
  perfCheckpoint: formatCheckpoint,
};

// Export default for convenience
export default logger;
