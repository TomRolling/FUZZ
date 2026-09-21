// ================= EXPORT / IMPORT / SHARE / RESET =================
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

// ================= HELPERS FICHIER & PRESSE-PAPIER (universels web + app native Tauri) =================
// Dans l'app native (Tauri), le trick <a download> du navigateur est bloqué par sécurité
// et ne montre aucune fenêtre "Enregistrer sous" — on utilise donc l'API native de Tauri
// quand elle est disponible (window.__TAURI__), sinon on retombe sur le comportement navigateur classique.

async function writeClipboardText(text) {
  if (isTauriApp() && window.__TAURI__.clipboardManager) {
    try { await window.__TAURI__.clipboardManager.writeText(text); return true; } catch(e) { console.error(e); }
  }
  try { await navigator.clipboard.writeText(text); return true; } catch(e) { return false; }
}

async function exportSaveFile(filename, text) {
  if (isTauriApp() && window.__TAURI__.dialog && window.__TAURI__.fs) {
    try {
      const path = await window.__TAURI__.dialog.save({
        defaultPath: filename,
        filters: [{ name: 'Sauvegarde FUZZ', extensions: ['txt'] }]
      });
      if (!path) return { ok: false, cancelled: true };
      await window.__TAURI__.fs.writeTextFile(path, text);
      return { ok: true, path };
    } catch (e) {
      console.error(e);
      return { ok: false, error: e };
    }
  }
  // Navigateur classique (site web / PWA) : téléchargement direct dans le dossier par défaut du navigateur.
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, path: null };
}

document.getElementById('exportBtn').addEventListener('click', async () => {
  const data = encodeSave();
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const filename = `fuzz-save-${stamp}.txt`;
  const result = await exportSaveFile(filename, data);
  if (result.cancelled) return; // le joueur a annulé la fenêtre "Enregistrer sous", pas d'erreur à afficher
  if (!result.ok) { showToast(selonLangue('❌ Échec de la sauvegarde du fichier.', '❌ Could not save the file.')); return; }
  await writeClipboardText(data);
  showToast(result.path
    ? selonLangue(`💾 Sauvegarde enregistrée : ${result.path}`, `💾 Save written to: ${result.path}`)
    : selonLangue('💾 Sauvegarde téléchargée (et copiée)', '💾 Save downloaded (and copied)'));
});

document.getElementById('copyCodeBtn').addEventListener('click', async () => {
  const data = encodeSave();
  const success = await writeClipboardText(data);
  if (success) {
    showToast(selonLangue('📋 Code de sauvegarde copié ! Colle-le sur ton autre appareil via "Importer (coller un code)".',
                          '📋 Save code copied! Paste it on your other device with "Import (paste a code)".'));
  } else {
    prompt(selonLangue('Copie ce code manuellement :', 'Copy this code manually:'), data);
  }
});
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});
document.getElementById('importFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(reader.result.trim()))));
      applyImportedData(parsed);
    } catch(err) { alert(selonLangue('Fichier de sauvegarde invalide.', 'Invalid save file.')); }
    e.target.value = '';
  };
  reader.readAsText(file);
});
document.getElementById('importPasteBtn').addEventListener('click', () => {
  const data = prompt(selonLangue('Colle ton code de sauvegarde :', 'Paste your save code:'));
  if (!data) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(data))));
    applyImportedData(parsed);
  } catch(e) { alert(selonLangue('Code de sauvegarde invalide.', 'Invalid save code.')); }
});
// Toutes les sauvegardes de secours disponibles, de la plus récente à la plus ancienne :
// la copie automatique des 5 minutes, puis une par jour.
function sauvegardesDisponibles() {
  const liste = [];
  const auto = localStorage.getItem(SAVE_KEY_BACKUP) || localStorage.getItem(LEGACY_SAVE_KEY_BACKUP);
  if (auto) liste.push({ id: 'auto', json: auto, ts: state.lastBackupTime || 0, auto: true });
  for (const e of lireRotation()) liste.push({ id: e.jour, json: e.json, ts: e.ts, auto: false });
  return liste;
}
// Résumé lisible d'une sauvegarde, sans la charger : date, Verdure gagnée, Prestiges.
function resumeSauvegarde(entree) {
  let s = {};
  try { s = JSON.parse(entree.json) || {}; } catch (e) { return null; }
  const d = new Date(entree.ts || s.lastSave || Date.now());
  const heure = d.toLocaleTimeString(state.lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
  const minuit = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const jours = Math.round((minuit(Date.now()) - minuit(d.getTime())) / 86400000);
  const quand = jours <= 0 ? tr('sauvAujourdhui') : jours === 1 ? tr('sauvHier') : selonLangue(`il y a ${jours} jours`, `${jours} days ago`);
  return {
    quand: `${quand} ${heure}`,
    detail: `${formatNum(s.totalEarned || 0)} ${tr('verdureWord')} · ${s.prestigeCount || 0} ${tr('prestigesWord')}`,
  };
}

let _signatureSauvegardes = null;
function renderSauvegardes() {
  const box = document.getElementById('backupList');
  if (!box) return;
  const liste = sauvegardesDisponibles();
  // renderAll tourne jusqu'à 60 fois par seconde : on ne relit les sauvegardes que si elles
  // ont bougé (analyser trois JSON à chaque image serait du gâchis pur).
  const signature = liste.map(e => e.id + ':' + e.ts).join('|') + '|' + state.lang + '|' + box.dataset.ouvert;
  if (signature === _signatureSauvegardes) return;
  _signatureSauvegardes = signature;
  if (box.dataset.ouvert !== '1') { box.innerHTML = ''; return; }
  if (!liste.length) { box.innerHTML = `<p class="tabIntro">${tr('sauvAucune')}</p>`; return; }
  box.innerHTML = liste.map(e => {
    const r = resumeSauvegarde(e);
    if (!r) return '';
    const etiquette = e.auto ? tr('sauvAuto') : r.quand;
    return `<div class="backupRow"><div><b>${etiquette}</b><div class="backupDetail">${r.detail}</div></div>` +
           `<button class="smallBtn" data-backup="${e.id}">${tr('sauvRestaurer')}</button></div>`;
  }).join('');
  box.querySelectorAll('[data-backup]').forEach(btn => {
    btn.onclick = () => restaurerSauvegarde(btn.dataset.backup);
  });
}
function restaurerSauvegarde(id) {
  const entree = sauvegardesDisponibles().find(e => e.id === id);
  if (!entree) return;
  const r = resumeSauvegarde(entree);
  const quand = entree.auto ? tr('sauvAuto') : (r ? r.quand : '');
  if (!confirm(selonLangue(
    `Restaurer la sauvegarde « ${quand} » ? Ta partie actuelle sera mise de côté (tu pourras y revenir).`,
    `Restore the save from "${quand}"? Your current game will be set aside (you can go back to it).`))) return;
  try { applyImportedData(JSON.parse(entree.json)); }
  catch (e) { alert(selonLangue('Cette sauvegarde est illisible.', 'This save cannot be read.')); }
}

// Visible seulement quand une partie a ete mise de cote par un import ou une restauration.
function renderUndoImportBtn() {
  const btn = document.getElementById('undoImportBtn');
  const visible = !!localStorage.getItem(SAVE_KEY_AVANT_IMPORT);
  if (btn && (btn.style.display === 'none') === visible) btn.style.display = visible ? '' : 'none';
}
document.getElementById('undoImportBtn').addEventListener('click', () => {
  const avant = localStorage.getItem(SAVE_KEY_AVANT_IMPORT);
  if (!avant) return;
  const en = state.lang === 'en';
  if (!confirm(en ? 'Go back to the game you had before the last import? Your current game will be replaced.'
                  : "Revenir à la partie que tu avais avant le dernier import ? Ta partie actuelle sera remplacée.")) return;
  try { applyImportedData(JSON.parse(avant), true); }
  catch (e) { alert(en ? 'That game could not be read.' : 'Impossible de relire cette partie.'); }
});
// Le bouton ouvre (ou referme) la liste : plusieurs sauvegardes coexistent, c'est au joueur
// de choisir laquelle il veut, en voyant ce qu'elle contient.
document.getElementById('restoreBackupBtn').addEventListener('click', () => {
  const box = document.getElementById('backupList');
  box.dataset.ouvert = box.dataset.ouvert === '1' ? '0' : '1';
  renderSauvegardes();
});
document.getElementById('shareBtn').addEventListener('click', async () => {
  const text = selonLangue(
    `🌱 FUZZ, mon jardin :\n` +
    `${formatNum(state.totalEarned)} Verdure gagnée\n` +
    `${state.cosmicSeeds} Graines Cosmiques\n` +
    `${state.prestigeCount} prestiges effectués\n` +
    `${Object.values(state.achievements||{}).length} succès débloqués`,
    `🌱 FUZZ, my garden:\n` +
    `${formatNum(state.totalEarned)} Greenery earned\n` +
    `${state.cosmicSeeds} Cosmic Seeds\n` +
    `${state.prestigeCount} prestiges done\n` +
    `${Object.values(state.achievements||{}).length} achievements unlocked`);
  await writeClipboardText(text);
  prompt(selonLangue('Copie ce texte pour le partager :', 'Copy this text to share it:'), text);
});

// ================= RESET TOTAL ET QUITTER =================
document.getElementById('resetBtn').addEventListener('click', () => {
  const confirmMsg = state.lang === 'en'
    ? 'Reset everything? All your progress is erased (Greenery, companions, Seeds, Shards, research, pets, achievements...). Only your settings (language, sound, theme, vacation mode) are kept. This cannot be undone.'
    : 'Tout remettre à zéro ? Toute ta progression est effacée (Verdure, compagnons, Graines, Éclats, recherches, familiers, succès...). Seuls tes paramètres (langue, son, thème, mode vacances) sont gardés. Action irréversible.';
  if (confirm(confirmMsg)) performFullReset();
});

// Réinitialisation complète : garde la langue déjà choisie (pas besoin de la redemander),
// fait un petit fondu vers noir, puis rejoue la séquence de lancement depuis après le choix
// de langue (vérification de MAJ puis scène d'ouverture), comme au tout premier lancement.
function performFullReset() {
  arreterPresentationsEnCours();
  // _suppressTabAnnouncements n'est normalement calculé qu'une fois, au chargement de la page
  // (!state.tutorialSeen à ce moment-là) — un reset ne recharge pas la page, donc sans cette
  // ligne il restait bloqué à sa valeur d'AVANT le reset. Pour un joueur qui avait déjà terminé
  // le tutoriel puis reset en cours de partie, ça valait déjà "false", ce qui faisait déclencher
  // DEUX annonces indépendantes pour les mêmes onglets de Paramètres juste après le reset (le
  // tick de jeu normal ET l'appel explicite programmé par tutorialCloseBtn) — d'où le bug
  // intermittent où Papi répétait/mélangeait ses présentations d'onglets après un reset.
  _suppressTabAnnouncements = true;
  // Les boutons flottants (Paramètres/Succès/Quêtes/Bonus quotidien/Magasin) ne perdent JAMAIS
  // leur classe "revealed"/"featureHighlight" toutes seules (elle n'est retirée qu'au clic sur
  // la cible, jamais réévaluée depuis l'état) — sans ce nettoyage explicite, ils restaient
  // débloqués à l'écran après un reset alors que la sauvegarde, elle, repartait bien à zéro.
  Object.values(GROUP_TO_FLOAT_BTN).forEach(id => {
    document.getElementById(id).classList.remove('revealed', 'featureHighlight');
  });
  const overlay = document.getElementById('splashOverlay');
  document.getElementById('splashSlideStudio').style.display = 'none';
  document.getElementById('splashSlideLogo').style.display = 'none';
  overlay.style.display = 'flex';
  overlay.classList.remove('hidden');
  setTimeout(() => {
    // Un reset total ne doit garder QUE les paramètres (langue, son, thème, mode vacances) —
    // tout le reste (progression, Graines, Éclats, familiers, onglets débloqués, skins, succès...)
    // repart à zéro.
    const preserved = {
      lang: state.lang,
      langChosen: state.langChosen,
      soundEnabled: state.soundEnabled,
      soundVolume: state.soundVolume,
      forceDarkMode: state.forceDarkMode,
      vacationMode: state.vacationMode,
    };
    // Rien de l'ancienne partie ne doit pouvoir revenir : sans ça, « Restaurer la sauvegarde de
    // secours » ou une ancienne clé d'avant le renommage la ramenaient.
    [SAVE_KEY_BACKUP, SAVE_KEY_AVANT_IMPORT, LEGACY_SAVE_KEY, LEGACY_SAVE_KEY_BACKUP].forEach(k => localStorage.removeItem(k));
    // Ce qui vit en mémoire hors de la sauvegarde (la page n'est pas rechargée) : bonus en cours,
    // vitesse du mode test, combo de clics, herbes dorées et papillons encore à l'écran.
    for (const k of Object.keys(_boosts)) delete _boosts[k];
    _vitesseTest = 1;
    _recentClickTimes = [];
    _lastClickTime = null;
    document.querySelectorAll('#gameViewport .golden').forEach(el => el.remove());
    const panneauTest = document.getElementById('modeTestPanel');
    if (panneauTest) panneauTest.remove();
    state = defaultState();
    Object.assign(state, preserved);
    saveGame();
    renderAll();
    proceedToUpdateCheck(() => {
      overlay.classList.add('hidden');
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    });
  }, 450);
}

// Affiche la réplique de départ de Papi (si l'écran principal n'est pas déjà occupé par autre
// chose) puis ferme, sans jamais obliger le joueur à cliquer dessus : le texte avance tout seul
// une fois lu (autoAdvanceMs, même mécanisme que les descriptifs d'onglets du tutoriel).
function quitGameWithPapiLine(doClose) {
  // Une bulle déjà affichée (remarque, annonce) passerait avant et attendrait un clic : on la
  // retire, le jeu se ferme de toute façon.
  hideDialogue(false);
  if (!papiSaysFromCategory('quitGame', { onComplete: doClose })) doClose();
}

document.getElementById('quitGameBtn').addEventListener('click', () => {
  if (isTauriApp() && window.__TAURI__.window) {
    const appWindow = window.__TAURI__.window.getCurrentWindow();
    // Referme d'abord la fenêtre Paramètres : sinon isMainScreenBlocked() la voit encore
    // ouverte et Papi ne dirait jamais rien avant que le jeu ne se ferme. Sauf si le tutoriel
    // d'introduction des Paramètres est justement en train de l'utiliser (spotlight/descriptif
    // pas encore terminés) : la fermer de force romprait son verrou partagé (_pendingSpotlightGroup)
    // et bloquerait le jeu sur une annonce fantôme — dans ce cas on laisse juste
    // isMainScreenBlocked() supprimer la réplique de Papi et fermer directement, comme d'habitude.
    if (_pendingSpotlightGroup !== 'settings') closeModal('settingsModalOverlay');
    quitGameWithPapiLine(() => appWindow.close());
  } else {
    showToast(state.lang === 'en' ? '🚪 This only works in the installed app.' : '🚪 Ça ne fonctionne que dans l\'application installée.');
  }
});
