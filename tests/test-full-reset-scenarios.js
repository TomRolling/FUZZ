const { chromium } = require('playwright');
const path = require('path');

const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

async function newPage(browser) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
  page.consoleErrors = consoleErrors;
  return page;
}

async function waitBoot(page) {
  await page.goto(filePath);
  await page.evaluate(() => { state.langChosen = true; saveGame(); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function skipIntroToTutorialOverlay(page) {
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.getElementById('tutorialOverlay').style.display === 'flex')) break;
    await page.evaluate(() => document.getElementById('sceneOverlay').click());
    await page.waitForTimeout(150);
  }
}

// Verifie qu apres un reset, refaire tout le parcours (intro -> tuto -> Parametres) fonctionne
// normalement, sans blocage residuel (clic verrouille pour toujours, mini-onglets bloques, etc).
async function verifyPostResetFlowWorks(page, label) {
  await page.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await page.waitForTimeout(500);

  const postResetState = await page.evaluate(() => ({
    tutorialSeen: state.tutorialSeen,
    pendingSpotlightGroup: _pendingSpotlightGroup,
    lockedToTabId: _lockedToTabId,
    clickZoneLockedForTutorial: (typeof _clickZoneLockedForTutorial === 'undefined' ? false : _clickZoneLockedForTutorial),
    dialogueVisible: document.getElementById('dialogueOverlay').classList.contains('visible'),
    settingsModalOpen: document.getElementById('settingsModalOverlay').classList.contains('open'),
  }));
  console.log(`[${label}] Etat juste apres reset:`, JSON.stringify(postResetState));
  const issues = [];
  if (postResetState.tutorialSeen !== false) issues.push('tutorialSeen devrait etre false apres reset');
  if (postResetState.pendingSpotlightGroup !== null) issues.push('pendingSpotlightGroup devrait etre null apres reset');
  if (postResetState.lockedToTabId !== null) issues.push('lockedToTabId devrait etre null apres reset');
  if (postResetState.dialogueVisible !== false) issues.push('dialogueVisible devrait etre false apres reset (bulle fantome)');
  if (postResetState.settingsModalOpen !== false) issues.push('settingsModalOverlay ne devrait pas etre ouvert apres reset');

  await skipIntroToTutorialOverlay(page);
  const tutorialOverlayShown = await page.evaluate(() => document.getElementById('tutorialOverlay').style.display === 'flex');
  if (!tutorialOverlayShown) issues.push('le tutoriel ne s est jamais réaffiché apres reset (scene bloquee ?)');
  await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());

  // Le magasin (et donc le spotlight qui le presente) n'apparait qu'a CLICS_POUR_LE_MAGASIN
  // clics : apres un reset complet le compteur repart de zero. Le test attendait ici un
  // spotlight que le jeu n'avait aucune raison d'afficher, et signalait 4 problemes... en
  // sortant malgre tout en code 0, donc sans jamais faire rougir tout.sh. On rejoue les clics
  // comme le ferait un joueur.
  await page.evaluate(() => { const z = document.getElementById('clickZone'); for (let i = 0; i < CLICS_POUR_LE_MAGASIN; i++) z.click(); });

  let spotlightAppeared = false;
  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(400);
    // Le dialogue de révélation et le spotlight s'affichent ENSEMBLE par design désormais —
    // ne pas ignorer le check du spotlight juste parce que le dialogue est aussi visible.
    if (await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display === 'block')) { spotlightAppeared = true; break; }
  }
  if (!spotlightAppeared) issues.push('le spotlight Parametres n est jamais apparu apres le reset');

  if (spotlightAppeared) {
    // Le tutoriel commence désormais par PRODUCTION (bouton du magasin) avant Paramètres :
    // on franchit cette première étape, puis on referme le magasin, avant de tester Paramètres.
    await page.evaluate(() => document.getElementById('shopBtn').click());
    await page.waitForTimeout(500);
    // Les descriptifs ne s'auto-avancent plus : il faut cliquer la bulle pour les passer.
    for (let i = 0; i < 6; i++) {
      const dv = await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'));
      if (!dv) break;
      await page.evaluate(() => document.getElementById('dialogueBox').click());
      await page.waitForTimeout(350);
    }
    await page.evaluate(() => document.getElementById('shopPageCloseBtn').click());
    await page.waitForTimeout(700);
    for (let i = 0; i < 6; i++) {
      const dv = await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'));
      if (!dv) break;
      await page.evaluate(() => document.getElementById('dialogueBox').click());
      await page.waitForTimeout(350);
    }
    await page.evaluate(() => document.getElementById('settingsBtn').click());
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => ({
      modalOpen: document.getElementById('settingsModalOverlay').classList.contains('open'),
      activeSettingsTab: activeSettingsTab,
    }));
    if (!opened.modalOpen || opened.activeSettingsTab !== 'options') issues.push('Parametres ne s est pas ouvert correctement sur Options apres le reset: ' + JSON.stringify(opened));

    // Verifie que le clic fonctionne a nouveau (pas bloque pour toujours).
    await page.evaluate(() => document.getElementById('settingsModalCloseBtn').click());
    for (let i = 0; i < 10; i++) {
      const dv = await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'));
      if (dv) { await page.evaluate(() => document.getElementById('dialogueBox').click()); await page.waitForTimeout(300); }
      else break;
    }
    await page.waitForTimeout(1000);
    const clickTest = await page.evaluate(() => {
      const before = state.totalClicks;
      document.getElementById('clickZone').click();
      return { before, after: state.totalClicks, locked: (typeof _clickZoneLockedForTutorial === 'undefined' ? false : _clickZoneLockedForTutorial) };
    });
    console.log(`[${label}] Test de clic apres reset:`, JSON.stringify(clickTest));
    if (clickTest.locked && clickTest.after === clickTest.before) issues.push('le clic reste bloque indefiniment apres avoir ferme Parametres post-reset');
  }

  console.log(`[${label}] Problemes detectes:`, issues.length ? issues : 'AUCUN');
  return issues;
}

(async () => {
  const browser = await chromium.launch();
  let allIssues = [];

  console.log('=== SCENARIO 1 : reset depuis un etat propre (jeu jamais touche) ===');
  {
    const page = await newPage(browser);
    await waitBoot(page);
    await page.evaluate(() => performFullReset());
    const issues = await verifyPostResetFlowWorks(page, 'Scenario1-etat-propre');
    console.log('Erreurs console:', page.consoleErrors);
    allIssues = allIssues.concat(issues);
    await page.close();
  }

  console.log('=== SCENARIO 2 : reset PENDANT que le spotlight Parametres est actif (pas encore clique) ===');
  {
    const page = await newPage(browser);
    await waitBoot(page);
    await skipIntroToTutorialOverlay(page);
    await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());
    for (let s = 0; s < 20; s++) {
      await page.waitForTimeout(400);
      if (await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'))) continue;
      if (await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display === 'block')) break;
    }
    console.log('Spotlight actif avant reset:', await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display));
    await page.evaluate(() => performFullReset());
    const issues = await verifyPostResetFlowWorks(page, 'Scenario2-pendant-spotlight');
    console.log('Erreurs console:', page.consoleErrors);
    allIssues = allIssues.concat(issues);
    await page.close();
  }

  console.log('=== SCENARIO 3 : reset PENDANT le descriptif d Options (bulle auto-avance en cours, mini-onglets verrouilles) ===');
  {
    const page = await newPage(browser);
    await waitBoot(page);
    await skipIntroToTutorialOverlay(page);
    await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());
    for (let s = 0; s < 20; s++) {
      await page.waitForTimeout(400);
      if (await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible'))) continue;
      if (await page.evaluate(() => document.getElementById('tutorialSpotlightOverlay').style.display === 'block')) break;
    }
    await page.evaluate(() => document.getElementById('settingsBtn').click());
    await page.waitForTimeout(200); // en plein milieu du descriptif d'Options
    console.log('Dialogue visible avant reset:', await page.evaluate(() => document.getElementById('dialogueOverlay').classList.contains('visible')));
    console.log('Modale Parametres ouverte avant reset:', await page.evaluate(() => document.getElementById('settingsModalOverlay').classList.contains('open')));
    await page.evaluate(() => performFullReset());
    const issues = await verifyPostResetFlowWorks(page, 'Scenario3-pendant-descriptif');
    console.log('Erreurs console:', page.consoleErrors);
    allIssues = allIssues.concat(issues);
    await page.close();
  }

  console.log('=== SCENARIO 4 : reset APRES avoir termine tout le tutoriel + progres reel ===');
  {
    const page = await newPage(browser);
    await waitBoot(page);
    await skipIntroToTutorialOverlay(page);
    await page.evaluate(() => document.getElementById('tutorialCloseBtn').click());
    // Avance rapidement en donnant beaucoup de progres, laisse le tick tourner un peu.
    await page.waitForTimeout(1500);
    await page.evaluate(() => { state.verdure = 1e6; state.totalClicks = 100; state.buildings.stagiaire = 5; saveGame(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => performFullReset());
    const issues = await verifyPostResetFlowWorks(page, 'Scenario4-apres-progres');
    console.log('Erreurs console:', page.consoleErrors);
    allIssues = allIssues.concat(issues);
    await page.close();
  }

  console.log('\n=== RESUME GLOBAL ===');
  console.log('Total de problemes detectes sur les 4 scenarios:', allIssues.length);
  if (allIssues.length) console.log(allIssues);

  await browser.close();
  // Sans ca, un test qui signale des problemes sortait quand meme en 0 et tout.sh le comptait OK.
  process.exitCode = allIssues.length ? 1 : 0;
})();
