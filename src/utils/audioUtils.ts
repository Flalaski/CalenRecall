// Shared audio context for all UI sounds - reuse to avoid creation overhead
let sharedAudioContext: AudioContext | null = null;

// Cache for sound effects enabled preference
let soundEffectsEnabledCache: boolean | null = null;

// Check if sound effects are enabled (synchronous, uses cache)
function areSoundEffectsEnabled(): boolean {
  // Use cached value if available
  if (soundEffectsEnabledCache !== null) {
    return soundEffectsEnabledCache;
  }
  
  // Default to enabled if cache is not set yet
  // The cache will be populated by App.tsx on startup
  return true;
}

// Update cache when preference changes (called from App.tsx or other components)
export function updateSoundEffectsCache(enabled: boolean): void {
  console.log('[audioUtils] Updating sound effects cache:', enabled);
  soundEffectsEnabledCache = enabled;
  
  // If sounds are being enabled, ensure audio context is ready
  if (enabled && sharedAudioContext) {
    // Resume audio context if it's suspended (browsers require user interaction)
    if (sharedAudioContext.state === 'suspended') {
      console.log('[audioUtils] Resuming suspended audio context...');
      sharedAudioContext.resume().then(() => {
        console.log('[audioUtils] ✅ Audio context resumed, state:', sharedAudioContext?.state);
      }).catch((error) => {
        console.warn('[audioUtils] Could not resume audio context:', error);
      });
    }
  }
}

// Initialize cache from preferences (called on app startup)
export async function initializeSoundEffectsCache(): Promise<void> {
  if (window.electronAPI) {
    try {
      const enabled = await window.electronAPI.getPreference('soundEffectsEnabled');
      console.log('[audioUtils] Initializing sound effects cache from preference:', enabled, 'type:', typeof enabled);
      // Explicitly handle boolean values
      // If value is explicitly false, disable sounds
      // If value is true, enable sounds
      // If value is undefined/null, enable sounds (default to enabled)
      let cacheValue: boolean;
      if (enabled === false) {
        cacheValue = false;
      } else if (enabled === true) {
        cacheValue = true;
      } else {
        // undefined, null, or any other value - default to enabled
        cacheValue = true;
      }
      console.log('[audioUtils] Setting initial sound effects cache to:', cacheValue, '(preference was:', enabled, ')');
      updateSoundEffectsCache(cacheValue);
    } catch (error) {
      console.debug('Error initializing sound effects cache:', error);
      updateSoundEffectsCache(true); // Default to enabled
    }
  } else {
    updateSoundEffectsCache(true); // Default to enabled
  }
}

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
  if (!areSoundEffectsEnabled()) return;
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
// Tier-aware version that reflects the time scale and direction of movement
export function playMicroBlip(
  tier: 'decade' | 'year' | 'month' | 'week' | 'day' = 'day',
  direction: 'next' | 'prev' | null = null
): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return;
  }
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Base frequencies for each tier (micro versions - higher and shorter than navigation sounds)
    const tierBaseFreqs: Record<typeof tier, number> = {
      decade: 800,  // Micro version of decade sound
      year: 900,
      month: 1000,
      week: 1100,
      day: 1200,    // Brightest, most precise
    };
    
    // Direction modifier: forward slightly higher, backward slightly lower
    const directionModifier = direction === 'next' ? 30 : direction === 'prev' ? -30 : 0;
    const baseFreq = tierBaseFreqs[tier] + directionModifier;
    
    oscillator.type = 'sine';
    const now = audioContext.currentTime;
    
    // Very quick frequency change based on direction
    if (direction) {
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.frequency.exponentialRampToValueAtTime(baseFreq + (direction === 'next' ? -200 : 200), now + 0.015);
    } else {
      // No direction - simple tick
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.frequency.exponentialRampToValueAtTime(baseFreq - 300, now + 0.02);
    }
    
    // Very short envelope for micro blip - quieter and shorter than main click
    // Slightly quieter for larger tiers to maintain subtlety
    const volumeMultiplier = tier === 'decade' ? 0.7 : tier === 'year' ? 0.8 : tier === 'month' ? 0.9 : 1.0;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08 * volumeMultiplier, now + 0.0005);
    gainNode.gain.exponentialRampToValueAtTime(0.005 * volumeMultiplier, now + 0.02);
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

// Tab sound - for tabbing between date input fields
export function playTabSound(): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Light stepping sound - quick, crisp tick for field navigation
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.linearRampToValueAtTime(950, now + 0.03);
    oscillator.frequency.linearRampToValueAtTime(700, now + 0.06);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.08);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  } catch (error) {
    console.debug('Tab sound error:', error);
  }
}

// Time input sound - for time field value changes
export function playTimeInputSound(): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Precise time input sound - quick, crisp tick for time value changes
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(900, now);
    oscillator.frequency.linearRampToValueAtTime(1000, now + 0.02);
    oscillator.frequency.linearRampToValueAtTime(850, now + 0.04);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.03, now + 0.03);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.06);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.06);
  } catch (error) {
    console.debug('Time input sound error:', error);
  }
}

// Time field focus sound - for focusing on time input fields
export function playTimeFieldFocusSound(): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Gentle focus sound - subtle indication of field focus
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(750, now);
    oscillator.frequency.linearRampToValueAtTime(850, now + 0.04);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.02, now + 0.03);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  } catch (error) {
    console.debug('Time field focus sound error:', error);
  }
}

// Time increment/decrement sound - for arrow key changes in time fields
export function playTimeIncrementSound(direction: 'up' | 'down'): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Quick tick sound - higher for up, lower for down
    oscillator.type = 'sine';
    const baseFreq = direction === 'up' ? 950 : 750;
    oscillator.frequency.setValueAtTime(baseFreq, now);
    oscillator.frequency.linearRampToValueAtTime(direction === 'up' ? 1050 : 650, now + 0.02);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.04);
  } catch (error) {
    console.debug('Time increment sound error:', error);
  }
}

// Date submit sound - for submitting date with Enter key
export function playDateSubmitSound(): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Confident date submission sound - ascending, decisive
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(550, now);
    oscillator.frequency.linearRampToValueAtTime(750, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(900, now + 0.15);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.18);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch (error) {
    console.debug('Date submit sound error:', error);
  }
}

// Era switch sound - for switching between CE and BCE
export function playEraSwitchSound(era: 'CE' | 'BCE'): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Distinct era switch sound - CE is higher/forward, BCE is lower/backward
    oscillator.type = 'sine';
    if (era === 'CE') {
      // CE: ascending, forward-moving sound
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.linearRampToValueAtTime(800, now + 0.06);
      oscillator.frequency.linearRampToValueAtTime(700, now + 0.12);
    } else {
      // BCE: descending, backward-moving sound
      oscillator.frequency.setValueAtTime(700, now);
      oscillator.frequency.linearRampToValueAtTime(500, now + 0.06);
      oscillator.frequency.linearRampToValueAtTime(600, now + 0.12);
    }
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.debug('Era switch sound error:', error);
  }
}

// Typing sound options - allows context-aware sounds based on key pressed
export interface TypingSoundOptions {
  key?: string;           // The key that was pressed (e.g., 'a', '1', 'Enter', 'Backspace')
  char?: string;          // The character being typed (for character-based sounds)
  keyCode?: number;       // Optional key code for precise identification
  isShift?: boolean;      // Whether shift was held
  isCtrl?: boolean;       // Whether ctrl was held
  isAlt?: boolean;        // Whether alt was held
}

// Character type classification for sound variation
type CharType = 'letter' | 'number' | 'punctuation' | 'space' | 'special' | 'unknown';

// Classify character type for sound generation
function classifyCharType(key: string | undefined, char: string | undefined): CharType {
  const testChar = char || key || '';
  
  if (!testChar || testChar.length === 0) return 'unknown';
  
  // Single character analysis
  const singleChar = testChar.length === 1 ? testChar : testChar.charAt(0);
  
  // Special keys (non-printable)
  if (key && (key.length > 1 || key === ' ')) {
    if (['Backspace', 'Delete', 'Enter', 'Tab', 'Escape'].includes(key)) {
      return 'special';
    }
    if (key === ' ') return 'space';
  }
  
  // Check if it's a letter
  if (/[a-zA-Z]/.test(singleChar)) return 'letter';
  
  // Check if it's a number
  if (/[0-9]/.test(singleChar)) return 'number';
  
  // Check if it's punctuation
  if (/[.,!?;:'"\-_=+[\]{}()<>@#$%^&*|\\/~`]/.test(singleChar)) return 'punctuation';
  
  // Check if it's a space
  if (singleChar === ' ' || singleChar === '\t') return 'space';
  
  return 'unknown';
}

// Get keyboard row position for letters (affects pitch)
// Top row: qwertyuiop -> higher pitch
// Home row: asdfghjkl -> medium pitch
// Bottom row: zxcvbnm -> lower pitch
function getLetterRowPosition(char: string): 'top' | 'home' | 'bottom' | 'unknown' {
  const topRow = 'qwertyuiop';
  const homeRow = 'asdfghjkl';
  const bottomRow = 'zxcvbnm';
  
  const lowerChar = char.toLowerCase();
  if (topRow.includes(lowerChar)) return 'top';
  if (homeRow.includes(lowerChar)) return 'home';
  if (bottomRow.includes(lowerChar)) return 'bottom';
  return 'unknown';
}

// Generate context-aware typing sound based on key pressed
export function playTypingSound(options?: TypingSoundOptions | string): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    
    // Handle backward compatibility - if string is passed, treat as key
    let opts: TypingSoundOptions;
    if (typeof options === 'string') {
      opts = { key: options };
    } else {
      opts = options || {};
    }
    
    const key = opts.key;
    const char = opts.char || key;
    const charType = classifyCharType(key, char);
    
    // Base frequency varies by character type
    let baseFreq: number;
    let freqVariation: number;
    let duration: number;
    let volume: number;
    let waveType: OscillatorType;
    
    switch (charType) {
      case 'letter': {
        // Letters: pitch varies by keyboard row position
        const row = getLetterRowPosition(char || '');
        switch (row) {
          case 'top':
            baseFreq = 1100;  // Higher pitch for top row
            break;
          case 'home':
            baseFreq = 1000;  // Medium pitch for home row
            break;
          case 'bottom':
            baseFreq = 900;   // Lower pitch for bottom row
            break;
          default:
            baseFreq = 1000;
        }
        // Add slight variation based on character position in alphabet
        if (char) {
          const charCode = char.toLowerCase().charCodeAt(0);
          const alphabetPos = charCode - 97; // a=0, z=25
          baseFreq += (alphabetPos % 5) * 20 - 40; // Subtle variation
        }
        freqVariation = 100;
        duration = 0.04;
        volume = 0.15;
        waveType = 'sine';
        break;
      }
      
      case 'number': {
        // Numbers: crisp, precise sound with pitch based on digit value
        const digit = char ? parseInt(char) : 5;
        // Map 0-9 to frequency range 850-1150
        baseFreq = 850 + (digit * 30);
        freqVariation = 80;
        duration = 0.035;
        volume = 0.18; // Slightly louder for numbers
        waveType = 'sine';
        break;
      }
      
      case 'punctuation': {
        // Punctuation: sharper, more percussive
        baseFreq = 1200;
        freqVariation = 150;
        duration = 0.03;
        volume = 0.12; // Quieter for punctuation
        waveType = 'sine';
        break;
      }
      
      case 'space': {
        // Space: very subtle, low thud
        baseFreq = 400;
        freqVariation = 50;
        duration = 0.05;
        volume = 0.08; // Very quiet
        waveType = 'sine';
        break;
      }
      
      case 'special': {
        // Special keys: distinct sounds based on key
        if (key === 'Backspace' || key === 'Delete') {
          // Deletion: descending, softer
          baseFreq = 800;
          freqVariation = -200; // Descending
          duration = 0.05;
          volume = 0.1;
          waveType = 'sine';
        } else if (key === 'Enter') {
          // Enter: ascending, confident
          baseFreq = 700;
          freqVariation = 300; // Ascending
          duration = 0.06;
          volume = 0.2;
          waveType = 'sine';
        } else if (key === 'Tab') {
          // Tab: quick step
          baseFreq = 900;
          freqVariation = 100;
          duration = 0.03;
          volume = 0.12;
          waveType = 'sine';
        } else {
          // Other special keys: neutral
          baseFreq = 1000;
          freqVariation = 100;
          duration = 0.04;
          volume = 0.15;
          waveType = 'sine';
        }
        break;
      }
      
      default: {
        // Unknown/fallback: default typing sound
        baseFreq = 1000;
        freqVariation = 100;
        duration = 0.04;
        volume = 0.15;
        waveType = 'sine';
      }
    }
    
    // Apply shift modifier (slightly higher pitch when shift is held)
    if (opts.isShift && charType === 'letter') {
      baseFreq += 50;
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = waveType;
    
    // Frequency envelope based on character type
    if (charType === 'special' && (key === 'Backspace' || key === 'Delete')) {
      // Descending for deletion
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.frequency.linearRampToValueAtTime(baseFreq + freqVariation, now + duration);
    } else if (charType === 'special' && key === 'Enter') {
      // Ascending for Enter
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.frequency.linearRampToValueAtTime(baseFreq + freqVariation, now + duration * 0.6);
      oscillator.frequency.linearRampToValueAtTime(baseFreq + freqVariation * 0.7, now + duration);
    } else {
      // Standard: quick rise and fall
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.frequency.linearRampToValueAtTime(baseFreq + freqVariation * 0.5, now + duration * 0.3);
      oscillator.frequency.linearRampToValueAtTime(baseFreq - freqVariation * 0.3, now + duration);
    }
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.2, now + duration * 0.5);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.debug('Typing sound error:', error);
  }
}

// Number typing sound - for typing digits in date fields
export function playNumberTypingSound(key?: string): void {
  // Use enhanced typing sound with number context
  if (key) {
    playTypingSound({ key, char: key });
  } else {
    playTypingSound({ char: '5' }); // Default to middle number if no key provided
  }
}

// Navigation sound - for prev/next/today buttons
export function playNavigationSound(): void {
  if (!areSoundEffectsEnabled()) return;
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

// Tier navigation sound - for manual keyboard/button navigation
// Distinguishes by tier level, direction (forward/backward), and shift state (large jumps)
export function playTierNavigationSound(
  tier: 'decade' | 'year' | 'month' | 'week' | 'day',
  direction: 'next' | 'prev',
  shiftPressed: boolean = false
): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    
    // Base frequencies for each tier (lower = larger time periods)
    const tierBaseFreqs: Record<typeof tier, number> = {
      decade: 150,
      year: 250,
      month: 400,
      week: 550,
      day: 700,
    };
    
    // Shift modifier: adds resonance and slightly lowers pitch for larger jumps
    const shiftModifier = shiftPressed ? -30 : 0;
    const shiftResonance = shiftPressed ? 1.3 : 1.0;
    
    // Direction modifier: forward (next) slightly higher pitch, backward (prev) slightly lower
    const directionModifier = direction === 'next' ? 20 : -20;
    
    const baseFreq = tierBaseFreqs[tier] + shiftModifier + directionModifier;
    const endFreq = baseFreq + (direction === 'next' ? 50 : -50);
    
    // Duration varies by tier - larger tiers have longer sounds
    const durations: Record<typeof tier, number> = {
      decade: 0.2,
      year: 0.15,
      month: 0.12,
      week: 0.1,
      day: 0.08,
    };
    
    const duration = durations[tier];
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Use different wave types for shift vs normal
    oscillator.type = shiftPressed ? 'triangle' : 'sine';
    
    oscillator.frequency.setValueAtTime(baseFreq, now);
    oscillator.frequency.linearRampToValueAtTime(endFreq, now + duration * 0.6);
    oscillator.frequency.linearRampToValueAtTime(baseFreq + (direction === 'next' ? 30 : -30), now + duration);
    
    // Volume envelope with resonance for shift
    const peakVolume = 0.025 * shiftResonance;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(peakVolume * 0.07, now + duration * 0.7);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
    
    // For shift, add a second harmonic layer for resonance
    if (shiftPressed) {
      setTimeout(() => {
        if (!audioContext || audioContext.state === 'closed') return;
        
        try {
          const now2 = audioContext.currentTime;
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          
          oscillator2.type = 'sine';
          oscillator2.frequency.setValueAtTime(baseFreq * 2, now2);
          oscillator2.frequency.linearRampToValueAtTime(endFreq * 2, now2 + duration * 0.5);
          
          gainNode2.gain.setValueAtTime(0, now2);
          gainNode2.gain.linearRampToValueAtTime(0.1, now2 + 0.003);
          gainNode2.gain.exponentialRampToValueAtTime(0.02, now2 + duration * 0.6);
          gainNode2.gain.linearRampToValueAtTime(0, now2 + duration * 0.8);
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          
          oscillator2.start(now2);
          oscillator2.stop(now2 + duration * 0.8);
        } catch (error) {
          console.debug('Shift harmonic sound error:', error);
        }
      }, 10);
    }
  } catch (error) {
    console.debug('Tier navigation sound error:', error);
  }
}

// Navigation journey sound - procedurally generated based on time tier
// Creates unique sounds for each tier that reflect the journey through time scales
export function playNavigationJourneySound(tier: 'decade' | 'year' | 'month' | 'week' | 'day'): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    
    // Each tier has a distinct sound profile reflecting its temporal scale
    // Larger time periods = deeper, more resonant sounds
    // Smaller time periods = brighter, more precise sounds
    switch (tier) {
      case 'decade': {
        // Deep, resonant sweep - vast temporal movement
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.linearRampToValueAtTime(200, now + 0.1);
        oscillator.frequency.linearRampToValueAtTime(180, now + 0.2);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.25);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.25);
        break;
      }
      
      case 'year': {
        // Medium-low sweep with slight resonance - substantial time passage
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(250, now);
        oscillator.frequency.linearRampToValueAtTime(320, now + 0.08);
        oscillator.frequency.linearRampToValueAtTime(280, now + 0.15);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.28, now + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
      }
      
      case 'month': {
        // Mid-range transition sound - moderate temporal step
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.linearRampToValueAtTime(500, now + 0.06);
        oscillator.frequency.linearRampToValueAtTime(450, now + 0.12);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.25, now + 0.006);
        gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.16);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.16);
        break;
      }
      
      case 'week': {
        // Bright, quick transition - shorter temporal step
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(550, now);
        oscillator.frequency.linearRampToValueAtTime(650, now + 0.05);
        oscillator.frequency.linearRampToValueAtTime(600, now + 0.1);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.22, now + 0.004);
        gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.08);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.12);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.12);
        break;
      }
      
      case 'day': {
        // Crisp, precise tick - fine temporal movement
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(700, now);
        oscillator.frequency.linearRampToValueAtTime(800, now + 0.03);
        oscillator.frequency.linearRampToValueAtTime(750, now + 0.06);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.08);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.08);
        break;
      }
    }
  } catch (error) {
    console.debug('Navigation journey sound error:', error);
  }
}

// Mode selection sound - for view mode buttons (generic, kept for backward compatibility)
export function playModeSelectionSound(): void {
  if (!areSoundEffectsEnabled()) return;
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

// Tier-specific mode selection sound - unique sound for each time tier
// Creates distinct selection sounds that reflect the temporal scale of each tier
export function playTierSelectionSound(tier: 'decade' | 'year' | 'month' | 'week' | 'day'): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    
    // Each tier has a distinct selection sound profile
    // Larger time periods = deeper, more resonant selection sounds
    // Smaller time periods = brighter, more precise selection sounds
    switch (tier) {
      case 'decade': {
        // Deep, resonant selection - vast temporal scale activation
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.linearRampToValueAtTime(220, now + 0.08);
        oscillator.frequency.linearRampToValueAtTime(180, now + 0.16);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.35, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
      }
      
      case 'year': {
        // Medium-low selection with resonance - substantial scale activation
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(250, now);
        oscillator.frequency.linearRampToValueAtTime(330, now + 0.07);
        oscillator.frequency.linearRampToValueAtTime(280, now + 0.14);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.33, now + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.11);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.18);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.18);
        break;
      }
      
      case 'month': {
        // Mid-range selection sound - moderate scale activation
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.linearRampToValueAtTime(520, now + 0.06);
        oscillator.frequency.linearRampToValueAtTime(450, now + 0.12);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.32, now + 0.006);
        gainNode.gain.exponentialRampToValueAtTime(0.09, now + 0.09);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;
      }
      
      case 'week': {
        // Bright, quick selection - shorter scale activation
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(550, now);
        oscillator.frequency.linearRampToValueAtTime(680, now + 0.05);
        oscillator.frequency.linearRampToValueAtTime(600, now + 0.1);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.004);
        gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.12);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.12);
        break;
      }
      
      case 'day': {
        // Crisp, precise selection - fine scale activation
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(700, now);
        oscillator.frequency.linearRampToValueAtTime(850, now + 0.04);
        oscillator.frequency.linearRampToValueAtTime(750, now + 0.08);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.28, now + 0.003);
        gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.06);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
      }
    }
  } catch (error) {
    console.debug('Tier selection sound error:', error);
  }
}

// Save/confirmation sound - for save buttons
export function playSaveSound(): void {
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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
  if (!areSoundEffectsEnabled()) return;
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

// Numerological reduction helper (same as in GlobalTimelineMinimap)
function numerologicalReduce(num: number): number {
  while (num > 9) {
    num = num.toString().split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0);
  }
  return num;
}

// Procedurally generate unique crystal click sound based on entry properties
// Uses the same numerological calculations as crystal generation for consistency
export function playCrystalClickSound(entry: { 
  date: string; 
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day';
  title?: string;
  content?: string;
  id?: number | string;
}): void {
  if (!areSoundEffectsEnabled()) return;
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  if (audioContext.state === 'closed') return;
  
  try {
    const now = audioContext.currentTime;
    
    // Calculate numerological values (same logic as calculateCrystalSides)
    const titleNumbers = (entry.title || '').match(/\d+/g) || [];
    const contentNumbers = (entry.content || '').match(/\d+/g) || [];
    
    let numberSum = 0;
    titleNumbers.forEach(numStr => {
      numberSum += parseInt(numStr, 10);
    });
    contentNumbers.forEach(numStr => {
      numberSum += parseInt(numStr, 10);
    });
    
    // Calculate numerological value from text
    let textValue = 0;
    const allText = (entry.title || '') + (entry.content || '');
    for (let i = 0; i < allText.length; i++) {
      const charCode = allText.charCodeAt(i);
      textValue += charCode * (i % 5 + 1);
    }
    
    // Extract numbers from date
    const dateParts = entry.date.split('-');
    const yearValue = parseInt(dateParts[0] || '0', 10);
    const monthValue = parseInt(dateParts[1] || '0', 10);
    const dayValue = parseInt(dateParts[2] || '0', 10);
    
    // Calculate numerological values
    const yearNumerological = numerologicalReduce(Math.abs(yearValue));
    const monthNumerological = numerologicalReduce(monthValue);
    const dayNumerological = numerologicalReduce(dayValue);
    const numberSumNumerological = numberSum > 0 ? numerologicalReduce(numberSum) : 0;
    const textValueNumerological = numerologicalReduce(Math.abs(textValue));
    
    // TimeRange numerological mapping
    const timeRangeNumerological = entry.timeRange === 'decade' ? 1 :
                                  entry.timeRange === 'year' ? 2 :
                                  entry.timeRange === 'month' ? 3 :
                                  entry.timeRange === 'week' ? 4 : 5;
    
    // ID numerological (if exists)
    const idNumerological = entry.id ? numerologicalReduce(typeof entry.id === 'number' ? entry.id : parseInt(String(entry.id), 10) || 0) : 0;
    
    // Combine all numerological values
    const combinedNumerological = yearNumerological + 
                                 monthNumerological + 
                                 dayNumerological + 
                                 numberSumNumerological + 
                                 textValueNumerological + 
                                 timeRangeNumerological + 
                                 idNumerological;
    
    // Final numerological reduction
    const finalNumerological = numerologicalReduce(combinedNumerological);
    
    // Calculate crystal sides (3-12)
    const sides = finalNumerological === 0 ? 3 : 3 + finalNumerological;
    
    // Base frequency varies by time range (larger ranges = lower frequencies)
    const timeRangeBaseFreqs: Record<typeof entry.timeRange, number> = {
      decade: 200,
      year: 300,
      month: 450,
      week: 600,
      day: 750,
    };
    
    // Base frequency from time range
    let baseFreq = timeRangeBaseFreqs[entry.timeRange];
    
    // Modify frequency based on sides (more sides = higher pitch, like a crystal chime)
    // Each side adds a small frequency increment
    const sidesModifier = (sides - 3) * 25; // 0-225 Hz range
    baseFreq += sidesModifier;
    
    // Add subtle variation based on individual numerological components
    // This creates unique timbre for each crystal
    const yearMod = (yearNumerological % 5) * 8;
    const monthMod = (monthNumerological % 5) * 6;
    const dayMod = (dayNumerological % 5) * 4;
    const textMod = (textValueNumerological % 5) * 10;
    const idMod = (idNumerological % 5) * 5;
    
    const uniqueModifier = yearMod + monthMod + dayMod + textMod + idMod;
    baseFreq += uniqueModifier;
    
    // Clamp frequency to reasonable range (150-1200 Hz)
    baseFreq = Math.max(150, Math.min(1200, baseFreq));
    
    // Create main oscillator with crystal-like timbre
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Use triangle wave for crystal-like chime (more harmonic content than sine)
    oscillator.type = 'triangle';
    
    // Frequency envelope: quick rise, then gentle fall (like a crystal being struck)
    const peakFreq = baseFreq * 1.15; // Slight overshoot for impact
    oscillator.frequency.setValueAtTime(baseFreq, now);
    oscillator.frequency.linearRampToValueAtTime(peakFreq, now + 0.01);
    oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(baseFreq * 0.9, now + 0.15);
    
    // Volume envelope: sharp attack, gentle decay (crystal resonance)
    const peakVolume = 0.28 + (sides / 12) * 0.1; // Larger crystals slightly louder
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.002); // Sharp attack
    gainNode.gain.exponentialRampToValueAtTime(peakVolume * 0.3, now + 0.06); // Initial decay
    gainNode.gain.exponentialRampToValueAtTime(peakVolume * 0.08, now + 0.12); // Resonance tail
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2); // Fade out
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
    
    // Add harmonic layer for larger crystals (sides >= 6)
    if (sides >= 6) {
      setTimeout(() => {
        if (!audioContext || audioContext.state === 'closed') return;
        
        try {
          const now2 = audioContext.currentTime;
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          
          // Harmonic at 2x frequency (octave up) for larger crystals
          const harmonicFreq = baseFreq * 2;
          oscillator2.type = 'sine'; // Pure sine for harmonic
          oscillator2.frequency.setValueAtTime(harmonicFreq, now2);
          oscillator2.frequency.exponentialRampToValueAtTime(harmonicFreq * 0.85, now2 + 0.1);
          
          // Quieter harmonic layer
          const harmonicVolume = peakVolume * 0.25 * (sides / 12); // Stronger for larger crystals
          gainNode2.gain.setValueAtTime(0, now2);
          gainNode2.gain.linearRampToValueAtTime(harmonicVolume, now2 + 0.001);
          gainNode2.gain.exponentialRampToValueAtTime(harmonicVolume * 0.2, now2 + 0.05);
          gainNode2.gain.linearRampToValueAtTime(0, now2 + 0.12);
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          
          oscillator2.start(now2);
          oscillator2.stop(now2 + 0.12);
        } catch (error) {
          console.debug('Crystal click harmonic sound error:', error);
        }
      }, 5);
    }
    
    // Add subharmonic for decade/year entries (deeper resonance)
    if (entry.timeRange === 'decade' || entry.timeRange === 'year') {
      setTimeout(() => {
        if (!audioContext || audioContext.state === 'closed') return;
        
        try {
          const now3 = audioContext.currentTime;
          const oscillator3 = audioContext.createOscillator();
          const gainNode3 = audioContext.createGain();
          
          // Subharmonic at 0.5x frequency (octave down) for depth
          const subFreq = baseFreq * 0.5;
          oscillator3.type = 'sine';
          oscillator3.frequency.setValueAtTime(subFreq, now3);
          oscillator3.frequency.exponentialRampToValueAtTime(subFreq * 0.9, now3 + 0.15);
          
          // Very quiet subharmonic for depth
          gainNode3.gain.setValueAtTime(0, now3);
          gainNode3.gain.linearRampToValueAtTime(peakVolume * 0.15, now3 + 0.003);
          gainNode3.gain.exponentialRampToValueAtTime(peakVolume * 0.05, now3 + 0.1);
          gainNode3.gain.linearRampToValueAtTime(0, now3 + 0.18);
          
          oscillator3.connect(gainNode3);
          gainNode3.connect(audioContext.destination);
          
          oscillator3.start(now3);
          oscillator3.stop(now3 + 0.18);
        } catch (error) {
          console.debug('Crystal click subharmonic sound error:', error);
        }
      }, 8);
    }
  } catch (error) {
    console.debug('Crystal click sound error:', error);
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
  if (!areSoundEffectsEnabled()) return null;
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

// Movement flow sound interface for continuous electrified flow loop
export type MovementDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface MovementFlowSound {
  start: (direction: MovementDirection) => void;
  stop: () => void;
  updateDirection: (direction: MovementDirection) => void;
}

// Generate quiet subtle inverted matter phasing vortex sound for movement keys (WASD & Arrows)
// Quickly fades in on key press and quickly stops on key release
export function createMovementFlowSound(): MovementFlowSound | null {
  if (!areSoundEffectsEnabled()) return null;
  const audioContext = getAudioContext();
  if (!audioContext) return null;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return null;
  }
  
  try {
    let bufferSource1: AudioBufferSourceNode | null = null;
    let bufferSource2: AudioBufferSourceNode | null = null;
    let gainNode: GainNode | null = null;
    let filter1: BiquadFilterNode | null = null;
    let filter2: BiquadFilterNode | null = null;
    let filter3: BiquadFilterNode | null = null;
    let lfo1: OscillatorNode | null = null;
    let lfo2: OscillatorNode | null = null;
    let lfoGain1: GainNode | null = null;
    let lfoGain2: GainNode | null = null;
    let isPlaying = false;
    let noiseBuffer: AudioBuffer | null = null;
    let currentDirection: MovementDirection = null;
    let filter2b: BiquadFilterNode | null = null;
    let filter3b: BiquadFilterNode | null = null;
    let eqNotchFilter: BiquadFilterNode | null = null; // EQ notch filter at 400Hz
    let stopTimeoutId: ReturnType<typeof setTimeout> | null = null; // Track stop timeout to cancel it
    let keyPressHistory: number[] = []; // Track timestamps of recent key presses for adaptive behavior
    let lastKeyPressTime: number = 0; // Timestamp of last key press
    let lastKeyReleaseTime: number = 0; // Timestamp of last key release
    let keyHoldDuration: number = 0; // Duration of current key hold
    let keyHoldStartTime: number = 0; // When current key hold started
    
    // Get direction-based sound parameters for low electrified hum
    const getDirectionParams = (direction: MovementDirection) => {
      switch (direction) {
        case 'left':
          // Backward in time: lower frequencies, slower rotation
          return {
            filter1Freq: 180,  // Much lower for hum
            filter2Freq: 280,  // Lower bandpass
            filter2bFreq: 240, // Lower second path
            lfo1Rate: 0.15,    // Slower rotation
            lfo2Rate: 0.2,     // Slower second LFO
            lfo1Depth: 40,     // Subtle modulation
            lfo2Depth: 50,     // Subtle modulation
            phaseOffset: 0.003, // Minimal phase offset
          };
        case 'right':
          // Forward in time: slightly higher frequencies, faster rotation
          return {
            filter1Freq: 220,  // Low but slightly higher
            filter2Freq: 320,  // Slightly higher bandpass
            filter2bFreq: 280, // Slightly higher second path
            lfo1Rate: 0.2,     // Slightly faster
            lfo2Rate: 0.25,    // Slightly faster
            lfo1Depth: 50,     // Subtle modulation
            lfo2Depth: 60,     // Subtle modulation
            phaseOffset: 0.002, // Minimal phase offset
          };
        case 'up':
          // Zoom in: slightly brighter hum
          return {
            filter1Freq: 250,  // Slightly brighter
            filter2Freq: 350,  // Slightly brighter
            filter2bFreq: 300, // Slightly brighter
            lfo1Rate: 0.22,    // Slightly faster
            lfo2Rate: 0.28,    // Slightly faster
            lfo1Depth: 55,     // Subtle modulation
            lfo2Depth: 65,     // Subtle modulation
            phaseOffset: 0.0025, // Minimal phase offset
          };
        case 'down':
          // Zoom out: darker, lower hum
          return {
            filter1Freq: 150,  // Lower for darker
            filter2Freq: 240,  // Lower bandpass
            filter2bFreq: 200, // Lower second path
            lfo1Rate: 0.12,    // Slower rotation
            lfo2Rate: 0.18,    // Slower second LFO
            lfo1Depth: 35,     // Subtle modulation
            lfo2Depth: 45,     // Subtle modulation
            phaseOffset: 0.0035, // Minimal phase offset
          };
        default:
          // Default/neutral - low electrified hum
          return {
            filter1Freq: 200,  // Low base frequency
            filter2Freq: 300,  // Low bandpass
            filter2bFreq: 260, // Low second path
            lfo1Rate: 0.18,    // Slow rotation
            lfo2Rate: 0.22,    // Slow second LFO
            lfo1Depth: 45,     // Subtle modulation
            lfo2Depth: 55,     // Subtle modulation
            phaseOffset: 0.003, // Minimal phase offset
          };
      }
    };
    
    // Create noise buffer for inverted matter phasing effect
    const createNoiseBuffer = (): AudioBuffer => {
      const bufferSize = audioContext!.sampleRate * 2; // 2 second buffer for seamless loop
      const buffer = audioContext!.createBuffer(1, bufferSize, audioContext!.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate pink noise (softer, more natural than white noise)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        
        // Apply pink noise filter (Paul Kellet's method)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        
        data[i] = pink * 0.12; // Lower amplitude for more subtle hum
      }
      
      // Crossfade for seamless loop
      const fadeLength = Math.floor(audioContext!.sampleRate * 0.1); // 100ms fade
      for (let i = 0; i < fadeLength; i++) {
        const fadeOut = i / fadeLength;
        const fadeIn = 1 - fadeOut;
        const endIndex = bufferSize - fadeLength + i;
        const startIndex = i;
        const blended = data[endIndex] * fadeOut + data[startIndex] * fadeIn;
        data[endIndex] = blended;
        data[startIndex] = blended;
      }
      
      return buffer;
    };
    
    // Analyze key press pattern to determine adaptive timing
    const analyzeKeyPressPattern = (): { fadeInTime: number; fadeOutTime: number; volumeMultiplier: number } => {
      const now = Date.now();
      const timeSinceLastPress = lastKeyPressTime > 0 ? now - lastKeyPressTime : Infinity;
      const timeSinceLastRelease = lastKeyReleaseTime > 0 ? now - lastKeyReleaseTime : Infinity;
      
      // Keep only recent key presses (within last 500ms)
      keyPressHistory = keyPressHistory.filter(timestamp => now - timestamp < 500);
      
      // Calculate average interval between key presses
      let avgInterval = Infinity;
      if (keyPressHistory.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < keyPressHistory.length; i++) {
          intervals.push(keyPressHistory[i] - keyPressHistory[i - 1]);
        }
        avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      }
      
      // Detect rapid short presses (fast tapping)
      // If average interval is less than 150ms, it's rapid tapping
      const isRapidTapping = avgInterval < 150 && keyPressHistory.length >= 3;
      
      // Detect very short key holds (quick taps)
      // If key was released quickly (< 100ms) and pressed again quickly, it's quick tapping
      const isQuickTapping = timeSinceLastRelease > 0 && timeSinceLastRelease < 100 && timeSinceLastPress < 200;
      
      // Detect sustained hold (key held for a while)
      const isSustainedHold = keyHoldDuration > 200;
      
      // Adaptive timing based on pattern
      if (isRapidTapping || isQuickTapping) {
        // Very fast response for rapid taps - instant feel
        return {
          fadeInTime: 0.02,  // 20ms - almost instant
          fadeOutTime: 0.05, // 50ms - quick cut
          volumeMultiplier: 1.0 // Full volume for clarity
        };
      } else if (isSustainedHold) {
        // Slower, smoother for sustained holds
        return {
          fadeInTime: 0.12,  // 120ms - smooth
          fadeOutTime: 0.2,  // 200ms - smooth fade
          volumeMultiplier: 0.9 // Slightly quieter for sustained
        };
      } else {
        // Normal response for regular usage
        return {
          fadeInTime: 0.08,  // 80ms - responsive
          fadeOutTime: 0.15, // 150ms - smooth
          volumeMultiplier: 1.0 // Full volume
        };
      }
    };
    
    return {
      start: (direction: MovementDirection = null) => {
        // Track key press timing for adaptive behavior
        const now = Date.now();
        const timeSinceLastPress = lastKeyPressTime > 0 ? now - lastKeyPressTime : Infinity;
        
        // Only add to history if this is a new press (not a continuation of the same key hold)
        if (timeSinceLastPress > 50 || lastKeyPressTime === 0) {
          // This is a new key press - add to history
          keyPressHistory.push(now);
          // Keep only recent presses (within last 500ms)
          keyPressHistory = keyPressHistory.filter(timestamp => now - timestamp < 500);
          
          // Reset key hold tracking for new press
          keyHoldStartTime = now;
        }
        
        lastKeyPressTime = now;
        keyHoldDuration = now - keyHoldStartTime;
        
        // Get adaptive timing based on key press pattern
        const adaptiveTiming = analyzeKeyPressPattern();
        // Cancel any pending stop timeout - we're starting/resuming the sound
        if (stopTimeoutId !== null) {
          clearTimeout(stopTimeoutId);
          stopTimeoutId = null;
        }
        
        // If already playing, smoothly update direction instead of stopping/restarting
        // This allows sounds to blend seamlessly when switching keys
        if (isPlaying && gainNode && filter1 && filter2 && filter2b && lfo1 && lfo2 && lfoGain1 && lfoGain2) {
          // Skip update if direction hasn't changed
          if (currentDirection === direction) return;
          
          // Cancel any scheduled fade out to keep sound playing
          const now = audioContext!.currentTime;
          const currentGain = gainNode.gain.value;
          
          // Get the scheduled value at a small time in the future to check if there's a ramp
          // This helps us avoid interrupting smooth transitions
          const targetVolume = 0.025;
          const volumeTolerance = 0.005; // Small tolerance to avoid unnecessary ramps
          
          // Cancel scheduled values but preserve current value smoothly
          gainNode.gain.cancelScheduledValues(now);
          
          // Use adaptive target volume based on key press pattern
          const adaptiveTargetVolume = targetVolume * adaptiveTiming.volumeMultiplier;
          
          // Cap volume to prevent spikes - if somehow above target, bring it down smoothly
          if (currentGain > adaptiveTargetVolume + volumeTolerance) {
            // Volume is too high - ramp down smoothly to prevent loud pops
            gainNode.gain.setValueAtTime(currentGain, now);
            gainNode.gain.linearRampToValueAtTime(adaptiveTargetVolume, now + 0.05);
          } else if (currentGain < adaptiveTargetVolume - volumeTolerance) {
            // Volume is significantly below target - ramp up with adaptive timing
            gainNode.gain.setValueAtTime(currentGain, now);
            gainNode.gain.linearRampToValueAtTime(adaptiveTargetVolume, now + adaptiveTiming.fadeInTime);
          } else {
            // Volume is already near target - just set it to current value to maintain smoothness
            gainNode.gain.setValueAtTime(currentGain, now);
          }
          
          // Update direction smoothly - this blends the sound instead of cutting
          currentDirection = direction;
          const params = getDirectionParams(direction);
          
          try {
            // Update filter frequencies smoothly
            filter1.frequency.cancelScheduledValues(now);
            filter1.frequency.setValueAtTime(filter1.frequency.value, now);
            filter1.frequency.linearRampToValueAtTime(params.filter1Freq, now + 0.1);
            
            filter2.frequency.cancelScheduledValues(now);
            filter2.frequency.setValueAtTime(filter2.frequency.value, now);
            filter2.frequency.linearRampToValueAtTime(params.filter2Freq, now + 0.1);
            
            filter2b.frequency.cancelScheduledValues(now);
            filter2b.frequency.setValueAtTime(filter2b.frequency.value, now);
            filter2b.frequency.linearRampToValueAtTime(params.filter2bFreq, now + 0.1);
            
            // Update LFO rates smoothly
            lfo1.frequency.cancelScheduledValues(now);
            lfo1.frequency.setValueAtTime(lfo1.frequency.value, now);
            lfo1.frequency.linearRampToValueAtTime(params.lfo1Rate, now + 0.1);
            
            lfo2.frequency.cancelScheduledValues(now);
            lfo2.frequency.setValueAtTime(lfo2.frequency.value, now);
            lfo2.frequency.linearRampToValueAtTime(params.lfo2Rate, now + 0.1);
            
            // Update LFO modulation depths
            lfoGain1.gain.cancelScheduledValues(now);
            lfoGain1.gain.setValueAtTime(lfoGain1.gain.value, now);
            lfoGain1.gain.linearRampToValueAtTime(params.lfo1Depth, now + 0.1);
            
            lfoGain2.gain.cancelScheduledValues(now);
            lfoGain2.gain.setValueAtTime(lfoGain2.gain.value, now);
            lfoGain2.gain.linearRampToValueAtTime(params.lfo2Depth, now + 0.1);
          } catch (error) {
            console.debug('Movement flow sound direction update error:', error);
          }
          return;
        }
        
        currentDirection = direction;
        const params = getDirectionParams(direction);
        
        try {
          const now = audioContext!.currentTime;
          
          // Create noise buffer if not already created
          if (!noiseBuffer) {
            noiseBuffer = createNoiseBuffer();
          }
          
          // Create two noise sources for phasing effect (inverted matter)
          bufferSource1 = audioContext!.createBufferSource();
          bufferSource2 = audioContext!.createBufferSource();
          bufferSource1.buffer = noiseBuffer;
          bufferSource2.buffer = noiseBuffer;
          bufferSource1.loop = true;
          bufferSource2.loop = true;
          
          // Create gain node for volume control
          gainNode = audioContext!.createGain();
          
          // Create EQ notch filter for precise 400Hz reduction
          eqNotchFilter = audioContext!.createBiquadFilter();
          eqNotchFilter.type = 'notch'; // Notch filter for precise frequency reduction
          eqNotchFilter.frequency.setValueAtTime(400, now); // Center at 400Hz
          eqNotchFilter.Q.setValueAtTime(0.3, now); // Lower Q (3) for wider notch curve
          eqNotchFilter.gain.setValueAtTime(-10, now); // Reduce by 10dB at 400Hz
          
          // Create multiple filters for vortex effect
          filter1 = audioContext!.createBiquadFilter();
          filter2 = audioContext!.createBiquadFilter();
          filter3 = audioContext!.createBiquadFilter();
          
          // Filter 1: Low-pass for low electrified hum - direction-aware
          filter1.type = 'lowpass';
          filter1.frequency.setValueAtTime(params.filter1Freq, now);
          filter1.Q.setValueAtTime(1.2, now); // Lower Q for less resonance, more hum-like
          
          // Filter 2: Subtle band-pass for electrical character - direction-aware
          filter2.type = 'bandpass';
          filter2.frequency.setValueAtTime(params.filter2Freq, now);
          filter2.Q.setValueAtTime(0.8, now); // Lower Q for less airy, more subtle
          
          // Filter 3: High-pass to remove very low rumble, keep it clean
          filter3.type = 'highpass';
          filter3.frequency.setValueAtTime(80, now); // Lower cutoff to preserve low hum
          filter3.Q.setValueAtTime(0.5, now); // Lower Q for gentle rolloff
          
          // Create second path filters for subtle phasing - direction-aware
          filter2b = audioContext!.createBiquadFilter();
          filter3b = audioContext!.createBiquadFilter();
          filter2b.type = 'bandpass';
          filter2b.frequency.setValueAtTime(params.filter2bFreq, now);
          filter2b.Q.setValueAtTime(0.8, now); // Lower Q for subtlety
          filter3b.type = 'highpass';
          filter3b.frequency.setValueAtTime(80, now); // Lower cutoff
          filter3b.Q.setValueAtTime(0.5, now); // Lower Q
          
          // Create LFOs for rotating vortex effect - direction-aware
          lfo1 = audioContext!.createOscillator();
          lfo2 = audioContext!.createOscillator();
          lfoGain1 = audioContext!.createGain();
          lfoGain2 = audioContext!.createGain();
          
          // LFO 1: Rotates filter1 frequency (vortex rotation) - direction-aware
          lfo1.type = 'sine';
          lfo1.frequency.setValueAtTime(params.lfo1Rate, now);
          lfoGain1.gain.setValueAtTime(params.lfo1Depth, now);
          lfo1.connect(lfoGain1);
          lfoGain1.connect(filter1.frequency);
          
          // LFO 2: Rotates filter2b frequency (phase offset for inverted matter) - direction-aware
          lfo2.type = 'sine';
          lfo2.frequency.setValueAtTime(params.lfo2Rate, now);
          lfoGain2.gain.setValueAtTime(params.lfo2Depth, now);
          lfo2.connect(lfoGain2);
          lfoGain2.connect(filter2b.frequency);
          
          // Start very quiet and fade in with adaptive timing based on key press pattern
          const adaptiveTargetVolume = 0.025 * adaptiveTiming.volumeMultiplier;
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(adaptiveTargetVolume, now + adaptiveTiming.fadeInTime);
          
          // Connect: noise sources -> filters -> gain -> EQ notch -> destination
          // Path 1: Main vortex path
          bufferSource1.connect(filter1);
          filter1.connect(filter2);
          filter2.connect(filter3);
          filter3.connect(gainNode);
          
          // Path 2: Phased path (inverted matter) - different filter chain
          bufferSource2.connect(filter2b);
          filter2b.connect(filter3b);
          filter3b.connect(gainNode);
          
          // Apply EQ notch filter after gain (affects final mixed signal)
          gainNode.connect(eqNotchFilter);
          eqNotchFilter.connect(audioContext!.destination);
          
          // Store second path filters for cleanup
          (bufferSource2 as any)._filter2b = filter2b;
          (bufferSource2 as any)._filter3b = filter3b;
          (bufferSource2 as any)._lfoGain2 = lfoGain2;
          
          // Start LFOs and noise sources
          lfo1.start(now);
          lfo2.start(now);
          bufferSource1.start(now);
          // Start second source with minimal phase offset for subtle phasing
          bufferSource2.start(now + params.phaseOffset);
          
          isPlaying = true;
        } catch (error) {
          console.debug('Movement flow sound start error:', error);
          isPlaying = false;
          // Clean up on error
          bufferSource1 = null;
          bufferSource2 = null;
          gainNode = null;
          filter1 = null;
          filter2 = null;
          filter3 = null;
          eqNotchFilter = null;
          lfo1 = null;
          lfo2 = null;
          lfoGain1 = null;
          lfoGain2 = null;
        }
      },
      stop: () => {
        if (!isPlaying || !gainNode) return;
        
        try {
          const stopTime = audioContext!.currentTime;
          
          // Track key release timing for adaptive behavior
          const now = Date.now();
          lastKeyReleaseTime = now;
          // Don't reset keyHoldStartTime here - we want to track the duration until release
          // keyHoldStartTime will be reset when a new key press starts
          
          // Get adaptive timing based on key press pattern
          const adaptiveTiming = analyzeKeyPressPattern();
          
          // Cancel any pending stop timeout (in case stop() is called multiple times)
          if (stopTimeoutId !== null) {
            clearTimeout(stopTimeoutId);
            stopTimeoutId = null;
          }
          
          // Fade out with adaptive timing based on key press pattern
          gainNode.gain.cancelScheduledValues(stopTime);
          gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
          gainNode.gain.linearRampToValueAtTime(0, stopTime + adaptiveTiming.fadeOutTime);
          
          // Stop all sources after fade out
          stopTimeoutId = setTimeout(() => {
            try {
              if (bufferSource1) {
                bufferSource1.stop();
              }
              if (bufferSource2) {
                bufferSource2.stop();
                // Clean up second path filters
                const filter2b = (bufferSource2 as any)._filter2b;
                const filter3b = (bufferSource2 as any)._filter3b;
                if (filter2b) filter2b.disconnect();
                if (filter3b) filter3b.disconnect();
              }
              if (lfo1) {
                lfo1.stop();
              }
              if (lfo2) {
                lfo2.stop();
              }
              if (lfoGain1) {
                lfoGain1.disconnect();
              }
              if (lfoGain2) {
                lfoGain2.disconnect();
              }
            } catch (error) {
              // Nodes may already be stopped
              console.debug('Movement flow sound stop error:', error);
            }
            bufferSource1 = null;
            bufferSource2 = null;
            gainNode = null;
            filter1 = null;
            filter2 = null;
            filter3 = null;
            eqNotchFilter = null;
            lfo1 = null;
            lfo2 = null;
            lfoGain1 = null;
            lfoGain2 = null;
            isPlaying = false;
            stopTimeoutId = null;
          }, Math.max(200, adaptiveTiming.fadeOutTime * 1000 + 50)); // Slightly longer than fade out to ensure smooth stop
        } catch (error) {
          console.debug('Movement flow sound stop error:', error);
          isPlaying = false;
          // Clean up on error
          bufferSource1 = null;
          bufferSource2 = null;
          gainNode = null;
          filter1 = null;
          filter2 = null;
          filter3 = null;
          filter2b = null;
          filter3b = null;
          eqNotchFilter = null;
          lfo1 = null;
          lfo2 = null;
          lfoGain1 = null;
          lfoGain2 = null;
          currentDirection = null;
        }
      },
      updateDirection: (direction: MovementDirection) => {
        if (!isPlaying || !filter1 || !filter2 || !filter2b || !lfo1 || !lfo2 || !lfoGain1 || !lfoGain2) return;
        
        // Skip update if direction hasn't changed
        if (currentDirection === direction) return;
        
        currentDirection = direction;
        const params = getDirectionParams(direction);
        const now = audioContext!.currentTime;
        
        try {
          // Update filter frequencies smoothly
          filter1.frequency.cancelScheduledValues(now);
          filter1.frequency.setValueAtTime(filter1.frequency.value, now);
          filter1.frequency.linearRampToValueAtTime(params.filter1Freq, now + 0.1);
          
          filter2.frequency.cancelScheduledValues(now);
          filter2.frequency.setValueAtTime(filter2.frequency.value, now);
          filter2.frequency.linearRampToValueAtTime(params.filter2Freq, now + 0.1);
          
          filter2b.frequency.cancelScheduledValues(now);
          filter2b.frequency.setValueAtTime(filter2b.frequency.value, now);
          filter2b.frequency.linearRampToValueAtTime(params.filter2bFreq, now + 0.1);
          
          // Update LFO rates smoothly
          lfo1.frequency.cancelScheduledValues(now);
          lfo1.frequency.setValueAtTime(lfo1.frequency.value, now);
          lfo1.frequency.linearRampToValueAtTime(params.lfo1Rate, now + 0.1);
          
          lfo2.frequency.cancelScheduledValues(now);
          lfo2.frequency.setValueAtTime(lfo2.frequency.value, now);
          lfo2.frequency.linearRampToValueAtTime(params.lfo2Rate, now + 0.1);
          
          // Update LFO modulation depths
          lfoGain1.gain.cancelScheduledValues(now);
          lfoGain1.gain.setValueAtTime(lfoGain1.gain.value, now);
          lfoGain1.gain.linearRampToValueAtTime(params.lfo1Depth, now + 0.1);
          
          lfoGain2.gain.cancelScheduledValues(now);
          lfoGain2.gain.setValueAtTime(lfoGain2.gain.value, now);
          lfoGain2.gain.linearRampToValueAtTime(params.lfo2Depth, now + 0.1);
        } catch (error) {
          console.debug('Movement flow sound updateDirection error:', error);
        }
      }
    };
  } catch (error) {
    console.debug('Movement flow sound creation error:', error);
    return null;
  }
}

