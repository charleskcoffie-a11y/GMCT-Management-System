// A version for the cache. You must update this to force a refresh of the cache.
const CACHE_NAME = 'gmct-app-cache-v3';

// List of all the essential files that make up the application shell.
// index.html is included here to be available offline. The fetch strategy below ensures it stays up-to-date.
const APP_SHELL_URLS = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  // External assets from CDN that are critical for the app to function
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/client',
  'https://aistudiocdn.com/uuid@^13.0.0',
  'https://alcdn.msauth.net/browser/2.37.0/js/msal-browser.min.js'
];

// The install event is fired when the service worker is first installed.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching app shell');
      // Use { cache: 'reload' } to bypass browser cache for these requests.
      const requests = APP_SHELL_URLS.map(url => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    }).then(() => {
      // Force the waiting service worker to become the active service worker.
      return self.skipWaiting();
    })
  );
});

// The activate event is fired when the service worker is activated.
// This is a good time to clean up old, unused caches.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tell the active service worker to take control of the page immediately.
      return self.clients.claim();
    })
  );
});


// The fetch event is fired for every network request the page makes.
self.addEventListener('fetch', event => {
  const { request } = event;

  // --- Caching Strategy ---

  // 1. Ignore non-GET requests and Microsoft authentication calls.
  if (request.method !== 'GET' || request.url.includes('login.microsoftonline')) {
    return;
  }

  // 2. For Microsoft Graph API calls, always go to the network. No caching.
  if (request.url.includes('graph.microsoft.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Network-first for HTML pages (navigation requests).
  // This is the most important part of the fix. It ensures the user always gets
  // the latest version of the app, preventing "stuck" states from a stale cache.
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the network request is successful, we update the cache with the new version.
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If the network fails (e.g., offline), we serve the page from the cache.
          return caches.match(request);
        })
    );
    return;
  }

  // 4. Cache-first for all other assets (JS, CSS, images, etc.).
  // This makes the app load instantly on subsequent visits and work offline.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // If we have a response in the cache, serve it immediately.
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache, fetch it from the network.
      return fetch(request).then(networkResponse => {
        // Also, cache the newly fetched resource for future use.
        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
            });
        }
        return networkResponse;
      });
    })
  );
});