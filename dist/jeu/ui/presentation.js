// ================= PRÉSENTATION DES ONGLETS PAR PAPI =================
// Annonces des onglets débloqués, doigt, halo, bulle accrochée à sa cible, descriptifs, et leur
// interruption. Séparé de la navigation pure (ui/navigation.js) : c'est le système qui casse
// le plus souvent, il a droit à son propre fichier.

// Empêche les annonces de Papi de se déclencher PENDANT la scène d'ouverture (les onglets
// par défaut Stats/Journal/Options n'ont pas besoin d'être annoncés au tout premier lancement,
// ils seraient sinon en concurrence visuelle avec la scène d'intro).
let _suppressTabAnnouncements = !state.tutorialSeen;

// Tant qu'un menu est "possédé" par une annonce forcée (spotlight cliqué mais fenêtre pas
// encore refermée), _pendingSpotlightGroup retient QUEL groupe (shop/settings/quests/...) —
// toute nouvelle annonce d'un AUTRE groupe doit patienter, sinon un bouton "quêtes" ou "bonus
// quotidien" pourrait se déclencher pendant qu'un spotlight précédent est encore affiché ou que
// sa fenêtre est encore ouverte. En revanche, une annonce du MÊME groupe est autorisée à
// s'enchaîner tout de suite (voir highlightNewFeature) : si le tuto suivant concerne le menu
// déjà ouvert, pas question de faire ressortir puis rerentrer le joueur pour rien.
// Contrairement à _dialogueBusy (qui ne suit que le TEXTE affiché et se libère dès que le
// joueur a fini de lire, bien avant que le spotlight soit cliqué ou la fenêtre refermée), ce
// verrou reste actif jusqu'à la fermeture réelle de la fenêtre concernée.
let _pendingSpotlightGroup = null;
let _pendingTabAnnouncements = [];

// Le descriptif d'un onglet (ce qu'il contient/permet) n'est plus dit dans l'annonce de
// déblocage — seulement une fois que le joueur a VRAIMENT ouvert cet onglet précis (clic sur le
// mini-onglet, ou sur le bouton flottant si le groupe n'a qu'un seul onglet — ex: Succès).
//
// « Cet onglet doit encore son explication » est un état DÉRIVÉ : révélé (tabsSeen), pas encore
// expliqué (tabsDescribed), et non silencieux. Le doubler d'une file en mémoire faisait deux
// sources de vérité, et c'est celle des deux qui ne survivait pas au rechargement qui laissait
// des onglets révélés mais jamais expliqués.
function pendingDescriptionFor(tabId) {
  if (!state.tabsSeen[tabId] || state.tabsDescribed[tabId]) return null;
  const t = TAB_DEFS.find(x => x.id === tabId);
  if (!t || t.silent) return null;
  return tabAnnouncementLines(t);
}
// Onglet dont le descriptif est EN TRAIN d'être joué : sans ça, recliquer le même mini-onglet
// pendant que Papi parle en empilait une seconde lecture (tabsDescribed n'est posé qu'à la fin).
let _descriptionEnCours = null;
// Temps de lecture (ms) d'une remarque de Papi une fois écrite, avant qu'elle ne s'efface toute
// seule : remarques spontanées (papiSaysFromCategory) et commentaires du magasin.
function papiReadingPauseMs(text) { return Math.max(2500, text.length * 50); }

function revealPendingDescription(tabId, onDone) {
  if (_descriptionEnCours === tabId) return; // déjà en cours de lecture : le clic en double ne rejoue rien
  const lines = pendingDescriptionFor(tabId);
  if (!lines) { if (onDone) onDone(); return; }
  _descriptionEnCours = tabId;
  // PAS d'auto-avance ici : le joueur clique lui-même pour passer à la réplique suivante.
  // Une avance automatique ne laissait pas le temps de lire. Un descriptif est un tableau de
  // plusieurs répliques courtes (plutôt qu'un long pavé) pour ne pas agrandir la bulle —
  // tabAnnouncementLines renvoie toujours un tableau, même pour une réplique unique.
  showDialogue('papi', lines, { position: 'top-right', onComplete: () => {
    stopFollowingDialogueAnchor();
    clearDescribedZone();
    // Mémorisé DURABLEMENT : c'est la seule trace de ce qui a déjà été expliqué, y compris
    // après un rechargement (voir pendingDescriptionFor).
    state.tabsDescribed[tabId] = true;
    _descriptionEnCours = null;
    saveGame();
    if (onDone) onDone();
  } });
  // Papi décrit le CONTENU de l'onglet : un halo doré entoure la zone concernée (rien à
  // cliquer, donc pas de doigt ni de "Clique ici !") et la bulle se place là où elle ne la
  // cache pas. Le clic sur la bulle fait disparaître les deux.
  const zone = highlightDescribedZone(tabId);
  followDialogueAnchor(zone || document.querySelector(`[data-tab-id="${tabId}"]`));
}
// La mise en page derrière la bulle peut être reconstruite par un renderAll() (la bulle, elle, a sa
// taille finale dès le début, voir typewriterEffect) : on la recale donc en continu tant que le
// descriptif est affiché.
let _dialogueAnchorTimer = null;
function followDialogueAnchor(targetEl) {
  stopFollowingDialogueAnchor();
  if (!targetEl) return;
  anchorDialogueTo(targetEl);
  _dialogueAnchorRecalage = () => { if (isDialogueVisible()) anchorDialogueTo(targetEl); };
  window.addEventListener('gameviewportfit', _dialogueAnchorRecalage);
  _dialogueAnchorTimer = setInterval(() => {
    if (!isDialogueVisible()) {
      stopFollowingDialogueAnchor();
      return;
    }
    anchorDialogueTo(targetEl);
  }, 150);
}
let _dialogueAnchorRecalage = null;
function stopFollowingDialogueAnchor() {
  if (_dialogueAnchorTimer) { clearInterval(_dialogueAnchorTimer); _dialogueAnchorTimer = null; }
  if (_dialogueAnchorRecalage) { window.removeEventListener('gameviewportfit', _dialogueAnchorRecalage); _dialogueAnchorRecalage = null; }
}
// Onglet suivant à présenter, un par un, dans un groupe multi-onglets (Paramètres/Quêtes/
// Magasin) : rempli quand un onglet est mis en évidence, vidé + appelé quand le joueur clique
// sur CE mini-onglet précis (voir renderMiniTabsRow) — jamais avant, pour ne jamais illuminer
// plusieurs mini-onglets à la fois.
let _pendingTabOpenedCallbacks = {};
// Bascule sur l'onglet interne indiqué pour ce groupe — utilisé uniquement pour le tout
// premier onglet présenté après l'ouverture d'un menu (voir highlightNewFeature) : le joueur
// vient d'ouvrir le menu, donc afficher directement le bon onglet plutôt que de le laisser sur
// l'onglet précédemment actif.
function setActiveTabForGroup(group, tabId) {
  if (group === 'shop') activeShopTab = tabId;
  else if (group === 'settings') activeSettingsTab = tabId;
  else if (group === 'quests') activeQuestsTab = tabId;
}

// Répliques décrivant un onglet — toujours un TABLEAU de lignes, même pour le repli générique
// (showDialogue attend une liste).
function tabAnnouncementLines(t) {
  const bi = PAPI_TAB_ANNOUNCEMENTS_BI[t.id];
  if (bi) return bi[state.lang] || bi.fr;
  return [state.lang === 'en' ? `This is "${L(t,'label')}".` : `Voici "${L(t,'label')}".`];
}
// Annonce les onglets nouvellement débloqués un par un (Papi parle, tu fermes, il t'emmène directement
// au bon endroit) — enchaînés proprement si plusieurs se débloquent en même temps.
function announceNewTabsSequentially(tabs) {
  if (tabs.length === 0) return;
  // Une présentation d'un AUTRE groupe est en cours : celle-ci attend la fermeture de sa fenêtre
  // (voir rendreLaMain), sinon Papi parlerait d'un autre menu pendant qu'on est encore dedans.
  if (_pendingSpotlightGroup && tabs[0].group !== _pendingSpotlightGroup) {
    for (const t of tabs) if (!_pendingTabAnnouncements.includes(t)) _pendingTabAnnouncements.push(t);
    return;
  }
  const t = tabs[0];
  const rest = tabs.slice(1);
  // C'est ICI que l'onglet devient visible : au début de SON annonce, pas au moment où le jeu
  // a détecté le lot. `_tabsPendingAppear` déclenche son animation d'apparition dès que sa
  // rangée est à l'écran (voir renderMiniTabsRow).
  const reveler = () => {
    if (!state.tabsSeen[t.id]) {
      state.tabsSeen[t.id] = true;
      _tabsPendingAppear.add(t.id);
      _tabsQueuedForAnnounce.delete(t.id);
      saveGame();
    }
  };
  // Options/Stats sont présents dès le lancement : les annoncer interromprait le joueur avant
  // même qu'il ait cliqué une fois. On les révèle donc en silence — le bouton apparaît, mais
  // Papi ne dit rien et aucun spotlight ne bloque l'écran.
  if (t.silent) {
    reveler();
    const btnId = GROUP_TO_FLOAT_BTN[t.group];
    if (btnId) document.getElementById(btnId).classList.add('revealed');
    announceNewTabsSequentially(rest);
    return;
  }
  // Pendant l'intro, les onglets se débloquent en silence : Papi les présentera lui-même
  // ensuite, un par un.
  if (_suppressTabAnnouncements) {
    _tabsQueuedForAnnounce.delete(t.id); // sera re-détecté (et annoncé) une fois l'intro finie
    announceNewTabsSequentially(rest);
    return;
  }
  // Annonce de déblocage : dit juste QU'il y a une nouveauté et où cliquer (le spotlight +
  // la flèche font le reste) — jamais CE QUE ça contient, ça c'est pour quand il l'ouvrira.
  const reaction = pickPapiLine('bigUpgrade');
  const revealMsg = state.lang === 'en' ? `Hey, I unlocked "${L(t,'label')}" for you.` : `Tiens, j'ai débloqué "${L(t,'label')}" pour toi.`;

  // Boutons forcés (Magasin/Paramètres/Succès/Quêtes) : la bulle et le spotlight apparaissent EN MÊME
  // TEMPS, et la bulle n'est PAS cliquable pour avancer (voir dismissDialogue) — seul le clic
  // sur le bouton indiqué la fait disparaître. Sans ça, un joueur qui clique vite sur la bulle
  // pouvait enchaîner plusieurs annonces d'un coup avant même de voir le spotlight.
  const combined = reaction ? `${reaction} ${revealMsg}` : revealMsg;
  reveler(); // l'onglet surgit dans sa rangée en même temps que Papi l'annonce
  showDialogue('papi', [combined], { position: 'top-right', blockAdvance: true });
  renderAll();
  highlightNewFeature(t.group, t.id, () => {
    announceNewTabsSequentially(rest.concat(_pendingTabAnnouncements.splice(0)));
  });
}

// Fenêtres qui ont une rangée de mini-onglets (voir renderTabsRow) — Succès n'en a pas.
const GROUPS_WITH_MINI_TABS = new Set(['shop', 'settings', 'quests']);
// Assombrit l'écran et affiche une flèche pointant vers targetEl pour forcer le joueur à
// cliquer dessus avant de continuer — le reste de l'écran (assombri) devient inerte car
// l'overlay est cliqué à sa place, sauf les boutons flottants qui restent au-dessus (z-index).
// Rectangle d'un élément dans les coordonnées de dessin de #gameViewport (avant mise à
// l'échelle). getBoundingClientRect() renvoie des pixels ÉCRAN (donc déjà multipliés par le
// scale) alors que les éléments en position:fixed à l'intérieur du wrapper se positionnent,
// eux, en coordonnées de dessin : sans cette conversion, flèche et bulle seraient décalées
// dès que la fenêtre n'est pas exactement à la taille de référence.
function rectInGameViewport(el) {
  const vp = document.getElementById('gameViewport');
  const r = el.getBoundingClientRect();
  if (!vp) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  const vr = vp.getBoundingClientRect();
  // fitGameViewport publie déjà l'échelle : la relire ici épargne une mesure de mise en page.
  const scale = window._gameScale || (vr.width / (vp.offsetWidth || 1)) || 1;
  return {
    left: (r.left - vr.left) / scale,
    top: (r.top - vr.top) / scale,
    right: (r.right - vr.left) / scale,
    bottom: (r.bottom - vr.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}

// Vrai quand la bulle a été resserrée pour tenir dans une bande libre étroite. Mémorisé pour
// n'effacer la largeur (une écriture, donc un recalcul de mise en page avant la mesure
// suivante) que dans ce cas rare, et pas à chaque passage.
let _dialogueNarrowed = false;
// Rend à la bulle sa position nommée (pos-top-right & co) en effaçant tout placement calculé.
function unanchorDialogue() {
  const box = document.getElementById('dialogueBox');
  if (!box) return;
  _dialogueNarrowed = false;
  box.style.width = '';
  box.style.left = box.style.top = box.style.right = box.style.bottom = '';
}
// Place la bulle de Papi à côté de ce qu'elle commente, du côté où elle ne le recouvre pas,
// et sans jamais sortir de l'écran. Toutes les mesures sont prises AVANT la moindre écriture
// de style : la fonction tourne en boucle pendant les descriptifs du tutoriel, et alterner
// lecture/écriture forcerait un recalcul de mise en page de tout le jeu à chaque passage.
function anchorDialogueTo(targetEl) {
  const box = document.getElementById('dialogueBox');
  const vp = document.getElementById('gameViewport');
  if (!box || !vp || !targetEl) return;
  if (!isDialogueVisible()) return;

  const W = window._gameW || vp.offsetWidth, H = window._gameH || vp.offsetHeight;
  const M = 16, GAP = 20;
  if (_dialogueNarrowed) { box.style.width = ''; _dialogueNarrowed = false; }
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const place = (left, top) => {
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  };

  // Dans le magasin, Papi a déjà son emplacement réservé sur la gauche : sa bulle se cale en
  // bas de CE cadre, jamais par-dessus la liste d'achats de droite (qui est justement ce
  // qu'il commente).
  const shopOpen = document.getElementById('shopPageOverlay').classList.contains('open');
  const papiSlot = document.getElementById('shopImagePlaceholder');
  if (shopOpen && papiSlot && papiSlot.offsetParent !== null) {
    const slot = rectInGameViewport(papiSlot);
    place(Math.max(M, Math.min(W - bw - M, slot.left + slot.width / 2 - bw / 2)),
          Math.max(M, Math.min(H - bh - M, slot.bottom - bh - 12)));
    return;
  }

  // Ce qu'il ne faut pas recouvrir, ce n'est pas seulement l'élément désigné mais la FENÊTRE
  // qui le contient : se caler sur le seul élément plaçait la bulle en plein milieu de la
  // modale ouverte. Une cible devenue invisible donne un rectangle 0×0 en haut à gauche —
  // s'y accrocher y collait la bulle, on repasse alors à la position nommée.
  let r = rectInGameViewport(targetEl.closest('.sideModal') || targetEl);
  if (r.width === 0 && r.height === 0) return unanchorDialogue();
  // Le doigt « Clique ici ! » est posé juste à côté de la cible (voir pointArrowAt, qui l'a
  // placé avant d'appeler cette fonction). Ne regarder que la cible calait la bulle à 20 px
  // d'elle — pile sous le doigt, qui masquait le texte de Papi. L'obstacle est donc
  // le rectangle qui englobe la cible ET le doigt.
  const arrow = document.getElementById('tutorialSpotlightArrow');
  if (arrow && arrow.style.display === 'flex') {
    const a = rectInGameViewport(arrow);
    const left = Math.min(r.left, a.left), top = Math.min(r.top, a.top);
    const right = Math.max(r.right, a.right), bottom = Math.max(r.bottom, a.bottom);
    r = { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  // Essayées dans l'ordre : dessous, dessus, à droite, à gauche. On retient la première qui
  // tient ENTIÈREMENT dans l'écran sans mordre sur l'obstacle.
  const placeBeside = (w, h) => {
    const cy = Math.max(M, Math.min(H - h - M, r.top + r.height / 2 - h / 2));
    const cx = Math.max(M, Math.min(W - w - M, r.left + r.width / 2 - w / 2));
    return [
      { left: cx, top: r.bottom + GAP },
      { left: cx, top: r.top - GAP - h },
      { left: r.right + GAP, top: cy },
      { left: r.left - GAP - w, top: cy },
    ].find(c =>
      c.left >= M && c.top >= M && c.left + w <= W - M && c.top + h <= H - M &&
      (c.left + w <= r.left || c.left >= r.right || c.top + h <= r.top || c.top >= r.bottom));
  };

  let fits = placeBeside(bw, bh);
  if (fits) { place(fits.left, fits.top); return; }

  // Rien ne tient à sa largeur naturelle (une modale large dans une petite fenêtre) : plutôt
  // que de poser la bulle par-dessus ce qu'elle commente, on la resserre à la bande libre la
  // plus large. En dessous de MIN_BW elle deviendrait illisible : on renonce alors et on garde
  // la position nommée, au moins prévisible.
  const MIN_BW = 300;
  const narrow = Math.min(bw, Math.max(r.left - GAP - M, W - r.right - GAP - M));
  if (narrow < MIN_BW) return unanchorDialogue();
  box.style.width = narrow + 'px';
  _dialogueNarrowed = true;
  // Hauteur RE-mesurée : en resserrant la bulle, le texte se replie sur plus de lignes. La
  // réutiliser telle quelle placerait la bulle d'après une hauteur qu'elle n'a plus.
  fits = placeBeside(narrow, box.offsetHeight);
  if (!fits) return unanchorDialogue();
  place(fits.left, fits.top);
}

// Pointeur du tutoriel (doigt + libellé optionnel), réutilisé pour les trois cas de figure :
//  - un bouton flottant à cliquer (avec "Clique ici !" et écran assombri),
//  - un mini-onglet à cliquer (avec "Clique ici !", sans assombrir : la fenêtre est ouverte),
//  - un simple élément que Papi commente (sans libellé : il n'y a rien à cliquer).
// Renvoie la fonction de repositionnement, à rappeler si la mise en page bouge.
function pointArrowAt(targetEl, label) {
  const arrow = document.getElementById('tutorialSpotlightArrow');
  const icon = arrow.querySelector('.tutorialSpotlightArrowIcon');
  const labelEl = document.getElementById('tutorialSpotlightArrowLabel');
  if (labelEl) {
    labelEl.textContent = label || '';
    labelEl.style.display = label ? '' : 'none';
  }
  const position = () => {
    // Hauteur du plan de jeu, déjà calculée par fitGameViewport : offsetHeight relirait la même
    // valeur en forçant un recalcul de mise en page, et ce code tourne en boucle (400 ms).
    const H = window._gameH || window.innerHeight;
    const rect = rectInGameViewport(targetEl);
    // Cible masquée (sa fenêtre est fermée) : son rectangle vaut 0×0 en haut à gauche, et s'y
    // fier plantait le doigt au milieu de l'écran, « Clique ici ! » pointant sur rien. On
    // efface le pointeur : il reviendra tout seul au prochain passage, la cible redevenue
    // visible (pointAtMiniTab rappelle cette fonction en boucle).
    if (rect.width === 0 && rect.height === 0) { arrow.style.display = 'none'; return; }
    arrow.style.display = 'flex';
    arrow.style.left = (rect.left + rect.width / 2) + 'px';
    // Élément trop bas (bouton du magasin par exemple) : la flèche passe AU-DESSUS et pointe
    // vers le bas, sinon elle sortirait de l'écran ou couvrirait ce qu'elle désigne.
    const arrowH = arrow.offsetHeight || 60;
    const below = rect.bottom + 8 + arrowH <= H - 8;
    if (below) {
      arrow.style.top = (rect.bottom + 8) + 'px';
      arrow.classList.remove('pointsDown');
      if (icon) icon.textContent = '👆';
    } else {
      arrow.style.top = (rect.top - 8 - arrowH) + 'px';
      arrow.classList.add('pointsDown');
      if (icon) icon.textContent = '👇';
    }
    anchorDialogueTo(targetEl);
  };
  position(); // pose aussi l'affichage : masqué si la cible ne l'est pas encore
  // PAS d'abonnement à `resize` ici : pointAtMiniTab rappelle cette fonction en boucle, et
  // chaque appel aurait alors ajouté un écouteur de plus dont un seul était jamais retiré.
  // C'est à l'appelant, qui connaît la durée de vie de son pointeur, de s'abonner.
  return position;
}
function hideTutorialArrow() {
  const arrow = document.getElementById('tutorialSpotlightArrow');
  arrow.style.display = 'none';
  arrow.classList.remove('pointsDown');
}

function showTutorialSpotlight(targetEl, onClicked) {
  const overlay = document.getElementById('tutorialSpotlightOverlay');
  const position = pointArrowAt(targetEl, tr('clickHere'));
  window.addEventListener('gameviewportfit', position);
  overlay.style.display = 'block';

  // Le halo pulsant (.featureHighlight) déborde visuellement bien au-delà de la vraie zone
  // cliquable du bouton (jusqu'à ~16px de box-shadow, qui n'agrandit pas la zone de clic
  // réelle) — un joueur qui vise ce halo plutôt que le bouton pile clique alors sur l'écran
  // assombri, qui ne fait rien : ça donne l'impression que le clic "n'a pas pris". On élargit
  // donc la zone cliquable perçue en transférant au bouton tout clic sur l'overlay assez proche.
  const CLICK_MARGIN = 24;
  const onOverlayClick = (e) => {
    const rect = targetEl.getBoundingClientRect();
    const within = e.clientX >= rect.left - CLICK_MARGIN && e.clientX <= rect.right + CLICK_MARGIN &&
                   e.clientY >= rect.top - CLICK_MARGIN && e.clientY <= rect.bottom + CLICK_MARGIN;
    if (within) targetEl.click();
  };
  overlay.addEventListener('click', onOverlayClick);

  targetEl.addEventListener('click', () => {
    overlay.style.display = 'none';
    hideTutorialArrow();
    window.removeEventListener('gameviewportfit', position);
    overlay.removeEventListener('click', onOverlayClick);
    if (onClicked) onClicked();
  }, { once: true });
}

// Doigt + "Clique ici !" sur un mini-onglet à cliquer, SANS assombrir l'écran : la fenêtre du
// groupe est déjà ouverte, l'assombrir donnerait l'impression qu'on ne peut plus rien toucher.
// Le halo doré du mini-onglet, lui, vient de _highlightedTabIds (voir renderMiniTabsRow).
let _miniTabArrowCleanup = null;
let _pointedTabId = null; // mini-onglet actuellement désigné du doigt par Papi
function pointAtMiniTab(tabId) {
  clearMiniTabArrow();
  _pointedTabId = tabId;
  // La rangée de mini-onglets est reconstruite à chaque rendu : on suit la position en continu
  // plutôt que de mémoriser un élément qui peut être remplacé entre-temps. Le suivi démarre
  // MÊME si le bouton n'est pas encore rendu — sortir dans ce cas laissait Papi présenter un
  // onglet sans jamais afficher le doigt.
  const suivre = () => {
    const cur = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (cur) pointArrowAt(cur, tr('clickHere'));
  };
  suivre();
  const timer = setInterval(suivre, 400);
  window.addEventListener('gameviewportfit', suivre); // recalage immediat (fenetre qui bouge, redimensionnement)
  _miniTabArrowCleanup = () => { clearInterval(timer); window.removeEventListener('gameviewportfit', suivre); hideTutorialArrow(); };
}
function clearMiniTabArrow() {
  _pointedTabId = null;
  if (_miniTabArrowCleanup) { _miniTabArrowCleanup(); _miniTabArrowCleanup = null; }
}

// Zone que Papi décrit : halo doré autour du panneau entier, PAS de doigt. Un doigt désigne
// un point précis — donc forcément une ligne de la liste — alors que Papi parle de l'onglet
// dans son ensemble ; le halo dit "c'est de cette zone-là que je parle" sans rien désigner de
// travers. Le halo s'éteint quand le joueur clique la bulle pour la faire disparaître.
let _describedZoneEl = null;
function highlightDescribedZone(tabId) {
  clearDescribedZone();
  // UNIQUEMENT dans le magasin. Dans les petites fenêtres en haut à droite (Paramètres,
  // Succès, Quêtes, Bonus quotidien), la zone à défilement occupe quasiment toute la modale :
  // l'entourer d'un halo ne désigne rien du tout, et l'ombre se fait rogner par les bords
  // arrondis de la fenêtre, ce qui donne un rendu bancal. Là-bas, la bulle de Papi suffit.
  const def = TAB_DEFS.find(t => t.id === tabId);
  if (!def || def.group !== 'shop') return null;
  const panel = document.getElementById('tab-' + tabId);
  if (!panel || panel.offsetParent === null) return null;
  // Le halo va sur le conteneur QUI DÉFILE, pas sur le panneau lui-même : le panneau fait la
  // hauteur de sa liste (souvent bien plus que l'écran) et son ombre était de toute façon
  // rognée par ce conteneur. Sur le conteneur, le halo entoure exactement la zone visible —
  // c'est-à-dire ce que Papi désigne. Ce sont les deux seuls conteneurs à défilement du jeu.
  const zone = panel.closest('.shopPageContent, .sideModalContent') || panel;
  zone.classList.add('tutorialZoneHighlight');
  _describedZoneEl = zone;
  return zone;
}
function clearDescribedZone() {
  if (_describedZoneEl) { _describedZoneEl.classList.remove('tutorialZoneHighlight'); _describedZoneEl = null; }
}
// Met en évidence (halo pulsant + spotlight forcé) le bouton flottant concerné et l'onglet
// correspondant dans la fenêtre qui vient de s'ouvrir, pour n'importe quel groupe (Magasin /
// Paramètres / Succès / Quêtes) — onOpened n'est appelé qu'une fois le bouton réellement cliqué.
function highlightNewFeature(group, tabId, onOpened) {
  const floatBtnId = GROUP_TO_FLOAT_BTN[group];
  const floatBtn = floatBtnId && document.getElementById(floatBtnId);
  _highlightedTabIds.add(tabId);
  _lockedToTabId = tabId;
  renderAll();
  if (!floatBtn) { if (onOpened) onOpened(); return; }
  floatBtn.classList.add('revealed', 'featureHighlight');
  const overlayId = GROUP_TO_OVERLAY[group];

  // Fin de la présentation de CE groupe : rendue à la fermeture de la fenêtre, pour que Papi ne
  // se mette pas à parler d'autre chose alors qu'une fenêtre du groupe est encore ouverte.
  const rendreLaMain = () => {
    _pendingSpotlightGroup = null;
    _lockedToTabId = null;
    if (_pendingTabAnnouncements.length) announceNewTabsSequentially(_pendingTabAnnouncements.splice(0));
    flushPendingPapiCategories();
  };
  // Le joueur est dans la fenêtre : Papi lui montre l'onglet concerné.
  // Dans toute fenêtre à mini-onglets (Magasin, Réglages, Quêtes), CHAQUE onglet présenté est
  // désigné du doigt avec « Clique ici ! », même le tout premier d'un groupe, et Papi attend le
  // clic : c'est ce geste qui ouvre l'onglet et lance son descriptif. Seule la fenêtre des
  // Succès, qui n'a pas de mini-onglets, décrit directement.
  const presenterOnglet = () => {
    floatBtn.classList.remove('featureHighlight');
    if (GROUPS_WITH_MINI_TABS.has(group)) {
      _pendingTabOpenedCallbacks[tabId] = onOpened;
      pointAtMiniTab(tabId); // le clic est pris en charge par miniTabClick
      renderAll();           // grise les autres mini-onglets tant que le doigt désigne celui-ci
      return;
    }
    setActiveTabForGroup(group, tabId);
    _highlightedTabIds.delete(tabId); // sinon le halo reste allumé pendant tout le descriptif
    renderAll();
    revealPendingDescription(tabId, () => { renderAll(); if (onOpened) onOpened(); });
  };
  // Le joueur vient d'arriver dans la fenêtre. Corps commun aux deux façons d'y entrer
  // (spotlight cliqué, ou fenêtre déjà ouverte).
  const entrerDansOnglet = () => {
    dismissDialogue(); // ferme la bulle verrouillée : le joueur a trouvé le bon endroit
    presenterOnglet();
    if (overlayId) waitForModalClose(overlayId, rendreLaMain);
    else rendreLaMain();
  };

  // Une présentation est déjà en cours dans ce groupe : la fenêtre est ouverte et le joueur y
  // est, la main lui sera rendue par le waitForModalClose déjà posé.
  if (_pendingSpotlightGroup === group) { presenterOnglet(); return; }

  _pendingSpotlightGroup = group;
  // La fenêtre est DÉJÀ ouverte : lui demander de cliquer sur le bouton flottant n'aurait aucun
  // sens (il est caché derrière), et la bulle verrouillée ne se ferme QUE par ce clic — le
  // joueur restait bloqué. On entre directement.
  if (overlayId && isOverlayOpen(overlayId)) { entrerDansOnglet(); return; }
  showTutorialSpotlight(floatBtn, entrerDansOnglet);
}

// Suivi persistant des onglets actuellement mis en évidence — nécessaire car
// renderMiniTabsRow() reconstruit entièrement les boutons à chaque rendu (plusieurs fois
// par seconde), ce qui effacerait une classe ajoutée directement sur l'élément.
let _highlightedTabIds = new Set();
// Onglets en cours d'animation d'apparition. Suivi ici et pas sur l'élément : renderMiniTabsRow
// réécrit className à chaque rendu (plusieurs fois par seconde) et effacerait la classe.
let _appearingTabIds = new Set();
// Onglets révélés alors que leur rangée n'était pas à l'écran (le magasin est fermé quand Papi
// les annonce). Jouer l'animation à ce moment-là revenait à la jouer dans le vide : on la
// diffère jusqu'à la première fois où la rangée devient réellement visible.
let _tabsPendingAppear = new Set();
// Onglets dont la condition est remplie mais dont l'annonce n'a pas encore commencé : ils
// attendent leur tour dans la file. Sans ce garde, renderTabsRow les re-détecterait à chaque
// rendu et les empilerait en double.
let _tabsQueuedForAnnounce = new Set();
function markTabAppearing(tabId) {
  _appearingTabIds.add(tabId);
  setTimeout(() => { _appearingTabIds.delete(tabId); }, 600);
}
// Onglet actuellement présenté par Papi dans le groupe en cours (_pendingSpotlightGroup) —
// distinct du halo (_highlightedTabIds, purement visuel et déjà éteint dès le clic) : celui-ci
// verrouille TOUS LES AUTRES mini-onglets du menu tant que Papi n'a pas fini de présenter
// celui-ci (y compris pendant le descriptif, après que son halo se soit déjà éteint).
let _lockedToTabId = null;

// Interrompt tout ce que Papi présente ou attend (annonces, spotlight, bulle, flèches) et referme
// les fenêtres. Utilisé par le reset total et par « Tout débloquer » du mode test.
function arreterPresentationsEnCours() {
  // Vidé AVANT de fermer les fenêtres ci-dessous : sinon un callback "à la fermeture" resté en
  // attente (ex: annonce suivante différée, voir waitForModalClose) se déclencherait pendant le
  // reset lui-même et ferait parler Papi d'autre chose en pleine réinitialisation.
  _onModalCloseCallbacks = {};
  // Un spotlight forcé (voir showTutorialSpotlight) peut être affiché, en attente d'un clic, au
  // moment du reset : sans ça, _pendingSpotlightGroup resterait bloqué pour toujours (plus
  // aucun élément ne le remettra à null), empêchant silencieusement toute future annonce
  // d'onglet après le reset. À lever AVANT de refermer les fenêtres : tant qu'il est posé,
  // closeModal refuse justement de fermer la fenêtre présentée (voir isTutorialHoldingModal).
  _pendingSpotlightGroup = null;
  _lockedToTabId = null;
  Object.values(GROUP_TO_OVERLAY).forEach(closeModal);
  _highlightedTabIds = new Set();
  _appearingTabIds = new Set();
  _tabsPendingAppear = new Set();
  _tabsQueuedForAnnounce = new Set();
  _pendingTabAnnouncements = [];
  _descriptionEnCours = null;
  _pendingTabOpenedCallbacks = {};
  _pendingPapiCategories = [];
  // Une bulle de dialogue (verrouillée ou en train d'avancer toute seule) peut être affichée au
  // moment du reset : sans ce nettoyage, elle resterait visible par-dessus le nouvel écran, ou
  // un minuteur d'auto-avance encore actif se déclencherait plus tard avec des références
  // périmées (l'onglet suivant d'avant le reset).
  hideDialogue(false); // false : la continuation viserait l'onglet d'AVANT le reset
  _dialogueAutoAdvanceMs = null;
  document.getElementById('tutorialSpotlightOverlay').style.display = 'none';
  // Passe aussi par les nettoyages dédiés : ils coupent les minuteurs de suivi de position,
  // qui sinon continueraient à repositionner une flèche invisible après le reset.
  clearMiniTabArrow();
  clearDescribedZone();
  stopFollowingDialogueAnchor();
  hideTutorialArrow();
  clearTimeout(_tutorialBreatherTimer);
}
