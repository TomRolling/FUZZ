// Mode test cache : invisible par defaut, Ctrl+Maj+D l'ouvre et le ferme, chaque bouton agit.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const clic = (p, libelle) => p.evaluate((l) => {
  const b = [...document.querySelectorAll('#modeTestPanel button')].find(x => x.textContent.trim() === l);
  if (!b) return false; b.click(); return true;
}, libelle);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; state.lastDailyLoginDate = todayStr(); state.buildings = { stagiaire: 10 }; saveGame(); });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.confirm = () => false; }); // aucune action du mode test ne doit demander de confirmation

  const cache = await p.evaluate(() => !document.getElementById('modeTestPanel'));
  console.log('  cache par defaut :', cache); if (!cache) fail('panneau visible sans raccourci');
  await p.keyboard.press('Control+Shift+D');
  await p.waitForTimeout(200);
  const ouvert = await p.evaluate(() => ({ ouvert: !!document.getElementById('modeTestPanel'), boutons: document.querySelectorAll('#modeTestPanel button').length }));
  console.log('  apres Ctrl+Maj+D :', JSON.stringify(ouvert)); if (!ouvert.ouvert || ouvert.boutons < 15) fail('panneau non ouvert ou incomplet');

  const avant = await p.evaluate(() => ({ t: state.totalPlayTimeSec, v: state.verdure }));
  for (const l of ['+1 h', 'x10', 'Verdure x100', '+1 000 Connaissances', '+10 Graines', '+1 Éclat', 'Tout débloquer', 'Prestige maintenant', 'Ascension maintenant', 'Herbe dorée', 'Papillons', 'Visite de Papi', 'Météo suivante', 'Recharger les capacités']) {
    if (!await clic(p, l)) fail('bouton absent :', l);
  }
  await p.waitForTimeout(300);
  const r = await p.evaluate((avant) => ({
    temps: state.totalPlayTimeSec - avant.t, vitesse: _vitesseTest, vitesseAffichee: document.querySelector('#modeTestPanel button.actif') && document.querySelector('#modeTestPanel button.actif').textContent,
    prestiges: state.prestigeCount, ascensions: state.totalAscensions, onglets: revealedTabs().length, total: TAB_DEFS.length,
    evenements: document.querySelectorAll('.golden').length, papi: !!(state.invasiveWeed && state.invasiveWeed.active),
  }), avant);
  console.log('  ', JSON.stringify(r));
  if (r.temps < 3600) fail('+1 h n avance pas le temps');
  if (r.vitesse !== 10 || r.vitesseAffichee !== 'x10') fail('vitesse x10 non appliquee');
  if (r.prestiges < 1) fail('Prestige maintenant sans effet');
  if (r.ascensions < 1) fail('Ascension maintenant sans effet (ou demande de confirmation)');
  if (r.onglets !== r.total) fail('Tout debloquer incomplet');
  if (r.evenements < 2) fail('herbe doree / papillons non generes');
  if (!r.papi) fail('visite de Papi non declenchee');

  const vitesse = await p.evaluate(async () => { const t0 = state.totalPlayTimeSec; await new Promise(res => setTimeout(res, 2100)); return state.totalPlayTimeSec - t0; });
  console.log('  temps de jeu gagne en ~2 s reelles a x10 :', vitesse); if (vitesse < 19) fail('la vitesse x10 n accelere pas le temps de jeu');

  const defi = await p.evaluate(() => { window.confirm = () => true; state.prestigeCount = Math.max(state.prestigeCount, 2); startChallenge('minimaliste'); window.confirm = () => false; return state.challengeActive; });
  await clic(p, 'Réussir le défi en cours');
  const defiFini = await p.evaluate(() => ({ fait: challengeDone('minimaliste'), actif: state.challengeActive }));
  console.log('  defi :', defi, JSON.stringify(defiFini)); if (!defiFini.fait) fail('Reussir le defi en cours sans effet');

  await p.keyboard.press('Control+Shift+D');
  await p.waitForTimeout(200);
  if (await p.evaluate(() => !!document.getElementById('modeTestPanel'))) fail('Ctrl+Maj+D ne referme pas le panneau');
  await p.keyboard.press('Control+Shift+D'); await p.waitForTimeout(200);
  await p.screenshot({ path: __dirname + '/captures/mode-test.png', clip: { x: 0, y: 60, width: 420, height: 700 } });

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
