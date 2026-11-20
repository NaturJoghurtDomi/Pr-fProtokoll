const CACHE = "pruefprotokoll-v1";

const DATEIEN = [
  "./", "./index.html", "./style.css", "./app.js", "./ui.js",
  "./ui-erfassen.js", "./ui-protokoll.js", "./ui-statistik.js", "./ui-daten.js",
  "./store.js", "./stats.js", "./export.js", "./charts.js", "./datum.js", "./listen.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(treffer => treffer ?? fetch(e.request)));
});
