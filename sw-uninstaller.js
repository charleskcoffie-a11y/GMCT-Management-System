// sw-uninstaller.js
// This script's sole purpose is to remove any and all service workers
// that might be 'stuck' controlling the page. This is a critical step
// to ensure that a fresh, non-cached version of the application is loaded.
// It runs before the main application script.

(function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      if (registrations.length === 0) {
        console.log('No old service workers found to unregister.');
        return;
      }
      for (let registration of registrations) {
        registration.unregister().then(function(boolean) {
          if (boolean) {
            console.log('Successfully unregistered an old service worker for scope:', registration.scope);
          } else {
            // This is not a critical error, might just mean it was already unregistered.
            console.warn('Failed to unregister an old service worker for scope:', registration.scope);
          }
        });
      }
      // The forced reload has been removed. By simply unregistering the old worker,
      // the browser will bypass its cache for this page load and fetch fresh assets
      // from the network, which solves the "stuck" cache problem without causing
      // a race condition. The new, correct service worker will be installed by
      // index.tsx and will take over on the next page load.
    }).catch(function(err) {
      console.error('Service Worker unregistration check failed: ', err);
    });
  }
})();
