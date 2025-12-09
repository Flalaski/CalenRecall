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
  
  // Cache extracted colors to avoid re-extraction when only theme changes
  const extractedColorsCacheRef = useRef<{ imageUrl: string; colors: Awaited<ReturnType<typeof extractColorsFromImage>> } | null>(null);

  // Extract colors from background image and apply them (only for default themes)
  // Also set data attribute to indicate custom image is present
  useEffect(() => {
    if (backgroundImage && testImageRef.current) {
      setImageLoadError(false);
      // Set data attribute so CSS can make theme backgrounds transparent
      document.documentElement.setAttribute('data-custom-background', 'true');
      
      const img = testImageRef.current;
      const newSrc = backgroundImage;
      
      // Only extract colors if image changed or not cached
      const needsColorExtraction = !extractedColorsCacheRef.current || extractedColorsCacheRef.current.imageUrl !== newSrc;
      
      // Set up error handler first
      img.onerror = () => {
        console.error('[BackgroundArt] Failed to load background image');
        setImageLoadError(true);
        clearBackgroundColors();
        document.documentElement.removeAttribute('data-custom-background');
        extractedColorsCacheRef.current = null;
      };
      
      if (needsColorExtraction) {
        // Extract colors only if image changed
        img.onload = async () => {
          setImageLoadError(false);
          // Extract colors and cache them
          try {
            const colors = await extractColorsFromImage(newSrc);
            extractedColorsCacheRef.current = { imageUrl: newSrc, colors };
            // Apply colors if theme is available
            if (theme) {
              applyBackgroundColors(colors, theme);
            }
          } catch (error) {
            console.error('[BackgroundArt] Error extracting colors:', error);
            extractedColorsCacheRef.current = null;
          }
        };
        // Only set src if we need to load/extract
        if (img.src !== newSrc) {
          img.src = newSrc;
        }
      } else {
        // Use cached colors if available (image already loaded, just apply colors)
        if (extractedColorsCacheRef.current && extractedColorsCacheRef.current.imageUrl === newSrc) {
          if (theme) {
            applyBackgroundColors(extractedColorsCacheRef.current.colors, theme);
          }
        }
      }
    } else if (!backgroundImage) {
      setImageLoadError(false);
      clearBackgroundColors();
      document.documentElement.removeAttribute('data-custom-background');
      extractedColorsCacheRef.current = null;
    }
  }, [backgroundImage]); // Removed theme from dependencies - handle theme changes separately

  // Apply cached colors when theme changes (without re-extracting)
  useEffect(() => {
    if (backgroundImage && extractedColorsCacheRef.current && extractedColorsCacheRef.current.imageUrl === backgroundImage) {
      if (theme) {
        applyBackgroundColors(extractedColorsCacheRef.current.colors, theme);
      }
    }
  }, [theme, backgroundImage]);

  // Only render if there's a background image
  if (!backgroundImage) {
    return null;
  }

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
        width: '100%',
        height: '100vh',
        zIndex: 0, /* Will be behind .app which has z-index: 1 */
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
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
    </div>
  );
}

