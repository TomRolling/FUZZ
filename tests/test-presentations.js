// Mode test « Rejouer les présentations » : Papi doit enchainer la presentation de TOUS les onglets
// (annonce + doigt « Clique ici ! » + explication a l'ouverture), sans rien oublier ni rester bloque.
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
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);

  console.log('=== 1. lancement depuis le panneau du mode test ===');
  await p.evaluate(() => {
    basculerModeTest();
    const i = MODE_TEST_ACTIONS.findIndex(g => g[0].includes('Étapes'));
    const j = MODE_TEST_ACTIONS[i][1].findIndex(x => x[0] === 'Rejouer les présentations');
    document.querySelector(`#modeTestPanel [data-mt="${i}-${j}"]`).click();
    basculerModeTest();
  });
  await p.waitForTimeout(1200);
  const debut = await p.evaluate(() => ({ presentes: Object.keys(state.tabsDescribed).length, bulle: isDialogueVisible(), spotlight: _pendingSpotlightGroup }));
  console.log('  ', JSON.stringify(debut));
  verifie(debut.presentes === 0, 'les onglets ne sont pas remis a « jamais presentes »');
  verifie(debut.bulle || debut.spotlight, 'Papi ne commence aucune presentation');

  console.log('=== 2. on suit Papi jusqu au bout (comme un joueur) ===');
  const aPresenter = await p.evaluate(() => TAB_DEFS.filter(t => !t.silent).map(t => t.id));
  let etapes = 0;
  let achatPendantPapi = null; // resultat de la tentative d'achat pendant une presentation
  for (; etapes < 200; etapes++) {
    const fini = await p.evaluate((ids) => ids.every(id => state.tabsDescribed[id]), aPresenter);
    if (fini) break;
    // Pendant que Papi parle, une ligne d'achat ne doit pas repondre : ni a la souris (regle
    // .papiParle), ni a un clic simule ou au clavier (garde de clicLigneAchat).
    if (achatPendantPapi === null) {
      achatPendantPapi = await p.evaluate(() => {
        if (!isOverlayOpen('shopPageOverlay') || !isDialogueVisible()) return null;
        const ligne = document.querySelector('#shopPageOverlay .upgrade');
        if (!ligne) return null;
        state.verdure = 1e9;
        const avant = JSON.stringify(state.buildings) + JSON.stringify(state.clickUpgrades);
        ligne.click();
        ligne.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return { onglet: activeShopTab, souris: getComputedStyle(ligne).pointerEvents,
                 achat: avant !== JSON.stringify(state.buildings) + JSON.stringify(state.clickUpgrades) };
      });
    }
    // Clique ce que Papi designe : bouton flottant, mini-onglet, puis la bulle elle-meme.
    const action = await p.evaluate(() => {
      const bouton = document.querySelector('.floatBtn.featureHighlight');
      if (bouton) { bouton.click(); return 'bouton ' + bouton.id; }
      const onglet = document.querySelector('.drawerBtn.featureHighlight');
      if (onglet) { onglet.click(); return 'onglet ' + onglet.dataset.tabId; }
      if (isDialogueVisible()) { document.getElementById('dialogueBox').click(); return 'bulle'; }
      const ouverte = Object.values(GROUP_TO_OVERLAY).find(isOverlayOpen);
      if (ouverte) { closeModal(ouverte); return 'fermeture ' + ouverte; }
      return 'rien';
    });
    await p.waitForTimeout(action === 'bulle' ? 220 : 420);
  }
  // Le verrou de presentation est rendu a la fermeture de la fenetre : on la referme comme le joueur.
  await p.evaluate(() => { const ouverte = Object.values(GROUP_TO_OVERLAY).find(isOverlayOpen); if (ouverte) closeModal(ouverte); });
  await p.waitForTimeout(600);
  const bilan = await p.evaluate((ids) => ({
    manquants: ids.filter(id => !state.tabsDescribed[id]),
    vus: ids.filter(id => !state.tabsSeen[id]),
    spotlight: _pendingSpotlightGroup,
    // Une remarque spontanee de Papi (meteo, nuit, capacite...) peut arriver a tout moment :
    // ce qui doit etre termine, c'est l'ANNONCE d'onglet, reconnaissable a sa bulle verrouillee
    // et a la file d'attente.
    annonceEnCours: _pendingTabAnnouncements.length > 0 || (isDialogueVisible() && _dialogueBlockAdvance),
    bulle: isDialogueVisible(),
    boutons: ['shopBtn', 'settingsBtn', 'achievementsBtn', 'questsBtn'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none').length,
  }), aPresenter);
  console.log('   etapes :', etapes, '|', JSON.stringify(bilan));
  if (!achatPendantPapi) {
    console.log('  (aucune liste d achat a l ecran pendant une replique : verification impossible)');
  } else {
    console.log(`  achat pendant la presentation de « ${achatPendantPapi.onglet} » : ${achatPendantPapi.achat ? 'PASSE' : 'bloque'} (souris : ${achatPendantPapi.souris})`);
    verifie(!achatPendantPapi.achat, 'on peut acheter pendant que Papi presente un onglet');
    verifie(achatPendantPapi.souris === 'none', 'les lignes d achat restent cliquables a la souris pendant une presentation');
  }
  const apresPapi = await p.evaluate(() => {
    if (!isOverlayOpen('shopPageOverlay')) openModal('shopPageOverlay');
    activeShopTab = 'production'; renderAll();
    state.verdure = 1e9;
    const avant = JSON.stringify(state.buildings);
    const ligne = document.querySelector('#shopPageOverlay .upgrade');
    if (ligne) ligne.click();
    return { presentation: presentationEnCours(), achat: avant !== JSON.stringify(state.buildings) };
  });
  console.log(`  une fois tout presente : presentationEnCours=${apresPapi.presentation}, achat ${apresPapi.achat ? 'possible' : 'IMPOSSIBLE'}`);
  verifie(apresPapi.achat, 'les achats restent bloques alors que Papi a fini de parler');
  verifie(bilan.manquants.length === 0, 'onglets jamais expliques :', bilan.manquants.join(', '));
  verifie(bilan.vus.length === 0, 'onglets jamais apparus :', bilan.vus.join(', '));
  verifie(!bilan.spotlight && !bilan.annonceEnCours, 'une annonce reste en cours a la fin');
  verifie(bilan.boutons === 4, 'les 4 boutons doivent etre visibles a la fin');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
