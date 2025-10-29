// Legacy service worker shim that immediately unregisters itself and clears GMCT caches.
// Older deployments registered an offline cache that could serve stale assets and block
// new bundles from loading. By keeping this file in the repo (and therefore on GitHub Pages)
// the browser will fetch it during the service worker update check, run the logic below,
// and permanently remove the obsolete worker so the SPA can boot normally again.

self.addEventListener('install', event => {
  // Activate immediately so the cleanup can run without waiting for a reload.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith('gmct'))
          .map(key => caches.delete(key).catch(() => undefined)),
      );
    } catch (error) {
      // Ignore cache cleanup failures – the goal is just to unblock the app bootstrap.
      console.warn('GMCT legacy service worker could not clear caches', error);
    }

    try {
      await self.registration.unregister();
    } catch (error) {
      console.warn('GMCT legacy service worker failed to unregister', error);
    }
  })());
});

// Provide a no-op fetch handler so the runtime treats this as a valid worker scope while
// it unregisters. All network requests fall back to the browser by design.
self.addEventListener('fetch', () => {});
