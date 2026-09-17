// La pop-up de recompense quotidienne n'apparait que sur l'ecran de jeu libre, jamais
// par-dessus un menu, et seulement une fois l'onglet debloque.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const popup = page => page.evaluate(() => document.getElementById('dailyPopupOverlay').style.display === 'flex');

async function boot(browser, onglet) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate((o) => {
    state.langChosen = true; state.tutorialSeen = true;
    for (const t of TAB_DEFS) { if (t.id !== 'dailyreward' || o) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; } }
    state.achievements = { a_click100: true };
    state.lastDailyLoginDate = dateStrForOffset(1); state.dailyLoginStreak = 1;
    saveGame();
  }, onglet);
  await page.reload();
  return page;
}

(async () => {
  const browser = await chromium.launch();

  console.log('=== 1. magasin ouvert des le lancement ===');
  {
    const page = await boot(browser, true);
    await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await page.evaluate(() => openModal('shopPageOverlay'));
    await page.waitForTimeout(3500);
    const pendant = await popup(page);
    console.log('  magasin ouvert pendant 3,5 s, pop-up visible :', pendant);
    if (pendant) fail('la pop-up s affiche par-dessus le magasin');
    await page.evaluate(() => closeModal('shopPageOverlay'));
    await page.waitForTimeout(1600);
    const apres = await page.evaluate(() => ({ popup: document.getElementById('dailyPopupOverlay').style.display === 'flex', jour: state.lastDailyLoginDate === todayStr() }));
    console.log('  apres fermeture :', JSON.stringify(apres));
    if (!apres.popup) fail('la pop-up n arrive pas une fois revenu sur l ecran de jeu');
    if (!apres.jour) fail('la recompense n est pas creditee');
    await page.close();
  }

  console.log('=== 2. onglet pas encore debloque ===');
  {
    const page = await boot(browser, false);
    await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => ({ popup: document.getElementById('dailyPopupOverlay').style.display === 'flex', reclame: state.lastDailyLoginDate === todayStr() }));
    console.log('  ', JSON.stringify(r));
    if (r.popup || r.reclame) fail('recompense donnee alors que l onglet n est pas debloque');
    await page.close();
  }

  console.log('=== 3. bouton Reclamer dans la fenetre des Quetes ===');
  {
    const page = await boot(browser, true);
    // Ouvre la fenetre avant la fin du splash, pour que le tick n'ait jamais l'ecran libre.
    await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await page.evaluate(() => { openModal('questsModalOverlay'); activeQuestsTab = 'dailyreward'; renderAll(); });
    await page.waitForTimeout(600);
    const avant = await page.evaluate(() => ({ popup: document.getElementById('dailyPopupOverlay').style.display === 'flex', bouton: getComputedStyle(document.getElementById('dailyRewardClaimBtn')).display !== 'none' }));
    await page.evaluate(() => document.getElementById('dailyRewardClaimBtn').click());
    await page.waitForTimeout(500);
    const apres = await page.evaluate(() => ({
      popup: document.getElementById('dailyPopupOverlay').style.display === 'flex',
      reclame: state.lastDailyLoginDate === todayStr(),
      toast: [...document.querySelectorAll('.toast')].map(t => t.textContent),
    }));
    console.log('  avant :', JSON.stringify(avant), '| apres clic :', JSON.stringify(apres));
    if (avant.popup) fail('pop-up par-dessus la fenetre des Quetes');
    if (!avant.bouton) fail('bouton Reclamer absent');
    if (apres.popup) fail('le bouton Reclamer ouvre la pop-up par-dessus le menu');
    if (!apres.reclame) fail('le bouton Reclamer ne credite rien');
    await page.evaluate(() => closeModal('questsModalOverlay'));
    await page.waitForTimeout(1600);
    if (await popup(page)) fail('la pop-up reapparait apres avoir deja reclame');
    await page.close();
  }

  console.log('=== 4. icone des objets caches ===');
  {
    const page = await boot(browser, true);
    await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await page.evaluate(() => { state.lastDailyLoginDate = todayStr(); openModal('shopPageOverlay'); });
    await page.waitForTimeout(500);
    const ic = await page.evaluate(() => {
      const el = document.querySelector('#shop .itemIconMystery');
      const cs = getComputedStyle(el);
      const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return 0.299 * r + 0.587 * g + 0.114 * b; };
      return { texte: el.textContent, fond: cs.backgroundColor, couleur: cs.color, lumFond: Math.round(lum(cs.backgroundColor)), lumTexte: Math.round(lum(cs.color)) };
    });
    console.log('  ', JSON.stringify(ic));
    if (ic.texte !== '?') fail('le point d interrogation n est pas un simple « ? »');
    if (!(ic.lumFond < 80 && ic.lumTexte > 180)) fail('icone attendue foncee avec un « ? » clair');
    await page.screenshot({ path: __dirname + '/captures/mystere-icone.png', clip: { x: 530, y: 480, width: 740, height: 330 } });
    await page.close();
  }

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
