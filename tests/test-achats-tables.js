// Chaque objet de chaque table d'achat, acheté comme le joueur l'achète : un clic sur sa ligne dans
// son onglet. Pour CHAQUE objet :
//  - sa ligne est affichée dans son onglet ;
//  - un poil moins que son prix ne l'achète pas, et la monnaie ne devient jamais négative ;
//  - son prix exact l'achète, et le prix payé est celui affiché sur la ligne ;
//  - l'achat change quelque chose de mesurable (production, clic, Connaissances, prix, Graines,
//    Éclats, hors-ligne, météo...), sauf les objets à effet propre, qui doivent alors être cités
//    par le moteur (un effet codé à part pour cet objet) ;
//  - après rechargement de la page, l'objet est toujours là.
// Un objet ajouté à une table est vérifié d'office : les listes viennent des tables du jeu.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const DIST = path.resolve(__dirname, '../dist');
const { filePath, chargerPartie, attendreDemarrage } = require('./commun');
let problems = 0;
const ok = (c, m, detail) => { console.log((c ? '  ok ' : '  X  ') + m + (!c && detail ? ' : ' + detail : '')); if (!c) problems++; };

// Le moteur (hors tables de contenu) cite-t-il cet identifiant ? C'est la marque d'un effet codé à
// part, pour un objet dont l'effet n'est pas un simple type d'amélioration.
const index = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const moteur = [...index.matchAll(/<script src="(jeu\/[^"]+\.js)"/g)].map(m => m[1]).filter(f => !f.startsWith('jeu/contenu/'))
  .map(f => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');
const citeParLeMoteur = (id) => new RegExp(`['"]${id}['"]`).test(moteur);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => ok(false, 'pageerror', e.message));
  await p.goto(filePath);
  // Partie où TOUT est visible (3 Ascensions) et où Papi a déjà tout présenté.
  await chargerPartie(p, { totalClicks: 1e5, totalPlayTimeSec: 1e6, prestigeCount: 30, totalAscensions: 3, totalSeedsEarned: 1e4,
    seedsSinceAscension: 1e4, totalShardsEarned: 50, reduireAnimations: true, buyMode: 1 });
  await p.waitForTimeout(800);

  const res = await p.evaluate(() => {
    hideDialogue(false);
    window.spawnGoldenWeed = () => {}; window.spawnButterflies = () => {};
    openModal('shopPageOverlay');
    // Tout ce qu'un achat peut changer. Un objet dont l'achat ne bouge aucune de ces valeurs n'a
    // d'effet mesurable nulle part.
    // Chaque composante À PART : dans une partie aussi avancée, un bonus sur le têtard ou sur la part
    // fixe du clic se noie dans le total, au-delà de la précision des nombres.
    const meteosNegatives = Object.keys(WEATHERS).filter(k => WEATHERS[k].negative);
    const meteoSous = (k) => { const avant = state.weather; state.weather = k; const v = weatherMultiplier(); state.weather = avant; return v; };
    const mesures = () => {
      const u = uniqueMultipliers();
      return [totalCps(), clickGain(), clickShopFlatMult(), totalClickCpsPercent(), totalClickFlatMultiplier(), knowledgeRate(),
        ...BUILDINGS.map(x => buildingCpsPerUnit(x)), buildingCost(BUILDINGS[5], 1), uniqueCostMult(), companionPriceMult(),
        verdureForSeeds(10), seedsForShards(5), u.prod, u.click, u.knowledge, u.invasiveRate,
        // Les valeurs que le jeu UTILISE, plafonds compris : mesurer l'agrégat avant son plafond
        // laissait croire utile une amélioration hors-ligne achetée au-delà des 100 %.
        efficaciteHorsLigne(), absenceCompteeMaxSec(), ...meteosNegatives.map(meteoSous),
        // Sans fonction à elles : leur agrégat est lu tel quel par le jeu.
        combinedUpgradeValue('questMult'), combinedUpgradeValue('startBonus')];
    };
    const tables = [
      { onglet: 'production', liste: '#shop', table: BUILDINGS, monnaie: 'verdure', prix: x => buildingCost(x, 1), possede: x => state.buildings[x.id] || 0, cumulable: true },
      { onglet: 'clic', liste: '#clickShop', table: CLICK_UPGRADES, monnaie: 'verdure', prix: x => x.cost, possede: x => hasClickUpgrade(x.id) },
      { onglet: 'batiments', liste: '#companionBuildingsShop', table: COMPANION_BUILDINGS, monnaie: 'verdure', prix: x => x.cost * uniqueCostMult(), possede: x => hasCompanionBuilding(x.id) },
      { onglet: 'special', liste: '#specialShop', table: UNIQUE_BUILDINGS, monnaie: 'verdure', prix: x => x.cost * uniqueCostMult(), possede: x => hasUnique(x.id) },
      { onglet: 'special', liste: '#skinsShop', table: SKINS.filter(s => s.cost > 0), monnaie: 'cosmicSeeds', prix: x => x.cost, possede: x => hasSkin(x.id), cosmetique: true },
      { onglet: 'recherche', liste: '#researchShop', table: RESEARCH, monnaie: 'knowledge', prix: x => x.cost, possede: x => hasResearch(x.id) },
      { onglet: 'recherche', liste: '#researchInfiniteShop', table: RESEARCH_INFINITE, monnaie: 'knowledge', prix: x => researchInfiniteCost(x), possede: x => state.researchInfiniteLevels[x.id] || 0, cumulable: true },
      { onglet: 'prestige', liste: '#prestigeShop', table: PRESTIGE_UPGRADES, monnaie: 'cosmicSeeds', prix: x => x.cost, possede: x => hasPrestigeUpgrade(x.id) },
      { onglet: 'ascension', liste: '#ascensionShop', table: ASCENSION_UPGRADES, monnaie: 'stellarShards', prix: x => x.cost, possede: x => hasAscensionUpgrade(x.id) },
    ];
    const rapport = [];
    for (const t of tables) {
      const r = { nom: t.onglet + ' ' + t.liste, n: t.table.length, achetes: [], absents: [], aCredit: [], mauvaisPrix: [], sansEffet: [], jamais: [] };
      let restants = [...t.table];
      // Plusieurs passes : un objet à prérequis s'achète au tour suivant.
      for (let passe = 0; passe < 8 && restants.length; passe++) {
        const suivants = [];
        for (const x of restants) {
          activeShopTab = t.onglet; renderAll();
          const ligne = document.querySelector(`${t.liste} [data-row-id="${CSS.escape(x.id)}"]`);
          if (!ligne) { if (passe === 0) r.absents.push(x.id); continue; }
          if (!ligne.onclick) { suivants.push(x); continue; } // verrouillé : prérequis pas encore acheté
          const avant = t.possede(x), prix = t.prix(x), affiche = (ligne.querySelector('.price') || ligne).textContent;
          // Un poil moins que le prix : rien ne s'achète.
          state[t.monnaie] = prix * (1 - 1e-6); renderAll();
          document.querySelector(`${t.liste} [data-row-id="${CSS.escape(x.id)}"]`).click();
          if (t.possede(x) !== avant || state[t.monnaie] < 0) r.aCredit.push(x.id);
          // Le prix exact : l'objet s'achète, pour ce prix-là.
          state[t.monnaie] = prix; renderAll();
          const m0 = mesures();
          document.querySelector(`${t.liste} [data-row-id="${CSS.escape(x.id)}"]`).click();
          if (t.possede(x) === avant) { r.jamais.push(x.id); continue; }
          r.achetes.push(x.id);
          const paye = prix - state[t.monnaie];
          if (Math.abs(paye - prix) > prix * 1e-9 || !affiche.includes(formatNum(prix))) r.mauvaisPrix.push(`${x.id} (affiché « ${affiche.trim()} », payé ${formatNum(paye)})`);
          const m1 = mesures();
          const change = m0.some((v, i) => Math.abs(v - m1[i]) > Math.abs(v) * 1e-12 + 1e-15);
          // Une capacité agit quand on l'active (vérifié juste en dessous), pas en étant possédée.
          if (!change && !t.cosmetique && !x.active) r.sansEffet.push(x.id);
          if (t.cosmetique) { selectSkin(x.id); if (state.activeSkin !== x.id) r.sansEffet.push(x.id + ' (ne se porte pas)'); }
          // Une capacité : le bouton Activer démarre sa recharge.
          if (x.active) { activateUniqueAbility(x.id); if (!(activeCooldownRemaining(x.id) > 0)) r.sansEffet.push(x.id + ' (Activer sans effet)'); }
        }
        restants = suivants;
      }
      r.jamais.push(...restants.map(x => x.id + ' (toujours verrouillé)'));
      rapport.push(r);
    }
    const possedes = tables.map(t => t.table.filter(x => t.possede(x)).map(x => t.onglet + ':' + x.id + '=' + t.possede(x)));
    saveGame();
    return { rapport, possedes: possedes.flat() };
  });

  for (const r of res.rapport) {
    console.log(`=== ${r.nom} : ${r.achetes.length} / ${r.n} achetés ===`);
    ok(!r.absents.length, 'chaque objet a sa ligne', r.absents.join(', '));
    ok(!r.jamais.length, 'chaque objet s\'achète', r.jamais.join(', '));
    ok(!r.aCredit.length, 'rien ne s\'achète à crédit', r.aCredit.join(', '));
    ok(!r.mauvaisPrix.length, 'le prix payé est le prix affiché', r.mauvaisPrix.slice(0, 4).join(' ; '));
    // Sans effet mesurable : acceptable seulement pour un objet dont le moteur code l'effet à part.
    const vraimentSansEffet = r.sansEffet.filter(id => / \(/.test(id) || !citeParLeMoteur(id));
    const aPart = r.sansEffet.filter(id => !vraimentSansEffet.includes(id));
    if (aPart.length) console.log('     (effet codé à part, vérifié par son propre test) :', aPart.join(', '));
    ok(!vraimentSansEffet.length, 'chaque achat a un effet', vraimentSansEffet.join(', '));
  }

  console.log('=== après rechargement ===');
  await p.reload();
  await attendreDemarrage(p);
  const perdus = await p.evaluate((liste) => {
    const niveau = { production: id => state.buildings[id] || 0, clic: id => hasClickUpgrade(id), batiments: id => hasCompanionBuilding(id),
      special: id => hasUnique(id) || hasSkin(id), recherche: id => hasResearch(id) || state.researchInfiniteLevels[id] || 0,
      prestige: id => hasPrestigeUpgrade(id), ascension: id => hasAscensionUpgrade(id) };
    return liste.map(e => { const [onglet, reste] = e.split(':'); const [id, v] = reste.split('='); const relu = String(niveau[onglet](id)); return relu === v ? null : `${e} relu ${relu}`; }).filter(Boolean);
  }, res.possedes);
  ok(res.possedes.length > 100 && !perdus.length, `les ${res.possedes.length} objets possédés sont toujours là`, perdus.slice(0, 5).join(', '));

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
