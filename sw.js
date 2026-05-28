const CACHE_NAME = "triumph-laundry-guide-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/tokens.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/sections.css",
  "./css/landing.css",
  "./css/intro.css",
  "./css/hero.css",
  "./css/footer.css",
  "./css/nav.css",
  "./css/darkmode.css",
  "./css/programs.css",
  "./css/landing_hub.css",
  "./css/tips.css",
  "./css/schedule.css",
  "./css/print.css",
  "./js/search.js",
  "./js/print.js",
  "./js/bubbles.js",
  "./js/schedule.js",
  "./js/app.js",
  "./js/intro.js",
  "./js/navigation.js",
  "./js/report.js",
  "./js/renderer.js",
  "./js/services/ChemicalService.js",
  "./js/services/ProgramService.js",
  "./data/chemicals.json",
  "./data/programs.json",
  "./logo.png",
  "./manifest.webmanifest",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800;900&family=Outfit:wght@400;700;800;900&display=swap"
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
