// Audit d'agression (releve, pas un test de la suite) : on maltraite le jeu comme un joueur
// enerve ou un bug de materiel le ferait, et on regarde si quelque chose casse ou devient
// absurde. Tout ce qui est verifie ici est du domaine du « ca ne devrait jamais arriver » :
//   - aucune erreur JavaScript, jamais ;
//   - aucun NaN, Infinity, undefined ni [object Object] affiche au joueur ;
//   - aucune ressource negative, aucun achat gratuit ;
//   - la sauvegarde survit a tout ce qu'on lui fait subir.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problemes = 0;
const fail = (...m) => { console.log('  X', ...m); problemes++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };
const ok = (m) => console.log('  ok  ' + m);

// Textes qui ne doivent JAMAIS apparaitre a l'ecran.
const INTERDITS = /(NaN|Infinity|undefined|null|\[object Object\]|\{\{|\}\})/;

async function nouvellePage(b, etat = {}, taille = { width: 1280, height: 820 }) {
  const p = await b.newPage({ viewport: taille });
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 140)); });
  await p.goto(filePath);
  await p.evaluate((e) => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), ...e };
    if (e.toutVu) for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  }, etat);
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 20000 });
  await p.waitForTimeout(900);
  p._erreurs = erreurs;
  return p;
}

// Ramasse tout le texte visible a l'ecran et le confronte aux interdits.
const texteVisible = (p) => p.evaluate(() => {
  const out = [];
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;                 // feuilles seulement
    const t = (el.textContent || '').trim();
    if (t && visible(el)) out.push(t);
  }
  return out;
});

(async () => {
  const b = await chromium.launch();

  // ---------- 1. Singe : 400 clics au hasard partout dans l'interface ----------
  console.log('=== 1. clics aleatoires (400 actions, tout est deverrouille) ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 1e12, knowledge: 5000, cosmicSeeds: 50,
      stellarShards: 8, totalSeedsEarned: 80, prestigeCount: 5, totalAscensions: 2, totalClicks: 9000, totalPlayTimeSec: 2e5 });
    const bilan = await p.evaluate(async () => {
      const pause = (ms) => new Promise(r => setTimeout(r, ms));
      let clics = 0, ouvertures = 0;
      for (let i = 0; i < 400; i++) {
        const cibles = [...document.querySelectorAll('button, .drawerBtn, .upgrade, .floatBtn, .statChip, .clickZone, .tabPanel .achv, .galleryCard')]
          .filter(el => el.offsetParent && getComputedStyle(el).pointerEvents !== 'none');
        if (!cibles.length) { document.getElementById('clickZone').click(); continue; }
        const el = cibles[Math.floor(Math.random() * cibles.length)];
        try { el.click(); clics++; } catch (e) { /* un clic peut fermer ce qu'on visait */ }
        if (i % 40 === 0) { ouvertures++; await pause(30); }
        if (i % 97 === 0) { avancerTemps(60); }
      }
      return { clics, ouvertures, verdure: state.verdure, knowledge: state.knowledge,
               graines: state.cosmicSeeds, eclats: state.stellarShards };
    });
    await p.waitForTimeout(800);
    console.log(`  ${bilan.clics} clics effectues`);
    verifie(p._erreurs.length === 0, 'erreurs pendant les clics aleatoires :', p._erreurs.slice(0, 4).join(' | '));
    for (const [nom, v] of Object.entries(bilan)) {
      if (typeof v !== 'number') continue;
      verifie(Number.isFinite(v), `${nom} n'est pas un nombre fini : ${v}`);
      if (['verdure', 'knowledge', 'graines', 'eclats'].includes(nom)) verifie(v >= 0, `${nom} est negatif : ${v}`);
    }
    const textes = await texteVisible(p);
    const mauvais = textes.filter(t => INTERDITS.test(t));
    verifie(mauvais.length === 0, 'texte interdit a l ecran :', mauvais.slice(0, 5).join(' | '));
    if (!problemes) ok('aucune erreur, aucune ressource negative, aucun texte cassé');
    await p.close();
  }

  // ---------- 2. Valeurs extremes : tres grands nombres partout ----------
  console.log('=== 2. valeurs extremes (1e300) ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 1e300, totalEarned: 1e300, knowledge: 1e200,
      cosmicSeeds: 1e15, stellarShards: 1e12, totalSeedsEarned: 1e15, prestigeCount: 9999, totalAscensions: 500, totalClicks: 1e9 });
    const r = await p.evaluate(async () => {
      const pause = (ms) => new Promise(r => setTimeout(r, ms));
      const vus = [];
      for (const [ov, v, onglets] of [['shopPageOverlay', 'activeShopTab', ['production','clic','batiments','special','recherche','prestige','familiers','ascension','automatisation']],
                                      ['questsModalOverlay', 'activeQuestsTab', ['quetes','dailyreward','defi']],
                                      ['settingsModalOverlay', 'activeSettingsTab', ['options','stats','galerie']]]) {
        openModal(ov);
        for (const o of onglets) { window[v] = o; renderAll(); await pause(40);
          for (const el of document.querySelectorAll(`#${ov} *`)) { if (!el.children.length) { const t = (el.textContent||'').trim(); if (t) vus.push(o + ' | ' + t); } } }
        closeModal(ov); await pause(120);
      }
      openModal('achievementsModalOverlay'); renderAll(); await pause(60);
      for (const el of document.querySelectorAll('#achievementsModalOverlay *')) if (!el.children.length) { const t=(el.textContent||'').trim(); if (t) vus.push('succes | ' + t); }
      closeModal('achievementsModalOverlay');
      return { vus, cps: totalCps(), clic: clickGain() };
    });
    const casses = r.vus.filter(t => INTERDITS.test(t.split(' | ')[1]));
    verifie(p._erreurs.length === 0, 'erreurs avec des valeurs extremes :', p._erreurs.slice(0, 4).join(' | '));
    verifie(casses.length === 0, `${casses.length} texte(s) casse(s) : ` + casses.slice(0, 6).join(' // '));
    verifie(Number.isFinite(r.cps) && Number.isFinite(r.clic), `production ou clic non fini : cps=${r.cps} clic=${r.clic}`);
    console.log(`  ${r.vus.length} textes inspectes dans tous les onglets`);
    if (!casses.length) ok('tous les panneaux restent lisibles a 1e300');
    await p.close();
  }

  // ---------- 3. Sauvegardes malmenees ----------
  console.log('=== 3. sauvegardes abimees, vides, futuristes ===');
  for (const [nom, fabrique] of [
    ['sauvegarde vide', '{}'],
    ['champs manquants', '{"verdure":100}'],
    ['types faux', '{"verdure":"beaucoup","buildings":[],"tabsSeen":null,"clickUpgrades":42}'],
    ['valeurs negatives', '{"verdure":-500,"knowledge":-10,"cosmicSeeds":-3,"totalClicks":-1}'],
    ['version future', '{"saveVersion":999,"verdure":1000}'],
    ['date dans le futur', '{"verdure":1000,"lastSave":' + (Date.now() + 86400000 * 30) + '}'],
    ['json casse', '{"verdure":1000,'],
  ]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
    const erreurs = [];
    p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(filePath);
    await p.evaluate((brut) => { localStorage.setItem('fuzzSave', brut); }, fabrique);
    await p.reload();
    const demarre = await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 20000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(700);
    const etat = demarre ? await p.evaluate(() => ({ verdure: state.verdure, ok: Number.isFinite(state.verdure) && state.verdure >= 0 })) : null;
    const verdict = !demarre ? 'NE DEMARRE PAS' : (erreurs.length ? 'erreurs: ' + erreurs[0].slice(0, 60) : (etat.ok ? 'demarre, verdure ' + Math.round(etat.verdure) : 'verdure invalide: ' + etat.verdure));
    console.log(`  ${nom.padEnd(22)} ${verdict}`);
    verifie(demarre, `${nom} : le jeu ne demarre pas`);
    if (demarre) { verifie(erreurs.length === 0, `${nom} : erreur au chargement`); verifie(etat.ok, `${nom} : verdure invalide`); }
    await p.close();
  }

  // ---------- 4. Achats en rafale : pas d'achat gratuit ni de dette ----------
  console.log('=== 4. achats en rafale (double-clic, clics simultanes) ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 1e7 });
    const r = await p.evaluate(async () => {
      state.verdure = 1e7; state.buildings = {}; renderAll();
      const avantV = state.verdure;
      const id = BUILDINGS[0].id;
      // 200 achats enchaines sans laisser respirer le rendu
      for (let i = 0; i < 200; i++) buyBuilding(id, 1);
      const cout = avantV - state.verdure;
      const possede = state.buildings[id] || 0;
      // buildingCost(b, n) = prix de n exemplaires D'UN COUP, depuis ce qu'on possede deja.
      // Le bareme depuis zero se calcule donc en remettant le compteur a zero le temps du calcul.
      const vrai = state.buildings[id];
      state.buildings[id] = 0;
      const theorique = buildingCost(BUILDINGS[0], possede);
      state.buildings[id] = vrai;
      return { possede, cout, theorique, verdure: state.verdure };
    });
    console.log(`  ${r.possede} achetes, cout ${Math.round(r.cout)} (theorique ${Math.round(r.theorique)}), reste ${Math.round(r.verdure)}`);
    verifie(r.verdure >= 0, 'la Verdure est passee negative apres des achats en rafale');
    verifie(Math.abs(r.cout - r.theorique) < Math.max(1, r.theorique * 1e-9), 'le cout paye ne correspond pas au bareme');
    verifie(p._erreurs.length === 0, 'erreurs pendant les achats :', p._erreurs.slice(0, 3).join(' | '));
    if (r.verdure >= 0) ok('aucun achat gratuit, aucune dette');
    await p.close();
  }

  // ---------- 5. Prestige et ascension a repetition ----------
  console.log('=== 5. dix prestiges et trois ascensions d affilee ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 1e14, totalEarned: 1e14 });
    const r = await p.evaluate(async () => {
      const avant = { graines: state.cosmicSeeds, eclats: state.stellarShards };
      for (let i = 0; i < 10; i++) { state.verdure = 1e14; state.totalEarned = 1e14; doPrestige(true); }
      for (let i = 0; i < 3; i++) { state.totalSeedsEarned = 1e6; state.cosmicSeeds = 1e6; doAscension(true); }
      return { avant, graines: state.cosmicSeeds, eclats: state.stellarShards, prestiges: state.prestigeCount,
               ascensions: state.totalAscensions, verdure: state.verdure, cps: totalCps(),
               fini: ['verdure','knowledge','cosmicSeeds','stellarShards'].every(k => Number.isFinite(state[k])) };
    });
    console.log(`  ${r.prestiges} prestiges, ${r.ascensions} ascensions, graines ${r.graines}, eclats ${r.eclats}`);
    verifie(r.fini, 'une ressource est devenue NaN ou Infinity apres les resets');
    verifie(r.verdure >= 0 && Number.isFinite(r.cps), `etat incoherent : verdure=${r.verdure} cps=${r.cps}`);
    verifie(p._erreurs.length === 0, 'erreurs pendant prestige/ascension :', p._erreurs.slice(0, 3).join(' | '));
    if (r.fini) ok('les remises a zero restent coherentes');
    await p.close();
  }

  // ---------- 6. Aller-retour de sauvegarde ----------
  console.log('=== 6. export puis import : rien ne se perd ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 123456.789, knowledge: 777, cosmicSeeds: 42,
      stellarShards: 7, prestigeCount: 3, totalAscensions: 1, totalClicks: 4321 });
    const r = await p.evaluate(async () => {
      state.buildings = Object.fromEntries(BUILDINGS.slice(0, 10).map((b, i) => [b.id, i + 1]));
      const code = encodeSave();
      // Champs qui bougent tout seuls (le tick tourne pendant le test) : on compare le reste.
      const VOLATILES = new Set(['lastSave', 'totalPlayTimeSec', 'verdureAffichee', 'lastActionTime', 'maxIdleGapSec']);
      const photo = () => JSON.stringify(Object.fromEntries(Object.entries(state).filter(([k]) => !VOLATILES.has(k))));
      const avant = photo();
      state.verdure = 0; state.buildings = {}; state.knowledge = 0; state.cosmicSeeds = 0;
      // applyImportedData recharge la page (c'est voulu) : on teste ici son coeur, applyLoadedState.
      applyLoadedState(JSON.parse(decodeURIComponent(escape(atob(code)))));
      return { egaux: photo() === avant, verdure: state.verdure, batiments: Object.keys(state.buildings).length };
    });
    console.log(`  identique apres import : ${r.egaux ? 'oui' : 'NON'} (verdure ${r.verdure}, ${r.batiments} compagnons)`);
    verifie(r.egaux, 'l etat differe apres un aller-retour export/import');
    await p.close();
  }

  // ---------- 7. Changement de langue en pleine action ----------
  console.log('=== 7. bascule de langue pendant qu une bulle et un menu sont ouverts ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 1e9 });
    const r = await p.evaluate(async () => {
      const pause = (ms) => new Promise(r => setTimeout(r, ms));
      openModal('shopPageOverlay'); activeShopTab = 'production'; renderAll();
      papiSaysFromCategory('shop', { position: 'top-right' });
      await pause(200);
      for (let i = 0; i < 6; i++) { state.lang = state.lang === 'fr' ? 'en' : 'fr'; applyStaticTranslations(); renderAll(); await pause(60); }
      const textes = [...document.querySelectorAll('#shopPageOverlay *')].filter(e => !e.children.length).map(e => (e.textContent||'').trim()).filter(Boolean);
      closeModal('shopPageOverlay');
      return { langue: state.lang, casses: textes.filter(t => /undefined|NaN|\[object/.test(t)).slice(0, 5) };
    });
    verifie(r.casses.length === 0, 'texte casse apres des bascules de langue :', r.casses.join(' | '));
    verifie(p._erreurs.length === 0, 'erreurs pendant la bascule de langue :', p._erreurs.slice(0, 3).join(' | '));
    if (!r.casses.length) ok('six bascules de langue sans degat');
    await p.close();
  }

  // ---------- 8. Redimensionnements brutaux ----------
  console.log('=== 8. redimensionnements pendant une bulle et un menu ===');
  {
    const p = await nouvellePage(b, { toutVu: true, verdure: 1e9 });
    await p.evaluate(() => { openModal('shopPageOverlay'); renderAll(); papiSaysFromCategory('shop', { position: 'top-right' }); });
    for (const [w, h] of [[800, 600], [1920, 1080], [1024, 640], [1280, 820], [600, 900], [1366, 620]]) {
      await p.setViewportSize({ width: w, height: h });
      await p.waitForTimeout(180);
    }
    const r = await p.evaluate(() => {
      const box = document.getElementById('dialogueBox').getBoundingClientRect();
      const dedans = box.top >= -1 && box.left >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
      return { dedans, largeur: Math.round(box.width) };
    });
    verifie(r.dedans, 'la bulle de Papi sort de l ecran apres redimensionnement');
    verifie(p._erreurs.length === 0, 'erreurs pendant les redimensionnements :', p._erreurs.slice(0, 3).join(' | '));
    if (r.dedans) ok('six tailles de fenetre enchainees, la bulle reste a l ecran');
    await p.close();
  }

  console.log(problemes ? `\n${problemes} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problemes ? 1 : 0;
})();
