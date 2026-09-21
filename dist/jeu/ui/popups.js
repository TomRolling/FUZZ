// ================= FENÊTRES « OBJET OBTENU » ET PETITES FENÊTRES =================
// Icônes d'objets, fenêtre de découverte, et fermerSurgissante, la sortie en fondu commune aux
// petites fenêtres (Nouvel objet, Bonus du jour, Absence, Signalement).

function getItemIconHtml(id, masked) {
  const entry = ITEM_SPRITES[id];
  if (!entry) return '';
  // Masqué (silhouette sombre) tant que le joueur n'a pas assez d'argent pour l'acheter — le
  // sprite ne se révèle qu'une fois l'achat à sa portée, pour garder un peu de découverte.
  const maskClass = masked ? ' itemIcon-masked' : '';
  return `<img src="${entry.src}" class="itemIcon${maskClass}" alt="" onerror="this.remove()">`;
}
// Retrouve la définition (nom/desc) et le statut de possession d'un objet illustré, quel
// que soit le tableau auquel il appartient — utilisé par le pop-up de révélation et la galerie.
// Table id -> définition, construite une seule fois (BUILDINGS/CLICK_UPGRADES/UNIQUE_BUILDINGS
// sont des tableaux de config statiques, jamais modifiés après leur déclaration) — un seul id
// à chercher au lieu d'un .find() sur le tableau du bon "kind" à chaque appel.
let _spriteItemById = null;
function findSpriteItem(id, kind) {
  if (!_spriteItemById) {
    _spriteItemById = new Map();
    [...BUILDINGS, ...CLICK_UPGRADES, ...UNIQUE_BUILDINGS, ...COMPANION_BUILDINGS].forEach(x => _spriteItemById.set(x.id, x));
  }
  const item = _spriteItemById.get(id);
  const owned = kind === 'building' ? (state.buildings[id] || 0) > 0
    : kind === 'clickUpgrade' ? hasClickUpgrade(id)
    : kind === 'companionBuilding' ? hasCompanionBuilding(id)
    : hasUnique(id);
  return { item, owned };
}

// Affiche un petit pop-up de révélation la toute première fois qu'un objet est acquis —
// uniquement pour les objets qui ont un vrai sprite (pas d'intérêt à révéler une case vide).
// Remplit et affiche la popup de révélation générique (#itemPopupOverlay) — partagée entre la
// première acquisition d'un objet illustré et la révélation du compagnon.
function showItemPopup({ title, iconSrc, name, desc, playSound }) {
  document.getElementById('itemPopupTitle').textContent = title;
  const iconEl = document.getElementById('itemPopupIcon');
  iconEl.style.display = iconSrc ? '' : 'none';
  if (iconSrc) iconEl.src = iconSrc;
  document.getElementById('itemPopupName').textContent = name;
  document.getElementById('itemPopupDesc').textContent = desc;
  document.getElementById('itemPopupCloseBtn').textContent = state.lang === 'en' ? 'Nice!' : 'Super !';
  document.getElementById('itemPopupOverlay').style.display = 'flex';
  // 'rare' = objet à achat unique (Spécial / Bâtiments) : jingle dédié, plus solennel que le
  // son de première acquisition des compagnons et améliorations de clic.
  if (playSound === 'rare') playRareItemSound();
  else if (playSound) playFirstPurchaseSound();
}
function markItemDiscovered(id) { (state.itemPopupsShown = state.itemPopupsShown || {})[id] = true; }
function maybeShowItemAcquiredPopup(id, kind, soundVariant) {
  if (!ITEM_SPRITES[id]) return;
  if (itemDiscovered(id, false)) return;
  markItemDiscovered(id);
  const { item } = findSpriteItem(id, kind);
  if (!item) return;
  const isRare = soundVariant === 'rare';
  showItemPopup({
    title: tr(isRare ? 'rareAcquisition' : 'newItem'),
    iconSrc: ITEM_SPRITES[id].src,
    name: L(item, 'name'),
    desc: L(item, 'desc'),
    playSound: isRare ? 'rare' : true,
  });
}
// Referme une petite fenêtre en fondu, puis la retire. `apres` s'exécute une fois qu'elle a
// disparu, pour que ce qui suit (une réplique de Papi, un rafraîchissement) ne se joue pas
// par-dessus une fenêtre encore visible.
function fermerSurgissante(id, apres) {
  const el = document.getElementById(id);
  if (!el || el.style.display === 'none' || el.classList.contains('fermetureSurgissante')) return;
  el.classList.add('fermetureSurgissante');
  setTimeout(() => {
    el.classList.remove('fermetureSurgissante');
    el.style.display = 'none';
    if (apres) apres();
  }, dureeAnimationMs(el));
}
document.getElementById('itemPopupCloseBtn').addEventListener('click', () => fermerSurgissante('itemPopupOverlay'));
