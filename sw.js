const CACHE_NAME = "triumph-laundry-guide-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./js/renderer.js",
  "./data/chemicals.json",
  "./data/programs.json",
  "./logo.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const reqUrl = new URL(request.url);

  // Stale-while-revalidate for API and JSON data
  if (reqUrl.pathname.includes('/api/') || reqUrl.pathname.includes('/data/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {
          return new Response("", { status: 504, statusText: "Offline" });
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && reqUrl.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => {
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return new Response("", { status: 504, statusText: "Offline" });
      });
    })
  );
});
