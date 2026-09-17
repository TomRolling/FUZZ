// Paliers de compagnon : multiplicateur, effet sur la production, affichage et notification.
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
    state.langChosen = true; state.tutorialSeen = true;
    for (const t of TAB_DEFS) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; }
    state.buildings = { stagiaire: 18 }; state.itemPopupsShown = { stagiaire: true };
    state.lastDailyLoginDate = todayStr(); saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1200);

  console.log('=== 1. multiplicateur ===');
  const m = await page.evaluate(() => ({
    a9: companionMilestoneMult(9), a10: companionMilestoneMult(10), a20: companionMilestoneMult(20), a500: companionMilestoneMult(500), a9999: companionMilestoneMult(9999),
    ratioProd: (() => { const b = BUILDINGS[0]; state.buildings[b.id] = 9; const p9 = buildingCpsPerUnit(b); state.buildings[b.id] = 10; const p10 = buildingCpsPerUnit(b); state.buildings[b.id] = 18; return p10 / p9; })(),
  }));
  console.log('  ', JSON.stringify(m));
  if (m.a9 !== 1 || m.a10 !== 1.25 || Math.abs(m.a20 - 1.5625) > 1e-12) fail('paliers 10 / 20 incorrects');
  if (Math.abs(m.a500 - Math.pow(1.25, 14)) > 1e-9 || m.a9999 !== m.a500) fail('dernier palier incorrect');
  if (Math.abs(m.ratioProd - 1.25) > 1e-9) fail('le 10e exemplaire doit multiplier la production du compagnon par 1,25');

  console.log('=== 2. affichage dans le magasin ===');
  await page.evaluate(() => { document.getElementById('itemPopupOverlay').style.display = 'none'; openModal('shopPageOverlay'); });
  await page.waitForTimeout(400);
  const ligne = await page.evaluate(() => {
    const r = document.querySelector('#shop [data-row-id="stagiaire"]');
    return { texte: r.querySelector('.palierLine').textContent, largeur: r.querySelector('.palierFill').style.width,
             cachee: !!document.querySelector('#shop .mysteryItem .palierLine') };
  });
  console.log('  ', JSON.stringify(ligne));
  if (!/Palier 20 : 18\/20/.test(ligne.texte)) fail('texte du prochain palier incorrect');
  if (ligne.largeur !== '80%') fail('barre attendue a 80 % (18 entre les paliers 10 et 20)');
  if (!/bonus x1\.25/.test(ligne.texte)) fail('bonus deja acquis non affiche');
  if (ligne.cachee) fail('une ligne mystere affiche un palier');

  console.log('=== 3. notification au franchissement ===');
  const notif = await page.evaluate(() => {
    state.verdure = 1e9;
    buyBuilding('stagiaire', 2);
    return { possedes: state.buildings.stagiaire, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent) };
  });
  console.log('  ', JSON.stringify(notif));
  if (!notif.toasts.some(t => /Palier atteint : 20 /.test(t) && /x1\.25/.test(t))) fail('pas de notification au palier 20');
  const sansNotif = await page.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); buyBuilding('stagiaire', 1); return [...document.querySelectorAll('.toast')].filter(t => /Palier/.test(t.textContent)).length; });
  if (sansNotif) fail('notification de palier alors qu aucun palier n est franchi');

  console.log('=== 4. tous les paliers ===');
  const fin = await page.evaluate(() => { state.buildings.stagiaire = 600; renderAll(); return document.querySelector('#shop [data-row-id="stagiaire"] .palierLine').textContent; });
  console.log('  ', fin);
  if (!/Tous les paliers atteints/.test(fin)) fail('etat final des paliers non affiche');
  await page.screenshot({ path: __dirname + '/captures/paliers-magasin.png', clip: { x: 530, y: 200, width: 740, height: 460 } });

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
