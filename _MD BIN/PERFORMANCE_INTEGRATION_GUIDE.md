# Performance Integration Guide
## Manual Integration Steps for GlobalTimelineMinimap

**Status:** Core utilities created ✅ | Integration in progress

---

## ✅ Completed

1. ✅ **Task Scheduler** - `src/utils/performance/taskScheduler.ts`
2. ✅ **Style Batcher** - `src/utils/performance/styleBatcher.ts`
3. ✅ **Animation Manager** - `src/utils/performance/animationManager.ts`
4. ✅ **Virtual Renderer** - `src/utils/performance/virtualRenderer.ts`
5. ✅ **React Hooks** - `src/hooks/usePerformanceOptimized.ts`
6. ✅ **CSS Optimizations** - Added containment and compositor optimizations

---

## 🔧 Manual Integration Steps

### Step 1: Add Imports to GlobalTimelineMinimap.tsx

**Location:** After line 12 (after `jdnToDate` import)

```typescript
import { useTaskScheduler, useStyleBatcher, useThrottledCallback } from '../hooks/usePerformanceOptimized';
```

### Step 2: Add Performance Hooks

**Location:** After line 348 (after `lastDragLimitsRef`)

```typescript
// HIGH-PERFORMANCE: Performance optimization hooks
const { schedule } = useTaskScheduler();
const { queueStyle } = useStyleBatcher();
```

### Step 3: Find Entry Rendering Logic

**Search for:** Where entries are being rendered/mapped

**Example pattern to find:**
```typescript
// Look for patterns like:
{timelineData.entries?.map((entry, index) => (
  // entry rendering
))}
```

**Replace with task-scheduled rendering:**
```typescript
// Wrap entry processing in task scheduler
{timelineData.entries?.map((entry, index) => {
  schedule(() => {
    // Existing entry rendering logic
  }, 'normal');
  return null; // Or return the rendered element
})}
```

### Step 4: Find Style Updates

**Search for:** Direct style assignments like:
```typescript
element.style.transform = ...
element.style.opacity = ...
```

**Replace with style batcher:**
```typescript
queueStyle(element, {
  transform: 'translateX(100px)',
  opacity: 0.5
}, 'normal');
```

### Step 5: Find Animation Triggers

**Search for:** CSS class additions that trigger animations, or direct animation starts

**Replace with animation manager:**
```typescript
import { useAnimationManager } from '../hooks/usePerformanceOptimized';

// In component:
const { animate } = useAnimationManager();

// When animating:
animate({
  element: targetElement,
  property: 'transform',
  from: 'translateX(0)',
  to: 'translateX(100px)',
  duration: 300,
  easing: 'ease-out'
});
```

### Step 6: Throttle Event Handlers

**Search for:** Event handlers that fire frequently (scroll, mousemove, drag)

**Example:**
```typescript
// BEFORE
const handleMouseMove = (e: MouseEvent) => {
  // Heavy work
};

// AFTER
const handleMouseMove = useThrottledCallback((e: MouseEvent) => {
  // Heavy work
}, 60); // 60fps
```

### Step 7: Chunk Large Operations

**Search for:** Loops processing many items

**Example:**
```typescript
// BEFORE
entries.forEach(entry => {
  processEntry(entry); // Blocks main thread
});

// AFTER
let index = 0;
const BATCH_SIZE = 50;

function processBatch() {
  const end = Math.min(index + BATCH_SIZE, entries.length);
  for (let i = index; i < end; i++) {
    schedule(() => processEntry(entries[i]), 'normal');
  }
  index = end;
  if (index < entries.length) {
    requestAnimationFrame(processBatch);
  }
}
processBatch();
```

---

## Key Integration Points

### 1. Entry Indicator Rendering
**Location:** Look for where entry indicators are created/updated
**Action:** Wrap in `schedule()` calls, use `queueStyle()` for position updates

### 2. Drag Handlers
**Location:** Mouse move/drag event handlers
**Action:** Use `useThrottledCallback` to limit to 60fps

### 3. Timeline Updates
**Location:** Where timeline position/entries are recalculated
**Action:** Use task scheduler to break into chunks

### 4. Animation Triggers
**Location:** Where animations start (mechanical click, transitions)
**Action:** Use animation manager for compositor-optimized animations

---

## Testing Checklist

After integration:

- [ ] No console errors
- [ ] Entries still render correctly
- [ ] Drag interactions still work
- [ ] Animations still play
- [ ] Performance improved (check DevTools)
- [ ] Frame rate stable at 60fps
- [ ] No tasks > 50ms

---

## Performance Monitoring

Add this to component for development:

```typescript
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('Long task detected:', entry.name, entry.duration);
        }
      }
    });
    observer.observe({ entryTypes: ['measure', 'longtask'] });
    return () => observer.disconnect();
  }
}, []);
```

---

## Expected Results

After full integration:
- ✅ Tasks < 50ms
- ✅ 60 FPS consistently
- ✅ Smooth drag interactions
- ✅ Reduced composite failures
- ✅ Lower memory usage
- ✅ Better responsiveness

---

## Files Modified

1. ✅ `src/utils/performance/taskScheduler.ts` - Created
2. ✅ `src/utils/performance/styleBatcher.ts` - Created
3. ✅ `src/utils/performance/animationManager.ts` - Created
4. ✅ `src/utils/performance/virtualRenderer.ts` - Created
5. ✅ `src/hooks/usePerformanceOptimized.ts` - Created
6. ✅ `src/components/GlobalTimelineMinimap.css` - Updated with containment
7. ⏳ `src/components/GlobalTimelineMinimap.tsx` - Needs manual integration

---

**Next Steps:**
1. Add imports (Step 1)
2. Add hooks (Step 2)
3. Find and replace entry rendering (Step 3)
4. Find and replace style updates (Step 4)
5. Find and replace animations (Step 5)
6. Throttle event handlers (Step 6)
7. Chunk large operations (Step 7)
8. Test and verify improvements

