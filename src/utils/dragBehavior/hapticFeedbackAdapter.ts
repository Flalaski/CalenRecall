/**
 * Haptic Feedback Adapter
 * Context-aware haptic feedback adjustments
 */

import { DragBehaviorProfile } from './dragBehaviorTracker';
import { EntryDensityInfo } from './entryDensityAwareness';

export interface HapticFeedbackSettings {
  blipFrequency: number; // 0-1, how often to play blips
  blipVolumeMultiplier: number; // 0-2, volume adjustment
  blipPitchOffset: number; // -1 to 1, pitch adjustment
  resistanceMultiplier: number; // Resistance adjustment
}

/**
 * Calculate adaptive blip frequency based on drag speed
 */
export function getAdaptiveBlipFrequency(
  dragSpeed: number, // pixels per frame
  baseFrequency: number = 1.0 // Default: every date change
): number {
  // Fast drags (>100 px/frame) → play more frequently
  // Slow drags (<10 px/frame) → play less frequently
  if (dragSpeed > 100) {
    return Math.min(1.0, baseFrequency * 1.5); // Up to 50% more frequent
  } else if (dragSpeed < 10) {
    return Math.max(0.2, baseFrequency * 0.5); // Reduce to 50% frequency
  }
  
  // Linear interpolation between 10-100 px/frame
  const normalizedSpeed = (dragSpeed - 10) / 90; // 0-1 range
  return baseFrequency * (0.5 + normalizedSpeed * 0.5); // 0.5x to 1.0x
}

/**
 * Calculate adaptive volume based on context
 */
export function getAdaptiveBlipVolume(
  entryDensity: EntryDensityInfo,
  distanceToFret: number, // 0-1, distance to nearest time point
  profile: DragBehaviorProfile | null
): number {
  let volume = 1.0;

  // Entry density adjustment
  volume *= entryDensity.blipVolumeMultiplier;

  // Distance to fret (louder near frets)
  const fretProximityVolume = 1.0 - (distanceToFret * 0.3); // Up to 30% louder near frets
  volume *= Math.max(0.7, fretProximityVolume);

  // User preference (if available)
  if (profile) {
    // Fast users might prefer quieter (less overwhelming)
    // Slow users might prefer louder (more feedback)
    const speedFactor = profile.preferredDragSpeed / 100;
    if (speedFactor > 1.2) {
      volume *= 0.9; // Slightly quieter for fast users
    } else if (speedFactor < 0.5) {
      volume *= 1.1; // Slightly louder for slow users
    }
  }

  return Math.max(0.3, Math.min(1.5, volume)); // Clamp between 30% and 150%
}

/**
 * Calculate adaptive pitch offset based on context
 */
export function getAdaptiveBlipPitch(
  dragSpeed: number,
  direction: 'next' | 'prev' | null,
  entryDensity: EntryDensityInfo
): number {
  let pitch = 0;

  // Speed-based pitch (faster = higher pitch)
  const speedFactor = Math.min(1.0, dragSpeed / 200); // Normalize to 0-1
  pitch += speedFactor * 0.3; // Up to 30% higher pitch

  // Entry density pitch (more entries = slightly higher pitch)
  pitch += entryDensity.density * 0.1; // Up to 10% higher

  // Direction-based pitch (next = slightly higher, prev = slightly lower)
  if (direction === 'next') {
    pitch += 0.05;
  } else if (direction === 'prev') {
    pitch -= 0.05;
  }

  return Math.max(-0.2, Math.min(0.4, pitch)); // Clamp between -20% and +40%
}

/**
 * Get comprehensive haptic feedback settings
 */
export function getHapticFeedbackSettings(
  dragSpeed: number,
  entryDensity: EntryDensityInfo,
  distanceToFret: number,
  direction: 'next' | 'prev' | null,
  profile: DragBehaviorProfile | null
): HapticFeedbackSettings {
  return {
    blipFrequency: getAdaptiveBlipFrequency(dragSpeed),
    blipVolumeMultiplier: getAdaptiveBlipVolume(entryDensity, distanceToFret, profile),
    blipPitchOffset: getAdaptiveBlipPitch(dragSpeed, direction, entryDensity),
    resistanceMultiplier: entryDensity.resistanceMultiplier,
  };
}

