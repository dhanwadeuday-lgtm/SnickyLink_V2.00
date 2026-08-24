// Minimal service worker: enables PWA installability. No aggressive caching
// of API responses (data must always be fresh / private).
const CACHE_NAME = 'snickylink-v1';
const STATIC_ASSETS = ['/static/style.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache API/data
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
