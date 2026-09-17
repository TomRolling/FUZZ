// Familiers : deblocage aux etapes, un seul actif, niveaux en Graines, effets, onglet, migration.
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

  console.log('=== 1. migration d une ancienne sauvegarde (escargot deja gagne) ===');
  await p.evaluate(() => {
    const vieux = { ...state, langChosen: true, tutorialSeen: true, prestigeCount: 2, companionUnlocked: true, lastDailyLoginDate: todayStr() };
    delete vieux.familiers;
    for (const t of TAB_DEFS) { vieux.tabsSeen[t.id] = true; vieux.tabsDescribed[t.id] = true; }
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(vieux));
  });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);
  const mig = await p.evaluate(() => ({ actif: state.familiers.actif, niveau: familierNiveau('escargot'), bonus: familierBonus('escargot'), icone: document.getElementById('companion').textContent, visible: document.getElementById('companion').style.display }));
  console.log('  ', JSON.stringify(mig));
  verifie(mig.actif === 'escargot' && mig.niveau === 1 && Math.abs(mig.bonus - 0.05) < 1e-9, 'l ancien +5 % de l escargot n est pas conserve');
  verifie(mig.icone === '🐌' && mig.visible === 'block', 'escargot absent de l ecran');

  console.log('=== 2. deblocage et choix ===');
  const d = await p.evaluate(() => {
    const dispo = st => FAMILIERS.filter(f => f.unlock(st)).map(f => f.id).join(',');
    const r = { p0: dispo({ prestigeCount: 0 }), p1: dispo({ prestigeCount: 1 }), p3: dispo({ prestigeCount: 3 }), a3: dispo({ prestigeCount: 3, totalAscensions: 3 }) };
    choisirFamilier('grenouille'); r.verrouille = state.familiers.actif; // grenouille pas encore offerte (2 Prestiges)
    return r;
  });
  console.log('  ', JSON.stringify(d));
  verifie(d.p0 === '' && d.p1 === 'escargot' && d.p3 === 'escargot,grenouille' && d.a3.split(',').length === 5, 'etapes de deblocage incorrectes');
  verifie(d.verrouille === 'escargot', 'un familier verrouille a pu etre choisi');

  console.log('=== 3. effets du familier actif, un seul a la fois ===');
  const e = await p.evaluate(() => {
    state.prestigeCount = 3; state.totalAscensions = 3;
    const prodEsc = totalProdMultiplier(), clicEsc = totalClickFlatMultiplier(), savoirEsc = knowledgeRate(), prixEsc = companionPriceMult();
    choisirFamilier('grenouille');
    const r = { prod: totalProdMultiplier() / prodEsc, clic: totalClickFlatMultiplier() / clicEsc };
    choisirFamilier('chouette'); r.savoir = savoirEsc > 0 ? knowledgeRate() / savoirEsc : null;
    choisirFamilier('abeille'); r.prix = companionPriceMult() / prixEsc;
    choisirFamilier('herisson');
    state.uniqueBuildings = { siffletMare: true }; state.activeCooldowns = {};
    activateUniqueAbility('siffletMare');
    r.dureeSifflet = Math.round((_boosts.ability.totalMs) / 1000);
    r.icone = (renderAll(), document.getElementById('companion').textContent);
    return r;
  });
  console.log('  ', JSON.stringify(e));
  verifie(Math.abs(e.prod - 1 / 1.05) < 1e-9, 'quitter l escargot doit retirer son +5 %');
  verifie(Math.abs(e.clic - 1.1) < 1e-9, 'grenouille : +10 % clic attendu');
  verifie(e.savoir === null || Math.abs(e.savoir - 1.1) < 1e-9, 'chouette : +10 % Connaissances attendu');
  verifie(Math.abs(e.prix - 0.98) < 1e-9, 'abeille : -2 % de prix attendu');
  verifie(e.dureeSifflet === 132, 'herisson : duree du sifflet attendue 120 s x 1,1');
  verifie(e.icone === '🦔', 'le familier affiche ne suit pas le choix');

  console.log('=== 4. amelioration avec des Graines ===');
  const a = await p.evaluate(() => {
    choisirFamilier('escargot'); state.cosmicSeeds = 5;
    ameliorerFamilier('escargot'); const n2 = familierNiveau('escargot'), graines2 = state.cosmicSeeds;   // 2 Graines
    ameliorerFamilier('escargot'); const n3 = familierNiveau('escargot');                                 // 3 Graines -> 0
    ameliorerFamilier('escargot'); const bloque = familierNiveau('escargot');                             // plus assez
    state.cosmicSeeds = 1e6; for (let i = 0; i < 20; i++) ameliorerFamilier('escargot');
    return { n2, graines2, n3, bloque, max: familierNiveau('escargot'), bonusMax: familierBonus('escargot'), grainesDepensees: 1e6 - state.cosmicSeeds };
  });
  console.log('  ', JSON.stringify(a));
  verifie(a.n2 === 2 && a.graines2 === 3 && a.n3 === 3 && a.bloque === 3, 'couts ou niveaux incorrects');
  verifie(a.max === 10 && Math.abs(a.bonusMax - 0.5) < 1e-9, 'niveau max ou bonus max incorrect');
  verifie(a.grainesDepensees === 5 + 8 + 13 + 21 + 34 + 55 + 89, 'Graines depensees au-dela du niveau max');

  console.log('=== 5. onglet Familiers ===');
  const ui = await p.evaluate(() => {
    openModal('shopPageOverlay'); activeShopTab = 'familiers'; renderAll();
    const lignes = [...document.querySelectorAll('#familiersList .upgrade')].map(x => ({ id: x.dataset.rowId, detail: (x.querySelector('.prodLine') || {}).textContent || '', actions: x.querySelector('.price').textContent.trim() }));
    document.querySelector('#familiersList [data-row-id="grenouille"] [data-action="choisir"]').click();
    return { lignes, apresClic: state.familiers.actif };
  });
  console.log('  ', JSON.stringify(ui));
  verifie(ui.lignes.length === 5, '5 familiers attendus');
  verifie(/Niveau 10\/10 : \+50 % de production/.test(ui.lignes[0].detail), 'detail de l escargot incorrect');
  verifie(ui.apresClic === 'grenouille', 'le bouton Choisir ne fonctionne pas');
  await p.screenshot({ path: __dirname + '/captures/familiers.png', clip: { x: 530, y: 120, width: 740, height: 680 } });

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
