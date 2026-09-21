// ================= BULLES DE DIALOGUE, COMMENTAIRES DU MAGASIN, SCÈNES =================
// Commentaire de Papi spécifique au magasin (achats, déblocages liés au shop) : une bulle
// flottante SANS portrait, qui n'apparaît que si on est effectivement dans le magasin —
// sinon la réplique est simplement ignorée pour cette fois (pas de report vers plus tard,
// contrairement aux autres répliques de Papi).
let _shopCommentTimer = null;
function hideShopComment() {
  clearTimeout(_shopCommentTimer);
  stopTypewriter(document.getElementById('shopCommentText'));
  document.getElementById('shopComment').style.display = 'none';
}
function showShopComment(category) {
  const overlay = document.getElementById('shopPageOverlay');
  if (!overlay || !overlay.classList.contains('open')) return false;
  const line = pickPapiLine(category);
  if (!line) return false;
  const box = document.getElementById('shopComment');
  document.getElementById('shopCommentName').textContent = charName('papi');
  box.style.display = 'block';
  clearTimeout(_shopCommentTimer);
  // S'efface tout seul après un temps de lecture, comme les autres remarques de Papi.
  typewriterEffect(document.getElementById('shopCommentText'), line, 20, () => {
    _shopCommentTimer = setTimeout(hideShopComment, papiReadingPauseMs(line));
  });
  _shopCommentCurrentFullText = line;
  return true;
}
let _shopCommentCurrentFullText = '';
document.getElementById('shopComment').addEventListener('click', () => {
  const textEl = document.getElementById('shopCommentText');
  if (skipTypewriterIfActive(textEl, _shopCommentCurrentFullText)) return;
  hideShopComment();
});

let _dialogueQueue = [];
let _dialogueOnComplete = null;
// Vrai pendant une bulle "verrouillée" (voir showDialogue({blockAdvance:true})) : le joueur ne
// peut PAS cliquer sur la bulle pour l'avancer/fermer, seul dismissDialogue() (appelé quand il
// clique sur la vraie cible indiquée) le peut — sinon un joueur qui clique vite "zappe" la
// bulle avant même de voir le spotlight, et enchaîne plusieurs annonces d'un coup.
let _dialogueBlockAdvance = false;


// ================= EFFET MACHINE À ÉCRIRE (texte qui défile lettre par lettre) =================
// Un clic sur "Suivant" pendant que ça défile affiche le texte en entier d'un coup (comme
// dans les vrais JRPG) ; un clic une fois le texte entièrement affiché passe à la réplique suivante.
// Écriture lettre par lettre. Le minuteur est porté par l'élément : la bulle de Papi, le
// commentaire du magasin et la scène peuvent écrire en même temps sans se couper.
function typewriterEffect(el, text, speed = 20, onDone) {
  stopTypewriter(el);
  el.textContent = '';
  // La suite du texte, pas encore écrite, est posée en invisible derrière (voir le CSS
  // `data-reste`) : la bulle a d'emblée sa taille finale et ne grandit plus pendant l'écriture.
  el.dataset.reste = text;
  el._typewriterDone = onDone || null;
  let i = 0;
  el._typewriterTimer = setInterval(() => {
    el.textContent += text[i];
    i++;
    el.dataset.reste = text.slice(i);
    if (i >= text.length) finishTypewriter(el);
  }, speed);
}
function stopTypewriter(el) {
  clearInterval(el._typewriterTimer);
  el._typewriterTimer = null;
  el._typewriterDone = null;
  el.dataset.reste = '';
}
// Fin de l'écriture, qu'elle arrive au bout ou soit passée d'un clic : la suite (avance ou
// fermeture automatique) part dans les deux cas.
function finishTypewriter(el) {
  const suite = el._typewriterDone;
  stopTypewriter(el);
  if (suite) suite();
}
// Renvoie true si un texte était en train de défiler (et l'affiche alors en entier sans avancer) ;
// renvoie false si rien n'était en cours (l'appelant doit alors avancer normalement).
function skipTypewriterIfActive(el, fullText) {
  if (!el._typewriterTimer) return false;
  el.textContent = fullText;
  finishTypewriter(el);
  return true;
}

// Si un dialogue ambiant est déjà en train de s'afficher, tout nouvel appel est mis en
// file d'attente et jouera juste après, au lieu d'écraser le premier en plein milieu
// (ce qui donnait l'impression qu'un message "se passait tout seul" sans qu'on ait pu le lire).
let _dialogueBusy = false;
let _dialogueCallQueue = [];
// Délai (ms) après lequel la bulle avance TOUTE SEULE une fois le texte entièrement affiché —
// voir showDialogue({autoAdvanceMs: ...}). null = comportement normal (avance seulement au clic).
let _dialogueAutoAdvanceMs = null;
let _autoAdvanceTimer = null;
// Vitesse de la machine à écrire (ms par caractère) — voir showDialogue({typeSpeed: ...}).
let _dialogueTypeSpeed = 20;

// showDialogue('leroy', "Une phrase.", { position: 'bottom-left' })
// showDialogue('papi', ["Première phrase.", "Deuxième phrase."], { position: 'top-right', modal: true, onComplete: () => {...} })
//
// characterId : une clé de CHARACTERS (contenu/dialogues.js) ('leroy', 'papi'...)
// lines       : une phrase (string) ou plusieurs (array de strings), affichées une par une avec le bouton "Suivant"
// options.position : 'bottom-left' (défaut) | 'bottom-right' | 'top-left' | 'top-right' | 'center'
// options.modal     : true = bloque le jeu derrière une vitre sombre (pour un moment d'histoire important) ;
//                      false/absent = le joueur peut continuer à jouer pendant que ça s'affiche (défaut)
// options.onComplete: fonction optionnelle appelée quand le joueur a fermé le dialogue
function showDialogue(characterId, lines, options = {}) {
  if (_dialogueBusy) {
    _dialogueCallQueue.push({ characterId, lines, options });
    return;
  }
  _dialogueBusy = true;
  const originalOnComplete = options.onComplete;
  const finalOptions = { ...options, onComplete: () => {
    _dialogueBusy = false;
    if (originalOnComplete) originalOnComplete();
    if (_dialogueCallQueue.length > 0) {
      const next = _dialogueCallQueue.shift();
      showDialogue(next.characterId, next.lines, next.options);
    }
  }};

  _dialogueQueue = Array.isArray(lines) ? [...lines] : [lines];
  _dialogueOnComplete = finalOptions.onComplete;
  _dialogueBlockAdvance = !!finalOptions.blockAdvance;
  _dialogueAutoAdvanceMs = finalOptions.autoAdvanceMs || null;
  _dialogueTypeSpeed = finalOptions.typeSpeed || 20;

  const overlay = document.getElementById('dialogueOverlay');
  const box = document.getElementById('dialogueBox');
  const position = finalOptions.position || 'bottom-left';
  box.className = 'dialogueBox pos-' + position;
  // Une bulle précédente a pu être collée à un élément du tutoriel (anchorDialogueTo pose des
  // coordonnées en ligne) : sans ce nettoyage, elles écraseraient la position nommée demandée.
  unanchorDialogue();
  // Idem pour le suivi de position et le halo de la bulle précédente : si une autre réplique
  // s'affiche avant que celle-ci ne soit refermée, son onComplete ne sera jamais appelé — le
  // minuteur continuerait alors de recaler la NOUVELLE bulle sur l'ANCIENNE zone.
  stopFollowingDialogueAnchor();
  clearDescribedZone();
  overlay.className = 'dialogueOverlay' + (finalOptions.modal ? ' modal' : '');

  const portraitEl = document.getElementById('dialoguePortrait');
  portraitEl.innerHTML = getCharacterPortraitHtml(characterId);
  // (le sprite gère désormais son propre fond, plus besoin de couleur de fond ici)
  document.getElementById('dialogueName').textContent = charName(characterId);

  overlay.classList.add('visible');
  advanceDialogue();
  // Après advanceDialogue : la bulle a pris la taille de sa réplique complète (voir data-reste).
  if (!finalOptions.modal) placerSousLeBandeau(box); // sans effet hors « en haut à droite »
}

// La position « en haut à droite » était fixe (150 px du haut) alors que le bandeau grandit au
// fil de la partie (saison, objectif, visite de Papi, bonus actifs) : en fin de partie, la bulle
// cachait l'objectif, la barre « Prochain » et même la bannière « Papi débarque ». On la pose
// donc juste sous le bas RÉEL du bandeau, sans jamais sortir de l'écran. Un tutoriel qui accroche
// la bulle à un élément (anchorDialogueTo) passe après et garde la main.
function placerSousLeBandeau(box) {
  if (!box || !box.classList.contains('pos-top-right')) return;
  let bas = 0;
  for (const el of [document.querySelector('.topBar'), document.getElementById('boostRow')]) {
    if (!el || !el.offsetParent) continue;
    const r = rectInGameViewport(el); // une seule mesure : la géométrie coûte un calcul de mise en page
    if (r.height < 2) continue;
    bas = Math.max(bas, r.bottom);
  }
  const hauteurJeu = window._gameH || 820;
  const hauteurBulle = box.offsetHeight || 180;
  const haut = Math.max(150, Math.min(bas + 12, hauteurJeu - hauteurBulle - 16));
  box.style.top = Math.round(haut) + 'px';
}
// Le bandeau ne grandit pas qu'au redimensionnement : un bonus qui démarre, « Papi débarque »,
// l'objectif suivant apparaissent en pleine partie, pendant que la bulle est déjà à l'écran.
// Calculer la position une fois à l'affichage ne suffit donc pas — la bulle se retrouvait
// par-dessus la bannière. On observe la taille du bandeau et de la rangée de bonus : tant que
// la bulle est visible et qu'aucun tutoriel ne la tient, elle suit.
function recalerBulleSousBandeau() {
  const box = document.getElementById('dialogueBox');
  if (box && isDialogueVisible() && !_dialogueAnchorTimer && !_dialogueAnchorRecalage) placerSousLeBandeau(box);
}
// (l'observateur est branche dans demarrage.js : voir la note la-bas)

let _dialogueCurrentFullText = '';
function advanceDialogue() {
  if (_autoAdvanceTimer) { clearTimeout(_autoAdvanceTimer); _autoAdvanceTimer = null; }
  const textEl = document.getElementById('dialogueText');
  if (_dialogueQueue.length === 0) { hideDialogue(true); return; }
  const nextLine = _dialogueQueue.shift();
  _dialogueCurrentFullText = nextLine;
  typewriterEffect(textEl, nextLine, _dialogueTypeSpeed, () => {
    // Une fois le texte entièrement affiché, avance tout seul après un temps de lecture — le
    // joueur peut toujours cliquer avant pour aller plus vite, mais n'y est plus obligé.
    if (_dialogueAutoAdvanceMs) {
      _autoAdvanceTimer = setTimeout(() => { _autoAdvanceTimer = null; advanceDialogue(); }, _dialogueAutoAdvanceMs);
    }
  });
}
// Vrai tant qu'un repère montre au joueur OÙ cliquer pour faire avancer une bulle verrouillée :
// l'écran assombri du spotlight, un bouton flottant en halo, ou un mini-onglet en halo.
function tutorialShowsATarget() {
  if (document.getElementById('tutorialSpotlightOverlay').style.display === 'block') return true;
  return !!document.querySelector('.floatBtn.featureHighlight, .drawerBtn.featureHighlight');
}
document.getElementById('dialogueBox').addEventListener('click', () => {
  // Une bulle verrouillée ne se ferme normalement qu'en cliquant la cible indiquée (voir
  // dismissDialogue). Mais si PLUS AUCUNE cible n'est affichée, il n'existe plus de geste qui
  // la ferme : le joueur est enfermé. Dans ce cas seulement, le clic sur la bulle vaut sortie.
  if (_dialogueBlockAdvance) {
    if (!tutorialShowsATarget()) dismissDialogue();
    return;
  }
  const textEl = document.getElementById('dialogueText');
  if (!skipTypewriterIfActive(textEl, _dialogueCurrentFullText)) advanceDialogue();
});
function isDialogueVisible() {
  return document.getElementById('dialogueOverlay').classList.contains('visible');
}
// Démontage complet d'une bulle : minuteurs coupés, file vidée, overlay caché. Les trois
// endroits qui faisaient ça à la main avaient fini par diverger (l'un d'eux laissait tourner la
// machine à écrire et l'auto-avance, et abandonnait la file d'appels).
// `executerLaSuite` dit si la continuation en attente doit être JOUÉE (fermeture normale : c'est
// elle qui libère _dialogueBusy et enchaîne la file, voir showDialogue) ou JETÉE (reset) — dans
// ce dernier cas il faut défaire son travail à la main.
function hideDialogue(executerLaSuite) {
  stopTypewriter(document.getElementById('dialogueText'));
  if (_autoAdvanceTimer) { clearTimeout(_autoAdvanceTimer); _autoAdvanceTimer = null; }
  document.getElementById('dialogueOverlay').classList.remove('visible');
  _dialogueQueue = [];
  _dialogueBlockAdvance = false;
  const suite = _dialogueOnComplete;
  _dialogueOnComplete = null;
  if (executerLaSuite) { if (suite) suite(); }
  else { _dialogueBusy = false; _dialogueCallQueue = []; }
}
// Ferme de force une bulle "verrouillée" (blockAdvance) — appelé quand le joueur clique sur la
// cible réelle indiquée par le spotlight plutôt que sur la bulle elle-même. Sans effet sur une
// bulle normale (celles-là se ferment via le clic dessus, voir ci-dessus).
function dismissDialogue() {
  if (!_dialogueBlockAdvance) return;
  hideDialogue(true);
}

// showScene([{character:'papi', text:'...'}, {character:'leroy', text:'...'}, ...], { left:'papi', right:'leroy', onComplete: fn })
// Affiche les deux personnages face à face en bas de l'écran (façon JRPG rétro) — celui qui ne
// parle pas s'assombrit automatiquement. Réservé aux vrais moments d'histoire (scène d'ouverture...).
let _sceneQueue = [];
let _sceneOnComplete = null;
let _sceneLeftChar = 'papi';
let _sceneRightChar = 'leroy';

function setScenePortraitImage(imgId, charId) {
  const c = CHARACTERS[charId] || {};
  const img = document.getElementById(imgId);
  if (c.portrait) {
    img.src = c.portrait;
    img.style.display = '';
    img.onerror = () => { img.style.display = 'none'; };
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
  }
}

function showScene(exchanges, options = {}) {
  _sceneQueue = [...exchanges];
  _sceneOnComplete = options.onComplete || null;
  _sceneLeftChar = options.left || 'papi';
  _sceneRightChar = options.right || 'leroy';

  setScenePortraitImage('scenePortraitLeftImg', _sceneLeftChar);
  setScenePortraitImage('scenePortraitRightImg', _sceneRightChar);

  document.getElementById('sceneOverlay').classList.add('visible');
  document.body.classList.add('sceneActive');
  advanceScene();
}

let _sceneCurrentFullText = '';
function advanceScene() {
  if (_sceneQueue.length === 0) {
    document.getElementById('sceneOverlay').classList.remove('visible');
    document.body.classList.remove('sceneActive');
    if (_sceneOnComplete) { const fn = _sceneOnComplete; _sceneOnComplete = null; fn(); }
    return;
  }
  const entry = _sceneQueue.shift();
  document.getElementById('sceneName').textContent = charName(entry.character);

  const speakerIsLeft = entry.character === _sceneLeftChar;
  document.getElementById('scenePortraitLeft').classList.toggle('dimmed', !speakerIsLeft);
  document.getElementById('scenePortraitRight').classList.toggle('dimmed', speakerIsLeft);
  const bubble = document.getElementById('sceneBubble');
  bubble.classList.toggle('speaker-left', speakerIsLeft);
  bubble.classList.toggle('speaker-right', !speakerIsLeft);

  const lineText = L(entry, 'text');
  _sceneCurrentFullText = lineText;
  typewriterEffect(document.getElementById('sceneText'), lineText);
}
document.getElementById('sceneOverlay').addEventListener('click', () => {
  const textEl = document.getElementById('sceneText');
  if (!skipTypewriterIfActive(textEl, _sceneCurrentFullText)) advanceScene();
});
// Permet de passer directement à la fin de la scène (dialogue d'ouverture Papi/Leroy, ou toute
// future scène) plutôt que de devoir cliquer ligne par ligne jusqu'au bout.
document.getElementById('sceneSkipBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  _sceneQueue = [];
  advanceScene();
});

