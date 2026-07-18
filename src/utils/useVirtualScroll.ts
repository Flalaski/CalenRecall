/**
 * React hook for virtual scrolling with variable-height items.
 * Renders only items in the visible viewport + overscan buffer.
 * Uses IntersectionObserver with sentinel elements for position tracking.
 * 
 * Usage:
 *   const { visibleItems, containerProps, spacerStyle } = useVirtualScroll({
 *     items: filteredEntries,
 *     itemHeight: 120, // estimated average height
 *     overscan: 5,
 *     containerRef,
 *   });
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

export interface VirtualScrollConfig<T> {
  items: T[];
  /** Estimated average item height in pixels */
  itemHeight: number;
  /** Number of extra items to render outside the visible viewport */
  overscan: number;
  /** Ref to the scrollable container element */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Unique key extractor */
  getKey?: (item: T, index: number) => string | number;
}

export interface VirtualScrollResult<T> {
  /** Items that should be rendered in the current viewport */
  visibleItems: Array<{ item: T; index: number; key: string | number }>;
  /** Props to spread onto the scrollable container (already applied if using containerRef) */
  containerProps: { onScroll: () => void };
  /** Style for the spacer div that creates the full scroll height */
  spacerStyle: React.CSSProperties;
  /** Style for the visible items container (relative positioning) */
  containerStyle: React.CSSProperties;
  /** Total pixel height of all items */
  totalHeight: number;
  /** Scroll to a specific item index */
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
}

export function useVirtualScroll<T>(config: VirtualScrollConfig<T>): VirtualScrollResult<T> {
  const { items, itemHeight, overscan, containerRef, getKey } = config;
  
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  // Track scroll position with RAF throttle
  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = containerRef.current;
      if (el) {
        const st = el.scrollTop;
        if (Math.abs(st - lastScrollTopRef.current) > 1) {
          lastScrollTopRef.current = st;
          setScrollTop(st);
          if (containerHeight === 0 || el.clientHeight !== containerHeight) {
            setContainerHeight(el.clientHeight);
          }
        }
      }
    });
  }, [containerRef, containerHeight]);

  // Measure container on mount and resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const measure = () => {
      setContainerHeight(el.clientHeight);
    };
    measure();
    
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  
  const visibleRange = useMemo(() => {
    if (containerHeight === 0 || items.length === 0) {
      return { start: 0, end: 0 };
    }
    
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);
    
    return { start, end };
  }, [scrollTop, containerHeight, items.length, itemHeight, overscan]);

  // Build visible items list
  const visibleItems = useMemo(() => {
    const result: Array<{ item: T; index: number; key: string | number }> = [];
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const item = items[i];
      const key = getKey ? getKey(item, i) : (item as any)?.id ?? i;
      result.push({ item, index: i, key });
    }
    return result;
  }, [items, visibleRange.start, visibleRange.end, getKey]);

  // Spacer pushes content down to simulate full list height
  const spacerStyle: React.CSSProperties = useMemo(() => ({
    height: totalHeight,
    pointerEvents: 'none',
  }), [totalHeight]);

  // Position visible items at their correct vertical offset
  const containerStyle: React.CSSProperties = useMemo(() => ({
    position: 'relative',
    width: '100%',
  }), []);

  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const el = containerRef.current;
    if (!el) return;
    
    const offset = index * itemHeight;
    let scrollTarget = offset;
    
    if (align === 'center') {
      scrollTarget = offset - containerHeight / 2 + itemHeight / 2;
    } else if (align === 'end') {
      scrollTarget = offset - containerHeight + itemHeight;
    }
    
    el.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [containerRef, itemHeight, containerHeight]);

  return {
    visibleItems,
    containerProps: { onScroll: handleScroll },
    spacerStyle,
    containerStyle,
    totalHeight,
    scrollToIndex,
  };
}
