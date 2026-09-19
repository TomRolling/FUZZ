// Papi commente les achats : une replique propre a chaque onglet du magasin, toujours au
// premier achat d'un onglet, jamais sur un achat automatique, et pas a chaque fois ensuite.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

const ONGLETS = ['production', 'clic', 'batiments', 'special', 'recherche', 'prestige', 'familiers', 'ascension', 'automatisation'];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      hasEverPurchased: true, verdure: 1e30, knowledge: 1e9, cosmicSeeds: 1e6, stellarShards: 500,
      prestigeCount: 10, totalAscensions: 5, totalSeedsEarned: 1e5, totalPlayTimeSec: 1e5 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);

  // 1. Chaque onglet est bien relie a un pool. L'equilibre fr/en et l'absence de doublon sont
  // deja verifies pour TOUS les pools par test-papi-visite.js : inutile de le refaire ici.
  const sansPool = await p.evaluate((ONGLETS) => ONGLETS.filter(o => !PAPI_LINES[CATEGORIE_ACHAT[o]]), ONGLETS);
  verifie(sansPool.length === 0, 'onglet(s) sans repliques :', sansPool.join(', '));
  console.log(`  ${ONGLETS.length - sansPool.length}/${ONGLETS.length} onglets ont leurs repliques`);

  // 2. Le premier achat de chaque onglet fait parler Papi, avec une phrase DE CET ONGLET.
  const achats = await p.evaluate(async () => {
    const dit = {};
    const lireBulle = () => {
      const box = document.getElementById('shopComment');
      const visible = box && box.style.display !== 'none';
      return visible ? document.getElementById('shopCommentText').textContent.trim() : '';
    };
    const essaie = async (onglet, action) => {
      hideShopComment();
      action();
      await new Promise(r => setTimeout(r, 260));
      dit[onglet] = lireBulle();
    };
    openModal('shopPageOverlay');
    state.ongletsAchetes = {};
    await essaie('production', () => buyBuilding(BUILDINGS[0].id, 1));
    await essaie('clic', () => buyClickUpgrade(CLICK_UPGRADES[0].id));
    await essaie('batiments', () => buyCompanionBuilding(COMPANION_BUILDINGS[0].id));
    await essaie('special', () => buyUnique(UNIQUE_BUILDINGS[0].id));
    await essaie('recherche', () => buyResearch(RESEARCH[0].id));
    await essaie('prestige', () => buyPrestigeUpgrade(PRESTIGE_UPGRADES[0].id));
    await essaie('familiers', () => { state.familiers.niveaux.escargot = 1; ameliorerFamilier('escargot'); });
    await essaie('ascension', () => buyAscensionUpgrade(ASCENSION_UPGRADES[0].id));
    return dit;
  });
  for (const o of ONGLETS.filter(x => x !== 'automatisation')) {
    const texte = achats[o] || '';
    const duPool = await p.evaluate(([o, texte]) => !!texte && PAPI_LINES[CATEGORIE_ACHAT[o]].fr.some(l => l.startsWith(texte.slice(0, 14))), [o, texte]);
    verifie(!!texte, `aucune replique au premier achat de l onglet « ${o} »`);
    verifie(duPool, `la replique de « ${o} » ne vient pas de son pool : « ${texte.slice(0, 50)} »`);
  }

  // 3. Un achat automatique ne fait pas parler Papi.
  const auto = await p.evaluate(async () => {
    hideShopComment();
    state.ongletsAchetes = { production: true };
    _dernierMotAchat = 0;
    for (let i = 0; i < 30; i++) notifyPurchase(1, 'production', true);
    await new Promise(r => setTimeout(r, 200));
    const box = document.getElementById('shopComment');
    return box.style.display !== 'none';
  });
  verifie(!auto, 'Papi commente les achats faits par l automatisation');

  // 4. Une serie d'achats a la main ne declenche pas une avalanche de repliques.
  const serie = await p.evaluate(async () => {
    let bulles = 0;
    const vrai = showShopComment;
    window.showShopComment = (c) => { bulles++; return vrai(c); };
    state.ongletsAchetes = { production: true };
    _dernierMotAchat = Date.now();
    for (let i = 0; i < 60; i++) notifyPurchase(1, 'production');
    window.showShopComment = vrai;
    return bulles;
  });
  verifie(serie <= 2, `${serie} repliques pour 60 achats d affilee : c est trop bavard`);
  console.log(`  60 achats rapides -> ${serie} replique(s)`);

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
