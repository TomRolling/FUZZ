// Audit : chaque élément de l'écran principal a-t-il sa place, sans gêner les autres ?
// Deux façons de se gêner, vérifiées toutes les deux :
//   1. se CHEVAUCHER à l'écran : deux éléments d'interface qui se recouvrent (le combo collé au bouton
//      SHOP en était un). On met le jeu dans l'état le plus chargé possible, à plusieurs tailles de
//      fenêtre, et on mesure chaque paire.
//   2. se faire BASCULER de calque : une animation confiée à la carte graphique oblige le navigateur à
//      sortir sur un calque ce qui est dessiné par-dessus, puis à le réintégrer. Une image ou un texte
//      n'a pas tout à fait le même rendu sur un calque et dans la page : chaque aller-retour se voit
//      (« se pixellise puis redevient net »). On observe l'arbre des calques de Chromium (CDP
//      LayerTree) et on compte, pour chaque élément, ses passages page <-> calque.
// Usage : node audit-chevauchements.js            (sortie : liste des problemes, code 1 s'il y en a)
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

// Éléments d'interface qui doivent chacun avoir leur place. Les décors (habitants, particules, herbe
// dorée, décor saisonnier) ont le droit de passer derrière ou devant : ils ne sont pas dans la liste.
const UI = ['.wordmark', '#weatherBadge', '#eventBadge', '#verdureCount', '#rateText', '#seedsText', '#knowledgeText',
  '.progressBarWrap', '#nextPurchaseLabel', '#nextGoalBox', '#invasiveBox', '#boostRow .boostChip', '#clickText', '#comboBadge',
  '#companion', '#abilityBar .abilityBtn', '#settingsBtn', '#achievementsBtn', '#questsBtn', '#shopBtn', '#dialogueBox',
  '#toastContainer .toast'];

// minimal : une partie qui commence, rien d'autre (pas de Prestige donc pas de familier qui se
// balance, pas d'événement saisonnier, pas de capacité ni d'herbes invasives, pas de bonus). C'est
// dans cet état qu'une animation fait vraiment basculer ses voisins : un halo qui pulse en continu,
// ou des succès débloqués au chargement (notifications), gardent tout sur un calque et masquent les
// bascules. L'ancien défaut du bouton SHOP ne se voyait qu'ici.
// creatures = 0 : jardin vide (début de partie, lendemain d'un Prestige). Une créature vit sur un calque
// permanent, et tout ce qui passe par-dessus elle aussi : un jardin peuplé masque donc les bascules.
// capacite : une capacité possédée et prête (son halo pulse), à utiliser pendant l'observation.
async function etatCharge(p, { creatures = 1, zoom = 1, minimal = false, capacite = false } = {}) {
  await p.goto(filePath);
  await p.evaluate(({ creatures, zoom, minimal, capacite }) => {
    const st = minimal
      ? { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 4.2e7, totalClicks: 3000, buildings: { stagiaire: 60 } }
      : { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(), verdure: 4.2e7, totalEarned: 1e9,
          totalClicks: 3000, prestigeCount: 3, cosmicSeeds: 12, totalSeedsEarned: 20, totalAscensions: 1, stellarShards: 2, knowledge: 40, zoomUI: zoom,
          buildings: Object.fromEntries(BUILDINGS.slice(0, Math.max(1, creatures)).map((x, i) => [x.id, 60 - i * 4])),
          uniqueBuildings: { siffletMare: true, grelotVent: true, tamtamCrapauds: true, chatJardin: true },
          activeCooldowns: { grelotVent: Date.now() + 5 * 60000 }, automation: { ...state.automation, abilities: false },
          invasiveWeed: { active: true, needed: 5, done: 2 } };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    if (capacite) { st.uniqueBuildings = { siffletMare: true }; st.activeCooldowns = {}; st.automation = { ...st.automation, abilities: false }; }
    window.saveGame = () => {}; localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  }, { creatures, zoom, minimal, capacite });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 20000 });
  await p.evaluate(({ creatures, minimal }) => {
    hideDialogue(false);
    if (!creatures) ITEM_SPRITES.stagiaire.provisoire = true;
    window._spawnOr = spawnGoldenWeed; window._spawnPap = spawnButterflies;
    window.spawnGoldenWeed = () => {}; window.spawnButterflies = () => {};
    // Plusieurs créatures : on prête le dessin du têtard aux autres sortes (le jardin de demain).
    for (const x of BUILDINGS.slice(1, creatures)) ITEM_SPRITES[x.id] = { src: ITEM_SPRITES.stagiaire.src, kind: 'building' };
    if (!minimal) {
      _evenementForce = EVENEMENTS[0].id;
      startTimedBoost('golden', 2, 60000); startTimedBoost('papillon', 1.25, 60000); startTimedBoost('ability', 1.5, 60000);
    }
    comboCount = minimal ? 0 : 20; updateComboBadge();
    renderAll();
  }, { creatures, minimal });
  // AUDIT_CSS : styles injectés pour vérifier que l'audit détecte bien un défaut connu (témoin négatif).
  if (process.env.AUDIT_CSS) await p.addStyleTag({ content: process.env.AUDIT_CSS });
  await p.waitForTimeout(1200);
}

// Boîte VISIBLE d'un élément : pour un bloc qui ne contient que du texte, la boîte du texte lui-même
// (un titre centré occupe toute la largeur, son texte non).
async function boites(p) {
  return p.evaluate((UI) => {
    const out = [];
    for (const sel of UI) { const tous = [...document.querySelectorAll(sel)]; for (const el of tous) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || !el.offsetParent && cs.position !== 'fixed') continue;
      let r = el.getBoundingClientRect();
      if (!el.children.length && el.textContent.trim() && cs.display === 'block') { const g = document.createRange(); g.selectNodeContents(el); r = g.getBoundingClientRect(); }
      if (r.width < 1 || r.height < 1) continue;
      out.push({ nom: sel + (tous.length > 1 ? '[' + tous.indexOf(el) + ']' : ''), g: r.left, h: r.top, d: r.right, b: r.bottom });
    } }
    return out;
  }, UI);
}
function chevauchements(liste) {
  const res = [];
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j];
    const w = Math.min(a.d, b.d) - Math.max(a.g, b.g), h = Math.min(a.b, b.b) - Math.max(a.h, b.h);
    if (w > 1 && h > 1) res.push(`${a.nom} / ${b.nom} (${Math.round(w)}x${Math.round(h)} px)`);
  }
  return res;
}

// Éléments présents dès le départ mais faits pour apparaître, bouger et disparaître : leur passage sur
// un calque est leur propre animation, pas celle d'un voisin.
const EPHEMERES = new Set(['.particle', '.floatText', '.golden', '.toast', '#toastContainer', '#dialogueOverlay', '#dialogueBox', '#eventDecor', '#comboBadge', '#boostRow']);
// Bascules normales : l'élément ne subit pas l'animation d'un voisin, c'est la sienne, ou il change
// de contenu au même instant. Chacune porte sa raison : une nouvelle entrée ici doit se justifier.
const ATTENDUS = {
  '.abilityBtn': 'son propre halo « prête » (pseudo-élément) naît et s éteint ; fond et bordure unis ne changent pas d aspect',
  '.abilityTime': 'bascule au moment même où son texte apparaît (capacité utilisée)',
  '#verdureCount': 'son propre sursaut quand la Verdure fait un bond',
};

(async () => {
  const b = await chromium.launch();
  let problemes = 0;

  console.log('=== 1. chevauchements, etat le plus charge ===');
  const tailles = [
    ['1280x820 (fenetre par defaut)', { width: 1280, height: 820 }, 1, 1],
    ['1024x640 (petite fenetre)', { width: 1024, height: 640 }, 1, 1],
    ['1366x768 (portable courant)', { width: 1366, height: 768 }, 1, 1],
    ['1536x864 a 125 % (Windows)', { width: 1536, height: 864 }, 1.25, 1],
    ['1920x1080 (agrandie)', { width: 1920, height: 1080 }, 1, 1],
    ['1280x820, interface agrandie x1.3', { width: 1280, height: 820 }, 1, 1.3],
  ];
  for (const [nom, viewport, dpr, zoom] of tailles) {
    const p = await b.newPage({ viewport, deviceScaleFactor: dpr });
    await etatCharge(p, { zoom });
    const vus = new Set();
    // Seules les deux positions que le jeu emploie : en haut à droite (répliques de Papi) et en bas à
    // gauche (défaut : tutoriel, présentations). Les deux autres ne servent jamais.
    const dire = (pos) => { hideDialogue(false); document.getElementById('toastContainer').innerHTML = '';
      showDialogue('papi', ['Un petit mot de Papi, assez long pour prendre la place qu il prend vraiment a l ecran.'], { position: pos });
      showToast('Une notification de test'); showToast('Une seconde notification, un peu plus longue que la premiere'); };
    for (const [moment, prep, arg] of [
      ['charge', () => {}],
      ['Papi bas-gauche + notif.', dire, 'bottom-left'],
      ['Papi haut-droite + notif.', dire, 'top-right'],
      ['sans Papi, 3 notif.', () => { hideDialogue(false); document.getElementById('toastContainer').innerHTML = ''; for (const m of ['Premiere notification', 'Deuxieme notification un peu plus longue', 'Troisieme']) showToast(m); }],
    ]) {
      await p.evaluate(prep, arg); await p.waitForTimeout(500);
      for (const c of chevauchements(await boites(p))) if (!vus.has(c)) { vus.add(c); console.log(`  X ${nom.padEnd(34)} ${moment.padEnd(24)} ${c}`); problemes++; }
    }
    if (!vus.size) console.log(`  ok ${nom}`);
    await p.close();
  }

  console.log('=== 2. bascules page <-> calque provoquees par les animations ===');
  for (const [creatures, minimal, capacite] of [[0, true], [1, true], [1, true, true], [1, false], [12, false]]) {
    const p = await b.newPage({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 });
    await etatCharge(p, { creatures, minimal, capacite });
    const cdp = await p.context().newCDPSession(p);
    // Chaque élément est suivi par une SIGNATURE STABLE, celle que verrait le joueur : la chaîne des
    // identifiants (id, data-row-id) qui mène à lui, plus sa classe. « L'icône de la capacité sifflet »
    // garde la même signature quand la barre des capacités la reconstruit ; son numéro interne, lui,
    // change. Suivi par numéro, l'audit voyait un élément mourir et un autre naître, jamais la bascule :
    // il avait manqué l'icône qui passait d'un calque à la page à chaque capacité utilisée.
    // Les numéros sont traduits en signatures par des photos de la page, prises au départ puis dès
    // qu'un calque porte un numéro encore inconnu (cumulées : un élément supprimé reste identifiable).
    const signatureDe = new Map();
    const photographier = async () => {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      (function parcourir(nd, chemin) {
        let suite = chemin;
        if (nd.nodeType === 1) {
          const a = {}; for (let i = 0; i < (nd.attributes || []).length; i += 2) a[nd.attributes[i]] = nd.attributes[i + 1];
          const repere = a.id ? '#' + a.id : a['data-row-id'] ? '[' + a['data-row-id'] + ']' : null;
          const classe = a.class ? '.' + a.class.split(' ')[0] : '';
          // Une ligne garde sa classe à côté de son repère ([siffletMare].abilityBtn) : c'est par elle que
          // les cas attendus (ATTENDUS) la reconnaissent.
          signatureDe.set(nd.backendNodeId, (chemin + ' ' + (a.id ? repere : repere ? repere + classe : (classe || nd.nodeName.toLowerCase()))).trim());
          if (repere) suite = chemin + ' ' + repere;
        }
        for (const c of nd.children || []) parcourir(c, suite);
      })(root, '');
    };
    await photographier();
    // Présente au départ : l'élément existait avant les animations, c'est une victime possible. Née
    // pendant le test (particule, notification, texte qui s'envole) : éphémère, ignorée.
    const auDepart = new Set(signatureDe.values());
    // Le tout premier relevé après l'activation arrive sans l'identité des éléments (les calques ne
    // sont rattachés qu'au relevé suivant) : pris pour une vraie photo, il faisait « basculer » tout
    // l'écran une fois. On ne compte qu'après une demi-seconde d'observation.
    let avant = null, file = Promise.resolve(), compter = false, fini = false;
    const bascules = new Map();
    cdp.on('LayerTree.layerTreeDidChange', e => {
      if (!e.layers || fini) return; // relevés arrivés après la fin de l'observation : la page va fermer
      const ids = e.layers.map(c => c.backendNodeId).filter(Boolean);
      file = file.then(async () => {
        if (ids.some(id => !signatureDe.has(id))) await photographier();
        const ici = new Set(ids.map(id => signatureDe.get(id)).filter(Boolean));
        if (avant && compter) for (const sg of new Set([...ici, ...avant])) if (ici.has(sg) !== avant.has(sg)) bascules.set(sg, (bascules.get(sg) || 0) + 1);
        avant = ici;
      });
    });
    await cdp.send('LayerTree.enable');
    await p.waitForTimeout(500); compter = true;
    // Chaque événement est suivi d'un RETOUR AU CALME : un voisin qu'une animation a fait passer sur un
    // calque n'en redescend qu'une fois l'animation finie. Enchaîner les événements sans pause le
    // gardait sur son calque jusqu'à la fin, et l'audit ne voyait jamais la bascule (témoin négatif).
    const calmer = () => p.waitForTimeout(2500);
    await p.waitForTimeout(3000); // les créatures se promènent
    const z = await p.evaluate(() => { const r = document.getElementById('clickZone').getBoundingClientRect(); return [r.left + r.width * 0.3, r.top + r.height * 0.35]; });
    for (let i = 0; i < 12; i++) { await p.mouse.click(z[0], z[1]); await p.waitForTimeout(70); }
    await calmer(); await p.waitForTimeout(2000); // le combo retombe
    await p.evaluate(() => _spawnOr()); await calmer();
    await p.evaluate(() => { const g = document.querySelector('.golden'); if (g) g.click(); }); await calmer();
    await p.evaluate(() => _spawnPap()); await calmer();
    await p.evaluate(() => { const g = document.querySelector('.golden'); if (g) g.click(); }); await calmer();
    await p.evaluate(() => { const a = document.querySelector('#abilityBar .abilityBtn.ready'); if (a) a.click(); }); await calmer(); // halo prêt jusqu'ici, puis éteint
    await p.evaluate(() => showToast('Notification')); await calmer(); await p.waitForTimeout(1000);
    await p.evaluate(() => showDialogue('papi', ['Papi passe dire bonjour.'], { position: 'bottom-left' })); await calmer();
    await p.evaluate(() => hideDialogue(false)); await calmer();
    // Qui a basculé ? Les éléments ANIMÉS eux-mêmes (particules, textes qui s'envolent, herbe dorée,
    // notifications, bulle) naissent et meurent sur leur calque : c'est normal. Ce qu'on cherche, ce
    // sont les éléments immobiles déjà présents avant, qu'une animation voisine fait basculer.
    fini = true;
    await file; // tous les événements de calques traités
    const noms = [], attendus = new Set();
    for (const [sg, k] of bascules) {
      const segments = sg.split(' '), nom = (segments[segments.length - 1].match(/(#[\w-]+|\.[\w-]+)$/) || [''])[0];
      // Né pendant le test, ou fait pour apparaître et disparaître (lui ou l'un des siens).
      if (!auDepart.has(sg) || segments.some(x => EPHEMERES.has(x))) continue;
      if (ATTENDUS[nom]) { attendus.add(nom + ' : ' + ATTENDUS[nom]); continue; }
      noms.push(segments.slice(-2).join(' ') + ' (' + k + ' bascule' + (k > 1 ? 's' : '') + ')');
    }
    for (const x of attendus) console.log('  (attendu) ' + x);
    const libelle = (minimal ? 'partie qui commence, ' : 'etat charge, ') + (capacite ? 'une capacite, ' : '') + (creatures === 0 ? 'jardin vide' : creatures === 1 ? 'jardin actuel (1 creature)' : 'jardin de demain (12 creatures)');
    if (noms.length) { console.log(`  X ${libelle} : ${noms.join(', ')}`); problemes += noms.length; }
    else console.log(`  ok ${libelle} : aucun element immobile ne bascule`);
    await p.close();
  }

  console.log(problemes ? `\n${problemes} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problemes ? 1 : 0;
})();
