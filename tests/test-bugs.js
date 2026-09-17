const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

async function boot(browser, w, h, skipTuto) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate((skip) => { state.langChosen = true; if (skip) { state.langChosen = true; state.tutorialSeen = true; state.totalClicks = 200; state.tabsSeen = { options: true, stats: true, production: true, clic: true }; saveGame(); } }, skipTuto);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(400);
  if (!skipTuto) {
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => document.getElementById('tutorialOverlay').style.display === 'flex')) break;
      await page.evaluate(() => document.getElementById('sceneOverlay').click());
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());
    // Le Magasin n'arrive plus juste apres l'intro : il demande 200 clics. On les donne pour
    // que Papi vienne le presenter, ce que la suite du test attend.
    await page.waitForTimeout(1500);
    await page.evaluate(() => { state.totalClicks = 200; renderTabsRow(); });
  }
  return page;
}

(async () => {
  const browser = await chromium.launch();

  // ---- 1. halo sur la zone de liste + capture ----
  console.log('=== 1. halo autour de la zone d achat ===');
  {
    const page = await boot(browser, 1280, 820, false);
    for (let s = 0; s < 25; s++) {
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display === 'block')) break;
    }
    await page.evaluate(() => document.getElementById('shopBtn').click());
    await page.waitForTimeout(1000);
  // Papi designe d'abord le mini-onglet (doigt « Clique ici ! ») : c'est ce clic qui lance le descriptif.
  await page.evaluate(() => { const b = document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'); if (b) b.click(); });
  await page.waitForTimeout(700);
    const z = await page.evaluate(() => {
      const el = document.querySelector('.tutorialZoneHighlight');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const rows = el.querySelectorAll('.upgrade').length;
      return { cls: el.className, id: el.id, w: Math.round(r.width), h: Math.round(r.height), rowsDedans: rows,
               scrollable: getComputedStyle(el).overflowY };
    });
    console.log('  zone halo:', JSON.stringify(z));
    if (!z) fail('aucune zone avec halo');
    else {
      if (z.rowsDedans < 3) fail('le halo n entoure pas la liste (seulement', z.rowsDedans, 'lignes dedans)');
      if (z.scrollable !== 'auto' && z.scrollable !== 'scroll') fail('le halo n est pas sur le conteneur qui defile');
    }
    await page.screenshot({ path: 'halo-magasin.png' });
    console.log('  capture: halo-magasin.png');

    // ---- 3. impossible de fermer pendant l explication ----
    console.log('=== 3. fermeture bloquee pendant l explication ===');
    const before = await page.evaluate(() => document.getElementById('shopPageOverlay').classList.contains('open'));
    await page.evaluate(() => document.getElementById('shopPageCloseBtn').click());
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      open: document.getElementById('shopPageOverlay').classList.contains('open'),
      boxLeft: Math.round(document.getElementById('dialogueBox').getBoundingClientRect().left),
      boxTop: Math.round(document.getElementById('dialogueBox').getBoundingClientRect().top),
    }));
    console.log('  avant:', before, '| apres tentative de fermeture:', JSON.stringify(after));
    if (!after.open) fail('le magasin s est ferme alors que Papi expliquait encore');
    if (after.boxLeft < 40 && after.boxTop < 40) fail('la bulle est partie dans le coin haut-gauche');

    // Une fois TOUT le parcours du magasin termine (Papi enchaine Production puis Clic), la
    // fermeture doit redevenir possible : on suit le parcours guide comme un joueur.
    for (let step = 0; step < 10; step++) {
      for (let i = 0; i < 40; i++) {
        if (!await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'))) break;
        const avant = await page.evaluate(() => document.getElementById('dialogueText').textContent);
        await page.evaluate(() => document.getElementById('dialogueBox').click());
        await page.waitForTimeout(300);
        const apres = await page.evaluate(() => ({ v: document.getElementById('dialogueOverlay').classList.contains('visible'), t: document.getElementById('dialogueText').textContent }));
        if (apres.v && apres.t === avant) break;
      }
      const hl = await page.evaluate(() => { const b = document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'); return b ? b.dataset.tabId : null; });
      if (!hl) break;
      await page.evaluate(id => document.querySelector(`[data-tab-id="${id}"]`).click(), hl);
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => document.getElementById('shopPageCloseBtn').click());
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => document.getElementById('shopPageOverlay').classList.contains('open'));
    console.log('  apres la fin de l explication, encore ouvert ?', closed, '(attendu: false)');
    if (closed) fail('impossible de fermer le magasin meme apres la fin du tutoriel');
    await page.close();
  }

  // ---- 2. survol stable malgre les rendus repetes ----
  console.log('=== 2. survol d une ligne du magasin ===');
  {
    const page = await boot(browser, 1280, 820, true);
    await page.evaluate(() => { state.verdure = 500; openModal('shopPageOverlay'); renderAll(); });
    await page.waitForTimeout(400);
    const row = await page.$('#tab-production .upgrade');
    const box = await row.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    // On observe l element sous le curseur pendant que le jeu tourne (rendus a repetition).
    const obs = await page.evaluate(async () => {
      const el = document.querySelector('#tab-production .upgrade');
      let sameNode = 0, hovered = 0, total = 0, rebuilds = 0;
      const first = el;
      let lastHtml = el.innerHTML;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        const cur = document.querySelector('#tab-production .upgrade');
        total++;
        if (cur === first) sameNode++;
        if (cur && cur.matches(':hover')) hovered++;
        if (cur && cur.innerHTML !== lastHtml) { rebuilds++; lastHtml = cur.innerHTML; }
      }
      return { total, sameNode, hovered, rebuilds };
    });
    console.log('  ', JSON.stringify(obs));
    if (obs.sameNode !== obs.total) fail('la ligne est recreee pendant le survol (' + obs.sameNode + '/' + obs.total + ')');
    if (obs.hovered !== obs.total) fail('le survol se perd (' + obs.hovered + '/' + obs.total + ' echantillons survoles)');
    await page.close();
  }

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
