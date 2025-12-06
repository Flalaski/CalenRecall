/**
 * Procedural Abstract Artwork Generator
 * Generates abstract artwork based on theme colors
 */

/**
 * Extract color values from CSS computed styles
 */
function getThemeColors(): {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
} {
  if (typeof document === 'undefined') {
    return {
      primary: '#4a90e2',
      secondary: '#6c757d',
      accent: '#ff9800',
      background: '#ffffff',
      text: '#000000',
    };
  }

  // Parse colors to RGB
  const parseColor = (color: string): [number, number, number] => {
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
    return [74, 144, 226]; // Default blue
  };

  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const bodyStyle = window.getComputedStyle(document.body);
  
  // Get the actual background color from body or timeline section
  const bodyBg = bodyStyle.backgroundColor || '#ffffff';
  
  // Detect if it's a light theme by checking if background is light
  const bgRgb = parseColor(bodyBg);
  const isLightTheme = (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 > 200;
  
  // Get theme-specific colors if available
  const primary = computedStyle.getPropertyValue('--primary-color')?.trim() || 
                  (isLightTheme ? '#4a90e2' : '#6ba3e8');
  
  const accent = computedStyle.getPropertyValue('--accent-color')?.trim() ||
                 (isLightTheme ? '#ff9800' : '#ffb74d');
  
  // For themes, try to get colors from the active theme's background
  const theme = root.getAttribute('data-theme') || 'light';

  const primaryRgb = parseColor(primary);
  const accentRgb = parseColor(accent);

  // For light themes, use lighter, more pastel colors
  // For dark themes, use the colors as-is
  let primaryColor: string;
  let secondaryColor: string;
  let accentColor: string;
  
  if (isLightTheme) {
    // Light theme: use pastel, subtle colors
    primaryColor = `rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, 0.15)`;
    secondaryColor = `rgba(${Math.floor(primaryRgb[0] * 0.8)}, ${Math.floor(primaryRgb[1] * 0.8)}, ${Math.floor(primaryRgb[2] * 0.8)}, 0.1)`;
    accentColor = `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.12)`;
  } else {
    // Dark theme: use colors with moderate opacity
    primaryColor = `rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, 0.25)`;
    secondaryColor = `rgba(${Math.floor(primaryRgb[0] * 0.7)}, ${Math.floor(primaryRgb[1] * 0.7)}, ${Math.floor(primaryRgb[2] * 0.7)}, 0.2)`;
    accentColor = `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.2)`;
  }

  return {
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    background: `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`,
    text: theme === 'dark' || theme.includes('dark') ? '#ffffff' : '#000000',
  };
}

/**
 * Generate a procedural abstract artwork as a data URL
 */
export function generateProceduralArt(width: number = 1920, height: number = 1080): string {
  const colors = getThemeColors();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return '';
  }

  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const bgRgb = colors.background.match(/\d+/g)?.map(Number) || [255, 255, 255];
  
  // For light themes, keep background very light
  const isLightTheme = (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 > 200;
  const tintOpacity = isLightTheme ? 0.05 : 0.15;
  
  // Extract RGB from primary color (handle rgba format)
  const primaryMatch = colors.primary.match(/\d+/g);
  const primaryRgb = primaryMatch ? primaryMatch.slice(0, 3).map(Number) : [74, 144, 226];
  
  // Create very subtle gradient from background to slightly tinted
  gradient.addColorStop(0, colors.background);
  gradient.addColorStop(0.5, `rgba(${Math.floor((bgRgb[0] + primaryRgb[0]) / 2)}, ${Math.floor((bgRgb[1] + primaryRgb[1]) / 2)}, ${Math.floor((bgRgb[2] + primaryRgb[2]) / 2)}, ${tintOpacity})`);
  gradient.addColorStop(1, colors.background);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Generate abstract shapes
  const numShapes = 15 + Math.floor(Math.random() * 10);
  
  const baseOpacity = isLightTheme ? 0.05 : 0.15;
  const maxOpacity = isLightTheme ? 0.15 : 0.3;
  
  for (let i = 0; i < numShapes; i++) {
    const shapeType = Math.random();
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 50 + Math.random() * 200;
    const opacity = baseOpacity + Math.random() * (maxOpacity - baseOpacity);
    
    ctx.save();
    ctx.globalAlpha = opacity;
    
    if (shapeType < 0.4) {
      // Circles
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, colors.primary);
      gradient.addColorStop(0.5, colors.secondary);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (shapeType < 0.7) {
      // Rectangles with rotation
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI * 2);
      const gradient = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
      gradient.addColorStop(0, colors.accent);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(-size/2, -size/2, size, size);
    } else {
      // Organic flowing shapes
      ctx.beginPath();
      const points = 5 + Math.floor(Math.random() * 5);
      for (let p = 0; p < points; p++) {
        const angle = (p / points) * Math.PI * 2;
        const radius = size * (0.5 + Math.random() * 0.5);
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (p === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, colors.secondary);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Add some noise/texture
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a simpler procedural pattern using CSS gradients
 * This is more performant than canvas for static backgrounds
 */
export function generateProceduralCSSGradient(): string {
  const colors = getThemeColors();
  
  // Create multiple overlapping gradients for depth
  const gradients: string[] = [];
  
  // Base gradient
  gradients.push(`linear-gradient(135deg, ${colors.background} 0%, ${colors.background} 100%)`);
  
  // Extract RGB values from rgba strings
  const primaryMatch = colors.primary.match(/\d+/g);
  const accentMatch = colors.accent.match(/\d+/g);
  const primaryRgb = primaryMatch ? primaryMatch.slice(0, 3).map(Number) : [74, 144, 226];
  const accentRgb = accentMatch ? accentMatch.slice(0, 3).map(Number) : [255, 152, 0];
  
  // Detect light theme
  const bgRgb = colors.background.match(/\d+/g)?.map(Number) || [255, 255, 255];
  const isLightTheme = (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 > 200;
  
  // Use much more subtle opacities for light themes
  const opacity1 = isLightTheme ? 0.06 : 0.15;
  const opacity2 = isLightTheme ? 0.05 : 0.12;
  const opacity3 = isLightTheme ? 0.04 : 0.08;
  
  // Radial gradients for depth
  gradients.push(`radial-gradient(circle at 20% 30%, rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, ${opacity1}) 0%, transparent 50%)`);
  gradients.push(`radial-gradient(circle at 80% 70%, rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, ${opacity2}) 0%, transparent 50%)`);
  gradients.push(`radial-gradient(ellipse at 50% 50%, rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, ${opacity3}) 0%, transparent 70%)`);
  
  return gradients.join(', ');
}

