/**
 * React hooks for high-performance operations
 * Supports ultra-high refresh rate monitors (120Hz, 144Hz, 240Hz, etc.)
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { globalTaskScheduler } from '../utils/performance/taskScheduler';
import { globalStyleBatcher } from '../utils/performance/styleBatcher';
import { globalAnimationManager } from '../utils/performance/animationManager';
import { displayRefreshRate } from '../utils/performance/displayRefreshRate';

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
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const lastCall = lastCallRef.current;

      // Leading edge
      if (leading && (!lastCall || now - lastCall.time >= delay)) {
        callbackRef.current(...args);
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
          callbackRef.current(...args);
          lastCallRef.current = { args, time: Date.now() };
        }, delay);
      }

      lastCallRef.current = { args, time: now };
    }) as T,
    [delay, leading, trailing]
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
 * Automatically adapts to display refresh rate (supports ultra-high refresh monitors)
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  fps?: number // If undefined, uses display refresh rate
): T {
  const rafRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);
  const refreshRateRef = useRef<number | null>(null);
  const lastCallTimeRef = useRef<number>(0);

  // Import display refresh rate
  useEffect(() => {
    refreshRateRef.current = displayRefreshRate.getOptimalThrottleFPS();
    
    const unsubscribe = displayRefreshRate.onRefreshRateChange((rate) => {
      refreshRateRef.current = displayRefreshRate.getOptimalThrottleFPS();
    });

    return unsubscribe;
  }, []);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttled = useCallback(
    ((...args: Parameters<T>) => {
      lastArgsRef.current = args;

      if (rafRef.current === null) {
        const targetFPS = fps ?? refreshRateRef.current ?? 60;
        const minInterval = 1000 / targetFPS;
        const now = performance.now();

        // For high refresh rates, use RAF directly (unlocked)
        // For lower rates or when FPS is specified, throttle
        if (targetFPS >= 120 || fps === undefined) {
          // Unlocked mode - use RAF directly for native refresh rate
          rafRef.current = requestAnimationFrame(() => {
            if (lastArgsRef.current) {
              callbackRef.current(...lastArgsRef.current);
              lastArgsRef.current = null;
            }
            rafRef.current = null;
            lastCallTimeRef.current = performance.now();
          });
        } else {
          // Throttled mode - respect FPS limit
          const timeSinceLastCall = now - lastCallTimeRef.current;
          if (timeSinceLastCall >= minInterval) {
            callbackRef.current(...args);
            lastCallTimeRef.current = now;
            lastArgsRef.current = null;
          } else {
            rafRef.current = requestAnimationFrame(() => {
              if (lastArgsRef.current) {
                callbackRef.current(...lastArgsRef.current);
                lastArgsRef.current = null;
              }
              rafRef.current = null;
              lastCallTimeRef.current = performance.now();
            });
          }
        }
      }
    }) as T,
    [fps]
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

