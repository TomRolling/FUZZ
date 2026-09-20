// Signalement de bug : le bouton des Options ouvre une fenetre montrant un rapport pre-rempli,
// le rapport contient bien ce qu'il faut pour diagnostiquer (version, environnement, etat de la
// partie, derniere erreur JS), le lien GitHub est valide, et Echap referme la fenetre.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const versionAttendue = require('../src-tauri/tauri.conf.json').version;
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  // On provoque volontairement une erreur JS plus bas : elle ne doit pas faire echouer le test.
  const erreursPage = [];
  p.on('pageerror', e => erreursPage.push(e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4.2e9, knowledge: 1200, cosmicSeeds: 12, prestigeCount: 3, totalAscensions: 1,
      stellarShards: 2, totalClicks: 5000, totalPlayTimeSec: 7200 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 8).map((x, i) => [x.id, 20 - i]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1000);

  // Une erreur JS quelconque doit se retrouver dans le rapport : c'est tout l'interet.
  await p.evaluate(() => { setTimeout(() => { null.boum(); }, 0); });
  await p.waitForTimeout(300);

  const r = await p.evaluate(async () => {
    hideDialogue(false);
    openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    await new Promise(r => setTimeout(r, 300));
    const bouton = document.getElementById('bugReportBtn');
    const visible = !!(bouton && bouton.offsetParent);
    bouton.click();
    await new Promise(r => setTimeout(r, 300));
    const zone = document.getElementById('bugReportText');
    const lien = lienSignalement(zone.value);
    return {
      visible,
      ouverte: document.getElementById('bugReportOverlay').style.display === 'flex',
      rapport: zone.value,
      modifiable: !zone.readOnly && !zone.disabled,
      lien,
      erreursGardees: _erreursRecentes.length,
    };
  });

  console.log('  rapport :');
  for (const l of r.rapport.split('\n')) console.log('    ' + l);
  console.log(`  lien (${r.lien.length} caracteres) : ${r.lien.slice(0, 90)}...`);

  verifie(r.visible, 'le bouton « Signaler un bug » n est pas visible dans les Options');
  verifie(r.ouverte, 'la fenetre de signalement ne s ouvre pas');
  verifie(r.modifiable, 'le joueur ne peut pas modifier le rapport avant de l envoyer');
  verifie(r.rapport.includes('v' + versionAttendue), `le rapport n annonce pas la version ${versionAttendue}`);
  verifie(/version web|installée/.test(r.rapport), 'le rapport ne dit pas dans quel environnement on joue');
  verifie(r.rapport.includes('Prestiges : 3'), 'le rapport ne contient pas l etat de la partie');
  verifie(/2 h/.test(r.rapport), 'le rapport ne contient pas le temps de jeu');
  verifie(r.erreursGardees >= 1 && /boum|null/i.test(r.rapport), 'l erreur JS declenchee ne figure pas dans le rapport');
  verifie(r.lien.startsWith('https://github.com/TomRolling/FUZZ/issues/new?'), 'le lien de signalement est mal forme');
  verifie(r.lien.length < 8000, `lien trop long pour GitHub (${r.lien.length} caracteres)`);

  // Echap referme, et le fondu de sortie est joue (la fenetre est encore la juste apres).
  await p.keyboard.press('Escape');
  const juste = await p.evaluate(() => document.getElementById('bugReportOverlay').style.display);
  await p.waitForTimeout(500);
  const apres = await p.evaluate(() => document.getElementById('bugReportOverlay').style.display);
  console.log(`  Echap : ${juste} -> ${apres}`);
  verifie(juste === 'flex', 'la fenetre disparait d un coup au lieu de se fondre');
  verifie(apres === 'none', 'Echap ne ferme pas la fenetre de signalement');

  // En anglais, le rapport doit l etre aussi.
  const anglais = await p.evaluate(async () => {
    state.lang = 'en'; applyStaticTranslations(); renderAll();
    document.getElementById('bugReportBtn').click();
    await new Promise(r => setTimeout(r, 200));
    return document.getElementById('bugReportText').value;
  });
  verifie(anglais.includes('What happened') && !/Ce qui s|Verdure|Connaissances/.test(anglais),
    'le rapport reste en francais quand le jeu est en anglais');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
