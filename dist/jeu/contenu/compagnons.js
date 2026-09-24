// ================= CONFIG: BUILDINGS =================
// Registre des sprites pixel art disponibles pour les bâtiments/améliorations, par id.
// Tant qu'un id n'a pas d'entrée ici, l'article s'affiche simplement sans icône (pas de
// cassure visuelle) — il suffit d'ajouter une ligne ici quand un nouveau sprite arrive.
const ITEM_SPRITES = {
  // Bâtiments (placeholders générés — à remplacer par du vrai pixel art au fil de l'eau)
  stagiaire: { src: 'assets/sprites/stagiaire.png', kind: 'building' },
  voisin: { src: 'assets/sprites/voisin.png', kind: 'building' },
  poubelleCompost: { src: 'assets/sprites/poubelleCompost.png', kind: 'building' },
  tondeuse: { src: 'assets/sprites/tondeuse.png', kind: 'building' },
  serre: { src: 'assets/sprites/serre.png', kind: 'building' },
  hamacLeroy: { src: 'assets/sprites/hamacLeroy.png', kind: 'building' },
  drone: { src: 'assets/sprites/drone.png', kind: 'building' },
  usine: { src: 'assets/sprites/usine.png', kind: 'building' },
  marcheNoir: { src: 'assets/sprites/marcheNoir.png', kind: 'building' },
  franchise: { src: 'assets/sprites/franchise.png', kind: 'building' },
  labo: { src: 'assets/sprites/labo.png', kind: 'building' },
  antenneCapte: { src: 'assets/sprites/antenneCapte.png', kind: 'building' },
  satellite: { src: 'assets/sprites/satellite.png', kind: 'building' },
  portail: { src: 'assets/sprites/portail.png', kind: 'building' },
  mars: { src: 'assets/sprites/mars.png', kind: 'building' },
  colonieMartienne: { src: 'assets/sprites/colonieMartienne.png', kind: 'building' },
  iaGalactique: { src: 'assets/sprites/iaGalactique.png', kind: 'building' },
  bigbang: { src: 'assets/sprites/bigbang.png', kind: 'building' },
  trouVerCompost: { src: 'assets/sprites/trouVerCompost.png', kind: 'building' },
  vaisseauGraine: { src: 'assets/sprites/vaisseauGraine.png', kind: 'building' },
  jardinQuantique: { src: 'assets/sprites/jardinQuantique.png', kind: 'building' },
  multiversMousse: { src: 'assets/sprites/multiversMousse.png', kind: 'building' },
  essaimGrenouilles: { src: 'assets/sprites/essaimGrenouilles.png', kind: 'building' },
  conscienceChloro: { src: 'assets/sprites/conscienceChloro.png', kind: 'building' },
  templeCompost: { src: 'assets/sprites/templeCompost.png', kind: 'building' },
  sanctuaireNenuphar: { src: 'assets/sprites/sanctuaireNenuphar.png', kind: 'building' },
  grainePrimordiale: { src: 'assets/sprites/grainePrimordiale.png', kind: 'building' },
  jardinHorsTemps: { src: 'assets/sprites/jardinHorsTemps.png', kind: 'building' },
  tortueGalaxies: { src: 'assets/sprites/tortueGalaxies.png', kind: 'building' },
  lucioleEtoiles: { src: 'assets/sprites/lucioleEtoiles.png', kind: 'building' },
  grenouilleTrouNoir: { src: 'assets/sprites/grenouilleTrouNoir.png', kind: 'building' },
  hibouFinDesTemps: { src: 'assets/sprites/hibouFinDesTemps.png', kind: 'building' },
  dragonMousse: { src: 'assets/sprites/dragonMousse.png', kind: 'building' },
  espritMareInfinie: { src: 'assets/sprites/espritMareInfinie.png', kind: 'building' },
  // Améliorations de clic (placeholders générés)
  c1: { src: 'assets/sprites/c1.png', kind: 'clickUpgrade' },
  c2: { src: 'assets/sprites/c2.png', kind: 'clickUpgrade' },
  c3: { src: 'assets/sprites/c3.png', kind: 'clickUpgrade' },
  c4: { src: 'assets/sprites/c4.png', kind: 'clickUpgrade' },
  c5: { src: 'assets/sprites/c5.png', kind: 'clickUpgrade' },
  c6: { src: 'assets/sprites/c6.png', kind: 'clickUpgrade' },
  c7: { src: 'assets/sprites/c7.png', kind: 'clickUpgrade' },
  c8: { src: 'assets/sprites/c8.png', kind: 'clickUpgrade' },
  c9: { src: 'assets/sprites/c9.png', kind: 'clickUpgrade' },
  c10: { src: 'assets/sprites/c10.png', kind: 'clickUpgrade' },
  c12: { src: 'assets/sprites/c12.png', kind: 'clickUpgrade' },
  c14: { src: 'assets/sprites/c14.png', kind: 'clickUpgrade' },
  c16: { src: 'assets/sprites/c16.png', kind: 'clickUpgrade' },
  c18: { src: 'assets/sprites/c18.png', kind: 'clickUpgrade' },
  c19: { src: 'assets/sprites/c19.png', kind: 'clickUpgrade' },
  c20: { src: 'assets/sprites/c20.png', kind: 'clickUpgrade' },
  c32: { src: 'assets/sprites/c32.png', kind: 'clickUpgrade' },
  c21: { src: 'assets/sprites/c21.png', kind: 'clickUpgrade' },
  c22: { src: 'assets/sprites/c22.png', kind: 'clickUpgrade' },
  c24: { src: 'assets/sprites/c24.png', kind: 'clickUpgrade' },
  // Objets uniques de l'onglet Spécial (placeholders générés)
  chatJardin: { src: 'assets/sprites/chatJardin.png', kind: 'unique' },
  siffletMare: { src: 'assets/sprites/siffletMare.png', kind: 'unique' },
  grelotVent: { src: 'assets/sprites/grelotVent.png', kind: 'unique' },
  tamtamCrapauds: { src: 'assets/sprites/tamtamCrapauds.png', kind: 'unique' },
  reveilTetards: { src: 'assets/sprites/reveilTetards.png', kind: 'unique' },
  coeurBraise: { src: 'assets/sprites/coeurBraise.png', kind: 'unique' },
  sentinelleTemporelle: { src: 'assets/sprites/sentinelleTemporelle.png', kind: 'unique' },
  chronoMare: { src: 'assets/sprites/chronoMare.png', kind: 'unique' },
  appelAncetres: { src: 'assets/sprites/appelAncetres.png', kind: 'unique' },
  orageApprivoise: { src: 'assets/sprites/orageApprivoise.png', kind: 'unique' },
  // Bâtiments de compagnon (onglet Bâtiments)
  cascadeTetards: { src: 'assets/sprites/cascadeTetards.png', kind: 'companionBuilding' },
  bureauComptage: { src: 'assets/sprites/bureauComptage.png', kind: 'companionBuilding' },
  circuitEscargots: { src: 'assets/sprites/circuitEscargots.png', kind: 'companionBuilding' },
  rocherChauffant: { src: 'assets/sprites/rocherChauffant.png', kind: 'companionBuilding' },
  retraiteTortues: { src: 'assets/sprites/retraiteTortues.png', kind: 'companionBuilding' },
  megaphoneCrapaud: { src: 'assets/sprites/megaphoneCrapaud.png', kind: 'companionBuilding' },
  tourRoseaux: { src: 'assets/sprites/tourRoseaux.png', kind: 'companionBuilding' },
  marcheNoirTaupes: { src: 'assets/sprites/marcheNoirTaupes.png', kind: 'companionBuilding' },
  entrepotGraines: { src: 'assets/sprites/entrepotGraines.png', kind: 'companionBuilding' },
  aquariumRadiations: { src: 'assets/sprites/aquariumRadiations.png', kind: 'companionBuilding' },
  pisteEnvol: { src: 'assets/sprites/pisteEnvol.png', kind: 'companionBuilding' },
  terrariumMartien: { src: 'assets/sprites/terrariumMartien.png', kind: 'companionBuilding' },
  perchoirRefroidi: { src: 'assets/sprites/perchoirRefroidi.png', kind: 'companionBuilding' },
  bocalSchrodinger: { src: 'assets/sprites/bocalSchrodinger.png', kind: 'companionBuilding' },
  templeEternel: { src: 'assets/sprites/templeEternel.png', kind: 'companionBuilding' },
  mareOriginelle: { src: 'assets/sprites/mareOriginelle.png', kind: 'companionBuilding' },
  observatoireCarapace: { src: 'assets/sprites/observatoireCarapace.png', kind: 'companionBuilding' },
  bassinHorizon: { src: 'assets/sprites/bassinHorizon.png', kind: 'companionBuilding' },
  sourceToutesMares: { src: 'assets/sprites/sourceToutesMares.png', kind: 'companionBuilding' },
};

// Compagnons (onglet Production) : des créatures que Leroy embauche, de la mare du coin
// jusqu'aux batraciens cosmiques. Les id restent ceux d'origine — ils sont référencés par
// SYNERGIES, les sprites et les bâtiments de l'onglet Bâtiments (voir COMPANION_BUILDINGS).
const BUILDINGS = [
  { id: 'stagiaire', name: { fr: "Cousin têtard de Leroy", en: "Leroy's Tadpole Cousin" }, desc: { fr: "Debout tôt ce matin, et motivé. Ça ne durera pas.", en: "Up early today, motivated. Won't last." }, baseCost: 100, baseCps: 1 },
  { id: 'voisin', name: { fr: "Coccinelle comptable", en: "Accountant Ladybug" }, desc: { fr: "Elle compte les pucerons deux fois. Personne n'a jamais osé vérifier.", en: "Counts the aphids twice. Nobody ever dared check." }, baseCost: 200, baseCps: 1 },
  { id: 'poubelleCompost', name: { fr: "Escargot de course", en: "Racing Snail" }, desc: { fr: "Il s'entraîne pour un championnat que personne n'a jamais vu.", en: "Training for a championship nobody has ever seen." }, baseCost: 700, baseCps: 3 },
  { id: 'tondeuse', name: { fr: "Bande de lézards du coin", en: "Local Lizard Gang" }, desc: { fr: "Personne ne sait qui les a prévenus, ils sont juste là.", en: "Nobody knows who told them. They're just here." }, baseCost: 2500, baseCps: 8 },
  { id: 'serre', name: { fr: "Tortue expérimentée", en: "Experienced Turtle" }, desc: { fr: "Trois chantiers à son actif. Elle prend son temps, mais elle livre.", en: "Already worked 3 sites before this one. Takes her time, but delivers." }, baseCost: 30000, baseCps: 47 },
  { id: 'hamacLeroy', name: { fr: "Crapaud contremaître", en: "Foreman Toad" }, desc: { fr: "Il ne fait rien lui-même, mais il crie très efficacement.", en: "Does nothing himself, but yells very efficiently." }, baseCost: 100000, baseCps: 110 },
  { id: 'drone', name: { fr: "Libellule éclaireuse", en: "Scout Dragonfly" }, desc: { fr: "Elle repère les mauvaises herbes depuis les airs. Et le chat des voisins aussi.", en: "Spots weeds from above. Also spots the neighbor's cat." }, baseCost: 300000, baseCps: 260 },
  { id: 'usine', name: { fr: "Colonie de taupes bénévoles", en: "Volunteer Mole Colony" }, desc: { fr: "Elles creusent gratuitement. Papi refuse d'expliquer pourquoi.", en: "They dig for free. Gramps refuses to explain why." }, baseCost: 3e+6, baseCps: 1400 },
  { id: 'marcheNoir', name: { fr: "Fourmilière sous-traitante", en: "Subcontracting Anthill" }, desc: { fr: "Papi connaît un gars. Papi connaît toujours un gars.", en: "Gramps knows a guy. Gramps always knows a guy." }, baseCost: 1.2e+7, baseCps: 3200 },
  { id: 'franchise', name: { fr: "Salamandre sous contrat douteux", en: "Salamander on a Shady Contract" }, desc: { fr: "Elle a signé sans lire. Papi avait bien insisté sur ce point.", en: "She signed without reading. Gramps did insist on that part." }, baseCost: 4e+7, baseCps: 7800 },
  { id: 'labo', name: { fr: "Triton mutant du labo", en: "Mutant Lab Newt" }, desc: { fr: "Trois pattes de trop, un rendement excellent. On ne pose pas de questions.", en: "Three legs too many, excellent output. We don't ask questions." }, baseCost: 5e+8, baseCps: 44000 },
  { id: 'antenneCapte', name: { fr: "Axolotl télépathe", en: "Telepathic Axolotl" }, desc: { fr: "Il capte les pensées de Leroy et se plaint qu'il n'y ait pas grand-chose.", en: "Picks up Leroy's thoughts. Complains there isn't much in there." }, baseCost: 2e+9, baseCps: 100000 },
  { id: 'satellite', name: { fr: "Escadrille de hérons cosmonautes", en: "Cosmonaut Heron Squadron" }, desc: { fr: "Leroy préfère ne pas demander où ils ont eu les casques.", en: "Leroy prefers not to ask where they got the helmets." }, baseCost: 6e+9, baseCps: 260000 },
  { id: 'portail', name: { fr: "Loutre passeuse de mondes", en: "World-Ferrying Otter" }, desc: { fr: "Elle en est revenue changée à jamais. Elle ne veut pas en parler.", en: "She came back forever changed. She won't talk about it." }, baseCost: 8e+10, baseCps: 1.6e6 },
  { id: 'mars', name: { fr: "Crapaud martien", en: "Martian Toad" }, desc: { fr: "Le terrain commence à se décoller du sol. Personne n'ose le dire à Leroy.", en: "The land is starting to lift off the ground. Nobody dares tell Leroy." }, baseCost: 2e+12, baseCps: 1e7 },
  { id: 'colonieMartienne', name: { fr: "Nuée de mille-pattes martiens", en: "Swarm of Martian Centipedes" }, desc: { fr: "Aucun État ne les reconnaît. Papi leur a quand même vendu des parcelles.", en: "Not recognized by any government. Gramps sold them plots anyway." }, baseCost: 1.2e+13, baseCps: 2.5e7 },
  { id: 'iaGalactique', name: { fr: "Hibou-calculateur galactique", en: "Galactic Owl Computer" }, desc: { fr: "Il hulule en binaire. Personne ne sait quoi en penser.", en: "It hoots in binary. Nobody knows what to make of it." }, baseCost: 4e+13, baseCps: 6.5e7 },
  { id: 'bigbang', name: { fr: "Tardigrade du Big Bang", en: "Big Bang Tardigrade" }, desc: { fr: "Il était déjà là avant l'univers, et il a survécu à tout depuis.", en: "It was there before the universe, and has survived everything since." }, baseCost: 6e+14, baseCps: 4.3e8 },
  { id: 'trouVerCompost', name: { fr: "Anguille des tunnels cosmiques", en: "Cosmic Tunnel Eel" }, desc: { fr: "Elle relie le tas de compost au fond de l'univers. Pratique.", en: "Links the compost heap to the edge of the universe. Handy." }, baseCost: 2.5e+15, baseCps: 1e9 },
  { id: 'vaisseauGraine', name: { fr: "Baleine-semeuse intergalactique", en: "Intergalactic Seeding Whale" }, desc: { fr: "Elle sème des mares sur des exoplanètes, en passant.", en: "Seeds ponds on distant exoplanets along the way." }, baseCost: 8e+15, baseCps: 2.8e9 },
  { id: 'jardinQuantique', name: { fr: "Papillon quantique", en: "Quantum Butterfly" }, desc: { fr: "Il bat des ailes et ne bat pas des ailes en même temps.", en: "It flaps and doesn't flap its wings at the same time." }, baseCost: 1e+17, baseCps: 1.9e10 },
  { id: 'multiversMousse', name: { fr: "Méduse de tous les mondes", en: "Jellyfish of Every World" }, desc: { fr: "Une version d'elle existe dans toutes les réalités possibles.", en: "A version of her exists in every possible reality." }, baseCost: 1.2e+18, baseCps: 1.3e11 },
  { id: 'essaimGrenouilles', name: { fr: "Vol de chauves-souris sans dimension", en: "Flight of Dimensionless Bats" }, desc: { fr: "Elles se repèrent à l'écho d'endroits qui n'existent pas.", en: "They echolocate off places that don't exist." }, baseCost: 5.5e+18, baseCps: 3.5e11 },
  { id: 'conscienceChloro', name: { fr: "Banc de poissons-devins", en: "School of Oracle Fish" }, desc: { fr: "Ils tournent en rond, mais ils savent des choses.", en: "They swim in circles, but they know things." }, baseCost: 2.4e+19, baseCps: 9e11 },
  { id: 'templeCompost', name: { fr: "Ancien du Nénuphar Éternel", en: "Elder of the Eternal Lily Pad" }, desc: { fr: "Il a vu naître le premier étang. Il en parle beaucoup trop.", en: "He watched the first pond appear. He talks about it far too much." }, baseCost: 2.8e+20, baseCps: 6e12 },
  { id: 'sanctuaireNenuphar', name: { fr: "Gardien aux mille yeux", en: "Guardian of a Thousand Eyes" }, desc: { fr: "L'Ancien d'à côté l'a mal pris. Papi s'en fiche complètement.", en: "The Elder next door didn't take it well. Gramps couldn't care less." }, baseCost: 1.2e+21, baseCps: 1.5e13 },
  { id: 'grainePrimordiale', name: { fr: "Têtard Primordial", en: "Primordial Tadpole" }, desc: { fr: "Le tout premier têtard de l'histoire.", en: "The very first tadpole to have ever existed." }, baseCost: 5.5e+21, baseCps: 4e13 },
  { id: 'jardinHorsTemps', name: { fr: "Le Vieux Râleur hors du temps", en: "The Old Grumbler Beyond Time" }, desc: { fr: "Personne ne connaît son âge. Il grommelle quand on le lui demande.", en: "Nobody knows his age. He grumbles when asked." }, baseCost: 7.1e+22, baseCps: 3e14 },
  // --- Fin de partie : au-delà du temps ---
  { id: 'tortueGalaxies', name: { fr: "Tortue porteuse de galaxies", en: "Galaxy-Bearing Turtle" }, desc: { fr: "Elle porte trois galaxies sur sa carapace. Elle n'a jamais demandé pourquoi.", en: "She carries three galaxies on her shell. She never asked why." }, baseCost: 8.1e+23, baseCps: 2e15 },
  { id: 'lucioleEtoiles', name: { fr: "Essaim de lucioles stellaires", en: "Swarm of Star Fireflies" }, desc: { fr: "Chaque luciole est une étoile en miniature. Papi revend les éteintes comme lampes.", en: "Each firefly is a tiny star. Gramps sells the burnt-out ones as lamps." }, baseCost: 8.4e+24, baseCps: 1.2e16 },
  { id: 'grenouilleTrouNoir', name: { fr: "Grenouille du trou noir", en: "Black Hole Frog" }, desc: { fr: "Tout ce qui passe près de sa langue disparaît. Même les factures de Papi.", en: "Everything near her tongue disappears. Even Gramps' bills." }, baseCost: 8.4e+25, baseCps: 7e16 },
  { id: 'hibouFinDesTemps', name: { fr: "Hibou de la fin des temps", en: "Owl at the End of Time" }, desc: { fr: "Il a déjà vu la fin de l'histoire. Il refuse de dire qui gagne.", en: "He has already seen how the story ends. He won't say who wins." }, baseCost: 8.7e+26, baseCps: 4.2e17 },
  { id: 'dragonMousse', name: { fr: "Dragon de mousse ancestral", en: "Ancestral Moss Dragon" }, desc: { fr: "Il crache de l'engrais au lieu du feu. Le jardin ne s'en plaint pas.", en: "He breathes fertilizer instead of fire. The garden doesn't complain." }, baseCost: 8.9e+27, baseCps: 2.5e18 },
  { id: 'espritMareInfinie', name: { fr: "Esprit de la Mare Infinie", en: "Spirit of the Infinite Pond" }, desc: { fr: "Toutes les mares du monde sont reliées à lui. Même le seau de Leroy.", en: "Every pond in the world is connected to him. Even Leroy's bucket." }, baseCost: 9.2e+28, baseCps: 1.5e19 },
];

// Paliers de compagnon : à chacun de ces nombres d'exemplaires, la production DE CE compagnon est
// multipliée par COMPANION_MILESTONE_MULT. Nombreux et doux plutôt que rares et forts : ils donnent
// un objectif à quelques minutes, font revenir sur les anciens compagnons, et comblent les temps
// morts sans accélérer la partie (les prix sont recalés en conséquence — voir le banc d'équilibrage).
const COMPANION_MILESTONES = [10, 20, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
const COMPANION_MILESTONE_MULT = 1.25;
// Nombre de paliers atteints (la liste est triée : on s'arrête au premier non atteint).
function companionMilestoneCount(owned) {
  let n = 0;
  while (n < COMPANION_MILESTONES.length && owned >= COMPANION_MILESTONES[n]) n++;
  return n;
}
function companionMilestoneMult(owned) { return Math.pow(companionMilestoneStep(), companionMilestoneCount(owned)); }
function companionMilestoneStep() { return challengeDone('minimaliste') ? 1.27 : COMPANION_MILESTONE_MULT; }
const GROWTH = 1.20;

