import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

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
  // DEFINITIVE FIX: The previous attempt to access `window.top.location` to detect
  // a cross-origin iframe was causing an uncatchable SecurityError that
  // terminated all script execution, leading to the persistent loading screen.
  // The fix is to remove this fragile check. We will now simply disable the
  // service worker if the app is running inside ANY iframe (`window.self !== window.top`),
  // which is a safe and robust way to handle the sandboxed development environment
  // without triggering security exceptions.
  if (window.self !== window.top) {
    console.log("App is in an iframe, skipping Service Worker registration for compatibility.");
    return;
  }
  
  if ('serviceWorker' in navigator) {
    const swUrl = new URL('sw.js', document.baseURI).href;
    
    navigator.serviceWorker.register(swUrl)
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
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
};


// --- Startup Logic ---
try {
  initialize();
} catch (error) {
  // This will catch any synchronous errors during the setup phase.
  handleError({ error: error });
}