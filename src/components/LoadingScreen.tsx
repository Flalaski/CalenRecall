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

// Generate organic tree-web branches like mammary veins for infinity symbol
// Each branch represents a possibility/potential in time
// Returns branches with positions for entry ornaments
function generateInfinityBranches() {
  const branches: Array<{ 
    path: string; 
    delay: number; 
    duration: number; 
    thickness: number;
    points: Array<{ x: number; y: number; t: number }>; // Points along branch for ornaments
  }> = [];
  
  // Helper to create organic branching path (like veins) and collect points for ornaments
  const createVeinBranch = (
    startX: number, 
    startY: number, 
    angle: number, 
    length: number, 
    depth: number,
    maxDepth: number = 3,
    points: Array<{ x: number; y: number; t: number }> = []
  ): { path: string; points: Array<{ x: number; y: number; t: number }> } => {
    if (depth > maxDepth) return { path: '', points };
    
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    
    // Main branch
    let path = `M ${startX} ${startY} L ${endX} ${endY}`;
    
    // Add points along main branch for ornaments (every 20% of length)
    for (let t = 0.2; t < 1; t += 0.2) {
      const px = startX + (endX - startX) * t;
      const py = startY + (endY - startY) * t;
      points.push({ x: px, y: py, t: depth + t });
    }
    
    // Create 2-3 sub-branches (like vein bifurcations)
    const numBranches = depth === 0 ? 3 : 2;
    for (let i = 0; i < numBranches; i++) {
      const branchAngle = angle + (i - 1) * 0.6 + (Math.random() - 0.5) * 0.4;
      const branchLength = length * (0.5 + Math.random() * 0.3);
      const branchStartT = 0.3 + Math.random() * 0.4; // Start branching partway along
      const branchStartX = startX + (endX - startX) * branchStartT;
      const branchStartY = startY + (endY - startY) * branchStartT;
      
      const subBranch = createVeinBranch(branchStartX, branchStartY, branchAngle, branchLength, depth + 1, maxDepth, points);
      path += subBranch.path;
    }
    
    return { path, points };
  };
  
  // Left half branches (past/potential past) - emanating from left loop
  for (let i = 0; i < 16; i++) {
    const baseAngle = (i / 16) * Math.PI * 2;
    const startX = 200;
    const startY = 200;
    const length = 25 + Math.random() * 35;
    
    const branchPoints: Array<{ x: number; y: number; t: number }> = [];
    const { path, points } = createVeinBranch(startX, startY, baseAngle, length, 0, 3, branchPoints);
    
    branches.push({
      path,
      delay: i * 0.08,
      duration: 2.5 + Math.random() * 1.5,
      thickness: 1.5 + Math.random() * 0.5,
      points: points,
    });
  }
  
  // Right half branches (future/potential future) - emanating from right loop
  for (let i = 0; i < 16; i++) {
    const baseAngle = (i / 16) * Math.PI * 2;
    const startX = 300;
    const startY = 200;
    const length = 25 + Math.random() * 35;
    
    const branchPoints: Array<{ x: number; y: number; t: number }> = [];
    const { path, points } = createVeinBranch(startX, startY, baseAngle, length, 0, 3, branchPoints);
    
    branches.push({
      path,
      delay: i * 0.08 + 0.6, // Offset from left half for polarity shift
      duration: 2.5 + Math.random() * 1.5,
      thickness: 1.5 + Math.random() * 0.5,
      points: points,
    });
  }
  
  return branches;
}

// Map entries to branch positions based on their timeline position
// Past entries go on left branches, future entries on right branches
function mapEntriesToBranches(
  entries: JournalEntry[],
  branches: Array<{ points: Array<{ x: number; y: number; t: number }> }>
): Array<{ entry: JournalEntry; x: number; y: number; branchIndex: number }> {
  if (entries.length === 0 || branches.length === 0) return [];
  
  const now = new Date();
  const nowTime = now.getTime();
  
  // Sort entries by date for timeline ordering
  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = parseISODate(a.date).getTime();
    const dateB = parseISODate(b.date).getTime();
    return dateA - dateB;
  });
  
  // Separate past and future entries
  const pastEntries = sortedEntries.filter(entry => {
    const entryTime = parseISODate(entry.date).getTime();
    return entryTime <= nowTime;
  });
  const futureEntries = sortedEntries.filter(entry => {
    const entryTime = parseISODate(entry.date).getTime();
    return entryTime > nowTime;
  });
  
  // Collect branch points - left branches (0-15) for past, right branches (16-31) for future
  const leftBranchPoints: Array<{ x: number; y: number; branchIndex: number; t: number }> = [];
  const rightBranchPoints: Array<{ x: number; y: number; branchIndex: number; t: number }> = [];
  
  branches.forEach((branch, branchIdx) => {
    branch.points.forEach(point => {
      if (branchIdx < 16) {
        leftBranchPoints.push({ ...point, branchIndex: branchIdx });
      } else {
        rightBranchPoints.push({ ...point, branchIndex: branchIdx });
      }
    });
  });
  
  // Map past entries to left branches
  const entryOrnaments: Array<{ entry: JournalEntry; x: number; y: number; branchIndex: number }> = [];
  
  pastEntries.forEach((entry, entryIdx) => {
    if (entryIdx < leftBranchPoints.length) {
      const point = leftBranchPoints[entryIdx % leftBranchPoints.length];
      entryOrnaments.push({
        entry,
        x: point.x,
        y: point.y,
        branchIndex: point.branchIndex,
      });
    }
  });
  
  // Map future entries to right branches
  futureEntries.forEach((entry, entryIdx) => {
    if (entryIdx < rightBranchPoints.length) {
      const point = rightBranchPoints[entryIdx % rightBranchPoints.length];
      entryOrnaments.push({
        entry,
        x: point.x,
        y: point.y,
        branchIndex: point.branchIndex,
      });
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

// Generate dithered nebula noise pattern
function generateNebulaPattern(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
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
}

export default function LoadingScreen({ progress, message = 'Loading your journal...' }: LoadingScreenProps) {
  const { entries } = useEntries();
  const [polarityPhase, setPolarityPhase] = useState(0);
  const [stars] = useState(() => generateStars(200));
  const [nebulaPattern, setNebulaPattern] = useState<string>('');

  // Generate branches with entry positions
  const branches = useMemo(() => generateInfinityBranches(), []);
  
  // Map entries to branch positions as ornaments
  const entryOrnaments = useMemo(() => {
    return mapEntriesToBranches(entries, branches);
  }, [entries, branches]);
  
  // Calculate how many entries to show based on progress
  // Use a smoother curve so entries appear more gradually
  const visibleEntries = useMemo(() => {
    if (progress === undefined) return entryOrnaments;
    if (entryOrnaments.length === 0) return [];
    
    // Use easing function for gradual appearance
    // Progress 0-100 maps to entries 0-total
    let easedProgress: number;
    if (progress < 20) {
      // First 20% of progress shows 5% of entries (slow start)
      easedProgress = (progress / 20) * 0.05;
    } else if (progress < 80) {
      // Next 60% of progress shows 80% of entries (main loading)
      easedProgress = 0.05 + ((progress - 20) / 60) * 0.80;
    } else {
      // Final 20% of progress shows remaining 15% of entries (completion)
      easedProgress = 0.85 + ((progress - 80) / 20) * 0.15;
    }
    
    const count = Math.floor(easedProgress * entryOrnaments.length);
    return entryOrnaments.slice(0, Math.max(0, count));
  }, [entryOrnaments, progress]);

  useEffect(() => {
    // Generate nebula pattern once
    const pattern = generateNebulaPattern(800, 600);
    setNebulaPattern(pattern);
    
    const interval = setInterval(() => {
      setPolarityPhase(prev => (prev + 0.01) % (Math.PI * 2));
    }, 16); // ~60fps
    return () => clearInterval(interval);
  }, []);

  // Infinity symbol path (∞) - proper mathematical infinity curve
  const infinityPath = `
    M 150 200
    C 150 150, 180 150, 200 175
    C 220 200, 230 200, 250 200
    C 270 200, 280 200, 300 175
    C 320 150, 350 150, 350 200
    C 350 250, 320 250, 300 225
    C 280 200, 270 200, 250 200
    C 230 200, 220 200, 200 225
    C 180 250, 150 250, 150 200
    Z
  `;

  // Calculate polarity colors (shifts between two poles)
  const leftColor = `hsl(${200 + Math.sin(polarityPhase) * 60}, 70%, ${50 + Math.sin(polarityPhase) * 20}%)`;
  const rightColor = `hsl(${300 + Math.cos(polarityPhase) * 60}, 70%, ${50 + Math.cos(polarityPhase) * 20}%)`;

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
          <div className="infinity-3d-container">
            <svg 
              className="infinity-time-mesh infinity-3d-layer infinity-layer-front" 
              viewBox="0 0 500 400" 
              width="500" 
              height="400"
              xmlns="http://www.w3.org/2000/svg"
            >
            <defs>
              <linearGradient id="infinityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={leftColor} />
                <stop offset="50%" stopColor="rgba(255, 255, 255, 0.3)" />
                <stop offset="100%" stopColor={rightColor} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Infinity symbol core */}
            <path
              className="infinity-core"
              d={infinityPath}
              fill="none"
              stroke="url(#infinityGradient)"
              strokeWidth="3"
              filter="url(#glow)"
            />
            
            {/* Left half tree-web branches (past/potential) */}
            <g className="infinity-branches-left">
              {branches.slice(0, 16).map((branch, idx) => (
                <path
                  key={`left-${idx}`}
                  className="time-branch time-branch-left"
                  d={branch.path}
                  fill="none"
                  stroke={leftColor}
                  strokeWidth={branch.thickness}
                  opacity="0.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animationDelay: `${branch.delay}s`,
                    animationDuration: `${branch.duration}s`,
                  }}
                />
              ))}
            </g>
            
            {/* Right half tree-web branches (future/potential) */}
            <g className="infinity-branches-right">
              {branches.slice(16, 32).map((branch, idx) => (
                <path
                  key={`right-${idx}`}
                  className="time-branch time-branch-right"
                  d={branch.path}
                  fill="none"
                  stroke={rightColor}
                  strokeWidth={branch.thickness}
                  opacity="0.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animationDelay: `${branch.delay}s`,
                    animationDuration: `${branch.duration}s`,
                  }}
                />
              ))}
            </g>
            
            {/* Entry ornaments - colored pixels on branches */}
            <g className="entry-ornaments">
              {visibleEntries.map(({ entry, x, y, branchIndex }, idx) => {
                const entryColor = calculateEntryColor(entry);
                // Stagger appearance based on index for smoother progression
                const delay = Math.min(idx * 0.01, 2); // Cap delay at 2s
                return (
                  <circle
                    key={`ornament-${entry.id || entry.date}-${branchIndex}-${idx}`}
                    className="entry-ornament"
                    cx={x}
                    cy={y}
                    r="3"
                    fill={entryColor}
                    opacity="1"
                    style={{
                      animation: `ornamentAppear 0.6s ease-out ${delay}s both`,
                    }}
                  />
                );
              })}
            </g>
            
          </svg>
          
          {/* Middle layer for depth */}
          <svg 
            className="infinity-time-mesh infinity-3d-layer infinity-layer-middle" 
            viewBox="0 0 500 400" 
            width="500" 
            height="400"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="infinityGradientMiddle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={leftColor} stopOpacity="0.6" />
                <stop offset="50%" stopColor="rgba(255, 255, 255, 0.2)" />
                <stop offset="100%" stopColor={rightColor} stopOpacity="0.6" />
              </linearGradient>
              <filter id="glowMiddle">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <path
              className="infinity-core"
              d={infinityPath}
              fill="none"
              stroke="url(#infinityGradientMiddle)"
              strokeWidth="2.5"
              filter="url(#glowMiddle)"
              opacity="0.7"
            />
          </svg>
          
          {/* Back layer for depth */}
          <svg 
            className="infinity-time-mesh infinity-3d-layer infinity-layer-back" 
            viewBox="0 0 500 400" 
            width="500" 
            height="400"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="infinityGradientBack" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={leftColor} stopOpacity="0.4" />
                <stop offset="50%" stopColor="rgba(255, 255, 255, 0.15)" />
                <stop offset="100%" stopColor={rightColor} stopOpacity="0.4" />
              </linearGradient>
              <filter id="glowBack">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <path
              className="infinity-core"
              d={infinityPath}
              fill="none"
              stroke="url(#infinityGradientBack)"
              strokeWidth="2"
              filter="url(#glowBack)"
              opacity="0.5"
            />
          </svg>
          
          {/* Unified singularity point - exists in all layers at same 3D position */}
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

