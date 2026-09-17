// Decouverte progressive du magasin : seul le prochain objet a acheter montre son nom et son
// image ; les suivants n'affichent que leur prix. Un objet decouvert le reste apres un Prestige.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

const lignes = (page, conteneur) => page.evaluate((c) => [...document.querySelectorAll(`#${c} .upgrade`)].map(r => ({
  id: r.dataset.rowId,
  nom: r.querySelector('.name').textContent.trim().slice(0, 28),
  image: !!r.querySelector('img.itemIcon'),
  mystere: r.classList.contains('mysteryItem'),
  desc: !!r.querySelector('.desc, .prodLine, .tags'),
  prix: r.querySelector('.price').textContent.trim(),
})), conteneur);

function verifier(label, rows, visiblesAttendus) {
  const visibles = rows.filter(r => !r.mystere).map(r => r.id);
  console.log(`  ${label.padEnd(24)} visibles=${JSON.stringify(visibles)} | 1er cache=${JSON.stringify(rows.find(r => r.mystere))}`);
  if (visibles.join() !== visiblesAttendus.join()) fail(label, ': visibles attendus', visiblesAttendus, 'trouves', visibles);
  for (const r of rows.filter(r => r.mystere)) {
    if (r.nom !== '???' || r.image || r.desc) { fail(label, ': ligne cachee qui revele quelque chose', JSON.stringify(r)); break; }
    if (!/🌿/.test(r.prix)) { fail(label, ': ligne cachee sans prix', JSON.stringify(r)); break; }
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    for (const t of TAB_DEFS) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; }
    state.achievements = { a_click100: true };
    state.buildings = { stagiaire: 2 }; state.itemPopupsShown = { stagiaire: true };
    state.lastDailyClaim = todayStr(); state.verdure = 0;
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.getElementById('itemPopupOverlay').style.display = 'none'; openModal('shopPageOverlay'); });
  await page.waitForTimeout(400);

  console.log('=== 1. etat de depart ===');
  verifier('Production', await lignes(page, 'shop'), ['stagiaire', 'voisin']);
  await page.evaluate(() => { activeShopTab = 'clic'; renderAll(); });
  verifier('Clic', await lignes(page, 'clickShop'), [CLICK_FIRST = null].length ? await page.evaluate(() => [CLICK_UPGRADES[0].id]) : []);
  await page.evaluate(() => { activeShopTab = 'batiments'; renderAll(); });
  const bat = await lignes(page, 'companionBuildingsShop');
  verifier('Batiments', bat, await page.evaluate(() => [COMPANION_BUILDINGS[0].id]));
  const cible = await page.evaluate(() => {
    const b = COMPANION_BUILDINGS[0];
    const visible = productionHidden().has(b.targetId) === false;
    return { cible: b.targetId, ligne: document.querySelector(`#companionBuildingsShop [data-row-id="${b.id}"] .synergy`).textContent, cibleVisibleEnProduction: visible };
  });
  console.log('  cible du 1er Batiment :', JSON.stringify(cible));
  if (!cible.cibleVisibleEnProduction && !cible.ligne.includes('???')) fail('le Batiment revele le nom d un compagnon encore cache');
  await page.evaluate(() => { activeShopTab = 'special'; renderAll(); });
  verifier('Special', await lignes(page, 'specialShop'), await page.evaluate(() => [UNIQUE_BUILDINGS.filter(u => !u.requires || u.requires(state))[0].id]));

  console.log('=== 2. achat du prochain objet ===');
  await page.evaluate(() => { activeShopTab = 'production'; state.verdure = 1e6; renderAll(); });
  const clicCache = await page.evaluate(() => { const r = document.querySelector('#shop [data-row-id="poubelleCompost"]'); r.click(); return state.buildings.poubelleCompost || 0; });
  if (clicCache) fail('une ligne cachee a pu etre achetee');
  await page.evaluate(() => { buyBuilding('voisin'); document.getElementById('itemPopupOverlay').style.display = 'none'; state.verdure = 0; renderAll(); });
  verifier('Production apres achat', await lignes(page, 'shop'), ['stagiaire', 'voisin', 'poubelleCompost']);

  console.log('=== 3. apres un Prestige ===');
  await page.evaluate(() => { state.buildings = {}; renderAll(); });
  verifier('Production apres Prestige', await lignes(page, 'shop'), ['stagiaire', 'voisin', 'poubelleCompost']);

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
