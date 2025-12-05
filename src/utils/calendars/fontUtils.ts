/**
 * Font Utilities for Calendar Systems
 * 
 * Provides font-family strings optimized for specific scripts/languages
 * used in calendar displays. Ensures proper rendering of multilingual text.
 */

/**
 * Get the appropriate font stack for a calendar system
 * Returns font-family CSS value optimized for the calendar's script
 * 
 * @param calendar Calendar system identifier
 * @returns Font-family CSS string
 */
export function getFontStackForCalendar(calendar: string): string {
  // Base multilingual stack (works for most calendars)
  const baseStack = `'Noto Sans', 'Noto Sans SC', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'SimHei', 'PingFang SC', sans-serif`;
  
  // Script-specific optimizations
  switch (calendar) {
    case 'chinese':
      // Optimize for Chinese characters
      return `'Noto Sans SC', 'Noto Sans', 'Microsoft YaHei', 'SimHei', 'PingFang SC', 'Hiragino Sans GB', ${baseStack}`;
    
    case 'islamic':
    case 'persian':
    case 'bahai':
      // Optimize for Arabic script
      return `'Noto Sans Arabic', 'Noto Sans', 'Arial Unicode MS', 'Tahoma', ${baseStack}`;
    
    case 'hebrew':
      // Optimize for Hebrew script
      return `'Noto Sans Hebrew', 'Noto Sans', 'Arial Hebrew', 'David', ${baseStack}`;
    
    case 'thai-buddhist':
      // Optimize for Thai script
      return `'Noto Sans Thai', 'Noto Sans', 'Thonburi', 'Sarabun', ${baseStack}`;
    
    default:
      // Default multilingual stack
      return baseStack;
  }
}

/**
 * Apply font stack to an element based on calendar
 * Useful for dynamically setting fonts when calendar changes
 * 
 * @param element HTML element to style
 * @param calendar Calendar system identifier
 */
export function applyCalendarFont(element: HTMLElement, calendar: string): void {
  element.style.fontFamily = getFontStackForCalendar(calendar);
}

