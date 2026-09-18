// Passe statique de traduction sur dist/index.html :
//  1. champs bilingues { fr, en } incomplets ;
//  2. cles presentes dans UI_STRINGS.fr mais absentes de UI_STRINGS.en (et l'inverse) ;
//  3. chaines francaises ecrites en dur dans le JS, hors des regions « fr: » et hors
//     ternaires de langue (en ? ... : ..., state.lang === 'en').
// Complete test-traduction.js, qui lui verifie a l'execution ce qui s'affiche vraiment.
const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '../dist/index.html'), 'utf8');

const MOTS_FR = /\b(le|la|les|des|une|du|de|tu|ton|ta|tes|vous|pour|avec|coût|prêt|prête|jardin|graine|graines|éclat|éclats|verdure|améliore|gagne|chaque|toutes|tous|sans|déjà|encore|quand|dans|sur|par)\b/i;
const ACCENTS = /[éèêëàâçùûîïôœ]/i;
const sentFrancais = s => ACCENTS.test(s) || MOTS_FR.test(s);
const problemes = [];
const ligneDe = i => src.slice(0, i).split('\n').length;

// --- 1. paires { fr: '...', en: '...' } ---
const re = /\bfr:\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1\s*(,\s*en:\s*(['"`])((?:\\.|(?!\4)[\s\S])*?)\4)?/g;
let m, total = 0;
while ((m = re.exec(src))) {
  total++;
  if (m[3] === undefined) problemes.push(`L${ligneDe(m.index)} [en manquant] ${m[2].slice(0, 90)}`);
  else if (m[5] === m[2] && sentFrancais(m[2])) problemes.push(`L${ligneDe(m.index)} [en identique au fr] ${m[2].slice(0, 90)}`);
}

// --- 2. UI_STRINGS.fr vs UI_STRINGS.en ---
const debut = src.indexOf('const UI_STRINGS = {');
const bloc = src.slice(debut, src.indexOf('\n};', debut));
const blocFr = bloc.slice(bloc.indexOf('fr: {'), bloc.indexOf('en: {'));
const blocEn = bloc.slice(bloc.indexOf('en: {'));
const cles = b => new Set([...b.matchAll(/(?:^|[{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)].map(x => x[1]).filter(k => k !== 'fr' && k !== 'en'));
const clesFr = cles(blocFr), clesEn = cles(blocEn);
for (const k of clesFr) if (!clesEn.has(k)) problemes.push(`UI_STRINGS : « ${k} » absent de en`);
for (const k of clesEn) if (!clesFr.has(k)) problemes.push(`UI_STRINGS : « ${k} » absent de fr`);

// --- 3. francais en dur ---
// Parcours caractere par caractere du JS : on repere les chaines, et on masque toute region
// qui est la valeur d'une cle « fr » (chaine, tableau ou objet, meme sur plusieurs lignes).
const scripts = [...src.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)];
const chaines = [];   // { texte, index, masquee }
for (const s of scripts) {
  const code = s[1], base = s.index + s[0].indexOf(code);
  let i = 0, finFr = -1;            // finFr : position de fin de la region « fr: » courante
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') { i = code.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && code[i + 1] === '*') { const f = code.indexOf('*/', i); i = f < 0 ? code.length : f + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1;
      chaines.push({ texte: code.slice(i + 1, j), index: base + i, masquee: i < finFr });
      i = j + 1; continue;
    }
    // cle « fr » : on saute toute sa valeur
    if (c === 'f' && code.slice(i, i + 3).match(/^fr\s*$/) === null && /^fr\s*:/.test(code.slice(i, i + 5)) && !/[\w$]/.test(code[i - 1] || ' ')) {
      let j = code.indexOf(':', i) + 1;
      while (/\s/.test(code[j])) j++;
      const ouvrant = code[j];
      if (ouvrant === '[' || ouvrant === '{') {
        const fermant = ouvrant === '[' ? ']' : '}';
        let prof = 0, k = j;
        for (; k < code.length; k++) {
          const d = code[k];
          if (d === '"' || d === "'" || d === '`') { let l = k + 1; while (l < code.length && code[l] !== d) l += code[l] === '\\' ? 2 : 1; k = l; continue; }
          if (d === ouvrant) prof++;
          else if (d === fermant && --prof === 0) break;
        }
        finFr = Math.max(finFr, k);
      }
      i += 2; continue;
    }
    i++;
  }
}
const lignesSrc = src.split('\n');
// MODE_TEST_ACTIONS + le panneau qui va avec : outil de dev, jamais traduit.
const LIGNE_MODE_TEST = [
  ligneDe(src.indexOf('const MODE_TEST_ACTIONS')),
  ligneDe(src.indexOf('// ================= IDLE TICK', src.indexOf('const MODE_TEST_ACTIONS'))),
];
const ACCENT_FR = /[éèêëàâçùûîïôœÉÈÊÀÇÔ]/;
const MOT_SEUL = /\b(le|la|les|des|une|du|tu|ton|ta|vous|pour|avec|sans|chaque|toutes|tous|quand|dans|par|aucun|aucune|maintenant|fermer|annuler|suivant)\b/i;
for (const ch of chaines) {
  if (ch.masquee) continue;
  // Un gabarit qui contient un commentaire de code : seul le texte affiche compte.
  const s = ch.texte.split(' // ')[0];
  if (s.length < 3) continue;
  if (!ACCENT_FR.test(s) && !MOT_SEUL.test(s)) continue;
  if (/^[\w.#\/-]+$/.test(s)) continue;                       // selecteurs, chemins, ids
  // Un gabarit imbrique (backticks dans un ${...}) peut etre mal decoupe ici : ce qui en sort
  // contient alors du code, jamais du texte affiche.
  if (/=>|\bfunction\s*\(|\bonclick:/.test(s)) continue;
  const n = ligneDe(ch.index);
  const ligne = lignesSrc[n - 1] || '';
  // Le panneau de mode test et la console ne sont pas de l'interface joueur.
  if (n >= LIGNE_MODE_TEST[0] && n <= LIGNE_MODE_TEST[1]) continue;
  if (/console\.|modeTest|MODE_TEST/.test(ligne)) continue;
  // Deja gere : ternaire de langue dans la chaine elle-meme (gabarit multi-ligne) ou sur
  // les lignes qu'elle occupe.
  // On remonte de quelques lignes : le `state.lang === 'en' ?` ou le `selonLangue(` qui prend
  // la chaine en charge est souvent au-dessus, surtout pour un appel etale sur plusieurs lignes.
  // (15 lignes : un bloc `if (state.lang === 'en') { ... }` peut preceder toute une serie de
  // retours francais, comme dans questLabel.)
  const occupe = lignesSrc.slice(Math.max(0, n - 15), ligneDe(ch.index + s.length)).join('\n');
  if (/selonLangue\(|\ben\s*\?|lang\s*===\s*'en'|lang\s*===\s*"en"|\bfr:/.test(s + '\n' + occupe)) continue;
  problemes.push(`L${n} [francais en dur] ${s.replace(/\s+/g, ' ').slice(0, 100)}`);
}

console.log(`champs bilingues : ${total} | cles UI_STRINGS : fr ${clesFr.size}, en ${clesEn.size} | chaines JS : ${chaines.length} (dont ${chaines.filter(c => c.masquee).length} cote fr)`);
console.log(`problemes : ${problemes.length}`);
for (const p of problemes.slice(0, 80)) console.log('  ' + p);
if (problemes.length > 80) console.log(`  ... et ${problemes.length - 80} autres`);
process.exitCode = problemes.length ? 1 : 0;
