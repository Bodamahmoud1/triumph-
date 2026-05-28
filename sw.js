importScripts('./sw-app-shell.js');

const CACHE_NAME = 'triumph-laundry-guide-v7';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function networkFirst(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504, statusText: 'Offline' })));
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
      }
      return networkResponse;
    }).catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    return cached || fetchPromise;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const reqUrl = new URL(request.url);

  if (reqUrl.pathname === '/api/schedule') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (reqUrl.pathname.includes('/api/') || reqUrl.pathname.includes('/data/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && reqUrl.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
