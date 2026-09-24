// Audit d'ergonomie (releve, pas un test) : on joue le tout premier lancement comme un nouveau
// joueur, on note MOT POUR MOT ce que le jeu lui dit et ce qu'il lui demande de faire, puis on
// compare les menus entre eux (fermeture, onglets, libelles) pour reperer les incoherences.
// Sortie : un transcript du tutoriel + un tableau des menus + des captures dans tests/captures/ergonomie.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const SORTIE = path.join(__dirname, 'captures', 'ergonomie');

const etatEcran = (p) => p.evaluate(() => {
  const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const bulle = document.getElementById('dialogueBox');
  const nom = document.getElementById('dialogueName');
  const txt = document.getElementById('dialogueText');
  const designe = document.querySelector('.featureHighlight');
  const fleche = document.querySelector('.tutorialArrow, .miniTabArrow');
  const spot = document.querySelector('.tutorialSpotlight, .spotlightHole');
  return {
    bulleVisible: vis(bulle) || (typeof isDialogueVisible === 'function' && isDialogueVisible()),
    qui: nom ? (nom.textContent || '').trim() : '',
    dit: txt ? (txt.textContent || '').trim() : '',
    designe: designe ? (designe.id || designe.dataset.tabId || designe.className) : null,
    flecheVisible: vis(fleche),
    spotlightVisible: vis(spot),
    boutonsVisibles: ['shopBtn', 'questsBtn', 'achievementsBtn', 'settingsBtn'].filter(id => vis(document.getElementById(id))),
    onglets: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].filter(vis).map(b => (b.textContent || '').trim().slice(0, 18)),
    verdure: (document.getElementById('verdureCount') || {}).textContent,
    objectif: (document.getElementById('nextPurchaseLabel') || {}).textContent,
    menuOuvert: ['shopPageOverlay', 'settingsModalOverlay', 'questsModalOverlay', 'achievementsModalOverlay'].find(id => typeof isOverlayOpen === 'function' && isOverlayOpen(id)) || null,
  };
});

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch();

  // ================= 1. Le tout premier lancement, pas a pas =================
  console.log('=== 1. PREMIER LANCEMENT : ce que voit un joueur qui n a jamais joue ===\n');
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  await p.goto(filePath);
  await p.evaluate(() => { localStorage.clear(); window.saveGame = () => {}; });
  await p.reload();
  await p.waitForTimeout(1500);

  // Combien de temps le joueur attend-il avant de pouvoir faire quoi que ce soit ?
  const t0 = Date.now();
  await p.screenshot({ path: path.join(SORTIE, '00-demarrage.png') });
  const langueVue = await p.waitForFunction(() => {
    const l = document.getElementById('langPopupOverlay');
    return l && getComputedStyle(l).display === 'flex';
  }, { timeout: 25000 }).then(() => true).catch(() => false);
  const attenteLangue = Math.round((Date.now() - t0) / 100) / 10;
  console.log(`  [0] premier ecran interactif : ${langueVue ? 'choix de la langue' : '(aucun)'} apres ${attenteLangue} s d attente`);
  if (langueVue) {
    const choix = await p.evaluate(() => [...document.querySelectorAll('#langPopupOverlay button')].map(b => (b.textContent || '').trim()));
    console.log(`      propositions : ${choix.join(' | ')}`);
    await p.screenshot({ path: path.join(SORTIE, '01-choix-langue.png') });
    await p.locator('#langPopupOverlay button').first().click();   // vrai clic souris
    await p.waitForTimeout(1200);
  }
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(SORTIE, '02-apres-splash.png') });

  // On suit le tutoriel comme un joueur : on clique ce qui est designe, sinon la bulle.
  const transcript = [];
  let etape = 0, repliques = 0, clicsJoueur = 0, clicsJardin = 0;
  const noter = (source, qui, dit, e) => {
    if (!dit) return;
    const derniere = transcript[transcript.length - 1];
    if (derniere && derniere.dit === dit) return;
    // Effet machine a ecrire : la meme replique est captee en cours de frappe puis complete.
    // On remplace la version tronquee au lieu d'en ajouter une deuxieme.
    if (derniere && derniere.qui === qui && dit.startsWith(derniere.dit)) { derniere.dit = dit; return; }
    repliques++;
    transcript.push({ n: repliques, source, qui, dit, designe: e && e.designe, fleche: e && e.flecheVisible, spot: e && e.spotlightVisible, menu: e && e.menuOuvert });
  };
  for (; etape < 160; etape++) {
    const vu = await p.evaluate(() => {
      const t = (id) => { const e = document.getElementById(id); return e ? (e.textContent || '').trim().replace(/\s+/g, ' ') : ''; };
      const scene = document.getElementById('sceneOverlay');
      const tuto = document.getElementById('tutorialOverlay');
      return {
        scene: scene && scene.classList.contains('visible') ? { qui: t('sceneName'), dit: t('sceneText') } : null,
        tuto: tuto && getComputedStyle(tuto).display === 'flex' ? { qui: 'tutoriel', dit: t('tutorialOverlay').slice(0, 300) } : null,
      };
    });
    const e = await etatEcran(p);
    if (vu.scene) noter('scene', vu.scene.qui || 'scène', vu.scene.dit, e);
    else if (vu.tuto) noter('tutoriel', 'tutoriel', vu.tuto.dit, e);
    else if (e.bulleVisible && e.dit) noter('bulle', e.qui, e.dit, e);

    // On clique comme un joueur : la cible désignée d'abord, sinon ce qui est à l'écran.
    const cibles = ['.floatBtn.featureHighlight', '.drawerBtn.featureHighlight', '#tutorialCloseBtn', '#sceneOverlay.visible', '#dialogueBox'];
    let agi = false;
    for (const sel of cibles) {
      const el = p.locator(sel).first();
      if (await el.count() && await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 2000 }).then(() => { agi = true; clicsJoueur++; }).catch(() => {});
        if (agi) break;
      }
    }
    if (!agi) {
      const fini = await p.evaluate(() => !!state.tutorialSeen && !isDialogueVisible() && !_pendingSpotlightGroup);
      if (fini && clicsJardin > 12) break;
      await p.locator('#clickZone').click({ position: { x: 300, y: 300 } }).catch(() => {});
      clicsJardin++;
    }
    await p.waitForTimeout(240);
  }
  console.log(`  (${clicsJardin} clics sur le jardin pour faire avancer le jeu)`);
  console.log(`  ${repliques} repliques, ${clicsJoueur} clics demandes au joueur, ${etape} etapes parcourues\n`);
  console.log('  --- transcript ---');
  for (const t of transcript) {
    const reperes = [t.designe ? 'designe:' + String(t.designe).slice(0, 22) : null, t.fleche ? 'fleche' : null, t.spot ? 'halo' : null, t.menu ? 'dans ' + t.menu.replace('Overlay', '') : null].filter(Boolean).join(', ');
    console.log(`  ${String(t.n).padStart(2)}. [${(t.qui || '?').padEnd(14)}] ${t.dit.replace(/\s+/g, ' ').slice(0, 110)}`);
    if (reperes) console.log(`      (${reperes})`);
  }
  await p.screenshot({ path: path.join(SORTIE, '02-fin-tutoriel.png') });

  // Que sait faire le joueur a la sortie du tutoriel ?
  const apres = await etatEcran(p);
  console.log('\n  --- etat a la sortie du tutoriel ---');
  console.log(`  boutons visibles : ${apres.boutonsVisibles.join(', ') || 'aucun'}`);
  console.log(`  onglets du magasin : ${apres.onglets.join(' | ') || 'aucun (magasin ferme)'}`);
  console.log(`  objectif affiche : ${(apres.objectif || '(aucun)').slice(0, 80)}`);
  console.log(`  erreurs JS pendant tout le premier lancement : ${erreurs.length || 'aucune'}`);

  // ================= 2. Coherence des menus =================
  console.log('\n=== 2. COHERENCE DES MENUS ===\n');
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4e12, knowledge: 2000, cosmicSeeds: 30, totalSeedsEarned: 80, prestigeCount: 6,
      totalAscensions: 2, stellarShards: 5, totalClicks: 6000, totalPlayTimeSec: 3e5 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 14).map((x, i) => [x.id, 60 - i * 3]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 20000 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => hideDialogue(false));

  const menus = [
    ['Magasin', 'shopPageOverlay', 'shopBtn', 'shopPageCloseBtn'],
    ['Quetes', 'questsModalOverlay', 'questsBtn', 'questsModalCloseBtn'],
    ['Succes', 'achievementsModalOverlay', 'achievementsBtn', 'achievementsModalCloseBtn'],
    ['Parametres', 'settingsModalOverlay', 'settingsBtn', 'settingsModalCloseBtn'],
  ];
  console.log('  menu        | ouverture | bouton fermer      | Echap | clic exterieur | onglets');
  for (const [nom, ov, btn, fermer] of menus) {
    const r = await p.evaluate(async ([ov, btn, fermer]) => {
      const pause = (ms) => new Promise(r => setTimeout(r, ms));
      document.getElementById(btn).click(); await pause(400);
      const ouvert = isOverlayOpen(ov);
      const f = document.getElementById(fermer);
      const libelle = f ? (f.textContent || '').trim() : '(aucun)';
      const pos = f ? (() => { const r = f.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)}`; })() : '-';
      const onglets = [...document.querySelectorAll(`#${ov} .drawerBtn`)].map(x => (x.textContent || '').trim().replace(/\s+/g, ' '));
      // clic a l'exterieur
      const zone = document.getElementById(ov);
      zone.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await pause(400);
      const fermeParExterieur = !isOverlayOpen(ov);
      if (!fermeParExterieur) { /* on rouvre pas : il est deja ouvert */ }
      return { ouvert, libelle, pos, onglets, fermeParExterieur };
    }, [ov, btn, fermer]);
    // Echap
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const fermeParEchap = await p.evaluate((ov) => !isOverlayOpen(ov), ov);
    await p.evaluate((ov) => { if (isOverlayOpen(ov)) closeModal(ov); }, ov);
    await p.waitForTimeout(300);
    console.log(`  ${nom.padEnd(11)} | ${r.ouvert ? 'ok       ' : 'ECHEC    '} | ${r.libelle.padEnd(18)} | ${fermeParEchap ? 'oui  ' : 'NON  '} | ${r.fermeParExterieur ? 'oui           ' : 'non           '} | ${r.onglets.length}`);
  }

  // ================= 3. Combien de clics pour atteindre chaque onglet ? =================
  console.log('\n=== 3. CLICS DEPUIS L ECRAN PRINCIPAL ===\n');
  const chemins = await p.evaluate(async () => {
    const pause = (ms) => new Promise(r => setTimeout(r, ms));
    const out = [];
    for (const t of TAB_DEFS) {
      if (!state.tabsSeen[t.id]) continue;
      const ov = GROUP_TO_OVERLAY[t.group];
      const btn = GROUP_TO_FLOAT_BTN[t.group];
      for (const id of Object.values(GROUP_TO_OVERLAY)) if (isOverlayOpen(id)) closeModal(id);
      await pause(120);
      let clics = 0;
      if (btn) { document.getElementById(btn).click(); clics++; await pause(160); }
      const deja = (t.group === 'shop' ? activeShopTab : t.group === 'settings' ? activeSettingsTab : t.group === 'quests' ? activeQuestsTab : t.id) === t.id;
      if (!deja) clics++;
      out.push({ onglet: t.id, groupe: t.group, clics });
      for (const id of Object.values(GROUP_TO_OVERLAY)) if (isOverlayOpen(id)) closeModal(id);
      await pause(100);
    }
    return out;
  });
  const parGroupe = {};
  for (const c of chemins) (parGroupe[c.groupe] = parGroupe[c.groupe] || []).push(`${c.onglet} (${c.clics})`);
  for (const [g, l] of Object.entries(parGroupe)) console.log(`  ${g.padEnd(13)} ${l.join(', ')}`);

  // ================= 4. Captures de chaque menu =================
  console.log('\n=== 4. captures ===');
  for (const [nom, ov, btn] of menus) {
    await p.evaluate((b) => document.getElementById(b).click(), btn);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(SORTIE, `menu-${nom.toLowerCase()}.png`) });
    await p.evaluate((ov) => closeModal(ov), ov);
    await p.waitForTimeout(400);
  }
  for (const onglet of ['production', 'clic', 'batiments', 'special', 'recherche', 'prestige', 'ascension', 'familiers', 'automatisation']) {
    await p.evaluate((o) => { if (!isOverlayOpen('shopPageOverlay')) openModal('shopPageOverlay'); activeShopTab = o; renderAll(); }, onglet);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(SORTIE, `magasin-${onglet}.png`) });
  }
  await p.evaluate(() => closeModal('shopPageOverlay'));
  console.log(`  captures dans ${SORTIE}`);
  console.log(`\n  erreurs JS sur tout l audit : ${erreurs.length || 'aucune'}`);
  await b.close();
})();
