/**
 * High-performance animation manager with compositor optimization
 * Throttles concurrent animations, manages will-change
 */

interface AnimationConfig {
  element: HTMLElement;
  property: string;
  from: number | string;
  to: number | string;
  duration: number;
  easing?: string;
  onComplete?: () => void;
}

class AnimationManager {
  private activeAnimations: Map<HTMLElement, Set<string>> = new Map();
  private animationQueue: AnimationConfig[] = [];
  private maxConcurrent = 10; // Limit concurrent animations
  private rafId: number | null = null;

  /**
   * Start an animation (compositor-optimized)
   */
  animate(config: AnimationConfig): void {
    const { element, property } = config;

    // Check if already animating this property
    const elementAnimations = this.activeAnimations.get(element);
    if (elementAnimations?.has(property)) {
      // Cancel existing animation
      this.cancelAnimation(element, property);
    }

    // Ensure compositor-friendly properties only
    if (!this.isCompositorProperty(property)) {
      console.warn(
        `Animation on non-compositor property: ${property}. Use transform/opacity instead.`
      );
      return;
    }

    // Check concurrent animation limit
    if (this.getActiveCount() >= this.maxConcurrent) {
      this.animationQueue.push(config);
      return;
    }

    this.startAnimation(config);
  }

  /**
   * Start animation with proper will-change management
   */
  private startAnimation(config: AnimationConfig): void {
    const { element, property, from, to, duration, easing, onComplete } = config;

    // Set will-change for compositor optimization
    this.setWillChange(element, property, true);

    // Use CSS animation for compositor optimization
    const animationName = `anim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const keyframes = this.generateKeyframes(property, from, to);

    // Inject keyframes
    this.injectKeyframes(animationName, keyframes, duration, easing);

    // Apply animation
    element.style.animation = `${animationName} ${duration}ms ${easing || 'ease-out'} forwards`;

    // Track animation
    if (!this.activeAnimations.has(element)) {
      this.activeAnimations.set(element, new Set());
    }
    this.activeAnimations.get(element)!.add(property);

    // Cleanup on complete
    const handleComplete = () => {
      element.style.animation = '';
      this.setWillChange(element, property, false);
      this.activeAnimations.get(element)?.delete(property);
      if (onComplete) onComplete();

      // Process queue
      this.processQueue();
    };

    element.addEventListener('animationend', handleComplete, { once: true });
  }

  /**
   * Generate keyframes for property
   */
  private generateKeyframes(
    property: string,
    from: number | string,
    to: number | string
  ): string {
    if (property === 'transform') {
      return `
        0% { transform: ${from}; }
        100% { transform: ${to}; }
      `;
    } else if (property === 'opacity') {
      return `
        0% { opacity: ${from}; }
        100% { opacity: ${to}; }
      `;
    }
    return '';
  }

  /**
   * Inject keyframes into document
   */
  private injectKeyframes(
    name: string,
    keyframes: string,
    duration: number,
    easing?: string
  ): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ${name} {
        ${keyframes}
      }
    `;
    document.head.appendChild(style);

    // Remove after animation completes
    setTimeout(() => {
      style.remove();
    }, duration + 100);
  }

  /**
   * Set will-change efficiently
   */
  private setWillChange(element: HTMLElement, property: string, enable: boolean): void {
    const current = element.style.willChange;
    const properties = current ? current.split(',').map(p => p.trim()) : [];

    if (enable) {
      if (!properties.includes(property)) {
        properties.push(property);
        element.style.willChange = properties.join(', ');
      }
    } else {
      const index = properties.indexOf(property);
      if (index !== -1) {
        properties.splice(index, 1);
        element.style.willChange = properties.length > 0 ? properties.join(', ') : 'auto';
      }
    }
  }

  /**
   * Check if property is compositor-friendly
   */
  private isCompositorProperty(property: string): boolean {
    return property === 'transform' || property === 'opacity';
  }

  /**
   * Get active animation count
   */
  private getActiveCount(): number {
    let count = 0;
    this.activeAnimations.forEach((set) => {
      count += set.size;
    });
    return count;
  }

  /**
   * Process animation queue
   */
  private processQueue(): void {
    while (
      this.animationQueue.length > 0 &&
      this.getActiveCount() < this.maxConcurrent
    ) {
      const config = this.animationQueue.shift();
      if (config) {
        this.startAnimation(config);
      }
    }
  }

  /**
   * Cancel animation
   */
  cancelAnimation(element: HTMLElement, property: string): void {
    const elementAnimations = this.activeAnimations.get(element);
    if (elementAnimations?.has(property)) {
      element.style.animation = '';
      this.setWillChange(element, property, false);
      elementAnimations.delete(property);
    }
  }

  /**
   * Cancel all animations for element
   */
  cancelAll(element: HTMLElement): void {
    const elementAnimations = this.activeAnimations.get(element);
    if (elementAnimations) {
      elementAnimations.forEach((property) => {
        this.cancelAnimation(element, property);
      });
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.activeAnimations.forEach((animations, element) => {
      animations.forEach((property) => {
        this.cancelAnimation(element, property);
      });
    });
    this.activeAnimations.clear();
    this.animationQueue = [];
  }
}

export const globalAnimationManager = new AnimationManager();
export default AnimationManager;

