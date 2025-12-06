/**
 * Simplified Procedural Art Generator
 * Directly uses theme colors from actual UI elements
 */

interface Shape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  targetSize: number;
  colorRgb: [number, number, number];
  targetColorRgb: [number, number, number];
  opacity: number;
  targetOpacity: number;
  timeOffset: number;
}

interface ThemeColors {
  primary: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
  background: [number, number, number];
  primaryOpacity: number;
  secondaryOpacity: number;
  accentOpacity: number;
}

/**
 * Parse color string to RGB array
 */
function parseColor(color: string): [number, number, number] {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return [128, 128, 128]; // Neutral gray fallback
  }
  
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    } else if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }
  
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return [
        parseInt(matches[0]),
        parseInt(matches[1]),
        parseInt(matches[2])
      ];
    }
  }
  
  return [128, 128, 128];
}

/**
 * Get actual colors from visible theme elements
 */
function getThemeColors(): ThemeColors {
  if (typeof document === 'undefined') {
    return {
      primary: [74, 144, 226],
      secondary: [108, 117, 125],
      accent: [255, 152, 0],
      background: [255, 255, 255],
      primaryOpacity: 0.2,
      secondaryOpacity: 0.15,
      accentOpacity: 0.18
    };
  }

  // Get background - check multiple sources
  let bgColor = '#ffffff';
  const bodyStyle = getComputedStyle(document.body);
  const htmlStyle = getComputedStyle(document.documentElement);
  
  bgColor = bodyStyle.backgroundColor || htmlStyle.backgroundColor || '#ffffff';
  if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
    bgColor = htmlStyle.backgroundColor || '#ffffff';
  }
  
  const background = parseColor(bgColor);
  const bgBrightness = (background[0] + background[1] + background[2]) / 3;
  const isLightTheme = bgBrightness > 200;

  // Get colors from actual visible UI elements - prioritize active/highlighted elements
  const colorSelectors = [
    '.view-mode-button.active',
    '.timeline-cell.today',
    '.nav-button.active',
    '.save-button:not(:disabled)',
    '.entry-item.selected',
    '.calendar-cell.selected'
  ];

  const colors: [number, number, number][] = [];
  
  for (const selector of colorSelectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      const style = getComputedStyle(element);
      const bg = style.backgroundColor;
      const color = style.color;
      
      // Prefer background color, fallback to text color
      const sampleColor = (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') ? bg : color;
      
      if (sampleColor && sampleColor !== 'transparent') {
        const rgb = parseColor(sampleColor);
        const brightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
        
        // Only use colors that are different from background
        if (Math.abs(brightness - bgBrightness) > 50) {
          // Avoid black colors on light themes
          if (isLightTheme && brightness < 80) continue;
          // Avoid white colors on dark themes
          if (!isLightTheme && brightness > 220) continue;
          
          colors.push(rgb);
          if (colors.length >= 3) break;
        }
      }
    }
  }

  // Use extracted colors or sensible defaults
  let primary: [number, number, number];
  let secondary: [number, number, number];
  let accent: [number, number, number];

  if (colors.length >= 1) {
    primary = colors[0];
    secondary = colors.length >= 2 ? colors[1] : [
      Math.max(0, Math.min(255, primary[0] + (isLightTheme ? -30 : 30))),
      Math.max(0, Math.min(255, primary[1] + (isLightTheme ? -30 : 30))),
      Math.max(0, Math.min(255, primary[2] + (isLightTheme ? -30 : 30)))
    ];
    accent = colors.length >= 3 ? colors[2] : [
      Math.max(0, Math.min(255, primary[0] + (isLightTheme ? 50 : -50))),
      Math.max(0, Math.min(255, primary[1] + (isLightTheme ? 30 : -30))),
      Math.max(0, Math.min(255, primary[2] + (isLightTheme ? -50 : 50)))
    ];
  } else {
    // Fallback to theme-appropriate vibrant colors
    if (isLightTheme) {
      primary = [74, 144, 226];   // Blue
      secondary = [108, 117, 125]; // Gray-blue
      accent = [255, 152, 0];     // Orange
    } else {
      primary = [100, 181, 246];   // Light blue
      secondary = [144, 202, 249]; // Lighter blue
      accent = [255, 183, 77];     // Light orange
    }
  }

  // Set opacity based on theme - higher for better visibility
  const baseOpacity = isLightTheme ? 0.2 : 0.25;
  
  return {
    primary,
    secondary,
    accent,
    background,
    primaryOpacity: baseOpacity,
    secondaryOpacity: baseOpacity * 0.8,
    accentOpacity: baseOpacity * 0.9
  };
}

/**
 * Interpolate between two RGB colors
 */
function interpolateRgb(
  color1: [number, number, number],
  color2: [number, number, number],
  factor: number
): [number, number, number] {
  return [
    Math.round(color1[0] + (color2[0] - color1[0]) * factor),
    Math.round(color1[1] + (color2[1] - color1[1]) * factor),
    Math.round(color1[2] + (color2[2] - color1[2]) * factor)
  ];
}

/**
 * Create optimized procedural art canvas
 */
export function createLavaLampCanvas(
  canvas: HTMLCanvasElement,
  width: number = 1920,
  height: number = 1080
): () => void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    return () => {};
  }

  canvas.width = width;
  canvas.height = height;
  
  // Type assertion: ctx is guaranteed non-null after check
  const context = ctx;

  // Get theme colors
  let themeColors = getThemeColors();
  let lastColorCheck = performance.now();
  const colorCheckInterval = 500; // Check less frequently to reduce flashes

  // Use fewer shapes for better performance
  const numShapes = 4;
  const shapes: Shape[] = [];
  const colorOptions: [number, number, number][] = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.accent
  ];
  const opacityOptions = [
    themeColors.primaryOpacity,
    themeColors.secondaryOpacity,
    themeColors.accentOpacity
  ];

  // Initialize shapes
  for (let i = 0; i < numShapes; i++) {
    const colorIndex = i % colorOptions.length;
    const color = colorOptions[colorIndex];
    const size = 120 + Math.random() * 180;
    
    shapes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      size,
      targetSize: size * (0.8 + Math.random() * 0.4),
      colorRgb: [color[0], color[1], color[2]],
      targetColorRgb: [color[0], color[1], color[2]],
      opacity: opacityOptions[colorIndex] * (0.9 + Math.random() * 0.2),
      targetOpacity: opacityOptions[colorIndex] * (0.9 + Math.random() * 0.2),
      timeOffset: Math.random() * Math.PI * 2
    });
  }

  let animationFrame: number;
  let lastTime = performance.now();
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;

  function animate(currentTime: number) {
    const deltaTime = currentTime - lastTime;

    // Check for theme changes - less frequently and only update if significantly different
    if (currentTime - lastColorCheck >= colorCheckInterval) {
      const newColors = getThemeColors();
      
      // Only update if colors changed significantly (more than 10 RGB units)
      const bgChanged = 
        Math.abs(newColors.background[0] - themeColors.background[0]) > 10 ||
        Math.abs(newColors.background[1] - themeColors.background[1]) > 10 ||
        Math.abs(newColors.background[2] - themeColors.background[2]) > 10;
      
      const primaryChanged = 
        Math.abs(newColors.primary[0] - themeColors.primary[0]) > 10 ||
        Math.abs(newColors.primary[1] - themeColors.primary[1]) > 10 ||
        Math.abs(newColors.primary[2] - themeColors.primary[2]) > 10;
      
      const accentChanged = 
        Math.abs(newColors.accent[0] - themeColors.accent[0]) > 10 ||
        Math.abs(newColors.accent[1] - themeColors.accent[1]) > 10 ||
        Math.abs(newColors.accent[2] - themeColors.accent[2]) > 10;
      
      if (bgChanged || primaryChanged || accentChanged) {
        const newColorOptions: [number, number, number][] = [
          newColors.primary,
          newColors.secondary,
          newColors.accent
        ];
        const newOpacityOptions = [
          newColors.primaryOpacity,
          newColors.secondaryOpacity,
          newColors.accentOpacity
        ];

        // Smoothly transition colors instead of instantly changing
        shapes.forEach((shape, i) => {
          const colorIndex = i % newColorOptions.length;
          shape.targetColorRgb = [
            newColorOptions[colorIndex][0],
            newColorOptions[colorIndex][1],
            newColorOptions[colorIndex][2]
          ];
          shape.targetOpacity = newOpacityOptions[colorIndex] * (0.9 + Math.random() * 0.2);
        });
        themeColors = newColors;
      }
      lastColorCheck = currentTime;
    }

    if (deltaTime >= frameInterval) {
      lastTime = currentTime - (deltaTime % frameInterval);

      // Clear canvas - use fillRect which is efficient and doesn't cause flashes
      context.fillStyle = `rgb(${themeColors.background[0]}, ${themeColors.background[1]}, ${themeColors.background[2]})`;
      context.fillRect(0, 0, width, height);

      const time = currentTime * 0.001;

      shapes.forEach((shape) => {
        // Smooth color transition
        if (
          shape.colorRgb[0] !== shape.targetColorRgb[0] ||
          shape.colorRgb[1] !== shape.targetColorRgb[1] ||
          shape.colorRgb[2] !== shape.targetColorRgb[2]
        ) {
          shape.colorRgb = interpolateRgb(shape.colorRgb, shape.targetColorRgb, 0.1);
        }

        // Smooth opacity transition
        shape.opacity += (shape.targetOpacity - shape.opacity) * 0.06;

        // Simple movement
        const waveX = Math.sin(time * 0.15 + shape.timeOffset) * 0.5;
        const waveY = Math.cos(time * 0.13 + shape.timeOffset * 1.2) * 0.5;
        
        shape.x += (shape.vx + waveX) * 0.3;
        shape.y += (shape.vy + waveY) * 0.3;

        // Wrap around
        if (shape.x < -shape.size) shape.x = width + shape.size;
        if (shape.x > width + shape.size) shape.x = -shape.size;
        if (shape.y < -shape.size) shape.y = height + shape.size;
        if (shape.y > height + shape.size) shape.y = -shape.size;

        // Size morphing
        const sizeWave = Math.sin(time * 0.1 + shape.timeOffset) * 0.1;
        shape.size += (shape.targetSize * (1 + sizeWave) - shape.size) * 0.05;

        // Draw circle with gradient
        const gradient = context.createRadialGradient(
          shape.x, shape.y, 0,
          shape.x, shape.y, shape.size * 1.3
        );
        const [r, g, b] = shape.colorRgb;
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${shape.opacity})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${shape.opacity * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(shape.x, shape.y, shape.size, 0, Math.PI * 2);
        context.fill();
      });

      // Occasionally update targets
      if (Math.random() < 0.003) {
        shapes.forEach(shape => {
          shape.targetSize = shape.size * (0.75 + Math.random() * 0.5);
          shape.vx += (Math.random() - 0.5) * 0.02;
          shape.vy += (Math.random() - 0.5) * 0.02;
          shape.vx = Math.max(-0.25, Math.min(0.25, shape.vx));
          shape.vy = Math.max(-0.25, Math.min(0.25, shape.vy));
        });
      }
    }

    animationFrame = requestAnimationFrame(animate);
  }

  animationFrame = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(animationFrame);
  };
}
