// Evenements saisonniers : dates (dont Paques, qui bouge), priorite du plus court, bonus de
// production, badge, decor, herbe doree relookee, et remarque de Papi une seule fois par an.
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

  // 1. Paques (dimanches de Paques connus).
  const paques = await p.evaluate(() => [2024, 2025, 2026, 2027].map(a => {
    const d = paquesDe(a); return `${a}-${d.getMonth() + 1}-${d.getDate()}`;
  }));
  const attendu = ['2024-3-31', '2025-4-20', '2026-4-5', '2027-3-28'];
  verifie(JSON.stringify(paques) === JSON.stringify(attendu), 'dates de Paques fausses :', paques.join(' '), 'au lieu de', attendu.join(' '));

  // 2. Quel evenement a quelle date.
  const cas = [
    ['2026-10-31', 'halloween'], ['2026-10-24', null], ['2026-12-25', 'noel'], ['2026-01-02', 'nouvelAn'],
    ['2026-02-14', 'valentin'], ['2026-03-25', 'printemps'], ['2026-04-01', 'poisson'], ['2026-04-05', 'paques'],
    ['2026-06-25', 'ete'], ['2026-09-05', 'anniversaire'], ['2026-08-15', null], ['2026-11-15', null],
  ];
  const trouves = await p.evaluate(dates => dates.map(([d]) => {
    const [a, m, j] = d.split('-').map(Number);
    const ev = evenementActif(new Date(a, m - 1, j, 12));
    return ev ? ev.id : null;
  }), cas);
  cas.forEach(([date, id], i) => verifie(trouves[i] === id, `${date} : « ${trouves[i]} » au lieu de « ${id} »`));

  // 3. Le bonus entre bien dans la production, et seulement pendant l'evenement.
  const bonus = await p.evaluate(() => {
    const sans = totalProdMultiplier();
    _evenementForce = 'halloween';
    const avec = totalProdMultiplier();
    _evenementForce = null;
    return { sans, avec, mult: evenementMult() };
  });
  verifie(Math.abs(bonus.avec / bonus.sans - 1.10) < 1e-9, 'le bonus d Halloween ne s applique pas :', bonus.avec / bonus.sans);
  verifie(bonus.mult === 1, 'un bonus reste actif hors evenement :', bonus.mult);

  // 4. Badge, decor et herbe doree pendant un evenement force.
  const pendant = await p.evaluate(() => {
    _evenementForce = 'noel';
    renderAll();
    spawnGoldenWeed();
    const badge = document.getElementById('eventBadge');
    const decor = document.getElementById('eventDecor');
    return {
      badgeVisible: getComputedStyle(badge).display !== 'none',
      badgeTexte: badge.textContent,
      flocons: decor ? decor.children.length : 0,
      decorCliquable: decor ? getComputedStyle(decor).pointerEvents : 'absent',
      herbe: (document.querySelector('.golden') || {}).textContent,
    };
  });
  verifie(pendant.badgeVisible && /Noël/.test(pendant.badgeTexte) && /15/.test(pendant.badgeTexte), 'badge de Noel incorrect :', pendant.badgeTexte);
  verifie(pendant.flocons === 14, 'decor absent ou incomplet :', pendant.flocons);
  verifie(pendant.decorCliquable === 'none', 'le decor intercepte les clics :', pendant.decorCliquable);
  verifie(pendant.herbe === '🎁', 'herbe doree pas aux couleurs de Noel :', pendant.herbe);

  // 5. Retour a la normale quand l'evenement s'arrete.
  const apres = await p.evaluate(() => {
    _evenementForce = null;
    document.querySelectorAll('.golden').forEach(e => e.remove());
    renderAll();
    spawnGoldenWeed();
    return {
      badgeVisible: getComputedStyle(document.getElementById('eventBadge')).display !== 'none',
      decor: !!document.getElementById('eventDecor'),
      herbe: (document.querySelector('.golden') || {}).textContent,
    };
  });
  verifie(!apres.badgeVisible, 'le badge reste affiche hors evenement');
  verifie(!apres.decor, 'le decor reste affiche hors evenement');
  verifie(apres.herbe === '🌿✨', 'herbe doree pas revenue a la normale :', apres.herbe);

  // 6. Papi ne commente qu'une fois par evenement et par annee.
  const papi = await p.evaluate(async () => {
    state.evenementsVus = {};
    hideDialogue(false);
    _evenementForce = 'halloween';
    renderEvenement();
    const premiere = document.getElementById('dialogueOverlay').classList.contains('visible');
    hideDialogue(false);
    renderEvenement();
    const seconde = document.getElementById('dialogueOverlay').classList.contains('visible');
    const cles = Object.keys(state.evenementsVus);
    _evenementForce = null;
    return { premiere, seconde, cles };
  });
  verifie(papi.premiere, 'Papi ne dit rien au debut de l evenement');
  verifie(!papi.seconde, 'Papi recommente le meme evenement');
  verifie(papi.cles.length === 1 && /^halloween-\d{4}$/.test(papi.cles[0]), 'cle d evenement vue inattendue :', papi.cles.join(','));

  // 7. Mode test (Ctrl+Maj+D) : un bouton par saison, qui rejoue l'evenement en entier.
  await p.evaluate(() => { hideDialogue(false); state.evenementsVus = {}; document.querySelectorAll('.golden').forEach(e => e.remove()); });
  await p.keyboard.press('Control+Shift+D');
  await p.waitForTimeout(250);
  const panneau = await p.evaluate(() => {
    const boutons = [...document.querySelectorAll('#modeTestPanel button')].map(b => b.textContent.trim());
    return { ouvert: !!document.getElementById('modeTestPanel'), saisons: EVENEMENTS.filter(ev => boutons.includes(`${ev.emoji} ${ev.nom.fr}`)).length, aucune: boutons.includes('Aucune') };
  });
  verifie(panneau.ouvert, 'le panneau de mode test ne s ouvre pas');
  verifie(panneau.saisons === 9 && panneau.aucune, `${panneau.saisons} bouton(s) de saison sur 9, « Aucune » ${panneau.aucune ? 'present' : 'absent'}`);

  const clicSaison = (libelle) => p.evaluate(l => {
    const b = [...document.querySelectorAll('#modeTestPanel button')].find(x => x.textContent.trim() === l);
    if (!b) return false; b.click(); return true;
  }, libelle);

  verifie(await clicSaison('🎃 Halloween'), 'bouton Halloween absent du panneau');
  await p.waitForTimeout(400);
  const force = await p.evaluate(() => ({
    force: _evenementForce,
    badge: getComputedStyle(document.getElementById('eventBadge')).display !== 'none',
    decor: document.getElementById('eventDecor') ? document.getElementById('eventDecor').children.length : 0,
    herbe: (document.querySelector('.golden') || {}).textContent,
    papi: document.getElementById('dialogueOverlay').classList.contains('visible'),
    boutonActif: !![...document.querySelectorAll('#modeTestPanel button.actif')].find(b => /Halloween/.test(b.textContent)),
  }));
  verifie(force.force === 'halloween', 'la saison n est pas forcee :', force.force);
  verifie(force.badge && force.decor === 14, 'badge ou decor manquant depuis le mode test');
  verifie(force.herbe === '🎃', 'l herbe doree de la saison n est pas montree :', force.herbe);
  verifie(force.papi, 'Papi ne rejoue pas sa remarque de saison');
  verifie(force.boutonActif, 'le bouton de la saison en cours n est pas marque actif');

  // Recliquer sur la meme saison la coupe.
  await clicSaison('🎃 Halloween');
  await p.waitForTimeout(300);
  const coupe = await p.evaluate(() => ({ force: _evenementForce, decor: !!document.getElementById('eventDecor') }));
  verifie(coupe.force === null && !coupe.decor, 'recliquer sur la saison ne la coupe pas :', coupe.force);

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
