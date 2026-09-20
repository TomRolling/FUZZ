// ================= WEATHER LOGIC =================
function maybeChangeWeather() {
  if (Date.now() - state.lastWeatherChange > 180000) {
    const keys = Object.keys(WEATHERS);
    const newWeather = keys[Math.floor(Math.random() * keys.length)];
    state.weather = newWeather;
    state.lastWeatherChange = Date.now();
    if (!state.weatherSeen.includes(newWeather)) state.weatherSeen.push(newWeather);
    checkAchievements();
    // Une fois sur trois quand le temps tourne mal : assez pour que le ciel existe, assez rare
    // pour ne pas transformer la météo en bavardage.
    if (WEATHERS[newWeather].negative && Math.random() < 0.34) papiSaysFromCategory('meteo', { position: 'top-right' });
    saveGame();
  }
}

// ================= INVASIVE WEED =================
function maybeSpawnInvasive() {
  if (state.vacationMode || challengeDone('papi')) return;
  if (state.invasiveWeed && state.invasiveWeed.active) return;
  if (isMainScreenBlocked()) return; // on ne dérange pas le joueur pendant qu'il est dans un menu, on retente au prochain tick
  const chance = 0.01 * uniqueMultipliers().invasiveRate;
  if (Math.random() < chance) {
    state.invasiveWeed = { active: true, needed: 5, done: 0 };
    // Il dit qu'il débarque : une remarque de passage ne donnait aucun sens à la bannière.
    papiSaysFromCategory('arrivee');
    saveGame();
  }
}
function clickInvasive() {
  if (!state.invasiveWeed || !state.invasiveWeed.active) return;
  state.invasiveWeed.done += 1;
  if (state.invasiveWeed.done >= state.invasiveWeed.needed) {
    state.invasiveWeed = null;
    state.invasiveDefeated += 1;
    checkAchievements();
    showToast(state.lang === 'en' ? '✅ Gramps left convinced you can handle it!' : '✅ Papi est reparti convaincu que tu gères !');
    // En file d'attente : s'il est dans un menu au moment du départ, la réplique attend la
    // fermeture du menu plutôt que d'être perdue (Papi doit parler en arrivant ET en partant).
    queueOrShowPapi('leaving', { position: 'top-right' });
  }
  saveGame(); renderAll();
}

// ================= DAILY QUESTS =================
// ================= RÉCOMPENSE DE CONNEXION QUOTIDIENNE =================
// Cycle de 7 jours, qui recommence indéfiniment (le palier 7 est un petit bonus, avec une
// Graine Cosmique si le joueur a déjà fait au moins un prestige). Les montants de Verdure
// sont proportionnels à la production actuelle, pour rester pertinents à tout stade de jeu.
function dateStrForOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function todayStr() { return dateStrForOffset(0); }
function dailyRewardForDay(day, cpsConnu) {
  const cps = cpsConnu !== undefined ? cpsConnu : Math.max(1, totalCps());
  switch (day) {
    case 1: return { verdure: Math.max(50, cps * 20) };
    case 2: return { verdure: Math.max(100, cps * 40) };
    case 3: return { knowledge: knowledgeMinutes(20, 10) };
    case 4: return { verdure: Math.max(200, cps * 80) };
    case 5: return { knowledge: knowledgeMinutes(40, 20) };
    case 6: return { verdure: Math.max(400, cps * 150) };
    case 7: return { verdure: Math.max(800, cps * 300), seeds: state.prestigeCount > 0 ? 1 : 0 };
    default: return { verdure: Math.max(50, cps * 20) };
  }
}
function dailyLoginRewardClaimable() {
  return !!state.tabsSeen.dailyreward && state.lastDailyLoginDate !== todayStr();
}
// Crédite la récompense du jour et renvoie { day, reward } — ou null si rien à réclamer.
function claimDailyLoginReward() {
  if (!dailyLoginRewardClaimable()) return null; // onglet pas encore présenté, ou déjà réclamé aujourd'hui
  const today = todayStr();
  const yesterday = dateStrForOffset(1);
  state.dailyLoginStreak = (state.lastDailyLoginDate === yesterday) ? (state.dailyLoginStreak || 0) + 1 : 1;
  state.lastDailyLoginDate = today;
  const day = ((state.dailyLoginStreak - 1) % 7) + 1;
  const reward = dailyRewardForDay(day);
  if (reward.verdure) { state.verdure += reward.verdure; state.totalEarned += reward.verdure; }
  if (reward.knowledge) grantKnowledge(reward.knowledge);
  if (reward.seeds) { state.cosmicSeeds += reward.seeds; state.totalSeedsEarned += reward.seeds; }
  saveGame();
  renderAll();
  return { day, reward };
}
// Appelée à chaque tick : la pop-up attend que le joueur soit sur l'écran de jeu, sans fenêtre
// ouverte, sans tutoriel ni bulle de Papi, sans autre pop-up. Elle arrive donc au lancement une
// fois l'écran libre, juste après la présentation de l'onglet (dès la fenêtre refermée), ou au
// changement de jour en pleine partie — jamais par-dessus un menu.
function maybeShowDailyLoginReward() {
  if (!dailyLoginRewardClaimable()) return;
  if (isMainScreenBlocked() || tutorialInProgress() || isDialogueVisible()) return;
  if (['dailyPopupOverlay', 'itemPopupOverlay', 'offlineOverlay'].some(id => document.getElementById(id).style.display === 'flex')) return;
  const claim = claimDailyLoginReward();
  if (claim) showDailyLoginPopup(claim.day, claim.reward);
}
// Lignes de gain d'une récompense du jour ; `court` : sans le nom de la ressource (notification).
function dailyRewardParts(reward, court) {
  const en = state.lang === 'en';
  const nom = (fr, enTxt) => court ? '' : ' ' + (en ? enTxt : fr);
  const parts = [];
  if (reward.verdure) parts.push(`+${formatNum(reward.verdure)}${nom('Verdure', 'Greenery')} 🌿`);
  if (reward.knowledge) parts.push(`+${formatNum(reward.knowledge)}${nom('Connaissances', 'Knowledge')} 📚`);
  if (reward.seeds) parts.push(`+${reward.seeds}${nom('Graine Cosmique', 'Cosmic Seed')} 🌌`);
  return parts;
}
function showDailyLoginPopup(day, reward) {
  const en = state.lang === 'en';
  document.getElementById('dailyPopupDay').textContent = (en ? 'Day ' : 'Jour ') + day;
  document.getElementById('dailyPopupRewards').innerHTML = dailyRewardParts(reward).map(p => `<div>${p}</div>`).join('');
  document.getElementById('dailyPopupStreak').textContent = en
    ? `${state.dailyLoginStreak} day streak. Come back tomorrow for more!`
    : `${state.dailyLoginStreak} jour(s) d'affilée. Reviens demain pour la suite !`;
  document.getElementById('dailyPopupCloseBtn').textContent = en ? 'Nice!' : 'Super !';
  document.getElementById('dailyPopupOverlay').style.display = 'flex';
}
document.getElementById('dailyPopupCloseBtn').addEventListener('click', () => {
  fermerSurgissante('dailyPopupOverlay');
  // Le panneau "Bonus quotidien" peut être resté ouvert en dessous (ex: premier déblocage, où le
  // clic sur le bouton flottant ouvre le panneau ET déclenche l'auto-réclamation) — sans ce
  // rafraîchissement il continuerait à afficher "prête à réclamer" alors que c'est déjà fait.
  if (isOverlayOpen('questsModalOverlay')) renderDailyRewardModal();
});

// Panneau consultable n'importe quand : statut du jour + calendrier de prévisualisation
// des 7 paliers (montants recalculés sur la production actuelle, donc réalistes).
function renderDailyRewardModal() {
  const en = state.lang === 'en';
  const today = todayStr();
  const alreadyClaimedToday = state.lastDailyLoginDate === today;
  // Si la récompense n'a pas encore été réclamée aujourd'hui, le jour à mettre en évidence dépend
  // de la continuité de la série (comme dans claimDailyLoginReward) : une série cassée (un jour
  // manqué) repart à 1, elle ne continue pas simplement à +1 — sinon le calendrier mettrait en
  // avant un jour différent de celui qui sera réellement accordé au clic sur "Réclamer".
  let currentDay;
  if (alreadyClaimedToday) {
    currentDay = ((state.dailyLoginStreak - 1) % 7) + 1;
  } else {
    const yesterday = dateStrForOffset(1);
    const streakIfClaimedNow = (state.lastDailyLoginDate === yesterday) ? (state.dailyLoginStreak || 0) + 1 : 1;
    currentDay = ((streakIfClaimedNow - 1) % 7) + 1;
  }

  const statusEl = document.getElementById('dailyRewardStatus');
  const claimBtn = document.getElementById('dailyRewardClaimBtn');
  if (alreadyClaimedToday) {
    statusEl.textContent = en
      ? `✅ Already claimed today. ${state.dailyLoginStreak} day streak. Come back tomorrow!`
      : `✅ Déjà réclamée aujourd'hui. ${state.dailyLoginStreak} jour(s) d'affilée. Reviens demain !`;
    claimBtn.style.display = 'none';
  } else {
    statusEl.textContent = en ? "Today's reward is ready!" : "La récompense du jour est prête !";
    claimBtn.style.display = 'block';
    claimBtn.textContent = en ? '🎁 Claim' : '🎁 Réclamer';
  }

  const cal = document.getElementById('dailyRewardCalendar');
  cal.className = 'dailyCalendar';
  // Une seule mesure de production pour les sept jours : chaque appel parcourt tous les
  // compagnons et toute la pile de multiplicateurs.
  const cps = Math.max(1, totalCps());
  let html = '';
  for (let d = 1; d <= 7; d++) {
    const parts = dailyRewardParts(dailyRewardForDay(d, cps), true);
    const isToday = d === currentDay;
    const isPast = !isToday && (alreadyClaimedToday ? d < currentDay || (currentDay === 7 && d !== 7) : d < currentDay);
    const isFinal = d === 7;
    const aPrendre = isToday && !alreadyClaimedToday;
    // Chaque carte dit explicitement OÙ on en est : récupéré / aujourd'hui / à venir. Sans ce
    // libellé, seule une nuance d'opacité distinguait un jour passé d'un jour à venir.
    const etat = aPrendre ? tr('dailyTapToClaim')
      : isToday ? tr('dailyToday') : (isPast ? tr('dailyClaimed') : tr('dailySoon'));
    html += `<div class="dailyCalendarCard${isToday ? ' today' : ''}${isPast ? ' past' : ''}`
      + `${isFinal ? ' final' : ''}${aPrendre ? ' aPrendre' : ''}">`
      + `<div class="dayLabel">${isFinal ? '🏆 ' : ''}${en ? 'Day' : 'Jour'} ${d}</div>`
      + `<div class="dayReward">${parts.join('<br>')}</div>`
      + `<div class="dayState">${etat}</div></div>`;
  }
  setHtmlIfChanged(cal, html);
}
document.getElementById('dailyRewardClaimBtn').addEventListener('click', () => reclamerBonusDuJour());
// Cliquer la carte du jour fait la même chose que le bouton : c'est là que le regard va.
// Délégué au calendrier, donc posé une seule fois plutôt qu'à chaque redessin des cartes.
document.getElementById('dailyRewardCalendar').addEventListener('click', (e) => {
  if (e.target.closest('.dailyCalendarCard.aPrendre')) reclamerBonusDuJour();
});
// Un seul chemin de réclamation, partagé par le bouton et par la carte du jour.
function reclamerBonusDuJour() {
  const claim = claimDailyLoginReward();
  renderDailyRewardModal();
  if (!claim) return;
  showToast(`🎁 ${state.lang === 'en' ? 'Day' : 'Jour'} ${claim.day} : ${dailyRewardParts(claim.reward, true).join(' ')}`);
}
function generateQuests() {
  const today = todayStr();
  if (state.dailyQuests && state.dailyQuests.date === today) return;
  // Les quêtes qui paient en Connaissances sont retirées du tirage tant que la ressource n'a
  // pas été présentée au joueur : sinon le panneau affiche « Récompense : 40 Connaissances »
  // pour une monnaie dont il n'a jamais entendu parler (et que le paiement refuserait).
  const pool = knowledgeUnlocked() ? QUEST_POOL : QUEST_POOL.filter(t => !QUEST_KNOWLEDGE_TYPES.has(t));
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  const quests = shuffled.map(type => {
    let target, rewardType, rewardAmount;
    const cps = Math.max(1, totalCps());
    // Objectifs calibres pour occuper une VRAIE journee de jeu, pas dix minutes : les seuils
    // adosses a la production (earn) valent plusieurs heures de rendement courant, et les
    // seuils fixes (clics, achats, herbes dorees) montent avec le nombre de prestiges pour
    // rester consistants quand la production explose.
    if (type === 'click') { target = 1500 + state.prestigeCount * 250; rewardType='verdure'; rewardAmount = Math.max(1000, cps*900); }
    if (type === 'earn') { target = Math.max(25000, Math.floor(cps*5400)); rewardType='knowledge'; rewardAmount = knowledgeMinutes(30, 15); }
    if (type === 'buy') { target = 40 + state.prestigeCount * 5; rewardType='verdure'; rewardAmount = Math.max(2000, cps*1800); }
    if (type === 'golden') { target = 8; rewardType='knowledge'; rewardAmount = knowledgeMinutes(45, 20); }
    return { type, target, rewardType, rewardAmount, claimed: false };
  });
  state.dailyQuests = { date: today, quests };
  state.dailyProgress = { click: 0, earn: 0, buy: 0, golden: 0 };
  saveGame();
}
function questProgressValue(type) { return state.dailyProgress[type] || 0; }
// Génère le texte de la quête à l'affichage (pas au moment de sa création) pour qu'il
// s'adapte automatiquement si la langue change en cours de journée.
function questDesc(q) {
  const target = q.target;
  if (state.lang === 'en') {
    if (q.type === 'click') return `Click ${target} times`;
    if (q.type === 'earn') return `Earn ${formatNum(target)} Greenery`;
    if (q.type === 'buy') return `Buy ${target} companions`;
    if (q.type === 'golden') return `Catch ${target} golden weeds`;
  }
  if (q.type === 'click') return `Clique ${target} fois`;
  if (q.type === 'earn') return `Gagne ${formatNum(target)} Verdure`;
  if (q.type === 'buy') return `Achète ${target} compagnons`;
  if (q.type === 'golden') return `Attrape ${target} herbes dorées`;
  return '';
}
function claimQuest(index) {
  if (!state.dailyQuests) return;
  const q = state.dailyQuests.quests[index];
  if (!q || q.claimed) return;
  const progress = questProgressValue(q.type);
  if (progress < q.target) return;
  const questMult = combinedUpgradeValue('questMult') || 1;
  const amount = q.rewardAmount * questMult;
  if (q.rewardType === 'verdure') { state.verdure += amount; state.totalEarned += amount; }
  else grantKnowledge(amount);
  q.claimed = true;
  state.questsCompleted = (state.questsCompleted || 0) + 1;
  checkAchievements();
  saveGame(); renderAll();
  showToast(state.lang === 'en'
    ? `✅ Quest completed! +${formatNum(amount)} ${q.rewardType === 'verdure' ? 'Greenery' : 'Knowledge'}`
    : `✅ Quête complétée ! +${formatNum(amount)} ${q.rewardType === 'verdure' ? 'Verdure' : 'Connaissances'}`);
}

