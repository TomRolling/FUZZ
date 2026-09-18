// Sauvegardes de secours : une par jour sur trois jours, plus la copie automatique, listees
// dans les Options avec leur contenu, et restaurables.
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
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1e6 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(600);

  // 1. Une entree par jour, la plus ancienne tombe au-dela de trois jours.
  const rotation = await p.evaluate(() => {
    // Trois jours deja en place (du plus ancien au plus recent), puis la sauvegarde du jour.
    const jour = 86400000, maintenant = Date.now();
    const anciennes = [3, 2, 1].map(n => ({
      jour: `j-${n}`, ts: maintenant - n * jour, jourTs: maintenant - n * jour,
      json: JSON.stringify({ totalEarned: n * 1000, prestigeCount: n, lastSave: maintenant - n * jour }),
    }));
    localStorage.setItem('fuzzSave_rotation', JSON.stringify(anciennes));
    _derniereRotation = 0;
    majRotationSauvegardes(JSON.stringify({ ...state, totalEarned: 99999 }));
    return lireRotation().map(e => e.jour);
  });
  verifie(rotation.length === 3, `${rotation.length} sauvegarde(s) gardee(s) au lieu de 3`);
  verifie(!rotation.includes('j-3'), 'la plus ancienne n a pas ete jetee :', rotation.join(','));
  verifie(rotation.includes('j-1') && rotation.includes('j-2'), 'les jours recents ont disparu :', rotation.join(','));

  // 2. Deux enregistrements dans la meme minute ne creent pas deux entrees.
  const memeMinute = await p.evaluate(() => {
    const avant = lireRotation().length;
    saveGame(); saveGame();
    return { avant, apres: lireRotation().length };
  });
  verifie(memeMinute.apres <= memeMinute.avant + 1, 'la rotation ecrit a chaque sauvegarde');

  // 3. La liste s'affiche dans les Options, avec le resume de chaque sauvegarde.
  const liste = await p.evaluate(() => {
    openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    document.getElementById('restoreBackupBtn').click();
    renderAll();
    const box = document.getElementById('backupList');
    return { lignes: box.querySelectorAll('.backupRow').length, texte: box.textContent.replace(/\s+/g, ' ').trim() };
  });
  verifie(liste.lignes >= 3, `${liste.lignes} ligne(s) dans la liste, au moins 3 attendues`);
  verifie(/Verdure/.test(liste.texte) && /Prestiges/i.test(liste.texte), 'le resume ne dit pas ce que contient la sauvegarde :', liste.texte.slice(0, 120));

  // 4. Le bouton referme la liste.
  const referme = await p.evaluate(() => {
    document.getElementById('restoreBackupBtn').click();
    renderAll();
    return document.getElementById('backupList').querySelectorAll('.backupRow').length;
  });
  verifie(referme === 0, 'la liste ne se referme pas');

  // 5. Restaurer remet bien la partie choisie, et la partie actuelle reste recuperable.
  const restaure = await p.evaluate(() => {
    window.confirm = () => true;
    localStorage.removeItem('fuzzSave_rotation');
    _derniereRotation = 0;
    const vrai = window.todayStr;
    window.todayStr = () => '2026-8-15';
    majRotationSauvegardes(JSON.stringify({ ...state, verdure: 424242, totalEarned: 424242, prestigeCount: 9 }));
    window.todayStr = vrai;
    // La restauration recharge la page : la navigation part apres ce bloc, donc on regarde ce
    // qui a ete ecrit, pas le rechargement lui-meme (location.reload n'est pas remplacable).
    restaurerSauvegarde('2026-8-15');
    const ecrit = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return { verdure: ecrit.verdure, avantImport: !!localStorage.getItem(SAVE_KEY_AVANT_IMPORT) };
  });
  verifie(restaure.verdure === 424242, 'la sauvegarde restauree n est pas la bonne :', restaure.verdure);
  verifie(restaure.avantImport, 'la partie d avant la restauration n est pas mise de cote');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
