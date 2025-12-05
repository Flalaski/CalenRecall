import { useEffect } from 'react';
import packageJson from '../../package.json';
import './About.css';

export default function AboutComponent() {
  useEffect(() => {
    // Enable scrolling for about page
    document.body.classList.add('about-page');
    document.documentElement.classList.add('about-page');
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.height = 'auto';
    
    // Apply theme on load
    const applyTheme = async () => {
      if (window.electronAPI) {
        const prefs = await window.electronAPI.getAllPreferences();
        const theme = prefs.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'auto') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
        if (prefs.fontSize) {
          document.documentElement.setAttribute('data-font-size', prefs.fontSize);
        }
      }
    };
    applyTheme();
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('about-page');
      document.documentElement.classList.remove('about-page');
    };
  }, []);

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
              target="_blank" 
              rel="noopener noreferrer"
              className="about-link"
            >
              GitHub Repository
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

