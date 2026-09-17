// 1) Le doigt de Papi reste sur sa cible quand la fenetre est agrandie pendant qu'il parle.
// 2) Les unites lisibles : « /sec » et « 25 sec » au lieu de « /s » et « 25s » ; « % » dans une
//    police nette.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const mesure = p => p.evaluate(() => {
  const a = document.getElementById('tutorialSpotlightArrow').getBoundingClientRect();
  const c = document.getElementById('achievementsBtn').getBoundingClientRect();
  const d = document.getElementById('dialogueBox').getBoundingClientRect();
  const chevauche = !(a.right <= d.left || a.left >= d.right || a.bottom <= d.top || a.top >= d.bottom);
  return { ecartDoigt: Math.round(Math.abs((a.left + a.width / 2) - (c.left + c.width / 2))), sousCible: Math.round(a.top - c.bottom), chevauche };
});

(async () => {
  const b = await chromium.launch();
  console.log('=== 1. agrandissement pendant une presentation ===');
  {
    const p = await b.newPage({ viewport: { width: 900, height: 620 } });
    p.on('pageerror', e => fail('pageerror:', e.message));
    await p.goto(filePath);
    await p.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; state.tabsSeen = { options: true, stats: true }; state.tabsDescribed = { options: true, stats: true }; state.achievements = { a_click100: true }; state.lastDailyLoginDate = todayStr(); saveGame(); });
    await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await p.waitForTimeout(1800);
    const avant = await mesure(p);
    for (const [w, h] of [[1600, 1000], [1100, 700], [2200, 1200]]) {
      await p.setViewportSize({ width: w, height: h });
      await p.waitForTimeout(500);
      const apres = await mesure(p);
      console.log(`  ${w}x${h}`, JSON.stringify(apres), '(avant', JSON.stringify(avant) + ')');
      if (apres.ecartDoigt > 3) fail(`${w}x${h} : doigt decale de ${apres.ecartDoigt} px`);
      if (apres.sousCible < 0 || apres.sousCible > 30) fail(`${w}x${h} : doigt pas juste sous le bouton`);
      if (apres.chevauche) fail(`${w}x${h} : le doigt recouvre la bulle`);
    }
    await p.close();
  }
  console.log('=== 2. unites lisibles ===');
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
    p.on('pageerror', e => fail('pageerror:', e.message));
    await p.goto(filePath);
    await p.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; for (const t of TAB_DEFS) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; } state.lastDailyLoginDate = todayStr(); state.buildings = { stagiaire: 12 }; state.itemPopupsShown = { stagiaire: true }; state.achievements = { a_click100: true }; saveGame(); });
    await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      startTimedBoost('click', 2, 25000); renderAll();
      openModal('shopPageOverlay');
      const prod = document.querySelector('#shop [data-row-id="stagiaire"] .prodLine').textContent;
      const chip = document.querySelector('#boostRow .boostTime') ? document.querySelector('#boostRow .boostTime').textContent : '';
      return { prod, chip, titre: document.title, duree: [formatDureeCourte(45), formatDureeCourte(180), formatDureeCourte(4800)], police: getComputedStyle(document.body).fontFamily };
    });
    console.log('  ', JSON.stringify(r));
    if (!/\/sec/.test(r.prod) || /\/s\b/.test(r.prod.replace('/sec', ''))) fail('production par compagnon pas en /sec');
    if (!/ sec$/.test(r.chip)) fail('decompte du bonus pas en « sec »');
    if (!/\/sec/.test(r.titre)) fail('titre pas en /sec');
    if (r.duree.join('|') !== '45 sec|3 min|1 h 20 min') fail('formatDureeCourte incorrect');
    if (!/FuzzPourcent/.test(r.police)) fail('police du % absente');
    await p.evaluate(() => { closeModal('shopPageOverlay'); openModal('achievementsModalOverlay'); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: __dirname + '/captures/lisibilite-pourcent.png', clip: { x: 740, y: 70, width: 540, height: 260 } });
    await p.close();
  }
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
