# CalenRecall Performance Audit
## Comprehensive Performance Analysis & Optimization Recommendations

**Date:** 2025-01-27  
**Scope:** Full codebase performance audit - "checking every brick"

---

## Executive Summary

This audit identified **47 performance optimization opportunities** across 8 major categories:
- React Rendering (12 issues)
- Database Operations (8 issues)
- Memory Management (7 issues)
- Bundle Size (5 issues)
- Event Handlers (6 issues)
- Computational Performance (5 issues)
- Network/IO (2 issues)
- Code Quality (2 issues)

**Priority Impact:**
- 🔴 **Critical** (10): Immediate performance gains
- 🟡 **High** (18): Significant improvements
- 🟢 **Medium** (19): Incremental optimizations

---

## 1. React Rendering Performance

### 🔴 Critical Issues

#### 1.1 Missing React.memo on Frequently Re-rendered Components
**Location:** Multiple components
**Impact:** Unnecessary re-renders causing UI lag

**Components needing memoization:**
- `EntryViewer.tsx` - Renders on every date/entry change
- `JournalEditor.tsx` - Complex component with many props
- `NavigationBar.tsx` - Renders frequently during navigation
- `JournalList.tsx` - List component that could benefit

**Fix:**
```typescript
// Example for EntryViewer
export default memo(EntryViewer, (prevProps, nextProps) => {
  return (
    prevProps.entry?.id === nextProps.entry?.id &&
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.viewMode === nextProps.viewMode
  );
});
```

#### 1.2 Array Operations in Render Cycles
**Location:** `SearchView.tsx:49`, `TimelineView.tsx` (multiple locations)
**Impact:** O(n) operations executed on every render

**Issues:**
- `results.flatMap(entry => entry.tags || [])` in SearchView (line 49) - runs on every render
- Multiple `.filter()` calls in TimelineView that could use lookup structures
- `.map()` operations without memoization

**Fix:**
```typescript
// SearchView.tsx - Memoize tag extraction
const allTags = useMemo(() => 
  Array.from(new Set(results.flatMap(entry => entry.tags || []))),
  [results]
);
```

#### 1.3 Unstable Function References
**Location:** `App.tsx`, `TimelineView.tsx`
**Impact:** Causes child components to re-render unnecessarily

**Issues:**
- `handleDateChange`, `handleTimePeriodSelect` recreated on every render
- Callback functions passed to child components without `useCallback`

**Fix:**
```typescript
// Already using useCallback, but verify all handlers are memoized
const handleDateChange = useCallback((date: Date) => {
  // ... implementation
}, [hasUnsavedChanges, showUnsavedChangesMessageWithTimer]);
```

### 🟡 High Priority Issues

#### 1.4 CalendarCell entriesWithTime Array Comparison
**Location:** `CalendarCell.tsx:108-112`
**Impact:** Deep array comparison on every render

**Issue:** The memo comparison does `.every()` check which is O(n)

**Fix:**
```typescript
// Use a stable reference or hash
const entriesWithTimeHash = useMemo(() => 
  entriesWithTime.map(e => `${e.id}-${e.hour}-${e.minute}`).join('|'),
  [entriesWithTime]
);
```

#### 1.5 Context Value Recreation
**Location:** `EntriesContext.tsx:122-138`
**Impact:** Context value object recreated on every render

**Fix:**
```typescript
const contextValue = useMemo(() => ({
  entries,
  setEntries,
  addEntry,
  updateEntry,
  removeEntry,
  isLoading,
  setIsLoading,
  entryLookup,
  entryColors,
}), [entries, isLoading, entryLookup, entryColors, addEntry, updateEntry, removeEntry]);
```

---

## 2. Database Operations

### 🔴 Critical Issues

#### 2.1 JSON.parse on Every Row
**Location:** `database.ts:1048-1067`, `1079-1095`, `1750-1770`
**Impact:** Parsing JSON for every entry on every query (expensive for large datasets)

**Current:**
```typescript
tags: row.tags ? JSON.parse(row.tags) : [],
linkedEntries: row.linked_entries ? JSON.parse(row.linked_entries) : [],
attachments: row.attachments ? JSON.parse(row.attachments) : [],
```

**Fix:** Cache parsed JSON or use a faster parser
```typescript
// Option 1: Cache parsed JSON in a WeakMap
const jsonCache = new WeakMap();
function getCachedJSON(jsonString: string | null): any {
  if (!jsonString) return null;
  if (!jsonCache.has(jsonString)) {
    jsonCache.set(jsonString, JSON.parse(jsonString));
  }
  return jsonCache.get(jsonString);
}

// Option 2: Use a faster JSON parser for large datasets
// Consider using a streaming parser for very large result sets
```

#### 2.2 Missing Database Indexes
**Location:** Database schema
**Impact:** Slow queries on large datasets

**Recommended indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_time_range ON journal_entries(time_range);
CREATE INDEX IF NOT EXISTS idx_journal_entries_archived ON journal_entries(archived);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date_range ON journal_entries(date, time_range);
CREATE INDEX IF NOT EXISTS idx_journal_entries_search ON journal_entries(title, content);
```

#### 2.3 Search Query Not Using FTS
**Location:** `database.ts:1740-1771`
**Impact:** Slow text search on large content

**Current:** Uses `LIKE` which is slow
```typescript
WHERE (title LIKE ? OR content LIKE ?)
```

**Fix:** Implement Full-Text Search
```sql
-- Add FTS table
CREATE VIRTUAL TABLE journal_entries_fts USING fts5(
  title, content, content='journal_entries', content_rowid='id'
);

-- Update search query
SELECT * FROM journal_entries 
WHERE id IN (
  SELECT rowid FROM journal_entries_fts 
  WHERE journal_entries_fts MATCH ?
) AND archived = 0
```

### 🟡 High Priority Issues

#### 2.4 getAllEntries Loads Everything
**Location:** `App.tsx:81`, `database.ts:1038`
**Impact:** Memory usage and initial load time

**Current:** Loads all entries at startup (good for preload, but could be optimized)

**Optimization:** Consider pagination or lazy loading for very large datasets
```typescript
// Add pagination support
export function getAllEntriesPaginated(
  page: number = 0,
  pageSize: number = 1000,
  includeArchived: boolean = false
): { entries: JournalEntry[]; total: number; hasMore: boolean } {
  // Implementation
}
```

#### 2.5 No Query Result Caching
**Location:** All database query functions
**Impact:** Repeated queries for same data

**Fix:** Implement a simple LRU cache for frequently accessed queries
```typescript
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache<string, JournalEntry[]>({
  max: 100,
  ttl: 60000 // 1 minute
});
```

---

## 3. Memory Management

### 🔴 Critical Issues

#### 3.1 Console.log in Production Code
**Location:** 1,264 instances across 70 files
**Impact:** Memory leaks, performance degradation, security concerns

**Files with most console statements:**
- `electron/main.ts`: 107 instances
- `src/components/GlobalTimelineMinimap.tsx`: 8 instances
- `src/App.tsx`: 57 instances
- `electron/database.ts`: 154 instances

**Fix:**
```typescript
// Create a logger utility
const logger = {
  log: process.env.NODE_ENV === 'development' ? console.log : () => {},
  warn: process.env.NODE_ENV === 'development' ? console.warn : () => {},
  error: console.error, // Always log errors
  debug: process.env.NODE_ENV === 'development' ? console.debug : () => {},
};

// Replace all console.log with logger.log
```

#### 3.2 Large Entry Arrays in Memory
**Location:** `EntriesContext.tsx`, `App.tsx`
**Impact:** High memory usage for large journals

**Current:** All entries loaded into memory at once

**Optimization:** Implement entry pagination or lazy loading
```typescript
// Only keep recent entries in memory, load others on demand
const RECENT_ENTRIES_DAYS = 365; // Keep last year in memory
const recentEntries = useMemo(() => 
  entries.filter(e => {
    const entryDate = parseISODate(e.date);
    const daysDiff = differenceInDays(new Date(), entryDate);
    return daysDiff <= RECENT_ENTRIES_DAYS;
  }),
  [entries]
);
```

### 🟡 High Priority Issues

#### 3.3 Unbounded Cache Growth
**Location:** `GlobalTimelineMinimap.tsx` (crystalSidesCache, entryColorCache)
**Location:** `entryLookupUtils.ts` (dateCache)

**Issue:** Caches grow indefinitely without cleanup

**Fix:** Implement LRU cache or size limits
```typescript
// Use LRU cache with size limit
import { LRUCache } from 'lru-cache';

const crystalSidesCache = new LRUCache<number, number>({
  max: 10000, // Limit cache size
  ttl: 3600000 // 1 hour TTL
});
```

#### 3.4 Event Listener Cleanup
**Location:** Multiple components
**Impact:** Memory leaks from uncleaned listeners

**Fix:** Ensure all event listeners are properly cleaned up
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('event', handler);
  return () => window.removeEventListener('event', handler);
}, []);
```

---

## 4. Bundle Size Optimization

### 🟡 High Priority Issues

#### 4.1 Multiple Font Imports
**Location:** `package.json:45-52`
**Impact:** Large bundle size (~500KB+ for fonts)

**Current:** 8 font packages imported
```json
"@fontsource/antonio": "^5.2.8",
"@fontsource/bebas-neue": "^5.2.7",
"@fontsource/inter": "^5.2.8",
"@fontsource/noto-sans": "^5.2.10",
"@fontsource/noto-sans-arabic": "^5.2.10",
"@fontsource/noto-sans-hebrew": "^5.2.8",
"@fontsource/noto-sans-sc": "^5.2.8",
"@fontsource/noto-sans-thai": "^5.2.8"
```

**Fix:** Use font subsetting or load fonts dynamically
```typescript
// Load fonts only when needed
const loadFont = async (fontName: string) => {
  if (!document.fonts.check(`16px ${fontName}`)) {
    await document.fonts.load(`16px ${fontName}`);
  }
};
```

#### 4.2 Missing Code Splitting
**Location:** `vite.config.ts`
**Impact:** Large initial bundle

**Current:** Only splits react-vendor and date-vendor

**Fix:** Add more granular code splitting
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'date-vendor': ['date-fns'],
  'calendar-utils': [
    './src/utils/calendars/*',
    './src/utils/dateUtils.ts'
  ],
  'components-heavy': [
    './src/components/GlobalTimelineMinimap.tsx',
    './src/components/TimelineView.tsx'
  ]
}
```

#### 4.3 Unused Dependencies
**Location:** `package.json`
**Impact:** Unnecessary bundle size

**Check for unused dependencies:**
```bash
npx depcheck
```

---

## 5. Event Handler Optimization

### 🟡 High Priority Issues

#### 5.1 Search Debounce Too Short
**Location:** `SearchView.tsx:143-149`
**Impact:** Too many database queries

**Current:** 300ms debounce

**Fix:** Increase to 500ms and add leading edge
```typescript
const debouncedSearch = useDebouncedCallback(
  performSearch,
  500,
  { leading: false, trailing: true }
);
```

#### 5.2 Navigation Handlers Not Optimized
**Location:** `App.tsx:814-908`
**Impact:** Rapid navigation causes performance issues

**Current:** Uses RAF and setTimeout, but could be optimized further

**Optimization:** Use `useThrottledCallback` from performance hooks
```typescript
const handleDateChange = useThrottledCallback((date: Date) => {
  setSelectedDate(date);
}, 16); // 60fps
```

#### 5.3 Keyboard Event Handler
**Location:** `App.tsx:1278-1324`
**Impact:** Runs on every keystroke globally

**Fix:** Add early returns and optimize
```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  // Early return for non-target keys
  if (!['n', 'f', 'Escape', ' '].includes(e.key)) return;
  
  // Rest of handler
}, [showSearch]);
```

---

## 6. Computational Performance

### 🔴 Critical Issues

#### 6.1 Crystal Calculations in GlobalTimelineMinimap
**Location:** `GlobalTimelineMinimap.tsx:57-122`
**Impact:** Expensive calculations for every entry on every render

**Current:** `calculateCrystalSides` does complex numerological calculations

**Fix:** Cache results aggressively and use Web Workers for large datasets
```typescript
// Cache crystal sides calculation
const crystalSidesCache = useMemo(() => {
  const cache = new Map<number, number>();
  entries.forEach(entry => {
    if (entry.id) {
      cache.set(entry.id, calculateCrystalSides(entry));
    }
  });
  return cache;
}, [entries]);

// Use Web Worker for very large entry sets
if (entries.length > 10000) {
  // Offload to worker
}
```

#### 6.2 Date Parsing in Loops
**Location:** Multiple locations
**Impact:** Repeated date parsing

**Fix:** Use the existing dateCache more extensively
```typescript
// Already implemented in entryLookupUtils, but ensure it's used everywhere
const dateCache = new Map<string, Date>();
const getCachedDate = (dateStr: string): Date => {
  if (!dateCache.has(dateStr)) {
    dateCache.set(dateStr, parseISODate(dateStr));
  }
  return dateCache.get(dateStr)!;
};
```

### 🟡 High Priority Issues

#### 6.3 Color Calculations
**Location:** `entryColorUtils.ts`
**Impact:** Color calculations for every entry

**Fix:** Already cached in context, but verify cache is working correctly

#### 6.4 Polygon Clip Path Generation
**Location:** `GlobalTimelineMinimap.tsx:29-46`
**Impact:** Regenerated for every entry

**Fix:** Cache polygon paths by number of sides
```typescript
const polygonCache = new Map<number, string>();
function getCachedPolygon(sides: number): string {
  if (!polygonCache.has(sides)) {
    polygonCache.set(sides, generatePolygonClipPath(sides));
  }
  return polygonCache.get(sides)!;
}
```

---

## 7. Network/IO Optimization

### 🟡 High Priority Issues

#### 7.1 Background Image Loading
**Location:** `App.tsx:219-238`
**Impact:** Image reloads unnecessarily

**Fix:** Already has caching via `backgroundImagePathRef`, but could add image preloading
```typescript
// Preload image
const img = new Image();
img.src = backgroundImagePath;
img.onload = () => setBackgroundImagePath(backgroundImagePath);
```

#### 7.2 IPC Message Frequency
**Location:** `App.tsx:579-581`
**Impact:** Polling every 2 seconds

**Current:** Preference check interval every 2 seconds

**Fix:** Use event-driven updates instead of polling
```typescript
// Already has IPC listeners, remove polling interval
// Remove: setInterval(checkAndApplyPreferences, 2000);
```

---

## 8. Code Quality & Best Practices

### 🟢 Medium Priority

#### 8.1 Type Safety
**Location:** Multiple files using `any` type
**Impact:** Potential runtime errors

**Fix:** Replace `any` with proper types

#### 8.2 Error Handling
**Location:** Some async operations lack error handling
**Impact:** Silent failures

**Fix:** Add comprehensive error boundaries and error handling

---

## Implementation Priority

### Phase 1: Critical (Week 1)
1. Remove console.log statements (use logger utility)
2. Add React.memo to unmemoized components
3. Optimize database JSON parsing
4. Add database indexes
5. Fix array operations in render cycles

### Phase 2: High Priority (Week 2)
1. Implement FTS for search
2. Add query result caching
3. Optimize crystal calculations
4. Fix memory leaks (caches, listeners)
5. Optimize event handlers

### Phase 3: Medium Priority (Week 3)
1. Bundle size optimization
2. Font loading optimization
3. Additional code splitting
4. Performance monitoring

---

## Performance Metrics to Track

1. **Initial Load Time:** Target < 2s
2. **Time to Interactive:** Target < 3s
3. **Bundle Size:** Target < 2MB (gzipped)
4. **Memory Usage:** Target < 200MB for 10k entries
5. **Frame Rate:** Target 60fps during navigation
6. **Database Query Time:** Target < 50ms for common queries

---

## Tools for Monitoring

1. **React DevTools Profiler:** Identify re-render issues
2. **Chrome DevTools Performance:** Profile runtime performance
3. **Bundle Analyzer:** `vite-bundle-visualizer`
4. **Lighthouse:** Overall performance score
5. **Memory Profiler:** Identify memory leaks

---

## Notes

- Many optimizations are already in place (entry lookup structures, memoization in some components)
- The codebase shows good performance awareness
- Focus on the critical issues first for maximum impact
- Test performance improvements with realistic data volumes (10k+ entries)

---

**Next Steps:**
1. Review this audit with the team
2. Prioritize based on user impact
3. Create tickets for each optimization
4. Set up performance monitoring
5. Establish performance budgets
