import { useEffect } from 'react';
import packageJson from '../../package.json';
import './About.css';

export default function AboutComponent() {
  useEffect(() => {
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
      </div>
    </div>
  );
}

