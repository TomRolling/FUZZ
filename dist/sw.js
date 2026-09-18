// Service worker de la version web / PWA de FUZZ.
// L'app native (Tauri) ne passe jamais par ici : elle charge index.html depuis le disque.
//
// Deux regimes, parce que tout precharger couterait 6,7 Mo a la premiere visite :
//  - la coquille (page, manifeste, icones, polices, personnages) est mise en cache a l'install ;
//  - le reste (sprites, musiques) entre en cache au fur et a mesure qu'il sert.
// La page elle-meme part sur le reseau d'abord, sinon une nouvelle version mise en ligne ne
// serait jamais vue par quelqu'un qui a deja joue.

// Remplace au deploiement par le workflow Pages (voir .github/workflows/pages.yml) : un cache
// par version, pour que la mise en ligne suivante reparte proprement.
const VERSION = '__VERSION__';
const CACHE = `fuzz-${VERSION}`;

const COQUILLE = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.png',
  './assets/shop_button.png',
  './assets/bulle_gauche.png',
  './assets/bulle_droite.png',
];

self.addEventListener('install', (e) => {
  // addAll echoue en entier si un seul fichier manque : on ajoute un par un.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(COQUILLE.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // La page : reseau d'abord, cache en secours (hors ligne ou serveur injoignable).
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(fetch(req)
      .then(rep => { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(req, copie)); return rep; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }

  // Le reste : cache d'abord, et on garde ce qui arrive du reseau.
  e.respondWith(caches.match(req).then(cache => cache || fetch(req).then(rep => {
    if (rep.ok && rep.type === 'basic') { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(req, copie)); }
    return rep;
  })));
});
