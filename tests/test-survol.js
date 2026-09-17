// Le survol d'une ligne doit rester stable dans TOUS les onglets du magasin : c'est la
// reconstruction complete de la liste a chaque tick qui detruisait l'element sous le curseur.
// Verifie aussi que le bouton « Activer » des capacites de Special fonctionne toujours.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

const ONGLETS = [
  ['production', '#tab-production #shop'],
  ['batiments', '#tab-batiments #companionBuildingsShop'],
  ['clic', '#tab-clic #clickShop'],
  ['special', '#tab-special #specialShop'],
  ['special (cosmetiques)', '#tab-special #skinsShop'],
  ['recherche', '#tab-recherche #researchShop'],
  ['recherche (infinies)', '#tab-recherche #researchInfiniteShop'],
  ['prestige', '#tab-prestige #prestigeShop'],
  ['ascension', '#tab-ascension #ascensionShop'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  page.on('console', m => { if (m.type() === 'error') fail('console:', m.text()); });
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true; state.totalClicks = 5000;
    state.tabsSeen = { options: true, stats: true, galerie: true, production: true, clic: true,
                       batiments: true, special: true, recherche: true, prestige: true, ascension: true };
    state.verdure = 1e15; state.knowledge = 1e9; state.cosmicSeeds = 500; state.stellarShards = 500;
    state.totalSeedsEarned = 1e9; state.prestigeCount = 3; state.totalPlayTimeSec = 7200;
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { openModal('shopPageOverlay'); });
  await page.waitForTimeout(400);

  for (const [nom, sel] of ONGLETS) {
    const tab = sel.match(/#tab-([a-z]+)/)[1];
    await page.evaluate((t) => { activeShopTab = t; renderAll(); }, tab);
    await page.waitForTimeout(300);

    const row = await page.$(sel + ' .upgrade');
    if (!row) { fail(nom, ': aucune ligne trouvee (' + sel + ')'); continue; }
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    if (!box) { fail(nom, ': ligne invisible'); continue; }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);

    const obs = await page.evaluate(async (s) => {
      const el = document.querySelector(s + ' .upgrade');
      const first = el;
      let sameNode = 0, hovered = 0, total = 0;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        const cur = document.querySelector(s + ' .upgrade');
        total++;
        if (cur === first) sameNode++;
        if (cur && cur.matches(':hover')) hovered++;
      }
      return { total, sameNode, hovered };
    }, sel);

    const ok = obs.sameNode === obs.total && obs.hovered === obs.total;
    console.log(' ', nom.padEnd(22), JSON.stringify(obs), ok ? 'OK' : '<-- PROBLEME');
    if (obs.sameNode !== obs.total) fail(nom, ': la ligne est recreee pendant le survol (' + obs.sameNode + '/' + obs.total + ')');
    if (obs.hovered !== obs.total) fail(nom, ': le survol se perd (' + obs.hovered + '/' + obs.total + ')');
  }

  // Le bouton « Activer » d'une capacite de Special doit toujours marcher, et NE PAS declencher
  // l'achat de la ligne.
  console.log('=== bouton Activer des capacites ===');
  const activation = await page.evaluate(() => {
    const u = UNIQUE_BUILDINGS.find(x => x.active);
    state.uniqueBuildings[u.id] = true;
    state.activeCooldowns = {};
    activeShopTab = 'special'; renderAll();
    const row = document.querySelector(`#specialShop [data-row-id="${u.id}"]`);
    const btn = row && row.querySelector('button');
    if (!btn) return { erreur: 'bouton Activer absent' };
    const avant = activeCooldownRemaining(u.id);
    btn.click();
    return { id: u.id, avant, apres: activeCooldownRemaining(u.id) };
  });
  console.log(' ', JSON.stringify(activation));
  if (activation.erreur) fail(activation.erreur);
  else if (!(activation.apres > activation.avant)) fail('le bouton Activer ne declenche plus la capacite');

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
