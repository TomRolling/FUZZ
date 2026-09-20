// Confort des fenetres : Echap ferme, les petites fenetres se referment en fondu, chaque onglet
// retient ou on en etait, les notifications ne debordent pas, et la premiere ouverture du
// magasin ne fait plus sauter d'image.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4e12, prestigeCount: 7, totalClicks: 5000, totalPlayTimeSec: 3e5 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 16).map((x, i) => [x.id, 100 - i * 5]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(4500); // laisse le temps mort preparer le magasin
  await p.evaluate(() => hideDialogue(false));

  // 1. Premiere ouverture du magasin : quasi immediate.
  const premiere = await p.evaluate(() => { const t0 = performance.now(); openModal('shopPageOverlay'); return performance.now() - t0; });
  console.log(`  premiere ouverture du magasin : ${Math.round(premiere)} ms`);
  verifie(premiere < 25, `premiere ouverture du magasin trop lente : ${Math.round(premiere)} ms`);
  await p.waitForTimeout(500);

  // 2. Chaque onglet retient sa position, la fenetre rouverte repart du haut.
  const defil = await p.evaluate(async () => {
    const zone = document.querySelector('.shopPageContent');
    const aller = (id) => miniTabClick(TAB_DEFS.find(t => t.id === id), (x) => { activeShopTab = x; });
    zone.scrollTop = 800; await new Promise(r => setTimeout(r, 100));
    aller('clic'); await new Promise(r => setTimeout(r, 200)); const surClic = zone.scrollTop;
    aller('production'); await new Promise(r => setTimeout(r, 200)); const retour = zone.scrollTop;
    closeModal('shopPageOverlay'); await new Promise(r => setTimeout(r, 500));
    openModal('shopPageOverlay'); await new Promise(r => setTimeout(r, 300)); const rouvert = zone.scrollTop;
    return { surClic, retour, rouvert };
  });
  console.log('  defilement :', JSON.stringify(defil));
  verifie(defil.surClic === 0, 'un onglet jamais ouvert ne demarre pas en haut');
  verifie(defil.retour >= 700, 'revenir sur un onglet ne retrouve pas sa position :', defil.retour);
  verifie(defil.rouvert === 0, 'une fenetre rouverte ne repart pas du haut');

  // 3. Echap ferme les grandes fenetres...
  for (const id of ['shopPageOverlay', 'settingsModalOverlay', 'questsModalOverlay', 'achievementsModalOverlay']) {
    await p.evaluate((id) => { if (!isOverlayOpen(id)) openModal(id); }, id);
    await p.waitForTimeout(450);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(450);
    verifie(await p.evaluate((id) => !isOverlayOpen(id), id), `Echap ne ferme pas ${id}`);
  }
  // ... et les petites, en fondu.
  for (const [id, ouvrir] of [
    ['itemPopupOverlay', () => showItemPopup({ title: 'x', name: 'x', desc: 'x' })],
    ['dailyPopupOverlay', () => showDailyLoginPopup(2, dailyRewardForDay(2))],
    ['offlineOverlay', () => { document.getElementById('offlineOverlay').style.display = 'flex'; }],
  ]) {
    await p.evaluate(ouvrir);
    await p.waitForTimeout(450);
    await p.keyboard.press('Escape');
    const pendant = await p.evaluate((id) => ({ affichee: getComputedStyle(document.getElementById(id)).display !== 'none',
      fondu: document.getElementById(id).classList.contains('fermetureSurgissante') }), id);
    await p.waitForTimeout(450);
    const apres = await p.evaluate((id) => getComputedStyle(document.getElementById(id)).display, id);
    verifie(pendant.affichee && pendant.fondu, `${id} ne se referme pas en fondu`);
    verifie(apres === 'none', `${id} ne se referme pas`);
  }

  // 4. Echap ne ferme rien pendant une presentation de Papi.
  const tuto = await p.evaluate(async () => {
    openModal('shopPageOverlay');
    _pendingSpotlightGroup = 'shop';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise(r => setTimeout(r, 300));
    const ouvert = isOverlayOpen('shopPageOverlay');
    _pendingSpotlightGroup = null; closeModal('shopPageOverlay');
    return ouvert;
  });
  verifie(tuto, 'Echap ferme une fenetre pendant une presentation de Papi');

  // 5. Une rafale de notifications ne deborde pas.
  const toasts = await p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < 25; i++) showToast('n' + i);
    const els = [...document.querySelectorAll('.toast')];
    return { nombre: els.length, max: TOASTS_MAX, dernier: els.length ? els[els.length - 1].textContent : '' };
  });
  console.log(`  25 notifications -> ${toasts.nombre} a l ecran, la plus recente « ${toasts.dernier} »`);
  verifie(toasts.nombre <= toasts.max, `${toasts.nombre} notifications a l ecran pour un plafond de ${toasts.max}`);
  verifie(toasts.dernier === 'n24', 'la notification la plus recente a ete retiree au lieu des anciennes');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
