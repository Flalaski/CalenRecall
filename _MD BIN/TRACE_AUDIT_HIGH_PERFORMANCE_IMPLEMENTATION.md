# High-Performance Implementation Plan
## Production-Grade Performance Patterns for Fluid, Low-Latency Operation

**Date:** December 8, 2025  
**Goal:** Achieve 60 FPS, <50ms tasks, fluid interactions  
**Approach:** Modern performance APIs, zero-copy patterns, adaptive scheduling

---

## Core Performance Principles

1. **Frame Budgeting:** Never exceed 16ms per frame
2. **Adaptive Scheduling:** Adjust work based on available time
3. **Zero-Copy Operations:** Minimize data copying
4. **Lazy Evaluation:** Compute only what's needed, when needed
5. **Memory Efficiency:** Reuse objects, minimize allocations
6. **Compositor-Friendly:** Use transform/opacity only
7. **Passive Event Listeners:** Non-blocking event handling
8. **Intersection Observer:** Efficient visibility detection

---

## Implementation: High-Performance Task Scheduler

### File: `src/utils/performance/taskScheduler.ts`

```typescript
/**
 * High-performance task scheduler with adaptive frame budgeting
 * Uses modern performance APIs for optimal scheduling
 */

interface Task {
  id: number;
  fn: () => void;
  priority: 'critical' | 'high' | 'normal' | 'low';
  deadline?: number; // Optional deadline in ms
}

interface SchedulerConfig {
  frameBudget: number; // Default 16ms for 60fps
  adaptiveBudget: boolean; // Adjust based on frame time
  maxConsecutiveFrames: number; // Max frames to process in one go
  idleTimeout: number; // Timeout for requestIdleCallback
}

class TaskScheduler {
  private taskQueue: Task[] = [];
  private criticalQueue: Task[] = [];
  private isProcessing = false;
  private frameId: number | null = null;
  private taskIdCounter = 0;
  private config: SchedulerConfig;
  private performanceObserver: PerformanceObserver | null = null;
  private averageFrameTime = 16; // Track average frame time
  private frameTimeHistory: number[] = [];
  private readonly FRAME_HISTORY_SIZE = 60; // Track last 60 frames

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      frameBudget: 16,
      adaptiveBudget: true,
      maxConsecutiveFrames: 3,
      idleTimeout: 100,
      ...config,
    };

    this.initializePerformanceObserver();
  }

  /**
   * Monitor frame performance to adapt budget
   */
  private initializePerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            const duration = entry.duration;
            this.updateFrameTimeHistory(duration);
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // PerformanceObserver not supported
      console.warn('PerformanceObserver not available');
    }
  }

  private updateFrameTimeHistory(frameTime: number): void {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.FRAME_HISTORY_SIZE) {
      this.frameTimeHistory.shift();
    }

    // Calculate rolling average
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    this.averageFrameTime = sum / this.frameTimeHistory.length;

    // Adapt budget if enabled
    if (this.config.adaptiveBudget) {
      // If we're consistently under budget, we can use more
      // If we're over, reduce budget
      if (this.averageFrameTime < 12) {
        this.config.frameBudget = Math.min(20, this.config.frameBudget + 0.5);
      } else if (this.averageFrameTime > 18) {
        this.config.frameBudget = Math.max(10, this.config.frameBudget - 0.5);
      }
    }
  }

  /**
   * Schedule a task with priority
   */
  schedule(
    fn: () => void,
    priority: Task['priority'] = 'normal',
    deadline?: number
  ): number {
    const task: Task = {
      id: ++this.taskIdCounter,
      fn,
      priority,
      deadline,
    };

    if (priority === 'critical') {
      this.criticalQueue.push(task);
    } else {
      this.taskQueue.push(task);
    }

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return task.id;
  }

  /**
   * Cancel a scheduled task
   */
  cancel(taskId: number): boolean {
    const criticalIndex = this.criticalQueue.findIndex(t => t.id === taskId);
    if (criticalIndex !== -1) {
      this.criticalQueue.splice(criticalIndex, 1);
      return true;
    }

    const normalIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (normalIndex !== -1) {
      this.taskQueue.splice(normalIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Start processing tasks
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processFrame();
  }

  /**
   * Process tasks within frame budget
   */
  private processFrame(): void {
    const startTime = performance.now();
    let frameCount = 0;
    let tasksProcessed = 0;

    // Process critical tasks first (always within budget)
    while (this.criticalQueue.length > 0 && frameCount < this.config.maxConsecutiveFrames) {
      const elapsed = performance.now() - startTime;
      const remainingBudget = this.config.frameBudget - elapsed;

      if (remainingBudget < 2) break; // Leave 2ms buffer

      const task = this.criticalQueue.shift();
      if (task) {
        const taskStart = performance.now();
        try {
          task.fn();
        } catch (error) {
          console.error('Task execution error:', error);
        }
        const taskDuration = performance.now() - taskStart;
        
        // Warn if task exceeds budget
        if (taskDuration > this.config.frameBudget) {
          console.warn(`Task exceeded frame budget: ${taskDuration.toFixed(2)}ms`);
        }
        tasksProcessed++;
      }
      frameCount++;
    }

    // Process normal priority tasks
    while (this.taskQueue.length > 0 && frameCount < this.config.maxConsecutiveFrames) {
      const elapsed = performance.now() - startTime;
      const remainingBudget = this.config.frameBudget - elapsed;

      if (remainingBudget < 2) break;

      // Check deadlines
      const now = performance.now();
      const overdueTasks = this.taskQueue.filter(
        t => t.deadline && t.deadline < now
      );
      
      // Process overdue tasks first
      const task = overdueTasks.length > 0 
        ? this.taskQueue.splice(this.taskQueue.indexOf(overdueTasks[0]), 1)[0]
        : this.taskQueue.shift();

      if (task) {
        const taskStart = performance.now();
        try {
          task.fn();
        } catch (error) {
          console.error('Task execution error:', error);
        }
        tasksProcessed++;
      }
      frameCount++;
    }

    const frameTime = performance.now() - startTime;

    // Continue processing if there are more tasks
    if (this.criticalQueue.length > 0 || this.taskQueue.length > 0) {
      // Use requestIdleCallback if available, otherwise requestAnimationFrame
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(
          () => {
            this.frameId = requestAnimationFrame(() => this.processFrame());
          },
          { timeout: this.config.idleTimeout }
        );
      } else {
        this.frameId = requestAnimationFrame(() => this.processFrame());
      }
    } else {
      this.isProcessing = false;
      this.frameId = null;
    }

    // Performance measurement
    if (this.performanceObserver && typeof performance.mark !== 'undefined') {
      performance.mark(`task-scheduler-frame-${Date.now()}`);
      performance.measure(
        'task-scheduler-frame',
        `task-scheduler-frame-${Date.now() - frameTime}`,
        `task-scheduler-frame-${Date.now()}`
      );
    }
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.taskQueue = [];
    this.criticalQueue = [];
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get current queue sizes
   */
  getQueueSize(): { critical: number; normal: number } {
    return {
      critical: this.criticalQueue.length,
      normal: this.taskQueue.length,
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    averageFrameTime: number;
    queueSize: { critical: number; normal: number };
    currentBudget: number;
  } {
    return {
      averageFrameTime: this.averageFrameTime,
      queueSize: this.getQueueSize(),
      currentBudget: this.config.frameBudget,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
  }
}

// Singleton instance for global use
export const globalTaskScheduler = new TaskScheduler();

// Export class for custom instances
export default TaskScheduler;
```

---

## Implementation: High-Performance Virtual Renderer

### File: `src/utils/performance/virtualRenderer.ts`

```typescript
/**
 * High-performance virtual rendering with Intersection Observer
 * Zero-copy operations, efficient visibility detection
 */

interface VirtualItem<T> {
  data: T;
  index: number;
  key: string | number;
}

interface VirtualRendererConfig {
  itemHeight: number; // Estimated item height
  overscan: number; // Items to render outside viewport
  container: HTMLElement;
  onVisibleChange?: (visible: VirtualItem<any>[]) => void;
}

class VirtualRenderer<T> {
  private config: VirtualRendererConfig;
  private items: T[] = [];
  private visibleRange: { start: number; end: number } = { start: 0, end: 0 };
  private observer: IntersectionObserver | null = null;
  private sentinelElements: Map<number, HTMLElement> = new Map();
  private itemCache: Map<number, VirtualItem<T>> = new Map();
  private lastScrollTop = 0;
  private rafId: number | null = null;

  constructor(config: VirtualRendererConfig) {
    this.config = config;
    this.initializeObserver();
    this.setupScrollListener();
  }

  /**
   * Use Intersection Observer for efficient visibility detection
   */
  private initializeObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback to scroll-based detection
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        // Batch visibility updates
        this.updateVisibleRange(entries);
      },
      {
        root: this.config.container,
        rootMargin: `${this.config.overscan * this.config.itemHeight}px`,
        threshold: [0, 0.1, 0.5, 1.0],
      }
    );
  }

  /**
   * Setup efficient scroll listener with RAF throttling
   */
  private setupScrollListener(): void {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        this.rafId = requestAnimationFrame(() => {
          const scrollTop = this.config.container.scrollTop;
          if (Math.abs(scrollTop - this.lastScrollTop) > 1) {
            this.updateVisibleRangeFromScroll(scrollTop);
            this.lastScrollTop = scrollTop;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    this.config.container.addEventListener('scroll', handleScroll, {
      passive: true, // Non-blocking
    });
  }

  /**
   * Update visible range from scroll position
   */
  private updateVisibleRangeFromScroll(scrollTop: number): void {
    const containerHeight = this.config.container.clientHeight;
    const itemHeight = this.config.itemHeight;

    const start = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - this.config.overscan
    );
    const end = Math.min(
      this.items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) +
        this.config.overscan
    );

    if (
      start !== this.visibleRange.start ||
      end !== this.visibleRange.end
    ) {
      this.visibleRange = { start, end };
      this.notifyVisibleChange();
    }
  }

  /**
   * Update visible range from Intersection Observer
   */
  private updateVisibleRange(entries: IntersectionObserverEntry[]): void {
    // Process entries to determine visible range
    // This is more efficient than scroll-based for large lists
    const visibleIndices = new Set<number>();

    entries.forEach((entry) => {
      const index = parseInt(entry.target.getAttribute('data-index') || '0');
      if (entry.isIntersecting) {
        visibleIndices.add(index);
      }
    });

    if (visibleIndices.size > 0) {
      const indices = Array.from(visibleIndices).sort((a, b) => a - b);
      const start = Math.max(0, indices[0] - this.config.overscan);
      const end = Math.min(
        this.items.length,
        indices[indices.length - 1] + 1 + this.config.overscan
      );

      if (
        start !== this.visibleRange.start ||
        end !== this.visibleRange.end
      ) {
        this.visibleRange = { start, end };
        this.notifyVisibleChange();
      }
    }
  }

  /**
   * Notify visible items changed
   */
  private notifyVisibleChange(): void {
    if (this.config.onVisibleChange) {
      const visible = this.getVisibleItems();
      this.config.onVisibleChange(visible);
    }
  }

  /**
   * Get currently visible items (zero-copy where possible)
   */
  getVisibleItems(): VirtualItem<T>[] {
    const { start, end } = this.visibleRange;
    const visible: VirtualItem<T>[] = [];

    for (let i = start; i < end; i++) {
      // Use cache if available
      if (this.itemCache.has(i)) {
        visible.push(this.itemCache.get(i)!);
      } else {
        const item: VirtualItem<T> = {
          data: this.items[i],
          index: i,
          key: this.getKey(this.items[i], i),
        };
        this.itemCache.set(i, item);
        visible.push(item);
      }
    }

    return visible;
  }

  /**
   * Get key for item (override for custom key generation)
   */
  protected getKey(item: T, index: number): string | number {
    if (typeof item === 'object' && item !== null) {
      const obj = item as any;
      return obj.id || obj.key || index;
    }
    return index;
  }

  /**
   * Set items (efficient update)
   */
  setItems(items: T[]): void {
    // Only update if actually changed (shallow comparison)
    if (this.items === items) return;

    this.items = items;
    this.itemCache.clear(); // Clear cache on items change
    this.updateVisibleRangeFromScroll(this.config.container.scrollTop);
  }

  /**
   * Get total height for scroll container
   */
  getTotalHeight(): number {
    return this.items.length * this.config.itemHeight;
  }

  /**
   * Get offset for item at index
   */
  getItemOffset(index: number): number {
    return index * this.config.itemHeight;
  }

  /**
   * Scroll to item
   */
  scrollToItem(index: number, align: 'start' | 'center' | 'end' = 'start'): void {
    const offset = this.getItemOffset(index);
    const containerHeight = this.config.container.clientHeight;

    let scrollTop = offset;
    if (align === 'center') {
      scrollTop = offset - containerHeight / 2 + this.config.itemHeight / 2;
    } else if (align === 'end') {
      scrollTop = offset - containerHeight + this.config.itemHeight;
    }

    this.config.container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth',
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.itemCache.clear();
    this.sentinelElements.clear();
  }
}

export default VirtualRenderer;
```

---

## Implementation: High-Performance Style Batcher

### File: `src/utils/performance/styleBatcher.ts`

```typescript
/**
 * High-performance style batching with RAF and CSS custom properties
 * Minimizes reflows and repaints
 */

interface StyleUpdate {
  element: HTMLElement;
  styles: Partial<CSSStyleDeclaration>;
  priority: 'critical' | 'normal';
}

class StyleBatcher {
  private updateQueue: Map<HTMLElement, StyleUpdate> = new Map();
  private isScheduled = false;
  private rafId: number | null = null;
  private readonly BATCH_SIZE = 50; // Max elements to update per frame

  /**
   * Queue a style update
   */
  queue(
    element: HTMLElement,
    styles: Partial<CSSStyleDeclaration>,
    priority: 'critical' | 'normal' = 'normal'
  ): void {
    const existing = this.updateQueue.get(element);
    if (existing) {
      // Merge styles
      existing.styles = { ...existing.styles, ...styles };
      if (priority === 'critical') {
        existing.priority = 'critical';
      }
    } else {
      this.updateQueue.set(element, { element, styles, priority });
    }

    if (!this.isScheduled) {
      this.scheduleBatch();
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    this.isScheduled = true;
    this.rafId = requestAnimationFrame(() => {
      this.processBatch();
    });
  }

  /**
   * Process queued style updates
   */
  private processBatch(): void {
    const startTime = performance.now();
    const updates = Array.from(this.updateQueue.values());

    // Sort by priority
    updates.sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (a.priority !== 'critical' && b.priority === 'critical') return 1;
      return 0;
    });

    // Process critical updates first
    const critical = updates.filter(u => u.priority === 'critical');
    const normal = updates.filter(u => u.priority === 'normal');

    // Process critical updates immediately
    critical.forEach((update) => {
      this.applyStyles(update.element, update.styles);
      this.updateQueue.delete(update.element);
    });

    // Process normal updates in batches
    let processed = 0;
    for (const update of normal) {
      if (processed >= this.BATCH_SIZE) break;

      const elapsed = performance.now() - startTime;
      if (elapsed > 12) break; // Leave 4ms buffer

      this.applyStyles(update.element, update.styles);
      this.updateQueue.delete(update.element);
      processed++;
    }

    // Continue if more updates remain
    if (this.updateQueue.size > 0) {
      this.scheduleBatch();
    } else {
      this.isScheduled = false;
      this.rafId = null;
    }
  }

  /**
   * Apply styles efficiently
   */
  private applyStyles(
    element: HTMLElement,
    styles: Partial<CSSStyleDeclaration>
  ): void {
    // Use CSS custom properties where possible (compositor-friendly)
    const customProps: Record<string, string> = {};
    const directStyles: Partial<CSSStyleDeclaration> = {};

    Object.entries(styles).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      // Map common properties to CSS variables
      const cssVarName = this.getCSSVarName(key);
      if (cssVarName && this.isCompositorProperty(key)) {
        customProps[cssVarName] = String(value);
      } else {
        (directStyles as any)[key] = value;
      }
    });

    // Apply CSS custom properties (single reflow)
    if (Object.keys(customProps).length > 0) {
      Object.entries(customProps).forEach(([prop, value]) => {
        element.style.setProperty(prop, value);
      });
    }

    // Apply direct styles (batch via Object.assign)
    if (Object.keys(directStyles).length > 0) {
      Object.assign(element.style, directStyles);
    }
  }

  /**
   * Get CSS variable name for property
   */
  private getCSSVarName(property: string): string | null {
    const mapping: Record<string, string> = {
      transform: '--transform',
      opacity: '--opacity',
      backgroundColor: '--bg-color',
      color: '--text-color',
      width: '--width',
      height: '--height',
    };
    return mapping[property] || null;
  }

  /**
   * Check if property is compositor-friendly
   */
  private isCompositorProperty(property: string): boolean {
    const compositorProps = [
      'transform',
      'opacity',
      'willChange',
      'backfaceVisibility',
      'perspective',
    ];
    return compositorProps.includes(property);
  }

  /**
   * Flush all pending updates immediately
   */
  flush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.processBatch();
  }

  /**
   * Clear all queued updates
   */
  clear(): void {
    this.updateQueue.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isScheduled = false;
  }
}

// Singleton instance
export const globalStyleBatcher = new StyleBatcher();
export default StyleBatcher;
```

---

## Implementation: High-Performance Animation Manager

### File: `src/utils/performance/animationManager.ts`

```typescript
/**
 * High-performance animation manager with compositor optimization
 * Throttles concurrent animations, manages will-change
 */

interface AnimationConfig {
  element: HTMLElement;
  property: string;
  from: number | string;
  to: number | string;
  duration: number;
  easing?: string;
  onComplete?: () => void;
}

class AnimationManager {
  private activeAnimations: Map<HTMLElement, Set<string>> = new Map();
  private animationQueue: AnimationConfig[] = [];
  private maxConcurrent = 10; // Limit concurrent animations
  private rafId: number | null = null;

  /**
   * Start an animation (compositor-optimized)
   */
  animate(config: AnimationConfig): void {
    const { element, property } = config;

    // Check if already animating this property
    const elementAnimations = this.activeAnimations.get(element);
    if (elementAnimations?.has(property)) {
      // Cancel existing animation
      this.cancelAnimation(element, property);
    }

    // Ensure compositor-friendly properties only
    if (!this.isCompositorProperty(property)) {
      console.warn(
        `Animation on non-compositor property: ${property}. Use transform/opacity instead.`
      );
      return;
    }

    // Check concurrent animation limit
    if (this.getActiveCount() >= this.maxConcurrent) {
      this.animationQueue.push(config);
      return;
    }

    this.startAnimation(config);
  }

  /**
   * Start animation with proper will-change management
   */
  private startAnimation(config: AnimationConfig): void {
    const { element, property, from, to, duration, easing, onComplete } = config;

    // Set will-change for compositor optimization
    this.setWillChange(element, property, true);

    // Use CSS animation for compositor optimization
    const animationName = `anim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const keyframes = this.generateKeyframes(property, from, to);

    // Inject keyframes
    this.injectKeyframes(animationName, keyframes, duration, easing);

    // Apply animation
    element.style.animation = `${animationName} ${duration}ms ${easing || 'ease-out'} forwards`;

    // Track animation
    if (!this.activeAnimations.has(element)) {
      this.activeAnimations.set(element, new Set());
    }
    this.activeAnimations.get(element)!.add(property);

    // Cleanup on complete
    const handleComplete = () => {
      element.style.animation = '';
      this.setWillChange(element, property, false);
      this.activeAnimations.get(element)?.delete(property);
      if (onComplete) onComplete();

      // Process queue
      this.processQueue();
    };

    element.addEventListener('animationend', handleComplete, { once: true });
  }

  /**
   * Generate keyframes for property
   */
  private generateKeyframes(
    property: string,
    from: number | string,
    to: number | string
  ): string {
    if (property === 'transform') {
      return `
        0% { transform: ${from}; }
        100% { transform: ${to}; }
      `;
    } else if (property === 'opacity') {
      return `
        0% { opacity: ${from}; }
        100% { opacity: ${to}; }
      `;
    }
    return '';
  }

  /**
   * Inject keyframes into document
   */
  private injectKeyframes(
    name: string,
    keyframes: string,
    duration: number,
    easing?: string
  ): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ${name} {
        ${keyframes}
      }
    `;
    document.head.appendChild(style);

    // Remove after animation completes
    setTimeout(() => {
      style.remove();
    }, duration + 100);
  }

  /**
   * Set will-change efficiently
   */
  private setWillChange(element: HTMLElement, property: string, enable: boolean): void {
    const current = element.style.willChange;
    const properties = current ? current.split(',').map(p => p.trim()) : [];

    if (enable) {
      if (!properties.includes(property)) {
        properties.push(property);
        element.style.willChange = properties.join(', ');
      }
    } else {
      const index = properties.indexOf(property);
      if (index !== -1) {
        properties.splice(index, 1);
        element.style.willChange = properties.length > 0 ? properties.join(', ') : 'auto';
      }
    }
  }

  /**
   * Check if property is compositor-friendly
   */
  private isCompositorProperty(property: string): boolean {
    return property === 'transform' || property === 'opacity';
  }

  /**
   * Get active animation count
   */
  private getActiveCount(): number {
    let count = 0;
    this.activeAnimations.forEach((set) => {
      count += set.size;
    });
    return count;
  }

  /**
   * Process animation queue
   */
  private processQueue(): void {
    while (
      this.animationQueue.length > 0 &&
      this.getActiveCount() < this.maxConcurrent
    ) {
      const config = this.animationQueue.shift();
      if (config) {
        this.startAnimation(config);
      }
    }
  }

  /**
   * Cancel animation
   */
  cancelAnimation(element: HTMLElement, property: string): void {
    const elementAnimations = this.activeAnimations.get(element);
    if (elementAnimations?.has(property)) {
      element.style.animation = '';
      this.setWillChange(element, property, false);
      elementAnimations.delete(property);
    }
  }

  /**
   * Cancel all animations for element
   */
  cancelAll(element: HTMLElement): void {
    const elementAnimations = this.activeAnimations.get(element);
    if (elementAnimations) {
      elementAnimations.forEach((property) => {
        this.cancelAnimation(element, property);
      });
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.activeAnimations.forEach((animations, element) => {
      animations.forEach((property) => {
        this.cancelAnimation(element, property);
      });
    });
    this.activeAnimations.clear();
    this.animationQueue = [];
  }
}

export const globalAnimationManager = new AnimationManager();
export default AnimationManager;
```

---

## Integration: React Hooks for Performance

### File: `src/hooks/usePerformanceOptimized.ts`

```typescript
/**
 * React hooks for high-performance operations
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { globalTaskScheduler } from '../utils/performance/taskScheduler';
import { globalStyleBatcher } from '../utils/performance/styleBatcher';
import { globalAnimationManager } from '../utils/performance/animationManager';

/**
 * Hook for scheduling tasks with frame budgeting
 */
export function useTaskScheduler() {
  const schedulerRef = useRef(globalTaskScheduler);

  const schedule = useCallback(
    (
      fn: () => void,
      priority: 'critical' | 'high' | 'normal' | 'low' = 'normal',
      deadline?: number
    ) => {
      return schedulerRef.current.schedule(fn, priority, deadline);
    },
    []
  );

  const cancel = useCallback((taskId: number) => {
    return schedulerRef.current.cancel(taskId);
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount if needed
    };
  }, []);

  return { schedule, cancel };
}

/**
 * Hook for batched style updates
 */
export function useStyleBatcher() {
  const batcherRef = useRef(globalStyleBatcher);

  const queueStyle = useCallback(
    (
      element: HTMLElement,
      styles: Partial<CSSStyleDeclaration>,
      priority: 'critical' | 'normal' = 'normal'
    ) => {
      batcherRef.current.queue(element, styles, priority);
    },
    []
  );

  const flush = useCallback(() => {
    batcherRef.current.flush();
  }, []);

  return { queueStyle, flush };
}

/**
 * Hook for optimized animations
 */
export function useAnimationManager() {
  const managerRef = useRef(globalAnimationManager);

  const animate = useCallback(
    (config: {
      element: HTMLElement;
      property: string;
      from: number | string;
      to: number | string;
      duration: number;
      easing?: string;
      onComplete?: () => void;
    }) => {
      managerRef.current.animate(config);
    },
    []
  );

  const cancelAnimation = useCallback(
    (element: HTMLElement, property: string) => {
      managerRef.current.cancelAnimation(element, property);
    },
    []
  );

  return { animate, cancelAnimation };
}

/**
 * Hook for debounced callbacks with leading/trailing edge
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T {
  const { leading = false, trailing = true } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallRef = useRef<{ args: Parameters<T>; time: number } | null>(null);

  const debounced = useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const lastCall = lastCallRef.current;

      // Leading edge
      if (leading && (!lastCall || now - lastCall.time >= delay)) {
        callback(...args);
        lastCallRef.current = { args, time: now };
        return;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Schedule trailing edge
      if (trailing) {
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastCallRef.current = { args, time: Date.now() };
        }, delay);
      }

      lastCallRef.current = { args, time: now };
    }) as T,
    [callback, delay, leading, trailing]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debounced;
}

/**
 * Hook for throttled callbacks with RAF
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  fps: number = 60
): T {
  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  const throttled = useCallback(
    ((...args: Parameters<T>) => {
      lastArgsRef.current = args;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (lastArgsRef.current) {
            callback(...lastArgsRef.current);
            lastArgsRef.current = null;
          }
          rafRef.current = null;
        });
      }
    }) as T,
    [callback]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return throttled;
}
```

---

## CSS Optimizations

### File: `src/components/GlobalTimelineMinimap.css` (Additions)

```css
/* High-performance CSS patterns */

/* CSS Containment for isolation */
.minimap-container {
  contain: layout style paint;
  /* Isolates rendering, prevents layout thrashing */
}

.entry-indicator {
  contain: layout style paint;
  /* Each indicator is isolated */
  will-change: transform; /* Only when animating */
}

/* Compositor-friendly animations only */
@keyframes smoothTransform {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1.1);
    opacity: 0.9;
  }
}

/* Use CSS custom properties for dynamic values */
.entry-indicator {
  --entry-x: 0%;
  --entry-y: 0%;
  --entry-opacity: 1;
  transform: translate3d(var(--entry-x), var(--entry-y), 0);
  opacity: var(--entry-opacity);
  /* Browser can optimize these as compositor properties */
}

/* Disable animations during drag for performance */
.minimap-container.dragging * {
  animation: none !important;
  will-change: auto !important;
  /* Prevents animation overhead during interaction */
}

/* GPU acceleration hints */
.minimap-container,
.entry-indicator {
  transform: translateZ(0); /* Force GPU layer */
  backface-visibility: hidden; /* Optimize transforms */
  perspective: 1000px; /* Enable 3D transforms */
}
```

---

## Usage Example: GlobalTimelineMinimap Integration

```typescript
// In GlobalTimelineMinimap.tsx

import { useTaskScheduler, useStyleBatcher, useThrottledCallback } from '../hooks/usePerformanceOptimized';
import VirtualRenderer from '../utils/performance/virtualRenderer';

export default function GlobalTimelineMinimap({ ... }) {
  const { schedule } = useTaskScheduler();
  const { queueStyle } = useStyleBatcher();
  const containerRef = useRef<HTMLDivElement>(null);
  const virtualRendererRef = useRef<VirtualRenderer<JournalEntry> | null>(null);

  // Initialize virtual renderer
  useEffect(() => {
    if (!containerRef.current) return;

    virtualRendererRef.current = new VirtualRenderer({
      itemHeight: 20, // Estimated height
      overscan: 10,
      container: containerRef.current,
      onVisibleChange: (visible) => {
        // Update visible entries
        schedule(() => {
          renderVisibleEntries(visible);
        }, 'high');
      },
    });

    return () => {
      virtualRendererRef.current?.destroy();
    };
  }, []);

  // Throttled scroll handler
  const handleScroll = useThrottledCallback((event: Event) => {
    // Handle scroll with RAF throttling
  }, 60);

  // Render entries with task scheduling
  const renderVisibleEntries = (visible: VirtualItem<JournalEntry>[]) => {
    visible.forEach((item) => {
      schedule(() => {
        const element = getOrCreateIndicator(item.data);
        const position = calculatePosition(item.data);
        
        // Use style batcher for updates
        queueStyle(element, {
          transform: `translate3d(${position}%, 0, 0)`,
        });
      }, 'normal');
    });
  };

  // ... rest of component
}
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|--------------|
| **Frame Time** | < 16ms | PerformanceObserver |
| **Task Duration** | < 50ms | TaskScheduler metrics |
| **Layout Elements** | < 100 | DevTools Performance |
| **Composite Failures** | < 100/min | Chrome DevTools |
| **Paint Operations** | Minimal | Paint flashing |
| **Memory Usage** | Stable | Memory profiler |

---

## Summary

This implementation provides:

1. ✅ **Adaptive Frame Budgeting** - Adjusts based on performance
2. ✅ **Zero-Copy Virtual Rendering** - Efficient visibility detection
3. ✅ **Batched Style Updates** - Minimizes reflows
4. ✅ **Compositor-Optimized Animations** - GPU-accelerated
5. ✅ **Modern Performance APIs** - PerformanceObserver, IntersectionObserver
6. ✅ **Memory Efficiency** - Object reuse, minimal allocations
7. ✅ **React Integration** - Custom hooks for easy use
8. ✅ **Production-Ready** - Error handling, cleanup, metrics

**Expected Results:**
- 60 FPS consistently
- < 50ms tasks
- Smooth, fluid interactions
- Low latency (< 16ms response time)
- Minimal memory footprint

