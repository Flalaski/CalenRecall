/**
 * High-performance task scheduler with adaptive frame budgeting
 * Uses modern performance APIs for optimal scheduling
 * Supports ultra-high refresh rate monitors (120Hz, 144Hz, 240Hz, etc.)
 */

import { displayRefreshRate } from './displayRefreshRate';

interface Task {
  id: number;
  fn: () => void;
  priority: 'critical' | 'high' | 'normal' | 'low';
  deadline?: number; // Optional deadline in ms
}

interface SchedulerConfig {
  frameBudget: number; // Auto-detected from display refresh rate
  adaptiveBudget: boolean; // Adjust based on frame time
  maxConsecutiveFrames: number; // Max frames to process in one go
  idleTimeout: number; // Timeout for requestIdleCallback
  useDisplayRefreshRate: boolean; // Use actual monitor refresh rate
}

class TaskScheduler {
  private taskQueue: Task[] = [];
  private criticalQueue: Task[] = [];
  private isProcessing = false;
  private frameId: number | null = null;
  private taskIdCounter = 0;
  private config: SchedulerConfig;
  private performanceObserver: PerformanceObserver | null = null;
  private averageFrameTime = 16; // Track average frame time
  private frameTimeHistory: number[] = [];
  private readonly FRAME_HISTORY_SIZE = 60; // Track last 60 frames
  private refreshRateUnsubscribe: (() => void) | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    const useDisplayRefreshRate = config.useDisplayRefreshRate !== false;
    const initialFrameBudget = useDisplayRefreshRate
      ? displayRefreshRate.getFrameBudgetWithMargin(20) // 20% margin for overhead
      : (config.frameBudget || 16);

    this.config = {
      frameBudget: initialFrameBudget,
      adaptiveBudget: true,
      maxConsecutiveFrames: 3,
      idleTimeout: 100,
      useDisplayRefreshRate,
      ...config,
    };

    // Subscribe to refresh rate changes if enabled
    if (useDisplayRefreshRate) {
      this.refreshRateUnsubscribe = displayRefreshRate.onRefreshRateChange(
        (refreshRate, frameBudget) => {
          this.config.frameBudget = frameBudget * 0.8; // 20% margin
          // Recalculate average frame time based on new refresh rate
          this.averageFrameTime = frameBudget;
        }
      );
    }

    this.initializePerformanceObserver();
  }

  /**
   * Monitor frame performance to adapt budget
   */
  private initializePerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            const duration = entry.duration;
            this.updateFrameTimeHistory(duration);
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // PerformanceObserver not supported
      console.warn('PerformanceObserver not available');
    }
  }

  private updateFrameTimeHistory(frameTime: number): void {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.FRAME_HISTORY_SIZE) {
      this.frameTimeHistory.shift();
    }

    // Calculate rolling average
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    this.averageFrameTime = sum / this.frameTimeHistory.length;

    // Adapt budget if enabled
    if (this.config.adaptiveBudget) {
      // If we're consistently under budget, we can use more
      // If we're over, reduce budget
      if (this.averageFrameTime < 12) {
        this.config.frameBudget = Math.min(20, this.config.frameBudget + 0.5);
      } else if (this.averageFrameTime > 18) {
        this.config.frameBudget = Math.max(10, this.config.frameBudget - 0.5);
      }
    }
  }

  /**
   * Schedule a task with priority
   */
  schedule(
    fn: () => void,
    priority: Task['priority'] = 'normal',
    deadline?: number
  ): number {
    const task: Task = {
      id: ++this.taskIdCounter,
      fn,
      priority,
      deadline,
    };

    if (priority === 'critical') {
      this.criticalQueue.push(task);
    } else {
      this.taskQueue.push(task);
    }

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return task.id;
  }

  /**
   * Cancel a scheduled task
   */
  cancel(taskId: number): boolean {
    const criticalIndex = this.criticalQueue.findIndex(t => t.id === taskId);
    if (criticalIndex !== -1) {
      this.criticalQueue.splice(criticalIndex, 1);
      return true;
    }

    const normalIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (normalIndex !== -1) {
      this.taskQueue.splice(normalIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Start processing tasks
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processFrame();
  }

  /**
   * Process tasks within frame budget
   */
  private processFrame(): void {
    const startTime = performance.now();
    let frameCount = 0;
    let tasksProcessed = 0;

    // Process critical tasks first (always within budget)
    while (this.criticalQueue.length > 0 && frameCount < this.config.maxConsecutiveFrames) {
      const elapsed = performance.now() - startTime;
      const remainingBudget = this.config.frameBudget - elapsed;

      if (remainingBudget < 2) break; // Leave 2ms buffer

      const task = this.criticalQueue.shift();
      if (task) {
        const taskStart = performance.now();
        try {
          task.fn();
        } catch (error) {
          console.error('Task execution error:', error);
        }
        const taskDuration = performance.now() - taskStart;
        
        // Warn if task exceeds budget
        if (taskDuration > this.config.frameBudget) {
          console.warn(`Task exceeded frame budget: ${taskDuration.toFixed(2)}ms`);
        }
        tasksProcessed++;
      }
      frameCount++;
    }

    // Process normal priority tasks
    while (this.taskQueue.length > 0 && frameCount < this.config.maxConsecutiveFrames) {
      const elapsed = performance.now() - startTime;
      const remainingBudget = this.config.frameBudget - elapsed;

      if (remainingBudget < 2) break;

      // Check deadlines
      const now = performance.now();
      const overdueTasks = this.taskQueue.filter(
        t => t.deadline && t.deadline < now
      );
      
      // Process overdue tasks first
      const task = overdueTasks.length > 0 
        ? this.taskQueue.splice(this.taskQueue.indexOf(overdueTasks[0]), 1)[0]
        : this.taskQueue.shift();

      if (task) {
        const taskStart = performance.now();
        try {
          task.fn();
        } catch (error) {
          console.error('Task execution error:', error);
        }
        tasksProcessed++;
      }
      frameCount++;
    }

    const frameTime = performance.now() - startTime;

    // Continue processing if there are more tasks
    if (this.criticalQueue.length > 0 || this.taskQueue.length > 0) {
      // Use requestIdleCallback if available, otherwise requestAnimationFrame
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(
          () => {
            this.frameId = requestAnimationFrame(() => this.processFrame());
          },
          { timeout: this.config.idleTimeout }
        );
      } else {
        this.frameId = requestAnimationFrame(() => this.processFrame());
      }
    } else {
      this.isProcessing = false;
      this.frameId = null;
    }

    // Performance measurement
    if (this.performanceObserver && typeof performance.mark !== 'undefined') {
      const markName = `task-scheduler-frame-${Date.now()}`;
      performance.mark(markName);
      performance.measure(
        'task-scheduler-frame',
        markName,
        `task-scheduler-frame-${Date.now()}`
      );
    }
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.taskQueue = [];
    this.criticalQueue = [];
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get current queue sizes
   */
  getQueueSize(): { critical: number; normal: number } {
    return {
      critical: this.criticalQueue.length,
      normal: this.taskQueue.length,
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    averageFrameTime: number;
    queueSize: { critical: number; normal: number };
    currentBudget: number;
  } {
    return {
      averageFrameTime: this.averageFrameTime,
      queueSize: this.getQueueSize(),
      currentBudget: this.config.frameBudget,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    if (this.refreshRateUnsubscribe) {
      this.refreshRateUnsubscribe();
      this.refreshRateUnsubscribe = null;
    }
  }
}

// Singleton instance for global use - automatically uses display refresh rate
export const globalTaskScheduler = new TaskScheduler({
  useDisplayRefreshRate: true, // Enable automatic refresh rate detection
});

// Export class for custom instances
export default TaskScheduler;

