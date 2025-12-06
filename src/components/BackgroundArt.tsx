import { useEffect, useState, useRef, useCallback } from 'react';
import { generateProceduralCSSGradient } from '../utils/proceduralArt';
import { createLavaLampCanvas } from '../utils/lavaLampArt';
import './BackgroundArt.css';

interface BackgroundArtProps {
  backgroundImage?: string;
  className?: string;
}

export default function BackgroundArt({ backgroundImage, className = '' }: BackgroundArtProps) {
  const [proceduralGradient, setProceduralGradient] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationCleanupRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize lava lamp canvas animation
  useEffect(() => {
    if (!backgroundImage && canvasRef.current) {
      // Clean up previous animation
      if (animationCleanupRef.current) {
        animationCleanupRef.current();
      }

      // Get container dimensions
      const container = containerRef.current;
      if (!container) return;

      const updateCanvasSize = () => {
        if (canvasRef.current && container) {
          const rect = container.getBoundingClientRect();
          const width = Math.max(rect.width, 1920);
          const height = Math.max(rect.height, 1080);
          
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
    } else {
      // Clean up animation when user image is set
      if (animationCleanupRef.current) {
        animationCleanupRef.current();
        animationCleanupRef.current = null;
      }
    }
  }, [backgroundImage]);

  // Restart animation when theme changes to update colors smoothly
  useEffect(() => {
    if (!backgroundImage && typeof document !== 'undefined') {
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
  }, [backgroundImage]);

  return (
    <div ref={containerRef} className={`background-art ${className}`}>
      {backgroundImage ? (
        // User's custom image
        <div
          className="background-image"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
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
                background: proceduralGradient || 'transparent',
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

