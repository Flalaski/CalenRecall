# Drag System Haptic Feedback & Adaptive Complexity Audit

## Executive Summary

This document provides a granular audit of the minimap drag system's haptic feedback mechanisms and proposes adaptive complexity improvements to enhance user experience through intelligent, context-aware interactions.

---

## 1. Current Haptic Feedback Mechanisms

### 1.1 Audio Feedback Systems

#### A. Micro Blips (Horizontal Navigation)
- **Trigger**: Date changes during horizontal drag
- **Frequency**: One blip per date change (day-level granularity)
- **Direction-aware**: `'next'` or `'prev'` based on movement direction
- **Tier-aware**: Different pitch/tone based on `viewMode` (decade/year/month/week/day)
- **Current Implementation**: `playMicroBlip(currentViewMode, blipDirection)`
- **Location**: Line ~3936 in `handleMouseMoveFrame`

**Issues Identified**:
- ✅ Works correctly for drag operations
- ✅ Fixed to match actual indicator movement for keyboard navigation
- ⚠️ No adaptive volume based on drag speed
- ⚠️ No frequency modulation based on distance from time points (frets)

#### B. Mechanical Clicks (Vertical Tier Changes)
- **Trigger**: View mode changes (zoom in/out)
- **Direction**: `'up'` (zoom in) or `'down'` (zoom out)
- **Visual Feedback**: Mechanical click animation with gear rotation
- **Current Implementation**: `playMechanicalClick(direction)`
- **Location**: Lines ~3782, ~3817

**Issues Identified**:
- ✅ Provides clear feedback for tier changes
- ⚠️ Fixed 200ms lock prevents rapid changes (may feel sluggish)
- ⚠️ No adaptive lock duration based on user behavior
- ⚠️ No haptic feedback intensity based on tier distance

#### C. Slider Noise (Continuous Vertical Feedback)
- **Purpose**: Real-time audio feedback indicating proximity to tier change threshold
- **Update Frequency**: Every frame during vertical drag
- **Features**:
  - Distance-based volume/pitch
  - Limit state detection (at min/max tier)
  - Portamento drop on tier change
- **Current Implementation**: `createSliderNoise()` with `update()` and `setLimitState()`
- **Location**: Lines ~3106, ~3706-3712

**Issues Identified**:
- ✅ Provides continuous feedback
- ⚠️ No adaptive sensitivity based on user's drag patterns
- ⚠️ Fixed threshold (800px) may not suit all users
- ⚠️ No learning from user's preferred drag distances

---

### 1.2 Visual Feedback Systems

#### A. Radial Dial
- **Appearance**: On drag start at mouse position
- **Components**: Center dot, directional arrows, scale labels
- **Visual States**: Shows dead zones, thresholds, current movement
- **Location**: Lines ~3112-3113, ~4117-4212

**Issues Identified**:
- ✅ Clear visual representation
- ⚠️ Fixed size/opacity (no adaptive scaling)
- ⚠️ No fade-in/out based on drag duration
- ⚠️ No contextual information density adaptation

#### B. Mechanical Click Animation
- **Trigger**: Tier changes
- **Duration**: 300ms
- **Components**: Gear rotation, scale label, directional animation
- **Location**: CSS animations + state management

**Issues Identified**:
- ✅ Provides clear visual confirmation
- ⚠️ Fixed animation duration
- ⚠️ No intensity variation based on tier jump distance

#### C. Drag Limits Visualization
- **Components**: Dead zone indicators, threshold lines, current position marker
- **Update Frequency**: On drag movement
- **Location**: Lines ~3726-3762

**Issues Identified**:
- ✅ Shows user where they are in the interaction space
- ⚠️ Fixed visual representation (no adaptive opacity/color)
- ⚠️ No contextual hints based on user's history

---

### 1.3 Tactile Feedback Systems (Resistance & Dampening)

#### A. Fret-like Resistance (Horizontal)
- **Mechanism**: Power curve `Math.pow(positionInValley, 2.5)`
- **Purpose**: Creates valleys between time points requiring more drag
- **Current Values**:
  - Resistance exponent: `2.5` (reduced from `5.0`)
  - Base dampening: `0.30` at center, `0.15` at edges
  - Distance multiplier: `0.7` for large movements (>30% of timeline)
- **Location**: Lines ~3905-3941

**Issues Identified**:
- ✅ Provides mechanical feel
- ⚠️ Fixed resistance curve (no adaptation)
- ⚠️ No learning from user's preferred drag patterns
- ⚠️ No context-aware resistance (e.g., more resistance near entries)

#### B. Vertical Movement Accumulation
- **Mechanism**: Accumulates vertical delta, decays when inactive
- **Threshold**: 800px for tier change
- **Dead Zone**: 300px after tier change
- **Decay Rate**: `0.95` multiplier when inactive
- **Location**: Lines ~3679-3856

**Issues Identified**:
- ✅ Prevents accidental tier changes
- ⚠️ Fixed thresholds (800px/300px)
- ⚠️ No adaptive thresholds based on user behavior
- ⚠️ Decay may interfere with deliberate slow movements

#### C. Horizontal Lock Mechanism
- **Trigger**: Primarily vertical movement (>20px vertical, <30px horizontal)
- **Unlock**: Horizontal movement >40px or 1.5x vertical
- **Purpose**: Prevents accidental horizontal movement during zoom
- **Location**: Lines ~3642-3665

**Issues Identified**:
- ✅ Prevents accidental navigation during zoom
- ⚠️ Fixed thresholds (20px/30px/40px)
- ⚠️ No learning from user's movement patterns
- ⚠️ May be too aggressive for some users

---

## 2. Adaptive Complexity Opportunities

### 2.1 User Behavior Learning

#### A. Drag Pattern Analysis
**Current State**: No tracking of user behavior
**Opportunity**: Track and learn from:
- Average drag distances
- Preferred drag speeds
- Common tier change patterns
- Horizontal vs vertical movement ratios
- Dead zone crossing frequency

**Implementation Strategy**:
```typescript
interface DragBehaviorProfile {
  avgHorizontalDragDistance: number;
  avgVerticalDragDistance: number;
  preferredDragSpeed: number; // pixels per frame
  tierChangeFrequency: number; // changes per minute
  horizontalLockFrequency: number;
  deadZoneCrossingTime: number; // ms to cross dead zone
  resistancePreference: 'light' | 'medium' | 'heavy';
  lastUpdated: Date;
}
```

#### B. Adaptive Thresholds
**Current State**: Fixed thresholds (800px vertical, 300px dead zone)
**Opportunity**: Adjust based on user's historical behavior:
- If user consistently drags 600px → lower threshold to 600px
- If user frequently reverses → reduce dead zone to 200px
- If user drags slowly → increase sensitivity

**Implementation Strategy**:
```typescript
const adaptiveVerticalThreshold = Math.max(
  400, // Minimum
  Math.min(
    1200, // Maximum
    userProfile.avgVerticalDragDistance * 1.2 // 20% buffer
  )
);
```

### 2.2 Context-Aware Haptic Feedback

#### A. Entry Density Awareness
**Current State**: No consideration of entry density
**Opportunity**: Adjust resistance near entries:
- More resistance near entries (magnetic feel)
- Stronger blips when passing entries
- Visual/audio emphasis on entry-rich periods

**Implementation Strategy**:
```typescript
const entryDensity = getEntryDensityInRange(
  currentTimelinePosition - 0.05,
  currentTimelinePosition + 0.05
);
const entryResistanceMultiplier = 1.0 + (entryDensity * 0.3); // Up to 30% more resistance
```

#### B. Time Period Context
**Current State**: Same feedback regardless of time period
**Opportunity**: Different feedback for:
- Historical periods (more resistance, deeper sounds)
- Recent periods (lighter resistance, brighter sounds)
- Future periods (different tone, predictive feel)

**Implementation Strategy**:
```typescript
const timeContext = getTimeContext(selectedDate);
const contextMultiplier = {
  'ancient': 1.5, // More resistance
  'historical': 1.2,
  'recent': 1.0,
  'future': 0.8 // Less resistance
}[timeContext];
```

### 2.3 Adaptive Audio Complexity

#### A. Dynamic Blip Frequency
**Current State**: One blip per date change
**Opportunity**: Adaptive frequency based on:
- Drag speed (faster = more frequent)
- User preference (learned)
- Entry density (more entries = more feedback)

**Implementation Strategy**:
```typescript
const dragSpeed = Math.abs(horizontalDelta) / frameTime;
const blipFrequency = Math.min(
  1.0, // Max: every date change
  Math.max(
    0.1, // Min: every 10th date change
    dragSpeed / 100 // Adaptive based on speed
  )
);
```

#### B. Volume/Pitch Modulation
**Current State**: Fixed volume/pitch
**Opportunity**: Adaptive based on:
- Distance from time points (louder near frets)
- Drag speed (faster = higher pitch)
- User's hearing sensitivity (learned preference)

**Implementation Strategy**:
```typescript
const distanceToNearestFret = getDistanceToNearestFret(currentPosition);
const volumeMultiplier = 1.0 - (distanceToNearestFret * 0.5); // Louder near frets
const pitchOffset = dragSpeed * 0.1; // Higher pitch for faster drag
```

### 2.4 Adaptive Visual Complexity

#### A. Radial Dial Adaptation
**Current State**: Fixed appearance
**Opportunity**: Adaptive based on:
- Drag duration (fade in/out)
- User expertise (simplify for beginners, detail for experts)
- Context (highlight relevant directions)

**Implementation Strategy**:
```typescript
const dialOpacity = Math.min(1.0, Math.max(0.3, 1.0 - (dragDuration / 5000)));
const showAdvancedFeatures = userProfile.expertiseLevel > 0.7;
```

#### B. Information Density
**Current State**: Always shows all information
**Opportunity**: Progressive disclosure:
- Beginners: Simple indicators
- Intermediate: Add thresholds
- Expert: Full detail with analytics

**Implementation Strategy**:
```typescript
const informationLevel = userProfile.expertiseLevel;
if (informationLevel < 0.3) {
  // Show only essential: current position
} else if (informationLevel < 0.7) {
  // Add: thresholds, dead zones
} else {
  // Full: analytics, predictions, suggestions
}
```

### 2.5 Adaptive Resistance Curves

#### A. Learning User Preference
**Current State**: Fixed resistance curve (exponent 2.5)
**Opportunity**: Learn preferred resistance:
- Track user's drag patterns
- Adjust curve exponent based on behavior
- A/B test different curves

**Implementation Strategy**:
```typescript
// Track successful drags (user didn't reverse)
if (dragCompleted && !dragReversed) {
  userProfile.preferredResistanceExponent = 
    (userProfile.preferredResistanceExponent * 0.9) + 
    (currentResistanceExponent * 0.1); // Moving average
}
```

#### B. Contextual Resistance
**Current State**: Same resistance everywhere
**Opportunity**: Variable resistance:
- More resistance near important dates
- Less resistance in empty periods
- Magnetic feel near entries

**Implementation Strategy**:
```typescript
const baseResistance = 2.5;
const entryProximity = getNearestEntryDistance(currentPosition);
const contextualResistance = baseResistance * (1.0 + (1.0 / (entryProximity + 0.1)));
```

---

## 3. Implementation Priority Matrix

### High Priority (Quick Wins)
1. **Adaptive Thresholds** - Easy to implement, high impact
2. **Entry Density Awareness** - Enhances haptic feel significantly
3. **Dynamic Blip Frequency** - Improves feedback quality

### Medium Priority (Moderate Effort)
4. **User Behavior Learning** - Requires tracking infrastructure
5. **Adaptive Resistance Curves** - Needs careful tuning
6. **Volume/Pitch Modulation** - Audio system enhancements

### Low Priority (Future Enhancements)
7. **Progressive Visual Disclosure** - UI complexity
8. **Time Period Context** - Requires time context system
9. **Advanced Analytics** - Expert features

---

## 4. Recommended Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Create `DragBehaviorProfile` interface
- [ ] Implement basic behavior tracking
- [ ] Add localStorage persistence
- [ ] Create adaptive threshold system

### Phase 2: Core Adaptations (Week 2)
- [ ] Implement entry density awareness
- [ ] Add dynamic blip frequency
- [ ] Create adaptive resistance curves
- [ ] Add volume/pitch modulation

### Phase 3: Advanced Features (Week 3)
- [ ] Implement user behavior learning
- [ ] Add progressive visual disclosure
- [ ] Create time period context system
- [ ] Add expert mode analytics

### Phase 4: Refinement (Week 4)
- [ ] A/B testing framework
- [ ] Performance optimization
- [ ] User preference UI
- [ ] Documentation

---

## 5. Metrics for Success

### Quantitative Metrics
- **Drag Success Rate**: % of drags that complete without reversal
- **Tier Change Accuracy**: % of intended tier changes
- **User Satisfaction**: Survey scores (1-10)
- **Performance**: Frame rate during drag (target: 60fps+)

### Qualitative Metrics
- **Haptic Feel**: "Mechanical" vs "Smooth" preference
- **Learning Curve**: Time to master drag system
- **Discoverability**: Can users find advanced features?
- **Delight Factor**: Does it feel magical?

---

## 6. Technical Considerations

### Performance
- Behavior tracking should be lightweight (<1ms per frame)
- Adaptive calculations should be cached
- Use requestAnimationFrame for smooth updates
- Debounce expensive calculations

### Privacy
- Store behavior data locally only
- No external transmission
- User can reset/clear profile
- Opt-in for advanced features

### Accessibility
- Maintain keyboard navigation
- Provide haptic feedback alternatives
- Support screen readers
- Respect reduced motion preferences

---

## 7. Code Structure Recommendations

### New Files to Create
```
src/utils/dragBehavior/
  ├── dragBehaviorTracker.ts      # Tracks user behavior
  ├── adaptiveThresholds.ts       # Calculates adaptive thresholds
  ├── resistanceCurves.ts        # Adaptive resistance calculations
  └── hapticFeedbackAdapter.ts    # Context-aware haptic feedback
```

### Modifications to Existing Files
- `GlobalTimelineMinimap.tsx`: Integrate adaptive systems
- `audioUtils.ts`: Add adaptive volume/pitch functions
- `App.tsx`: Add user preference storage

---

## 8. Example Implementation: Adaptive Thresholds

```typescript
// src/utils/dragBehavior/adaptiveThresholds.ts

interface DragSession {
  verticalDistances: number[];
  horizontalDistances: number[];
  tierChanges: number;
  startTime: number;
}

class AdaptiveThresholdManager {
  private sessions: DragSession[] = [];
  private profile: DragBehaviorProfile | null = null;

  recordDragSession(session: DragSession) {
    this.sessions.push(session);
    this.updateProfile();
    this.persistProfile();
  }

  getAdaptiveVerticalThreshold(): number {
    if (!this.profile || this.sessions.length < 5) {
      return 800; // Default
    }
    
    const avgDistance = this.profile.avgVerticalDragDistance;
    return Math.max(400, Math.min(1200, avgDistance * 1.2));
  }

  getAdaptiveDeadZone(): number {
    if (!this.profile) {
      return 300; // Default
    }
    
    // If user frequently reverses, reduce dead zone
    const reversalRate = this.profile.deadZoneCrossingTime / 1000;
    return Math.max(150, Math.min(400, 300 - (reversalRate * 50)));
  }

  private updateProfile() {
    // Calculate averages, patterns, etc.
  }

  private persistProfile() {
    localStorage.setItem('dragBehaviorProfile', JSON.stringify(this.profile));
  }
}
```

---

## 9. Conclusion

The current drag system provides excellent haptic feedback, but there are significant opportunities to make it adaptively more complex and responsive to individual user behavior. By implementing adaptive thresholds, context-aware feedback, and user behavior learning, we can create a truly personalized haptic experience that feels magical and responsive.

The recommended approach is to start with high-priority quick wins (adaptive thresholds, entry density awareness) and gradually build toward more sophisticated adaptive systems as we learn what works best for users.

---

## Appendix: Current Constants Reference

### Fixed Values (Candidates for Adaptation)
- Vertical threshold: `800px`
- Dead zone size: `300px`
- Resistance exponent: `2.5`
- Base dampening: `0.30` (center) to `0.15` (edges)
- Distance multiplier threshold: `0.3` (30% of timeline)
- Horizontal dead zone: `30px`
- Horizontal unlock threshold: `40px`
- Vertical to horizontal ratio: `2.5`
- Scale change lock duration: `200ms`
- Mechanical click animation: `300ms`
- Accumulator decay rate: `0.95`

