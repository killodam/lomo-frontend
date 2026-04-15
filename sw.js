const STATIC_CACHE = 'lomo-static-v4';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/config.js',
  '/manifest.webmanifest',
  OFFLINE_URL,
  '/styles/main.css',
  '/styles/core.css',
  '/styles/profile.css',
  '/styles/theme.css',
  '/styles/responsive.css',
  '/styles/chat.css',
  '/styles/landing.css',
  '/styles/feed.css',
  '/scripts/api.js',
  '/scripts/state.js',
  '/scripts/screens.js',
  '/scripts/auth.js',
  '/scripts/admin.js',
  '/scripts/public-profile.js',
  '/scripts/runtime.js',
  '/scripts/auth-ui.js',
  '/scripts/profile-runtime.js',
  '/scripts/ui-shell.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/app-icon.svg',
  '/icons/app-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
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
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', responseClone)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match(OFFLINE_URL)) || (await cache.match('/index.html'));
        })
    );
    return;
  }

  const preferFreshAsset = request.destination === 'script'
    || request.destination === 'style'
    || url.pathname === '/config.js'
    || url.pathname === '/manifest.webmanifest';

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone)).catch(() => {});
          return response;
        });

      if (preferFreshAsset) {
        return networkFetch.catch(() => cached || Response.error());
      }

      return cached || networkFetch.catch(() => Response.error());
    })
  );
});
