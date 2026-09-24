
const SAVE_VERSION = 2;
// Détecteur d'environnement, utilisé dès le chargement : déclaré dans le premier fichier.
function isTauriApp() { return typeof window !== 'undefined' && !!window.__TAURI__; }
// Version affichée du jeu. L'app native connaît la sienne (tauri.conf.json) mais la version web
// n'a aucun moyen de la lire : elle est donc écrite ici, et tests/check-tables.js vérifie que
// les deux restent d'accord. Sert au signalement de bug (voir rapportDeBug).
const VERSION_JEU = '0.7.0';
// Trois dernières erreurs JavaScript, gardées en mémoire pour le rapport de bug : sans elles, un
// signalement de joueur dit « ça a planté » et rien de plus. Jamais écrites sur le disque.
const _erreursRecentes = [];
function noterErreur(texte) {
  _erreursRecentes.push(String(texte).slice(0, 300));
  while (_erreursRecentes.length > 3) _erreursRecentes.shift();
}
window.addEventListener('error', (e) => noterErreur(`${e.message} (${String(e.filename || '').split('/').pop()}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => noterErreur('unhandled rejection: ' + ((e.reason && e.reason.message) || e.reason)));

