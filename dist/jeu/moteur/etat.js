// ================= STATE =================
function defaultState() {
  return {
    verdure: 0,
    totalEarned: 0,
    totalClicks: 0,
    goldenClicked: 0,
    invasiveDefeated: 0,
    questsCompleted: 0,
    cosmicSeeds: 0,
    totalSeedsEarned: 0,
    prestigeCount: 0,
    knowledge: 0,
    buildings: {},
    uniqueBuildings: {},
    companionBuildings: {},
    researchUpgrades: {},
    researchInfiniteLevels: {},
    prestigeUpgrades: {},
    clickUpgrades: {},
    achievements: {},
    tabsSeen: {},
    // Onglets dont Papi a réellement donné l'explication (distinct de tabsSeen, qui est posé
    // dès le DÉBUT de l'annonce pour que l'onglet apparaisse à ce moment-là).
    tabsDescribed: {},
    weather: 'soleil',
    weatherSeen: ['soleil'],
    lastWeatherChange: Date.now(),
    invasiveWeed: null,
    challengeActive: null,      // id du défi en cours (voir CHALLENGES)
    challengeStartPlayTime: 0,  // temps de jeu au lancement (défi chronométré)
    challengesDone: {},         // défis réussis : leurs récompenses sont permanentes
    dailyQuests: null,
    dailyProgress: { click: 0, earn: 0, buy: 0, golden: 0 },
    buyMode: 1,
    lastSave: Date.now(),
    lastGoldenSpawn: Date.now(),
    lastButterflySpawn: Date.now(),
    soundEnabled: true,
    soundVolume: 100,
    totalPlayTimeSec: 0,
    saveVersion: SAVE_VERSION,
    ownedSkins: { default: true },
    activeSkin: 'default',
    forceDarkMode: false,
    vacationMode: false,
    reduireAnimations: null, // null : on suit le reglage du systeme (prefers-reduced-motion)
    zoomUI: 1,              // 1, 1.15 ou 1.3 : taille de l'affichage
    evenementsVus: {}, // « halloween-2026 » : Papi ne commente chaque saison qu'une fois par an
    lang: 'fr',
    langChosen: false,
    hasEverPurchased: false,
    ongletsAchetes: {}, // premier achat fait dans chaque onglet : Papi le commente toujours
    itemPopupsShown: {},
    dailyLoginStreak: 0,
    lastDailyLoginDate: null,
    lastActionTime: Date.now(),
    inactivityAnnounced: false,
    lastBackupTime: 0,
    tutorialSeen: false,
    maxIdleGapSec: 0,
    maxClicksIn5s: 0,
    fastestPrestigeSec: null,
    lastPrestigeTime: null,
    bestCpsEver: 0,
    activeCooldowns: {},
    stellarShards: 0,
    totalShardsEarned: 0, // Éclats gagnés au total (base du bonus, voir shardMultiplier)
    // Automatisations : achat et capacités allumés dès leur déblocage, Prestige automatique
    // éteint par défaut (il remet la partie à zéro, c'est au joueur de le décider).
    automation: { buyCompanions: true, abilities: true, prestige: false, prestigeSeeds: 10 },
    automationsAnnounced: {},
    familiers: { actif: 'escargot', niveaux: {} }, // voir FAMILIERS
    familiersAnnounced: {},
    totalAscensions: 0,
    seedsSinceAscension: 0,
    ascensionUpgrades: {},
  };
}
let state = defaultState();

function applyLoadedState(parsed) {
  state = { ...defaultState(), ...parsed };
  state.dailyProgress = { ...defaultState().dailyProgress, ...(parsed.dailyProgress || {}) };
  state.tabsSeen = { ...defaultState().tabsSeen, ...(parsed.tabsSeen || {}) };
  state.automation = { ...defaultState().automation, ...(parsed.automation || {}) };
  state.familiers = { ...defaultState().familiers, ...(parsed.familiers || {}) };
  state.familiers.niveaux = { ...(state.familiers.niveaux || {}) };
  state.ownedSkins = { ...defaultState().ownedSkins, ...(parsed.ownedSkins || {}) };
  // Migration douce : les sauvegardes plus anciennes récupèrent simplement les nouveaux champs par défaut ci-dessus.
  // Le bonus des Éclats porte désormais sur les Éclats GAGNÉS : une sauvegarde d'avant n'a que le
  // solde, on y rajoute ce qui a déjà été dépensé en améliorations d'Ascension.
  if (parsed.totalShardsEarned === undefined) {
    state.totalShardsEarned = (state.stellarShards || 0)
      + ASCENSION_UPGRADES.filter(u => (state.ascensionUpgrades || {})[u.id]).reduce((t, u) => t + u.cost, 0);
  }
  state.saveVersion = SAVE_VERSION;
}

const SAVE_KEY = 'fuzzSave';
const SAVE_KEY_BACKUP = 'fuzzSave_backup';
const SAVE_KEY_AVANT_IMPORT = 'fuzzSave_avantImport'; // partie remplacee par le dernier import (voir applyImportedData)
const IMPORT_TOAST_FLAG = 'fuzzImportToast'; // sessionStorage : confirmation à afficher après le rechargement d'un import
const LEGACY_SAVE_KEY = 'jardinIdleSave'; // ancien nom, avant le renommage du jeu en Fuzz
const LEGACY_SAVE_KEY_BACKUP = 'jardinIdleSave_backup';

function loadGame() {
  // 1. Sauvegarde déjà migrée vers la nouvelle clé (cas normal après le premier lancement post-renommage)
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      applyLoadedState(JSON.parse(saved));
      return;
    } catch(e) { console.error('Save corrompue, tentative avec la sauvegarde de secours', e); }
  }
  const backup = localStorage.getItem(SAVE_KEY_BACKUP);
  if (backup) {
    try { applyLoadedState(JSON.parse(backup)); return; } catch(e) { console.error('Sauvegarde de secours également corrompue', e); }
  }
  // 2. Rien sous la nouvelle clé : on cherche une ancienne sauvegarde (avant le renommage) et on la migre,
  // SANS jamais supprimer l'ancienne clé (sécurité, au cas où).
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY_BACKUP);
  console.log('DEBUG legacy found:', !!legacy, legacy ? legacy.substring(0,50) : null);
  if (legacy) {
    try {
      applyLoadedState(JSON.parse(legacy));
      console.log('DEBUG after applyLoadedState, verdure=', state.verdure);
      localStorage.setItem(SAVE_KEY, legacy); // migration immédiate vers la nouvelle clé
      console.log('Sauvegarde migrée depuis l\'ancien format (jardinIdleSave → fuzzSave).');
    } catch(e) { console.error('Ancienne sauvegarde corrompue, impossible de migrer', e); }
  }
}
function saveGame() {
  state.lastSave = Date.now();
  state.saveVersion = SAVE_VERSION;
  const json = JSON.stringify(state);
  localStorage.setItem(SAVE_KEY, json);
  if (Date.now() - (state.lastBackupTime || 0) > 5 * 60000) {
    localStorage.setItem(SAVE_KEY_BACKUP, json);
    state.lastBackupTime = Date.now();
  }
  majRotationSauvegardes(json);
}

// Une sauvegarde par jour, sur les 3 derniers jours joués : la copie des 5 minutes protège
// d'une bêtise immédiate, celle-ci d'un problème qu'on ne remarque que le lendemain.
const SAVE_KEY_ROTATION = 'fuzzSave_rotation';
const JOURS_GARDES = 3;
let _derniereRotation = 0;
function lireRotation() {
  try {
    const brut = localStorage.getItem(SAVE_KEY_ROTATION);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter(e => e && e.json && e.jour) : [];
  } catch (e) { return []; }
}
function majRotationSauvegardes(json) {
  if (Date.now() - _derniereRotation < 60000) return; // au plus une écriture par minute
  _derniereRotation = Date.now();
  let liste = lireRotation();
  const jour = todayStr();
  const minuit = new Date(); minuit.setHours(0, 0, 0, 0);
  const entree = { jour, ts: Date.now(), jourTs: minuit.getTime(), json };
  const i = liste.findIndex(e => e.jour === jour);
  if (i >= 0) liste[i] = entree; else liste.push(entree);
  liste.sort((a, b) => (b.jourTs || b.ts || 0) - (a.jourTs || a.ts || 0));
  liste = liste.slice(0, JOURS_GARDES);
  // Si le navigateur refuse (quota), on se rabat sur moins d'entrées plutôt que tout perdre.
  while (liste.length) {
    try { localStorage.setItem(SAVE_KEY_ROTATION, JSON.stringify(liste)); break; }
    catch (e) { liste.pop(); }
  }
  sauvegardeFichierQuotidienne(json);
}

// App native uniquement : une copie écrite à côté des données de l'app (une fois par jour, en
// réécrivant toujours le même fichier pour ne rien accumuler), pour que la partie survive même à
// un effacement des données du navigateur embarqué. Silencieux par construction : si l'écriture
// échoue, le joueur a déjà ses sauvegardes dans le jeu.
let _dernierFichierAuto = null;
async function sauvegardeFichierQuotidienne(json) {
  if (!isTauriApp() || !window.__TAURI__.fs) return;
  const jour = todayStr();
  if (_dernierFichierAuto === jour) return;
  _dernierFichierAuto = jour;
  try {
    const fs = window.__TAURI__.fs;
    await fs.writeTextFile('fuzz-sauvegarde-auto.txt', btoa(unescape(encodeURIComponent(json))), { baseDir: fs.BaseDirectory.AppData });
  } catch (e) { console.warn('sauvegarde fichier automatique impossible', e); }
}
loadGame();
// Les reglages de confort touchent <body> et la mise a l'echelle : a poser des que l'etat est lu.
appliquerConfort();

