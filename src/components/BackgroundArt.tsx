import { useEffect, useState, useRef } from 'react';
import { extractColorsFromImage, applyBackgroundColors, clearBackgroundColors } from '../utils/backgroundColorExtractor';
import './BackgroundArt.css';

interface BackgroundArtProps {
  backgroundImage?: string;
  className?: string;
  theme?: string; // Current theme name
}

export default function BackgroundArt({ backgroundImage, className = '', theme }: BackgroundArtProps) {
  const containerRef = useRef<HTMLDivElement>(null);


  // Test image loading with a hidden img element to detect errors
  const [imageLoadError, setImageLoadError] = useState(false);
  const testImageRef = useRef<HTMLImageElement>(null);

  // Extract colors from background image and apply them (only for default themes)
  // Also set data attribute to indicate custom image is present
  useEffect(() => {
    if (backgroundImage && testImageRef.current) {
      setImageLoadError(false);
      // Set data attribute so CSS can make theme backgrounds transparent
      document.documentElement.setAttribute('data-custom-background', 'true');
      
      const img = testImageRef.current;
      img.src = backgroundImage;
      img.onload = async () => {
        setImageLoadError(false);
        // Extract colors and apply them (only for light theme)
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
        document.documentElement.removeAttribute('data-custom-background');
      };
    } else if (!backgroundImage) {
      setImageLoadError(false);
      clearBackgroundColors();
      document.documentElement.removeAttribute('data-custom-background');
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
      ) : null}
    </div>
  );
}

