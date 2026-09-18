// Version web / PWA : le jeu doit demarrer servi en http, enregistrer son service worker,
// et rester jouable apres un rechargement hors ligne (c'est tout l'interet du cache).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const racine = path.resolve(__dirname, '../dist');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

(async () => {
  const serveur = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(racine, p);
    if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  // « localhost » et pas 127.0.0.1 : le jeu n'enregistre son service worker que sur localhost
  // ou en https (voir la fin de dist/index.html).
  const base = `http://localhost:${serveur.address().port}/`;
  console.log('  servi sur', base);

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 } });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erreurs.push('console: ' + m.text()); });

  await p.goto(base);
  await p.evaluate(() => {
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 5000 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });

  // Le jeu tourne-t-il vraiment ? (un clic doit rapporter de la Verdure)
  const gagne = await p.evaluate(async () => {
    const avant = state.verdure;
    document.getElementById('clickZone').click();
    return state.verdure > avant;
  });
  verifie(gagne, 'le clic ne rapporte rien');

  // La carte de mise a jour de l'app native doit rester invisible sur le web.
  const carteMaj = await p.evaluate(() => { const c = document.getElementById('updateCard'); return c ? getComputedStyle(c).display : 'absent'; });
  verifie(carteMaj === 'none' || carteMaj === 'absent', 'la carte « Mises a jour » s affiche sur le web :', carteMaj);

  // Service worker : enregistre, puis aux commandes apres un rechargement.
  const enregistre = await p.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  verifie(enregistre, 'le service worker ne s enregistre pas');
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  const controle = await p.evaluate(() => !!navigator.serviceWorker.controller);
  verifie(controle, 'le service worker ne controle pas la page apres rechargement');

  // Hors ligne : la page doit repartir depuis le cache.
  await ctx.setOffline(true);
  let horsLigne = true;
  try {
    await p.reload();
    await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  } catch (e) { horsLigne = false; }
  verifie(horsLigne, 'le jeu ne se recharge pas hors ligne');
  await ctx.setOffline(false);

  if (erreurs.length) fail('erreurs de page :', erreurs.slice(0, 5).join(' | '));
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close(); serveur.close();
  process.exitCode = problems ? 1 : 0;
})();
