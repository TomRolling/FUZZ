// Les bonus temporaires ramasses a l'ecran (herbe doree, papillons) et ceux des capacites
// actives doivent afficher leur duree restante, et disparaitre a l'expiration.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

const CHIPS = () => [...document.querySelectorAll('#boostRow .boostChip')].map(c => ({
  id: c.dataset.rowId,
  texte: c.textContent.trim(),
  barre: c.querySelector('.boostBar') ? parseFloat(c.querySelector('.boostBar').style.width) : null,
}));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  page.on('console', m => { if (m.type() === 'error') fail('console:', m.text()); });
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true; state.totalClicks = 5000;
    state.tabsSeen = { options: true, stats: true, production: true, clic: true };
    state.verdure = 1e9; state.buildings = { stagiaire: 20 };
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1200);

  console.log('=== aucun bonus au depart ===');
  const vide = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('#boostRow .boostChip')].length,
    rowVisible: getComputedStyle(document.getElementById('boostRow')).display !== 'none',
  }));
  console.log(' ', JSON.stringify(vide));
  if (vide.chips !== 0) fail('des jauges sont affichees alors qu aucun bonus n est actif');
  if (vide.rowVisible) fail('le bandeau devrait etre masque quand il est vide');

  console.log('=== herbe doree (x3 production, 30s) ===');
  const golden = await page.evaluate((f) => {
    startTimedBoost('golden', 3, 30000);
    renderAll();
    return eval('(' + f + ')')();
  }, CHIPS.toString());
  console.log(' ', JSON.stringify(golden));
  if (golden.length !== 1) fail('une seule jauge attendue, trouve', golden.length);
  else {
    if (!/x3/.test(golden[0].texte)) fail('le multiplicateur x3 n est pas affiche:', golden[0].texte);
    if (!/\d+ sec/.test(golden[0].texte)) fail('pas de compte a rebours:', golden[0].texte);
    if (!(golden[0].barre > 90)) fail('la jauge devrait etre quasi pleine au debut:', golden[0].barre);
  }

  console.log('=== papillons par-dessus (production, constantes du jeu) ===');
  const deux = await page.evaluate((f) => {
    document.querySelector('.golden') || spawnButterflies();
    const el = [...document.querySelectorAll('.golden')].find(e => e.textContent === '🦋');
    el.click();
    renderAll();
    return { chips: eval('(' + f + ')')(), mult: _boosts.papillon && _boosts.papillon.mult, total: _boosts.papillon && _boosts.papillon.totalMs };
  }, CHIPS.toString());
  console.log(' ', JSON.stringify(deux));
  if (deux.chips.length !== 2) fail('deux jauges attendues, trouve', deux.chips.length);
  const attendu = await page.evaluate(() => ({ mult: PAPILLONS_MULT, duree: PAPILLONS_DUREE_MS }));
  if (deux.mult !== attendu.mult) fail('multiplicateur des papillons attendu', attendu.mult, 'trouve:', deux.mult);
  if (deux.total !== attendu.duree) fail('duree des papillons attendue', attendu.duree, 'trouve:', deux.total);

  console.log('=== le compte a rebours descend ===');
  const t1 = await page.evaluate((f) => eval('(' + f + ')')()[0].texte, CHIPS.toString());
  await page.waitForTimeout(2500);
  const t2 = await page.evaluate((f) => eval('(' + f + ')')()[0].texte, CHIPS.toString());
  const sec = t => parseInt((t.match(/(\d+) sec/) || [])[1], 10);
  console.log('  ', t1, '->', t2);
  if (!(sec(t2) < sec(t1))) fail('le compte a rebours ne descend pas:', t1, '->', t2);
  const barres = await page.evaluate((f) => eval('(' + f + ')')().map(c => c.barre), CHIPS.toString());
  console.log('  jauges:', JSON.stringify(barres));
  if (!(barres[0] < 95)) fail('la jauge ne se vide pas:', barres[0]);

  console.log('=== expiration ===');
  await page.evaluate(() => { _boosts.golden.until = Date.now() - 1; renderAll(); });
  await page.waitForTimeout(300);
  const apres = await page.evaluate((f) => eval('(' + f + ')')(), CHIPS.toString());
  console.log(' ', JSON.stringify(apres.map(c => c.id)));
  if (apres.some(c => c.id === 'golden')) fail('la jauge expiree est toujours affichee');
  if (apres.length !== 1) fail('la jauge des papillons aurait du rester, trouve', apres.length);

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
