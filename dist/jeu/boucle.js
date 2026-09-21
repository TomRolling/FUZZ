// ================= CLICK =================
let _lastClickTime = null;
let _recentClickTimes = [];
document.getElementById('clickZone').addEventListener('click', (e) => {
  if (challengeIs('mains')) return;
  state.lastActionTime = Date.now();
  state.inactivityAnnounced = false;
  registerCombo();
  const gain = clickGain();
  state.verdure += gain;
  state.totalEarned += gain;
  state.totalClicks += 1;
  state.dailyProgress.click += 1;
  state.dailyProgress.earn += gain;

  // Suivi pour les succès secrets "Zen absolu" et "Frénésie"
  const now = Date.now();
  if (_lastClickTime !== null) {
    const gapSec = (now - _lastClickTime) / 1000;
    if (gapSec > state.maxIdleGapSec) state.maxIdleGapSec = gapSec;
  }
  _lastClickTime = now;
  _recentClickTimes.push(now);
  _recentClickTimes = _recentClickTimes.filter(t => now - t <= 5000);
  if (_recentClickTimes.length > state.maxClicksIn5s) state.maxClicksIn5s = _recentClickTimes.length;

  const floatEl = prendreEphemere('texte', 'floatText');
  if (floatEl) {
    floatEl.textContent = `+${formatNum(gain)}`;
    floatEl.style.left = (e.clientX - 10) + 'px';
    floatEl.style.top = (e.clientY - 10) + 'px';
    lancerEphemere('texte', floatEl, 800);
  }

  spawnClickParticles(e.clientX, e.clientY);
  playClickSound();

  checkAchievements();
  scheduleRenderAll();
});

// Enveloppés : passer la fonction directement lui donnerait l'événement de clic comme `auto`.
document.getElementById('prestigeBtn').addEventListener('click', () => doPrestige());
document.getElementById('ascensionBtn').addEventListener('click', () => doAscension());

// ================= GOLDEN WEED EVENT =================
function spawnGoldenWeed() {
  const el = document.createElement('div');
  el.className = 'golden';
  const saison = evenementActif();
  el.textContent = saison ? saison.herbe : '🌿✨';
  el.style.left = (10 + Math.random() * 80) + '%';
  el.style.top = (15 + Math.random() * 65) + '%';
  el.onclick = () => {
    state.goldenClicked += 1;
    state.dailyProgress.golden += 1;
    const bonusType = Math.random() < 0.5 ? 'instant' : 'boost';
    if (bonusType === 'instant') {
      const bonus = Math.max(50, totalCps() * 25);
      state.verdure += bonus; state.totalEarned += bonus;
      state.dailyProgress.earn += bonus;
      bump('verdureCount');
      showToast(state.lang === 'en' ? `✨ Golden weed! +${formatNum(bonus)} instant Greenery` : `✨ Mauvaise herbe dorée ! +${formatNum(bonus)} Verdure instantanée`);
    } else {
      const duree = 25000;
      startTimedBoost('golden', 2, duree);
      showToast(state.lang === 'en' ? `✨ Golden weed! x2 production for ${formatDureeCourte(duree / 1000)}` : `✨ Mauvaise herbe dorée ! x2 production pendant ${formatDureeCourte(duree / 1000)}`);
    }
    playGoldenSound();
    checkAchievements();
    saveGame(); renderAll();
    el.remove();
  };
  // DANS #gameViewport, pas dans <body> : hors du wrapper, leur position:fixed se résolvait
  // contre la vraie fenêtre (et non contre la zone de dessin mise à l'échelle), et ils
  // passaient par-dessus les menus, qui sont eux à l'intérieur.
  document.getElementById('gameViewport').appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 8000);
}
// Toutes les 3 à 6 minutes (armé dans demarrage.js) : l'herbe dorée est un petit plus pour le
// joueur attentif, pas un moteur de progression (à 45-90 s, elle rapportait presque autant que
// toute la production).
function peutEtreHerbeDoree() {
  if (isMainScreenBlocked()) return; // pas pendant un menu ouvert ni un tutoriel en cours
  if (Date.now() - state.lastGoldenSpawn > 180000 + Math.random() * 180000) {
    state.lastGoldenSpawn = Date.now();
    spawnGoldenWeed();
  }
}

// ================= ÉVÉNEMENT ALÉATOIRE : NUÉE DE PAPILLONS =================
function spawnButterflies() {
  const el = document.createElement('div');
  el.className = 'golden';
  el.textContent = '🦋';
  el.style.left = (10 + Math.random() * 80) + '%';
  el.style.top = (15 + Math.random() * 65) + '%';
  el.onclick = () => {
    const duree = 25000;
    startTimedBoost('click', 2, duree);
    showToast(state.lang === 'en' ? `🦋 Swarm of butterflies! x2 click gain for ${formatDureeCourte(duree / 1000)}` : `🦋 Nuée de papillons ! x2 gain par clic pendant ${formatDureeCourte(duree / 1000)}`);
    playGoldenSound();
    saveGame(); renderAll();
    el.remove();
  };
  // DANS #gameViewport, pas dans <body> : hors du wrapper, leur position:fixed se résolvait
  // contre la vraie fenêtre (et non contre la zone de dessin mise à l'échelle), et ils
  // passaient par-dessus les menus, qui sont eux à l'intérieur.
  document.getElementById('gameViewport').appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 8000);
}
// Toutes les 4 à 8 minutes (armé dans demarrage.js).
function peutEtrePapillons() {
  if (isMainScreenBlocked()) return; // pas pendant un menu ouvert ni un tutoriel en cours
  if (Date.now() - (state.lastButterflySpawn||0) > 240000 + Math.random() * 240000) {
    state.lastButterflySpawn = Date.now();
    spawnButterflies();
  }
}

// ================= CHAT DU JARDIN (bonus horaire) =================
// Trois minutes de production offertes, une fois par heure. Le banc d'équilibrage lit cette
// fonction pour simuler le chat ET pour estimer ce qu'il vaut : une seule formule pour les deux.
const CHAT_SECONDES_OFFERTES = 180;
function bonusChatJardin(cps) { return Math.max(20, cps * CHAT_SECONDES_OFFERTES); }
// Une fois par heure (armé dans demarrage.js).
function bonusHoraireChat() {
  if (!uniqueActive('chatJardin')) return;
  const bonus = bonusChatJardin(totalCps());
  state.verdure += bonus; state.totalEarned += bonus;
  saveGame(); renderAll();
  const chat = L(UNIQUE_BUILDINGS.find(u => u.id === 'chatJardin'), 'name');
  showToast(selonLangue(`🐈 ${chat} ramène +${formatNum(bonus)} Verdure !`, `🐈 ${chat} brings back +${formatNum(bonus)} Greenery!`));
}

// ================= AUTOMATISATION =================
// Offerte aux étapes de la progression (voir AUTOMATIONS) et pilotée depuis l'onglet
// « Automatisation » du Magasin. Tourne chaque seconde, menus ouverts ou non.
function automationOn(id) {
  const a = AUTOMATIONS.find(x => x.id === id);
  return !!a && a.unlock(state) && !!(state.automation || {})[id];
}
let _automationTick = 0;
// Signale une fois chaque entrée débloquée d'une table. Tant que Papi n'a pas présenté l'onglet,
// l'entrée est notée sans message : c'est la présentation de l'onglet qui la fait découvrir.
function announceUnlocks(table, stateKey, tabId, message) {
  const deja = state[stateKey] = state[stateKey] || {};
  for (const x of table) {
    if (!x.unlock(state) || deja[x.id]) continue;
    deja[x.id] = true;
    if (state.tabsSeen[tabId]) showToast(message(L(x, 'name'), state.lang === 'en'));
  }
}
function runAutomations() {
  _automationTick++;
  announceUnlocks(FAMILIERS, 'familiersAnnounced', 'familiers', (x, en) => en ? `🐾 New pet: ${x} (Pets tab)` : `🐾 Nouveau familier : ${x} (onglet Familiers)`);
  announceUnlocks(AUTOMATIONS, 'automationsAnnounced', 'automatisation', (x, en) => en ? `🤖 New automation: ${x} (Automation tab)` : `🤖 Nouvelle automatisation : ${x} (onglet Automatisation)`);

  // Achat automatique : le compagnon VISIBLE au meilleur rapport qualité/prix. Quand le Prestige
  // automatique est actif, un achat n'est fait que s'il rapproche du Prestige visé (il rapporte
  // plus, pendant l'attente, qu'il ne coûte) — sinon l'achat automatique vidait la Verdure en
  // poche et le Prestige automatique n'arrivait jamais.
  if (automationOn('buyCompanions') && state.tabsSeen.production && _automationTick % 2 === 0) {
    let achats = 0;
    for (let n = 0; n < 20; n++) {
      const id = bestRoiBuildingId();
      const b = id && BUILDINGS.find(x => x.id === id);
      if (!b) break;
      const cost = buildingCost(b, 1);
      if (state.verdure < cost) break;
      if (automationOn('prestige')) {
        const reste = verdureForSeeds(Math.max(1, state.automation.prestigeSeeds || 1)) - state.verdure;
        const gain = buildingCpsPerUnit(b) * totalProdMultiplier();
        if (reste <= 0 || cost * totalCps() >= gain * reste) break;
      }
      if (!buyBuilding(id, 1, true)) break;
      achats++;
    }
    if (achats) { checkAchievements(); scheduleRenderAll(); }
  }

  // Capacités : dès la fin de leur recharge, sans écraser un bonus plus fort déjà en cours.
  if (automationOn('abilities')) {
    for (const u of UNIQUE_BUILDINGS) {
      if (!u.active || !uniqueActive(u.id) || activeCooldownRemaining(u.id) > 0) continue;
      if (u.active.type === 'boostMult' && boostMult('ability') >= u.active.value) continue;
      if (u.active.type === 'clickBoost' && boostMult('click') >= u.active.value) continue;
      activateUniqueAbility(u.id);
    }
  }

  // Prestige automatique : dès que le gain atteint le nombre de Graines choisi. Jamais pendant
  // qu'un tutoriel est à l'écran.
  if (automationOn('prestige') && state.tabsSeen.prestige && !_pendingSpotlightGroup && !state.challengeActive) {
    const cible = Math.max(1, state.automation.prestigeSeeds || 1);
    if (prestigeGainAmount() >= cible) {
      showToast(state.lang === 'en' ? '🤖 Automatic Prestige' : '🤖 Prestige automatique');
      doPrestige(true);
    }
  }
}

// ================= MÉTÉO, VISITES, INACTIVITÉ ET REMARQUES SPONTANÉES =================
function checkInactivity() {
  if (state.inactivityAnnounced) return;
  const idleSec = (Date.now() - (state.lastActionTime || Date.now())) / 1000;
  if (idleSec >= 300) { // 5 minutes sans clic ni achat
    state.inactivityAnnounced = true;
    queueOrShowPapi('inactivity');
  }
}
function maybeShowRandomUnrelated() {
  if (isMainScreenBlocked()) return;
  if (state.invasiveWeed && state.invasiveWeed.active) return; // pas pendant qu'une visite à malus est déjà en cours
  if (Math.random() < 0.0025) {
    const heure = new Date().getHours();
    const tard = heure >= 23 || heure < 5;
    const category = Math.random() < 0.3 ? 'mysteryTeaser' : (tard && Math.random() < 0.6 ? 'nuit' : 'randomUnrelated');
    papiSaysFromCategory(category, { position: 'top-right' });
  }
}
// Toutes les 10 secondes (armé dans demarrage.js).
function tickMeteoEtVisites() { maybeChangeWeather(); maybeSpawnInvasive(); checkInactivity(); maybeShowRandomUnrelated(); }

