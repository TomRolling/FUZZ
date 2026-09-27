// ================= PRESTIGE ET ASCENSION : DÉCISION ET CÉRÉMONIE =================
// Les deux plus grands moments du jeu. Ils passaient par confirm(), la fenêtre système grise, avec
// un paragraphe à lire, puis se résumaient à un son et une notification. Désormais :
//   1. un PANNEAU DE DÉCISION aux couleurs du jeu : ce qu'on gagne (en chiffres, effet compris),
//      ce qu'on garde, ce qui repart de zéro, et l'état du défi en cours ;
//   2. une CÉRÉMONIE : une vague verte terraforme le jardin (Prestige), ou un ciel étoilé laisse
//      tomber les Éclats (Ascension), puis un BILAN de ce qui vient de changer.
// Le Prestige revient souvent (189 en 25 jours au banc) : sa séquence est courte, plus brève
// encore une fois connue, et un clic la passe. L'Ascension est rare (10 en 25 jours) : la sienne
// prend son temps. Seuls les boutons passent par ici : l'automatisation, le mode test et le banc
// appellent doPrestige() / doAscension(), sans panneau ni cérémonie.
// Le vrai Prestige a lieu quand la vague ou le ciel couvre l'écran : le joueur ne voit pas ses
// compteurs tomber à zéro, il découvre le jardin neuf quand l'écran se découvre.

// Nombre d'éléments et accord : « 1 Graine Cosmique », « 3 Graines Cosmiques ».
function nombreDe(n, singulier, pluriel) { return formatNum(n) + ' ' + (n > 1 ? pluriel : singulier); }
const graines = (n) => nombreDe(n, selonLangue('Graine Cosmique', 'Cosmic Seed'), selonLangue('Graines Cosmiques', 'Cosmic Seeds'));
const eclats = (n) => nombreDe(n, selonLangue('Éclat Stellaire', 'Stellar Shard'), selonLangue('Éclats Stellaires', 'Stellar Shards'));
const ongletNom = (id) => { const t = TAB_DEFS.find(x => x.id === id); return t ? L(t, 'label') : id; };
// « Libellé : ×A → ×B », le chiffre qui compte en gras. Même ligne dans le panneau et dans le bilan.
const ligneMult = (libelle, avant, apres) => libelle + ' : ' + '×' + trimZeros(avant) + ' → <b>×' + trimZeros(apres) + '</b>';
const LIBELLES = {
  bonusGraines: () => selonLangue('Bonus de production des Graines', 'Seed production bonus'),
  production: () => selonLangue('Production', 'Production'),
  grainesParPrestige: () => selonLangue('Graines de chaque Prestige', 'Seeds from each Prestige'),
};

let _decisionType = null;   // 'prestige' | 'ascension' tant que le panneau est ouvert
let _ceremonie = null;      // { type, bilan, resultat, minuteurs } pendant la séquence et le bilan

function decisionOuverte() { return _decisionType !== null; }
function ceremonieEnCours() { return _ceremonie !== null; }

// Ce que le panneau annonce, calculé sans rien modifier : les mêmes formules que le Prestige réel.
function bilanPrevuPrestige() {
  const gain = prestigeGainAmount();
  const s = state.seedsSinceAscension || 0;
  return { gain, bonusAvant: seedMultiplierPour(s), bonusApres: seedMultiplierPour(s + gain), defi: activeChallenge(), defiReussi: defiReussiPour(gain) };
}
function bilanPrevuAscension() {
  const gain = ascensionGainAmount();
  const n = state.totalShardsEarned || 0;
  return { gain, prodAvant: shardMultiplierPour(n), prodApres: shardMultiplierPour(n + gain),
    grainesAvant: shardSeedMultiplierPour(n), grainesApres: shardSeedMultiplierPour(n + gain),
    grainesPerdues: state.cosmicSeeds || 0, bonusGrainesPerdu: seedMultiplier(),
    amelioPerdues: Object.keys(state.prestigeUpgrades || {}).length, defi: activeChallenge() };
}

function listeHtml(id, lignes) {
  document.getElementById(id).innerHTML = lignes.map(l => '<li>' + l + '</li>').join('');
}

// Appelé par les boutons « Terraformer » et « Ascensionner » du magasin (boucle.js).
function ouvrirDecision(type) {
  if (decisionOuverte() || ceremonieEnCours()) return;
  const prestige = type === 'prestige';
  const b = prestige ? bilanPrevuPrestige() : bilanPrevuAscension();
  if (b.gain < 1) return;
  _decisionType = type;
  const ov = document.getElementById('decisionOverlay');
  ov.classList.toggle('ascension', !prestige);
  document.getElementById('decisionTitre').textContent = tr(prestige ? 'decisionPrestigeTitre' : 'decisionAscensionTitre');
  document.getElementById('decisionConfirmerBtn').textContent = tr(prestige ? 'decisionTerraformer' : 'decisionAscensionner');
  // Ce que les deux gardent, et ce que les deux remettent à zéro (voir resetRun) ; chacun y ajoute le sien.
  const garde = [ongletNom('recherche'), tr('decisionConnaissances'), ongletNom('succes'), ongletNom('familiers')];
  const perd = [tr('verdureWord'), ongletNom('production'), ongletNom('clic'), ongletNom('batiments'), ongletNom('special')];
  let gagne, defi = '', defiClasse = 'rate';
  if (prestige) {
    gagne = ['<b>+' + graines(b.gain) + '</b>', ligneMult(LIBELLES.bonusGraines(), b.bonusAvant, b.bonusApres)];
    garde.push(selonLangue('Améliorations de Prestige', 'Prestige upgrades'));
    if ((state.totalShardsEarned || 0) > 0) garde.push(selonLangue('Éclats Stellaires et Ascension', 'Stellar Shards and Ascension'));
    if (b.defi) {
      defiClasse = b.defiReussi ? 'reussi' : 'rate';
      const nom = L(b.defi, 'name'), objectif = nombreDe(b.defi.goal, selonLangue('Graine', 'Seed'), selonLangue('Graines', 'Seeds'));
      defi = b.defiReussi
        ? selonLangue(`🏅 Ce Prestige réussit le défi « ${nom} ».`, `🏅 This Prestige completes the challenge "${nom}".`)
        : selonLangue(`⚠️ Le défi « ${nom} » n'est pas réussi (objectif : ${objectif}${b.defi.timeLimitSec ? ', dans le temps imparti' : ''}) : il prendra fin.`,
                      `⚠️ The challenge "${nom}" is not completed (goal: ${objectif}${b.defi.timeLimitSec ? ', within the time limit' : ''}): it will end.`);
    }
  } else {
    gagne = ['<b>+' + eclats(b.gain) + '</b>', ligneMult(LIBELLES.production(), b.prodAvant, b.prodApres),
      ligneMult(LIBELLES.grainesParPrestige(), b.grainesAvant, b.grainesApres)];
    garde.push(selonLangue('Améliorations d\'Ascension', 'Ascension upgrades'));
    perd.push('<b>' + graines(b.grainesPerdues) + '</b> ' + selonLangue('et leur bonus', 'and their bonus') + ' (×' + trimZeros(b.bonusGrainesPerdu) + ')');
    if (b.amelioPerdues) perd.push(nombreDe(b.amelioPerdues, selonLangue('amélioration de Prestige', 'Prestige upgrade'), selonLangue('améliorations de Prestige', 'Prestige upgrades')));
    if (b.defi) defi = selonLangue(`⚠️ L'Ascension met fin au défi « ${L(b.defi, 'name')} ».`, `⚠️ Ascending ends the challenge "${L(b.defi, 'name')}".`);
  }
  listeHtml('decisionGagne', gagne);
  listeHtml('decisionGarde', garde);
  listeHtml('decisionPerd', perd);
  const defiEl = document.getElementById('decisionDefi');
  defiEl.textContent = defi;
  defiEl.className = 'decisionDefi' + (defi ? ' ' + defiClasse : '');
  ov.style.display = 'flex';
  document.getElementById('decisionConfirmerBtn').focus({ preventScroll: true });
}

function fermerDecision() {
  if (!decisionOuverte()) return;
  _decisionType = null;
  fermerSurgissante('decisionOverlay');
}

// La cérémonie démarre AUSSITÔT, par-dessus le panneau qui s'efface. Elle attendait la fin du fondu
// (~0,12 s), et un second clic pendant ce temps (un double-clic sur « Terraformer ») traversait le
// panneau et atterrissait dans le magasin en dessous : un achat involontaire.
function confirmerDecision() {
  const type = _decisionType;
  if (!type) return;
  fermerDecision();
  lancerCeremonie(type);
}

// ---------- La cérémonie ----------
// Durées (ms). Le Prestige raccourcit une fois que le joueur l'a vu quelques fois. Seule source de ces
// durées : le CSS les lit dans --ceremonie-couvre et --ceremonie-decouvre.
const CEREMONIE = {
  prestige:  { couvre: 650, decouvre: 700, graines: 700 },
  prestigeCourt: { couvre: 380, decouvre: 420, graines: 450 },
  ascension: { couvre: 1100, decouvre: 1000, graines: 1300 },
};
const PRESTIGES_AVANT_VERSION_COURTE = 3;

function lancerCeremonie(type) {
  const ov = document.getElementById('ceremonieOverlay');
  const court = type === 'prestige' && (state.prestigeCount || 0) >= PRESTIGES_AVANT_VERSION_COURTE;
  const d = CEREMONIE[type === 'prestige' ? (court ? 'prestigeCourt' : 'prestige') : 'ascension'];
  _ceremonie = { type, bilan: false, resultat: null, minuteurs: [] };
  ov.className = 'ceremonieOverlay ' + type;
  document.getElementById('ceremonieBilan').classList.remove('visible');
  document.getElementById('ceremonieParticules').innerHTML = '';
  ov.style.setProperty('--ceremonie-couvre', d.couvre + 'ms');
  ov.style.setProperty('--ceremonie-decouvre', d.decouvre + 'ms');
  // Affichée comme les autres petites fenêtres (display:flex, refermée par fermerSurgissante) : Échap
  // la reconnaît de la même façon (voir fenetreDuDessus).
  ov.style.display = 'flex';
  if (animationsReduites()) { afficherBilan(); return; }
  if (type === 'prestige') playPrestigeSound(); else playAscensionSound();
  const plus = (ms, f) => _ceremonie.minuteurs.push(setTimeout(f, ms));
  // L'écran est couvert : c'est maintenant que la partie repart de zéro, à l'abri des regards.
  plus(d.couvre, () => {
    executerCeremonie();
    ov.classList.add('decouvre');
    lancerParticules(type, d.graines);
  });
  plus(d.couvre + Math.max(d.decouvre, d.graines) + 120, afficherBilan);
}

function executerCeremonie() {
  if (!_ceremonie || _ceremonie.resultat) return;
  // On terraforme le JARDIN : c'est lui qu'on doit retrouver quand l'écran se découvre, pas le
  // magasin d'où le Prestige a été décidé (le joueur y était ramené, demande du joueur). Fermé ici,
  // pendant que la vague ou le ciel couvre l'écran, sa fermeture ne se voit pas. Les Graines volent
  // alors vers le compteur de l'écran principal, et Papi parle juste après le bilan au lieu
  // d'attendre qu'on quitte le magasin.
  if (isOverlayOpen('shopPageOverlay')) fermerMagasin();
  _ceremonie.resultat = _ceremonie.type === 'prestige' ? executerPrestige() : executerAscension();
}

// Graines (Prestige) qui volent vers leur compteur, ou Éclats (Ascension) qui tombent vers le
// centre, là où le bilan va s'ouvrir. Pas plus d'une douzaine : au-delà, c'est du bruit.
function lancerParticules(type, duree) {
  const zone = document.getElementById('ceremonieParticules');
  const r = _ceremonie.resultat;
  const n = Math.max(3, Math.min(12, r ? r.gain : 3));
  const vp = document.getElementById('gameViewport');
  const L_ = vp.offsetWidth, H_ = vp.offsetHeight;
  const cible = document.getElementById('seedsText');
  const rc = type === 'prestige' && cible && cible.offsetParent ? rectInGameViewport(cible) : null;
  const tx = rc ? rc.left + rc.width / 2 : L_ / 2, ty = rc ? rc.top + rc.height / 2 : H_ * 0.42;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'ceremonieParticule';
    p.textContent = type === 'prestige' ? '🌌' : '✦';
    const x0 = type === 'prestige' ? L_ / 2 + (Math.random() - 0.5) * L_ * 0.5 : Math.random() * L_;
    const y0 = type === 'prestige' ? H_ * 0.62 + (Math.random() - 0.5) * H_ * 0.2 : -30;
    p.style.left = x0 + 'px'; p.style.top = y0 + 'px';
    zone.appendChild(p);
    const retard = (i / n) * duree * 0.45;
    p.animate([
      { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
      { transform: 'translate(0, 0) scale(1.1)', opacity: 1, offset: 0.2 },
      { transform: `translate(${tx - x0}px, ${ty - y0}px) scale(0.5)`, opacity: 0 },
    ], { duration: duree * (type === 'ascension' ? 0.9 : 0.7), delay: retard, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
    if (i < 6) _ceremonie.minuteurs.push(setTimeout(() => playTone(type === 'prestige' ? 1047 + i * 80 : 660 + i * 110, 0.06, 'sine', 0.025), retard + duree * 0.7));
  }
}

function afficherBilan() {
  if (!_ceremonie) return;
  executerCeremonie(); // passé d'un clic avant que l'écran soit couvert
  _ceremonie.minuteurs.forEach(clearTimeout); _ceremonie.minuteurs = [];
  _ceremonie.bilan = true;
  document.getElementById('ceremonieOverlay').classList.add('decouvre', 'fini');
  const r = _ceremonie.resultat || { gain: 0 };
  const prestige = _ceremonie.type === 'prestige';
  document.getElementById('ceremonieTitre').textContent = (prestige ? '🌍 ' : '🌟 ') + tr(prestige ? 'ceremoniePrestigeTitre' : 'ceremonieAscensionTitre');
  const lignes = prestige
    ? ['<b>+' + graines(r.gain) + '</b>', r.bonusAvant && ligneMult(LIBELLES.bonusGraines(), r.bonusAvant, r.bonusApres),
       r.defi && (r.defiReussi ? selonLangue(`🏅 Défi réussi : ${L(r.defi, 'name')}`, `🏅 Challenge completed: ${L(r.defi, 'name')}`)
                               : selonLangue(`Défi raté : ${L(r.defi, 'name')}`, `Challenge failed: ${L(r.defi, 'name')}`))]
    : ['<b>+' + eclats(r.gain) + '</b>', r.prodAvant && ligneMult(LIBELLES.production(), r.prodAvant, r.prodApres),
       r.grainesAvant && ligneMult(LIBELLES.grainesParPrestige(), r.grainesAvant, r.grainesApres)];
  document.getElementById('ceremonieLignes').innerHTML = lignes.filter(Boolean).map(l => '<div>' + l + '</div>').join('');
  document.getElementById('ceremonieBilan').classList.add('visible');
}

// Un clic : pendant la séquence, il la passe ; sur le bilan, il le referme.
function clicCeremonie() {
  if (!_ceremonie) return;
  if (!_ceremonie.bilan) { afficherBilan(); return; }
  const { type, resultat } = _ceremonie;
  _ceremonie = null;
  fermerSurgissante('ceremonieOverlay', () => {
    document.getElementById('ceremonieOverlay').className = 'ceremonieOverlay';
    document.getElementById('ceremonieParticules').innerHTML = '';
    // Papi réagit une fois l'écran rendu au joueur.
    faireLePoint(type, resultat);
  });
}

// ---------- Le point de Papi ----------
// Après un Prestige ou une Ascension, rien ne disait au joueur où dépenser ce qu'il venait de
// gagner, ni ce qui s'était débloqué : un nouveau familier n'avait droit qu'à une notification,
// un nouveau défi à rien du tout. Papi fait donc le point, tiré de la partie : où dépenser les
// Graines ou les Éclats, et ce qui vient d'apparaître. Les onglets dont il parle portent une
// pastille jusqu'à ce que le joueur les ouvre. Point complet aux premiers Prestiges, à chaque
// Ascension et dès que quelque chose se débloque ; sinon sa courte réplique habituelle (189
// Prestiges en 25 jours au banc : le même discours à chaque fois lasserait).
// Un onglet qui apparaît a droit à sa propre présentation (verifierNouveauxOnglets) : Papi n'en
// détaille pas le contenu, il prévient seulement qu'il a du nouveau à montrer, et la présentation
// attend la fin de la scène (isMainScreenBlocked la voit).
// Le point est un moment important : Papi le dit en scène (papiEnScene), en grand comme dans
// l'introduction. Dit en petite bulle, le joueur ouvrait le magasin par-dessus et ne lisait rien.

// Ce que Papi dit d'une nouveauté dans un onglet déjà connu, selon qu'il y en a une ou plusieurs.
const PHRASES_NOUVEAUTES = {
  familiers: [
    (n) => selonLangue(`Un nouveau familier t'attend dans l'onglet Familiers : ${n}. Un seul t'aide à la fois, à toi de choisir.`, `A new pet is waiting in the Pets tab: ${n}. Only one helps you at a time, so pick one.`),
    (n) => selonLangue(`De nouveaux familiers t'attendent dans l'onglet Familiers : ${n}. Un seul t'aide à la fois, à toi de choisir.`, `New pets are waiting in the Pets tab: ${n}. Only one helps you at a time, so pick one.`)],
  automatisation: [
    (n) => selonLangue(`Nouvelle automatisation dans l'onglet Automatisation : ${n}. Pense à l'activer.`, `New automation in the Automation tab: ${n}. Remember to switch it on.`),
    (n) => selonLangue(`Nouvelles automatisations dans l'onglet Automatisation : ${n}. Pense à les activer.`, `New automations in the Automation tab: ${n}. Remember to switch them on.`)],
  defi: [
    (n) => selonLangue(`Nouveau défi dans les Quêtes, onglet Défi : ${n}.`, `New challenge in Quests, Challenge tab: ${n}.`),
    (n) => selonLangue(`Nouveaux défis dans les Quêtes, onglet Défi : ${n}.`, `New challenges in Quests, Challenge tab: ${n}.`)],
};

// « 🦉 Chouette », « 🦉 Chouette et 🐝 Abeille ».
const nomsDe = (liste) => liste.map(x => x.icon + ' ' + L(x, 'name')).join(selonLangue(' et ', ' and '));
function lignesDuPoint(type, resultat) {
  // Ce que le reset vient de débloquer (voir executerPrestige) ; vide si le bilan a été passé sans résultat.
  const nouveautes = (resultat && resultat.nouveautes) || {};
  const lignes = [], onglets = [];
  const vu = (id) => !!state.tabsSeen[id];
  // Un défi réussi : un grand moment, dit en premier. Le tout premier a droit à ses félicitations.
  const defiReussi = type === 'prestige' && resultat && resultat.defiReussi ? resultat.defi : null;
  if (defiReussi) {
    const nom = nomsDe([defiReussi]), recompense = L(defiReussi, 'reward');
    if (challengesDoneCount(state) === 1) lignes.push(
      selonLangue(`Tu as réussi ton premier défi : ${nom} ! Je n'y croyais qu'à moitié, je te l'avoue.`, `You completed your first challenge: ${nom}! I only half believed you could, I admit.`),
      selonLangue(`Sa récompense est à toi pour toujours : ${recompense}. D'autres défis t'attendent dans les Quêtes, onglet Défi.`, `Its reward is yours forever: ${recompense}. More challenges are waiting in Quests, Challenge tab.`));
    else lignes.push(selonLangue(`Défi réussi : ${nom}. Sa récompense est à toi pour toujours : ${recompense}.`, `Challenge completed: ${nom}. Its reward is yours forever: ${recompense}.`));
  }
  if (type === 'prestige') {
    lignes.push(selonLangue(
      `Te voilà avec ${graines(state.cosmicSeeds)} en poche. Dans l'onglet Prestige, elles s'échangent contre des améliorations qui te suivent d'un Prestige à l'autre.`,
      `You now have ${graines(state.cosmicSeeds)} to spend. In the Prestige tab, they buy upgrades that stay with you from one Prestige to the next.`));
    onglets.push('prestige');
    if (vu('familiers')) {
      lignes.push(selonLangue('Tes Graines font aussi monter tes familiers de niveau, dans l\'onglet Familiers.', 'Your Seeds also level up your pets, in the Pets tab.'));
      onglets.push('familiers');
    }
  } else {
    lignes.push(selonLangue(
      `Tu as maintenant ${eclats(state.stellarShards)} à dépenser dans l'onglet Ascension. Ce que tu y achètes ne disparaît jamais.`,
      `You now have ${eclats(state.stellarShards)} to spend in the Ascension tab. What you buy there is never lost.`),
    selonLangue(
      'Tes Graines et tes améliorations de Prestige sont reparties à zéro. Refais des Prestiges : grâce à tes Éclats, chacun te rapportera plus de Graines qu\'avant.',
      'Your Seeds and Prestige upgrades are back to zero. Prestige again: thanks to your Shards, each one will bring you more Seeds than before.'));
    onglets.push('ascension');
  }
  // Nouveautés dans un onglet déjà connu. Dans un onglet qui apparaît, sa présentation s'en charge.
  for (const { onglet } of DEBLOCAGES) {
    const liste = nouveautes[onglet] || [];
    if (!liste.length || !vu(onglet)) continue;
    lignes.push(PHRASES_NOUVEAUTES[onglet][liste.length > 1 ? 1 : 0](nomsDe(liste)));
    onglets.push(onglet);
  }
  const ongletsQuiApparaissent = unlockedTabs().some(t => !vu(t.id) && !t.silent);
  if (ongletsQuiApparaissent) lignes.push(selonLangue('Et ce n\'est pas tout : j\'ai du nouveau à te montrer.', 'And that\'s not all: I have something new to show you.'));
  const aSignaler = !!defiReussi || ongletsQuiApparaissent || Object.values(nouveautes).some(l => l.length);
  return { lignes, onglets, aSignaler };
}

function faireLePoint(type, resultat) {
  const point = lignesDuPoint(type, resultat);
  const complet = type === 'ascension' || (state.prestigeCount || 0) <= PRESTIGES_AVANT_VERSION_COURTE || point.aSignaler;
  if (!complet || isMainScreenBlocked()) { queueOrShowPapi(type, { position: 'top-right' }); return; }
  point.onglets.forEach(id => _ongletsAVoir.add(id));
  const reaction = pickPapiLine(type);
  papiEnScene(reaction ? [reaction, ...point.lignes] : point.lignes, flushPendingPapiCategories);
  renderAll();
}

document.getElementById('decisionAnnulerBtn').addEventListener('click', () => fermerDecision());
document.getElementById('decisionConfirmerBtn').addEventListener('click', confirmerDecision);
document.getElementById('decisionOverlay').addEventListener('click', (e) => { if (e.target.id === 'decisionOverlay') fermerDecision(); });
document.getElementById('ceremonieOverlay').addEventListener('click', clicCeremonie);
