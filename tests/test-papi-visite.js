// Papi Feuillage : il parle en arrivant sur le terrain ET en repartant, chaque contexte a son
// pool, et les repliques respectent les regles d'ecriture du jeu (francais complet, pas de
// tiret cadratin, autant de phrases en francais qu'en anglais).
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
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1e6 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(800);

  // 1. Les pools : tous presents, equilibres fr/en, sans doublon interne.
  const pools = await p.evaluate(() => {
    const out = {};
    for (const [cat, pool] of Object.entries(PAPI_LINES)) {
      out[cat] = { fr: pool.fr.length, en: pool.en.length, doublonsFr: pool.fr.length - new Set(pool.fr).size };
    }
    return out;
  });
  for (const attendu of ['arrivee', 'leaving', 'prestige', 'ascension', 'meteo', 'nuit', 'defi', 'familier', 'capacite']) {
    verifie(pools[attendu], `pool « ${attendu} » absent`);
  }
  for (const [cat, n] of Object.entries(pools)) {
    verifie(n.fr === n.en, `${cat} : ${n.fr} phrases en francais contre ${n.en} en anglais`);
    verifie(n.doublonsFr === 0, `${cat} : ${n.doublonsFr} doublon(s) en francais`);
    verifie(n.fr >= 4, `${cat} : seulement ${n.fr} phrase(s), ca tournera en rond`);
  }
  const total = Object.values(pools).reduce((s, n) => s + n.fr, 0);
  console.log(`  ${Object.keys(pools).length} contextes, ${total} repliques par langue`);
  verifie(total >= 200, `seulement ${total} repliques, on en attend au moins 200`);

  // 2. Regles d'ecriture (voir les corrections de textes demandees par le joueur).
  const fautes = await p.evaluate(() => {
    const out = [];
    for (const [cat, pool] of Object.entries(PAPI_LINES)) {
      for (const l of pool.fr) {
        if (l.includes('—')) out.push(`${cat} (tiret cadratin) : ${l}`);
        if (/\b(t'as|t'es|j'suis|y'a)\b/i.test(l)) out.push(`${cat} (contraction) : ${l}`);
      }
      for (const l of pool.en) if (l.includes('—')) out.push(`${cat} EN (tiret cadratin) : ${l}`);
    }
    return out;
  });
  fautes.forEach(f => fail(f));

  // 3. Il parle en arrivant, avec une phrase du pool « arrivee ».
  const arrivee = await p.evaluate(async () => {
    hideDialogue(false);
    const vrai = Math.random; Math.random = () => 0; // force le declenchement
    maybeSpawnInvasive();
    Math.random = vrai;
    await new Promise(r => setTimeout(r, 300));
    const texte = document.getElementById('dialogueText').textContent;
    return {
      actif: !!(state.invasiveWeed && state.invasiveWeed.active),
      visible: document.getElementById('dialogueOverlay').classList.contains('visible'),
      duPool: PAPI_LINES.arrivee.fr.some(l => l.startsWith(texte.slice(0, 12))),
      texte,
    };
  });
  verifie(arrivee.actif, 'la visite de Papi ne se declenche pas');
  verifie(arrivee.visible, 'Papi ne dit rien en arrivant');
  verifie(arrivee.duPool, 'la phrase d arrivee ne vient pas du pool « arrivee » :', arrivee.texte);

  // 4. Il parle en repartant, avec une phrase du pool « leaving ».
  const depart = await p.evaluate(async () => {
    hideDialogue(false);
    for (let i = 0; i < 5; i++) clickInvasive();
    await new Promise(r => setTimeout(r, 300));
    const texte = document.getElementById('dialogueText').textContent;
    return {
      partie: !state.invasiveWeed,
      visible: document.getElementById('dialogueOverlay').classList.contains('visible'),
      duPool: PAPI_LINES.leaving.fr.some(l => l.startsWith(texte.slice(0, 12))),
      texte,
    };
  });
  verifie(depart.partie, 'la visite ne se termine pas apres les clics');
  verifie(depart.visible, 'Papi ne dit rien en repartant');
  verifie(depart.duPool, 'la phrase de depart ne vient pas du pool « leaving » :', depart.texte);

  // 5. La replique de depart n'est pas perdue si le joueur est dans un menu : elle attend.
  const enFile = await p.evaluate(async () => {
    hideDialogue(false);
    state.invasiveWeed = { active: true, needed: 1, done: 0 };
    openModal('shopPageOverlay');
    clickInvasive();
    await new Promise(r => setTimeout(r, 200));
    const pendantMenu = document.getElementById('dialogueOverlay').classList.contains('visible');
    closeModal('shopPageOverlay');
    flushPendingPapiCategories();
    await new Promise(r => setTimeout(r, 400));
    return { pendantMenu, apresMenu: document.getElementById('dialogueOverlay').classList.contains('visible') };
  });
  verifie(!enFile.pendantMenu, 'Papi parle par-dessus un menu ouvert');
  verifie(enFile.apresMenu, 'la replique de depart est perdue quand on etait dans un menu');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
