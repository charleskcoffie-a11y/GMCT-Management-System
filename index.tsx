import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register Service Worker for PWA Offline Functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Construct an absolute URL to the service worker script based on the current page's location.
    // This is necessary to avoid same-origin policy errors in environments that might use a <base> tag
    // or have a different script execution origin.
    const swUrl = new URL('sw.js', window.location.href).href;
    navigator.serviceWorker.register(swUrl)
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}


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