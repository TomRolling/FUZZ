// ================= LANGUE (FR/EN) =================
// Contenu traduit dans cette passe : Papi (nom + répliques) et les boutons du système de
// dialogue. Le reste du contenu du jeu (bâtiments, améliorations, succès...) reste en
// français pour l'instant — un chantier de traduction complet viendra dans un second temps.
const UI_STRINGS = {
  fr: {
    next: 'Suivant ▸', close: 'Fermer ✕', exitShop: 'Quitter le magasin ✕',
    each: 'chacun', synergyActive: 'Synergie active', bestRoi: 'Meilleur rapport qualité/prix',
    max: 'MAX', acquired: '✔ Acquis', active: '✔ Actif', owned: 'Possédé', free: 'Gratuit', use: 'Utiliser',
    activate: 'Activer', locked: '(nécessite d\'abord une autre amélioration)',
    settingsTitle: '⚙️ Paramètres', achievementsTitle: '🏆 Succès', questsTitle: '📓 Quêtes & Défis',
    shopTitle: '🛒 Magasin de Papi Feuillage',
    soundLabel: '🔊 Sons du jeu', enabled: 'Activés', disabled: 'Désactivés', enabledSingular: 'Activé', disabledSingular: 'Désactivé', volumeLabel: 'Volume',
    darkModeLabel: '🌙 Mode sombre forcé', vacationLabel: '🏖️ Mode vacances (plus de visites de Papi)',
    animLabel: '🎬 Réduire les animations', animAuto: 'Système', zoomLabel: "🔍 Taille de l'affichage",
    sauvAujourdhui: "Aujourd'hui", sauvHier: 'Hier', sauvAuto: 'Copie automatique (dernières minutes)',
    sauvAucune: 'Aucune sauvegarde de secours pour le moment. Le jeu en garde une par jour, sur trois jours.',
    sauvRestaurer: 'Restaurer', verdureWord: 'Verdure', prestigesWord: 'Prestiges',
    zoomNormal: 'Normale', zoomGrand: 'Grande', zoomTresGrand: 'Très grande',
    langLabel: '🌐 Langue / Language', creditsLabel: '🎬 Crédits',
    saveShareReset: 'Sauvegarde, partage et remise à zéro.',
    exportBtn: '💾 Exporter (fichier)', copyCodeBtn: '📋 Copier mon code (autre appareil)',
    importBtn: '📂 Importer (fichier)', importPasteBtn: '📋 Importer (coller un code)',
    restoreBackupBtn: '♻️ Restaurer une sauvegarde', undoImportBtn: '↩️ Revenir à la partie d\'avant l\'import', shareBtn: '📣 Partager', resetBtn: '🗑️ Reset total', quitGameBtn: '🚪 Quitter le jeu',
    updatesLabel: '🔄 Mises à jour', checkBtn: 'Vérifier', installBtn: 'Installer', updateNow: 'Mettre à jour maintenant', laterBtn: 'Plus tard', checkingLabel: 'Vérification...',
    clickHere: 'Clique ici !',
    bugReportIntro: 'Un bug, un blocage ? Raconte-le, ça aide à réparer.',
    bugReportBtn: '🐞 Signaler un bug', bugReportTitle: '🐞 Signaler un bug',
    bugReportExplain: 'Voici ce qui sera envoyé. Relis-le, tu pourras tout modifier avant de valider.',
    bugReportOpen: '🌐 Ouvrir le formulaire', bugReportCopy: '📋 Copier le rapport',
    dailyCycleIntro: "Le calendrier tourne sur <b>7 jours</b> : reviens chaque jour pour avancer dedans, et le <b>jour 7</b> offre le plus gros lot. Un jour manqué et la série repart au jour 1.",
    dailyTapToClaim: 'Clique pour prendre', dailyToday: "Aujourd'hui",
    dailyClaimed: 'Récupéré',
    dailySoon: 'À venir',
    boosts: 'Booste',
    totalHere: 'au total :',
    rareAcquisition: 'Acquisition rare !',
    newItem: 'Nouvel objet !',
    researchInfiniteIntro: "♾️ Recherches infinies",
    level: 'Niveau',
    specialCosmeticsIntro: "🎨 Cosmétiques de clic",
    prestigeBtnLabel: '🌍 Terraformer (Prestige)', ascensionBtnLabel: '🌟 Ascensionner',
    tutorialTitle: '🐸 Bienvenue sur le terrain de Leroy !',
    tutorialBody: `<p class="tutorialIntro">Papi Feuillage a « mystérieusement » hérité de ce terrain vague. Trop occupé pour l'entretenir, il en a confié les clés à son petit-fils au chômage, <b>Leroy</b>. C'est toi.</p><ul class="tutorialTips"><li><span>👆</span><div><b>Clique</b> au centre de l'écran pour désherber et gagner de la Verdure 🌿.</div></li><li><span>🏪</span><div>Ouvre le <b>Magasin</b> pour embaucher de l'aide qui produit toute seule, même quand le jeu est fermé.</div></li><li><span>🌍</span><div>Plus tard, utilise le <b>Prestige</b> pour repartir de zéro avec des bonus permanents.</div></li></ul>`,
    tutorialCloseBtn: 'Compris, on désherbe !',
    offlineTitle: 'Pendant ton absence', offlineCloseBtn: 'Continuer à jardiner 🌱',
    skipBtn: 'Passer ⏭️',
    creditsGeneric: "FUZZ<br>Développement : SeiuZ<br>Dessins, musiques et histoire : Anko<br>Merci d'avoir joué ! 🐸",
  },
  en: {
    next: 'Next ▸', close: 'Close ✕', exitShop: 'Exit shop ✕',
    each: 'each', synergyActive: 'Synergy active', bestRoi: 'Best value for money',
    max: 'MAX', acquired: '✔ Owned', active: '✔ Active', owned: 'Owned', free: 'Free', use: 'Use',
    activate: 'Activate', locked: '(requires another upgrade first)',
    settingsTitle: '⚙️ Settings', achievementsTitle: '🏆 Achievements', questsTitle: '📓 Quests & Challenges',
    shopTitle: '🛒 Gramps Weeds\' Shop',
    soundLabel: '🔊 Game sounds', enabled: 'On', disabled: 'Off', enabledSingular: 'On', disabledSingular: 'Off', volumeLabel: 'Volume',
    darkModeLabel: '🌙 Force dark mode', vacationLabel: '🏖️ Vacation mode (no more visits from Gramps)',
    animLabel: '🎬 Reduce animations', animAuto: 'System', zoomLabel: '🔍 Display size',
    sauvAujourdhui: 'Today', sauvHier: 'Yesterday', sauvAuto: 'Automatic copy (last few minutes)',
    sauvAucune: 'No backup save yet. The game keeps one per day, over three days.',
    sauvRestaurer: 'Restore', verdureWord: 'Greenery', prestigesWord: 'prestiges',
    zoomNormal: 'Normal', zoomGrand: 'Large', zoomTresGrand: 'Extra large',
    langLabel: '🌐 Langue / Language', creditsLabel: '🎬 Credits',
    saveShareReset: 'Save, share, and reset.',
    exportBtn: '💾 Export (file)', copyCodeBtn: '📋 Copy my code (other device)',
    importBtn: '📂 Import (file)', importPasteBtn: '📋 Import (paste a code)',
    restoreBackupBtn: '♻️ Restore a save', undoImportBtn: '↩️ Go back to the game before the import', shareBtn: '📣 Share', resetBtn: '🗑️ Full reset', quitGameBtn: '🚪 Quit game',
    updatesLabel: '🔄 Updates', checkBtn: 'Check', installBtn: 'Install', updateNow: 'Update now', laterBtn: 'Later', checkingLabel: 'Checking...',
    clickHere: 'Click here!',
    bugReportIntro: 'Hit a bug, or got stuck? Tell us about it, it helps fix things.',
    bugReportBtn: '🐞 Report a bug', bugReportTitle: '🐞 Report a bug',
    bugReportExplain: 'Here is what will be sent. Read it over, you can edit everything before submitting.',
    bugReportOpen: '🌐 Open the form', bugReportCopy: '📋 Copy the report',
    dailyCycleIntro: 'The calendar runs on a <b>7-day</b> cycle: come back every day to move through it, and <b>day 7</b> has the biggest prize. Miss a day and the streak restarts at day 1.',
    dailyTapToClaim: 'Tap to claim', dailyToday: 'Today',
    dailyClaimed: 'Claimed',
    dailySoon: 'Upcoming',
    boosts: 'Boosts',
    totalHere: 'total:',
    rareAcquisition: 'Rare acquisition!',
    newItem: 'New item!',
    researchInfiniteIntro: "♾️ Infinite research",
    level: 'Level',
    specialCosmeticsIntro: "🎨 Click cosmetics",
    prestigeBtnLabel: '🌍 Terraform (Prestige)', ascensionBtnLabel: '🌟 Ascend',
    tutorialTitle: "🐸 Welcome to Leroy's plot!",
    tutorialBody: `<p class="tutorialIntro">Gramps Weeds "mysteriously" inherited this vacant lot. Too busy to deal with it, he handed the keys to his unemployed grandson, <b>Leroy</b>. That's you.</p><ul class="tutorialTips"><li><span>👆</span><div><b>Click</b> the center of the screen to weed and earn Greenery 🌿.</div></li><li><span>🏪</span><div>Open the <b>Shop</b> to hire help that produces on its own, even offline.</div></li><li><span>🌍</span><div>Later, use <b>Prestige</b> to start fresh with permanent bonuses.</div></li></ul>`,
    tutorialCloseBtn: "Got it, let's weed!",
    offlineTitle: 'While you were away', offlineCloseBtn: 'Back to gardening 🌱',
    skipBtn: 'Skip ⏭️',
    creditsGeneric: "FUZZ<br>Development: SeiuZ<br>Art, music and story: Anko<br>Thanks for playing! 🐸",
  },
};
function tr(key) { return (UI_STRINGS[state.lang] || UI_STRINGS.fr)[key] || key; }

// --- Confort d'affichage ---
// Animations : tant que le joueur n'a rien choisi (null), on suit son systeme.
function animationsReduites() {
  if (state.reduireAnimations !== null && state.reduireAnimations !== undefined) return !!state.reduireAnimations;
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
const ZOOMS_UI = [1, 1.15, 1.3];
function appliquerConfort() {
  document.body.classList.toggle('moinsAnimations', animationsReduites());
  const zoom = ZOOMS_UI.includes(state.zoomUI) ? state.zoomUI : 1;
  if (window._zoomUI !== zoom) { window._zoomUI = zoom; fitGameViewport(); }
}
// Message bilingue ecrit sur place, pour les textes construits a la volee (toasts, confirmations)
// qui n'ont pas leur place dans UI_STRINGS parce qu'ils interpolent des valeurs.
function selonLangue(fr, en) { return state.lang === 'en' ? en : fr; }
// Lit un champ bilingue { fr: '...', en: '...' } sur n'importe quel objet de contenu du jeu
// (bâtiment, amélioration, succès...). Reste compatible avec une chaîne simple si jamais
// un champ n'a pas encore été traduit (retombe sur le français).
function L(obj, field) {
  const v = obj[field];
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return v[state.lang] || v.fr || '';
  return '';
}

