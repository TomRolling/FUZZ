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
  const type = _ceremonie.type;
  _ceremonie = null;
  fermerSurgissante('ceremonieOverlay', () => {
    document.getElementById('ceremonieOverlay').className = 'ceremonieOverlay';
    document.getElementById('ceremonieParticules').innerHTML = '';
    // Papi réagit une fois l'écran rendu au joueur.
    queueOrShowPapi(type, { position: 'top-right' });
  });
}

document.getElementById('decisionAnnulerBtn').addEventListener('click', () => fermerDecision());
document.getElementById('decisionConfirmerBtn').addEventListener('click', confirmerDecision);
document.getElementById('decisionOverlay').addEventListener('click', (e) => { if (e.target.id === 'decisionOverlay') fermerDecision(); });
document.getElementById('ceremonieOverlay').addEventListener('click', clicCeremonie);
