// Outils partagés par les tests. Chaque test les recopiait : un changement du démarrage ou de la
// sauvegarde demandait de retoucher des dizaines de fichiers, et une automatisation ajoutée au jeu
// restait active dans les parties préparées, où elle achetait toute seule pendant le test.
const path = require('path');

const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

// Le jeu a fini de démarrer : l'écran de lancement (logos) a disparu.
async function attendreDemarrage(p, timeout = 20000) {
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout });
}

// Prépare une partie et la recharge, comme un joueur qui rouvre le jeu : langue choisie, tutoriel
// vu, bonus du jour déjà pris, tous les onglets déjà présentés sauf `pasVus` (ou seulement ceux de
// `vus`, si la liste est donnée), et toutes les
// automatisations coupées (lues dans AUTOMATIONS : une automatisation ajoutée au jeu l'est d'office),
// sauf si `automatisations` est vrai. `etat` complète ou remplace ces valeurs. La page doit déjà
// être sur le jeu (goto). La sauvegarde de sortie est neutralisée : au rechargement, elle écrasait
// la partie préparée. `attendre: false` : ne pas attendre la fin du démarrage (une fenêtre de mise
// à jour, par exemple, le retient).
async function chargerPartie(p, etat = {}, { vus = null, pasVus = [], automatisations = false, attendre = true } = {}) {
  await p.evaluate(([etat, vus, pasVus, automatisations]) => {
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr() };
    st.tabsSeen = vus ? {} : { ...st.tabsSeen }; st.tabsDescribed = vus ? {} : { ...st.tabsDescribed };
    for (const t of TAB_DEFS) if (vus ? vus.includes(t.id) : !pasVus.includes(t.id)) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    if (!automatisations) st.automation = { ...st.automation, ...Object.fromEntries(AUTOMATIONS.map(a => [a.id, false])) };
    Object.assign(st, etat);
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  }, [etat, vus, pasVus, automatisations]);
  await p.reload();
  if (attendre) await attendreDemarrage(p);
}

// Fait défiler une scène (Papi en grand, introduction) jusqu'au bout, comme un joueur qui clique.
async function finirScene(p, max = 60) {
  for (let i = 0; i < max && await p.evaluate(() => sceneAffichee()); i++) {
    await p.evaluate(() => document.getElementById('sceneOverlay').click());
    await p.waitForTimeout(80);
  }
}

module.exports = { filePath, attendreDemarrage, chargerPartie, finirScene };
