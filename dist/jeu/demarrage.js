// ================= INIT =================
applyOfflineProgress();
generateQuests();
checkAchievements();
syncRevealedButtonsOnLoad();
// Traductions statiques : posées une fois ici, puis uniquement au changement de langue
// (elles ne dépendent de rien d'autre — les rejouer à chaque rendu balayait tout le document).
applyStaticTranslations();
renderAll();

// ---- Séquence de lancement : splash (studio → logo) → choix de langue (1re fois
// seulement) → vérification de mise à jour → scène d'ouverture/tutoriel (1re fois seulement).
// Chaque étape appelle la suivante via callback une fois terminée, jamais en parallèle.
// Chaque étape reçoit un "reveal" : la fonction à appeler quand l'étape SUIVANTE est
// vraiment prête à être montrée (donc quand on peut commencer le fondu de l'étape actuelle
// sans jamais risquer de laisser voir le jeu brut en dessous, même si l'étape suivante
// dépend d'une vérification réseau asynchrone comme la mise à jour).
function runSplashScreen(onReady) {
  const overlay = document.getElementById('splashOverlay');
  const studioSlide = document.getElementById('splashSlideStudio');
  const logoSlide = document.getElementById('splashSlideLogo');
  let advanced = false;
  // Rechargement apres un import (voir applyImportedData) : le joueur etait deja en jeu, on ne lui
  // remontre pas les logos.
  let apresImport = false;
  try { apresImport = !!sessionStorage.getItem(IMPORT_TOAST_FLAG); } catch (e) {}
  if (apresImport) { studioSlide.style.display = 'none'; finish(); return; }
  function finish() {
    if (advanced) return;
    advanced = true;
    onReady(() => {
      overlay.classList.add('hidden');
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    });
  }
  function showLogoSlide() {
    studioSlide.style.display = 'none';
    logoSlide.style.display = 'flex';
    const t = setTimeout(finish, 1500);
    overlay.onclick = () => { clearTimeout(t); finish(); };
  }
  const t1 = setTimeout(showLogoSlide, 1400);
  overlay.onclick = () => { clearTimeout(t1); showLogoSlide(); };
}

function runLanguageChoiceIfNeeded(reveal) {
  if (state.langChosen) { proceedToUpdateCheck(reveal); return; }
  const overlay = document.getElementById('langPopupOverlay');
  overlay.style.display = 'flex';
  reveal(); // le popup est déjà affiché : l'étape précédente (splash) peut commencer son fondu
  function choose(lang) {
    state.lang = lang;
    applyStaticTranslations();
    state.langChosen = true;
    saveGame();
    renderAll();
    document.getElementById('langPopupFr').onclick = null;
    document.getElementById('langPopupEn').onclick = null;
    proceedToUpdateCheck(() => {
      // Appelé UNIQUEMENT une fois que la vérification de MAJ est vraiment terminée
      // (modale affichée ou pas de MAJ) — jamais avant, pour ne jamais laisser voir le jeu brut.
      overlay.classList.add('hidden');
      setTimeout(() => { overlay.style.display = 'none'; }, 500);
    });
  }
  document.getElementById('langPopupFr').onclick = () => choose('fr');
  document.getElementById('langPopupEn').onclick = () => choose('en');
}

function proceedToUpdateCheck(reveal) {
  initUpdateUI(() => {
    reveal();
    runOpeningIfNeeded();
  });
}

function runOpeningIfNeeded() {
  beginBackgroundMusic(); // le jeu commence ici : premier moment où la musique a sa place
  // Confirmation d'un import (voir applyImportedData), une fois l'écran de lancement passé.
  try {
    if (sessionStorage.getItem(IMPORT_TOAST_FLAG)) {
      sessionStorage.removeItem(IMPORT_TOAST_FLAG);
      showToast(state.lang === 'en' ? 'Save imported!' : 'Sauvegarde importée !');
    }
  } catch (e) {}
  if (!state.tutorialSeen) { startOpeningScene(); return; }
  // La récompense quotidienne n'est plus lancée d'ici : voir maybeShowDailyLoginReward (tick).
}

runSplashScreen((reveal) => runLanguageChoiceIfNeeded(reveal));

// Réplique de Papi quand le joueur ferme l'application via la croix (Tauri natif uniquement) —
// voir quitGameWithPapiLine : le texte se ferme tout seul après un temps de lecture, pas besoin
// de cliquer dessus.
if (isTauriApp() && window.__TAURI__.window) {
  try {
    const appWindow = window.__TAURI__.window.getCurrentWindow();
    let _closeConfirmed = false;
    appWindow.onCloseRequested(async (event) => {
      if (_closeConfirmed) return;
      event.preventDefault();
      quitGameWithPapiLine(async () => { _closeConfirmed = true; await appWindow.close(); });
    });
  } catch (e) { console.error('Interception de fermeture indisponible :', e); }
}

// ================= RAPPELS ARMÉS AU CHARGEMENT =================
// Tout ce qui peut se déclencher tout seul est armé ICI, dans le dernier fichier chargé et après
// applyOfflineProgress : minuteurs, requestAnimationFrame, requestIdleCallback, observateurs, et
// les événements de cycle de vie de la page. Armé plus tôt, un rappel pouvait partir entre deux
// balises <script> — le navigateur peut rendre entre elles, et sur le web chaque fichier est une
// requête. Un ResizeObserver a ainsi appelé des fonctions pas encore chargées, et le tick
// sauvegardait avant le calcul du gain hors ligne, qui disparaissait sans la moindre erreur.
// Ce que fait chaque rappel est défini dans son fichier ; seul le « quand » vit ici.
// Règle vérifiée par tests/check-tables.js.
requestAnimationFrame(animerCompteurVerdure);
const _observateurBandeau = new ResizeObserver(recalerBulleSousBandeau);
for (const el of [document.querySelector('.topBar'), document.getElementById('boostRow')]) {
  if (el) _observateurBandeau.observe(el);
}
// Changer d'onglet ou fermer peut survenir pendant le chargement : sauvegarder à ce moment-là
// réécrivait lastSave avant le calcul du gain hors ligne.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });
window.addEventListener('beforeunload', () => { saveGame(); });
setInterval(peutEtreHerbeDoree, 5000);   // herbe dorée, toutes les 3 à 6 minutes
setInterval(peutEtrePapillons, 5000);    // papillons, toutes les 4 à 8 minutes
setInterval(bonusHoraireChat, 3600000);  // chat du jardin, une fois par heure
setInterval(runAutomations, 1000);       // achats et capacités automatiques
setInterval(tickMeteoEtVisites, 10000);  // météo, visites de Papi, inactivité, remarques
setInterval(tickJeu, 1000);              // une seconde de jeu
planifierPrechauffage();                 // fenêtres mises en page pendant un temps mort
