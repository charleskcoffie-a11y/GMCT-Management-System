import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

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

const registerServiceWorker = () => {
  // A robust check to determine if the app is running inside a sandboxed or
  // cross-origin iframe. Service Worker registration is blocked by browsers in
  // these environments for security reasons, which causes the "invalid state" error.
  // This detects the condition and skips registration to prevent the error.
  let isSandboxed = false;
  if (window.self !== window.top) {
    try {
      // If this access fails, we are in a cross-origin frame.
      const topHostname = window.top.location.hostname;
    } catch (e) {
      isSandboxed = true;
    }
  }

  if (isSandboxed) {
    console.log("Skipping Service Worker registration in a sandboxed environment.");
    return;
  }
  
  if ('serviceWorker' in navigator) {
    // To eliminate any ambiguity in path resolution, especially with the <base> tag,
    // we now construct an absolute URL for the service worker script. This is more robust
    // than a relative path and can prevent "Invalid state" errors if the browser is
    // confused about the script's origin.
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
  
  // 1. Register the Service Worker for offline capabilities.
  // This is now safe to run because sw-uninstaller.js has cleared any old registrations.
  registerServiceWorker();
  
  // 2. Render the React application.
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Fatal: Could not find the #root element in the HTML to mount the application.");
  }

  console.log("Root element found, clearing failsafe message...");
  // This is the critical step that removes the failsafe loading message
  // from index.html right before React takes over.
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
// We wrap the entire app startup in a try/catch to use our failsafe handler.
// Since this script is deferred and at the end of `<body>`, the DOM is ready,
// so we can initialize immediately without waiting for any further events.
try {
  initialize();
} catch (error) {
  // This will catch any synchronous errors during the setup phase.
  handleError({
      preventDefault: () => {},
      error: error
  } as any);
}