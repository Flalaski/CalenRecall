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
  INFINITY_AMPLITUDE: 50,
  INFINITY_SEGMENTS: 120,
  BRANCHES_PER_SIDE: 16,
  STAR_COUNT: 200,
  NEBULA_DIMENSIONS: { width: 800, height: 600 },
  PROGRESS_THRESHOLDS: { slow: 20, fast: 80 },
  PROGRESS_PERCENTAGES: { slow: 0.05, fast: 0.80, finish: 0.15 },
  ORNAMENT_SIZE: 8,
  MAX_ANIMATION_DELAY: 2,
  OPACITY_DIVISORS: { infinity: 100, branch: 150 },
  ANIMATION_INTERVAL_MS: 16, // ~60fps
  POLARITY_PHASE_INCREMENT: 0.01,
  CAMERA_ZOOM: 11.0, // Higher = more zoomed in (1.0 = normal, 2.0 = 2x zoom, 0.5 = zoomed out)
  CAMERA_DISTANCE: 0, // translateZ offset for camera position (negative = closer, positive = farther)
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
  
  // Helper to create 3D branch segments (like veins)
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
    
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    // Vary Z depth based on branch depth for 3D structure
    const endZ = startZ + (Math.random() - 0.5) * 20 * (depth + 1);
    
    const points: Array<{ x: number; y: number; z: number }> = [];
    
    // Add points along main branch for ornaments (every 20% of length)
    for (let t = 0.2; t < 1; t += 0.2) {
      const px = startX + (endX - startX) * t;
      const py = startY + (endY - startY) * t;
      const pz = startZ + (endZ - startZ) * t;
      points.push({ x: px, y: py, z: pz });
    }
    
    // Create main branch segment
    const segment: BranchSegment3D = {
      startX,
      startY,
      startZ,
      endX,
      endY,
      endZ,
      thickness: 2 - depth * 0.3,
      color: baseColor,
      delay: delay + depth * 0.1,
      duration: 2.5 + Math.random() * 1.5,
      points,
    };
    
    const allSegments = [segment];
    const allPoints = [...points];
    
    // Create 2-3 sub-branches (like vein bifurcations)
    const numBranches = depth === 0 ? 3 : 2;
    for (let i = 0; i < numBranches; i++) {
      const branchAngle = angle + (i - 1) * 0.6 + (Math.random() - 0.5) * 0.4;
      const branchLength = length * (0.5 + Math.random() * 0.3);
      const branchStartT = 0.3 + Math.random() * 0.4;
      const branchStartX = startX + (endX - startX) * branchStartT;
      const branchStartY = startY + (endY - startY) * branchStartT;
      const branchStartZ = startZ + (endZ - startZ) * branchStartT;
      
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

// Map entries to 3D branch positions based on their timeline position
// Past entries go on left branches, future entries on right branches
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
  
  // Collect all 3D branch points - separate left and right segments
  const leftSegmentPoints: Array<{ x: number; y: number; z: number; segmentIndex: number }> = [];
  const rightSegmentPoints: Array<{ x: number; y: number; z: number; segmentIndex: number }> = [];
  
  // Find midpoint to separate left and right
  const midX = LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
  
  branchSegments.forEach((segment, segIdx) => {
    segment.points.forEach(point => {
      if (point.x < midX) {
        leftSegmentPoints.push({ ...point, segmentIndex: segIdx });
      } else {
        rightSegmentPoints.push({ ...point, segmentIndex: segIdx });
      }
    });
  });
  
  // Guard against empty point arrays to prevent issues
  if (leftSegmentPoints.length === 0 && rightSegmentPoints.length === 0) {
    return [];
  }
  
  // Map past entries to left branch points
  const entryOrnaments: Array<{ entry: JournalEntry; x: number; y: number; z: number; segmentIndex: number }> = [];
  
  if (leftSegmentPoints.length > 0) {
    pastEntries.forEach((entry, entryIdx) => {
      const point = leftSegmentPoints[entryIdx % leftSegmentPoints.length];
      entryOrnaments.push({
        entry,
        x: point.x,
        y: point.y,
        z: point.z,
        segmentIndex: point.segmentIndex,
      });
    });
  }
  
  // Map future entries to right branch points
  if (rightSegmentPoints.length > 0) {
    futureEntries.forEach((entry, entryIdx) => {
      const point = rightSegmentPoints[entryIdx % rightSegmentPoints.length];
      entryOrnaments.push({
        entry,
        x: point.x,
        y: point.y,
        z: point.z,
        segmentIndex: point.segmentIndex,
      });
    });
  }
  
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
    const numSegments = LOADING_SCREEN_CONSTANTS.INFINITY_SEGMENTS;
    for (let i = 0; i < numSegments; i++) {
      const t1 = i / numSegments;
      const t2 = (i + 1) / numSegments;
      const p1 = sampleInfinityCurve(t1);
      const p2 = sampleInfinityCurve(t2);
      
      // Vary Z depth along the curve - creates 3D depth
      const z1 = Math.sin(t1 * Math.PI * 4) * 25;
      const z2 = Math.sin(t2 * Math.PI * 4) * 25;
      
      segments.push({
        x1: p1.x,
        y1: p1.y,
        z1: z1,
        x2: p2.x,
        y2: p2.y,
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
              transformStyle: 'preserve-3d',
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
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const avgZ = (seg.z1 + seg.z2) / 2;
              
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
                    opacity: 0.8 - Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.infinity,
                  }}
                />
              );
            })}
            
            {/* Branch segments - 3D positioned */}
            {branchSegments3D.map((segment, idx) => {
              const isLeft = segment.startX < LOADING_SCREEN_CONSTANTS.MIDPOINT_X;
              const color = isLeft ? leftColor : rightColor;
              const dx = segment.endX - segment.startX;
              const dy = segment.endY - segment.startY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const avgZ = (segment.startZ + segment.endZ) / 2;
              
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
                    opacity: 0.7 - Math.abs(avgZ) / LOADING_SCREEN_CONSTANTS.OPACITY_DIVISORS.branch,
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
                    boxShadow: `0 0 4px ${entryColor}, 0 0 8px ${entryColor}`,
                    animation: `ornamentAppear 0.6s ease-out ${delay}s both`,
                  }}
                />
              );
            })}
            
            {/* Unified singularity point - centered in 3D space */}
            <div className="singularity-unified">
              <div className="singularity-core"></div>
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

