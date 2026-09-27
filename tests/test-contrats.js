// Contrats que tout ajout au jeu doit respecter. Chacun correspond à une panne SILENCIEUSE : rien
// ne plante, le joueur voit juste un texte vide, un Papi muet ou une progression perdue.
//  1. chaque clé passée à tr('...') existe dans UI_STRINGS, en français ET en anglais ;
//  2. chaque catégorie de répliques demandée à Papi existe dans PAPI_LINES (une faute de frappe
//     le rendait muet à cet endroit, pour toujours) ;
//  3. chaque champ state.xxx lu ou écrit par le jeu existe dans defaultState() : sinon une
//     ancienne sauvegarde et le reset total ne l'initialisent pas ;
//  4. chaque type d'effet des tables d'améliorations est lu quelque part hors des tables
//     (sinon l'amélioration s'achète et ne fait rien) ;
//  5. chaque onglet a son panneau, et sa présentation par Papi (FR et EN, même nombre de bulles)
//     s'il n'est pas silencieux ;
//  6. les conditions de déblocage (onglets, familiers, automatisations, défis, Spécial, succès)
//     s'évaluent sans erreur sur une partie neuve comme sur une partie très avancée ;
//  7. chaque image du jeu (sprites, boutons) se charge vraiment dans le navigateur.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const DIST = path.resolve(__dirname, '../dist');
const filePath = 'file://' + path.join(DIST, 'index.html').split(path.sep).join('/');
let problems = 0;
const ok = (c, m, detail) => { console.log((c ? '  ok ' : '  X  ') + m + (!c && detail ? ' : ' + detail : '')); if (!c) problems++; };

// Les sources du jeu, dans l'ordre où index.html les charge.
const index = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const fichiers = [...index.matchAll(/<script src="(jeu\/[^"]+\.js)"/g)].map(m => m[1]);
const sources = Object.fromEntries(fichiers.map(f => [f, fs.readFileSync(path.join(DIST, f), 'utf8')]));
// Sans commentaires : un nom cité dans une explication n'est pas un usage.
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const code = Object.fromEntries(Object.entries(sources).map(([f, s]) => [f, sansCommentaires(s)]));
// TEMOIN=1 node test-contrats.js : une panne de chaque sorte est injectée, et CHAQUE vérification
// doit échouer. C'est la preuve que le test voit encore ce qu'il prétend voir.
const TEMOIN = !!process.env.TEMOIN;
if (TEMOIN) code['jeu/temoin.js'] = "tr('cleFantome'); queueOrShowPapi('categorieFantome'); state.champFantome = 1;";
const tout = Object.values(code).join('\n');
const horsTables = Object.entries(code).filter(([f]) => !f.startsWith('jeu/contenu/')).map(([, s]) => s).join('\n');

// Toutes les chaînes littérales d'un appel f(...) : tr('a'), tr(x ? 'a' : 'b').
function argumentsLitteraux(nomFonction) {
  const r = new Set();
  for (const m of tout.matchAll(new RegExp(`\\b${nomFonction}\\(([^()]*)\\)`, 'g')))
    for (const s of m[1].matchAll(/'([A-Za-z_][\w]*)'/g)) r.add(s[1]);
  return [...r];
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => ok(false, 'pageerror', e.message));
  await p.goto(filePath);
  await p.waitForFunction(() => typeof TAB_DEFS !== 'undefined' && typeof renderAll === 'function');
  if (TEMOIN) await p.evaluate(() => {
    RESEARCH.push({ id: 'temoin', type: 'effetFantome', cost: 1, name: { fr: 't', en: 't' }, desc: { fr: 't', en: 't' } });
    PAPI_TAB_ANNOUNCEMENTS_BI.clic.en.pop();
    FAMILIERS.push({ id: 'temoin', unlock: s => s.champInexistant.x });
    ITEM_SPRITES.temoin = { src: 'assets/sprites/image-fantome.png' };
  });

  console.log('=== 1. clés de traduction ===');
  const cles = argumentsLitteraux('tr');
  const manquantes = await p.evaluate((cles) => cles.filter(k => !(k in UI_STRINGS.fr) || !(k in UI_STRINGS.en)), cles);
  ok(cles.length > 20, `${cles.length} clés utilisées dans le code`);
  ok(!manquantes.length, 'toutes existent en FR et en EN', manquantes.join(', '));

  console.log('=== 2. catégories de répliques de Papi ===');
  const categories = [...new Set(['queueOrShowPapi', 'papiSaysFromCategory', 'pickPapiLine', 'showShopComment'].flatMap(argumentsLitteraux))];
  const dynamiques = await p.evaluate(() => [...Object.values(CATEGORIE_ACHAT), 'prestige', 'ascension']);
  const inconnues = await p.evaluate((c) => c.filter(x => !PAPI_LINES[x] || !PAPI_LINES[x].fr.length || !PAPI_LINES[x].en.length), [...categories, ...dynamiques]);
  ok(categories.length > 10, `${categories.length} catégories citées dans le code, ${dynamiques.length} par les achats et les cérémonies`);
  ok(!inconnues.length, 'toutes existent, avec des répliques FR et EN', inconnues.join(', '));

  console.log('=== 3. champs de la sauvegarde ===');
  const lus = new Set([...tout.matchAll(/\bstate\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  const defaut = await p.evaluate(() => Object.keys(defaultState()));
  const horsDefaut = [...lus].filter(k => !defaut.includes(k)).sort();
  ok(lus.size > 30, `${lus.size} champs de state utilisés par le jeu, ${defaut.length} dans defaultState()`);
  ok(!horsDefaut.length, 'chacun est déclaré dans defaultState()', horsDefaut.join(', '));
  const jamaisLus = defaut.filter(k => !lus.has(k) && !new RegExp(`\\b${k}\\b`).test(horsTables));
  if (jamaisLus.length) console.log('     (info) champs de defaultState() que le code ne cite jamais :', jamaisLus.join(', '));

  console.log('=== 4. types d\'effet des améliorations ===');
  const types = await p.evaluate(() => {
    const r = {};
    const tables = { CLICK_UPGRADES, UNIQUE_BUILDINGS, COMPANION_BUILDINGS, RESEARCH, RESEARCH_INFINITE, PRESTIGE_UPGRADES, ASCENSION_UPGRADES };
    for (const [nom, t] of Object.entries(tables)) for (const x of t) {
      for (const ty of [x.type, x.active && x.active.type, x.effect && x.effect.type]) if (ty) (r[ty] = r[ty] || new Set()).add(nom);
    }
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [...v]]));
  });
  const nonLus = Object.keys(types).filter(t => !horsTables.includes(`'${t}'`));
  ok(Object.keys(types).length > 10, `${Object.keys(types).length} types d'effet dans les tables`);
  ok(!nonLus.length, 'chacun est lu par le moteur', nonLus.map(t => `${t} (${types[t].join(', ')})`).join(' ; '));

  console.log('=== 5. onglets ===');
  const onglets = await p.evaluate(() => TAB_DEFS.map(t => {
    const a = PAPI_TAB_ANNOUNCEMENTS_BI[t.id];
    return { id: t.id, silent: !!t.silent, panneau: !!document.getElementById('tab-' + t.id), groupe: !!GROUP_TO_OVERLAY[t.group],
      libelle: !!(t.label && t.label.fr && t.label.en && t.icon), fr: a ? a.fr.length : 0, en: a ? a.en.length : 0 };
  }));
  const sansPanneau = onglets.filter(o => !o.panneau || !o.groupe || !o.libelle).map(o => o.id);
  const sansPresentation = onglets.filter(o => !o.silent && (!o.fr || o.fr !== o.en)).map(o => `${o.id} (${o.fr} FR / ${o.en} EN)`);
  ok(!sansPanneau.length, `les ${onglets.length} onglets ont un panneau, une fenêtre, un nom FR/EN et une icône`, sansPanneau.join(', '));
  ok(!sansPresentation.length, 'chaque onglet non silencieux a sa présentation, autant de bulles en FR qu\'en EN', sansPresentation.join(', '));

  console.log('=== 6. conditions de déblocage ===');
  const conditions = await p.evaluate(() => {
    const neuf = defaultState();
    // Partie très avancée, pour les conditions qui ne s'évaluent qu'au-delà d'un seuil.
    const avance = Object.assign(defaultState(), { verdure: 1e40, totalVerdureEarned: 1e40, knowledge: 1e12, totalClicks: 1e6,
      totalPlayTimeSec: 1e7, prestigeCount: 200, totalAscensions: 12, cosmicSeeds: 1e6, totalSeedsEarned: 1e6, seedsSinceAscension: 1e6,
      stellarShards: 500, totalShardsEarned: 500, buildings: Object.fromEntries(BUILDINGS.map(x => [x.id, 500])) });
    const erreurs = [];
    const essayer = (nom, f) => { for (const [etat, s] of [['neuve', neuf], ['avancée', avance]]) { try { f(s); } catch (e) { erreurs.push(`${nom} (partie ${etat}) : ${e.message}`); } } };
    for (const t of TAB_DEFS) essayer('onglet ' + t.id, s => t.unlock(s));
    for (const [nom, table] of Object.entries({ FAMILIERS, AUTOMATIONS, CHALLENGES }))
      for (const x of table) essayer(nom + ' ' + x.id, s => x.unlock(s));
    for (const u of UNIQUE_BUILDINGS) if (typeof u.requires === 'function') essayer('Spécial ' + u.id, s => u.requires(s));
    // Les succès lisent l'état global : on l'échange le temps de l'essai.
    const vrai = state;
    for (const a of ACHIEVEMENTS) for (const [etat, s] of [['neuve', neuf], ['avancée', avance]]) {
      state = s;
      try { const f = a.check || a.condition || a.cond; if (f) f(s); if (a.progress) a.progress(s); } catch (e) { erreurs.push(`succès ${a.id} (partie ${etat}) : ${e.message}`); }
    }
    state = vrai;
    return { erreurs, n: TAB_DEFS.length + FAMILIERS.length + AUTOMATIONS.length + CHALLENGES.length + ACHIEVEMENTS.length };
  });
  ok(!conditions.erreurs.length, `${conditions.n} conditions évaluées sur une partie neuve et une partie avancée, sans erreur`, conditions.erreurs.slice(0, 5).join(' | '));

  console.log('=== 7. images ===');
  const images = await p.evaluate(async () => {
    const urls = new Set(Object.values(ITEM_SPRITES).map(s => s.src || s.file || s).filter(u => typeof u === 'string'));
    document.querySelectorAll('img[src]').forEach(i => urls.add(i.getAttribute('src')));
    const cassees = [];
    await Promise.all([...urls].map(u => new Promise(res => {
      const i = new Image(); i.onload = () => { if (!i.naturalWidth) cassees.push(u); res(); }; i.onerror = () => { cassees.push(u); res(); }; i.src = u;
    })));
    return { n: urls.size, cassees };
  });
  ok(images.n > 20, `${images.n} images référencées`);
  ok(!images.cassees.length, 'toutes se chargent', images.cassees.slice(0, 5).join(', '));

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
