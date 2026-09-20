// Chasse aux textes non traduits : joue en anglais, ouvre tous les onglets et toutes les
// fenetres, et signale tout texte francais encore affiche. Complete scan-traduction.js
// (passe statique sur les tables bilingues).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

// Mots et signes qui ne peuvent pas apparaitre dans une interface anglaise correcte.
const MOTS_FR = ['le', 'la', 'les', 'des', 'une', 'du', 'tu', 'ton', 'ta', 'tes', 'vous', 'pour',
  'avec', 'sans', 'chaque', 'toutes', 'tous', 'quand', 'dans', 'sur', 'par', 'est', 'sont', 'plus',
  'clic', 'clics', 'jardin', 'graines', 'verdure', 'gagne', 'coute', 'niveau', 'fermer', 'valider',
  'annuler', 'oui', 'non', 'maintenant', 'bientot', 'encore', 'deja', 'aucun', 'aucune'];
// Noms propres et mots identiques dans les deux langues : ils ont le droit de rester tels quels.
const TOLERE = [/^papi feuillage$/i, /^leroy'?s?$/i, /^bramble$/i, /^fuzz$/i, /^production$/i,
  /^options?$/i, /^stats?$/i, /^prestige$/i, /^ascension$/i, /^[\d\s.,:%+×x/-]*$/];

function suspect(texte) {
  const t = texte.trim();
  if (!t || t.length < 2) return false;
  if (TOLERE.some(r => r.test(t))) return false;
  const sansAccent = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/[éèêëàâçùûîïôœÉÈÊÀÇÔ]/.test(t)) return true;
  const mots = sansAccent.toLowerCase().match(/[a-z']+/g) || [];
  return mots.some(m => MOTS_FR.includes(m));
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  // Partie avancee en anglais : tout est debloque, toutes les fenetres ont du contenu.
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, lang: 'en', langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4e12, knowledge: 5000, cosmicSeeds: 40, totalSeedsEarned: 200, seedsSinceAscension: 40,
      prestigeCount: 7, totalAscensions: 3, stellarShards: 8, totalShardsEarned: 12,
      totalClicks: 5000, totalPlayTimeSec: 96 * 3600 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 16).map((b, i) => [b.id, 120 - i * 6]));
    st.uniqueBuildings = Object.fromEntries(UNIQUE_BUILDINGS.slice(0, 6).map(u => [u.id, true]));
    st.clickUpgrades = Object.fromEntries(CLICK_UPGRADES.slice(0, 12).map(u => [u.id, true]));
    st.companionBuildings = Object.fromEntries(COMPANION_BUILDINGS.slice(0, 8).map(u => [u.id, true]));
    st.researchUpgrades = Object.fromEntries(RESEARCH.slice(0, 20).map(u => [u.id, true]));
    st.achievements = Object.fromEntries(ACHIEVEMENTS.slice(0, 16).map(a => [a.id, true]));
    st.familiers = { actif: 'grenouille', niveaux: { escargot: 4, grenouille: 3 } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1200);

  // Ramasse le texte visible, morceau par morceau, avec le chemin de l'element pour le retrouver.
  const ramasser = () => p.evaluate(() => {
    const out = [];
    const visible = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05; };
    const chemin = el => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) p.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')); return p.slice(-3).join(' > '); };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent.trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      let cache = false;
      for (let e = el; e && e !== document.body; e = e.parentElement) if (!visible(e)) { cache = true; break; }
      if (!cache) out.push([t, chemin(el)]);
    }
    return out;
  });

  const vus = new Map();
  const noter = async (ou) => { for (const [t, c] of await ramasser()) if (!vus.has(t)) vus.set(t, `${ou} (${c})`); };

  await noter('ecran principal');

  // Tous les onglets des quatre fenetres a onglets.
  const groupes = [['shop', 'shopPageOverlay', 'activeShopTab'], ['quests', 'questsModalOverlay', 'activeQuestsTab'],
    ['achievements', 'achievementsModalOverlay', null], ['settings', 'settingsModalOverlay', 'activeSettingsTab']];
  for (const [groupe, overlay, variable] of groupes) {
    const onglets = await p.evaluate(g => TAB_DEFS.filter(t => t.group === g).map(t => t.id), groupe);
    for (const onglet of onglets) {
      await p.evaluate(([overlay, variable, onglet]) => {
        for (const id of ['shopPageOverlay', 'questsModalOverlay', 'achievementsModalOverlay', 'settingsModalOverlay'])
          if (isOverlayOpen(id)) closeModal(id);
        openModal(overlay);
        if (variable) window[variable] = onglet;
        renderAll();
      }, [overlay, variable, onglet]);
      await p.waitForTimeout(250);
      await noter('onglet ' + onglet);
    }
  }

  // Fenetres a part, qui ne s'ouvrent pas toutes seules dans une partie de test.
  const aPart = [
    ['fenetre d absence', () => { state.lastSave = Date.now() - 3600 * 1000; applyOfflineProgress(); }],
    ['bonus du jour', () => { state.dailyLoginStreak = 3; showDailyLoginPopup(3, dailyRewardForDay(3)); }],
    ['nouvel objet', () => { showItemPopup({ title: tr('newItemTitle') || 'New', name: L(BUILDINGS[3], 'name'), desc: L(BUILDINGS[3], 'desc'), iconSrc: (ITEM_SPRITES[BUILDINGS[3].id] || {}).src }); }],
    ['galerie (image en grand)', () => { const c = document.querySelector('#tab-galerie .galleryItem'); if (c) c.click(); }],
    ['bulle de Papi', () => { papiSaysFromCategory('shop'); }],
    ['signalement de bug', () => { document.getElementById('bugReportBtn').click(); }],
  ];
  for (const [nom, action] of aPart) {
    const ok = await p.evaluate(src => { try { eval('(' + src + ')()'); return true; } catch (e) { return 'ERREUR ' + e.message; } }, action.toString());
    if (ok !== true) { console.log(`  (${nom} non testee : ${ok})`); continue; }
    await p.waitForTimeout(500);
    await noter(nom);
    await p.evaluate(() => { for (const id of ['offlineOverlay', 'dailyPopupOverlay', 'itemPopupOverlay', 'galleryLightboxOverlay', 'bugReportOverlay']) if (isOverlayOpen(id)) closeModal(id); hideDialogue(false); });
  }

  const douteux = [...vus.entries()].filter(([t]) => suspect(t));
  console.log(`\ntextes visibles ramasses : ${vus.size}`);
  if (douteux.length) {
    console.log(`\n${douteux.length} TEXTE(S) ENCORE EN FRANCAIS :`);
    for (const [t, ou] of douteux) console.log(`  - « ${t.slice(0, 110)} »  [${ou}]`);
    problems += douteux.length;
  }
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
