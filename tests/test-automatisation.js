// Automatisations offertes aux etapes : deblocage, onglet, achat auto, capacites auto, Prestige auto.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

async function boot(browser, setup) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  // L'aide doit exister DANS la page : les fonctions de setup y sont executees, pas dans Node.
  await page.evaluate(() => { window.tousOngletsVusG = () => { state.langChosen = true; state.tutorialSeen = true; for (const t of TAB_DEFS) if (t.id !== 'automatisation') { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; } state.lastDailyLoginDate = todayStr(); }; });
  await page.evaluate(setup);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(800);
  // Le test appelle lui-meme les automatisations, dans des evaluate synchrones ou la vraie boucle
  // (setInterval) ne peut pas s'intercaler. confirm renvoie false : un Prestige qui demanderait
  // confirmation echouerait.
  await page.evaluate(() => { window.__vraiRun = runAutomations; window.confirm = () => false; });
  return page;
}

(async () => {
  const browser = await chromium.launch();

  console.log('=== 1. deblocage aux etapes ===');
  {
    const page = await boot(browser, () => { tousOngletsVusG(); });
    const r = await page.evaluate(() => {
      const t = TAB_DEFS.find(x => x.id === 'automatisation');
      const test = st => AUTOMATIONS.map(a => a.unlock(st) ? 1 : 0).join('');
      return {
        existe: !!t, groupe: t && t.group,
        p2: test({ prestigeCount: 2, totalAscensions: 0 }), p3: test({ prestigeCount: 3, totalAscensions: 0 }),
        a1: test({ prestigeCount: 3, totalAscensions: 1 }), a3: test({ prestigeCount: 3, totalAscensions: 3 }),
        ongletAvant: t.unlock({ prestigeCount: 2, totalAscensions: 0 }), ongletApres: t.unlock({ prestigeCount: 3, totalAscensions: 0 }),
        pAuto1: PRESTIGE_UPGRADES.some(u => u.id === 'p_auto1'),
        defaut: state.automation,
      };
    });
    console.log('  ', JSON.stringify(r));
    if (!r.existe || r.groupe !== 'shop') fail('onglet Automatisation absent du Magasin');
    if (r.p2 !== '000' || r.p3 !== '100' || r.a1 !== '110' || r.a3 !== '111') fail('ordre de deblocage incorrect');
    if (r.ongletAvant || !r.ongletApres) fail('onglet debloque au mauvais moment');
    if (r.pAuto1) fail('l ancien Assistant jardinier est encore en vente');
    if (!r.defaut || !r.defaut.buyCompanions || !r.defaut.abilities || r.defaut.prestige) fail('reglages par defaut incorrects');
    await page.close();
  }

  console.log('=== 2. achat automatique des compagnons ===');
  {
    const page = await boot(browser, () => { tousOngletsVusG(); state.prestigeCount = 3; state.buildings = { stagiaire: 5 }; state.itemPopupsShown = { stagiaire: true }; saveGame(); });
    const r = await page.evaluate(() => {
      state.verdure = 5000;
      const avant = JSON.stringify(state.buildings);
      for (let i = 0; i < 6; i++) __vraiRun();
      const apres = { ...state.buildings };
      const caches = productionHidden();
      const achetesCaches = Object.keys(apres).filter(id => caches.has(id) && !(state.itemPopupsShown || {})[id]);
      state.automation.buyCompanions = false; state.verdure = 1e6;
      const figes = JSON.stringify(state.buildings);
      for (let i = 0; i < 6; i++) __vraiRun();
      return { avant, apres, verdure: Math.round(state.verdure), achetesCaches, eteintNachetePas: JSON.stringify(state.buildings) === figes };
    });
    console.log('  ', JSON.stringify(r));
    if (r.avant === JSON.stringify(r.apres)) fail('rien n a ete achete automatiquement');
    if (r.achetesCaches.length) fail('un compagnon cache a ete achete');
    if (!r.eteintNachetePas) fail('l achat continue alors que l automatisation est eteinte');
    await page.close();
  }

  console.log('=== 3. capacites automatiques ===');
  {
    const page = await boot(browser, () => { tousOngletsVusG(); state.prestigeCount = 3; state.totalAscensions = 1; state.uniqueBuildings = { siffletMare: true }; state.buildings = { stagiaire: 50 }; state.automation = { buyCompanions: false, abilities: true, prestige: false, prestigeSeeds: 10 }; saveGame(); });
    const r = await page.evaluate(() => { __vraiRun(); return { recharge: activeCooldownRemaining('siffletMare') > 0, bonus: boostMult('ability') }; });
    console.log('  ', JSON.stringify(r));
    if (!r.recharge || r.bonus < 1.5) fail('la capacite n a pas ete declenchee');
    await page.close();
  }

  console.log('=== 4. Prestige automatique ===');
  {
    const page = await boot(browser, () => { tousOngletsVusG(); state.tabsSeen.automatisation = true; state.tabsDescribed.automatisation = true; state.prestigeCount = 5; state.totalAscensions = 3; state.automation = { buyCompanions: false, abilities: false, prestige: true, prestigeSeeds: 2 }; saveGame(); /* onglet deja presente : un tutoriel en cours bloque (a raison) le Prestige auto */ });
    const r = await page.evaluate(() => {
      state.verdure = PRESTIGE_DIVISOR * 1.5;      // gain de 1 : sous la cible de 2
      __vraiRun(); const apres1 = state.prestigeCount;
      state.verdure = PRESTIGE_DIVISOR * 8.5;      // gain de 2 : cible atteinte
      __vraiRun();
      return { avant: 5, sousCible: apres1, cibleAtteinte: state.prestigeCount, verdure: state.verdure };
    });
    console.log('  ', JSON.stringify(r));
    if (r.sousCible !== 5) fail('Prestige declenche sous la cible');
    if (r.cibleAtteinte !== 6) fail('Prestige automatique non declenche (ou demande de confirmation)');
    await page.close();
  }

  console.log('=== 5. panneau et reglages ===');
  {
    const page = await boot(browser, () => { tousOngletsVusG(); state.tabsSeen.automatisation = true; state.tabsDescribed.automatisation = true; state.prestigeCount = 4; state.totalAscensions = 3; saveGame(); });
    const r = await page.evaluate(() => {
      openModal('shopPageOverlay'); activeShopTab = 'automatisation'; renderAll();
      const lignes = [...document.querySelectorAll('#automationList .upgrade')].map(x => x.querySelector('.price').textContent.trim());
      document.querySelector('#automationList [data-row-id="buyCompanions"] [data-action="toggle"]').click();
      const apresToggle = state.automation.buyCompanions;
      document.querySelector('#automationList [data-row-id="prestige"] [data-action="10"]').click();
      document.querySelector('#automationList [data-row-id="prestige"] [data-action="-1"]').click();
      return { lignes, apresToggle, seuil: state.automation.prestigeSeeds, affiche: document.querySelector('#automationList [data-row-id="prestige"] .autoSeuil b').textContent };
    });
    console.log('  ', JSON.stringify(r));
    if (r.lignes.length !== 3) fail('3 automatisations attendues');
    if (r.apresToggle !== false) fail('l interrupteur ne coupe pas l achat auto');
    if (r.seuil !== 19 || r.affiche !== '19') fail('reglage du seuil incorrect (10 + 10 - 1 = 19)');
    await page.screenshot({ path: __dirname + '/captures/automatisation.png', clip: { x: 530, y: 120, width: 740, height: 480 } });
    await page.close();
  }

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
