const CACHE_NAME = 'familia-cache-v1';
const urlsToCache = [
  './',
  './index.html'
];

// 1. Install the Service Worker and save the files to the phone
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Intercept network requests and serve the saved files if offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the cached version if we have it, otherwise fetch from the internet
        return response || fetch(event.request);
      })
  );
});
