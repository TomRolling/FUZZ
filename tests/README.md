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

Banc d'equilibrage (un bot joue sous horloge virtuelle) :

```bash
node banc.js ./equilibre-jeu-paliers.js attentif 42 150   # debut de partie
node banc.js ./equilibre-fin.js attentif 42 600           # fin de partie, environ 2 min
```

Toujours les DEUX : le contenu est prevu pour environ trois semaines, donc des objets jamais achetes
au bout de 150 h sont normaux. Juger la fin de partie sur 150 h a fait casser la 0.7.0 (tout le
contenu fini en 6,6 jours, emballement des Ascensions), ce que seul le banc de 600 h montrait.
