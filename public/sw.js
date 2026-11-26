const CACHE_NAME = 'uberbuses-light-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always use Network-First so development and map tiles are never stuck on stale cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
