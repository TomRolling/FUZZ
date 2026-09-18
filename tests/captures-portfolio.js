// Captures pour le portfolio (rangees dans docs/portfolio/).
// Meme partie de reference que captures-readme.js, mais plus de scenes et en 2x pour un site.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const sortie = path.resolve(__dirname, '../docs/portfolio');

(async () => {
  fs.mkdirSync(sortie, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4.2e12, knowledge: 1850, cosmicSeeds: 24, totalSeedsEarned: 60, seedsSinceAscension: 44,
      prestigeCount: 7, totalAscensions: 2, stellarShards: 3, totalShardsEarned: 5, totalPlayTimeSec: 96 * 3600 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 14).map((b, i) => [b.id, 120 - i * 7]));
    st.uniqueBuildings = Object.fromEntries(UNIQUE_BUILDINGS.slice(0, 5).map(u => [u.id, true]));
    st.clickUpgrades = Object.fromEntries(CLICK_UPGRADES.slice(0, 10).map(u => [u.id, true]));
    st.companionBuildings = Object.fromEntries(COMPANION_BUILDINGS.slice(0, 7).map(u => [u.id, true]));
    st.researchUpgrades = Object.fromEntries(RESEARCH.slice(0, 18).map(u => [u.id, true]));
    st.achievements = Object.fromEntries(ACHIEVEMENTS.slice(0, 14).map(a => [a.id, true]));
    st.familiers = { actif: 'grenouille', niveaux: { escargot: 4, grenouille: 3 } };
    st.automation = { ...st.automation, abilities: false, buyCompanions: false };
    st.activeCooldowns = { grelotVent: Date.now() + 8 * 60000, tamtamCrapauds: Date.now() + 95 * 1000 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(2500);

  const prise = async (nom, prepare, attente = 700) => {
    await p.evaluate(prepare);
    await p.waitForTimeout(attente);
    await p.screenshot({ path: path.join(sortie, nom + '.png') });
    console.log('  ecrit :', nom + '.png');
  };

  // Dans le magasin, la colonne de gauche porte encore le cadre « illustration a integrer ».
  // On y met ce qu'elle affiche vraiment en jeu : Papi qui commente pendant qu'on achete.
  const commentaire = (texte) => {
    document.getElementById('shopImagePlaceholder').querySelector('span[data-i18n]').style.display = 'none';
    const box = document.getElementById('shopComment');
    box.style.display = 'block';
    document.getElementById('shopCommentName').textContent = charName('papi');
    const t = document.getElementById('shopCommentText');
    stopTypewriter(t);
    t.textContent = texte;
    t.removeAttribute('data-reste');
    clearTimeout(_shopCommentTimer);
  };

  await prise('02-magasin', () => {
    openModal('shopPageOverlay'); activeShopTab = 'production'; renderAll();
  }, 900);
  await p.evaluate(commentaire, "Tu as dépensé de l'argent ? Sur ce terrain ? Ça alors.");
  await prise('02-magasin', () => {}, 400);

  await prise('03-recherche', () => { activeShopTab = 'recherche'; renderAll(); });
  await prise('04-ascension', () => { activeShopTab = 'ascension'; renderAll(); });
  await prise('05-familiers', () => { activeShopTab = 'familiers'; renderAll(); });
  await prise('06-succes', () => {
    closeModal('shopPageOverlay');
    openModal('achievementsModalOverlay');
    renderAll();
  }, 900);

  // Papi qui commente : c'est le personnage, il doit apparaitre quelque part.
  await prise('07-papi', () => {
    closeModal('achievementsModalOverlay');
    hideDialogue(false);
    showDialogue('papi', ["Mon petit-fils, propriétaire terrien. Qui l'aurait cru."], { position: 'top-right' });
    renderAll();
  }, 1400);

  // Une saison, pour montrer que le jeu change avec le calendrier.
  await prise('08-halloween', () => {
    hideDialogue(false);
    state.evenementsVus = { [`halloween-${new Date().getFullYear()}`]: true };
    _evenementForce = 'halloween';
    renderAll();
    spawnGoldenWeed();
  }, 1400);

  // L'ecran principal en dernier : le decor du jeu depend de l'avancement, et le theme vert du
  // milieu de partie est bien plus parlant que le bleu pale de la toute fin.
  await prise('01-jeu', () => {
    hideDialogue(false);
    for (const id of ['shopPageOverlay', 'settingsModalOverlay', 'achievementsModalOverlay', 'questsModalOverlay']) if (isOverlayOpen(id)) closeModal(id);
    _evenementForce = null;
    state.buildings.satellite = 0; state.buildings.mars = 0; // sinon on bascule sur le theme de fin
    state.prestigeCount = 3;
    startTimedBoost('golden', 2, 22000);
    document.querySelectorAll('.golden').forEach(e => e.remove()); // citrouille restee de la scene d'Halloween
    renderAll();
    spawnGoldenWeed();
  }, 1200);

  await b.close();
  console.log('captures ecrites dans docs/portfolio/');
})();
