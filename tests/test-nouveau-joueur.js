// Ce qu'un nouveau joueur voit doit toujours etre actionnable :
//  1. avant l'ouverture du magasin, la barre « Prochain » montre le vrai objectif (ouvrir le
//     magasin) et pas des compagnons qu'il est impossible d'acheter ;
//  2. aucun onglet n'est presente entierement grise : Batiments et Special apparaissent quand
//     leur premier objet est abordable, et Recherche arrive avec de quoi faire une recherche.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

async function partie(b, etat) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate((etat) => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), ...etat };
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  }, etat);
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(700);
  return p;
}

(async () => {
  const b = await chromium.launch();

  // 1. La barre avant le magasin.
  for (const clics of [0, 120, 199]) {
    const p = await partie(b, { totalClicks: clics, verdure: clics, totalEarned: clics });
    const barre = await p.evaluate(() => ({
      texte: document.getElementById('nextPurchaseLabel').textContent,
      magasin: getComputedStyle(document.getElementById('shopBtn')).display !== 'none',
    }));
    console.log(`  ${clics} clics :`, barre.texte);
    verifie(!barre.magasin, `${clics} clics : le magasin est deja la`);
    verifie(/magasin/i.test(barre.texte) && barre.texte.includes(`${clics} / `),
      `${clics} clics : la barre ne montre pas l objectif du magasin (« ${barre.texte} »)`);
    await p.close();
  }

  // 2. Production et Clic, a l'ouverture du magasin : ce que le joueur a en poche (un clic = une
  // Verdure au depart) doit suffire pour au moins un achat dans CHACUN des deux onglets.
  {
    const p = await partie(b, { totalClicks: 200, verdure: 200, totalEarned: 200 });
    const r = await p.evaluate(() => ({
      production: BUILDINGS.filter(x => buildingCost(x, 1) <= state.verdure).length,
      clic: CLICK_UPGRADES.filter(x => !x.requires && x.cost <= state.verdure).length,
    }));
    console.log(`  magasin a 200 clics : ${r.production} compagnon(s) et ${r.clic} amelioration(s) de clic achetables`);
    verifie(r.production >= 1, 'Production s ouvre sans compagnon achetable');
    verifie(r.clic >= 1, 'Clic s ouvre sans amelioration achetable');
    await p.close();
  }

  // 2a. Batiments et Special : au seuil d'apparition, au moins un objet est achetable.
  for (const [onglet, table, prix] of [['batiments', 'COMPANION_BUILDINGS', 'cost'], ['special', 'UNIQUE_BUILDINGS', 'cost']]) {
    const p = await partie(b, { totalClicks: 500 });
    const r = await p.evaluate(([onglet, table, prix]) => {
      const seuil = seuilOnglet(onglet);
      state.verdure = seuil;
      const debloque = TAB_DEFS.find(t => t.id === onglet).unlock(state);
      const abordables = eval(table).filter(x => !x.requires && x[prix] <= state.verdure).length;
      return { seuil, debloque, abordables };
    }, [onglet, table, prix]);
    console.log(`  ${onglet} : apparait a ${r.seuil}, ${r.abordables} objet(s) achetable(s) a ce moment`);
    verifie(r.debloque, `${onglet} n apparait pas a son propre seuil`);
    verifie(r.abordables >= 1, `${onglet} apparait sans aucun objet achetable`);
    await p.close();
  }

  // 2b. Recherche : de quoi faire la premiere recherche des l'ouverture.
  const p = await partie(b, {
    totalClicks: 500, totalPlayTimeSec: 1900, verdure: 1e5, knowledge: 0,
    tabsSeen: { production: true, clic: true, batiments: true, options: true, stats: true },
    tabsDescribed: { production: true, clic: true, batiments: true, options: true, stats: true },
  });
  const r = await p.evaluate(async () => {
    hideDialogue(false);
    verifierNouveauxOnglets();
    await new Promise(r => setTimeout(r, 300));
    const prix = prixPremiereRecherche();
    return { vue: !!state.tabsSeen.recherche, connaissances: state.knowledge, prix,
             achetable: RESEARCH.filter(x => !x.requires && x.cost <= state.knowledge).length };
  });
  console.log(`  recherche : ouverte=${r.vue}, ${r.connaissances} Connaissances pour une premiere recherche a ${r.prix}`);
  verifie(r.vue, 'l onglet Recherche ne s ouvre pas');
  verifie(r.achetable >= 1, 'Recherche s ouvre sans aucune recherche achetable');
  await p.close();

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
