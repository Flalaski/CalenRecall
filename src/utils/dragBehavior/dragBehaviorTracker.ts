/**
 * Drag Behavior Tracker
 * Tracks user drag patterns and builds adaptive behavior profile
 */

export interface DragBehaviorProfile {
  avgHorizontalDragDistance: number;
  avgVerticalDragDistance: number;
  preferredDragSpeed: number; // pixels per frame
  tierChangeFrequency: number; // changes per minute (estimated)
  horizontalLockFrequency: number;
  deadZoneCrossingTime: number; // ms to cross dead zone
  resistancePreference: 'light' | 'medium' | 'heavy';
  verticalThreshold: number;
  deadZoneSize: number;
  sessionCount: number;
  lastUpdated: number; // timestamp
}

export interface DragSession {
  verticalDistances: number[];
  horizontalDistances: number[];
  tierChanges: number;
  deadZoneCrossings: number[];
  totalDragTime: number; // ms
  startTime: number;
  endTime: number;
  maxDragSpeed: number;
  avgDragSpeed: number;
}

const PROFILE_STORAGE_KEY = 'dragBehaviorProfile';
const SESSION_HISTORY_KEY = 'dragSessionHistory';
const MAX_SESSIONS = 50; // Keep last 50 sessions

class DragBehaviorTracker {
  private profile: DragBehaviorProfile | null = null;
  private currentSession: DragSession | null = null;
  private sessionHistory: DragSession[] = [];

  constructor() {
    this.loadProfile();
    this.loadSessionHistory();
  }

  /**
   * Start tracking a new drag session
   */
  startSession(): void {
    this.currentSession = {
      verticalDistances: [],
      horizontalDistances: [],
      tierChanges: 0,
      deadZoneCrossings: [],
      totalDragTime: 0,
      startTime: Date.now(),
      endTime: 0,
      maxDragSpeed: 0,
      avgDragSpeed: 0,
    };
  }

  /**
   * Record vertical movement
   */
  recordVerticalMovement(distance: number, speed: number): void {
    if (!this.currentSession) return;
    
    this.currentSession.verticalDistances.push(Math.abs(distance));
    this.currentSession.maxDragSpeed = Math.max(this.currentSession.maxDragSpeed, speed);
  }

  /**
   * Record horizontal movement
   */
  recordHorizontalMovement(distance: number, speed: number): void {
    if (!this.currentSession) return;
    
    this.currentSession.horizontalDistances.push(Math.abs(distance));
    this.currentSession.maxDragSpeed = Math.max(this.currentSession.maxDragSpeed, speed);
  }

  /**
   * Record tier change
   */
  recordTierChange(): void {
    if (!this.currentSession) return;
    this.currentSession.tierChanges++;
  }

  /**
   * Record dead zone crossing
   */
  recordDeadZoneCrossing(timeMs: number): void {
    if (!this.currentSession) return;
    this.currentSession.deadZoneCrossings.push(timeMs);
  }

  /**
   * End current session and update profile
   */
  endSession(): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.totalDragTime = 
      this.currentSession.endTime - this.currentSession.startTime;

    // Calculate average drag speed
    const totalDistances = [
      ...this.currentSession.verticalDistances,
      ...this.currentSession.horizontalDistances
    ];
    if (totalDistances.length > 0 && this.currentSession.totalDragTime > 0) {
      const totalDistance = totalDistances.reduce((sum, d) => sum + d, 0);
      this.currentSession.avgDragSpeed = totalDistance / (this.currentSession.totalDragTime / 1000);
    }

    // Add to history
    this.sessionHistory.push(this.currentSession);
    
    // Keep only last N sessions
    if (this.sessionHistory.length > MAX_SESSIONS) {
      this.sessionHistory.shift();
    }

    // Update profile
    this.updateProfile();
    this.persistProfile();
    this.persistSessionHistory();

    this.currentSession = null;
  }

  /**
   * Get adaptive vertical threshold
   */
  getAdaptiveVerticalThreshold(): number {
    if (!this.profile || this.profile.sessionCount < 3) {
      return 800; // Default
    }

    const avgDistance = this.profile.avgVerticalDragDistance;
    // Use 20% buffer above average, clamped between 400-1200px
    return Math.max(400, Math.min(1200, avgDistance * 1.2));
  }

  /**
   * Get adaptive dead zone size
   */
  getAdaptiveDeadZoneSize(): number {
    if (!this.profile || this.profile.sessionCount < 3) {
      return 300; // Default
    }

    // If user frequently crosses dead zone quickly, reduce it
    // If user takes long to cross, increase it slightly
    const avgCrossingTime = this.profile.deadZoneCrossingTime;
    let adaptiveSize = 300;

    if (avgCrossingTime > 0) {
      // Quick crossings (<500ms) suggest dead zone is too large
      if (avgCrossingTime < 500) {
        adaptiveSize = Math.max(150, 300 - (500 - avgCrossingTime) / 10);
      }
      // Slow crossings (>2000ms) suggest dead zone might be good, but user struggles
      else if (avgCrossingTime > 2000) {
        adaptiveSize = Math.min(400, 300 + (avgCrossingTime - 2000) / 20);
      }
    }

    return adaptiveSize;
  }

  /**
   * Get current behavior profile
   */
  getProfile(): DragBehaviorProfile | null {
    return this.profile;
  }

  /**
   * Update profile based on session history
   */
  private updateProfile(): void {
    if (this.sessionHistory.length === 0) {
      this.profile = this.getDefaultProfile();
      return;
    }

    // Calculate averages from recent sessions (last 20 sessions or all if less)
    const recentSessions = this.sessionHistory.slice(-20);
    
    const allVerticalDistances = recentSessions.flatMap(s => s.verticalDistances);
    const allHorizontalDistances = recentSessions.flatMap(s => s.horizontalDistances);
    const allDeadZoneCrossings = recentSessions.flatMap(s => s.deadZoneCrossings);
    const allSpeeds = recentSessions.map(s => s.avgDragSpeed).filter(s => s > 0);

    const avgVertical = allVerticalDistances.length > 0
      ? allVerticalDistances.reduce((sum, d) => sum + d, 0) / allVerticalDistances.length
      : 0;

    const avgHorizontal = allHorizontalDistances.length > 0
      ? allHorizontalDistances.reduce((sum, d) => sum + d, 0) / allHorizontalDistances.length
      : 0;

    const avgSpeed = allSpeeds.length > 0
      ? allSpeeds.reduce((sum, s) => sum + s, 0) / allSpeeds.length
      : 0;

    const avgDeadZoneCrossing = allDeadZoneCrossings.length > 0
      ? allDeadZoneCrossings.reduce((sum, t) => sum + t, 0) / allDeadZoneCrossings.length
      : 0;

    const totalTierChanges = recentSessions.reduce((sum, s) => sum + s.tierChanges, 0);
    const totalTime = recentSessions.reduce((sum, s) => sum + s.totalDragTime, 0);
    const tierChangeFrequency = totalTime > 0
      ? (totalTierChanges / (totalTime / 1000)) * 60 // per minute
      : 0;

    // Determine resistance preference based on drag patterns
    // Heavy: large distances, slow speed → high resistance
    // Light: small distances, fast speed → low resistance
    let resistancePreference: 'light' | 'medium' | 'heavy' = 'medium';
    if (avgVertical > 600 && avgSpeed < 50) {
      resistancePreference = 'heavy';
    } else if (avgVertical < 400 && avgSpeed > 100) {
      resistancePreference = 'light';
    }

    // Use existing profile values as base, update with new data (exponential moving average)
    const existingProfile = this.profile || this.getDefaultProfile();
    const alpha = 0.3; // Learning rate

    this.profile = {
      avgHorizontalDragDistance: existingProfile.avgHorizontalDragDistance * (1 - alpha) + avgHorizontal * alpha,
      avgVerticalDragDistance: existingProfile.avgVerticalDragDistance * (1 - alpha) + avgVertical * alpha,
      preferredDragSpeed: existingProfile.preferredDragSpeed * (1 - alpha) + avgSpeed * alpha,
      tierChangeFrequency: existingProfile.tierChangeFrequency * (1 - alpha) + tierChangeFrequency * alpha,
      horizontalLockFrequency: existingProfile.horizontalLockFrequency, // Track separately
      deadZoneCrossingTime: existingProfile.deadZoneCrossingTime * (1 - alpha) + avgDeadZoneCrossing * alpha,
      resistancePreference,
      verticalThreshold: this.getAdaptiveVerticalThreshold(),
      deadZoneSize: this.getAdaptiveDeadZoneSize(),
      sessionCount: this.sessionHistory.length,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get default profile
   */
  private getDefaultProfile(): DragBehaviorProfile {
    return {
      avgHorizontalDragDistance: 0,
      avgVerticalDragDistance: 800,
      preferredDragSpeed: 50,
      tierChangeFrequency: 0,
      horizontalLockFrequency: 0,
      deadZoneCrossingTime: 0,
      resistancePreference: 'medium',
      verticalThreshold: 800,
      deadZoneSize: 300,
      sessionCount: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Load profile from localStorage
   */
  private loadProfile(): void {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
        this.profile = JSON.parse(stored);
      }
    } catch (error) {
      console.debug('Failed to load drag behavior profile:', error);
      this.profile = this.getDefaultProfile();
    }
  }

  /**
   * Persist profile to localStorage
   */
  private persistProfile(): void {
    try {
      if (this.profile) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      }
    } catch (error) {
      console.debug('Failed to persist drag behavior profile:', error);
    }
  }

  /**
   * Load session history from localStorage
   */
  private loadSessionHistory(): void {
    try {
      const stored = localStorage.getItem(SESSION_HISTORY_KEY);
      if (stored) {
        this.sessionHistory = JSON.parse(stored);
        // Limit to MAX_SESSIONS
        if (this.sessionHistory.length > MAX_SESSIONS) {
          this.sessionHistory = this.sessionHistory.slice(-MAX_SESSIONS);
        }
      }
    } catch (error) {
      console.debug('Failed to load drag session history:', error);
      this.sessionHistory = [];
    }
  }

  /**
   * Persist session history to localStorage
   */
  private persistSessionHistory(): void {
    try {
      // Only persist last 20 sessions to save space
      const toPersist = this.sessionHistory.slice(-20);
      localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(toPersist));
    } catch (error) {
      console.debug('Failed to persist drag session history:', error);
    }
  }

  /**
   * Reset profile (for testing or user preference)
   */
  resetProfile(): void {
    this.profile = this.getDefaultProfile();
    this.sessionHistory = [];
    this.persistProfile();
    this.persistSessionHistory();
  }
}

// Singleton instance
export const dragBehaviorTracker = new DragBehaviorTracker();

