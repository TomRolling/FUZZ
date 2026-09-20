// 1) Quand Papi a fini de parler, les autres mini-onglets redeviennent cliquables SANS avoir
//    a fermer la fenetre.
// 2) Rouvrir une fenetre / changer d'onglet repart du haut de la liste.
// 3) L'animation d'apparition se joue quand la rangee devient VISIBLE (le magasin est ferme
//    au moment ou Papi revele l'onglet : l'animation doit etre differee, pas jouee dans le vide).
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

async function boot(browser, tuto) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate((t) => { state.langChosen = true; if (!t) state.tutorialSeen = true; saveGame(); }, tuto);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(400);
  return page;
}

(async () => {
  const browser = await chromium.launch();

  // ---- 1. degrisage a la fin de l'explication ----
  console.log('=== 1. mini-onglets degrises quand Papi a fini ===');
  {
    const page = await boot(browser, true);
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => document.getElementById('tutorialOverlay').style.display === 'flex')) break;
      await page.evaluate(() => document.getElementById('sceneOverlay').click());
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());
    await page.waitForTimeout(1500);
    // Deux onglets deja reveles : sans un second mini-onglet, il n'y a rien a griser.
    await page.evaluate(() => { state.totalClicks = 200; state.tabsSeen.clic = true; renderTabsRow(); });
    for (let s = 0; s < 25; s++) {
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display === 'block')) break;
    }
    await page.evaluate(() => document.getElementById('shopBtn').click());
    await page.waitForTimeout(900);
    // Le magasin compte deja plusieurs mini-onglets : Papi DESIGNE celui dont il va parler
    // (doigt + halo) et attend le clic. Il ne se met a parler qu'apres.
    const designe = await page.evaluate(() => ({
      doigt: getComputedStyle(document.getElementById('tutorialSpotlightArrow')).display !== 'none',
      halo: [...document.querySelectorAll('#shopTabsRow .drawerBtn.featureHighlight')].map(b => b.dataset.tabId),
    }));
    console.log('  onglet designe :', JSON.stringify(designe));
    if (!designe.doigt) fail('aucun doigt : le joueur doit deviner quel onglet Papi presente');
    if (designe.halo.length !== 1) fail('halo attendu sur exactement un mini-onglet, vu', designe.halo);
    if (designe.halo[0]) await page.evaluate(id => document.querySelector(`[data-tab-id="${id}"]`).click(), designe.halo[0]);
    await page.waitForTimeout(700);
    const pendant = await page.evaluate(() => ({
      parle: document.getElementById('dialogueOverlay').classList.contains('visible'),
      grises: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].filter(b => b.disabled).map(b => b.dataset.tabId),
    }));
    console.log('  pendant l explication :', JSON.stringify(pendant));
    if (!pendant.parle) fail('Papi ne parle pas, le test ne prouve rien');
    if (pendant.grises.length === 0) fail('aucun onglet grise pendant l explication (le verrou ne marche plus)');

    // Papi presente les 4 onglets de Parametres a la suite : on va au bout du parcours guide,
    // c'est SEULEMENT une fois tout termine que plus rien ne doit etre grise.
    for (let step = 0; step < 12; step++) {
      for (let i = 0; i < 40; i++) {
        if (!await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'))) break;
        const avant = await page.evaluate(() => document.getElementById('dialogueText').textContent);
        await page.evaluate(() => document.getElementById('dialogueBox').click());
        await page.waitForTimeout(320);
        const apres = await page.evaluate(() => ({ v: document.getElementById('dialogueOverlay').classList.contains('visible'), t: document.getElementById('dialogueText').textContent }));
        if (apres.v && apres.t === avant) break;
      }
      const hl = await page.evaluate(() => { const b = document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'); return b ? b.dataset.tabId : null; });
      if (!hl) break;
      await page.evaluate((id) => document.querySelector(`[data-tab-id="${id}"]`).click(), hl);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({
      parle: document.getElementById('dialogueOverlay').classList.contains('visible'),
      ouvert: document.getElementById('shopPageOverlay').classList.contains('open'),
      grises: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].filter(b => b.disabled).map(b => b.dataset.tabId),
      total: document.querySelectorAll('#shopTabsRow .drawerBtn').length,
    }));
    console.log('  apres l explication   :', JSON.stringify(apres));
    if (apres.parle) fail('Papi parle encore, le test ne prouve rien');
    if (!apres.ouvert) fail('la fenetre s est fermee toute seule');
    if (apres.grises.length) fail('onglets encore grises alors que Papi a fini :', apres.grises);
    await page.close();
  }

  // ---- 2. defilement remis en haut ----
  console.log('=== 2. defilement remis en haut ===');
  {
    const page = await boot(browser, false);
    const r = await page.evaluate(() => {
      state.tabsSeen = { production: true, journal: true, stats: true, galerie: true, options: true };
      // Journal bien rempli : sans contenu long, la zone ne defile pas et le test ne teste rien.
      state.eventLog = Array.from({ length: 30 }, (_, i) => ({ t: Date.now() - i * 60000, msg: 'Evenement de test numero ' + i + ' avec un texte suffisamment long pour remplir la fenetre.' }));
      activeSettingsTab = 'journal';
      renderAll();
      openModal('settingsModalOverlay');
      const pane = document.querySelector('#settingsModalOverlay .sideModalContent');
      pane.scrollTop = 99999;
      const apresScroll = pane.scrollTop;
      closeModal('settingsModalOverlay');
      openModal('settingsModalOverlay');
      const apresReouverture = pane.scrollTop;
      pane.scrollTop = 99999;
      const avantChangement = pane.scrollTop;
      const t = TAB_DEFS.find(x => x.id === 'stats');
      miniTabClick(t, (id) => { activeSettingsTab = id; });
      return { apresScroll, apresReouverture, avantChangement, apresChangement: pane.scrollTop };
    });
    console.log('  ', JSON.stringify(r));
    if (r.apresScroll === 0) fail('la zone ne defile pas, le test ne prouve rien');
    if (r.apresReouverture !== 0) fail('la reouverture garde la position de defilement:', r.apresReouverture);
    if (r.avantChangement !== 0 && r.apresChangement !== 0) fail('changer d onglet garde la position:', r.apresChangement);
    await page.close();
  }

  // ---- 3. animation differee jusqu'a l'ouverture du magasin ----
  console.log('=== 3. animation a l ouverture du magasin ===');
  {
    const page = await boot(browser, false);
    const r = await page.evaluate(async () => {
      state.totalClicks = 200; state.tabsSeen = { options: true, stats: true, production: true, clic: true };
      state.verdure = 0; renderAll();
      // On laisse le JEU detecter le deblocage (c'est lui qui arme l'animation), magasin FERME.
      state.verdure = seuilOnglet('batiments');
      renderTabsRow();
      await new Promise(r => setTimeout(r, 400));
      const rangeeCachee = document.getElementById('shopTabsRow').offsetParent === null;
      const anime = [...document.querySelectorAll('#shopTabsRow .drawerBtn.tabAppear')].length;
      // maintenant on ouvre : c'est LA que l'animation doit partir
      openModal('shopPageOverlay'); renderAll();
      const vu = [...document.querySelectorAll('#shopTabsRow .drawerBtn.tabAppear')].map(b => b.dataset.tabId);
      return { rangeeCachee, animeAvantOuverture: anime, animeApresOuverture: vu };
    });
    console.log('  ', JSON.stringify(r));
    if (!r.rangeeCachee) fail('la rangee n etait pas cachee, le test ne prouve rien');
    if (r.animeAvantOuverture !== 0) fail('animation jouee alors que la rangee etait cachee');
    if (!r.animeApresOuverture.includes('batiments')) fail('pas d animation a l ouverture du magasin:', r.animeApresOuverture);
    await page.close();
  }

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
