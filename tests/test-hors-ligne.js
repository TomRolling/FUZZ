// Fenetre « Pendant ton absence » : textes traduits (FR et EN), contenu complet, et capture.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };
const verifie = (c, ...m) => { if (!c) fail(...m); };

(async () => {
  const b = await chromium.launch();
  for (const lang of ['fr', 'en']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
    p.on('pageerror', e => fail('pageerror:', e.message));
    await p.goto(filePath);
    // Partie avancee, fermee il y a 37 minutes.
    await p.evaluate((lang) => {
      window.saveGame = () => {};
      const st = { ...state, lang, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1e6, lastSave: Date.now() - 37 * 60000 };
      for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
      st.buildings = { stagiaire: 30, voisin: 20 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    }, lang);
    await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => ({
      visible: getComputedStyle(document.getElementById('offlineOverlay')).display === 'flex',
      titre: document.getElementById('offlineTitle').textContent,
      corps: document.getElementById('offlineBody').textContent.replace(/\s+/g, ' ').trim(),
      bouton: document.getElementById('offlineCloseBtn').textContent,
      lignes: document.querySelectorAll('#offlineBody .offlineLigne').length,
      gain: (document.querySelector('#offlineBody .offlineGain') || {}).textContent || '',
    }));
    console.log(' ', lang, JSON.stringify(r));
    verifie(r.visible, lang, ': la fenetre ne s affiche pas');
    verifie(!/^[A-Z]+$/.test(r.titre.replace(/\s/g, '')) && !/offline/i.test(r.titre + r.bouton), lang, ': texte non traduit', r.titre, r.bouton);
    verifie(r.lignes === 2 && /^🌿 \+/.test(r.gain), lang, ': contenu incomplet');
    verifie(/37 min/.test(r.corps), lang, ': duree d absence absente du texte');
    if (lang === 'fr') await p.screenshot({ path: __dirname + '/captures/hors-ligne.png', clip: { x: 430, y: 240, width: 420, height: 340 } });
    await p.close();
  }

  // Absence longue : la fenetre doit afficher la VRAIE duree (20 h) et dire que la production
  // n'est comptee que sur 8 h. Avant, elle affichait « 8 h » comme duree d'absence.
  for (const lang of ['fr', 'en']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
    p.on('pageerror', e => fail('pageerror:', e.message));
    await p.goto(filePath);
    await p.evaluate((lang) => {
      window.saveGame = () => {};
      const st = { ...state, lang, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1e6, lastSave: Date.now() - 20 * 3600000 };
      for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
      st.buildings = { stagiaire: 30, voisin: 20 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    }, lang);
    await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
    await p.waitForTimeout(900);
    const corps = await p.evaluate(() => document.getElementById('offlineBody').textContent.replace(/\s+/g, ' ').trim());
    console.log(' ', lang, '20 h :', corps);
    verifie(/20 h/.test(corps), lang, ': la duree reelle de 20 h n est pas affichee');
    verifie(/8 h/.test(corps) && /(maximum|max)/i.test(corps), lang, ': le plafond de 8 h n est pas explique');
    await p.close();
  }
  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
