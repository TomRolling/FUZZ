// ================= WEATHER =================
const WEATHERS = {
  soleil: { label: { fr: '☀️ Ensoleillé', en: '☀️ Sunny' }, mult: 1.10, negative: false },
  pluie: { label: { fr: '🌧️ Pluie', en: '🌧️ Rain' }, mult: 1.25, negative: false },
  secheresse: { label: { fr: '🌵 Sécheresse', en: '🌵 Drought' }, mult: 0.8, negative: true },
  gel: { label: { fr: '❄️ Gel', en: '❄️ Frost' }, mult: 0.6, negative: true },
  arcEnCiel: { label: { fr: '🌈 Arc-en-ciel', en: '🌈 Rainbow' }, mult: 1.5, negative: false },
  brouillard: { label: { fr: '🌫️ Brouillard', en: '🌫️ Fog' }, mult: 0.85, negative: true },
};

// ================= ÉVÉNEMENTS SAISONNIERS =================
// Un habillage qui revient chaque année aux mêmes dates : décor qui tombe, herbe dorée
// relookée, une remarque de Papi et un petit bonus de production. Rien ne se débloque et rien
// ne se rate : qui joue en août n'est pas puni, il n'a simplement pas de confettis.
// `du` et `au` sont des [mois, jour], mois à partir de 1, bornes comprises.
const EVENEMENTS = [
  { id: 'nouvelAn', nom: { fr: 'Nouvel An', en: 'New Year' }, emoji: '🎆', du: [1, 1], au: [1, 3],
    bonus: 0.15, decor: '🎆', herbe: '🎆',
    papi: { fr: ["Bonne année. Ne prends pas de résolution, tu ne les tiens jamais.",
                 "Nouvelle année, même terrain. Au moins, lui, il ne change pas."],
            en: ["Happy New Year. Do not make resolutions, you never keep them.",
                 "New year, same patch of dirt. At least it does not change."] } },
  { id: 'valentin', nom: { fr: 'Saint-Valentin', en: "Valentine's Day" }, emoji: '💕', du: [2, 13], au: [2, 15],
    bonus: 0.10, decor: '💕', herbe: '💐',
    papi: { fr: ["C'est la Saint-Valentin. Tes grenouilles se sont trouvées, elles.",
                 "Ne fais pas cette tête. Le terrain t'aime bien, lui."],
            en: ["It is Valentine's Day. Your frogs found each other, at least.",
                 "Do not pull that face. The garden likes you."] } },
  { id: 'printemps', nom: { fr: 'Printemps', en: 'Spring' }, emoji: '🌸', du: [3, 20], au: [4, 5],
    bonus: 0.10, decor: '🌸', herbe: '🌸',
    papi: { fr: ["Le printemps. Tout pousse, même toi, on dirait.",
                 "Ça sent la sève et l'espoir. Profites-en, ça ne dure pas."],
            en: ["Spring. Everything grows, even you, apparently.",
                 "Smells like sap and hope. Enjoy it, it does not last."] } },
  { id: 'poisson', nom: { fr: "Poisson d'avril", en: "April Fools" }, emoji: '🐟', du: [4, 1], au: [4, 1],
    bonus: 0.10, decor: '🐟', herbe: '🐟',
    papi: { fr: ["Tu as un poisson accroché dans le dos depuis ce matin. Je n'ai rien dit.",
                 "Tes compagnons ont dit qu'ils démissionnaient. C'était une blague. Enfin, je crois."],
            en: ["There has been a paper fish on your back since this morning. I said nothing.",
                 "Your companions said they were quitting. It was a joke. I think."] } },
  { id: 'paques', nom: { fr: 'Pâques', en: 'Easter' }, emoji: '🥚', mobile: true,
    bonus: 0.10, decor: '🥚', herbe: '🥚',
    papi: { fr: ["J'ai caché des œufs dans le terrain. Ou pas. À toi de voir.",
                 "Ne mange pas tout, laisse-en pour les têtards."],
            en: ["I hid eggs in the garden. Or maybe I did not. Up to you.",
                 "Do not eat it all, leave some for the tadpoles."] } },
  { id: 'ete', nom: { fr: 'Été', en: 'Summer' }, emoji: '🏖️', du: [6, 21], au: [7, 7],
    bonus: 0.10, decor: '🌻', herbe: '🍉',
    papi: { fr: ["L'été. Arrose, et évite l'insolation, je n'ai pas envie de te ramasser.",
                 "Tout le monde est en vacances. Le terrain, lui, travaille."],
            en: ["Summer. Water the plants and avoid sunstroke, I am not scraping you off the ground.",
                 "Everyone is on holiday. The garden is still working."] } },
  { id: 'anniversaire', nom: { fr: 'Anniversaire du terrain', en: "The Garden's Birthday" }, emoji: '🎂', du: [9, 3], au: [9, 9],
    bonus: 0.20, decor: '🎉', herbe: '🎂',
    papi: { fr: ["Ce terrain a un an de plus. Toi aussi, mais on ne va pas en parler.",
                 "On fête le terrain, pas toi. Ne t'emballe pas."],
            en: ["This garden is a year older. So are you, but we will not dwell on it.",
                 "We are celebrating the garden, not you. Do not get excited."] } },
  { id: 'halloween', nom: { fr: 'Halloween', en: 'Halloween' }, emoji: '🎃', du: [10, 25], au: [10, 31],
    bonus: 0.10, decor: '🦇', herbe: '🎃',
    papi: { fr: ["Il paraît qu'un esprit hante le compost. C'est peut-être juste l'odeur.",
                 "Ne mange pas les citrouilles du voisin. Enfin, pas devant lui."],
            en: ["They say a spirit haunts the compost. It might just be the smell.",
                 "Do not eat the neighbour's pumpkins. Not in front of him, anyway."] } },
  { id: 'noel', nom: { fr: 'Noël', en: 'Christmas' }, emoji: '🎄', du: [12, 18], au: [12, 31],
    bonus: 0.15, decor: '❄️', herbe: '🎁',
    papi: { fr: ["Joyeux Noël. Ton cadeau, c'est le terrain. Tu l'as déjà, donc je n'ai rien acheté.",
                 "Il neige sur les grenouilles. Elles ont l'air de trouver ça normal."],
            en: ["Merry Christmas. Your present is the garden. You already have it, so I bought nothing.",
                 "It is snowing on the frogs. They seem fine with it."] } },
];

// Dimanche de Pâques (algorithme grégorien anonyme) : la seule date de la liste qui bouge.
function paquesDe(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const jourDeLAn = h + l - 7 * m + 114;
  return new Date(annee, Math.floor(jourDeLAn / 31) - 1, (jourDeLAn % 31) + 1);
}

// Fenêtre [début, fin] de l'événement pour une année donnée. Pâques est encadrée du vendredi
// au lundi, les autres tiennent dans leurs dates fixes.
function fenetreEvenement(ev, annee) {
  if (ev.mobile) {
    const p = paquesDe(annee);
    const debut = new Date(p); debut.setDate(p.getDate() - 2);
    const fin = new Date(p); fin.setDate(p.getDate() + 1); fin.setHours(23, 59, 59, 999);
    return [debut, fin];
  }
  return [new Date(annee, ev.du[0] - 1, ev.du[1]), new Date(annee, ev.au[0] - 1, ev.au[1], 23, 59, 59, 999)];
}

let _evenementForce = null; // mode test : force un événement hors de ses dates
// evenementActif() est appelé depuis totalProdMultiplier(), donc des centaines de fois par image
// pendant un rendu du magasin : la date, elle, ne change qu'une fois par jour. On garde donc la
// réponse une minute. Un appel avec une date explicite (tests, vérifications) n'est jamais mis en
// cache et recalcule tout.
let _evCache = { calculeA: 0, force: undefined, ev: null };
function evenementActif(maintenant) {
  if (maintenant) return calculerEvenement(maintenant);
  const now = Date.now();
  if (_evCache.force !== _evenementForce || now - _evCache.calculeA > 60000) {
    _evCache = { calculeA: now, force: _evenementForce, ev: calculerEvenement(new Date()) };
  }
  return _evCache.ev;
}
function calculerEvenement(maintenant) {
  if (_evenementForce) return EVENEMENTS.find(e => e.id === _evenementForce) || null;
  const annee = maintenant.getFullYear();
  const enCours = EVENEMENTS.filter(ev => {
    const [a, b] = fenetreEvenement(ev, annee);
    return maintenant >= a && maintenant <= b;
  });
  // Le plus court l'emporte : le 1er avril tombe en plein printemps, et c'est lui qu'on veut voir.
  enCours.sort((x, y) => {
    const duree = ev => { const [a, b] = fenetreEvenement(ev, annee); return b - a; };
    return duree(x) - duree(y);
  });
  return enCours[0] || null;
}
function evenementMult() { const ev = evenementActif(); return ev ? 1 + ev.bonus : 1; }

// ================= ACHIEVEMENTS =================
// `progress` retourne [valeur actuelle, valeur cible] pour afficher une barre sur les succès verrouillés.
const ACHIEVEMENTS = [
  // En tête parce que c'est le premier succès que la plupart des joueurs décrochent, et celui
  // qui leur ouvre l'onglet : le chercher en bas de liste n'avait aucun sens.
  { id: 'a_secret_clicker', name: { fr: 'Frénésie', en: 'Frenzy' }, desc: { fr: 'Cliquer 30 fois en moins de 5 secondes.', en: 'Click 30 times in under 5 seconds.' }, bonus: 0.03, check: s => (s.maxClicksIn5s || 0) >= 30, secret: true },
  { id: 'a_click100', name: { fr: 'Petit bras', en: 'Weak Arm' }, desc: { fr: '100 clics effectués.', en: '100 clicks performed.' }, bonus: 0.01, check: s => s.totalClicks >= 100, progress: s => [s.totalClicks, 100] },
  { id: 'a_click1000', name: { fr: 'Poignet solide', en: 'Solid Wrist' }, desc: { fr: '1000 clics effectués.', en: '1000 clicks performed.' }, bonus: 0.02, check: s => s.totalClicks >= 1000, progress: s => [s.totalClicks, 1000] },
  { id: 'a_earn1k', name: { fr: 'Premiers légumes', en: 'First Vegetables' }, desc: { fr: '1 000 Verdure gagnée au total.', en: '1,000 Greenery earned in total.' }, bonus: 0.01, check: s => s.totalEarned >= 1000, progress: s => [s.totalEarned, 1000] },
  { id: 'a_earn1m', name: { fr: 'Petit empire vert', en: 'Small Green Empire' }, desc: { fr: '1 000 000 Verdure gagnée au total.', en: '1,000,000 Greenery earned in total.' }, bonus: 0.03, check: s => s.totalEarned >= 1e6, progress: s => [s.totalEarned, 1e6] },
  { id: 'a_earn1b', name: { fr: 'Magnat du jardin', en: 'Garden Tycoon' }, desc: { fr: '1 milliard de Verdure gagnée au total.', en: '1 billion Greenery earned in total.' }, bonus: 0.05, check: s => s.totalEarned >= 1e9, progress: s => [s.totalEarned, 1e9] },
  { id: 'a_earn1t', name: { fr: 'Divinité végétale', en: 'Plant Deity' }, desc: { fr: '1 trillion de Verdure gagnée au total.', en: '1 trillion Greenery earned in total.' }, bonus: 0.08, check: s => s.totalEarned >= 1e12, progress: s => [s.totalEarned, 1e12] },
  { id: 'a_stagiaire10', name: { fr: 'Petite équipe', en: 'Small Team' }, desc: { fr: '10 Cousins têtards de Leroy.', en: '10 Tadpole Cousins of Leroy.' }, bonus: 0.01, check: s => (s.buildings.stagiaire||0) >= 10, progress: s => [s.buildings.stagiaire||0, 10] },
  { id: 'a_stagiaire50', name: { fr: 'Toute la famille', en: 'The Whole Family' }, desc: { fr: '50 Cousins têtards de Leroy.', en: '50 Tadpole Cousins of Leroy.' }, bonus: 0.02, check: s => (s.buildings.stagiaire||0) >= 50, progress: s => [s.buildings.stagiaire||0, 50] },
  { id: 'a_drone10', name: { fr: 'Escadrille de libellules', en: 'Dragonfly Squadron' }, desc: { fr: '10 Libellules éclaireuses.', en: '10 Scout Dragonflies.' }, bonus: 0.02, check: s => (s.buildings.drone||0) >= 10, progress: s => [s.buildings.drone||0, 10] },
  { id: 'a_mars1', name: { fr: 'Bienvenue sur Mars', en: 'Welcome to Mars' }, desc: { fr: 'Posséder un Crapaud martien.', en: 'Own a Martian Toad.' }, bonus: 0.03, check: s => (s.buildings.mars||0) >= 1, progress: s => [s.buildings.mars||0, 1] },
  { id: 'a_bigbang1', name: { fr: 'Avant toute chose', en: 'Before Anything Else' }, desc: { fr: 'Posséder un Tardigrade du Big Bang.', en: 'Own a Big Bang Tardigrade.' }, bonus: 0.05, check: s => (s.buildings.bigbang||0) >= 1, progress: s => [s.buildings.bigbang||0, 1] },
  { id: 'a_hors_temps1', name: { fr: 'Éternité', en: 'Eternity' }, desc: { fr: 'Recruter le Vieux Râleur hors du temps.', en: 'Recruit the Old Grumbler Beyond Time.' }, bonus: 0.08, check: s => (s.buildings.jardinHorsTemps||0) >= 1, progress: s => [s.buildings.jardinHorsTemps||0, 1] },
  { id: 'a_prestige1', name: { fr: 'Nouveau départ', en: 'New Beginning' }, desc: { fr: 'Premier Prestige effectué.', en: 'First Prestige completed.' }, bonus: 0.03, check: s => s.prestigeCount >= 1, progress: s => [s.prestigeCount, 1] },
  { id: 'a_prestige5', name: { fr: 'Habitué du redémarrage', en: 'Restart Regular' }, desc: { fr: '5 Prestiges effectués.', en: '5 Prestiges completed.' }, bonus: 0.05, check: s => s.prestigeCount >= 5, progress: s => [s.prestigeCount, 5] },
  { id: 'a_prestige20', name: { fr: 'Terraformeur professionnel', en: 'Professional Terraformer' }, desc: { fr: '20 Prestiges effectués.', en: '20 Prestiges completed.' }, bonus: 0.1, check: s => s.prestigeCount >= 20, progress: s => [s.prestigeCount, 20] },
  { id: 'a_seeds10', name: { fr: "Poussière d'étoiles", en: 'Stardust' }, desc: { fr: '10 Graines Cosmiques gagnées.', en: '10 Cosmic Seeds accumulated.' }, bonus: 0.03, check: s => s.totalSeedsEarned >= 10, progress: s => [s.totalSeedsEarned, 10] },
  { id: 'a_golden10', name: { fr: 'Chasseur de bonus', en: 'Bonus Hunter' }, desc: { fr: '10 mauvaises herbes dorées cliquées.', en: '10 golden weeds clicked.' }, bonus: 0.02, check: s => s.goldenClicked >= 10, progress: s => [s.goldenClicked, 10] },
  { id: 'a_research1', name: { fr: 'Apprenti chercheur', en: 'Research Apprentice' }, desc: { fr: 'Débloquer 1 recherche.', en: 'Unlock 1 research.' }, bonus: 0.01, check: s => Object.keys(s.researchUpgrades||{}).length >= 1, progress: s => [Object.keys(s.researchUpgrades||{}).length, 1] },
  { id: 'a_research5', name: { fr: 'Chercheur confirmé', en: 'Established Researcher' }, desc: { fr: 'Débloquer 5 recherches.', en: 'Unlock 5 research items.' }, bonus: 0.04, check: s => Object.keys(s.researchUpgrades||{}).length >= 5, progress: s => [Object.keys(s.researchUpgrades||{}).length, 5] },
  { id: 'a_unique1', name: { fr: 'Objet rare', en: 'Rare Item' }, desc: { fr: 'Posséder un objet du Spécial.', en: 'Own a Special item.' }, bonus: 0.02, check: s => Object.keys(s.uniqueBuildings||{}).length >= 1, progress: s => [Object.keys(s.uniqueBuildings||{}).length, 1] },
  { id: 'a_unique5', name: { fr: 'Collection complète', en: 'Full Collection' }, desc: { fr: 'Posséder 5 objets du Spécial.', en: 'Own 5 Special items.' }, bonus: 0.08, check: s => Object.keys(s.uniqueBuildings||{}).length >= 5, progress: s => [Object.keys(s.uniqueBuildings||{}).length, 5] },
  { id: 'a_unique8', name: { fr: 'Conservateur du jardin', en: 'Garden Curator' }, desc: { fr: 'Posséder tous les objets du Spécial.', en: 'Own every Special item.' }, bonus: 0.12, check: s => Object.keys(s.uniqueBuildings||{}).length >= UNIQUE_BUILDINGS.length, progress: s => [Object.keys(s.uniqueBuildings||{}).length, UNIQUE_BUILDINGS.length] },
  { id: 'a_firmeInternationale', name: { fr: 'Promoteur de la mare', en: 'Pond Developer' }, desc: { fr: 'Construire 5 bâtiments pour tes compagnons.', en: 'Build 5 buildings for your companions.' }, bonus: 0.05, check: s => Object.keys(s.companionBuildings || {}).length >= 5 },
  { id: 'a_quest10', name: { fr: 'Jardinier assidu', en: 'Diligent Gardener' }, desc: { fr: 'Compléter 10 quêtes journalières.', en: 'Complete 10 daily quests.' }, bonus: 0.03, check: s => (s.questsCompleted||0) >= 10, progress: s => [s.questsCompleted||0, 10] },
  { id: 'a_weatherAll', name: { fr: "Prévisionniste", en: 'Forecaster' }, desc: { fr: 'Vivre les 6 types de météo.', en: 'Experience all 6 weather types.' }, bonus: 0.02, check: s => (s.weatherSeen||[]).length >= 6, progress: s => [(s.weatherSeen||[]).length, 6] },
  { id: 'a_invasive10', name: { fr: "Tu gères tout seul", en: "You've Got This" }, desc: { fr: 'Convaincre Papi de repartir 10 fois.', en: 'Convince Gramps to leave 10 times.' }, bonus: 0.03, check: s => (s.invasiveDefeated||0) >= 10, progress: s => [s.invasiveDefeated||0, 10] },
  { id: 'a_clickUp10', name: { fr: 'Maître du clic', en: 'Click Master' }, desc: { fr: '10 améliorations de clic achetées.', en: '10 click upgrades purchased.' }, bonus: 0.04, check: s => Object.keys(s.clickUpgrades||{}).length >= 10, progress: s => [Object.keys(s.clickUpgrades||{}).length, 10] },
  { id: 'a_clickUpAll', name: { fr: 'Clic transcendant', en: 'Transcendent Click' }, desc: { fr: 'Toutes les améliorations de clic achetées.', en: 'All click upgrades purchased.' }, bonus: 0.1, check: s => Object.keys(s.clickUpgrades||{}).length >= CLICK_UPGRADES.length, progress: s => [Object.keys(s.clickUpgrades||{}).length, CLICK_UPGRADES.length] },
  { id: 'a_noBuy1', name: { fr: "Relever le gant", en: "Taking Up the Gauntlet" }, desc: { fr: "Réussir 1 défi.", en: "Complete 1 challenge." }, bonus: 0.02, check: s => challengesDoneCount(s) >= 1, progress: s => [challengesDoneCount(s), 1] },
  { id: 'a_noBuy5', name: { fr: "Habitué des défis", en: "Challenge Regular" }, desc: { fr: "Réussir 5 défis.", en: "Complete 5 challenges." }, bonus: 0.06, check: s => challengesDoneCount(s) >= 5, progress: s => [challengesDoneCount(s), 5] },
  { id: 'a_speed1', name: { fr: "Téméraire", en: "Daredevil" }, desc: { fr: "Réussir 2 défis.", en: "Complete 2 challenges." }, bonus: 0.02, check: s => challengesDoneCount(s) >= 2, progress: s => [challengesDoneCount(s), 2] },
  { id: 'a_speed5', name: { fr: "Maître des défis", en: "Challenge Master" }, desc: { fr: "Réussir les 8 défis.", en: "Complete all 8 challenges." }, bonus: 0.07, check: s => challengesDoneCount(s) >= 8, progress: s => [challengesDoneCount(s), 8] },
  // --- Fin de partie ---
  { id: 'a_tortueGalaxies1', name: { fr: 'Porteur de mondes', en: 'World Bearer' }, desc: { fr: 'Posséder une Tortue porteuse de galaxies.', en: 'Own a Galaxy-Bearing Turtle.' }, bonus: 0.05, check: s => (s.buildings.tortueGalaxies||0) >= 1, progress: s => [s.buildings.tortueGalaxies||0, 1] },
  { id: 'a_mareInfinie1', name: { fr: 'Au bout de la mare', en: 'The Far End of the Pond' }, desc: { fr: "Recruter l'Esprit de la Mare Infinie.", en: 'Recruit the Spirit of the Infinite Pond.' }, bonus: 0.1, check: s => (s.buildings.espritMareInfinie||0) >= 1, progress: s => [s.buildings.espritMareInfinie||0, 1] },
  { id: 'a_ascension10', name: { fr: 'Voyageur des étoiles', en: 'Star Traveler' }, desc: { fr: '10 Ascensions effectuées.', en: '10 Ascensions completed.' }, bonus: 0.08, check: s => (s.totalAscensions||0) >= 10, progress: s => [s.totalAscensions||0, 10] },
  { id: 'a_shards100', name: { fr: "Collectionneur d'étoiles", en: 'Star Collector' }, desc: { fr: '100 Éclats Stellaires gagnés.', en: '100 Stellar Shards earned.' }, bonus: 0.08, check: s => (s.totalShardsEarned||0) >= 100, progress: s => [s.totalShardsEarned||0, 100] },
  { id: 'a_prestige100', name: { fr: 'Terraformeur infatigable', en: 'Tireless Terraformer' }, desc: { fr: '100 Prestiges effectués.', en: '100 Prestiges completed.' }, bonus: 0.1, check: s => (s.prestigeCount||0) >= 100, progress: s => [s.prestigeCount||0, 100] },
  // --- Succès secrets : condition non affichée tant qu'ils ne sont pas débloqués (pas de barre de progression) ---
  { id: 'a_secret_owl', name: { fr: 'Oiseau de nuit', en: 'Night Owl' }, desc: { fr: 'Cliquer entre 2h et 4h du matin.', en: 'Click between 2am and 4am.' }, bonus: 0.03, check: s => { const h = new Date().getHours(); return h >= 2 && h < 4 && s.totalClicks > 0; }, secret: true },
  { id: 'a_secret_patience', name: { fr: 'Zen absolu', en: 'Absolute Zen' }, desc: { fr: "Rester 10 minutes sans cliquer une seule fois (hors défi « Mains dans les poches »).", en: "Stay on screen for 10 minutes without clicking once (outside the Hands in Pockets challenge)." }, bonus: 0.04, check: s => (s.maxIdleGapSec || 0) >= 600, secret: true },
];

const QUEST_POOL = ['click', 'earn', 'buy', 'golden'];
// Types de quête dont la récompense est en Connaissances (voir generateQuests).
const QUEST_KNOWLEDGE_TYPES = new Set(['earn', 'golden']);

// Étape de déblocage d'une entrée d'onglet : le texte affiché et la condition vont ensemble.
// `offerte` : accord au féminin du texte français (« Offerte à la 1re Ascension »).
const ORDINAL_EN = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
function atPrestige(n, offerte) {
  return { stage: { fr: `Offert${offerte ? 'e' : ''} au ${n === 1 ? '1er' : n + 'e'} Prestige`, en: `Unlocked at the ${ORDINAL_EN(n)} Prestige` },
           unlock: s => (s.prestigeCount || 0) >= n };
}
function atAscension(n, offerte) {
  return { stage: { fr: `Offert${offerte ? 'e' : ''} à la ${n === 1 ? '1re' : n + 'e'} Ascension`, en: `Unlocked at the ${ORDINAL_EN(n)} Ascension` },
           unlock: s => (s.totalAscensions || 0) >= n };
}

// Automatisations offertes aux étapes de la progression, dans l'ordre où le joueur les obtient.
const AUTOMATIONS = [
  { id: 'buyCompanions', icon: '🛒',
    name: { fr: "Achat automatique des compagnons", en: "Automatic companion buying" },
    desc: { fr: "Achète tout seul le compagnon au meilleur rapport qualité/prix. Si le Prestige automatique est activé, il garde de quoi l'atteindre.", en: "Buys the best-value companion on its own. If automatic Prestige is on, it keeps enough to reach it." },
    ...atPrestige(3) },
  { id: 'abilities', icon: '⚡',
    name: { fr: "Activation automatique des capacités", en: "Automatic abilities" },
    desc: { fr: "Déclenche les capacités du Spécial dès que leur recharge est terminée, sans écraser un bonus plus fort déjà en cours.", en: "Triggers Special abilities as soon as their cooldown ends, without overwriting a stronger bonus already running." },
    ...atAscension(1) },
  { id: 'prestige', icon: '🌍',
    name: { fr: "Prestige automatique", en: "Automatic Prestige" },
    desc: { fr: "Terraforme tout seul dès que le gain atteint le nombre de Graines que tu choisis.", en: "Terraforms on its own as soon as the gain reaches the number of Seeds you pick." },
    ...atAscension(3) },
];

// Défis (onglet Défi). Lancer un défi remet la partie en cours à zéro, sans toucher aux Graines ;
// sa règle s'applique jusqu'au prochain Prestige, qui le réussit s'il rapporte au moins `goal`
// Graines. La récompense est PERMANENTE : jamais perdue, même à l'Ascension.
const CHALLENGES = [
  { id: 'mains', icon: '🙌', goal: 1,
    name: { fr: "Mains dans les poches", en: "Hands in Pockets" },
    rule: { fr: "Aucun clic manuel sur le jardin.", en: "No manual clicks on the garden." },
    reward: { fr: "+10 % de production", en: "+10% production" },
    ...atPrestige(1) },
  { id: 'minimaliste', icon: '🌱', goal: 1,
    name: { fr: "Jardin minimaliste", en: "Minimalist Garden" },
    rule: { fr: "10 sortes de compagnons au maximum.", en: "At most 10 kinds of companions." },
    reward: { fr: "Paliers de compagnon : x1.27 au lieu de x1.25", en: "Companion milestones: x1.27 instead of x1.25" },
    ...atPrestige(2) },
  { id: 'tempete', icon: '🌩️', goal: 2,
    name: { fr: "Tempête sans fin", en: "Endless Storm" },
    rule: { fr: "Il gèle en permanence (météo du Gel).", en: "Permanent frost (Frost weather)." },
    reward: { fr: "Effets négatifs de la météo réduits de 50 %", en: "Negative weather effects reduced by 50%" },
    ...atPrestige(3) },
  { id: 'papi', icon: '🧓', goal: 2,
    name: { fr: "Papi s'installe", en: "Gramps Moves In" },
    rule: { fr: "Papi reste planté là : -30 % de production pendant tout le défi.", en: "Gramps won't leave: -30% production for the whole challenge." },
    reward: { fr: "Papi ne vient plus te déranger, et +5 % de production", en: "Gramps stops dropping by, and +5% production" },
    ...atPrestige(5) },
  { id: 'livres', icon: '🔬', goal: 4,
    name: { fr: "Livres fermés", en: "Closed Books" },
    rule: { fr: "La Recherche n'a aucun effet.", en: "Research has no effect." },
    reward: { fr: "+50 % de gain de Connaissances", en: "+50% Knowledge gain" },
    ...atAscension(1) },
  { id: 'fondations', icon: '🏗️', goal: 8,
    name: { fr: "Sans fondations", en: "No Foundations" },
    rule: { fr: "Bâtiments et Spécial n'ont aucun effet et ne s'achètent pas.", en: "Buildings and Special have no effect and can't be bought." },
    reward: { fr: "Bâtiments et Spécial 20 % moins chers", en: "Buildings and Special 20% cheaper" },
    ...atAscension(2) },
  { id: 'montre', icon: '⏱️', goal: 20, timeLimitSec: 8 * 3600,
    name: { fr: "Course contre la montre", en: "Race Against the Clock" },
    rule: { fr: "Terraformer moins de 8 h de jeu après avoir lancé le défi.", en: "Terraform within 8 h of play after starting." },
    reward: { fr: "Bonus de départ : +2 min de production", en: "Start bonus: +2 min of production" },
    ...atAscension(3) },
  { id: 'inflation', icon: '💸', goal: 60,
    name: { fr: "Inflation", en: "Inflation" },
    rule: { fr: "Les compagnons coûtent 10 fois plus cher.", en: "Companions cost 10 times more." },
    reward: { fr: "Compagnons 10 % moins chers", en: "Companions 10% cheaper" },
    ...atAscension(4) },
];
function challengeIs(id) { return state.challengeActive === id; }
function challengeDone(id) { return !!(state.challengesDone || {})[id]; }
function activeChallenge() { return CHALLENGES.find(x => x.id === state.challengeActive); }
function challengesDoneCount(st) { return Object.keys(st.challengesDone || {}).length; }
// Récompenses permanentes de production.
function challengeProdMult() { return (challengeDone('mains') ? 1.1 : 1) * (challengeDone('papi') ? 1.05 : 1); }
// Prix des compagnons : x10 pendant « Inflation », -10 % une fois le défi réussi.
function companionPriceMult() { return (challengeIs('inflation') ? 10 : 1) * (challengeDone('inflation') ? 0.9 : 1) * (1 - familierBonus('abeille')); }
// Prix des Bâtiments et du Spécial (remise de Prestige + récompense de « Sans fondations »).
function uniqueCostMult() { return combinedUpgradeValue('uniqueDiscount') * (challengeDone('fondations') ? 0.8 : 1); }
function specialDisabled() { return challengeIs('fondations'); }
// Un objet du Spécial possédé ET actif (tout le Spécial est coupé pendant « Sans fondations »).
function uniqueActive(id) { return hasUnique(id) && !specialDisabled(); }
function researchDisabled() { return challengeIs('livres'); }
function companionKindsOwned() { return Object.values(state.buildings).filter(n => n > 0).length; }
// `sortes` : nombre de sortes possédées, déjà compté quand on teste tous les compagnons à la suite.
function challengeAllowsBuilding(id, sortes) {
  if (!challengeIs('minimaliste') || (state.buildings[id] || 0) > 0) return true;
  return (sortes === undefined ? companionKindsOwned() : sortes) < 10;
}
// Secondes restantes d'un défi chronométré (négatif une fois le temps écoulé), null sinon.
function challengeTimeLeftSec() {
  const c = activeChallenge();
  if (!c || !c.timeLimitSec) return null;
  return c.timeLimitSec - ((state.totalPlayTimeSec || 0) - (state.challengeStartPlayTime || 0));
}

// Familiers : un seul actif à la fois (il se balade à l'écran et SEUL son bonus compte), chacun
// amélioré de 1 à FAMILIER_NIVEAU_MAX avec des Graines Cosmiques. Ils arrivent aux étapes de la
// progression, chacun avec un style de jeu : production, clic, Connaissances, capacités, prix.
const FAMILIERS = [
  { id: 'escargot', icon: '🐌', parNiveau: 0.05,
    name: { fr: "Escargot", en: "Snail" }, effet: { fr: "de production", en: "production" },
    ...atPrestige(1) },
  { id: 'grenouille', icon: '🐸', parNiveau: 0.10,
    name: { fr: "Grenouille", en: "Frog" }, effet: { fr: "sur tout ce que rapporte un clic", en: "on everything a click earns" },
    ...atPrestige(3, true) },
  { id: 'chouette', icon: '🦉', parNiveau: 0.10,
    name: { fr: "Chouette", en: "Owl" }, effet: { fr: "de gain de Connaissances", en: "Knowledge gain" },
    ...atAscension(1, true) },
  { id: 'herisson', icon: '🦔', parNiveau: 0.10,
    name: { fr: "Hérisson", en: "Hedgehog" }, effet: { fr: "de durée et de gain des capacités du Spécial", en: "Special ability duration and gains" },
    ...atAscension(2) },
  { id: 'abeille', icon: '🐝', parNiveau: 0.02, reduction: true,
    name: { fr: "Abeille", en: "Bee" }, effet: { fr: "sur le prix des compagnons", en: "on companion prices" },
    ...atAscension(3, true) },
];
const FAMILIER_NIVEAU_MAX = 10;
// Graines pour passer du niveau n au niveau n+1 (indice n).
const FAMILIER_COUTS = [0, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const FAMILIERS_BY_ID = Object.fromEntries(FAMILIERS.map(f => [f.id, f]));
function familierNiveau(id) {
  const f = FAMILIERS_BY_ID[id];
  if (!f || !f.unlock(state)) return 0;
  return Math.max(1, ((state.familiers || {}).niveaux || {})[id] || 1);
}
// Bonus du familier `id` : nul s'il n'est pas le familier actif.
function familierBonus(id) {
  if (!state.familiers || state.familiers.actif !== id) return 0;
  return FAMILIERS_BY_ID[id].parNiveau * familierNiveau(id);
}
function choisirFamilier(id) {
  const f = FAMILIERS_BY_ID[id];
  if (!f || !f.unlock(state)) return;
  const changement = state.familiers.actif !== id;
  state.familiers.actif = id;
  // En file : le choix se fait dans le magasin, donc la remarque attend qu'on en sorte.
  if (changement) queueOrShowPapi('familier', { position: 'top-right' });
  saveGame(); renderAll();
}
function ameliorerFamilier(id) {
  const niv = familierNiveau(id);
  if (!niv || niv >= FAMILIER_NIVEAU_MAX) return;
  const cout = FAMILIER_COUTS[niv];
  if (state.cosmicSeeds < cout) return;
  state.cosmicSeeds -= cout;
  state.familiers.niveaux[id] = niv + 1;
  finaliserAchat({ onglet: 'familiers' });
}

