/**
 * PerformanceTrail — CalenRecall Instrumentation Layer
 *
 * Zero-dependency span-timing, aggregation, throttled console output,
 * FPS monitoring, error enrichment, and auto-enable/disable.
 *
 * DESIGN PRINCIPLES:
 * - Zero-cost when disabled (single boolean gate short-circuits start())
 * - Aggregation always runs (even when console output is suppressed)
 * - Budgets warn, never throw
 * - Per-label throttle prevents console flood
 * - Over-budget spans always surface (dedicated 1s throttle)
 * - All activation logic is fail-safe (try/catch wrapped)
 * - Dual-publish: frontend logger + Electron logger
 *
 * Usage:
 *   import PerfTrail from '../utils/performance/perfTrail';
 *   PerfTrail.start('my-operation');
 *   // ... work ...
 *   PerfTrail.end('my-operation');
 */

import { displayRefreshRate } from './displayRefreshRate';

// ── Type Definitions ──

interface SpanEntry {
  start: number;       // performance.now() timestamp
  threshold: number;   // budget in ms (Infinity if unset)
}

export interface HistoryEntry {
  label: string;
  elapsed: number;
  timestamp: number;   // Date.now() for throttle
  overBudget: boolean;
}

export interface Aggregate {
  count: number;
  total: number;
  min: number;
  max: number;
  last: number;
}

export interface AggregateRow {
  label: string;
  count: number;
  lastMs: string;
  avgMs: string;
  minMs: string;
  maxMs: string;
  totalMs: string;
}

export interface PerfSnapshot {
  enabled: boolean;
  aggregates: Record<string, Aggregate>;
  history: HistoryEntry[];
  activeSpans: string[];
  budgets: Record<string, number>;
  fps: number;
  displayRefreshRate: number;
  timestamp: string;
}

// ── Default Budgets (CalenRecall-Specific) ──

const DEFAULT_BUDGETS: Record<string, number> = {
  'app-init': 5000,
  'load-entries': 3000,
  'search-entries': 1000,
  'export-entries': 10000,
  'import-entries': 10000,
  'calendar-render': 500,
  'minimap-render': 300,
  'entry-save': 500,
  'entry-delete': 300,
  'calendar-convert': 100,
  'astronomy-calc': 200,
  'theme-apply': 200,
  'background-art': 1000,
  'animation-frame': 33,
  'ipc-invoke': 100,
  'db-query': 50,
  'db-write': 100,
  'export-format-md': 3000,
  'export-format-pdf': 5000,
  'export-format-json': 2000,
  'archive-create': 8000,
  'profile-switch': 2000,
  'password-verify': 200,
  'nav-today': 50,
  'nav-arrow': 50,
  'nav-date-input': 100,
  'entry-load': 200,
  'entry-autosave': 300,
  'prefs-save': 500,
  'bg-color-extract': 2000,
  'procedural-art-gen': 1500,
  'lava-lamp-frame': 50,
  'astronomy-new-moon': 300,
  'astronomy-solar-term': 300,
  'minimap-drag': 100,
  'minimap-crystal-update': 200,
  'calendar-month-render': 400,
  'calendar-week-render': 300,
  'ipc-save-entry': 500,
  'ipc-search': 1000,
  'ipc-export': 10000,
  'ipc-import': 10000,
  'ipc-backup': 8000,
  'ipc-get-all-entries': 3000,
};

// ── Default Throttle (ms between console outputs per label) ──

const DEFAULT_THROTTLE: Record<string, number> = {
  '_default': 200,           // General spans: 5 logs/second (more responsive tracking)
  'animation-frame': 3000,   // Fires every frame; 1 log/3s max
  'fps': 5000,               // FPS reports: 1 log/5s
  'ipc-invoke': 1000,        // Frequent IPC calls
  'ipc-query': 1000,         // Frequent queries
  'db-query': 1000,
  'db-write': 1000,
  'nav-arrow': 100,          // Arrow navigation: frequent, show most
  'nav-today': 100,          // Today button: show every press
  '__overbudget__': 1000,    // Over-budget always surfaces, but ≤1/sec
};

// ── History Cap ──

const MAX_HISTORY = 200;

// ── PerfTrail Singleton ──

class PerfTrail {
  // Master gate
  private _enabled = false;

  // Active spans
  private _spans: Map<string, SpanEntry> = new Map();

  // Aggregate stats per label (always accumulates)
  private _aggregates: Map<string, Aggregate> = new Map();

  // History ring buffer
  private _history: HistoryEntry[] = [];

  // Per-label budget thresholds (ms)
  private _budgets: Map<string, number> = new Map();

  // Per-label last-output timestamp (for throttle)
  private _lastLogged: Map<string, number> = new Map();

  // Per-label throttle intervals (ms)
  private _logThrottleMs: Map<string, number> = new Map();

  // FPS tracking
  private _frameCount = 0;
  private _frameWindowStart = 0;
  private _frameFPS = 0;

  // FPS subscribers
  private _fpsCallbacks: Set<(fps: number) => void> = new Set();

  // Override flags
  private _forceDisable = false;
  private _forceEnable = false;

  constructor() {
    this._applyDefaultBudgets();
    this._applyDefaultThrottles();
    this._autoEnable();
  }

  // ────────────────────────────────────────────
  //  Lifecycle
  // ────────────────────────────────────────────

  /** Enable PerfTrail instrumentation */
  enable(): void {
    this._enabled = true;
    this._emitStartupBanner();
  }

  /** Disable PerfTrail instrumentation */
  disable(): void {
    this._enabled = false;
    this._logToSinks('[PerfTrail] 🔴 Disabled', 'info');
  }

  /** Check if PerfTrail is active */
  isEnabled(): boolean {
    return this._enabled;
  }

  /** Force-enable, overriding all auto-disable conditions */
  forceEnable(): void {
    this._forceEnable = true;
    this._forceDisable = false;
    this.enable();
  }

  /** Force-disable, overriding all auto-enable conditions */
  forceDisable(): void {
    this._forceDisable = true;
    this._forceEnable = false;
    this.disable();
  }

  // ────────────────────────────────────────────
  //  Budget Management
  // ────────────────────────────────────────────

  /** Set a budget threshold for a span label */
  budget(label: string, ms: number): void {
    this._budgets.set(label, ms);
  }

  /** Get the budget for a label (Infinity if unset) */
  getBudget(label: string): number {
    return this._budgets.get(label) ?? Infinity;
  }

  /** Set throttle interval for a label */
  setThrottle(label: string, ms: number): void {
    this._logThrottleMs.set(label, ms);
  }

  // ────────────────────────────────────────────
  //  Span Timing
  // ────────────────────────────────────────────

  /** Start timing a span. Returns immediately if disabled. */
  start(label: string): void {
    if (!this._enabled) return;
    this._spans.set(label, {
      start: performance.now(),
      threshold: this.getBudget(label),
    });
  }

  /**
   * End timing a span.
   * @returns Elapsed milliseconds (0 if span never started)
   */
  end(label: string): number {
    const span = this._spans.get(label);
    if (!span) return 0;

    this._spans.delete(label);
    const elapsed = performance.now() - span.start;
    const overBudget = elapsed > span.threshold;

    // Always aggregate
    this._updateAggregate(label, elapsed);

    // Cap history
    this._history.push({
      label,
      elapsed,
      timestamp: Date.now(),
      overBudget,
    });
    if (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }

    // Throttled console output
    if (this._shouldLog(label, overBudget)) {
      this._emitTiming(label, elapsed, span.threshold, overBudget);
    }

    return elapsed;
  }

  /**
   * Wrap a sync or async function with start/end timing.
   * Handles both sync return values and async promises.
   */
  wrap<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      const result = fn();
      if (result instanceof Promise) {
        // Handle async
        (result as unknown as Promise<unknown>)
          .then(() => this.end(label))
          .catch(() => this.end(label));
      } else {
        this.end(label);
      }
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  // ────────────────────────────────────────────
  //  Error Enrichment
  // ────────────────────────────────────────────

  /**
   * Log an error with structured context.
   * @param source - Module or component name
   * @param message - Error description
   * @param context - Key-value pairs for enrichment
   */
  error(source: string, message: string, context?: Record<string, unknown>): void {
    if (!this._enabled) return;
    const ctxStr = this._formatContext(context);
    const output = `❌ [${source}] ${message}${ctxStr ? ` | ${ctxStr}` : ''}`;
    this._logToSinks(output, 'error');
  }

  // ────────────────────────────────────────────
  //  Checkpoint Markers
  // ────────────────────────────────────────────

  /**
   * Log a state-snapshot marker without timing.
   * Respects per-label throttle to prevent flood during rapid operations
   * (e.g., minimap drag, keyboard scroll).
   * @param label - Checkpoint name
   * @param data - Optional key-value context
   */
  checkpoint(label: string, data?: Record<string, unknown>): void {
    if (!this._enabled) return;
    const ctxStr = this._formatContext(data);
    const output = `◆ [CP] ${label}${ctxStr ? ` ${ctxStr}` : ''}`;
    // Use checkpoint-specific throttle key so checkpoints don't interfere with span throttle
    if (this._shouldLog(`__cp__${label}`, false)) {
      this._logToSinks(output, 'info');
    } else {
      // Still track in debug panel via logger (throttle is only for console output)
      if (typeof window !== 'undefined' && (window as any).electronAPI?.logToMain) {
        try { (window as any).electronAPI.logToMain(output, 'perf'); } catch { /* ignore */ }
      }
    }
  }

  // ────────────────────────────────────────────
  //  FPS Monitoring
  // ────────────────────────────────────────────

  /**
   * Call once per animation frame.
   * Tracks FPS over a 1-second rolling window.
   * @returns Current FPS (0 until first window completes)
   */
  tick(): number {
    if (!this._enabled) return this._frameFPS;

    const now = performance.now();
    if (this._frameWindowStart === 0) {
      this._frameWindowStart = now;
      this._frameCount = 1;
      return this._frameFPS;
    }

    this._frameCount++;
    const elapsed = now - this._frameWindowStart;

    if (elapsed >= 1000) {
      const fps = Math.round((this._frameCount * 1000) / elapsed);
      this._frameFPS = fps;
      this._frameCount = 0;
      this._frameWindowStart = now;

      // Notify subscribers
      this._fpsCallbacks.forEach(cb => cb(fps));

      // Log low FPS
      const detectedHz = displayRefreshRate.getRefreshRate();
      if (fps < 45 && this._shouldLog('fps', false)) {
        this._logToSinks(
          `○ [FPS] ${fps} (detected display: ${detectedHz} Hz)`,
          'warn'
        );
      }
    }

    return this._frameFPS;
  }

  /** Get latest FPS reading without side effects */
  fps(): number {
    return this._frameFPS;
  }

  /** Subscribe to FPS updates. Returns unsubscribe function. */
  onFps(callback: (fps: number) => void): () => void {
    this._fpsCallbacks.add(callback);
    return () => { this._fpsCallbacks.delete(callback); };
  }

  /**
   * Emit a startup banner to confirm PerfTrail is live.
   * Called once when enabled in dev mode.
   */
  private _emitStartupBanner(): void {
    this._logToSinks(
      `[PerfTrail] ✅ Active — ${this._budgets.size} budgets, ${this._logThrottleMs.size} throttle rules, ${this._aggregates.size} aggregates`,
      'info'
    );
    this._logToSinks(
      `[PerfTrail] 📊 Span timing, FPS monitoring, error enrichment — all outputs in console.error filter`,
      'info'
    );
  }

  // ────────────────────────────────────────────
  //  Reports & Dump
  // ────────────────────────────────────────────

  /**
   * Get aggregate statistics for all tracked labels.
   * @returns Array of rows suitable for table display
   */
  report(): AggregateRow[] {
    if (this._aggregates.size === 0) return [];

    const rows: AggregateRow[] = [];
    this._aggregates.forEach((agg, label) => {
      rows.push({
        label,
        count: agg.count,
        lastMs: agg.last.toFixed(2),
        avgMs: (agg.total / agg.count).toFixed(2),
        minMs: agg.min.toFixed(2),
        maxMs: agg.max.toFixed(2),
        totalMs: agg.total.toFixed(2),
      });
    });

    // Sort by total time descending
    rows.sort((a, b) => parseFloat(b.totalMs) - parseFloat(a.totalMs));

    this._logToSinks('[PerfTrail] 📊 Performance Report', 'info');
    if (typeof console.table !== 'undefined') {
      console.table(rows);
    } else {
      rows.forEach(r => {
        this._logToSinks(
          `  ${r.label}: count=${r.count}, avg=${r.avgMs}ms, max=${r.maxMs}ms, total=${r.totalMs}ms`,
          'info'
        );
      });
    }

    return rows;
  }

  /**
   * Get a full snapshot of all PerfTrail state.
   * In browser, also attempts clipboard copy.
   */
  dump(): PerfSnapshot {
    const aggregates: Record<string, Aggregate> = {};
    this._aggregates.forEach((agg, label) => { aggregates[label] = { ...agg }; });

    const budgets: Record<string, number> = {};
    this._budgets.forEach((budget, label) => { budgets[label] = budget; });

    const snapshot: PerfSnapshot = {
      enabled: this._enabled,
      aggregates,
      history: this._history.slice(-100), // Last 100 entries
      activeSpans: Array.from(this._spans.keys()),
      budgets,
      fps: this._frameFPS,
      displayRefreshRate: displayRefreshRate.getRefreshRate(),
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(snapshot, null, 2);
    this._logToSinks('[PerfTrail] 📦 Perf Snapshot', 'info');
    console.log(json);

    // Attempt clipboard copy (browser)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(json).catch(() => {});
    }

    return snapshot;
  }

  /** Reset all state */
  reset(): void {
    this._spans.clear();
    this._aggregates.clear();
    this._history = [];
    this._lastLogged.clear();
    this._frameCount = 0;
    this._frameWindowStart = 0;
    this._frameFPS = 0;
    this._logToSinks('[PerfTrail] 🔄 Reset', 'info');
  }

  // ────────────────────────────────────────────
  //  Internal: Aggregation
  // ────────────────────────────────────────────

  private _updateAggregate(label: string, elapsed: number): void {
    const existing = this._aggregates.get(label);
    if (existing) {
      existing.count++;
      existing.total += elapsed;
      if (elapsed < existing.min) existing.min = elapsed;
      if (elapsed > existing.max) existing.max = elapsed;
      existing.last = elapsed;
    } else {
      this._aggregates.set(label, {
        count: 1,
        total: elapsed,
        min: elapsed,
        max: elapsed,
        last: elapsed,
      });
    }
  }

  // ────────────────────────────────────────────
  //  Internal: Throttle
  // ────────────────────────────────────────────

  private _shouldLog(label: string, overBudget: boolean): boolean {
    if (!this._enabled) return false;

    const now = Date.now();

    // Over-budget spans use a shared throttle key so they always surface
    const key = overBudget ? '__overbudget__' : label;
    const interval = this._logThrottleMs.get(key)
                  ?? this._logThrottleMs.get('_default')
                  ?? 500;

    const last = this._lastLogged.get(key) ?? 0;
    if (now - last < interval) return false;

    this._lastLogged.set(key, now);
    return true;
  }

  // ────────────────────────────────────────────
  //  Internal: Output Formatting
  // ────────────────────────────────────────────

  private _emitTiming(label: string, elapsed: number, threshold: number, overBudget: boolean): void {
    const icon = overBudget ? '⚠️' : '⏱️';
    const pct = threshold === Infinity
      ? ''
      : ` (${(elapsed / threshold * 100).toFixed(0)}% of ${threshold.toFixed(0)}ms budget)`;
    const avg = this._getAverage(label);
    const avgStr = avg !== null ? ` avg: ${avg.toFixed(2)}ms` : '';

    const output = `${icon} [Perf] ${label}: ${elapsed.toFixed(2)}ms${pct}${avgStr}`;
    this._logToSinks(output, overBudget ? 'warn' : 'info');
  }

  private _getAverage(label: string): number | null {
    const agg = this._aggregates.get(label);
    if (!agg || agg.count === 0) return null;
    return agg.total / agg.count;
  }

  private _formatContext(context?: Record<string, unknown>): string {
    if (!context || Object.keys(context).length === 0) return '';
    return Object.entries(context)
      .map(([key, value]) => {
        if (value === null || value === undefined) return `${key}=null`;
        if (typeof value === 'object') {
          try { return `${key}=${JSON.stringify(value)}`; }
          catch { return `${key}=[object]`; }
        }
        return `${key}=${String(value)}`;
      })
      .join(', ');
  }

  // ────────────────────────────────────────────
  //  Internal: Sink
  // ────────────────────────────────────────────

  /**
   * Route output to all available sinks:
   * 1. Frontend logger (dev console)
   * 2. Electron main process (via IPC if available)
   * 3. Direct console fallback
   */
  private _logToSinks(message: string, level: 'info' | 'warn' | 'error'): void {
    // Per original PerformanceTrail spec: ALL output goes to console.error
    // so developers can filter to 'Errors' level and see perf data + real errors together.
    console.error(message);

    // Forward to Electron main process if available
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.logToMain) {
        (window as any).electronAPI.logToMain(message, 'perf');
      }
    } catch {
      // Silently fail — IPC bridge may not exist
    }
  }

  // ────────────────────────────────────────────
  //  Internal: Defaults & Auto-Enable
  // ────────────────────────────────────────────

  private _applyDefaultBudgets(): void {
    Object.entries(DEFAULT_BUDGETS).forEach(([label, ms]) => {
      this._budgets.set(label, ms);
    });
  }

  private _applyDefaultThrottles(): void {
    Object.entries(DEFAULT_THROTTLE).forEach(([label, ms]) => {
      this._logThrottleMs.set(label, ms);
    });
  }

  private _autoEnable(): void {
    try {
      // Priority 1: Force-disable takes precedence
      if (this._forceDisable) return;

      // Priority 2: Force-enable
      if (this._forceEnable) { this._enabled = true; return; }

      // Priority 3: Environment variable (Electron main process)
      if (typeof process !== 'undefined' && process.env) {
        if (process.env.CALENRECALL_PERF === '1') { this._enabled = true; return; }
        if (process.env.CALENRECALL_PERF === '0') { this._enabled = false; return; }
        if (process.env.NODE_ENV === 'development') { this._enabled = true; return; }
        // Electron dev detection
        try {
          const electron = require('electron');
          if (electron.app && !electron.app.isPackaged) { this._enabled = true; return; }
        } catch { /* not in Electron */ }
      }

      // Priority 4: Browser dev detection (renderer process)
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
          this._enabled = true; return;
        }

        // URL params
        try {
          const params = new URLSearchParams(window.location.search);
          if (params.get('perf') === '1') { this._enabled = true; return; }
          if (params.get('perf') === '0') { this._enabled = false; return; }
        } catch { /* URL params not available */ }
      }

      // Priority 5: Persistent preference from Electron
      this._checkPersistentPreference();
    } catch (e) {
      // Fail-safe: ensure PerfTrail is disabled in hostile environments
      this._enabled = false;
    }
  }

  private async _checkPersistentPreference(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getPreference) {
        const val = await (window as any).electronAPI.getPreference('perfTrail');
        if (val === true) { this._enabled = true; return; }
        if (val === false) { this._enabled = false; return; }
      }
    } catch {
      // Preference check failed — stay at current state
    }
  }
}

// Singleton instance
const perfTrail = new PerfTrail();
export default perfTrail;
export { PerfTrail };
