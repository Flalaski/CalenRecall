import React from 'react';
import ReactDOM from 'react-dom/client';
import AboutComponent from './components/About';
import './utils/themeLoader'; // Load all theme CSS files automatically
import { loadCustomThemes } from './utils/customThemeLoader'; // Load custom themes from AppData
import './index.css';

// Load custom themes from AppData/themes directory
loadCustomThemes().catch(error => {
  console.error('Error loading custom themes:', error);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AboutComponent />
  </React.StrictMode>
);

