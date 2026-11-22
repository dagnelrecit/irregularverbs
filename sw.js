/* Service worker : permet d'utiliser l'application hors-ligne.
   Change VERSION après chaque mise à jour du site pour forcer le rafraîchissement. */
const VERSION = 'iv-v6';
const FICHIERS = [
  './', './index.html', './enseignant.html', './manifest.webmanifest',
  './css/styles.css', './js/config.js', './js/verbes-defaut.js', './js/phrases-defaut.js', './js/commun.js', './js/app.js', './js/enseignant.js',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (pour avoir la dernière version), cache si hors-ligne.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Google Apps Script : jamais en cache
  e.respondWith(
    fetch(e.request)
      .then((rep) => { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); return rep; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
