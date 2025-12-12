import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CalendarProvider } from './contexts/CalendarContext';
import { EntriesProvider } from './contexts/EntriesContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './utils/themeLoader'; // Load all theme CSS files automatically
import { loadCustomThemes } from './utils/customThemeLoader'; // Load custom themes from user data directory
import './index.css';

// EXTREME PERFORMANCE: Enable performance mode by default
// This disables all animations and visual effects for maximum speed
if (typeof document !== 'undefined') {
  // Check for prefers-reduced-motion (accessibility)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Enable performance mode for maximum speed
  // Can be disabled via preference if needed
  document.documentElement.classList.add('performance-mode');
  
  // Also respect system preference
  if (prefersReducedMotion) {
    document.documentElement.classList.add('performance-mode');
  }
}

// Load custom themes from user data directory (themes subfolder)
loadCustomThemes().catch(error => {
  console.error('Error loading custom themes:', error);
});

// Disable StrictMode in production for better performance (it causes double renders)
const isProduction = import.meta.env.PROD;
const AppWrapper = (
  <ErrorBoundary>
    <CalendarProvider>
      <EntriesProvider>
        <App />
      </EntriesProvider>
    </CalendarProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  isProduction ? AppWrapper : <React.StrictMode>{AppWrapper}</React.StrictMode>
);

