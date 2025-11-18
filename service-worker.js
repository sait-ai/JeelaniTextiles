// service-worker.js - Jeelani Textiles
// Enhanced service worker with versioning, offline fallback, and cache warmup.
// [CHANGE LOG]:
// - Added versioning with cache invalidation.
// - Implemented stale-while-revalidate strategy.
// - Updated offline fallback to offline.html.
// - Included skipWaiting and clientsClaim.
// - Added cache warmup on message.
// [AFFECTED COMPONENTS]: All cached assets, offline.html.
// [ROLLBACK]: Revert to basic cache logic.

const CACHE_NAME = 'jeelani-textiles-v1.0.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/assets/images/hero-bg.webp',
  '/js/firebase.js',
  '/js/init.js',
  '/js/script.js',
  '/pages/products.html', // Added for offline access
  '/offline.html'         // Added for offline fallback
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html') || caches.match('/404.html');
        }
        return new Response('Offline', { status: 503 });
      });

      return cachedResponse || fetchPromise; // Stale-while-revalidate
    })
  );
});

// Magical Touch: Cache Warmup
self.addEventListener('message', event => {
  if (event.data === 'warm-cache') {
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache));
  }
});