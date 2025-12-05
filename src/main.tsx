import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CalendarProvider } from './contexts/CalendarContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CalendarProvider>
      <App />
    </CalendarProvider>
  </React.StrictMode>
);

