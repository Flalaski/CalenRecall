/**
 * useFpsMonitor — React hook for live FPS monitoring.
 *
 * Subscribes to PerfTrail FPS updates and provides a reactive value.
 * Useful for debug overlays and adaptive quality settings.
 *
 * Usage:
 *   const { fps, isLowFps } = useFpsMonitor();
 *   // fps = current frame rate
 *   // isLowFps = true when fps drops below threshold
 */

import { useState, useEffect, useCallback } from 'react';
import perfTrail from '../utils/performance/perfTrail';

interface FpsMonitorState {
  fps: number;
  isLowFps: boolean;
  lowFpsThreshold: number;
}

export function useFpsMonitor(lowFpsThreshold: number = 45): FpsMonitorState {
  const [fps, setFps] = useState(() => perfTrail.fps());
  const [isLowFps, setIsLowFps] = useState(false);

  useEffect(() => {
    const unsubscribe = perfTrail.onFps((currentFps) => {
      setFps(currentFps);
      setIsLowFps(currentFps < lowFpsThreshold && currentFps > 0);
    });
    return unsubscribe;
  }, [lowFpsThreshold]);

  return { fps, isLowFps, lowFpsThreshold };
}

export default useFpsMonitor;
