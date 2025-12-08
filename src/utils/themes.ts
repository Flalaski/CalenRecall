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
  'bios': {
    displayName: 'BIOS',
    description: 'Early 2000\'s DOS-like BIOS menu aesthetic'
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
  'red-rock': {
    displayName: 'Red Rock',
    description: 'Warm red rock depth layers inspired by Grand Canyon sedimentary layers'
  },
  'australian-desert': {
    displayName: 'Australian Desert',
    description: 'Warm Australian desert tones with reds, oranges, and golds'
  },
  'hot-spring': {
    displayName: 'Hot Spring',
    description: 'Warm nighttime hot spring theme with steamy blues and purples'
  },
  'NEON': {
    displayName: 'NEON',
    description: 'Vibrant 1980s retro theme'
  },
  'vegas80s': {
    displayName: 'Vegas 80s',
    description: 'Cigarette smoke-filled Vegas strip 80s with neon nightlife atmosphere'
  },
  'modern-minimal': {
    displayName: 'Modern Minimal',
    description: 'Clean minimal design with subtle colors'
  },
  'modern-minimal-oled': {
    displayName: 'Modern Minimal OLED',
    description: 'OLED-optimized dark variant with true black backgrounds for maximum power efficiency'
  },
  'auto': {
    displayName: 'Auto (System)',
    description: 'Follows your system theme preference'
  },
  'on-screen': {
    displayName: 'ON SCREEN',
    description: 'Futuristic LCARS-inspired interface design with amber/orange active elements'
  },
  'elite': {
    displayName: 'Elite',
    description: 'Elite: Dangerous ship HUD theme with orange highlights and cyan data displays'
  },
  'journeyman': {
    displayName: 'Journeyman',
    description: 'Mid-1990s industrial/futuristic interface inspired by The Journeyman Project: Pegasus Prime with purple-blue gradients and gold accents'
  },
  'scholar': {
    displayName: 'Scholar',
    description: 'Warm parchment aesthetic inspired by medieval manuscripts and ancient libraries, perfect for academic work and historical research'
  },
  'archive': {
    displayName: 'Archive',
    description: '19th-century libraries aesthetic with aged cream paper, deep burgundy accents, and ink blue highlights - elegant design for formal academic work'
  },
  'librarians-study': {
    displayName: 'Librarian\'s Study',
    description: 'Modern academic library aesthetic with soft beige backgrounds, deep green accents, and academic blue highlights - clean organized design for scholarly research'
  },
  'research': {
    displayName: 'Research',
    description: 'Historical archive aesthetic with neutral tan backgrounds, archive brown accents, and dusty blue highlights - professional design for archival research and documentation'
  },
  'manuscript-room': {
    displayName: 'Manuscript Room',
    description: 'Rare book room aesthetic with warm ivory backgrounds, deep purple-blue accents, and illuminated gold highlights - luxurious design for special collections'
  },
  'reading-room': {
    displayName: 'Reading Room',
    description: 'Traditional library reading room aesthetic with soft cream backgrounds, forest green accents, and quiet blue highlights - peaceful design for focused reading'
  },
  'temple-of-light': {
    displayName: 'Temple of Light',
    description: 'Light mode variant - Mormon temple aesthetic with marble interiors, custom carpets featuring diamond patterns and floral motifs, rich mahogany woodwork, and soft stained glass blues and greens - sacred and serene design'
  },
  'temple-of-darkness': {
    displayName: 'Temple of Darkness',
    description: 'Dark mode variant - Gothic temple aesthetic with aged stone walls, weathered ebony woodwork, oxidized bronze metals, and mystical torchlight - mysterious and arcane design'
  },
  'kallisti': {
    displayName: 'Kallisti',
    description: 'Inspired by Eris, the divine mother of chaos and goddess of discord - deep night backgrounds with golden apple highlights and discord purple accents, representing the legendary "Kallisti" (to the fairest) that sparked the Trojan War'
  },
  'aero': {
    displayName: 'Aero',
    description: 'Windows Aero-inspired glassmorphism theme with translucent effects and smooth gradients'
  },
  'tabletop': {
    displayName: 'Tabletop',
    description: 'Classic board game aesthetic with wood grain textures, felt surfaces, and game piece styling - the minimap looks like a game board with grid lines and markers'
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
  // @ts-ignore - import.meta.glob is a Vite-specific feature
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

// Built-in themes discovered at build time
const BUILT_IN_THEMES: ThemeInfo[] = discoverThemes();

// Dynamically loaded themes (built-in + custom)
// This will be populated at runtime with custom themes from AppData
let AVAILABLE_THEMES_CACHE: ThemeInfo[] = BUILT_IN_THEMES;

/**
 * Load custom themes from AppData and merge with built-in themes
 * This must be called after custom themes are loaded via customThemeLoader
 */
export async function loadAllThemes(): Promise<ThemeInfo[]> {
  // Start with built-in themes
  const allThemes: ThemeInfo[] = [...BUILT_IN_THEMES];
  const themeNames = new Set<string>(BUILT_IN_THEMES.map(t => t.name));
  
  // Load custom themes from Electron if available
  if (typeof window !== 'undefined' && window.electronAPI && 'getCustomThemes' in window.electronAPI) {
    try {
      const result = await (window.electronAPI as any).getCustomThemes();
      if (result.success && result.themes && Array.isArray(result.themes)) {
        for (const theme of result.themes) {
          // Skip if theme name already exists (built-in takes precedence)
          if (themeNames.has(theme.name)) {
            console.log(`[themes] Skipping duplicate custom theme (built-in exists): ${theme.name}`);
            continue;
          }
          
          themeNames.add(theme.name);
          
          // Extract theme name from CSS to determine display name
          // Look for [data-theme="theme-name"] in the CSS
          let displayName = formatDisplayName(theme.name);
          const themeMatch = theme.css.match(/\[data-theme=["']([^"']+)["']\]/);
          if (themeMatch && themeMatch[1]) {
            const cssThemeName = themeMatch[1];
            // Use metadata if available, otherwise format the name
            const metadata = BUILT_IN_THEME_METADATA[cssThemeName];
            if (metadata) {
              displayName = metadata.displayName;
            } else {
              displayName = formatDisplayName(cssThemeName);
            }
          }
          
          allThemes.push({
            name: theme.name,
            displayName: displayName,
            description: `Custom theme: ${displayName}`
          });
        }
      }
    } catch (error) {
      console.error('[themes] Error loading custom themes:', error);
    }
  }
  
  // Sort: core themes first, then others alphabetically
  const coreThemes = allThemes.filter(t => ['light', 'dark', 'auto'].includes(t.name));
  const otherThemes = allThemes
    .filter(t => !['light', 'dark', 'auto'].includes(t.name))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  
  AVAILABLE_THEMES_CACHE = [...coreThemes, ...otherThemes];
  // Update exported AVAILABLE_THEMES for backwards compatibility
  AVAILABLE_THEMES = AVAILABLE_THEMES_CACHE;
  return AVAILABLE_THEMES_CACHE;
}

/**
 * Get available themes (built-in + custom)
 * If custom themes haven't been loaded yet, returns built-in themes only
 * Call loadAllThemes() first to ensure custom themes are included
 */
export function getAvailableThemes(): ThemeInfo[] {
  return AVAILABLE_THEMES_CACHE;
}

// For backwards compatibility, export AVAILABLE_THEMES 
// Note: This is a mutable reference - it will update when loadAllThemes() is called
// Use getAvailableThemes() for the most up-to-date list
export let AVAILABLE_THEMES: ThemeInfo[] = AVAILABLE_THEMES_CACHE;

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
 * This function is safe to call multiple times and handles timing issues
 */
export function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  
  // Ensure document.documentElement exists (may not be available during early initialization)
  if (!document.documentElement) {
    // If DOM isn't ready yet, wait for it
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyTheme(theme);
      });
      return;
    }
    // If document exists but documentElement doesn't, retry after a short delay
    setTimeout(() => {
      applyTheme(theme);
    }, 10);
    return;
  }
  
  // For 'auto' theme, resolve to light/dark based on system preference
  // For all other themes (including custom themes), use the theme name directly
  const themeToApply = theme === 'auto' ? getEffectiveTheme(theme) : theme;
  
  console.log('[themes] Applying theme:', theme, '->', themeToApply);
  
  try {
    // Set the theme attribute directly and synchronously
    document.documentElement.setAttribute('data-theme', themeToApply);
    
    // Verify it was set correctly
    const appliedTheme = document.documentElement.getAttribute('data-theme');
    console.log('[themes] Theme applied. Current data-theme:', appliedTheme);
    
    if (appliedTheme !== themeToApply) {
      console.warn('[themes] Theme mismatch! Expected:', themeToApply, 'Got:', appliedTheme);
      // Force set again
      document.documentElement.setAttribute('data-theme', themeToApply);
    }
    
    // Force a reflow to ensure CSS is recalculated
    void document.documentElement.offsetHeight;
    
  } catch (error) {
    console.error('[themes] Error applying theme:', error);
    // Retry after a short delay in case of timing issues
    setTimeout(() => {
      try {
        if (document.documentElement) {
          document.documentElement.setAttribute('data-theme', themeToApply);
          const appliedTheme = document.documentElement.getAttribute('data-theme');
          console.log('[themes] Theme applied on retry. Current data-theme:', appliedTheme);
          // Force a reflow
          void document.documentElement.offsetHeight;
        }
      } catch (retryError) {
        console.error('[themes] Error retrying theme application:', retryError);
      }
    }, 50);
  }
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

/**
 * Valid font size values
 */
export type FontSize = 'xxxSmall' | 'xxSmall' | 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge' | 'xxLarge' | 'xxxLarge';

const VALID_FONT_SIZES: FontSize[] = [
  'xxxSmall', 'xxSmall', 'xSmall', 'small', 'medium', 
  'large', 'xLarge', 'xxLarge', 'xxxLarge'
];

/**
 * Validate and normalize a font size value
 * Returns the value if valid, or 'medium' as default
 */
export function validateFontSize(value: any): FontSize {
  if (!value || typeof value !== 'string') {
    return 'medium';
  }
  const normalized = value.trim();
  if (VALID_FONT_SIZES.includes(normalized as FontSize)) {
    return normalized as FontSize;
  }
  console.warn(`Invalid font size value: "${value}". Using default 'medium'.`);
  return 'medium';
}

/**
 * Apply font size to document
 * This function is safe to call multiple times and handles timing issues
 */
export function applyFontSize(fontSize: FontSize | string | undefined) {
  if (typeof document === 'undefined') return;
  
  // Ensure document.documentElement exists (may not be available during early initialization)
  if (!document.documentElement) {
    // If DOM isn't ready yet, wait for it
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyFontSize(fontSize);
      });
      return;
    }
    // If document exists but documentElement doesn't, retry after a short delay
    setTimeout(() => {
      applyFontSize(fontSize);
    }, 10);
    return;
  }
  
  const validSize = validateFontSize(fontSize);
  try {
    document.documentElement.setAttribute('data-font-size', validSize);
  } catch (error) {
    console.error('Error applying font size:', error);
    // Retry after a short delay in case of timing issues
    setTimeout(() => {
      try {
        if (document.documentElement) {
          document.documentElement.setAttribute('data-font-size', validSize);
        }
      } catch (retryError) {
        console.error('Error retrying font size application:', retryError);
      }
    }, 50);
  }
}

