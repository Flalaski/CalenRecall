# PerformanceTrail — CalenRecall Integration Audit

> **Audit Date:** 2026-07-17  
> **Status:** Blueprint & Gap Analysis  
> **Based on:** `PERF_TRAIL_RECONSTRUCTION_GUIDE.md` × `src/utils/performance/*` × `electron/utils/logger.ts` × `src/utils/logger.ts`

---

## 1. Executive Summary

CalenRecall already has a **sophisticated performance infrastructure** — a 5-module subsystem in `src/utils/performance/` (animation manager, task scheduler, display refresh rate detector, style batcher, virtual renderer) plus two separate loggers (frontend + Electron). What it **lacks** is the **instrumentation layer** that PerformanceTrail provides: span timing with budget thresholds, aggregated statistics, console-output throttling, FPS monitoring, error enrichment, and environment-gated auto-enable.

**PerformanceTrail is ~370 lines of zero-dependency instrumentation.**

We need to build a **CalenRecall-native PerfTrail** that:
1. Wraps the existing performance modules (reuses `displayRefreshRate`)
2. Adds the missing span-timing/aggregation/throttle core
3. Feeds **both** `electron/utils/logger.ts` (for production) and the frontend logger (for dev)
4. Instruments ~50 critical call sites across the codebase
5. Auto-enables in dev, stays dark in production

---

## 2. Gap Analysis: CalenRecall vs. PerformanceTrail

### 2.1 What PerformanceTrail Has That CalenRecall Lacks

| Feature | PerfTrail | CalenRecall | Gap |
|---------|-----------|-------------|-----|
| **Span timing** (`start`/`end`) | ✅ Core feature | ❌ Nothing | **Critical** |
| **Per-label aggregation** (count, min, max, avg, last) | ✅ Always-on | ❌ Nothing | **Critical** |
| **Budget thresholds** | ✅ 33 budgets defined | ❌ Nothing | **High** |
| **Console output throttle** | ✅ Per-label (500ms/3s/5s) | ❌ None | **High** |
| **Over-budget warnings** | ✅ Dedicated 1s throttle | ❌ None | **High** |
| **FPS monitoring** (`tick()`) | ✅ Per-frame tracker | ⚠️ `displayRefreshRate` detects Hz but doesn't track actual FPS | **High** |
| **Error enrichment** | ✅ Structured `key=value` | ❌ `errorHandler.ts` classifies but doesn't enrich with context | **Medium** |
| **Checkpoint markers** | ✅ `checkpoint(label, data)` | ❌ Nothing | **Medium** |
| **Report/Dump snapshot** | ✅ `report()`, `dump()` | ❌ Nothing | **Medium** |
| **Auto-enable/disable** | ✅ 6-rule chain | ❌ Manual only | **Medium** |
| **Dual-publish** | ✅ `console.error` + `debugConsole` | ⚠️ Two separate loggers, not unified | **Medium** |
| **Zero-cost guard pattern** | ✅ `_pt && _pt.start()` | ⚠️ `logger.ts` guards but isn't used for perf | **Low** |
| **`wrap()` helper** | ✅ RAII-like | ❌ Nothing | **Low** |
| **No dependencies** | ✅ Pure IIFE | ⚠️ Can use ES modules instead | **N/A** |

### 2.2 What CalenRecall Already Has (That PerfTrail Doesn't)

| Feature | CalenRecall | PerfTrail |
|---------|-------------|-----------|
| **Display refresh rate detection** | ✅ Samples 60 RAF frames, rounds to common rates | ❌ Simple 1s window FPS counter |
| **Task scheduler with priorities** | ✅ 4 levels, frame-budget-aware, PerformanceObserver | ❌ None |
| **Animation manager** | ✅ Compositor-optimized, will-change, keyframe injection | ❌ None |
| **Style batcher** | ✅ Per-RAF batch with priority | ❌ None |
| **Virtual renderer** | ✅ IntersectionObserver-based | ❌ None |
| **Structured Electron logger** | ✅ Levels, timestamps, context, file output | ❌ Console only |
| **Extreme performance CSS** | ✅ Strips all animations/transitions | ❌ None |
| **Entry lookup O(1) cache** | ✅ Maps + Sets for instant queries | ❌ None |
| **Entry color cache** | ✅ Numerological color cache | ❌ None |

**Conclusion:** CalenRecall has **better perf infrastructure at the system level** but **zero instrumentation**. PerformanceTrail is the missing **measurement layer** that tells you whether those systems are actually working.

---

## 3. Architecture: CalenRecall PerfTrail

### 3.1 High-Level Design

```
┌──────────────────────────────────────────────────────────┐
│                  CalenRecall PerfTrail                     │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Span Timing  │  │ Aggregator   │  │ Throttle Manager │ │
│  │ start/end    │  │ count/min/   │  │ per-label 500ms  │ │
│  │ wrap()       │  │ max/avg/last │  │ over-budget 1s   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
│         │                 │                    │           │
│         └─────────────────┼────────────────────┘           │
│                           │                                │
│                    ┌──────▼───────┐                        │
│                    │   Sink Mux   │                        │
│                    └──┬───────┬───┘                        │
│                       │       │                            │
│              ┌────────▼─┐  ┌──▼───────────┐               │
│              │ Frontend  │  │ Electron     │               │
│              │ logger.ts │  │ logger.ts    │               │
│              │ (dev)     │  │ (prod+dev)   │               │
│              └───────────┘  └──────────────┘               │
│                                                           │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────────┐ │
│  │ Enrichment   │  │ Checkpoint │  │ Auto-Enable Chain │ │
│  │ error(source │  │ (state     │  │ hostname → env    │ │
│  │ ,msg,ctx)    │  │  snapshot) │  │ → config → flag   │ │
│  └──────────────┘  └────────────┘  └───────────────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Integration Hooks                                     │ │
│  │  • Reuses displayRefreshRate for FPS monitoring       │ │
│  │  • Reuses taskScheduler for deferred reporting        │ │
│  │  • Reuses errorHandler for error classification       │ │
│  │  • Bridges both frontend + Electron logger            │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3.2 File Placement

```
src/utils/performance/
├── displayRefreshRate.ts   ← EXISTS
├── taskScheduler.ts        ← EXISTS
├── animationManager.ts     ← EXISTS
├── styleBatcher.ts         ← EXISTS
├── virtualRenderer.ts      ← EXISTS
└── perfTrail.ts            ← NEW (the integration layer)

electron/utils/
├── logger.ts               ← EXISTS (to be enhanced)
└── perfTrail.ts            ← NEW (Electron-side spans)

src/hooks/
├── useDisplayRefreshRate.ts  ← EXISTS
├── usePerformanceOptimized.ts ← EXISTS
├── usePerfTrail.ts           ← NEW (React hook for span timing)
└── useFpsMonitor.ts          ← NEW (FPS overlay component hook)
```

---

## 4. Complete API Specification

### 4.1 Core Singleton: `src/utils/performance/perfTrail.ts`

```typescript
// === Public Interface ===

// ── Lifecycle ──
PerfTrail.enable(): void
PerfTrail.disable(): void
PerfTrail.isEnabled(): boolean

// ── Activation Overrides ──
PerfTrail.forceEnable(): void    // Overrides all auto-disable
PerfTrail.forceDisable(): void   // Overrides all auto-enable

// ── Span Timing ──
PerfTrail.start(label: string): void
PerfTrail.end(label: string): number    // Returns elapsed ms
PerfTrail.wrap<T>(label: string, fn: () => T): T   // Sync + async

// ── Budgets ──
PerfTrail.budget(label: string, ms: number): void
PerfTrail.setThrottle(label: string, ms: number): void

// ── Enrichment ──
PerfTrail.error(source: string, message: string, context?: Record<string, unknown>): void
PerfTrail.checkpoint(label: string, data?: Record<string, unknown>): void

// ── FPS Monitoring ──
PerfTrail.tick(): number          // Call per animation frame, returns FPS
PerfTrail.fps(): number           // Get latest FPS without side effects
PerfTrail.onFps(callback: (fps: number) => void): () => void  // Subscribe

// ── Reports ──
PerfTrail.report(): AggregateRow[]    // Returns stats array
PerfTrail.dump(): PerfSnapshot        // Returns full state
PerfTrail.reset(): void

// ── Integration Hooks ──
PerfTrail.getSchedulerMetrics(): SchedulerMetrics  // From taskScheduler
PerfTrail.getDisplayInfo(): DisplayInfo            // From displayRefreshRate
```

### 4.2 Internal State

```typescript
interface SpanEntry {
  start: number;        // performance.now() timestamp
  threshold: number;    // budget in ms (Infinity if unset)
}

interface HistoryEntry {
  label: string;
  elapsed: number;
  timestamp: number;    // Date.now() for throttle
  overBudget: boolean;
}

interface Aggregate {
  count: number;
  total: number;
  min: number;
  max: number;
  last: number;
}

interface PerfSnapshot {
  enabled: boolean;
  aggregates: Record<string, Aggregate>;
  history: HistoryEntry[];       // Last 200
  activeSpans: string[];         // Currently running labels
  budgets: Record<string, number>;
  fps: number;
  displayRefreshRate: number;
  schedulerMetrics: SchedulerMetrics | null;
  timestamp: string;
}
```

### 4.3 Default Budgets (CalenRecall-Specific)

Based on auditing the existing performance infrastructure and the app's critical paths:

| Label | Budget (ms) | Justification |
|-------|-------------|---------------|
| `app-init` | 5000 | Full app initialization (prefs, entries, theme) |
| `load-entries` | 3000 | `getAllEntries` IPC + lookup build |
| `search-entries` | 1000 | Full-text search across all entries |
| `export-entries` | 10000 | Export pipeline (all 7 formats) |
| `import-entries` | 10000 | Import pipeline |
| `calendar-render` | 500 | Calendar grid render (day/week/month/year/decade) |
| `minimap-render` | 300 | Timeline minimap canvas render |
| `entry-save` | 500 | Save entry IPC + lookup update |
| `entry-delete` | 300 | Delete entry IPC + lookup update |
| `calendar-convert` | 100 | JDN calendar conversion |
| `astronomy-calc` | 200 | Solar term / moon phase calculation |
| `theme-apply` | 200 | Theme CSS application |
| `background-art` | 1000 | Procedural art generation |
| `animation-frame` | 33 | Per-frame budget (~30fps target) |
| `ipc-invoke` | 100 | IPC round-trip (renderer → main → renderer) |
| `db-query` | 50 | SQLite query (main process) |
| `db-write` | 100 | SQLite write (main process) |
| `export-format-md` | 3000 | Markdown export generation |
| `export-format-pdf` | 5000 | PDF export (PDFKit) |
| `export-format-json` | 2000 | JSON export generation |
| `archive-create` | 8000 | Archiver backup creation |
| `profile-switch` | 2000 | Profile database switch |
| `password-verify` | 200 | Password hashing + verification |

### 4.4 Throttle Configuration

| Label | Throttle (ms) | Rationale |
|-------|---------------|-----------|
| `_default` | 500 | General spans: 2 logs/second max |
| `animation-frame` | 3000 | Fires every frame; 1 log/3s max |
| `fps` | 5000 | FPS reports: 1 log/5s |
| `ipc-invoke` | 1000 | Frequent IPC calls |
| `db-query` | 1000 | Frequent queries |
| `__overbudget__` | 1000 | Over-budget always surfaces, but ≤1/sec |

---

## 5. Integration Points: All 50+ Instrumentation Sites

### 5.1 Frontend: App.tsx (6 sites)

| Location | Label | When |
|----------|-------|------|
| Preload effect (line ~70) | `app-init` | Start before preload, end after prefs loaded |
| `preloadAllEntries` (line ~77) | `load-entries` | Wrap `getAllEntries` + `setEntries` |
| `handleDateChange` (line ~860) | `calendar-render` | Wrap RAF callback that sets selectedDate |
| Search open (line ~1300) | `search-entries` | Wrap IPC `searchEntries` call |
| Export trigger | `export-entries` | Wrap export IPC call |
| Entry save | `entry-save` | Wrap `saveEntry` IPC call |

### 5.2 Frontend: NavigationBar.tsx (3 sites)

| Location | Label | When |
|----------|-------|------|
| `goToToday` (line ~280) | `nav-today` | On Today button click |
| `navigate` (line ~200) | `nav-arrow` | On ← → navigation |
| `handleDateInputSubmit` | `nav-date-input` | On date field submit |

### 5.3 Frontend: CalendarView.tsx (3 sites)

| Location | Label | When |
|----------|-------|------|
| Month grid render | `calendar-month-render` | Around month generation |
| Week rows render | `calendar-week-render` | Around week generation |
| Astronomical event calc | `astronomy-calc` | Around solstice/equinox calc |

### 5.4 Frontend: GlobalTimelineMinimap.tsx (3 sites)

| Location | Label | When |
|----------|-------|------|
| RAF animation loop | `animation-frame` | `tick()` + `start/end` per frame |
| Drag calculation | `minimap-drag` | On drag interaction |
| Crystal position update | `minimap-crystal-update` | After entry data changes |

### 5.5 Frontend: BackgroundArt.tsx (2 sites)

| Location | Label | When |
|----------|-------|------|
| Procedural art generation | `background-art` | On theme/background change |
| Color extraction | `bg-color-extract` | On image load |

### 5.6 Frontend: JournalEditor.tsx (2 sites)

| Location | Label | When |
|----------|-------|------|
| Save entry | `entry-save` | On save button |
| Auto-save | `entry-autosave` | On auto-save timer |

### 5.7 Frontend: EntryViewer.tsx (1 site)

| Location | Label | When |
|----------|-------|------|
| Load entry content | `entry-load` | On entry selection |

### 5.8 Frontend: Preferences.tsx (2 sites)

| Location | Label | When |
|----------|-------|------|
| Theme apply | `theme-apply` | On theme change |
| Save all prefs | `prefs-save` | On save button |

### 5.9 Frontend: Utils (4 sites)

| File | Label | When |
|------|-------|------|
| `proceduralArt.ts` | `procedural-art-gen` | On art generation |
| `lavaLampArt.ts` | `lava-lamp-frame` | Per lava lamp frame |
| `calendars/astronomicalUtils.ts` | `astronomy-new-moon` | New moon calculation |
| `calendars/astronomicalUtils.ts` | `astronomy-solar-term` | Solar term calculation |

### 5.10 Electron Main Process (8 sites)

| File | Label | When |
|------|-------|------|
| `ipc-handlers.ts` — `saveEntry` | `ipc-save-entry` | Wrap write handler |
| `ipc-handlers.ts` — `searchEntries` | `ipc-search` | Wrap search handler |
| `ipc-handlers.ts` — `exportEntries` | `ipc-export` | Wrap export handler |
| `ipc-handlers.ts` — `importEntries` | `ipc-import` | Wrap import handler |
| `ipc-handlers.ts` — `backupDatabase` | `ipc-backup` | Wrap backup handler |
| `ipc-handlers.ts` — `getAllEntries` | `ipc-get-all-entries` | Wrap read handler |
| `profile-manager.ts` — `switchProfile` | `profile-switch` | Wrap profile switch |
| `database.ts` — query methods | `db-query` / `db-write` | Wrap SQL operations |

### 5.11 FPS Monitoring (2 sites)

| File | Label | When |
|------|-------|------|
| `GlobalTimelineMinimap.tsx` RAF loop | — | Add `tick()` call per frame |
| `electron/main.ts` `setFrameRate(30)` | — | Replace with `PerfTrail` frame monitoring |

---

## 6. Activation & Environment Gating

### 6.1 Auto-Enable Chain (priority order)

```
1. Process env: CALENRECALL_PERF=1        → enable
2. Node env:    NODE_ENV=development       → enable
3. Electron:    !app.isPackaged            → enable
4. Config flag: preference 'perfTrail'=1  → enable (persistent toggle)
5. Override:    CALENRECALL_PERF=0         → force-disable
6. Config flag: preference 'perfTrail'=0  → force-disable (persistent)
```

### 6.2 Frontend Activation (renderer process)

```typescript
// src/utils/performance/perfTrail.ts — auto-enable
function autoEnable(): void {
  try {
    // URL param (dev overrides)
    if (typeof URLSearchParams !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('perf') === '1') { enable(); return; }
      if (params.get('perf') === '0') { disable(); return; }
    }

    // Dev environment detection
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
      enable(); return;
    }

    // Persistent preference (via IPC to Electron)
    if (window.electronAPI) {
      window.electronAPI.getPreference('perfTrail').then((val: any) => {
        if (val === true) enable();
        if (val === false) disable();
      }).catch(() => {});
    }
  } catch (e) { /* silent */ }
}
```

### 6.3 Electron Activation (main process)

```typescript
// electron/utils/perfTrail.ts — auto-enable
function autoEnable(): void {
  if (process.env.CALENRECALL_PERF === '1') { enable(); return; }
  if (process.env.CALENRECALL_PERF === '0') { disable(); return; }
  if (!app.isPackaged) { enable(); return; }
  // Check profile preference
  try {
    const db = getDatabase();
    if (db) {
      const row = db.prepare('SELECT value FROM preferences WHERE key = ?').get('perfTrail') as any;
      if (row) {
        const val = JSON.parse(row.value);
        if (val === true) enable();
        if (val === false) disable();
      }
    }
  } catch { /* silent */ }
}
```

---

## 7. Output & Sink Architecture

### 7.1 Dual-Publish Design

```
PerfTrail.end(label)
    │
    ├──► Always: Update aggregates + history
    │
    ├──► If shouldLog(label, overBudget):
    │       ├──► console.log('[PerfTrail]', formattedTiming)
    │       └──► if (window.electronAPI?.logToMain)
    │               window.electronAPI.logToMain(...)
    │
    └──► If Electron-side:
            ├──► electronLogger.log(...)
            └──► sendToAllWindows('perf-trail-update', ...)
```

### 7.2 Frontend Sink (`src/utils/logger.ts` — enhanced)

Add timing-specific methods:

```typescript
// Add to existing logger
logger.perf = (label: string, elapsed: number, budget: number, over: boolean) => {
  if (!isDevelopment) return;
  const icon = over ? '⚠️' : '⏱️';
  const pct = budget === Infinity ? '' : ` (${(elapsed/budget*100).toFixed(0)}% of ${budget}ms)`;
  console.log(`%c${icon} [Perf] %c${label}%c ${elapsed.toFixed(2)}ms${pct}`,
    'color:' + (over ? '#f90' : '#6cf'),
    'font-weight:bold',
    'color:#888');
};

logger.perfError = (source: string, message: string, ctx: string) => {
  if (!isDevelopment) return;
  console.log(`%c❌ [${source}]%c ${message}%c | ${ctx}`,
    'color:#f44;font-weight:bold',
    'color:#fff;font-weight:bold',
    'color:#888');
};

logger.perfCheckpoint = (label: string, data: string) => {
  if (!isDevelopment) return;
  console.log(`%c◆ [CP] %c${label}%c ${data}`,
    'color:#c9f',
    'font-weight:bold',
    'color:#888');
};
```

### 7.3 Electron Sink (`electron/utils/logger.ts` — enhanced)

```typescript
// Add to existing Electron logger
logger.perf = (label: string, elapsed: number, budget: number, over: boolean) => {
  if (!shouldLog(LogLevel.DEBUG)) return;
  const icon = over ? '⚠️ OVER-BUDGET' : '[PERF]';
  const pct = budget === Infinity ? '' : ` (${(elapsed/budget*100).toFixed(0)}%)`;
  const formatted = formatMessage(over ? 'WARN' : 'INFO', 
    `${icon} ${label}: ${elapsed.toFixed(2)}ms${pct}`, 'PerfTrail');
  console.log(formatted);
  
  // Forward to renderer windows for live display
  try {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('perf-trail-update', {
          label, elapsed, budget, overBudget: over,
          aggregates: getAggregatesForLabel(label)
        });
      }
    });
  } catch { /* ignore */ }
};
```

---

## 8. Implementation Plan: Phases & Ordering

### Phase 1: Core Engine (Day 1)

**File:** `src/utils/performance/perfTrail.ts`

Build the singleton with:
- `_enabled` gate
- `_spans`, `_aggregates`, `_history` (ring buffer 200)
- `_budgets`, `_lastLogged`, `_logThrottleMs`
- `start(label)`, `end(label)`, `wrap(label, fn)`
- `_shouldLog(label, overBudget)` — throttle logic
- `enable()`, `disable()`, `budget()`, `setThrottle()`
- Auto-enable chain
- Default budgets table (23 entries from §4.3)
- Default throttle table (5 entries from §4.4)

**Deliverable:** `window.PerfTrail` exists, can `start`/`end` spans, no console flood.

### Phase 2: Output Sinks (Day 1-2)

- Enhance `src/utils/logger.ts` with `logger.perf()`, `logger.perfError()`, `logger.perfCheckpoint()`
- Enhance `electron/utils/logger.ts` with `logger.perf()`
- Wire PerfTrail `end()` → `logger.perf()`
- Wire PerfTrail `error()` → `logger.perfError()`
- Wire PerfTrail `checkpoint()` → `logger.perfCheckpoint()`
- Add IPC channel `'perf-trail-update'` for Electron → renderer forwarding

**Deliverable:** PerfTrail output appears in dev console and Electron log.

### Phase 3: FPS Monitoring (Day 2)

- Add `tick()`, `fps()`, `_frameCount`, `_frameWindowStart` to PerfTrail
- Integrate `displayRefreshRate` — use its detected Hz as the comparison baseline
- Add `onFps(callback)` subscriber system
- Wire `GlobalTimelineMinimap.tsx` RAF loop to call `tick()`
- Wire `electron/main.ts` frame rate setting to log via PerfTrail

**Deliverable:** FPS tracking shows actual frame rate vs. detected refresh rate.

### Phase 4: Error Enrichment & Checkpoints (Day 2)

- Add `error(source, message, context)` — formats `key=value` pairs, logs through both sinks
- Add `checkpoint(label, data)` — state snapshot markers
- Wire common error paths in `errorHandler.ts` to call `PerfTrail.error()`

**Deliverable:** Errors carry structured context; checkpoints mark phase transitions.

### Phase 5: Report & Dump (Day 2-3)

- Add `report()` → builds `console.table()`-ready array of aggregates
- Add `dump()` → full JSON snapshot with clipboard copy (browser) or file write (Electron)
- Add `reset()` — clear all state

**Deliverable:** Developer can call `PerfTrail.report()` to see cold stats for every instrumented span.

### Phase 6: Instrumentation — 50+ Call Sites (Day 3-5)

Following the integration map from §5, instrument every site with the guard pattern:

```typescript
// Frontend pattern:
import PerfTrail from '../utils/performance/perfTrail';
// ... at call site:
PerfTrail.start('entry-save');
try {
  await window.electronAPI.saveEntry(entry);
} finally {
  PerfTrail.end('entry-save');
}

// Electron pattern:
const { perfTrail } = require('./utils/perfTrail');
perfTrail.start('ipc-save-entry');
try {
  // ... handler logic ...
} finally {
  perfTrail.end('ipc-save-entry');
}
```

**Deliverable:** All 50+ sites instrumented with zero-cost guard.

### Phase 7: React Hooks & Dev UI (Day 4-5)

**File:** `src/hooks/usePerfTrail.ts`
- `usePerfTrail()` — provides `start`, `end`, `wrap` bound to component lifecycle
- `useFpsMonitor()` — provides live FPS value, auto-subscribes

**File:** `src/components/PerfMonitorPanel.tsx` (optional, lazy-loaded)
- Floating panel showing live FPS, active spans, recent completions
- Toggle with `` Ctrl+` `` or `?perf=1` URL param
- Reuses `GlobalTimelineMinimap` portal pattern if desired

---

## 9. Guard Pattern & Zero-Cost Design

### 9.1 The `_pt` Guard

Every call site follows:

```typescript
// Before operation:
PerfTrail.start('span-name');

// After operation:
PerfTrail.end('span-name');
```

`start()` does one check (`if (!_enabled) return`) — cost is a single boolean read.
`end()` does one check (`const span = _spans[label]; if (!span) return 0`) — cost is a hash lookup + boolean.

**Total overhead when disabled: ~3 operations per instrumented boundary.**

### 9.2 RAII-Style Wrapper (for Electron main process)

```typescript
// electron/utils/perfTrail.ts
export class ScopedSpan {
  private label: string;
  constructor(label: string) { this.label = label; PerfTrail.start(label); }
  close(): void { PerfTrail.end(this.label); }
}

// Usage:
function handleSaveEntry(event, entry) {
  const span = new ScopedSpan('ipc-save-entry');
  try {
    // ... handler logic ...
  } finally {
    span.close();
  }
}
```

### 9.3 React Hook Wrapper

```typescript
// src/hooks/usePerfTrail.ts
export function usePerfTrail() {
  const spanRef = useRef<Map<string, number>>(new Map());

  const start = useCallback((label: string) => {
    spanRef.current.set(label, performance.now());
  }, []);

  const end = useCallback((label: string): number => {
    const startTime = spanRef.current.get(label);
    if (startTime === undefined) return 0;
    spanRef.current.delete(label);
    return performance.now() - startTime;
  }, []);

  const wrap = useCallback(<T>(label: string, fn: () => T): T => {
    start(label);
    try { return fn(); }
    finally { end(label); }
  }, [start, end]);

  return { start, end, wrap };
}
```

---

## 10. Testing the Integration

### 10.1 Unit Tests (Jest)

| Test | What to Verify |
|------|----------------|
| Disabled cost | `start('test')` when `_enabled=false` → no new entries in `_spans` |
| Basic timing | `start('a')` → `end('a')` returns ms > 0 |
| Nested spans | `start('a')`, `start('b')`, `end('b')`, `end('a')` → no cross-contamination |
| Aggregation | 10 calls to `end('test')` → `report()` shows count=10, correct min/max/avg |
| History cap | 500 pushes → `_history.length ≤ 200` |
| Throttle | 1000 calls to `end('test')` in loop → logger receives ≤ 3 outputs |
| Over-budget | Set budget=1ms, end a 50ms span → ⚠️ output appears |
| Reset | `reset()` → all maps empty, FPS counter zeroed |
| FPS tick | 60 `tick()` calls in 1s → `fps()` ≈ 60 |
| Error enrichment | `error('src', 'msg', {a:1,b:2})` → output contains `a=1, b=2` |

### 10.2 Integration Tests

| Test | What to Verify |
|------|----------------|
| IPC timing | Save entry → `ipc-save-entry` span recorded on both sides |
| Calendar render | Navigate months → `calendar-render` spans appear |
| FPS in minimap | Drag minimap → `tick()` called, FPS > 0 |
| Auto-enable dev | `NODE_ENV=development` → `_enabled` is true |
| Auto-disable prod | `app.isPackaged` → `_enabled` is false |
| Preference toggle | Set `perfTrail=true` in DB → PerfTrail enables on next load |

---

## 11. File Manifest: What to Create & Modify

### New Files

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/utils/performance/perfTrail.ts` | Core PerfTrail singleton | ~400 |
| `electron/utils/perfTrail.ts` | Electron-side PerfTrail (wraps FE core + adds Electron sinks) | ~150 |
| `src/hooks/usePerfTrail.ts` | React hook for component-scoped timing | ~40 |
| `src/hooks/useFpsMonitor.ts` | React hook for live FPS display | ~40 |
| `src/utils/performance/perfTrailBudgets.ts` | Budget constants table | ~80 |

### Modified Files

| File | Change | Est. Lines |
|------|--------|------------|
| `src/utils/logger.ts` | Add `logger.perf()`, `perfError()`, `perfCheckpoint()` | +30 |
| `electron/utils/logger.ts` | Add `logger.perf()` with window forwarding | +30 |
| `src/hooks/usePerformanceOptimized.ts` | Re-export `usePerfTrail` for convenience | +2 |
| `src/App.tsx` | Add 6 instrumentation sites | +30 |
| `src/components/NavigationBar.tsx` | Add 3 instrumentation sites | +15 |
| `src/components/CalendarView.tsx` | Add 3 instrumentation sites | +15 |
| `src/components/GlobalTimelineMinimap.tsx` | Add FPS `tick()` + 3 spans | +20 |
| `src/components/BackgroundArt.tsx` | Add 2 instrumentation sites | +10 |
| `src/components/JournalEditor.tsx` | Add 2 instrumentation sites | +10 |
| `src/components/EntryViewer.tsx` | Add 1 instrumentation site | +5 |
| `src/components/Preferences.tsx` | Add 2 instrumentation sites (if component, not separate page) | +10 |
| `electron/ipc-handlers.ts` | Add 8 instrumentation sites | +40 |
| `electron/profile-manager.ts` | Add 1 instrumentation site | +5 |
| `electron/database.ts` | Add 2 instrumentation sites | +10 |
| `electron/main.ts` | Add auto-enable call | +5 |

---

## 12. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PerfTrail adds measurable overhead in production | Low | Medium | `_enabled` gate means 3 ops per site when disabled. Test with `performance.now()`. |
| Console flood from unthrottled spans | Medium | High | Default throttle of 500ms. Over-budget spans have separate 1s throttle. Test with loop before deploy. |
| IPC `perf-trail-update` channel floods renderer | Low | Medium | Only Electron `end()` sends IPC; throttle already limits to ≤2/sec per label. |
| Circular dependency with taskScheduler | Low | Low | PerfTrail imports taskScheduler for deferred report generation; taskScheduler must NOT import PerfTrail. |
| Memory leak from unbounded history | Low | Medium | Ring buffer capped at 200. `reset()` available. |
| Nested span cross-contamination | Low | High | `_spans` is a flat map keyed by label. Two concurrent spans with same label would collide. Mitigation: use unique labels or wrap with `ScopedSpan`. Document this limitation. |
| URL param `?perf=1` leaks to production users | Medium | Low | Auto-enable chain checks `app.isPackaged` (Electron) or `localhost` (browser). Production binaries run packaged, so URL params are ignored. |

---

## 13. Quick-Reference: PerfTrail → CalenRecall Mapping

| PerfTrail Concept | CalenRecall Equivalent | Status |
|-------------------|----------------------|--------|
| `performance.now()` | `performance.now()` (available in both Electron + browser) | ✅ Available |
| `console.error()` output | `logger.ts` frontend + `electron/utils/logger.ts` | ⚠️ Need to add perf methods |
| `window.debugConsole.log()` | No equivalent — skip or use Electron IPC | ❌ Not needed |
| `window.PerfTrail` export | ES module `import PerfTrail from '../utils/performance/perfTrail'` | ✅ Better |
| `localStorage` persistence | Electron `preferences` table in SQLite | ✅ Better |
| `URLSearchParams` activation | `window.location.search` (renderer) + `process.env` (Electron) | ✅ Available |
| FPS via `tick()` frame counter | `displayRefreshRate` detected Hz + new frame counter | ⚠️ Need to add |
| `navigator.clipboard` | `electron.clipboard` (main) + `navigator.clipboard` (renderer) | ✅ Available |
| Error enrichment | `errorHandler.ts` + new `PerfTrail.error()` | ⚠️ Need to wire together |
| Animation frame budget | `taskScheduler` frame budget + new PerfTrail budget | ✅ Complementary |

---

*End of integration audit. Next step: Begin Phase 1 implementation — build `src/utils/performance/perfTrail.ts` with the core engine, default budgets, and throttle system.*
