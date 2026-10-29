import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/app.css';
import { initStore, runRecurring } from './data/store.js';
import { autoRefreshRates } from './services/rateController.js';

// 1. Load + validate stored data and create any due recurring records.
initStore();
// 2. Refresh the exchange rate in the background if the cached one is old.
autoRefreshRates();
// 3. When the app comes back to the foreground (e.g. next day on iPhone),
//    create newly due recurring items and refresh a stale rate.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    runRecurring();
    autoRefreshRates();
  }
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Offline support / home-screen install (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  });
}
