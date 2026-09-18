// Capture du panneau Options (nouveaux reglages de confort + liste des sauvegardes).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

(async () => {
  fs.mkdirSync(path.join(__dirname, 'captures'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {}; // sinon la sauvegarde de fermeture ecrase ce qu'on prepare
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 4e9, prestigeCount: 3, totalEarned: 8.4e9 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    // Deux sauvegardes de jours precedents, pour voir la liste remplie.
    const jour = 86400000, maintenant = Date.now();
    localStorage.setItem('fuzzSave_rotation', JSON.stringify([1, 2].map(n => ({
      jour: 'j-' + n, ts: maintenant - n * jour, jourTs: maintenant - n * jour,
      json: JSON.stringify({ totalEarned: 8.4e9 / (n * 3), prestigeCount: 3 - n, lastSave: maintenant - n * jour }),
    }))));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    hideDialogue(false);
    state.lastBackupTime = Date.now() - 120000;
    localStorage.setItem(SAVE_KEY_BACKUP, JSON.stringify({ ...state, totalEarned: 8.3e9, prestigeCount: 3 }));
    openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    document.getElementById('restoreBackupBtn').click();
    renderAll();
  });
  await p.waitForTimeout(600);
  const out = path.join(__dirname, 'captures', 'options.png');
  await p.screenshot({ path: out });
  console.log('capture ecrite :', out);
  await b.close();
})();
