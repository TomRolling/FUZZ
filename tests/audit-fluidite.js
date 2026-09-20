// Audit de fluidite (pas un test : un releve). Pour chaque fenetre du jeu : s'anime-t-elle a
// l'ouverture et a la fermeture, combien d'images depassent 20 ms pendant la transition, et
// quelques points de confort (Echap, empilement des notifications, defilement des onglets).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => console.log('  pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4e12, knowledge: 1850, cosmicSeeds: 24, totalSeedsEarned: 60, prestigeCount: 7, totalAscensions: 2,
      stellarShards: 3, totalClicks: 5000, totalPlayTimeSec: 96 * 3600 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 16).map((x, i) => [x.id, 100 - i * 5]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => hideDialogue(false));

  // Enregistreur d'images : ecart entre deux requestAnimationFrame.
  await p.evaluate(() => {
    window.__images = [];
    let dernier = performance.now();
    const boucle = (t) => { window.__images.push(t - dernier); dernier = t; requestAnimationFrame(boucle); };
    requestAnimationFrame(boucle);
  });
  const mesurer = async (action, dureeMs = 700) => p.evaluate(async ([src, duree]) => {
    window.__images = [];
    const t0 = performance.now();
    eval('(' + src + ')()');
    const synchro = performance.now() - t0;
    await new Promise(r => setTimeout(r, duree));
    const imgs = window.__images.slice(1);
    return { synchroMs: Math.round(synchro), images: imgs.length, lentes: imgs.filter(x => x > 20).length, pire: Math.round(Math.max(0, ...imgs)) };
  }, [action.toString(), dureeMs]);

  // Une fenetre s'anime-t-elle ? On regarde les animations CSS en cours juste apres l'appel.
  const animee = (id) => p.evaluate((id) => {
    const el = document.getElementById(id);
    const tous = [el, ...el.querySelectorAll('*')].slice(0, 400);
    return tous.some(e => e.getAnimations().some(a => a.playState === 'running'))
      || (getComputedStyle(el).transitionDuration !== '0s' && getComputedStyle(el).transitionProperty !== 'none');
  }, id);

  console.log('=== Fenetres : animation et images lentes ===');
  const FENETRES = [
    ['Magasin', 'shopPageOverlay', () => openModal('shopPageOverlay'), () => closeModal('shopPageOverlay')],
    ['Parametres', 'settingsModalOverlay', () => openModal('settingsModalOverlay'), () => closeModal('settingsModalOverlay')],
    ['Succes', 'achievementsModalOverlay', () => openModal('achievementsModalOverlay'), () => closeModal('achievementsModalOverlay')],
    ['Quetes', 'questsModalOverlay', () => openModal('questsModalOverlay'), () => closeModal('questsModalOverlay')],
    ['Nouvel objet', 'itemPopupOverlay', () => showItemPopup({ title: 'x', name: 'x', desc: 'x' }), () => fermerSurgissante('itemPopupOverlay')],
    ['Bonus du jour', 'dailyPopupOverlay', () => showDailyLoginPopup(2, dailyRewardForDay(2)), () => fermerSurgissante('dailyPopupOverlay')],
    ['Absence', 'offlineOverlay', () => { document.getElementById('offlineOverlay').style.display = 'flex'; }, () => fermerSurgissante('offlineOverlay')],
  ];
  for (const [nom, id, ouvrir, fermer] of FENETRES) {
    const o = await mesurer(ouvrir);
    const aOuv = await p.evaluate((id) => { const el = document.getElementById(id); return [el, ...el.querySelectorAll('*')].slice(0, 400).some(e => e.getAnimations().length > 0); }, id);
    await p.waitForTimeout(300);
    const f = await mesurer(fermer);
    const aFerm = await p.evaluate((id) => { const el = document.getElementById(id); return [el, ...el.querySelectorAll('*')].slice(0, 400).some(e => e.getAnimations().some(a => a.playState === 'running')); }, id);
    console.log(`  ${nom.padEnd(14)} ouverture : ${String(o.synchroMs).padStart(3)} ms de calcul, ${o.lentes} image(s) >20 ms (pire ${o.pire} ms), anime=${aOuv ? 'oui' : 'NON'}` +
      ` | fermeture : ${f.lentes} image(s) lente(s), anime=${aFerm ? 'oui' : 'non'}`);
    await p.waitForTimeout(400);
  }

  console.log('\n=== Onglets du magasin : changement ===');
  await p.evaluate(() => openModal('shopPageOverlay'));
  await p.waitForTimeout(600);
  for (const onglet of ['production', 'clic', 'batiments', 'recherche', 'prestige', 'ascension']) {
    const m = await mesurer(`() => { activeShopTab = '${onglet}'; renderAll(); }`, 400);
    console.log(`  -> ${onglet.padEnd(12)} ${String(m.synchroMs).padStart(3)} ms de calcul, ${m.lentes} image(s) lente(s)`);
  }
  // Defilement : garde-t-on sa position en revenant sur un onglet ?
  const defil = await p.evaluate(async () => {
    activeShopTab = 'production'; renderAll();
    const zone = document.querySelector('.shopPageContent');
    zone.scrollTop = 600;
    await new Promise(r => setTimeout(r, 100));
    const avant = zone.scrollTop;
    activeShopTab = 'clic'; renderAll();
    await new Promise(r => setTimeout(r, 100));
    activeShopTab = 'production'; renderAll();
    await new Promise(r => setTimeout(r, 100));
    return { avant, apres: zone.scrollTop };
  });
  console.log(`  defilement de Production : ${defil.avant}px avant de changer d'onglet, ${defil.apres}px au retour`);
  await p.evaluate(() => closeModal('shopPageOverlay'));
  await p.waitForTimeout(500);

  console.log('\n=== Confort ===');
  for (const [nom, id] of [['Magasin', 'shopPageOverlay'], ['Parametres', 'settingsModalOverlay'], ['Nouvel objet', 'itemPopupOverlay']]) {
    await p.evaluate((id) => { if (id === 'itemPopupOverlay') showItemPopup({ title: 'x', name: 'x', desc: 'x' }); else openModal(id); }, id);
    await p.waitForTimeout(500);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
    const ferme = await p.evaluate((id) => { const el = document.getElementById(id); return getComputedStyle(el).display === 'none' || !isOverlayOpen(id); }, id);
    console.log(`  Echap ferme ${nom.padEnd(13)} : ${ferme ? 'oui' : 'NON'}`);
    await p.evaluate((id) => { if (isOverlayOpen(id)) closeModal(id); else fermerSurgissante(id); }, id);
    await p.waitForTimeout(300);
  }
  const toasts = await p.evaluate(async () => {
    for (let i = 0; i < 25; i++) showToast('Notification ' + i);
    await new Promise(r => setTimeout(r, 100));
    const els = [...document.querySelectorAll('.toast')];
    const hauteurPile = els.length ? Math.round(els[0].getBoundingClientRect().top) : null;
    return { visibles: els.length, hautDeLaPile: hauteurPile };
  });
  console.log(`  25 notifications d'un coup : ${toasts.visibles} affichees en meme temps, la plus haute a ${toasts.hautDeLaPile}px du haut`);

  await b.close();
})();
