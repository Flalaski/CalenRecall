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
      // Optimize for Chinese characters (Hanzi)
      return `'Noto Sans SC', 'Noto Sans', 'Microsoft YaHei', 'SimHei', 'PingFang SC', 'Hiragino Sans GB', ${baseStack}`;
    
    case 'islamic':
    case 'persian':
    case 'bahai':
      // Optimize for Arabic script (used by Islamic, Persian, and Baháʼí calendars)
      return `'Noto Sans Arabic', 'Noto Sans', 'Arial Unicode MS', 'Tahoma', ${baseStack}`;
    
    case 'hebrew':
      // Optimize for Hebrew script (Hebrew calendar)
      return `'Noto Sans Hebrew', 'Noto Sans', 'Arial Hebrew', 'David', ${baseStack}`;
    
    case 'thai-buddhist':
      // Optimize for Thai script (Thai Buddhist calendar)
      return `'Noto Sans Thai', 'Noto Sans', 'Thonburi', 'Sarabun', ${baseStack}`;
    
    case 'ethiopian':
      // Optimize for Ge'ez/Ethiopic script
      return `'Noto Sans Ethiopic', 'Noto Sans', 'Abyssinica SIL', 'Nyala', 'Ebrima', ${baseStack}`;

    case 'coptic':
      // Optimize for Coptic script (Unicode block U+2C80–U+2CFF)
      return `'Noto Sans Coptic', 'Noto Sans Ethiopic', 'Noto Sans', 'Arial Unicode MS', ${baseStack}`;

    case 'iroquois':
      // Latin-based orthography with special diacritics (Kanien'kéha/Mohawk)
      return `'Noto Sans', 'Noto Sans Canadian Aboriginal', 'Inter', 'Arial Unicode MS', 'Euphemia UCAS', ${baseStack}`;
    
    case 'indian-saka':
      // Optimize for Devanagari script (Indian Saka calendar)
      return `'Noto Sans Devanagari', 'Noto Sans', 'Nirmala UI', 'Mangal', 'Arial Unicode MS', ${baseStack}`;
    
    case 'cherokee':
      // Optimize for Cherokee syllabary
      return `'Noto Sans Cherokee', 'Noto Sans', 'Plantagenet Cherokee', 'Ebrima', ${baseStack}`;
    
    case 'mayan-tzolkin':
    case 'mayan-haab':
    case 'mayan-longcount':
    case 'aztec-xiuhpohualli':
      // Mesoamerican calendars use Latin script with special diacritics
      return `'Noto Sans', 'Inter', 'Arial Unicode MS', ${baseStack}`;
    
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

