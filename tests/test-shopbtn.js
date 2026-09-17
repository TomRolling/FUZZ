// Le bouton du magasin ne doit plus bouger (ni au survol, ni pendant un combo) : c'est le
// deplacement d'une image `image-rendering: pixelated` qui la faisait gresiller.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const R = () => { const b = document.getElementById('shopBtn'); const r = b.getBoundingClientRect();
  return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), tf: getComputedStyle(b).transform }; };

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1280, 820], [1920, 1040]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => fail('pageerror:', e.message));
    await page.goto(filePath);
    await page.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; state.lastDailyLoginDate = todayStr(); state.tabsSeen.production = true; state.tabsDescribed.production = true; saveGame(); });
    await page.reload();
    await page.waitForTimeout(900);

    const base = await page.evaluate(R);
    const box = await (await page.$('#shopBtn')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    const hover = await page.evaluate(R);

    // combo : on clique vite, puis on remesure
    await page.mouse.move(w / 2, h / 2);
    for (let i = 0; i < 12; i++) { await page.mouse.click(w / 2, h / 2); }
    await page.waitForTimeout(300);
    const combo = await page.evaluate(() => ({ ...(() => { const b = document.getElementById('shopBtn'); const r = b.getBoundingClientRect();
      return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), tf: getComputedStyle(b).transform }; })(), comboCount }));

    console.log(`${w}x${h}`);
    console.log('  repos :', JSON.stringify(base));
    console.log('  survol:', JSON.stringify(hover));
    console.log('  combo :', JSON.stringify(combo));
    if (base.tf !== 'none') fail('le bouton porte encore un transform au repos:', base.tf);
    if (hover.tf !== 'none') fail('le bouton porte un transform au survol:', hover.tf);
    if (hover.x !== base.x || hover.y !== base.y) fail('le bouton bouge au survol');
    if (combo.x !== base.x || combo.y !== base.y) fail('le bouton bouge pendant un combo');
    if (Math.abs(base.x + base.w / 2 - w / 2) > 1) fail('le bouton n est plus centre:', base.x, base.w);
    // centre sur un pixel entier -> pas de re-echantillonnage a demi-pixel
    if (Math.abs(base.x - Math.round(base.x)) > 0.01) fail('bouton sur un demi-pixel:', base.x);
    await page.close();
  }
  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
