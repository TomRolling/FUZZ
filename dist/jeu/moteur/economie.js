// ================= HELPERS =================
// Au niveau module : formatNum est appelée des centaines de fois par rendu, reconstruire cette
// table à chaque fois n'était que de l'allocation jetable.
const NUM_UNITS = ['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','UDc','DDc','TDc','QaDc','QiDc','SxDc','SpDc','OcDc','NoDc','Vg'];
// 2 décimales sans zéros de fin : un nombre rond doit se lire rond (« 6 », « 2.5 », pas « 6.00 »).
function trimZeros(x) { return x.toFixed(2).replace(/\.?0+$/, ''); }
// Au-delà, l'arrondi à deux décimales afficherait « 1000 » : il faut passer à l'unité suivante.
const MAX_PAR_UNITE = 999.995;
function formatNum(n) {
  if (n === Infinity) return '∞';
  const sign = n < 0 ? '-' : '';
  const original = Math.abs(n);
  if (original < 1000) return sign + Math.floor(original).toString();
  let n2 = original;
  let unitIndex = -1;
  // Seuil de changement d'unité : c'est l'ARRONDI affiché qui compte, pas la valeur exacte.
  // 999 999 donne 999,999 K, que les deux décimales de trimZeros transforment en « 1000K » : on
  // change donc d'unité dès que l'affichage atteindrait le millier. (Dérivé du toFixed(2).)
  while (n2 >= MAX_PAR_UNITE && unitIndex < NUM_UNITS.length - 1) { n2 /= 1000; unitIndex++; }
  // Au-delà de la dernière unité nommée (~10^66), notation scientifique précise plutôt qu'un nombre sans suffixe.
  if (n2 >= MAX_PAR_UNITE) return sign + original.toExponential(3).replace('e+', 'e');
  // 2 décimales de précision (ex: 1.60K), comme dans la plupart des idle games — assez pour
  // savoir si un achat est possible, sans perdre en lisibilité.
  // Zéros de fin retirés : un prix rond doit se lire rond (« 6M », « 2.5M », pas « 6.00M »).
  return sign + trimZeros(n2) + NUM_UNITS[unitIndex];
}

// Durée courte lisible (« 45 sec », « 3 min », « 1 h 20 min »), jamais « 45s » : dans la police
// pixel, le s se confond avec un 5.
function formatDureeCourte(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) { const m = Math.floor(sec / 60), r = sec % 60; return r ? `${m} min ${r} sec` : `${m} min`; }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
// Comme formatNum, mais pour des TAUX (par seconde) : sous 1 000, un débit non nul s'affiche en
// entier d'au moins 1, pour qu'un petit gain ne se lise jamais « 0/sec ».
function formatRate(n) {
  if (n === Infinity) return '∞';
  const sign = n < 0 ? '-' : '';
  const original = Math.abs(n);
  if (original === 0) return '0';
  // Sous 1 000, un débit s'affiche en nombre ENTIER, jamais en dessous de 1 s'il n'est pas nul
  // (un malus météo peut faire passer un débit réel sous 1 : on n'affiche pas « 0 » pour autant).
  // L'arrondi est fait AVANT la comparaison : sinon 999,6 s'affichait « 1000 » sans unité, alors
  // que 1 001 donnait « 1K » (même défaut que celui corrigé dans formatNum).
  const arrondi = Math.max(1, Math.round(original));
  if (arrondi < 1000) return sign + arrondi;
  return formatNum(n);
}

function hasPrestigeUpgrade(id) { return !!state.prestigeUpgrades[id]; }
function hasResearch(id) { return !!state.researchUpgrades[id]; }
function hasUnique(id) { return !!state.uniqueBuildings[id]; }
function hasCompanionBuilding(id) { return !!state.companionBuildings[id]; }
// Index figé compagnon -> bâtiments qui le ciblent, construit une fois au chargement : les
// tables sont des constantes, seul l'état "possédé" varie. totalCps() interroge ce
// multiplicateur pour CHAQUE compagnon et est lui-même appelé plusieurs fois par rendu —
// balayer les 16 bâtiments à chaque fois coûtait des milliers de comparaisons par seconde.
// Un index plutôt qu'un cache de résultat : il n'y a rien à invalider, donc aucun risque
// d'oublier un point de mutation (ni d'ordre de déclaration à respecter au chargement).
const COMPANION_BUILDINGS_BY_TARGET = {};
for (const b of COMPANION_BUILDINGS) {
  (COMPANION_BUILDINGS_BY_TARGET[b.targetId] = COMPANION_BUILDINGS_BY_TARGET[b.targetId] || []).push(b);
}
// Production réellement apportée par UN exemplaire d'un compagnon : synergies et bâtiment
// dédié compris. Écrite une seule fois — totalCps, la ligne du magasin et le badge
// « meilleur rapport qualité/prix » doivent parler du même chiffre.
function buildingCpsPerUnit(b) {
  return b.baseCps * (1 + synergyBonusFor(b.id)) * companionBuildingMultFor(b.id) * companionMilestoneMult(state.buildings[b.id] || 0);
}
// Multiplicateur de production propre à UN compagnon — 1 si aucun bâtiment ne le cible.
function companionBuildingMultFor(companionId) {
  if (specialDisabled()) return 1;
  let mult = 1;
  for (const b of COMPANION_BUILDINGS_BY_TARGET[companionId] || []) {
    if (hasCompanionBuilding(b.id)) mult *= b.mult;
  }
  return mult;
}
function hasClickUpgrade(id) { return !!state.clickUpgrades[id]; }
function hasAscensionUpgrade(id) { return !!state.ascensionUpgrades[id]; }

// Types dont les effets se COMBINENT en multipliant : ils partent donc de 1, jamais de 0.
// Les semer à 0 obligeait chaque branche et chaque appelant à rattraper le coup
// (`result === 0 ? … :`, `|| 1`). Au niveau module : combinedUpgradeValue est appelée des
// dizaines de fois par rendu, y reconstruire la liste à chaque fois était du gaspillage pur.
const MULTIPLICATIFS = new Set(['prodMult', 'clickMult', 'synergyMult', 'knowledgeMult', 'cheaper', 'uniqueDiscount']);
// Index figé type -> améliorations de ce type, avec le test de possession qui va avec.
// combinedUpgradeValue est appelée des dizaines de fois par rendu (une fois par compagnon dans
// buildingCost et synergyBonusFor) : elle reconstruisait à chaque appel un tableau de 75
// améliorations CLONÉES, pour n'en retenir ensuite qu'une poignée. L'index les regroupe une
// fois pour toutes ; il ne reste qu'à parcourir les 1 à 18 entrées du type demandé.
const UPGRADES_BY_TYPE = {};
for (const [table, isOwned] of [[PRESTIGE_UPGRADES, hasPrestigeUpgrade], [RESEARCH, hasResearch], [ASCENSION_UPGRADES, hasAscensionUpgrade]]) {
  for (const u of table) {
    (UPGRADES_BY_TYPE[u.type] = UPGRADES_BY_TYPE[u.type] || []).push({ u, isOwned, recherche: table === RESEARCH });
  }
}
function combinedUpgradeValue(type) {
  let result = MULTIPLICATIFS.has(type) ? 1 : 0;
  for (const { u, isOwned, recherche } of UPGRADES_BY_TYPE[type] || []) {
    if (isOwned(u.id) && !(recherche && researchDisabled())) {
      if (type === 'uniqueDiscount') result = Math.min(result, u.value);
      else if (MULTIPLICATIFS.has(type)) result *= u.value;
      else if (type === 'offline' || type === 'weatherShield') result = Math.max(result, u.value);
      else if (type === 'offlineBonus' || type === 'clickCpsPercent' || type === 'prestigeSeedMult' || type === 'ascensionSeedMult') result += u.value;
      else if (type === 'startBonus') result = Math.max(result, u.value);
      else if (type === 'questMult') result = Math.max(result, u.value);
    }
  }
  // Recherches infinies : effet composé selon le niveau acheté (même logique que le
  // multiplicateur de Graines Cosmiques) — c'est ce qui les rend utiles à l'infini.
  if (!researchDisabled()) for (const ri of RESEARCH_INFINITE) {
    if (ri.type !== type) continue;
    const level = state.researchInfiniteLevels[ri.id] || 0;
    if (level <= 0) continue;
    if (MULTIPLICATIFS.has(type)) result *= Math.pow(ri.value, level);
    else if (type === 'offlineBonus' || type === 'clickCpsPercent') result += ri.value * level;
  }
  return result;
}

function clickShopFlatMult() {
  let mult = 1;
  for (const c of CLICK_UPGRADES) if (c.type === 'flatMult' && hasClickUpgrade(c.id)) mult *= c.value;
  return mult;
}
function clickShopTotalMult() {
  let mult = 1;
  for (const c of CLICK_UPGRADES) if (c.type === 'totalMult' && hasClickUpgrade(c.id)) mult *= c.value;
  return mult;
}
function clickShopCpsPercent() {
  let sum = 0;
  for (const c of CLICK_UPGRADES) if (c.type === 'cpsPercent' && hasClickUpgrade(c.id)) sum += c.value;
  return sum;
}

function achievementMultiplier() {
  let bonus = 0;
  // Sur les succès OBTENUS : la condition d'un succès peut redevenir fausse (Clic remis à zéro par
  // un Prestige, par exemple), le bonus, lui, est acquis pour toujours.
  for (const a of ACHIEVEMENTS) if (state.achievements[a.id]) bonus += a.bonus;
  return 1 + bonus;
}
// Bonus des resets, calcules sur ce qui a ete GAGNE et non sur le solde : depenser des Graines
// ou des Eclats en ameliorations ne coute donc plus de production (avant, chaque achat faisait
// perdre x1.15 par Graine, et presque aucune amelioration n'etait rentable).
// Croissance volontairement douce (racine carree des Graines, lineaire en Eclats, eux-memes en
// racine cubique des Graines) : avec des bonus exponentiels, chaque Prestige financait le
// suivant presque aussitot et la partie s'emballait (verifie au banc d'equilibrage).
function seedMultiplier() { return 1 + 0.1 * Math.sqrt(state.seedsSinceAscension || 0); }
// Bonus de production des Éclats : +50 % par Éclat jusqu'à 20 Éclats, puis en racine carrée. En
// linéaire, la fin de partie s'emballait : plus d'Éclats, donc plus de Graines, donc encore plus d'Éclats.
function shardMultiplier() {
  const n = state.totalShardsEarned || 0, palier = 20;
  return n <= palier ? 1 + 0.5 * n : 1 + 0.5 * palier * Math.sqrt(n / palier);
}
// Les Éclats gagnés augmentent aussi les Graines de chaque Prestige : après une Ascension, un
// Prestige rapporte vraiment plus, ce qui garde son intérêt à la couche des Graines. En racine
// carrée (x1.25 avec 1 Éclat, x1.5 avec 4, x2 avec 16) : en linéaire, la boucle Éclats → Graines
// → Éclats emballait la fin de partie (banc : 8e Ascension à 9.1 j au lieu de 16 j).
function shardSeedMultiplier() { return 1 + 0.25 * Math.sqrt(state.totalShardsEarned || 0); }

function uniqueMultipliers() {
  let prod = 1, click = 1, offlineBonus = 0, knowledge = 1, invasiveRate = 1;
  // Un seul passif câblé ici désormais : les autres onglets couvrent production, clic,
  // connaissances et hors-ligne (voir le commentaire au-dessus de UNIQUE_BUILDINGS).
  if (uniqueActive('sentinelleTemporelle')) invasiveRate *= 0.5;
  return { prod, click, offlineBonus, knowledge, invasiveRate };
}

// La météo qui compte : le Gel pendant « Tempête sans fin », sinon la météo du moment.
function currentWeather() { return challengeIs('tempete') ? WEATHERS.gel : (WEATHERS[state.weather] || WEATHERS.soleil); }
function weatherMultiplier() {
  const w = currentWeather();
  if (!w.negative) return w.mult;
  const shield = combinedUpgradeValue('weatherShield') || 0;
  const greenhouseRelief = (state.buildings.serre || 0) > 0 ? 0.5 : 0;
  const totalRelief = Math.min(0.9, shield + greenhouseRelief * 0.5 + (challengeDone('tempete') ? 0.5 : 0));
  return 1 - (1 - w.mult) * (1 - totalRelief);
}
function invasivePenalty() { return challengeIs('papi') || (state.invasiveWeed && state.invasiveWeed.active) ? 0.7 : 1; }
// Tous les bonus temporaires en cours, quelle que soit leur origine (herbe dorée ramassée,
// nuée de papillons, capacité active de l'onglet Spécial). Une seule liste : l'affichage n'a
// pas à connaître chaque source, et une nouvelle source apparaîtra toute seule dans le bandeau.
// Registre des bonus temporaires en cours : { cle: { mult, until, totalMs } }. Hors de `state`
// à dessein — un bonus de 25 secondes n'a pas à survivre à un rechargement.
const _boosts = {};
// Habillage de chaque bonus dans le bandeau. Séparé du registre : c'est de la présentation, et
// l'ajouter ici est la SEULE chose à faire pour qu'une nouvelle source s'y affiche.
const BOOST_CHIPS = {
  golden:  { cls: 'gold',  icon: '✨', fr: 'production', en: 'production' },
  ability: { cls: 'gold',  icon: '⚡', fr: 'production', en: 'production' },
  click:   { cls: 'click', icon: '👆', fr: 'par clic',   en: 'per click' },
  papillon:{ cls: 'papillon', icon: '🦋', fr: 'production', en: 'production' },
};
// SEUL point d'écriture : la durée et le multiplicateur d'un bonus ne sont donc énoncés qu'une
// fois, là où il est accordé — l'effet et la jauge lisent tous deux ce registre.
function startTimedBoost(key, mult, durationMs) {
  _boosts[key] = { mult, until: Date.now() + durationMs, totalMs: durationMs };
}
// SEUL point de lecture pour les effets. 1 = pas de bonus actif.
function boostMult(key) {
  const b = _boosts[key];
  return (b && Date.now() < b.until) ? b.mult : 1;
}
function activeTimedBoosts() {
  const now = Date.now();
  return Object.keys(BOOST_CHIPS)
    .filter(k => _boosts[k] && now < _boosts[k].until)
    .map(k => Object.assign({ key: k, label: BOOST_CHIPS[k][state.lang] || BOOST_CHIPS[k].fr }, BOOST_CHIPS[k], _boosts[k]));
}
function renderActiveBoosts() {
  const row = document.getElementById('boostRow');
  if (!row) return;
  const boosts = activeTimedBoosts();
  // Le HTML de la pastille ne contient QUE ses parties stables : renderItemRows ne le réécrit
  // donc jamais tant que le bonus dure. Le décompte et la jauge sont ensuite mis à jour sur les
  // nœuds EXISTANTS — sinon la barre était recréée à chaque rendu et sa transition, remplacée
  // avant d'avoir commencé, ne pouvait jamais s'animer.
  renderItemRows(row, boosts.map(b => ({
    id: b.key,
    className: 'boostChip ' + b.cls,
    html: `${b.icon} x${b.mult} ${b.label}<span class="boostTime"></span><div class="boostBar"></div>`,
  })));
  const now = Date.now();
  // Les pastilles sont dans le même ordre que `boosts` (renderItemRows respecte l'ordre fourni)
  // et leur HTML est fixe : le décompte est le dernier-avant-dernier enfant, la jauge le dernier.
  // Les retrouver par index évite deux querySelector par pastille à chaque rendu.
  boosts.forEach((b, i) => {
    const chip = row.children[i];
    if (!chip) return;
    const restantMs = Math.max(0, b.until - now);
    const secondes = formatDureeCourte(restantMs / 1000);
    const largeur = (b.totalMs > 0 ? Math.max(0, Math.min(100, (restantMs / b.totalMs) * 100)) : 100).toFixed(1) + '%';
    const t = chip.lastElementChild.previousElementSibling;
    if (t && t.textContent !== secondes) t.textContent = secondes;
    const bar = chip.lastElementChild;
    if (bar && bar.style.width !== largeur) bar.style.width = largeur;
  });
}
function totalProdMultiplier() {
  return seedMultiplier()
    * shardMultiplier()
    * combinedUpgradeValue('prodMult')
    * achievementMultiplier()
    * uniqueMultipliers().prod
    * weatherMultiplier()
    * evenementMult()
    * invasivePenalty()
    * boostMult('ability')
    * (1 + familierBonus('escargot'))
    * challengeProdMult();
}
// Multiplicateur du clic ENTIER (base + part de production) : Prestige, Ascension, Spécial et
// les améliorations « sur tout ce que rapporte un clic » de l'onglet Clic.
function totalClickFlatMultiplier() {
  return combinedUpgradeValue('clickMult') * uniqueMultipliers().click * clickShopTotalMult() * (1 + familierBonus('grenouille'));
}
function totalClickCpsPercent() {
  return combinedUpgradeValue('clickCpsPercent') + clickShopCpsPercent();
}

function synergyBonusFor(buildingId) {
  let bonus = 0;
  const synergyMult = combinedUpgradeValue('synergyMult') || 1;
  for (const s of SYNERGIES) {
    if (s.target === buildingId) {
      const ownedSource = state.buildings[s.source] || 0;
      bonus += ownedSource * s.percent * synergyMult;
    }
  }
  return bonus;
}

function totalCps() {
  let cps = 0;
  for (const b of BUILDINGS) {
    const owned = state.buildings[b.id] || 0;
    if (owned <= 0) continue;
    cps += owned * buildingCpsPerUnit(b);
  }
  return cps * totalProdMultiplier();
}

function clickGain() {
  // La base du clic ne profite PAS des multiplicateurs de production : sinon, après quelques
  // Prestiges, les clics suffisaient à atteindre le Prestige suivant sans compagnons et la boucle
  // s'emballait. Seule la part « % de la production » suit la production.
  const base = clickShopFlatMult();
  const cpsPart = totalCps() * totalClickCpsPercent();
  return (base + cpsPart) * totalClickFlatMultiplier() * comboMultiplier() * boostMult('click');
}

// Les Connaissances n'existent pour le joueur qu'a partir du moment ou Papi lui presente
// l'onglet Recherche : avant ca, ni compteur affiche, ni accumulation silencieuse. Sinon le
// joueur arrivait dans Recherche avec un magot tombe du ciel, sans comprendre d'ou il venait.
// Deux questions différentes, longtemps confondues en une seule : les Connaissances
// S'ACCUMULENT dès que Papi a fini de présenter Bâtiments (le moment où le concept entre dans la
// partie, et la condition qui ouvre Recherche), mais elles ne s'AFFICHENT qu'avec l'onglet
// Recherche. Tout bloquer sur l'affichage faisait arriver l'onglet à zéro Connaissance, donc
// vide : il fallait alors un cadeau d'ouverture, à répéter partout où un onglet se révèle.
// Le second terme couvre les parties d'avant `tabsDescribed` : si l'onglet est déjà là, les
// Connaissances tombent, évidemment.
function knowledgeAccumule() { return !!(state.tabsDescribed || {}).batiments || !!state.tabsSeen.recherche; }
function knowledgeUnlocked() { return !!state.tabsSeen.recherche; }
const KNOWLEDGE_PER_MINUTE = 1;
// Récompense en Connaissances équivalente à `minutes` de gain au rythme actuel du joueur (avec
// un plancher) : une récompense fixe devenait insignifiante une fois le gain multiplié.
function knowledgeMinutes(minutes, plancher) {
  return Math.max(plancher, Math.round(knowledgeRate() * 60 * minutes));
}
// Seul point d'entrée pour créditer des Connaissances : tant qu'elles ne sont pas présentées au
// joueur, elles ne s'accumulent pas.
function grantKnowledge(n) { if (knowledgeAccumule()) state.knowledge += n; }
function knowledgeRate() {
  if (!knowledgeAccumule()) return 0;
  // 1 Connaissance par MINUTE de base, sans aucun lien avec la production : seules les
  // améliorations de gain de Connaissances l'accélèrent. Les coûts de la Recherche sont calés
  // sur ce rythme pour que l'arbre s'étale sur toute la partie (voir RESEARCH).
  return KNOWLEDGE_PER_MINUTE / 60 * (combinedUpgradeValue('knowledgeMult') || 1) * uniqueMultipliers().knowledge * (challengeDone('livres') ? 1.5 : 1) * (1 + familierBonus('chouette'));
}

// Facteur de prix commun à tous les compagnons : réductions de Recherche, défi Inflation, abeille.
function companionCostMult() { return combinedUpgradeValue('cheaper') * companionPriceMult(); }
// `prixMult` : facteur déjà calculé, pour les boucles sur tous les compagnons.
function buildingCost(b, n, prixMult = companionCostMult()) {
  const owned = state.buildings[b.id] || 0;
  return b.baseCost * Math.pow(GROWTH, owned) * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1) * prixMult;
}
function maxAffordable(b) {
  const owned = state.buildings[b.id] || 0;
  const effectiveBase = b.baseCost * companionCostMult();
  const avail = state.verdure;
  const val = (avail * (GROWTH - 1)) / (effectiveBase * Math.pow(GROWTH, owned)) + 1;
  if (val <= 0) return 0;
  let n = Math.floor(Math.log(val) / Math.log(GROWTH));
  return Math.max(0, Math.min(n, 10000));
}
// Appelée à chaque achat réussi, quel que soit l'onglet du magasin. Papi réagit :
//  - toujours à la toute première dépense, et au premier achat fait dans chaque onglet ;
//  - sinon de temps en temps seulement. Commenter CHAQUE achat serait intenable : avec les
//    modes x10 / x100 / MAX, une séance d'achats en enchaîne plusieurs par seconde, et une
//    blague répétée quarante fois cesse d'être une blague. Mettre CHANCE_MOT à 1 et
//    PAUSE_MOT_MS à 0 suffit à le faire parler à chaque fois.
//  - jamais sur un achat fait par l'automatisation : ce n'est pas le joueur qui agit.
const CHANCE_MOT = 0.25;
const PAUSE_MOT_MS = 25000;
let _dernierMotAchat = 0;
// Déclarée plutôt que recomposée à partir de l'id d'onglet : une faute de frappe se voit ici,
// alors qu'une concaténation ratée ne produisait qu'un Papi silencieux, sans erreur.
const CATEGORIE_ACHAT = {
  production: 'achatProduction', clic: 'achatClic', batiments: 'achatBatiments',
  special: 'achatSpecial', recherche: 'achatRecherche', prestige: 'achatPrestige',
  familiers: 'achatFamiliers', ascension: 'achatAscension', automatisation: 'achatAutomatisation',
};
// Fin commune à TOUS les achats du magasin, quel que soit l'onglet et la monnaie : le son, les
// succès, la réaction de Papi, la sauvegarde et le rendu. Une nouvelle façon d'acheter n'a plus
// qu'à appeler ceci pour être complète — avant, chaque fonction recopiait ces cinq lignes et
// deux d'entre elles avaient déjà oublié de prévenir Papi.
// `coutVerdure` : le prix EN VERDURE, ou 0 quand l'achat se paie dans une autre monnaie.
function finaliserAchat({ coutVerdure = 0, onglet, auto } = {}) {
  if (!auto) playBuySound();
  checkAchievements();
  notifyPurchase(coutVerdure, onglet, auto);
  saveGame();
  renderAll();
}

// `coutVerdure` : le prix EN VERDURE, ou 0 quand l'achat se paie dans une autre monnaie
// (Connaissances, Graines, Éclats) — il ne sert qu'à repérer une dépense énorme.
function notifyPurchase(coutVerdure, onglet, auto) {
  // En premier : un achat de l'automatisation n'est pas une action du joueur. Le compter comme
  // telle repoussait `lastActionTime` jusqu'à vingt fois par seconde, et Papi ne pouvait plus
  // jamais remarquer que le joueur ne faisait rien.
  if (auto) return;
  state.lastActionTime = Date.now();
  state.inactivityAnnounced = false;
  if (!state.hasEverPurchased) {
    state.hasEverPurchased = true;
    _dernierMotAchat = Date.now();
    showShopComment('firstPurchase');
    return;
  }
  const categorie = CATEGORIE_ACHAT[onglet];
  // Premier achat dans cet onglet : c'est une découverte, Papi la commente toujours.
  if (categorie && !state.ongletsAchetes[onglet]) {
    state.ongletsAchetes[onglet] = true;
    _dernierMotAchat = Date.now();
    showShopComment(categorie);
    return;
  }
  if (Date.now() - _dernierMotAchat < PAUSE_MOT_MS) return;
  // Dépense énorme : relative à ce que le joueur possède, et non un montant fixe qui finit
  // par être atteint par n'importe quel achat en fin de partie.
  const grosseDepense = coutVerdure >= Math.max(1e6, (state.verdure + coutVerdure) * 0.6);
  if (!grosseDepense && Math.random() > CHANCE_MOT) return;
  _dernierMotAchat = Date.now();
  if (grosseDepense) showShopComment('bigPurchase');
  else if (categorie) showShopComment(categorie);
}

// `auto` : achat fait par l'automatisation — voir runAutomations.
function buyBuilding(id, forceN, auto) {
  const b = BUILDINGS.find(x => x.id === id);
  if (!b) return;
  let n = forceN !== undefined ? forceN : (state.buyMode === 'max' ? maxAffordable(b) : state.buyMode);
  if (n <= 0) return;
  if (!challengeAllowsBuilding(id)) {
    if (!auto) showToast(state.lang === 'en' ? '🌱 Minimalist Garden: 10 kinds of companions at most' : '🌱 Jardin minimaliste : 10 sortes de compagnons au maximum');
    return;
  }
  const cost = buildingCost(b, n);
  if (state.verdure >= cost) {
    const wasOwned = (state.buildings[id] || 0) > 0;
    const bonusAvant = companionMilestoneMult(state.buildings[id] || 0);
    state.verdure -= cost;
    state.buildings[id] = (state.buildings[id] || 0) + n;
    const gainPalier = companionMilestoneMult(state.buildings[id]) / bonusAvant;
    if (gainPalier > 1 && !auto) {
      const atteint = COMPANION_MILESTONES[companionMilestoneCount(state.buildings[id]) - 1];
      const mult = trimZeros(gainPalier);
      showToast(state.lang === 'en'
        ? `🎯 Milestone: ${atteint} ${L(b,'name')}, production x${mult}`
        : `🎯 Palier atteint : ${atteint} ${L(b,'name')}, production x${mult}`);
    }
    state.dailyProgress.buy += n;
    if (auto) {
      if (!wasOwned) {
        markItemDiscovered(id);
        showToast(state.lang === 'en' ? `🤖 New companion bought: ${L(b,'name')}` : `🤖 Nouveau compagnon acheté : ${L(b,'name')}`);
      }
      return true; // succès, sauvegarde et rendu vérifiés une seule fois par vague, par l'appelant
    }
    finaliserAchat({ coutVerdure: cost, onglet: 'production', auto });
    if (!wasOwned) maybeShowItemAcquiredPopup(id, 'building');
  }
}

function buyClickUpgrade(id) {
  const c = CLICK_UPGRADES.find(x => x.id === id);
  if (!c || hasClickUpgrade(id)) return;
  if (state.verdure < c.cost) return;
  state.verdure -= c.cost;
  state.clickUpgrades[id] = true;
  finaliserAchat({ coutVerdure: c.cost, onglet: 'clic' });
  maybeShowItemAcquiredPopup(id, 'clickUpgrade');
}

function activeCooldownRemaining(id) {
  const until = state.activeCooldowns[id] || 0;
  return Math.max(0, until - Date.now());
}
function activateUniqueAbility(id) {
  const u = UNIQUE_BUILDINGS.find(x => x.id === id);
  if (!u || !u.active || !uniqueActive(id)) return;
  if (activeCooldownRemaining(id) > 0) return;
  const a = u.active;
  const renfort = 1 + familierBonus('herisson'); // hérisson : capacités plus longues et plus généreuses
  if (a.type === 'boostMult') {
    startTimedBoost('ability', a.value, a.durationMs * renfort);
    showToast(selonLangue(`🔔 ${L(u,'name')} activé ! x${a.value} production pendant ${formatDureeCourte(a.durationMs * renfort / 1000)}`,
                          `🔔 ${L(u,'name')} activated! x${a.value} production for ${formatDureeCourte(a.durationMs * renfort / 1000)}`));
  } else if (a.type === 'clickBoost') {
    startTimedBoost('click', a.value, a.durationMs * renfort);
    showToast(selonLangue(`👆 ${L(u,'name')} activé ! x${a.value} par clic pendant ${formatDureeCourte(a.durationMs * renfort / 1000)}`,
                          `👆 ${L(u,'name')} activated! x${a.value} per click for ${formatDureeCourte(a.durationMs * renfort / 1000)}`));
  } else if (a.type === 'instantGain') {
    const gain = totalCps() * a.minutesEquivalent * 60 * renfort;
    state.verdure += gain; state.totalEarned += gain;
    bump('verdureCount');
    showToast(selonLangue(`🔥 ${L(u,'name')} activé ! +${formatNum(gain)} Verdure instantanée`,
                          `🔥 ${L(u,'name')} activated! +${formatNum(gain)} Greenery instantly`));
  }
  state.activeCooldowns[id] = Date.now() + a.cooldownMs;
  // Une capacité sur six : de quoi souligner le geste sans commenter chaque déclenchement.
  if (Math.random() < 0.16) papiSaysFromCategory('capacite', { position: 'top-right' });
  playGoldenSound();
  saveGame(); renderAll();
}

function buyUnique(id) {
  const u = UNIQUE_BUILDINGS.find(x => x.id === id);
  if (!u || hasUnique(id)) return;
  if (specialDisabled()) { showToast(state.lang === 'en' ? '🏗️ No Foundations: Special is off' : '🏗️ Sans fondations : le Spécial est coupé'); return; }
  const discount = uniqueCostMult();
  const cost = u.cost * discount;
  if (state.verdure >= cost) {
    state.verdure -= cost;
    state.uniqueBuildings[id] = true;
    finaliserAchat({ coutVerdure: cost, onglet: 'special' });
    showToast(state.lang === 'en' ? `✨ Special item acquired: ${L(u,'name')}` : `✨ Objet spécial acquis : ${L(u,'name')}`);
    maybeShowItemAcquiredPopup(id, 'unique', 'rare');
  }
}

function buyCompanionBuilding(id) {
  const b = COMPANION_BUILDINGS.find(x => x.id === id);
  if (!b || hasCompanionBuilding(id)) return;
  if (specialDisabled()) { showToast(state.lang === 'en' ? '🏗️ No Foundations: Buildings are off' : '🏗️ Sans fondations : les Bâtiments sont coupés'); return; }
  const discount = uniqueCostMult();
  const cost = b.cost * discount;
  if (state.verdure < cost) return;
  state.verdure -= cost;
  state.companionBuildings[id] = true;
  finaliserAchat({ coutVerdure: cost, onglet: 'batiments' });
  const target = BUILDINGS.find(x => x.id === b.targetId);
  showToast(state.lang === 'en'
    ? `🏗️ Building acquired: ${L(b,'name')} (${target ? L(target,'name') : ''} boosted)`
    : `🏗️ Bâtiment acquis : ${L(b,'name')} (${target ? L(target,'name') : ''} amélioré)`);
  maybeShowItemAcquiredPopup(id, 'companionBuilding', 'rare');
}

function buyResearch(id) {
  const r = RESEARCH.find(x => x.id === id);
  if (!r || hasResearch(id)) return;
  if (r.requires && !hasResearch(r.requires)) return;
  if (state.knowledge < r.cost) return;
  state.knowledge -= r.cost;
  state.researchUpgrades[id] = true;
  finaliserAchat({ onglet: 'recherche' });
}

function researchInfiniteCost(item) {
  const level = state.researchInfiniteLevels[item.id] || 0;
  return Math.ceil(item.baseCost * Math.pow(item.growth, level));
}
function buyResearchInfinite(id) {
  const item = RESEARCH_INFINITE.find(x => x.id === id);
  if (!item) return;
  const cost = researchInfiniteCost(item);
  if (state.knowledge < cost) return;
  state.knowledge -= cost;
  state.researchInfiniteLevels[id] = (state.researchInfiniteLevels[id] || 0) + 1;
  finaliserAchat({ onglet: 'recherche' });
}

// Diviseur du calcul de Graines Cosmiques : plus il est grand, plus le Prestige est lointain.
const PRESTIGE_DIVISOR = 4e+10;
function prestigeSeedBoost() { return 1 + (combinedUpgradeValue('prestigeSeedMult') || 0); }
// Verdure en poche qu'il faut pour gagner `n` Graines (inverse de prestigeGainAmount).
function verdureForSeeds(n) { return Math.pow(n / shardSeedMultiplier(), 3) * PRESTIGE_DIVISOR / prestigeSeedBoost(); }
function prestigeGainAmount() {
  const boost = prestigeSeedBoost();
  // Sur la Verdure EN POCHE, pas sur le cumul de la partie : c'est le chiffre affiche a
  // l'ecran, donc le seul que le joueur puisse viser — et c'est aussi ce qui conditionne
  // l'apparition de l'onglet (voir TAB_DEFS).
  // Le bonus des Éclats multiplie le nombre de Graines (pas la Verdure comptée) ; la petite marge
  // évite qu'un arrondi flottant fasse perdre une Graine pile au seuil.
  return Math.floor(Math.cbrt((state.verdure * boost) / PRESTIGE_DIVISOR) * shardSeedMultiplier() + 1e-9);
}

// Remet la partie en cours à zéro (Prestige, Ascension, lancement d'un défi), avec le bonus de
// départ : minutes de la production d'avant (récompense de « Course contre la montre » comprise).
function resetRun(cpsAvantReset, plancher = 0) {
  const minutes = (combinedUpgradeValue('startBonus') || 0) + (challengeDone('montre') ? 2 : 0);
  state.verdure = Math.max(plancher, minutes * 60 * cpsAvantReset);
  state.totalEarned = 0;
  // Tout ce qui s'achète en Verdure repart de zéro : compagnons, Clic, Bâtiments et Spécial.
  // Restent la Recherche, les succès, les familiers et ce qui s'achète en Graines ou en Éclats.
  state.buildings = {};
  state.clickUpgrades = {};
  state.companionBuildings = {};
  state.uniqueBuildings = {};
}
function creditSeeds(n) {
  state.cosmicSeeds += n;
  state.totalSeedsEarned += n;
  state.seedsSinceAscension = (state.seedsSinceAscension || 0) + n;
}
function creditShards(n) {
  state.stellarShards = (state.stellarShards || 0) + n;
  state.totalShardsEarned = (state.totalShardsEarned || 0) + n;
}

function startChallenge(id) {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c || !c.unlock(state) || challengeDone(id) || state.challengeActive) return;
  const en = state.lang === 'en';
  if (!confirm(en
    ? `Start "${L(c,'name')}"? Your current run restarts from zero (Greenery, companions, Click, Buildings and Special); your Seeds are kept. Goal: a Prestige worth at least ${c.goal} Seed(s) while following the rule.`
    : `Lancer « ${L(c,'name')} » ? Ta partie en cours repart de zéro (Verdure, compagnons, Clic, Bâtiments et Spécial) ; tes Graines sont conservées. Objectif : un Prestige d'au moins ${c.goal} Graine(s) en respectant la règle.`)) return;
  const cpsAvantReset = totalCps() / boostMult('ability');
  state.challengeActive = id;
  state.challengeStartPlayTime = state.totalPlayTimeSec || 0;
  queueOrShowPapi('defi', { position: 'top-right' });
  resetRun(cpsAvantReset, 1000); // minimum pour acheter les premiers compagnons
  saveGame(); renderAll();
  showToast(en ? `🏅 Challenge started: ${L(c,'name')}` : `🏅 Défi lancé : ${L(c,'name')}`);
}
function abandonChallenge() {
  const c = activeChallenge();
  if (!c) return;
  if (!confirm(state.lang === 'en'
    ? `Give up "${L(c,'name')}"? The rule stops applying and your run continues normally.`
    : `Abandonner « ${L(c,'name')} » ? La règle cesse de s'appliquer et ta partie continue normalement.`)) return;
  state.challengeActive = null;
  saveGame(); renderAll();
}

function doPrestige(auto) {
  const gain = prestigeGainAmount();
  if (gain < 1) return;
  const defi = activeChallenge();
  const tempsRestant = challengeTimeLeftSec();
  const defiReussi = !!defi && gain >= defi.goal && (tempsRestant === null || tempsRestant >= 0);
  const avertissement = !defi ? '' : defiReussi
    ? selonLangue(`\n\nDéfi « ${L(defi,'name')} » réussi avec ce Prestige !`,
                  `\n\nChallenge "${L(defi,'name')}" completed with this Prestige!`)
    : selonLangue(`\n\nAttention : le défi « ${L(defi,'name')} » n'est pas réussi (objectif ${defi.goal} Graine(s)${defi.timeLimitSec ? ' dans le temps imparti' : ''}) et prendra fin.`,
                  `\n\nWarning: challenge "${L(defi,'name')}" is not completed (goal: ${defi.goal} Seed(s)${defi.timeLimitSec ? ' within the time limit' : ''}) and will end.`);
  if (!auto && !confirm(selonLangue(
    `Terraformer maintenant ? Tu vas gagner ${gain} Graine(s) Cosmique(s), mais tu repars de zéro : Verdure, compagnons, Clic, Bâtiments et Spécial (Recherche, Connaissances, succès, familiers et améliorations de Prestige sont conservés). Continuer ?${avertissement}`,
    `Terraform now? You will earn ${gain} Cosmic Seed(s), but you start over: Greenery, companions, Click, Buildings and Special (Research, Knowledge, achievements, pets and Prestige upgrades are kept). Continue?${avertissement}`))) return;
  const cpsAvantReset = totalCps() / boostMult('ability');
  const now = Date.now();
  if (state.lastPrestigeTime) {
    const runSec = (now - state.lastPrestigeTime) / 1000;
    if (state.fastestPrestigeSec === null || runSec < state.fastestPrestigeSec) state.fastestPrestigeSec = runSec;
  }
  state.lastPrestigeTime = now;
  creditSeeds(gain);
  state.prestigeCount += 1;
  if (defi) {
    if (defiReussi) { state.challengesDone = state.challengesDone || {}; state.challengesDone[defi.id] = true; }
    state.challengeActive = null; // réussi ou non, le défi s'arrête avec ce Prestige
  }
  resetRun(cpsAvantReset);
  playPrestigeSound();
  bump('verdureCount');
  checkAchievements();
  saveGame(); renderAll();
  showToast(state.lang === 'en'
    ? `🌍 Terraforming successful! +${gain} Cosmic Seed(s)` + (defi ? (defiReussi ? ` 🏅 Challenge completed: ${L(defi,'name')}` : '. Challenge failed') : '')
    : `🌍 Terraformation réussie ! +${gain} Graine(s) Cosmique(s)` + (defi ? (defiReussi ? ` 🏅 Défi réussi : ${L(defi,'name')}` : '. Défi raté') : ''));
  if (!auto) queueOrShowPapi('prestige', { position: 'top-right' });
}

const ASCENSION_SEED_DIVISOR = 15; // banc d'équilibrage : 1re Ascension vers 45-55 h de jeu actif
// Graines « par Éclat » : 15 au départ, un peu plus pour chaque Éclat déjà gagné (frein de fin de partie).
function ascensionSeedDivisor() { return ASCENSION_SEED_DIVISOR * (1 + (state.totalShardsEarned || 0) / 20); }
function ascensionGainAmount() {
  const boost = 1 + (combinedUpgradeValue('ascensionSeedMult') || 0);
  return Math.floor(Math.cbrt(((state.seedsSinceAscension || 0) * boost) / ascensionSeedDivisor()) + 1e-9); // marge : pas d'Éclat perdu pile au seuil
}
// Graines à gagner depuis la dernière Ascension pour obtenir `n` Éclats (inverse de ascensionGainAmount).
function seedsForShards(n) { return Math.pow(n, 3) * ascensionSeedDivisor() / (1 + (combinedUpgradeValue('ascensionSeedMult') || 0)); }
function ascensionUnlocked() { return (state.totalSeedsEarned || 0) >= ASCENSION_SEED_DIVISOR || state.totalAscensions > 0; }

function doAscension(auto) {
  const gain = ascensionGainAmount();
  if (gain < 1) return;
  if (!auto && !confirm(selonLangue(
    `Ascensionner maintenant ? Tu vas gagner ${gain} Éclat(s) Stellaire(s) (plus de production et plus de Graines à chaque Prestige, jamais remis à zéro), mais tu repars de zéro comme avec un Prestige (Verdure, compagnons, Clic, Bâtiments et Spécial) ET tes Graines Cosmiques, leur bonus de production et tes améliorations de Prestige sont remis à zéro (Recherche, Connaissances, succès, familiers et améliorations d'Ascension sont conservés). Continuer ?`,
    `Ascend now? You will earn ${gain} Stellar Shard(s) (more production and more Seeds on every Prestige, never reset), but you start over as with a Prestige (Greenery, companions, Click, Buildings and Special) AND your Cosmic Seeds, their production bonus and your Prestige upgrades are reset (Research, Knowledge, achievements, pets and Ascension upgrades are kept). Continue?`))) return;
  const cpsAvantReset = totalCps() / boostMult('ability');
  creditShards(gain);
  state.totalAscensions = (state.totalAscensions || 0) + 1;
  state.seedsSinceAscension = 0;
  state.cosmicSeeds = 0;
  state.challengeActive = null; // une Ascension met fin au défi en cours
  state.prestigeUpgrades = {};
  // Une Ascension implique aussi un Prestige complet (le jardin actuel repart à zéro)
  resetRun(cpsAvantReset);
  playPrestigeSound();
  setTimeout(() => playPrestigeSound(), 200);
  bump('verdureCount');
  checkAchievements();
  saveGame(); renderAll();
  showToast(state.lang === 'en'
    ? `🌟 Ascension successful! +${gain} Stellar Shard(s). Total production x${shardMultiplier().toFixed(2)}`
    : `🌟 Ascension réussie ! +${gain} Éclat(s) Stellaire(s). Production x${shardMultiplier().toFixed(2)} au total`);
  if (!auto) queueOrShowPapi('ascension', { position: 'top-right' });
}

function buyAscensionUpgrade(id) {
  const au = ASCENSION_UPGRADES.find(x => x.id === id);
  if (!au || hasAscensionUpgrade(id)) return;
  if (au.requires && !hasAscensionUpgrade(au.requires)) return;
  if ((state.stellarShards || 0) < au.cost) return;
  state.stellarShards -= au.cost;
  state.ascensionUpgrades[id] = true;
  finaliserAchat({ onglet: 'ascension' });
}

function buyPrestigeUpgrade(id) {
  const pu = PRESTIGE_UPGRADES.find(x => x.id === id);
  if (!pu || hasPrestigeUpgrade(id)) return;
  if (pu.requires && !hasPrestigeUpgrade(pu.requires)) return;
  if (state.cosmicSeeds < pu.cost) return;
  state.cosmicSeeds -= pu.cost;
  state.prestigeUpgrades[id] = true;
  finaliserAchat({ onglet: 'prestige' });
}

function checkAchievements() {
  let newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements[a.id] && a.check(state)) { state.achievements[a.id] = true; newlyUnlocked.push(a); }
  }
  if (newlyUnlocked.length) {
    saveGame(); playAchievementSound();
    newlyUnlocked.forEach(a => {
      showToast(`🏆 ${state.lang === 'en' ? 'Achievement unlocked' : 'Succès débloqué'} : ${L(a,'name')}`);
    });
    // Papi réagit une seule fois par lot, sur le succès le plus marquant débloqué — toujours
    // pour les gros succès, seulement 1 fois sur 3 pour les petits (sinon ça parle trop souvent).
    const biggest = newlyUnlocked.reduce((max, a) => (a.bonus > (max ? max.bonus : -1) ? a : max), null);
    if (biggest) {
      if (biggest.bonus >= 0.08) queueOrShowPapi('hugeMilestone');
      else if (Math.random() < 0.33) queueOrShowPapi('milestone');
    }
  }
}

// Au-delà de quatre notifications à l'écran, on retire les plus anciennes : une rafale (achats
// en série, automatisation) les empilait jusqu'à sortir par le haut de l'écran.
const TOASTS_MAX = 4;
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  container.appendChild(t);
  // Retirer la notification annule aussi son minuteur : une rafale en laissait des dizaines
  // armés, chacun retenant un élément déjà sorti de la page.
  while (container.children.length > TOASTS_MAX) {
    const vieille = container.firstElementChild;
    clearTimeout(vieille._minuteur);
    vieille.remove();
  }
  t._minuteur = setTimeout(() => t.remove(), 3000);
}

function bump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('bump');
}

// ================= COSMÉTIQUES DE CLIC =================
function hasSkin(id) { return !!state.ownedSkins[id]; }
function activeSkinEmojis() {
  const sk = SKINS.find(x => x.id === state.activeSkin) || SKINS[0];
  return sk.emojis;
}
function buySkin(id) {
  const sk = SKINS.find(x => x.id === id);
  if (!sk || hasSkin(id)) return;
  if (state.cosmicSeeds < sk.cost) return;
  state.cosmicSeeds -= sk.cost;
  state.ownedSkins[id] = true;
  finaliserAchat({ onglet: 'clic' }); // les cosmétiques vivent dans l'onglet Clic
  showToast(state.lang === 'en' ? `🎨 Cosmetic unlocked: ${L(sk,'name')}` : `🎨 Cosmétique débloqué : ${L(sk,'name')}`);
}
function selectSkin(id) {
  if (!hasSkin(id) || state.activeSkin === id) return;
  state.activeSkin = id;
  saveGame(); renderAll();
}
