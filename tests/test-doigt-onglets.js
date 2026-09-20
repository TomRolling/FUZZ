// Audit de l'accueil : pour CHAQUE onglet que Papi presente, on verifie qu'il a bien
//  1. designe du doigt « Clique ici ! » le bouton de la fenetre ou vit l'onglet ;
//  2. designe du doigt l'onglet lui-meme une fois la fenetre ouverte (sauf la fenetre des Succes,
//     qui n'a pas d'onglets et que Papi decrit directement) ;
//  3. explique ce que contient l'onglet.
// Le parcours part de zero via « Rejouer les presentations » (mode test), ce qui couvre tous
// les onglets du jeu d'un coup, dans l'ordre ou un joueur les decouvrirait.
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
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);

  await p.evaluate(() => {
    basculerModeTest();
    const i = MODE_TEST_ACTIONS.findIndex(g => g[0].includes('Étapes'));
    const j = MODE_TEST_ACTIONS[i][1].findIndex(x => x[0] === 'Rejouer les présentations');
    document.querySelector(`#modeTestPanel [data-mt="${i}-${j}"]`).click();
    basculerModeTest();
  });
  await p.waitForTimeout(1200);

  // Ce que le doigt designe a cet instant (ou rien), mesure sur l'ecran reel.
  const observer = () => p.evaluate(() => {
    const fleche = document.getElementById('tutorialSpotlightArrow');
    const visible = fleche && getComputedStyle(fleche).display !== 'none' && +getComputedStyle(fleche).opacity > 0.3;
    const libelle = document.getElementById('tutorialSpotlightArrowLabel').textContent.trim();
    if (!visible) return { doigt: null };
    // On juge comme l'oeil : la cible est celle qui se trouve dans l'axe du doigt (son centre
    // horizontal) et juste a cote de lui verticalement. Comparer des boites ne marche pas : la
    // fleche est plus large qu'un onglet et touche aussi ses voisins.
    const rf = fleche.getBoundingClientRect();
    const axe = rf.left + rf.width / 2;
    const cibles = [
      ...['shopBtn', 'questsBtn', 'achievementsBtn', 'settingsBtn'].map(id => ({ id: 'bouton:' + id, el: document.getElementById(id) })),
      ...[...document.querySelectorAll('.drawerBtn[data-tab-id]')].filter(e => e.offsetParent).map(e => ({ id: 'onglet:' + e.dataset.tabId, el: e })),
    ].filter(c => c.el).map(c => {
      const r = c.el.getBoundingClientRect();
      const dansLAxe = axe >= r.left && axe <= r.right;
      const ecartVertical = Math.max(r.top - rf.bottom, rf.top - r.bottom, 0);
      return { id: c.id, ok: dansLAxe && ecartVertical < 100, ecart: ecartVertical };
    }).filter(c => c.ok).sort((a, c) => a.ecart - c.ecart);
    return { doigt: cibles.length ? cibles[0].id : 'ailleurs', libelle };
  });

  const BOUTON_DU_GROUPE = { shop: 'shopBtn', quests: 'questsBtn', achievements: 'achievementsBtn', settings: 'settingsBtn' };
  const infos = await p.evaluate(() => TAB_DEFS.filter(t => !t.silent).map(t => ({ id: t.id, groupe: t.group })));
  const journal = {};
  for (const t of infos) journal[t.id] = { groupe: t.groupe, doigtBouton: false, doigtOnglet: false, libelles: new Set(), fenetreFermee: null };

  const aPresenter = infos.map(t => t.id);
  let etapes = 0;
  for (; etapes < 260; etapes++) {
    const fini = await p.evaluate((ids) => ids.every(id => state.tabsDescribed[id]), aPresenter);
    if (fini) break;

    // Qui Papi est-il en train de presenter ? `_pointedTabId` d'abord : `_lockedToTabId` reste
    // pose sur l'onglet PRECEDENT tant que sa fenetre est ouverte, il ne dit pas qui est designe.
    const ctx = await p.evaluate(() => ({
      designe: _pointedTabId,
      verrou: _lockedToTabId,
      ouvertes: Object.entries(GROUP_TO_OVERLAY).filter(([, id]) => isOverlayOpen(id)).map(([g]) => g),
    }));
    // Premiere apparition d'un onglet dans la presentation : sa fenetre etait-elle deja ouverte ?
    // Si oui, aucun doigt sur le bouton n'est attendu (on est deja dedans).
    for (const id of [ctx.verrou, ctx.designe]) {
      if (id && journal[id] && journal[id].fenetreFermee === null) journal[id].fenetreFermee = !ctx.ouvertes.includes(journal[id].groupe);
    }
    const vu = await observer();
    if (vu.doigt && vu.doigt.startsWith('onglet:')) {
      const id = vu.doigt.slice(7);
      if (journal[id] && id === ctx.designe) { journal[id].doigtOnglet = true; journal[id].libelles.add(vu.libelle); }
    }
    if (vu.doigt && vu.doigt.startsWith('bouton:') && ctx.verrou && journal[ctx.verrou]) {
      const j = journal[ctx.verrou];
      if (vu.doigt === 'bouton:' + BOUTON_DU_GROUPE[j.groupe]) { j.doigtBouton = true; j.libelles.add(vu.libelle); }
    }

    // Puis on fait ce que Papi demande, comme un joueur.
    const action = await p.evaluate(() => {
      const bouton = document.querySelector('.floatBtn.featureHighlight');
      if (bouton) { bouton.click(); return 'bouton'; }
      const onglet = document.querySelector('.drawerBtn.featureHighlight');
      if (onglet) { onglet.click(); return 'onglet'; }
      if (isDialogueVisible()) { document.getElementById('dialogueBox').click(); return 'bulle'; }
      const ouverte = Object.values(GROUP_TO_OVERLAY).find(isOverlayOpen);
      if (ouverte) { closeModal(ouverte); return 'fermeture'; }
      return 'rien';
    });
    await p.waitForTimeout(action === 'bulle' ? 220 : 450);
  }

  const bilan = await p.evaluate((ids) => ids.map(id => ({ id, explique: !!state.tabsDescribed[id] })), aPresenter);
  console.log(`  parcours termine en ${etapes} etapes\n`);
  console.log('  onglet           fenetre       doigt bouton         doigt onglet     explique');
  for (const { id, explique } of bilan) {
    const j = journal[id];
    const sansOnglets = j.groupe === 'achievements';
    const boutonAttendu = j.fenetreFermee !== false; // fenetre fermee (ou inconnue) : le doigt doit y mener
    const colBouton = !boutonAttendu ? '(deja ouverte)' : (j.doigtBouton ? 'oui' : 'NON');
    console.log('  ' + id.padEnd(16) + ' ' + j.groupe.padEnd(13) + ' ' + colBouton.padEnd(20) + ' ' +
      (sansOnglets ? '(pas d onglets)' : (j.doigtOnglet ? 'oui' : 'NON')).padEnd(16) + ' ' +
      (explique ? 'oui' : 'NON'));
    verifie(explique, `« ${id} » n a jamais ete explique`);
    if (boutonAttendu) verifie(j.doigtBouton, `« ${id} » : fenetre fermee, et le doigt n a jamais designe son bouton`);
    if (!sansOnglets) verifie(j.doigtOnglet, `« ${id} » : le doigt n a jamais designe l onglet lui-meme`);
    for (const l of j.libelles) verifie(/Clique ici/i.test(l), `« ${id} » : libelle du doigt inattendu « ${l} »`);
  }

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
