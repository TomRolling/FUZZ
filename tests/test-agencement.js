// Agencement : en fin de partie, avec tout le bandeau affiche (saison, objectif, visite de Papi,
// bonus actifs), la bulle de Papi ne doit rien recouvrir, a plusieurs tailles de fenetre ; et les
// onglets du magasin doivent former une grille de cases identiques, sans case trop etroite.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1280, 820], [1024, 640], [1366, 620], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => fail('pageerror:', e.message));
    await p.goto(filePath);
    await p.evaluate(() => {
      window.saveGame = () => {};
      const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
        verdure: 4.2e12, knowledge: 1850, cosmicSeeds: 24, totalSeedsEarned: 60, prestigeCount: 7, totalAscensions: 2,
        stellarShards: 3, totalClicks: 5000, totalPlayTimeSec: 3e5 };
      for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
      st.buildings = Object.fromEntries(BUILDINGS.slice(0, 14).map((x, i) => [x.id, 100 - i * 5]));
      localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    });
    await p.reload();
    await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(async () => {
      hideDialogue(false);
      _evenementForce = 'noel';
      state.evenementsVus = { [`noel-${new Date().getFullYear()}`]: true };
      state.invasiveWeed = { active: true, needed: 5, done: 1 };
      startTimedBoost('golden', 2, 60000); startTimedBoost('click', 2, 60000);
      renderAll();
      await new Promise(r => setTimeout(r, 300));
      showDialogue('papi', ["Ce terrain a une histoire. Une longue histoire. Que tu ne connaîtras pas aujourd'hui."], { position: 'top-right' });
      await new Promise(r => setTimeout(r, 600));
      const bulle = document.getElementById('dialogueBox').getBoundingClientRect();
      const touches = [];
      for (const [sel, nom] of [['#weatherBadge', 'meteo'], ['#eventBadge', 'saison'], ['.statsRow', 'bulles chiffrees'],
        ['#nextPurchaseLabel', 'barre Prochain'], ['#nextGoalBox', 'objectif'], ['#invasiveBox', 'visite de Papi'],
        ['#boostRow', 'bonus actifs'], ['.floatingButtonsTopRight', 'boutons']]) {
        const el = document.querySelector(sel);
        if (!el || !el.offsetParent) continue;
        const e = el.getBoundingClientRect();
        const ix = Math.min(bulle.right, e.right) - Math.max(bulle.left, e.left);
        const iy = Math.min(bulle.bottom, e.bottom) - Math.max(bulle.top, e.top);
        if (ix > 4 && iy > 4) touches.push(nom);
      }
      const dansLEcran = bulle.top >= 0 && bulle.bottom <= innerHeight && bulle.left >= 0 && bulle.right <= innerWidth;
      // Onglets du magasin.
      hideDialogue(false);
      openModal('shopPageOverlay'); renderAll();
      await new Promise(r => setTimeout(r, 500));
      const onglets = [...document.querySelectorAll('#shopTabsRow .drawerBtn')].map(b => b.getBoundingClientRect());
      const largeurs = [...new Set(onglets.map(o => Math.round(o.width)))];
      const coupes = [...document.querySelectorAll('#shopTabsRow .drawerBtn')].filter(b => b.scrollWidth > b.clientWidth + 1).length;
      const echelle = window._gameScale || 1;
      return { touches, dansLEcran, largeurs, coupes, largeurDessin: Math.round(onglets[0].width / echelle) };
    });
    console.log(`  ${w}x${h} : bulle sur ${r.touches.join(', ') || 'rien'} | onglets ${r.largeurs.join('/')} px (${r.largeurDessin} px de dessin), ${r.coupes} libelle(s) coupe(s)`);
    verifie(r.touches.length === 0, `${w}x${h} : la bulle de Papi recouvre ${r.touches.join(', ')}`);
    verifie(r.dansLEcran, `${w}x${h} : la bulle de Papi sort de l ecran`);
    verifie(r.largeurs.length === 1, `${w}x${h} : les onglets du magasin n ont pas tous la meme taille (${r.largeurs.join(', ')})`);
    verifie(r.largeurDessin >= 100, `${w}x${h} : onglets trop etroits (${r.largeurDessin} px)`);
    verifie(r.coupes === 0, `${w}x${h} : ${r.coupes} libelle(s) d onglet coupe(s)`);
    await p.close();
  }
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
