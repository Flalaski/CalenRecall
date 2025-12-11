import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CalendarProvider } from './contexts/CalendarContext';
import { EntriesProvider } from './contexts/EntriesContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './utils/themeLoader'; // Load all theme CSS files automatically
import { loadCustomThemes } from './utils/customThemeLoader'; // Load custom themes from user data directory
import './index.css';

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

