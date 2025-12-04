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

