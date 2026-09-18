# Tests de FUZZ

Tests automatiques du jeu (`dist/index.html`), lancés dans un navigateur par Playwright.

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
  service worker et se recharge hors ligne.

Banc d'equilibrage (un bot joue sous horloge virtuelle) :

```bash
node banc.js ./equilibre-jeu-paliers.js attentif 42 150
```
