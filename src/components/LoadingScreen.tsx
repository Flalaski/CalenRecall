import { useEffect, useState, useMemo, useCallback } from 'react';
import { useEntries } from '../contexts/EntriesContext';
import { JournalEntry } from '../types';
import { calculateEntryColor } from '../utils/entryColorUtils';
import { parseISODate } from '../utils/dateUtils';
import './LoadingScreen.css';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
}

// Constants for loading screen configuration
const LOADING_SCREEN_CONSTANTS = {
  LEFT_LOOP_CENTER: { x: 200, y: 200 },
  RIGHT_LOOP_CENTER: { x: 300, y: 200 },
  MIDPOINT_X: 250,
  INFINITY_AMPLITUDE: 111,
  INFINITY_SEGMENTS: 24,
  BRANCHES_PER_SIDE: 8,
  STAR_COUNT: 216,
  NEBULA_DIMENSIONS: { width: 800, height: 600 },
  PROGRESS_THRESHOLDS: { slow: 20, fast: 80 },
  PROGRESS_PERCENTAGES: { slow: 0.05, fast: 0.80, finish: 0.15 },
  ORNAMENT_SIZE: 8,
  MAX_ANIMATION_DELAY: 1,
  OPACITY_DIVISORS: { infinity: 100, branch: 150 },
  ANIMATION_INTERVAL_MS: 13, // ~60fps
  POLARITY_PHASE_INCREMENT: 0.112358,
  CAMERA_ZOOM: 1.5, // Higher = more zoomed in (1.0 = normal, 2.0 = 2x zoom, 0.5 = zoomed out)
  CAMERA_DISTANCE: -200, // translateZ offset for camera position (negative = closer, positive = farther) - closer for better view
  CAMERA_ROTATE_X: 0, // Rotation around X axis (degrees) - 0 for straight on (no tilt)
  CAMERA_ROTATE_Y: 0, // Rotation around Y axis (degrees) - 0 for straight on front view
  SINGULARITY_CENTER: { x: 250, y: 200 }, // Center singularity point representing present moment
  TEMPORAL_DISTANCE_SCALE: 0.8888888888888888, // How much temporal distance affects spatial position (0-1 blend factor)
  MAX_TEMPORAL_DISTANCE_DAYS: 365 * 100, // 100 years - maximum temporal distance for scaling
} as const;

// Generate 3D positioned branch segments for true 3D structure
// Each segment is a 3D line element positioned in space
interface BranchSegment3D {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  thickness: number;
  color: string;
  delay: number;
  duration: number;
  points: Array<{ x: number; y: number; z: number }>; // 3D points for ornaments
  isPastBranch?: boolean; // Track branch type to prevent cross-boundary rendering
}

function generateInfinityBranches3D(): Array<BranchSegment3D> {
  const segments: Array<BranchSegment3D> = [];
  
  // Fractal interpolation function for mathematically perfect smooth curves
  const fractalInterpolate = (
    p0: { x: number; y: number; z: number },
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
    t: number
  ): { x: number; y: number; z: number } => {
    // Quadratic Bezier interpolation for smooth fractal curves
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
      z: mt * mt * p0.z + 2 * mt * t * p1.z + t * t * p2.z,
    };
  };

  // Helper to create 3D branch segments with fractal interpolation for perfect connections
  // Branches curve to form infinity symbol shape: past curves left, future curves right
  const createVeinBranch3D = (
    startX: number, 
    startY: number,
    startZ: number,
    angle: number, 
    length: number, 
    depth: number,
    maxDepth: number = 3,
    baseColor: string,
    delay: number,
    isPastBranch?: boolean // Track if this is a past branch for infinity curve shaping
  ): { segments: BranchSegment3D[]; points: Array<{ x: number; y: number; z: number }> } => {
    if (depth > maxDepth) return { segments: [], points: [] };
    
    // Constrain branches to their respective sides to prevent infiltration
    const branchMidpoint = LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
    const bufferZone = 30; // Minimum distance from midpoint to prevent crossing
    
    // Calculate endpoint with mathematical precision
    let endX = startX + Math.cos(angle) * length;
    let endY = startY + Math.sin(angle) * length;
    
    if (isPastBranch !== undefined) {
      // Past branches must stay on left side (x < branchMidpoint)
      if (isPastBranch && endX > branchMidpoint - bufferZone) {
        // Redirect endpoint to stay on left side
        const maxX = branchMidpoint - bufferZone;
        const distanceFromStart = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        if (distanceFromStart > 0) {
          const ratio = Math.abs((maxX - startX) / (endX - startX));
          endX = Math.min(endX, maxX);
          endY = startY + (endY - startY) * ratio;
        } else {
          endX = Math.min(endX, maxX);
        }
      }
      // Future branches must stay on right side (x > branchMidpoint)
      else if (!isPastBranch && endX < branchMidpoint + bufferZone) {
        // Redirect endpoint to stay on right side
        const minX = branchMidpoint + bufferZone;
        const distanceFromStart = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        if (distanceFromStart > 0) {
          const ratio = Math.abs((minX - startX) / (endX - startX));
          endX = Math.max(endX, minX);
          endY = startY + (endY - startY) * ratio;
        } else {
          endX = Math.max(endX, minX);
        }
      }
    }
    
    // Vary Z depth based on branch depth for 3D structure (reduced variation for less explosion)
    const zVariation = depth === 0 ? 36 : 18; // Reduced Z variation: 36 for primary, 18 for sub-branches
    const endZ = startZ + (Math.random() - 0.5) * zVariation;
    
    // Create control point for fractal interpolation (midpoint with slight offset)
    // For infinity symbol shaping: past branches curve left, future curve right
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const midZ = (startZ + endZ) / 2;
    
    // Determine curve direction based on branch type and depth
    // Primary branches (depth 0) curve more strongly toward infinity loops
    // Past branches curve leftward (toward negative X), future curve rightward (toward positive X)
    const perpAngle = angle + Math.PI / 2;
    let curveDirection = 1; // Default perpendicular
    if (isPastBranch !== undefined && depth === 0) {
      // Past branches curve left (toward left loop), future curve right (toward right loop)
      curveDirection = isPastBranch ? 1 : -1;
    } else if (isPastBranch !== undefined) {
      // Sub-branches maintain parent direction with moderate strength
      curveDirection = isPastBranch ? 0.4 : -0.4; // Moderate curve for organized flow
    }
    // Stronger curve for primary branches to shape infinity symbol
    // Moderate curve for sub-branches - organized but still flowing
    const curveStrength = depth === 0 ? 0.3 : 0.12; // Moderate curve for sub-branches
    const offset = length * curveStrength * (depth + 1) * 0.3 * curveDirection;
    let controlX = midX + Math.cos(perpAngle) * offset;
    const controlY = midY + Math.sin(perpAngle) * offset;
    const controlZ = midZ;
    
    // CRITICAL FIX: Constrain control point to prevent curve from crossing midpoint
    // The control point determines curve shape, so it must also respect boundaries
    if (isPastBranch !== undefined) {
      if (isPastBranch && controlX > branchMidpoint - bufferZone) {
        // Control point must stay on left side
        controlX = Math.min(controlX, branchMidpoint - bufferZone);
      } else if (!isPastBranch && controlX < branchMidpoint + bufferZone) {
        // Control point must stay on right side
        controlX = Math.max(controlX, branchMidpoint + bufferZone);
      }
    }
    
    const points: Array<{ x: number; y: number; z: number }> = [];
    
    // Fractal interpolation: create smooth curve with multiple points
    // CRITICAL FIX: Validate all interpolated points to prevent crossing midpoint
    const numInterpolationPoints = 5;
    for (let i = 0; i <= numInterpolationPoints; i++) {
      const t = i / numInterpolationPoints;
      let interpolated = fractalInterpolate(
        { x: startX, y: startY, z: startZ },
        { x: controlX, y: controlY, z: controlZ },
        { x: endX, y: endY, z: endZ },
        t
      );
      
      // Constrain interpolated point to correct side
      if (isPastBranch !== undefined && t > 0 && t < 1) {
        if (isPastBranch && interpolated.x > branchMidpoint - bufferZone) {
          interpolated.x = Math.min(interpolated.x, branchMidpoint - bufferZone);
        } else if (!isPastBranch && interpolated.x < branchMidpoint + bufferZone) {
          interpolated.x = Math.max(interpolated.x, branchMidpoint + bufferZone);
        }
        points.push(interpolated);
      }
    }
    
    // Create main branch segment with extended endpoint to close gaps
    // Extend segment slightly beyond endpoint to ensure perfect connection
    // CRITICAL FIX: Don't extend if it would cross the midpoint boundary
    const extensionFactor = 1.01; // 1% extension to close gaps
    let extendedEndX = startX + (endX - startX) * extensionFactor;
    let extendedEndY = startY + (endY - startY) * extensionFactor;
    const extendedEndZ = startZ + (endZ - startZ) * extensionFactor;
    
    // Constrain extended endpoint to prevent crossing boundary
    if (isPastBranch !== undefined) {
      if (isPastBranch && extendedEndX > branchMidpoint - bufferZone) {
        extendedEndX = Math.min(extendedEndX, branchMidpoint - bufferZone);
      } else if (!isPastBranch && extendedEndX < branchMidpoint + bufferZone) {
        extendedEndX = Math.max(extendedEndX, branchMidpoint + bufferZone);
      }
    }
    
    const segment: BranchSegment3D = {
      startX,
      startY,
      startZ,
      endX: extendedEndX,
      endY: extendedEndY,
      endZ: extendedEndZ,
      thickness: Math.max(1, 2 - depth * 0.3), // Ensure minimum thickness for visibility
      color: baseColor,
      delay: delay + depth * 0.1,
      duration: 2.5 + Math.random() * 1.5,
      points,
      isPastBranch, // Store branch type for correct color assignment during rendering
    };
    
    const allSegments = [segment];
    const allPoints = [...points];
    
    // Create many sub-branches that extend far, but with controlled organization
    // Ensure branches connect perfectly to parent segment endpoints
    const numBranches = depth === 0 ? 3 : (depth === 1 ? 2 : (depth === 2 ? 1 : 0)); // More branches, deeper levels
    const subBranchMidpoint = LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
    
    for (let i = 0; i < numBranches; i++) {
      // For first sub-branch, start at the exact end of parent segment to ensure connection
      // For subsequent branches, use fractal interpolation along the parent segment
      const branchStartT = i === 0 ? 1.0 : (0.4 + Math.random() * 0.3);
      
      // Use exact endpoint coordinates for first branch, fractal interpolation for others
      let branchStartX: number, branchStartY: number, branchStartZ: number;
      if (i === 0) {
        // Exact endpoint connection
        branchStartX = endX;
        branchStartY = endY;
        branchStartZ = endZ;
      } else {
        // Fractal interpolation along parent segment for smooth connection
        const parentControlX = (startX + endX) / 2;
        const parentControlY = (startY + endY) / 2;
        const parentControlZ = (startZ + endZ) / 2;
        const interpolated = fractalInterpolate(
          { x: startX, y: startY, z: startZ },
          { x: parentControlX, y: parentControlY, z: parentControlZ },
          { x: endX, y: endY, z: endZ },
          branchStartT
        );
        branchStartX = interpolated.x;
        branchStartY = interpolated.y;
        branchStartZ = interpolated.z;
      }
      
      // CRITICAL FIX: Constrain sub-branch start position to ensure it's on the correct side
      // Even with constrained parent endpoints, interpolated points could be near the boundary
      if (isPastBranch !== undefined) {
        if (isPastBranch && branchStartX > subBranchMidpoint - 20) {
          // Clamp to left side boundary
          branchStartX = Math.min(branchStartX, subBranchMidpoint - 20);
        } else if (!isPastBranch && branchStartX < subBranchMidpoint + 20) {
          // Clamp to right side boundary
          branchStartX = Math.max(branchStartX, subBranchMidpoint + 20);
        }
      }
      
      // Controlled angle spread - organized but still branching out
      let branchAngle = angle + (i - (numBranches - 1) / 2) * 0.4 + (Math.random() - 0.5) * 0.1; // Organized spread
      
      // Constrain sub-branch angles to keep them on their respective sides
      if (isPastBranch !== undefined) {
        // Calculate where this branch would end up
        const testLength = length * (0.6 + Math.random() * 0.3);
        const testEndX = branchStartX + Math.cos(branchAngle) * testLength * 0.8;
        
        // If past branch would cross to right side, redirect it left
        if (isPastBranch && testEndX > subBranchMidpoint - 20) {
          // Redirect toward left side - constrain angle to point leftward
          const targetAngle = Math.PI; // Point left (180 degrees)
          branchAngle = targetAngle + (Math.random() - 0.5) * 0.3; // Small variation around left
        }
        // If future branch would cross to left side, redirect it right
        else if (!isPastBranch && testEndX < subBranchMidpoint + 20) {
          // Redirect toward right side - constrain angle to point rightward
          const targetAngle = 0; // Point right (0 degrees)
          branchAngle = targetAngle + (Math.random() - 0.5) * 0.3; // Small variation around right
        }
      }
      
      // Longer sub-branches that extend far
      const branchLength = length * (0.6 + Math.random() * 0.3); // 60-90% of parent length - extends far
      
      const subBranch = createVeinBranch3D(
        branchStartX, 
        branchStartY, 
        branchStartZ,
        branchAngle, 
        branchLength, 
        depth + 1, 
        maxDepth,
        baseColor,
        delay + i * 0.05,
        isPastBranch // Pass down the branch type for consistent curvature
      );
      allSegments.push(...subBranch.segments);
      allPoints.push(...subBranch.points);
    }
    
    return { segments: allSegments, points: allPoints };
  };
  
  // Get theme colors for branches (called during generation, so we need to get them here)
  const getBranchThemeColor = (property: string, fallback: string): string => {
    if (typeof window === 'undefined' || !document.documentElement) {
      return fallback;
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
    return value || fallback;
  };

  // All branches start from singularity point (present moment) and branch outward
  // Forming a tree structure that abstractly shapes an infinity symbol
  const singularity = LOADING_SCREEN_CONSTANTS.SINGULARITY_CENTER;
  const totalBranches = LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE * 2;
  
  // Primary branches: half go left (past), half go right (future)
  // These will curve to form the infinity symbol shape
  for (let i = 0; i < totalBranches; i++) {
    const isPast = i < LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE;
    const branchIndex = isPast ? i : i - LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE;
    
    // Calculate initial angle: past branches start leftward, future branches start rightward
    // Wider spread for more branches, but still organized
    const angleSpread = Math.PI * 0.7; // Increased back to 0.7 (70% of circle) for more coverage
    const baseAngleOffset = isPast 
      ? Math.PI - angleSpread / 2 // Start pointing left (180° - spread/2)
      : -angleSpread / 2; // Start pointing right (0° - spread/2)
    
    // Distribute branches within the spread
    const normalizedIndex = branchIndex / LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE;
    const baseAngle = baseAngleOffset + normalizedIndex * angleSpread;
    
    // Controlled randomization - organized but with natural variation
    const angleVariation = (Math.random() - 0.5) * 0.2; // Moderate variation for natural look
    const finalAngle = baseAngle + angleVariation;
    
    // Start from singularity point
    const startX = singularity.x;
    const startY = singularity.y;
    const startZ = (Math.random() - 0.5) * 36; // Random Z depth around center
    
    // Initial branch length - longer to extend far
    const length = 120 + Math.random() * 40; // Increased from 90-110 to 120-160
    
    // Color based on time direction
    const baseColor = isPast
      ? getBranchThemeColor('--loading-past-color', 'hsl(270, 70%, 60%)')
      : getBranchThemeColor('--loading-future-color', 'hsl(45, 85%, 55%)');
    
    // Create primary branch with many sub-branches that extend far
    // Increased maxDepth to 3 for more branching, but with controlled organization
    const { segments: branchSegments } = createVeinBranch3D(
      startX, startY, startZ, finalAngle, length, 0, 3, baseColor, i * 0.08, isPast
    );
    
    segments.push(...branchSegments);
  }
  
  return segments;
}

// Map entries to random 3D positions throughout the tree like ornaments
// Past entries go on left side, future entries on right side
function mapEntriesToBranches3D(
  entries: JournalEntry[],
  branchSegments: Array<BranchSegment3D>
): Array<{ entry: JournalEntry; x: number; y: number; z: number; segmentIndex: number }> {
  if (entries.length === 0 || branchSegments.length === 0) return [];
  
  const now = new Date();
  const nowTime = now.getTime();
  
  // Sort entries by date for timeline ordering with error handling
  const sortedEntries = [...entries]
    .filter(entry => {
      // Validate entry has required fields
      if (!entry.date) {
        console.warn('Entry missing date field:', entry);
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      try {
        const dateA = parseISODate(a.date).getTime();
        const dateB = parseISODate(b.date).getTime();
        return dateA - dateB;
      } catch (error) {
        console.warn('Error sorting entries by date:', error);
        return 0; // Keep original order if parsing fails
      }
    });
  
  // Separate past and future entries with error handling
  const pastEntries = sortedEntries.filter(entry => {
    try {
      const entryTime = parseISODate(entry.date).getTime();
      return entryTime <= nowTime;
    } catch (error) {
      console.warn('Error parsing entry date:', entry.date, error);
      return false; // Skip invalid entries
    }
  });
  const futureEntries = sortedEntries.filter(entry => {
    try {
      const entryTime = parseISODate(entry.date).getTime();
      return entryTime > nowTime;
    } catch (error) {
      console.warn('Error parsing entry date:', entry.date, error);
      return false; // Skip invalid entries
    }
  });
  
  // Calculate tree bounds from all branch segments for random placement
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  branchSegments.forEach(segment => {
    minX = Math.min(minX, segment.startX, segment.endX);
    maxX = Math.max(maxX, segment.startX, segment.endX);
    minY = Math.min(minY, segment.startY, segment.endY);
    maxY = Math.max(maxY, segment.startY, segment.endY);
    minZ = Math.min(minZ, segment.startZ, segment.endZ);
    maxZ = Math.max(maxZ, segment.startZ, segment.endZ);
    
    // Also check points along segments
    segment.points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    });
  });
  
  // Add some padding to bounds
  const padding = 20;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;
  minZ -= padding;
  maxZ += padding;
  
  const midX = LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
  const singularityCenter = LOADING_SCREEN_CONSTANTS.SINGULARITY_CENTER;
  
  // Helper function to calculate temporal distance from present moment
  const getTemporalDistance = (entryDate: Date): number => {
    const timeDiff = Math.abs(now.getTime() - entryDate.getTime());
    return timeDiff / (1000 * 60 * 60 * 24); // Convert to days
  };
  
  // Helper function to normalize temporal distance (0 = present, 1 = max distance)
  const normalizeTemporalDistance = (days: number): number => {
    return Math.min(1, days / LOADING_SCREEN_CONSTANTS.MAX_TEMPORAL_DISTANCE_DAYS);
  };
  
  // Helper function to calculate spatial distance from center based on temporal distance
  const getSpatialDistanceFromCenter = (normalizedTemporalDist: number): number => {
    // Entries closer to present (smaller temporal distance) are closer to center
    // Entries further from present (larger temporal distance) are further from center
    const baseDistance = 30; // Minimum distance from center
    const maxDistance = Math.max(
      Math.abs(singularityCenter.x - minX),
      Math.abs(singularityCenter.x - maxX),
      Math.abs(singularityCenter.y - minY),
      Math.abs(singularityCenter.y - maxY)
    );
    return baseDistance + normalizedTemporalDist * (maxDistance - baseDistance);
  };
  
  // Generate random positions blended with temporal-distance-based positions
  const entryOrnaments: Array<{ entry: JournalEntry; x: number; y: number; z: number; segmentIndex: number }> = [];
  
  // Place past entries randomly on left side, blended with temporal distance from center
  pastEntries.forEach((entry, entryIdx) => {
    try {
      const entryDate = parseISODate(entry.date);
      const temporalDistDays = getTemporalDistance(entryDate);
      const normalizedTemporalDist = normalizeTemporalDistance(temporalDistDays);
      
      // Use entry index as seed for consistent but varied positioning
      const seed = entry.id || entryIdx;
      const rng = (seed: number) => {
        const x = Math.sin(seed * 12.9898) * 43758.5453;
        return x - Math.floor(x);
      };
      
      // Calculate angle for radial distribution from center (left side = 90-270 degrees)
      const angle = Math.PI + (rng(seed * 5) - 0.5) * Math.PI; // 180 degrees ± 90
      
      // Spatial distance from center based on temporal distance
      const spatialDist = getSpatialDistanceFromCenter(normalizedTemporalDist);
      
      // Temporal-based position (radial from center)
      const temporalX = singularityCenter.x + Math.cos(angle) * spatialDist;
      const temporalY = singularityCenter.y + Math.sin(angle) * spatialDist;
      const temporalZ = (rng(seed * 11) - 0.5) * (maxZ - minZ);
      
      // Random position on left side
      const randomX = minX + (midX - minX) * rng(seed * 3);
      const randomY = minY + (maxY - minY) * rng(seed * 7);
      const randomZ = minZ + (maxZ - minZ) * rng(seed * 11);
      
      // Blend temporal-based position with random position
      const blendFactor = LOADING_SCREEN_CONSTANTS.TEMPORAL_DISTANCE_SCALE;
      const x = temporalX * blendFactor + randomX * (1 - blendFactor);
      const y = temporalY * blendFactor + randomY * (1 - blendFactor);
      const z = temporalZ * blendFactor + randomZ * (1 - blendFactor);
      
      entryOrnaments.push({
        entry,
        x,
        y,
        z,
        segmentIndex: Math.floor(rng(seed * 13) * branchSegments.length),
      });
    } catch (error) {
      console.warn('Error processing entry for ornament placement:', entry.date, error);
    }
  });
  
  // Place future entries randomly on right side, blended with temporal distance from center
  futureEntries.forEach((entry, entryIdx) => {
    try {
      const entryDate = parseISODate(entry.date);
      const temporalDistDays = getTemporalDistance(entryDate);
      const normalizedTemporalDist = normalizeTemporalDistance(temporalDistDays);
      
      // Use entry index as seed for consistent but varied positioning
      const seed = entry.id || (entryIdx + pastEntries.length);
      const rng = (seed: number) => {
        const x = Math.sin(seed * 12.9898) * 43758.5453;
        return x - Math.floor(x);
      };
      
      // Calculate angle for radial distribution from center (right side = -90-90 degrees)
      const angle = (rng(seed * 5) - 0.5) * Math.PI; // 0 degrees ± 90
      
      // Spatial distance from center based on temporal distance
      const spatialDist = getSpatialDistanceFromCenter(normalizedTemporalDist);
      
      // Temporal-based position (radial from center)
      const temporalX = singularityCenter.x + Math.cos(angle) * spatialDist;
      const temporalY = singularityCenter.y + Math.sin(angle) * spatialDist;
      const temporalZ = (rng(seed * 11) - 0.5) * (maxZ - minZ);
      
      // Random position on right side
      const randomX = midX + (maxX - midX) * rng(seed * 3);
      const randomY = minY + (maxY - minY) * rng(seed * 7);
      const randomZ = minZ + (maxZ - minZ) * rng(seed * 11);
      
      // Blend temporal-based position with random position
      const blendFactor = LOADING_SCREEN_CONSTANTS.TEMPORAL_DISTANCE_SCALE;
      const x = temporalX * blendFactor + randomX * (1 - blendFactor);
      const y = temporalY * blendFactor + randomY * (1 - blendFactor);
      const z = temporalZ * blendFactor + randomZ * (1 - blendFactor);
      
      entryOrnaments.push({
        entry,
        x,
        y,
        z,
        segmentIndex: Math.floor(rng(seed * 13) * branchSegments.length),
      });
    } catch (error) {
      console.warn('Error processing entry for ornament placement:', entry.date, error);
    }
  });
  
  return entryOrnaments;
}

// Generate MS-DOS style starfield
function generateStars(count: number): Array<{ x: number; y: number; brightness: number; size: number }> {
  const stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      brightness: Math.floor(Math.random() * 4) + 1, // 1-4 brightness levels
      size: Math.random() < 0.1 ? 2 : 1, // 10% chance of larger star
    });
  }
  return stars;
}

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

// Helper function to parse HSL color string
function parseHSLColor(hsl: string): { h: number; s: number; l: number } | null {
  const match = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (!match) return null;
  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3])
  };
}

// Generate dithered nebula noise pattern with error handling
function generateNebulaPattern(width: number, height: number): string {
  try {
    // Get theme colors for nebula
    const getThemeColor = (property: string, fallback: string): string => {
      if (typeof window === 'undefined' || !document.documentElement) {
        return fallback;
      }
      const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
      return value || fallback;
    };

    const nebulaColor1Base = getThemeColor('--loading-nebula-color-1', 'hsl(270, 50%, 30%)');
    const nebulaColor2Base = getThemeColor('--loading-nebula-color-2', 'hsl(220, 60%, 40%)');
    
    // Parse theme colors
    const color1HSL = parseHSLColor(nebulaColor1Base);
    const color2HSL = parseHSLColor(nebulaColor2Base);
    
    // Convert to RGB with fallbacks (very dark colors, almost black)
    const color1 = color1HSL ? hslToRgb(color1HSL.h, color1HSL.s, color1HSL.l) : { r: 15, g: 8, b: 20 };
    const color2 = color2HSL ? hslToRgb(color2HSL.h, color2HSL.s, color2HSL.l) : { r: 10, g: 15, b: 25 };
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Failed to get canvas context for nebula pattern');
      return '';
    }
    
    // Create image data for pixel manipulation
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Generate noise-based nebula with dithering
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Multiple noise octaves for nebula structure with velvety dark noise
        const noise1 = Math.sin(x * 0.01 + y * 0.01) * 0.5 + 0.5;
        const noise2 = Math.sin(x * 0.03 + y * 0.02) * 0.5 + 0.5;
        const noise3 = Math.sin(x * 0.05 - y * 0.03) * 0.5 + 0.5;
        const darkNoise = Math.random() * 0.3; // Velvety dark noise (0-0.3)
        const combined = (noise1 * 0.4 + noise2 * 0.3 + noise3 * 0.2 + darkNoise * 0.1);
        
        // Blend between theme colors and darkness based on noise
        const blendFactor = combined;
        const darkFactor = 0.7; // Mix 70% darkness into the colors
        const baseR = color1.r * (1 - blendFactor) + color2.r * blendFactor;
        const baseG = color1.g * (1 - blendFactor) + color2.g * blendFactor;
        const baseB = color1.b * (1 - blendFactor) + color2.b * blendFactor;
        
        // Mix with velvety dark noise
        const r = Math.floor(baseR * (1 - darkFactor) + Math.random() * 5);
        const g = Math.floor(baseG * (1 - darkFactor) + Math.random() * 4);
        const b = Math.floor(baseB * (1 - darkFactor) + Math.random() * 6);
        
        data[index] = Math.min(30, Math.max(0, r));     // R - capped very low
        data[index + 1] = Math.min(25, Math.max(0, g)); // G - capped very low
        data[index + 2] = Math.min(35, Math.max(0, b)); // B - capped very low
        data[index + 3] = 255; // A
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  } catch (error) {
    console.error('Error generating nebula pattern:', error);
    return '';
  }
}


export default function LoadingScreen({ progress, message = 'Loading your journal...' }: LoadingScreenProps) {
  const { entries } = useEntries();
  const [polarityPhase, setPolarityPhase] = useState(0);
  const [rotationAngle, setRotationAngle] = useState(0); // Track infinity rotation angle
  const [stars] = useState(() => generateStars(LOADING_SCREEN_CONSTANTS.STAR_COUNT));
  const [nebulaPattern, setNebulaPattern] = useState<string>('');

  // Generate 3D branch segments
  const branchSegments3D = useMemo(() => generateInfinityBranches3D(), []);
  
  // Generate connection lines between branch segments to fill gaps (optimized)
  const branchConnections3D = useMemo(() => {
    const connections: Array<BranchSegment3D> = [];
    const tolerance = 12; // pixels - maximum gap to connect
    const maxConnections = 200; // Limit total connections for performance
    const processedPairs = new Set<string>(); // Avoid duplicate connections
    
    // Use spatial grid to reduce O(n²) to approximate O(n)
    const gridSize = 50; // Grid cell size
    const grid = new Map<string, BranchSegment3D[]>();
    
    // Build spatial grid
    branchSegments3D.forEach((segment) => {
      const gridX = Math.floor(segment.endX / gridSize);
      const gridY = Math.floor(segment.endY / gridSize);
      const key = `${gridX},${gridY}`;
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key)!.push(segment);
    });
    
    // For each segment, only check nearby grid cells
    branchSegments3D.forEach((segment) => {
      if (connections.length >= maxConnections) return; // Performance limit
      
      const gridX = Math.floor(segment.endX / gridSize);
      const gridY = Math.floor(segment.endY / gridSize);
      
      // Check current and adjacent grid cells only
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gridX + dx},${gridY + dy}`;
          const nearbySegments = grid.get(key);
          if (!nearbySegments) continue;
          
          nearbySegments.forEach((otherSegment) => {
            if (connections.length >= maxConnections) return;
            if (segment === otherSegment) return;
            
            // Quick distance check (avoid sqrt for performance)
            const distX = segment.endX - otherSegment.startX;
            const distY = segment.endY - otherSegment.startY;
            const distZ = segment.endZ - otherSegment.startZ;
            const distSq = distX * distX + distY * distY;
            const toleranceSq = tolerance * tolerance;
            
            // Create unique key for this pair
            const pairKey = segment.endX < otherSegment.startX 
              ? `${segment.endX},${segment.endY},${otherSegment.startX},${otherSegment.startY}`
              : `${otherSegment.startX},${otherSegment.startY},${segment.endX},${segment.endY}`;
            
            // If segments are close but not connected, create a connection line
            if (distSq > 1 && distSq < toleranceSq && Math.abs(distZ) < 80 && !processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              connections.push({
                startX: segment.endX,
                startY: segment.endY,
                startZ: segment.endZ,
                endX: otherSegment.startX,
                endY: otherSegment.startY,
                endZ: otherSegment.startZ,
                thickness: Math.min(segment.thickness, otherSegment.thickness) * 0.6,
                color: segment.color,
                delay: segment.delay,
                duration: segment.duration,
                points: [],
                // Preserve branch type from source segment for correct color assignment
                isPastBranch: segment.isPastBranch !== undefined 
                  ? segment.isPastBranch 
                  : (segment.startX < LOADING_SCREEN_CONSTANTS.MIDPOINT_X),
              });
            }
          });
        }
      }
    });
    
    return connections;
  }, [branchSegments3D]);
  
  // Calculate average Z depth of branch segments for relative displacement
  const averageBranchZ = useMemo(() => {
    if (branchSegments3D.length === 0) return 0;
    const sumZ = branchSegments3D.reduce((sum, seg) => sum + (seg.startZ + seg.endZ) / 2, 0);
    return sumZ / branchSegments3D.length;
  }, [branchSegments3D]);
  
  // Map entries to 3D branch positions as ornaments
  const entryOrnaments = useMemo(() => {
    return mapEntriesToBranches3D(entries, branchSegments3D);
  }, [entries, branchSegments3D]);
  
  // Calculate how many entries to show based on progress
  // Use a smoother curve so entries appear more gradually
  const visibleEntries = useMemo(() => {
    if (progress === undefined) return entryOrnaments;
    if (entryOrnaments.length === 0) return [];
    
    // Use easing function for gradual appearance
    // Progress 0-100 maps to entries 0-total
    let easedProgress: number;
    const { slow: slowThreshold, fast: fastThreshold } = LOADING_SCREEN_CONSTANTS.PROGRESS_THRESHOLDS;
    const { slow: slowPercent, fast: fastPercent, finish: finishPercent } = LOADING_SCREEN_CONSTANTS.PROGRESS_PERCENTAGES;
    
    if (progress < slowThreshold) {
      // First 20% of progress shows 5% of entries (slow start)
      easedProgress = (progress / slowThreshold) * slowPercent;
    } else if (progress < fastThreshold) {
      // Next 60% of progress shows 80% of entries (main loading)
      easedProgress = slowPercent + ((progress - slowThreshold) / (fastThreshold - slowThreshold)) * fastPercent;
    } else {
      // Final 20% of progress shows remaining 15% of entries (completion)
      easedProgress = (slowPercent + fastPercent) + ((progress - fastThreshold) / (100 - fastThreshold)) * finishPercent;
    }
    
    const count = Math.floor(easedProgress * entryOrnaments.length);
    return entryOrnaments.slice(0, Math.max(0, count));
  }, [entryOrnaments, progress]);

  useEffect(() => {
    // Generate nebula pattern once
    const pattern = generateNebulaPattern(
      LOADING_SCREEN_CONSTANTS.NEBULA_DIMENSIONS.width,
      LOADING_SCREEN_CONSTANTS.NEBULA_DIMENSIONS.height
    );
    setNebulaPattern(pattern);
    
    // Track infinity rotation angle (60 seconds per full rotation, mechanical ticks)
    const startTime = Date.now();
    const rotationInterval = setInterval(() => {
      // Calculate current rotation based on elapsed time (60s = 360deg, mechanical ticks)
      const elapsed = (Date.now() - startTime) / 1000; // Elapsed seconds
      const rotationSpeed = 360 / 60; // 6 degrees per second (1 tick per second)
      const currentAngle = (elapsed * rotationSpeed) % 360;
      setRotationAngle(currentAngle);
    }, 1000); // Update every second (each mechanical tick)
    
    const interval = setInterval(() => {
      setPolarityPhase(prev => (prev + LOADING_SCREEN_CONSTANTS.POLARITY_PHASE_INCREMENT) % (Math.PI * 2));
    }, LOADING_SCREEN_CONSTANTS.ANIMATION_INTERVAL_MS);
    
    return () => {
      clearInterval(interval);
      clearInterval(rotationInterval);
    };
  }, []);

  // Generate 3D infinity symbol segments with mathematically accurate polarity alternation
  const infinitySegments3D = useMemo(() => {
    const segments: Array<{
      x1: number; y1: number; z1: number;
      x2: number; y2: number; z2: number;
      z: number;
      t: number; // Store parametric parameter for polarity calculation
    }> = [];
    
    // Sample the infinity curve using proper parametric equation (lemniscate of Bernoulli)
    // Parametric form: x = a * cos(t) / (1 + sin²(t)), y = a * sin(t) * cos(t) / (1 + sin²(t))
    // Or alternative: x = a * sin(t), y = a * sin(t) * cos(t) / (1 + sin²(t))
    const sampleInfinityCurve = (t: number): { x: number; y: number } => {
      const a = LOADING_SCREEN_CONSTANTS.INFINITY_AMPLITUDE;
      const centerX = LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
      const centerY = LOADING_SCREEN_CONSTANTS.LEFT_LOOP_CENTER.y;
      const angle = t * Math.PI * 2; // t ∈ [0, 1] maps to angle ∈ [0, 2π]
      
      const sinT = Math.sin(angle);
      const cosT = Math.cos(angle);
      const sin2T = sinT * sinT;
      
      // Lemniscate parametric equations
      const x = a * sinT;
      const y = (a * sinT * cosT) / (1 + sin2T);
      
      return {
        x: centerX + x,
        y: centerY + y,
      };
    };
    
    // Polarity alternation is calculated in infinitySegmentColors useMemo
    // based on the parametric parameter t stored in each segment
    
    // Create segments with varying Z depth for true 3D structure
    // Use fractal interpolation for mathematically perfect smooth connections
    const numSegments = LOADING_SCREEN_CONSTANTS.INFINITY_SEGMENTS;
    for (let i = 0; i < numSegments; i++) {
      const t1 = i / numSegments;
      const t2 = (i + 1) / numSegments;
      const p1 = sampleInfinityCurve(t1);
      const p2 = sampleInfinityCurve(t2);
      
      // Vary Z depth along the curve - creates 3D depth
      const z1 = Math.sin(t1 * Math.PI * 4) * 25;
      const z2 = Math.sin(t2 * Math.PI * 4) * 25;
      
      // Extend segment slightly to close gaps between line tips
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const extensionFactor = 1.01; // 1% extension to ensure perfect connection
      const extendedX2 = p1.x + dx * extensionFactor;
      const extendedY2 = p1.y + dy * extensionFactor;
      
      // Store the parametric midpoint for polarity calculation
      const tMid = (t1 + t2) / 2;
      
      segments.push({
        x1: p1.x,
        y1: p1.y,
        z1: z1,
        x2: extendedX2,
        y2: extendedY2,
        z2: z2,
        z: (z1 + z2) / 2,
        t: tMid, // Store parametric parameter for polarity
      });
    }
    
    return segments;
  }, []);

  // Pre-calculate mathematically accurate polarity assignment based on parametric phase
  // Uses the lemniscate's parametric structure to determine alternating polarities
  const infinitySegmentColors = useMemo(() => {
    const assignments: boolean[] = []; // true = past/purple, false = future/golden
    
    // Assign polarity based on parametric parameter t (mathematically accurate)
    // The lemniscate has 4 distinct phases as t goes from 0 to 1
    // We alternate polarity: [past, future, past, future] for the 4 lobes
    infinitySegments3D.forEach((segment) => {
      // Use the stored parametric parameter t to determine polarity
      // Quadrants 0,2 = past (true), quadrants 1,3 = future (false)
      const quadrant = Math.floor(segment.t * 4) % 4;
      const isPast = quadrant % 2 === 0;
      assignments.push(isPast);
    });
    
    // Verify mathematical balance (should be exactly half each if numSegments is even)
    const pastCount = assignments.filter(a => a).length;
    const futureCount = assignments.length - pastCount;
    
    // If there's an imbalance due to rounding, adjust segments at phase boundaries
    const imbalance = pastCount - futureCount;
    if (Math.abs(imbalance) > 0) {
      // Find segments at phase boundaries (where t is close to 0.25, 0.5, 0.75, or 1.0)
      const phaseBoundaries = [0.25, 0.5, 0.75, 1.0];
      const boundarySegments = infinitySegments3D.map((seg, idx) => ({
        idx,
        t: seg.t,
        distToBoundary: Math.min(...phaseBoundaries.map(b => Math.abs(seg.t - b)))
      })).sort((a, b) => a.distToBoundary - b.distToBoundary);
      
      // Flip segments at boundaries to balance
      let flipsNeeded = Math.abs(imbalance);
      for (const { idx } of boundarySegments) {
        if (flipsNeeded === 0) break;
        if (imbalance > 0 && assignments[idx]) {
          assignments[idx] = false;
          flipsNeeded--;
        } else if (imbalance < 0 && !assignments[idx]) {
          assignments[idx] = true;
          flipsNeeded--;
        }
      }
    }
    
    return assignments;
  }, [infinitySegments3D]);

  // Get theme colors from CSS custom properties (memoized for performance)
  const themeColors = useMemo(() => {
    const getThemeColor = (property: string, fallback: string): string => {
      if (typeof window === 'undefined' || !document.documentElement) {
        return fallback;
      }
      const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
      return value || fallback;
    };

    const pastColorBase = getThemeColor('--loading-past-color', 'hsl(270, 70%, 60%)');
    const futureColorBase = getThemeColor('--loading-future-color', 'hsl(45, 85%, 55%)');
    
    // Parse HSL once
    const parseHSL = (hsl: string): { h: number; s: number; l: number } | null => {
      const match = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
      if (!match) return null;
      return {
        h: parseFloat(match[1]),
        s: parseFloat(match[2]),
        l: parseFloat(match[3])
      };
    };

    return {
      pastColorBase,
      futureColorBase,
      pastHSL: parseHSL(pastColorBase),
      futureHSL: parseHSL(futureColorBase),
    };
  }, []); // Only recalculate if theme changes (could add theme dependency)
  
  // Calculate polarity colors with phase animation (memoized per phase)
  const { leftColor, rightColor } = useMemo(() => {
    const pastHSL = themeColors.pastHSL;
    const futureHSL = themeColors.futureHSL;
    
    const left = pastHSL
      ? `hsl(${pastHSL.h + Math.sin(polarityPhase) * 20}, ${pastHSL.s}%, ${pastHSL.l + Math.sin(polarityPhase) * 20}%)`
      : themeColors.pastColorBase;
    
    const right = futureHSL
      ? `hsl(${futureHSL.h + Math.cos(polarityPhase) * 15}, ${futureHSL.s}%, ${futureHSL.l + Math.cos(polarityPhase) * 15}%)`
      : themeColors.futureColorBase;
    
    return { leftColor: left, rightColor: right };
  }, [polarityPhase, themeColors]);
  
  // Helper function to create cylindrical gradient from HSL color (with caching)
  const gradientCache = useMemo(() => new Map<string, string>(), []);
  const createCylindricalGradient = useCallback((hslColor: string): string => {
    // Cache gradients to avoid recalculating
    if (gradientCache.has(hslColor)) {
      return gradientCache.get(hslColor)!;
    }
    
    // Parse HSL color: hsl(h, s%, l%)
    const match = hslColor.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
    if (!match) {
      gradientCache.set(hslColor, hslColor);
      return hslColor; // Fallback if parsing fails
    }
    
    const h = parseFloat(match[1]);
    const s = parseFloat(match[2]);
    const l = parseFloat(match[3]);
    
    // Create highlight (lighter center) and shadow (darker edges) for cylindrical effect
    const highlightL = Math.min(100, l + 25); // Lighter center
    const shadowL = Math.max(0, l - 20); // Darker edges
    
    const highlightColor = `hsl(${h}, ${s}%, ${highlightL}%)`;
    const shadowColor = `hsl(${h}, ${s}%, ${shadowL}%)`;
    
    // Radial gradient: highlight in center, base color in middle, shadow on edges
    const gradient = `radial-gradient(ellipse at center, ${highlightColor} 0%, ${hslColor} 35%, ${shadowColor} 100%)`;
    gradientCache.set(hslColor, gradient);
    return gradient;
  }, [gradientCache]);

  return (
    <div className="loading-screen">
      {/* MS-DOS style deep space background */}
      <div className="space-background">
        {nebulaPattern && (
          <div 
            className="nebula-layer"
            style={{ backgroundImage: `url(${nebulaPattern})` }}
          />
        )}
        <div className="starfield">
          {stars.map((star, idx) => (
            <div
              key={idx}
              className="star"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.brightness * 0.25,
              }}
            />
          ))}
        </div>
      </div>
      <div className="loading-content">
        <div className="loading-logo">
            <div 
            className="camera-wrapper"
            style={{
              transform: `
                translateZ(${LOADING_SCREEN_CONSTANTS.CAMERA_DISTANCE}px) 
                rotateX(${LOADING_SCREEN_CONSTANTS.CAMERA_ROTATE_X}deg) 
                rotateY(${LOADING_SCREEN_CONSTANTS.CAMERA_ROTATE_Y}deg) 
                scale(${LOADING_SCREEN_CONSTANTS.CAMERA_ZOOM})
              `,
            }}
          >
            <div className="infinity-3d-container">
            {/* Unified 3D infinity structure - all elements positioned in 3D space */}
            
            {/* Infinity symbol core - 3D cylindrical forms - wrapped in rotating container */}
            <div className="infinity-rotating-wrapper">
            {infinitySegments3D.map((seg, idx) => {
              // Use pre-calculated balanced color assignment
              const isLeft = infinitySegmentColors[idx];
              const baseColor = isLeft ? leftColor : rightColor;
              const dx = seg.x2 - seg.x1;
              const dy = seg.y2 - seg.y1;
              // Calculate length with mathematical precision
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              // Interpolate Z depth smoothly along segment
              const avgZ = (seg.z1 + seg.z2) / 2;
              const segmentCenterX = (seg.x1 + seg.x2) / 2;
              const segmentCenterY = (seg.y1 + seg.y2) / 2;
              
              // Calculate gravitational pull from entry ornaments (optimized)
              // Each entry exerts a gravitational force on the infinity segment
              let gravitationalX = 0;
              let gravitationalY = 0;
              const gravitationalConstant = 0.8; // Strength of gravitational pull
              const maxGravitationalDistance = 888; // Maximum distance for gravitational effect
              const maxGravitationalDistanceSq = maxGravitationalDistance * maxGravitationalDistance; // Pre-calculate squared
              
              // Limit number of entries to check for performance
              const maxEntriesToCheck = 100;
              const entriesToCheck = visibleEntries.slice(0, maxEntriesToCheck);
              
              entriesToCheck.forEach(({ x: entryX, y: entryY }) => {
                // Calculate distance from segment center to entry (avoid sqrt until needed)
                const distX = entryX - segmentCenterX;
                const distY = entryY - segmentCenterY;
                const distance2DSq = distX * distX + distY * distY;
                
                // Only apply gravity if within range (using squared distance for performance)
                if (distance2DSq < maxGravitationalDistanceSq && distance2DSq > 0.1) {
                  // Inverse square law for gravitational pull (weakened for subtlety)
                  const gravitationalStrength = gravitationalConstant / (1 + distance2DSq / 1000);
                  const pullAngle = Math.atan2(distY, distX) * (180 / Math.PI);
                  
                  // Adjust pull direction based on rotation angle
                  const adjustedAngle = pullAngle + rotationAngle;
                  const angleRad = adjustedAngle * Math.PI / 180;
                  gravitationalX += gravitationalStrength * Math.cos(angleRad);
                  gravitationalY += gravitationalStrength * Math.sin(angleRad);
                }
              });
              
              // Combine with subtle relative displacement based on Z position relative to branch average
              const zRelativeToBranches = avgZ - averageBranchZ;
              const displacementScale = 0.12; // Subtle displacement factor
              // Perpendicular to segment, adjusted by current rotation angle
              const perpAngle = angle + 90 + rotationAngle; // Perpendicular to segment + rotation
              const parallaxX = zRelativeToBranches * displacementScale * Math.cos(perpAngle * Math.PI / 180);
              const parallaxY = zRelativeToBranches * displacementScale * Math.sin(perpAngle * Math.PI / 180);
              
              // Combine gravitational pull with parallax displacement
              const displacementX = gravitationalX + parallaxX;
              const displacementY = gravitationalY + parallaxY;
              
              // Ensure minimum opacity so segments remain visible and connected
              const baseOpacity = 0.4; // Semi-transparent
              const zOpacityFactor = Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.infinity;
              const finalOpacity = Math.max(0.2, baseOpacity - zOpacityFactor);
              
              // Create cylindrical gradient for thin cylinder appearance
              const cylindricalGradient = createCylindricalGradient(baseColor);
              
              // Cylinder dimensions - true 3D form
              const cylinderRadius = 1.112358; // Half of 3px diameter
              const cylinderLength = length;
              
              return (
                <div
                  key={`infinity-seg-${idx}`}
                  className="infinity-segment-3d-cylinder"
                  style={{
                    left: `${seg.x1}px`,
                    top: `${seg.y1}px`,
                    transform: `translateZ(${avgZ}px) translateX(${displacementX}px) translateY(${displacementY}px) rotateZ(${angle}deg)`,
                    opacity: finalOpacity,
                  }}
                >
                  {/* Cylinder body - main tube with 3D depth */}
                  <div 
                    className="cylinder-body"
                    style={{
                      width: `${cylinderLength}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: cylindricalGradient,
                      borderRadius: `${cylinderRadius}px`,
                      boxShadow: `inset 0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2), 0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.1)`,
                    }}
                  />
                  {/* Cylinder start cap - circular end facing viewer */}
                  <div 
                    className="cylinder-cap cylinder-cap-start"
                    style={{
                      width: `${cylinderRadius * 2}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: `radial-gradient(circle, ${baseColor}, ${baseColor}dd)`,
                      borderRadius: '50%',
                      transform: `translateX(-${cylinderRadius}px) translateZ(${cylinderRadius}px)`,
                      boxShadow: `0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2)`,
                    }}
                  />
                  {/* Cylinder end cap - circular end facing viewer */}
                  <div 
                    className="cylinder-cap cylinder-cap-end"
                    style={{
                      width: `${cylinderRadius * 2}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: `radial-gradient(circle, ${baseColor}, ${baseColor}dd)`,
                      borderRadius: '50%',
                      transform: `translateX(${cylinderLength - cylinderRadius}px) translateZ(${cylinderRadius}px)`,
                      boxShadow: `0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2)`,
                    }}
                  />
                </div>
              );
            })}
            </div>
            
            {/* Branch connection lines - fill gaps between segments */}
            {branchConnections3D.map((connection, idx) => {
              // CRITICAL FIX: Use stored isPastBranch flag if available, otherwise fall back to position check
              const isLeft = connection.isPastBranch !== undefined 
                ? connection.isPastBranch 
                : connection.startX < LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
              const color = isLeft ? leftColor : rightColor;
              // Calculate with mathematical precision
              const dx = connection.endX - connection.startX;
              const dy = connection.endY - connection.startY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              // Smooth Z interpolation along connection
              const avgZ = (connection.startZ + connection.endZ) / 2;
              
              // Ensure minimum opacity
              const baseOpacity = 0.3; // Slightly more transparent than main segments
              const zOpacityFactor = Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.branch;
              const finalOpacity = Math.max(0.12, baseOpacity - zOpacityFactor);
              
              // Create cylindrical gradient
              const cylindricalGradient = createCylindricalGradient(color);
              
              // Cylinder dimensions
              const cylinderRadius = connection.thickness / 2;
              const cylinderLength = length;
              
              return (
                <div
                  key={`branch-conn-${idx}`}
                  className="branch-segment-3d-cylinder"
                  style={{
                    left: `${connection.startX}px`,
                    top: `${connection.startY}px`,
                    transform: `translateZ(${avgZ}px) rotateZ(${angle}deg)`,
                    opacity: finalOpacity,
                    animationDelay: `${connection.delay}s`,
                    animationDuration: `${connection.duration}s`,
                  }}
                >
                  {/* Cylinder body */}
                  <div 
                    className="cylinder-body"
                    style={{
                      width: `${cylinderLength}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: cylindricalGradient,
                      borderRadius: `${cylinderRadius}px`,
                      boxShadow: `inset 0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2), 0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.1)`,
                    }}
                  />
                  {/* Cylinder start cap */}
                  <div 
                    className="cylinder-cap cylinder-cap-start"
                    style={{
                      width: `${cylinderRadius * 2}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: `radial-gradient(circle, ${color}, ${color}dd)`,
                      borderRadius: '50%',
                      transform: `translateX(-${cylinderRadius}px) translateZ(${cylinderRadius}px)`,
                      boxShadow: `0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2)`,
                    }}
                  />
                  {/* Cylinder end cap */}
                  <div 
                    className="cylinder-cap cylinder-cap-end"
                    style={{
                      width: `${cylinderRadius * 2}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: `radial-gradient(circle, ${color}, ${color}dd)`,
                      borderRadius: '50%',
                      transform: `translateX(${cylinderLength - cylinderRadius}px) translateZ(${cylinderRadius}px)`,
                      boxShadow: `0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2)`,
                    }}
                  />
                </div>
              );
            })}
            
            {/* Branch segments - 3D cylindrical forms */}
            {branchSegments3D.map((segment, idx) => {
              // CRITICAL FIX: Use stored isPastBranch flag if available, otherwise fall back to position check
              // This ensures future branches that start near the boundary still get the correct color
              const isLeft = segment.isPastBranch !== undefined 
                ? segment.isPastBranch 
                : segment.startX < LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
              const color = isLeft ? leftColor : rightColor;
              // Calculate with mathematical precision for perfect connections
              const dx = segment.endX - segment.startX;
              const dy = segment.endY - segment.startY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              // Smooth Z interpolation along segment
              const avgZ = (segment.startZ + segment.endZ) / 2;
              
              // Ensure minimum opacity so segments remain visible
              const baseOpacity = 0.35; // Semi-transparent
              const zOpacityFactor = Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.branch;
              const finalOpacity = Math.max(0.15, baseOpacity - zOpacityFactor);
              
              // Create cylindrical gradient for thin cylinder appearance
              const cylindricalGradient = createCylindricalGradient(color);
              
              // Cylinder dimensions - true 3D form
              const cylinderRadius = segment.thickness / 2;
              const cylinderLength = length;
              
              return (
                <div
                  key={`branch-seg-${idx}`}
                  className="branch-segment-3d-cylinder"
                  style={{
                    left: `${segment.startX}px`,
                    top: `${segment.startY}px`,
                    transform: `translateZ(${avgZ}px) rotateZ(${angle}deg)`,
                    opacity: finalOpacity,
                    animationDelay: `${segment.delay}s`,
                    animationDuration: `${segment.duration}s`,
                  }}
                >
                  {/* Cylinder body - main tube with 3D depth */}
                  <div 
                    className="cylinder-body"
                    style={{
                      width: `${cylinderLength}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: cylindricalGradient,
                      borderRadius: `${cylinderRadius}px`,
                      boxShadow: `inset 0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2), 0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.1)`,
                    }}
                  />
                  {/* Cylinder start cap - circular end facing viewer */}
                  <div 
                    className="cylinder-cap cylinder-cap-start"
                    style={{
                      width: `${cylinderRadius * 2}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: `radial-gradient(circle, ${color}, ${color}dd)`,
                      borderRadius: '50%',
                      transform: `translateX(-${cylinderRadius}px) translateZ(${cylinderRadius}px)`,
                      boxShadow: `0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2)`,
                    }}
                  />
                  {/* Cylinder end cap - circular end facing viewer */}
                  <div 
                    className="cylinder-cap cylinder-cap-end"
                    style={{
                      width: `${cylinderRadius * 2}px`,
                      height: `${cylinderRadius * 2}px`,
                      background: `radial-gradient(circle, ${color}, ${color}dd)`,
                      borderRadius: '50%',
                      transform: `translateX(${cylinderLength - cylinderRadius}px) translateZ(${cylinderRadius}px)`,
                      boxShadow: `0 0 ${cylinderRadius}px rgba(0, 0, 0, 0.2)`,
                    }}
                  />
                </div>
              );
            })}
            
            {/* Entry ornaments - 3D spherical forms */}
            {visibleEntries.map(({ entry, x, y, z }, idx) => {
              const entryColor = calculateEntryColor(entry);
              const delay = Math.min(idx * 0.01, LOADING_SCREEN_CONSTANTS.MAX_ANIMATION_DELAY);
              
              // Parse color for sphere gradient
              const sphereSize = LOADING_SCREEN_CONSTANTS.ORNAMENT_SIZE;
              
              return (
                <div
                  key={`ornament-${entry.id || entry.date}-${idx}`}
                  className="entry-ornament-3d-sphere"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: `translateZ(${z}px)`,
                    width: `${sphereSize}px`,
                    height: `${sphereSize}px`,
                    animation: `ornamentAppear 0.6s ease-out ${delay}s both`,
                  }}
                >
                  {/* Sphere outer shell with 3D lighting */}
                  <div 
                    className="sphere-shell"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6), ${entryColor} 50%, ${entryColor} 100%)`,
                      boxShadow: `inset -2px -2px 4px rgba(0, 0, 0, 0.3), inset 2px 2px 4px rgba(255, 255, 255, 0.2), 0 0 8px ${entryColor}`,
                    }}
                  />
                  {/* Sphere highlight for 3D depth */}
                  <div 
                    className="sphere-highlight"
                    style={{
                      width: '40%',
                      height: '40%',
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent)',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '20%',
                      left: '25%',
                    }}
                  />
                </div>
              );
            })}
            
          </div>
          </div>
        </div>
        <h1 className="loading-title">CalenRecall</h1>
        <p className="loading-message">{message}</p>
        {progress !== undefined && (
          <div className="loading-progress">
            <div className="loading-progress-bar">
              <div 
                className="loading-progress-fill" 
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              ></div>
            </div>
            <span className="loading-progress-text">{Math.round(progress)}%</span>
          </div>
        )}
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
      </div>
    </div>
  );
}

