/**
 * Theme CSS Loader
 * 
 * Automatically imports all CSS files from the themes directory.
 * This ensures that any theme file added to src/themes/ is automatically
 * included in the bundle and available for use.
 * 
 * Using Vite's import.meta.glob with eager: true will:
 * 1. Discover all .css files in the themes directory at build time
 * 2. Import them immediately, causing Vite to process and bundle them
 * 3. Make the CSS available to the application
 */

// Import all CSS files from themes directory using Vite's glob import
// The eager: true option causes all matching files to be imported immediately
// This ensures all theme CSS files are processed and included in the bundle
import.meta.glob('../themes/*.css', { eager: true });

