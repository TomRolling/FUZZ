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
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Les scripts du jeu font partie de la coquille au meme titre que la page : sans eux,
    // index.html hors ligne n'affiche rien. On lit leur liste DANS index.html plutot que
    // de la tenir a la main ici : un fichier ajoute au jeu est mis en cache sans rien
    // toucher a ce service worker.
    let scripts = [];
    try {
      const rep = await fetch('./index.html');
      // La MEME reponse sert a remplir le cache et a lire la liste : deux requetes separees
      // pourraient tomber de part et d'autre d'un deploiement et melanger deux versions.
      await c.put('./index.html', rep.clone());
      scripts = [...(await rep.text()).matchAll(/<script src="([^"]+)"/g)].map(m => './' + m[1]);
    } catch (err) { /* hors ligne a l'install : les scripts entreront en cache a l'usage */ }
    // addAll echoue en entier si un seul fichier manque : on ajoute un par un, en une vague.
    await Promise.all([...COQUILLE, ...scripts].map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
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
