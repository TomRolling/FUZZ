// 1) Un onglet dont la condition tombe pendant que le magasin est OUVERT ne doit PAS apparaitre
//    tout seul : il attend le retour a l'ecran principal et la presentation de Papi.
// 2) L'onglet Batiments doit avoir une vraie replique de Papi, pas le repli generique.
// 3) Un onglet qui vient d'etre revele doit jouer son animation d'apparition.
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
  await page.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; saveGame(); });
  await page.reload();
  await page.waitForTimeout(900);

  const onglets = () => [...document.querySelectorAll('#shopTabsRow .drawerBtn')].map(b => b.dataset.tabId);

  // --- 1. AFK dans le magasin : la condition de Batiments tombe pendant qu'on y est ---
  console.log('=== 1. deblocage pendant que le magasin est ouvert ===');
  await page.evaluate(() => { openModal('shopPageOverlay'); renderAll(); });
  await page.waitForTimeout(300);
  const avant = await page.evaluate(onglets);
  console.log('  onglets a l ouverture :', avant.join(', '));

  await page.evaluate(() => {
    // remplit la condition de l'onglet Batiments (>= 3 types de compagnons)
    state.buildings = { stagiaire: 1, voisin: 1, poubelleCompost: 1 };
    state.verdure = 1e6;
  });
  await page.waitForTimeout(1500); // on laisse tourner : c'est le scenario "AFK"
  const pendant = await page.evaluate(() => ({
    onglets: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].map(b => b.dataset.tabId),
    debloque: unlockedTabs().some(t => t.id === 'batiments'),
    vu: !!state.tabsSeen.batiments,
  }));
  console.log('  apres 1,5s AFK dans le magasin :', JSON.stringify(pendant));
  if (!pendant.debloque) fail('la condition de Batiments n est pas remplie, le test ne teste rien');
  if (pendant.onglets.includes('batiments')) fail('Batiments est apparu tout seul dans le magasin, sans presentation');
  if (pendant.vu) fail('Batiments a ete marque comme vu alors que Papi ne l a pas presente');

  // --- retour a l'ecran principal : Papi doit le presenter ---
  console.log('=== 2. retour a l ecran principal ===');
  await page.evaluate(() => { closeModal('shopPageOverlay'); });
  await page.waitForTimeout(1500);
  const apres = await page.evaluate(() => ({
    dialogue: document.getElementById('dialogueOverlay').classList.contains('visible'),
    texte: document.getElementById('dialogueText').textContent,
    spotlight: document.getElementById('tutorialSpotlightOverlay').style.display,
    vu: !!state.tabsSeen.batiments,
  }));
  console.log('  ', JSON.stringify(apres));
  if (!apres.dialogue) fail('Papi ne presente pas Batiments au retour sur l ecran principal');
  if (!apres.vu) fail('Batiments n a pas ete marque comme vu apres presentation');

  // --- 3. la replique de description est bien specifique ---
  console.log('=== 3. replique specifique a Batiments ===');
  await page.evaluate(() => document.getElementById('shopBtn').click());
  await page.waitForTimeout(1200);
  const desc = await page.evaluate(() => ({
    texte: document.getElementById('dialogueText').textContent,
    ongletActif: activeShopTab,
    onglets: [...document.querySelectorAll('#shopTabsRow .drawerBtn')].map(b => b.dataset.tabId),
    anime: [...document.querySelectorAll('#shopTabsRow .drawerBtn.tabAppear')].map(b => b.dataset.tabId),
  }));
  console.log('  ', JSON.stringify(desc));
  if (!desc.onglets.includes('batiments')) fail('Batiments n apparait toujours pas dans la rangee');
  if (/^Voici "|^This is "/.test(desc.texte)) fail('replique generique utilisee pour Batiments:', desc.texte);

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
