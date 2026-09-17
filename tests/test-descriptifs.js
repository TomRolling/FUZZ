// Le descriptif d'un onglet est un etat DERIVE (tabsSeen && !tabsDescribed), plus une file en
// memoire. Ce test couvre les trois comportements que cette file assurait :
//   1. un onglet revele mais jamais explique (jeu ferme entre l'annonce et le descriptif)
//      recoit bien son explication au rechargement ;
//   2. recliquer le mini-onglet pendant la lecture n'empile pas une seconde lecture ;
//   3. une fois lu, il ne se rejoue plus.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    state.tabsSeen = { options: true, stats: true, production: true, clic: true };
    state.tabsDescribed = { options: true, stats: true, clic: true };
    state.totalClicks = 200; saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('shopBtn').click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-tab-id="production"]').click());
  await page.waitForTimeout(900);

  const rattrape = await page.evaluate(() => ({
    bulle: isDialogueVisible(),
    texte: document.getElementById('dialogueText').textContent.slice(0, 45),
  }));
  console.log('  descriptif rattrape :', JSON.stringify(rattrape));
  if (!rattrape.bulle) fail('onglet revele mais jamais explique : Papi ne rattrape pas le descriptif');

  await page.evaluate(() => document.querySelector('[data-tab-id="production"]').click());
  await page.waitForTimeout(300);
  const file = await page.evaluate(() => ({ enFile: _dialogueCallQueue.length, enCours: _descriptionEnCours }));
  console.log('  file d appels       :', JSON.stringify(file));
  if (file.enFile !== 0) fail('un second descriptif a ete empile par le double clic :', file.enFile);
  if (file.enCours !== 'production') fail('lecture en cours non signalee');

  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.getElementById('dialogueBox').click());
    await page.waitForTimeout(260);
  }
  await page.evaluate(() => document.querySelector('[data-tab-id="production"]').click());
  await page.waitForTimeout(700);
  const apres = await page.evaluate(() => ({ bulle: isDialogueVisible(), decrit: !!state.tabsDescribed.production }));
  console.log('  apres lecture       :', JSON.stringify(apres));
  if (!apres.decrit) fail('tabsDescribed pas memorise');
  if (apres.bulle) fail('le descriptif se rejoue alors qu il a deja ete lu');

  await browser.close();
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  process.exitCode = problems ? 1 : 0;
})();
