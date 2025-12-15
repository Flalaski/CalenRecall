import { useEffect, useRef, useCallback, useState } from 'react';
import packageJson from '../../package.json';
import { initializeTheme, type ThemeName, applyFontSize } from '../utils/themes';
import './About.css';

export default function AboutComponent() {
  const themeCleanupRef = useRef<(() => void) | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');
  const [newVersion, setNewVersion] = useState<string>('');
  const [checkingManually, setCheckingManually] = useState(false);

  // Load theme from profile selector's localStorage (same as profile selector)
  const loadProfileSelectorTheme = (): ThemeName => {
    const savedTheme = localStorage.getItem('profileSelectorTheme') as ThemeName | null;
    return savedTheme || 'aero';
  };

  // Save theme to profile selector's localStorage
  const saveProfileSelectorTheme = (themeName: ThemeName) => {
    localStorage.setItem('profileSelectorTheme', themeName);
  };

  // Handle theme change - updates localStorage and applies the theme
  const handleThemeChange = useCallback((newTheme: ThemeName) => {
    console.log('[About] Theme change requested:', newTheme);
    saveProfileSelectorTheme(newTheme);
    
    // Clean up previous theme listener
    if (themeCleanupRef.current) {
      themeCleanupRef.current();
      themeCleanupRef.current = null;
    }
    
    // Apply new theme
    const cleanup = initializeTheme(newTheme);
    themeCleanupRef.current = cleanup;
    
    // Force reflow to ensure CSS variables are applied
    setTimeout(() => {
      void document.documentElement.offsetHeight;
      void document.body.offsetHeight;
      const appliedTheme = document.documentElement.getAttribute('data-theme');
      console.log('[About] Theme applied. Current data-theme:', appliedTheme);
    }, 0);
  }, []);

  useEffect(() => {
    // Enable scrolling for about page with performance optimizations
    document.body.classList.add('about-page');
    document.documentElement.classList.add('about-page');
    
    // Set overflow for scrolling
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.height = 'auto';
    
    // Enable hardware acceleration for smooth scrolling
    document.body.style.transform = 'translateZ(0)';
    // @ts-expect-error: Non-standard property for legacy iOS momentum scrolling
    document.body.style.webkitOverflowScrolling = 'touch';

    // Initialize theme from profile selector's localStorage
    const initialTheme = loadProfileSelectorTheme();
    console.log('[About] Initial theme from localStorage:', initialTheme);
    
    // Apply theme immediately - don't wait for DOMContentLoaded
    const applyTheme = () => {
      // Clean up previous theme listener if it exists
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
        themeCleanupRef.current = null;
      }
      
      console.log('[About] Applying theme:', initialTheme);
      const cleanup = initializeTheme(initialTheme);
      themeCleanupRef.current = cleanup;
      
      // Force a reflow to ensure CSS variables are applied
      void document.documentElement.offsetHeight;
      void document.body.offsetHeight;
      
      // Verify theme was applied
      const appliedTheme = document.documentElement.getAttribute('data-theme');
      console.log('[About] Theme attribute after apply:', appliedTheme);
      
      // Ensure body/html get theme background
      if (appliedTheme) {
        const bodyBg = getComputedStyle(document.body).getPropertyValue('--theme-body-bg');
        console.log('[About] Theme body background variable:', bodyBg);
      }
    };
    
    // Apply theme immediately
    applyTheme();
    
    // Also apply after a short delay to ensure theme CSS is fully loaded
    setTimeout(applyTheme, 100);
    
    // Load font size from preferences if available
    const loadFontSize = async () => {
      if (window.electronAPI) {
        try {
          const prefs = await window.electronAPI.getAllPreferences();
          if (prefs.fontSize) {
            applyFontSize(prefs.fontSize);
          }
        } catch (error) {
          console.error('Error loading font size:', error);
        }
      }
    };
    loadFontSize();
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('about-page');
      document.documentElement.classList.remove('about-page');
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
      }
    };
  }, []);

  // Listen for theme updates from Electron menu - uses profile selector's localStorage theme
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onPreferenceUpdated) {
      return;
    }

    const handlePreferenceUpdate = (data: { key: string; value: any }) => {
      if (data.key === 'theme') {
        // When theme is changed from Electron menu, update profile selector's localStorage theme
        // This keeps the about page theme in sync with profile selector
        const newTheme = (data.value || 'aero') as ThemeName;
        handleThemeChange(newTheme);
      } else if (data.key === 'fontSize') {
        // Update font size when preference changes
        applyFontSize(data.value);
      }
    };

    window.electronAPI.onPreferenceUpdated(handlePreferenceUpdate);

    return () => {
      if (window.electronAPI && window.electronAPI.removePreferenceUpdatedListener) {
        window.electronAPI.removePreferenceUpdatedListener();
      }
    };
  }, [handleThemeChange]);

  // Listen for localStorage changes to profileSelectorTheme (when profile selector changes theme)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'profileSelectorTheme' && e.newValue) {
        const newTheme = e.newValue as ThemeName;
        handleThemeChange(newTheme);
      }
    };

    // Listen for storage events (works across tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also poll for changes (since storage events don't fire in the same window)
    // Use a shorter interval for more responsive updates
    const pollInterval = setInterval(() => {
      const currentTheme = loadProfileSelectorTheme();
      const appliedTheme = document.documentElement.getAttribute('data-theme');
      
      // If theme has changed, apply it
      if (currentTheme && currentTheme !== appliedTheme) {
        console.log('[About] Detected theme change via polling:', currentTheme, '-> applying');
        handleThemeChange(currentTheme);
      }
    }, 250); // Check every 250ms for more responsive updates

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [handleThemeChange]);

  // Listen for update events
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeChecking = window.electronAPI.onUpdateChecking?.(() => {
      setUpdateStatus('checking');
    });

    const removeAvailable = window.electronAPI.onUpdateAvailable?.((version: string) => {
      setUpdateStatus('available');
      setNewVersion(version);
      setCheckingManually(false);
    });

    const removeNotAvailable = window.electronAPI.onUpdateNotAvailable?.(() => {
      setUpdateStatus('up-to-date');
      setCheckingManually(false);
    });

    const removeError = window.electronAPI.onUpdateError?.(() => {
      setUpdateStatus('error');
      setCheckingManually(false);
    });

    return () => {
      removeChecking?.();
      removeAvailable?.();
      removeNotAvailable?.();
      removeError?.();
    };
  }, []);

  const handleCheckForUpdates = () => {
    if (window.electronAPI?.checkForUpdates) {
      setCheckingManually(true);
      setUpdateStatus('checking');
      window.electronAPI.checkForUpdates();
    }
  };

  return (
    <div className="about-container">
      <div className="about-content">
        <div className="about-header">
          <img 
            src="./icon.png" 
            alt="CalenRecall" 
            className="about-icon"
          />
          <div className="about-title-section">
            <h1>CalenRecall</h1>
            <p className="about-description">
              A calendar journal for recalling memories across decades, years, months, weeks, and days
            </p>
          </div>
        </div>
        
        <div className="about-section">
          <p className="about-version">
            <strong>Version:</strong> {packageJson.version || 'Unknown'}
          </p>
          <p className="about-note">
            All your journaling history is stored locally on your device.
          </p>
        </div>

        <div className="about-section about-updates">
          <h2>Updates</h2>
          <div className="update-check-container">
            {updateStatus === 'idle' && (
              <button 
                className="update-check-button"
                onClick={handleCheckForUpdates}
                disabled={!window.electronAPI?.checkForUpdates}
              >
                Check for Updates
              </button>
            )}
            {updateStatus === 'checking' && (
              <div className="update-status checking">
                <span className="update-spinner">⟳</span>
                <span>Checking for updates...</span>
              </div>
            )}
            {updateStatus === 'available' && (
              <div className="update-status available">
                <span className="update-icon">↓</span>
                <span>Update {newVersion} is available and will download in the background</span>
              </div>
            )}
            {updateStatus === 'up-to-date' && (
              <div className="update-status up-to-date">
                <span className="update-icon">✓</span>
                <span>You're running the latest version</span>
              </div>
            )}
            {updateStatus === 'error' && (
              <div className="update-status error">
                <span className="update-icon">⚠</span>
                <span>Could not check for updates. Please try again later.</span>
              </div>
            )}
          </div>
        </div>

        <div className="about-section about-credits">
          <h2>Credits</h2>
          <p>
            Created by <strong>Cory F. Mahler</strong>
          </p>
          <p>
            <a 
              href="https://flalaski.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="about-link"
            >
              Flalaski.com
            </a>
          </p>
          <p>
            <a 
              href="https://github.com/flalaski/CalenRecall" 
              onClick={(e) => {
                e.preventDefault();
                if (window.electronAPI?.openExternalBrowser) {
                  window.electronAPI.openExternalBrowser('https://github.com/flalaski/CalenRecall');
                }
              }}
              className="about-link"
            >
              GitHub Repository
            </a>
          </p>
          <p>
            <a 
              href="https://github.com/flalaski/CalenRecall/issues" 
              onClick={(e) => {
                e.preventDefault();
                if (window.electronAPI?.openExternalBrowser) {
                  window.electronAPI.openExternalBrowser('https://github.com/flalaski/CalenRecall/issues');
                }
              }}
              className="about-link"
            >
              Report Issues or Provide Feedback
            </a>
          </p>
        </div>

        <div className="about-section about-credits-detailed">
          <h2>Detailed Credits</h2>
          
          <div className="credits-category">
            <h3>Calendar Algorithms & References</h3>
            <ul>
              <li>
                <strong>Julian Day Number Calculations:</strong> Based on algorithms from 
                <em> "Calendrical Calculations"</em> by Nachum Dershowitz & Edward Reingold
              </li>
              <li>
                <strong>Astronomical Calculations:</strong> Based on algorithms from 
                <em> "Astronomical Algorithms"</em> by Jean Meeus
              </li>
              <li>
                <strong>Chinese Calendar:</strong> Implementation based on <em>"Calendrical Calculations"</em> Chapter 19 
                (Dershowitz & Reingold) and astronomical algorithms from Jean Meeus
              </li>
              <li>
                <strong>Calendar Conversions:</strong> All calendar systems use Julian Day Number (JDN) as a universal 
                reference point, with conversions based on established calendrical and astronomical methods
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Core Framework & Runtime</h3>
            <ul>
              <li>
                <strong>Electron</strong> (v39.2.5) - Cross-platform desktop application framework
                <br />
                <a href="https://www.electronjs.org" target="_blank" rel="noopener noreferrer" className="about-link">
                  electronjs.org
                </a>
              </li>
              <li>
                <strong>React</strong> (v18.2.0) - UI library for building user interfaces
                <br />
                <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="about-link">
                  react.dev
                </a>
              </li>
              <li>
                <strong>React DOM</strong> (v18.2.0) - React renderer for web
              </li>
              <li>
                <strong>TypeScript</strong> (v5.3.3) - Typed superset of JavaScript
                <br />
                <a href="https://www.typescriptlang.org" target="_blank" rel="noopener noreferrer" className="about-link">
                  typescriptlang.org
                </a>
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Date & Time Utilities</h3>
            <ul>
              <li>
                <strong>date-fns</strong> (v3.0.0) - Modern JavaScript date utility library
                <br />
                <a href="https://date-fns.org" target="_blank" rel="noopener noreferrer" className="about-link">
                  date-fns.org
                </a>
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Database & Data Storage</h3>
            <ul>
              <li>
                <strong>better-sqlite3</strong> (v12.5.0) - Fast, synchronous SQLite3 database for Node.js
                <br />
                <a href="https://github.com/WiseLibs/better-sqlite3" target="_blank" rel="noopener noreferrer" className="about-link">
                  github.com/WiseLibs/better-sqlite3
                </a>
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Typography & Fonts</h3>
            <ul>
              <li>
                <strong>Inter</strong> - Variable font family designed for user interfaces
                <br />
                <a href="https://fonts.google.com/specimen/Inter" target="_blank" rel="noopener noreferrer" className="about-link">
                  Google Fonts - Inter
                </a>
              </li>
              <li>
                <strong>Noto Sans</strong> - Font family designed to support all languages with a harmonious look
                <br />
                <a href="https://fonts.google.com/noto" target="_blank" rel="noopener noreferrer" className="about-link">
                  Google Fonts - Noto Sans
                </a>
                <br />
                Used variants: Noto Sans, Noto Sans SC (Simplified Chinese), Noto Sans Arabic, Noto Sans Hebrew, Noto Sans Thai
              </li>
              <li>
                <strong>Bebas Neue</strong> - Condensed display typeface used for date labels
                <br />
                <a href="https://fonts.google.com/specimen/Bebas+Neue" target="_blank" rel="noopener noreferrer" className="about-link">
                  Google Fonts - Bebas Neue
                </a>
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Build Tools & Development</h3>
            <ul>
              <li>
                <strong>Vite</strong> (v7.2.6) - Next generation frontend build tool
                <br />
                <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" className="about-link">
                  vitejs.dev
                </a>
              </li>
              <li>
                <strong>@vitejs/plugin-react</strong> (v4.2.1) - Official React plugin for Vite
              </li>
              <li>
                <strong>Electron Builder</strong> (v24.9.1) - Complete solution to package and build Electron applications
                <br />
                <a href="https://www.electron.build" target="_blank" rel="noopener noreferrer" className="about-link">
                  electron.build
                </a>
              </li>
              <li>
                <strong>@electron/rebuild</strong> (v3.7.2) - Rebuild native Node.js modules against Electron
              </li>
              <li>
                <strong>concurrently</strong> (v8.2.2) - Run multiple commands concurrently
              </li>
              <li>
                <strong>wait-on</strong> (v7.2.0) - Utility to wait for resources to be available
              </li>
              <li>
                <strong>ts-node</strong> (v10.9.2) - TypeScript execution environment for Node.js
              </li>
              <li>
                <strong>sharp</strong> (v0.34.5) - High performance Node.js image processing
                <br />
                <a href="https://sharp.pixelplumbing.com" target="_blank" rel="noopener noreferrer" className="about-link">
                  sharp.pixelplumbing.com
                </a>
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Document Generation</h3>
            <ul>
              <li>
                <strong>PDFKit</strong> (v0.14.0) - PDF generation library for Node.js and the browser
                <br />
                <a href="https://pdfkit.org" target="_blank" rel="noopener noreferrer" className="about-link">
                  pdfkit.org
                </a>
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Audio & Media</h3>
            <ul>
              <li>
                <strong>Web Audio API</strong> - Native browser API for audio synthesis and processing
                <br />
                All UI sounds are procedurally generated using Web Audio API oscillators and gain nodes
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>Calendar Systems Supported</h3>
            <ul>
              <li>Gregorian Calendar (modern international standard)</li>
              <li>Julian Calendar (historical European calendar)</li>
              <li>Islamic Calendar (Hijri - lunar calendar)</li>
              <li>Hebrew Calendar (Jewish lunisolar calendar)</li>
              <li>Persian Calendar (Solar Hijri / Jalali calendar)</li>
              <li>Chinese Calendar (农历 - traditional lunisolar calendar)</li>
              <li>Ethiopian Calendar (Ethiopian Orthodox calendar)</li>
              <li>Coptic Calendar (Coptic Orthodox calendar)</li>
              <li>Indian Saka Calendar (Indian National Calendar)</li>
              <li>Baha'i Calendar (Badi' calendar)</li>
              <li>Thai Buddhist Calendar (Buddhist Era calendar)</li>
              <li>Mayan Tzolk'in Calendar (260-day sacred cycle)</li>
              <li>Mayan Haab' Calendar (365-day solar calendar)</li>
              <li>Mayan Long Count Calendar (linear day count system)</li>
              <li>Cherokee Calendar (12-month seasonal calendar)</li>
              <li>Iroquois Calendar (13-moon lunar calendar)</li>
              <li>Aztec Xiuhpohualli Calendar (365-day solar calendar)</li>
            </ul>
            <p className="credits-note">
              Any and all feedback is welcome for helping ensure accuracy for cross-cultural interfacing.
            </p>
          </div>

          <div className="credits-category">
            <h3>Type Definitions</h3>
            <ul>
              <li>
                <strong>@types/node</strong> (v20.19.25) - TypeScript definitions for Node.js
              </li>
              <li>
                <strong>@types/react</strong> (v18.2.45) - TypeScript definitions for React
              </li>
              <li>
                <strong>@types/react-dom</strong> (v18.2.18) - TypeScript definitions for React DOM
              </li>
              <li>
                <strong>@types/better-sqlite3</strong> (v7.6.13) - TypeScript definitions for better-sqlite3
              </li>
            </ul>
          </div>

          <div className="credits-category">
            <h3>License</h3>
            <p>
              This project is licensed under the <strong>MIT License</strong>.
            </p>
            <p className="credits-note">
              All dependencies and libraries are used in accordance with their respective licenses.
              Calendar algorithms are based on published academic and reference works in calendrical
              and astronomical computation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

