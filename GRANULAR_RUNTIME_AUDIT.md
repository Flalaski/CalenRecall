# CalenRecall — Granular Runtime Audit

**Date:** 2026-07-17  
**Type:** Full static + build + type-system audit  
**Findings:** 26 issues (3 Critical, 4 High, 4 Medium, 8 Low, 7 Info)

---

## 1. Build Health

| Check | Result |
|-------|--------|
| `vite build` (frontend) | ✅ **SUCCESS** — 465 modules transformed, all chunks written |
| `tsc --noEmit` (frontend) | ⚠️ **5 errors** — all in `JournalList.tsx` (pre-existing unclosed JSX fragment) |
| `tsc --noEmit` (Electron) | ✅ **Clean** — 0 errors |
| All 8 HTML entry points | ✅ Exist and match `vite.config.ts` |
| All `package.json` script files | ✅ Exist under `scripts/` |
| `node_modules` dependencies | ✅ All present |

---

## 2. 🔴 Critical Issues (3)

### C1. `NodeJS.Timeout` in browser-context files

**Files:** `src/App.tsx`, `src/components/NavigationBar.tsx`, `src/components/JournalEditor.tsx`, `src/hooks/usePerformanceOptimized.ts`, `src/utils/windowStateTracker.ts`

**Problem:** `NodeJS.Timeout` is a Node.js type, not available in `tsconfig.json`'s DOM-only lib (`"lib": ["ES2020", "DOM", "DOM.Iterable"]`). Only visible as an error when the file is open in VS Code (language server), but `tsc --noEmit` skips it because `skipLibCheck: true` masks the issue.

**Fix:** Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` in all 5 files (8 occurrences).

### C2. Budget constants triplicated — no shared source of truth

| File | Budgets | Source |
|------|---------|--------|
| `src/utils/performance/perfTrailBudgets.ts` | ✅ 46 budgets (canonical) | Intended shared source |
| `src/utils/performance/perfTrail.ts` | ❌ 44 budgets (inline, lines 64–118) | **Does not import from canonical** |
| `electron/utils/perfTrail.ts` | ❌ 9 budgets (inline, lines 23–41) | **Does not import from canonical** |

**Problem:** Updating a budget in `perfTrailBudgets.ts` has zero effect on the actual running code. The Electron version is missing 35+ budgets (calendar-render, minimap-render, background-art, astronomy-calc, etc.).

**Fix:** Both `PerfTrail` classes should `import { DEFAULT_BUDGETS, DEFAULT_THROTTLES } from './perfTrailBudgets'` and remove inline definitions.

### C3. `perfTrailBudgets.ts` is dead code

**Problem:** Zero imports of this file exist anywhere in the project despite being authored as a shared registry with "Imported by both the frontend and Electron PerfTrail instances" in its header comment.

---

## 3. 🟠 High Issues (4)

### H1. No CSS type declarations

**27 files** import `.css` files via `import './Foo.css'`. TypeScript can't resolve these module declarations. Will break under stricter settings.

**Fix:** Create `src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

### H2. `scripts/tsconfig.json` — broken rootDir configuration

Includes files outside its root (`../src/utils/calendars/**/*.ts`) with `outDir: "./"`. Causes:
```
File 'calendarDescriptions.ts' is not under 'rootDir'
File 'dateEntryConfig.ts' is not under 'rootDir'
File 'fontUtils.ts' is not under 'rootDir'
File 'macroCycleVerification.ts' is not under 'rootDir'
File 'timeRangeConverter.ts' is not under 'rootDir'
```

Also uses deprecated `moduleResolution: "node"` (fails in TS 7.0).

### H3. `electron/tsconfig.json` — deprecated `moduleResolution`

```
Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0.
```

**Fix:** Change to `"moduleResolution": "node16"`.

### H4. Unused variable `isRtlCalendar` in `NavigationBar.tsx`

Line 306: `const isRtlCalendar = useMemo(...)` — declared but never read. Fails `noUnusedLocals` when that file is checked.

**Fix:** Remove or use it for the Gregorian reference `dir` attribute.

---

## 4. 🟡 Medium Issues (4)

### M1. Electron `perfTrail._autoEnable()` lacks force-override support

Frontend PerfTrail checks `_forceDisable` / `_forceEnable` before auto-enable. Electron version skips this entirely — `forceEnable()`/`forceDisable()` have no effect on initial state.

### M2. `handleDateChange` stale closure over `viewMode`

`App.tsx` line 827: `viewMode` is used inside the checkpoint log but missing from the dependency array `[hasUnsavedChanges, showUnsavedChangesMessageWithTimer]`. Checkpoint will always show initial `'month'` value.

### M3. Duplicate file: `scripts/scripts/test-calendar-accuracy.js`

Nested duplicate alongside the valid `scripts/test-calendar-accuracy.js`. Likely a build artifact.

### M4. Dead ternary in `electron/utils/perfTrail.ts` line 30

```ts
new Map(DEFAULT_BUDGETS ? Object.entries(DEFAULT_BUDGETS) : []);
```
`DEFAULT_BUDGETS` is a hardcoded const — always truthy. The `: []` branch is dead code.

---

## 5. 🟢 Low Issues (8)

| # | Issue | Location |
|---|-------|----------|
| L1 | `require('electron')` (CJS) mixed with ESM-style imports | `electron/utils/perfTrail.ts:153` |
| L2 | No `.env.example` for documented environment variables | Project root |
| L3 | `scripts/tsconfig.json` has `strict: false` | `scripts/tsconfig.json` |
| L4 | Zero test files for all 6 performance modules | `src/utils/performance/*` |
| L5 | `INDICATOR_MOVEMENT_DELAY = 0` hardcoded but unused | `src/App.tsx:810` |
| L6 | `_checkPersistentPreference()` is async but called without `await` | `src/utils/performance/perfTrail.ts:656` |
| L7 | Version string `2026.01.14-5` may cause semver parsing issues | `package.json` |
| L8 | `setupTests.ts` has incomplete `electronAPI` mock | `src/setupTests.ts` |

---

## 6. ℹ️ Info (7)

| # | Item |
|---|------|
| I1 | `performance.now()` used in Electron — `process.hrtime.bigint()` offers ns precision |
| I2 | Test coverage thresholds all at 0% in `jest.config.js` |
| I3 | `better-sqlite3` requires `electron-rebuild` — silent failure risk |
| I4 | Calendar scripts `test-calendar-accuracy.ts` runs outside Jest as `ts-node` |
| I5 | 2 test files exist: `ErrorBoundary.test.tsx`, `errorHandler.test.ts` |
| I6 | `src/utils/performance/taskScheduler.ts` imports `displayRefreshRate` — no circular deps |
| I7 | `src/utils/performance/virtualRenderer.ts` creates an IntersectionObserver but never calls `observer.observe()` |

---

## 7. Quick-Fix Actions (Priority Order)

```
1.  [C2] Import perfTrailBudgets in both PerfTrail classes           (~15 min)
2.  [C1] Replace NodeJS.Timeout with ReturnType<typeof setTimeout>    (~5 min)
3.  [H1] Create src/vite-env.d.ts with Vite client types              (~1 min)
4.  [H4] Use isRtlCalendar or remove it                               (~2 min)
5.  [H2] Fix scripts/tsconfig.json rootDir                            (~5 min)
6.  [H3] Fix electron/tsconfig.json moduleResolution                  (~1 min)
7.  [M3] Remove scripts/scripts/ duplicate                            (~1 min)
8.  [M2] Add viewMode to handleDateChange deps                        (~1 min)
9.  [C3] Wire perfTrailBudgets into both consumers                    (~5 min)
10. [M1] Add force-override to Electron autoEnable                    (~5 min)
```

**Total estimated fix time:** ~40 minutes
