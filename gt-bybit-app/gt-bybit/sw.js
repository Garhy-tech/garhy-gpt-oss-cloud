const CACHE = 'gt-bybit-shell-v4';
const SHELL = [
  '/gt-bybit/',
  '/gt-bybit/index.html',
  '/gt-bybit/app.css',
  '/gt-bybit/app.js',
  '/gt-bybit/p2p.html',
  '/gt-bybit/p2p-console.css',
  '/gt-bybit/p2p-console.js',
  '/gt-bybit/manifest.webmanifest',
  '/assets/gt-bybit/icon-180.png',
  '/assets/gt-bybit/icon-192.png',
  '/assets/gt-bybit/icon-512.webp',
  '/assets/gt-bybit/gt-profile.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
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

  // Financial/account API traffic is always network-only and never cached.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/assets/gt-bybit/icon-512.png') {
    event.respondWith(
      caches.match('/assets/gt-bybit/gt-profile.jpg')
        .then((cached) => cached || fetch('/assets/gt-bybit/gt-profile.jpg'))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match(url.pathname === '/gt-bybit/p2p.html' ? '/gt-bybit/p2p.html' : '/gt-bybit/index.html'))
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
