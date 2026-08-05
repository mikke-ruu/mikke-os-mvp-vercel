self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network-first passthrough for the initial release.
  // We intentionally avoid caching app data so guest/local records and auth flows stay predictable.
});
