// Fluidite : compteur de Verdure continu (jamais au-dessus de la vraie valeur), fondu des fenetres,
// bulle de Papi de taille fixe pendant l'ecriture, boutons des quetes gardes d'un rendu a l'autre.
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
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 5000, totalPlayTimeSec: 5000 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = { stagiaire: 40, voisin: 40, poubelleCompost: 40 };
    st.automation = { ...st.automation, buyCompanions: false, abilities: false };
    window.saveGame = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload(); await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(1500);

  console.log('=== 1. compteur de Verdure continu ===');
  const c = await p.evaluate(() => new Promise(res => {
    const el = document.getElementById('verdureCount'), vus = new Set(); let depasse = 0, images = 0;
    const t0 = performance.now();
    const boucle = () => {
      vus.add(el.textContent); images++;
      if (_compteur.affiche > state.verdure + 1e-6) depasse++;
      if (performance.now() - t0 < 2000) requestAnimationFrame(boucle); else res({ valeurs: vus.size, images, depasse, cps: totalCps() });
    };
    requestAnimationFrame(boucle);
  }));
  console.log('  ', JSON.stringify(c));
  verifie(c.valeurs >= 20, 'le compteur doit changer souvent en 2 s (avant : 2 fois), vu', c.valeurs);
  verifie(c.depasse === 0, 'le compteur a affiche plus que la vraie Verdure');
  const depense = await p.evaluate(() => new Promise(res => { state.verdure = Math.floor(state.verdure / 2); requestAnimationFrame(() => requestAnimationFrame(() => res({ affiche: _compteur.affiche, vraie: state.verdure }))); }));
  verifie(depense.affiche === depense.vraie, 'une depense doit s afficher aussitot', JSON.stringify(depense));

  console.log('=== 2. fenetres : fondu, et etat ferme immediat pour le jeu ===');
  const f = await p.evaluate(() => new Promise(res => {
    const o = document.getElementById('settingsModalOverlay');
    openModal('settingsModalOverlay');
    const entree = getComputedStyle(o).animationName;
    closeModal('settingsModalOverlay');
    const r = { entree, fermeeTout: !isOverlayOpen('settingsModalOverlay'), visibleEnSortie: getComputedStyle(o).display, sortie: getComputedStyle(o).animationName };
    const fermee = document.getElementById('questsModalOverlay');
    closeModal('questsModalOverlay'); r.dejaFermeeReste = getComputedStyle(fermee).display;
    setTimeout(() => { r.apres = getComputedStyle(o).display; res(r); }, 350);
  }));
  console.log('  ', JSON.stringify(f));
  verifie(f.entree === 'fenetreEntree', 'pas de fondu a l ouverture');
  verifie(f.fermeeTout && f.visibleEnSortie === 'flex' && f.sortie === 'fenetreSortie', 'pas de fondu a la fermeture, ou fenetre encore ouverte pour le jeu');
  verifie(f.apres === 'none', 'la fenetre reste affichee apres le fondu');
  verifie(f.dejaFermeeReste === 'none', 'fermer une fenetre deja fermee la fait reapparaitre');

  console.log('=== 2b. magasin : monte a l ouverture, redescend a la fermeture ===');
  const m = await p.evaluate(() => new Promise(res => {
    const o = document.getElementById('shopPageOverlay'), haut = () => Math.round(o.getBoundingClientRect().top);
    let recalages = 0; const compter = () => recalages++; window.addEventListener('gameviewportfit', compter);
    openModal('shopPageOverlay');
    const r = { entree: getComputedStyle(o).animationName };
    setTimeout(() => {
      r.pendantMontee = haut();
      setTimeout(() => {
        r.arrive = haut(); r.recalagesPendantMontee = recalages;
        window.removeEventListener('gameviewportfit', compter);
        closeModal('shopPageOverlay');
        r.sortie = getComputedStyle(o).animationName; r.fermePourLeJeu = !isOverlayOpen('shopPageOverlay');
        setTimeout(() => { r.pendantDescente = haut(); setTimeout(() => { r.apres = getComputedStyle(o).display; res(r); }, 350); }, 130);
      }, 400);
    }, 60);
  }));
  console.log('  ', JSON.stringify(m));
  verifie(m.entree === 'magasinMonte' && m.sortie === 'magasinDescend', 'animations de montee / descente absentes');
  verifie(m.pendantMontee > 0 && m.pendantMontee < 820 && m.arrive === 0, 'le magasin ne monte pas depuis le bas');
  verifie(m.pendantDescente > 0 && m.fermePourLeJeu && m.apres === 'none', 'le magasin ne redescend pas, ou reste affiche');
  verifie(m.recalagesPendantMontee >= 5, 'les reperes des tutoriels ne sont pas recales pendant la montee');

  console.log('=== 3. bulle de Papi : taille fixe pendant l ecriture ===');
  const h = await p.evaluate(() => new Promise(res => {
    // Texte volontairement plus long qu'une bulle normale : sans la correction, la bulle grandirait
    // pendant l'écriture (sa hauteur finale dépasse la hauteur minimale de 176 px).
    const lignes = tabAnnouncementLines(TAB_DEFS.find(t => t.id === 'prestige'));
    const ligne = lignes[4] + ' ' + lignes[5] + ' ' + lignes[6];
    hideDialogue(false); // une remarque de Papi deja en cours ferait attendre la bulle de test dans la file
    showDialogue('papi', [ligne], { position: 'top-right', typeSpeed: 8 });
    const box = document.getElementById('dialogueBox'), hauteurs = [];
    let k = 0; const it = setInterval(() => { hauteurs.push(Math.round(box.getBoundingClientRect().height)); if (++k >= 14) { clearInterval(it); hideDialogue(false); res({ hauteurs, n: ligne.length }); } }, 250);
  }));
  console.log('  ', JSON.stringify(h));
  verifie(h.hauteurs[h.hauteurs.length - 1] > 176, 'texte de test trop court pour prouver quelque chose');
  verifie(new Set(h.hauteurs).size === 1, 'la bulle change de hauteur pendant l ecriture');

  console.log('=== 4. quetes : boutons gardes, reclamation qui marche ===');
  const q = await p.evaluate(() => {
    state.dailyQuests = null; generateQuests();
    openModal('questsModalOverlay'); activeQuestsTab = 'quetes'; renderAll();
    const bouton0 = document.querySelector('#questList .claimBtn');
    const q0 = state.dailyQuests.quests[0];
    for (let i = 0; i < 5; i++) { state.dailyProgress[q0.type] = (state.dailyProgress[q0.type] || 0) + 1; renderAll(); }
    const memeBouton = document.querySelector('#questList .claimBtn') === bouton0;
    state.dailyProgress[q0.type] = q0.target; renderAll();
    const actif = !bouton0.disabled;
    bouton0.click();
    return { memeBouton, actif, reclamee: q0.claimed, libelle: bouton0.textContent };
  });
  console.log('  ', JSON.stringify(q));
  verifie(q.memeBouton, 'le bouton Reclamer est recree a chaque rendu');
  verifie(q.actif && q.reclamee && /Réclamée/.test(q.libelle), 'la reclamation d une quete ne marche plus');

  console.log('=== 5. barre de palier : glisse au lieu de sauter ===');
  const pal = await p.evaluate(() => new Promise(res => {
    closeModal('questsModalOverlay');
    state.verdure = 1e12; state.buildings.stagiaire = 12;
    openModal('shopPageOverlay'); activeShopTab = 'production'; state.buyMode = 1; renderAll();
    const fill = () => document.querySelector('#shop [data-row-id="stagiaire"] .palierFill');
    const avant = parseFloat(fill().style.width);
    buyBuilding('stagiaire', 5, true); renderAll(); // 12 -> 17 : la barre avance vers 70 %
    const cible = parseFloat(fill().style.width), transition = getComputedStyle(fill()).transitionProperty;
    setTimeout(() => { // au milieu de la transition (0,4 s)
      const enCours = fill().getBoundingClientRect().width / fill().parentElement.getBoundingClientRect().width * 100;
      closeModal('shopPageOverlay');
      res({ avant, cible, transition, enCours: Math.round(enCours) });
    }, 150);
  }));
  console.log('  ', JSON.stringify(pal));
  verifie(pal.avant === 20 && pal.cible === 70, 'largeurs de palier inattendues');
  verifie(/width/.test(pal.transition), 'pas de transition sur la barre de palier');
  verifie(pal.enCours > 20 && pal.enCours < 70, 'la barre saute directement a sa nouvelle largeur', pal.enCours);

  console.log('=== 6. galerie et succes : pas reconstruits a chaque rendu ===');
  const gs = await p.evaluate(() => {
    openModal('settingsModalOverlay'); activeSettingsTab = 'galerie'; renderAll();
    const carte = document.querySelector('#galleryGrid .galleryCard');
    renderAll(); renderAll();
    const galerieGardee = document.querySelector('#galleryGrid .galleryCard') === carte;
    const ouverte = document.querySelector('#galleryGrid .galleryCard:not(.locked)');
    if (ouverte) ouverte.click();
    const lightbox = getComputedStyle(document.getElementById('galleryLightboxOverlay')).display !== 'none';
    document.getElementById('galleryLightboxOverlay').style.display = 'none';
    closeModal('settingsModalOverlay');
    openModal('achievementsModalOverlay'); renderAll();
    const succes = document.querySelector('#achvList .achv');
    renderAll(); renderAll();
    const succesGarde = document.querySelector('#achvList .achv') === succes;
    closeModal('achievementsModalOverlay');
    return { galerieGardee, carteOuverte: !!ouverte, lightbox, succesGarde, nbSucces: document.querySelectorAll('#achvList .achv').length };
  });
  console.log('  ', JSON.stringify(gs));
  verifie(gs.galerieGardee, 'la galerie est reconstruite a chaque rendu');
  verifie(!gs.carteOuverte || gs.lightbox, 'cliquer une carte de la galerie n ouvre plus l image');
  verifie(gs.succesGarde && gs.nbSucces > 10, 'la liste des succes est reconstruite a chaque rendu');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
