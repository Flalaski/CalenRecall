# CalenRecall — Master Issues & Fixes

**Generated:** 2026-07-17  
**Purpose:** Complete inventory of every known issue with fix instructions and status.

---

## 🔴 C2/C3: Budget Triplication — perfTrailBudgets.ts Unused

**Problem:** `src/utils/performance/perfTrailBudgets.ts` exists as a canonical constants file but NEITHER consumer imports it. Budget changes have zero effect.

**Files to modify:**
- `src/utils/performance/perfTrail.ts` — replace inline `DEFAULT_BUDGETS` + `DEFAULT_THROTTLE` with imports
- `electron/utils/perfTrail.ts` — replace inline `DEFAULT_BUDGETS` with import from canonical (via relative path)

**Fix:** Import `DEFAULT_BUDGETS` and `DEFAULT_THROTTLES` from `./perfTrailBudgets`, remove duplicate inline definitions.

---

## 🟠 H2: scripts/tsconfig.json — Broken rootDir

**Problem:** Includes files outside root (`../src/utils/calendars/**/*.ts`) with `outDir: "./"`, causing rootDir errors. Uses deprecated `moduleResolution: "node"` and `baseUrl`.

**Files to modify:**
- `scripts/tsconfig.json`

**Fix:** Change `moduleResolution` to `"node16"`, remove deprecated `baseUrl`, set explicit `rootDir: ".."`.

---

## 🟠 H3: electron/tsconfig.json — Deprecated moduleResolution

**Problem:** `moduleResolution: "node"` deprecated in TS 7.0.

**Files to modify:**
- `electron/tsconfig.json`

**Fix:** Change `"moduleResolution": "node"` to `"moduleResolution": "node16"`.

---

## 🟡 M1: Electron forceEnable/forceDisable ignored

**Problem:** `electron/utils/perfTrail.ts` `_autoEnable()` checks `process.env` and `app.isPackaged` directly without checking `_forceDisable`/`_forceEnable` flags first.

**Files to modify:**
- `electron/utils/perfTrail.ts`

**Fix:** Add force-override checks at the top of `_autoEnable()` matching the frontend pattern.

---

## 🟡 M2: handleDateChange stale viewMode — FIXED ✅

**Status:** Fixed in previous session with `viewModeRef`.

---

## 🟡 M4: Dead ternary in electron/perfTrail.ts

**Problem:** Line 30: `new Map(DEFAULT_BUDGETS ? Object.entries(DEFAULT_BUDGETS) : [])` — `DEFAULT_BUDGETS` is a const, always truthy.

**Files to modify:**
- `electron/utils/perfTrail.ts`

**Fix:** Simplify to `new Map(Object.entries(DEFAULT_BUDGETS))`.

---

## 🟢 L3: scripts/tsconfig.json strict: false

**Problem:** Disables all strict type checking for calendar test scripts.

**Files to modify:**
- `scripts/tsconfig.json`

**Fix:** Change `"strict": false` to `"strict": true`.

---

## 🟢 L5: INDICATOR_MOVEMENT_DELAY unused

**Problem:** `const INDICATOR_MOVEMENT_DELAY = 0` in App.tsx is set but never referenced.

**Files to modify:**
- `src/App.tsx`

**Fix:** Remove the dead variable.

---

## 🟢 L7: Version string may cause semver issues

**Problem:** `"2026.01.14-5"` — dates in version strings can confuse semver parsers.

**Files to modify:**
- `package.json`

**Fix:** Change to standard semver like `"2026.1.14-beta.5"` (low priority — cosmetic).

---

## 🟢 L8: Incomplete electronAPI mock in setupTests.ts

**Problem:** `src/setupTests.ts` mocks `window.electronAPI` but many methods used in production aren't mocked.

**Files to modify:**
- `src/setupTests.ts`

**Fix:** Add mock stubs for all methods referenced in tests.

---

## ℹ️ I6: virtualRenderer observer.observe() never called

**Problem:** `src/utils/performance/virtualRenderer.ts` creates an IntersectionObserver but never calls `observer.observe()` on any element.

**Files to modify:**
- `src/utils/performance/virtualRenderer.ts`

**Fix:** Add TODO or implement observation (low priority — scroll-based fallback works).

---

## Summary

| Priority | Count | Est. Time |
|----------|-------|-----------|
| 🔴 Critical | 1 (C2/C3) | 15 min |
| 🟠 High | 2 (H2, H3) | 5 min |
| 🟡 Medium | 2 (M1, M4) | 5 min |
| 🟢 Low | 4 (L3, L5, L7, L8) | 10 min |
| ℹ️ Info | 1 (I6) | 2 min |
| **Total** | **10** | **~37 min** |

---

*Fix order: C → H → M → L per priority. Each fix verified with tsc --noEmit.*
