// ================= VISUAL THEME =================
function getThemeClass() {
  const tierBuildings = ['jardinHorsTemps','grainePrimordiale','templeCompost','conscienceChloro'];
  if (tierBuildings.some(id => (state.buildings[id]||0) > 0) || state.prestigeCount >= 15) return 'theme-5';
  if ((state.buildings.mars||0) > 0 || state.prestigeCount >= 8) return 'theme-4';
  if ((state.buildings.satellite||0) > 0 || state.prestigeCount >= 4) return 'theme-3';
  if ((state.buildings.usine||0) > 0 || state.prestigeCount >= 1) return 'theme-2';
  return 'theme-1';
}

// ================= NAVIGATION (modales Paramètres/Succès/Quêtes + page Magasin) =================
function unlockedTabs() { return TAB_DEFS.filter(t => t.unlock(state)); }
// Onglets réellement AFFICHABLES. Un déblocage est un ÉVÉNEMENT, pas un état : on ne consulte
// donc QUE tabsSeen, posé au DÉBUT de l'annonce de cet onglet (voir announceNewTabsSequentially),
// pour qu'il surgisse au moment précis où Papi en parle. Re-tester `unlock` ici faisait disparaître un onglet déjà
// acquis dès que sa condition redevenait fausse — Bâtiments, dont le seuil porte sur la Verdure
// EN POCHE, s'évaporait à la première dépense, c'est-à-dire aussitôt après son déblocage.
function revealedTabs() { return TAB_DEFS.filter(t => state.tabsSeen[t.id]); }

// Onglet actif par fenêtre (pas besoin d'être sauvegardé, repart sur la valeur par défaut à chaque lancement)
let activeShopTab = 'production';
let activeSettingsTab = 'options';
let activeQuestsTab = 'quetes';

// Les panneaux d'onglets partagent un seul conteneur à défilement par fenêtre : sans cette
// remise à zéro, une fenêtre rouverte reprenait à la position laissée la fois d'avant, souvent
// au milieu de nulle part. D'un onglet à l'autre, en revanche, la position est mémorisée
// (voir _defilementOnglets).
function resetScrollPanes(root) {
  if (!root) return;
  root.querySelectorAll('.sideModalContent, .shopPageContent').forEach(el => { el.scrollTop = 0; });
}
function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  // Le dernier onglet consulté est conservé, y compris pendant le tutoriel : quand Papi présente
  // un nouvel onglet, la fenêtre s'ouvre là où le joueur en était et c'est le doigt « Clique
  // ici ! » qui l'emmène sur la nouveauté (seul le défilement repart en haut, voir
  // resetScrollPanes).
  clearTimeout(overlay._fermetureTimer);
  overlay.classList.remove('fermeture');
  overlay.classList.add('open');
  suivreFenetrePendantAnimation(overlay);
  // Les panneaux de cette fenêtre ne sont pas redessinés tant qu'elle est fermée (voir
  // renderAll) : on les remet à jour maintenant qu'elle est marquée ouverte, avant de rendre
  // la main — pas en différé, sinon le joueur verrait une frame de contenu périmé.
  renderAll();
  // APRÈS l'affichage : sur un élément encore en display:none, écrire scrollTop ne fait rien
  // et le navigateur restaure ensuite la position précédente.
  resetScrollPanes(overlay);
  // Une bulle AMBIANTE de Papi ne doit pas rester par-dessus un menu ouvert : on l'efface.
  // Mais surtout pas une bulle de TUTORIEL — la vider mettait `_dialogueOnComplete` à null,
  // c'est-à-dire jetait la suite de la séquence : le groupe n'était jamais rendu et toutes les
  // annonces suivantes restaient bloquées en file. Celle-là, on la referme proprement
  // (dismissDialogue exécute la continuation).
  if (isDialogueVisible()) hideDialogue(_dialogueBlockAdvance);
}
// Callbacks à exécuter la prochaine fois qu'une fenêtre précise (par id d'overlay) se ferme —
// utilisé pour ne présenter la fonctionnalité suivante qu'une fois la fenêtre actuelle
// réellement refermée par le joueur, jamais pendant qu'elle est encore ouverte à l'écran.
let _onModalCloseCallbacks = {};
function waitForModalClose(overlayId, cb) {
  (_onModalCloseCallbacks[overlayId] = _onModalCloseCallbacks[overlayId] || []).push(cb);
}
// Vrai tant que Papi doit encore présenter quelque chose dans CETTE fenêtre. La refermer
// avant qu'il ait fini laissait le tutoriel à moitié joué et, la zone à laquelle la bulle était
// accrochée ayant disparu, envoyait celle-ci se replier dans le coin haut-gauche de l'écran.
// Le verrou est posé ici plutôt que sur chaque bouton de fermeture : la croix, le clic sur le
// fond sombre et tout autre appel passent tous par closeModal.
// Vrai tant que Papi est EN TRAIN de présenter un onglet de ce groupe : une réplique est à
// l'écran et un onglet précis est désigné. C'est LE critère unique du verrouillage pendant le
// tutoriel — fermeture de la fenêtre comme accès aux autres mini-onglets. Dès qu'il a fini de
// parler, plus rien n'est bloqué : le joueur reste libre d'explorer la fenêtre ouverte, et
// c'est même en la refermant qu'il enchaîne la suite du tutoriel.
function isTutorialSpeakingFor(group) {
  if (_pendingSpotlightGroup !== group || !_lockedToTabId) return false;
  // Le doigt qui désigne un mini-onglet compte comme une présentation en cours : fermer la
  // fenêtre à ce moment-là abandonnait l'onglet présenté et bloquait les suivants du groupe.
  return isDialogueVisible() || _pointedTabId !== null;
}
function isTutorialHoldingModal(overlayId) {
  if (!_pendingSpotlightGroup) return false;
  if (GROUP_TO_OVERLAY[_pendingSpotlightGroup] !== overlayId) return false;
  return isTutorialSpeakingFor(_pendingSpotlightGroup);
}
// Durée (ms) de l'animation CSS en cours sur un élément.
function dureeAnimationMs(el) { return (parseFloat(getComputedStyle(el).animationDuration) || 0) * 1000; }
// Pendant qu'une fenêtre bouge (le magasin qui monte), le doigt, le spotlight et la bulle de Papi
// se recalent à chaque image sur le signal `gameviewportfit`, au lieu de sauter une fois arrivés.
function suivreFenetrePendantAnimation(overlay) {
  const fin = performance.now() + dureeAnimationMs(overlay) + 50;
  const boucle = () => {
    window.dispatchEvent(new Event('gameviewportfit'));
    if (performance.now() < fin) requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
}
function closeModal(overlayId) {
  if (isTutorialHoldingModal(overlayId)) return;
  // Fenêtre fermée : ses onglets oublient leur position, on la rouvrira en haut.
  for (const cle of Object.keys(_defilementOnglets)) delete _defilementOnglets[cle];
  const overlay = document.getElementById(overlayId);
  // Fondu de sortie seulement pour une fenêtre réellement ouverte : le reset ferme toutes les
  // fenêtres d'un coup, et celles déjà fermées ne doivent pas réapparaître un instant.
  if (overlay.classList.contains('open')) {
    overlay.classList.remove('open');
    overlay.classList.add('fermeture');
    clearTimeout(overlay._fermetureTimer);
    overlay._fermetureTimer = setTimeout(() => overlay.classList.remove('fermeture'), dureeAnimationMs(overlay) + 20);
  }
  flushPendingPapiCategories();
  if (_onModalCloseCallbacks[overlayId] && _onModalCloseCallbacks[overlayId].length) {
    _onModalCloseCallbacks[overlayId].splice(0).forEach(cb => cb());
  }
}
// Vrai si une modale (Paramètres/Succès/Quêtes) ou la page Magasin est actuellement ouverte —
// sert à n'afficher les répliques ambiantes de Papi que sur l'écran principal, jamais par-dessus un menu.
function isAnyModalOpen() {
  return Object.values(GROUP_TO_OVERLAY).some(isOverlayOpen);
}
// Vrai si N'IMPORTE QUOI empêche de considérer qu'on est tranquillement sur l'écran principal :
// une modale, la fenêtre de mise à jour, le splash, le popup de langue, la scène d'ouverture ou
// le tutoriel. Les répliques ambiantes de Papi ne doivent JAMAIS apparaître par-dessus l'un de ces écrans.
function isMainScreenBlocked() {
  // Un tutoriel forcé (spotlight en cours, avant même que le joueur ait ouvert la fenêtre
  // visée) doit bloquer exactement comme un menu ouvert — sinon un événement aléatoire (Papi
  // qui débarque, herbe dorée, papillons...) peut apparaître par-dessus et perturber le
  // tutoriel, qui doit rester la SEULE chose à l'écran tant qu'il est en cours.
  if (_pendingSpotlightGroup) return true;
  if (isAnyModalOpen()) return true;
  const updateOverlay = document.getElementById('updatePromptOverlay');
  if (updateOverlay && updateOverlay.classList.contains('open')) return true;
  const splash = document.getElementById('splashOverlay');
  if (splash && splash.style.display !== 'none') return true;
  const lang = document.getElementById('langPopupOverlay');
  if (lang && lang.style.display === 'flex') return true;
  const scene = document.getElementById('sceneOverlay');
  if (scene && scene.classList.contains('visible')) return true;
  const tutorial = document.getElementById('tutorialOverlay');
  if (tutorial && tutorial.style.display === 'flex') return true;
  return false;
}

// La plupart des achats se font DANS le magasin (une fenêtre) — ces réactions de Papi doivent
// donc attendre que le joueur revienne à l'écran principal plutôt que d'apparaître par-dessus.
let _pendingPapiCategories = [];
// Tant qu'un tutoriel (annonce de nouvel onglet) est en cours — texte affiché OU spotlight/
// fenêtre encore en attente —, aucune autre réplique de Papi (achievement, commentaire de
// boutique, etc.) ne doit se mélanger : le joueur ne doit voir QUE le tutoriel pendant cette
// période. Ces répliques sont simplement mises en attente, comme pour un menu ouvert.
function tutorialInProgress() {
  return _dialogueBusy || !!_pendingSpotlightGroup;
}
function queueOrShowPapi(category, options = {}) {
  if (isMainScreenBlocked() || tutorialInProgress()) {
    if (!_pendingPapiCategories.includes(category)) _pendingPapiCategories.push(category);
    return;
  }
  papiSaysFromCategory(category, options);
}
function flushPendingPapiCategories() {
  if (isMainScreenBlocked() || tutorialInProgress() || _pendingPapiCategories.length === 0) return;
  const cat = _pendingPapiCategories.shift();
  papiSaysFromCategory(cat, { onComplete: flushPendingPapiCategories });
}

document.getElementById('settingsBtn').addEventListener('click', () => { document.getElementById('settingsBtn').classList.remove('featureHighlight'); openModal('settingsModalOverlay'); });
document.getElementById('settingsModalCloseBtn').addEventListener('click', () => closeModal('settingsModalOverlay'));
document.getElementById('achievementsBtn').addEventListener('click', () => { document.getElementById('achievementsBtn').classList.remove('featureHighlight'); openModal('achievementsModalOverlay'); });
document.getElementById('achievementsModalCloseBtn').addEventListener('click', () => closeModal('achievementsModalOverlay'));
document.getElementById('questsBtn').addEventListener('click', () => { document.getElementById('questsBtn').classList.remove('featureHighlight'); openModal('questsModalOverlay'); });
document.getElementById('questsModalCloseBtn').addEventListener('click', () => closeModal('questsModalOverlay'));
// Pas de menu du clic droit (Inspecter, Recharger...) : c'est un jeu, pas une page web.
document.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('shopBtn').addEventListener('click', () => { document.getElementById('shopBtn').classList.remove('featureHighlight'); openModal('shopPageOverlay'); });
document.getElementById('shopPageCloseBtn').addEventListener('click', () => {
  closeModal('shopPageOverlay');
  hideShopComment();
});
// Cliquer sur le fond sombre des modales (pas la page Magasin, en plein écran) les ferme aussi
document.getElementById('settingsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsModalOverlay') closeModal('settingsModalOverlay'); });
document.getElementById('achievementsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'achievementsModalOverlay') closeModal('achievementsModalOverlay'); });
document.getElementById('questsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'questsModalOverlay') closeModal('questsModalOverlay'); });

const GROUP_TO_OVERLAY = { shop: 'shopPageOverlay', settings: 'settingsModalOverlay', quests: 'questsModalOverlay', achievements: 'achievementsModalOverlay' };
const GROUP_TO_FLOAT_BTN = { shop: 'shopBtn', settings: 'settingsBtn', quests: 'questsBtn', achievements: 'achievementsBtn' };

// Position de défilement de chaque onglet (les identifiants d'onglets sont uniques, tous menus
// confondus), le temps que sa fenêtre reste ouverte. Sans elle, revenir sur Production après un
// détour par Clic renvoyait en haut d'une liste de trente compagnons. Oubliée à la fermeture :
// une fenêtre rouverte repart du haut.
const _defilementOnglets = {};
function ongletActifDu(groupe) {
  return { shop: activeShopTab, settings: activeSettingsTab, quests: activeQuestsTab }[groupe];
}
function miniTabClick(t, onSelect) {
  const zone = document.querySelector(`#${GROUP_TO_OVERLAY[t.group]} .shopPageContent, #${GROUP_TO_OVERLAY[t.group]} .sideModalContent`);
  const quitte = ongletActifDu(t.group);
  if (zone && quitte) _defilementOnglets[quitte] = zone.scrollTop;
  _highlightedTabIds.delete(t.id);
  // Le doigt ne s'efface que si le joueur a cliqué l'onglet DÉSIGNÉ. S'il en explore un autre
  // entre-temps, l'indication doit rester à l'écran, sinon plus rien ne lui dit où aller.
  if (!_pointedTabId || _pointedTabId === t.id) clearMiniTabArrow();
  onSelect(t.id);
  // Le conteneur à défilement est partagé par tous les panneaux du menu : on le ramène à la
  // position mémorisée pour l'onglet d'arrivée (le haut s'il n'a jamais été ouvert), une fois
  // son contenu dessiné, sinon la hauteur n'est pas encore la bonne.
  if (zone) {
    zone.scrollTop = 0;
    const retour = _defilementOnglets[t.id] || 0;
    if (retour) requestAnimationFrame(() => { zone.scrollTop = retour; });
  }
  dismissDialogue();
  revealPendingDescription(t.id, () => {
    // Papi a fini de parler : re-rendre dégrise les autres mini-onglets (le verrou ne tient que
    // tant qu'une réplique est à l'écran, mais c'est le rendu qui l'applique aux boutons).
    renderAll();
    const cb = _pendingTabOpenedCallbacks[t.id];
    if (cb) { delete _pendingTabOpenedCallbacks[t.id]; cb(); }
  });
  renderAll();
}
function tabButtonClass(t, activeId, locked) {
  return 'drawerBtn'
    + (activeId === t.id ? ' active' : '')
    + (_highlightedTabIds.has(t.id) ? ' featureHighlight' : '')
    + (_appearingTabIds.has(t.id) ? ' tabAppear' : '')
    + (locked ? ' locked' : '');
}
// `revealed` est la liste déjà calculée par renderTabsRow : la recalculer ici la referait trois
// fois par rendu, une par groupe.
function renderMiniTabsRow(containerId, group, activeId, onSelect, revealed) {
  const unlocked = revealed.filter(t => t.group === group);
  const container = document.getElementById(containerId);
  if (!container) return;
  // Pendant que Papi présente un onglet de ce groupe, tous les AUTRES mini-onglets du menu
  // sont désactivés : le joueur ne peut rien faire d'autre que cliquer sur celui indiqué.
  // Dès qu'il a fini de parler, tout est dégrisé — rester coincé sans rien pouvoir ouvrir
  // jusqu'à la fermeture de la fenêtre n'avait aucune raison d'être.
  const isGroupLocked = isTutorialSpeakingFor(group);
  // Même verrou pour le CONTENU de la fenêtre (voir .papiParle) : les mini-onglets grisés ne
  // servaient à rien si le joueur pouvait acheter pendant que Papi parlait.
  const fenetre = document.getElementById(GROUP_TO_OVERLAY[group]);
  if (fenetre) fenetre.classList.toggle('papiParle', isGroupLocked);
  const ids = unlocked.map(t => t.id);
  // offsetParent est null tant qu'un ancêtre est en display:none — c'est ainsi qu'on sait si
  // cette rangée est réellement sous les yeux du joueur. Lu SEULEMENT quand la réponse sert :
  // c'est une lecture de mise en page, qui force un recalcul, et cette fonction tourne trois
  // fois par rendu entre deux séries d'écritures de styles.
  if (_tabsPendingAppear.size && container.offsetParent !== null) {
    ids.filter(id => _tabsPendingAppear.has(id)).forEach(id => {
      _tabsPendingAppear.delete(id);
      markTabAppearing(id);
    });
  }
  const existingButtons = [...container.children];
  const sameSet = existingButtons.length === ids.length && existingButtons.every((btn, i) => btn.dataset.tabId === ids[i]);
  if (sameSet) {
    // Le jeu re-rend cette rangée plusieurs fois par seconde (tick, clics...) — si le même
    // ensemble d'onglets est déjà affiché, on se contente de mettre à jour les classes des
    // boutons EXISTANTS plutôt que de tout détruire/recréer à chaque fois. Sans ça, un clic du
    // joueur pouvait tomber pile au moment où son bouton était remplacé par un nouveau nœud
    // DOM identique, et le clic ne "prenait" pas (il fallait recliquer).
    existingButtons.forEach((btn, i) => {
      const t = unlocked[i];
      const locked = isGroupLocked && t.id !== _lockedToTabId;
      const cls = tabButtonClass(t, activeId, locked);
      if (btn.className !== cls) btn.className = cls;
      if (btn.disabled !== locked) btn.disabled = locked;
    });
    return;
  }
  container.innerHTML = '';
  unlocked.forEach(t => {
    const btn = document.createElement('button');
    const locked = isGroupLocked && t.id !== _lockedToTabId;
    btn.className = tabButtonClass(t, activeId, locked);
    btn.dataset.tabId = t.id;
    btn.disabled = locked;
    btn.innerHTML = `<span class="icon">${t.icon}</span> ${L(t,'label')}`;
    btn.onclick = () => miniTabClick(t, onSelect);
    container.appendChild(btn);
  });
}

// Détection des onglets fraîchement débloqués. Appelée depuis le tick de jeu, et SURTOUT PAS
// depuis un rendu : une annonce redessine l'écran en cours de route, et détecter là revenait à
// lancer une deuxième annonce à l'intérieur de la première (deux doigts, deux bulles).
// Un onglet n'est marqué « vu » QUE lorsque son annonce commence (voir
// announceNewTabsSequentially) : il apparaît donc dans la rangée à son tour, pas avec tout le
// lot détecté d'un coup. `_tabsQueuedForAnnounce` évite de le re-détecter pendant qu'il patiente.
function verifierNouveauxOnglets() {
  if (isMainScreenBlocked()) return;
  const nouveaux = unlockedTabs().filter(t => !state.tabsSeen[t.id] && !_tabsQueuedForAnnounce.has(t.id));
  if (!nouveaux.length) return;
  nouveaux.forEach(t => _tabsQueuedForAnnounce.add(t.id));
  announceNewTabsSequentially(nouveaux);
}

function renderTabsRow() {
  // L'onglet actif doit être un onglet VISIBLE, pas seulement débloqué.
  const revealed = revealedTabs();
  if (!revealed.find(t => t.id === activeShopTab && t.group === 'shop')) activeShopTab = 'production';
  if (!revealed.find(t => t.id === activeSettingsTab && t.group === 'settings')) activeSettingsTab = 'options';
  if (!revealed.find(t => t.id === activeQuestsTab && t.group === 'quests')) activeQuestsTab = 'quetes';

  renderMiniTabsRow('shopTabsRow', 'shop', activeShopTab, (id) => { activeShopTab = id; }, revealed);
  renderMiniTabsRow('settingsTabsRow', 'settings', activeSettingsTab, (id) => { activeSettingsTab = id; }, revealed);
  renderMiniTabsRow('questsTabsRow', 'quests', activeQuestsTab, (id) => { activeQuestsTab = id; }, revealed);
}

// Pour un joueur qui recharge une partie déjà avancée : les boutons dont au moins un onglet
// a déjà été vu doivent être visibles tout de suite, sans attendre une nouvelle annonce (le
// halo de mise en évidence, lui, ne se joue que pour un VRAI nouveau déblocage). Appelé UNE
// SEULE FOIS au chargement (appelé une seule fois par demarrage.js) — surtout pas depuis renderTabsRow(), qui
// tourne en continu : state.tabsSeen[id] passe à true dès la détection du déblocage (avant
// même que l'annonce de Papi ait joué), donc rechecker ce flag à chaque rendu révélait les
// boutons instantanément au lieu d'attendre highlightNewFeature().
function syncRevealedButtonsOnLoad() {
  if (_suppressTabAnnouncements) return;
  // 'shop' inclus : son bouton n'est plus affiché d'office (il n'apparaît qu'à 200 clics), donc
  // sans lui un joueur qui relance le jeu après l'avoir débloqué se retrouvait sans magasin.
  Object.keys(GROUP_TO_FLOAT_BTN).forEach(group => {
    const groupTabs = TAB_DEFS.filter(t => t.group === group);
    const anySeen = groupTabs.some(t => state.tabsSeen[t.id]);
    const btnId = GROUP_TO_FLOAT_BTN[group];
    if (anySeen && btnId) document.getElementById(btnId).classList.add('revealed');
  });
}

function renderPanelsVisibility() {
  document.querySelectorAll('.tabPanel').forEach(p => p.classList.remove('active'));
  // .tabPanel = "un panneau parmi plusieurs, commutés par une rangée de mini-onglets". Les
  // fenêtres à panneau unique (Succès, Bonus quotidien) ne portent donc PAS cette classe : le
  // balayage ci-dessus les éteignait sans que rien ne les rallume, et leur fenêtre s'ouvrait
  // vide — c'est ce qui rendait le calendrier des récompenses quotidiennes invisible.
  ['tab-' + activeShopTab, 'tab-' + activeSettingsTab, 'tab-' + activeQuestsTab].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  });
}
