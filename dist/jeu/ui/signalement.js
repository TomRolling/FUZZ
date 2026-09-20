// ================= SIGNALEMENT DE BUG =================
// Un joueur qui tombe sur un bug n'a sous la main ni sa version, ni son environnement, ni l'état
// de sa partie : le rapport est donc rempli d'avance. Il est montré tel quel, modifiable, avant
// tout envoi — rien ne part sans que le joueur l'ait lu. Le bouton « Copier » sert à ceux qui
// n'ont pas de compte GitHub : le rapport se colle aussi bien ailleurs.
const DEPOT_GITHUB = 'https://github.com/TomRolling/FUZZ';
function environnementJoueur() {
  const systeme = navigator.platform || navigator.userAgent;
  return isTauriApp()
    ? selonLangue(`application installée, ${systeme}`, `installed app, ${systeme}`)
    : selonLangue(`version web, ${navigator.userAgent}`, `web version, ${navigator.userAgent}`);
}
function rapportDeBug() {
  const onglets = TAB_DEFS.filter(t => state.tabsSeen[t.id]).map(t => t.id).join(', ') || '-';
  const compagnons = Object.values(state.buildings || {}).reduce((s, n) => s + (n || 0), 0);
  const heures = Math.round((state.totalPlayTimeSec || 0) / 360) / 10;
  const erreurs = _erreursRecentes.length ? _erreursRecentes.join(' | ') : selonLangue('aucune', 'none');
  const technique = [
    `FUZZ v${VERSION_JEU} (${environnementJoueur()})`,
    `${selonLangue('Langue', 'Language')} : ${state.lang} | ${selonLangue('sauvegarde', 'save')} v${state.saveVersion || SAVE_VERSION} | ${selonLangue('temps de jeu', 'play time')} : ${heures} h`,
    `${selonLangue('Verdure', 'Greenery')} : ${formatNum(state.verdure)} (${formatNum(totalCps())}/s) | ${selonLangue('Connaissances', 'Knowledge')} : ${formatNum(state.knowledge || 0)}`,
    `${selonLangue('Prestiges', 'Prestiges')} : ${state.prestigeCount || 0} | ${selonLangue('Ascensions', 'Ascensions')} : ${state.totalAscensions || 0} | ${selonLangue('Graines', 'Seeds')} : ${state.cosmicSeeds || 0} | ${selonLangue('Éclats', 'Shards')} : ${state.stellarShards || 0}`,
    `${selonLangue('Compagnons', 'Companions')} : ${compagnons} | ${selonLangue('Onglets ouverts', 'Tabs unlocked')} : ${onglets}`,
    `${selonLangue('Erreurs récentes', 'Recent errors')} : ${erreurs}`,
  ].join('\n');
  return selonLangue(
    `### Ce qui s'est passé\n(raconte ici ce que tu faisais et ce qui n'allait pas)\n\n### Informations techniques\n${technique}\n`,
    `### What happened\n(describe here what you were doing and what went wrong)\n\n### Technical details\n${technique}\n`);
}
// L'app native n'ouvre pas les liens toute seule : elle passe par le plugin « opener ». S'il
// manque (ancienne version installée), le joueur ne reste pas sans rien — l'adresse part dans le
// presse-papiers.
async function ouvrirLienExterne(url) {
  if (isTauriApp()) {
    const T = window.__TAURI__;
    // Deux chemins vers le même plugin : l'API globale quand elle est injectée, sinon l'appel
    // direct à sa commande. Si les deux échouent, c'est que l'application tourne sans le plugin
    // « opener » (binaire construit avant son ajout) — le presse-papiers prend alors le relais.
    try {
      if (T.opener && T.opener.openUrl) { await T.opener.openUrl(url); return true; }
      const invoke = (T.core && T.core.invoke) || (window.__TAURI_INTERNALS__ || {}).invoke;
      if (invoke) { await invoke('plugin:opener|open_url', { url }); return true; }
    } catch (e) { console.error('ouverture du lien impossible :', e); }
    await writeClipboardText(url);
    showToast(selonLangue('Adresse copiée : colle-la dans ton navigateur.', 'Link copied: paste it into your browser.'));
    return false;
  }
  window.open(url, '_blank', 'noopener');
  return true;
}
function lienSignalement(rapport) {
  return `${DEPOT_GITHUB}/issues/new?title=${encodeURIComponent(selonLangue('Bug : ', 'Bug: '))}&body=${encodeURIComponent(rapport)}`;
}
document.getElementById('bugReportBtn').addEventListener('click', () => {
  document.getElementById('bugReportText').value = rapportDeBug();
  document.getElementById('bugReportOverlay').style.display = 'flex';
});
document.getElementById('bugReportOpenBtn').addEventListener('click', () => {
  ouvrirLienExterne(lienSignalement(document.getElementById('bugReportText').value));
});
document.getElementById('bugReportCopyBtn').addEventListener('click', async () => {
  const ok = await writeClipboardText(document.getElementById('bugReportText').value);
  showToast(ok ? selonLangue('Rapport copié.', 'Report copied.') : selonLangue('Copie impossible : sélectionne le texte à la main.', 'Copy failed: select the text by hand.'));
});
document.getElementById('bugReportCloseBtn').addEventListener('click', () => fermerSurgissante('bugReportOverlay'));
document.getElementById('resetBtn').addEventListener('click', () => {
  const confirmMsg = state.lang === 'en'
    ? 'Reset everything? All your progress is erased (Greenery, companions, Seeds, Shards, research, pets, achievements...). Only your settings (language, sound, theme, vacation mode) are kept. This cannot be undone.'
    : 'Tout remettre à zéro ? Toute ta progression est effacée (Verdure, compagnons, Graines, Éclats, recherches, familiers, succès...). Seuls tes paramètres (langue, son, thème, mode vacances) sont gardés. Action irréversible.';
  if (confirm(confirmMsg)) performFullReset();
});

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

// Réinitialisation complète : garde la langue déjà choisie (pas besoin de la redemander),
// fait un petit fondu vers noir, puis rejoue la séquence de lancement depuis après le choix
// de langue (vérification de MAJ puis scène d'ouverture), comme au tout premier lancement.
function performFullReset() {
  arreterPresentationsEnCours();
  // _suppressTabAnnouncements n'est normalement calculé qu'une fois, au chargement de la page
  // (!state.tutorialSeen à ce moment-là) — un reset ne recharge pas la page, donc sans cette
  // ligne il restait bloqué à sa valeur d'AVANT le reset. Pour un joueur qui avait déjà terminé
  // le tutoriel puis reset en cours de partie, ça valait déjà "false", ce qui faisait déclencher
  // DEUX annonces indépendantes pour les mêmes onglets de Paramètres juste après le reset (le
  // tick de jeu normal ET l'appel explicite programmé par tutorialCloseBtn) — d'où le bug
  // intermittent où Papi répétait/mélangeait ses présentations d'onglets après un reset.
  _suppressTabAnnouncements = true;
  // Les boutons flottants (Paramètres/Succès/Quêtes/Bonus quotidien/Magasin) ne perdent JAMAIS
  // leur classe "revealed"/"featureHighlight" toutes seules (elle n'est retirée qu'au clic sur
  // la cible, jamais réévaluée depuis l'état) — sans ce nettoyage explicite, ils restaient
  // débloqués à l'écran après un reset alors que la sauvegarde, elle, repartait bien à zéro.
  Object.values(GROUP_TO_FLOAT_BTN).forEach(id => {
    document.getElementById(id).classList.remove('revealed', 'featureHighlight');
  });
  const overlay = document.getElementById('splashOverlay');
  document.getElementById('splashSlideStudio').style.display = 'none';
  document.getElementById('splashSlideLogo').style.display = 'none';
  overlay.style.display = 'flex';
  overlay.classList.remove('hidden');
  setTimeout(() => {
    // Un reset total ne doit garder QUE les paramètres (langue, son, thème, mode vacances) —
    // tout le reste (progression, Graines, Éclats, familiers, onglets débloqués, skins, succès...)
    // repart à zéro.
    const preserved = {
      lang: state.lang,
      langChosen: state.langChosen,
      soundEnabled: state.soundEnabled,
      soundVolume: state.soundVolume,
      forceDarkMode: state.forceDarkMode,
      vacationMode: state.vacationMode,
    };
    // Rien de l'ancienne partie ne doit pouvoir revenir : sans ça, « Restaurer la sauvegarde de
    // secours » ou une ancienne clé d'avant le renommage la ramenaient.
    [SAVE_KEY_BACKUP, SAVE_KEY_AVANT_IMPORT, LEGACY_SAVE_KEY, LEGACY_SAVE_KEY_BACKUP].forEach(k => localStorage.removeItem(k));
    // Ce qui vit en mémoire hors de la sauvegarde (la page n'est pas rechargée) : bonus en cours,
    // vitesse du mode test, combo de clics, herbes dorées et papillons encore à l'écran.
    for (const k of Object.keys(_boosts)) delete _boosts[k];
    _vitesseTest = 1;
    _recentClickTimes = [];
    _lastClickTime = null;
    document.querySelectorAll('#gameViewport .golden').forEach(el => el.remove());
    const panneauTest = document.getElementById('modeTestPanel');
    if (panneauTest) panneauTest.remove();
    state = defaultState();
    Object.assign(state, preserved);
    saveGame();
    renderAll();
    proceedToUpdateCheck(() => {
      overlay.classList.add('hidden');
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    });
  }, 450);
}

// Affiche la réplique de départ de Papi (si l'écran principal n'est pas déjà occupé par autre
// chose) puis ferme, sans jamais obliger le joueur à cliquer dessus : le texte avance tout seul
// une fois lu (autoAdvanceMs, même mécanisme que les descriptifs d'onglets du tutoriel).
function quitGameWithPapiLine(doClose) {
  // Une bulle déjà affichée (remarque, annonce) passerait avant et attendrait un clic : on la
  // retire, le jeu se ferme de toute façon.
  hideDialogue(false);
  if (!papiSaysFromCategory('quitGame', { onComplete: doClose })) doClose();
}

document.getElementById('quitGameBtn').addEventListener('click', () => {
  if (isTauriApp() && window.__TAURI__.window) {
    const appWindow = window.__TAURI__.window.getCurrentWindow();
    // Referme d'abord la fenêtre Paramètres : sinon isMainScreenBlocked() la voit encore
    // ouverte et Papi ne dirait jamais rien avant que le jeu ne se ferme. Sauf si le tutoriel
    // d'introduction des Paramètres est justement en train de l'utiliser (spotlight/descriptif
    // pas encore terminés) : la fermer de force romprait son verrou partagé (_pendingSpotlightGroup)
    // et bloquerait le jeu sur une annonce fantôme — dans ce cas on laisse juste
    // isMainScreenBlocked() supprimer la réplique de Papi et fermer directement, comme d'habitude.
    if (_pendingSpotlightGroup !== 'settings') closeModal('settingsModalOverlay');
    quitGameWithPapiLine(() => appWindow.close());
  } else {
    showToast(state.lang === 'en' ? '🚪 This only works in the installed app.' : '🚪 Ça ne fonctionne que dans l\'application installée.');
  }
});

