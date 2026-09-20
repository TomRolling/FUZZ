const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(require('path').resolve(__dirname, '../dist/index.html'), 'utf8');

// Une table peut se referer a une constante du jeu (ex. cost: CLICS_POUR_LE_MAGASIN). Comme on
// evalue le litteral tout seul, hors de la page, on relit d'abord les constantes numeriques
// simples du fichier pour les fournir a l'evaluation.
const CONSTANTES = {};
for (const m of html.matchAll(/^const ([A-Z][A-Z0-9_]*) = (-?[0-9.]+(?:e[+-]?[0-9]+)?);/gm)) CONSTANTES[m[1]] = Number(m[2]);

function extractLiteral(name, open, close) {
  const marker = `const ${name} = ${open}`;
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) throw new Error('not found: ' + name);
  let i = startIdx + marker.length - 1, depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === open) depth++;
    else if (html[i] === close) { depth--; if (depth === 0) { i++; break; } }
  }
  const text = html.slice(startIdx + marker.length - 1, i);
  const corps = 'return ' + text.replace(/requires:\s*s\s*=>[^,}]+/g, 'requires: null').replace(/check:\s*s\s*=>[^,}]+/g, 'check: null');
  return new Function(...Object.keys(CONSTANTES), corps)(...Object.values(CONSTANTES));
}

const tables = {
  BUILDINGS: extractLiteral('BUILDINGS', '[', ']'),
  CLICK_UPGRADES: extractLiteral('CLICK_UPGRADES', '[', ']'),
  UNIQUE_BUILDINGS: extractLiteral('UNIQUE_BUILDINGS', '[', ']'),
  COMPANION_BUILDINGS: extractLiteral('COMPANION_BUILDINGS', '[', ']'),
  RESEARCH: extractLiteral('RESEARCH', '[', ']'),
  RESEARCH_INFINITE: extractLiteral('RESEARCH_INFINITE', '[', ']'),
  PRESTIGE_UPGRADES: extractLiteral('PRESTIGE_UPGRADES', '[', ']'),
  ASCENSION_UPGRADES: extractLiteral('ASCENSION_UPGRADES', '[', ']'),
  SYNERGIES: extractLiteral('SYNERGIES', '[', ']'),
};
const ITEM_SPRITES = extractLiteral('ITEM_SPRITES', '{', '}');

let problems = 0;
const fail = (...m) => { console.log('  ✗', ...m); problems++; };

for (const [name, arr] of Object.entries(tables)) {
  const seen = new Set();
  for (const it of arr) { if (it.id) { if (seen.has(it.id)) fail('DUP id in', name, it.id); seen.add(it.id); } }
  console.log(name, '=', arr.length);
}

// Collisions croisées entre toutes les tables qui partagent l'espace d'ids des sprites
const spriteTables = ['BUILDINGS', 'CLICK_UPGRADES', 'UNIQUE_BUILDINGS', 'COMPANION_BUILDINGS'];
const cross = new Map();
for (const t of spriteTables) for (const it of tables[t]) cross.set(it.id, (cross.get(it.id) || 0) + 1);
const dups = [...cross.entries()].filter(([, c]) => c > 1);
if (dups.length) fail('collisions croisées:', dups); else console.log('collisions croisées: AUCUNE');

// Chaînes requires
for (const t of ['RESEARCH', 'PRESTIGE_UPGRADES', 'ASCENSION_UPGRADES']) {
  const ids = new Set(tables[t].map(x => x.id));
  for (const it of tables[t]) if (it.requires && !ids.has(it.requires)) fail('requires cassé', t, it.id, '->', it.requires);
}

// RESEARCH : uniquement les 5 catégories autorisées
const ALLOWED = new Set(['prodMult', 'knowledgeMult', 'cheaper', 'weatherShield', 'offlineBonus']);
for (const r of [...tables.RESEARCH, ...tables.RESEARCH_INFINITE]) {
  if (!ALLOWED.has(r.type)) fail('type interdit dans Recherche:', r.id, r.type);
}
// weatherShield se combine en Math.max -> chaque palier doit être strictement meilleur
const ws = tables.RESEARCH.filter(r => r.type === 'weatherShield').map(r => r.value);
for (let i = 1; i < ws.length; i++) if (ws[i] >= ws[i - 1]) fail('weatherShield non strictement meilleur:', ws);

// COMPANION_BUILDINGS : targetId doit exister dans BUILDINGS
const compIds = new Set(tables.BUILDINGS.map(b => b.id));
for (const b of tables.COMPANION_BUILDINGS) if (!compIds.has(b.targetId)) fail('targetId inconnu:', b.id, '->', b.targetId);

// SYNERGIES : source/target doivent exister
for (const s of tables.SYNERGIES) {
  if (!compIds.has(s.source)) fail('synergie source inconnue:', s.source);
  if (!compIds.has(s.target)) fail('synergie target inconnue:', s.target);
}

// Version du jeu : la version web ne peut pas lire tauri.conf.json, elle porte donc la sienne en
// dur (VERSION_JEU, utilisée par le signalement de bug). Les deux doivent rester d'accord.
const versionJeu = (html.match(/const VERSION_JEU = '([^']+)'/) || [])[1];
const versionTauri = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src-tauri/tauri.conf.json'), 'utf8')).version;
if (versionJeu !== versionTauri) fail(`VERSION_JEU (${versionJeu}) != tauri.conf.json (${versionTauri})`);

// ITEM_SPRITES : fichier présent + item correspondant existant
const allItems = new Map();
for (const t of spriteTables) for (const it of tables[t]) allItems.set(it.id, t);
for (const [id, entry] of Object.entries(ITEM_SPRITES)) {
  if (!allItems.has(id)) fail('sprite orphelin (aucun objet):', id);
  const f = path.join(__dirname, '../dist', entry.src);
  if (!fs.existsSync(f)) fail('fichier sprite manquant:', entry.src);
}
for (const [id, t] of allItems) if (!ITEM_SPRITES[id]) fail('objet sans sprite:', id, '(' + t + ')');

console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
process.exitCode = problems ? 1 : 0;
