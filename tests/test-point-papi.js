// Après un Prestige ou une Ascension (voir faireLePoint dans ui/ceremonie.js) : Papi dit où dépenser
// ce qu'on vient de gagner et ce qui s'est débloqué, des pastilles signalent les onglets concernés, et
// la présentation d'un onglet qui apparaît attend qu'il ait fini. Vérifie aussi : prérequis nommés,
// bilan centré dès son apparition, contenu de l'Ascension caché avant la première, pas d'anneau de
// focus sur le bouton qui a ouvert une fenêtre refermée par Échap.
const { chromium } = require('playwright'); const path = require('path');
const { filePath, chargerPartie, finirScene } = require('./commun');
let pb = 0; const ok = (c, m, detail) => { console.log((c ? '  ok ' : '  X  ') + m + (!c && detail ? ' : ' + detail : '')); if (!c) pb++; };

async function partie(b, { prestigeCount, totalAscensions = 0, vus, type = 'prestige', lang = 'fr' }) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => { console.log('  pageerror', e.message); pb++; });
  await p.goto(filePath);
  await chargerPartie(p, { lang, totalClicks: 5000, totalPlayTimeSec: 99999, prestigeCount, totalAscensions, cosmicSeeds: 4, totalSeedsEarned: 5,
    seedsSinceAscension: 5, totalShardsEarned: totalAscensions, stellarShards: 0, buildings: { stagiaire: 40 }, achievements: { a: true } }, { vus });
  await p.evaluate(() => { hideDialogue(false); window.spawnGoldenWeed = () => {}; window.spawnButterflies = () => {};
    window._dits = []; const orig = showDialogue; window.showDialogue = (c, l, o) => { window._dits.push([].concat(l)); return orig(c, l, o); };
    const scene = showScene; window.showScene = (ex, o) => { window._dits.push(ex.map(e => L(e, 'text'))); return scene(ex, o); };
    window._toasts = []; const t = showToast; window.showToast = (m, ...r) => { window._toasts.push(m); return t(m, ...r); }; });
  await p.waitForTimeout(300);
  await p.evaluate((type) => {
    if (type === 'prestige') state.verdure = verdureForSeeds(2) * 1.01; else { state.seedsSinceAscension = seedsForShards(1) * 1.01; state.totalSeedsEarned = Math.max(state.totalSeedsEarned, state.seedsSinceAscension); }
    state.reduireAnimations = true; ouvrirDecision(type); confirmerDecision();
  }, type);
  await p.waitForTimeout(200);
  await p.evaluate(() => clicCeremonie()); // ferme le bilan
  await p.waitForTimeout(600);
  return p;
}
async function lirePoint(p) {
  return p.evaluate(() => ({
    dits: window._dits.map(x => x.join(' || ')), toasts: window._toasts,
    aVoir: [..._ongletsAVoir], enCours: sceneAffichee(),
    shopPastille: document.getElementById('shopBtn').classList.contains('aNouveau'),
    quetesPastille: document.getElementById('questsBtn').classList.contains('aNouveau'),
    annonceLancee: _tabsQueuedForAnnounce.size > 0 || !!_pendingSpotlightGroup,
  }));
}
async function finirPoint(p) {
  await finirScene(p);
  await p.waitForTimeout(1500); // un tick de jeu : la présentation des nouveaux onglets peut démarrer
  return p.evaluate(() => ({ enCours: sceneAffichee(), annonce: !!_pendingSpotlightGroup, dernier: window._dits.at(-1).join(' || ') }));
}

(async () => {
  const b = await chromium.launch();
  const base = ['production', 'clic', 'batiments', 'special', 'recherche', 'prestige', 'quetes', 'dailyreward', 'succes', 'options', 'stats', 'galerie'];

  console.log('=== 1er Prestige (Familiers et Défi apparaissent) ===');
  let p = await partie(b, { prestigeCount: 0, vus: base });
  let r = await lirePoint(p); console.log('   ' + r.dits.join('\n   '));
  ok(r.enCours && /Graines Cosmiques en poche/.test(r.dits[0]) && /du nouveau à te montrer/.test(r.dits[0]), 'point complet : Graines + « du nouveau à te montrer »');
  ok(!r.annonceLancee, 'la presentation des nouveaux onglets attend la fin du point');
  ok(r.aVoir.join() === 'prestige' && r.shopPastille && !r.quetesPastille, 'pastille sur Prestige et sur SHOP (' + r.aVoir + ')');
  let f = await finirPoint(p); console.log('   apres :', f.dernier);
  ok(!f.enCours && f.annonce && /débloqué/.test(f.dernier), 'le point fini, Papi presente le nouvel onglet');
  await p.close();

  // Un moment important : Papi parle en scène, en grand, et rien d'autre ne se fait pendant ce temps.
  // (En petite bulle, le joueur ouvrait le magasin par-dessus et ne lisait pas.)
  console.log('=== 1er Prestige : le point est une scene, rien d autre ne se fait ===');
  p = await partie(b, { prestigeCount: 0, vus: base });
  const scene = await p.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return !!el && el.getClientRects().length > 0; };
    return { scene: document.getElementById('sceneOverlay').classList.contains('visible'), nom: document.getElementById('sceneName').textContent,
      papi: vis('scenePortraitLeft'), leroy: vis('scenePortraitRight'), passer: vis('sceneSkipBtn'), shop: vis('shopBtn'), menus: vis('settingsBtn') };
  });
  ok(scene.scene && /Papi/.test(scene.nom) && scene.papi && !scene.leroy, 'Papi seul, en grand, dans la scene', JSON.stringify(scene));
  ok(!scene.passer && !scene.shop && !scene.menus, 'ni bouton Passer, ni SHOP, ni menus pendant la scene', JSON.stringify(scene));
  const v0 = await p.evaluate(() => state.totalClicks);
  await p.mouse.click(640, 480); await p.waitForTimeout(200);
  ok(await p.evaluate((v0) => state.totalClicks === v0 && sceneAffichee(), v0), 'un clic sur l ecran ne clique pas le jardin : il fait avancer Papi');
  f = await finirPoint(p);
  ok(!f.enCours && f.annonce && /Familiers/.test(f.dernier), 'la scene finie, Papi presente Familiers', f.dernier);
  ok(await p.evaluate(() => ['shopBtn', 'settingsBtn'].every(id => document.getElementById(id).getClientRects().length > 0)), 'les boutons reviennent apres la scene');
  await p.close();

  console.log('=== 3e Prestige (Grenouille, defi Tempete, onglet Automatisation) ===');
  p = await partie(b, { prestigeCount: 2, vus: [...base, 'familiers', 'defi'] });
  r = await lirePoint(p); console.log('   ' + r.dits.join('\n   ') + '\n   toasts: ' + r.toasts.join(' | '));
  const d = r.dits[0];
  ok(/Grenouille/.test(d) && /Tempête sans fin/.test(d) && /du nouveau à te montrer/.test(d) && /monter tes familiers/.test(d), 'grenouille, defi, familiers, nouvel onglet annonces');
  ok(!/Achat automatique/.test(d), 'l automatisation (onglet qui apparait) laissee a sa presentation');
  ok(r.aVoir.sort().join() === 'defi,familiers,prestige' && r.shopPastille && r.quetesPastille, 'pastilles : ' + r.aVoir);
  await p.waitForTimeout(1200); r = await lirePoint(p);
  ok(!r.toasts.some(t => /Grenouille/.test(t)), 'pas de notification en doublon pour la Grenouille');
  await p.close();

  console.log('=== 4e Prestige (rien de nouveau) ===');
  p = await partie(b, { prestigeCount: 3, vus: [...base, 'familiers', 'defi', 'automatisation'] });
  r = await lirePoint(p); console.log('   ' + r.dits.join('\n   '));
  ok(!r.enCours && r.dits.length === 1 && !/Graines Cosmiques en poche/.test(r.dits[0]) && r.aVoir.length === 0 && !r.shopPastille, 'courte replique habituelle, aucune pastille', JSON.stringify(r));
  await p.close();

  console.log('=== 5e Prestige (defi Papi s installe) ===');
  p = await partie(b, { prestigeCount: 4, vus: [...base, 'familiers', 'defi', 'automatisation'] });
  r = await lirePoint(p); console.log('   ' + r.dits.join('\n   '));
  ok(r.enCours && /Papi s'installe/.test(r.dits[0]) && !/du nouveau à te montrer/.test(r.dits[0]), 'point complet pour le nouveau defi');
  await p.close();

  console.log('=== 1re Ascension, en anglais ===');
  p = await partie(b, { prestigeCount: 12, vus: [...base, 'familiers', 'defi', 'automatisation', 'ascension'], type: 'ascension', lang: 'en' });
  r = await lirePoint(p); console.log('   ' + r.dits.join('\n   '));
  const a = r.dits[0];
  ok(/Stellar Shard/.test(a) && /Ascension tab/.test(a) && /back to zero/.test(a) && /Owl/.test(a) && /automatic abilit|Automatic abilit|abilit/i.test(a) && /Closed Books/.test(a), 'eclats, remise a zero, chouette, automatisation, defi');
  ok(r.aVoir.sort().join() === 'ascension,automatisation,defi,familiers', 'pastilles : ' + r.aVoir);
  await finirPoint(p);
  // Ouvrir l'onglet Familiers efface sa pastille ; SHOP la garde tant qu'il en reste une.
  const apres = await p.evaluate(() => { document.getElementById('shopBtn').click(); renderAll();
    const btn = document.querySelector('#shopTabsRow [data-tab-id="familiers"]'); const avant = btn.className; btn.click(); renderAll();
    return { avant, apres: document.querySelector('#shopTabsRow [data-tab-id="familiers"]').className, aVoir: [..._ongletsAVoir], shop: document.getElementById('shopBtn').classList.contains('aNouveau') }; });
  console.log('   ', JSON.stringify(apres));
  ok(/aNouveau/.test(apres.avant) && !/aNouveau/.test(apres.apres) && apres.shop, 'pastille effacee a l ouverture de l onglet, SHOP la garde pour les autres');
  await p.close();

  console.log('=== Prerequis nommes (Prestige) ===');
  p = await partie(b, { prestigeCount: 3, vus: [...base, 'familiers', 'defi', 'automatisation'] });
  const txt = await p.evaluate(() => { openModal('shopPageOverlay'); activeShopTab = 'prestige'; renderAll(); return document.getElementById('prestigeShop').innerText; });
  const m = txt.match(/nécessite d'abord : [^)]+\)/g) || [];
  console.log('   ' + m.slice(0, 3).join('\n   '));
  ok(m.length > 0 && !/autre amélioration/.test(txt), 'chaque amelioration bloquee nomme la sienne');
  await p.close();

  // Grands moments en scène : un défi réussi (même au-delà des premiers Prestiges), et la découverte
  // de l'Ascension, que Papi explique en grand au lieu de petites bulles.
  console.log('=== Defi reussi : Papi felicite en scene ===');
  const partieDefi = async (defisFaits) => {
    const q = await b.newPage({ viewport: { width: 1280, height: 820 } });
    q.on('pageerror', e => { console.log('  pageerror', e.message); pb++; });
    await q.goto(filePath);
    await chargerPartie(q, { totalClicks: 5000, totalPlayTimeSec: 99999, prestigeCount: 5, cosmicSeeds: 4, totalSeedsEarned: 5, seedsSinceAscension: 5,
      challengeActive: 'mains', challengeStartPlayTime: 99000, challengesDone: defisFaits, buildings: { stagiaire: 40 } }, { pasVus: ['ascension'] });
    await q.evaluate(() => { hideDialogue(false); window._scenes = []; const s = showScene; window.showScene = (ex, o) => { window._scenes.push(ex.map(e => L(e, 'text')).join(' || ')); return s(ex, o); };
      state.verdure = verdureForSeeds(2) * 1.01; state.reduireAnimations = true; ouvrirDecision('prestige'); confirmerDecision(); });
    await q.waitForTimeout(300); await q.evaluate(() => clicCeremonie()); await q.waitForTimeout(600);
    const r = await q.evaluate(() => ({ scene: sceneAffichee(), texte: window._scenes.join(' ## '), faits: Object.keys(state.challengesDone || {}) }));
    await q.close();
    return r;
  };
  const premier = await partieDefi({});
  console.log('   ' + premier.texte.slice(0, 260));
  ok(premier.scene && /premier défi : 🙌 Mains dans les poches/.test(premier.texte) && /à toi pour toujours : \+10 % de production/.test(premier.texte), '1er defi reussi : scene de felicitations, avec sa recompense', premier.texte.slice(0, 200));
  const suivant = await partieDefi({ minimaliste: true });
  ok(suivant.scene && /Défi réussi : 🙌 Mains dans les poches/.test(suivant.texte) && !/premier défi/.test(suivant.texte), 'defi suivant : annonce en scene, sans le « premier »', suivant.texte.slice(0, 200));

  console.log('=== Decouverte de l Ascension : explication en scene ===');
  p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => { console.log('  pageerror', e.message); pb++; });
  await p.goto(filePath);
  await chargerPartie(p, { totalClicks: 5000, totalPlayTimeSec: 99999, prestigeCount: 5, totalSeedsEarned: 20, seedsSinceAscension: 20 }, { pasVus: ['ascension'] });
  await p.waitForFunction(() => _pendingSpotlightGroup === 'shop', { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => document.getElementById('shopBtn').click()); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('#shopTabsRow [data-tab-id="ascension"]').click()); await p.waitForTimeout(800);
  const asc = await p.evaluate(() => ({ scene: document.getElementById('sceneOverlay').classList.contains('visible'), solo: document.getElementById('sceneOverlay').classList.contains('solo'),
    texte: document.getElementById('sceneText').textContent + ' ' + _sceneQueue.map(e => L(e, 'text')).join(' '), bulle: isDialogueVisible(), onglet: activeShopTab }));
  ok(asc.scene && asc.solo && !asc.bulle && asc.onglet === 'ascension' && /Ascension/.test(asc.texte), 'Papi explique l Ascension en scene, onglet ouvert derriere', JSON.stringify({ ...asc, texte: asc.texte.slice(0, 80) }));
  await finirScene(p);
  const apresAsc = await p.evaluate(() => ({ decrit: !!state.tabsDescribed.ascension, magasin: isOverlayOpen('shopPageOverlay') }));
  await p.evaluate(() => fermerMagasin()); await p.waitForTimeout(400);
  const libere = await p.evaluate(() => _pendingSpotlightGroup === null && !_lockedToTabId);
  ok(apresAsc.decrit && apresAsc.magasin && libere, 'la scene finie, l onglet est marque explique et la presentation se termine normalement', JSON.stringify({ ...apresAsc, libere }));
  await p.close();

  console.log('=== Pastilles hors point de Papi : recompense a reclamer, Prestige automatique ===');
  // 1 Prestige avant la cérémonie, donc 2 après : le Prestige automatique fait le 3e, celui de la Grenouille.
  p = await partie(b, { prestigeCount: 1, vus: [...base, 'familiers', 'defi'] });
  await finirPoint(p);
  const pastilles = await p.evaluate(() => {
    const r = {}, lire = () => ({ quetes: document.getElementById('questsBtn').classList.contains('aNouveau'), shop: document.getElementById('shopBtn').classList.contains('aNouveau'), aVoir: [..._ongletsAVoir] });
    _ongletsAVoir.clear(); renderAll(); r.depart = lire();
    // Une quête terminée : pastille sur Quêtes jusqu'à ce qu'on la réclame.
    generateQuests(); const q = state.dailyQuests.quests[0]; state.dailyProgress[q.type] = q.target; renderAll(); r.queteFinie = lire();
    claimQuest(0); renderAll(); r.queteReclamee = lire();
    // Le bonus du jour disponible : pastille jusqu'à ce qu'il soit pris.
    state.lastDailyLoginDate = '2000-1-1'; renderAll(); r.bonusDispo = lire();
    claimDailyLoginReward(); renderAll(); r.bonusPris = lire();
    // Un Prestige automatique débloque la Grenouille (3e Prestige) : notification et pastilles.
    state.verdure = verdureForSeeds(2) * 1.01; doPrestige(); runAutomations(); renderAll(); r.auto = lire();
    r.toast = [...document.querySelectorAll('.toast')].some(t => /Grenouille/.test(t.textContent));
    return r;
  });
  console.log('   ', JSON.stringify(pastilles));
  ok(!pastilles.depart.quetes && !pastilles.depart.shop, 'au depart, aucune pastille');
  ok(pastilles.queteFinie.quetes && !pastilles.queteReclamee.quetes, 'quete terminee : pastille sur Quetes, partie une fois reclamee');
  ok(pastilles.bonusDispo.quetes && !pastilles.bonusPris.quetes, 'bonus du jour : pastille sur Quetes, partie une fois pris');
  ok(pastilles.toast && pastilles.auto.shop && pastilles.auto.aVoir.includes('familiers'), 'Prestige automatique : la Grenouille est annoncee, pastille sur Familiers et SHOP');
  await p.close();

  // Une partie avancée qu'on rouvre : rien de ce qui est déjà débloqué n'est annoncé au lancement.
  p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => { console.log('  pageerror', e.message); pb++; });
  await p.goto(filePath);
  await chargerPartie(p, { totalClicks: 5000, prestigeCount: 6, totalAscensions: 2 });
  await p.waitForTimeout(2500);
  const avalanche = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).filter(t => /Nouveau (défi|familier)|Nouvelle automatisation/.test(t)));
  ok(!avalanche.length, 'ancienne partie : rien de deja debloque n est annonce au lancement', avalanche.join(' | '));
  await p.close();

  console.log('=== Bilan centre, contenu de l Ascension cache, focus apres Echap ===');
  p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => { console.log('  pageerror', e.message); pb++; });
  await p.goto(filePath);
  await chargerPartie(p, { totalClicks: 5000, prestigeCount: 5, cosmicSeeds: 4, totalSeedsEarned: 4, seedsSinceAscension: 4, buildings: { stagiaire: 40 } });
  await p.evaluate(() => hideDialogue(false)); await p.waitForTimeout(500);

  // Le bilan apparaît directement au centre : son animation d'entrée écrasait la transformation
  // qui le centrait, il surgissait en bas à droite puis sautait au milieu.
  const pos = await p.evaluate(async () => {
    state.verdure = verdureForSeeds(2) * 1.01; state.reduireAnimations = false;
    ouvrirDecision('prestige'); confirmerDecision();
    await new Promise(r => setTimeout(r, 120)); afficherBilan();
    const centres = [], t0 = performance.now();
    while (performance.now() - t0 < 450) { const r = document.getElementById('ceremonieBilan').getBoundingClientRect(); centres.push(r.left + r.width / 2); await new Promise(r => requestAnimationFrame(r)); }
    return { centres, milieu: innerWidth / 2 };
  });
  const ecartMax = Math.round(Math.max(...pos.centres.map(c => Math.abs(c - pos.milieu))));
  ok(ecartMax <= 2, 'le bilan reste centre du debut a la fin de son apparition (ecart max ' + ecartMax + ' px)');
  await p.evaluate(() => { clicCeremonie(); }); await p.waitForTimeout(600);
  await p.evaluate(() => { hideDialogue(false); _ongletsAVoir.clear(); });

  // Familiers, automatisations et défis de l'Ascension : invisibles avant la première.
  const lire = () => p.evaluate(() => { openModal('shopPageOverlay'); activeShopTab = 'familiers'; renderAll();
    const f = [...document.querySelectorAll('#familiersList [data-row-id]')].map(e => e.dataset.rowId);
    activeShopTab = 'automatisation'; renderAll();
    const a = [...document.querySelectorAll('#automationList [data-row-id]')].map(e => e.dataset.rowId);
    renderDefi();
    const d = [...document.querySelectorAll('#defiListe [data-row-id]')].map(e => e.dataset.rowId);
    const texte = document.getElementById('familiersList').textContent + document.getElementById('automationList').textContent + document.getElementById('defiListe').textContent;
    closeModal('shopPageOverlay'); return { f, a, d, parleAscension: /Ascension/.test(texte) }; });
  const cacheAvant = await lire();
  ok(cacheAvant.f.join() === "escargot,grenouille" && cacheAvant.a.join() === "buyCompanions" && cacheAvant.d.length === 4 && !cacheAvant.parleAscension, 'avant : seulement ce que donne le Prestige, aucune mention de l Ascension ' + JSON.stringify(cacheAvant));
  await p.evaluate(() => { state.totalAscensions = 1; renderAll(); });
  const cacheApres = await lire();
  ok(cacheApres.f.length === 5 && cacheApres.a.length === 3 && cacheApres.d.length === 8, 'apres la 1re Ascension : tout est visible');

  // Échap referme la fenêtre sans laisser d'anneau de focus sur le bouton qui l'avait ouverte.
  for (const id of ['shopBtn', 'settingsBtn', 'achievementsBtn', 'questsBtn']) {
    await p.click('#' + id); await p.waitForTimeout(400);
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    const f = await p.evaluate((id) => { const el = document.getElementById(id); return { focus: document.activeElement === el, anneau: el.matches(':focus-visible') }; }, id);
    ok(!f.focus && !f.anneau, id + ' : pas d anneau de focus apres Echap');
  }
  await p.close();

  console.log(pb ? '\n' + pb + ' PROBLEME(S)' : '\nTOUT EST OK');
  process.exitCode = pb ? 1 : 0;
  await b.close();
})();
