/**
 * Display refresh rate detection and management
 * Supports ultra-high refresh rate monitors (120Hz, 144Hz, 240Hz, etc.)
 */

class DisplayRefreshRate {
  private refreshRate: number = 60; // Default to 60Hz
  private frameBudget: number = 16.67; // Default 16.67ms for 60Hz
  private isDetecting: boolean = false;
  private detectionFrames: number[] = [];
  private readonly DETECTION_SAMPLE_SIZE = 60; // Sample 60 frames
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private callbacks: Set<(refreshRate: number, frameBudget: number) => void> = new Set();

  constructor() {
    this.detectRefreshRate();
    // Re-detect on visibility change (monitor change, display settings change)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Re-detect when tab becomes visible (might have changed monitors)
          setTimeout(() => this.detectRefreshRate(), 100);
        }
      });
    }
  }

  /**
   * Detect the actual display refresh rate
   */
  private detectRefreshRate(): void {
    if (this.isDetecting) return;
    this.isDetecting = true;
    this.detectionFrames = [];
    this.lastFrameTime = performance.now();

    const measureFrame = (currentTime: number) => {
      const frameTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      if (frameTime > 0 && frameTime < 100) {
        // Valid frame time (between 0 and 100ms)
        this.detectionFrames.push(frameTime);
      }

      if (this.detectionFrames.length < this.DETECTION_SAMPLE_SIZE) {
        this.rafId = requestAnimationFrame(measureFrame);
      } else {
        this.calculateRefreshRate();
        this.isDetecting = false;
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }
    };

    this.rafId = requestAnimationFrame(measureFrame);
  }

  /**
   * Calculate refresh rate from frame time samples
   */
  private calculateRefreshRate(): void {
    if (this.detectionFrames.length === 0) {
      this.refreshRate = 60;
      this.frameBudget = 16.67;
      return;
    }

    // Calculate average frame time
    const sum = this.detectionFrames.reduce((a, b) => a + b, 0);
    const averageFrameTime = sum / this.detectionFrames.length;

    // Convert to refresh rate (Hz)
    this.refreshRate = Math.round(1000 / averageFrameTime);

    // Round to common refresh rates for cleaner values
    const commonRates = [60, 75, 120, 144, 165, 240, 360];
    const closest = commonRates.reduce((prev, curr) => {
      return Math.abs(curr - this.refreshRate) < Math.abs(prev - this.refreshRate)
        ? curr
        : prev;
    });
    this.refreshRate = closest;

    // Calculate frame budget (time per frame in ms)
    this.frameBudget = 1000 / this.refreshRate;

    // Notify all callbacks
    this.notifyCallbacks();
  }

  /**
   * Get current refresh rate
   */
  getRefreshRate(): number {
    return this.refreshRate;
  }

  /**
   * Get current frame budget in milliseconds
   */
  getFrameBudget(): number {
    return this.frameBudget;
  }

  /**
   * Get frame budget with safety margin (leaves buffer for browser overhead)
   */
  getFrameBudgetWithMargin(marginPercent: number = 20): number {
    return this.frameBudget * (1 - marginPercent / 100);
  }

  /**
   * Subscribe to refresh rate changes
   */
  onRefreshRateChange(
    callback: (refreshRate: number, frameBudget: number) => void
  ): () => void {
    this.callbacks.add(callback);
    // Immediately call with current values
    callback(this.refreshRate, this.frameBudget);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all subscribers of refresh rate change
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(this.refreshRate, this.frameBudget);
      } catch (error) {
        console.error('Error in refresh rate callback:', error);
      }
    });
  }

  /**
   * Force re-detection (useful after display settings change)
   */
  redetect(): void {
    this.detectRefreshRate();
  }

  /**
   * Get optimal throttle FPS based on refresh rate
   * For high refresh rates, we can throttle less aggressively
   */
  getOptimalThrottleFPS(): number {
    // For refresh rates >= 120Hz, use native refresh rate
    // For lower rates, cap at refresh rate
    return Math.min(this.refreshRate, 240); // Cap at 240fps max
  }
}

// Singleton instance
export const displayRefreshRate = new DisplayRefreshRate();

// Export class for custom instances
export default DisplayRefreshRate;

