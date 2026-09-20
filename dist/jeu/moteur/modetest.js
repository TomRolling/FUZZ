// ================= MODE TEST (caché) =================
// Ctrl+Maj+D ouvre ou ferme un panneau pour tester vite : avancer le temps, accélérer le jeu, se
// donner des ressources, sauter aux étapes, déclencher les événements. Invisible sans le raccourci.
let _vitesseTest = 1;
function avancerTemps(sec) { accrue(sec); checkAchievements(); }
// Mode test : tout débloquer à n'importe quel moment, y compris pendant la scène d'ouverture, le
// tutoriel ou une annonce de Papi, qui sont interrompus. Les annonces sont réactivées AVANT de
// révéler les boutons : syncRevealedButtonsOnLoad ne fait rien tant qu'elles sont suspendues
// (nouvelle partie, intro, après un reset), c'est pour ça que l'ancien bouton ne marchait pas toujours.
function toutDebloquerModeTest() {
  arreterPresentationsEnCours();
  _sceneOnComplete = null; // scène fermée sans jouer sa suite (le tutoriel)
  _sceneQueue = [];
  advanceScene();
  document.getElementById('tutorialOverlay').style.display = 'none';
  state.tutorialSeen = true;
  _suppressTabAnnouncements = false;
  for (const t of TAB_DEFS) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; }
  syncRevealedButtonsOnLoad();
}

// Mode test : remet le jeu dans l'état « tout est débloqué, mais Papi n'a encore rien présenté »,
// puis relance la chaîne d'annonces. Sert à vérifier d'un coup tout le parcours de présentation
// (annonce, doigt « Clique ici ! », explication à l'ouverture) sans refaire une partie.
function rejouerPresentationsModeTest() {
  arreterPresentationsEnCours();
  _sceneOnComplete = null;
  _sceneQueue = [];
  advanceScene();
  document.getElementById('tutorialOverlay').style.display = 'none';
  state.tutorialSeen = true;
  // De quoi remplir toutes les conditions d'apparition (voir TAB_DEFS).
  state.totalClicks = Math.max(state.totalClicks || 0, 500);
  state.totalPlayTimeSec = Math.max(state.totalPlayTimeSec || 0, 3600);
  state.verdure = Math.max(state.verdure || 0, 1e9);
  state.prestigeCount = Math.max(state.prestigeCount || 0, 3);
  state.totalAscensions = Math.max(state.totalAscensions || 0, 3);
  state.totalSeedsEarned = Math.max(state.totalSeedsEarned || 0, ASCENSION_SEED_DIVISOR);
  state.cosmicSeeds = Math.max(state.cosmicSeeds || 0, 20);
  // Recherche demande aussi de quoi acheter sa premiere ligne (voir TAB_DEFS) : sans ça, l'onglet
  // ne réapparaît jamais et la chaîne de présentations s'arrête avant la fin.
  state.knowledge = Math.max(state.knowledge || 0, prixPremiereRecherche());
  // La Galerie demande 5 objets distincts possédés, les Succès au moins un succès.
  for (const b of BUILDINGS.slice(0, 3)) state.buildings[b.id] = Math.max(state.buildings[b.id] || 0, 10);
  for (const c of CLICK_UPGRADES.slice(0, 3)) state.clickUpgrades[c.id] = true;
  checkAchievements();
  state.tabsSeen = {};
  state.tabsDescribed = {};
  _suppressTabAnnouncements = false;
  _highlightedTabIds = new Set();
  _appearingTabIds = new Set();
  _tabsPendingAppear = new Set();
  _tabsQueuedForAnnounce = new Set();
  Object.values(GROUP_TO_FLOAT_BTN).forEach(id => document.getElementById(id).classList.remove('revealed', 'featureHighlight'));
  saveGame();
  renderAll(); // renderTabsRow repère les onglets à annoncer et lance la chaîne
}

const MODE_TEST_ACTIONS = [
  ['⏩ Temps (production, Connaissances, temps de jeu)', [
    ['+10 min', () => avancerTemps(600)], ['+1 h', () => avancerTemps(3600)],
    ['+8 h', () => avancerTemps(8 * 3600)], ['+1 jour', () => avancerTemps(86400)],
  ]],
  ['🚀 Vitesse du jeu', [1, 10, 100].map(v => [`x${v}`, () => { _vitesseTest = v; }, () => _vitesseTest === v])],
  ['💰 Ressources', [
    ['Verdure x100', () => { state.verdure = Math.max(10000, state.verdure * 100); }],
    ['+1 000 Connaissances', () => { state.knowledge += 1000; }],
    ['+10 Graines', () => creditSeeds(10)],
    ['+1 Éclat', () => creditShards(1)],
  ]],
  ['🌍 Étapes', [
    ['Prestige maintenant', () => { state.verdure = Math.max(state.verdure, verdureForSeeds(1) * 1.01); doPrestige(true); }],
    ['Ascension maintenant', () => { creditSeeds(Math.max(0, Math.ceil(seedsForShards(1)) - (state.seedsSinceAscension || 0))); doAscension(true); }],
    ['Tout débloquer', toutDebloquerModeTest],
    ['Rejouer les présentations', rejouerPresentationsModeTest],
  ]],
  ['🎉 Saisons', [['Aucune', () => forcerSaisonModeTest(null), () => !_evenementForce]].concat(
    EVENEMENTS.map(ev => [`${ev.emoji} ${ev.nom.fr}`, () => forcerSaisonModeTest(ev.id), () => _evenementForce === ev.id]))],
  ['✨ Événements', [
    ['Herbe dorée', () => spawnGoldenWeed()], ['Papillons', () => spawnButterflies()],
    ['Visite de Papi', () => { state.invasiveWeed = { active: true, needed: 5, done: 0 }; }],
    ['Météo suivante', () => { state.lastWeatherChange = 0; maybeChangeWeather(); }],
    ['Recharger les capacités', () => { state.activeCooldowns = {}; }],
  ]],
  ['🏅 Défi', [
    ['Réussir le défi en cours', () => {
      const c = activeChallenge();
      if (!c) { showToast('🧪 Aucun défi en cours'); return; }
      state.verdure = Math.max(state.verdure, verdureForSeeds(c.goal) * 1.01);
      state.challengeStartPlayTime = state.totalPlayTimeSec || 0;
      doPrestige(true);
    }],
  ]],
];
function renderModeTest() {
  const panneau = document.getElementById('modeTestPanel');
  if (!panneau) return;
  panneau.innerHTML = `<div class="mtTete"><span>🧪 Mode test</span><button data-mt="fermer">✕</button></div>`
    + MODE_TEST_ACTIONS.map(([titre, boutons], i) => `<h4>${titre}</h4><div class="mtBoutons">`
      + boutons.map(([nom, , actif], j) => `<button data-mt="${i}-${j}" class="${actif && actif() ? 'actif' : ''}">${nom}</button>`).join('')
      + '</div>').join('')
    + `<div class="mtAide">Ctrl+Maj+D pour fermer</div>`;
}
// Mode test : passe sur une saison (ou la quitte) et remet tout ce qu'elle déclenche à l'état
// « jamais vu », pour qu'on revoie d'un coup le décor, la remarque de Papi et son herbe dorée.
// Recliquer sur la saison déjà active la coupe.
function forcerSaisonModeTest(id) {
  _evenementForce = (id && _evenementForce === id) ? null : id;
  const ev = evenementActif();
  if (ev) {
    state.evenementsVus = state.evenementsVus || {};
    delete state.evenementsVus[`${ev.id}-${new Date().getFullYear()}`];
  }
  document.querySelectorAll('.golden').forEach(e => e.remove());
  renderAll();
  if (ev) spawnGoldenWeed();
}

function basculerModeTest() {
  let panneau = document.getElementById('modeTestPanel');
  if (panneau) { panneau.remove(); return; }
  panneau = document.createElement('div');
  panneau.id = 'modeTestPanel';
  panneau.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mt]');
    if (!b) return;
    if (b.dataset.mt === 'fermer') { basculerModeTest(); return; }
    const [i, j] = b.dataset.mt.split('-').map(Number);
    MODE_TEST_ACTIONS[i][1][j][1]();
    saveGame(); renderAll(); renderModeTest();
  });
  document.getElementById('gameViewport').appendChild(panneau);
  renderModeTest();
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); basculerModeTest(); }
});
// Échap ferme ce qui est ouvert, de la fenêtre la plus au-dessus à la plus en dessous, en
// passant par sa croix (donc avec exactement les mêmes effets qu'un clic). Jamais pendant une
// présentation de Papi : c'est lui qui guide, et closeModal refuserait de toute façon.
// Échap ferme la fenêtre du DESSUS. Chaque fenêtre déclare son propre bouton de fermeture dans
// le HTML (`data-fermeture`) et l'ordre vient du vrai empilement CSS : une fenêtre ajoutée plus
// tard est prise en compte du seul fait de porter l'attribut. La liste tenue à la main qui
// précédait recopiait les z-index et avait déjà oublié la proposition de mise à jour.
function fenetreDuDessus() {
  return [...document.querySelectorAll('[data-fermeture]')]
    .filter(el => isOverlayOpen(el.id) || el.style.display === 'flex')
    .sort((a, b) => (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0))[0];
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || _pendingSpotlightGroup) return;
  const fenetre = fenetreDuDessus();
  if (!fenetre) return;
  const bouton = document.getElementById(fenetre.dataset.fermeture);
  if (!bouton) return;
  bouton.click();
  e.preventDefault();
});

