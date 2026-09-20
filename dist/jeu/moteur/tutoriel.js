// ================= TUTORIEL DE PREMIER LANCEMENT =================
// Scène d'ouverture (Papi Feuillage + Leroy face à face, façon JRPG) qui joue AVANT
// les conseils de gameplay, pour poser l'histoire avant la mécanique.
function startOpeningScene() {
  showScene([
    { character: 'papi', text: { fr: "Hm hm… Petit. J'ai un cadeau pour toi.", en: "Hm hm… Kid. I've got a gift for you." } },
    { character: 'leroy', text: { fr: "…un cadeau ?", en: "…a gift?" } },
    { character: 'papi', text: { fr: "Un terrain. Immense. Magnifique. Et à moi, en toute légalité.", en: "A plot of land. Huge. Gorgeous. Mine, fair and square." } },
    { character: 'papi', text: { fr: "...", en: "..." } },
    { character: 'papi', text: { fr: "Ne pose pas de questions.", en: "Don't ask questions." } },
    { character: 'leroy', text: { fr: "Je ne posais pas de que…", en: "I wasn't gonna ask…" } },
    { character: 'papi', text: { fr: "Bien. Alors tu vas t'en occuper.", en: "Good. So you're taking care of it." } },
    { character: 'leroy', text: { fr: "Quoi ? Pourquoi moi ?", en: "What? Why me?" } },
    { character: 'papi', text: { fr: "Parce que tu ne fais rien de tes journées, et ce terrain non plus. Vous êtes faits l'un pour l'autre.", en: "Because you do nothing all day, and neither does that land. Match made in heaven." } },
    { character: 'leroy', text: { fr: "Ce n'est pas très gentil…", en: "That's not very nice…" } },
    { character: 'papi', text: { fr: "Remarque, tu es un bon petit. Enfin. Tu es petit.", en: "Eh, you're a good kid. Well. You're a kid." } },
    { character: 'leroy', text: { fr: "…", en: "…" } },
    { character: 'papi', text: { fr: "Bref. Ton cousin Bramble, lui, en aurait déjà défriché la moitié avant le petit-déjeuner. Mais il a déjà son entreprise, alors… on fait avec ce qu'on a.", en: "Anyway. Your cousin Bramble would've cleared half of it before breakfast. But he's got his own business now, so… we make do." } },
    { character: 'leroy', text: { fr: "Je n'ai pas vraiment le choix, c'est ça ?", en: "I don't really have a choice, do I?" } },
    { character: 'papi', text: { fr: "Tu as très bien compris. C'est ta nouvelle maison, profites-en.", en: "Now you're getting it. It's called home ownership, enjoy." } },
    { character: 'papi', text: { fr: "Ah, et bonne nouvelle : tu en fais ce que tu veux.", en: "Silver lining, do whatever you want with it." } },
    { character: 'papi', text: { fr: "...", en: "..." } },
    { character: 'papi', text: { fr: "Je repasserai jeter un œil, au cas où une mauvaise herbe t'attaquerait.", en: "I'll swing by now and then. Just in case a weed jumps you." } },
  ], { left: 'papi', right: 'leroy', onComplete: () => {
    document.getElementById('tutorialBoxPortrait').innerHTML = getCharacterPortraitHtml('papi');
    document.getElementById('tutorialOverlay').style.display = 'flex';
  }});
}

// Délai de respiration après le tutoriel (voir ci-dessous), annulé par arreterPresentationsEnCours :
// sans ça, un reset dans la seconde qui suit réactivait les annonces pendant l'intro rejouée.
let _tutorialBreatherTimer = null;
document.getElementById('tutorialCloseBtn').addEventListener('click', () => {
  state.tutorialSeen = true;
  document.getElementById('tutorialOverlay').style.display = 'none';
  // Aucun verrou sur la zone de clic : le tout premier pas du joueur EST de cliquer (200 clics
  // font apparaitre le Magasin, que Papi vient alors presenter).
  saveGame();
  renderAll();
  // Petit délai avant de rendre la parole à Papi, pour laisser une respiration après l'intro.
  // On se contente de rouvrir les annonces : c'est la détection normale (renderTabsRow) qui
  // détermine quoi présenter. Construire la liste à la main ici annonçait des onglets dont la
  // condition n'était pas remplie — Papi présentait Production avant les 200 clics, alors que
  // la rangée refusait de l'afficher.
  _tutorialBreatherTimer = setTimeout(() => {
    _suppressTabAnnouncements = false;
    renderTabsRow();
  }, 1200);
});
let _shouldShowReturnLine = false;
document.getElementById('offlineCloseBtn').addEventListener('click', () => {
  fermerSurgissante('offlineOverlay', () => {
    if (_shouldShowReturnLine) { _shouldShowReturnLine = false; papiSaysFromCategory('returnAfterBreak', { position: 'top-right' }); }
  });
});

// La toute première ouverture d'une fenêtre coûtait cher (magasin ~50 ms, Paramètres ~26 ms),
// les suivantes 2 à 3 ms : ce n'est pas le dessin des lignes mais le premier calcul de mise en
// page de toute la fenêtre, fait au moment où elle s'affiche. On le fait donc faire pendant un
// temps mort : contenu dessiné, puis fenêtre mise en page une fois en restant invisible et
// incliquable, et aussitôt remise en place.
function prechaufferFenetre(overlayId) {
  const ov = document.getElementById(overlayId);
  if (!ov || isOverlayOpen(overlayId)) return;
  _fenetrePrechauffee = overlayId;
  try {
    renderAll();
    ov.classList.add('prechauffe');
    void ov.offsetHeight; // force la mise en page maintenant, pendant que personne ne regarde
  } finally {
    ov.classList.remove('prechauffe');
    _fenetrePrechauffee = null;
  }
}
// Une fenêtre par temps mort : les quatre d'un coup feraient justement le à-coup qu'on évite.
const _fenetresAPrechauffer = ['shopPageOverlay', 'settingsModalOverlay', 'questsModalOverlay', 'achievementsModalOverlay'];
function prechaufferLaSuivante() {
  const id = _fenetresAPrechauffer.shift();
  if (!id) return;
  prechaufferFenetre(id);
  if (_fenetresAPrechauffer.length) planifierPrechauffage();
}
function planifierPrechauffage() {
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(prechaufferLaSuivante, { timeout: 4000 });
}
planifierPrechauffage();

