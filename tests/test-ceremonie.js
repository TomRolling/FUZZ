// Prestige et Ascension : panneau de décision (à la place de confirm()), cérémonie, bilan.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const ok = (c, m) => { console.log((c ? '  ok ' : '  X  ') + m); if (!c) problems++; };

async function partie(b, extra = {}) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => { console.log('  pageerror:', e.message); problems++; });
  await p.goto(filePath);
  await p.evaluate((extra) => {
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), totalClicks: 5000, prestigeCount: 1,
      cosmicSeeds: 4, totalSeedsEarned: 4, seedsSinceAscension: 4, ...extra };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = { stagiaire: 40, voisin: 20 };
    window.saveGame = () => {}; localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  }, extra);
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 20000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    hideDialogue(false);
    window.confirm = () => { window.__confirmAppele = true; return true; }; // ne doit plus jamais servir
    state.verdure = verdureForSeeds(3) * 1.01; state.totalEarned = state.verdure;
    openModal('shopPageOverlay'); activeShopTab = 'prestige'; renderAll();
  });
  await p.waitForTimeout(400);
  return p;
}
const CAPT = path.resolve(__dirname, 'captures');
// Après une cérémonie on est sur l'écran principal : le joueur rouvre le magasin pour recommencer.
async function rouvrirMagasin(p, onglet = 'prestige') {
  await p.evaluate((onglet) => { hideDialogue(false); openModal('shopPageOverlay'); activeShopTab = onglet; renderAll(); }, onglet);
  await p.waitForTimeout(450);
}
// De quoi faire un Prestige, magasin rouvert, bouton puis « Terraformer ».
async function relancerPrestige(p) {
  await p.evaluate(() => { state.verdure = verdureForSeeds(2) * 1.01; renderAll(); });
  await rouvrirMagasin(p);
  await p.click('#prestigeBtn'); await p.waitForTimeout(300);
  await p.click('#decisionConfirmerBtn');
}

(async () => {
  const b = await chromium.launch();

  console.log('=== 1. le bouton ouvre le panneau, plus la fenetre systeme ===');
  let p = await partie(b);
  await p.click('#prestigeBtn');
  await p.waitForTimeout(400);
  const pan = await p.evaluate(() => ({
    ouvert: document.getElementById('decisionOverlay').style.display === 'flex', confirm: !!window.__confirmAppele,
    titre: document.getElementById('decisionTitre').textContent, bouton: document.getElementById('decisionConfirmerBtn').textContent,
    gagne: document.getElementById('decisionGagne').textContent, garde: document.getElementById('decisionGarde').textContent,
    perd: document.getElementById('decisionPerd').textContent,
    attendu: { gain: prestigeGainAmount(), avant: trimZeros(seedMultiplierPour(state.seedsSinceAscension)) },
  }));
  console.log('  ', JSON.stringify({ titre: pan.titre, gagne: pan.gagne }));
  ok(pan.ouvert && !pan.confirm, 'le panneau s ouvre, confirm() n est pas appele');
  ok(pan.gagne.includes('+' + pan.attendu.gain + ' Graines Cosmiques'), 'le gain en Graines est annonce, accorde au pluriel');
  ok(pan.gagne.includes('×' + pan.attendu.avant) && pan.gagne.includes('→'), 'le bonus des Graines est annonce avant -> apres');
  ok(/Recherche/.test(pan.garde) && /Connaissances/.test(pan.garde) && /Verdure/.test(pan.perd) && /Production/.test(pan.perd), 'ce qu on garde et ce qui repart de zero sont listes');
  ok(pan.bouton === 'Terraformer', 'le bouton dit Terraformer');
  await p.screenshot({ path: CAPT + '/ceremonie-1-panneau-prestige.png' });

  console.log('=== 2. « Pas encore » et Echap n abiment rien ===');
  const avant = await p.evaluate(() => ({ n: state.prestigeCount, v: state.verdure }));
  await p.click('#decisionAnnulerBtn'); await p.waitForTimeout(500);
  const annule = await p.evaluate(() => ({ n: state.prestigeCount, v: state.verdure, ouvert: decisionOuverte(), affiche: document.getElementById('decisionOverlay').style.display }));
  ok(annule.n === avant.n && annule.v >= avant.v && !annule.ouvert && annule.affiche === 'none', 'Pas encore : panneau ferme, rien n a change');
  await p.click('#prestigeBtn'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !decisionOuverte() && state.prestigeCount === 1), 'Echap ferme le panneau sans terraformer');

  console.log('=== 3. automatisation en pause pendant que le panneau est ouvert ===');
  await p.click('#prestigeBtn'); await p.waitForTimeout(300);
  const auto = await p.evaluate(() => { state.automation = { ...state.automation, prestige: true, prestigeSeeds: 1 };
    const t = window.automationOn; window.automationOn = (k) => k === 'prestige' ? true : t(k);
    runAutomations(); runAutomations(); window.automationOn = t; state.automation.prestige = false; return state.prestigeCount; });
  ok(auto === 1, 'aucun Prestige automatique pendant la lecture du panneau (compte : ' + auto + ')');

  console.log('=== 4. la ceremonie : le Prestige a lieu quand la vague couvre l ecran ===');
  await p.click('#decisionConfirmerBtn'); await p.waitForTimeout(150);
  const debut = await p.evaluate(() => ({ ceremonie: ceremonieEnCours(), ouverte: document.getElementById('ceremonieOverlay').style.display === 'flex', n: state.prestigeCount, bloque: isMainScreenBlocked() }));
  ok(debut.ceremonie && debut.ouverte && debut.n === 1, 'la vague monte, la partie n est pas encore remise a zero');
  ok(debut.bloque, 'l ecran est bloque (ni herbe doree ni Papi par-dessus)');
  await p.waitForTimeout(350); await p.screenshot({ path: CAPT + '/ceremonie-2-vague.png' });
  await p.waitForTimeout(1600);
  const fin = await p.evaluate(() => ({ n: state.prestigeCount, compagnons: Object.keys(state.buildings).length,
    bilan: document.getElementById('ceremonieBilan').classList.contains('visible'), titre: document.getElementById('ceremonieTitre').textContent,
    lignes: document.getElementById('ceremonieLignes').textContent }));
  console.log('  ', JSON.stringify({ titre: fin.titre, lignes: fin.lignes }));
  ok(fin.n === 2 && fin.compagnons === 0, 'le Prestige a eu lieu (compteur 2, compagnons remis a zero)');
  ok(fin.bilan && /Terraformation réussie/.test(fin.titre) && /\+3 Graines Cosmiques/.test(fin.lignes) && /→/.test(fin.lignes), 'le bilan annonce le gain et le nouveau bonus');
  await p.screenshot({ path: CAPT + '/ceremonie-3-bilan-prestige.png' });
  await p.mouse.click(640, 700); await p.waitForTimeout(600);
  const ferme = await p.evaluate(() => ({ ceremonie: ceremonieEnCours(), ouverte: document.getElementById('ceremonieOverlay').style.display === 'flex',
    magasin: isOverlayOpen('shopPageOverlay'), papi: isDialogueVisible() || _pendingPapiCategories.includes('prestige') }));
  ok(!ferme.ceremonie && !ferme.ouverte, 'un clic referme le bilan');
  ok(!ferme.magasin, 'apres la vague, on est sur l ecran principal et non plus dans le magasin');
  ok(ferme.papi, 'Papi reagit juste apres la ceremonie');
  await p.screenshot({ path: CAPT + '/ceremonie-3b-retour-jardin.png' });

  console.log('=== 5. un clic passe la sequence ===');
  await relancerPrestige(p); await p.waitForTimeout(80);
  await p.mouse.click(640, 400); await p.waitForTimeout(250);
  const saut = await p.evaluate(() => ({ n: state.prestigeCount, bilan: document.getElementById('ceremonieBilan').classList.contains('visible') }));
  ok(saut.n === 3 && saut.bilan, 'passee d un clic : le Prestige a bien eu lieu et le bilan est la');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !ceremonieEnCours()), 'Echap referme le bilan');

  console.log('=== 6. version courte une fois la ceremonie connue ===');
  await relancerPrestige(p); await p.waitForTimeout(50);
  const duree = await p.evaluate(() => document.getElementById('ceremonieOverlay').style.getPropertyValue('--ceremonie-couvre'));
  ok(duree === '380ms', 'apres 3 Prestiges, la vague est plus rapide (' + duree + ')');
  await p.waitForTimeout(1500); await p.mouse.click(640, 700); await p.waitForTimeout(500);

  console.log('=== 7. Prestige automatique : ni panneau ni ceremonie ===');
  const a = await p.evaluate(() => { state.verdure = verdureForSeeds(2) * 1.01; const n = state.prestigeCount; doPrestige();
    return { fait: state.prestigeCount === n + 1, panneau: decisionOuverte(), ceremonie: ceremonieEnCours() }; });
  ok(a.fait && !a.panneau && !a.ceremonie, 'doPrestige() (automatisation) terraforme directement');
  await p.close();

  console.log('=== 8. defi en cours : le panneau le dit ===');
  p = await partie(b, { challengeActive: 'minimaliste', prestigeCount: 3 });
  await p.click('#prestigeBtn'); await p.waitForTimeout(300);
  const defi = await p.evaluate(() => ({ texte: document.getElementById('decisionDefi').textContent, classe: document.getElementById('decisionDefi').className }));
  console.log('  ', defi.texte);
  ok(/défi/.test(defi.texte) && /(reussi|rate)/.test(defi.classe), 'l etat du defi est annonce dans le panneau');
  await p.close();

  console.log('=== 9. Ascension : panneau, ciel etoile, bilan ===');
  p = await partie(b, { cosmicSeeds: 40, totalSeedsEarned: 60, seedsSinceAscension: 60, prestigeUpgrades: { p_prod1: true } });
  await p.evaluate(() => { activeShopTab = 'ascension'; renderAll(); });
  await p.waitForTimeout(300);
  await p.click('#ascensionBtn'); await p.waitForTimeout(400);
  const asc = await p.evaluate(() => ({ titre: document.getElementById('decisionTitre').textContent, gagne: document.getElementById('decisionGagne').textContent,
    perd: document.getElementById('decisionPerd').textContent, bouton: document.getElementById('decisionConfirmerBtn').textContent, confirm: !!window.__confirmAppele }));
  console.log('  ', JSON.stringify({ gagne: asc.gagne, perd: asc.perd }));
  ok(/Ascensionner/.test(asc.titre) && asc.bouton === 'Ascensionner' && !asc.confirm, 'panneau d Ascension, sans confirm()');
  ok(/Éclat/.test(asc.gagne) && /Graines de chaque Prestige/.test(asc.gagne), 'gain en Eclats et effet sur les Graines annonces');
  ok(/40 Graines Cosmiques/.test(asc.perd) && /1 amélioration de Prestige/.test(asc.perd), 'les Graines et l amelioration perdues sont chiffrees');
  await p.screenshot({ path: CAPT + '/ceremonie-4-panneau-ascension.png' });
  await p.click('#decisionConfirmerBtn'); await p.waitForTimeout(1300);
  await p.screenshot({ path: CAPT + '/ceremonie-5-ciel-ascension.png' });
  await p.waitForTimeout(1600);
  const ascFin = await p.evaluate(() => ({ n: state.totalAscensions, graines: state.cosmicSeeds, titre: document.getElementById('ceremonieTitre').textContent, magasin: isOverlayOpen('shopPageOverlay') }));
  ok(ascFin.n === 1 && ascFin.graines === 0 && /Ascension réussie/.test(ascFin.titre), 'l Ascension a eu lieu et le bilan est affiche');
  ok(!ascFin.magasin, 'apres l Ascension aussi, on est sur l ecran principal');
  await p.screenshot({ path: CAPT + '/ceremonie-6-bilan-ascension.png' });
  await p.close();

  console.log('=== 10. animations reduites : directement le bilan ===');
  p = await partie(b, { reduireAnimations: true });
  await p.click('#prestigeBtn'); await p.waitForTimeout(300);
  await p.click('#decisionConfirmerBtn'); await p.waitForTimeout(400);
  const red = await p.evaluate(() => ({ n: state.prestigeCount, bilan: document.getElementById('ceremonieBilan').classList.contains('visible') }));
  ok(red.n === 2 && red.bilan, 'Prestige fait et bilan affiche sans attendre de sequence');
  await p.close();

  console.log('=== 11. en anglais ===');
  p = await partie(b, { lang: 'en' });
  await p.click('#prestigeBtn'); await p.waitForTimeout(300);
  const en = await p.evaluate(() => ({ titre: document.getElementById('decisionTitre').textContent, bouton: document.getElementById('decisionConfirmerBtn').textContent,
    annuler: document.getElementById('decisionAnnulerBtn').textContent, gagne: document.getElementById('decisionGagne').textContent,
    colonnes: [...document.querySelectorAll('.decisionColTitre')].map(e => e.textContent).join(' | ') }));
  console.log('  ', JSON.stringify(en));
  ok(/Terraform the garden/.test(en.titre) && en.bouton === 'Terraform' && en.annuler === 'Not yet' && /Cosmic Seeds/.test(en.gagne) && /You gain/.test(en.colonnes), 'tout le panneau est en anglais');
  await p.close();

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
