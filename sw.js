// Minimal Service Worker for PWA Installation
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Canlı akışların bozulmaması için istekleri doğrudan internete yönlendirir
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
