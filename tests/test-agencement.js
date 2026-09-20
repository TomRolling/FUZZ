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
      renderAll();
      await new Promise(r => setTimeout(r, 300));
      // La bulle s'affiche d'ABORD, bandeau reduit ; la banniere et les bonus arrivent ensuite,
      // comme en vraie partie. Elle doit redescendre toute seule.
      showDialogue('papi', ["Ce terrain a une histoire. Une longue histoire. Que tu ne connaîtras pas aujourd'hui."], { position: 'top-right' });
      await new Promise(r => setTimeout(r, 600));
      const hautInitial = document.getElementById('dialogueBox').getBoundingClientRect().top;
      state.invasiveWeed = { active: true, needed: 5, done: 1 };
      startTimedBoost('golden', 2, 60000); startTimedBoost('click', 2, 60000);
      renderAll();
      await new Promise(r => setTimeout(r, 700));
      const bulleSuit = document.getElementById('dialogueBox').getBoundingClientRect().top > hautInitial + 4;
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
      // Rangees d'onglets : magasin, parametres, quetes.
      hideDialogue(false);
      const echelle = window._gameScale || 1;
      const rangees = {};
      for (const [nom, ov, sel] of [['magasin', 'shopPageOverlay', '#shopTabsRow'],
        ['parametres', 'settingsModalOverlay', '#settingsTabsRow'], ['quetes', 'questsModalOverlay', '#questsTabsRow']]) {
        openModal(ov); renderAll();
        await new Promise(r => setTimeout(r, 450));
        const bs = [...document.querySelectorAll(`${sel} .drawerBtn`)];
        rangees[nom] = {
          largeurs: [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().width)))],
          coupes: bs.filter(b => b.scrollWidth > b.clientWidth + 1).length,
          largeurDessin: Math.round(bs[0].getBoundingClientRect().width / echelle),
        };
        closeModal(ov);
        await new Promise(r => setTimeout(r, 300));
      }
      return { touches, dansLEcran, bulleSuit, rangees };
    });
    console.log(`  ${w}x${h} : bulle sur ${r.touches.join(', ') || 'rien'}, suit le bandeau : ${r.bulleSuit ? 'oui' : 'NON'}`);
    for (const [nom, d] of Object.entries(r.rangees)) {
      console.log(`      onglets ${nom.padEnd(10)} : ${d.largeurs.join('/')} px (${d.largeurDessin} px de dessin), ${d.coupes} libelle(s) coupe(s)`);
    }
    verifie(r.touches.length === 0, `${w}x${h} : la bulle de Papi recouvre ${r.touches.join(', ')}`);
    verifie(r.dansLEcran, `${w}x${h} : la bulle de Papi sort de l ecran`);
    verifie(r.bulleSuit, `${w}x${h} : la bulle ne se replace pas quand le bandeau grandit pendant qu elle est affichee`);
    for (const [nom, d] of Object.entries(r.rangees)) {
      verifie(d.largeurs.length === 1, `${w}x${h} : les onglets ${nom} n ont pas tous la meme taille (${d.largeurs.join(', ')})`);
      verifie(d.largeurDessin >= 125, `${w}x${h} : onglets ${nom} trop etroits (${d.largeurDessin} px)`);
      verifie(d.coupes === 0, `${w}x${h} : ${d.coupes} libelle(s) coupe(s) dans les onglets ${nom}`);
    }
    await p.close();
  }
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
