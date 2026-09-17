// Barre des capacites : temps de recharge exact, largeur fixe du texte, texte dans l'ecran,
// icones rondes. Capture en gros plan pour controle visuel.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    const now = Date.now();
    const st = { ...state, langChosen: true, tutorialSeen: true, prestigeCount: 3, totalAscensions: 3, lastDailyLoginDate: todayStr(), verdure: 1e22 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = { stagiaire: 30 };
    st.uniqueBuildings = { siffletMare: true, grelotVent: true, tamtamCrapauds: true, chronoMare: true };
    st.automation = { ...st.automation, abilities: false };
    // Temps choisis pour s'afficher apres le chargement : ~14 min 30 sec, ~1 min 2 sec, ~30 sec.
    st.activeCooldowns = { grelotVent: now + (14 * 60 + 36) * 1000, tamtamCrapauds: now + 68 * 1000, chronoMare: now + 36 * 1000 };
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(2500);
  const mesure = () => p.evaluate(() => [...document.querySelectorAll('#abilityBar .abilityBtn')].map(el => {
    const t = el.querySelector('.abilityTime'), r = t.getBoundingClientRect(), vp = document.getElementById('gameViewport').getBoundingClientRect();
    const img = el.querySelector('img'), cs = img ? getComputedStyle(img) : null;
    return { id: el.dataset.rowId, texte: t.textContent, largeur: Math.round(r.width * 10) / 10, gauche: Math.round(r.left - vp.left), clip: cs ? cs.clipPath : null };
  }));
  const m1 = await mesure();
  console.log(JSON.stringify(m1, null, 1));
  const grelot = m1.find(x => x.id === 'grelotVent'), tamtam = m1.find(x => x.id === 'tamtamCrapauds'), chrono = m1.find(x => x.id === 'chronoMare');
  verifie(/^14 min [23]\d sec$/.test(grelot.texte), 'temps exact attendu (14 min xx sec) :', grelot.texte);
  verifie(/^1 min [0-5]?\d sec$/.test(tamtam.texte), 'temps exact attendu (1 min x sec) :', tamtam.texte);
  verifie(/^[23]\d sec$/.test(chrono.texte), 'temps en secondes attendu :', chrono.texte);
  verifie(!/\b0\d/.test(grelot.texte + tamtam.texte + chrono.texte), 'aucun zero devant un nombre');
  verifie(grelot.largeur === tamtam.largeur, 'meme largeur attendue pour « 14 min xx sec » et « 1 min x sec » :', grelot.largeur, tamtam.largeur);
  verifie(m1.every(x => x.gauche >= 0), 'un texte de recharge sort de l ecran a gauche');
  verifie(m1.every(x => x.clip && x.clip.startsWith('circle')), 'icone non decoupee en rond');
  // La largeur ne bouge pas pendant le decompte.
  await p.waitForTimeout(3000);
  const m2 = await mesure();
  verifie(m2.find(x => x.id === 'grelotVent').largeur === grelot.largeur, 'la largeur du texte change pendant le decompte');
  const bar = await p.evaluate(() => { const x = document.getElementById('abilityBar').getBoundingClientRect(); return { y: x.top, h: x.height }; });
  await p.screenshot({ path: __dirname + '/captures/capacites-rondes.png', clip: { x: 0, y: bar.y - 20, width: 200, height: bar.h + 60 } });
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
