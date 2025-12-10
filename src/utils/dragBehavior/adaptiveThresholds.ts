/**
 * Adaptive Thresholds
 * Calculates adaptive thresholds based on user behavior profile
 */

import { dragBehaviorTracker, DragBehaviorProfile } from './dragBehaviorTracker';

export interface AdaptiveThresholds {
  verticalThreshold: number;
  deadZoneSize: number;
  horizontalDeadZone: number;
  horizontalUnlockThreshold: number;
}

/**
 * Get adaptive thresholds based on user behavior
 */
export function getAdaptiveThresholds(): AdaptiveThresholds {
  const profile = dragBehaviorTracker.getProfile();
  
  // Base values (fallback to defaults)
  let verticalThreshold = 800;
  let deadZoneSize = 300;
  let horizontalDeadZone = 30;
  let horizontalUnlockThreshold = 40;

  if (profile && profile.sessionCount >= 3) {
    // Use adaptive values from tracker
    verticalThreshold = dragBehaviorTracker.getAdaptiveVerticalThreshold();
    deadZoneSize = dragBehaviorTracker.getAdaptiveDeadZoneSize();

    // Adjust horizontal thresholds based on user's movement patterns
    // If user frequently locks/unlocks, make it less sensitive
    const avgHorizontal = profile.avgHorizontalDragDistance;
    if (avgHorizontal > 0) {
      // Scale horizontal dead zone relative to average movement
      horizontalDeadZone = Math.max(20, Math.min(50, avgHorizontal * 0.1));
      horizontalUnlockThreshold = horizontalDeadZone * 1.33; // ~33% larger than dead zone
    }
  }

  return {
    verticalThreshold,
    deadZoneSize,
    horizontalDeadZone,
    horizontalUnlockThreshold,
  };
}

/**
 * Get adaptive resistance curve exponent based on user preference
 */
export function getAdaptiveResistanceExponent(profile: DragBehaviorProfile | null): number {
  if (!profile) {
    return 2.5; // Default
  }

  switch (profile.resistancePreference) {
    case 'light':
      return 1.8; // Less resistance
    case 'medium':
      return 2.5; // Default
    case 'heavy':
      return 3.5; // More resistance
    default:
      return 2.5;
  }
}

/**
 * Get adaptive dampening multiplier based on user behavior
 */
export function getAdaptiveDampening(profile: DragBehaviorProfile | null): {
  baseMin: number;
  baseMax: number;
  distanceMultiplier: number;
} {
  if (!profile) {
    return {
      baseMin: 0.15,
      baseMax: 0.30,
      distanceMultiplier: 0.7,
    };
  }

  // Adjust based on drag speed preference
  // Fast users prefer higher dampening (more responsive)
  // Slow users prefer lower dampening (more controlled)
  const speedFactor = profile.preferredDragSpeed / 100; // Normalize to 0-2 range
  const baseMultiplier = 0.5 + (speedFactor * 0.5); // Range: 0.5-1.0

  return {
    baseMin: 0.15 * baseMultiplier,
    baseMax: 0.30 * baseMultiplier,
    distanceMultiplier: 0.7,
  };
}

