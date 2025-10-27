// sw-uninstaller.js
// This script's sole purpose is to remove any and all service workers
// that might be 'stuck' controlling the page. This is a critical step
// to ensure that a fresh, non-cached version of the application is loaded.
// It runs before the main application script.

(function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      if (registrations.length === 0) {
        console.log('No service workers found to unregister.');
        return;
      }
      for (let registration of registrations) {
        registration.unregister().then(function(boolean) {
          if (boolean) {
            console.log('Successfully unregistered service worker for scope:', registration.scope);
          } else {
            console.log('Failed to unregister service worker for scope:', registration.scope);
          }
        });
      }
      // After unregistering, a hard reload is often necessary for the changes
      // to take full effect immediately. We can prompt the user or do it automatically.
      // For a seamless fix, we'll reload once.
      console.log('All service workers unregistered. Reloading the page to ensure a clean start.');
      // Using a flag in sessionStorage to prevent an infinite reload loop.
      if (!sessionStorage.getItem('sw_unregistered')) {
        sessionStorage.setItem('sw_unregistered', 'true');
        window.location.reload();
      }
    }).catch(function(err) {
      console.error('Service Worker unregistration failed: ', err);
    });
  }
})();
