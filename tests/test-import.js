// Import d'une sauvegarde : la page recharge et le demarrage normal reconstruit tout (boutons
// reveles, partie importee, memoire de session propre, notification de confirmation).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  // Partie en cours : debut de partie, tutoriel vu, aucun bouton debloque.
  await p.evaluate(() => { const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr() }; localStorage.setItem(SAVE_KEY, JSON.stringify(st)); });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);

  console.log('=== 1. import d une partie avancee pendant une partie en cours (vitesse x100, bonus actif) ===');
  const avant = await p.evaluate(() => {
    _vitesseTest = 100; startTimedBoost('ability', 3, 600000);
    const importee = { ...defaultState(), langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 123456, prestigeCount: 4, cosmicSeeds: 9, totalClicks: 5000 };
    for (const t of TAB_DEFS) { importee.tabsSeen[t.id] = true; importee.tabsDescribed[t.id] = true; }
    const boutons = ['shopBtn', 'settingsBtn', 'achievementsBtn', 'questsBtn'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none').length;
    setTimeout(() => applyImportedData(importee), 0);
    return { boutons };
  });
  console.log('   boutons visibles avant :', avant.boutons);
  await p.waitForEvent('load', { timeout: 15000 });
  const t0 = Date.now();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  const dureeLancement = Date.now() - t0;
  console.log('   ecran de lancement apres import :', dureeLancement, 'ms');
  verifie(dureeLancement < 1500, 'l ecran de lancement (logos) repasse apres un import');
  await p.waitForTimeout(1200);
  const apres = await p.evaluate(() => ({
    boutons: ['shopBtn', 'settingsBtn', 'achievementsBtn', 'questsBtn'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none').length,
    prestiges: state.prestigeCount, graines: state.cosmicSeeds, vitesse: _vitesseTest, boosts: Object.keys(_boosts).length,
    toast: [...document.querySelectorAll('.toast')].some(t => /Sauvegarde importée/.test(t.textContent)),
    bulle: document.getElementById('dialogueOverlay').classList.contains('visible'), spotlight: _pendingSpotlightGroup,
  }));
  console.log('  ', JSON.stringify(apres));
  verifie(apres.boutons === 4, 'les boutons de la partie importee doivent etre visibles');
  verifie(apres.prestiges === 4 && apres.graines === 9, 'la partie importee n est pas chargee');
  verifie(apres.vitesse === 1 && apres.boosts === 0, 'la memoire de l ancienne partie (vitesse, bonus) doit disparaitre');
  verifie(apres.toast, 'la notification « Sauvegarde importée ! » est absente');
  verifie(!apres.bulle && !apres.spotlight, 'aucune annonce de Papi ne doit se declencher pour des onglets deja vus');

  console.log('=== 2. la partie importee survit a un nouveau rechargement ===');
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);
  const encore = await p.evaluate(() => ({ prestiges: state.prestigeCount, toast: [...document.querySelectorAll('.toast')].some(t => /Sauvegarde importée/.test(t.textContent)) }));
  console.log('  ', JSON.stringify(encore));
  verifie(encore.prestiges === 4, 'la partie importee a ete perdue au rechargement');
  verifie(!encore.toast, 'la notification d import ne doit s afficher qu une fois');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
