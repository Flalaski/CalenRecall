/**
 * Electron-side PerformanceTrail wrapper.
 *
 * Provides a thin proxy over the renderer PerfTrail core with Electron-specific
 * output routing: feeds into `electron/utils/logger.ts` and forwards timing
 * data to all open renderer windows via IPC.
 *
 * This enables timing instrumentation in the main process (IPC handlers,
 * database operations, profile management) with the same API surface.
 *
 * Usage:
 *   import { perfTrail } from './utils/perfTrail';
 *   perfTrail.start('db-query');
 *   // ... work ...
 *   perfTrail.end('db-query');
 */

import { logger } from './logger';

interface SpanEntry {
  start: number;
  threshold: number;
}

interface Aggregate {
  count: number;
  total: number;
  min: number;
  max: number;
  last: number;
}

interface HistoryEntry {
  label: string;
  elapsed: number;
  timestamp: number;
  overBudget: boolean;
}

const DEFAULT_BUDGETS: Record<string, number> = {
  'db-query': 50,
  'db-write': 100,
  'ipc-invoke': 100,
  'ipc-save-entry': 500,
  'ipc-search': 1000,
  'ipc-export': 10000,
  'ipc-import': 10000,
  'ipc-backup': 8000,
  'ipc-get-all-entries': 3000,
  'profile-switch': 2000,
  'password-verify': 200,
};

const MAX_HISTORY = 200;
const DEFAULT_THROTTLE_MS = 1000;
const OVERBUDGET_THROTTLE_MS = 1000;

class ElectronPerfTrail {
  private _enabled = false;
  private _spans: Map<string, SpanEntry> = new Map();
  private _aggregates: Map<string, Aggregate> = new Map();
  private _history: HistoryEntry[] = [];
  private _budgets: Map<string, number> = new Map(DEFAULT_BUDGETS ? Object.entries(DEFAULT_BUDGETS) : []);
  private _lastLogged: Map<string, number> = new Map();

  constructor() {
    this._autoEnable();
  }

  // ── Lifecycle ──

  enable(): void { this._enabled = true; logger.log('PerfTrail enabled', undefined, 'PerfTrail'); }
  disable(): void { this._enabled = false; logger.log('PerfTrail disabled', undefined, 'PerfTrail'); }
  isEnabled(): boolean { return this._enabled; }

  budget(label: string, ms: number): void { this._budgets.set(label, ms); }

  // ── Span Timing ──

  start(label: string): void {
    if (!this._enabled) return;
    this._spans.set(label, {
      start: performance.now(),
      threshold: this._budgets.get(label) ?? Infinity,
    });
  }

  end(label: string): number {
    const span = this._spans.get(label);
    if (!span) return 0;
    this._spans.delete(label);

    const elapsed = performance.now() - span.start;
    const overBudget = elapsed > span.threshold;

    // Always aggregate
    const agg = this._aggregates.get(label);
    if (agg) {
      agg.count++; agg.total += elapsed;
      if (elapsed < agg.min) agg.min = elapsed;
      if (elapsed > agg.max) agg.max = elapsed;
      agg.last = elapsed;
    } else {
      this._aggregates.set(label, { count: 1, total: elapsed, min: elapsed, max: elapsed, last: elapsed });
    }

    // History
    this._history.push({ label, elapsed, timestamp: Date.now(), overBudget });
    if (this._history.length > MAX_HISTORY) this._history.shift();

    // Throttled output
    if (this._shouldLog(label, overBudget)) {
      logger.perf(label, elapsed, span.threshold, overBudget);
    }

    return elapsed;
  }

  error(source: string, message: string, context?: Record<string, unknown>): void {
    if (!this._enabled) return;
    const ctxStr = context ? Object.entries(context).map(([k, v]) => `${k}=${String(v)}`).join(', ') : '';
    logger.error(`[${source}] ${message}${ctxStr ? ` | ${ctxStr}` : ''}`, undefined, 'PerfTrail');
  }

  checkpoint(label: string, data?: Record<string, unknown>): void {
    if (!this._enabled) return;
    const ctxStr = data ? Object.entries(data).map(([k, v]) => `${k}=${String(v)}`).join(', ') : '';
    logger.log(`◆ [CP] ${label}${ctxStr ? ` ${ctxStr}` : ''}`, undefined, 'PerfTrail');
  }

  reset(): void {
    this._spans.clear();
    this._aggregates.clear();
    this._history = [];
    this._lastLogged.clear();
  }

  // ── Internal ──

  private _shouldLog(label: string, overBudget: boolean): boolean {
    if (!this._enabled) return false;
    const now = Date.now();
    const key = overBudget ? '__overbudget__' : label;
    const interval = overBudget ? OVERBUDGET_THROTTLE_MS : DEFAULT_THROTTLE_MS;
    const last = this._lastLogged.get(key) ?? 0;
    if (now - last < interval) return false;
    this._lastLogged.set(key, now);
    return true;
  }

  private _autoEnable(): void {
    try {
      if (process.env.CALENRECALL_PERF === '1') { this._enabled = true; return; }
      if (process.env.CALENRECALL_PERF === '0') { this._enabled = false; return; }
      const { app } = require('electron');
      if (process.env.NODE_ENV === 'development' || !app.isPackaged) { this._enabled = true; return; }
    } catch {
      this._enabled = false;
    }
  }
}

export const perfTrail = new ElectronPerfTrail();
export default perfTrail;
