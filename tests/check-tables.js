const fs = require('fs');
const path = require('path');
// Le jeu est decoupe en fichiers (voir dist/jeu/). La liste qui fait autorite est celle des
// balises <script src> d'index.html, dans leur ordre de chargement : la lire evite de ramasser
// un .js etranger tombe dans le dossier (cache d'outil, sauvegarde), qui serait analyse comme
// s'il etait le jeu.
const RACINE = path.resolve(__dirname, '../dist');
const INDEX = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
const FICHIERS_JEU = [...INDEX.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const SOURCES = FICHIERS_JEU.map(rel => ({ rel, code: fs.readFileSync(path.join(RACINE, rel), 'utf8') }));
const html = [INDEX].concat(SOURCES.map(s => s.code)).join('\n');

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

// ===== Decoupage en fichiers : trois invariants que rien d'autre ne verifie =====
// Le jeu partage un seul espace global entre 23 fichiers charges a la suite. Trois pannes
// deviennent possibles, toutes silencieuses, et aucune n'existait du temps du fichier unique.
const declare = new Map();          // nom -> premier fichier qui le declare
const doublons = [];
for (const { rel, code } of SOURCES) {
  for (const m of code.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (declare.has(m[1])) doublons.push(`${m[1]} : ${declare.get(m[1])} et ${rel}`);
    else declare.set(m[1], rel);
  }
}
// 1. Unicite : deux fichiers qui declarent le meme nom, c'est le dernier charge qui gagne,
//    en silence. Impossible avant le decoupage, invisible aujourd'hui.
for (const d of doublons) fail('nom declare dans deux fichiers:', d);

// 2. Ordre : une ligne executee AU CHARGEMENT ne peut utiliser qu'un nom deja declare, le
//    hissage des fonctions ne traversant pas les fichiers.
const rang = new Map(FICHIERS_JEU.map((f, i) => [f, i]));
for (const { rel, code } of SOURCES) {
  for (const ligne of code.split(/\r?\n/)) {
    // Colonne 0 SANS indentation : c'est ce qui distingue une instruction executee au
    // chargement d'un appel ecrit dans un corps de fonction, qui lui se resout a l'execution.
    if (!/^[A-Za-z_$][\w$]*\(/.test(ligne)) continue;
    const appel = ligne.match(/^([A-Za-z_$][\w$]*)\(/)[1];
    const ou = declare.get(appel);
    if (ou && rang.get(ou) > rang.get(rel)) {
      fail(`appel au chargement avant sa declaration: ${appel}() dans ${rel}, declare dans ${ou}`);
    }
  }
}

// 3. Completude : un fichier present sur le disque mais absent d'index.html ne s'execute
//    jamais, et rien ne le signale.
const surDisque = [];
(function parcours(d, prefixe) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) parcours(p, prefixe + e.name + '/');
    else if (e.name.endsWith('.js')) surDisque.push(prefixe + e.name);
  }
})(path.join(RACINE, 'jeu'), 'jeu/');
const charges = new Set(FICHIERS_JEU);
for (const f of surDisque) if (!charges.has(f)) fail('fichier jamais charge par index.html:', f);
for (const f of FICHIERS_JEU) if (!fs.existsSync(path.join(RACINE, f))) fail('script introuvable sur le disque:', f);
console.log(`decoupage: ${FICHIERS_JEU.length} fichiers charges, ${declare.size} noms de premier niveau, ${doublons.length} doublon(s)`);

console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
process.exitCode = problems ? 1 : 0;
