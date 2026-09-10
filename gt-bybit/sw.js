const CACHE = 'gt-bybit-shell-v4';
const SHELL = [
  '/gt-bybit/',
  '/gt-bybit/index.html',
  '/gt-bybit/manifest.webmanifest',
  '/assets/gt-bybit/icon-180.png',
  '/assets/gt-bybit/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('gt-bybit-shell-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/gt-bybit/index.html'))
    );
    return;
  }

  if (url.pathname === '/gt-bybit/app.css' || url.pathname === '/gt-bybit/app.js' || url.pathname.startsWith('/gt-bybit-app/gt-bybit/')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  if (url.pathname.startsWith('/gt-bybit/') || url.pathname.startsWith('/assets/gt-bybit/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
