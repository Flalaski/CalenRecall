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
   * Get current visible range
   */
  getVisibleRange(): { start: number; end: number } {
    return { ...this.visibleRange };
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

