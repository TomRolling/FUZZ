# Tests de FUZZ

Tests automatiques du jeu (`dist/index.html`, qui charge les fichiers de `dist/jeu/`), lancés dans un navigateur par Playwright.

```bash
cd tests
npm install          # une fois : installe Playwright
npx playwright install chromium   # une fois : navigateur de test
bash tout.sh        # toute la suite (environ 15 min), resultat par test dans sortie-<test>.txt
node test-fluidite.js   # un seul test
```

Deux verifications sortent du lot :

- `scan-traduction.js` lit le source et signale tout texte francais ecrit en dur, hors des tables
  bilingues (il ne lance pas de navigateur) ;
- `test-web.js` sert `dist/` en http et verifie que la version web demarre, enregistre son
  service worker et se recharge hors ligne ;
- `audit-chevauchements.js` verifie que chaque element de l'ecran principal a sa place : aucun
  recouvrement (etat le plus charge, cinq tailles de fenetre et le zoom de l'interface), et aucun
  element immobile qu'une animation voisine ferait passer sur un calque a part puis revenir, ce que
  le joueur voit comme une image qui « se pixellise puis redevient nette ». Il lit l'arbre des
  calques de Chromium (CDP LayerTree) et suit chaque element par une signature stable (chaine des
  id et data-row-id), pas par son numero interne : un element reconstruit (icone de capacite, ligne
  du magasin) reste le meme pour l'audit. `AUDIT_CSS='...'` injecte des styles pour rejouer un
  ancien defaut et verifier que l'audit le voit toujours (temoin negatif), par exemple
  `.shopFloatBtn, .floatingButtonsTopRight { will-change: auto !important; } .comboBadge { bottom: 14% !important; }`
  ou `.abilityBtn::before { z-index: auto !important; will-change: auto !important; }`.

Outils partages (`commun.js`) : `filePath`, `attendreDemarrage(page)`, `chargerPartie(page, etat, options)`
(partie preparee puis rechargee : onglets deja presentes, automatisations coupees d'apres AUTOMATIONS,
sauvegarde de sortie neutralisee) et `finirScene(page)`. Un nouveau test s'en sert au lieu de recopier ces
blocs : un changement du demarrage ou de la sauvegarde se corrige alors a un seul endroit.

Quatre tests servent de filet quand on AJOUTE quelque chose au jeu : ils lisent les tables du jeu,
donc un objet, un onglet ou un champ ajoute est verifie d'office, sans toucher au test.

- `test-contrats.js` : les pannes silencieuses d'un ajout. Cle passee a `tr()` absente de UI_STRINGS,
  categorie de repliques de Papi inexistante (il se tait), champ `state.xxx` absent de defaultState()
  (les anciennes sauvegardes ne l'initialisent pas), type d'effet qu'aucun code ne lit, onglet sans
  panneau ni presentation, condition de deblocage qui plante, image introuvable.
- `test-achats-tables.js` : chaque objet de chaque table achete par un clic sur sa ligne. Prix paye =
  prix affiche, rien a credit, un EFFET mesurable (sur ce que le jeu utilise vraiment, plafonds
  compris : il a trouve neuf ameliorations meteo et hors-ligne qui s'achetaient pour rien), toujours
  la apres rechargement.
- `test-anciennes-sauvegardes.js` : une partie de chaque version publiee (`sauvegardes-anciennes/`)
  se reprend sans rien perdre. Apres chaque version publiee, ajouter la sienne :
  `node generer-sauvegardes-anciennes.js v0.X.Y`, puis committer le fichier produit.
- `test-gestes-joueur.js` : les gestes que rien d'autre n'exercait (choix de la langue, achats x10 et
  MAX, export puis import, restauration, chat, volume) et l'appli native simulee (`window.__TAURI__` :
  fichiers, presse-papiers, lien du signalement, mise a jour, Quitter).

`TEMOIN=1 node test-contrats.js` (et `test-anciennes-sauvegardes.js`) injecte une panne de chaque sorte :
chaque verification doit alors echouer. C'est la preuve qu'un test vert voit encore quelque chose.

Couverture : `COUVERTURE=1 bash tout.sh`, puis `node couverture.js`, liste les fonctions du jeu que la
suite n'execute jamais. C'est la carte des trous a combler par un test. Limite : une fonction qui fait
recharger la page par le jeu (import, restauration) peut y figurer a tort.

Banc d'equilibrage (un bot joue sous horloge virtuelle) :

```bash
node banc.js ./equilibre-jeu-paliers.js attentif 42 150   # debut de partie
node banc.js ./equilibre-fin.js attentif 42 600           # fin de partie, environ 2 min
```

Toujours les DEUX : le contenu est prevu pour environ trois semaines, donc des objets jamais achetes
au bout de 150 h sont normaux. Juger la fin de partie sur 150 h a fait casser la 0.7.0 (tout le
contenu fini en 6,6 jours, emballement des Ascensions), ce que seul le banc de 600 h montrait.
