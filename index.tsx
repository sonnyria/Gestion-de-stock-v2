import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Vite résout l'extension .tsx automatiquement
import logger from './services/logger';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        logger.info('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        logger.warn('ServiceWorker registration failed: ', err);
      });
  });
}