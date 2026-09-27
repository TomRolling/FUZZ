// Couverture de code de la suite : quelles fonctions du jeu (dist/jeu/) les tests exécutent-ils
// réellement ? Deux usages :
//   COUVERTURE=1 bash tout.sh      (tout.sh charge ce fichier dans chaque test via NODE_OPTIONS)
//   node couverture.js             (après la suite : rapport des fonctions jamais exécutées)
// Chargé dans un test, il enveloppe playwright : chaque page enregistre sa couverture JS
// (Chromium, à la fonction près) et la dépose dans .couverture/ quand elle se ferme. Aucun test
// n'a à être modifié.
// Limite connue : une fonction qui fait recharger la page par le jeu lui-même (import, restauration
// d'une sauvegarde : applyImportedData puis location.reload) peut être comptée comme jamais
// exécutée, son document disparaissant avant le relevé. Vérifier ces cas-là dans les tests.
const fs = require('fs'), path = require('path');
const DOSSIER = path.join(__dirname, '.couverture');

if (require.main === module) rapport();
else envelopper();

function envelopper() {
  const pw = require('playwright');
  fs.mkdirSync(DOSSIER, { recursive: true });
  let n = 0;
  // Relevé direct auprès de Chromium (protocole CDP), toutes les 250 ms et à chaque étape : un
  // document remplacé par un rechargement emporte sa couverture avec lui, y compris quand c'est le
  // jeu qui recharge (import, restauration d'une sauvegarde). Les compteurs repartent de zéro à
  // chaque relevé : on cumule donc « exécutée au moins une fois ».
  const suivies = new Map(); // page -> { session, vues: Map(url|debut -> fonction), minuteur }
  const prendre = async (p) => {
    const s = suivies.get(p);
    if (!s || s.occupe) return;
    s.occupe = true;
    try {
      const { result } = await s.session.send('Profiler.takePreciseCoverage');
      for (const e of result) {
        if (!/\/dist\/(jeu\/.*\.js|index\.html)/.test(e.url)) continue;
        const url = e.url.replace(/^.*\/dist\//, '');
        for (const fn of e.functions) {
          const r = fn.ranges[0], cle = url + '|' + r.startOffset;
          const deja = s.vues.get(cle);
          if (!deja) s.vues.set(cle, { url, functionName: fn.functionName, startOffset: r.startOffset, endOffset: r.endOffset, count: r.count });
          else if (r.count > 0) deja.count = 1;
        }
      }
    } catch (e) { /* page fermée entre-temps */ }
    s.occupe = false;
  };
  const deposer = async (p) => {
    const s = suivies.get(p);
    if (!s) return;
    clearInterval(s.minuteur);
    await prendre(p);
    suivies.delete(p);
    const parUrl = {};
    for (const v of s.vues.values()) (parUrl[v.url] = parUrl[v.url] || []).push({ functionName: v.functionName, ranges: [{ startOffset: v.startOffset, endOffset: v.endOffset, count: v.count }] });
    const utiles = Object.entries(parUrl).map(([url, functions]) => ({ url, functions }));
    if (utiles.length) fs.writeFileSync(path.join(DOSSIER, `${process.pid}-${n++}.json`), JSON.stringify(utiles));
  };
  const suivre = (obj) => {
    const newPage = obj.newPage.bind(obj);
    obj.newPage = async (...a) => {
      const p = await newPage(...a);
      try {
        const session = await p.context().newCDPSession(p);
        await session.send('Profiler.enable');
        await session.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
        const s = { session, vues: new Map(), occupe: false };
        s.minuteur = setInterval(() => prendre(p), 250);
        s.minuteur.unref();
        suivies.set(p, s);
      } catch (e) {}
      const close = p.close.bind(p);
      p.close = async (...x) => { await deposer(p); return close(...x); };
      for (const nav of ['reload', 'goto']) {
        const orig = p[nav].bind(p);
        p[nav] = async (...x) => { await prendre(p); return orig(...x); };
      }
      // Juste après chaque action du test : si elle a déclenché un rechargement par le jeu
      // (location.reload), c'est la dernière occasion de relever le document qui l'a exécutée.
      const apres = (obj, nom) => {
        const orig = obj[nom].bind(obj);
        obj[nom] = async (...x) => { const r = await orig(...x); await prendre(p); return r; };
      };
      for (const nom of ['evaluate', 'click', 'dispatchEvent']) apres(p, nom);
      apres(p.keyboard, 'press'); apres(p.mouse, 'click');
      return p;
    };
    const close = obj.close.bind(obj);
    obj.close = async (...a) => { for (const p of [...suivies.keys()]) await deposer(p); return close(...a); };
    return obj;
  };
  const launch = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = async (...a) => {
    const b = suivre(await launch(...a));
    const newContext = b.newContext.bind(b);
    b.newContext = async (...x) => suivre(await newContext(...x));
    return b;
  };
}

// Fonctions jamais exécutées, par fichier. Une fonction est identifiée par son fichier et sa
// position ; son nom est relu dans la source pour que le rapport soit lisible.
function rapport() {
  const fichiers = fs.existsSync(DOSSIER) ? fs.readdirSync(DOSSIER).filter(f => f.endsWith('.json')) : [];
  if (!fichiers.length) { console.log('Aucune mesure : lancer d\'abord COUVERTURE=1 bash tout.sh'); return; }
  const vues = {};   // url -> Map(debut -> { nom, fin, executee })
  for (const f of fichiers) {
    for (const e of JSON.parse(fs.readFileSync(path.join(DOSSIER, f), 'utf8'))) {
      const m = vues[e.url] = vues[e.url] || new Map();
      for (const fn of e.functions) {
        const r = fn.ranges[0];
        if (!fn.functionName) continue; // fonctions anonymes (callbacks) : comptées avec leur parente
        // Par nom : un fichier modifié pendant la mesure décale les positions, et la même fonction
        // apparaîtrait deux fois, dont une « jamais exécutée ».
        const cle = fn.functionName;
        const deja = m.get(cle) || { nom: fn.functionName, debut: r.startOffset, fin: r.endOffset, executee: false };
        deja.executee = deja.executee || r.count > 0;
        m.set(cle, deja);
      }
    }
  }
  let total = 0, jamais = 0;
  const lignes = [];
  for (const url of Object.keys(vues).sort()) {
    const src = fs.readFileSync(path.join(__dirname, '../dist', url), 'utf8');
    const ligneDe = (off) => src.slice(0, off).split('\n').length;
    const non = [...vues[url].values()].filter(v => !v.executee).sort((a, b) => a.debut - b.debut).map(v => [v.debut, v]);
    total += vues[url].size; jamais += non.length;
    if (non.length) lignes.push(`\n${url} (${non.length} / ${vues[url].size} jamais exécutées)\n` + non.map(([deb, v]) => `  ${String(ligneDe(deb)).padStart(5)}  ${v.nom}`).join('\n'));
  }
  console.log(`${fichiers.length} pages mesurées. Fonctions nommées : ${total}, jamais exécutées par la suite : ${jamais} (${(100 * jamais / total).toFixed(1)} %)`);
  console.log(lignes.join('\n'));
}
