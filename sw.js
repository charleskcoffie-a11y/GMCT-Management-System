// A version for the cache. You can update this to force a refresh of the cache.
const CACHE_NAME = 'gmct-app-cache-v1';

// List of all the essential files that make up the application shell.
const APP_SHELL_URLS = [
  './', // This caches index.html
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
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching app shell');
      // Use { cache: 'reload' } to bypass browser cache for these requests.
      const requests = APP_SHELL_URLS.map(url => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
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
    }).then(() => self.clients.claim()) // Claim clients immediately
  );
});

// The fetch event is fired for every network request the page makes.
self.addEventListener('fetch', event => {
  const { request } = event;

  // We only want to handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // For external API calls, always go to the network.
  if (url.hostname === 'graph.microsoft.com' || url.hostname.includes('login.microsoftonline.com')) {
    return; // Do not intercept, let the browser handle it.
  }

  // For all other requests (app files, CDN scripts), use a cache-first strategy.
  // This ensures the app loads fast and works offline.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // If we have a match in the cache, return it.
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Otherwise, go to the network.
      // We don't cache new responses here to stick to the original "pre-cache only" model.
      return fetch(request);
    })
  );
});