/**
 * usePerfTrail — React hook for component-scoped span timing.
 *
 * Provides start/end/wrap that are stable across renders via useRef.
 * Components can instrument their own render and effect timing without
 * worrying about the singleton directly.
 *
 * Usage:
 *   const { start, end, wrap } = usePerfTrail();
 *   start('my-component-render');
 *   // ... work ...
 *   end('my-component-render');
 */

import { useCallback, useRef } from 'react';
import perfTrail from '../utils/performance/perfTrail';

export function usePerfTrail() {
  const spanRef = useRef<Map<string, number>>(new Map());

  const start = useCallback((label: string) => {
    perfTrail.start(label);
    spanRef.current.set(label, performance.now());
  }, []);

  const end = useCallback((label: string): number => {
    const elapsed = perfTrail.end(label);
    spanRef.current.delete(label);
    return elapsed;
  }, []);

  const wrap = useCallback(<T>(label: string, fn: () => T): T => {
    return perfTrail.wrap(label, fn);
  }, []);

  return { start, end, wrap };
}

export default usePerfTrail;
