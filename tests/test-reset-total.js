// Reset total : toute la progression repart de zero (Eclats compris), seuls les parametres restent,
// rien ne revient apres rechargement ni via la sauvegarde de secours.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

// Champs qui changent tout seuls (horodatages) : non compares.
const HORAIRES = ['lastSave', 'lastWeatherChange', 'lastGoldenSpawn', 'lastButterflySpawn', 'lastActionTime', 'lastBackupTime', 'saveVersion'];
const PARAMETRES = { lang: 'en', langChosen: true, soundEnabled: false, soundVolume: 35, forceDarkMode: true, vacationMode: true };

async function differences(p) {
  return p.evaluate(({ HORAIRES, PARAMETRES }) => {
    const attendu = { ...defaultState(), ...PARAMETRES };
    const diffs = [];
    for (const k of new Set([...Object.keys(attendu), ...Object.keys(state)])) {
      if (HORAIRES.includes(k)) continue;
      if (JSON.stringify(state[k]) !== JSON.stringify(attendu[k])) diffs.push(`${k}: ${JSON.stringify(state[k])} (attendu ${JSON.stringify(attendu[k])})`);
    }
    return diffs;
  }, { HORAIRES, PARAMETRES });
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate((PARAMETRES) => {
    const st = { ...state, ...PARAMETRES, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1e20, knowledge: 5000,
      cosmicSeeds: 40, totalSeedsEarned: 90, seedsSinceAscension: 30, prestigeCount: 12, totalAscensions: 3, stellarShards: 20, totalShardsEarned: 35,
      buildings: { stagiaire: 50 }, clickUpgrades: { [CLICK_UPGRADES[0].id]: true }, uniqueBuildings: { siffletMare: true },
      researchUpgrades: { [RESEARCH[0].id]: true }, prestigeUpgrades: { p_prod1: true }, ascensionUpgrades: { [ASCENSION_UPGRADES[0].id]: true },
      achievements: { [ACHIEVEMENTS[0].id]: true }, challengesDone: { mains: true }, familiers: { actif: 'grenouille', niveaux: { escargot: 6 } },
      ownedSkins: { default: true, [SKINS[1].id]: true }, dailyLoginStreak: 9, totalPlayTimeSec: 99999 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    localStorage.setItem(SAVE_KEY_BACKUP, JSON.stringify(st));
    localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(st));
    localStorage.setItem(LEGACY_SAVE_KEY_BACKUP, JSON.stringify(st));
  }, PARAMETRES);
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);

  console.log('=== 1. partie avancee en cours (mode test x100, bonus, herbe doree) ===');
  await p.evaluate(() => {
    basculerModeTest(); _vitesseTest = 100;
    startTimedBoost('ability', 3, 600000); startTimedBoost('golden', 2, 600000);
    spawnGoldenWeed(); spawnButterflies();
  });
  const avant = await p.evaluate(() => ({ eclats: state.totalShardsEarned, panneau: !!document.getElementById('modeTestPanel'), dores: document.querySelectorAll('#gameViewport .golden').length }));
  console.log('  ', JSON.stringify(avant));

  console.log('=== 2. reset total ===');
  await p.evaluate(() => performFullReset());
  await p.waitForTimeout(700); // fondu de 450 ms, puis nouvel etat
  const diffs = await differences(p);
  diffs.forEach(d => fail('apres reset :', d));
  const memoire = await p.evaluate(() => ({
    vitesse: _vitesseTest, boosts: Object.keys(_boosts).length, dores: document.querySelectorAll('#gameViewport .golden').length,
    panneau: !!document.getElementById('modeTestPanel'), cles: [SAVE_KEY_BACKUP, LEGACY_SAVE_KEY, LEGACY_SAVE_KEY_BACKUP].map(k => localStorage.getItem(k)).map(v => v === null ? 'vide' : (JSON.parse(v).totalShardsEarned || 0)),
    multProd: shardMultiplier() * seedMultiplier(),
  }));
  console.log('  ', JSON.stringify(memoire));
  verifie(memoire.vitesse === 1, 'la vitesse du mode test doit revenir a x1');
  verifie(memoire.boosts === 0, 'les bonus en cours doivent disparaitre');
  verifie(memoire.dores === 0, 'les herbes dorees et papillons doivent disparaitre');
  verifie(memoire.panneau === false, 'le panneau du mode test doit se fermer');
  verifie(memoire.cles.every(v => v === 'vide' || v === 0), 'une sauvegarde de secours ou ancienne cle contient encore l ancienne partie');
  verifie(memoire.multProd === 1, 'aucun bonus de Graines ou d Eclats ne doit rester');

  console.log('=== 3. apres rechargement ===');
  await p.evaluate(() => { saveGame = window.__vraiSave || saveGame; });
  await p.reload();
  await p.waitForTimeout(2500);
  const recharge = await differences(p);
  // L'intro (scene d'ouverture) peut deja avoir commence : seuls les champs de progression comptent.
  const progression = recharge.filter(d => !/^(tabsSeen|tabsDescribed|dailyQuests|dailyProgress|weather|weatherSeen|itemPopupsShown|hasEverPurchased|totalPlayTimeSec|maxIdleGapSec|invasiveWeed|lastDailyLoginDate|dailyLoginStreak|inactivityAnnounced|tutorialSeen)\b/.test(d));
  progression.forEach(d => fail('apres rechargement :', d));
  const langue = await p.evaluate(() => ({ popupLangue: document.getElementById('langPopupOverlay').style.display === 'flex', lang: state.lang, eclats: state.totalShardsEarned, graines: state.cosmicSeeds }));
  console.log('  ', JSON.stringify(langue));
  verifie(!langue.popupLangue && langue.lang === 'en', 'la langue choisie doit etre gardee sans reposer la question');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
