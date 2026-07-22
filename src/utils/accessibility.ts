/**
 * Accessibility System — CalenRecall
 * 
 * Provides ARIA label generation, keyboard navigation helpers,
 * screen reader announcements, and focus management utilities.
 * Designed to make the app fully navigable by keyboard and screen readers.
 */

// ── Screen Reader Announcements ──

let announcerEl: HTMLDivElement | null = null;
let announcementTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the screen reader announcer element.
 * Creates a visually-hidden aria-live region for dynamic announcements.
 */
export function initAnnouncer(): void {
  if (typeof document === 'undefined' || document.getElementById('sr-announcer')) return;

  announcerEl = document.createElement('div');
  announcerEl.id = 'sr-announcer';
  announcerEl.setAttribute('aria-live', 'polite');
  announcerEl.setAttribute('aria-atomic', 'true');
  announcerEl.className = 'sr-only';
  Object.assign(announcerEl.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  document.body.appendChild(announcerEl);
}

/**
 * Announce a message to screen readers.
 * Uses the polite announcer for general updates.
 * @param message - The message to announce
 * @param assertive - Use assertive mode for urgent announcements (use sparingly)
 */
export function announce(message: string, assertive: boolean = false): void {
  if (!announcerEl) {
    initAnnouncer();
    if (!announcerEl) return;
  }

  // Clear any pending timeout
  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
  }

  // Set the appropriate live region mode
  announcerEl.setAttribute('aria-live', assertive ? 'assertive' : 'polite');

  // Clear and reset to ensure announcement repeats even for identical messages
  announcerEl.textContent = '';
  announcementTimeout = setTimeout(() => {
    if (announcerEl) {
      announcerEl.textContent = message;
    }
  }, 50);
}

/**
 * Announce that a view mode has changed.
 */
export function announceViewChange(viewLabel: string, dateLabel: string): void {
  announce(`Viewing ${viewLabel}: ${dateLabel}`);
}

/**
 * Announce that an entry has been created/updated/deleted.
 */
export function announceEntryChange(action: 'created' | 'updated' | 'deleted', title: string): void {
  announce(`${title} ${action}.`);
}

/**
 * Announce navigation to a new date.
 */
export function announceNavigation(direction: 'previous' | 'next', period: string, dateLabel: string): void {
  announce(`Navigated ${direction}: ${period} ${dateLabel}`);
}

// ── Focus Management ──

/**
 * Focus an element by its test ID or selector, with a fallback.
 * @param selector - CSS selector or element reference
 * @param options - Focus options
 */
export function focusElement(
  selector: string | HTMLElement,
  options: { preventScroll?: boolean; delay?: number } = {}
): void {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;

  const doFocus = () => {
    (el as HTMLElement).focus({ preventScroll: options.preventScroll });
  };

  if (options.delay) {
    setTimeout(doFocus, options.delay);
  } else {
    doFocus();
  }
}

/**
 * Trap focus within a container (for modals and dialogs).
 * Returns a cleanup function to restore focus and remove the trap.
 */
export function trapFocus(container: HTMLElement, options?: { returnFocusTo?: HTMLElement | null }): () => void {
  const previouslyFocused = options?.returnFocusTo ?? (document.activeElement as HTMLElement);

  // Focus the first focusable element in the container
  const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const firstFocusable = container.querySelector(focusableSelector) as HTMLElement;
  if (firstFocusable) {
    firstFocusable.focus();
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = container.querySelectorAll(focusableSelector);
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
}

// ── ARIA Label Generators ──

/**
 * Generate ARIA label for a calendar day cell.
 */
export function getDayCellAriaLabel(
  date: Date,
  hasEntries: boolean,
  entryCount: number,
  isToday: boolean,
  isSelected: boolean
): string {
  const parts: string[] = [];
  
  parts.push(date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }));
  
  if (isToday) parts.push('Today');
  if (isSelected) parts.push('Selected');
  if (hasEntries && entryCount > 0) {
    parts.push(`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`);
  } else if (hasEntries) {
    parts.push('Has entries');
  }
  
  return parts.join('. ');
}

/**
 * Generate ARIA label for a month cell in year view.
 */
export function getMonthCellAriaLabel(
  monthName: string,
  year: number,
  entryCount: number,
  isCurrent: boolean
): string {
  const parts = [`${monthName} ${year}`];
  if (isCurrent) parts.push('Current month');
  if (entryCount > 0) parts.push(`${entryCount} entries`);
  return parts.join('. ');
}

/**
 * Generate ARIA label for a year cell in decade view.
 */
export function getYearCellAriaLabel(
  year: number,
  entryCount: number,
  isCurrent: boolean
): string {
  const parts = [`Year ${year}`];
  if (isCurrent) parts.push('Current year');
  if (entryCount > 0) parts.push(`${entryCount} entries`);
  return parts.join('. ');
}

/**
 * Generate ARIA label for a navigation button.
 */
export function getNavButtonAriaLabel(
  direction: 'previous' | 'next',
  period: string,
  label: string
): string {
  return `${direction} ${period}: ${label}`;
}

/**
 * Generate ARIA label for view mode selector.
 */
export function getViewModeAriaLabel(mode: string): string {
  const modeLabels: Record<string, string> = {
    decade: 'Decade view',
    year: 'Year view',
    month: 'Month view',
    week: 'Week view',
    day: 'Day view',
  };
  return modeLabels[mode] || `${mode} view`;
}

// ── Keyboard Navigation ──

export type KeyAction =
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'enter'
  | 'escape'
  | 'tab'
  | 'home'
  | 'end'
  | 'page-up'
  | 'page-down'
  | 'space';

/**
 * Normalize a KeyboardEvent to an action string.
 * Accounts for different modifier key combinations.
 */
export function getKeyAction(event: KeyboardEvent): KeyAction | null {
  const key = event.key;
  const isCtrl = event.ctrlKey || event.metaKey;

  // Don't intercept if typing in an input
  const target = event.target as HTMLElement;
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
    if (key === 'Escape') return 'escape'; // Allow escape to close
    return null;
  }

  switch (key) {
    case 'ArrowUp': return isCtrl ? null : 'arrow-up';
    case 'ArrowDown': return isCtrl ? null : 'arrow-down';
    case 'ArrowLeft': return 'arrow-left';
    case 'ArrowRight': return 'arrow-right';
    case 'Enter': return 'enter';
    case 'Escape': return 'escape';
    case 'Tab': return 'tab';
    case 'Home': return 'home';
    case 'End': return 'end';
    case 'PageUp': return 'page-up';
    case 'PageDown': return 'page-down';
    case ' ': return 'space';
    default: return null;
  }
}

// ── Accessibility Styles ──

/**
 * CSS to inject for screen reader only elements.
 * Injected once into the document head.
 */
export function injectSrOnlyStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sr-only-styles')) return;

  const style = document.createElement('style');
  style.id = 'sr-only-styles';
  style.textContent = `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .sr-only-focusable:focus,
    .sr-only-focusable:focus-visible {
      position: static;
      width: auto;
      height: auto;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    :focus-visible {
      outline: 2px solid -webkit-focus-ring-color;
      outline-offset: 2px;
    }
    [role="button"]:focus-visible,
    button:focus-visible {
      outline: 2px solid -webkit-focus-ring-color;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

// ── Role Mappings ──

/**
 * Get appropriate WAI-ARIA role for a calendar time range.
 */
export function getTimeRangeRole(timeRange: string): string {
  switch (timeRange) {
    case 'day': return 'gridcell';
    case 'week': return 'row';
    case 'month': return 'grid';
    case 'year': return 'list';
    case 'decade': return 'list';
    default: return 'region';
  }
}

/**
 * Initialize all accessibility services.
 * Call once at app startup.
 */
export function initializeAccessibility(): void {
  initAnnouncer();
  injectSrOnlyStyles();
}
