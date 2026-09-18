# FUZZ — dossier pour une page de portfolio

Tout ce qu'il faut pour présenter FUZZ sur un portfolio : textes prêts à coller, captures,
liens, chiffres et points techniques. Les captures sont dans ce dossier, en 2560 × 1640 (rapport
1280 × 820, donc réductibles sans rogner).

---

## En une phrase

FUZZ est un jeu de jardinage incrémental jouable dans le navigateur ou en application de bureau,
où l'on part d'un terrain vague et de deux clics pour finir par terraformer des planètes, sous le
commentaire permanent d'un grand-père peu impressionné.

## Liens

| Quoi | Où |
|---|---|
| Jouer tout de suite | https://tomrolling.github.io/FUZZ/ |
| Code source | https://github.com/TomRolling/FUZZ |
| Télécharger (Windows, macOS, Linux) | https://github.com/TomRolling/FUZZ/releases |

## Crédits

- **Développement : SeiuZ**
- **Dessins, musiques et histoire : Anko**

## Textes prêts à coller

**Version courte (carte de projet, 2 lignes)**

> Jeu de jardinage incrémental, jouable dans le navigateur ou en application native.
> Trois semaines de contenu, deux langues, et un grand-père qui commente tout ce que vous faites.

**Version moyenne (un paragraphe)**

> FUZZ est un jeu incrémental où l'on hérite d'un terrain vague et d'un grand-père qui a mieux à
> faire. On désherbe à la main, puis on embauche des têtards, des escargots de course et, plus
> tard, des esprits de mare infinie. Le jeu se joue autant fermé qu'ouvert : la production tourne
> sans vous, et on revient pour dépenser. Trente-quatre compagnons, deux monnaies de renaissance,
> des défis, des familiers, neuf événements saisonniers, français et anglais. Jouable dans le
> navigateur, installable en application sur Windows, macOS et Linux.

**Version longue (trois paragraphes)**

> **FUZZ** — jeu incrémental, 2026.
>
> Papi Feuillage a « mystérieusement » hérité d'un terrain vague, et le confie à son petit-fils au
> chômage. On commence en cliquant sur de la mauvaise herbe ; deux cents clics plus tard, le
> magasin ouvre, et à partir de là le jardin travaille tout seul. Trente-quatre compagnons se
> succèdent, du cousin têtard jusqu'à l'Esprit de la Mare Infinie, chacun avec son prix, son
> rendement et sa réplique. Deux systèmes de renaissance se superposent : le Prestige, qui remet
> le jardin à zéro contre des Graines Cosmiques, et l'Ascension, qui efface jusqu'aux Graines
> contre des Éclats Stellaires. Compter environ quinze heures jusqu'au premier Prestige, trois
> jours et demi jusqu'à la première Ascension, et près de trois semaines pour posséder tout le
> contenu.
>
> Techniquement, le jeu entier tient dans un seul fichier HTML : pas de framework, pas de
> bundler, pas d'étape de compilation. La même page sert de site jouable, d'application
> installable hors ligne, et de contenu pour une fenêtre native Tauri. Tout est bilingue, la
> progression est sauvegardée localement avec des copies de secours quotidiennes, et l'interface
> se met à l'échelle pour rendre exactement la même image quelle que soit la taille de la fenêtre.
>
> L'équilibrage n'a pas été fait au jugé : un banc de test fait jouer un bot sous horloge
> virtuelle pendant des semaines simulées et sort le moment de chaque déblocage, les temps morts
> et la part de chaque source de revenus. Quarante-quatre tests automatiques pilotent le vrai jeu
> dans un navigateur à chaque changement.

**Version anglaise courte** (le jeu est bilingue, pratique si le portfolio l'est aussi)

> An incremental gardening game: start with a vacant lot and two clicks, end up terraforming
> planets, with a thoroughly unimpressed grandfather commenting throughout. Playable in the
> browser, installable on Windows, macOS and Linux.

## Chiffres à citer

- 34 compagnons, 4 monnaies (Verdure, Connaissances, Graines Cosmiques, Éclats Stellaires)
- 9 onglets de magasin, 8 défis, 5 familiers, 9 événements saisonniers
- ~3 semaines de contenu, calibrées au banc de test
- 2 langues, 3 systèmes d'exploitation, 1 seul fichier de jeu
- 44 tests automatiques, tous verts

## Points techniques qui valent d'être mis en avant

- **Un seul fichier.** `dist/index.html` contient le HTML, le CSS et le JavaScript. Aucune
  dépendance, aucun build. Le même fichier sert de site web, de PWA et d'application Tauri.
- **Mise à l'échelle proportionnelle.** Le jeu est dessiné à une résolution de référence puis mis
  à l'échelle d'un bloc : l'image est identique en fenêtré et en plein écran, à la taille près.
- **Jouable hors ligne.** Service worker : la coquille est mise en cache à l'installation, le
  reste à l'usage, et la page part sur le réseau d'abord pour que les mises à jour arrivent.
- **Équilibrage mesuré.** Un bot joue sous horloge virtuelle et produit un rapport de progression ;
  c'est ce qui a servi à corriger un emballement de fin de partie et à ramener la part du clic de
  50 % à moins de 22 % des revenus.
- **Bilingue vérifié par machine.** Un scan statique repère tout texte français écrit en dur, et
  un test joue la partie en anglais pour signaler ce qui s'affiche encore en français.
- **Livraison automatisée.** Un tag pousse la construction Windows / macOS / Linux et une release
  en brouillon avec mise à jour automatique signée ; un push republie la version web.

## Les captures

Toutes en 2560 × 1640. Ordre conseillé : 01, 02, 08, 07, puis le reste selon la place.

| Fichier | Ce qu'on voit | Légende proposée | Texte alternatif |
|---|---|---|---|
| `01-jeu.png` | L'écran principal, une herbe dorée, les capacités en recharge à gauche | « Le jardin travaille tout seul ; on revient pour dépenser. » | Écran principal de FUZZ : compteurs de production, capacités en recharge et mauvaise herbe dorée |
| `02-magasin.png` | Le magasin, onglet Production, Papi qui commente | « Trente-quatre compagnons, chacun avec son prix et sa réplique. » | Le magasin de FUZZ, liste des compagnons à acheter |
| `03-recherche.png` | L'arbre de recherche | « La Recherche se paie en Connaissances, qui tombent même quand on ne joue pas. » | Onglet Recherche de FUZZ |
| `04-ascension.png` | L'onglet Ascension | « Deux systèmes de renaissance empilés : Prestige, puis Ascension. » | Onglet Ascension de FUZZ, améliorations en Éclats Stellaires |
| `05-familiers.png` | Les cinq familiers | « Un familier actif à la fois, à faire monter en niveau. » | Onglet Familiers de FUZZ |
| `06-succes.png` | La grille des succès | « Des succès qui donnent un vrai bonus, pas seulement une image. » | Grille des succès de FUZZ |
| `07-papi.png` | Papi qui commente en pleine partie | « Papi Feuillage passe, commente, et repart. » | Papi Feuillage, personnage de FUZZ, dans une bulle de dialogue |
| `08-halloween.png` | L'événement Halloween | « Neuf événements saisonniers changent le décor au fil de l'année. » | FUZZ pendant l'événement Halloween, chauves-souris et citrouille |

## Comment intégrer le jeu dans la page

**Conseillé : un bouton qui ouvre le jeu dans un nouvel onglet**, avec `01-jeu.png` en aperçu.
C'est le plus sûr et le plus lisible sur mobile.

```html
<a href="https://tomrolling.github.io/FUZZ/" target="_blank" rel="noopener">
  <img src="captures/01-jeu.png" alt="Écran principal de FUZZ" width="1280">
  Jouer à FUZZ
</a>
```

**Possible mais à connaître : l'iframe.**

```html
<iframe src="https://tomrolling.github.io/FUZZ/" width="1280" height="820"
        style="border:0;max-width:100%" title="FUZZ"></iframe>
```

Les navigateurs cloisonnent le stockage d'une iframe venant d'un autre domaine : la partie
sauvegardée dans le portfolio sera différente de celle du site du jeu, et Safari en réglages
stricts peut bloquer la sauvegarde. Si l'iframe est retenue, prévoir en plus un lien
« Ouvrir en plein écran ».

## À ne pas annoncer

Deux chantiers sont encore en cours ; mieux vaut ne pas les mettre en avant :

- certains objets de fin de partie ont des images générées automatiquement, en attendant les
  illustrations définitives ;
- la colonne gauche du magasin attend son illustration de Papi et de sa boutique.
