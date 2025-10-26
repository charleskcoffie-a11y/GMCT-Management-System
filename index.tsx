import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getAppBaseUrl } from './utils';

// --- Global Failsafe Error Handler ---
// This code runs before React and will catch any critical startup errors.
// If the app crashes, it displays the error on the screen instead of a blank page.
const handleError = (errorEvent: ErrorEvent | PromiseRejectionEvent) => {
  // Prevent the browser's default error handling
  errorEvent.preventDefault();
  
  // FIX: Moved the 'error' variable declaration out of the 'if (rootElement)' block to make it accessible to the console.error call at the end of the function, fixing a scope-related "Cannot find name 'error'" error.
  // Handle both standard errors and unhandled promise rejections
  const error = 'reason' in errorEvent ? errorEvent.reason : errorEvent.error;

  const rootElement = document.getElementById('root');
  if (rootElement) {
    // Immediately stop any further rendering and clear the screen
    rootElement.innerHTML = ''; 

    const errorBox = document.createElement('div');
    // Use inline styles to ensure this works even if CSS fails to load
    errorBox.style.padding = '1.5rem';
    errorBox.style.margin = '1.5rem';
    errorBox.style.backgroundColor = '#FEF2F2'; // bg-red-50
    errorBox.style.border = '1px solid #F87171'; // border-red-400
    errorBox.style.borderRadius = '0.5rem';
    errorBox.style.color = '#991B1B'; // text-red-800
    errorBox.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';

    const message = error?.message || 'An unknown error occurred.';
    const stack = error?.stack || 'No stack trace available.';

    errorBox.innerHTML = `
      <h1 style="font-size: 1.25rem; font-weight: bold; color: #B91C1C;">Application Failed to Load</h1>
      <p style="margin-top: 1rem;">An unexpected error prevented the application from starting. This is often caused by a configuration problem or a network issue after deployment.</p>
      <p style="margin-top: 0.5rem;">Please copy the technical details below to help with troubleshooting.</p>
      <div style="background-color: #FEE2E2; padding: 1rem; border-radius: 0.25rem; margin-top: 1rem; font-family: ui-monospace, monospace; white-space: pre-wrap; word-wrap: break-word; font-size: 0.875rem;">
        <strong>Error:</strong> ${message}
        <br><br>
        <strong>Stack Trace:</strong>
        <pre style="margin-top: 0.5rem; overflow-x: auto;">${stack}</pre>
      </div>
    `;
    
    rootElement.appendChild(errorBox);
  }
  // Also log the original error to the console for developers
  console.error("GMCT App Global Error Handler caught:", error);
};

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', handleError);
// --- End of Failsafe ---

try {
  // --- Dynamic Base URL Injection ---
  // This is the definitive fix for GitHub Pages deployment. It programmatically
  // calculates the correct base URL and injects the <base> tag, which must
  // happen before any other script relies on relative paths.
  const baseUrl = getAppBaseUrl();
  if (!document.querySelector('base')) {
    const baseTag = document.createElement('base');
    baseTag.href = baseUrl;
    document.head.prepend(baseTag);
  }
  // --- End of Injection ---

  // Register Service Worker for PWA Offline Functionality
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Use the calculated baseUrl to correctly resolve the sw.js path.
      const swUrl = new URL('sw.js', baseUrl).href;
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
    throw new Error("Fatal: Could not find the #root element in the HTML to mount the application.");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

} catch(error) {
  // If React itself fails to initialize synchronously, catch it and display it.
  handleError({
      preventDefault: () => {},
      error: error
  } as any);
}