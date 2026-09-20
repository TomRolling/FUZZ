// ================= EXPORT / IMPORT / SHARE / RESET =================
// ================= MISES À JOUR AUTOMATIQUES (app native uniquement) =================
// Invisible et sans effet sur la version web/PWA — seule l'app Tauri a accès à
// window.__TAURI__.updater. Le fichier latest.json consulté est généré et signé
// automatiquement par le workflow GitHub Actions à chaque nouvelle release taguée.
let _pendingUpdate = null;

function setUpdateProgressText(msg) {
  const optionsEl = document.getElementById('updateStatusText');
  if (optionsEl) optionsEl.textContent = msg;
  const modalEl = document.getElementById('updatePromptProgress');
  if (modalEl && document.getElementById('updatePromptOverlay').classList.contains('open')) {
    modalEl.style.display = 'block';
    modalEl.textContent = msg;
  }
}

let _updateFlowOnDone = null;
function showUpdatePromptModal(version, onDone) {
  _updateFlowOnDone = onDone || null;
  document.getElementById('updatePromptBody').textContent = state.lang === 'en'
    ? `Version v${version} of FUZZ is ready to install.`
    : `La version v${version} de FUZZ est prête à être installée.`;
  document.getElementById('updatePromptProgress').style.display = 'none';
  document.getElementById('updatePromptInstallBtn').disabled = false;
  document.getElementById('updatePromptInstallBtn').textContent = tr('updateNow');
  document.getElementById('updatePromptOverlay').classList.add('open');
}

async function initUpdateUI(onDone) {
  if (!isTauriApp() || !window.__TAURI__.updater) { if (onDone) onDone(); return; } // reste caché sur le web
  const card = document.getElementById('updateCard');
  card.style.display = 'flex';
  try {
    const version = await window.__TAURI__.app.getVersion();
    document.getElementById('currentVersionText').textContent = `(v${version})`;
  } catch (e) { /* pas bloquant si la version n'est pas lisible */ }
  refreshUpdateStatus(true, onDone);
}

async function refreshUpdateStatus(silent, onDone) {
  const statusEl = document.getElementById('updateStatusText');
  const en = state.lang === 'en';
  try {
    const update = await window.__TAURI__.updater.check();
    if (update && update.available) {
      _pendingUpdate = update;
      statusEl.textContent = en ? `🎉 New version available: v${update.version}` : `🎉 Nouvelle version disponible : v${update.version}`;
      document.getElementById('updateCheckBtn').textContent = en ? 'Install' : 'Installer';
      if (!silent) showToast(en ? `🎉 Version ${update.version} available!` : `🎉 Version ${update.version} disponible !`);
      else showUpdatePromptModal(update.version, onDone); // vérification silencieuse au lancement : on propose directement, onDone se déclenche à la fermeture
    } else {
      _pendingUpdate = null;
      statusEl.textContent = en ? "You're already on the latest version ✅" : 'Tu as déjà la dernière version ✅';
      document.getElementById('updateCheckBtn').textContent = tr('checkBtn');
      if (!silent) showToast(en ? "✅ You're already on the latest version." : '✅ Tu as déjà la dernière version.');
      else if (onDone) onDone();
    }
  } catch (e) {
    console.error(e);
    if (!silent) {
      statusEl.textContent = en ? 'Unable to check (no connection?)' : 'Impossible de vérifier (pas de connexion ?)';
      showToast(en ? '❌ Unable to check for updates.' : '❌ Impossible de vérifier les mises à jour.');
    } else if (onDone) onDone(); // ne bloque jamais le lancement à cause d'un souci réseau
  }
}

async function installPendingUpdate(skipConfirm) {
  if (!_pendingUpdate) { await refreshUpdateStatus(false); return; }
  if (!skipConfirm && !confirm(selonLangue(
    `Installer la mise à jour v${_pendingUpdate.version} ? L'app va redémarrer automatiquement une fois terminé. Ta sauvegarde n'est pas affectée.`,
    `Install update v${_pendingUpdate.version}? The app will restart automatically once it is done. Your save is not affected.`))) return;
  const btn = document.getElementById('updateCheckBtn');
  const modalBtn = document.getElementById('updatePromptInstallBtn');
  if (btn) btn.disabled = true;
  if (modalBtn) { modalBtn.disabled = true; modalBtn.textContent = selonLangue('Installation...', 'Installing...'); }
  try {
    let total = 0, downloaded = 0;
    await _pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') total = event.data.contentLength || 0;
      else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        setUpdateProgressText(total
          ? selonLangue(`Téléchargement... ${Math.round(downloaded / total * 100)}%`, `Downloading... ${Math.round(downloaded / total * 100)}%`)
          : selonLangue('Téléchargement...', 'Downloading...'));
      } else if (event.event === 'Finished') {
        setUpdateProgressText(selonLangue('Installation terminée, redémarrage...', 'Install complete, restarting...'));
      }
    });
    await window.__TAURI__.process.relaunch();
  } catch (e) {
    console.error(e);
    setUpdateProgressText(selonLangue("Échec de l'installation.", 'Install failed.'));
    showToast(selonLangue('❌ Échec de la mise à jour.', '❌ Update failed.'));
    if (btn) btn.disabled = false;
    if (modalBtn) { modalBtn.disabled = false; modalBtn.textContent = selonLangue('Réessayer', 'Try again'); }
  }
}

document.getElementById('updatePromptInstallBtn').addEventListener('click', () => installPendingUpdate(true));
document.getElementById('updatePromptLaterBtn').addEventListener('click', () => {
  document.getElementById('updatePromptOverlay').classList.remove('open');
  if (_updateFlowOnDone) { const fn = _updateFlowOnDone; _updateFlowOnDone = null; fn(); }
});

document.getElementById('updateCheckBtn').addEventListener('click', () => {
  if (_pendingUpdate) installPendingUpdate();
  else refreshUpdateStatus(false);
});

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

function encodeSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
// Import (fichier, code collé, sauvegarde de secours) : la partie importée est enregistrée, puis la
// page est rechargée. Le démarrage normal reconstruit alors tout (boutons révélés, annonces de
// Papi, bonus et minuteurs en mémoire), exactement comme au lancement : rien de l'ancienne partie
// ne reste à l'écran. (La sauvegarde faite en quittant la page réécrit la même partie importée.)
//
// La partie remplacee est mise de cote dans SAVE_KEY_AVANT_IMPORT, un emplacement que le jeu ne
// touche jamais tout seul : la sauvegarde de secours, elle, est rafraichie toutes les 5 minutes et
// recevait aussitot la partie importee, si bien qu'un mauvais import faisait perdre la partie d'avant.
// `revenir` : c'est justement cette partie mise de cote qu'on remet en place (bouton « Revenir... »).
function applyImportedData(parsed, revenir) {
  if (revenir) localStorage.removeItem(SAVE_KEY_AVANT_IMPORT);
  else localStorage.setItem(SAVE_KEY_AVANT_IMPORT, JSON.stringify(state));
  applyLoadedState(parsed);
  saveGame();
  try { sessionStorage.setItem(IMPORT_TOAST_FLAG, '1'); } catch (e) {}
  location.reload();
}

