// Un import met la partie en cours de cote : le bouton « Revenir a la partie d'avant l'import » la
// remet en place, meme apres avoir joue un moment ; la sauvegarde de secours n'est pas touchee ; le
// reset total efface la copie.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };
const pret = p => p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  p.on('dialog', d => d.accept());
  await p.goto(filePath);
  // Partie A : la « vraie » partie du joueur.
  await p.evaluate(() => {
    window.saveGame = () => {}; // sinon la sauvegarde faite en quittant la page ecraserait la partie A
    const st = { ...defaultState(), langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), prestigeCount: 7, cosmicSeeds: 77 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload(); await pret(p); await p.waitForTimeout(800);

  console.log('=== 1. avant tout import : pas de bouton ===');
  const avant = await p.evaluate(() => { openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll(); return { bouton: getComputedStyle(document.getElementById('undoImportBtn')).display, prestiges: state.prestigeCount }; });
  verifie(avant.prestiges === 7, 'la partie A de depart n est pas chargee');
  verifie(avant.bouton === 'none', 'le bouton est visible sans import');

  console.log('=== 2. mauvais import (partie B), puis on joue 6 minutes ===');
  await p.evaluate(() => {
    const B = { ...defaultState(), langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), prestigeCount: 1, cosmicSeeds: 2 };
    for (const t of TAB_DEFS) { B.tabsSeen[t.id] = true; B.tabsDescribed[t.id] = true; }
    setTimeout(() => applyImportedData(B), 0);
  });
  await p.waitForEvent('load'); await pret(p); await p.waitForTimeout(800);
  const apresImport = await p.evaluate(() => {
    // Six minutes plus tard : la sauvegarde de secours se rafraichit avec la partie B.
    state.lastBackupTime = Date.now() - 6 * 60000; saveGame();
    openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    return { prestiges: state.prestigeCount, bouton: getComputedStyle(document.getElementById('undoImportBtn')).display, secours: JSON.parse(localStorage.getItem(SAVE_KEY_BACKUP)).prestigeCount };
  });
  console.log('  ', JSON.stringify(apresImport));
  verifie(apresImport.prestiges === 1, 'la partie importee n est pas chargee');
  verifie(apresImport.bouton !== 'none', 'le bouton « Revenir » devrait etre visible apres un import');
  verifie(apresImport.secours === 1, 'la sauvegarde de secours devrait suivre la partie en cours');

  console.log('=== 3. retour a la partie d avant l import ===');
  await p.evaluate(() => setTimeout(() => document.getElementById('undoImportBtn').click(), 0));
  await p.waitForEvent('load'); await pret(p); await p.waitForTimeout(800);
  const retour = await p.evaluate(() => {
    openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    return { prestiges: state.prestigeCount, graines: state.cosmicSeeds, bouton: getComputedStyle(document.getElementById('undoImportBtn')).display, copie: localStorage.getItem(SAVE_KEY_AVANT_IMPORT) };
  });
  console.log('  ', JSON.stringify({ ...retour, copie: retour.copie ? 'presente' : null }));
  verifie(retour.prestiges === 7 && retour.graines === 77, 'la partie d avant l import n a pas ete retrouvee');
  verifie(retour.bouton === 'none' && !retour.copie, 'le bouton ou la copie restent apres le retour');

  console.log('=== 4. reset total : la copie d avant import est effacee ===');
  const reset = await p.evaluate(() => new Promise(res => {
    localStorage.setItem(SAVE_KEY_AVANT_IMPORT, JSON.stringify(state));
    performFullReset();
    setTimeout(() => res(localStorage.getItem(SAVE_KEY_AVANT_IMPORT)), 700);
  }));
  verifie(reset === null, 'le reset total laisse la partie d avant l import');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
