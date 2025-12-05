import { useEffect, useState, useMemo } from 'react';
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
  INFINITY_AMPLITUDE: 36.9,
  INFINITY_SEGMENTS: 42,
  BRANCHES_PER_SIDE: 12,
  STAR_COUNT: 216,
  NEBULA_DIMENSIONS: { width: 800, height: 600 },
  PROGRESS_THRESHOLDS: { slow: 20, fast: 80 },
  PROGRESS_PERCENTAGES: { slow: 0.05, fast: 0.80, finish: 0.15 },
  ORNAMENT_SIZE: 8,
  MAX_ANIMATION_DELAY: 2,
  OPACITY_DIVISORS: { infinity: 100, branch: 150 },
  ANIMATION_INTERVAL_MS: 16, // ~60fps
  POLARITY_PHASE_INCREMENT: 0.01,
  CAMERA_ZOOM: 3.0, // Higher = more zoomed in (1.0 = normal, 2.0 = 2x zoom, 0.5 = zoomed out)
  CAMERA_DISTANCE: 0, // translateZ offset for camera position (negative = closer, positive = farther)
  SINGULARITY_CENTER: { x: 250, y: 200 }, // Center singularity point representing present moment
  TEMPORAL_DISTANCE_SCALE: 0.5, // How much temporal distance affects spatial position (0-1 blend factor)
  MAX_TEMPORAL_DISTANCE_DAYS: 365 * 10, // 10 years - maximum temporal distance for scaling
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
  const createVeinBranch3D = (
    startX: number, 
    startY: number,
    startZ: number,
    angle: number, 
    length: number, 
    depth: number,
    maxDepth: number = 3,
    baseColor: string,
    delay: number
  ): { segments: BranchSegment3D[]; points: Array<{ x: number; y: number; z: number }> } => {
    if (depth > maxDepth) return { segments: [], points: [] };
    
    // Calculate endpoint with mathematical precision
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    // Vary Z depth based on branch depth for 3D structure
    const endZ = startZ + (Math.random() - 0.5) * 20 * (depth + 1);
    
    // Create control point for fractal interpolation (midpoint with slight offset)
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const midZ = (startZ + endZ) / 2;
    const perpAngle = angle + Math.PI / 2;
    const offset = length * 0.1 * (depth + 1) * 0.3;
    const controlX = midX + Math.cos(perpAngle) * offset;
    const controlY = midY + Math.sin(perpAngle) * offset;
    const controlZ = midZ;
    
    const points: Array<{ x: number; y: number; z: number }> = [];
    
    // Fractal interpolation: create smooth curve with multiple points
    const numInterpolationPoints = 5;
    for (let i = 0; i <= numInterpolationPoints; i++) {
      const t = i / numInterpolationPoints;
      const interpolated = fractalInterpolate(
        { x: startX, y: startY, z: startZ },
        { x: controlX, y: controlY, z: controlZ },
        { x: endX, y: endY, z: endZ },
        t
      );
      if (t > 0 && t < 1) {
        points.push(interpolated);
      }
    }
    
    // Create main branch segment with extended endpoint to close gaps
    // Extend segment slightly beyond endpoint to ensure perfect connection
    const extensionFactor = 1.01; // 1% extension to close gaps
    const extendedEndX = startX + (endX - startX) * extensionFactor;
    const extendedEndY = startY + (endY - startY) * extensionFactor;
    const extendedEndZ = startZ + (endZ - startZ) * extensionFactor;
    
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
    };
    
    const allSegments = [segment];
    const allPoints = [...points];
    
    // Create 2-3 sub-branches (like vein bifurcations) with fractal interpolation
    // Ensure branches connect perfectly to parent segment endpoints
    const numBranches = depth === 0 ? 3 : 2;
    for (let i = 0; i < numBranches; i++) {
      const branchAngle = angle + (i - 1) * 0.6 + (Math.random() - 0.5) * 0.4;
      const branchLength = length * (0.5 + Math.random() * 0.3);
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
      
      const subBranch = createVeinBranch3D(
        branchStartX, 
        branchStartY, 
        branchStartZ,
        branchAngle, 
        branchLength, 
        depth + 1, 
        maxDepth,
        baseColor,
        delay + i * 0.05
      );
      allSegments.push(...subBranch.segments);
      allPoints.push(...subBranch.points);
    }
    
    return { segments: allSegments, points: allPoints };
  };
  
  // Left half branches (past/potential past) - emanating from left loop - BLUE
  for (let i = 0; i < LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE; i++) {
    const baseAngle = (i / LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE) * Math.PI * 2;
    const startX = LOADING_SCREEN_CONSTANTS.LEFT_LOOP_CENTER.x;
    const startY = LOADING_SCREEN_CONSTANTS.LEFT_LOOP_CENTER.y;
    const startZ = (Math.random() - 0.5) * 30; // Random Z depth
    const length = 25 + Math.random() * 35;
    const baseColor = `hsl(200, 70%, 60%)`; // Blue for past
    
    const { segments: branchSegments } = createVeinBranch3D(
      startX, startY, startZ, baseAngle, length, 0, 3, baseColor, i * 0.08
    );
    
    segments.push(...branchSegments);
  }

  // Right half branches (future/potential future) - emanating from right loop - RED
  for (let i = 0; i < LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE; i++) {
    const baseAngle = (i / LOADING_SCREEN_CONSTANTS.BRANCHES_PER_SIDE) * Math.PI * 2;
    const startX = LOADING_SCREEN_CONSTANTS.RIGHT_LOOP_CENTER.x;
    const startY = LOADING_SCREEN_CONSTANTS.RIGHT_LOOP_CENTER.y;
    const startZ = (Math.random() - 0.5) * 30; // Random Z depth
    const length = 25 + Math.random() * 35;
    const baseColor = `hsl(0, 70%, 60%)`; // Red for future
    
    const { segments: branchSegments } = createVeinBranch3D(
      startX, startY, startZ, baseAngle, length, 0, 3, baseColor, i * 0.08 + 0.6
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

// Generate dithered nebula noise pattern with error handling
function generateNebulaPattern(width: number, height: number): string {
  try {
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
        
        // Multiple noise octaves for nebula structure
        const noise1 = Math.sin(x * 0.01 + y * 0.01) * 0.5 + 0.5;
        const noise2 = Math.sin(x * 0.03 + y * 0.02) * 0.5 + 0.5;
        const noise3 = Math.sin(x * 0.05 - y * 0.03) * 0.5 + 0.5;
        const combined = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2);
        
        // Dithering - convert to limited color palette (MS-DOS style)
        const dithered = Math.floor(combined * 16) / 16; // 16 levels
        
        // Deep space colors - dark purples, blues, blacks
        const r = Math.floor(dithered * 30 + Math.random() * 5); // 0-35
        const g = Math.floor(dithered * 20 + Math.random() * 5); // 0-25
        const b = Math.floor(dithered * 40 + Math.random() * 10); // 0-50
        
        data[index] = r;     // R
        data[index + 1] = g; // G
        data[index + 2] = b; // B
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
  const [stars] = useState(() => generateStars(LOADING_SCREEN_CONSTANTS.STAR_COUNT));
  const [nebulaPattern, setNebulaPattern] = useState<string>('');

  // Generate 3D branch segments
  const branchSegments3D = useMemo(() => generateInfinityBranches3D(), []);
  
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
    
    const interval = setInterval(() => {
      setPolarityPhase(prev => (prev + LOADING_SCREEN_CONSTANTS.POLARITY_PHASE_INCREMENT) % (Math.PI * 2));
    }, LOADING_SCREEN_CONSTANTS.ANIMATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Generate 3D infinity symbol segments
  const infinitySegments3D = useMemo(() => {
    const segments: Array<{
      x1: number; y1: number; z1: number;
      x2: number; y2: number; z2: number;
      z: number;
    }> = [];
    
    // Sample the infinity curve using proper parametric equation
    const sampleInfinityCurve = (t: number): { x: number; y: number } => {
      // Parametric infinity curve: x = a * sin(t), y = a * sin(t) * cos(t) / (1 + sin^2(t))
      const a = LOADING_SCREEN_CONSTANTS.INFINITY_AMPLITUDE;
      const centerX = LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
      const centerY = LOADING_SCREEN_CONSTANTS.LEFT_LOOP_CENTER.y;
      const angle = t * Math.PI * 2;
      
      const sinT = Math.sin(angle);
      const cosT = Math.cos(angle);
      const sin2T = sinT * sinT;
      
      const x = a * sinT;
      const y = (a * sinT * cosT) / (1 + sin2T);
      
      return {
        x: centerX + x,
        y: centerY + y,
      };
    };
    
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
      
      segments.push({
        x1: p1.x,
        y1: p1.y,
        z1: z1,
        x2: extendedX2,
        y2: extendedY2,
        z2: z2,
        z: (z1 + z2) / 2,
      });
    }
    
    return segments;
  }, []);

  // Calculate polarity colors (shifts between two poles)
  // Blue for past (left), Red for future (right)
  const leftColor = `hsl(${200 + Math.sin(polarityPhase) * 40}, 70%, ${50 + Math.sin(polarityPhase) * 20}%)`; // Blue (past)
  const rightColor = `hsl(${0 + Math.cos(polarityPhase) * 20}, 70%, ${50 + Math.cos(polarityPhase) * 20}%)`; // Red (future)

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
              transform: `translateZ(${LOADING_SCREEN_CONSTANTS.CAMERA_DISTANCE}px) scale(${LOADING_SCREEN_CONSTANTS.CAMERA_ZOOM})`,
            }}
          >
            <div className="infinity-3d-container">
            {/* Unified 3D infinity structure - all elements positioned in 3D space */}
            
            {/* Infinity symbol core - 3D line segments */}
            {infinitySegments3D.map((seg, idx) => {
              const isLeft = seg.x1 < LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
              const color = isLeft ? leftColor : rightColor;
              const dx = seg.x2 - seg.x1;
              const dy = seg.y2 - seg.y1;
              // Calculate length with mathematical precision
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              // Interpolate Z depth smoothly along segment
              const avgZ = (seg.z1 + seg.z2) / 2;
              
              // Ensure minimum opacity so segments remain visible and connected
              const baseOpacity = 0.9;
              const zOpacityFactor = Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.infinity;
              const finalOpacity = Math.max(0.4, baseOpacity - zOpacityFactor);
              
              return (
                <div
                  key={`infinity-seg-${idx}`}
                  className="infinity-segment-3d"
                  style={{
                    left: `${seg.x1}px`,
                    top: `${seg.y1}px`,
                    width: `${length}px`,
                    transform: `translateZ(${avgZ}px) rotateZ(${angle}deg)`,
                    background: `linear-gradient(to right, ${color}, ${isLeft ? rightColor : leftColor})`,
                    opacity: finalOpacity,
                  }}
                />
              );
            })}
            
            {/* Branch segments - 3D positioned */}
            {branchSegments3D.map((segment, idx) => {
              const isLeft = segment.startX < LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
              const color = isLeft ? leftColor : rightColor;
              // Calculate with mathematical precision for perfect connections
              const dx = segment.endX - segment.startX;
              const dy = segment.endY - segment.startY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              // Smooth Z interpolation along segment
              const avgZ = (segment.startZ + segment.endZ) / 2;
              
              // Ensure minimum opacity so segments remain visible
              const baseOpacity = 0.8;
              const zOpacityFactor = Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.branch;
              const finalOpacity = Math.max(0.3, baseOpacity - zOpacityFactor);
              
              return (
                <div
                  key={`branch-seg-${idx}`}
                  className="branch-segment-3d"
                  style={{
                    left: `${segment.startX}px`,
                    top: `${segment.startY}px`,
                    width: `${length}px`,
                    height: `${segment.thickness}px`,
                    transform: `translateZ(${avgZ}px) rotateZ(${angle}deg)`,
                    background: color,
                    opacity: finalOpacity,
                    animationDelay: `${segment.delay}s`,
                    animationDuration: `${segment.duration}s`,
                  }}
                />
              );
            })}
            
            {/* Entry ornaments - 3D positioned */}
            {visibleEntries.map(({ entry, x, y, z }, idx) => {
              const entryColor = calculateEntryColor(entry);
              const delay = Math.min(idx * 0.01, LOADING_SCREEN_CONSTANTS.MAX_ANIMATION_DELAY);
              
              return (
                <div
                  key={`ornament-${entry.id || entry.date}-${idx}`}
                  className="entry-ornament-3d"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: `translateZ(${z}px)`,
                    background: entryColor,
                    width: `${LOADING_SCREEN_CONSTANTS.ORNAMENT_SIZE}px`,
                    height: `${LOADING_SCREEN_CONSTANTS.ORNAMENT_SIZE}px`,
                    animation: `ornamentAppear 0.6s ease-out ${delay}s both`,
                  }}
                />
              );
            })}
            
            {/* Unified singularity point - pixelated star blast at center representing present moment */}
            <div className="singularity-unified">
              <div className="singularity-core">
                {/* Generate pixelated star blast - radiating points from center */}
                {Array.from({ length: 16 }, (_, i) => {
                  const angle = (i / 16) * Math.PI * 2;
                  const distance = 8 + (i % 3) * 3; // Vary distance for layered effect
                  const x = Math.cos(angle) * distance;
                  const y = Math.sin(angle) * distance;
                  const delay = (i % 4) * 0.2;
                  
                  return (
                    <div
                      key={`star-point-${i}`}
                      className="singularity-star-point"
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: `translate(-50%, -50%)`,
                        animationDelay: `${delay}s`,
                      }}
                    />
                  );
                })}
                {/* Additional inner layer for more density */}
                {Array.from({ length: 8 }, (_, i) => {
                  const angle = (i / 8) * Math.PI * 2 + Math.PI / 8; // Offset angle
                  const distance = 4;
                  const x = Math.cos(angle) * distance;
                  const y = Math.sin(angle) * distance;
                  
                  return (
                    <div
                      key={`star-point-inner-${i}`}
                      className="singularity-star-point"
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: `translate(-50%, -50%)`,
                        width: '1px',
                        height: '1px',
                        animationDelay: `${(i % 2) * 0.5}s`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="singularity-rings">
                <div className="singularity-ring ring-1"></div>
                <div className="singularity-ring ring-2"></div>
                <div className="singularity-ring ring-3"></div>
              </div>
            </div>
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

