import { useEffect, useState } from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
}

// Generate organic tree-web branches like mammary veins for infinity symbol
// Each branch represents a possibility/potential in time
function generateInfinityBranches() {
  const branches: Array<{ path: string; delay: number; duration: number; thickness: number }> = [];
  
  // Helper to create organic branching path (like veins)
  const createVeinBranch = (
    startX: number, 
    startY: number, 
    angle: number, 
    length: number, 
    depth: number,
    maxDepth: number = 3
  ): string => {
    if (depth > maxDepth) return '';
    
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    
    // Main branch
    let path = `M ${startX} ${startY} L ${endX} ${endY}`;
    
    // Create 2-3 sub-branches (like vein bifurcations)
    const numBranches = depth === 0 ? 3 : 2;
    for (let i = 0; i < numBranches; i++) {
      const branchAngle = angle + (i - 1) * 0.6 + (Math.random() - 0.5) * 0.4;
      const branchLength = length * (0.5 + Math.random() * 0.3);
      const branchStartT = 0.3 + Math.random() * 0.4; // Start branching partway along
      const branchStartX = startX + (endX - startX) * branchStartT;
      const branchStartY = startY + (endY - startY) * branchStartT;
      
      path += createVeinBranch(branchStartX, branchStartY, branchAngle, branchLength, depth + 1, maxDepth);
    }
    
    return path;
  };
  
  // Left half branches (past/potential past) - emanating from left loop
  for (let i = 0; i < 16; i++) {
    const baseAngle = (i / 16) * Math.PI * 2;
    const startX = 200;
    const startY = 200;
    const length = 25 + Math.random() * 35;
    
    const path = createVeinBranch(startX, startY, baseAngle, length, 0);
    
    branches.push({
      path,
      delay: i * 0.08,
      duration: 2.5 + Math.random() * 1.5,
      thickness: 1.5 + Math.random() * 0.5,
    });
  }
  
  // Right half branches (future/potential future) - emanating from right loop
  for (let i = 0; i < 16; i++) {
    const baseAngle = (i / 16) * Math.PI * 2;
    const startX = 300;
    const startY = 200;
    const length = 25 + Math.random() * 35;
    
    const path = createVeinBranch(startX, startY, baseAngle, length, 0);
    
    branches.push({
      path,
      delay: i * 0.08 + 0.6, // Offset from left half for polarity shift
      duration: 2.5 + Math.random() * 1.5,
      thickness: 1.5 + Math.random() * 0.5,
    });
  }
  
  return branches;
}

export default function LoadingScreen({ progress, message = 'Loading your journal...' }: LoadingScreenProps) {
  const [branches] = useState(() => generateInfinityBranches());
  const [polarityPhase, setPolarityPhase] = useState(0);

  useEffect(() => {
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
            
              {/* Central connection point - polarity shift */}
            <circle
              className="polarity-center"
              cx="250"
              cy="200"
              r="12"
              fill="rgba(255, 255, 255, 0.9)"
              filter="url(#glow)"
            />
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

