// Banc d'essai d'equilibrage : un bot joue au VRAI jeu (dist/index.html) sous horloge virtuelle,
// avec des reglages optionnels appliques par-dessus (fichier de configuration), et mesure :
//  - les jalons (onglets, Prestiges, Ascensions) ;
//  - l'utilite de chaque objet : quand il est achete pour la premiere fois, ou jamais ;
//  - la repartition des achats entre onglets au fil du temps ;
//  - la part du revenu venant de la production, des clics, des herbes dorees, des papillons,
//    des capacites du Special.
//
// Usage : node banc.js <config.js> [attentif|clics] [graine] [heuresMax]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const CONFIG = require(path.resolve(process.argv[2] || './equilibre-actuel.js'));
const PROFIL = process.argv[3] || 'attentif';
const GRAINE = parseInt(process.argv[4] || '42', 10);
const HEURES_MAX = parseFloat(process.argv[5] || '150');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.addInitScript((graine) => {
    let vt = 1.8e12;
    Date.now = () => vt;
    window.__avancer = ms => { vt += ms; };
    let a = graine >>> 0;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.setInterval = () => 0; window.setTimeout = () => 0; window.requestAnimationFrame = () => 0;
    try { localStorage.clear(); } catch (e) {}
  }, GRAINE);
  await page.goto(filePath);
  await page.waitForTimeout(500);

  await page.evaluate(({ profil, cfg }) => {
    const noop = () => {};
    for (const f of ['renderAll', 'scheduleRenderAll', 'saveGame', 'showToast', 'playBuySound', 'playAchievementSound',
      'playGoldenSound', 'playPrestigeSound', 'queueOrShowPapi', 'papiSaysFromCategory', 'showDialogue', 'notifyPurchase',
      'bump', 'updateComboBadge', 'showCompanionRevealPopup', 'flushPendingPapiCategories']) window[f] = noop;
    window.maybeShowItemAcquiredPopup = (id) => { state.itemPopupsShown[id] = true; };
    window.confirm = () => true;
    state.langChosen = true; state.tutorialSeen = true;
    // Reglages essayes (tables et formules), appliques APRES le chargement du jeu.
    if (cfg.patch) (0, eval)(cfg.patch);

    const ATTENTIF = profil === 'attentif';
    const CPS_CLICS = 7;
    const G = cfg.golden, P = cfg.butterfly;
    const E_OR = ATTENTIF ? 1 + ((G.instantSec + (G.boostMult - 1) * G.boostSec) / 2) / ((G.min + G.max) / 2 + 2.5) : 1;
    const E_PAP = ATTENTIF ? 1 + (P.mult - 1) * P.sec / ((P.min + P.max) / 2 + 2.5) : 1;
    comboCount = 40;

    const B = window.__bot = {
      t: 0, jalons: {}, prestiges: [], ascensions: [], prochainOr: G.min, prochainPap: P.min, prochainChat: 3600,
      premierAchat: {}, achatsParOnglet: [], revenus: [], parts: { production: 0, clics: 0, herbes: 0, papillons: 0, capacites: 0 },
      evenements: [], paliersRun: {}, defis: [],
    };
    const ONGLET = {};
    for (const [liste, onglet] of [[BUILDINGS, 'production'], [CLICK_UPGRADES, 'clic'], [COMPANION_BUILDINGS, 'batiments'], [UNIQUE_BUILDINGS, 'special'],
      [RESEARCH, 'recherche'], [RESEARCH_INFINITE, 'recherche'], [PRESTIGE_UPGRADES, 'prestige'], [ASCENSION_UPGRADES, 'ascension']]) for (const x of liste) ONGLET[x.id] = onglet;
    function noterAchat(id) {
      if (B.premierAchat[id] == null) { B.premierAchat[id] = B.t; B.evenements.push({ t: B.t, quoi: 'achat ' + id }); }
      const fenetre = Math.floor(B.t / 7200);
      const f = B.achatsParOnglet[fenetre] || (B.achatsParOnglet[fenetre] = {});
      f[ONGLET[id]] = (f[ONGLET[id]] || 0) + 1;
    }
    // Chaque achat reel passe par ces fonctions : on les enveloppe pour journaliser.
    for (const [fn, possede] of [
      ['buyBuilding', id => state.buildings[id] || 0], ['buyClickUpgrade', id => !!state.clickUpgrades[id]],
      ['buyCompanionBuilding', id => !!state.companionBuildings[id]], ['buyUnique', id => !!state.uniqueBuildings[id]],
      ['buyResearch', id => !!state.researchUpgrades[id]], ['buyResearchInfinite', id => state.researchInfiniteLevels[id] || 0],
      ['buyPrestigeUpgrade', id => !!state.prestigeUpgrades[id]], ['buyAscensionUpgrade', id => !!state.ascensionUpgrades[id]]]) {
      const orig = window[fn];
      window[fn] = function (id, ...rest) { const avant = possede(id); const r = orig.call(this, id, ...rest); if (possede(id) !== avant) noterAchat(id); return r; };
    }

    const vu = id => !!state.tabsSeen[id];
    const clicParSeconde = () => (typeof challengeIs !== 'undefined' && challengeIs('mains')) ? 0 : CPS_CLICS * E_PAP * clickGain() / boostMult('click'); // pas de revenu de clic pendant Mains dans les poches
    const revenu = () => totalCps() / boostMult('ability') * E_OR + clicParSeconde();
    const essai = (appliquer, annuler) => { const avant = revenu(); appliquer(); const apres = revenu(); annuler(); return apres - avant; };

    function objectifVerdure() {
      if (typeof CHALLENGES !== 'undefined' && state.challengeActive && vu('prestige')) {
        const c = CHALLENGES.find(x => x.id === state.challengeActive);
        const boost = 1 + (combinedUpgradeValue('prestigeSeedMult') || 0);
        return (typeof verdureForSeeds !== 'undefined' && !window.__PRESTIGE_DIVISOR && cfg.racinePrestige === 3) ? verdureForSeeds(c.goal) : (window.__PRESTIGE_DIVISOR || PRESTIGE_DIVISOR) * Math.pow(c.goal, cfg.racinePrestige) / boost;
      }
      const seuils = [['batiments', 15000], ['special', 2.5e6], ['prestige', 5e8]].filter(([id]) => !vu(id));
      if (seuils.length) return seuils[0][1];
      const depuis = state.seedsSinceAscension || 0;
      const vise = depuis === 0 ? 1 : Math.max(1, Math.round(cfg.prestigePolicy * depuis));
      const boost = 1 + (combinedUpgradeValue('prestigeSeedMult') || 0);
      return (typeof verdureForSeeds !== 'undefined' && !window.__PRESTIGE_DIVISOR && cfg.racinePrestige === 3) ? verdureForSeeds(vise) : (window.__PRESTIGE_DIVISOR || PRESTIGE_DIVISOR) * Math.pow(vise, cfg.racinePrestige) / boost;
    }

    function candidats() {
      const c = totalCps() / boostMult('ability'), I = revenu();
      const liste = [];
      if (vu('production')) {
        const caches = productionHidden();
        // Valeur d'1 /s de production en plus : herbes dorees + part des clics indexee sur la production.
        const clic0 = clicParSeconde(); const s0 = state.buildings.stagiaire || 0;
        state.buildings.stagiaire = s0 + 1; const dc = totalCps() / boostMult('ability') - c; const dClic = clicParSeconde() - clic0; state.buildings.stagiaire = s0;
        const valeurCps = E_OR + (dc > 0 ? dClic / dc : 0);
        const pm = totalProdMultiplier() / boostMult('ability');
        for (const b of BUILDINGS) if (!caches.has(b.id) && (typeof challengeAllowsBuilding === 'undefined' || challengeAllowsBuilding(b.id)))
          liste.push({ id: b.id, cout: buildingCost(b, 1), gain: buildingCpsPerUnit(b) * pm * valeurCps, acheter: () => buyBuilding(b.id, 1) });
      }
      if (vu('clic')) {
        const caches = hiddenShopItems(CLICK_UPGRADES, x => hasClickUpgrade(x.id));
        for (const u of CLICK_UPGRADES) if (!hasClickUpgrade(u.id) && !caches.has(u.id))
          liste.push({ id: u.id, cout: u.cost, gain: essai(() => { state.clickUpgrades[u.id] = true; }, () => { delete state.clickUpgrades[u.id]; }), acheter: () => buyClickUpgrade(u.id) });
      }
      const remise = typeof uniqueCostMult !== 'undefined' ? uniqueCostMult() : combinedUpgradeValue('uniqueDiscount');
      if (typeof specialDisabled !== 'undefined' && specialDisabled()) return liste;
      if (vu('batiments')) {
        const caches = hiddenShopItems(COMPANION_BUILDINGS, x => hasCompanionBuilding(x.id));
        for (const u of COMPANION_BUILDINGS) if (!hasCompanionBuilding(u.id) && !caches.has(u.id))
          liste.push({ id: u.id, cout: u.cost * remise, gain: essai(() => { state.companionBuildings[u.id] = true; }, () => { delete state.companionBuildings[u.id]; }), acheter: () => buyCompanionBuilding(u.id) });
      }
      if (vu('special')) {
        const visibles = UNIQUE_BUILDINGS.filter(u => hasUnique(u.id) || !u.requires || u.requires(state));
        const caches = hiddenShopItems(visibles, x => hasUnique(x.id));
        for (const u of visibles) if (!hasUnique(u.id) && !caches.has(u.id)) {
          const a = u.active;
          let gain = 0;
          if (u.passiveValue) gain = u.passiveValue(c, I);
          else if (a && ATTENTIF) {
            if (a.type === 'boostMult') gain = c * E_OR * (a.value - 1) * a.durationMs / a.cooldownMs;
            else if (a.type === 'instantGain') gain = c * a.minutesEquivalent * 60000 / a.cooldownMs;
            else if (a.type === 'clickBoost') gain = clicParSeconde() / E_PAP * (a.value - 1) * a.durationMs / a.cooldownMs;
          }
          liste.push({ id: u.id, cout: u.cost * remise, gain: gain > 0 ? gain : I * 1e-6, acheter: () => buyUnique(u.id) });
        }
      }
      return liste;
    }

    function acheter() {
      for (let n = 0; n < 300; n++) {
        const I = revenu(), reste = objectifVerdure() - state.verdure;
        if (reste <= 0) return;
        let meilleur = null;
        for (const x of candidats()) {
          if (x.cout > state.verdure || !(x.cout * I < x.gain * reste)) continue;
          const ratio = x.gain / x.cout;
          if (!meilleur || ratio > meilleur.ratio) meilleur = { ...x, ratio };
        }
        if (!meilleur) return;
        meilleur.acheter();
      }
    }

    function rechercher() {
      if (!knowledgeUnlocked()) return;
      for (let n = 0; n < 50; n++) {
        const dispo = [
          ...RESEARCH.filter(r => !hasResearch(r.id) && (!r.requires || hasResearch(r.requires))).map(r => ({ cout: r.cost, go: () => buyResearch(r.id) })),
          ...RESEARCH_INFINITE.map(ri => ({ cout: researchInfiniteCost(ri), go: () => buyResearchInfinite(ri.id) })),
        ].filter(x => x.cout <= state.knowledge).sort((a, b) => a.cout - b.cout)[0];
        if (!dispo) return;
        dispo.go();
      }
    }

    // Ameliorations achetees avec une monnaie (Graines, Eclats) : meilleur gain de revenu d'abord,
    // puis celles qui ne se chiffrent pas en revenu (Connaissances, remises, hors-ligne...).
    function amelio(table, possede, monnaie, depenser, acheterFn) {
      for (let n = 0; n < 40; n++) {
        let meilleur = null, utilitaire = null;
        for (const u of table) {
          if (possede(u.id) || (u.requires && !possede(u.requires)) || u.cost > monnaie()) continue;
          const g = essai(() => { depenser(u.cost); table === PRESTIGE_UPGRADES ? state.prestigeUpgrades[u.id] = true : state.ascensionUpgrades[u.id] = true; },
            () => { depenser(-u.cost); table === PRESTIGE_UPGRADES ? delete state.prestigeUpgrades[u.id] : delete state.ascensionUpgrades[u.id]; });
          if (g > revenu() * 1e-4) { if (!meilleur || g / u.cost > meilleur.r) meilleur = { u, r: g / u.cost }; }
          else if (!utilitaire || u.cost < utilitaire.cost) utilitaire = u;
        }
        const choix = meilleur ? meilleur.u : utilitaire;
        if (!choix) return;
        acheterFn(choix.id);
      }
    }

    function evenements(fraction) {
      if (!ATTENTIF) return 0;
      let bonus = 0;
      if (B.t >= B.prochainOr) {
        state.goldenClicked += 1;
        if (Math.random() < 0.5) { const v = Math.max(50, totalCps() / boostMult('ability') * G.instantSec); state.verdure += v; state.totalEarned += v; bonus += v; }
        else startTimedBoost('golden', G.boostMult, G.boostSec * 1000);
        B.prochainOr = B.t + G.min + 2.5 + Math.random() * (G.max - G.min);
      }
      if (B.t >= B.prochainPap) { startTimedBoost('click', P.mult, P.sec * 1000); B.prochainPap = B.t + P.min + 2.5 + Math.random() * (P.max - P.min); }
      return bonus;
    }
    function capacites() {
      if (!ATTENTIF) return 0;
      let gain = 0;
      for (const u of UNIQUE_BUILDINGS) if (u.active && hasUnique(u.id) && activeCooldownRemaining(u.id) <= 0) {
        if (u.active.type === 'boostMult' && boostMult('ability') >= u.active.value) continue;
        if (u.active.type === 'clickBoost' && boostMult('click') >= u.active.value) continue;
        const avant = state.verdure; activateUniqueAbility(u.id); gain += state.verdure - avant;
      }
      return gain;
    }

    B.seconde = function () {
      __avancer(1000); B.t += 1;
      if (B.t % 10 === 0) maybeChangeWeather();
      B.parts.herbes += evenements();
      B.parts.capacites += capacites();
      if (B.t >= B.prochainChat) { B.prochainChat += 3600; if (hasUnique('chatJardin') && !UNIQUE_BUILDINGS.find(u => u.id === 'chatJardin').passiveValue) { const v = Math.max(20, totalCps() * 180); state.verdure += v; state.totalEarned += v; B.parts.capacites += v; } }
      if (cfg.chaqueSeconde) cfg.chaqueSeconde; // reserve
      const cps = totalCps(), sansCapacite = cps / boostMult('ability'), or = boostMult('golden');
      state.verdure += cps * or; state.totalEarned += cps * or;
      B.parts.production += sansCapacite; B.parts.capacites += cps - sansCapacite; B.parts.herbes += cps * (or - 1);
      grantKnowledge(knowledgeRate());
      state.totalPlayTimeSec = (state.totalPlayTimeSec || 0) + 1;
      const clic = (typeof challengeIs !== 'undefined' && challengeIs('mains')) ? 0 : clickGain() * CPS_CLICS, pap = boostMult('click');
      state.verdure += clic; state.totalEarned += clic; state.totalClicks += CPS_CLICS; state.clicksThisRun += CPS_CLICS;
      B.parts.clics += clic / pap; B.parts.papillons += clic - clic / pap;
      for (const t of TAB_DEFS) if (!state.tabsSeen[t.id] && t.unlock(state)) { state.tabsSeen[t.id] = true; B.jalons[t.id] = B.t; B.evenements.push({ t: B.t, quoi: 'onglet ' + t.id }); }
      if (B.t % 5 === 0) checkAchievements();
      if (B.t % 5 === 0) {
        acheter();
        if (cfg.paliers) for (const b of BUILDINGS) {
          const n = state.buildings[b.id] || 0;
          const atteints = cfg.paliers.filter(x => n >= x).length;
          if (atteints > (B.paliersRun[b.id] || 0)) { B.paliersRun[b.id] = atteints; B.evenements.push({ t: B.t, quoi: 'palier ' + b.id + ' ' + cfg.paliers[atteints - 1] }); }
        }
      }
      if (B.t % 30 === 0) rechercher();
      if (B.t % 1800 === 0) { B.revenus.push({ t: B.t, ...B.parts }); for (const k in B.parts) B.parts[k] = 0; }
      if (vu('prestige') && state.verdure >= objectifVerdure() && prestigeGainAmount() >= 1) {
        const avant = state.totalSeedsEarned || 0;
        doPrestige();
        B.prestiges.push({ t: B.t, gain: state.totalSeedsEarned - avant, total: state.totalSeedsEarned });
        B.evenements.push({ t: B.t, quoi: 'prestige' }); B.paliersRun = {};
        amelio(PRESTIGE_UPGRADES, hasPrestigeUpgrade, () => state.cosmicSeeds, c => { state.cosmicSeeds -= c; }, buyPrestigeUpgrade);
        if (cfg.defis) {
          const enCours = B.defis.find(x => x.fin == null);
          if (enCours) { enCours.fin = B.t; enCours.reussi = challengeDone(enCours.id); enCours.graines = B.prestiges[B.prestiges.length - 1].gain; }
          const prochain = CHALLENGES.find(c => c.unlock(state) && !challengeDone(c.id) && !B.defis.some(x => x.id === c.id && x.reussi === false && x.essais >= 2));
          if (prochain) {
            const essais = B.defis.filter(x => x.id === prochain.id).length + 1;
            startChallenge(prochain.id);
            B.defis.push({ id: prochain.id, debut: B.t, essais });
          }
        }
      }
      if (vu('ascension') && ascensionGainAmount() >= Math.max(1, Math.round(cfg.ascensionPolicy * (state.totalShardsEarned || state.stellarShards || 0)))) {
        const avant = state.stellarShards || 0;
        doAscension();
        B.ascensions.push({ t: B.t, gain: (state.stellarShards || 0) - avant });
        B.evenements.push({ t: B.t, quoi: 'ascension' }); B.paliersRun = {};
        amelio(ASCENSION_UPGRADES, hasAscensionUpgrade, () => state.stellarShards || 0, c => { state.stellarShards -= c; }, buyAscensionUpgrade);
      }
    };
    B.courir = function (secondes) {
      for (let i = 0; i < secondes; i++) B.seconde();
      return { t: B.t, graines: state.totalSeedsEarned, prestiges: B.prestiges.length, ascensions: B.ascensions.length, cps: totalCps() };
    };
    B.rapport = function () {
      const nom = id => { for (const l of [BUILDINGS, CLICK_UPGRADES, COMPANION_BUILDINGS, UNIQUE_BUILDINGS, RESEARCH, RESEARCH_INFINITE, PRESTIGE_UPGRADES, ASCENSION_UPGRADES]) { const x = l.find(y => y.id === id); if (x) return L(x, 'name'); } return id; };
      const tables = { production: BUILDINGS, clic: CLICK_UPGRADES, batiments: COMPANION_BUILDINGS, special: UNIQUE_BUILDINGS, recherche: [...RESEARCH, ...RESEARCH_INFINITE], prestige: PRESTIGE_UPGRADES, ascension: ASCENSION_UPGRADES };
      const utilite = {};
      for (const [onglet, l] of Object.entries(tables)) utilite[onglet] = l.map(x => ({ id: x.id, nom: nom(x.id), type: x.type || (x.active ? x.active.type : ''), t: B.premierAchat[x.id] ?? null }));
      return { jalons: B.jalons, prestiges: B.prestiges, ascensions: B.ascensions, utilite, achatsParOnglet: B.achatsParOnglet, revenus: B.revenus, fin: B.t, evenements: B.evenements, defis: B.defis };
    };
  }, { profil: PROFIL, cfg: { golden: CONFIG.golden, butterfly: CONFIG.butterfly, patch: CONFIG.patch || '', prestigePolicy: CONFIG.prestigePolicy ?? 1, ascensionPolicy: CONFIG.ascensionPolicy ?? 1, racinePrestige: CONFIG.racinePrestige ?? 3, paliers: CONFIG.paliers || null, defis: !!CONFIG.defis } });

  const h = s => s == null ? 'jamais' : s < 3600 ? Math.round(s / 60) + ' min' : s < 172800 ? (s / 3600).toFixed(1) + ' h' : (s / 86400).toFixed(2) + ' j';
  const t0 = Date.now();
  let r;
  for (let heure = 0; heure < HEURES_MAX; heure++) {
    r = await page.evaluate(() => __bot.courir(3600));
    if (heure % 12 === 11) process.stderr.write(`  [${h(r.t)}] prestiges=${r.prestiges} ascensions=${r.ascensions} graines=${r.graines} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
    if (CONFIG.stopApresAscensions && r.ascensions >= CONFIG.stopApresAscensions) break;
  }
  const rap = await page.evaluate(() => __bot.rapport());
  const sortie = path.basename(process.argv[2] || 'actuel', '.js') + `-${PROFIL}-${GRAINE}.json`;
  fs.writeFileSync(sortie, JSON.stringify(rap, null, 1));

  console.log(`\n### ${path.basename(process.argv[2] || 'actuel')} | ${PROFIL} | graine ${GRAINE} | ${h(rap.fin)} simulees en ${Math.round((Date.now() - t0) / 60000)} min reelles`);
  console.log('Jalons :', ['batiments', 'special', 'recherche', 'prestige', 'ascension'].map(k => `${k} ${h(rap.jalons[k])}`).join(' | '));
  console.log(`Prestiges (${rap.prestiges.length}, 20 premiers) :`, rap.prestiges.slice(0, 20).map(p => `${h(p.t)} (+${p.gain})`).join(', ') || 'aucun');
  console.log('Ascensions :', rap.ascensions.map(a => `${h(a.t)} (+${a.gain})`).join(', ') || 'aucune');
  console.log('Objets jamais achetes :');
  for (const [onglet, l] of Object.entries(rap.utilite)) {
    const jamais = l.filter(x => x.t == null);
    console.log(`  ${onglet.padEnd(10)} ${l.length - jamais.length}/${l.length} achetes${jamais.length ? ' — jamais : ' + jamais.map(x => `${x.id}(${x.type})`).join(', ') : ''}`);
  }
  // Ordre de premiere acquisition, onglet par onglet, dans l'ordre de la table : chaque objet
  // avec l'heure de son premier achat. Les « inversions » signalent un objet achete avant un
  // objet plus haut dans la liste (donc moins cher ou prerequis).
  {
    const ev = rap.evenements.slice().sort((a, b) => a.t - b.t);
    const finContenu = Math.max(...Object.values(rap.utilite).flat().filter(x => !/^ri_/.test(x.id) && x.t != null).map(x => x.t));
    const p1 = rap.prestiges[0] ? rap.prestiges[0].t : finContenu, a1 = rap.ascensions[0] ? rap.ascensions[0].t : finContenu;
    const phases = [['avant le 1er Prestige', 0, p1], ['1er Prestige -> 1re Ascension', p1, a1], ['1re Ascension -> fin du contenu', a1, finContenu]];
    const mn = x => x < 3600 ? Math.round(x / 60) + ' min' : (x / 3600).toFixed(1) + ' h';
    console.log('Temps morts (plus longs passages sans rien de nouveau) :');
    for (const [nom, debut, fin] of phases) {
      if (fin <= debut) continue;
      const pts = [debut, ...ev.filter(e => e.t > debut && e.t <= fin).map(e => e.t), fin];
      const quoi = [null, ...ev.filter(e => e.t > debut && e.t <= fin).map(e => e.quoi), 'fin de phase'];
      const trous = [];
      for (let i = 1; i < pts.length; i++) trous.push({ duree: pts[i] - pts[i - 1], de: pts[i - 1], fini: quoi[i] });
      trous.sort((a, b) => b.duree - a.duree);
      // Deux sortes d'attente : celle ou le joueur ECONOMISE pour son Prestige / son Ascension (il
      // voit sa barre de Graines monter et choisit d'attendre), et celle ou il n'a vraiment rien a faire.
      const sansReset = trous.filter(x => !/^(prestige|ascension|fin de phase)/.test(x.fini));
      console.log(`  ${nom.padEnd(32)} max ${mn(trous[0].duree).padEnd(8)} | hors attente de reset : max ${sansReset[0] ? mn(sansReset[0].duree) : '-'} | ` + trous.slice(0, 3).map(x => `${mn(x.duree)} a ${mn(x.de)} (-> ${x.fini})`).join(' ; '));
    }
  }
  if (rap.defis && rap.defis.length) {
    console.log('Defis (duree de la partie en defi) :');
    for (const d of rap.defis) console.log(`  ${d.id.padEnd(12)} lance a ${h(d.debut).padEnd(8)} ${d.fin == null ? 'toujours en cours' : `${d.reussi ? 'REUSSI' : 'rate  '} en ${h(d.fin - d.debut)} (+${d.graines} Graines)`}`);
  }
  console.log('Ordre de premiere acquisition (heure) :');
  for (const [onglet, l] of Object.entries(rap.utilite)) {
    const vus = l.filter(x => x.t != null);
    let inversions = 0;
    for (let i = 1; i < vus.length; i++) if (vus[i].t < vus[i - 1].t) inversions++;
    console.log(`  ${onglet.padEnd(10)} ${vus.map(x => `${x.id}@${(x.t / 3600).toFixed(1)}`).join(' ')}${inversions ? '  [' + inversions + ' inversion(s)]' : ''}`);
  }
  console.log('Part du revenu (par tranche de 6 h) :');
  for (let i = 0; i < rap.revenus.length; i += 12) {
    const tr = rap.revenus.slice(i, i + 12).reduce((a, x) => { for (const k of ['production', 'clics', 'herbes', 'papillons', 'capacites']) a[k] = (a[k] || 0) + x[k]; return a; }, {});
    const tot = Object.values(tr).reduce((a, b) => a + b, 0) || 1;
    console.log(`  ${h(i * 1800).padEnd(7)}→ ` + Object.entries(tr).map(([k, v]) => `${k} ${Math.round(100 * v / tot)}%`).join(' | '));
  }
  console.log('Achats par onglet (tranches de 2 h) :');
  rap.achatsParOnglet.forEach((f, i) => { if (f) console.log(`  ${h(i * 7200).padEnd(7)}→ ` + Object.entries(f).map(([k, v]) => `${k} ${v}`).join(' | ')); });
  if (erreurs.length) console.log('Erreurs page :', erreurs.slice(0, 3));
  await browser.close();
})();
