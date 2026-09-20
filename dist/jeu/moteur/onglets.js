// ================= ONBOARDING / UNLOCKS =================
// Ordre de découverte du jeu. Règle générale : un onglet n'apparaît QUE lorsque le joueur a de
// quoi s'en servir, et Papi le présente à ce moment-là (voir announceNewTabsSequentially).
// Les seuils de Verdure portent sur la Verdure EN POCHE (state.verdure), pas sur le cumul :
// c'est ce que le joueur voit à l'écran, donc le seul chiffre qu'il puisse anticiper.
// Verdure EN POCHE qui fait apparaître un onglet. Pour Bâtiments et Spécial, c'est le prix de
// leur objet le moins cher : ils apparaissaient à 15 000 et 2,5 M pour un premier prix à 50 000
// et 10 M, et Papi désignait du doigt un onglet où rien n'était achetable. Calculé plutôt que
// recopié, pour suivre tout changement de prix. Le banc d'équilibrage lit aussi cette fonction,
// depuis sa boucle de simulation : le résultat est donc retenu (les tables sont figées).
const _seuilsOnglets = {};
function seuilOnglet(id) {
  if (_seuilsOnglets[id] === undefined) {
    if (id === 'batiments') _seuilsOnglets[id] = Math.min(...COMPANION_BUILDINGS.map(b => b.cost));
    else if (id === 'special') _seuilsOnglets[id] = Math.min(...UNIQUE_BUILDINGS.filter(u => !u.requires).map(u => u.cost));
    else if (id === 'prestige') _seuilsOnglets[id] = 5e8;
    else _seuilsOnglets[id] = Infinity;
  }
  return _seuilsOnglets[id];
}
// Prix de la recherche la moins chère parmi celles qui n'ont pas de prérequis.
function prixPremiereRecherche() {
  return Math.min(...RESEARCH.filter(r => !r.requires).map(r => r.cost));
}
const TAB_DEFS = [
  // --- Magasin : n'apparaît qu'à 200 clics, avec Production et Clic pour seul contenu ---
  { id: 'production', label: { fr: 'Production', en: 'Production' }, icon: '🐸', unlock: s => s.totalClicks >= CLICS_POUR_LE_MAGASIN, group: 'shop' },
  { id: 'clic', label: { fr: 'Clic', en: 'Click' }, icon: '👆', unlock: s => s.totalClicks >= CLICS_POUR_LE_MAGASIN, group: 'shop' },
  { id: 'batiments', label: { fr: 'Bâtiments', en: 'Buildings' }, icon: '🏗️', unlock: s => s.verdure >= seuilOnglet('batiments'), group: 'shop' },
  { id: 'special', label: { fr: 'Spécial', en: 'Special' }, icon: '✨', unlock: s => s.verdure >= seuilOnglet('special'), group: 'shop' },
  // Recherche demande d'avoir DÉJÀ vu Bâtiments, 30 min de jeu, et de quoi acheter sa première
  // ligne. `tabsDescribed` et non `tabsSeen` : il faut que Papi ait FINI de présenter Bâtiments,
  // pas seulement que l'onglet soit apparu. Sinon, un joueur qui laisse tourner le jeu débloque
  // les deux à la suite immédiate et enchaîne deux présentations sur le même écran. Les
  // Connaissances s'accumulent depuis cette même présentation (voir knowledgeAccumule), donc
  // l'onglet s'ouvre sur un achat possible sans qu'on ait à lui offrir quoi que ce soit.
  { id: 'recherche', label: { fr: 'Recherche', en: 'Research' }, icon: '🔬', group: 'shop',
    unlock: s => !!(s.tabsDescribed || {}).batiments && (s.totalPlayTimeSec || 0) >= 1800 && (s.knowledge || 0) >= prixPremiereRecherche() },
  { id: 'prestige', label: { fr: 'Prestige', en: 'Prestige' }, icon: '🌍', unlock: s => s.verdure >= seuilOnglet('prestige'), group: 'shop' },
  { id: 'familiers', label: { fr: 'Familiers', en: 'Pets' }, icon: '🐾', unlock: s => (s.prestigeCount || 0) >= 1, group: 'shop' },
  { id: 'ascension', label: { fr: 'Ascension', en: 'Ascension' }, icon: '🌟', unlock: s => (s.totalSeedsEarned || 0) >= ASCENSION_SEED_DIVISOR, group: 'shop' },
  { id: 'automatisation', label: { fr: 'Automatisation', en: 'Automation' }, icon: '🤖', unlock: s => AUTOMATIONS.some(a => a.unlock(s)), group: 'shop' },

  // --- Quêtes : le bouton apparaît après 20 min de jeu, avec le Bonus quotidien comme onglet ---
  { id: 'quetes', label: { fr: 'Quêtes', en: 'Quests' }, icon: '📋', unlock: s => (s.totalPlayTimeSec || 0) >= 1200, group: 'quests' },
  { id: 'dailyreward', label: { fr: 'Bonus du jour', en: 'Daily Bonus' }, icon: '🎁', unlock: s => (s.totalPlayTimeSec || 0) >= 1200, group: 'quests' },
  { id: 'defi', label: { fr: 'Défi', en: 'Challenge' }, icon: '🏅', unlock: s => s.prestigeCount >= 1, group: 'quests' },

  // --- Succès : présenté au tout premier succès décroché (« Petit bras », 100 clics) ---
  { id: 'succes', label: { fr: 'Succès', en: 'Achievements' }, icon: '🏆', unlock: s => Object.keys(s.achievements || {}).length >= 1, group: 'achievements' },

  // --- Paramètres : seul menu présent au lancement, et le seul que Papi ne présente PAS
  //     (voir SILENT_TABS) — le joueur n'a rien à y comprendre pour jouer. ---
  // `silent` : présents dès le lancement, donc aucun déblocage à annoncer — les commenter
  // interromprait le joueur avant même qu'il ait cliqué une fois.
  { id: 'options', label: { fr: 'Options', en: 'Options' }, icon: '⚙️', unlock: () => true, silent: true, group: 'settings' },
  { id: 'stats', label: { fr: 'Stats', en: 'Stats' }, icon: '📊', unlock: () => true, silent: true, group: 'settings' },
  // Galerie : quand il y a de quoi regarder, soit 5 objets distincts achetés, tous onglets confondus.
  { id: 'galerie', label: { fr: 'Galerie', en: 'Gallery' }, icon: '🖼️', unlock: s => distinctUpgradesOwned(s) >= 5, group: 'settings' },
];
// Nombre d'objets DISTINCTS possédés, toutes catégories d'achat confondues — sert de seuil à
// la Galerie, qui n'a d'intérêt qu'une fois qu'elle a quelque chose à montrer.
function distinctUpgradesOwned(st) {
  return Object.keys(st.buildings || {}).filter(k => st.buildings[k] > 0).length
    + Object.keys(st.clickUpgrades || {}).length
    + Object.keys(st.uniqueBuildings || {}).length
    + Object.keys(st.companionBuildings || {}).length;
}

