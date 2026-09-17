// Mesure les proportions REELLES a l'ecran (en px physiques) pour plusieurs tailles de
// fenetre : l'objectif est que la part de l'ecran occupee par chaque element reste stable,
// et que la taille apparente du texte grandisse un peu — sans exploser — quand on maximise.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

const SIZES = [
  ['petite fenetre  900x620', 900, 620],
  ['REFERENCE      1280x820', 1280, 820],
  ['                1600x900', 1600, 900],
  ['maximise 1080p 1920x1040', 1920, 1040],
  ['maximise 1440p 2560x1400', 2560, 1400],
  ['ultralarge     3440x1400', 3440, 1400],
];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  let problems = 0;
  const fail = (...m) => { console.log('  X', ...m); problems++; };

  for (const [label, w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(filePath);
    await page.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; saveGame(); });
    await page.reload();
    await page.waitForTimeout(700);
    await page.evaluate(() => { state.verdure = 1e9; openModal('shopPageOverlay'); renderAll(); });
    await page.waitForTimeout(400);

    const r = await page.evaluate(() => {
      const vp = document.getElementById('gameViewport');
      const scale = window._gameScale;
      const ph = document.querySelector('.shopImagePlaceholder').getBoundingClientRect();
      const row = document.querySelector('#tab-production .upgrade');
      const rowRect = row ? row.getBoundingClientRect() : null;
      const nameEl = row ? row.querySelector('.name') : null;
      const fs = nameEl ? parseFloat(getComputedStyle(nameEl).fontSize) : 0;
      const icon = row ? row.querySelector('.itemIcon') : null;
      return {
        scale: +scale.toFixed(3),
        designW: Math.round(vp.offsetWidth),
        designH: Math.round(vp.offsetHeight),
        // getBoundingClientRect renvoie deja des px ECRAN (transform applique)
        phScreenW: Math.round(ph.width),
        phPctOfWindow: +(ph.width / window.innerWidth * 100).toFixed(1),
        rowScreenH: rowRect ? Math.round(rowRect.height) : 0,
        rowPctOfWindow: rowRect ? +(rowRect.width / window.innerWidth * 100).toFixed(1) : 0,
        nameFontScreenPx: +(fs * scale).toFixed(1),
        iconScreenPx: icon ? Math.round(icon.getBoundingClientRect().width) : 0,
        horizOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        vertOverflow: vp.getBoundingClientRect().height > window.innerHeight + 1,
      };
    });
    rows.push([label, w, h, r]);
    await page.close();
  }

  console.log('taille fenetre           | echelle | dessin      | Papi(px)  %ecran | texte px | icone px | ligne %ecran');
  for (const [label, w, h, r] of rows) {
    console.log(
      label.padEnd(24), '|',
      String(r.scale).padEnd(7), '|',
      (r.designW + 'x' + r.designH).padEnd(11), '|',
      String(r.phScreenW).padStart(4), String(r.phPctOfWindow + '%').padStart(7), '|',
      String(r.nameFontScreenPx).padStart(8), '|',
      String(r.iconScreenPx).padStart(8), '|',
      String(r.rowPctOfWindow + '%').padStart(6)
    );
    if (r.horizOverflow) fail(label, ': debordement horizontal');
    if (r.vertOverflow) fail(label, ': debordement vertical');
  }

  // La part d'ecran de l'emplacement Papi doit rester dans une fourchette etroite.
  const pcts = rows.map(([, , , r]) => r.phPctOfWindow);
  const min = Math.min(...pcts), max = Math.max(...pcts);
  console.log(`\npart d'ecran de l'emplacement Papi : ${min}% -> ${max}% (ecart ${(max - min).toFixed(1)} pts)`);
  if (max - min > 12) fail("l'emplacement de Papi change trop de proportion selon la taille de fenetre");

  // Invariant reel : la taille APPARENTE du texte (sa part de la hauteur de fenetre) doit
  // rester dans une fourchette etroite — c'est ca, "bien proportionne", pas une taille en px
  // identique (une grande fenetre doit legitimement afficher un texte physiquement plus gros).
  const refRow = rows.find(([l]) => l.includes('REFERENCE'));
  const refPct = refRow[3].nameFontScreenPx / refRow[2] * 100;
  console.log(`\ntexte en %% de la hauteur de fenetre (reference ${refPct.toFixed(2)}%) :`);
  for (const [label, , h, r] of rows) {
    const pct = r.nameFontScreenPx / h * 100;
    const ratio = pct / refPct;
    console.log('  ', label.padEnd(24), pct.toFixed(2) + '%', `(${ratio.toFixed(2)}x)`);
    if (ratio > 1.30) fail(label, `: texte ${ratio.toFixed(2)}x la reference — trop gros`);
    if (ratio < 0.85) fail(label, `: texte ${ratio.toFixed(2)}x la reference — trop petit`);
  }

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
