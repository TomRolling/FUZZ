// ================= CLICK UPGRADES (parallèle aux bâtiments) =================
// 'flatMult' : multiplie le gain de clic de base
// 'cpsPercent' : ajoute un % de la production/seconde totale au gain de clic (additif, garde le clic utile très loin)
// Nombre de clics avant que Papi n'ouvre son magasin. Lu aussi par la barre « Prochain », qui
// montre ce seuil tant que le magasin n'existe pas, et par le prix du premier objet de l'onglet
// Clic ci-dessous. Déclaré ici, avant les tables qui s'en servent.
const CLICS_POUR_LE_MAGASIN = 200;
const CLICK_UPGRADES = [
  // Prix = ce que le joueur a en poche quand le magasin s'ouvre (un clic donne 1 Verdure) :
  // l'onglet Clic est donc présenté avec un achat possible, comme tous les autres.
  { id: 'c1', name: { fr: 'Gants renforcés', en: 'Reinforced Gloves' }, desc: { fr: '+100% de Verdure par clic.', en: '+100% Greenery per click.' }, cost: CLICS_POUR_LE_MAGASIN, type: 'flatMult', value: 2 },
  { id: 'c2', name: { fr: 'Clic synchronisé', en: 'Synced Click' }, desc: { fr: "Chaque clic ajoute 0.025% de ta production/seconde.", en: "Each click adds 0.025% of your production/second." }, cost: 3000, type: 'cpsPercent', value: 0.00025 },
  { id: 'c3', name: { fr: "Poignet d'acier", en: 'Steel Wrist' }, desc: { fr: '+100% de Verdure par clic en plus.', en: '+100% additional Greenery per click.' }, cost: 40000, type: 'flatMult', value: 2 },
  { id: 'c4', name: { fr: 'Clic en rafale', en: 'Burst Click' }, desc: { fr: "+0.025% supplémentaire de ta production/seconde par clic.", en: "An additional +0.025% of your production/second per click." }, cost: 400000, type: 'cpsPercent', value: 0.00025 },
  { id: 'c21', name: { fr: 'Gant à ventouses', en: 'Suction-Cup Glove' }, desc: { fr: '+125% de Verdure par clic en plus.', en: '+125% additional Greenery per click.' }, cost: 1.5e+6, type: 'flatMult', value: 2.25 },
  { id: 'c22', name: { fr: 'Cadence naturelle', en: 'Natural Cadence' }, desc: { fr: "+0.025% supplémentaire de ta production/seconde par clic.", en: "An additional +0.025% of your production/second per click." }, cost: 2.5e+6, type: 'cpsPercent', value: 0.00025 },
  { id: 'c5', name: { fr: 'Binette vibrante', en: 'Vibrating Hand Hoe' }, desc: { fr: '+100% de Verdure par clic en plus.', en: '+100% additional Greenery per click.' }, cost: 6e+6, type: 'flatMult', value: 2 },
  { id: 'c6', name: { fr: 'Réflexes augmentés', en: 'Enhanced Reflexes' }, desc: { fr: "+0.025% supplémentaire de ta production/seconde par clic.", en: "An additional +0.025% of your production/second per click." }, cost: 6e+7, type: 'cpsPercent', value: 0.00025 },
  { id: 'c7', name: { fr: 'Gant-drone', en: 'Drone Glove' }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 1e+9, type: 'totalMult', value: 1.05 },
  { id: 'c8', name: { fr: 'Synchronisation neurale', en: 'Neural Sync' }, desc: { fr: "+0.03% supplémentaire de ta production/seconde par clic.", en: "An additional +0.03% of your production/second per click." }, cost: 2e+10, type: 'cpsPercent', value: 0.0003 },
  { id: 'c23', name: { fr: 'Prothèse de jardinier', en: "Gardener's Prosthetic" }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 4e+10, type: 'totalMult', value: 1.05 },
  { id: 'c24', name: { fr: 'Mémoire musculaire', en: 'Muscle Memory' }, desc: { fr: "+0.03% supplémentaire de ta production/seconde par clic.", en: "An additional +0.03% of your production/second per click." }, cost: 1e+11, type: 'cpsPercent', value: 0.0003 },
  { id: 'c9', name: { fr: 'Exosquelette léger', en: 'Light Exoskeleton' }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 3e+11, type: 'totalMult', value: 1.05 },
  { id: 'c10', name: { fr: 'Clic quantique', en: 'Quantum Click' }, desc: { fr: "+0.03% supplémentaire de ta production/seconde par clic.", en: "An additional +0.03% of your production/second per click." }, cost: 5e+12, type: 'cpsPercent', value: 0.0003 },
  { id: 'c11', name: { fr: 'Main martienne', en: 'Martian Hand' }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 7e+13, type: 'totalMult', value: 1.05 },
  { id: 'c12', name: { fr: 'Résonance galactique', en: 'Galactic Resonance' }, desc: { fr: "+0.04% supplémentaire de ta production/seconde par clic.", en: "An additional +0.04% of your production/second per click." }, cost: 1e+15, type: 'cpsPercent', value: 0.0004 },
  { id: 'c25', name: { fr: 'Griffe martienne', en: 'Martian Claw' }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 2.5e+15, type: 'totalMult', value: 1.05 },
  { id: 'c26', name: { fr: 'Câblage neuronal avancé', en: 'Advanced Neural Wiring' }, desc: { fr: "+0.04% supplémentaire de ta production/seconde par clic.", en: "An additional +0.04% of your production/second per click." }, cost: 5e+15, type: 'cpsPercent', value: 0.0004 },
  { id: 'c13', name: { fr: 'Doigts du Big Bang', en: 'Big Bang Fingers' }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 1.5e+16, type: 'totalMult', value: 1.05 },
  { id: 'c14', name: { fr: 'Clic intergalactique', en: 'Intergalactic Click' }, desc: { fr: "+0.04% supplémentaire de ta production/seconde par clic.", en: "An additional +0.04% of your production/second per click." }, cost: 2e+17, type: 'cpsPercent', value: 0.0004 },
  { id: 'c15', name: { fr: 'Pression quantique', en: 'Quantum Pressure' }, desc: { fr: "+8% sur tout ce que rapporte un clic.", en: "+8% on everything a click earns." }, cost: 3e+18, type: 'totalMult', value: 1.08 },
  { id: 'c16', name: { fr: 'Écho de mousse', en: 'Moss Echo' }, desc: { fr: "+0.045% supplémentaire de ta production/seconde par clic.", en: "An additional +0.045% of your production/second per click." }, cost: 1e+20, type: 'cpsPercent', value: 0.00045 },
  { id: 'c27', name: { fr: 'Poing du compost éternel', en: 'Fist of Eternal Compost' }, desc: { fr: "+8% sur tout ce que rapporte un clic.", en: "+8% on everything a click earns." }, cost: 5e+20, type: 'totalMult', value: 1.08 },
  { id: 'c28', name: { fr: 'Battement stellaire', en: 'Stellar Pulse' }, desc: { fr: "+0.045% supplémentaire de ta production/seconde par clic.", en: "An additional +0.045% of your production/second per click." }, cost: 2e+21, type: 'cpsPercent', value: 0.00045 },
  { id: 'c17', name: { fr: 'Volonté chlorophyllienne', en: 'Chlorophyll Will' }, desc: { fr: "+8% sur tout ce que rapporte un clic.", en: "+8% on everything a click earns." }, cost: 1.2e+22, type: 'totalMult', value: 1.08 },
  { id: 'c18', name: { fr: 'Rituel du compost', en: 'Compost Ritual' }, desc: { fr: "+0.045% supplémentaire de ta production/seconde par clic.", en: "An additional +0.045% of your production/second per click." }, cost: 3e+23, type: 'cpsPercent', value: 0.00045 },
  { id: 'c19', name: { fr: 'Empreinte primordiale', en: 'Primordial Imprint' }, desc: { fr: "+10% sur tout ce que rapporte un clic.", en: "+10% on everything a click earns." }, cost: 9.999999999999999e+24, type: 'totalMult', value: 1.1 },
  { id: 'c20', name: { fr: 'Clic hors du temps', en: 'Click Beyond Time' }, desc: { fr: "+0.05% supplémentaire de ta production/seconde par clic.", en: "An additional +0.05% of your production/second per click." }, cost: 2.5e+26, type: 'cpsPercent', value: 0.0005 },
  { id: 'c29', name: { fr: 'Paume galactique', en: 'Galactic Palm' }, desc: { fr: "+10% sur tout ce que rapporte un clic.", en: "+10% on everything a click earns." }, cost: 1e+28, type: 'totalMult', value: 1.1 },
  { id: 'c30', name: { fr: 'Clic du trou noir', en: 'Black Hole Click' }, desc: { fr: "+8% sur tout ce que rapporte un clic.", en: "+8% on everything a click earns." }, cost: 5e+29, type: 'totalMult', value: 1.08 },
  { id: 'c31', name: { fr: 'Main de la fin des temps', en: 'Hand at the End of Time' }, desc: { fr: "+12% sur tout ce que rapporte un clic.", en: "+12% on everything a click earns." }, cost: 2e+31, type: 'totalMult', value: 1.12 },
  { id: 'c32', name: { fr: 'Clic infini', en: 'Infinite Click' }, desc: { fr: "+10% sur tout ce que rapporte un clic.", en: "+10% on everything a click earns." }, cost: 1e+33, type: 'totalMult', value: 1.1 },
];

// Synergies: chaque unité de "source" boost le cps de "target" de percent
const SYNERGIES = [
  { source: 'serre', target: 'stagiaire', percent: 0.02 },
  { source: 'franchise', target: 'voisin', percent: 0.02 },
  { source: 'usine', target: 'tondeuse', percent: 0.015 },
  { source: 'iaGalactique', target: 'drone', percent: 0.02 },
  { source: 'labo', target: 'usine', percent: 0.015 },
  { source: 'portail', target: 'satellite', percent: 0.02 },
  { source: 'bigbang', target: 'mars', percent: 0.03 },
  { source: 'satellite', target: 'serre', percent: 0.015 },
  { source: 'grainePrimordiale', target: 'jardinQuantique', percent: 0.02 },
  { source: 'jardinHorsTemps', target: 'conscienceChloro', percent: 0.025 },
];

// ================= BÂTIMENTS DE COMPAGNON (onglet Bâtiments) =================
// Achat unique, et chacun ne booste QU'UN compagnon précis (targetId -> id dans BUILDINGS).
// C'est le seul endroit du jeu où un bonus cible un compagnon en particulier : Recherche et
// Spécial ne font que du générique, pour que l'équilibrage reste lisible.
const COMPANION_BUILDINGS = [
  { id: 'cascadeTetards', targetId: 'stagiaire', mult: 2.0, cost: 50000, name: { fr: 'Cascade à têtards', en: 'Tadpole Waterslide' }, desc: { fr: "Ils remontent le courant pour la redescendre. Toute la journée.", en: "They swim back up just to do it again. All day long." } },
  { id: 'bureauComptage', targetId: 'voisin', mult: 2.0, cost: 120000, name: { fr: "Bureau de comptage", en: "Counting Office" }, desc: { fr: "Un abaque, deux registres, et beaucoup moins d'erreurs de pucerons.", en: "An abacus, two ledgers, and far fewer aphid miscounts." } },
  { id: 'circuitEscargots', targetId: 'poubelleCompost', mult: 2.0, cost: 500000, name: { fr: 'Circuit de course à escargots', en: 'Snail Racing Circuit' }, desc: { fr: "Un vrai podium, de vrais gradins, zéro spectateur.", en: "A real podium, real stands, zero spectators." } },
  { id: 'rocherChauffant', targetId: 'tondeuse', mult: 2.0, cost: 2e+6, name: { fr: 'Rocher chauffant municipal', en: 'Municipal Basking Rock' }, desc: { fr: "Un lézard au chaud est un lézard qui travaille. Théoriquement.", en: "A warm lizard is a working lizard. In theory." } },
  { id: 'retraiteTortues', targetId: 'serre', mult: 2.0, cost: 2e+7, name: { fr: 'Maison de retraite pour tortues', en: 'Turtle Retirement Home' }, desc: { fr: "Elles y prennent des forces. Très, très lentement.", en: "They regain their strength there. Very, very slowly." } },
  { id: 'megaphoneCrapaud', targetId: 'hamacLeroy', mult: 2.0, cost: 1e+8, name: { fr: 'Mégaphone à crapaud', en: 'Toad Megaphone' }, desc: { fr: "On l'entend maintenant à trois terrains de distance.", en: "You can now hear him three plots away." } },
  { id: 'tourRoseaux', targetId: 'drone', mult: 2.0, cost: 5e+8, name: { fr: 'Tour de contrôle en roseaux', en: 'Reed Control Tower' }, desc: { fr: "Les libellules ont enfin un plan de vol. Elles l'ignorent.", en: "The dragonflies finally have a flight plan. They ignore it." } },
  { id: 'marcheNoirTaupes', targetId: 'usine', mult: 2.25, cost: 4e+9, name: { fr: 'Marché noir des taupes', en: 'Mole Black Market' }, desc: { fr: "Ça se passe sous terre, et c'est mieux ainsi.", en: "It happens underground, and that's for the best." } },
  { id: 'entrepotGraines', targetId: 'marcheNoir', mult: 2.25, cost: 2e+10, name: { fr: "Entrepôt à graines", en: "Seed Warehouse" }, desc: { fr: "Papi jure que tout est déclaré. Papi jure beaucoup.", en: "Gramps swears it's all declared. Gramps swears a lot." } },
  { id: 'aquariumRadiations', targetId: 'labo', mult: 2.25, cost: 5e+11, name: { fr: 'Aquarium à radiations douces', en: 'Gentle Radiation Tank' }, desc: { fr: "« Douces » : c'est le mot important.", en: "\"Gentle\" is the word to focus on here." } },
  { id: 'pisteEnvol', targetId: 'satellite', mult: 2.5, cost: 8e+12, name: { fr: "Piste d'envol pour hérons", en: "Heron Runway" }, desc: { fr: "Décollages groupés toutes les dix minutes.", en: "Group takeoffs every ten minutes." } },
  { id: 'terrariumMartien', targetId: 'mars', mult: 2.5, cost: 2.5e+15, name: { fr: 'Terrarium martien pressurisé', en: 'Pressurized Martian Terrarium' }, desc: { fr: "Enfin un endroit où le crapaud arrête de se plaindre du vide.", en: "Finally a place where the toad stops complaining about the vacuum." } },
  { id: 'perchoirRefroidi', targetId: 'iaGalactique', mult: 2.5, cost: 6e+16, name: { fr: "Perchoir refroidi à la vase", en: "Silt-Cooled Perch" }, desc: { fr: "Refroidissement naturel, odeur discutable, calculs redoutables.", en: "Natural cooling, questionable smell, formidable computing." } },
  { id: 'bocalSchrodinger', targetId: 'jardinQuantique', mult: 3.0, cost: 3e+20, name: { fr: "Bocal de Schrödinger", en: "Schrödinger's Jar" }, desc: { fr: "Le papillon y est à la fois posé et en vol. On encaisse quand même.", en: "The butterfly is both resting and flying. We cash in either way." } },
  { id: 'templeEternel', targetId: 'templeCompost', mult: 3.0, cost: 2e+24, name: { fr: 'Temple Éternel', en: 'Eternal Temple' }, desc: { fr: "L'Ancien a enfin un lieu à sa mesure pour raconter l'histoire du premier étang.", en: "The Elder finally has a venue worthy of his first-pond stories." } },
  { id: 'mareOriginelle', targetId: 'grainePrimordiale', mult: 3.0, cost: 5e+25, name: { fr: 'Mare Originelle restaurée', en: 'Restored Original Pond' }, desc: { fr: "Le tout premier têtard y est enfin chez lui.", en: "The very first tadpole is finally home." } },
  { id: 'observatoireCarapace', targetId: 'tortueGalaxies', mult: 3.0, cost: 5e+28, name: { fr: "Observatoire sur carapace", en: "Shell Observatory" }, desc: { fr: "On y observe les galaxies de très près. Trop près, selon la tortue.", en: "You watch the galaxies up close from here. Too close, says the turtle." } },
  { id: 'bassinHorizon', targetId: 'grenouilleTrouNoir', mult: 3.0, cost: 4e+30, name: { fr: "Bassin de l'horizon des événements", en: "Event Horizon Basin" }, desc: { fr: "Rien n'en ressort, à part la production.", en: "Nothing comes out of it, except production." } },
  { id: 'sourceToutesMares', targetId: 'espritMareInfinie', mult: 3.0, cost: 1e+35, name: { fr: "Source de toutes les mares", en: "Source of All Ponds" }, desc: { fr: "Leroy y a jeté une pièce. Elle n'est jamais retombée.", en: "Leroy tossed a coin in. It never came back down." } },
];

// ================= UNIQUE SPECIAL BUILDINGS =================
// Deux règles pour cet onglet : soit une compétence ACTIVE (bouton + effet temporaire +
// recharge), soit un effet qui n'a aucun équivalent dans Recherche / Clic / Bâtiments.
// Tout bonus "production globale / connaissances / coût / hors-ligne / clic" appartient
// désormais aux autres onglets, pour que chaque onglet ait un rôle clair.
// Prix des quatre premiers : chacun rapporte environ +5 % de production en moyenne, et le Spécial
// repart de zéro à chaque Prestige. Plus chers, aucun n'était rentable dans une partie (le banc ne
// les achetait jamais) ; à ces prix, ils le deviennent l'un après l'autre au fil de la première
// partie. Les suivants restent calés pour les parties d'après.
const UNIQUE_BUILDINGS = [
  { id: 'chatJardin', name: { fr: 'Le Chat de la Mare', en: 'The Pond Cat' }, desc: { fr: "Rapporte un bonus aléatoire de Verdure toutes les heures.", en: "Brings a random Greenery bonus every hour." }, cost: 4e+6 },
  { id: 'siffletMare', name: { fr: 'Sifflet de la Mare', en: 'Pond Whistle' }, desc: { fr: "Capacité active : x1.5 production pendant 2 min (recharge 20 min).", en: "Active ability: x1.5 production for 2 min (20 min cooldown)." }, cost: 5e+7, active: { cooldownMs: 20 * 60000, type: 'boostMult', value: 1.5, durationMs: 120000 } },
  { id: 'grelotVent', name: { fr: 'Grelot du Vent', en: 'Wind Chime' }, desc: { fr: "Capacité active : x2 production pendant 1 min (recharge 15 min).", en: "Active ability: x2 production for 1 min (15 min cooldown)." }, cost: 6e+8, active: { cooldownMs: 15 * 60000, type: 'boostMult', value: 2, durationMs: 60000 } },
  { id: 'tamtamCrapauds', name: { fr: 'Tam-tam des crapauds', en: 'Toad Drums' }, desc: { fr: "Capacité active : x3 Verdure par clic pendant 1 min (recharge 15 min).", en: "Active ability: x3 Greenery per click for 1 min (15 min cooldown)." }, cost: 5e+9, active: { cooldownMs: 15 * 60000, type: 'clickBoost', value: 3, durationMs: 60000 } },
  { id: 'reveilTetards', name: { fr: 'Réveil des têtards', en: 'Tadpole Reveille' }, desc: { fr: "Capacité active : gain instantané égal à 30 s de production (recharge 15 min).", en: "Active ability: instant gain equal to 30 s of production (15 min cooldown)." }, cost: 1.5e+12, active: { cooldownMs: 15 * 60000, type: 'instantGain', minutesEquivalent: 0.5 } },
  { id: 'coeurBraise', name: { fr: 'Cœur de Braise', en: 'Ember Heart' }, desc: { fr: "Capacité active : gain instantané égal à 1 min 30 s de production (recharge 30 min).", en: "Active ability: instant gain equal to 1 min 30 s of production (30 min cooldown)." }, cost: 1.2e+14, active: { cooldownMs: 30 * 60000, type: 'instantGain', minutesEquivalent: 1.5 } },
  { id: 'sentinelleTemporelle', name: { fr: 'Sentinelle Temporelle', en: 'Temporal Sentinel' }, desc: { fr: "Réduit de 50% les visites surprises de Papi Feuillage.", en: "Reduces Gramps Weeds' surprise visits by 50%." }, cost: 1e+15 },
  { id: 'chronoMare', name: { fr: 'Chrono de la mare', en: 'Pond Stopwatch' }, desc: { fr: "Capacité active : x3 production pendant 1 min (recharge 20 min).", en: "Active ability: x3 production for 1 min (20 min cooldown)." }, cost: 4e+16, active: { cooldownMs: 20 * 60000, type: 'boostMult', value: 3, durationMs: 60000 } },
  { id: 'appelAncetres', name: { fr: 'Appel des Ancêtres', en: 'Call of the Ancestors' }, desc: { fr: "Capacité active : gain instantané égal à 3 min de production (recharge 60 min).", en: "Active ability: instant gain equal to 3 min of production (60 min cooldown)." }, cost: 6e+18, active: { cooldownMs: 60 * 60000, type: 'instantGain', minutesEquivalent: 3 } },
  { id: 'orageApprivoise', name: { fr: 'Orage apprivoisé', en: 'Tamed Thunderstorm' }, desc: { fr: "Capacité active : x4 production pendant 1 min (recharge 20 min).", en: "Active ability: x4 production for 1 min (20 min cooldown)." }, cost: 2.5e+21, active: { cooldownMs: 20 * 60000, type: 'boostMult', value: 4, durationMs: 60000 } },
];

// ================= COSMÉTIQUES DE CLIC (purement visuels) =================
const SKINS = [
  { id: 'default', name: { fr: 'Feuilles classiques', en: 'Classic Leaves' }, desc: { fr: 'Le style par défaut.', en: 'The default style.' }, emojis: ['🌿','🍃','✨'], cost: 0 },
  { id: 'flowers', name: { fr: 'Pack Floral', en: 'Floral Pack' }, desc: { fr: 'Des pétales à chaque clic.', en: 'Petals on every click.' }, emojis: ['🌸','🌺','💮'], cost: 5 },
  { id: 'stars', name: { fr: 'Pack Étoilé', en: 'Starry Pack' }, desc: { fr: 'Un peu de magie cosmique.', en: 'A bit of cosmic magic.' }, emojis: ['⭐','💫','🌙'], cost: 8 },
  { id: 'candy', name: { fr: 'Pack Friandises', en: 'Candy Pack' }, desc: { fr: 'Sucré et coloré.', en: 'Sweet and colorful.' }, emojis: ['🍬','🍭','🧁'], cost: 6 },
];

// ================= RESEARCH TREE (Connaissances) =================
const RESEARCH = [
  { id: 'r_prod1', name: { fr: "Compost amélioré", en: "Improved Compost" }, desc: { fr: "+10% production globale.", en: "+10% global production." }, cost: 25, type: 'prodMult', value: 1.1, requires: null },
  { id: 'r_knowledge1', name: { fr: "Carnet d'observations", en: "Observation Notebook" }, desc: { fr: "+50% de gain de Connaissances.", en: "+50% Knowledge gain." }, cost: 20, type: 'knowledgeMult', value: 1.5, requires: null },
  { id: 'r_cheap1', name: { fr: "Achat en gros", en: "Bulk Buying" }, desc: { fr: "-8% sur le coût des compagnons.", en: "-8% on companion costs." }, cost: 45, type: 'cheaper', value: 0.92, requires: null },
  { id: 'r_weather1', name: { fr: "Abri météo", en: "Weather Shelter" }, desc: { fr: "Réduit de moitié les effets négatifs de la météo.", en: "Halves the negative effects of weather." }, cost: 50, type: 'weatherShield', value: 0.5, requires: null },
  { id: 'r_offline1', name: { fr: "Goutte-à-goutte", en: "Drip Irrigation" }, desc: { fr: "+20% d'efficacité hors-ligne.", en: "+20% offline efficiency." }, cost: 60, type: 'offlineBonus', value: 0.2, requires: null },
  { id: 'r_prod2', name: { fr: "Biodiversité contrôlée", en: "Controlled Biodiversity" }, desc: { fr: "+15% production globale supplémentaire.", en: "+15% additional global production." }, cost: 90, type: 'prodMult', value: 1.15, requires: 'r_prod1' },
  { id: 'r_knowledge2', name: { fr: "Loupe de terrain", en: "Field Magnifier" }, desc: { fr: "+60% de gain de Connaissances supplémentaire.", en: "+60% additional Knowledge gain." }, cost: 100, type: 'knowledgeMult', value: 1.6, requires: 'r_knowledge1' },
  { id: 'r_prod3', name: { fr: "Harmonie de la mare", en: "Pond Harmony" }, desc: { fr: "+25% production globale supplémentaire.", en: "+25% additional global production." }, cost: 200, type: 'prodMult', value: 1.25, requires: 'r_prod2' },
  { id: 'r_prod4', name: { fr: "Permaculture", en: "Permaculture" }, desc: { fr: "+20% production globale supplémentaire.", en: "+20% additional global production." }, cost: 250, type: 'prodMult', value: 1.2, requires: 'r_prod3' },
  { id: 'r_cheap2', name: { fr: "Négociation de gros", en: "Bulk Negotiation" }, desc: { fr: "-6% supplémentaire sur le coût des compagnons.", en: "-6% additional on companion costs." }, cost: 350, type: 'cheaper', value: 0.94, requires: 'r_cheap1' },
  { id: 'r_offline2', name: { fr: "Paillage nocturne", en: "Night Mulching" }, desc: { fr: "+20% d'efficacité hors-ligne supplémentaire.", en: "+20% additional offline efficiency." }, cost: 450, type: 'offlineBonus', value: 0.2, requires: 'r_offline1' },
  { id: 'r_knowledge3', name: { fr: "Journal de bord", en: "Logbook" }, desc: { fr: "+75% de gain de Connaissances supplémentaire.", en: "+75% additional Knowledge gain." }, cost: 600, type: 'knowledgeMult', value: 1.75, requires: 'r_knowledge2' },
  { id: 'r_weather2', name: { fr: "Brise-vent en roseaux", en: "Reed Windbreak" }, desc: { fr: "Réduit les effets négatifs de la météo de 65% au total.", en: "Reduces negative weather effects by 65% in total." }, cost: 1200, type: 'weatherShield', value: 0.35, requires: 'r_weather1' },
  { id: 'r_prod5', name: { fr: "Rotation des mares", en: "Pond Rotation" }, desc: { fr: "+30% production globale supplémentaire.", en: "+30% additional global production." }, cost: 1500, type: 'prodMult', value: 1.3, requires: 'r_prod4' },
  { id: 'r_prod6', name: { fr: "Ingénierie du sol", en: "Soil Engineering" }, desc: { fr: "+35% production globale supplémentaire.", en: "+35% additional global production." }, cost: 2500, type: 'prodMult', value: 1.35, requires: 'r_prod5' },
  { id: 'r_cheap3', name: { fr: "Fournisseur attitré", en: "Regular Supplier" }, desc: { fr: "-7% supplémentaire sur le coût des compagnons.", en: "-7% additional on companion costs." }, cost: 2000, type: 'cheaper', value: 0.93, requires: 'r_cheap2' },
  { id: 'r_offline3', name: { fr: "Arrosage automatique", en: "Automatic Watering" }, desc: { fr: "+25% d'efficacité hors-ligne supplémentaire.", en: "+25% additional offline efficiency." }, cost: 2500, type: 'offlineBonus', value: 0.25, requires: 'r_offline2' },
  { id: 'r_knowledge4', name: { fr: "Bibliothèque de poche", en: "Pocket Library" }, desc: { fr: "+100% de gain de Connaissances supplémentaire.", en: "+100% additional Knowledge gain." }, cost: 5000, type: 'knowledgeMult', value: 2, requires: 'r_knowledge3' },
  { id: 'r_weather3', name: { fr: "Dôme de brume", en: "Mist Dome" }, desc: { fr: "Réduit les effets négatifs de la météo de 80% au total.", en: "Reduces negative weather effects by 80% in total." }, cost: 15000, type: 'weatherShield', value: 0.2, requires: 'r_weather2' },
  { id: 'r_prod7', name: { fr: "Sol vivant", en: "Living Soil" }, desc: { fr: "+45% production globale supplémentaire.", en: "+45% additional global production." }, cost: 20000, type: 'prodMult', value: 1.45, requires: 'r_prod6' },
  { id: 'r_prod8', name: { fr: "Optimisation totale", en: "Total Optimization" }, desc: { fr: "+60% production globale supplémentaire.", en: "+60% additional global production." }, cost: 50000, type: 'prodMult', value: 1.6, requires: 'r_prod7' },
  { id: 'r_cheap4', name: { fr: "Contrat d'exclusivité", en: "Exclusive Contract" }, desc: { fr: "-8% supplémentaire sur le coût des compagnons.", en: "-8% additional on companion costs." }, cost: 45000, type: 'cheaper', value: 0.92, requires: 'r_cheap3' },
  { id: 'r_offline4', name: { fr: "Mare en autonomie", en: "Self-Sufficient Pond" }, desc: { fr: "+25% d'efficacité hors-ligne supplémentaire.", en: "+25% additional offline efficiency." }, cost: 45000, type: 'offlineBonus', value: 0.25, requires: 'r_offline3' },
  { id: 'r_knowledge5', name: { fr: "Archives secrètes", en: "Secret Archives" }, desc: { fr: "+150% de gain de Connaissances supplémentaire.", en: "+150% additional Knowledge gain." }, cost: 50000, type: 'knowledgeMult', value: 2.5, requires: 'r_knowledge4' },
  { id: 'r_prod9', name: { fr: "Écosystème parfait", en: "Perfect Ecosystem" }, desc: { fr: "+75% production globale supplémentaire.", en: "+75% additional global production." }, cost: 150000, type: 'prodMult', value: 1.75, requires: 'r_prod8' },
  { id: 'r_prod10', name: { fr: "Résonance chlorophyllienne totale", en: "Total Chlorophyll Resonance" }, desc: { fr: "+90% production globale supplémentaire.", en: "+90% additional global production." }, cost: 150000, type: 'prodMult', value: 1.9, requires: 'r_prod9' },
  { id: 'r_knowledge6', name: { fr: "Sagesse post-ascension", en: "Post-Ascension Wisdom" }, desc: { fr: "+175% de gain de Connaissances supplémentaire.", en: "+175% additional Knowledge gain." }, cost: 250000, type: 'knowledgeMult', value: 2.75, requires: 'r_knowledge5' },
  { id: 'r_cheap5', name: { fr: "Troc interstellaire", en: "Interstellar Barter" }, desc: { fr: "-10% supplémentaire sur le coût des compagnons.", en: "-10% additional on companion costs." }, cost: 1e+6, type: 'cheaper', value: 0.9, requires: 'r_cheap4' },
  { id: 'r_offline5', name: { fr: "Mare qui ne dort jamais", en: "Pond That Never Sleeps" }, desc: { fr: "+30% d'efficacité hors-ligne supplémentaire.", en: "+30% additional offline efficiency." }, cost: 1.2e+6, type: 'offlineBonus', value: 0.3, requires: 'r_offline4' },
  { id: 'r_knowledge7', name: { fr: "Mémoire de la Mare Originelle", en: "Memory of the Original Pond" }, desc: { fr: "+200% de gain de Connaissances supplémentaire.", en: "+200% additional Knowledge gain." }, cost: 3.5e+6, type: 'knowledgeMult', value: 3, requires: 'r_knowledge6' },
  // --- Fin de partie ---
  { id: 'r_prod11', name: { fr: "Photosynthèse stellaire", en: "Stellar Photosynthesis" }, desc: { fr: "+100% production globale supplémentaire.", en: "+100% additional global production." }, cost: 4e+6, type: 'prodMult', value: 2, requires: 'r_prod10' },
  { id: 'r_cheap6', name: { fr: "Bourse des mares", en: "Pond Exchange" }, desc: { fr: "-10% supplémentaire sur le coût des compagnons.", en: "-10% additional on companion costs." }, cost: 6e+6, type: 'cheaper', value: 0.9, requires: 'r_cheap5' },
  { id: 'r_offline6', name: { fr: "Rêves de la mare", en: "Pond Dreams" }, desc: { fr: "+30% d'efficacité hors-ligne supplémentaire.", en: "+30% additional offline efficiency." }, cost: 8e+6, type: 'offlineBonus', value: 0.3, requires: 'r_offline5' },
  { id: 'r_prod12', name: { fr: "Racines entre les mondes", en: "Roots Between Worlds" }, desc: { fr: "+120% production globale supplémentaire.", en: "+120% additional global production." }, cost: 8e+6, type: 'prodMult', value: 2.2, requires: 'r_prod11' },
  { id: 'r_cheap7', name: { fr: "Monnaie de nénuphar", en: "Lily Pad Currency" }, desc: { fr: "-12% supplémentaire sur le coût des compagnons.", en: "-12% additional on companion costs." }, cost: 9e+6, type: 'cheaper', value: 0.88, requires: 'r_cheap6' },
  { id: 'r_prod13', name: { fr: "Jardin sans fin", en: "Endless Garden" }, desc: { fr: "+150% production globale supplémentaire.", en: "+150% additional global production." }, cost: 1.3e+7, type: 'prodMult', value: 2.5, requires: 'r_prod12' },
];

// Recherches infinies : rachetables indéfiniment (coût croissant à chaque niveau, comme
// les bâtiments), pour que les Connaissances restent utiles même très loin dans la partie —
// c'est LE puits sans fond une fois l'arbre normal terminé.
const RESEARCH_INFINITE = [
  { id: 'ri_prod', name: { fr: 'Compost éternel', en: 'Eternal Compost' }, desc: { fr: '+2% production globale par niveau.', en: '+2% global production per level.' }, baseCost: 4.5e+6, growth: 1.4, type: 'prodMult', value: 1.02 },
    { id: 'ri_cheap', name: { fr: 'Marchandage éternel', en: 'Eternal Haggling' }, desc: { fr: '-0.5% sur le coût des compagnons par niveau.', en: '-0.5% on companion costs per level.' }, baseCost: 6e+6, growth: 1.4, type: 'cheaper', value: 0.995 },
  { id: 'ri_knowledge', name: { fr: 'Mémoire ancestrale', en: 'Ancestral Memory' }, desc: { fr: '+3% de gain de Connaissances par niveau.', en: '+3% Knowledge gain per level.' }, baseCost: 8e+6, growth: 1.45, type: 'knowledgeMult', value: 1.03 },
];

// ================= ASCENSION UPGRADES (Éclats Stellaires — ne reset JAMAIS, même par une nouvelle Ascension) =================
const ASCENSION_UPGRADES = [
  // --- Branche Production (comme avant) ---
  { id: 'as_prod1', name: { fr: 'Résonance stellaire', en: 'Stellar Resonance' }, desc: { fr: '+30% de production globale.', en: '+30% global production.' }, cost: 1, type: 'prodMult', value: 1.3, requires: null },
  { id: 'as_click1', name: { fr: 'Clic céleste', en: 'Celestial Click' }, desc: { fr: "+8% sur tout ce que rapporte un clic.", en: "+8% on everything a click earns." }, cost: 1, type: 'clickMult', value: 1.08, requires: null },
  { id: 'as_click2', name: { fr: 'Poigne stellaire', en: 'Stellar Grip' }, desc: { fr: "+12% sur tout ce que rapporte un clic.", en: "+12% on everything a click earns." }, cost: 2, type: 'clickMult', value: 1.12, requires: 'as_click1' },
  { id: 'as_knowledge1', name: { fr: 'Sagesse des étoiles', en: 'Wisdom of the Stars' }, desc: { fr: '+100% de gain de Connaissances.', en: '+100% Knowledge gain.' }, cost: 1, type: 'knowledgeMult', value: 2, requires: null },
  { id: 'as_knowledge2', name: { fr: 'Archives cosmiques', en: 'Cosmic Archives' }, desc: { fr: '+150% supplémentaire de gain de Connaissances.', en: 'An additional +150% Knowledge gain.' }, cost: 2, type: 'knowledgeMult', value: 2.5, requires: 'as_knowledge1' },
  { id: 'as_cheaper1', name: { fr: 'Commerce interstellaire', en: 'Interstellar Trade' }, desc: { fr: 'Compagnons encore 10% moins chers.', en: 'Companions another 10% cheaper.' }, cost: 2, type: 'cheaper', value: 0.9, requires: null },
  { id: 'as_offline1', name: { fr: 'Jardin autonome total', en: 'Fully Autonomous Garden' }, desc: { fr: 'Gains hors-ligne à 100%, cumulable avec les autres sources.', en: '100% offline gains, stacks with other sources.' }, cost: 2, type: 'offline', value: 1.0, requires: null },
  { id: 'as_prod2', name: { fr: 'Éclat de constellation', en: 'Constellation Shard' }, desc: { fr: '+50% de production globale supplémentaire.', en: '+50% additional global production.' }, cost: 3, type: 'prodMult', value: 1.5, requires: 'as_prod1' },
  { id: 'as_prod3', name: { fr: 'Aurore galactique', en: 'Galactic Aurora' }, desc: { fr: '+75% de production globale supplémentaire.', en: '+75% additional global production.' }, cost: 5, type: 'prodMult', value: 1.75, requires: 'as_prod2' },
  // --- Branche Snowball (accélère les cycles de Prestige/Ascension suivants) ---
  { id: 'as_seedBoost1', name: { fr: 'Fertilité stellaire', en: 'Stellar Fertility' }, desc: { fr: '+25% de Verdure "comptée" pour le calcul des Graines Cosmiques gagnées au Prestige.', en: '+25% Greenery "counted" for calculating Cosmic Seeds earned on Prestige.' }, cost: 2, type: 'prestigeSeedMult', value: 0.25, requires: null },
  { id: 'as_seedBoost2', name: { fr: 'Abondance cosmique', en: 'Cosmic Abundance' }, desc: { fr: '+35% supplémentaires de Verdure "comptée" pour le Prestige.', en: 'An additional +35% Greenery "counted" for Prestige.' }, cost: 4, type: 'prestigeSeedMult', value: 0.35, requires: 'as_seedBoost1' },
  { id: 'as_seedBoost3', name: { fr: 'Marée cosmique', en: 'Cosmic Tide' }, desc: { fr: '+50% supplémentaires de Verdure "comptée" pour le Prestige.', en: 'An additional +50% Greenery "counted" for Prestige.' }, cost: 6, type: 'prestigeSeedMult', value: 0.5, requires: 'as_seedBoost2' },
  { id: 'as_ascBoost1', name: { fr: 'Résonance galactique', en: 'Galactic Resonance' }, desc: { fr: '+25% de Graines "comptées" pour le calcul des Éclats gagnés à l\'Ascension.', en: '+25% Seeds "counted" for calculating Shards earned on Ascension.' }, cost: 3, type: 'ascensionSeedMult', value: 0.25, requires: null },
  { id: 'as_ascBoost2', name: { fr: 'Écho galactique', en: 'Galactic Echo' }, desc: { fr: '+35% supplémentaires de Graines "comptées" pour l\'Ascension.', en: 'An additional +35% Seeds "counted" for Ascension.' }, cost: 5, type: 'ascensionSeedMult', value: 0.35, requires: 'as_ascBoost1' },
  { id: 'as_synergy1', name: { fr: 'Toile mycélienne stellaire', en: 'Stellar Mycelial Web' }, desc: { fr: '+50% sur tous les effets de synergie entre compagnons.', en: '+50% on all building synergy effects.' }, cost: 2, type: 'synergyMult', value: 1.5, requires: null },
  { id: 'as_synergy2', name: { fr: 'Réseau stellaire ultime', en: 'Ultimate Stellar Web' }, desc: { fr: '+100% supplémentaire sur tous les effets de synergie.', en: 'An additional +100% on all synergy effects.' }, cost: 4, type: 'synergyMult', value: 2.0, requires: 'as_synergy1' },
  { id: 'as_startBonus1', name: { fr: 'Graine éternelle', en: 'Eternal Seed' }, desc: { fr: "Après un Prestige OU une Ascension, commence avec 3 min de ta production d'avant.", en: "After a Prestige OR an Ascension, start with 3 min of your previous production." }, cost: 3, type: 'startBonus', value: 3, requires: 'as_seedBoost1' },
  { id: 'as_clickCps1', name: { fr: 'Écho stellaire éternel', en: 'Eternal Stellar Echo' }, desc: { fr: "+0.05% de production/seconde ajoutée à chaque clic.", en: "+0.05% of production/second added to each click." }, cost: 3, type: 'clickCpsPercent', value: 0.0005, requires: 'as_click1' },
  // --- Fin de partie (aucun bonus de Graines ni d'Éclats : ils relanceraient l'emballement) ---
  { id: 'as_click3', name: { fr: 'Main des étoiles', en: 'Hand of the Stars' }, desc: { fr: "+20% sur tout ce que rapporte un clic.", en: "+20% on everything a click earns." }, cost: 20, type: 'clickMult', value: 1.2, requires: 'as_click2' },
  { id: 'as_prod4', name: { fr: 'Cœur de nébuleuse', en: 'Nebula Heart' }, desc: { fr: '+100% de production globale supplémentaire.', en: '+100% additional global production.' }, cost: 40, type: 'prodMult', value: 2, requires: 'as_prod3' },
  { id: 'as_knowledge3', name: { fr: "Bibliothèque de l'univers", en: 'Library of the Universe' }, desc: { fr: '+200% supplémentaire de gain de Connaissances.', en: 'An additional +200% Knowledge gain.' }, cost: 40, type: 'knowledgeMult', value: 3, requires: 'as_knowledge2' },
  { id: 'as_cheaper2', name: { fr: 'Marché galactique', en: 'Galactic Market' }, desc: { fr: 'Compagnons encore 15% moins chers.', en: 'Companions another 15% cheaper.' }, cost: 60, type: 'cheaper', value: 0.85, requires: 'as_cheaper1' },
  { id: 'as_prod5', name: { fr: 'Souffle cosmique', en: 'Cosmic Breath' }, desc: { fr: '+150% de production globale supplémentaire.', en: '+150% additional global production.' }, cost: 90, type: 'prodMult', value: 2.5, requires: 'as_prod4' },
  { id: 'as_prod6', name: { fr: 'Naissance d\'une étoile', en: 'Birth of a Star' }, desc: { fr: '+200% de production globale supplémentaire.', en: '+200% additional global production.' }, cost: 120, type: 'prodMult', value: 3, requires: 'as_prod5' },
];

// ================= PRESTIGE UPGRADES (Graines Cosmiques) =================
const PRESTIGE_UPGRADES = [
  { id: 'p_click1', name: { fr: 'Poigne ferme', en: 'Firm Grip' }, desc: { fr: "+5% sur tout ce que rapporte un clic.", en: "+5% on everything a click earns." }, cost: 1, type: 'clickMult', value: 1.05, requires: null },
  { id: 'p_prod1', name: { fr: 'Terreau enrichi', en: 'Enriched Soil' }, desc: { fr: '+25% production globale.', en: '+25% global production.' }, cost: 2, type: 'prodMult', value: 1.25, requires: null },
  { id: 'p_offline1', name: { fr: 'Arrosage automatique', en: 'Automatic Watering' }, desc: { fr: "Gains hors-ligne portés à 75%.", en: "Offline gains raised to 75%." }, cost: 2, type: 'offline', value: 0.75, requires: null },
  { id: 'p_click2', name: { fr: 'Binette légendaire', en: 'Legendary Hand Hoe' }, desc: { fr: "+8% sur tout ce que rapporte un clic.", en: "+8% on everything a click earns." }, cost: 4, type: 'clickMult', value: 1.08, requires: 'p_click1' },
  { id: 'p_prod2', name: { fr: 'Symbiose fongique', en: 'Fungal Symbiosis' }, desc: { fr: '+50% production globale supplémentaire.', en: '+50% additional global production.' }, cost: 6, type: 'prodMult', value: 1.5, requires: 'p_prod1' },
  { id: 'p_offline2', name: { fr: 'Serre autonome totale', en: 'Fully Autonomous Greenhouse' }, desc: { fr: 'Gains hors-ligne portés à 100%.', en: 'Offline gains raised to 100%.' }, cost: 7, type: 'offline', value: 1.0, requires: 'p_offline1' },
  { id: 'p_startBonus', name: { fr: 'Graine mère', en: 'Mother Seed' }, desc: { fr: "Après un Prestige, commence avec 1 min de ta production d'avant.", en: "After a Prestige, start with 1 min of your previous production." }, cost: 8, type: 'startBonus', value: 1, requires: null },
  { id: 'p_prod3', name: { fr: 'Bénédiction de Gaïa', en: "Gaia's Blessing" }, desc: { fr: '+100% production globale supplémentaire.', en: '+100% additional global production.' }, cost: 13, type: 'prodMult', value: 2, requires: 'p_prod2' },
  { id: 'p_prod4', name: { fr: 'Chant des racines', en: 'Song of the Roots' }, desc: { fr: '+75% production globale supplémentaire.', en: '+75% additional global production.' }, cost: 23, type: 'prodMult', value: 1.75, requires: 'p_prod3' },
  { id: 'p_cheaper', name: { fr: 'Négociation en gros', en: 'Bulk Negotiation' }, desc: { fr: 'Compagnons 10% moins chers.', en: 'Companions 10% cheaper.' }, cost: 10, type: 'cheaper', value: 0.9, requires: null },
  { id: 'p_cheaper2', name: { fr: 'Grossiste attitré', en: 'Regular Wholesaler' }, desc: { fr: '-10% supplémentaire sur le prix des compagnons.', en: 'An additional -10% on companion prices.' }, cost: 15, type: 'cheaper', value: 0.9, requires: 'p_cheaper' },
  { id: 'p_synergyBoost', name: { fr: 'Réseau mycélien', en: 'Mycelial Network' }, desc: { fr: '+50% sur les effets de synergie.', en: '+50% on synergy effects.' }, cost: 17, type: 'synergyMult', value: 1.5, requires: 'p_prod3' },
  { id: 'p_synergyBoost2', name: { fr: 'Toile racinaire', en: 'Root Web' }, desc: { fr: '+100% supplémentaire sur les effets de synergie.', en: 'An additional +100% on synergy effects.' }, cost: 23, type: 'synergyMult', value: 2.0, requires: 'p_synergyBoost' },
  { id: 'p_questBoost', name: { fr: 'Journal du jardinier', en: "Gardener's Journal" }, desc: { fr: '+50% de récompenses de quêtes.', en: '+50% quest rewards.' }, cost: 7, type: 'questMult', value: 1.5, requires: null },
  { id: 'p_questBoost2', name: { fr: 'Registre de quêtes', en: 'Quest Ledger' }, desc: { fr: '+100% supplémentaire de récompenses de quêtes.', en: 'An additional +100% quest rewards.' }, cost: 10, type: 'questMult', value: 2.0, requires: 'p_questBoost' },
  { id: 'p_weatherShield', name: { fr: 'Dôme climatique', en: 'Climate Dome' }, desc: { fr: 'Effets négatifs de météo réduits de moitié.', en: 'Negative weather effects halved.' }, cost: 12, type: 'weatherShield', value: 0.5, requires: null },
  { id: 'p_uniqueDiscount', name: { fr: 'Réseau de fournisseurs', en: 'Supplier Network' }, desc: { fr: '-15% sur le prix des Bâtiments et du Spécial.', en: '-15% on Buildings and Special prices.' }, cost: 13, type: 'uniqueDiscount', value: 0.85, requires: null },
  { id: 'p_knowledgeBoost', name: { fr: 'Bibliothèque du jardin', en: 'Garden Library' }, desc: { fr: '+100% de gain de Connaissances.', en: '+100% Knowledge gain.' }, cost: 6, type: 'knowledgeMult', value: 2, requires: null },
  { id: 'p_knowledgeBoost2', name: { fr: 'Grimoire du compost', en: 'Compost Grimoire' }, desc: { fr: '+150% supplémentaire de gain de Connaissances.', en: 'An additional +150% Knowledge gain.' }, cost: 10, type: 'knowledgeMult', value: 2.5, requires: 'p_knowledgeBoost' },
  { id: 'p_click3', name: { fr: 'Doigts de lumière', en: 'Fingers of Light' }, desc: { fr: "+10% sur tout ce que rapporte un clic.", en: "+10% on everything a click earns." }, cost: 20, type: 'clickMult', value: 1.1, requires: 'p_click2' },
  { id: 'p_click4', name: { fr: 'Étreinte de la mare', en: "Pond's Embrace" }, desc: { fr: "+12% sur tout ce que rapporte un clic.", en: "+12% on everything a click earns." }, cost: 25, type: 'clickMult', value: 1.12, requires: 'p_click3' },
  { id: 'p_clickCps1', name: { fr: 'Résonance cosmique', en: 'Cosmic Resonance' }, desc: { fr: "+0.05% de production/seconde ajoutée à chaque clic.", en: "+0.05% of production/second added to each click." }, cost: 10, type: 'clickCpsPercent', value: 0.0005, requires: null },
  { id: 'p_clickCps2', name: { fr: 'Écho stellaire', en: 'Stellar Echo' }, desc: { fr: "+0.075% supplémentaire de production/seconde ajoutée à chaque clic.", en: "An additional +0.075% of production/second added to each click." }, cost: 20, type: 'clickCpsPercent', value: 0.00075, requires: 'p_clickCps1' },
];

