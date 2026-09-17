// Au 3e Prestige, Papi presente l'onglet Automatisation comme les autres : bouton du Magasin mis
// en evidence, doigt sur le mini-onglet, descriptif au clic.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    for (const t of TAB_DEFS) if (t.id !== 'automatisation') { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; }
    state.lastDailyLoginDate = todayStr(); state.prestigeCount = 2; saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const avant = await page.evaluate(() => ({ vu: !!state.tabsSeen.automatisation, halo: document.getElementById('shopBtn').classList.contains('featureHighlight') }));
  console.log('  au 2e Prestige :', JSON.stringify(avant));
  if (avant.vu || avant.halo) fail('onglet annonce trop tot');

  await page.evaluate(() => { state.prestigeCount = 3; });
  let halo = false;
  for (let i = 0; i < 30 && !halo; i++) { await page.waitForTimeout(250); halo = await page.evaluate(() => document.getElementById('shopBtn').classList.contains('featureHighlight')); }
  console.log('  au 3e Prestige, bouton du Magasin en evidence :', halo);
  if (!halo) fail('Papi ne presente pas l onglet Automatisation');
  await page.evaluate(() => document.getElementById('shopBtn').click());
  await page.waitForTimeout(900);
  const designe = await page.evaluate(() => ({
    doigt: getComputedStyle(document.getElementById('tutorialSpotlightArrow')).display !== 'none',
    halo: [...document.querySelectorAll('#shopTabsRow .drawerBtn.featureHighlight')].map(b => b.dataset.tabId),
  }));
  console.log('  dans le Magasin :', JSON.stringify(designe));
  if (!designe.doigt || designe.halo.join() !== 'automatisation') fail('le doigt ne designe pas le mini-onglet Automatisation');
  await page.evaluate(() => document.querySelector('#shopTabsRow [data-tab-id="automatisation"]').click());
  await page.waitForTimeout(800);
  const desc = await page.evaluate(() => ({ bulle: isDialogueVisible(), texte: document.getElementById('dialogueText').textContent.slice(0, 60), actif: activeShopTab, lignes: document.querySelectorAll('#automationList .upgrade').length }));
  console.log('  apres le clic :', JSON.stringify(desc));
  if (!desc.bulle || desc.actif !== 'automatisation') fail('pas de descriptif de l onglet');
  if (desc.lignes !== 3) fail('le panneau n affiche pas les 3 automatisations');
  await page.screenshot({ path: __dirname + '/captures/automatisation-papi.png' });

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
