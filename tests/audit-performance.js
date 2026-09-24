// Audit de performances (releve, pas un test) : combien coute reellement une image de jeu ?
// On mesure sur une partie de fin de jeu, la plus lourde possible, parce que c'est la que le
// joueur passe ses dernieres heures et que tout ralentissement se voit.
//   - duree d'un renderAll par onglet (le chemin chaud : jusqu'a 60 fois par seconde) ;
//   - duree du tick de jeu (une fois par seconde, il touche a tout) ;
//   - cout d'un clic (le geste le plus repete du jeu) ;
//   - images perdues pendant une rafale de clics et pendant le defilement d'une longue liste ;
//   - poids du DOM.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

const moyenne = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const centile = (a, p) => { const t = [...a].sort((x, y) => x - y); return t[Math.min(t.length - 1, Math.floor(t.length * p))]; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => console.log('  pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 1e30, totalEarned: 1e30, knowledge: 1e6, cosmicSeeds: 5000, totalSeedsEarned: 1e5,
      prestigeCount: 40, totalAscensions: 12, stellarShards: 300, totalClicks: 5e5, totalPlayTimeSec: 2e6 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    // Partie de fin : tout achete, toutes les recherches, tous les familiers.
    st.buildings = Object.fromEntries(BUILDINGS.map(x => [x.id, 300]));
    st.clickUpgrades = Object.fromEntries(CLICK_UPGRADES.map(x => [x.id, true]));
    st.uniqueBuildings = Object.fromEntries(UNIQUE_BUILDINGS.map(x => [x.id, true]));
    st.companionBuildings = Object.fromEntries(COMPANION_BUILDINGS.map(x => [x.id, true]));
    st.research = Object.fromEntries(RESEARCH.map(x => [x.id, true]));
    st.itemPopupsShown = Object.fromEntries([...BUILDINGS, ...CLICK_UPGRADES, ...UNIQUE_BUILDINGS, ...COMPANION_BUILDINGS].map(x => [x.id, true]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => hideDialogue(false));

  console.log('=== 1. duree d un rendu complet (renderAll), partie de fin de jeu ===');
  console.log('  contexte                 median   90e centile   pire');
  const mesureRendu = async (nom, prep) => {
    const r = await p.evaluate(async (src) => {
      eval('(' + src + ')()');
      renderAll(); await new Promise(r => requestAnimationFrame(r));
      const t = [];
      for (let i = 0; i < 60; i++) { const d = performance.now(); renderAll(); t.push(performance.now() - d); }
      return t;
    }, prep.toString());
    console.log(`  ${nom.padEnd(24)} ${centile(r, 0.5).toFixed(2)}ms   ${centile(r, 0.9).toFixed(2)}ms      ${Math.max(...r).toFixed(2)}ms`);
    return r;
  };
  await mesureRendu('tous menus fermes', () => { for (const id of Object.values(GROUP_TO_OVERLAY)) if (isOverlayOpen(id)) closeModal(id); });
  for (const o of ['production', 'clic', 'recherche', 'ascension']) {
    await mesureRendu('magasin / ' + o, new Function(`if (!isOverlayOpen('shopPageOverlay')) openModal('shopPageOverlay'); activeShopTab = '${o}';`));
  }
  await mesureRendu('succes ouverts', () => { for (const id of Object.values(GROUP_TO_OVERLAY)) if (isOverlayOpen(id)) closeModal(id); openModal('achievementsModalOverlay'); });

  console.log('=== 2. duree du tick de jeu (une fois par seconde) ===');
  const tick = await p.evaluate(async () => {
    for (const id of Object.values(GROUP_TO_OVERLAY)) if (isOverlayOpen(id)) closeModal(id);
    const t = [];
    for (let i = 0; i < 40; i++) { const d = performance.now(); tickJeu(); t.push(performance.now() - d); await new Promise(r => setTimeout(r, 5)); }
    return t;
  });
  console.log(`  median ${centile(tick, 0.5).toFixed(2)}ms | 90e ${centile(tick, 0.9).toFixed(2)}ms | pire ${Math.max(...tick).toFixed(2)}ms`);

  console.log('=== 3. cout d un clic ===');
  const clic = await p.evaluate(async () => {
    const zone = document.getElementById('clickZone');
    const t = [];
    for (let i = 0; i < 80; i++) { const d = performance.now(); zone.click(); t.push(performance.now() - d); }
    return t;
  });
  console.log(`  median ${centile(clic, 0.5).toFixed(2)}ms | 90e ${centile(clic, 0.9).toFixed(2)}ms | pire ${Math.max(...clic).toFixed(2)}ms`);

  console.log('=== 4. images perdues pendant une rafale de 100 clics ===');
  const rafale = await p.evaluate(async () => {
    const images = [];
    let dernier = performance.now(), stop = false;
    const boucle = () => { const m = performance.now(); images.push(m - dernier); dernier = m; if (!stop) requestAnimationFrame(boucle); };
    requestAnimationFrame(boucle);
    const zone = document.getElementById('clickZone');
    for (let i = 0; i < 100; i++) { zone.click(); await new Promise(r => setTimeout(r, 16)); }
    stop = true;
    return images.slice(2);
  });
  const lentes = rafale.filter(x => x > 20).length;
  console.log(`  ${rafale.length} images, ${lentes} au-dessus de 20ms, pire ${Math.max(...rafale).toFixed(1)}ms, median ${centile(rafale, 0.5).toFixed(1)}ms`);

  console.log('=== 5. defilement d une longue liste (Recherche, 39 objets) ===');
  const defil = await p.evaluate(async () => {
    if (!isOverlayOpen('shopPageOverlay')) openModal('shopPageOverlay');
    activeShopTab = 'recherche'; renderAll();
    await new Promise(r => setTimeout(r, 200));
    const zone = document.querySelector('.shopPageContent');
    const images = []; let dernier = performance.now(), stop = false;
    const boucle = () => { const m = performance.now(); images.push(m - dernier); dernier = m; if (!stop) requestAnimationFrame(boucle); };
    requestAnimationFrame(boucle);
    for (let i = 0; i < 40; i++) { zone.scrollTop += 60; await new Promise(r => requestAnimationFrame(r)); }
    stop = true;
    return images.slice(2);
  });
  console.log(`  ${defil.length} images, ${defil.filter(x => x > 20).length} au-dessus de 20ms, pire ${Math.max(...defil).toFixed(1)}ms`);

  console.log('=== 6. poids du DOM ===');
  const dom = await p.evaluate(() => {
    const compte = (sel) => document.querySelectorAll(sel).length;
    return { total: document.querySelectorAll('*').length, cartes: compte('.upgrade'), succes: compte('.achv'),
             ecouteurs: 'voir audit-session-longue', html: document.documentElement.innerHTML.length };
  });
  console.log(`  ${dom.total} elements au total, ${dom.cartes} cartes d objets, ${dom.succes} succes, ${Math.round(dom.html / 1024)} Ko de HTML vivant`);
  await b.close();
})();
