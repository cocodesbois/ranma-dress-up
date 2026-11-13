# Architecture de Ranma Dress-up Studio

L'application est statique, en modules ES JavaScript, servie et construite par
Vite. Elle n'a ni serveur applicatif ni stockage persistant. Le catalogue et les
presets sont des données versionnées ; le look courant vit uniquement en mémoire.

## Structure et responsabilités

| Module                                | Rôle et dépendances                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.js`                         | Point d'entrée chargé par `index.html` : récupère le DOM, construit les dépendances et démarre le bootstrap. Aucun export public.                                       |
| `src/types.js`                        | Contrats JSDoc partagés, importés uniquement dans les commentaires de types. Aucune valeur métier à l'exécution.                                                        |
| `src/data/sprite-catalog.js`          | Export par défaut du `Catalog` : fond, personnage, catégories, paires incompatibles, `Item` et `Outfit`.                                                                |
| `src/data/sprite-manifest.js`         | Export par défaut du manifest généré : dimensions du document, URLs WebP et offsets de recadrage par clé PNG.                                                           |
| `src/core/catalog-model.js`           | Valide et résout les presets, y compris les paires de catégories incompatibles ; fournit les recherches par ID, look, preset par défaut et exclusions. Sans DOM.        |
| `src/core/state-store.js`             | État synchrone isolé : `Look`, catégorie active, panneau mobile, disponibilité du preview et jetons de sélection. Sans DOM ni rendu.                                    |
| `src/render/image-loader.js`          | Deux caches distincts (chargements en cours, images décodées), résolution PNG → WebP par le manifest, préchargement adjacent et en arrière-plan.                        |
| `src/render/canvas-renderer.js`       | Composition des calques, ombre, redimensionnement selon la densité de pixels et export PNG à taille fixe. Lit le store via des getters et ne charge pas d'images.       |
| `src/ui/outfit-controller.js`         | Orchestre sélections, exclusivités, chargements, mutations du store et rafraîchissement de la présentation.                                                             |
| `src/ui/wardrobe-ui.js`               | Onglets et cartes accessibles, miniatures statiques et fallback canvas, avis avec reprise si des sprites n'ont pas pu être chargés ; délègue les actions au contrôleur. |
| `src/ui/status-controller.js`         | Texte de statut et activation/désactivation des contrôles de presets.                                                                                                   |
| `src/ui/wardrobe-panel-controller.js` | Panneau mobile, attributs de dialogue, focus, Échap et navigation Tab.                                                                                                  |
| `src/app-bootstrap.js`                | Branche les événements, observe le canvas, lance le chargement initial et déclenche le téléchargement PNG (export à taille fixe).                                       |
| `src/styles/main.css`                 | Présentation responsive ; le seuil mobile utilisé par les contrôleurs est de 720 px.                                                                                    |

## Flux des données

```text
sprite-catalog.js ──→ catalog-model ──→ presets validés + look par défaut
                                               │
                                               ▼
                                           state-store
                                               ▲
DOM ──→ bootstrap / wardrobe-ui ──→ controllers ──┤
                                      │        │ getters
                                      ▼        ▼
                                image-loader   canvas-renderer ──→ canvas
                                      ▲              ▲
                                      └── manifest ──┘
controllers ──→ wardrobe-ui / status-controller ──→ DOM
```

Le câblage se fait dans `main.js`, sans globales applicatives `window.RanmaDressUp*`.
Les factories reçoivent leurs collaborateurs ; les modules de présentation
utilisent encore les API globales du navigateur. Les tests injectent des doubles
pour le DOM, les images ou le contexte canvas sans lancer de navigateur ; les tests
de présentation (garde-robe, téléchargement) s'exécutent dans jsdom.

### Démarrage

1. Le modèle transforme chaque `Outfit` en preset avec ses objets `Item` résolus et
   son `Look` complet (catégorie → ID ou `null`). Il vérifie les références,
   les catégories, la présence de cheveux et d'au moins un vêtement.
2. `main.js` choisit le preset `005`, ou le premier disponible, et copie son look
   dans un nouveau store.
3. Le bootstrap branche les contrôles et les observateurs de taille/densité, puis
   appelle `startApp()`.
4. Le contrôleur charge le fond, le personnage et les pièces sélectionnées, qui sont
   requis, puis le reste de la catégorie initiale `tops`, facultatif. Il construit les options et les cartes, marque le
   preview prêt, dessine puis précharge les presets voisins et les autres pièces.

### Sélections et concurrence

- Une sélection de catégorie charge ses images avant de reconstruire les cartes. Un
  échec ne vide pas la grille : les cartes dont le sprite est décodé sont affichées,
  un avis avec un bouton « Try again » remplace les autres et le statut indique
  combien d'images ont échoué. Une réponse devenue obsolète ne remplace pas la
  catégorie active et ne signale aucune erreur.
- Une sélection manuelle applique les exclusivités déclarées dans le catalogue
  (`incompatibleCategories`), modifie le store, synchronise le preset reconnu et
  redessine. Le store n'applique pas de règles métier lui-même.
- Une sélection de preset obtient un jeton monotone du store. Après chargement,
  seul le jeton encore courant peut appliquer le look et réactiver les contrôles.
  Les sélections manuelles et Reset invalident également les requêtes en cours.
- Deux caches distincts conservent les chargements en cours et les images décodées.
  `loadImage()` renvoie toujours une promesse. `getSprite()` ne renvoie un sprite
  que lorsque l'image est décodée. `getMissingSourcesForPreset()` compte aussi comme
  manquantes les images encore en cours de chargement : une sélection de preset
  attend alors leur fin au lieu de dessiner trop tôt. Un échec est retiré du cache
  pour permettre une nouvelle tentative.
- Au démarrage, le fond, le personnage et le look courant sont requis : leur échec
  est signalé et l'application ne démarre pas. Les autres pièces de la catégorie
  initiale sont facultatives et l'avis de reprise de la garde-robe s'applique.
- Les erreurs de sélection/démarrage sont transmises au statut et à la console ;
  les erreurs de préchargement sont journalisées sans bloquer la sélection.

## Contrats et invariants

Les typedefs `Catalog`, `Item`, `Outfit` et `Look` sont définis dans `src/types.js`,
avec les contrats auxiliaires `Placement`, `Crop`, `Layer`, `Category`,
`OutfitPreset`, `SpriteManifest` et `Sprite`.

- `Outfit` est une définition de preset : ses clés omises sont des catégories vides.
- `Look` est la sélection courante : les catégories vides sont représentées par
  `null`. Les IDs de catégories restent des chaînes afin que le catalogue soit la
  source de vérité ; le modèle et les tests vérifient les références à l'exécution.
- Le store copie le look initial et les looks de remplacement. `getOutfit()` expose
  la carte courante, à traiter en lecture seule par ses consommateurs.
- Les cheveux sont obligatoires dans les presets ; leur catégorie ne propose pas
  de bouton None.
- `Catalog.incompatibleCategories` liste des paires de catégories qui ne se portent
  pas ensemble. Une paire vaut dans les deux sens, le modèle refuse un preset qui
  combine les deux catégories et le contrôleur applique les exclusions à la
  sélection manuelle. Elles et l'ordre des calques sont détaillés dans
  [les contraintes techniques](../.github/technical-constraints.md).
  Les robes restent au-dessus des chaussures.

## Assets et géométrie

Les exports Photoshop de même taille restent intacts dans `assets/sprites/`.
Leur chemin `assets/sprites/<nom>.png` est une clé stable du catalogue et du
manifest, pas l'URL chargée par le navigateur.

`scripts/optimize-sprites.py` produit les WebP sous `public/images/optimized/`
et le manifest sous `src/data/`. Le script écrit aussi l'en-tête JSDoc du manifest :
ne pas modifier ce fichier généré manuellement. Les miniatures sont produites dans
`public/images/thumbnails/` par les scripts de préparation ou de génération.
Vite copie `public/` dans `dist/` et utilise la base relative `./` ; les URLs du
manifest commencent donc par `images/`, sans préfixe `public/`.

Le canvas représente tout le document Photoshop. Les placements, recadrages des
miniatures et offsets du manifest sont en pixels du document ; l'échelle du WebP
ne change pas l'alignement. Le fond n'est jamais recadré. Le renderer compose le
fond, l'ombre, le personnage et les vêtements dans un ordre fixe, puis adapte la
résolution du canvas à ses dimensions CSS et à `devicePixelRatio`.

Le téléchargement n'enregistre pas le canvas visible, dont la taille dépend de la
fenêtre et de la densité d'écran. `exportPreview()` redessine le look, avec la même
composition, sur un canvas hors écran de largeur fixe (2400 px, plafonnée à la
résolution des WebP) : le PNG obtenu est identique quel que soit l'appareil.

## Typage progressif et vérifications

`jsconfig.json` décrit les modules ES et les API DOM, avec `strict: true`,
`noEmit: true` et `checkJs: false`. Seuls les modules optant explicitement pour
`// @ts-check` sont vérifiés : les types partagés, le catalogue, le modèle, le
store et le contrôleur de statut. Le reste du runtime possède une documentation
JSDoc mais n'est pas encore soumis au contrôle strict. Le manifest généré, les
tests et les configurations d'outillage ne font pas partie de cette première
activation. Aucun fichier TypeScript ni JavaScript compilé n'est produit.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
```

Pour étendre la couverture, ajouter `// @ts-check` à un module, typer ses frontières
DOM et ses paramètres, puis corriger ses diagnostics sans modifier le comportement.
Ne pas masquer les erreurs par `@ts-ignore`, `any` ou un cast non justifié.
Le compilateur TypeScript est seulement une dépendance de développement pour
vérifier le JavaScript ; Vite reste l'outil de build, sans Vite+.

La CI applique lint, format, types, tests, vérification des sprites et build Vite.
Les PR construisent `dist/` sans déploiement ; seul `main` (ou un lancement manuel
hors PR) peut déclencher le déploiement Pages. Les vérifications navigateur
(parité visuelle, panneau mobile, téléchargement PNG, preview et Pages) restent à
la charge du mainteneur conformément au [plan de migration](migration-vite.md).
