// Nouvel ordre de decouverte. Trois volets :
//  1) les CONDITIONS de deblocage, testees sur des etats synthetiques (deterministe, sans
//     dependre du rythme de la file d'annonces de Papi) ;
//  2) l'etat REEL au lancement ;
//  3) l'arrivee du Magasin a 200 clics et la place de la bulle de Papi dedans.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  page.on('console', m => { if (m.type() === 'error') fail('console:', m.text()); });
  await page.goto(filePath);
  await page.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; saveGame(); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(2500);

  // ---------- 1. Les conditions de deblocage ----------
  console.log('=== conditions de deblocage ===');
  const cas = await page.evaluate(() => {
    const base = () => ({
      totalClicks: 0, verdure: 0, totalEarned: 0, totalPlayTimeSec: 0, prestigeCount: 0,
      buildings: {}, clickUpgrades: {}, uniqueBuildings: {}, companionBuildings: {},
      achievements: {}, tabsSeen: {}, totalSeedsEarned: 0, totalAscensions: 0,
    });
    const test = (id, st) => TAB_DEFS.find(t => t.id === id).unlock(Object.assign(base(), st));
    return {
      magasinAvant:       test('production', { totalClicks: 199 }),
      magasinApres:       test('production', { totalClicks: 200 }),
      clicApres:          test('clic',       { totalClicks: 200 }),
      // Seuils lus dans le jeu : c'est le prix du premier objet de l'onglet (voir seuilOnglet).
      batimentsAvant:     test('batiments',  { verdure: seuilOnglet('batiments') - 1 }),
      batimentsApres:     test('batiments',  { verdure: seuilOnglet('batiments') }),
      batimentsCumul:     test('batiments',  { verdure: 0, totalEarned: 1e9 }),
      specialAvant:       test('special',    { verdure: seuilOnglet('special') - 1 }),
      specialApres:       test('special',    { verdure: seuilOnglet('special') }),
      rechercheSansBat:   test('recherche',  { totalPlayTimeSec: 3600 }),
      rechercheBatVue:    test('recherche',  { tabsSeen: { batiments: true }, tabsDescribed: {}, totalPlayTimeSec: 3600 }),
      rechercheSansTemps: test('recherche',  { tabsDescribed: { batiments: true }, totalPlayTimeSec: 1799, knowledge: 30 }),
      rechercheSansSavoir: test('recherche', { tabsDescribed: { batiments: true }, totalPlayTimeSec: 1800, knowledge: 0 }),
      rechercheOk:        test('recherche',  { tabsDescribed: { batiments: true }, totalPlayTimeSec: 1800, knowledge: 30 }),
      prestigeAvant:      test('prestige',   { verdure: 4.9e8 }),
      prestigeApres:      test('prestige',   { verdure: 5e8 }),
      prestigeCumul:      test('prestige',   { verdure: 0, totalEarned: 1e12 }),
      quetesAvant:        test('quetes',     { totalPlayTimeSec: 1199 }),
      quetesApres:        test('quetes',     { totalPlayTimeSec: 1200 }),
      bonusJourApres:     test('dailyreward',{ totalPlayTimeSec: 1200 }),
      succesAvant:        test('succes',     {}),
      succesApres:        test('succes',     { achievements: { a_click100: true } }),
      galerieAvant:       test('galerie',    { buildings: { a: 1, b: 1 }, clickUpgrades: { c: true } }),
      galerieApres:       test('galerie',    { buildings: { a: 1, b: 1, c: 1 }, clickUpgrades: { d: true }, uniqueBuildings: { e: true } }),
      optionsToujours:    test('options',    {}),
      statsToujours:      test('stats',      {}),
      journalExiste:      !!TAB_DEFS.find(t => t.id === 'journal'),
      silencieux:         TAB_DEFS.filter(t => t.silent).map(t => t.id),
      groupeBonusJour:    TAB_DEFS.find(t => t.id === 'dailyreward').group,
    };
  });
  const attendu = {
    magasinAvant: false, magasinApres: true, clicApres: true,
    batimentsAvant: false, batimentsApres: true, batimentsCumul: false,
    specialAvant: false, specialApres: true,
    rechercheSansBat: false, rechercheBatVue: false, rechercheSansTemps: false, rechercheOk: true,
    prestigeAvant: false, prestigeApres: true, prestigeCumul: false,
    quetesAvant: false, quetesApres: true, bonusJourApres: true,
    succesAvant: false, succesApres: true,
    galerieAvant: false, galerieApres: true,
    optionsToujours: true, statsToujours: true,
    journalExiste: false,
  };
  for (const [k, v] of Object.entries(attendu)) {
    if (cas[k] !== v) fail(`${k} = ${cas[k]}, attendu ${v}`);
  }
  console.log('  onglets silencieux :', cas.silencieux.join(', '));
  console.log('  groupe du Bonus du jour :', cas.groupeBonusJour);
  if (cas.silencieux.slice().sort().join() !== 'options,stats') fail('onglets silencieux inattendus:', cas.silencieux);
  if (cas.groupeBonusJour !== 'quests') fail('le Bonus du jour doit etre dans le groupe quests');

  // ---------- 2. L'etat reel au lancement ----------
  console.log('=== etat au lancement ===');
  const debut = await page.evaluate(() => ({
    boutons: ['settingsBtn', 'achievementsBtn', 'questsBtn', 'shopBtn']
      .filter(id => getComputedStyle(document.getElementById(id)).display !== 'none'),
    ongletsReglages: [...document.querySelectorAll('#settingsTabsRow .drawerBtn')].map(b => b.dataset.tabId),
    connaissances: getComputedStyle(document.getElementById('knowledgeText')).display !== 'none',
    knowledge: state.knowledge,
    bulle: document.getElementById('dialogueOverlay').classList.contains('visible'),
  }));
  console.log(' ', JSON.stringify(debut));
  if (debut.boutons.join() !== 'settingsBtn') fail('seul le bouton Options doit etre visible, trouve:', debut.boutons);
  if (debut.ongletsReglages.join() !== 'options,stats') fail('Reglages doit contenir options,stats — trouve:', debut.ongletsReglages);
  if (debut.connaissances) fail('les Connaissances ne doivent pas etre visibles au depart');
  if (debut.knowledge > 0) fail('les Connaissances s accumulent avant la presentation de Batiments:', debut.knowledge);
  if (debut.bulle) fail('Papi ne doit rien annoncer au lancement (Options/Stats sont silencieux)');

  // ---------- 3. 200 clics : le Magasin arrive avec Production + Clic ----------
  console.log('=== 200 clics ===');
  await page.evaluate(() => { state.totalClicks = 200; });
  await page.waitForTimeout(2500);
  const apres200 = await page.evaluate(() => ({
    magasinVisible: getComputedStyle(document.getElementById('shopBtn')).display !== 'none',
    halo: document.getElementById('shopBtn').classList.contains('featureHighlight'),
    bulle: document.getElementById('dialogueOverlay').classList.contains('visible'),
    onglets: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].map(b => b.dataset.tabId),
  }));
  console.log(' ', JSON.stringify(apres200));
  if (!apres200.magasinVisible) fail('le bouton Magasin n est pas apparu a 200 clics');
  if (!apres200.halo) fail('Papi ne met pas le bouton Magasin en evidence');
  if (!apres200.bulle) fail('Papi ne presente pas le Magasin');
  // Un onglet a la fois : Clic n'arrive qu'une fois Production presentee (verifie plus bas).
  if (apres200.onglets.join() !== 'production') fail('seule Production doit apparaitre d abord — trouve:', apres200.onglets);

  // ---------- 4. La bulle de Papi se place dans son emplacement reserve ----------
  console.log('=== bulle de Papi dans le magasin ===');
  await page.evaluate(() => document.getElementById('shopBtn').click());
  await page.waitForTimeout(1500);
  const designe = await page.evaluate(() => ({
    doigt: getComputedStyle(document.getElementById('tutorialSpotlightArrow')).display !== 'none',
    halo: [...document.querySelectorAll('#shopTabsRow .drawerBtn.featureHighlight')].map(b => b.dataset.tabId),
  }));
  console.log('  a l ouverture :', JSON.stringify(designe));
  if (!designe.doigt || designe.halo.join() !== 'production') fail('Papi doit designer Production du doigt a l ouverture du magasin');
  // Papi designe d'abord le mini-onglet (doigt « Clique ici ! ») : c'est ce clic qui lance le descriptif.
  await page.evaluate(() => { const b = document.querySelector('#shopTabsRow .drawerBtn.featureHighlight'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const dansMagasin = await page.evaluate(() => {
    const slot = document.getElementById('shopImagePlaceholder').getBoundingClientRect();
    const box = document.getElementById('dialogueBox').getBoundingClientRect();
    return {
      ouvert: document.getElementById('shopPageOverlay').classList.contains('open'),
      dansEmplacement: box.left >= slot.left - 30 && box.right <= slot.right + 30
                    && box.bottom <= slot.bottom + 30 && box.top >= slot.top - 30,
      box: { l: Math.round(box.left), t: Math.round(box.top), r: Math.round(box.right), b: Math.round(box.bottom) },
      slot: { l: Math.round(slot.left), t: Math.round(slot.top), r: Math.round(slot.right), b: Math.round(slot.bottom) },
    };
  });
  console.log(' ', JSON.stringify(dansMagasin));
  if (!dansMagasin.ouvert) fail('le magasin ne s est pas ouvert au clic');
  if (!dansMagasin.dansEmplacement) fail('la bulle de Papi n est pas dans son emplacement reserve');

  // ---------- 5. Une fois Production presentee, Clic apparait a son tour ----------
  console.log('=== enchainement Production -> Clic ===');
  for (let i = 0; i < 40; i++) {
    const v = await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'));
    if (!v) break;
    const avant = await page.evaluate(() => document.getElementById('dialogueText').textContent);
    await page.evaluate(() => document.getElementById('dialogueBox').click());
    await page.waitForTimeout(400);
    if (await page.evaluate(() => document.getElementById('dialogueText').textContent) === avant) break;
  }
  await page.waitForTimeout(700);
  const suite = await page.evaluate(() => ({
    onglets: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].map(b => b.dataset.tabId),
    halo: [...document.querySelectorAll('#shopTabsRow .drawerBtn.featureHighlight')].map(b => b.dataset.tabId),
    doigt: getComputedStyle(document.getElementById('tutorialSpotlightArrow')).display !== 'none',
  }));
  console.log(' ', JSON.stringify(suite));
  if (!suite.onglets.includes('clic')) fail('Clic n apparait pas apres la presentation de Production');
  if (!suite.halo.includes('clic')) fail('Clic n est pas mis en evidence');
  if (!suite.doigt) fail('le doigt ne designe pas le nouvel onglet');

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
