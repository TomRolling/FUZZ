// Confort : reduction des animations (automatique ou choisie) et taille de l'affichage.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

async function ouvrir(b, options = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, ...options });
  const p = await ctx.newPage();
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1e6 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(600);
  return p;
}

(async () => {
  const b = await chromium.launch();

  // 1. Par defaut : le systeme ne demande rien, donc animations completes.
  const p = await ouvrir(b);
  const depart = await p.evaluate(() => ({
    classe: document.body.classList.contains('moinsAnimations'),
    reglage: state.reduireAnimations,
    zoom: state.zoomUI,
  }));
  verifie(!depart.classe, 'animations reduites alors que rien ne le demande');
  verifie(depart.reglage === null, 'reglage d animations inattendu :', depart.reglage);

  // 2. Le bouton fait tourner les trois etats, et l'affichage suit.
  const etats = [];
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => { openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll(); });
    await p.click('#animToggleBtn');
    etats.push(await p.evaluate(() => ({
      reglage: state.reduireAnimations,
      classe: document.body.classList.contains('moinsAnimations'),
      label: document.getElementById('animStateLabel').textContent,
    })));
  }
  verifie(etats[0].reglage === true && etats[0].classe, '1er clic : les animations ne sont pas reduites');
  verifie(etats[1].reglage === false && !etats[1].classe, '2e clic : les animations restent reduites');
  verifie(etats[2].reglage === null, '3e clic : on ne revient pas au reglage du systeme');
  verifie(/Syst/i.test(etats[2].label), 'libelle du reglage systeme inattendu :', etats[2].label);

  // 3. Animations reduites : le decor de saison ne doit pas etre construit.
  const decor = await p.evaluate(() => {
    state.reduireAnimations = true; appliquerConfort();
    _evenementForce = 'noel'; renderAll();
    const avec = !!document.getElementById('eventDecor');
    state.reduireAnimations = false; appliquerConfort(); renderAll();
    const sans = !!document.getElementById('eventDecor');
    _evenementForce = null; state.reduireAnimations = null; appliquerConfort(); renderAll();
    return { avec, sans };
  });
  verifie(!decor.avec, 'le decor de saison s affiche malgre les animations reduites');
  verifie(decor.sans, 'le decor de saison ne revient pas quand les animations sont reactivees');

  // 4. Taille de l'affichage : tout grossit, et rien ne sort de l'ecran.
  const tailles = [];
  for (let i = 0; i < 3; i++) {
    tailles.push(await p.evaluate(() => {
      const vp = document.getElementById('gameViewport');
      const shop = document.getElementById('shopBtn').getBoundingClientRect();
      return { zoom: state.zoomUI, echelle: window._gameScale, largeurDessin: window._gameW,
               shopDansEcran: shop.right <= window.innerWidth + 1 && shop.bottom <= window.innerHeight + 1 && shop.left >= -1,
               hauteurReelle: vp.getBoundingClientRect().height };
    }));
    await p.evaluate(() => { openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll(); });
    await p.click('#zoomToggleBtn');
    await p.waitForTimeout(150);
  }
  verifie(tailles[1].echelle > tailles[0].echelle, 'la taille « Grande » n agrandit rien');
  verifie(tailles[2].echelle > tailles[1].echelle, 'la taille « Tres grande » n agrandit rien');
  verifie(tailles.every(t => t.shopDansEcran), 'le bouton du magasin sort de l ecran a un des zooms');
  // getBoundingClientRect rend deja la hauteur APRES mise a l'echelle : elle doit couvrir la fenetre.
  verifie(tailles.every(t => Math.abs(t.hauteurReelle - 820) < 3), 'la zone de dessin ne remplit plus la fenetre');
  await p.context().close();

  // 5. Systeme qui demande moins d'animations : c'est pris en compte tout seul.
  const p2 = await ouvrir(b, { reducedMotion: 'reduce' });
  const auto = await p2.evaluate(() => ({
    classe: document.body.classList.contains('moinsAnimations'),
    reglage: state.reduireAnimations,
    label: document.getElementById('animStateLabel') ? true : false,
  }));
  verifie(auto.classe, 'le reglage systeme « moins d animations » est ignore');
  verifie(auto.reglage === null, 'le reglage systeme a ete transforme en choix du joueur');
  await p2.context().close();

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
