// Scenario du joueur qui laisse tourner le jeu : plusieurs onglets remplissent leurs conditions
// au meme instant. Chacun doit etre presente a son tour, jamais deux a la fois, et aucun onglet
// ne doit apparaitre sans que Papi l'ait presente.
// Deux lots se produisent chez tous les joueurs :
//   - Batiments + Quetes + Bonus du jour + Succes, quand on laisse tourner une demi-heure ;
//   - Familiers + Defi, au premier Prestige (et ceux-la sont dans DEUX fenetres differentes).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

// Deroule les presentations comme un joueur : clic sur le bouton designe, puis sur l'onglet
// designe, lecture du descriptif, fermeture. Renvoie l'ordre dans lequel ils ont ete presentes.
async function deroulerPresentations(p, etiquette) {
  const presentes = [];
  for (let etape = 0; etape < 16; etape++) {
    const quoi = await p.evaluate(() => ({
      bouton: ['shopBtn', 'questsBtn', 'achievementsBtn', 'settingsBtn']
        .find(id => document.getElementById(id).classList.contains('featureHighlight')),
      onglets: [...document.querySelectorAll('.drawerBtn.featureHighlight')].map(b => b.dataset.tabId),
    }));
    if (process.env.DEBUG_ONGLETS) console.log('    ', etiquette, etape, JSON.stringify(quoi));
    // La regle qui comptait : jamais deux choses designees en meme temps.
    verifie(quoi.onglets.length <= 1, `${etiquette} etape ${etape} : ${quoi.onglets.length} onglets designes a la fois (${quoi.onglets.join(',')})`);

    const lireDescriptif = async () => {
      for (let i = 0; i < 40; i++) {
        if (!await p.evaluate(() => isDialogueVisible())) break;
        await p.evaluate(() => document.getElementById('dialogueBox').click());
        await p.waitForTimeout(250);
      }
    };
    const fermerSiPlusRien = async () => {
      const encore = await p.evaluate(() => document.querySelectorAll('.drawerBtn.featureHighlight').length);
      if (!encore) {
        await p.evaluate(() => { for (const id of ['shopPageOverlay', 'questsModalOverlay', 'achievementsModalOverlay', 'settingsModalOverlay']) if (isOverlayOpen(id)) closeModal(id); });
        await p.waitForTimeout(1400);
      }
    };

    if (quoi.bouton) {
      await p.evaluate((id) => document.getElementById(id).click(), quoi.bouton);
      await p.waitForTimeout(800);
      // La fenetre des Succes n'a pas de mini-onglets : Papi decrit directement, il faut lire.
      const sansOnglets = await p.evaluate(() => document.querySelectorAll('.drawerBtn.featureHighlight').length === 0 && isDialogueVisible());
      if (sansOnglets) {
        presentes.push('succes');
        await lireDescriptif();
        await fermerSiPlusRien();
      }
      continue;
    }
    if (quoi.onglets.length === 1) {
      presentes.push(quoi.onglets[0]);
      await p.evaluate((id) => document.querySelector(`.drawerBtn[data-tab-id="${id}"]`).click(), quoi.onglets[0]);
      await p.waitForTimeout(500);
      await lireDescriptif();
      await p.waitForTimeout(700);
      await fermerSiPlusRien();
      continue;
    }
    // Rien de designe a cet instant : la presentation suivante peut arriver au tick d'apres.
    await p.waitForTimeout(1600);
    const reprise = await p.evaluate(() => ['shopBtn', 'questsBtn', 'achievementsBtn', 'settingsBtn']
      .some(id => document.getElementById(id).classList.contains('featureHighlight'))
      || document.querySelectorAll('.drawerBtn.featureHighlight').length > 0);
    if (!reprise) break;
  }
  return presentes;
}

const bilanOnglets = (p) => p.evaluate(() => {
  const silencieux = TAB_DEFS.filter(t => t.silent).map(t => t.id);
  const vus = TAB_DEFS.filter(t => state.tabsSeen[t.id]).map(t => t.id);
  return { vus, nonExpliques: vus.filter(id => !state.tabsDescribed[id] && !silencieux.includes(id)) };
});

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);

  // --- Lot 1 : le joueur a laisse tourner le jeu ---
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      totalClicks: 400, totalPlayTimeSec: 4000, verdure: seuilOnglet('batiments') * 1.2, totalEarned: 1e6,
      achievements: { a_click100: true } };
    st.tabsSeen = { production: true, clic: true, options: true, stats: true };
    st.tabsDescribed = { production: true, clic: true, options: true, stats: true };
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1500);

  const depart = await p.evaluate(() => ({
    vus: Object.keys(state.tabsSeen).filter(k => state.tabsSeen[k]),
    haloBoutons: ['shopBtn', 'questsBtn', 'achievementsBtn', 'settingsBtn'].filter(id => document.getElementById(id).classList.contains('featureHighlight')),
  }));
  console.log('  au demarrage :', depart.vus.join(','));
  verifie(!depart.vus.includes('recherche'), 'Recherche apparait alors que Batiments n est pas encore presente');
  verifie(depart.haloBoutons.length <= 1, 'plusieurs fenetres designees en meme temps :', depart.haloBoutons.join(','));

  const lot1 = await deroulerPresentations(p, 'lot1');
  console.log('  lot 1 :', lot1.join(' > '));
  for (const attendu of ['batiments', 'quetes', 'dailyreward', 'recherche']) {
    verifie(lot1.includes(attendu), `« ${attendu} » n a jamais ete presente`);
  }
  verifie(lot1.indexOf('recherche') > lot1.indexOf('batiments'), 'Recherche est presentee avant Batiments');
  const bilan1 = await bilanOnglets(p);
  verifie(bilan1.nonExpliques.length === 0, 'lot 1 : onglet(s) apparus sans presentation :', bilan1.nonExpliques.join(','));

  // --- Lot 2 : premier Prestige. Familiers (Magasin) et Defi (Quetes) tombent ensemble,
  // dans deux fenetres differentes.
  await p.evaluate(() => {
    state.prestigeCount = 1;
    state.totalSeedsEarned = 1;
    renderAll();
  });
  await p.waitForTimeout(1500);
  const lot2 = await deroulerPresentations(p, 'lot2');
  console.log('  lot 2 :', lot2.join(' > '));
  for (const attendu of ['familiers', 'defi']) {
    verifie(lot2.includes(attendu), `« ${attendu} » n a jamais ete presente apres le premier Prestige`);
  }
  const bilan2 = await bilanOnglets(p);
  verifie(bilan2.nonExpliques.length === 0, 'lot 2 : onglet(s) apparus sans presentation :', bilan2.nonExpliques.join(','));

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
