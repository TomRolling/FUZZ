// Audit d'agencement (releve, pas un test) : partie avancee ou TOUT est a l'ecran en meme temps,
// capturee sur plusieurs tailles de fenetre. Pour chaque taille : captures, et liste des elements
// qui se chevauchent alors qu'ils ne devraient pas.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const sortie = path.join(__dirname, 'captures', 'agencement');

const TAILLES = [[1280, 820, 'reference'], [1024, 640, 'petite'], [1920, 1080, 'grande'], [1366, 620, 'basse']];

// Elements de l'ecran principal a surveiller (id ou selecteur -> nom lisible).
const ELEMENTS = {
  '.wordmark': 'titre FUZZ', '#weatherBadge': 'meteo', '#eventBadge': 'saison',
  '.statsRow': 'bulles chiffrees', '#nextPurchaseLabel': 'barre Prochain', '#nextGoalBox': 'objectif suivant',
  '#boostRow': 'bonus actifs', '.abilityBar': 'capacites', '#invasiveBox': 'visite de Papi',
  '.floatingButtonsTopRight': 'boutons haut droite', '#shopBtn': 'bouton magasin',
  '.companion': 'familier', '#toastContainer': 'notifications', '#dialogueBox': 'bulle de Papi', '.golden': 'herbe doree',
};

(async () => {
  fs.mkdirSync(sortie, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h, nom] of TAILLES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on('pageerror', e => console.log('  pageerror:', e.message));
    await p.goto(filePath);
    await p.evaluate(() => {
      window.saveGame = () => {};
      const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
        verdure: 4.2e12, knowledge: 1850, cosmicSeeds: 24, totalSeedsEarned: 60, prestigeCount: 7, totalAscensions: 2,
        stellarShards: 3, totalClicks: 5000, totalPlayTimeSec: 3e5 };
      for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
      st.buildings = Object.fromEntries(BUILDINGS.slice(0, 14).map((x, i) => [x.id, 100 - i * 5]));
      st.uniqueBuildings = Object.fromEntries(UNIQUE_BUILDINGS.slice(0, 5).map(u => [u.id, true]));
      st.familiers = { actif: 'grenouille', niveaux: { grenouille: 3 } };
      st.automation = { ...st.automation, abilities: false };
      st.activeCooldowns = { grelotVent: Date.now() + 8 * 60000 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    });
    await p.reload();
    await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await p.waitForTimeout(1500);
    // Tout a l'ecran : saison, visite de Papi, bonus, herbe doree, notifications, bulle de Papi.
    await p.evaluate(() => {
      hideDialogue(false);
      _evenementForce = 'noel';
      state.evenementsVus = { [`noel-${new Date().getFullYear()}`]: true };
      state.invasiveWeed = { active: true, needed: 5, done: 1 };
      startTimedBoost('golden', 2, 60000);
      startTimedBoost('click', 2, 60000);
      renderAll();
      for (let i = 0; i < 3; i++) showToast('Nouveau compagnon acheté : Escadrille de hérons ' + i);
      showDialogue('papi', ["Ce terrain a une histoire. Une longue histoire. Que tu ne connaîtras pas aujourd'hui."], { position: 'top-right' });
    });
    await p.waitForTimeout(1600);
    await p.screenshot({ path: path.join(sortie, `ecran-${nom}.png`) });

    const r = await p.evaluate((ELEMENTS) => {
      const boites = [];
      for (const [sel, nom] of Object.entries(ELEMENTS)) {
        const el = document.querySelector(sel);
        if (!el) { boites.push({ nom, absent: true }); continue; }
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') { boites.push({ nom, cache: true }); continue; }
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) { boites.push({ nom, vide: true }); continue; }
        boites.push({ nom, x: r.left, y: r.top, w: r.width, h: r.height,
          horsEcran: r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 });
      }
      const visibles = boites.filter(x => x.w);
      const chevauchements = [];
      for (let i = 0; i < visibles.length; i++) for (let j = i + 1; j < visibles.length; j++) {
        const a = visibles[i], c = visibles[j];
        const ix = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        const iy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ix > 4 && iy > 4) chevauchements.push(`${a.nom} / ${c.nom} (${Math.round(ix)}x${Math.round(iy)} px)`);
      }
      return { absents: boites.filter(x => x.absent || x.cache || x.vide).map(x => x.nom),
               horsEcran: visibles.filter(x => x.horsEcran).map(x => x.nom), chevauchements };
    }, ELEMENTS);
    console.log(`\n=== ${nom} (${w}x${h}) ===`);
    console.log('  non visibles  :', r.absents.join(', ') || '-');
    console.log('  hors ecran    :', r.horsEcran.join(', ') || '-');
    console.log('  chevauchements:');
    for (const c of r.chevauchements) console.log('    - ' + c);
    if (!r.chevauchements.length) console.log('    aucun');

    // Menus, a la taille de reference et a la plus petite.
    if (nom === 'reference' || nom === 'petite' || nom === 'basse') {
      await p.evaluate(() => { hideDialogue(false); state.invasiveWeed = null; renderAll(); });
      for (const [id, fichier, prep] of [
        ['shopPageOverlay', 'magasin', () => { openModal('shopPageOverlay'); activeShopTab = 'production'; }],
        ['settingsModalOverlay', 'options', () => { openModal('settingsModalOverlay'); activeSettingsTab = 'options'; }],
        ['questsModalOverlay', 'quetes', () => { openModal('questsModalOverlay'); activeQuestsTab = 'quetes'; }],
        ['achievementsModalOverlay', 'succes', () => openModal('achievementsModalOverlay')],
      ]) {
        await p.evaluate(`(${prep})()`);
        await p.evaluate(() => renderAll());
        await p.waitForTimeout(700);
        await p.screenshot({ path: path.join(sortie, `${fichier}-${nom}.png`) });
        await p.evaluate((id) => closeModal(id), id);
        await p.waitForTimeout(500);
      }
    }
    await p.close();
  }
  await b.close();
  console.log('\ncaptures dans', sortie);
})();
