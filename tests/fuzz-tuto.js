// Martele le tutoriel : clics rapides et repetes sur la bulle, les boutons flottants et les
// mini-onglets. Cherche un etat bloque — bulle verrouillee sans moyen de la fermer.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

const CIBLES = ['dialogueBox', 'achievementsBtn', 'shopBtn', 'settingsBtn', 'questsBtn',
                'achievementsModalCloseBtn', 'shopPageCloseBtn', 'settingsModalCloseBtn'];

async function unePasse(browser, graine) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(filePath);
  await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true;
    state.tabsSeen = {}; state.tabsDescribed = {};
    state.totalClicks = 200; state.achievements = { a_click100: true };
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Marteau : 120 clics pseudo-aleatoires mais reproductibles.
  let x = graine;
  const suivant = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x; };
  for (let i = 0; i < 120; i++) {
    const cible = CIBLES[suivant() % CIBLES.length];
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) el.click();
    }, cible);
    if (i % 10 === 0) {
      const t = await page.evaluate(() => { const b = document.querySelector('.drawerBtn.featureHighlight'); return b ? b.dataset.tabId : null; });
      if (t) await page.evaluate(id => document.querySelector(`[data-tab-id="${id}"]`).click(), t);
    }
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(1500);

  // Le joueur peut-il repartir ? On lui laisse 30 clics "normaux" pour se degager.
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      if (isDialogueVisible()) document.getElementById('dialogueBox').click();
      const b = document.querySelector('.drawerBtn.featureHighlight');
      if (b) b.click();
      for (const id of ['achievementsBtn', 'shopBtn', 'settingsBtn', 'questsBtn']) {
        const e = document.getElementById(id);
        if (e && e.classList.contains('featureHighlight')) e.click();
      }
    });
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(800);

  const etat = await page.evaluate(() => {
    const avant = state.totalClicks;
    document.getElementById('clickZone').click();
    return {
      bulle: isDialogueVisible(),
      bloquee: _dialogueBlockAdvance,
      texte: document.getElementById('dialogueText').textContent.slice(0, 50),
      groupe: _pendingSpotlightGroup,
      locked: _lockedToTabId,
      spotlight: document.getElementById('tutorialSpotlightOverlay').style.display,
      modaleOuverte: ['shopPageOverlay', 'settingsModalOverlay', 'questsModalOverlay', 'achievementsModalOverlay']
        .find(id => document.getElementById(id).classList.contains('open')) || null,
      halosBoutons: ['settingsBtn', 'achievementsBtn', 'questsBtn', 'shopBtn']
        .filter(id => document.getElementById(id).classList.contains('featureHighlight')),
      clicPasse: state.totalClicks > avant,
    };
  });
  await page.close();
  return { etat, erreurs };
}

(async () => {
  const browser = await chromium.launch();
  let bloques = 0;
  for (const graine of [1, 7, 13, 29, 101, 997]) {
    const { etat, erreurs } = await unePasse(browser, graine);
    // Bloque = une bulle verrouillee persiste alors qu'aucun halo/spotlight n'indique la sortie.
    const bloque = etat.bulle && etat.bloquee && etat.spotlight !== 'block' && etat.halosBoutons.length === 0;
    const fige = !etat.clicPasse && !etat.modaleOuverte && !etat.bulle;
    console.log('graine', String(graine).padStart(4), bloque ? 'BLOQUE' : (fige ? 'FIGE' : 'ok    '), JSON.stringify(etat));
    if (erreurs.length) console.log('        erreurs:', erreurs.slice(0, 2));
    if (bloque || fige) bloques++;
  }
  console.log(bloques ? `\n${bloques} PASSE(S) BLOQUEE(S)` : '\nAUCUN BLOCAGE');
  await browser.close();
  process.exitCode = bloques ? 1 : 0;
})();
