import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

declare global {
  interface Window {
    __gmctAppBooted?: boolean;
  }
}

// --- Global Failsafe Error Handler ---
// This is a new, simplified, and more robust error handler that is guaranteed
// to display startup errors instead of crashing silently.
const handleError = (errorEvent: ErrorEvent | PromiseRejectionEvent | { error: any }) => {
  try {
    if ('preventDefault' in errorEvent && typeof errorEvent.preventDefault === 'function') {
      errorEvent.preventDefault();
    }
    
    // Safely extract the error object or message, regardless of the event type.
    const error = 'reason' in errorEvent ? errorEvent.reason : errorEvent.error;

    // Log the raw error to the console for developers.
    console.error("GMCT App Global Error Handler caught:", error);

    const rootElement = document.getElementById('root');
    if (rootElement) {
      // Safely convert the error to a string for display.
      const message = error?.message || String(error) || 'An unknown error occurred.';
      const stack = error?.stack || 'No stack trace available.';
      
      // Clear the root element and use textContent for maximum safety.
      // This avoids any potential issues with innerHTML parsing.
      rootElement.innerHTML = '';
      rootElement.style.padding = '1.5rem';
      rootElement.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
      rootElement.style.color = '#B91C1C'; // text-red-700
      
      const title = document.createElement('h1');
      title.textContent = 'Application Failed to Load';
      title.style.fontSize = '1.5rem';
      title.style.fontWeight = 'bold';
      
      const preamble = document.createElement('p');
      preamble.textContent = 'A critical error prevented the application from starting. Please check the browser\'s developer console and report the technical details below.';
      preamble.style.marginTop = '1rem';

      const details = document.createElement('pre');
      details.textContent = `Error: ${message}\n\nStack Trace:\n${stack}`;
      details.style.marginTop = '1rem';
      details.style.padding = '1rem';
      details.style.backgroundColor = '#FEF2F2'; // bg-red-50
      details.style.border = '1px solid #F87171'; // border-red-400
      details.style.borderRadius = '0.5rem';
      details.style.whiteSpace = 'pre-wrap';
      details.style.wordWrap = 'break-word';
      details.style.fontFamily = 'ui-monospace, monospace';

      rootElement.appendChild(title);
      rootElement.appendChild(preamble);
      rootElement.appendChild(details);
    }
  } catch (e) {
    // If the error handler itself fails, this is the final fallback.
    console.error("FATAL: The global error handler itself has crashed.", e);
    alert("A critical error occurred, and the error handler also failed. Please check the console for details.");
  }
};

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', handleError as (e: PromiseRejectionEvent) => void);
// --- End of Failsafe ---

const registerServiceWorker = () => {
  // Per user feedback and common GitHub Pages deployment issues, the service worker
  // is being explicitly disabled to prevent silent, script-terminating errors.
  console.log("Service Worker registration has been disabled for maximum compatibility.");

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => {
        registrations.forEach(registration => {
          if (registration.active || registration.waiting || registration.installing) {
            console.log('Unregistering stale service worker:', registration.scope);
          }
          registration.unregister().catch(error => {
            console.warn('Failed to unregister service worker', error);
          });
        });
      })
      .catch(error => {
        console.warn('Unable to enumerate existing service workers', error);
      });
  }

  if ('caches' in window) {
    caches
      .keys()
      .then(keys => {
        keys
          .filter(key => key.startsWith('gmct-app-cache') || key.startsWith('gmct-'))
          .forEach(key => {
            caches.delete(key).catch(error => {
              console.warn(`Failed to delete cache ${key}`, error);
            });
          });
      })
      .catch(error => {
        console.warn('Unable to enumerate caches for cleanup', error);
      });
  }
};

// --- App Initialization ---
const initialize = () => {
  console.log("Initializing application...");
  registerServiceWorker();
  
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Fatal: Could not find the #root element in the HTML to mount the application.");
  }

  console.log("Root element found, clearing failsafe message...");
  rootElement.innerHTML = '';

  const root = createRoot(rootElement);
  
  console.log("Rendering React app...");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React app rendered.");
  window.__gmctAppBooted = true;
};


// --- Startup Logic ---
try {
  initialize();
} catch (error) {
  // This will catch any synchronous errors during the setup phase.
  handleError({ error: error });
}