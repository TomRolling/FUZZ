// Mode test « Tout debloquer » : doit marcher a tout moment (scene d'ouverture, juste apres le
// tutoriel, pendant une annonce de Papi, apres un reset total).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

async function demarrer(b, etat) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate((etat) => { window.saveGame = () => {}; const st = { ...state, langChosen: true, lastDailyLoginDate: todayStr(), ...etat }; localStorage.setItem(SAVE_KEY, JSON.stringify(st)); }, etat);
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  return p;
}

async function toutDebloquer(p) {
  // Meme chemin que le bouton du panneau (voir basculerModeTest).
  await p.evaluate(() => {
    basculerModeTest();
    const i = MODE_TEST_ACTIONS.findIndex(g => g[0].includes('Étapes'));
    const j = MODE_TEST_ACTIONS[i][1].findIndex(x => x[0] === 'Tout débloquer');
    document.querySelector(`#modeTestPanel [data-mt="${i}-${j}"]`).click();
    basculerModeTest();
  });
  await p.waitForTimeout(2500); // laisse le temps a une annonce ou une scene de revenir
}

async function controle(p, cas) {
  const r = await p.evaluate(() => {
    const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
    const r = {
      boutons: ['shopBtn', 'settingsBtn', 'achievementsBtn', 'questsBtn'].filter(vis).length,
      scene: document.getElementById('sceneOverlay').classList.contains('visible'),
      tuto: document.getElementById('tutorialOverlay').style.display === 'flex',
      spotlight: _pendingSpotlightGroup, bulle: document.getElementById('dialogueOverlay').classList.contains('visible'),
    };
    if (isOverlayOpen('shopPageOverlay')) closeModal('shopPageOverlay');
    openModal('shopPageOverlay'); renderAll();
    r.ongletsMagasin = document.querySelectorAll('#shopTabsRow [data-tab-id]:not([disabled])').length;
    const cible = document.querySelector('#shopTabsRow [data-tab-id="ascension"]');
    if (cible) cible.click();
    renderAll();
    r.ongletActif = activeShopTab;
    r.fenetreOuverte = isOverlayOpen('shopPageOverlay');
    return r;
  });
  console.log('  ', cas, JSON.stringify(r));
  const nbMagasin = await p.evaluate(() => TAB_DEFS.filter(t => t.group === 'shop').length);
  verifie(r.boutons === 4, cas, ': les 4 boutons doivent etre visibles');
  verifie(!r.scene && !r.tuto, cas, ': la scene d ouverture / le tutoriel doivent etre fermes');
  verifie(!r.spotlight && !r.bulle, cas, ': aucune annonce de Papi ne doit rester en cours');
  verifie(r.ongletsMagasin === nbMagasin, cas, `: ${nbMagasin} onglets de magasin attendus`);
  verifie(r.ongletActif === 'ascension' && r.fenetreOuverte, cas, ': les onglets du magasin doivent etre cliquables');
}

(async () => {
  const b = await chromium.launch();

  console.log('=== A. pendant la scene d ouverture (nouvelle partie) ===');
  let p = await demarrer(b, { tutorialSeen: false });
  await p.waitForTimeout(1500);
  await toutDebloquer(p); await controle(p, 'A'); await p.close();

  console.log('=== B. juste apres le tutoriel, aucun clic ===');
  p = await demarrer(b, { tutorialSeen: true });
  await p.waitForTimeout(800);
  await toutDebloquer(p); await controle(p, 'B'); await p.close();

  console.log('=== C. pendant l annonce du magasin par Papi ===');
  p = await demarrer(b, { tutorialSeen: true, totalClicks: 200 });
  const annonce = await p.waitForFunction(() => !!_pendingSpotlightGroup, { timeout: 8000 }).then(() => true, () => false);
  console.log('   annonce en cours avant :', annonce);
  await toutDebloquer(p); await controle(p, 'C'); await p.close();

  console.log('=== D. apres un reset total ===');
  p = await demarrer(b, { tutorialSeen: true, totalClicks: 500 });
  await p.evaluate(() => performFullReset());
  await p.waitForTimeout(2500);
  await toutDebloquer(p); await controle(p, 'D'); await p.close();

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
