# CalenRecall — Master Fix Plan

**Generated:** 2026-07-17  
**Scope:** All remaining issues from codebase audit, theme audit, and calendar time-tier audit.  
**Order:** Critical → High → Medium → Low per priority.

---

## Phase 1: Calendar Metadata & Encodings (Trivial — 5 min)

### 1.1 Fix Mayan Haab' metadata `months: 18` → `19`
**File:** `src/utils/calendars/types.ts`  
**Change:** `'mayan-haab'.months` from `18` to `19` (code uses 1–19, Wayeb' is month 19)

### 1.2 Fix Aztec Xiuhpohualli metadata `months: 18` → `19`
**File:** `src/utils/calendars/types.ts`  
**Change:** `'aztec-xiuhpohualli'.months` from `18` to `19` (Nemontemi is month 19)

### 1.3 Fix Cherokee `type: 'lunisolar'` → `'solar'`
**File:** `src/utils/calendars/types.ts`  
**Change:** `cherokee.type` from `'lunisolar'` to `'solar'` (implementation delegates to Gregorian)

### 1.4 Fix Baháʼí Ayyám-i-Há / 'Alá' month collision
**File:** `src/utils/calendars/bahai.ts`  
**Problem:** Both Ayyám-i-Há (intercalary days 1-4/5) and 'Alá' (days 1-19) use `month=19`. Ambiguous.
**Fix:** Use `month=0` for Ayyám-i-Há (intercalary), `month=19` for 'Alá'. Update `toJDN()` and `fromJDN()`.
**Impact:** Also update `dateFormatter.ts` MONTH_NAMES entry for bahai to include 'Ayyám-i-Há' at index 0 (or prepend).

---

## Phase 2: Small Code Cleanups (Quick — 10 min)

### 2.1 Dead ternary in `electron/utils/perfTrail.ts`
**File:** `electron/utils/perfTrail.ts`  
**Line:** `new Map(DEFAULT_BUDGETS ? Object.entries(DEFAULT_BUDGETS) : [])`  
**Fix:** Remove dead `: []` branch — `DEFAULT_BUDGETS` is a const, always truthy.

### 2.2 Unused `isRtlCalendar` in NavigationBar
**File:** `src/components/NavigationBar.tsx`  
**Problem:** `isRtlCalendar` computed but never used.  
**Fix:** Remove the variable or use it for Gregorian reference `dir` attribute.

### 2.3 Incomplete `electronAPI` mock in `setupTests.ts`
**File:** `src/setupTests.ts`  
**Problem:** Many methods used in production are not mocked.  
**Fix:** Add stubs for all methods that tests might need.

### 2.4 Version string semver issue
**File:** `package.json`  
**Fix:** Change `"2026.01.14-5"` to `"2026.1.14-beta.5"` for proper semver parsing.

---

## Phase 3: Calendar Time Tier Rendering (Large — 2-3 hrs)

### 3.1 Fix `getMonthsInYear()` to be calendar-aware
**File:** `src/utils/dateUtils.ts`  
**Problem:** Hardcoded 12 months — ignores Hebrew 13-month leap years, Ethiopian/Coptic 13 months, Baháʼí 19 months, Iroquois 13 moons, Mayan Haab' 18+Wayeb', Aztec 18+Nemontemi.  
**Fix:** Accept optional `calendar` parameter. Use `CALENDAR_INFO[calendar].months` to determine count. Generate dates using calendar-specific JDN conversions rather than `createDate(year, i, 1)`.

### 3.2 Fix `navigateInCalendar()` for non-Gregorian calendars
**File:** `src/utils/calendars/timeRangeConverter.ts`  
**Problem:** Uses Gregorian `addMonths`/`addYears` for ALL calendars.  
**Fix:** For month/year navigation in non-Gregorian calendars, convert to CalendarDate, advance the month/year field according to the target calendar's structure, convert back.

### 3.3 Fix `getDaysInMonth()` calendar awareness
**File:** `src/utils/dateUtils.ts`  
**Problem:** Always returns Gregorian month days using `getMonthStart`/`getMonthEnd`.  
**Fix:** Accept optional `calendar` parameter. For calendars with different month structures (Baháʼí 19-day months, Mayan Haab' 20-day months), generate days via JDN conversions.

### 3.4 Fix `CalendarView.tsx` hardcoded month names and grid
**File:** `src/components/CalendarView.tsx`  
**Problem:** Year view hardcodes `['Jan','Feb',...'Dec']` and always renders 12 cells. Month grid always Gregorian.  
**Fix:** Use `MONTH_NAMES_SHORT[calendar]` for labels. Use calendar-aware `getMonthsInYear` for cell count.

### 3.5 Fix `getTimeRangeBoundsInCalendar()` for structural mismatch
**File:** `src/utils/calendars/timeRangeConverter.ts`  
**Problem:** Computes Gregorian bounds then converts — the bounds themselves are wrong for non-Gregorian calendars.  
**Fix:** For calendars with different month counts, compute bounds directly in the target calendar's terms using JDN ranges.

---

## Execution Order

```
Phase 1 (metadata)  →  Phase 2 (quick cleanups)  →  Phase 3 (calendar tiers)
   5 min                   10 min                       2-3 hrs
```

Each phase verified with `npx vite build` and `npx tsc --noEmit -p electron` before proceeding.
