// Barre des capacites sur l'ecran de jeu, Prestige qui remet Clic/Batiments/Special a zero,
// petits correctifs (familiers, clic droit, Tout debloquer, taille des cases).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    const st = { ...state, langChosen: true, tutorialSeen: true, prestigeCount: 3, totalAscensions: 3, lastDailyLoginDate: todayStr(), verdure: 1e22 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = { stagiaire: 30, voisin: 12 };
    st.uniqueBuildings = { siffletMare: true, grelotVent: true, tamtamCrapauds: true, chatJardin: true };
    st.activeCooldowns = { grelotVent: Date.now() + 10 * 60000 };
    st.automation = { ...st.automation, abilities: false }; // sinon les capacites pretes partent toutes seules
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1200);

  console.log('=== 1. barre des capacites ===');
  const barre = await p.evaluate(() => [...document.querySelectorAll('#abilityBar .abilityBtn')].map(x => ({ id: x.dataset.rowId, pret: x.classList.contains('ready'), temps: x.querySelector('.abilityTime').textContent, cd: x.style.getPropertyValue('--cd') })));
  console.log('  ', JSON.stringify(barre));
  verifie(barre.length === 3, '3 capacites attendues (le chat n est pas une capacite active)');
  verifie(barre.find(x => x.id === 'grelotVent' && !x.pret && /^(9 min 5\d|10 min 0) sec$/.test(x.temps)), 'grelot en recharge attendu avec le temps exact (9 min 5x sec)');
  verifie(barre.find(x => x.id === 'siffletMare' && x.pret && x.temps === ''), 'sifflet pret attendu');
  await p.click('#abilityBar [data-row-id="siffletMare"]');
  await p.waitForTimeout(1300);
  const apres = await p.evaluate(() => ({ boost: boostMult('ability'), recharge: activeCooldownRemaining('siffletMare') > 0, pret: document.querySelector('#abilityBar [data-row-id="siffletMare"]').classList.contains('ready') }));
  console.log('  ', JSON.stringify(apres));
  verifie(apres.boost === 1.5 && apres.recharge && !apres.pret, 'le clic sur l icone n active pas la capacite');
  await p.click('#abilityBar [data-row-id="grelotVent"]');
  verifie(await p.evaluate(() => boostMult('ability')) === 1.5, 'une capacite en recharge a pu etre activee');
  await p.screenshot({ path: __dirname + '/captures/capacites-ecran.png', clip: { x: 0, y: 150, width: 420, height: 560 } });

  console.log('=== 2. clic droit bloque ===');
  const menu = await p.evaluate(() => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.getElementById('clickZone').dispatchEvent(ev); return ev.defaultPrevented; });
  verifie(menu, 'le menu du clic droit n est pas bloque');

  console.log('=== 3. Prestige : Clic, Batiments et Special remis a zero ===');
  const pr = await p.evaluate(() => {
    state.clickUpgrades = { [CLICK_UPGRADES[0].id]: true }; state.companionBuildings = { cascadeTetards: true };
    state.researchUpgrades = { [RESEARCH[0].id]: true }; const savoir = state.knowledge = 123;
    doPrestige(true);
    return { clic: Object.keys(state.clickUpgrades).length, bat: Object.keys(state.companionBuildings).length, special: Object.keys(state.uniqueBuildings).length, compagnons: Object.keys(state.buildings).length, recherche: Object.keys(state.researchUpgrades).length, savoir: state.knowledge === savoir, barre: document.querySelectorAll('#abilityBar .abilityBtn').length };
  });
  console.log('  ', JSON.stringify(pr));
  verifie(pr.clic === 0 && pr.bat === 0 && pr.special === 0 && pr.compagnons === 0, 'le Prestige doit tout remettre a zero sauf la Recherche');
  verifie(pr.recherche === 1 && pr.savoir, 'la Recherche et les Connaissances doivent rester');
  verifie(pr.barre === 0, 'la barre des capacites doit se vider apres un Prestige');

  console.log('=== 4. familiers : prix seul, Graines en haut ===');
  const fam = await p.evaluate(() => {
    state.cosmicSeeds = 7; openModal('shopPageOverlay'); activeShopTab = 'familiers'; renderAll();
    return { bouton: document.querySelector('#familiersList [data-row-id="escargot"] [data-action="ameliorer"]').textContent.trim(), ressource: document.getElementById('shopResourceBar').textContent };
  });
  console.log('  ', JSON.stringify(fam));
  verifie(/^\d+ 🌌$/.test(fam.bouton), 'le bouton doit afficher seulement le prix');
  verifie(/7 Graines Cosmiques/.test(fam.ressource), 'la ressource affichee doit etre les Graines');

  // Les cases avaient toutes la meme hauteur, partout : 136px, taillees pour l'onglet le plus
  // charge. Les sept onglets sans sprite n'en remplissaient alors que 28%, et on ne voyait que
  // 3,9 objets a l'ecran sur une liste de 39 recherches. La hauteur suit desormais le contenu.
  // Ce qu'on verifie a la place : assez d'objets visibles d'un coup, et pas de dents de scie a
  // l'interieur d'un meme onglet (les objets d'un onglet ont la meme forme, leurs cases aussi).
  console.log('=== 5. cases du magasin : denses, et regulieres dans un onglet ===');
  const tailles = await p.evaluate(() => {
    state.buildings = { stagiaire: 30, voisin: 12, [BUILDINGS[2].id]: 3 };
    const zone = document.querySelector('.shopPageContent').getBoundingClientRect().height;
    const out = {};
    for (const t of TAB_DEFS.filter(t => t.group === 'shop')) {
      activeShopTab = t.id; renderAll();
      const h = [...document.querySelectorAll('#tab-' + t.id + ' .upgrade')].map(r => Math.round(r.getBoundingClientRect().height));
      if (!h.length) continue;
      const moy = h.reduce((a, b) => a + b, 0) / h.length;
      out[t.id] = { min: Math.min(...h), max: Math.max(...h), visibles: +(zone / moy).toFixed(1) };
    }
    return out;
  });
  for (const [onglet, d] of Object.entries(tailles)) {
    console.log(`   ${onglet.padEnd(15)} ${d.min}-${d.max}px, ${d.visibles} cases visibles`);
    verifie(d.visibles >= 5, `onglet ${onglet} : seulement ${d.visibles} cases visibles a l ecran`);
    verifie(d.max <= d.min * 2, `onglet ${onglet} : hauteurs en dents de scie (${d.min} a ${d.max}px)`);
  }

  console.log('=== 6. mode test : Tout debloquer fait apparaitre les boutons ===');
  const p2 = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p2.on('pageerror', e => fail('pageerror:', e.message));
  await p2.goto(filePath);
  await p2.evaluate(() => { const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr() }; window.saveGame = () => {}; localStorage.setItem(SAVE_KEY, JSON.stringify(st)); });
  await p2.reload(); await p2.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p2.waitForTimeout(800);
  const visibles = await p2.evaluate(() => {
    const vus = () => ['shopBtn', 'settingsBtn', 'achievementsBtn', 'questsBtn'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none').length;
    const avant = vus();
    MODE_TEST_ACTIONS.find(g => g[0].includes('Étapes'))[1].find(x => x[0] === 'Tout débloquer')[1]();
    renderAll();
    return { avant, apres: vus() };
  });
  console.log('  ', JSON.stringify(visibles));
  verifie(visibles.apres === 4, 'Tout debloquer doit afficher le magasin et les 3 boutons du haut');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
