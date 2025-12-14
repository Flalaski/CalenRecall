import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CalendarProvider } from './contexts/CalendarContext';
import { EntriesProvider } from './contexts/EntriesContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './utils/themeLoader'; // Load all theme CSS files automatically
import { loadCustomThemes } from './utils/customThemeLoader'; // Load custom themes from user data directory
import './index.css';

// Render all title-based tooltips above the cursor with a single shared overlay
const initGlobalTooltips = () => {
  if (typeof document === 'undefined') return;
  if (document.body.dataset.tooltipsInitialized === 'true') return;

  document.body.dataset.tooltipsInitialized = 'true';

  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'global-tooltip';
  document.body.appendChild(tooltipEl);

  let activeEl: HTMLElement | null = null;
  let activeTitle: string | null = null;

  const restoreTitle = () => {
    if (activeEl && activeTitle !== null && !activeEl.getAttribute('title')) {
      activeEl.setAttribute('title', activeTitle);
    }
  };

  const hide = () => {
    restoreTitle();
    tooltipEl.classList.remove('visible');
    tooltipEl.textContent = '';
    activeEl = null;
    activeTitle = null;
  };

  const updatePosition = (x: number, y: number) => {
    const clampedY = Math.max(8, y - 18); // keep tooltip above cursor
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${clampedY}px`;
  };

  const show = (el: HTMLElement, title: string, x: number, y: number) => {
    activeEl = el;
    activeTitle = title;
    tooltipEl.textContent = title;
    updatePosition(x, y);
    tooltipEl.classList.add('visible');
  };

  document.addEventListener('pointerover', event => {
    const target = event.target as HTMLElement | null;
    const title = target?.getAttribute?.('title');
    if (!target || !title) return;

    target.removeAttribute('title'); // suppress native tooltip
    show(target, title, event.clientX, event.clientY);
  });

  document.addEventListener('pointermove', event => {
    if (!activeEl) return;
    updatePosition(event.clientX, event.clientY);
  });

  document.addEventListener('pointerout', event => {
    if (!activeEl) return;
    const next = event.relatedTarget as Node | null;
    if (next && activeEl.contains(next)) return; // moving within same target
    hide();
  });

  document.addEventListener('pointerdown', hide);
  document.addEventListener('scroll', hide, true);

  document.addEventListener('focusin', event => {
    const target = event.target as HTMLElement | null;
    const title = target?.getAttribute?.('title');
    if (!target || !title) return;

    target.removeAttribute('title');
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const topY = Math.max(8, rect.top);
    show(target, title, centerX, topY);
  });

  document.addEventListener('focusout', event => {
    if (!activeEl) return;
    if (event.target === activeEl) hide();
  });
};

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

// Ensure tooltips render above the cursor
initGlobalTooltips();

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

