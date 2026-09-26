// ================= LES HABITANTS DU JARDIN =================
// Les compagnons possédés vivent dans la zone de clic, c'est-à-dire dans le jardin qu'on désherbe.
// Une créature par SORTE possédée (pas une par exemplaire) : elle se promène au sol à son rythme,
// sursaute quand on désherbe près d'elle, et grandit un peu à chaque palier franchi. Au Prestige,
// les compagnons repartent de zéro et le jardin se vide avec eux.
//
// Seules les sortes qui ont un VRAI dessin apparaissent : une image encore provisoire
// (`provisoire: true` dans ITEM_SPRITES) serait un carré de couleur posé sur l'écran principal,
// moins beau que l'écran vide. Retirer ce drapeau suffit à faire entrer la créature dans le jardin.
// Les dessins sont supposés regarder vers la droite ; `regardeAGauche: true` dit le contraire.
//
// Chaque créature vit sur son PROPRE CALQUE, en permanence (will-change dans le CSS), et tous ses
// mouvements passent par la carte graphique (translate, transform). Deux essais ont précédé :
//   - transform sans calque permanent : le navigateur sortait la créature sur un calque le temps de
//     chaque animation puis la réintégrait, et à une échelle non entière (fenêtre agrandie, écran à
//     125 %) les deux rendus d'une image très réduite (738 px pour ~50) diffèrent : elle « se
//     pixellisait puis redevenait nette » à chaque bond ;
//   - top et left, dessinés dans la page : plus de bascule, mais une image y est calée sur la grille
//     des pixels, donc le mouvement avançait par sauts d'un pixel entier. Le dandinement (3 px) n'avait
//     que trois ou quatre positions : ça saccadait, « comme en 30 images par seconde ».
// Un calque permanent réunit les deux : placement au sous-pixel près, et aucune bascule.
//
// Deux couches par créature :
//   .habitant      la position (translate, transition CSS : c'est la marche), le dandinement, le bond
//                  et l'arrivée (transform) ; translate et transform se composent sans se remplacer.
//   .habitantSens  le sens de marche (retournement horizontal, fixe)
// La position est retenue en % de la largeur du jardin et convertie en pixels au moment de bouger :
// la zone n'a pas encore de taille au démarrage (écran d'accueil), et elle change avec la fenêtre.

const HABITANT_TAILLE_BASE = 46, HABITANT_TAILLE_PAR_PALIER = 3, HABITANT_TAILLE_MAX = 78;
// Au sol : bas de la zone de clic, entre ces deux hauteurs (en % depuis le bas)…
const HABITANT_SOL_MIN = 3, HABITANT_SOL_MAX = 17;
// … et entre ces deux bords (en % depuis la gauche, taille de la créature comprise).
const HABITANT_BORD_MIN = 2, HABITANT_BORD_MAX = 92;
const _habitants = new Map(); // id -> { el, sens, img, x, taille, vitesse, prochainDepart, bond, gauche }
let _largeurJardin = 0;

// Nombre pseudo-aléatoire stable, tiré de l'id : chaque sorte garde sa profondeur, sa vitesse et
// son point de départ d'une session à l'autre.
function hacheHabitant(texte) {
  let v = 2166136261;
  for (const c of texte) v = Math.imul(v ^ c.charCodeAt(0), 16777619);
  return (v >>> 0) / 4294967296;
}

function habitantsVisibles() {
  return BUILDINGS.filter(b => (state.buildings[b.id] || 0) > 0 && ITEM_SPRITES[b.id] && !ITEM_SPRITES[b.id].provisoire);
}
function tailleHabitant(id) {
  return Math.min(HABITANT_TAILLE_MAX, HABITANT_TAILLE_BASE + HABITANT_TAILLE_PAR_PALIER * companionMilestoneCount(state.buildings[id] || 0));
}
const pxHabitant = (x) => (x / 100 * _largeurJardin).toFixed(2) + 'px 0';

// Appelée par renderAll : ne touche au DOM que si une sorte arrive, part ou change de taille.
function renderJardin() {
  const zone = document.getElementById('jardinHabitants');
  if (!zone) return;
  const voulus = new Set();
  let enseigne; // mesurée une seule fois, et seulement si une créature arrive
  for (const b of habitantsVisibles()) {
    voulus.add(b.id);
    const h = _habitants.get(b.id) || creerHabitant(zone, b, enseigne === undefined ? (enseigne = solSousEnseigne(zone)) : enseigne);
    const t = tailleHabitant(b.id);
    if (h.taille !== t) { h.taille = t; h.img.style.width = h.img.style.height = t + 'px'; }
  }
  for (const [id, h] of _habitants) if (!voulus.has(id)) { h.el.remove(); _habitants.delete(id); }
  // Largeur encore inconnue (démarrage) : la mesurer. Ensuite, seul un redimensionnement la change,
  // et il a son propre signal (gameviewportfit) : la relire à chaque rendu forçait un calcul de mise
  // en page au milieu de chaque image.
  if (!_largeurJardin) recalerHabitants();
}

// Largeur du jardin changée (démarrage, fenêtre redimensionnée, zoom de l'interface) : chaque
// créature est replacée d'un coup à sa position, exprimée en % de la nouvelle largeur. Armée sur
// `gameviewportfit` dans demarrage.js, et appelée à chaque rendu ; ne fait rien si rien n'a changé.
function recalerHabitants() {
  const zone = document.getElementById('jardinHabitants');
  const largeur = zone ? zone.clientWidth : 0;
  if (!largeur || largeur === _largeurJardin) return;
  _largeurJardin = largeur;
  for (const h of _habitants.values()) {
    h.el.style.transitionDuration = '0s';
    h.el.classList.remove('enMarche');
    h.el.style.translate = pxHabitant(h.x);
  }
}

function creerHabitant(zone, b, cache) {
  const el = document.createElement('div');
  el.className = 'habitant';
  const profondeur = hacheHabitant(b.id + ':sol');
  el.style.bottom = (HABITANT_SOL_MIN + profondeur * (HABITANT_SOL_MAX - HABITANT_SOL_MIN)).toFixed(1) + '%';
  el.style.zIndex = String(Math.round((1 - profondeur) * 100)); // plus bas à l'écran = plus près = devant
  let x = HABITANT_BORD_MIN + hacheHabitant(b.id + ':x') * (HABITANT_BORD_MAX - HABITANT_BORD_MIN);
  // La place de départ non plus ne doit pas être derrière l'enseigne.
  if (cache && x > cache[0] && x < cache[1]) x = Math.min(HABITANT_BORD_MAX, cache[1] + 1);
  el.innerHTML = '<div class="habitantSens"><img class="habitantImg" alt="" draggable="false"></div>';
  const sens = el.firstChild, img = sens.firstChild;
  img.src = ITEM_SPRITES[b.id].src;
  // La marche s'arrête quand la transition de position se termine : le dandinement aussi.
  el.addEventListener('transitionend', () => el.classList.remove('enMarche'));
  zone.appendChild(el);
  const h = { el, sens, img, x, taille: 0, vitesse: 1.5 + 2.5 * hacheHabitant(b.id + ':v'), // en % du jardin par seconde
    prochainDepart: performance.now() + 1500 + 4000 * Math.random(), bond: null, gauche: !!ITEM_SPRITES[b.id].regardeAGauche };
  _habitants.set(b.id, h);
  if (_largeurJardin) el.style.translate = pxHabitant(x);
  // Arrivée : la créature tombe dans le jardin avec un petit rebond (aussi au chargement de la partie).
  if (!animationsReduites()) {
    el.animate([{ transform: 'translateY(-30px) scale(0.5)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }],
      { duration: 420, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  }
  return h;
}

// Portion du sol cachée par l'enseigne du magasin, en % de la zone (ou null si elle n'y passe pas).
// Une créature peut y passer, jamais s'y arrêter : avec un seul habitant, c'était tout le jardin qui
// disparaissait derrière le panneau pendant sa pause.
function solSousEnseigne(zone) {
  const btn = document.getElementById('shopBtn');
  if (!btn || btn.offsetParent === null) return null;
  // Dans l'espace du jeu (rectInGameViewport), comme HABITANT_TAILLE_MAX : en pixels d'écran, la
  // marge était fausse dès que l'échelle n'était pas 1 (zoom de l'interface, écran à 125 %).
  const z = rectInGameViewport(zone), r = rectInGameViewport(btn);
  if (!z.width || r.top > z.bottom || r.bottom < z.bottom - z.height * (HABITANT_SOL_MAX + 12) / 100) return null;
  const marge = HABITANT_TAILLE_MAX / z.width * 100; // la créature entière doit sortir de derrière
  return [(r.left - z.left) / z.width * 100 - marge, (r.right - z.left) / z.width * 100];
}

// Une fois par tick (armé dans demarrage.js) : chaque créature dont la pause est finie repart d'un
// petit pas, dans un sens au hasard, et fait demi-tour au bord. Rien en arrière-plan ni en mode
// animations réduites : elles restent alors à leur place.
function promenerHabitants() {
  if (document.hidden || !_habitants.size || !_largeurJardin || animationsReduites()) return;
  const maintenant = performance.now();
  const cache = solSousEnseigne(document.getElementById('jardinHabitants'));
  for (const h of _habitants.values()) {
    if (maintenant < h.prochainDepart) continue;
    const pas = (8 + Math.random() * 22) * (Math.random() < 0.5 ? -1 : 1);
    let cible = h.x + pas;
    if (cible < HABITANT_BORD_MIN || cible > HABITANT_BORD_MAX) cible = h.x - pas;
    // Arrêt prévu derrière l'enseigne : elle traverse et s'arrête juste de l'autre côté.
    if (cache && cible > cache[0] && cible < cache[1]) cible = cible > h.x ? cache[1] + 1 : cache[0] - 1;
    cible = Math.min(HABITANT_BORD_MAX, Math.max(HABITANT_BORD_MIN, cible));
    if (Math.abs(cible - h.x) < 1) continue;
    const duree = Math.abs(cible - h.x) / h.vitesse; // secondes
    h.el.style.transitionDuration = duree.toFixed(2) + 's';
    h.el.style.translate = pxHabitant(cible);
    h.sens.style.transform = (cible < h.x) !== h.gauche ? 'scaleX(-1)' : '';
    h.el.classList.add('enMarche');
    h.x = cible;
    h.prochainDepart = maintenant + duree * 1000 + 2000 + Math.random() * 5000;
  }
}

// Appelée à chaque clic de désherbage : les créatures proches du clic sursautent.
function faireSursauterHabitants(x, y) {
  if (!_habitants.size || animationsReduites()) return;
  // Toutes les mesures d'abord, puis les animations : alterner les deux forçait un recalcul de style
  // par créature. La position se mesure (et ne se déduit pas de h.x) : une créature en marche est
  // entre deux places, h.x ne donne que sa destination.
  const proches = [..._habitants.values()].filter(h => {
    const r = h.img.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    return dx * dx + dy * dy <= (r.width * 2.2) ** 2;
  });
  for (const h of proches) {
    if (h.bond) h.bond.cancel(); // clics en rafale : le nouveau bond remplace le précédent
    h.bond = h.el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)', offset: 0.35 }, { transform: 'translateY(0)' }],
      { duration: 340, easing: 'ease-out' });
  }
}
