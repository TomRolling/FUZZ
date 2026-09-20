// Parcours complet des onglets du magasin, tel que le joueur le vit :
//  - chaque nouvel onglet est presente avec le doigt « Clique ici ! » (y compris le premier) ;
//  - le magasin s'ouvre sur l'onglet ou le joueur en etait, JAMAIS directement sur le nouveau ;
//  - le doigt ne recouvre jamais la bulle de Papi ;
//  - un clic sur l'onglet designe lance son descriptif.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

const ETAPES = [
  { id: 'production', debloque: () => { state.totalClicks = 200; } },
  { id: 'clic',       debloque: null }, // arrive a la suite de Production
  { id: 'batiments',  debloque: () => { state.verdure = seuilOnglet('batiments') * 1.05; } },
  { id: 'special',    debloque: () => { state.verdure = seuilOnglet('special') * 1.05; } },
  { id: 'recherche',  debloque: () => { state.totalPlayTimeSec = 1900; state.knowledge = prixPremiereRecherche(); } },
  { id: 'prestige',   debloque: () => { state.verdure = 6e8; } },
];

const chevauchement = () => {
  const a = document.getElementById('tutorialSpotlightArrow'), d = document.getElementById('dialogueBox');
  if (getComputedStyle(a).display === 'none' || !isDialogueVisible()) return false;
  const ra = a.getBoundingClientRect(), rd = d.getBoundingClientRect();
  return !(ra.right <= rd.left || ra.left >= rd.right || ra.bottom <= rd.top || ra.top >= rd.bottom);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    state.tabsSeen = { options: true, stats: true, succes: true, quetes: true, dailyreward: true, galerie: true };
    state.tabsDescribed = { options: true, stats: true, succes: true, quetes: true, dailyreward: true, galerie: true };
    state.achievements = { a_click100: true };
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1500);

  for (const etape of ETAPES) {
    if (etape.debloque) {
      await page.evaluate(`(${etape.debloque})()`);
      // Attend le spotlight sur le bouton du magasin, puis l'ouvre comme le joueur.
      let spot = false;
      for (let i = 0; i < 30 && !spot; i++) {
        await page.waitForTimeout(250);
        spot = await page.evaluate(() => document.getElementById('shopBtn').classList.contains('featureHighlight'));
      }
      if (!spot) { fail(etape.id, ': le bouton du magasin n est pas mis en evidence'); break; }
      if (await page.evaluate(chevauchement)) fail(etape.id, ': le doigt recouvre la bulle (bouton du magasin)');
      await page.evaluate(() => document.getElementById('shopBtn').click());
    }
    // Le doigt doit designer le nouvel onglet.
    let etat = null;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(200);
      etat = await page.evaluate((id) => ({
        doigt: getComputedStyle(document.getElementById('tutorialSpotlightArrow')).display !== 'none',
        libelle: document.getElementById('tutorialSpotlightArrowLabel').textContent,
        halo: [...document.querySelectorAll('#shopTabsRow .drawerBtn.featureHighlight')].map(b => b.dataset.tabId),
        actif: activeShopTab,
        present: !!document.querySelector(`#shopTabsRow [data-tab-id="${id}"]`),
      }), etape.id);
      if (etat.doigt && etat.halo.includes(etape.id)) break;
    }
    console.log(`  ${etape.id.padEnd(11)}`, JSON.stringify(etat));
    if (!etat.present) { fail(etape.id, ': mini-onglet absent'); break; }
    if (!etat.doigt || etat.libelle !== 'Clique ici !') fail(etape.id, ': pas de doigt « Clique ici ! »');
    if (!etat.halo.includes(etape.id)) fail(etape.id, ': mini-onglet pas mis en evidence');
    if (etape.id !== 'production' && etat.actif === etape.id) fail(etape.id, ': le magasin s est ouvert directement sur le nouvel onglet');
    if (await page.evaluate(chevauchement)) fail(etape.id, ': le doigt recouvre la bulle (mini-onglet)');

    await page.evaluate(id => document.querySelector(`#shopTabsRow [data-tab-id="${id}"]`).click(), etape.id);
    await page.waitForTimeout(600);
    const desc = await page.evaluate(() => ({ bulle: isDialogueVisible(), actif: activeShopTab }));
    if (!desc.bulle) fail(etape.id, ': pas de descriptif apres le clic');
    if (desc.actif !== etape.id) fail(etape.id, ': l onglet ne s ouvre pas au clic');
    // Lit le descriptif jusqu'au bout.
    for (let i = 0; i < 40; i++) {
      if (!await page.evaluate(() => isDialogueVisible() && !document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'))) break;
      await page.evaluate(() => document.getElementById('dialogueBox').click());
      await page.waitForTimeout(280);
    }
    await page.waitForTimeout(500);
    // Etape suivante dans la foulee (Production -> Clic) : on laisse le magasin ouvert.
    const suivanteEnchainee = await page.evaluate(() => !!document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'));
    if (!suivanteEnchainee) {
      await page.evaluate(() => closeModal('shopPageOverlay'));
      await page.waitForTimeout(700);
      if (await page.evaluate(() => isOverlayOpen('shopPageOverlay'))) fail(etape.id, ': le magasin ne se ferme pas apres la presentation');
    }
  }

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
