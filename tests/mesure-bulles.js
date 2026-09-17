// Verifie qu'aucune replique de presentation d'onglet (FR et EN) n'agrandit la bulle de Papi :
// la hauteur de reference est celle de la bulle avec une replique d'un seul caractere (le
// portrait fixe la hauteur minimale).
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => { const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr() }; window.saveGame = () => {}; localStorage.setItem(SAVE_KEY, JSON.stringify(st)); });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(600);
  const { base, out } = await p.evaluate(() => {
    showDialogue('papi', ['x'], { position: 'top-right' });
    const box = document.getElementById('dialogueBox'), txt = document.getElementById('dialogueText');
    const hauteur = t => { txt.textContent = t; return Math.round(box.getBoundingClientRect().height); };
    const base = hauteur('x');
    const out = [];
    for (const [id, bi] of Object.entries(PAPI_TAB_ANNOUNCEMENTS_BI)) for (const lang of ['fr', 'en']) (bi[lang] || []).forEach((ligne, i) => {
      out.push({ id, lang, i, h: hauteur(ligne), n: ligne.length });
    });
    return { base, out };
  });
  const trop = out.filter(x => x.h > base);
  const parOnglet = {};
  for (const x of out.filter(x => x.lang === 'fr')) parOnglet[x.id] = (parOnglet[x.id] || 0) + 1;
  console.log('hauteur de reference :', base, 'px | repliques :', out.length, '| plus longue :', Math.max(...out.map(x => x.n)), 'caracteres | trop hautes :', trop.length);
  console.log('bulles par onglet (FR) :', JSON.stringify(parOnglet));
  const enDiff = Object.keys(parOnglet).filter(id => out.filter(x => x.id === id && x.lang === 'en').length !== parOnglet[id]);
  if (enDiff.length) console.log('  X nombre de bulles FR/EN different :', enDiff.join(', '));
  trop.forEach(x => console.log(`  X ${x.id} ${x.lang} #${x.i + 1} : ${x.h} px (${x.n} caracteres)`));
  await b.close();
  process.exitCode = trop.length || enDiff.length ? 1 : 0;
})();
