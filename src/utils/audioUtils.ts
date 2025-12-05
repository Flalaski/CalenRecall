// Shared audio context for all UI sounds - reuse to avoid creation overhead
let sharedAudioContext: AudioContext | null = null;

// Initialize audio context on first use
export function getAudioContext(): AudioContext | null {
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.debug('Audio context not available:', error);
      return null;
    }
  }
  
  // Check if context was closed (shouldn't happen, but handle gracefully)
  if (sharedAudioContext.state === 'closed') {
    // Reset and try to create a new one
    sharedAudioContext = null;
    try {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.debug('Audio context recreation failed:', error);
      return null;
    }
  }
  
  // Resume audio context if suspended (browsers require user interaction)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch((error) => {
      // Silently fail if resume is not possible
      console.debug('Audio context resume failed:', error);
    });
  }
  
  return sharedAudioContext;
}

// Generate mechanical click sound using Web Audio API (for minimap scale changes)
export function playMechanicalClick(direction: 'up' | 'down'): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return;
  }
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Create a mechanical click sound - sharp transient with resonance
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(direction === 'up' ? 800 : 600, now);
    oscillator.frequency.exponentialRampToValueAtTime(direction === 'up' ? 400 : 300, now + 0.05);
    
    // Envelope for click sound
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.1);
    
    // Add a second click for mechanical feel
    setTimeout(() => {
      // Re-check context state in case it changed
      if (!audioContext || audioContext.state === 'closed') {
        return;
      }
      
      try {
        const now2 = audioContext.currentTime;
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(direction === 'up' ? 1200 : 900, now2);
        oscillator2.frequency.exponentialRampToValueAtTime(direction === 'up' ? 500 : 400, now2 + 0.03);
        
        gainNode2.gain.setValueAtTime(0, now2);
        gainNode2.gain.linearRampToValueAtTime(0.2, now2 + 0.001);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.03);
        gainNode2.gain.linearRampToValueAtTime(0, now2 + 0.08);
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.start(now2);
        oscillator2.stop(now2 + 0.08);
      } catch (error) {
        // Silently fail if second click cannot be created
        console.debug('Second click audio error:', error);
      }
    }, 20);
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug('Mechanical click audio error:', error);
  }
}

// Generate micro mechanical blip sound for date changes during dragging
export function playMicroBlip(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return;
  }
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Create a very short, quiet mechanical blip - subtle tick sound
    oscillator.type = 'sine';
    const now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime(1000, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.02);
    
    // Very short envelope for micro blip - quieter and shorter than main click
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.0005);
    gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.04);
  } catch (error) {
    // Silently fail if audio creation fails
    console.debug('Micro blip audio error:', error);
  }
}

// Navigation sound - for prev/next/today buttons
export function playNavigationSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Gentle navigation sound - smooth transition
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, now);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(450, now + 0.15);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.18);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch (error) {
    console.debug('Navigation sound error:', error);
  }
}

// Mode selection sound - for view mode buttons
export function playModeSelectionSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Confident selection sound - clear and decisive
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(700, now);
    oscillator.frequency.linearRampToValueAtTime(850, now + 0.06);
    oscillator.frequency.linearRampToValueAtTime(550, now + 0.12);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.debug('Mode selection sound error:', error);
  }
}

// Save/confirmation sound - for save buttons
export function playSaveSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Positive confirmation sound - ascending, satisfying
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(800, now + 0.1);
    oscillator.frequency.linearRampToValueAtTime(1000, now + 0.2);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.15);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.25);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  } catch (error) {
    console.debug('Save sound error:', error);
  }
}

// Cancel sound - for cancel buttons
export function playCancelSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Neutral cancel sound - descending, non-committal
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(450, now + 0.1);
    oscillator.frequency.linearRampToValueAtTime(350, now + 0.18);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch (error) {
    console.debug('Cancel sound error:', error);
  }
}

// Delete/warning sound - for delete buttons
export function playDeleteSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Warning sound - lower, more serious tone
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.linearRampToValueAtTime(300, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(250, now + 0.15);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.18);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch (error) {
    console.debug('Delete sound error:', error);
  }
}

// Edit sound - for edit buttons
export function playEditSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Edit sound - quick, precise
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(650, now);
    oscillator.frequency.linearRampToValueAtTime(750, now + 0.05);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.1);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.28, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.08);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.12);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  } catch (error) {
    console.debug('Edit sound error:', error);
  }
}

// New entry/creation sound - for new entry buttons
export function playNewEntrySound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Creation sound - bright, optimistic, ascending
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(550, now);
    oscillator.frequency.linearRampToValueAtTime(750, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(950, now + 0.16);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.32, now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.14);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch (error) {
    console.debug('New entry sound error:', error);
  }
}

// Add sound - for add tag buttons
export function playAddSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Quick add sound - short, positive
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(700, now);
    oscillator.frequency.linearRampToValueAtTime(850, now + 0.06);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.08);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  } catch (error) {
    console.debug('Add sound error:', error);
  }
}

// Remove sound - for remove tag buttons
export function playRemoveSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Quick remove sound - short, descending
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(700, now);
    oscillator.frequency.linearRampToValueAtTime(550, now + 0.06);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.08);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  } catch (error) {
    console.debug('Remove sound error:', error);
  }
}

// Settings/preferences sound - for preferences button
export function playSettingsSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Settings sound - neutral, balanced
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(650, now + 0.04);
    oscillator.frequency.linearRampToValueAtTime(550, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.12);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.28, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.debug('Settings sound error:', error);
  }
}

// Reset sound - for reset buttons
export function playResetSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Reset sound - descending then ascending, like a reset cycle
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(400, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.16);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch (error) {
    console.debug('Reset sound error:', error);
  }
}

// Export sound - for export buttons
export function playExportSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Export sound - ascending, like data flowing out
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, now);
    oscillator.frequency.linearRampToValueAtTime(700, now + 0.1);
    oscillator.frequency.linearRampToValueAtTime(900, now + 0.2);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.15);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.25);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  } catch (error) {
    console.debug('Export sound error:', error);
  }
}

// Calendar selection sound - for clicking calendar cells
export function playCalendarSelectionSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Calendar selection sound - crisp, precise click for date selection
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(650, now);
    oscillator.frequency.linearRampToValueAtTime(750, now + 0.04);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.08);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.28, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.06);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch (error) {
    console.debug('Calendar selection sound error:', error);
  }
}

// Entry selection sound - for clicking on journal entries
export function playEntrySelectionSound(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Entry selection sound - soft, gentle click for selecting entries
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(550, now);
    oscillator.frequency.linearRampToValueAtTime(650, now + 0.05);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.22, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.04);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.08);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  } catch (error) {
    console.debug('Entry selection sound error:', error);
  }
}

// Slider noise interface for continuous mixing board-like sound
export interface SliderNoise {
  stop: () => void;
  update: (distanceFromCenter: number, threshold: number) => void;
  portamentoDrop: () => void; // Momentary volume drop with smooth return (for level shifts)
  setLimitState: (isAtLimit: boolean) => void; // Pitch down and dampen when at limit (null wall effect)
}

// Generate continuous soft noise simulating a mixing board slider
// Volume and frequency fade based on distance from center to threshold
export function createSliderNoise(): SliderNoise | null {
  const audioContext = getAudioContext();
  if (!audioContext) return null;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return null;
  }
  
  try {
    const now = audioContext.currentTime;
    
    // Create a much longer buffer for seamless looping (3 seconds)
    // Longer buffer = less audible looping artifacts
    const bufferSize = audioContext.sampleRate * 3; // 3 second buffer
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate smoother, more granular noise using pink noise approximation
    // Pink noise has more low-frequency content, sounds softer and more natural
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    
    for (let i = 0; i < bufferSize; i++) {
      // Generate white noise
      const white = Math.random() * 2 - 1;
      
      // Apply pink noise filter (Paul Kellet's method)
      // This creates smoother, more natural-sounding noise
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      
      // Normalize and apply gentle smoothing
      data[i] = pink * 0.11; // Normalize pink noise (quieter than white)
    }
    
    // Crossfade the end with the beginning for seamless loop
    // Fade out last 100ms and fade in first 100ms
    const fadeLength = Math.floor(audioContext.sampleRate * 0.1); // 100ms fade
    for (let i = 0; i < fadeLength; i++) {
      const fadeOut = i / fadeLength; // 0 to 1
      const fadeIn = 1 - fadeOut;
      const endIndex = bufferSize - fadeLength + i;
      const startIndex = i;
      
      // Blend end with beginning
      const blended = data[endIndex] * fadeOut + data[startIndex] * fadeIn;
      data[endIndex] = blended;
      data[startIndex] = blended;
    }
    
    // Create buffer source (looping)
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.loop = true;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);
    
    // Create low-pass filter to soften the noise (mixing board slider sound)
    // Lower Q value creates smoother, more blended sound without resonance peaks
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now); // Start with moderate filtering
    filter.Q.setValueAtTime(0.7, now); // Lower Q for smoother, more blended sound (less resonance)
    
    // Connect: bufferSource -> filter -> gain -> destination
    bufferSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start playing
    bufferSource.start(now);
    
    // Track current target volume for portamento return
    let currentTargetVolume = 0;
    let portamentoActive = false;
    let portamentoReturnCallback: (() => void) | null = null;
    let isAtLimit = false;
    
    // Return interface for controlling the slider noise
    return {
      stop: () => {
        try {
          const stopTime = audioContext.currentTime;
          portamentoActive = false;
          portamentoReturnCallback = null;
          // Fade out smoothly
          gainNode.gain.cancelScheduledValues(stopTime);
          gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
          gainNode.gain.linearRampToValueAtTime(0, stopTime + 0.1);
          
          // Stop the source after fade out
          setTimeout(() => {
            try {
              bufferSource.stop();
            } catch (error) {
              // Source may already be stopped
              console.debug('Slider noise stop error:', error);
            }
          }, 150);
        } catch (error) {
          console.debug('Slider noise stop error:', error);
        }
      },
      update: (distanceFromCenter: number, threshold: number) => {
        try {
          const updateTime = audioContext.currentTime;
          
          // Calculate normalized distance (0 = center, 1 = at threshold)
          const normalizedDistance = Math.min(Math.abs(distanceFromCenter) / threshold, 1);
          
          // Volume fades in as you approach threshold
          // Quietest at center (0), loudest at threshold (1)
          // Use a smooth curve for natural fade
          const volumeCurve = Math.pow(normalizedDistance, 0.7); // Slight curve for smoother fade
          const minVolume = 0.01; // Very quiet at center
          const maxVolume = 0.05; // Soft but audible near threshold
          const targetVolume = minVolume + (maxVolume - minVolume) * volumeCurve;
          
          // Store target volume for portamento return
          currentTargetVolume = targetVolume;
          
          // If portamento is active, update the return target but don't interrupt the portamento
          // Otherwise, update volume smoothly
          if (!portamentoActive) {
            gainNode.gain.cancelScheduledValues(updateTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, updateTime);
            gainNode.gain.linearRampToValueAtTime(targetVolume, updateTime + 0.05);
          } else {
            // Update the callback to return to current position after portamento
            portamentoReturnCallback = () => {
              const callbackTime = audioContext.currentTime;
              gainNode.gain.cancelScheduledValues(callbackTime);
              gainNode.gain.setValueAtTime(gainNode.gain.value, callbackTime);
              gainNode.gain.linearRampToValueAtTime(targetVolume, callbackTime + 0.05);
            };
          }
          
          // Filter frequency also changes - brighter as you approach threshold
          // But if at limit, pitch down significantly (dampened null wall effect)
          let minFreq = 1500; // Softer at center
          let maxFreq = 3000; // Brighter near threshold
          
          if (isAtLimit) {
            // At limit: pitch down to create dampened null wall sound
            minFreq = 400; // Much lower pitch
            maxFreq = 800; // Still low even at threshold
            // Also reduce volume further when at limit
            const limitVolumeReduction = 0.6; // Reduce volume by 60% at limit
            const adjustedTargetVolume = targetVolume * limitVolumeReduction;
            currentTargetVolume = adjustedTargetVolume;
            if (!portamentoActive) {
              gainNode.gain.cancelScheduledValues(updateTime);
              gainNode.gain.setValueAtTime(gainNode.gain.value, updateTime);
              gainNode.gain.linearRampToValueAtTime(adjustedTargetVolume, updateTime + 0.05);
            }
          }
          
          const targetFreq = minFreq + (maxFreq - minFreq) * normalizedDistance;
          
          filter.frequency.cancelScheduledValues(updateTime);
          filter.frequency.setValueAtTime(filter.frequency.value, updateTime);
          filter.frequency.linearRampToValueAtTime(targetFreq, updateTime + 0.05);
        } catch (error) {
          console.debug('Slider noise update error:', error);
        }
      },
      portamentoDrop: () => {
        try {
          const dropTime = audioContext.currentTime;
          portamentoActive = true;
          
          // Get current volume
          const currentVolume = gainNode.gain.value;
          
          // Drop volume to 30% of current (momentary dip)
          const dropVolume = currentVolume * 0.3;
          
          // Quick drop (50ms)
          gainNode.gain.cancelScheduledValues(dropTime);
          gainNode.gain.setValueAtTime(currentVolume, dropTime);
          gainNode.gain.linearRampToValueAtTime(dropVolume, dropTime + 0.05);
          
          // Then smoothly return to target volume (portamento - 200ms smooth return)
          const returnTime = dropTime + 0.05;
          gainNode.gain.linearRampToValueAtTime(currentTargetVolume, returnTime + 0.2);
          
          // After portamento completes, update to current mouse position if callback exists
          setTimeout(() => {
            portamentoActive = false;
            if (portamentoReturnCallback) {
              portamentoReturnCallback();
              portamentoReturnCallback = null;
            }
          }, 250);
        } catch (error) {
          console.debug('Slider noise portamento drop error:', error);
          portamentoActive = false;
          portamentoReturnCallback = null;
        }
      },
      setLimitState: (atLimit: boolean) => {
        try {
          const limitTime = audioContext.currentTime;
          const wasAtLimit = isAtLimit;
          isAtLimit = atLimit;
          
          if (atLimit && !wasAtLimit) {
            // When hitting limit, pitch down smoothly (portamento pitch down)
            // Create dampened null wall effect
            const currentFreq = filter.frequency.value;
            const limitFreq = 400; // Low pitch for null wall
            
            filter.frequency.cancelScheduledValues(limitTime);
            filter.frequency.setValueAtTime(currentFreq, limitTime);
            filter.frequency.exponentialRampToValueAtTime(limitFreq, limitTime + 0.3); // Smooth pitch down over 300ms
            
            // Also reduce volume to create dampened effect
            const currentVolume = gainNode.gain.value;
            const dampenedVolume = currentVolume * 0.5; // Reduce to 50% for dampened effect
            
            if (!portamentoActive) {
              gainNode.gain.cancelScheduledValues(limitTime);
              gainNode.gain.setValueAtTime(gainNode.gain.value, limitTime);
              gainNode.gain.linearRampToValueAtTime(dampenedVolume, limitTime + 0.3);
            }
          } else if (!atLimit && wasAtLimit) {
            // When leaving limit, smoothly restore to normal frequency
            // The next update() call will set the correct frequency, but we smooth the transition
            const currentFreq = filter.frequency.value;
            // Restore to a mid-range frequency as starting point
            const restoreFreq = 2000; // Mid-range frequency
            
            filter.frequency.cancelScheduledValues(limitTime);
            filter.frequency.setValueAtTime(currentFreq, limitTime);
            filter.frequency.exponentialRampToValueAtTime(restoreFreq, limitTime + 0.2); // Smooth pitch up over 200ms
          }
        } catch (error) {
          console.debug('Slider noise limit state error:', error);
        }
      }
    };
  } catch (error) {
    console.debug('Slider noise creation error:', error);
    return null;
  }
}

