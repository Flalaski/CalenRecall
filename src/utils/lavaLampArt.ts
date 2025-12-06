/**
 * Lava Lamp Style Procedural Art Generator
 * Creates continuously morphing, fluid abstract art
 */

interface Shape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  targetSize: number;
  color: string;
  opacity: number;
  targetOpacity: number;
  type: 'circle' | 'blob';
  points?: number[];
  timeOffset: number;
}

/**
 * Extract color values from CSS computed styles
 */
function getThemeColors(): {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
} {
  if (typeof document === 'undefined') {
    return {
      primary: 'rgba(74, 144, 226, 0.15)',
      secondary: 'rgba(108, 117, 125, 0.1)',
      accent: 'rgba(255, 152, 0, 0.12)',
      background: '#ffffff',
    };
  }

  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const bodyStyle = window.getComputedStyle(document.body);
  
  const bodyBg = bodyStyle.backgroundColor || '#ffffff';
  const bgRgb = parseColor(bodyBg);
  const isLightTheme = (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 > 200;
  
  const primary = computedStyle.getPropertyValue('--primary-color')?.trim() || 
                  (isLightTheme ? '#4a90e2' : '#6ba3e8');
  const accent = computedStyle.getPropertyValue('--accent-color')?.trim() ||
                 (isLightTheme ? '#ff9800' : '#ffb74d');

  const primaryRgb = parseColor(primary);
  const accentRgb = parseColor(accent);
  
  const primaryOpacity = isLightTheme ? 0.15 : 0.25;
  const secondaryOpacity = isLightTheme ? 0.1 : 0.2;
  const accentOpacity = isLightTheme ? 0.12 : 0.2;

  return {
    primary: `rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, ${primaryOpacity})`,
    secondary: `rgba(${Math.floor(primaryRgb[0] * 0.8)}, ${Math.floor(primaryRgb[1] * 0.8)}, ${Math.floor(primaryRgb[2] * 0.8)}, ${secondaryOpacity})`,
    accent: `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, ${accentOpacity})`,
    background: `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`,
  };
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])];
    }
  }
  return [74, 144, 226];
}

/**
 * Create and animate a lava lamp style procedural art canvas
 */
export function createLavaLampCanvas(
  canvas: HTMLCanvasElement,
  width: number = 1920,
  height: number = 1080
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return () => {};
  }

  canvas.width = width;
  canvas.height = height;

  const colors = getThemeColors();
  const bgRgb = colors.background.match(/\d+/g)?.map(Number) || [255, 255, 255];
  const isLightTheme = (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 > 200;

  // Create shapes that will morph continuously
  const shapes: Shape[] = [];
  const numShapes = 8 + Math.floor(Math.random() * 6);
  const colorOptions = [colors.primary, colors.secondary, colors.accent];

  for (let i = 0; i < numShapes; i++) {
    const size = 80 + Math.random() * 180;
    const shape: Shape = {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: size,
      targetSize: size * (0.8 + Math.random() * 0.4),
      color: colorOptions[Math.floor(Math.random() * colorOptions.length)],
      opacity: (isLightTheme ? 0.05 : 0.15) + Math.random() * (isLightTheme ? 0.1 : 0.15),
      targetOpacity: (isLightTheme ? 0.05 : 0.15) + Math.random() * (isLightTheme ? 0.1 : 0.15),
      type: Math.random() > 0.5 ? 'blob' : 'circle',
      timeOffset: Math.random() * Math.PI * 2,
    };
    shapes.push(shape);
  }

  let animationFrame: number;
  let lastTime = performance.now();
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;

  function animate(currentTime: number) {
    const deltaTime = currentTime - lastTime;
    
    if (deltaTime >= frameInterval) {
      lastTime = currentTime - (deltaTime % frameInterval);

      // Clear canvas
      ctx.fillStyle = colors.background;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(0, 0, width, height);

      // Update and draw shapes
      const time = currentTime * 0.001; // Convert to seconds

      shapes.forEach((shape, index) => {
        // Smooth movement with multiple sine waves for organic, fluid motion
        const waveX1 = Math.sin(time * 0.25 + shape.timeOffset) * 0.8;
        const waveX2 = Math.cos(time * 0.18 + shape.timeOffset * 1.7) * 0.4;
        const waveY1 = Math.cos(time * 0.22 + shape.timeOffset * 1.3) * 0.8;
        const waveY2 = Math.sin(time * 0.15 + shape.timeOffset * 2.1) * 0.4;
        
        // Combine waves for more complex, organic motion
        const waveX = waveX1 + waveX2;
        const waveY = waveY1 + waveY2;
        
        // Update position with very smooth easing (lava lamp effect)
        shape.x += (shape.vx + waveX) * 0.5;
        shape.y += (shape.vy + waveY) * 0.5;
        
        // Wrap around edges smoothly
        if (shape.x < -shape.size * 2) shape.x = width + shape.size * 2;
        if (shape.x > width + shape.size * 2) shape.x = -shape.size * 2;
        if (shape.y < -shape.size * 2) shape.y = height + shape.size * 2;
        if (shape.y > height + shape.size * 2) shape.y = -shape.size * 2;

        // Smoothly morph size with multiple wave frequencies
        const sizeWave1 = Math.sin(time * 0.15 + shape.timeOffset * 2) * 0.15;
        const sizeWave2 = Math.cos(time * 0.1 + shape.timeOffset * 3) * 0.1;
        const sizeVariation = sizeWave1 + sizeWave2;
        shape.size += (shape.targetSize * (1 + sizeVariation) - shape.size) * 0.03;
        
        // Smoothly morph opacity with gentle waves
        const opacityWave1 = Math.sin(time * 0.12 + shape.timeOffset * 1.5) * 0.25;
        const opacityWave2 = Math.cos(time * 0.08 + shape.timeOffset * 2.3) * 0.15;
        const opacityVariation = opacityWave1 + opacityWave2;
        shape.opacity += (shape.targetOpacity * (1 + opacityVariation) - shape.opacity) * 0.03;

        // Draw shape with smooth blending
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, shape.opacity));
        ctx.globalCompositeOperation = 'source-over';
        
        if (shape.type === 'circle') {
          // Smooth circular blob with soft edges
          const gradient = ctx.createRadialGradient(shape.x, shape.y, 0, shape.x, shape.y, shape.size * 1.1);
          gradient.addColorStop(0, shape.color);
          gradient.addColorStop(0.5, shape.color.replace(/[\d.]+\)$/, '0.4)'));
          gradient.addColorStop(0.8, shape.color.replace(/[\d.]+\)$/, '0.1)'));
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Organic blob shape that continuously morphs like lava
          const numPoints = 10;
          const points: number[] = [];
          for (let p = 0; p < numPoints; p++) {
            const angle = (p / numPoints) * Math.PI * 2;
            // Multiple wave frequencies for smooth, organic morphing
            const radiusWave1 = Math.sin(time * 0.25 + shape.timeOffset + angle * 2) * 0.25;
            const radiusWave2 = Math.cos(time * 0.18 + shape.timeOffset * 1.5 + angle * 3) * 0.15;
            const radiusWave3 = Math.sin(time * 0.12 + shape.timeOffset * 2.2 + angle * 4) * 0.1;
            const radiusVariation = radiusWave1 + radiusWave2 + radiusWave3;
            const radius = shape.size * (0.65 + radiusVariation);
            points.push(shape.x + Math.cos(angle) * radius);
            points.push(shape.y + Math.sin(angle) * radius);
          }
          
          // Create smooth radial gradient with soft edges for blending
          const gradient = ctx.createRadialGradient(shape.x, shape.y, 0, shape.x, shape.y, shape.size * 1.3);
          gradient.addColorStop(0, shape.color);
          gradient.addColorStop(0.3, shape.color.replace(/[\d.]+\)$/, '0.5)'));
          gradient.addColorStop(0.6, shape.color.replace(/[\d.]+\)$/, '0.2)'));
          gradient.addColorStop(0.85, shape.color.replace(/[\d.]+\)$/, '0.05)'));
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          
          // Draw smooth blob with bezier curves for fluid edges
          ctx.beginPath();
          ctx.moveTo(points[0], points[1]);
          for (let p = 2; p < points.length; p += 2) {
            const nextP = (p + 2) % points.length;
            const cp1x = points[p - 2] + (points[p] - points[p - 2]) * 0.4;
            const cp1y = points[p - 1] + (points[p + 1] - points[p - 1]) * 0.4;
            const cp2x = points[p] + (points[nextP] - points[p]) * 0.4;
            const cp2y = points[p + 1] + (points[nextP + 1] - points[p + 1]) * 0.4;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[p], points[p + 1]);
          }
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.restore();
      });

      // Occasionally update target values for more organic, unpredictable movement
      if (Math.random() < 0.008) {
        shapes.forEach(shape => {
          shape.targetSize = shape.size * (0.75 + Math.random() * 0.5);
          shape.targetOpacity = (isLightTheme ? 0.05 : 0.15) + Math.random() * (isLightTheme ? 0.1 : 0.15);
          // Very gentle velocity changes for smooth motion
          shape.vx += (Math.random() - 0.5) * 0.05;
          shape.vy += (Math.random() - 0.5) * 0.05;
          // Limit velocity to keep it smooth
          shape.vx = Math.max(-0.4, Math.min(0.4, shape.vx));
          shape.vy = Math.max(-0.4, Math.min(0.4, shape.vy));
        });
      }
    }

    animationFrame = requestAnimationFrame(animate);
  }

  // Start animation
  animationFrame = requestAnimationFrame(animate);

  // Return cleanup function
  return () => {
    cancelAnimationFrame(animationFrame);
  };
}

