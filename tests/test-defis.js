// Defis a recompense permanente : deblocage, lancement avec reset, regles appliquees,
// reussite / echec au Prestige, recompenses, panneau.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (cond, ...m) => { if (!cond) fail(...m); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    for (const t of TAB_DEFS) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; }
    state.lastDailyLoginDate = todayStr(); state.prestigeCount = 1; state.cosmicSeeds = 7; state.seedsSinceAscension = 7; saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.confirm = () => true; state.automation.buyCompanions = false; });

  console.log('=== 1. deblocage ===');
  const d = await page.evaluate(() => {
    const dispo = st => CHALLENGES.filter(c => c.unlock(st)).map(c => c.id).join(',');
    return { p1: dispo({ prestigeCount: 1 }), p5: dispo({ prestigeCount: 5 }), a4: dispo({ prestigeCount: 9, totalAscensions: 4 }), nb: CHALLENGES.length };
  });
  console.log('  ', JSON.stringify(d));
  verifie(d.nb === 8 && d.p1 === 'mains' && d.p5 === 'mains,minimaliste,tempete,papi' && d.a4.split(',').length === 8, 'deblocage incorrect');

  console.log('=== 2. Mains dans les poches : reset, clic bloque, reussite ===');
  const m = await page.evaluate(() => {
    state.verdure = 5e6; state.buildings = { stagiaire: 30 };
    startChallenge('mains');
    const apresLancement = { verdure: state.verdure, compagnons: Object.keys(state.buildings).length, graines: state.cosmicSeeds, actif: state.challengeActive, premierCompagnon: state.verdure >= buildingCost(BUILDINGS[0], 1) };
    const clicsAvant = state.totalClicks;
    document.getElementById('clickZone').click();
    const clicBloque = state.totalClicks === clicsAvant;
    const prodAvant = challengeProdMult();
    state.verdure = PRESTIGE_DIVISOR * 1.5;
    doPrestige(true);
    return { apresLancement, clicBloque, prodAvant, fait: challengeDone('mains'), actif: state.challengeActive, prodApres: challengeProdMult(), succes: state.achievements.a_noBuy1 || ACHIEVEMENTS.find(a => a.id === 'a_noBuy1').check(state) };
  });
  console.log('  ', JSON.stringify(m));
  verifie(m.apresLancement.verdure >= 1000 && m.apresLancement.premierCompagnon && m.apresLancement.compagnons === 0 && m.apresLancement.graines === 7 && m.apresLancement.actif === 'mains', 'le lancement ne remet pas la partie a zero, touche aux Graines, ou ne laisse pas de quoi acheter un compagnon');
  verifie(m.clicBloque, 'le clic manuel n est pas bloque');
  verifie(m.fait && m.actif === null && Math.abs(m.prodApres - 1.1) < 1e-9 && m.prodAvant === 1, 'reussite ou recompense +10 % incorrecte');
  verifie(m.succes, 'le succes « Relever le gant » ne se debloque pas');

  console.log('=== 3. regles des autres defis ===');
  const r = await page.evaluate(() => {
    const res = {};
    state.prestigeCount = 9; state.totalAscensions = 4; state.challengesDone = { mains: true };
    // Minimaliste : 10 sortes au maximum.
    startChallenge('minimaliste'); state.verdure = 1e14;
    for (const b of BUILDINGS.slice(0, 13)) { state.itemPopupsShown[b.id] = true; buyBuilding(b.id, 1); }
    res.minimaliste = Object.values(state.buildings).filter(n => n > 0).length;
    state.challengeActive = null;
    // Tempete : gel permanent.
    state.weather = 'arcEnCiel'; startChallenge('tempete');
    res.tempeteMeteo = weatherMultiplier(); state.challengeActive = null; res.horsTempete = weatherMultiplier();
    // Papi : -30 % permanent.
    startChallenge('papi'); res.papiPenalite = invasivePenalty(); state.challengeActive = null;
    // Livres : la Recherche ne compte pas.
    state.researchUpgrades = { r_prod1: true, r_prod2: true };
    const prodRech = combinedUpgradeValue('prodMult');
    startChallenge('livres'); res.livres = [prodRech, combinedUpgradeValue('prodMult')]; state.challengeActive = null;
    // Fondations : Batiments et Special coupes.
    state.buildings = { stagiaire: 10 }; state.companionBuildings = { cascadeTetards: true };
    const multBat = companionBuildingMultFor('stagiaire');
    startChallenge('fondations'); state.verdure = 1e15;
    res.fondations = { avant: multBat, pendant: companionBuildingMultFor('stagiaire'), achatSpecial: (buyUnique('chatJardin'), !!state.uniqueBuildings.chatJardin) };
    state.challengeActive = null;
    // Inflation : x10.
    const b0 = BUILDINGS[0]; state.buildings = {};
    const prixNormal = buildingCost(b0, 1);
    startChallenge('inflation'); res.inflation = buildingCost(b0, 1) / prixNormal;
    state.challengesDone.inflation = true; state.challengeActive = null; res.inflationRecompense = buildingCost(b0, 1) / prixNormal;
    return res;
  });
  console.log('  ', JSON.stringify(r));
  verifie(r.minimaliste === 10, 'Jardin minimaliste : nombre de sortes achetees different de 10');
  verifie(r.tempeteMeteo < 1 && r.horsTempete === 1.5, 'Tempete : la meteo n est pas forcee au gel');
  verifie(r.papiPenalite === 0.7, 'Papi s installe : penalite absente');
  verifie(r.livres[0] > 1 && r.livres[1] === 1, 'Livres fermes : la Recherche compte encore');
  verifie(r.fondations.avant > 1 && r.fondations.pendant === 1 && !r.fondations.achatSpecial, 'Sans fondations : Batiments ou Special encore actifs');
  verifie(Math.abs(r.inflation - 10) < 1e-9 && Math.abs(r.inflationRecompense - 0.9) < 1e-9, 'Inflation : prix incorrects');

  console.log('=== 4. echec : objectif ou temps non tenus ===');
  const e = await page.evaluate(() => {
    state.challengesDone = { mains: true };
    startChallenge('montre');
    state.challengeStartPlayTime = (state.totalPlayTimeSec || 0) - 9 * 3600;   // 9 h ecoulees sur 8
    state.verdure = PRESTIGE_DIVISOR * 70;                                     // 4 Graines
    doPrestige(true);
    const montre = { fait: challengeDone('montre'), actif: state.challengeActive };
    startChallenge('inflation');
    state.verdure = PRESTIGE_DIVISOR * 30;                                     // 3 Graines < 8
    doPrestige(true);
    return { montre, inflation: { fait: challengeDone('inflation'), actif: state.challengeActive } };
  });
  console.log('  ', JSON.stringify(e));
  verifie(!e.montre.fait && e.montre.actif === null, 'Course contre la montre reussie hors delai');
  verifie(!e.inflation.fait && e.inflation.actif === null, 'defi reussi sous l objectif de Graines');

  console.log('=== 5. Prestige automatique suspendu pendant un defi ===');
  const a = await page.evaluate(() => {
    state.totalAscensions = 4; state.automation.prestige = true; state.automation.prestigeSeeds = 1;
    startChallenge('papi'); state.verdure = PRESTIGE_DIVISOR * 100;
    const avant = state.prestigeCount; runAutomations();
    const r = state.prestigeCount === avant && state.challengeActive === 'papi';
    state.automation.prestige = false; abandonChallenge();
    return { suspendu: r, apresAbandon: state.challengeActive };
  });
  console.log('  ', JSON.stringify(a));
  verifie(a.suspendu, 'le Prestige auto se declenche pendant un defi');
  verifie(a.apresAbandon === null, 'l abandon ne termine pas le defi');

  console.log('=== 6. panneau ===');
  const ui = await page.evaluate(() => {
    openModal('questsModalOverlay'); activeQuestsTab = 'defi'; renderAll();
    const lignes = [...document.querySelectorAll('#defiListe .upgrade')].map(x => ({ id: x.dataset.rowId, etat: x.querySelector('.price').textContent.trim() }));
    document.querySelector('#defiListe [data-row-id="tempete"] [data-action="start"]').click();
    const lance = state.challengeActive;
    renderAll();
    const bandeau = document.getElementById('weatherBadge').textContent;
    document.querySelector('#defiListe [data-row-id="tempete"] [data-action="abandon"]').click();
    return { lignes, lance, bandeau, apres: state.challengeActive, resume: document.getElementById('defiInfos').textContent.replace(/\s+/g, ' ').trim() };
  });
  console.log('  ', JSON.stringify(ui));
  verifie(ui.lignes.length === 8, '8 defis attendus dans le panneau');
  verifie(ui.lance === 'tempete' && /Tempête sans fin/.test(ui.bandeau), 'lancement depuis le panneau ou bandeau absent');
  verifie(ui.apres === null, 'abandon depuis le panneau');
  await page.screenshot({ path: __dirname + '/captures/defis.png', clip: { x: 740, y: 60, width: 540, height: 700 } });

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
