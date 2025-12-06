import { useEffect, useState, useRef } from 'react';
import { generateProceduralCSSGradient } from '../utils/proceduralArt';
import { createLavaLampCanvas } from '../utils/lavaLampArt';
import { extractColorsFromImage, applyBackgroundColors, clearBackgroundColors } from '../utils/backgroundColorExtractor';
import './BackgroundArt.css';

interface BackgroundArtProps {
  backgroundImage?: string;
  className?: string;
  enableProceduralArt?: boolean; // Default: true
  theme?: string; // Current theme name
}

export default function BackgroundArt({ backgroundImage, className = '', enableProceduralArt = true, theme }: BackgroundArtProps) {
  const [proceduralGradient, setProceduralGradient] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationCleanupRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Removed excessive debug logging

  // Initialize lava lamp canvas animation
  useEffect(() => {
    if (!backgroundImage && enableProceduralArt) {
      // Wait for canvas to be available
      const initCanvas = () => {
        if (!canvasRef.current) {
          setTimeout(initCanvas, 100);
          return;
        }

        // Clean up previous animation
        if (animationCleanupRef.current) {
          animationCleanupRef.current();
        }

        // Get container dimensions
        const container = containerRef.current;
        if (!container) {
          return;
        }

        const updateCanvasSize = () => {
          if (canvasRef.current && container) {
            const rect = container.getBoundingClientRect();
            const width = Math.max(rect.width, 1920);
            const height = Math.max(rect.height, 1080);
            
            // Set canvas dimensions
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            
            // Restart animation with new size
            if (animationCleanupRef.current) {
              animationCleanupRef.current();
            }
            animationCleanupRef.current = createLavaLampCanvas(canvasRef.current, width, height);
          }
        };

        // Initial setup
        updateCanvasSize();

        // Update on resize
        const resizeObserver = new ResizeObserver(updateCanvasSize);
        resizeObserver.observe(container);

        return () => {
          resizeObserver.disconnect();
          if (animationCleanupRef.current) {
            animationCleanupRef.current();
          }
        };
      };

      // Start initialization
      initCanvas();
    } else {
      // Clean up animation when user image is set
      if (animationCleanupRef.current) {
        animationCleanupRef.current();
        animationCleanupRef.current = null;
      }
    }
  }, [backgroundImage, enableProceduralArt]);

  // Restart animation when theme changes to update colors smoothly
  useEffect(() => {
    if (!backgroundImage && enableProceduralArt && typeof document !== 'undefined') {
      let timeoutId: NodeJS.Timeout | null = null;
      
      const observer = new MutationObserver(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Small delay to ensure theme CSS has been applied
        timeoutId = setTimeout(() => {
          if (canvasRef.current && containerRef.current) {
            const container = containerRef.current;
            const rect = container.getBoundingClientRect();
            const width = Math.max(rect.width, 1920);
            const height = Math.max(rect.height, 1080);
            
            // Restart with new theme colors - smooth transition
            if (animationCleanupRef.current) {
              animationCleanupRef.current();
            }
            animationCleanupRef.current = createLavaLampCanvas(canvasRef.current, width, height);
          }
          timeoutId = null;
        }, 150);
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      return () => {
        observer.disconnect();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [backgroundImage, enableProceduralArt]);

  // Test image loading with a hidden img element to detect errors
  const [imageLoadError, setImageLoadError] = useState(false);
  const testImageRef = useRef<HTMLImageElement>(null);

  // Extract colors from background image and apply them (only for default themes)
  useEffect(() => {
    if (backgroundImage && testImageRef.current) {
      setImageLoadError(false);
      const img = testImageRef.current;
      img.src = backgroundImage;
      img.onload = async () => {
        setImageLoadError(false);
        // Extract colors and apply them (only for light/dark themes)
        try {
          const colors = await extractColorsFromImage(backgroundImage);
          if (theme) {
            applyBackgroundColors(colors, theme);
          }
        } catch (error) {
          console.error('[BackgroundArt] Error extracting colors:', error);
        }
      };
      img.onerror = () => {
        console.error('[BackgroundArt] Failed to load background image');
        setImageLoadError(true);
        clearBackgroundColors();
      };
    } else if (!backgroundImage) {
      setImageLoadError(false);
      clearBackgroundColors();
    }
  }, [backgroundImage, theme]);

  // Removed excessive debug logging

  // Render background art directly (not using portal)
  return (
    <div 
      ref={containerRef} 
      className={`background-art ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0, /* Will be behind .app which has z-index: 1 */
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {backgroundImage ? (
        // User's custom image
        <>
          {/* Hidden test image to detect loading errors */}
          <img
            ref={testImageRef}
            alt=""
            style={{ display: 'none' }}
          />
          {imageLoadError && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(255, 0, 0, 0.8)',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 1000
            }}>
              Failed to load background image. Check console for details.
            </div>
          )}
          <div
            className="background-image"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              zIndex: 0,
            }}
          />
        </>
      ) : enableProceduralArt ? (
        // Lava lamp style continuously morphing art
        <>
          <canvas
            ref={canvasRef}
            className="background-lava-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
          {/* Fallback gradient in case canvas isn't ready */}
          {!canvasRef.current && (
            <div
              className="background-procedural-gradient"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                background: proceduralGradient || 'transparent',
              }}
            />
          )}
        </>
      ) : (
        // No background - show a debug indicator
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 255, 0, 0.8)',
          color: 'black',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          No background (procedural art disabled, no custom image)
        </div>
      )}
    </div>
  );
}

