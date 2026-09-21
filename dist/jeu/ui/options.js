// ================= PANNEAU OPTIONS =================
// Réglages du joueur : son, animations, zoom, volume, langue, mode sombre, vacances, crédits.

document.getElementById('soundToggleBtn').addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  if (state.soundEnabled) playTone(600, 0.06, 'sine', 0.04);
  updateMusicVolume();
  saveGame(); renderSoundToggle();
});
// Animations : on fait tourner les trois etats (systeme -> reduites -> completes).
document.getElementById('animToggleBtn').addEventListener('click', () => {
  const suite = { null: true, true: false, false: null };
  state.reduireAnimations = suite[String(state.reduireAnimations)];
  if (state.reduireAnimations === undefined) state.reduireAnimations = null;
  appliquerConfort(); saveGame(); renderConfortToggles(); renderAll();
});
document.getElementById('zoomToggleBtn').addEventListener('click', () => {
  const i = Math.max(0, ZOOMS_UI.indexOf(state.zoomUI));
  state.zoomUI = ZOOMS_UI[(i + 1) % ZOOMS_UI.length];
  appliquerConfort(); saveGame(); renderConfortToggles();
});
document.getElementById('volumeSlider').addEventListener('input', (e) => {
  state.soundVolume = parseInt(e.target.value, 10);
  document.getElementById('volumeValueLabel').textContent = state.soundVolume + '%';
  updateMusicVolume();
});
document.getElementById('volumeSlider').addEventListener('change', () => {
  saveGame();
  playTone(600, 0.06, 'sine', 0.04);
});
document.getElementById('creditsToggleBtn').addEventListener('click', () => {
  const panel = document.getElementById('creditsPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('langToggleBtn').addEventListener('click', () => {
  state.lang = state.lang === 'fr' ? 'en' : 'fr';
  applyStaticTranslations();
  saveGame(); renderAll();
});
document.getElementById('darkModeToggleBtn').addEventListener('click', () => {
  state.forceDarkMode = !state.forceDarkMode;
  saveGame(); renderStats(); renderDarkModeToggle();
});
document.getElementById('vacationToggleBtn').addEventListener('click', () => {
  state.vacationMode = !state.vacationMode;
  if (state.vacationMode && state.invasiveWeed) state.invasiveWeed = null;
  saveGame(); renderAll();
});
