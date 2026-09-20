// ================= VISUAL THEME =================
function getThemeClass() {
  const tierBuildings = ['jardinHorsTemps','grainePrimordiale','templeCompost','conscienceChloro'];
  if (tierBuildings.some(id => (state.buildings[id]||0) > 0) || state.prestigeCount >= 15) return 'theme-5';
  if ((state.buildings.mars||0) > 0 || state.prestigeCount >= 8) return 'theme-4';
  if ((state.buildings.satellite||0) > 0 || state.prestigeCount >= 4) return 'theme-3';
  if ((state.buildings.usine||0) > 0 || state.prestigeCount >= 1) return 'theme-2';
  return 'theme-1';
}

// ================= NAVIGATION (modales Paramètres/Succès/Quêtes + page Magasin) =================
function unlockedTabs() { return TAB_DEFS.filter(t => t.unlock(state)); }
// Onglets réellement AFFICHABLES. Un déblocage est un ÉVÉNEMENT, pas un état : on ne consulte
// donc QUE tabsSeen, posé au DÉBUT de l'annonce de cet onglet (voir announceNewTabsSequentially),
// pour qu'il surgisse au moment précis où Papi en parle. Re-tester `unlock` ici faisait disparaître un onglet déjà
// acquis dès que sa condition redevenait fausse — Bâtiments, dont le seuil porte sur la Verdure
// EN POCHE, s'évaporait à la première dépense, c'est-à-dire aussitôt après son déblocage.
function revealedTabs() { return TAB_DEFS.filter(t => state.tabsSeen[t.id]); }

// Onglet actif par fenêtre (pas besoin d'être sauvegardé, repart sur la valeur par défaut à chaque lancement)
let activeShopTab = 'production';
let activeSettingsTab = 'options';
let activeQuestsTab = 'quetes';

// Les panneaux d'onglets partagent un seul conteneur à défilement par fenêtre : sans cette
// remise à zéro, une fenêtre rouverte reprenait à la position laissée la fois d'avant, souvent
// au milieu de nulle part. D'un onglet à l'autre, en revanche, la position est mémorisée
// (voir _defilementOnglets).
function resetScrollPanes(root) {
  if (!root) return;
  root.querySelectorAll('.sideModalContent, .shopPageContent').forEach(el => { el.scrollTop = 0; });
}
function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  // Le dernier onglet consulté est conservé, y compris pendant le tutoriel : quand Papi présente
  // un nouvel onglet, la fenêtre s'ouvre là où le joueur en était et c'est le doigt « Clique
  // ici ! » qui l'emmène sur la nouveauté (seul le défilement repart en haut, voir
  // resetScrollPanes).
  clearTimeout(overlay._fermetureTimer);
  overlay.classList.remove('fermeture');
  overlay.classList.add('open');
  suivreFenetrePendantAnimation(overlay);
  // Les panneaux de cette fenêtre ne sont pas redessinés tant qu'elle est fermée (voir
  // renderAll) : on les remet à jour maintenant qu'elle est marquée ouverte, avant de rendre
  // la main — pas en différé, sinon le joueur verrait une frame de contenu périmé.
  renderAll();
  // APRÈS l'affichage : sur un élément encore en display:none, écrire scrollTop ne fait rien
  // et le navigateur restaure ensuite la position précédente.
  resetScrollPanes(overlay);
  // Une bulle AMBIANTE de Papi ne doit pas rester par-dessus un menu ouvert : on l'efface.
  // Mais surtout pas une bulle de TUTORIEL — la vider mettait `_dialogueOnComplete` à null,
  // c'est-à-dire jetait la suite de la séquence : le groupe n'était jamais rendu et toutes les
  // annonces suivantes restaient bloquées en file. Celle-là, on la referme proprement
  // (dismissDialogue exécute la continuation).
  if (isDialogueVisible()) hideDialogue(_dialogueBlockAdvance);
}
// Callbacks à exécuter la prochaine fois qu'une fenêtre précise (par id d'overlay) se ferme —
// utilisé pour ne présenter la fonctionnalité suivante qu'une fois la fenêtre actuelle
// réellement refermée par le joueur, jamais pendant qu'elle est encore ouverte à l'écran.
let _onModalCloseCallbacks = {};
function waitForModalClose(overlayId, cb) {
  (_onModalCloseCallbacks[overlayId] = _onModalCloseCallbacks[overlayId] || []).push(cb);
}
// Vrai tant que Papi doit encore présenter quelque chose dans CETTE fenêtre. La refermer
// avant qu'il ait fini laissait le tutoriel à moitié joué et, la zone à laquelle la bulle était
// accrochée ayant disparu, envoyait celle-ci se replier dans le coin haut-gauche de l'écran.
// Le verrou est posé ici plutôt que sur chaque bouton de fermeture : la croix, le clic sur le
// fond sombre et tout autre appel passent tous par closeModal.
// Vrai tant que Papi est EN TRAIN de présenter un onglet de ce groupe : une réplique est à
// l'écran et un onglet précis est désigné. C'est LE critère unique du verrouillage pendant le
// tutoriel — fermeture de la fenêtre comme accès aux autres mini-onglets. Dès qu'il a fini de
// parler, plus rien n'est bloqué : le joueur reste libre d'explorer la fenêtre ouverte, et
// c'est même en la refermant qu'il enchaîne la suite du tutoriel.
function isTutorialSpeakingFor(group) {
  if (_pendingSpotlightGroup !== group || !_lockedToTabId) return false;
  // Le doigt qui désigne un mini-onglet compte comme une présentation en cours : fermer la
  // fenêtre à ce moment-là abandonnait l'onglet présenté et bloquait les suivants du groupe.
  return isDialogueVisible() || _pointedTabId !== null;
}
function isTutorialHoldingModal(overlayId) {
  if (!_pendingSpotlightGroup) return false;
  if (GROUP_TO_OVERLAY[_pendingSpotlightGroup] !== overlayId) return false;
  return isTutorialSpeakingFor(_pendingSpotlightGroup);
}
// Durée (ms) de l'animation CSS en cours sur un élément.
function dureeAnimationMs(el) { return (parseFloat(getComputedStyle(el).animationDuration) || 0) * 1000; }
// Pendant qu'une fenêtre bouge (le magasin qui monte), le doigt, le spotlight et la bulle de Papi
// se recalent à chaque image sur le signal `gameviewportfit`, au lieu de sauter une fois arrivés.
function suivreFenetrePendantAnimation(overlay) {
  const fin = performance.now() + dureeAnimationMs(overlay) + 50;
  const boucle = () => {
    window.dispatchEvent(new Event('gameviewportfit'));
    if (performance.now() < fin) requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
}
function closeModal(overlayId) {
  if (isTutorialHoldingModal(overlayId)) return;
  // Fenêtre fermée : ses onglets oublient leur position, on la rouvrira en haut.
  for (const cle of Object.keys(_defilementOnglets)) delete _defilementOnglets[cle];
  const overlay = document.getElementById(overlayId);
  // Fondu de sortie seulement pour une fenêtre réellement ouverte : le reset ferme toutes les
  // fenêtres d'un coup, et celles déjà fermées ne doivent pas réapparaître un instant.
  if (overlay.classList.contains('open')) {
    overlay.classList.remove('open');
    overlay.classList.add('fermeture');
    clearTimeout(overlay._fermetureTimer);
    overlay._fermetureTimer = setTimeout(() => overlay.classList.remove('fermeture'), dureeAnimationMs(overlay) + 20);
  }
  flushPendingPapiCategories();
  if (_onModalCloseCallbacks[overlayId] && _onModalCloseCallbacks[overlayId].length) {
    _onModalCloseCallbacks[overlayId].splice(0).forEach(cb => cb());
  }
}
// Vrai si une modale (Paramètres/Succès/Quêtes) ou la page Magasin est actuellement ouverte —
// sert à n'afficher les répliques ambiantes de Papi que sur l'écran principal, jamais par-dessus un menu.
function isAnyModalOpen() {
  return Object.values(GROUP_TO_OVERLAY).some(isOverlayOpen);
}
// Vrai si N'IMPORTE QUOI empêche de considérer qu'on est tranquillement sur l'écran principal :
// une modale, la fenêtre de mise à jour, le splash, le popup de langue, la scène d'ouverture ou
// le tutoriel. Les répliques ambiantes de Papi ne doivent JAMAIS apparaître par-dessus l'un de ces écrans.
function isMainScreenBlocked() {
  // Un tutoriel forcé (spotlight en cours, avant même que le joueur ait ouvert la fenêtre
  // visée) doit bloquer exactement comme un menu ouvert — sinon un événement aléatoire (Papi
  // qui débarque, herbe dorée, papillons...) peut apparaître par-dessus et perturber le
  // tutoriel, qui doit rester la SEULE chose à l'écran tant qu'il est en cours.
  if (_pendingSpotlightGroup) return true;
  if (isAnyModalOpen()) return true;
  const updateOverlay = document.getElementById('updatePromptOverlay');
  if (updateOverlay && updateOverlay.classList.contains('open')) return true;
  const splash = document.getElementById('splashOverlay');
  if (splash && splash.style.display !== 'none') return true;
  const lang = document.getElementById('langPopupOverlay');
  if (lang && lang.style.display === 'flex') return true;
  const scene = document.getElementById('sceneOverlay');
  if (scene && scene.classList.contains('visible')) return true;
  const tutorial = document.getElementById('tutorialOverlay');
  if (tutorial && tutorial.style.display === 'flex') return true;
  return false;
}

// La plupart des achats se font DANS le magasin (une fenêtre) — ces réactions de Papi doivent
// donc attendre que le joueur revienne à l'écran principal plutôt que d'apparaître par-dessus.
let _pendingPapiCategories = [];
// Tant qu'un tutoriel (annonce de nouvel onglet) est en cours — texte affiché OU spotlight/
// fenêtre encore en attente —, aucune autre réplique de Papi (achievement, commentaire de
// boutique, etc.) ne doit se mélanger : le joueur ne doit voir QUE le tutoriel pendant cette
// période. Ces répliques sont simplement mises en attente, comme pour un menu ouvert.
function tutorialInProgress() {
  return _dialogueBusy || !!_pendingSpotlightGroup;
}
function queueOrShowPapi(category, options = {}) {
  if (isMainScreenBlocked() || tutorialInProgress()) {
    if (!_pendingPapiCategories.includes(category)) _pendingPapiCategories.push(category);
    return;
  }
  papiSaysFromCategory(category, options);
}
function flushPendingPapiCategories() {
  if (isMainScreenBlocked() || tutorialInProgress() || _pendingPapiCategories.length === 0) return;
  const cat = _pendingPapiCategories.shift();
  papiSaysFromCategory(cat, { onComplete: flushPendingPapiCategories });
}

document.getElementById('settingsBtn').addEventListener('click', () => { document.getElementById('settingsBtn').classList.remove('featureHighlight'); openModal('settingsModalOverlay'); });
document.getElementById('settingsModalCloseBtn').addEventListener('click', () => closeModal('settingsModalOverlay'));
document.getElementById('achievementsBtn').addEventListener('click', () => { document.getElementById('achievementsBtn').classList.remove('featureHighlight'); openModal('achievementsModalOverlay'); });
document.getElementById('achievementsModalCloseBtn').addEventListener('click', () => closeModal('achievementsModalOverlay'));
document.getElementById('questsBtn').addEventListener('click', () => { document.getElementById('questsBtn').classList.remove('featureHighlight'); openModal('questsModalOverlay'); });
document.getElementById('questsModalCloseBtn').addEventListener('click', () => closeModal('questsModalOverlay'));
// Pas de menu du clic droit (Inspecter, Recharger...) : c'est un jeu, pas une page web.
document.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('shopBtn').addEventListener('click', () => { document.getElementById('shopBtn').classList.remove('featureHighlight'); openModal('shopPageOverlay'); });
document.getElementById('shopPageCloseBtn').addEventListener('click', () => {
  closeModal('shopPageOverlay');
  hideShopComment();
});
// Cliquer sur le fond sombre des modales (pas la page Magasin, en plein écran) les ferme aussi
document.getElementById('settingsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsModalOverlay') closeModal('settingsModalOverlay'); });
document.getElementById('achievementsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'achievementsModalOverlay') closeModal('achievementsModalOverlay'); });
document.getElementById('questsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'questsModalOverlay') closeModal('questsModalOverlay'); });

// Message de Papi pour chaque onglet (sauf Jardin, disponible dès le début) + fenêtre à ouvrir une fois le message lu
const PAPI_TAB_ANNOUNCEMENTS_BI = {
  // Une explication = plusieurs bulles courtes : une réplique trop longue agrandirait la bulle.
  // Mieux vaut une bulle de plus qu'une bulle plus grande (vérifié par pw-test/mesure-bulles.js).
  // Un onglet ne parle que de ce que le joueur connaît déjà au moment où il apparaît.
  production: {
    fr: [
      "Voici le cœur du jardin : les compagnons. Chacun te rapporte de la Verdure tout seul, chaque seconde, même quand tu ne cliques pas.",
      "Chaque exemplaire acheté coûte 20 % de plus que le précédent. C'est normal, il faut bien que je paie mon loyer.",
      "À 10, 20, 30, 40, 50 exemplaires d'un même compagnon, et ainsi de suite, tu passes un palier : sa production est multipliée par 1.25.",
      "La petite barre sous son nom te montre où tu en es avant le prochain palier.",
      "Les « ??? » sont des compagnons que tu n'as pas encore découverts. Ils se dévoilent dans l'ordre : achète celui d'avant pour voir le suivant.",
      "Les boutons au-dessus de la liste choisissent combien d'exemplaires tu achètes d'un coup. MAX achète tout ce que tu peux payer.",
      "Et l'étiquette « Meilleur rapport qualité/prix » indique le compagnon qui rapporte le plus pour son prix. Si tu hésites, suis-la.",
    ],
    en: [
      "Here's the heart of the garden: companions. Each one brings you Greenery on its own, every second, even when you're not clicking.",
      "Each copy you buy costs 20% more than the previous one. That's normal, I've got rent to pay.",
      "At 10, 20, 30, 40, 50 copies of the same companion, and so on, you reach a milestone: its production is multiplied by 1.25.",
      "The little bar under its name shows how close you are to the next milestone.",
      "The \"???\" are companions you haven't discovered yet. They're revealed in order: buy the previous one to see the next.",
      "The buttons above the list choose how many copies you buy at once. MAX buys as many as you can afford.",
      "And the \"Best value for money\" tag points to the companion that earns the most for its price. If you're unsure, follow it.",
    ],
  },
  clic: {
    fr: [
      "Tiens, j'avais des gants renforcés qui traînaient au fond du magasin, cachés derrière un stock dont je préfère ne pas parler.",
      "Ici, tu améliores ton clic. Chaque amélioration ne s'achète qu'une seule fois, avec de la Verdure.",
      "Certaines ajoutent de la Verdure à chaque clic, d'autres te donnent un pourcentage de ta production par clic, et d'autres multiplient le tout.",
      "Plus ta production augmente, plus les pourcentages rapportent. C'est utile tant que tu cliques à la main.",
    ],
    en: [
      "Here, I had some reinforced gloves lying around at the back of the shop, hidden behind stock I'd rather not talk about.",
      "This is where you upgrade your click. Each upgrade can only be bought once, with Greenery.",
      "Some add Greenery to every click, some give you a percentage of your production per click, and others multiply everything.",
      "The more your production grows, the more those percentages are worth. It's useful as long as you click by hand.",
    ],
  },
  batiments: {
    fr: [
      "Ça, c'est du solide : chaque bâtiment ne s'achète qu'une seule fois, et il améliore un seul compagnon, celui indiqué dans sa description.",
      "Par exemple, un bâtiment « x2 » pour tes têtards double la production de tous tes têtards. Les autres compagnons, eux, ne changent pas.",
      "Commence donc par les compagnons que tu as en grand nombre. Un bâtiment pour un compagnon que tu n'as pas ne rapporte rien du tout.",
    ],
    en: [
      "Now this is solid stuff: each building can only be bought once, and it improves a single companion, the one named in its description.",
      "For example, an \"x2\" building for your tadpoles doubles the production of all your tadpoles. The other companions don't change.",
      "So start with the companions you own a lot of. A building for a companion you don't have earns nothing at all.",
    ],
  },
  special: {
    fr: [
      "J'ai reçu du matériel… disons, particulier : des objets uniques, en un seul exemplaire chacun.",
      "La plupart sont des capacités : tu les déclenches toi-même pour un gros coup de pouce, puis elles se rechargent pendant un moment.",
      "Une fois achetée, une capacité apparaît sous forme de rond à gauche de l'écran. Clique dessus quand elle brille ; le cadran sombre montre la recharge.",
      "Quelques objets fonctionnent tout seuls, sans que tu aies quoi que ce soit à faire, comme le chat qui te rapporte un petit cadeau toutes les heures.",
      "Lis bien les descriptions avant d'acheter : certains objets sont plus malins qu'ils n'en ont l'air.",
    ],
    en: [
      "I've received some… let's say, unusual gear: one-of-a-kind items, a single copy of each.",
      "Most of them are abilities: you trigger them yourself for a big boost, then they recharge for a while.",
      "Once bought, an ability shows up as a circle on the left of the screen. Click it when it glows; the dark dial shows the recharge.",
      "A few items work on their own, without you having to do anything, like the cat that brings you a little gift every hour.",
      "Read the descriptions carefully before buying: some items are cleverer than they look.",
    ],
  },
  recherche: {
    fr: [
      "Un ami m'a offert des livres de recherche. Enfin, « offert »… disons qu'il me devait de l'argent.",
      "La Recherche se paie en Connaissances 📚. Tu en gagnes 1 par minute de jeu, quoi que tu fasses : ta production n'y change rien.",
      "Chaque recherche donne un bonus permanent : plus de production, des compagnons moins chers ou plus de Connaissances.",
      "D'autres réduisent les effets du mauvais temps, ou te font gagner davantage pendant que le jeu est fermé.",
      "Certaines demandent d'avoir terminé la précédente. En bas, les recherches infinies s'achètent encore et encore, un peu plus cher à chaque fois.",
      "Une recherche achetée est acquise pour de bon : tu la garderas quoi qu'il arrive.",
    ],
    en: [
      "A friend gave me some research books. Well, \"gave\"… let's say he owed me money.",
      "Research is paid with Knowledge 📚. You earn 1 per minute of play, whatever you do: your production doesn't change that.",
      "Each research gives a permanent bonus: more production, cheaper companions or more Knowledge.",
      "Others reduce the effects of bad weather, or make you earn more while the game is closed.",
      "Some require the previous one first. At the bottom, infinite research can be bought again and again, a little pricier each time.",
      "Research you buy is yours for good: you'll keep it no matter what.",
    ],
  },
  prestige: {
    fr: [
      "Tu as bien avancé. Il faut qu'on parle du Prestige, qu'on appelle aussi « Terraformer ». Écoute bien, c'est important.",
      "Terraformer, c'est tout recommencer : ta Verdure, tes compagnons, ton Clic, tes Bâtiments et ton Spécial repartent à zéro.",
      "Ce que tu gardes : ta Recherche, tes Connaissances, tes succès et tout ce que tu achètes avec des Graines.",
      "En échange, tu gagnes des Graines Cosmiques 🌌. Leur nombre dépend de la Verdure que tu as en poche au moment de terraformer.",
      "Il faut 40 milliards de Verdure en poche pour 1 Graine. Pour 2 Graines, il en faut 8 fois plus, et pour 3, 27 fois plus.",
      "Tes Graines servent à deux choses. D'abord, chaque Graine gagnée augmente ta production pour toujours : +10 % pour 1, +20 % pour 4, +30 % pour 9.",
      "Dépenser tes Graines ne fait pas baisser ce bonus, car il compte les Graines que tu as gagnées, pas celles qui te restent.",
      "Ensuite, tu les dépenses ici, dans des améliorations que tu gardes d'un Prestige à l'autre.",
      "Tu recommences donc, mais en plus fort : tout se rachète beaucoup plus vite. La barre au-dessus du bouton montre ce qu'il te manque pour la Graine suivante.",
    ],
    en: [
      "You've come a long way. We need to talk about Prestige, also called \"Terraforming\". Listen carefully, this matters.",
      "Terraforming means starting over: your Greenery, companions, Click, Buildings and Special all go back to zero.",
      "What you keep: your Research, your Knowledge, your achievements and everything you buy with Seeds.",
      "In exchange, you earn Cosmic Seeds 🌌. How many depends on the Greenery you have on hand when you terraform.",
      "You need 40 billion Greenery on hand for 1 Seed. For 2 Seeds you need 8 times more, and for 3, 27 times more.",
      "Your Seeds do two things. First, every Seed earned raises your production forever: +10% for 1, +20% for 4, +30% for 9.",
      "Spending your Seeds doesn't lower that bonus, because it counts the Seeds you've earned, not the ones you have left.",
      "Second, you spend them here, on upgrades you keep from one Prestige to the next.",
      "So you start over, but stronger: everything gets bought back much faster. The bar above the button shows what you need for the next Seed.",
    ],
  },
  ascension: {
    fr: [
      "Là, on passe dans la cour des grands : l'Ascension. C'est un cran au-dessus du Prestige, alors écoute bien.",
      "Une Ascension fonctionne d'abord comme un Prestige : Verdure, compagnons, Clic, Bâtiments et Spécial repartent à zéro.",
      "Mais en plus, tu perds tes Graines Cosmiques, le bonus de production qu'elles te donnaient et les améliorations de l'onglet Prestige.",
      "Ce que tu gardes : ta Recherche, tes Connaissances, tes succès, tes familiers et leurs niveaux, les défis réussis et ce qui s'achète avec des Éclats.",
      "En échange, tu gagnes des Éclats Stellaires ✨ selon les Graines gagnées depuis ta dernière Ascension : 15 pour ton premier Éclat, puis de plus en plus.",
      "Chaque Éclat gagné augmente ta production de 50 % pour toujours (un peu moins au-delà de 20 Éclats), et te fait gagner plus de Graines à chaque Prestige.",
      "Après chaque Ascension, tes Prestiges rapportent donc plus de Graines. Ils restent toujours utiles, puisque ce sont eux qui te font gagner des Éclats.",
      "Tu dépenses tes Éclats ici, dans des améliorations permanentes. Chaque Ascension débloque aussi des nouveautés : familiers, automatisations et défis.",
      "Le bon moment pour une Ascension ? Quand tes Graines ne te font plus assez avancer. Tu perds leur bonus, mais tes Éclats te feront repartir bien plus vite.",
    ],
    en: [
      "Now we're in the big leagues: Ascension. It's a step above Prestige, so listen carefully.",
      "An Ascension first works like a Prestige: Greenery, companions, Click, Buildings and Special go back to zero.",
      "But on top of that, you lose your Cosmic Seeds, the production bonus they gave you and the upgrades from the Prestige tab.",
      "What you keep: your Research, Knowledge, achievements, pets and their levels, completed challenges and what you buy with Shards.",
      "In exchange, you earn Stellar Shards ✨ based on the Seeds earned since your last Ascension: 15 for your first Shard, then more and more.",
      "Every Shard earned raises your production by 50% forever (a bit less past 20 Shards), and makes you earn more Seeds on every Prestige.",
      "So after each Ascension, your Prestiges bring in more Seeds. They always stay useful, since they're what earns you Shards.",
      "You spend your Shards here, on permanent upgrades. Each Ascension also unlocks new things: pets, automations and challenges.",
      "The right time for an Ascension? When your Seeds no longer move you forward enough. You lose their bonus, but your Shards will get you going much faster.",
    ],
  },
  automatisation: {
    fr: [
      "Bon. J'en ai assez de te voir cliquer sur les mêmes bestioles, ça me fatigue rien qu'à te regarder.",
      "Ici, le jardin se débrouille tout seul. Chaque automatisation s'allume ou s'éteint avec son bouton, quand tu veux.",
      "L'achat automatique achète tout seul le compagnon au meilleur rapport qualité/prix. Il n'achète que des compagnons.",
      "L'activation automatique lance tes capacités dès qu'elles sont rechargées, sans remplacer un bonus plus fort déjà en cours.",
      "Le Prestige automatique terraforme dès que tu peux gagner le nombre de Graines choisi avec les boutons − et +. Il est éteint au départ.",
      "Les automatisations se débloquent une par une, au fil de ta progression.",
    ],
    en: [
      "Right. I'm tired of watching you click the same critters, it wears me out just looking at you.",
      "In here, the garden takes care of itself. Each automation switches on or off with its button, whenever you like.",
      "Automatic buying buys the best-value companion on its own. It only buys companions.",
      "Automatic abilities trigger your abilities as soon as they recharge, without replacing a stronger bonus already running.",
      "Automatic Prestige terraforms as soon as you can earn the number of Seeds picked with the − and + buttons. It starts switched off.",
      "Automations unlock one by one as you progress.",
    ],
  },
  familiers: {
    fr: [
      "Tu as remarqué la bestiole qui traîne dans ton jardin ? C'est ton familier. D'autres viendront au fil de ta progression.",
      "Un seul familier te suit à la fois. Clique sur « Choisir » pour en changer quand tu veux : c'est gratuit et l'effet est immédiat.",
      "Chacun t'aide à sa façon : production, clics, Connaissances, capacités ou prix des compagnons.",
      "Tu les fais monter de niveau avec des Graines Cosmiques, jusqu'au niveau 10. Chaque niveau augmente leur bonus.",
      "Seul le familier choisi donne son bonus, mais les niveaux gagnés restent acquis pour toujours.",
    ],
    en: [
      "Noticed the critter hanging around your garden? That's your pet. Others will come as you progress.",
      "Only one pet follows you at a time. Click \"Choose\" to switch whenever you like: it's free and takes effect right away.",
      "Each one helps in its own way: production, clicks, Knowledge, abilities or companion prices.",
      "You level them up with Cosmic Seeds, up to level 10. Each level raises their bonus.",
      "Only the chosen pet gives its bonus, but the levels you earn are kept forever.",
    ],
  },
  galerie: {
    fr: [
      "Et voici ma petite fierté : tous les compagnons et les bâtiments que tu as rencontrés, bien rangés.",
      "Ceux que tu n'as pas encore trouvés apparaissent en silhouette. Et non, je ne te dirai pas ce que c'est : il faut bien garder un peu de mystère.",
    ],
    en: [
      "And here's my little pride: every companion and building you've come across, neatly filed.",
      "The ones you haven't found yet appear as silhouettes. And no, I won't tell you what they are: we have to keep some mystery.",
    ],
  },
  dailyreward: {
    fr: [
      "Et pense à repasser tous les jours : je te laisse un petit quelque chose devant la porte.",
      "Le calendrier tourne sur 7 jours, avec une récompense chaque jour, et le septième jour est le plus généreux.",
      "Si tu manques un jour, la série repart au premier jour. Alors passe au moins une fois par jour, même rapidement.",
    ],
    en: [
      "And remember to come by every day: I leave a little something at your door.",
      "The calendar runs over 7 days, with a reward each day, and the seventh day is the most generous.",
      "If you miss a day, the streak goes back to day one. So drop by at least once a day, even briefly.",
    ],
  },
  quetes: {
    fr: [
      "J'ai quelques petites missions pour toi, histoire de pimenter un peu les choses.",
      "Chaque jour, tu reçois 3 quêtes : cliquer, produire de la Verdure, acheter des compagnons ou attraper des herbes dorées.",
      "Quand une barre est pleine, réclame ta récompense.",
      "Les quêtes changent chaque jour. Rien n'est obligatoire, mais c'est toujours bon à prendre.",
    ],
    en: [
      "I've got a few small missions for you, just to spice things up.",
      "Every day you get 3 quests: clicking, producing Greenery, buying companions or catching golden weeds.",
      "When a bar is full, claim your reward.",
      "Quests change every day. Nothing is mandatory, but it's always worth taking.",
    ],
  },
  defi: {
    fr: [
      "Si tu te sens motivé, j'ai des défis pour les courageux : des règles tordues, comme l'interdiction de cliquer ou des prix dix fois plus élevés.",
      "Lancer un défi fait tout repartir de zéro, comme un Prestige, mais tu gardes tes Graines. Ensuite, tu dois respecter une règle.",
      "Pour le réussir, fais un Prestige qui rapporte au moins le nombre de Graines demandé, en respectant la règle jusqu'au bout.",
      "Au Prestige, le défi s'arrête, qu'il soit réussi ou non. Tu peux aussi abandonner quand tu veux. Un seul défi à la fois.",
      "Un défi réussi te donne une récompense permanente, indiquée sous le défi. Les suivants se débloquent au fil de ta progression.",
    ],
    en: [
      "If you're feeling motivated, I've got challenges for the brave: twisted rules, like no clicking allowed or prices ten times higher.",
      "Starting a challenge resets everything, like a Prestige, but you keep your Seeds. Then you have to follow a rule.",
      "To complete it, do a Prestige worth at least the number of Seeds required, following the rule all the way.",
      "On Prestige, the challenge ends, whether it's completed or not. You can also give up anytime. One challenge at a time.",
      "A completed challenge gives you a permanent reward, shown under the challenge. The next ones unlock as you progress.",
    ],
  },
  succes: {
    fr: [
      "Tiens, voici le registre de tes exploits. Pratique pour te vanter.",
      "Chaque succès débloqué augmente ta production de Verdure pour toujours. Le bonus total est affiché en haut.",
    ],
    en: [
      "Here's the record of your achievements. Handy for bragging.",
      "Every achievement unlocked raises your Greenery production forever. The total bonus is shown at the top.",
    ],
  },
};
const GROUP_TO_OVERLAY = { shop: 'shopPageOverlay', settings: 'settingsModalOverlay', quests: 'questsModalOverlay', achievements: 'achievementsModalOverlay' };

// Annonce les onglets nouvellement débloqués un par un (Papi parle, tu fermes, il t'emmène directement
// au bon endroit) — enchaînés proprement si plusieurs se débloquent en même temps.
// Empêche les annonces de Papi de se déclencher PENDANT la scène d'ouverture (les onglets
// par défaut Stats/Journal/Options n'ont pas besoin d'être annoncés au tout premier lancement,
// ils seraient sinon en concurrence visuelle avec la scène d'intro).
let _suppressTabAnnouncements = !state.tutorialSeen;

// Tant qu'un menu est "possédé" par une annonce forcée (spotlight cliqué mais fenêtre pas
// encore refermée), _pendingSpotlightGroup retient QUEL groupe (shop/settings/quests/...) —
// toute nouvelle annonce d'un AUTRE groupe doit patienter, sinon un bouton "quêtes" ou "bonus
// quotidien" pourrait se déclencher pendant qu'un spotlight précédent est encore affiché ou que
// sa fenêtre est encore ouverte. En revanche, une annonce du MÊME groupe est autorisée à
// s'enchaîner tout de suite (voir highlightNewFeature) : si le tuto suivant concerne le menu
// déjà ouvert, pas question de faire ressortir puis rerentrer le joueur pour rien.
// Contrairement à _dialogueBusy (qui ne suit que le TEXTE affiché et se libère dès que le
// joueur a fini de lire, bien avant que le spotlight soit cliqué ou la fenêtre refermée), ce
// verrou reste actif jusqu'à la fermeture réelle de la fenêtre concernée.
let _pendingSpotlightGroup = null;
let _pendingTabAnnouncements = [];

// Le descriptif d'un onglet (ce qu'il contient/permet) n'est plus dit dans l'annonce de
// déblocage — seulement une fois que le joueur a VRAIMENT ouvert cet onglet précis (clic sur le
// mini-onglet, ou sur le bouton flottant si le groupe n'a qu'un seul onglet — ex: Succès).
//
// « Cet onglet doit encore son explication » est un état DÉRIVÉ : révélé (tabsSeen), pas encore
// expliqué (tabsDescribed), et non silencieux. Le doubler d'une file en mémoire faisait deux
// sources de vérité, et c'est celle des deux qui ne survivait pas au rechargement qui laissait
// des onglets révélés mais jamais expliqués.
function pendingDescriptionFor(tabId) {
  if (!state.tabsSeen[tabId] || state.tabsDescribed[tabId]) return null;
  const t = TAB_DEFS.find(x => x.id === tabId);
  if (!t || t.silent) return null;
  return tabAnnouncementLines(t);
}
// Onglet dont le descriptif est EN TRAIN d'être joué : sans ça, recliquer le même mini-onglet
// pendant que Papi parle en empilait une seconde lecture (tabsDescribed n'est posé qu'à la fin).
let _descriptionEnCours = null;
// Temps de lecture (ms) d'une remarque de Papi une fois écrite, avant qu'elle ne s'efface toute
// seule : remarques spontanées (papiSaysFromCategory) et commentaires du magasin.
function papiReadingPauseMs(text) { return Math.max(2500, text.length * 50); }

function revealPendingDescription(tabId, onDone) {
  if (_descriptionEnCours === tabId) return; // déjà en cours de lecture : le clic en double ne rejoue rien
  const lines = pendingDescriptionFor(tabId);
  if (!lines) { if (onDone) onDone(); return; }
  _descriptionEnCours = tabId;
  // PAS d'auto-avance ici : le joueur clique lui-même pour passer à la réplique suivante.
  // Une avance automatique ne laissait pas le temps de lire. Un descriptif est un tableau de
  // plusieurs répliques courtes (plutôt qu'un long pavé) pour ne pas agrandir la bulle —
  // tabAnnouncementLines renvoie toujours un tableau, même pour une réplique unique.
  showDialogue('papi', lines, { position: 'top-right', onComplete: () => {
    stopFollowingDialogueAnchor();
    clearDescribedZone();
    // Mémorisé DURABLEMENT : c'est la seule trace de ce qui a déjà été expliqué, y compris
    // après un rechargement (voir pendingDescriptionFor).
    state.tabsDescribed[tabId] = true;
    _descriptionEnCours = null;
    saveGame();
    if (onDone) onDone();
  } });
  // Papi décrit le CONTENU de l'onglet : un halo doré entoure la zone concernée (rien à
  // cliquer, donc pas de doigt ni de "Clique ici !") et la bulle se place là où elle ne la
  // cache pas. Le clic sur la bulle fait disparaître les deux.
  const zone = highlightDescribedZone(tabId);
  followDialogueAnchor(zone || document.querySelector(`[data-tab-id="${tabId}"]`));
}
// La mise en page derrière la bulle peut être reconstruite par un renderAll() (la bulle, elle, a sa
// taille finale dès le début, voir typewriterEffect) : on la recale donc en continu tant que le
// descriptif est affiché.
let _dialogueAnchorTimer = null;
function followDialogueAnchor(targetEl) {
  stopFollowingDialogueAnchor();
  if (!targetEl) return;
  anchorDialogueTo(targetEl);
  _dialogueAnchorRecalage = () => { if (isDialogueVisible()) anchorDialogueTo(targetEl); };
  window.addEventListener('gameviewportfit', _dialogueAnchorRecalage);
  _dialogueAnchorTimer = setInterval(() => {
    if (!isDialogueVisible()) {
      stopFollowingDialogueAnchor();
      return;
    }
    anchorDialogueTo(targetEl);
  }, 150);
}
let _dialogueAnchorRecalage = null;
function stopFollowingDialogueAnchor() {
  if (_dialogueAnchorTimer) { clearInterval(_dialogueAnchorTimer); _dialogueAnchorTimer = null; }
  if (_dialogueAnchorRecalage) { window.removeEventListener('gameviewportfit', _dialogueAnchorRecalage); _dialogueAnchorRecalage = null; }
}
// Onglet suivant à présenter, un par un, dans un groupe multi-onglets (Paramètres/Quêtes/
// Magasin) : rempli quand un onglet est mis en évidence, vidé + appelé quand le joueur clique
// sur CE mini-onglet précis (voir renderMiniTabsRow) — jamais avant, pour ne jamais illuminer
// plusieurs mini-onglets à la fois.
let _pendingTabOpenedCallbacks = {};
// Bascule sur l'onglet interne indiqué pour ce groupe — utilisé uniquement pour le tout
// premier onglet présenté après l'ouverture d'un menu (voir highlightNewFeature) : le joueur
// vient d'ouvrir le menu, donc afficher directement le bon onglet plutôt que de le laisser sur
// l'onglet précédemment actif.
function setActiveTabForGroup(group, tabId) {
  if (group === 'shop') activeShopTab = tabId;
  else if (group === 'settings') activeSettingsTab = tabId;
  else if (group === 'quests') activeQuestsTab = tabId;
}

// Répliques décrivant un onglet — toujours un TABLEAU de lignes, même pour le repli générique
// (showDialogue attend une liste).
function tabAnnouncementLines(t) {
  const bi = PAPI_TAB_ANNOUNCEMENTS_BI[t.id];
  if (bi) return bi[state.lang] || bi.fr;
  return [state.lang === 'en' ? `This is "${L(t,'label')}".` : `Voici "${L(t,'label')}".`];
}
function announceNewTabsSequentially(tabs) {
  if (tabs.length === 0) return;
  // Une présentation d'un AUTRE groupe est en cours : celle-ci attend la fermeture de sa fenêtre
  // (voir rendreLaMain), sinon Papi parlerait d'un autre menu pendant qu'on est encore dedans.
  if (_pendingSpotlightGroup && tabs[0].group !== _pendingSpotlightGroup) {
    for (const t of tabs) if (!_pendingTabAnnouncements.includes(t)) _pendingTabAnnouncements.push(t);
    return;
  }
  const t = tabs[0];
  const rest = tabs.slice(1);
  // C'est ICI que l'onglet devient visible : au début de SON annonce, pas au moment où le jeu
  // a détecté le lot. `_tabsPendingAppear` déclenche son animation d'apparition dès que sa
  // rangée est à l'écran (voir renderMiniTabsRow).
  const reveler = () => {
    if (!state.tabsSeen[t.id]) {
      state.tabsSeen[t.id] = true;
      _tabsPendingAppear.add(t.id);
      _tabsQueuedForAnnounce.delete(t.id);
      saveGame();
    }
  };
  // Options/Stats sont présents dès le lancement : les annoncer interromprait le joueur avant
  // même qu'il ait cliqué une fois. On les révèle donc en silence — le bouton apparaît, mais
  // Papi ne dit rien et aucun spotlight ne bloque l'écran.
  if (t.silent) {
    reveler();
    const btnId = GROUP_TO_FLOAT_BTN[t.group];
    if (btnId) document.getElementById(btnId).classList.add('revealed');
    announceNewTabsSequentially(rest);
    return;
  }
  // Pendant l'intro, les onglets se débloquent en silence : Papi les présentera lui-même
  // ensuite, un par un.
  if (_suppressTabAnnouncements) {
    _tabsQueuedForAnnounce.delete(t.id); // sera re-détecté (et annoncé) une fois l'intro finie
    announceNewTabsSequentially(rest);
    return;
  }
  // Annonce de déblocage : dit juste QU'il y a une nouveauté et où cliquer (le spotlight +
  // la flèche font le reste) — jamais CE QUE ça contient, ça c'est pour quand il l'ouvrira.
  const reaction = pickPapiLine('bigUpgrade');
  const revealMsg = state.lang === 'en' ? `Hey, I unlocked "${L(t,'label')}" for you.` : `Tiens, j'ai débloqué "${L(t,'label')}" pour toi.`;

  // Boutons forcés (Magasin/Paramètres/Succès/Quêtes) : la bulle et le spotlight apparaissent EN MÊME
  // TEMPS, et la bulle n'est PAS cliquable pour avancer (voir dismissDialogue) — seul le clic
  // sur le bouton indiqué la fait disparaître. Sans ça, un joueur qui clique vite sur la bulle
  // pouvait enchaîner plusieurs annonces d'un coup avant même de voir le spotlight.
  const combined = reaction ? `${reaction} ${revealMsg}` : revealMsg;
  reveler(); // l'onglet surgit dans sa rangée en même temps que Papi l'annonce
  showDialogue('papi', [combined], { position: 'top-right', blockAdvance: true });
  renderAll();
  highlightNewFeature(t.group, t.id, () => {
    announceNewTabsSequentially(rest.concat(_pendingTabAnnouncements.splice(0)));
  });
}

const GROUP_TO_FLOAT_BTN = { shop: 'shopBtn', settings: 'settingsBtn', quests: 'questsBtn', achievements: 'achievementsBtn' };
// Fenêtres qui ont une rangée de mini-onglets (voir renderTabsRow) — Succès n'en a pas.
const GROUPS_WITH_MINI_TABS = new Set(['shop', 'settings', 'quests']);
// Assombrit l'écran et affiche une flèche pointant vers targetEl pour forcer le joueur à
// cliquer dessus avant de continuer — le reste de l'écran (assombri) devient inerte car
// l'overlay est cliqué à sa place, sauf les boutons flottants qui restent au-dessus (z-index).
// Rectangle d'un élément dans les coordonnées de dessin de #gameViewport (avant mise à
// l'échelle). getBoundingClientRect() renvoie des pixels ÉCRAN (donc déjà multipliés par le
// scale) alors que les éléments en position:fixed à l'intérieur du wrapper se positionnent,
// eux, en coordonnées de dessin : sans cette conversion, flèche et bulle seraient décalées
// dès que la fenêtre n'est pas exactement à la taille de référence.
function rectInGameViewport(el) {
  const vp = document.getElementById('gameViewport');
  const r = el.getBoundingClientRect();
  if (!vp) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  const vr = vp.getBoundingClientRect();
  // fitGameViewport publie déjà l'échelle : la relire ici épargne une mesure de mise en page.
  const scale = window._gameScale || (vr.width / (vp.offsetWidth || 1)) || 1;
  return {
    left: (r.left - vr.left) / scale,
    top: (r.top - vr.top) / scale,
    right: (r.right - vr.left) / scale,
    bottom: (r.bottom - vr.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}

// Vrai quand la bulle a été resserrée pour tenir dans une bande libre étroite. Mémorisé pour
// n'effacer la largeur (une écriture, donc un recalcul de mise en page avant la mesure
// suivante) que dans ce cas rare, et pas à chaque passage.
let _dialogueNarrowed = false;
// Rend à la bulle sa position nommée (pos-top-right & co) en effaçant tout placement calculé.
function unanchorDialogue() {
  const box = document.getElementById('dialogueBox');
  if (!box) return;
  _dialogueNarrowed = false;
  box.style.width = '';
  box.style.left = box.style.top = box.style.right = box.style.bottom = '';
}
// Place la bulle de Papi à côté de ce qu'elle commente, du côté où elle ne le recouvre pas,
// et sans jamais sortir de l'écran. Toutes les mesures sont prises AVANT la moindre écriture
// de style : la fonction tourne en boucle pendant les descriptifs du tutoriel, et alterner
// lecture/écriture forcerait un recalcul de mise en page de tout le jeu à chaque passage.
function anchorDialogueTo(targetEl) {
  const box = document.getElementById('dialogueBox');
  const vp = document.getElementById('gameViewport');
  if (!box || !vp || !targetEl) return;
  if (!isDialogueVisible()) return;

  const W = window._gameW || vp.offsetWidth, H = window._gameH || vp.offsetHeight;
  const M = 16, GAP = 20;
  if (_dialogueNarrowed) { box.style.width = ''; _dialogueNarrowed = false; }
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const place = (left, top) => {
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  };

  // Dans le magasin, Papi a déjà son emplacement réservé sur la gauche : sa bulle se cale en
  // bas de CE cadre, jamais par-dessus la liste d'achats de droite (qui est justement ce
  // qu'il commente).
  const shopOpen = document.getElementById('shopPageOverlay').classList.contains('open');
  const papiSlot = document.getElementById('shopImagePlaceholder');
  if (shopOpen && papiSlot && papiSlot.offsetParent !== null) {
    const slot = rectInGameViewport(papiSlot);
    place(Math.max(M, Math.min(W - bw - M, slot.left + slot.width / 2 - bw / 2)),
          Math.max(M, Math.min(H - bh - M, slot.bottom - bh - 12)));
    return;
  }

  // Ce qu'il ne faut pas recouvrir, ce n'est pas seulement l'élément désigné mais la FENÊTRE
  // qui le contient : se caler sur le seul élément plaçait la bulle en plein milieu de la
  // modale ouverte. Une cible devenue invisible donne un rectangle 0×0 en haut à gauche —
  // s'y accrocher y collait la bulle, on repasse alors à la position nommée.
  let r = rectInGameViewport(targetEl.closest('.sideModal') || targetEl);
  if (r.width === 0 && r.height === 0) return unanchorDialogue();
  // Le doigt « Clique ici ! » est posé juste à côté de la cible (voir pointArrowAt, qui l'a
  // placé avant d'appeler cette fonction). Ne regarder que la cible calait la bulle à 20 px
  // d'elle — pile sous le doigt, qui masquait le texte de Papi. L'obstacle est donc
  // le rectangle qui englobe la cible ET le doigt.
  const arrow = document.getElementById('tutorialSpotlightArrow');
  if (arrow && arrow.style.display === 'flex') {
    const a = rectInGameViewport(arrow);
    const left = Math.min(r.left, a.left), top = Math.min(r.top, a.top);
    const right = Math.max(r.right, a.right), bottom = Math.max(r.bottom, a.bottom);
    r = { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  // Essayées dans l'ordre : dessous, dessus, à droite, à gauche. On retient la première qui
  // tient ENTIÈREMENT dans l'écran sans mordre sur l'obstacle.
  const placeBeside = (w, h) => {
    const cy = Math.max(M, Math.min(H - h - M, r.top + r.height / 2 - h / 2));
    const cx = Math.max(M, Math.min(W - w - M, r.left + r.width / 2 - w / 2));
    return [
      { left: cx, top: r.bottom + GAP },
      { left: cx, top: r.top - GAP - h },
      { left: r.right + GAP, top: cy },
      { left: r.left - GAP - w, top: cy },
    ].find(c =>
      c.left >= M && c.top >= M && c.left + w <= W - M && c.top + h <= H - M &&
      (c.left + w <= r.left || c.left >= r.right || c.top + h <= r.top || c.top >= r.bottom));
  };

  let fits = placeBeside(bw, bh);
  if (fits) { place(fits.left, fits.top); return; }

  // Rien ne tient à sa largeur naturelle (une modale large dans une petite fenêtre) : plutôt
  // que de poser la bulle par-dessus ce qu'elle commente, on la resserre à la bande libre la
  // plus large. En dessous de MIN_BW elle deviendrait illisible : on renonce alors et on garde
  // la position nommée, au moins prévisible.
  const MIN_BW = 300;
  const narrow = Math.min(bw, Math.max(r.left - GAP - M, W - r.right - GAP - M));
  if (narrow < MIN_BW) return unanchorDialogue();
  box.style.width = narrow + 'px';
  _dialogueNarrowed = true;
  // Hauteur RE-mesurée : en resserrant la bulle, le texte se replie sur plus de lignes. La
  // réutiliser telle quelle placerait la bulle d'après une hauteur qu'elle n'a plus.
  fits = placeBeside(narrow, box.offsetHeight);
  if (!fits) return unanchorDialogue();
  place(fits.left, fits.top);
}

// Pointeur du tutoriel (doigt + libellé optionnel), réutilisé pour les trois cas de figure :
//  - un bouton flottant à cliquer (avec "Clique ici !" et écran assombri),
//  - un mini-onglet à cliquer (avec "Clique ici !", sans assombrir : la fenêtre est ouverte),
//  - un simple élément que Papi commente (sans libellé : il n'y a rien à cliquer).
// Renvoie la fonction de repositionnement, à rappeler si la mise en page bouge.
function pointArrowAt(targetEl, label) {
  const arrow = document.getElementById('tutorialSpotlightArrow');
  const icon = arrow.querySelector('.tutorialSpotlightArrowIcon');
  const labelEl = document.getElementById('tutorialSpotlightArrowLabel');
  if (labelEl) {
    labelEl.textContent = label || '';
    labelEl.style.display = label ? '' : 'none';
  }
  const position = () => {
    // Hauteur du plan de jeu, déjà calculée par fitGameViewport : offsetHeight relirait la même
    // valeur en forçant un recalcul de mise en page, et ce code tourne en boucle (400 ms).
    const H = window._gameH || window.innerHeight;
    const rect = rectInGameViewport(targetEl);
    // Cible masquée (sa fenêtre est fermée) : son rectangle vaut 0×0 en haut à gauche, et s'y
    // fier plantait le doigt au milieu de l'écran, « Clique ici ! » pointant sur rien. On
    // efface le pointeur : il reviendra tout seul au prochain passage, la cible redevenue
    // visible (pointAtMiniTab rappelle cette fonction en boucle).
    if (rect.width === 0 && rect.height === 0) { arrow.style.display = 'none'; return; }
    arrow.style.display = 'flex';
    arrow.style.left = (rect.left + rect.width / 2) + 'px';
    // Élément trop bas (bouton du magasin par exemple) : la flèche passe AU-DESSUS et pointe
    // vers le bas, sinon elle sortirait de l'écran ou couvrirait ce qu'elle désigne.
    const arrowH = arrow.offsetHeight || 60;
    const below = rect.bottom + 8 + arrowH <= H - 8;
    if (below) {
      arrow.style.top = (rect.bottom + 8) + 'px';
      arrow.classList.remove('pointsDown');
      if (icon) icon.textContent = '👆';
    } else {
      arrow.style.top = (rect.top - 8 - arrowH) + 'px';
      arrow.classList.add('pointsDown');
      if (icon) icon.textContent = '👇';
    }
    anchorDialogueTo(targetEl);
  };
  position(); // pose aussi l'affichage : masqué si la cible ne l'est pas encore
  // PAS d'abonnement à `resize` ici : pointAtMiniTab rappelle cette fonction en boucle, et
  // chaque appel aurait alors ajouté un écouteur de plus dont un seul était jamais retiré.
  // C'est à l'appelant, qui connaît la durée de vie de son pointeur, de s'abonner.
  return position;
}
function hideTutorialArrow() {
  const arrow = document.getElementById('tutorialSpotlightArrow');
  arrow.style.display = 'none';
  arrow.classList.remove('pointsDown');
}

function showTutorialSpotlight(targetEl, onClicked) {
  const overlay = document.getElementById('tutorialSpotlightOverlay');
  const position = pointArrowAt(targetEl, tr('clickHere'));
  window.addEventListener('gameviewportfit', position);
  overlay.style.display = 'block';

  // Le halo pulsant (.featureHighlight) déborde visuellement bien au-delà de la vraie zone
  // cliquable du bouton (jusqu'à ~16px de box-shadow, qui n'agrandit pas la zone de clic
  // réelle) — un joueur qui vise ce halo plutôt que le bouton pile clique alors sur l'écran
  // assombri, qui ne fait rien : ça donne l'impression que le clic "n'a pas pris". On élargit
  // donc la zone cliquable perçue en transférant au bouton tout clic sur l'overlay assez proche.
  const CLICK_MARGIN = 24;
  const onOverlayClick = (e) => {
    const rect = targetEl.getBoundingClientRect();
    const within = e.clientX >= rect.left - CLICK_MARGIN && e.clientX <= rect.right + CLICK_MARGIN &&
                   e.clientY >= rect.top - CLICK_MARGIN && e.clientY <= rect.bottom + CLICK_MARGIN;
    if (within) targetEl.click();
  };
  overlay.addEventListener('click', onOverlayClick);

  targetEl.addEventListener('click', () => {
    overlay.style.display = 'none';
    hideTutorialArrow();
    window.removeEventListener('gameviewportfit', position);
    overlay.removeEventListener('click', onOverlayClick);
    if (onClicked) onClicked();
  }, { once: true });
}

// Doigt + "Clique ici !" sur un mini-onglet à cliquer, SANS assombrir l'écran : la fenêtre du
// groupe est déjà ouverte, l'assombrir donnerait l'impression qu'on ne peut plus rien toucher.
// Le halo doré du mini-onglet, lui, vient de _highlightedTabIds (voir renderMiniTabsRow).
let _miniTabArrowCleanup = null;
let _pointedTabId = null; // mini-onglet actuellement désigné du doigt par Papi
function pointAtMiniTab(tabId) {
  clearMiniTabArrow();
  _pointedTabId = tabId;
  // La rangée de mini-onglets est reconstruite à chaque rendu : on suit la position en continu
  // plutôt que de mémoriser un élément qui peut être remplacé entre-temps. Le suivi démarre
  // MÊME si le bouton n'est pas encore rendu — sortir dans ce cas laissait Papi présenter un
  // onglet sans jamais afficher le doigt.
  const suivre = () => {
    const cur = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (cur) pointArrowAt(cur, tr('clickHere'));
  };
  suivre();
  const timer = setInterval(suivre, 400);
  window.addEventListener('gameviewportfit', suivre); // recalage immediat (fenetre qui bouge, redimensionnement)
  _miniTabArrowCleanup = () => { clearInterval(timer); window.removeEventListener('gameviewportfit', suivre); hideTutorialArrow(); };
}
function clearMiniTabArrow() {
  _pointedTabId = null;
  if (_miniTabArrowCleanup) { _miniTabArrowCleanup(); _miniTabArrowCleanup = null; }
}

// Zone que Papi décrit : halo doré autour du panneau entier, PAS de doigt. Un doigt désigne
// un point précis — donc forcément une ligne de la liste — alors que Papi parle de l'onglet
// dans son ensemble ; le halo dit "c'est de cette zone-là que je parle" sans rien désigner de
// travers. Le halo s'éteint quand le joueur clique la bulle pour la faire disparaître.
let _describedZoneEl = null;
function highlightDescribedZone(tabId) {
  clearDescribedZone();
  // UNIQUEMENT dans le magasin. Dans les petites fenêtres en haut à droite (Paramètres,
  // Succès, Quêtes, Bonus quotidien), la zone à défilement occupe quasiment toute la modale :
  // l'entourer d'un halo ne désigne rien du tout, et l'ombre se fait rogner par les bords
  // arrondis de la fenêtre, ce qui donne un rendu bancal. Là-bas, la bulle de Papi suffit.
  const def = TAB_DEFS.find(t => t.id === tabId);
  if (!def || def.group !== 'shop') return null;
  const panel = document.getElementById('tab-' + tabId);
  if (!panel || panel.offsetParent === null) return null;
  // Le halo va sur le conteneur QUI DÉFILE, pas sur le panneau lui-même : le panneau fait la
  // hauteur de sa liste (souvent bien plus que l'écran) et son ombre était de toute façon
  // rognée par ce conteneur. Sur le conteneur, le halo entoure exactement la zone visible —
  // c'est-à-dire ce que Papi désigne. Ce sont les deux seuls conteneurs à défilement du jeu.
  const zone = panel.closest('.shopPageContent, .sideModalContent') || panel;
  zone.classList.add('tutorialZoneHighlight');
  _describedZoneEl = zone;
  return zone;
}
function clearDescribedZone() {
  if (_describedZoneEl) { _describedZoneEl.classList.remove('tutorialZoneHighlight'); _describedZoneEl = null; }
}
// Met en évidence (halo pulsant + spotlight forcé) le bouton flottant concerné et l'onglet
// correspondant dans la fenêtre qui vient de s'ouvrir, pour n'importe quel groupe (Magasin /
// Paramètres / Succès / Quêtes) — onOpened n'est appelé qu'une fois le bouton réellement cliqué.
function highlightNewFeature(group, tabId, onOpened) {
  const floatBtnId = GROUP_TO_FLOAT_BTN[group];
  const floatBtn = floatBtnId && document.getElementById(floatBtnId);
  _highlightedTabIds.add(tabId);
  _lockedToTabId = tabId;
  renderAll();
  if (!floatBtn) { if (onOpened) onOpened(); return; }
  floatBtn.classList.add('revealed', 'featureHighlight');
  const overlayId = GROUP_TO_OVERLAY[group];

  // Fin de la présentation de CE groupe : rendue à la fermeture de la fenêtre, pour que Papi ne
  // se mette pas à parler d'autre chose alors qu'une fenêtre du groupe est encore ouverte.
  const rendreLaMain = () => {
    _pendingSpotlightGroup = null;
    _lockedToTabId = null;
    if (_pendingTabAnnouncements.length) announceNewTabsSequentially(_pendingTabAnnouncements.splice(0));
    flushPendingPapiCategories();
  };
  // Le joueur est dans la fenêtre : Papi lui montre l'onglet concerné.
  // Dans toute fenêtre à mini-onglets (Magasin, Réglages, Quêtes), CHAQUE onglet présenté est
  // désigné du doigt avec « Clique ici ! », même le tout premier d'un groupe, et Papi attend le
  // clic : c'est ce geste qui ouvre l'onglet et lance son descriptif. Seule la fenêtre des
  // Succès, qui n'a pas de mini-onglets, décrit directement.
  const presenterOnglet = () => {
    floatBtn.classList.remove('featureHighlight');
    if (GROUPS_WITH_MINI_TABS.has(group)) {
      _pendingTabOpenedCallbacks[tabId] = onOpened;
      pointAtMiniTab(tabId); // le clic est pris en charge par miniTabClick
      renderAll();           // grise les autres mini-onglets tant que le doigt désigne celui-ci
      return;
    }
    setActiveTabForGroup(group, tabId);
    _highlightedTabIds.delete(tabId); // sinon le halo reste allumé pendant tout le descriptif
    renderAll();
    revealPendingDescription(tabId, () => { renderAll(); if (onOpened) onOpened(); });
  };
  // Le joueur vient d'arriver dans la fenêtre. Corps commun aux deux façons d'y entrer
  // (spotlight cliqué, ou fenêtre déjà ouverte).
  const entrerDansOnglet = () => {
    dismissDialogue(); // ferme la bulle verrouillée : le joueur a trouvé le bon endroit
    presenterOnglet();
    if (overlayId) waitForModalClose(overlayId, rendreLaMain);
    else rendreLaMain();
  };

  // Une présentation est déjà en cours dans ce groupe : la fenêtre est ouverte et le joueur y
  // est, la main lui sera rendue par le waitForModalClose déjà posé.
  if (_pendingSpotlightGroup === group) { presenterOnglet(); return; }

  _pendingSpotlightGroup = group;
  // La fenêtre est DÉJÀ ouverte : lui demander de cliquer sur le bouton flottant n'aurait aucun
  // sens (il est caché derrière), et la bulle verrouillée ne se ferme QUE par ce clic — le
  // joueur restait bloqué. On entre directement.
  if (overlayId && isOverlayOpen(overlayId)) { entrerDansOnglet(); return; }
  showTutorialSpotlight(floatBtn, entrerDansOnglet);
}

// Suivi persistant des onglets actuellement mis en évidence — nécessaire car
// renderMiniTabsRow() reconstruit entièrement les boutons à chaque rendu (plusieurs fois
// par seconde), ce qui effacerait une classe ajoutée directement sur l'élément.
let _highlightedTabIds = new Set();
// Onglets en cours d'animation d'apparition. Suivi ici et pas sur l'élément : renderMiniTabsRow
// réécrit className à chaque rendu (plusieurs fois par seconde) et effacerait la classe.
let _appearingTabIds = new Set();
// Onglets révélés alors que leur rangée n'était pas à l'écran (le magasin est fermé quand Papi
// les annonce). Jouer l'animation à ce moment-là revenait à la jouer dans le vide : on la
// diffère jusqu'à la première fois où la rangée devient réellement visible.
let _tabsPendingAppear = new Set();
// Onglets dont la condition est remplie mais dont l'annonce n'a pas encore commencé : ils
// attendent leur tour dans la file. Sans ce garde, renderTabsRow les re-détecterait à chaque
// rendu et les empilerait en double.
let _tabsQueuedForAnnounce = new Set();
function markTabAppearing(tabId) {
  _appearingTabIds.add(tabId);
  setTimeout(() => { _appearingTabIds.delete(tabId); }, 600);
}
// Onglet actuellement présenté par Papi dans le groupe en cours (_pendingSpotlightGroup) —
// distinct du halo (_highlightedTabIds, purement visuel et déjà éteint dès le clic) : celui-ci
// verrouille TOUS LES AUTRES mini-onglets du menu tant que Papi n'a pas fini de présenter
// celui-ci (y compris pendant le descriptif, après que son halo se soit déjà éteint).
let _lockedToTabId = null;

// Position de défilement de chaque onglet (les identifiants d'onglets sont uniques, tous menus
// confondus), le temps que sa fenêtre reste ouverte. Sans elle, revenir sur Production après un
// détour par Clic renvoyait en haut d'une liste de trente compagnons. Oubliée à la fermeture :
// une fenêtre rouverte repart du haut.
const _defilementOnglets = {};
function ongletActifDu(groupe) {
  return { shop: activeShopTab, settings: activeSettingsTab, quests: activeQuestsTab }[groupe];
}
function miniTabClick(t, onSelect) {
  const zone = document.querySelector(`#${GROUP_TO_OVERLAY[t.group]} .shopPageContent, #${GROUP_TO_OVERLAY[t.group]} .sideModalContent`);
  const quitte = ongletActifDu(t.group);
  if (zone && quitte) _defilementOnglets[quitte] = zone.scrollTop;
  _highlightedTabIds.delete(t.id);
  // Le doigt ne s'efface que si le joueur a cliqué l'onglet DÉSIGNÉ. S'il en explore un autre
  // entre-temps, l'indication doit rester à l'écran, sinon plus rien ne lui dit où aller.
  if (!_pointedTabId || _pointedTabId === t.id) clearMiniTabArrow();
  onSelect(t.id);
  // Le conteneur à défilement est partagé par tous les panneaux du menu : on le ramène à la
  // position mémorisée pour l'onglet d'arrivée (le haut s'il n'a jamais été ouvert), une fois
  // son contenu dessiné, sinon la hauteur n'est pas encore la bonne.
  if (zone) {
    zone.scrollTop = 0;
    const retour = _defilementOnglets[t.id] || 0;
    if (retour) requestAnimationFrame(() => { zone.scrollTop = retour; });
  }
  dismissDialogue();
  revealPendingDescription(t.id, () => {
    // Papi a fini de parler : re-rendre dégrise les autres mini-onglets (le verrou ne tient que
    // tant qu'une réplique est à l'écran, mais c'est le rendu qui l'applique aux boutons).
    renderAll();
    const cb = _pendingTabOpenedCallbacks[t.id];
    if (cb) { delete _pendingTabOpenedCallbacks[t.id]; cb(); }
  });
  renderAll();
}
function tabButtonClass(t, activeId, locked) {
  return 'drawerBtn'
    + (activeId === t.id ? ' active' : '')
    + (_highlightedTabIds.has(t.id) ? ' featureHighlight' : '')
    + (_appearingTabIds.has(t.id) ? ' tabAppear' : '')
    + (locked ? ' locked' : '');
}
// `revealed` est la liste déjà calculée par renderTabsRow : la recalculer ici la referait trois
// fois par rendu, une par groupe.
function renderMiniTabsRow(containerId, group, activeId, onSelect, revealed) {
  const unlocked = revealed.filter(t => t.group === group);
  const container = document.getElementById(containerId);
  if (!container) return;
  // Pendant que Papi présente un onglet de ce groupe, tous les AUTRES mini-onglets du menu
  // sont désactivés : le joueur ne peut rien faire d'autre que cliquer sur celui indiqué.
  // Dès qu'il a fini de parler, tout est dégrisé — rester coincé sans rien pouvoir ouvrir
  // jusqu'à la fermeture de la fenêtre n'avait aucune raison d'être.
  const isGroupLocked = isTutorialSpeakingFor(group);
  // Même verrou pour le CONTENU de la fenêtre (voir .papiParle) : les mini-onglets grisés ne
  // servaient à rien si le joueur pouvait acheter pendant que Papi parlait.
  const fenetre = document.getElementById(GROUP_TO_OVERLAY[group]);
  if (fenetre) fenetre.classList.toggle('papiParle', isGroupLocked);
  const ids = unlocked.map(t => t.id);
  // offsetParent est null tant qu'un ancêtre est en display:none — c'est ainsi qu'on sait si
  // cette rangée est réellement sous les yeux du joueur. Lu SEULEMENT quand la réponse sert :
  // c'est une lecture de mise en page, qui force un recalcul, et cette fonction tourne trois
  // fois par rendu entre deux séries d'écritures de styles.
  if (_tabsPendingAppear.size && container.offsetParent !== null) {
    ids.filter(id => _tabsPendingAppear.has(id)).forEach(id => {
      _tabsPendingAppear.delete(id);
      markTabAppearing(id);
    });
  }
  const existingButtons = [...container.children];
  const sameSet = existingButtons.length === ids.length && existingButtons.every((btn, i) => btn.dataset.tabId === ids[i]);
  if (sameSet) {
    // Le jeu re-rend cette rangée plusieurs fois par seconde (tick, clics...) — si le même
    // ensemble d'onglets est déjà affiché, on se contente de mettre à jour les classes des
    // boutons EXISTANTS plutôt que de tout détruire/recréer à chaque fois. Sans ça, un clic du
    // joueur pouvait tomber pile au moment où son bouton était remplacé par un nouveau nœud
    // DOM identique, et le clic ne "prenait" pas (il fallait recliquer).
    existingButtons.forEach((btn, i) => {
      const t = unlocked[i];
      const locked = isGroupLocked && t.id !== _lockedToTabId;
      const cls = tabButtonClass(t, activeId, locked);
      if (btn.className !== cls) btn.className = cls;
      if (btn.disabled !== locked) btn.disabled = locked;
    });
    return;
  }
  container.innerHTML = '';
  unlocked.forEach(t => {
    const btn = document.createElement('button');
    const locked = isGroupLocked && t.id !== _lockedToTabId;
    btn.className = tabButtonClass(t, activeId, locked);
    btn.dataset.tabId = t.id;
    btn.disabled = locked;
    btn.innerHTML = `<span class="icon">${t.icon}</span> ${L(t,'label')}`;
    btn.onclick = () => miniTabClick(t, onSelect);
    container.appendChild(btn);
  });
}

// Détection des onglets fraîchement débloqués. Appelée depuis le tick de jeu, et SURTOUT PAS
// depuis un rendu : une annonce redessine l'écran en cours de route, et détecter là revenait à
// lancer une deuxième annonce à l'intérieur de la première (deux doigts, deux bulles).
// Un onglet n'est marqué « vu » QUE lorsque son annonce commence (voir
// announceNewTabsSequentially) : il apparaît donc dans la rangée à son tour, pas avec tout le
// lot détecté d'un coup. `_tabsQueuedForAnnounce` évite de le re-détecter pendant qu'il patiente.
function verifierNouveauxOnglets() {
  if (isMainScreenBlocked()) return;
  const nouveaux = unlockedTabs().filter(t => !state.tabsSeen[t.id] && !_tabsQueuedForAnnounce.has(t.id));
  if (!nouveaux.length) return;
  nouveaux.forEach(t => _tabsQueuedForAnnounce.add(t.id));
  announceNewTabsSequentially(nouveaux);
}

function renderTabsRow() {
  // L'onglet actif doit être un onglet VISIBLE, pas seulement débloqué.
  const revealed = revealedTabs();
  if (!revealed.find(t => t.id === activeShopTab && t.group === 'shop')) activeShopTab = 'production';
  if (!revealed.find(t => t.id === activeSettingsTab && t.group === 'settings')) activeSettingsTab = 'options';
  if (!revealed.find(t => t.id === activeQuestsTab && t.group === 'quests')) activeQuestsTab = 'quetes';

  renderMiniTabsRow('shopTabsRow', 'shop', activeShopTab, (id) => { activeShopTab = id; }, revealed);
  renderMiniTabsRow('settingsTabsRow', 'settings', activeSettingsTab, (id) => { activeSettingsTab = id; }, revealed);
  renderMiniTabsRow('questsTabsRow', 'quests', activeQuestsTab, (id) => { activeQuestsTab = id; }, revealed);
}

// Pour un joueur qui recharge une partie déjà avancée : les boutons dont au moins un onglet
// a déjà été vu doivent être visibles tout de suite, sans attendre une nouvelle annonce (le
// halo de mise en évidence, lui, ne se joue que pour un VRAI nouveau déblocage). Appelé UNE
// SEULE FOIS au chargement (voir INIT plus bas) — surtout pas depuis renderTabsRow(), qui
// tourne en continu : state.tabsSeen[id] passe à true dès la détection du déblocage (avant
// même que l'annonce de Papi ait joué), donc rechecker ce flag à chaque rendu révélait les
// boutons instantanément au lieu d'attendre highlightNewFeature().
function syncRevealedButtonsOnLoad() {
  if (_suppressTabAnnouncements) return;
  // 'shop' inclus : son bouton n'est plus affiché d'office (il n'apparaît qu'à 200 clics), donc
  // sans lui un joueur qui relance le jeu après l'avoir débloqué se retrouvait sans magasin.
  Object.keys(GROUP_TO_FLOAT_BTN).forEach(group => {
    const groupTabs = TAB_DEFS.filter(t => t.group === group);
    const anySeen = groupTabs.some(t => state.tabsSeen[t.id]);
    const btnId = GROUP_TO_FLOAT_BTN[group];
    if (anySeen && btnId) document.getElementById(btnId).classList.add('revealed');
  });
}

function renderPanelsVisibility() {
  document.querySelectorAll('.tabPanel').forEach(p => p.classList.remove('active'));
  // .tabPanel = "un panneau parmi plusieurs, commutés par une rangée de mini-onglets". Les
  // fenêtres à panneau unique (Succès, Bonus quotidien) ne portent donc PAS cette classe : le
  // balayage ci-dessus les éteignait sans que rien ne les rallume, et leur fenêtre s'ouvrait
  // vide — c'est ce qui rendait le calendrier des récompenses quotidiennes invisible.
  ['tab-' + activeShopTab, 'tab-' + activeSettingsTab, 'tab-' + activeQuestsTab].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  });
}


