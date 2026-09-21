// ================= SIGNALEMENT DE BUG =================
// Un joueur qui tombe sur un bug n'a sous la main ni sa version, ni son environnement, ni l'état
// de sa partie : le rapport est donc rempli d'avance. Il est montré tel quel, modifiable, avant
// tout envoi — rien ne part sans que le joueur l'ait lu. Le bouton « Copier » sert à ceux qui
// n'ont pas de compte GitHub : le rapport se colle aussi bien ailleurs.
const DEPOT_GITHUB = 'https://github.com/TomRolling/FUZZ';
function environnementJoueur() {
  const systeme = navigator.platform || navigator.userAgent;
  return isTauriApp()
    ? selonLangue(`application installée, ${systeme}`, `installed app, ${systeme}`)
    : selonLangue(`version web, ${navigator.userAgent}`, `web version, ${navigator.userAgent}`);
}
function rapportDeBug() {
  const onglets = TAB_DEFS.filter(t => state.tabsSeen[t.id]).map(t => t.id).join(', ') || '-';
  const compagnons = Object.values(state.buildings || {}).reduce((s, n) => s + (n || 0), 0);
  const heures = Math.round((state.totalPlayTimeSec || 0) / 360) / 10;
  const erreurs = _erreursRecentes.length ? _erreursRecentes.join(' | ') : selonLangue('aucune', 'none');
  const technique = [
    `FUZZ v${VERSION_JEU} (${environnementJoueur()})`,
    `${selonLangue('Langue', 'Language')} : ${state.lang} | ${selonLangue('sauvegarde', 'save')} v${state.saveVersion || SAVE_VERSION} | ${selonLangue('temps de jeu', 'play time')} : ${heures} h`,
    `${selonLangue('Verdure', 'Greenery')} : ${formatNum(state.verdure)} (${formatNum(totalCps())}/s) | ${selonLangue('Connaissances', 'Knowledge')} : ${formatNum(state.knowledge || 0)}`,
    `${selonLangue('Prestiges', 'Prestiges')} : ${state.prestigeCount || 0} | ${selonLangue('Ascensions', 'Ascensions')} : ${state.totalAscensions || 0} | ${selonLangue('Graines', 'Seeds')} : ${state.cosmicSeeds || 0} | ${selonLangue('Éclats', 'Shards')} : ${state.stellarShards || 0}`,
    `${selonLangue('Compagnons', 'Companions')} : ${compagnons} | ${selonLangue('Onglets ouverts', 'Tabs unlocked')} : ${onglets}`,
    `${selonLangue('Erreurs récentes', 'Recent errors')} : ${erreurs}`,
  ].join('\n');
  return selonLangue(
    `### Ce qui s'est passé\n(raconte ici ce que tu faisais et ce qui n'allait pas)\n\n### Informations techniques\n${technique}\n`,
    `### What happened\n(describe here what you were doing and what went wrong)\n\n### Technical details\n${technique}\n`);
}
// L'app native n'ouvre pas les liens toute seule : elle passe par le plugin « opener ». S'il
// manque (ancienne version installée), le joueur ne reste pas sans rien — l'adresse part dans le
// presse-papiers.
async function ouvrirLienExterne(url) {
  if (isTauriApp()) {
    const T = window.__TAURI__;
    // Deux chemins vers le même plugin : l'API globale quand elle est injectée, sinon l'appel
    // direct à sa commande. Si les deux échouent, c'est que l'application tourne sans le plugin
    // « opener » (binaire construit avant son ajout) — le presse-papiers prend alors le relais.
    try {
      if (T.opener && T.opener.openUrl) { await T.opener.openUrl(url); return true; }
      const invoke = (T.core && T.core.invoke) || (window.__TAURI_INTERNALS__ || {}).invoke;
      if (invoke) { await invoke('plugin:opener|open_url', { url }); return true; }
    } catch (e) { console.error('ouverture du lien impossible :', e); }
    await writeClipboardText(url);
    showToast(selonLangue('Adresse copiée : colle-la dans ton navigateur.', 'Link copied: paste it into your browser.'));
    return false;
  }
  window.open(url, '_blank', 'noopener');
  return true;
}
function lienSignalement(rapport) {
  return `${DEPOT_GITHUB}/issues/new?title=${encodeURIComponent(selonLangue('Bug : ', 'Bug: '))}&body=${encodeURIComponent(rapport)}`;
}
document.getElementById('bugReportBtn').addEventListener('click', () => {
  document.getElementById('bugReportText').value = rapportDeBug();
  document.getElementById('bugReportOverlay').style.display = 'flex';
});
document.getElementById('bugReportOpenBtn').addEventListener('click', () => {
  ouvrirLienExterne(lienSignalement(document.getElementById('bugReportText').value));
});
document.getElementById('bugReportCopyBtn').addEventListener('click', async () => {
  const ok = await writeClipboardText(document.getElementById('bugReportText').value);
  showToast(ok ? selonLangue('Rapport copié.', 'Report copied.') : selonLangue('Copie impossible : sélectionne le texte à la main.', 'Copy failed: select the text by hand.'));
});
document.getElementById('bugReportCloseBtn').addEventListener('click', () => fermerSurgissante('bugReportOverlay'));
