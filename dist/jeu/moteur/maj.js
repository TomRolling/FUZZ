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
