// formatNum : aucune unite ne doit jamais depasser 999.99 (999 999 s'affichait « 1000K »,
// parce que l'unite est choisie avant l'arrondi d'affichage).
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
  await p.waitForTimeout(600);

  // 1. Les cas de bascule, palier par palier.
  const bascules = await p.evaluate(() => {
    const out = [];
    for (let e = 3; e <= 63; e += 3) {
      const unite = Math.pow(10, e);
      for (const v of [unite * 999.99, unite * 999.994, unite * 999.999, unite * 1000, unite - 1]) {
        out.push({ v, texte: formatNum(v) });
      }
    }
    return out;
  });
  const depassements = bascules.filter(x => {
    const m = x.texte.match(/^(\d+(?:\.\d+)?)[A-Za-z]/);
    return m && parseFloat(m[1]) >= 1000;
  });
  verifie(depassements.length === 0, 'unite(s) au-dessus de 999.99 :',
    depassements.slice(0, 5).map(x => `${x.v.toExponential(2)} -> ${x.texte}`).join(', '));

  // 2. Le cas exact signale : 999 999 doit se lire en millions, pas en « 1000K ».
  const cas = await p.evaluate(() => ({
    m999999: formatNum(999999),
    m999994: formatNum(999994),
    m1M: formatNum(1000000),
    m999_99K: formatNum(999990),
    grand: formatNum(9.99999e65),
    petit: formatNum(999),
    zero: formatNum(0),
  }));
  console.log('  ' + JSON.stringify(cas));
  verifie(cas.m999999 === '1M', `999 999 affiche « ${cas.m999999} » au lieu de « 1M »`);
  verifie(cas.m999994 === '999.99K', `999 994 affiche « ${cas.m999994} » au lieu de « 999.99K »`);
  verifie(cas.m1M === '1M', `1 000 000 affiche « ${cas.m1M} »`);
  verifie(cas.m999_99K === '999.99K', `999 990 affiche « ${cas.m999_99K} »`);
  verifie(cas.petit === '999' && cas.zero === '0', 'les petits nombres ne s affichent plus correctement');

  // 3. Aucune valeur ne doit produire « 1000 » quelle que soit l'unite, sur un balayage large.
  const balayage = await p.evaluate(() => {
    const mauvais = [];
    for (let i = 0; i < 4000; i++) {
      const v = Math.pow(10, 3 + (i / 4000) * 60);
      const t = formatNum(v);
      if (/^1000/.test(t)) mauvais.push([v, t]);
    }
    return mauvais;
  });
  verifie(balayage.length === 0, `${balayage.length} valeur(s) affichent encore « 1000... » :`, JSON.stringify(balayage.slice(0, 3)));

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
