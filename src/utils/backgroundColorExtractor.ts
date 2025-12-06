/**
 * Extracts dominant colors from a background image and applies them as CSS variables
 * Only applies to default themes (light/dark), not custom themes
 */

export interface ExtractedColors {
  primary: string;      // Main dominant color
  secondary: string;    // Second most common color
  accent: string;        // Accent/highlight color
  text: string;         // Text color (light or dark based on background)
  panel: string;        // Panel background color (semi-transparent)
  border: string;       // Border color
}

/**
 * Extract colors from an image using canvas
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Scale down image for faster processing (max 200x200)
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Sample colors from the image
        const colorCounts = new Map<string, number>();
        const step = 4; // Sample every 4th pixel for performance

        for (let i = 0; i < data.length; i += step * 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Quantize colors to reduce palette
          const quantized = quantizeColor(r, g, b);
          const key = `${quantized.r},${quantized.g},${quantized.b}`;
          colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
        }

        // Get most common colors
        const sortedColors = Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number);
            return { r, g, b, hex: rgbToHex(r, g, b) };
          });

        if (sortedColors.length === 0) {
          // Fallback colors
          resolve(getDefaultColors());
          return;
        }

        // Determine if image is light or dark
        const avgBrightness = sortedColors.reduce((sum, color) => {
          return sum + (color.r * 0.299 + color.g * 0.587 + color.b * 0.114);
        }, 0) / sortedColors.length;

        const isLight = avgBrightness > 128;

        // Extract colors
        const primary = sortedColors[0].hex;
        const secondary = sortedColors[1]?.hex || primary;
        const accent = sortedColors[Math.min(2, sortedColors.length - 1)]?.hex || secondary;

        // Generate panel color (semi-transparent version of primary)
        const panelRgba = hexToRgba(primary, isLight ? 0.85 : 0.75);
        
        // Generate border color (darker/lighter version)
        const borderRgba = adjustBrightness(primary, isLight ? -20 : 20);
        
        // Text color based on brightness
        const textColor = isLight ? '#1a1a1a' : '#f0f0f0';

        resolve({
          primary,
          secondary,
          accent,
          text: textColor,
          panel: panelRgba,
          border: borderRgba,
        });
      } catch (error) {
        console.error('Error extracting colors:', error);
        resolve(getDefaultColors());
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Quantize color to reduce palette size
 */
function quantizeColor(r: number, g: number, b: number): { r: number; g: number; b: number } {
  const factor = 16; // Reduce to 16 levels per channel
  return {
    r: Math.floor(r / factor) * factor,
    g: Math.floor(g / factor) * factor,
    b: Math.floor(b / factor) * factor,
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Convert hex to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Adjust brightness of a hex color
 */
function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return rgbToHex(r, g, b);
}

/**
 * Get default colors (fallback)
 */
function getDefaultColors(): ExtractedColors {
  return {
    primary: '#f5f5f5',
    secondary: '#e0e0e0',
    accent: '#4a90e2',
    text: '#333333',
    panel: 'rgba(245, 245, 245, 0.85)',
    border: '#d0d0d0',
  };
}

/**
 * Apply extracted colors as CSS variables (only for light theme)
 */
export function applyBackgroundColors(colors: ExtractedColors, theme: string): void {
  // Only apply to light theme
  if (theme !== 'light') {
    // Clear any previously set variables for other themes
    document.documentElement.style.removeProperty('--bg-extracted-primary');
    document.documentElement.style.removeProperty('--bg-extracted-secondary');
    document.documentElement.style.removeProperty('--bg-extracted-accent');
    document.documentElement.style.removeProperty('--bg-extracted-text');
    document.documentElement.style.removeProperty('--bg-extracted-panel');
    document.documentElement.style.removeProperty('--bg-extracted-border');
    return;
  }

  // Apply CSS variables
  document.documentElement.style.setProperty('--bg-extracted-primary', colors.primary);
  document.documentElement.style.setProperty('--bg-extracted-secondary', colors.secondary);
  document.documentElement.style.setProperty('--bg-extracted-accent', colors.accent);
  document.documentElement.style.setProperty('--bg-extracted-text', colors.text);
  document.documentElement.style.setProperty('--bg-extracted-panel', colors.panel);
  document.documentElement.style.setProperty('--bg-extracted-border', colors.border);
}

/**
 * Clear background colors (when no custom image or switching to custom theme)
 */
export function clearBackgroundColors(): void {
  document.documentElement.style.removeProperty('--bg-extracted-primary');
  document.documentElement.style.removeProperty('--bg-extracted-secondary');
  document.documentElement.style.removeProperty('--bg-extracted-accent');
  document.documentElement.style.removeProperty('--bg-extracted-text');
  document.documentElement.style.removeProperty('--bg-extracted-panel');
  document.documentElement.style.removeProperty('--bg-extracted-border');
}

