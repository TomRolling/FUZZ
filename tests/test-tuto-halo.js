// Parcours reel du tutoriel : verifie que quand Papi DECRIT une zone, il y a un halo dore
// sur la zone et AUCUN doigt, que la bulle ne recouvre ni la zone ni le bord de l'ecran, et
// qu'un clic sur la bulle fait disparaitre bulle + halo.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

async function boot(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => { state.langChosen = true; saveGame(); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(400);
  // saute la scene d'ouverture jusqu'au panneau de tutoriel
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.getElementById('tutorialOverlay').style.display === 'flex')) break;
    await page.evaluate(() => document.getElementById('sceneOverlay').click());
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());
  // Le Magasin n'arrive plus juste apres l'intro : il demande 200 clics.
  await page.waitForTimeout(1500);
  await page.evaluate(() => { state.totalClicks = 200; renderTabsRow(); });
  return page;
}

// Etat visuel au moment ou Papi decrit quelque chose.
const SNAPSHOT = () => {
  const box = document.getElementById('dialogueBox');
  const vp = document.getElementById('gameViewport');
  const zone = document.querySelector('.tutorialZoneHighlight');
  const arrow = document.getElementById('tutorialSpotlightArrow');
  const b = box.getBoundingClientRect();
  const z = zone ? zone.getBoundingClientRect() : null;
  const overlap = z && !(b.right <= z.left || b.left >= z.right || b.bottom <= z.top || b.top >= z.bottom);
  return {
    dialogueVisible: document.getElementById('dialogueOverlay').classList.contains('visible'),
    texte: document.getElementById('dialogueText').textContent,
    zoneId: zone ? (zone.id || zone.className.replace(' tutorialZoneHighlight', '')) : null,
    zoneRows: zone ? zone.querySelectorAll('.upgrade, .researchNode, .settingRow, .statRow').length : 0,
    arrowShown: getComputedStyle(arrow).display !== 'none',
    arrowLabel: document.getElementById('tutorialSpotlightArrowLabel').textContent,
    boxInScreen: b.left >= -1 && b.top >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1,
    boxRect: { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) },
    overlapsZone: !!overlap,
  };
};

async function clickThroughDialogues(page, max = 40) {
  for (let i = 0; i < max; i++) {
    const v = await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'));
    if (!v) return;
    await page.evaluate(() => document.getElementById('dialogueBox').click());
    await page.waitForTimeout(300);
  }
}

async function scenario(browser, w, h) {
  console.log(`\n=== fenetre ${w}x${h} ===`);
  const page = await boot(browser, w, h);

  // attend le spotlight du bouton magasin puis l'ouvre
  for (let s = 0; s < 25; s++) {
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display === 'block')) break;
  }
  await page.evaluate(() => document.getElementById('shopBtn').click());
  await page.waitForTimeout(900);
  // Papi designe d'abord le mini-onglet (doigt « Clique ici ! ») : c'est ce clic qui lance le descriptif.
  await page.evaluate(() => { const b = document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'); if (b) b.click(); });
  await page.waitForTimeout(700);

  // Papi decrit maintenant l'onglet Production (dans le magasin)
  const shop = await page.evaluate(SNAPSHOT);
  console.log('  magasin/Production:', JSON.stringify(shop));
  if (!shop.dialogueVisible) fail('aucune bulle de description dans le magasin');
  // Le halo va sur le conteneur QUI DEFILE (il entoure toute la zone d'achat visible), pas
  // sur le panneau de l'onglet dont l'ombre serait rognee par ce conteneur.
  if (shop.zoneId !== 'shopPageContent') fail('halo attendu sur shopPageContent, trouve:', shop.zoneId);
  if (shop.zoneRows < 3) fail('le halo n entoure pas la liste (', shop.zoneRows, 'lignes dedans)');
  if (shop.arrowShown) fail('le doigt est encore affiche alors que Papi ne fait que decrire');
  if (!shop.boxInScreen) fail('la bulle sort de l ecran:', JSON.stringify(shop.boxRect));
  if (shop.overlapsZone) fail('la bulle recouvre la zone qu elle explique');

  // le clic sur le texte fait tout disparaitre
  await page.evaluate(() => document.getElementById('dialogueBox').click());
  await page.waitForTimeout(200);
  await clickThroughDialogues(page);
  const after = await page.evaluate((avant) => ({
    // Une bulle peut rester visible : c'est l'annonce de l'onglet SUIVANT, qui s'enchaine.
    // Ce qui compte, c'est que le descriptif qu'on vient de fermer, lui, soit parti.
    memeTexte: document.getElementById('dialogueText').textContent === avant,
    zone: !!document.querySelector('.tutorialZoneHighlight'),
  }), shop.texte);
  console.log('  apres clic sur le texte:', JSON.stringify(after));
  if (after.memeTexte) fail('le descriptif ne part pas au clic');
  if (after.zone) fail('le halo dore reste apres la fermeture de la bulle');

  // Onglet suivant du magasin (Clic) : Papi le presente via un clic sur son mini-onglet.
  const hl = await page.evaluate(() => { const b = document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'); return b ? b.dataset.tabId : null; });
  if (hl) {
    await page.evaluate(id => document.querySelector(`[data-tab-id="${id}"]`).click(), hl);
    await page.waitForTimeout(900);
    const suivant = await page.evaluate(SNAPSHOT);
    console.log('  onglet', hl, ':', JSON.stringify(suivant));
    if (suivant.dialogueVisible) {
      if (!suivant.boxInScreen) fail('bulle hors ecran sur l onglet', hl, JSON.stringify(suivant.boxRect));
      if (suivant.arrowShown) fail('le doigt est affiche pendant une simple description');
      if (suivant.overlapsZone) fail('la bulle recouvre la zone qu elle explique');
    }
  } else {
    console.log('  (aucun onglet suivant en attente)');
  }

  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await scenario(browser, 1280, 820);
  await scenario(browser, 1920, 1040);
  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
