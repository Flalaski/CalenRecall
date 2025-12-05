/**
 * Theme configuration and definitions
 * Provides comprehensive theme support with detailed styling for all UI elements
 * 
 * Themes are automatically discovered from CSS files in the themes folder.
 * Any .css file in src/themes/ will be automatically registered.
 */

export type ThemeName = string;

export interface ThemeInfo {
  name: ThemeName;
  displayName: string;
  description: string;
}

// Built-in theme metadata (for themes that have predefined display names/descriptions)
const BUILT_IN_THEME_METADATA: Record<string, Omit<ThemeInfo, 'name'>> = {
  'light': {
    displayName: 'Light',
    description: 'Clean and bright light theme'
  },
  'dark': {
    displayName: 'Dark',
    description: 'Modern dark theme for comfortable viewing'
  },
  'classic-light': {
    displayName: 'Classic Light',
    description: 'Nostalgic Windows 95 classic interface'
  },
  'classic-dark': {
    displayName: 'Classic Dark',
    description: 'Dark mode variant of classic Windows 95 interface'
  },
  'high-contrast': {
    displayName: 'High Contrast',
    description: 'High contrast theme for accessibility'
  },
  'terminal': {
    displayName: 'Terminal',
    description: 'Monochrome terminal aesthetic'
  },
  'forest': {
    displayName: 'Forest',
    description: 'Nature-inspired green theme'
  },
  'ocean': {
    displayName: 'Ocean',
    description: 'Cool blue ocean theme'
  },
  'sunset': {
    displayName: 'Sunset',
    description: 'Warm sunset orange theme'
  },
  'retro80s': {
    displayName: 'Retro 80s',
    description: 'Vibrant 1980s retro theme'
  },
  'modern-minimal': {
    displayName: 'Modern Minimal',
    description: 'Clean minimal design with subtle colors'
  },
  'auto': {
    displayName: 'Auto (System)',
    description: 'Follows your system theme preference'
  }
};

/**
 * Convert a filename to a display name
 * Examples: "modern-minimal.css" -> "Modern Minimal", "high-contrast.css" -> "High Contrast"
 */
function formatDisplayName(filename: string): string {
  // Remove .css extension
  const name = filename.replace(/\.css$/, '');
  
  // Split by hyphens and capitalize each word
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Discover all theme CSS files in the themes directory
 * Uses Vite's import.meta.glob to find all CSS files at build time
 */
function discoverThemes(): ThemeInfo[] {
  // Use Vite's import.meta.glob to discover all CSS files in themes directory
  // This works at build time and includes all .css files
  const themeModules = import.meta.glob('../themes/*.css', { eager: true });
  
  const discoveredThemes: ThemeInfo[] = [];
  const processedNames = new Set<string>();
  
  // Process discovered theme files
  for (const path in themeModules) {
    // Extract filename from path (e.g., "../themes/modern-minimal.css" -> "modern-minimal")
    const match = path.match(/\/([^/]+)\.css$/);
    if (!match) continue;
    
    const themeName = match[1];
    
    // Skip template/example files
    if (themeName.includes('template') || 
        themeName.includes('example') || 
        themeName.includes('temp') ||
        themeName === 'README' ||
        themeName === 'COMPONENT_CLASSES' ||
        themeName === 'THEME_EXPANSION_STATUS') {
      continue;
    }
    
    // Avoid duplicates
    if (processedNames.has(themeName)) continue;
    processedNames.add(themeName);
    
    // Use built-in metadata if available, otherwise generate from filename
    const metadata = BUILT_IN_THEME_METADATA[themeName];
    discoveredThemes.push({
      name: themeName,
      displayName: metadata?.displayName || formatDisplayName(themeName),
      description: metadata?.description || `Custom theme: ${formatDisplayName(themeName)}`
    });
  }
  
  // Always include 'light', 'dark', and 'auto' themes (they're handled in index.css, not separate files)
  const coreThemes: ThemeInfo[] = [
    {
      name: 'light',
      displayName: BUILT_IN_THEME_METADATA['light'].displayName,
      description: BUILT_IN_THEME_METADATA['light'].description
    },
    {
      name: 'dark',
      displayName: BUILT_IN_THEME_METADATA['dark'].displayName,
      description: BUILT_IN_THEME_METADATA['dark'].description
    },
    {
      name: 'auto',
      displayName: BUILT_IN_THEME_METADATA['auto'].displayName,
      description: BUILT_IN_THEME_METADATA['auto'].description
    }
  ];
  
  // Sort: core themes first, then discovered themes alphabetically
  const otherThemes = discoveredThemes
    .filter(t => !['light', 'dark', 'auto'].includes(t.name))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  
  return [...coreThemes, ...otherThemes];
}

// Dynamically discover and register all themes
export const AVAILABLE_THEMES: ThemeInfo[] = discoverThemes();

/**
 * Get the effective theme name (resolves 'auto' to light/dark based on system preference)
 */
export function getEffectiveTheme(theme: ThemeName): string {
  if (theme !== 'auto') {
    return theme;
  }
  
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  return 'light';
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  
  const effectiveTheme = getEffectiveTheme(theme);
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

/**
 * Initialize theme with system preference listener for 'auto' theme
 */
export function initializeTheme(theme: ThemeName, callback?: (newTheme: string) => void) {
  applyTheme(theme);
  
  if (theme === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const effectiveTheme = e.matches ? 'dark' : 'light';
      applyTheme(theme);
      if (callback) callback(effectiveTheme);
    };
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Legacy browsers
      mediaQuery.addListener(handleChange);
    }
    
    // Return cleanup function
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }
  
  return () => {}; // No cleanup needed
}

