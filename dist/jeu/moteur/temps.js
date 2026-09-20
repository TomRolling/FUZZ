// ================= IDLE TICK =================
let _idleTickCount = 0;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });
window.addEventListener('beforeunload', () => { saveGame(); });
let _appStartTime = Date.now();
setInterval(() => {
  if (!challengeIs('mains')) {
    const gapSec = (Date.now() - (_lastClickTime || _appStartTime)) / 1000;
    if (gapSec > state.maxIdleGapSec) state.maxIdleGapSec = gapSec;
  }
  accrue(_vitesseTest, boostMult('golden'));
  maybeShowDailyLoginReward();
  checkAchievements();
  verifierNouveauxOnglets(); // après checkAchievements : l'onglet Succès dépend d'un succès obtenu
  _idleTickCount = (_idleTickCount || 0) + 1;
  if (_idleTickCount % 5 === 0) saveGame(); // écriture disque toutes les 5s seulement, pas à chaque tick
  // Passe par renderAll (groupé sur la frame) plutôt que d'appeler les rendus un par un :
  // ceux des fenêtres fermées étaient redessinés chaque seconde dans le vide.
  scheduleRenderAll();
  updateDocumentTitle(); // hors rAF : le titre doit aussi se mettre à jour onglet en arrière-plan
}, 1000);

// ================= OFFLINE PROGRESS =================
// Au-delà, l'absence ne rapporte plus rien : le jeu récompense qu'on revienne, pas qu'on parte.
const ABSENCE_COMPTEE_MAX_SEC = 8 * 3600;
function applyOfflineProgress() {
  // Deux durées distinctes : celle de l'absence réelle (affichée telle quelle), et celle qui
  // produit (plafonnée). Afficher la seconde à la place de la première faisait lire « 8 h »
  // à un joueur parti vingt heures.
  const absenceSec = Math.max(0, (Date.now() - (state.lastSave || Date.now())) / 1000);
  const elapsedSec = Math.min(absenceSec, ABSENCE_COMPTEE_MAX_SEC);
  if (elapsedSec > 10) {
    const baseEff = combinedUpgradeValue('offline') || 0.5;
    const bonusEff = combinedUpgradeValue('offlineBonus') || 0;
    const uniqueEff = uniqueMultipliers().offlineBonus;
    const efficiency = Math.min(1, baseEff + bonusEff + uniqueEff);
    const gain = totalCps() * elapsedSec * efficiency;
    if (gain > 0) {
      state.verdure += gain; state.totalEarned += gain;
      const mins = Math.floor(elapsedSec / 60);
      const timeLabel = formatDureeCourte(Math.floor(absenceSec / 60) * 60);
      if (elapsedSec > 60) {
        const en = state.lang === 'en', rendement = (efficiency * 100).toFixed(0);
        // Le plafond n'est dit que quand il a servi : inutile d'en parler après une heure d'absence.
        const plafond = absenceSec > ABSENCE_COMPTEE_MAX_SEC
          ? `<div class="offlineLigne"><span>${en ? 'Production counted' : 'Production comptée'}</span><b>${formatDureeCourte(ABSENCE_COMPTEE_MAX_SEC)} ${en ? '(max)' : '(maximum)'}</b></div>`
          : '';
        document.getElementById('offlineBody').innerHTML =
          `<div class="offlineLigne"><span>${en ? 'Time away' : 'Durée de ton absence'}</span><b>${timeLabel}</b></div>` +
          plafond +
          `<div class="offlineLigne"><span>${en ? 'Garden efficiency' : 'Rendement du jardin'}</span><b>${en ? rendement + '%' : rendement + ' %'}</b></div>` +
          `<div class="offlineGain">🌿 +${formatNum(gain)} ${en ? 'Greenery' : 'Verdure'}</div>`;
        document.getElementById('offlineOverlay').style.display = 'flex';
        _shouldShowReturnLine = true;
      } else {
        showToast(state.lang === 'en'
          ? `⏱️ While you were away (${mins} min): +${formatNum(gain)} Greenery`
          : `⏱️ Pendant ton absence (${mins} min) : +${formatNum(gain)} Verdure`);
      }
    }
  }
}

