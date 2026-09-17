// Une vraie sauvegarde doit se RECHARGER telle quelle, sans erreur console et sans passer par
// la sauvegarde de secours. (Une exception dans applyLoadedState faisait silencieusement
// declarer la partie corrompue : le jeu redemarrait a zero sans que rien ne le signale.)
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    state.verdure = 12345; state.totalClicks = 77;
    state.buildings.stagiaire = 9;
    state.companionBuildings = { cascadeTetards: true };
    state.researchUpgrades = { r_prod1: true };
    saveGame();
  });
  const before = await page.evaluate(() => ({
    verdure: Math.round(state.verdure), clicks: state.totalClicks,
    comp: state.buildings.stagiaire, bat: Object.keys(state.companionBuildings),
    cps: +totalCps().toFixed(4),
  }));

  errs.length = 0;
  await page.reload();
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => ({
    verdure: Math.round(state.verdure), clicks: state.totalClicks,
    comp: state.buildings.stagiaire, bat: Object.keys(state.companionBuildings),
    cps: +totalCps().toFixed(4),
  }));
  console.log('  avant rechargement:', JSON.stringify(before));
  console.log('  apres rechargement:', JSON.stringify(after));
  if (errs.length) fail('erreurs au chargement:', errs);
  if (after.clicks !== before.clicks) fail('totalClicks perdu:', after.clicks, '!=', before.clicks);
  if (after.comp !== before.comp) fail('compagnons perdus:', after.comp, '!=', before.comp);
  if (after.bat.join() !== before.bat.join()) fail('batiments perdus:', after.bat, '!=', before.bat);
  if (after.verdure < before.verdure) fail('verdure perdue:', after.verdure, '<', before.verdure);

  // Le cache des multiplicateurs doit refleter les batiments possedes des le chargement.
  const mult = await page.evaluate(() => ({
    avecBatiment: companionBuildingMultFor('stagiaire'),
    sansBatiment: companionBuildingMultFor('voisin'),
  }));
  console.log('  multiplicateurs:', JSON.stringify(mult));
  if (!(mult.avecBatiment > 1)) fail('le batiment possede ne booste pas son compagnon apres rechargement');
  if (mult.sansBatiment !== 1) fail('un compagnon sans batiment est booste a tort:', mult.sansBatiment);

  // Et il doit s'invalider a l'achat.
  const apresAchat = await page.evaluate(() => {
    const avant = companionBuildingMultFor('voisin');
    const b = COMPANION_BUILDINGS.find(x => x.targetId === 'voisin');
    if (!b) return { avant, apres: null, id: null };
    state.verdure = b.cost * 10;
    buyCompanionBuilding(b.id);
    return { avant, apres: companionBuildingMultFor('voisin'), id: b.id };
  });
  console.log('  apres achat:', JSON.stringify(apresAchat));
  if (apresAchat.id && !(apresAchat.apres > apresAchat.avant)) fail('le cache ne s invalide pas a l achat');

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
