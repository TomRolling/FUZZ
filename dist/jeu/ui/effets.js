// ================= CLICK PARTICLES =================
// Décor éphémère du clic (particules, « +N » qui monte). Deux raisons de passer par un
// réservoir d'éléments réutilisés plutôt que d'en créer à chaque clic :
//  - chacun est composé sur sa propre couche le temps de son animation ; sans limite, une salve
//    de clics en créait des centaines par seconde et le compositeur redessinait tout autour ;
//  - la limite est ici la taille du réservoir, pas un compteur à incrémenter et décrémenter à
//    la main dans deux blocs de code différents.
// La taille laisse passer le rythme du succès « Frénésie » (30 clics en 5 secondes).
const EPHEMERES_MAX = { particule: 30, texte: 12 };
const _ephemeresLibres = { particule: [], texte: [] };
const _ephemeresCrees = { particule: 0, texte: 0 };
// Rend un élément prêt à servir, ou null si le réservoir est à sec (tout est déjà à l'écran).
function prendreEphemere(type, classe) {
  const libre = _ephemeresLibres[type].pop();
  if (libre) return libre;
  if (_ephemeresCrees[type] >= EPHEMERES_MAX[type]) return null;
  _ephemeresCrees[type]++;
  const el = document.createElement('div');
  el.className = classe;
  return el;
}
function lancerEphemere(type, el, dureeMs) {
  document.body.appendChild(el);
  // Un élément réutilisé garde son animation terminée : on la relance explicitement. Passer par
  // les animations CSS (plutôt que de les redéclarer en JS) garde le réglage « moins
  // d'animations » actif, qui agit par une règle de style.
  el.getAnimations().forEach(a => { a.cancel(); a.play(); });
  setTimeout(() => { el.remove(); _ephemeresLibres[type].push(el); }, dureeMs);
}
function spawnClickParticles(x, y) {
  const emojis = activeSkinEmojis();
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const p = prendreEphemere('particule', 'particle');
    if (!p) return; // réservoir à sec : l'écran en est déjà plein
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 28 + Math.random() * 46;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
    p.style.setProperty('--dy', (Math.sin(angle) * dist - 10) + 'px');
    p.style.setProperty('--rot', (Math.random() * 180 - 90) + 'deg');
    lancerEphemere('particule', p, 700);
  }
}

// ================= CLICK COMBO (feedback + petit bonus) =================
let comboCount = 0;
let comboResetTimer = null;
function registerCombo() {
  comboCount = Math.min(comboCount + 1, 40);
  clearTimeout(comboResetTimer);
  comboResetTimer = setTimeout(() => { comboCount = 0; updateComboBadge(); }, 1100);
  updateComboBadge();
}
function comboMultiplier() {
  return 1 + Math.min(comboCount, 30) * 0.015; // jusqu'à +45%
}
function updateComboBadge() {
  const badge = document.getElementById('comboBadge');
  if (!badge) return;
  if (comboCount >= 3) {
    badge.textContent = `🔥 Combo x${comboMultiplier().toFixed(2)}`;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

// ================= RENDER DEBOUNCING (perf) =================
let _renderQueued = false;
function scheduleRenderAll() {
  if (_renderQueued) return;
  _renderQueued = true;
  requestAnimationFrame(() => { _renderQueued = false; renderAll(); });
}

