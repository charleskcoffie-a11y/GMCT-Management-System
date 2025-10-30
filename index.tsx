import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

declare const global: any;

(function ensureGlobalThis() {
  if (typeof globalThis !== 'undefined') {
    return;
  }

  var getGlobal = function (): any {
    if (typeof self !== 'undefined') {
      return self;
    }
    if (typeof window !== 'undefined') {
      return window;
    }
    if (typeof global !== 'undefined') {
      return global;
    }

    return Function('return this')();
  };

  var globalObj = getGlobal();
  try {
    Object.defineProperty(globalObj, 'globalThis', {
      value: globalObj,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch (error) {
    (globalObj as any).globalThis = globalObj;
  }
})();

declare global {
  interface Window {
    __gmctAppBooted?: boolean;
    __gmctBootstrapFailed?: boolean;
    __gmctBootstrapError?: string;
  }
}

window.__gmctAppBooted = false;
window.__gmctBootstrapFailed = false;
try {
  delete window.__gmctBootstrapError;
} catch {
  window.__gmctBootstrapError = undefined;
}

// --- Global Failsafe Error Handler ---
// This is a new, simplified, and more robust error handler that is guaranteed
// to display startup errors instead of crashing silently.
function extractError(event: ErrorEvent | PromiseRejectionEvent | { error: any }): any {
  if ('reason' in event) {
    return event.reason;
  }
  return (event as { error: any }).error;
}

function normaliseErrorMessage(error: any): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error || 'An unknown error occurred.');
}

function getStack(error: any): string {
  if (error && typeof error === 'object' && 'stack' in error && typeof (error as { stack: unknown }).stack === 'string') {
    return (error as { stack: string }).stack;
  }
  return 'No stack trace available.';
}

function handleError(errorEvent: ErrorEvent | PromiseRejectionEvent | { error: any }): void {
  try {
    if ('preventDefault' in errorEvent && typeof errorEvent.preventDefault === 'function') {
      errorEvent.preventDefault();
    }

    var error = extractError(errorEvent);
    console.error('GMCT App Global Error Handler caught:', error);

    var message = normaliseErrorMessage(error);
    var stack = getStack(error);
    var detailText = 'Error: ' + message + '\n\nStack Trace:\n' + stack;
    window.__gmctBootstrapFailed = true;
    window.__gmctAppBooted = false;
    window.__gmctBootstrapError = detailText;
    try {
      window.sessionStorage.setItem('gmct-last-bootstrap-error', detailText);
    } catch (storageError) {
      console.warn('GMCT bootstrap error details could not be persisted.', storageError);
    }

    var rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = '';
      rootElement.style.padding = '1.5rem';
      rootElement.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
      rootElement.style.color = '#B91C1C';

      var title = document.createElement('h1');
      title.textContent = 'Application Failed to Load';
      title.style.fontSize = '1.5rem';
      title.style.fontWeight = 'bold';

      var preamble = document.createElement('p');
      preamble.textContent = 'A critical error prevented the application from starting. Please check the browser\'s developer console and report the technical details below.';
      preamble.style.marginTop = '1rem';

      var details = document.createElement('pre');
      details.textContent = detailText;
      details.style.marginTop = '1rem';
      details.style.padding = '1rem';
      details.style.backgroundColor = '#FEF2F2';
      details.style.border = '1px solid #F87171';
      details.style.borderRadius = '0.5rem';
      details.style.whiteSpace = 'pre-wrap';
      details.style.wordWrap = 'break-word';
      details.style.fontFamily = 'ui-monospace, monospace';

      rootElement.appendChild(title);
      rootElement.appendChild(preamble);
      rootElement.appendChild(details);
    }
  } catch (error) {
    console.error('FATAL: The global error handler itself has crashed.', error);
    alert('A critical error occurred, and the error handler also failed. Please check the console for details.');
  }
}

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', function (event) {
  handleError(event);
});
// --- End of Failsafe ---

function registerServiceWorker(): void {
  // Per user feedback and common GitHub Pages deployment issues, the service worker
  // is being explicitly disabled to prevent silent, script-terminating errors.
  console.log("Service Worker registration has been disabled for maximum compatibility.");

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        registrations.forEach(function (registration) {
          if (registration.active || registration.waiting || registration.installing) {
            console.log('Unregistering stale service worker:', registration.scope);
          }
          registration.unregister().catch(function (error) {
            console.warn('Failed to unregister service worker', error);
          });
        });
      })
      .catch(function (error) {
        console.warn('Unable to enumerate existing service workers', error);
      });
  }

  if ('caches' in window) {
    caches
      .keys()
      .then(function (keys) {
        keys
          .filter(function (key) {
            return key.indexOf('gmct-app-cache') === 0 || key.indexOf('gmct-') === 0;
          })
          .forEach(function (key) {
            caches.delete(key).catch(function (error) {
              console.warn('Failed to delete cache ' + key, error);
            });
          });
      })
      .catch(function (error) {
        console.warn('Unable to enumerate caches for cleanup', error);
      });
  }
}

// --- App Initialization ---
function initialize(): void {
  console.log("Initializing application...");
  registerServiceWorker();

  var rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Fatal: Could not find the #root element in the HTML to mount the application.");
  }

  console.log("Root element found, clearing failsafe message...");
  rootElement.innerHTML = '';

  var root = createRoot(rootElement);

  console.log("Rendering React app...");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React app rendered.");
  window.__gmctAppBooted = true;
  window.__gmctBootstrapFailed = false;
  try {
    delete window.__gmctBootstrapError;
  } catch (error) {
    window.__gmctBootstrapError = undefined;
  }
  try {
    window.sessionStorage.removeItem('gmct-last-bootstrap-error');
  } catch (storageError) {
    console.warn('GMCT bootstrap error record could not be cleared.', storageError);
  }
}


// --- Startup Logic ---
try {
  initialize();
} catch (error) {
  handleError({ error: error });
}
