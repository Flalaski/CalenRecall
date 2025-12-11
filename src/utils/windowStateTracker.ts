/**
 * Window state tracker to prevent flickering during maximize/fullscreen transitions
 * Detects when window is transitioning and pauses resize handlers during those times
 */

let isTransitioning = false;
let transitionEndTimeout: NodeJS.Timeout | null = null;
const TRANSITION_END_DELAY = 500; // Wait 500ms after transition before resuming handlers

/**
 * Check if window is currently transitioning (maximize/fullscreen)
 */
export function isWindowTransitioning(): boolean {
  return isTransitioning;
}

/**
 * Mark window as transitioning (call when maximize/fullscreen starts)
 */
export function startWindowTransition(): void {
  isTransitioning = true;
  
  // Clear any existing timeout
  if (transitionEndTimeout) {
    clearTimeout(transitionEndTimeout);
  }
  
  // Update CSS class
  document.body.classList.add('window-transitioning');
  
  // Set timeout to mark transition as complete
  transitionEndTimeout = setTimeout(() => {
    isTransitioning = false;
    document.body.classList.remove('window-transitioning');
    transitionEndTimeout = null;
  }, TRANSITION_END_DELAY);
}

/**
 * Mark window transition as complete (call when maximize/fullscreen ends)
 */
export function endWindowTransition(): void {
  // Clear any existing timeout
  if (transitionEndTimeout) {
    clearTimeout(transitionEndTimeout);
  }
  
  // Mark as complete after a short delay to ensure transition is fully done
  transitionEndTimeout = setTimeout(() => {
    isTransitioning = false;
    document.body.classList.remove('window-transitioning');
    transitionEndTimeout = null;
  }, TRANSITION_END_DELAY);
}

/**
 * Initialize window state tracking
 * Sets up listeners for window state changes
 */
export function initializeWindowStateTracker(): () => void {
  // Track window size changes to detect maximize/fullscreen transitions
  let lastWidth = window.innerWidth;
  let lastHeight = window.innerHeight;
  let resizeTimeout: NodeJS.Timeout | null = null;
  let rapidResizeCount = 0;
  
  const handleResize = () => {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
    // Calculate size change
    const widthChange = Math.abs(currentWidth - lastWidth);
    const heightChange = Math.abs(currentHeight - lastHeight);
    const totalChange = widthChange + heightChange;
    
    // If size change is very large (>50% of screen), likely a maximize/fullscreen transition
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const isLargeChange = totalChange > (screenWidth + screenHeight) * 0.5;
    
    // If we see rapid resize events (>3 in quick succession) or large change, mark as transitioning
    if (isLargeChange) {
      startWindowTransition();
      rapidResizeCount = 0;
    } else {
      rapidResizeCount++;
      if (rapidResizeCount > 3) {
        // Multiple rapid resizes likely means transition
        startWindowTransition();
        rapidResizeCount = 0;
      }
    }
    
    lastWidth = currentWidth;
    lastHeight = currentHeight;
    
    // Reset rapid resize count after a delay
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(() => {
      rapidResizeCount = 0;
    }, 200);
  };
  
  // Listen for resize events
  window.addEventListener('resize', handleResize, { passive: true });
  
  // Also listen for fullscreen changes
  const handleFullscreenChange = () => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement) {
      startWindowTransition();
    } else {
      endWindowTransition();
    }
  };
  
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  
  // Cleanup function
  return () => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    if (transitionEndTimeout) {
      clearTimeout(transitionEndTimeout);
    }
    document.body.classList.remove('window-transitioning');
  };
}

