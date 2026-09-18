// Capture du panneau de mode test (Ctrl+Maj+D), saison forcee, pour verifier a l'oeil.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const saison = process.argv[2] || '🎃 Halloween';

(async () => {
  fs.mkdirSync(path.join(__dirname, 'captures'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 4e9, prestigeCount: 2 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 10).map((b, i) => [b.id, 60 - i * 5]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => hideDialogue(false));
  await p.keyboard.press('Control+Shift+D');
  await p.waitForTimeout(250);
  await p.evaluate(l => {
    const b = [...document.querySelectorAll('#modeTestPanel button')].find(x => x.textContent.trim() === l);
    if (b) b.click();
  }, saison);
  await p.waitForTimeout(1200);
  const out = path.join(__dirname, 'captures', 'mode-test-saisons.png');
  await p.screenshot({ path: out });
  console.log('capture ecrite :', out);
  await b.close();
})();
