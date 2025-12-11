/**
 * Custom Theme Loader
 * 
 * Loads custom themes from the user data directory (themes subfolder) dynamically.
 * These themes are loaded at runtime and injected into the document as <style> tags.
 * Platform paths: Windows (AppData), macOS (Application Support), Linux (~/.config)
 */

import { loadAllThemes } from './themes';

/**
 * Load all custom themes from the user data directory and inject them into the document
 */
export async function loadCustomThemes(): Promise<void> {
  // Only run in Electron environment
  if (typeof window === 'undefined' || !window.electronAPI || !('getCustomThemes' in window.electronAPI)) {
    console.log('[CustomThemeLoader] Not in Electron environment, skipping custom theme loading');
    return;
  }

  try {
    console.log('[CustomThemeLoader] Loading custom themes...');
    const result = await (window.electronAPI as any).getCustomThemes();
    
    if (!result.success) {
      console.error('[CustomThemeLoader] Failed to load custom themes:', result.error, result.message);
      return;
    }
    
    if (!result.themes || result.themes.length === 0) {
      console.log('[CustomThemeLoader] No custom themes found');
      return;
    }
    
    console.log(`[CustomThemeLoader] Found ${result.themes.length} custom theme(s)`);
    
    // Inject each custom theme as a <style> tag
    for (const theme of result.themes) {
      try {
        // Check if style tag already exists for this theme
        const existingStyle = document.getElementById(`custom-theme-${theme.name}`);
        if (existingStyle) {
          console.log(`[CustomThemeLoader] Theme ${theme.name} already loaded, skipping`);
          continue;
        }
        
        // Create and inject style tag
        const styleTag = document.createElement('style');
        styleTag.id = `custom-theme-${theme.name}`;
        styleTag.setAttribute('data-theme-name', theme.name);
        styleTag.textContent = theme.css;
        
        // Append to document head
        document.head.appendChild(styleTag);
        console.log(`[CustomThemeLoader] ✅ Loaded custom theme: ${theme.name}`);
      } catch (error) {
        console.error(`[CustomThemeLoader] Error loading theme ${theme.name}:`, error);
      }
    }
    
    console.log('[CustomThemeLoader] Custom theme loading complete');
    
    // Reload theme list to include custom themes
    await loadAllThemes();
    console.log('[CustomThemeLoader] Theme list updated with custom themes');
  } catch (error) {
    console.error('[CustomThemeLoader] Error loading custom themes:', error);
  }
}

/**
 * Reload custom themes (useful after adding/removing theme files)
 * Removes existing custom theme styles and reloads them
 */
export async function reloadCustomThemes(): Promise<void> {
  // Remove existing custom theme style tags
  const existingStyles = document.querySelectorAll('style[data-theme-name]');
  existingStyles.forEach(style => style.remove());
  
  // Reload custom themes and update theme list
  await loadCustomThemes();
  await loadAllThemes();
}

