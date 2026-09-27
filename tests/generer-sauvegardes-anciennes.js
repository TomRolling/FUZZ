// Fabrique les sauvegardes de référence des versions publiées (tests/sauvegardes-anciennes/), que
// test-anciennes-sauvegardes.js recharge dans le jeu actuel. Chaque sauvegarde est produite PAR SA
// VERSION : on extrait dist/ du tag git, on ouvre ce jeu-là, on y monte une partie avancée avec ses
// propres tables, et c'est sa propre fonction saveGame() qui écrit. Le format est donc le vrai
// format de l'époque, champs manquants et anciens noms compris.
// À relancer après chaque version publiée : node generer-sauvegardes-anciennes.js [tag...]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.join(__dirname, 'sauvegardes-anciennes');
const tags = process.argv.slice(2).length ? process.argv.slice(2)
  : execSync('git tag --list "v*" --sort=creatordate', { cwd: RACINE }).toString().split(/\s+/).filter(Boolean);

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch();
  for (const tag of tags) {
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'fuzz-' + tag + '-'));
    execSync(`git archive --format=tar ${tag} dist | tar -x -C "${dossier.split(path.sep).join('/')}"`, { cwd: RACINE, shell: 'bash' });
    const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
    const erreurs = [];
    p.on('pageerror', e => erreurs.push(e.message));
    await p.goto('file://' + path.join(dossier, 'dist', 'index.html').split(path.sep).join('/'));
    await p.waitForFunction(() => typeof state !== 'undefined' && typeof saveGame === 'function', { timeout: 20000 });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const s = state, a = (k, v) => { if (k in s) s[k] = v; };
      // Une partie avancée, avec ce que cette version connaît.
      a('langChosen', true); a('tutorialSeen', true);
      a('verdure', 1.234e9); a('totalEarned', 5.678e11); a('totalClicks', 4321); a('totalPlayTimeSec', 98765);
      a('knowledge', 777); a('cosmicSeeds', 13); a('totalSeedsEarned', 21); a('seedsSinceAscension', 21); a('prestigeCount', 6);
      a('stellarShards', 2); a('totalShardsEarned', 3); a('totalAscensions', 1);
      if (typeof BUILDINGS !== 'undefined' && s.buildings) BUILDINGS.slice(0, 6).forEach((x, i) => { s.buildings[x.id] = 25 - i * 3; });
      if (typeof CLICK_UPGRADES !== 'undefined' && s.clickUpgrades) CLICK_UPGRADES.slice(0, 3).forEach(x => { s.clickUpgrades[x.id] = true; });
      const tableRecherche = typeof RESEARCH !== 'undefined' ? RESEARCH : (typeof RESEARCH_TREE !== 'undefined' ? RESEARCH_TREE : null);
      if (tableRecherche && s.researchUpgrades) tableRecherche.filter(x => !x.requires).slice(0, 2).forEach(x => { s.researchUpgrades[x.id] = true; });
      if (typeof PRESTIGE_UPGRADES !== 'undefined' && s.prestigeUpgrades) PRESTIGE_UPGRADES.filter(x => !x.requires).slice(0, 2).forEach(x => { s.prestigeUpgrades[x.id] = true; });
      if (typeof UNIQUE_BUILDINGS !== 'undefined' && s.uniqueBuildings) UNIQUE_BUILDINGS.slice(0, 1).forEach(x => { s.uniqueBuildings[x.id] = true; });
      saveGame();
      const cle = typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : (localStorage.getItem('fuzzSave') ? 'fuzzSave' : 'jardinIdleSave');
      return { cle, brut: localStorage.getItem(cle), version: typeof VERSION_JEU !== 'undefined' ? VERSION_JEU : null };
    });
    await p.close();
    fs.rmSync(dossier, { recursive: true, force: true });
    if (!r.brut) { console.log(`${tag} : aucune sauvegarde écrite (clé ${r.cle})`, erreurs.slice(0, 2)); continue; }
    fs.writeFileSync(path.join(SORTIE, tag + '.json'), JSON.stringify({ tag, cle: r.cle, brut: r.brut }, null, 1));
    console.log(`${tag} : ${r.brut.length} caractères sous « ${r.cle} »${erreurs.length ? ' (erreurs de l\'époque : ' + erreurs.length + ')' : ''}`);
  }
  await b.close();
})();
