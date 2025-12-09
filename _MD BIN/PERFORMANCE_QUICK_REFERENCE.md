# Performance Optimization Quick Reference
## High-Quality Performance Patterns for Fluid, Low-Latency Operation

**Goal:** 60 FPS, <50ms tasks, fluid interactions, minimal latency

---

## Core Principles

### 1. Frame Budgeting
- **Never exceed 16ms per frame**
- Use `requestAnimationFrame` for visual updates
- Use `requestIdleCallback` for non-critical work
- Monitor frame time with `PerformanceObserver`

### 2. Task Chunking
- Break long operations into <50ms chunks
- Yield to browser between chunks
- Use adaptive scheduling based on frame time
- Prioritize critical tasks

### 3. Virtual Rendering
- Only render visible items
- Use `IntersectionObserver` for visibility detection
- Implement overscan for smooth scrolling
- Zero-copy operations where possible

### 4. Style Batching
- Batch style updates with `requestAnimationFrame`
- Use CSS custom properties for compositor-friendly updates
- Minimize reflows and repaints
- Apply styles in priority order

### 5. Compositor Optimization
- **Only animate:** `transform`, `opacity`
- **Never animate:** `width`, `height`, `top`, `left`, `margin`, `padding`
- Use `will-change` only when animating
- Remove `will-change` after animation completes

### 6. Memory Efficiency
- Reuse objects and arrays
- Clear caches when not needed
- Use object pools for frequently created objects
- Avoid closures in hot paths

### 7. Event Handling
- Use passive event listeners for scroll/touch
- Debounce/throttle with `requestAnimationFrame`
- Remove event listeners on cleanup
- Batch event processing

---

## Performance APIs

### TaskScheduler
```typescript
import { globalTaskScheduler } from '../utils/performance/taskScheduler';

// Schedule task with priority
const taskId = globalTaskScheduler.schedule(
  () => { /* work */ },
  'high', // 'critical' | 'high' | 'normal' | 'low'
  deadline // optional
);

// Cancel if needed
globalTaskScheduler.cancel(taskId);
```

### VirtualRenderer
```typescript
import VirtualRenderer from '../utils/performance/virtualRenderer';

const renderer = new VirtualRenderer({
  itemHeight: 20,
  overscan: 10,
  container: containerElement,
  onVisibleChange: (visible) => {
    // Render visible items
  }
});

renderer.setItems(entries);
const visible = renderer.getVisibleItems();
```

### StyleBatcher
```typescript
import { globalStyleBatcher } from '../utils/performance/styleBatcher';

// Queue style update (batched automatically)
globalStyleBatcher.queue(
  element,
  { transform: 'translateX(100px)', opacity: 0.5 },
  'normal' // or 'critical'
);

// Flush immediately if needed
globalStyleBatcher.flush();
```

### AnimationManager
```typescript
import { globalAnimationManager } from '../utils/performance/animationManager';

// Animate (compositor-optimized)
globalAnimationManager.animate({
  element,
  property: 'transform', // or 'opacity'
  from: 'translateX(0)',
  to: 'translateX(100px)',
  duration: 300,
  easing: 'ease-out',
  onComplete: () => { /* cleanup */ }
});
```

---

## React Hooks

### useTaskScheduler
```typescript
import { useTaskScheduler } from '../hooks/usePerformanceOptimized';

const { schedule, cancel } = useTaskScheduler();

schedule(() => {
  // Heavy work
}, 'high');
```

### useStyleBatcher
```typescript
import { useStyleBatcher } from '../hooks/usePerformanceOptimized';

const { queueStyle, flush } = useStyleBatcher();

queueStyle(element, { transform: 'translateX(100px)' });
```

### useThrottledCallback
```typescript
import { useThrottledCallback } from '../hooks/usePerformanceOptimized';

const handleScroll = useThrottledCallback((event) => {
  // Throttled to 60fps
}, 60);
```

### useDebouncedCallback
```typescript
import { useDebouncedCallback } from '../hooks/usePerformanceOptimized';

const handleResize = useDebouncedCallback((event) => {
  // Debounced with leading/trailing edge
}, 300, { leading: true, trailing: true });
```

---

## CSS Patterns

### Compositor-Friendly Animations
```css
/* ✅ GOOD - Compositor properties */
@keyframes smooth {
  0% { transform: translate3d(0, 0, 0); opacity: 1; }
  100% { transform: translate3d(100px, 0, 0); opacity: 0.5; }
}

/* ❌ BAD - Layout properties */
@keyframes bad {
  0% { left: 0; width: 100px; }
  100% { left: 100px; width: 200px; }
}
```

### CSS Containment
```css
.container {
  contain: layout style paint;
  /* Isolates rendering, prevents layout thrashing */
}

.item {
  contain: layout style paint;
  /* Each item is isolated */
}
```

### CSS Custom Properties
```css
.item {
  --x: 0px;
  --opacity: 1;
  transform: translate3d(var(--x), 0, 0);
  opacity: var(--opacity);
  /* Browser optimizes as compositor properties */
}
```

### Will-Change Management
```css
/* Only when animating */
.item.animating {
  will-change: transform, opacity;
}

/* Remove after animation */
.item {
  will-change: auto;
}
```

---

## Common Patterns

### Pattern 1: Chunked Processing
```typescript
function processLargeArray<T>(
  items: T[],
  processor: (item: T) => void,
  chunkSize: number = 50
) {
  let index = 0;
  
  function processChunk() {
    const end = Math.min(index + chunkSize, items.length);
    
    for (let i = index; i < end; i++) {
      processor(items[i]);
    }
    
    index = end;
    
    if (index < items.length) {
      requestAnimationFrame(processChunk);
    }
  }
  
  processChunk();
}
```

### Pattern 2: RAF Throttling
```typescript
function throttleRAF<T extends (...args: any[]) => any>(
  fn: T
): T {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  return ((...args: Parameters<T>) => {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
        rafId = null;
      });
    }
  }) as T;
}
```

### Pattern 3: Passive Event Listeners
```typescript
element.addEventListener('scroll', handler, {
  passive: true, // Non-blocking
  capture: false
});
```

### Pattern 4: Object Pooling
```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  
  constructor(createFn: () => T) {
    this.createFn = createFn;
  }
  
  acquire(): T {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj: T): void {
    // Reset object state
    this.pool.push(obj);
  }
}
```

---

## Performance Checklist

### Before Implementation
- [ ] Identify performance bottlenecks
- [ ] Measure baseline metrics
- [ ] Set performance targets
- [ ] Plan optimization strategy

### During Implementation
- [ ] Use TaskScheduler for long operations
- [ ] Implement virtual rendering for large lists
- [ ] Batch style updates
- [ ] Use compositor-friendly animations only
- [ ] Add CSS containment
- [ ] Use passive event listeners
- [ ] Debounce/throttle event handlers
- [ ] Monitor frame time

### After Implementation
- [ ] Measure performance improvements
- [ ] Verify 60 FPS target
- [ ] Check task durations < 50ms
- [ ] Validate memory usage
- [ ] Test on low-end devices
- [ ] Profile with DevTools

---

## Measurement Tools

### Chrome DevTools
- Performance panel for frame analysis
- Memory profiler for leaks
- Paint flashing for repaints
- Layer panel for compositor layers

### PerformanceObserver
```typescript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn('Long task:', entry.name, entry.duration);
    }
  }
});

observer.observe({ entryTypes: ['measure', 'longtask'] });
```

### Frame Rate Monitoring
```typescript
let lastTime = performance.now();
let frameCount = 0;

function measureFPS() {
  frameCount++;
  const now = performance.now();
  
  if (now - lastTime >= 1000) {
    const fps = frameCount;
    console.log('FPS:', fps);
    frameCount = 0;
    lastTime = now;
  }
  
  requestAnimationFrame(measureFPS);
}

measureFPS();
```

---

## Anti-Patterns to Avoid

### ❌ Synchronous Long Operations
```typescript
// BAD
for (let i = 0; i < 10000; i++) {
  processItem(items[i]); // Blocks main thread
}
```

### ❌ Animating Layout Properties
```css
/* BAD */
@keyframes bad {
  0% { width: 100px; }
  100% { width: 200px; }
}
```

### ❌ Inline Styles in Loops
```typescript
// BAD
items.forEach(item => {
  item.element.style.left = `${item.x}px`; // Causes reflow each time
});
```

### ❌ Unbounded Will-Change
```css
/* BAD */
.element {
  will-change: transform; /* Never removed */
}
```

### ❌ No Event Cleanup
```typescript
// BAD
element.addEventListener('scroll', handler); // Never removed
```

---

## Quick Wins

1. **Add CSS containment** - Immediate layout isolation
2. **Use passive listeners** - Non-blocking scroll/touch
3. **Batch style updates** - Reduce reflows
4. **Virtual rendering** - Render only visible items
5. **Compositor animations** - GPU-accelerated
6. **Task chunking** - Break up long operations
7. **Debounce/throttle** - Reduce event frequency
8. **Remove will-change** - After animations complete

---

## Resources

- **High-Performance Implementation Plan:** `TRACE_AUDIT_HIGH_PERFORMANCE_IMPLEMENTATION.md`
- **Detailed Implementation Plan:** `TRACE_AUDIT_IMPLEMENTATION_PLAN.md`
- **Complete Audit Report:** `TRACE_FILE_GRANULAR_AUDIT.md`

---

**Remember:** Performance is not about micro-optimizations, it's about using the right patterns and APIs for smooth, fluid, low-latency operation.

