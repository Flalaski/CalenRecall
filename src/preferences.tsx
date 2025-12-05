import React from 'react';
import ReactDOM from 'react-dom/client';
import PreferencesComponent from './components/Preferences';
import './utils/themeLoader'; // Load all theme CSS files automatically
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesComponent />
  </React.StrictMode>
);

