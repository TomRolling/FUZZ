// Une partie commencée sur n'importe quelle version publiée doit se reprendre dans le jeu actuel,
// sans rien perdre. C'est la panne la plus grave qu'un ajout puisse causer, et la plus discrète :
// un champ renommé ou une migration oubliée, et le joueur retrouve un jardin vide.
// Les sauvegardes de tests/sauvegardes-anciennes/ ont été écrites par leur propre version (voir
// generer-sauvegardes-anciennes.js). Pour chacune :
//  - elle se charge sans erreur, sans basculer sur la sauvegarde de secours ni repartir de zéro ;
//  - la progression est intacte : Prestiges, Graines, clics, compagnons, améliorations (celles qui
//    existent encore), Verdure (au moins autant : l'absence en rapporte) ;
//  - le jeu tourne ensuite normalement : magasin ouvert sur chaque onglet, quelques secondes de jeu ;
//  - la partie reprise se sauvegarde et se recharge à l'identique.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const { filePath, attendreDemarrage } = require('./commun');
const DOSSIER = path.join(__dirname, 'sauvegardes-anciennes');
let problems = 0;
const ok = (c, m, detail) => { console.log((c ? '  ok ' : '  X  ') + m + (!c && detail ? ' : ' + detail : '')); if (!c) problems++; };

const lire = (brut) => { try { return JSON.parse(brut); } catch (e) { return JSON.parse(Buffer.from(brut, 'base64').toString('utf8')); } };

(async () => {
  const fichiers = fs.existsSync(DOSSIER) ? fs.readdirSync(DOSSIER).filter(f => f.endsWith('.json')).sort() : [];
  ok(fichiers.length >= 5, `${fichiers.length} sauvegardes de versions publiées`);
  const b = await chromium.launch();
  for (const f of fichiers) {
    const { tag, cle, brut } = JSON.parse(fs.readFileSync(path.join(DOSSIER, f), 'utf8'));
    const attendu = lire(brut);
    console.log(`=== ${tag} (${cle}) ===`);
    const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
    const erreurs = [];
    p.on('pageerror', e => erreurs.push(e.message));
    // TEMOIN=1 : le chargement « perd » les compagnons de la sauvegarde ; chaque version doit échouer.
    if (process.env.TEMOIN) await p.addInitScript((cle) => {
      const lire = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) { const v = lire.call(this, k); if (k !== cle || !v) return v; try { const s = JSON.parse(v); s.buildings = {}; return JSON.stringify(s); } catch (e) { return v; } };
    }, cle);
    await p.goto(filePath);
    await p.evaluate(([cle, brut]) => { window.saveGame = () => {}; localStorage.clear(); localStorage.setItem(cle, brut); }, [cle, brut]);
    await p.reload();
    await attendreDemarrage(p);

    const repris = await p.evaluate(() => ({
      verdure: state.verdure, prestigeCount: state.prestigeCount, cosmicSeeds: state.cosmicSeeds, totalClicks: state.totalClicks,
      knowledge: state.knowledge, buildings: state.buildings, clickUpgrades: state.clickUpgrades, researchUpgrades: state.researchUpgrades,
      prestigeUpgrades: state.prestigeUpgrades, uniqueBuildings: state.uniqueBuildings, saveVersion: state.saveVersion, versionActuelle: SAVE_VERSION,
      existe: { b: BUILDINGS.map(x => x.id), c: CLICK_UPGRADES.map(x => x.id), r: RESEARCH.map(x => x.id), p: PRESTIGE_UPGRADES.map(x => x.id), u: UNIQUE_BUILDINGS.map(x => x.id) },
    }));
    const perdu = [];
    const egal = (nom, a, b) => { if (a !== undefined && a !== b) perdu.push(`${nom} ${a} → ${b}`); };
    egal('Prestiges', attendu.prestigeCount, repris.prestigeCount);
    egal('Graines', attendu.cosmicSeeds, repris.cosmicSeeds);
    egal('clics', attendu.totalClicks, repris.totalClicks);
    if (attendu.verdure !== undefined && !(repris.verdure >= attendu.verdure * 0.999)) perdu.push(`Verdure ${attendu.verdure} → ${repris.verdure}`);
    if (attendu.knowledge !== undefined && !(repris.knowledge >= attendu.knowledge)) perdu.push(`Connaissances ${attendu.knowledge} → ${repris.knowledge}`);
    for (const [id, n] of Object.entries(attendu.buildings || {})) if (repris.existe.b.includes(id)) egal('compagnon ' + id, n, repris.buildings[id]);
    for (const [champ, ids] of [['clickUpgrades', 'c'], ['researchUpgrades', 'r'], ['prestigeUpgrades', 'p'], ['uniqueBuildings', 'u']])
      for (const id of Object.keys(attendu[champ] || {})) if (attendu[champ][id] && repris.existe[ids].includes(id) && !repris[champ][id]) perdu.push(`${champ}.${id} perdu`);
    ok(!perdu.length, 'progression intacte', perdu.slice(0, 5).join(' ; '));
    ok(repris.saveVersion === repris.versionActuelle, `migrée jusqu'à la version de sauvegarde actuelle (${repris.saveVersion} / ${repris.versionActuelle})`);

    // Le jeu tourne : chaque onglet du magasin s'affiche, et quelques secondes de jeu passent.
    await p.evaluate(() => {
      // Les automatisations achètent toutes seules : la comparaison qui suit n'aurait plus de sens.
      state.automation = { ...state.automation, buyCompanions: false, abilities: false, prestige: false };
      hideDialogue(false); openModal('shopPageOverlay');
      for (const t of TAB_DEFS.filter(x => x.group === 'shop')) { activeShopTab = t.id; renderAll(); }
      closeModal('shopPageOverlay');
      for (let s = 0; s < 3; s++) tickJeu(); // trois secondes de jeu, sans les attendre
    });
    // Sauvegardée puis rechargée : la partie reprise ne change plus (la migration est faite une fois).
    const avant = await p.evaluate(() => { return JSON.stringify({ p: state.prestigeCount, g: state.cosmicSeeds, b: state.buildings }); });
    await p.evaluate(() => { saveGame(); });
    await p.reload();
    await attendreDemarrage(p);
    const apres = await p.evaluate(() => JSON.stringify({ p: state.prestigeCount, g: state.cosmicSeeds, b: state.buildings }));
    ok(apres === avant, 'resauvegardée puis rechargée à l\'identique', avant + ' => ' + apres);
    ok(!erreurs.length, 'aucune erreur JavaScript', erreurs.slice(0, 3).join(' | '));
    await p.close();
  }
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
