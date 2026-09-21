// ================= RENDER =================
// Affiche l'événement de saison : badge, décor qui tombe, et une remarque de Papi la première
// fois qu'on le croise dans l'année. Le décor n'est reconstruit que quand l'événement change,
// pas à chaque rendu.
let _evenementAffiche = null;
let _decorAnime = null; // reglage des animations au moment ou le decor a ete construit
function renderEvenement() {
  const ev = evenementActif();
  const badge = document.getElementById('eventBadge');
  if (ev) {
    const bonus = `+${Math.round(ev.bonus * 100)} %`;
    badge.textContent = `${ev.emoji} ${L(ev, 'nom')} · production ${bonus}`;
    badge.style.display = '';
  } else if (badge.style.display !== 'none') {
    badge.style.display = 'none';
  }

  const idActuel = ev ? ev.id : null;
  const anime = !animationsReduites();
  if (idActuel !== _evenementAffiche || anime !== _decorAnime) {
    _evenementAffiche = idActuel;
    _decorAnime = anime;
    construireDecorEvenement(ev);
  }

  // Papi commente, une seule fois par événement et par année (et jamais en mode vacances).
  if (!ev || !state.tutorialSeen || state.vacationMode) return;
  const cle = `${ev.id}-${new Date().getFullYear()}`;
  state.evenementsVus = state.evenementsVus || {};
  if (state.evenementsVus[cle] || isMainScreenBlocked() || tutorialInProgress()) return;
  state.evenementsVus[cle] = true;
  const lignes = ev.papi[state.lang] || ev.papi.fr;
  const ligne = lignes[Math.floor(Math.random() * lignes.length)];
  // Remarque spontanée : elle part toute seule, comme les autres visites de Papi.
  showDialogue('papi', [ligne], { position: 'top-right', autoAdvanceMs: papiReadingPauseMs(ligne) });
}

// 14 éléments : de quoi habiller l'écran sans peser sur l'animation (ils tombent en CSS pur).
function construireDecorEvenement(ev) {
  let couche = document.getElementById('eventDecor');
  if (!ev || animationsReduites()) { if (couche) couche.remove(); return; }
  if (!couche) {
    couche = document.createElement('div');
    couche.id = 'eventDecor';
    // Dans #gameViewport comme les herbes dorées : hors du wrapper, le décor ignorerait la
    // mise à l'échelle et passerait par-dessus les menus.
    document.getElementById('gameViewport').appendChild(couche);
  }
  couche.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.textContent = ev.decor;
    s.style.left = (Math.random() * 96) + '%';
    s.style.animationDuration = (7 + Math.random() * 7).toFixed(1) + 's';
    s.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';
    s.style.fontSize = (14 + Math.random() * 12).toFixed(0) + 'px';
    couche.appendChild(s);
  }
}

function renderNextPurchaseBar() {
  const fill = document.getElementById('nextPurchaseFill');
  const label = document.getElementById('nextPurchaseLabel');
  if (!fill || !label) return;
  // Tant que le magasin n'existe pas, le seul objectif réel est de l'ouvrir. Montrer le prochain
  // compagnon promettait des achats impossibles (« Cousin têtard : 100 / 100 ») sans jamais dire
  // ce qu'il fallait vraiment faire.
  if (!state.tabsSeen.production) {
    const clics = Math.min(state.totalClicks || 0, CLICS_POUR_LE_MAGASIN);
    fill.style.width = (clics / CLICS_POUR_LE_MAGASIN * 100).toFixed(1) + '%';
    label.textContent = selonLangue(
      `Prochain : le magasin de Papi (${clics} / ${CLICS_POUR_LE_MAGASIN} clics)`,
      `Next: Gramps' shop (${clics} / ${CLICS_POUR_LE_MAGASIN} clicks)`);
    return;
  }
  let target = null, targetCost = Infinity;
  // Le facteur de réduction est le même pour tous : le sortir de la boucle évite 28 parcours
  // identiques de la table des améliorations à chaque rendu.
  const prixMult = companionCostMult();
  for (const b of BUILDINGS) {
    const cost = buildingCost(b, 1, prixMult);
    if (cost < targetCost && state.verdure < cost) { targetCost = cost; target = b; }
  }
  if (!target) { fill.style.width = '100%'; label.textContent = state.lang === 'en' ? 'Everything is affordable right now!' : 'Tout est abordable en ce moment !'; return; }
  const pct = Math.min(100, (state.verdure / targetCost) * 100);
  fill.style.width = pct.toFixed(1) + '%';
  label.textContent = `${state.lang === 'en' ? 'Next' : 'Prochain'} : ${L(target,'name')} (${formatNum(state.verdure)} / ${formatNum(targetCost)} 🌿)`;
}

let _themeApplique = null;
// ================= COMPTEUR DE VERDURE FLUIDE =================
// La production est ajoutée une fois par seconde : affiché tel quel, le compteur avançait par
// sauts. Il défile donc en continu vers la vraie valeur, sans jamais la dépasser (on n'affiche
// pas de Verdure pas encore gagnée). Une dépense s'affiche aussitôt ; un gain soudain (clic,
// herbe dorée...) défile vite ; la production régulière défile sur une seconde, jusqu'au tick suivant.
const _compteur = { affiche: null, depart: 0, cible: 0, t0: 0, duree: 1000 };
function animerCompteurVerdure(maintenant) {
  const c = _compteur, vraie = state.verdure;
  if (c.affiche === null || vraie < c.affiche) {
    c.affiche = c.depart = c.cible = vraie;
  } else if (vraie !== c.cible) {
    c.duree = vraie - c.affiche > totalCps() * 1.5 ? 250 : 1000;
    c.depart = c.affiche; c.cible = vraie; c.t0 = maintenant;
  }
  if (c.affiche !== c.cible) c.affiche = c.depart + (c.cible - c.depart) * Math.min(1, (maintenant - c.t0) / c.duree);
  const el = document.getElementById('verdureCount'), texte = formatNum(c.affiche);
  if (el.textContent !== texte) el.textContent = texte;
  requestAnimationFrame(animerCompteurVerdure);
}
function renderStats(cps) {
  renderActiveBoosts();
  const currentCps = cps === undefined ? totalCps() : cps;
  if (currentCps > state.bestCpsEver) state.bestCpsEver = currentCps;
  document.getElementById('rateText').textContent = `+${formatRate(currentCps)} / ${state.lang === 'en' ? 'second' : 'seconde'}`;
  const seedsChip = document.getElementById('seedsText');
  if (state.prestigeCount > 0 || state.cosmicSeeds > 0) {
    seedsChip.style.display = '';
    seedsChip.textContent = `${formatNum(state.cosmicSeeds)} ${state.lang === 'en' ? 'Cosmic Seeds' : 'Graines Cosmiques'} 🌌`;
  } else {
    seedsChip.style.display = 'none';
  }
  const knowChip = document.getElementById('knowledgeText');
  if (knowledgeUnlocked()) {
    knowChip.style.display = '';
    knowChip.textContent = `${formatNum(state.knowledge)} ${state.lang === 'en' ? 'Knowledge' : 'Connaissances'} 📚 (+${formatRate(knowledgeRate() * 60)}/min)`;
  } else {
    knowChip.style.display = 'none';
  }
  renderEvenement();
  const w = currentWeather();
  const defiEnCours = activeChallenge();
  document.getElementById('weatherBadge').textContent = `${L(w,'label')} · production x${weatherMultiplier().toFixed(2)}` + (defiEnCours ? ` · 🏅 ${L(defiEnCours,'name')}` : '');
  // Écrit seulement quand il change : <body> porte des règles descendantes, donc chaque
  // modification de sa classe invalidait le style de tout le document, plusieurs fois par seconde.
  const themeVoulu = getThemeClass() + (state.forceDarkMode ? ' darkOverride' : '');
  if (themeVoulu !== _themeApplique) {
    const bodyEl = document.getElementById('bodyEl');
    bodyEl.classList.remove('theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'darkOverride');
    themeVoulu.split(' ').forEach(c => bodyEl.classList.add(c));
    _themeApplique = themeVoulu;
  }
  renderNextPurchaseBar();

  const invBox = document.getElementById('invasiveBox');
  if (state.invasiveWeed && state.invasiveWeed.active) {
    invBox.style.display = 'block';
    invBox.innerHTML = selonLangue(
      `👴 <b>Papi Feuillage débarque !</b> Production -30 % : il te déconcentre en te regardant faire. Clique ${state.invasiveWeed.needed - state.invasiveWeed.done} fois pour lui montrer que tu t'en sors, et il repartira.`,
      `👴 <b>Gramps is here!</b> Production -30%: he puts you off by watching over your shoulder. Click ${state.invasiveWeed.needed - state.invasiveWeed.done} times to show him you have got this, and he will go.`);
    invBox.onclick = clickInvasive;
  } else { invBox.style.display = 'none'; }

  const clickZone = document.getElementById('clickZone');
  const clickText = document.getElementById('clickText');
  if (challengeIs('mains')) {
    clickZone.classList.add('disabled');
    clickText.textContent = state.lang === 'en' ? '🚫 Challenge: Hands in Pockets' : '🚫 Défi : Mains dans les poches';
  } else {
    clickZone.classList.remove('disabled');
    clickText.textContent = state.lang === 'en' ? 'Click' : 'Clic';
  }
}

const BUY_MODES = [1, 10, 100, 'max'];
// Les boutons sont créés une seule fois : les reconstruire à chaque rendu (jusqu'à 60 fois par
// seconde) faisait clignoter leur survol. Ensuite, seul le bouton actif change.
function renderBuyModeRow() {
  const row = document.getElementById('buyModeRow');
  if (!row.children.length) {
    for (const mode of BUY_MODES) {
      const btn = document.createElement('button');
      btn.className = 'buyModeBtn';
      btn._mode = mode;
      btn.textContent = mode === 'max' ? 'MAX' : 'x' + mode;
      btn.onclick = () => { state.buyMode = mode; renderAll(); };
      row.appendChild(btn);
    }
  }
  for (const btn of row.children) btn.classList.toggle('active', state.buyMode === btn._mode);
}

// Calcule quel bâtiment offre le meilleur rapport CPS gagné / coût du prochain exemplaire —
// aide les joueurs à éviter le piège du "moins cher d'abord" qui n'est pas toujours le plus rentable.
function bestRoiBuildingId() {
  let bestId = null, bestRoi = -1;
  const caches = productionHidden(); // un compagnon « ??? » ne peut être ni conseillé ni acheté
  const sortes = companionKindsOwned(), prixMult = companionCostMult();
  for (const b of BUILDINGS) {
    if (caches.has(b.id) || !challengeAllowsBuilding(b.id, sortes)) continue;
    const effectiveCps = buildingCpsPerUnit(b);
    const cost = buildingCost(b, 1, prixMult);
    if (cost <= 0) continue;
    const roi = effectiveCps / cost;
    if (roi > bestRoi) { bestRoi = roi; bestId = b.id; }
  }
  return bestId;
}

// Affiche la ressource pertinente pour l'onglet actuellement ouvert dans le magasin (Verdure
// pour Jardin/Clic/Spécial, Connaissances pour Recherche, Graines Cosmiques pour Prestige,
// Éclats Stellaires pour Ascension) — sans ça, impossible de savoir ce qu'on a en poche une
// fois dans le magasin plein écran, qui masque le reste de l'interface.
function renderShopResourceBar() {
  const bar = document.getElementById('shopResourceBar');
  if (!bar) return;
  const en = state.lang === 'en';
  let icon, value, label;
  if (activeShopTab === 'recherche') {
    icon = '📚'; value = formatNum(state.knowledge); label = en ? 'Knowledge' : 'Connaissances';
  } else if (activeShopTab === 'prestige' || activeShopTab === 'familiers') {
    icon = '🌌'; value = formatNum(state.cosmicSeeds); label = en ? 'Cosmic Seeds' : 'Graines Cosmiques';
  } else if (activeShopTab === 'ascension') {
    icon = '🌟'; value = formatNum(state.stellarShards || 0); label = en ? 'Stellar Shards' : 'Éclats Stellaires';
  } else {
    icon = '🌿'; value = formatNum(state.verdure); label = en ? 'Greenery' : 'Verdure';
  }
  const texte = `${icon} ${value} ${label}`;
  if (bar.textContent !== texte) bar.textContent = texte;
}

// Les listes du magasin sont redessinées à chaque tick du jeu. Les reconstruire avec
// `innerHTML = ''` détruisait la ligne située sous le curseur : le navigateur perdait son état
// :hover et ne le réévaluait qu'au prochain mouvement de souris, d'où une ligne qui se
// sélectionnait/désélectionnait en boucle. On réutilise donc les lignes déjà en place tant que
// ce sont les mêmes objets dans le même ordre, et on ne réécrit que ce qui a réellement changé.
// Écrit le HTML d'un élément seulement s'il a changé : les rendus tournent jusqu'à 60 fois par
// seconde, et réécrire innerHTML reconstruit les nœuds pour, presque toujours, le même contenu.
function setHtmlIfChanged(el, html) {
  if (el && el._html !== html) { el.innerHTML = html; el._html = html; }
}
// Vrai tant que Papi présente un onglet, quel que soit le menu (voir isTutorialSpeakingFor).
function presentationEnCours() {
  return !!_pendingSpotlightGroup && isTutorialSpeakingFor(_pendingSpotlightGroup);
}
// Un seul gestionnaire pour toutes les lignes d'achat, plutôt qu'une fermeture par ligne et par
// rendu. Il refuse le clic pendant une présentation : la règle CSS (.papiParle) arrête la souris,
// celui-ci arrête aussi le clavier et tout clic simulé. L'achat automatique, lui, appelle
// buyBuilding directement et n'est pas concerné.
function clicLigneAchat(e) {
  if (presentationEnCours()) return;
  const acheter = e.currentTarget._acheter;
  if (acheter) acheter(e);
}
function renderItemRows(container, rows) {
  if (!container) return;
  const sameSet = container.children.length === rows.length &&
    rows.every((r, i) => container.children[i].dataset.rowId === r.id);
  if (!sameSet) {
    container.innerHTML = '';
    for (const r of rows) {
      const div = document.createElement('div');
      div.dataset.rowId = r.id;
      container.appendChild(div);
    }
  }
  rows.forEach((r, i) => {
    const div = container.children[i];
    if (div.className !== r.className) div.className = r.className;
    // On compare au dernier HTML POSÉ (mémorisé sur l'élément) et non à `div.innerHTML`, que
    // le navigateur renormalise — la comparaison serait alors toujours fausse et on
    // reconstruirait la ligne à chaque fois, ce qu'on cherche justement à éviter.
    if (div._rowHtml !== r.html) { div._rowHtml = r.html; div.innerHTML = r.html; }
    div._acheter = r.onclick || null;
    const voulu = r.onclick ? clicLigneAchat : null;
    if (div.onclick !== voulu) div.onclick = voulu;
  });
}

// Découverte progressive du magasin. Dans chaque liste (Production, Clic, Bâtiments, Spécial),
// on voit les objets déjà découverts et le PROCHAIN objet à acheter ; tous ceux d'après
// n'affichent que leur prix, le reste (nom, image, description, production) est remplacé par
// « ??? ». Un objet reste découvert pour toujours une fois acquis : `itemPopupsShown` est la
// mémoire durable des acquisitions (le Prestige et l'Ascension ne la remettent pas à zéro).
function itemDiscovered(id, owned) {
  return owned || !!(state.itemPopupsShown && state.itemPopupsShown[id]);
}
// Ids à masquer dans une liste déjà triée par prix croissant : tous les non-découverts, sauf
// le premier d'entre eux (le prochain achat).
function hiddenShopItems(items, isOwned) {
  const caches = new Set();
  let prochainVu = false;
  for (const it of items) {
    if (itemDiscovered(it.id, isOwned(it))) continue;
    if (prochainVu) caches.add(it.id);
    prochainVu = true;
  }
  return caches;
}
function mysteryShopRow(id, priceHtml) {
  return {
    id,
    className: 'upgrade disabled mysteryItem',
    html: `
      <div class="itemIcon itemIconMystery">?</div>
      <div class="info"><div class="name">???</div></div>
      <div class="price">${priceHtml}</div>
    `,
    onclick: null, // on découvre dans l'ordre : l'objet d'avant doit être acheté en premier
  };
}
const productionHidden = () => hiddenShopItems(BUILDINGS, b => (state.buildings[b.id] || 0) > 0);

// Progression vers le prochain palier du compagnon (barre remplie depuis le palier précédent).
function companionMilestoneHtml(owned) {
  const en = state.lang === 'en';
  const atteints = companionMilestoneCount(owned);
  const bonus = Math.pow(companionMilestoneStep(), atteints);
  const bonusTxt = bonus > 1 ? ` <span class="palierBonus">· bonus x${trimZeros(bonus)}</span>` : '';
  const next = COMPANION_MILESTONES[atteints];
  if (next === undefined) return `<div class="palierLine">🏅 ${en ? 'All milestones reached' : 'Tous les paliers atteints'}${bonusTxt}</div>`;
  const prev = COMPANION_MILESTONES[atteints - 1] || 0;
  const pct = Math.round(((owned - prev) / (next - prev)) * 100);
  return `<div class="palierLine">🎯 ${en ? 'Milestone' : 'Palier'} ${next} : ${owned}/${next} → x${companionMilestoneStep()} production${bonusTxt}`
    + `<div class="palierBar"><div class="palierFill" data-pct="${pct}"></div></div></div>`; // largeur posee apres le rendu (voir majBarresPalier)
}

// Ligne d'un onglet à actions (Familiers, Automatisation, Défis) : icône, texte, zone de boutons.
// Un seul gestionnaire par ligne, le bouton visé est reconnu à son data-action.
function actionRow({ id, icon, className, info, actions, onAction }) {
  return {
    id, className,
    html: `
      <div class="itemIcon itemIconAuto">${icon}</div>
      <div class="info">${info}</div>
      <div class="price">${actions}</div>
    `,
    onclick: onAction ? (e) => {
      const bouton = e.target.closest('[data-action]');
      if (bouton) onAction(bouton.dataset.action);
    } : null,
  };
}
function renderFamiliers() {
  const en = state.lang === 'en';
  const actif = (state.familiers || {}).actif;
  renderItemRows(document.getElementById('familiersList'), FAMILIERS.map(f => {
    const ok = f.unlock(state), niv = familierNiveau(f.id), estActif = ok && actif === f.id;
    const pct = v => `${f.reduction ? '-' : '+'}${Math.round(v * 100)} %`;
    let actions;
    if (!ok) actions = `<span class="owned">🔒 ${L(f,'stage')}</span>`;
    else {
      const choix = estActif ? `<span class="owned">✅ ${en ? 'Active' : 'Actif'}</span>` : `<button class="claimBtn" data-action="choisir">${en ? 'Choose' : 'Choisir'}</button>`;
      const cout = FAMILIER_COUTS[niv];
      const amelio = niv >= FAMILIER_NIVEAU_MAX
        ? `<span class="owned">${en ? 'Max level' : 'Niveau max'}</span>`
        : `<button class="claimBtn${state.cosmicSeeds >= cout ? '' : ' off'}" data-action="ameliorer">${cout} 🌌</button>`;
      actions = `<div class="familierActions">${choix}${amelio}</div>`;
    }
    const detail = ok
      ? `${en ? 'Level' : 'Niveau'} ${niv}/${FAMILIER_NIVEAU_MAX} : ${pct(f.parNiveau * niv)} ${L(f,'effet')}${estActif ? '' : (en ? ' (pick it to benefit)' : ' (choisis-le pour en profiter)')}`
      : '';
    return actionRow({
      id: f.id, icon: f.icon, actions,
      className: 'upgrade' + (estActif ? ' defiEnCours' : '') + (ok ? '' : ' disabled'),
      info: `
        <div class="name">${L(f,'name')}</div>
        <div class="desc">${pct(f.parNiveau)} ${L(f,'effet')} ${en ? 'per level' : 'par niveau'}.</div>
        ${detail ? `<div class="prodLine">${detail}</div>` : ''}`,
      onAction: ok ? action => action === 'choisir' ? choisirFamilier(f.id) : ameliorerFamilier(f.id) : null,
    });
  }));
}

function renderAutomation() {
  const en = state.lang === 'en';
  const a0 = state.automation;
  renderItemRows(document.getElementById('automationList'), AUTOMATIONS.map(a => {
    const ok = a.unlock(state), on = ok && !!a0[a.id];
    const controle = ok
      ? `<button class="claimBtn autoToggle${on ? '' : ' off'}" data-action="toggle">${on ? (en ? 'ON' : 'ACTIVÉ') : (en ? 'OFF' : 'ÉTEINT')}</button>`
      : `<span class="owned">🔒 ${L(a,'stage')}</span>`;
    const seuil = (a.id === 'prestige' && ok)
      ? `<div class="autoSeuil">${en ? 'Target' : 'Graines visées'} : <button class="autoStep" data-action="-10">−10</button><button class="autoStep" data-action="-1">−1</button><b>${a0.prestigeSeeds}</b><button class="autoStep" data-action="1">+1</button><button class="autoStep" data-action="10">+10</button></div>`
      : '';
    return actionRow({
      id: a.id, icon: a.icon, actions: controle,
      className: 'upgrade' + (ok ? '' : ' disabled'),
      info: `
        <div class="name">${L(a,'name')}</div>
        <div class="desc">${L(a,'desc')}</div>
        ${seuil}`,
      onAction: ok ? action => {
        if (action === 'toggle') {
          a0[a.id] = !a0[a.id];
          // Pas un achat (rien n'est dépensé) : on ne passe donc pas par finaliserAchat, mais
          // Papi commente quand même, c'est l'activation qui fait l'événement.
          if (a0[a.id]) notifyPurchase(0, 'automatisation');
        }
        else a0.prestigeSeeds = Math.max(1, (a0.prestigeSeeds || 1) + parseInt(action, 10));
        saveGame(); renderAll();
      } : null,
    });
  }));
}

function renderShop() {
  const bestRoiId = bestRoiBuildingId();
  const caches = productionHidden();
  renderItemRows(document.getElementById('shop'), BUILDINGS.map(b => {
    const owned = state.buildings[b.id] || 0;
    const n = state.buyMode === 'max' ? maxAffordable(b) : state.buyMode;
    const cost = n > 0 ? buildingCost(b, n) : buildingCost(b, 1);
    if (caches.has(b.id)) return mysteryShopRow(b.id, `${state.buyMode === 'max' ? 'x' + n + ' : ' : ''}${formatNum(cost)} 🌿`);
    const canAfford = state.verdure >= cost && n > 0;
    const synBonus = synergyBonusFor(b.id);
    const perUnit = buildingCpsPerUnit(b);
    return {
      id: b.id,
      className: 'upgrade' + (canAfford ? '' : ' disabled'),
      html: `
      ${getItemIconHtml(b.id, !owned && !canAfford)}
      <div class="info">
        <div class="name">${L(b,'name')} <span class="owned">${owned}</span></div>
        <div class="desc">${L(b,'desc')}</div>
        <div class="prodLine">⚡ <b>${formatNum(perUnit)}</b>/sec ${tr('each')}${owned > 0 ? ` <span class="prodTotal">· ${tr('totalHere')} <b>${formatNum(perUnit * owned)}</b>/sec</span>` : ''}</div>
        ${companionMilestoneHtml(owned)}
        <div class="tags">
          ${synBonus > 0 ? `<span class="synergy">${tr('synergyActive')} : +${(synBonus*100).toFixed(0)}%</span>` : ''}
          ${b.id === bestRoiId ? `<span class="roiBadge">💡 ${tr('bestRoi')}</span>` : ''}
        </div>
      </div>
      <div class="price">${state.buyMode === 'max' ? 'x' + n + ' : ' : ''}${formatNum(cost)} 🌿</div>
    `,
      onclick: () => buyBuilding(b.id),
    };
  }));
  majBarresPalier();
}
// Barres de palier : la ligne d'un compagnon est reconstruite a chaque achat (son HTML change), ce
// qui recreait la barre deja a sa nouvelle largeur : elle sautait. La largeur est donc posee apres
// le rendu, et une barre recreee repart de sa derniere largeur connue avant de glisser vers la nouvelle.
const _palierLargeurs = {};
function majBarresPalier() {
  for (const fill of document.querySelectorAll('#shop .palierFill')) {
    const id = fill.closest('[data-row-id]').dataset.rowId, cible = fill.dataset.pct + '%';
    if (!fill.style.width) {
      fill.style.transition = 'none';
      fill.style.width = _palierLargeurs[id] || cible;
      void fill.offsetWidth; // la largeur de depart est prise en compte avant la transition
      fill.style.transition = '';
    }
    if (fill.style.width !== cible) fill.style.width = cible;
    _palierLargeurs[id] = cible;
  }
}

function renderClickShop() {
  const caches = hiddenShopItems(CLICK_UPGRADES, c => hasClickUpgrade(c.id));
  renderItemRows(document.getElementById('clickShop'), CLICK_UPGRADES.map(c => {
    if (caches.has(c.id)) return mysteryShopRow(c.id, formatNum(c.cost) + ' 🌿');
    const owned = hasClickUpgrade(c.id);
    const canAfford = !owned && state.verdure >= c.cost;
    return {
      id: c.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      ${getItemIconHtml(c.id, !owned && !canAfford)}
      <div class="info">
        <div class="name">${L(c,'name')} ${owned ? `<span class="owned">${tr('acquired')}</span>` : ''}</div>
        <div class="desc">${L(c,'desc')}</div>
      </div>
      <div class="price">${owned ? '' : formatNum(c.cost) + ' 🌿'}</div>
    `,
      onclick: owned ? null : () => buyClickUpgrade(c.id),
    };
  }));
}

// Onglet Bâtiments : chaque entrée booste UN compagnon précis, une seule fois. On affiche le
// compagnon ciblé et combien on en possède, parce que c'est ça qui décide si l'achat vaut le
// coup (un bâtiment sur un compagnon qu'on n'a pas encore ne rapporte rien).
function renderCompanionBuildings() {
  const discount = uniqueCostMult();
  const caches = hiddenShopItems(COMPANION_BUILDINGS, b => hasCompanionBuilding(b.id));
  const compagnonsCaches = productionHidden();
  renderItemRows(document.getElementById('companionBuildingsShop'), COMPANION_BUILDINGS.map(b => {
    const owned = hasCompanionBuilding(b.id);
    const cost = b.cost * discount;
    if (caches.has(b.id)) return mysteryShopRow(b.id, formatNum(cost) + ' 🌿');
    const canAfford = !owned && state.verdure >= cost;
    const target = b._target || (b._target = BUILDINGS.find(x => x.id === b.targetId));
    const targetCount = state.buildings[b.targetId] || 0;
    const bonusPct = Math.round((b.mult - 1) * 100);
    const targetLine = target
      ? `${tr('boosts')} <b>${compagnonsCaches.has(target.id) ? '???' : L(target,'name')}</b> +${bonusPct}% <span class="owned">${targetCount}</span>`
      : '';
    return {
      id: b.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      ${getItemIconHtml(b.id, !owned && !canAfford)}
      <div class="info">
        <div class="name">${L(b,'name')} ${owned ? `<span class="owned">${tr('acquired')}</span>` : ''}</div>
        <div class="desc">${L(b,'desc')}</div>
        <div class="tags"><span class="synergy">${targetLine}</span></div>
      </div>
      <div class="price">${owned ? '' : formatNum(cost) + ' 🌿'}</div>
    `,
      onclick: owned ? null : () => buyCompanionBuilding(b.id),
    };
  }));
}

function renderSpecial() {
  const discount = uniqueCostMult();
  const visibles = UNIQUE_BUILDINGS.filter(u => hasUnique(u.id) || !u.requires || u.requires(state));
  const caches = hiddenShopItems(visibles, u => hasUnique(u.id));
  renderItemRows(document.getElementById('specialShop'), visibles.map(u => {
    const owned = hasUnique(u.id);
    const cost = u.cost * discount;
    if (caches.has(u.id)) return mysteryShopRow(u.id, formatNum(cost) + ' 🌿');
    const canAfford = !owned && state.verdure >= cost;
    let priceOrAction = owned ? '' : formatNum(cost) + ' 🌿';
    if (u.active && uniqueActive(u.id)) {
      const remaining = activeCooldownRemaining(u.id);
      priceOrAction = remaining > 0
        ? `⏳ ${formatDureeCourte(remaining / 1000)}`
        : `<button class="claimBtn" style="padding:6px 12px;">${tr('activate')}</button>`;
    }
    return {
      id: u.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      ${getItemIconHtml(u.id, !owned && !canAfford)}
      <div class="info">
        <div class="name">${L(u,'name')} ${owned ? `<span class="owned">${tr('acquired')}</span>` : ''}</div>
        <div class="desc">${L(u,'desc')}</div>
      </div>
      <div class="price">${priceOrAction}</div>
    `,
      // Un seul gestionnaire pour toute la ligne : le bouton « Activer » est distingué par la
      // cible du clic, plutôt que par un second écouteur posé sur un nœud que le rendu suivant
      // remplacerait.
      onclick: owned
        ? (u.active ? (e) => { if (e.target.closest('button')) activateUniqueAbility(u.id); } : null)
        : () => buyUnique(u.id),
    };
  }));

  renderItemRows(document.getElementById('skinsShop'), SKINS.map(sk => {
    const owned = hasSkin(sk.id);
    const active = state.activeSkin === sk.id;
    const canAfford = !owned && state.cosmicSeeds >= sk.cost;
    return {
      id: sk.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      <div class="info">
        <div class="name">${sk.emojis.join(' ')} ${L(sk,'name')} ${active ? `<span class="owned">${tr('active')}</span>` : (owned ? `<span class="owned">${tr('owned')}</span>` : '')}</div>
        <div class="desc">${L(sk,'desc')}</div>
      </div>
      <div class="price">${owned ? (active ? '' : tr('use')) : (sk.cost > 0 ? formatNum(sk.cost) + ' 🌌' : tr('free'))}</div>
    `,
      onclick: () => { if (!owned) buySkin(sk.id); else if (!active) selectSkin(sk.id); },
    };
  }));
}

function renderResearch() {
  renderItemRows(document.getElementById('researchShop'), RESEARCH.map(r => {
    const owned = hasResearch(r.id);
    const locked = r.requires && !hasResearch(r.requires);
    const canAfford = !owned && !locked && state.knowledge >= r.cost;
    return {
      id: r.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      <div class="info">
        <div class="name">${L(r,'name')} ${owned ? `<span class="owned">${tr('acquired')}</span>` : ''}</div>
        <div class="desc">${L(r,'desc')}${locked ? ' ' + tr('locked') : ''}</div>
      </div>
      <div class="price">${owned ? '' : formatNum(r.cost) + ' 📚'}</div>
    `,
      onclick: (!owned && !locked) ? () => buyResearch(r.id) : null,
    };
  }));

  renderItemRows(document.getElementById('researchInfiniteShop'), RESEARCH_INFINITE.map(ri => {
    const level = state.researchInfiniteLevels[ri.id] || 0;
    const cost = researchInfiniteCost(ri);
    const canAfford = state.knowledge >= cost;
    return {
      id: ri.id,
      className: 'upgrade' + (canAfford ? '' : ' disabled'),
      html: `
      <div class="info">
        <div class="name">${L(ri,'name')} <span class="owned">${tr('level')} ${level}</span></div>
        <div class="desc">${L(ri,'desc')}</div>
      </div>
      <div class="price">${formatNum(cost)} 📚</div>
    `,
      onclick: () => buyResearchInfinite(ri.id),
    };
  }));
}

// Barre de progression + libellé des onglets Prestige et Ascension, écrits seulement s'ils changent.
function setProgressBar(fillId, labelId, pct, texte) {
  const fill = document.getElementById(fillId), label = document.getElementById(labelId);
  const largeur = pct.toFixed(1) + '%';
  if (fill && fill.style.width !== largeur) fill.style.width = largeur;
  if (label && label.textContent !== texte) label.textContent = texte;
}
function renderPrestige() {
  const gain = prestigeGainAmount();
  const btn = document.getElementById('prestigeBtn');
  btn.disabled = gain < 1;
  setHtmlIfChanged(document.getElementById('prestigeInfo'),
    gain >= 1
      ? (state.lang === 'en'
          ? `Terraforming will give you <b>+${gain} Cosmic Seed(s)</b> (every seed earned raises your production bonus, and spending seeds never lowers it). You start over from zero: Greenery, companions, Click, Buildings and Special. Kept: Research, Knowledge, achievements, pets and Prestige upgrades.<br>Currently: ${formatNum(state.seedsSinceAscension || 0)} seeds earned = +${Math.round((seedMultiplier() - 1) * 100)}% production.${shardSeedMultiplier() > 1 ? `<br>Your Shards' bonus: x${trimZeros(shardSeedMultiplier())} Seeds on every Prestige.` : ''}`
          : `Terraformer te donnera <b>+${gain} Graine(s) Cosmique(s)</b> (chaque graine gagnée augmente ton bonus de production, et dépenser des graines ne le réduit pas). Tu repars de zéro : Verdure, compagnons, Clic, Bâtiments et Spécial. Restent acquis : Recherche, Connaissances, succès, familiers et améliorations de Prestige.<br>Actuellement : ${formatNum(state.seedsSinceAscension || 0)} graines gagnées = +${Math.round((seedMultiplier() - 1) * 100)} % de production.${shardSeedMultiplier() > 1 ? `<br>Bonus de tes Éclats : x${trimZeros(shardSeedMultiplier())} Graines à chaque Prestige.` : ''}`)
      : (state.lang === 'en'
          ? `You need more Greenery on hand to terraform (you have ${formatNum(state.verdure)}).`
          : `Il te faut plus de Verdure en poche pour terraformer (tu en as ${formatNum(state.verdure)}).`));

  // Mêmes ressource et même constante que prestigeGainAmount() : la barre mesurait encore la
  // Verdure TOTALE contre un seuil périmé, elle annonçait donc autre chose que le bouton.
  const nextGain = gain + 1;
  const requiredForNext = verdureForSeeds(nextGain);
  const requiredForCurrent = verdureForSeeds(gain);
  const span = Math.max(1, requiredForNext - requiredForCurrent);
  const pct = Math.min(100, Math.max(0, ((state.verdure - requiredForCurrent) / span) * 100));
  setProgressBar('prestigeProgressFill', 'prestigeProgressLabel', pct, state.lang === 'en'
    ? `Towards +${nextGain} Cosmic Seed(s): ${formatNum(state.verdure)} / ${formatNum(requiredForNext)} 🌿`
    : `Vers +${nextGain} Graine(s) Cosmique(s) : ${formatNum(state.verdure)} / ${formatNum(requiredForNext)} 🌿`);

  renderItemRows(document.getElementById('prestigeShop'), PRESTIGE_UPGRADES.map(pu => {
    const owned = hasPrestigeUpgrade(pu.id);
    const locked = pu.requires && !hasPrestigeUpgrade(pu.requires);
    const canAfford = !owned && !locked && state.cosmicSeeds >= pu.cost;
    return {
      id: pu.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      <div class="info">
        <div class="name">${L(pu,'name')} ${owned ? `<span class="owned">${tr('acquired')}</span>` : ''}</div>
        <div class="desc">${L(pu,'desc')}${locked ? ' ' + tr('locked') : ''}</div>
      </div>
      <div class="price">${owned ? '' : formatNum(pu.cost) + ' 🌌'}</div>
    `,
      onclick: (!owned && !locked) ? () => buyPrestigeUpgrade(pu.id) : null,
    };
  }));
}

function renderAscension() {
  if (!ascensionUnlocked()) return;
  const gain = ascensionGainAmount();
  const btn = document.getElementById('ascensionBtn');
  if (!btn) return;
  btn.disabled = gain < 1;
  setHtmlIfChanged(document.getElementById('ascensionInfo'),
    gain >= 1
      ? (state.lang === 'en'
          ? `Ascending will give you <b>+${gain} Stellar Shard(s)</b> (your Shards earned raise your production: +50% per Shard up to 20, then more and more slowly; they also raise the Seeds of every Prestige: x1.25 with 1, x1.5 with 4, x2 with 16; <u>never reset</u>, and spending Shards never lowers it). Like a Prestige, you start over from zero (Greenery, companions, Click, Buildings and Special), and on top of that your Cosmic Seeds, their production bonus and your Prestige upgrades are reset. Kept: Research, Knowledge, achievements, pets and Ascension upgrades.<br>Currently: ${formatNum(state.totalShardsEarned||0)} Shard(s) earned in total = x${trimZeros(shardMultiplier())} permanent production and x${trimZeros(shardSeedMultiplier())} Seeds per Prestige.`
          : `Ascensionner te donnera <b>+${gain} Éclat(s) Stellaire(s)</b> (tes Éclats gagnés augmentent ta production : +50 % par Éclat jusqu'à 20, puis de plus en plus lentement ; ils augmentent aussi les Graines de chaque Prestige : x1.25 avec 1, x1.5 avec 4, x2 avec 16 ; <u>jamais réinitialisé</u>, et dépenser des Éclats ne le réduit pas). Comme un Prestige, tu repars de zéro (Verdure, compagnons, Clic, Bâtiments et Spécial), et en plus tes Graines Cosmiques, leur bonus de production et tes améliorations de Prestige sont remis à zéro. Restent acquis : Recherche, Connaissances, succès, familiers et améliorations d'Ascension.<br>Actuellement : ${formatNum(state.totalShardsEarned||0)} Éclat(s) gagné(s) au total = x${trimZeros(shardMultiplier())} production permanente et x${trimZeros(shardSeedMultiplier())} Graines par Prestige.`)
      : (state.lang === 'en'
          ? `Prestige to earn more Cosmic Seeds (${formatNum(state.seedsSinceAscension||0)} earned since your last Ascension): they bring your next Ascension closer.`
          : `Fais des Prestiges pour gagner plus de Graines Cosmiques (${formatNum(state.seedsSinceAscension||0)} gagnées depuis ta dernière Ascension) : elles te rapprochent de ta prochaine Ascension.`));

  const nextGain = gain + 1;
  const requiredForNext = seedsForShards(nextGain);
  const requiredForCurrent = seedsForShards(gain);
  const span = Math.max(1, requiredForNext - requiredForCurrent);
  const pct = Math.min(100, Math.max(0, ((state.seedsSinceAscension||0) - requiredForCurrent) / span * 100));
  setProgressBar('ascensionProgressFill', 'ascensionProgressLabel', pct, state.lang === 'en'
    ? `Towards +${nextGain} Shard(s): ${formatNum(state.seedsSinceAscension||0)} / ${formatNum(requiredForNext)} 🌌`
    : `Vers +${nextGain} Éclat(s) : ${formatNum(state.seedsSinceAscension||0)} / ${formatNum(requiredForNext)} 🌌`);

  renderItemRows(document.getElementById('ascensionShop'), ASCENSION_UPGRADES.map(au => {
    const owned = hasAscensionUpgrade(au.id);
    const locked = au.requires && !hasAscensionUpgrade(au.requires);
    const canAfford = !owned && !locked && (state.stellarShards||0) >= au.cost;
    return {
      id: au.id,
      className: 'upgrade' + (canAfford || owned ? '' : ' disabled'),
      html: `
      <div class="info">
        <div class="name">${L(au,'name')} ${owned ? `<span class="owned">${tr('acquired')}</span>` : ''}</div>
        <div class="desc">${L(au,'desc')}${locked ? ' ' + tr('locked') : ''}</div>
      </div>
      <div class="price">${owned ? '' : formatNum(au.cost) + ' 🌟'}</div>
    `,
      onclick: (!owned && !locked) ? () => buyAscensionUpgrade(au.id) : null,
    };
  }));
}

// Les cartes gardent leurs nœuds (renderItemRows) : la barre, le compteur et le bouton sont mis à
// jour sur place. Recréées à chaque rendu, elles faisaient clignoter le bouton « Réclamer » au
// survol et pouvaient avaler un clic.
function renderQuests() {
  generateQuests();
  const list = document.getElementById('questList');
  if (!state.dailyQuests) { list.innerHTML = ''; return; }
  const en = state.lang === 'en';
  const quetes = state.dailyQuests.quests;
  renderItemRows(list, quetes.map((q, i) => ({
    id: `${state.dailyQuests.date}-${i}`,
    className: 'questCard',
    html: `
      <div class="qName">${questDesc(q)}</div>
      <div class="qDesc">${en ? 'Reward' : 'Récompense'} : ${formatNum(q.rewardAmount * (combinedUpgradeValue('questMult')||1))} ${q.rewardType === 'verdure' ? (en ? 'Greenery 🌿' : 'Verdure 🌿') : (en ? 'Knowledge 📚' : 'Connaissances 📚')}</div>
      <div class="qBar"><div class="qBarFill"></div></div>
      <div class="qProgress" style="font-size:11px;opacity:0.7;"></div>
      <button class="claimBtn"></button>
    `,
    onclick: (e) => { if (e.target.closest('.claimBtn')) claimQuest(i); },
  })));
  quetes.forEach((q, i) => {
    const carte = list.children[i];
    if (!carte) return;
    const progress = questProgressValue(q.type);
    const largeur = Math.min(100, (progress / q.target) * 100) + '%';
    const fill = carte.querySelector('.qBarFill'), texte = carte.querySelector('.qProgress'), bouton = carte.querySelector('.claimBtn');
    if (fill.style.width !== largeur) fill.style.width = largeur;
    const compte = `${formatNum(progress)} / ${formatNum(q.target)}`;
    if (texte.textContent !== compte) texte.textContent = compte;
    const pret = progress >= q.target && !q.claimed;
    if (bouton.disabled === pret) bouton.disabled = !pret;
    const libelle = q.claimed ? (en ? '✔ Claimed' : '✔ Réclamée') : (en ? 'Claim' : 'Réclamer');
    if (bouton.textContent !== libelle) bouton.textContent = libelle;
  });
}

function renderDefi() {
  const panel = document.getElementById('defiPanel');
  const en = state.lang === 'en';
  let liste = panel.querySelector('#defiListe');
  if (!liste) {
    panel.innerHTML = '<div id="defiListe"></div><div id="defiInfos"></div>';
    liste = panel.querySelector('#defiListe');
  }
  const actif = state.challengeActive;
  renderItemRows(liste, CHALLENGES.map(c => {
    const ok = c.unlock(state), fait = challengeDone(c.id), enCours = actif === c.id;
    let etat;
    if (fait) etat = `<span class="owned">✅ ${en ? 'Completed' : 'Réussi'}</span>`;
    else if (enCours) {
      const reste = challengeTimeLeftSec();
      const chrono = reste === null ? '' : `<div class="defiChrono">${reste >= 0 ? '⏱️ ' + formatDureeCourte(reste) : (en ? '⌛ Time is up' : '⌛ Temps écoulé')}</div>`;
      etat = `${chrono}<button class="claimBtn" data-action="abandon">${en ? 'Give up' : 'Abandonner'}</button>`;
    } else if (!ok) etat = `<span class="owned">🔒 ${L(c,'stage')}</span>`;
    else if (actif) etat = `<span class="owned defiAttente">⏸️ ${en ? 'After the current challenge' : 'Après le défi en cours'}</span>`;
    else etat = `<button class="claimBtn" data-action="start">${en ? 'Start' : 'Lancer'}</button>`;
    return actionRow({
      id: c.id, icon: c.icon, actions: etat,
      className: 'upgrade' + (enCours ? ' defiEnCours' : '') + (ok || fait ? '' : ' disabled'),
      info: `
        <div class="name">${L(c,'name')}${enCours ? ` <span class="owned">${en ? 'In progress' : 'En cours'}</span>` : ''}</div>
        <div class="desc">${L(c,'rule')} ${en ? `Goal: a Prestige worth ${c.goal} Seed(s).` : `Objectif : un Prestige de ${c.goal} Graine(s).`}</div>
        <div class="prodLine">🎁 ${L(c,'reward')}${fait ? ' (active)' : ''}</div>`,
      onAction: action => action === 'start' ? startChallenge(c.id) : abandonChallenge(),
    });
  }));
  const infos = panel.querySelector('#defiInfos');
  const html = `
    <div class="defiRow"><div style="font-size:13px;">🏅 ${en ? 'Challenges completed' : 'Défis réussis'} : <b>${challengesDoneCount(state)} / ${CHALLENGES.length}</b></div></div>
    <div class="defiRow"><div style="font-size:13px;">👴 ${en ? "Gramps' visits cut short" : 'Visites de Papi écourtées'} : <b>${state.invasiveDefeated || 0}</b></div></div>
    <div class="defiRow"><div style="font-size:13px;">🌤️ ${en ? 'Weather types observed' : 'Types de météo observés'} : <b>${(state.weatherSeen || []).length} / 6</b></div></div>`;
  setHtmlIfChanged(infos, html);
}

// ================= OBJECTIF SUIVANT =================
function renderNextGoal() {
  const box = document.getElementById('nextGoalBox');
  if (!box) return;
  let best = null, bestPct = -1;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !a.progress) continue;
    const [cur, target] = a.progress(state);
    const pct = Math.min(100, Math.max(0, (cur / target) * 100));
    if (pct > bestPct) { bestPct = pct; best = { a, cur, target, pct }; }
  }
  if (!best) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const html = `🎯 ${state.lang === 'en' ? 'Next goal' : 'Objectif suivant'} : <b>${L(best.a,'name')}</b> : ${L(best.a,'desc')}
    <div class="nextGoalBarWrap"><div class="nextGoalBarFill" style="width:${best.pct}%;"></div></div>`;
  setHtmlIfChanged(box, html);
}

// Les succès secrets encore verrouillés passent en fin de liste, pour ne pas ouvrir le panneau
// sur un « ??? ». L'ordre ne change qu'au déblocage d'un secret : inutile de le recalculer à
// chaque image (le panneau est redessiné jusqu'à soixante fois par seconde tant qu'il est ouvert).
let _ordreSucces = null, _ordreSuccesCle = null;
function ordreAffichageSucces() {
  const cle = ACHIEVEMENTS.filter(a => a.secret && state.achievements[a.id]).length;
  if (cle !== _ordreSuccesCle) {
    _ordreSuccesCle = cle;
    _ordreSucces = ACHIEVEMENTS.filter(a => !(a.secret && !state.achievements[a.id]))
      .concat(ACHIEVEMENTS.filter(a => a.secret && !state.achievements[a.id]));
  }
  return _ordreSucces;
}

function renderAchievements() {
  const list = document.getElementById('achvList');
  // Le pourcentage affiché sur chaque succès s'additionne en un bonus PERMANENT de production :
  // le total est rappelé en tête, sinon rien ne disait à quoi servaient ces « +1 % ».
  const total = Math.round((achievementMultiplier() - 1) * 100);
  const resume = document.getElementById('achvSummary');
  const resumeHtml = state.lang === 'en'
    ? `Each achievement permanently boosts your Greenery production.<br>Current bonus: <b>+${total} %</b>`
    : `Chaque succès augmente pour toujours ta production de Verdure.<br>Bonus actuel : <b>+${total} %</b>`;
  setHtmlIfChanged(resume, resumeHtml);
  // Liste construite en texte puis ecrite seulement si elle change (une barre de progression qui
  // avance), au lieu d'etre reconstruite a chaque rafraichissement.
  let html = '';
  for (const a of ordreAffichageSucces()) {
    const unlocked = !!state.achievements[a.id];
    let barHtml = '';
    if (!unlocked && a.progress) {
      const [cur, target] = a.progress(state);
      const pct = Math.min(100, Math.max(0, (cur / target) * 100));
      barHtml = `<div class="achvBarWrap"><div class="achvBarFill" style="width:${pct}%;"></div></div><div style="font-size:10px;opacity:0.7;margin-top:2px;">${formatNum(cur)} / ${formatNum(target)}</div>`;
    }
    const isHiddenSecret = a.secret && !unlocked;
    const displayName = isHiddenSecret ? (state.lang === 'en' ? '??? (secret achievement)' : '??? (succès secret)') : L(a,'name');
    const displayDesc = isHiddenSecret ? (state.lang === 'en' ? 'Unlocked by playing... differently.' : 'Débloqué en jouant... autrement.') : L(a,'desc');
    html += `<div class="achv${unlocked ? '' : ' locked'}">
      <div class="achvTop">
        <div><div class="name">${unlocked ? '🏆' : '🔒'} ${displayName}</div><div class="desc">${displayDesc}</div></div>
        <div class="achvBonus">${unlocked ? `+${(a.bonus*100).toFixed(0)} % production` : '???'}</div>
      </div>
      ${barHtml}
    </div>`;
  }
  setHtmlIfChanged(list, html);
}

function mostOwnedBuilding() {
  let best = null, bestN = 0;
  for (const b of BUILDINGS) {
    const n = state.buildings[b.id] || 0;
    if (n > bestN) { bestN = n; best = b; }
  }
  return best ? `${L(best,'name')} (${bestN})` : 'Aucun';
}

// ================= FAMILIER À L'ÉCRAN =================
// Le familier actif se promène sur l'écran de jeu (son icône) dès qu'il est débloqué. Son bonus
// est calculé à part (voir familierBonus).
function renderCompanion() {
  const el = document.getElementById('companion');
  if (!el) return;
  const f = FAMILIERS_BY_ID[(state.familiers || {}).actif];
  const visible = !!f && f.unlock(state);
  el.style.display = visible ? 'block' : 'none';
  if (visible && el.textContent !== f.icon) el.textContent = f.icon;
}

// Vue agrandie d'un objet de la galerie — plein écran, se ferme au clic n'importe où.
function showGalleryLightbox(src, name, desc) {
  document.getElementById('galleryLightboxImg').src = src;
  document.getElementById('galleryLightboxName').textContent = name;
  document.getElementById('galleryLightboxDesc').textContent = desc;
  document.getElementById('galleryLightboxOverlay').style.display = 'flex';
}
document.getElementById('galleryLightboxOverlay').addEventListener('click', () => {
  document.getElementById('galleryLightboxOverlay').style.display = 'none';
});

// Galerie : un objet non encore possédé s'affiche en silhouette grisée (mystère à
// débloquer) plutôt que d'être caché, pour donner envie de continuer à jouer.
// La galerie est construite en texte puis ecrite seulement si elle change : reconstruite a chaque
// rafraichissement, elle recreait (et rechargeait) toutes ses images tant que la fenetre etait ouverte.
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const ids = Object.keys(ITEM_SPRITES);
  if (ids.length === 0) {
    setHtmlIfChanged(grid, `<p style="font-size:12px;opacity:0.6;">${state.lang === 'en' ? 'No items illustrated yet.' : "Aucun objet illustré pour l'instant."}</p>`);
    return;
  }
  let html = '';
  for (const id of ids) {
    const entry = ITEM_SPRITES[id];
    const { item, owned } = findSpriteItem(id, entry.kind);
    if (!item) continue;
    html += `<div class="galleryCard${owned ? '' : ' locked'}" data-sprite="${id}">
      <img src="${entry.src}" alt="" onerror="this.remove()">
      <div class="galleryCardName">${owned ? L(item, 'name') : '???'}</div>
    </div>`;
  }
  setHtmlIfChanged(grid, html);
  // Un seul gestionnaire pour toutes les cartes : la carte cliquee est reconnue a son data-sprite.
  grid.onclick = (e) => {
    const card = e.target.closest('.galleryCard:not(.locked)');
    if (!card) return;
    const entry = ITEM_SPRITES[card.dataset.sprite], { item } = findSpriteItem(card.dataset.sprite, entry.kind);
    showGalleryLightbox(entry.src, L(item, 'name'), L(item, 'desc'));
  };
}

function renderStatsTab() {
  const list = document.getElementById('statsList');
  const en = state.lang === 'en';
  const rows = [
    [en ? 'Current Greenery' : 'Verdure actuelle', formatNum(state.verdure)],
    [en ? 'Greenery earned (current run)' : 'Verdure gagnée (partie en cours)', formatNum(state.totalEarned)],
    [en ? 'Current production' : 'Production actuelle', formatRate(totalCps()) + '/sec'],
    [en ? 'Gain per click (total)' : 'Gain par clic (total)', formatNum(clickGain())],
    [en ? '· fixed part' : '· dont part fixe', formatNum(clickShopFlatMult() * totalClickFlatMultiplier())],
    [en ? '· % of production/s' : '· dont % de la production/s', formatNum(totalCps() * totalClickCpsPercent() * totalClickFlatMultiplier()) + ` (${(totalClickCpsPercent()*100).toFixed(2)}% ${en ? 'of production' : 'de la prod'})`],
    [en ? 'Total clicks' : 'Clics totaux', formatNum(state.totalClicks)],
    [en ? 'Golden weeds clicked' : 'Mauvaises herbes dorées cliquées', formatNum(state.goldenClicked)],
    [en ? 'Cosmic Seeds' : 'Graines Cosmiques', formatNum(state.cosmicSeeds)],
    [en ? 'Knowledge' : 'Connaissances', formatNum(state.knowledge)],
    [en ? 'Prestiges completed' : 'Prestiges effectués', state.prestigeCount],
    [en ? 'Weather multiplier' : 'Multiplicateur météo', 'x' + weatherMultiplier().toFixed(2)],
    [en ? 'Special items owned' : 'Objets du Spécial possédés', Object.keys(state.uniqueBuildings||{}).length + ' / ' + UNIQUE_BUILDINGS.length],
    [en ? 'Research unlocked' : 'Recherches débloquées', Object.keys(state.researchUpgrades||{}).length + ' / ' + RESEARCH.length],
    [en ? 'Click upgrades' : 'Améliorations de clic', Object.keys(state.clickUpgrades||{}).length + ' / ' + CLICK_UPGRADES.length],
    [en ? 'Total play time' : 'Temps de jeu total', formatDureeCourte(state.totalPlayTimeSec || 0)],
    [en ? 'Clicks per minute (average)' : 'Clics par minute (moyenne)', formatNum((state.totalClicks || 0) / Math.max(1, (state.totalPlayTimeSec || 1) / 60))],
    [en ? 'Most owned companion' : 'Compagnon le plus nombreux', mostOwnedBuilding()],
    [en ? '🏅 Best production/sec record' : '🏅 Record de production/sec', formatRate(state.bestCpsEver || 0) + '/sec'],
    [en ? '🏅 Fastest prestige' : '🏅 Prestige le plus rapide', state.fastestPrestigeSec ? formatDureeCourte(state.fastestPrestigeSec) : (en ? 'None yet (do 2 Prestiges)' : 'Aucun pour l\'instant (fais 2 Prestiges)')],
    [en ? '🌟 Stellar Shards' : '🌟 Éclats Stellaires', formatNum(state.stellarShards || 0) + ` (x${shardMultiplier().toFixed(2)} ${en ? 'production' : 'production'})`],
    [en ? '🌟 Ascensions completed' : '🌟 Ascensions effectuées', state.totalAscensions || 0],
  ];
  list.innerHTML = rows.map(r => `<div class="statLine"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}

// Les deux reglages de confort : l'etat affiche dit « Selon le systeme » tant que le joueur
// n'a rien impose lui-meme.
function renderConfortToggles() {
  const anim = document.getElementById('animStateLabel');
  if (anim) {
    const auto = state.reduireAnimations === null || state.reduireAnimations === undefined;
    const actif = animationsReduites();
    anim.textContent = auto ? `${tr('animAuto')} (${actif ? tr('enabledSingular') : tr('disabledSingular')})`
                            : (actif ? tr('enabledSingular') : tr('disabledSingular'));
    anim.className = 'state' + (actif ? ' on' : '');
  }
  const zoom = document.getElementById('zoomStateLabel');
  if (zoom) {
    const i = Math.max(0, ZOOMS_UI.indexOf(state.zoomUI));
    zoom.textContent = [tr('zoomNormal'), tr('zoomGrand'), tr('zoomTresGrand')][i];
    zoom.className = 'state' + (i > 0 ? ' on' : '');
  }
}

function renderSoundToggle() {
  const label = document.getElementById('soundStateLabel');
  if (!label) return;
  label.textContent = state.soundEnabled ? tr('enabled') : tr('disabled');
  label.className = 'state' + (state.soundEnabled ? ' on' : '');
  const slider = document.getElementById('volumeSlider');
  const volLabel = document.getElementById('volumeValueLabel');
  if (slider && document.activeElement !== slider) slider.value = state.soundVolume === undefined ? 100 : state.soundVolume;
  if (volLabel) volLabel.textContent = (state.soundVolume === undefined ? 100 : state.soundVolume) + '%';
}

// Applique la traduction à tous les éléments HTML statiques marqués data-i18n="clé"
// (titres de fenêtres, boutons, textes d'intro...) — appelée à chaque renderAll() et
// immédiatement après un changement de langue.
function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = tr(el.getAttribute('data-i18n'));
  });
}

function renderLangToggle() {
  const label = document.getElementById('langStateLabel');
  if (!label) return;
  label.textContent = state.lang === 'en' ? 'English' : 'Français';
}

function renderDarkModeToggle() {
  const label = document.getElementById('darkModeStateLabel');
  if (!label) return;
  label.textContent = state.forceDarkMode ? tr('enabledSingular') : tr('disabledSingular');
  label.className = 'state' + (state.forceDarkMode ? ' on' : '');
}

function renderVacationToggle() {
  const label = document.getElementById('vacationStateLabel');
  if (!label) return;
  label.textContent = state.vacationMode ? tr('enabledSingular') : tr('disabledSingular');
  label.className = 'state' + (state.vacationMode ? ' on' : '');
}

// Un panneau enfermé dans une fenêtre FERMÉE n'a aucune raison d'être redessiné : personne ne
// le voit, et il sera de toute façon régénéré à l'ouverture (openModal appelle renderAll).
// renderAll tourne à la cadence des clics : sans ce filtre, chaque clic reconstruisait les
// chaînes de 28 compagnons + 16 bâtiments + 28 améliorations de clic + la galerie (82 objets),
// pour un magasin fermé la quasi-totalité du temps.
function isOverlayOpen(id) {
  const el = document.getElementById(id);
  return !!el && el.classList.contains('open');
}
function noop() {}
// Quel rendu correspond à quel onglet. Les onglets sans contenu dynamique (Options, Bonus du
// jour au repos…) n'y figurent simplement pas.
const PANEL_RENDERERS = {
  production: renderShop,
  batiments: renderCompanionBuildings,
  clic: renderClickShop,
  special: renderSpecial,
  recherche: renderResearch,
  prestige: renderPrestige,
  ascension: renderAscension,
  automatisation: renderAutomation,
  familiers: renderFamiliers,
  quetes: renderQuests,
  defi: renderDefi,
  dailyreward: renderDailyRewardModal,
  stats: renderStatsTab,
  galerie: renderGallery,
};
// Temps de recharge exact sous l'icône : « 14 min 30 sec », « 1 min 2 sec », « 45 sec ». Chaque
// nombre occupe la largeur de deux chiffres (sans zéro devant) : le texte ne bouge pas pendant
// le décompte, et « 1 min 2 sec » prend la même place que « 14 min 30 sec ».
function abilityTimeHtml(sec) {
  const min = Math.floor(sec / 60);
  return min ? `${abilityNum(min)} min ${abilityNum(sec % 60)} sec` : `${abilityNum(sec)} sec`;
}
function abilityNum(v) { return `<span class="abilityNum">${v}</span>`; }
// Capacités du Spécial possédées, à portée de clic sur l'écran de jeu. Comme pour les pastilles de
// bonus, le HTML de chaque bouton est fixe : la recharge (cadran et temps) est mise à jour sur
// les nœuds existants, ce qui laisse la transition du cadran s'animer.
function renderAbilityBar() {
  const bar = document.getElementById('abilityBar');
  if (!bar) return;
  const capacites = UNIQUE_BUILDINGS.filter(u => u.active && uniqueActive(u.id));
  renderItemRows(bar, capacites.map(u => ({
    id: u.id,
    className: 'abilityBtn' + (activeCooldownRemaining(u.id) > 0 ? '' : ' ready'),
    html: `${getItemIconHtml(u.id) || '⚡'}<span class="abilityTime"></span>`,
    onclick: (e) => {
      if (activeCooldownRemaining(u.id) > 0) return;
      e.currentTarget.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
      activateUniqueAbility(u.id);
    },
  })));
  capacites.forEach((u, i) => {
    const el = bar.children[i];
    if (!el) return;
    const reste = activeCooldownRemaining(u.id);
    // Écrit seulement quand la valeur change (au millième) : chaque écriture relance la transition du cadran.
    const cd = reste > 0 ? (reste / u.active.cooldownMs).toFixed(3) : '0';
    if (el._cd !== cd) { el.style.setProperty('--cd', cd); el._cd = cd; }
    const titre = `${L(u,'name')} : ${L(u,'desc')}`;
    if (el.title !== titre) el.title = titre;
    // Le texte ne change qu'une fois par seconde : il n'est reconstruit qu'à ce moment-là.
    const sec = Math.ceil(reste / 1000);
    if (el._sec !== sec) { el._sec = sec; el.lastElementChild.innerHTML = sec > 0 ? abilityTimeHtml(sec) : ''; } // HTML fixe : le temps est le dernier enfant
  });
}
// Une fenêtre est dessinée quand elle est ouverte — ou quand on la met en page à l'avance
// (voir prechaufferFenetre). Le préchauffage passe ainsi par le rendu normal, au lieu d'en
// recopier une partie : une zone ajoutée à renderAll est préchauffée sans rien faire de plus.
let _fenetrePrechauffee = null;
function doitDessiner(overlayId) { return isOverlayOpen(overlayId) || _fenetrePrechauffee === overlayId; }
// Tout ce que le magasin affiche, en un seul endroit : appelé par renderAll quand la fenêtre est
// ouverte, et pendant son préchauffage. Ajouter une zone ici la fait suivre des deux côtés.
function renderPanneauxMagasin() {
  renderShopResourceBar();
  renderBuyModeRow();
  (PANEL_RENDERERS[activeShopTab] || noop)();
}
function renderAll() {
  renderTabsRow();
  renderPanelsVisibility();
  // totalCps() parcourt les 28 bâtiments et toute la pile de multiplicateurs : une seule fois
  // par rendu, partagée par les deux consommateurs de l'écran principal.
  const cps = totalCps();
  renderStats(cps);
  // Un seul panneau est visible par fenêtre : les autres sont en display:none. On ne dessine
  // donc que celui de l'onglet actif — les autres étaient reconstruits en pure perte, soit
  // ~157 lignes de HTML par rendu pour en afficher une trentaine.
  if (doitDessiner('shopPageOverlay')) renderPanneauxMagasin();
  if (doitDessiner('questsModalOverlay')) (PANEL_RENDERERS[activeQuestsTab] || noop)();
  if (doitDessiner('achievementsModalOverlay')) renderAchievements();
  if (doitDessiner('settingsModalOverlay')) {
    (PANEL_RENDERERS[activeSettingsTab] || noop)();
    renderSoundToggle();
    renderConfortToggles();
    renderSauvegardes();
    renderLangToggle();
    renderDarkModeToggle();
    renderVacationToggle();
    renderUndoImportBtn();
  }
  renderNextGoal();
  renderCompanion();
  renderAbilityBar();
  updateDocumentTitle(cps);
}

// ================= TITRE D'ONGLET DYNAMIQUE =================
let _titreApplique = '';
function updateDocumentTitle(cps) {
  const titre = `🌱 +${formatNum(cps === undefined ? totalCps() : cps)}/sec · FUZZ`;
  if (titre !== _titreApplique) { document.title = titre; _titreApplique = titre; }
}
