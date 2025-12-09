/**
 * Hook to access and monitor display refresh rate
 * Supports ultra-high refresh rate monitors
 */

import { useEffect, useState } from 'react';
import { displayRefreshRate } from '../utils/performance/displayRefreshRate';

/**
 * Hook to get current display refresh rate
 * Automatically updates when refresh rate changes
 */
export function useDisplayRefreshRate(): {
  refreshRate: number;
  frameBudget: number;
  frameBudgetWithMargin: number;
  optimalThrottleFPS: number;
} {
  const [refreshRate, setRefreshRate] = useState(() =>
    displayRefreshRate.getRefreshRate()
  );
  const [frameBudget, setFrameBudget] = useState(() =>
    displayRefreshRate.getFrameBudget()
  );

  useEffect(() => {
    const unsubscribe = displayRefreshRate.onRefreshRateChange(
      (rate, budget) => {
        setRefreshRate(rate);
        setFrameBudget(budget);
      }
    );

    return unsubscribe;
  }, []);

  return {
    refreshRate,
    frameBudget,
    frameBudgetWithMargin: displayRefreshRate.getFrameBudgetWithMargin(20),
    optimalThrottleFPS: displayRefreshRate.getOptimalThrottleFPS(),
  };
}

/**
 * Hook to force refresh rate re-detection
 */
export function useRefreshRateDetection(): {
  refreshRate: number;
  redetect: () => void;
} {
  const [refreshRate, setRefreshRate] = useState(() =>
    displayRefreshRate.getRefreshRate()
  );

  useEffect(() => {
    const unsubscribe = displayRefreshRate.onRefreshRateChange((rate) => {
      setRefreshRate(rate);
    });

    return unsubscribe;
  }, []);

  const redetect = useCallback(() => {
    displayRefreshRate.redetect();
  }, []);

  return { refreshRate, redetect };
}

