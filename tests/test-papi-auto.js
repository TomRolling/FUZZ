// Remarques spontanees de Papi : elles disparaissent seules (sans clic), la replique de fermeture
// ferme le jeu toute seule meme si une autre bulle etait affichee, les explications d'onglet
// restent au clic.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), totalClicks: 50 };
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);
  const bulle = () => p.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'));

  console.log('=== 1. remarque spontanee : part toute seule ===');
  const duree = await p.evaluate(() => { papiSaysFromCategory('randomUnrelated'); return _dialogueCurrentFullText.length * 20 + papiReadingPauseMs(_dialogueCurrentFullText); });
  verifie(await bulle(), 'la remarque ne s affiche pas');
  await p.waitForTimeout(duree + 800);
  verifie(!(await bulle()), 'la remarque est encore affichee sans clic apres', duree, 'ms');

  console.log('=== 1b. remarque cliquee pendant l ecriture : part quand meme toute seule ===');
  const duree1b = await p.evaluate(() => {
    papiSaysFromCategory('randomUnrelated');
    document.getElementById('dialogueBox').click(); // termine l'ecriture d'un coup
    return papiReadingPauseMs(_dialogueCurrentFullText);
  });
  await p.waitForTimeout(duree1b + 800);
  verifie(!(await bulle()), 'une remarque cliquee pendant l ecriture reste affichee');

  console.log('=== 2. fermeture du jeu : sans clic, meme avec une bulle deja affichee ===');
  const ferme = await p.evaluate(() => new Promise(resolve => {
    showDialogue('papi', ['Une annonce qui attend un clic.'], { position: 'top-right', blockAdvance: true });
    const t0 = Date.now();
    quitGameWithPapiLine(() => resolve(Date.now() - t0));
    setTimeout(() => resolve(-1), 15000);
  }));
  console.log('   fermeture apres', ferme, 'ms');
  verifie(ferme > 0, 'le jeu ne se ferme pas sans clic');

  console.log('=== 3. commentaire du magasin : part tout seul ===');
  const dureeMagasin = await p.evaluate(() => {
    openModal('shopPageOverlay');
    showShopComment('bigPurchase');
    return _shopCommentCurrentFullText.length * 20 + papiReadingPauseMs(_shopCommentCurrentFullText);
  });
  verifie(await p.evaluate(() => document.getElementById('shopComment').style.display === 'block'), 'le commentaire du magasin ne s affiche pas');
  await p.waitForTimeout(dureeMagasin + 800);
  verifie(await p.evaluate(() => document.getElementById('shopComment').style.display === 'none'), 'le commentaire du magasin reste affiche sans clic');

  console.log('=== 3b. bulle de Papi et commentaire du magasin en meme temps : aucun ne coupe l autre ===');
  const ensemble = await p.evaluate(() => {
    showDialogue('papi', ['Une bulle qui s ecrit pendant que Papi commente un achat dans le magasin.'], { position: 'top-right', autoAdvanceMs: 500 });
    showShopComment('bigPurchase');
    return Math.max(80 * 20 + 500, _shopCommentCurrentFullText.length * 20 + papiReadingPauseMs(_shopCommentCurrentFullText));
  });
  await p.waitForTimeout(ensemble + 1000);
  const fin = await p.evaluate(() => ({ bulle: document.getElementById('dialogueOverlay').classList.contains('visible'), commentaire: document.getElementById('shopComment').style.display, texte: document.getElementById('shopCommentText').textContent === _shopCommentCurrentFullText }));
  console.log('  ', JSON.stringify(fin));
  verifie(!fin.bulle && fin.commentaire === 'none', 'une des deux bulles est restee bloquee');

  console.log('=== 4. explication d onglet : reste au clic ===');
  await p.evaluate(() => { closeModal('shopPageOverlay'); showDialogue('papi', tabAnnouncementLines(TAB_DEFS.find(t => t.id === 'succes')), { position: 'top-right' }); });
  await p.waitForTimeout(9000);
  verifie(await bulle(), 'une explication d onglet est partie toute seule');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
