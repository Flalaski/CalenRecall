/**
 * High-performance style batching with RAF and CSS custom properties
 * Minimizes reflows and repaints
 */

interface StyleUpdate {
  element: HTMLElement;
  styles: Partial<CSSStyleDeclaration>;
  priority: 'critical' | 'normal';
}

class StyleBatcher {
  private updateQueue: Map<HTMLElement, StyleUpdate> = new Map();
  private isScheduled = false;
  private rafId: number | null = null;
  private readonly BATCH_SIZE = 50; // Max elements to update per frame

  /**
   * Queue a style update
   */
  queue(
    element: HTMLElement,
    styles: Partial<CSSStyleDeclaration>,
    priority: 'critical' | 'normal' = 'normal'
  ): void {
    const existing = this.updateQueue.get(element);
    if (existing) {
      // Merge styles
      existing.styles = { ...existing.styles, ...styles };
      if (priority === 'critical') {
        existing.priority = 'critical';
      }
    } else {
      this.updateQueue.set(element, { element, styles, priority });
    }

    if (!this.isScheduled) {
      this.scheduleBatch();
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    this.isScheduled = true;
    this.rafId = requestAnimationFrame(() => {
      this.processBatch();
    });
  }

  /**
   * Process queued style updates
   */
  private processBatch(): void {
    const startTime = performance.now();
    const updates = Array.from(this.updateQueue.values());

    // Sort by priority
    updates.sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (a.priority !== 'critical' && b.priority === 'critical') return 1;
      return 0;
    });

    // Process critical updates first
    const critical = updates.filter(u => u.priority === 'critical');
    const normal = updates.filter(u => u.priority === 'normal');

    // Process critical updates immediately
    critical.forEach((update) => {
      this.applyStyles(update.element, update.styles);
      this.updateQueue.delete(update.element);
    });

    // Process normal updates in batches
    let processed = 0;
    for (const update of normal) {
      if (processed >= this.BATCH_SIZE) break;

      const elapsed = performance.now() - startTime;
      if (elapsed > 12) break; // Leave 4ms buffer

      this.applyStyles(update.element, update.styles);
      this.updateQueue.delete(update.element);
      processed++;
    }

    // Continue if more updates remain
    if (this.updateQueue.size > 0) {
      this.scheduleBatch();
    } else {
      this.isScheduled = false;
      this.rafId = null;
    }
  }

  /**
   * Apply styles efficiently
   */
  private applyStyles(
    element: HTMLElement,
    styles: Partial<CSSStyleDeclaration>
  ): void {
    // Use CSS custom properties where possible (compositor-friendly)
    const customProps: Record<string, string> = {};
    const directStyles: Partial<CSSStyleDeclaration> = {};

    Object.entries(styles).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      // Map common properties to CSS variables
      const cssVarName = this.getCSSVarName(key);
      if (cssVarName && this.isCompositorProperty(key)) {
        customProps[cssVarName] = String(value);
      } else {
        (directStyles as any)[key] = value;
      }
    });

    // Apply CSS custom properties (single reflow)
    if (Object.keys(customProps).length > 0) {
      Object.entries(customProps).forEach(([prop, value]) => {
        element.style.setProperty(prop, value);
      });
    }

    // Apply direct styles (batch via Object.assign)
    if (Object.keys(directStyles).length > 0) {
      Object.assign(element.style, directStyles);
    }
  }

  /**
   * Get CSS variable name for property
   */
  private getCSSVarName(property: string): string | null {
    const mapping: Record<string, string> = {
      transform: '--transform',
      opacity: '--opacity',
      backgroundColor: '--bg-color',
      color: '--text-color',
      width: '--width',
      height: '--height',
    };
    return mapping[property] || null;
  }

  /**
   * Check if property is compositor-friendly
   */
  private isCompositorProperty(property: string): boolean {
    const compositorProps = [
      'transform',
      'opacity',
      'willChange',
      'backfaceVisibility',
      'perspective',
    ];
    return compositorProps.includes(property);
  }

  /**
   * Flush all pending updates immediately
   */
  flush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.processBatch();
  }

  /**
   * Clear all queued updates
   */
  clear(): void {
    this.updateQueue.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isScheduled = false;
  }
}

// Singleton instance
export const globalStyleBatcher = new StyleBatcher();
export default StyleBatcher;

