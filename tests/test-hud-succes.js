// Deux corrections d'affichage :
//  - « Frenesie » est le premier succes decroche, il doit donc etre en tete de liste (et les
//    succes secrets encore verrouilles en fin de liste, pour ne pas ouvrir sur un « ??? ») ;
//  - la bulle de Verdure garde la meme largeur quel que soit le nombre affiche, sinon toute la
//    ligne de bulles se decale a chaque chiffre.
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
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 1000 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(700);

  // 1. Une fois decroche, « Frenesie » ouvre la liste.
  const avecFrenesie = await p.evaluate(() => {
    state.achievements = { a_secret_clicker: true };
    openModal('achievementsModalOverlay');
    renderAll();
    const noms = [...document.querySelectorAll('#achvList .name')].map(e => e.textContent.trim());
    return { premier: noms[0], total: noms.length };
  });
  verifie(/Frénésie/.test(avecFrenesie.premier), 'le premier succes affiche n est pas Frenesie :', avecFrenesie.premier);

  // 2. Tant qu'il n'est pas decroche, aucun « ??? » n'ouvre la liste.
  const sansFrenesie = await p.evaluate(() => {
    state.achievements = {};
    renderAll();
    const noms = [...document.querySelectorAll('#achvList .name')].map(e => e.textContent.trim());
    return { premier: noms[0], dernier: noms[noms.length - 1], total: noms.length };
  });
  verifie(!/\?\?\?/.test(sansFrenesie.premier), 'la liste s ouvre sur un succes secret verrouille :', sansFrenesie.premier);
  verifie(/\?\?\?/.test(sansFrenesie.dernier), 'les secrets verrouilles ne sont pas en fin de liste :', sansFrenesie.dernier);
  verifie(sansFrenesie.total === avecFrenesie.total, 'des succes disparaissent de la liste :', sansFrenesie.total, 'contre', avecFrenesie.total);

  // 3. Chaque bulle chiffree garde sa place : meme largeur et meme position quelles que soient
  // les valeurs affichees, dans les deux langues, et sans que le texte soit coupe.
  await p.evaluate(() => {
    closeModal('achievementsModalOverlay');
    state.prestigeCount = 3; state.totalSeedsEarned = 60; state.totalAscensions = 1; // affiche graines et connaissances
  });
  const BULLES = ['verdureCount', 'rateText', 'seedsText', 'knowledgeText'];
  const VALEURS = [
    { verdure: 0, seeds: 0, know: 0, batiments: 0 },
    { verdure: 1234, seeds: 8, know: 42, batiments: 5 },
    { verdure: 999999, seeds: 240, know: 1850, batiments: 60 },
    { verdure: 4.2e12, seeds: 12500, know: 99000, batiments: 400 },
    { verdure: 8.7e33, seeds: 9.9e6, know: 9.9e6, batiments: 5000 },
    { verdure: 1.5e60, seeds: 9.9e9, know: 9.9e9, batiments: 100000 },
  ];
  for (const lang of ['fr', 'en']) {
    const mesures = [];
    for (const v of VALEURS) {
      mesures.push(await p.evaluate(({ v, lang, BULLES }) => {
        state.lang = lang;
        // Le compteur monte en douceur vers state.verdure : on le place directement sur la
        // valeur voulue, sinon le texte affiche reste celui de la mesure precedente.
        state.verdure = v.verdure;
        _compteur.affiche = _compteur.depart = _compteur.cible = v.verdure;
        state.cosmicSeeds = v.seeds; state.knowledge = v.know;
        state.buildings = {}; BUILDINGS.slice(0, 20).forEach(b => { state.buildings[b.id] = v.batiments; });
        animerCompteurVerdure(performance.now());
        renderAll();
        const out = {};
        for (const id of BULLES) {
          const el = document.getElementById(id);
          const r = el.getBoundingClientRect();
          out[id] = { largeur: Math.round(r.width), gauche: Math.round(r.left), haut: Math.round(r.top),
                      texte: el.textContent.trim(), coupe: el.scrollWidth > el.clientWidth + 1 };
        }
        return out;
      }, { v, lang, BULLES }));
    }
    for (const id of BULLES) {
      const largeurs = [...new Set(mesures.map(m => m[id].largeur))];
      const positions = [...new Set(mesures.map(m => m[id].gauche + 'x' + m[id].haut))];
      const coupes = mesures.filter(m => m[id].coupe);
      verifie(largeurs.length === 1, `${lang} : ${id} change de largeur (${largeurs.join(' / ')})`);
      verifie(positions.length === 1, `${lang} : ${id} se deplace (${positions.join(' / ')})`);
      verifie(coupes.length === 0, `${lang} : texte coupe dans ${id} : ${coupes.map(m => m[id].texte).join(' | ')}`);
    }
    console.log(`  ${lang} : ` + BULLES.map(id => `${id}=${mesures[0][id].largeur}px`).join(' '));
    console.log(`       valeurs extremes : ${mesures[mesures.length - 1].verdureCount.texte} | ${mesures[mesures.length - 1].rateText.texte} | ${mesures[mesures.length - 1].seedsText.texte} | ${mesures[mesures.length - 1].knowledgeText.texte}`);
  }
  await p.evaluate(() => { state.lang = 'fr'; renderAll(); });

  // 4. Le son de premiere acquisition doit rester nettement plus fort que les effets courants :
  // c'est un evenement rare, et il se perdait sous la musique.
  const volumes = await p.evaluate(async () => {
    const vrai = window.playTone;
    const vus = {};
    const espionne = (nom, fn) => { const v = []; window.playTone = (f, d, t, vol) => v.push(vol); fn(); vus[nom] = v; };
    espionne('premiereAcquisition', () => playFirstPurchaseSound());
    espionne('herbeDoree', () => playGoldenSound());
    espionne('succes', () => playAchievementSound());
    window.playTone = vrai;
    return vus;
  });
  const max = o => Math.max(...volumes[o]);
  console.log('  volumes :', Object.entries(volumes).map(([k, v]) => `${k}=${Math.max(...v)}`).join(' '));
  verifie(max('premiereAcquisition') >= 2 * max('herbeDoree'),
    'le son de premiere acquisition n est pas assez fort :', max('premiereAcquisition'), 'contre', max('herbeDoree'));
  verifie(max('premiereAcquisition') >= 2 * max('succes'),
    'le son de premiere acquisition ne se distingue pas du son de succes');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
