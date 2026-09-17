// 1) La bulle de Papi reste dans son emplacement reserve pour TOUS les onglets du magasin
//    (le bug signale concernait Recherche, qui partait en haut a droite).
// 2) Les commentaires d'achat de Papi sortent au meme endroit.
// 3) L'herbe doree et les papillons ne passent plus au-dessus des menus.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true; state.totalClicks = 200;
    state.tabsSeen = { options: true, stats: true, production: true, clic: true,
                       batiments: true, special: true, recherche: true, prestige: true };
    state.verdure = 1e9; state.totalPlayTimeSec = 3600;
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1500);

  console.log('=== 1. bulle de Papi, onglet par onglet ===');
  await page.evaluate(() => { openModal('shopPageOverlay'); });
  await page.waitForTimeout(500);
  for (const tab of ['production', 'batiments', 'clic', 'special', 'recherche', 'prestige']) {
    const r = await page.evaluate((id) => {
      activeShopTab = id; renderAll();
      showDialogue('papi', ['Voila ce que fait cet onglet, en deux mots pour voir.'], { position: 'top-right' });
      const zone = highlightDescribedZone(id);
      followDialogueAnchor(zone || document.querySelector(`[data-tab-id="${id}"]`));
      const slot = document.getElementById('shopImagePlaceholder').getBoundingClientRect();
      const box = document.getElementById('dialogueBox').getBoundingClientRect();
      return {
        dans: box.left >= slot.left - 30 && box.right <= slot.right + 30
           && box.bottom <= slot.bottom + 30 && box.top >= slot.top - 30,
        box: { l: Math.round(box.left), t: Math.round(box.top) },
      };
    }, tab);
    console.log(' ', tab.padEnd(11), JSON.stringify(r));
    if (!r.dans) fail('bulle hors de l emplacement reserve sur l onglet', tab, JSON.stringify(r.box));
  }

  console.log('=== 2. commentaire d achat de Papi ===');
  const comm = await page.evaluate(() => {
    const ok = showShopComment('firstPurchase') || showShopComment('bigPurchase');
    const slot = document.getElementById('shopImagePlaceholder').getBoundingClientRect();
    const c = document.getElementById('shopComment').getBoundingClientRect();
    return {
      affiche: ok && getComputedStyle(document.getElementById('shopComment')).display !== 'none',
      dans: c.left >= slot.left - 5 && c.right <= slot.right + 5 && c.bottom <= slot.bottom + 5,
    };
  });
  console.log(' ', JSON.stringify(comm));
  if (!comm.affiche) fail('le commentaire de Papi ne s affiche pas');
  else if (!comm.dans) fail('le commentaire de Papi n est pas dans son emplacement reserve');

  console.log('=== 3. evenements aleatoires sous les menus ===');
  const evt = await page.evaluate(() => {
    spawnGoldenWeed();
    const herbe = document.querySelector('.golden');
    const shop = document.getElementById('shopPageOverlay');
    const dansViewport = document.getElementById('gameViewport').contains(herbe);
    // Qui est reellement au-dessus, au centre du magasin ouvert ?
    const dessus = document.elementFromPoint(640, 410);
    return {
      dansViewport,
      zHerbe: +getComputedStyle(herbe).zIndex,
      zMagasin: +getComputedStyle(shop).zIndex,
      elementAuDessus: dessus ? (dessus.id || dessus.className.split(' ')[0]) : null,
      herbeVisiblePardessus: dessus === herbe,
    };
  });
  console.log(' ', JSON.stringify(evt));
  if (!evt.dansViewport) fail('l herbe doree n est pas dans #gameViewport');
  if (!(evt.zHerbe < evt.zMagasin)) fail('z-index de l herbe >= celui du magasin :', evt.zHerbe, '>=', evt.zMagasin);
  if (evt.herbeVisiblePardessus) fail('l herbe doree passe au-dessus du menu ouvert');

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
