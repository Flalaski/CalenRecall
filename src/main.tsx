import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CalendarProvider } from './contexts/CalendarContext';
import { EntriesProvider } from './contexts/EntriesContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CalendarProvider>
      <EntriesProvider>
        <App />
      </EntriesProvider>
    </CalendarProvider>
  </React.StrictMode>
);

