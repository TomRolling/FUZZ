# 🌱 Jardin Idle — Version native (Tauri)

Ce dossier enveloppe ton jeu (`dist/index.html`, inchangé côté logique) dans une vraie
application installable — `.exe` sur Windows, `.app`/`.dmg` sur macOS, `.deb`/`.AppImage`
sur Linux. Tauri ouvre juste une fenêtre native qui charge ton fichier HTML ; aucune
réécriture du jeu n'a été nécessaire.

## Pré-requis (à installer une seule fois sur ta machine)

1. **Node.js** (v18+) — tu l'as sûrement déjà.
2. **Rust** — via [rustup.rs](https://rustup.rs) (`curl https://sh.rustup.rs -sSf | sh` sur Mac/Linux,
   ou l'installeur `.exe` sur Windows).
3. Dépendances système selon l'OS où tu compiles (nécessaires seulement pour builder,
   pas pour faire tourner l'app une fois compilée) :
   - **Windows** : "Desktop development with C++" via Visual Studio Build Tools (l'installeur Rust te le proposera).
   - **macOS** : Xcode Command Line Tools (`xcode-select --install`).
   - **Linux** : `libwebkit2gtk-4.1-dev`, `libssl-dev`, `librsvg2-dev`, `patchelf`, `build-essential`
     (sur Debian/Ubuntu : `sudo apt install libwebkit2gtk-4.1-dev libssl-dev librsvg2-dev patchelf build-essential curl wget file libxdo-dev libayatana-appindicator3-dev`).

## Étapes de build

```bash
cd jardin-idle-tauri

# 1. Installe le CLI Tauri (une seule fois)
npm install

# 2. (Recommandé) Régénère toutes les icônes proprement depuis la source haute résolution
#    — ça génère automatiquement .icns (Mac), .ico (Windows) et tous les PNG requis.
#    J'ai déjà mis des icônes de base dans src-tauri/icons/, mais cette commande
#    les remplace par une génération plus complète et fiable (notamment icon.icns pour Mac).
npx tauri icon app-icon-source.png

# 3. Lancer en mode développement (fenêtre native, hot-reload pas nécessaire ici
#    car le jeu est un fichier statique, mais utile pour vérifier que tout s'affiche bien)
npm run tauri dev

# 4. Builder l'installeur final pour TON OS actuel
npm run tauri build
```

Le fichier installable apparaît dans :
`src-tauri/target/release/bundle/` (sous-dossier `msi/`, `nsis/`, `dmg/`, `deb/`,
`appimage/` selon ton OS).

## Builder pour Windows + macOS + Linux automatiquement (GitHub Actions)

Le fichier `.github/workflows/build.yml` est déjà prêt. Pour l'utiliser :

1. Pousse ce dossier dans un dépôt GitHub (public ou privé, peu importe).
2. Crée un tag de version et pousse-le :
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. Va dans l'onglet **Actions** de ton dépôt GitHub : le workflow se lance tout seul,
   build en parallèle sur 3 runners (Windows/macOS/Linux), puis crée une **Release
   GitHub en brouillon** avec les 3 installeurs (`.msi`/`.nsis`, `.dmg`, `.deb`+`.AppImage`)
   déjà attachés. Il ne te reste qu'à relire et publier la release.
4. Tu peux aussi le lancer manuellement sans tag, via le bouton "Run workflow" dans
   l'onglet Actions (déclenchement `workflow_dispatch`) — dans ce cas il build mais
   ne publie pas de release, pratique pour juste vérifier que ça compile.

Aucune installation de Rust/Node nécessaire sur ta machine pour cette méthode — tout
se passe sur les serveurs GitHub, gratuit pour les dépôts publics (et un quota gratuit
généreux pour les dépôts privés).

## Mises à jour automatiques (bouton "Vérifier" dans le jeu)

L'app peut désormais se mettre à jour toute seule : à chaque nouvelle release (tag `vX.X.X`),
elle détecte la nouvelle version, la télécharge, l'installe et redémarre — plus besoin de
désinstaller/réinstaller manuellement.

**Obligatoire avant de builder une release avec l'updater actif** : Tauri exige que chaque
mise à jour soit signée cryptographiquement (sécurité : empêche quiconque d'injecter un faux
exécutable via une future mise à jour). Ça se fait **une seule fois**, chez toi :

### 1. Génère ta paire de clés

```bash
cd jardin-idle-tauri
npx tauri signer generate -w ~/.tauri/jardin-idle.key
```

Ça te demande un mot de passe pour protéger la clé (choisis-en un, note-le). Le terminal
affiche ensuite une **clé publique** (un long texte qui commence par `dW50cnVzdGVk...` ou
similaire) — copie-la.

### 2. Colle la clé publique dans la config

Ouvre `src-tauri/tauri.conf.json`, trouve la ligne :
```json
"pubkey": "REMPLACE_MOI_PAR_TA_CLE_PUBLIQUE_GENEREE_LOCALEMENT"
```
et remplace par ta vraie clé publique copiée à l'étape 1.

### 3. Ajoute la clé privée comme secret GitHub (jamais dans le code !)

Sur `github.com/TomRolling/IdleJardin` → **Settings** → **Secrets and variables** → **Actions**
→ **New repository secret**, crée ces deux secrets :

| Nom | Valeur |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Le contenu du fichier `~/.tauri/jardin-idle.key` (ouvre-le avec un éditeur de texte et copie tout) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Le mot de passe choisi à l'étape 1 |

### 4. Commit, push, tag comme d'habitude

Une fois ces 3 étapes faites (une seule fois, pas à refaire à chaque version), chaque nouveau
tag `vX.X.X` poussé génère automatiquement un `latest.json` signé, attaché à la Release. Le
bouton "Vérifier" dans l'app (onglet Options) le détecte et propose l'installation.

**Pour sortir une nouvelle version** : pense à incrémenter le numéro de version dans
`src-tauri/tauri.conf.json` (champ `"version"`) avant de tagger — c'est ce numéro que
l'updater compare pour savoir s'il y a du neuf.

⚠️ Ne perds pas le fichier `~/.tauri/jardin-idle.key` ni le mot de passe — sans eux, impossible
de publier une nouvelle mise à jour reconnue par les installations existantes (il faudrait
générer une nouvelle paire de clés, ce qui casserait la mise à jour automatique pour tout le
monde une fois).

## Sauvegarde du jeu dans l'app native

Ton système actuel utilise `localStorage`, qui **fonctionne nativement dans Tauri**
sans aucune modification — chaque installation de l'app a son propre stockage local
persistant, comme dans un navigateur. Les boutons Export/Import/Partager du jeu
fonctionnent aussi tels quels.

## Ce qui a été volontairement laissé de côté

- `sw.js` (service worker) n'est pas copié dans `dist/` : il ne sert que pour le mode
  PWA installée via navigateur (cache hors-ligne HTTPS), ce qui devient inutile une
  fois que l'app est un vrai exécutable natif. Le `index.html` détecte ça tout seul
  (il ne tente d'enregistrer le service worker que si servi en `https:` ou
  `localhost`) donc rien à changer.
- Pas d'icône `.icns` pré-générée (nécessite un Mac ou l'étape 2 ci-dessus) — les
  PNG et le `.ico` Windows sont déjà prêts si tu veux tester sans attendre.
