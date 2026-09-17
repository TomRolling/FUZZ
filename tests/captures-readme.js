// Captures d'ecran pour le README (rangees dans docs/captures/).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const sortie = path.resolve(__dirname, '../docs/captures');

(async () => {
  fs.mkdirSync(sortie, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1.5 });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4.2e12, knowledge: 1850, cosmicSeeds: 24, totalSeedsEarned: 60, seedsSinceAscension: 44,
      prestigeCount: 7, totalAscensions: 2, stellarShards: 3, totalShardsEarned: 5, totalPlayTimeSec: 96 * 3600 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 14).map((b, i) => [b.id, 120 - i * 7]));
    st.uniqueBuildings = Object.fromEntries(UNIQUE_BUILDINGS.slice(0, 5).map(u => [u.id, true]));
    st.clickUpgrades = Object.fromEntries(CLICK_UPGRADES.slice(0, 10).map(u => [u.id, true]));
    st.companionBuildings = Object.fromEntries(COMPANION_BUILDINGS.slice(0, 7).map(u => [u.id, true]));
    st.researchUpgrades = Object.fromEntries(RESEARCH.slice(0, 18).map(u => [u.id, true]));
    st.achievements = Object.fromEntries(ACHIEVEMENTS.slice(0, 14).map(a => [a.id, true]));
    st.familiers = { actif: 'grenouille', niveaux: { escargot: 4, grenouille: 3 } };
    st.automation = { ...st.automation, abilities: false, buyCompanions: false };
    st.activeCooldowns = { grelotVent: Date.now() + 8 * 60000, tamtamCrapauds: Date.now() + 95 * 1000 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { hideDialogue(false); startTimedBoost('golden', 2, 22000); renderAll(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(sortie, 'jeu.png') });

  await p.evaluate(() => { openModal('shopPageOverlay'); activeShopTab = 'production'; renderAll(); });
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(sortie, 'magasin.png') });

  await p.evaluate(() => { activeShopTab = 'ascension'; renderAll(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(sortie, 'ascension.png') });
  await b.close();
  console.log('captures ecrites dans docs/captures/');
})();
