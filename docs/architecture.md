# Architecture de Ranma Dress-up Studio

L'application est statique, en modules ES TypeScript, servie et construite par
Vite. Elle n'a ni serveur applicatif ni stockage persistant. Le catalogue et les
presets sont des données versionnées ; le look courant vit uniquement en mémoire.

## Structure et responsabilités

| Module                                     | Rôle et dépendances                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.ts`                              | Point d'entrée chargé par `index.html` : construit les dépendances, monte Vue et enregistre le service worker. Aucun export public.                                                                                                                    |
| `src/types.ts`                             | Contrats TypeScript partagés, importés uniquement comme types. Aucune valeur métier à l'exécution.                                                                                                                                                     |
| `src/data/sprite-catalog.ts`               | Export par défaut du `Catalog` : fond, personnage, catégories, paires incompatibles, `Item` et `Outfit`.                                                                                                                                               |
| `src/data/layer-order.ts`                  | Liste unique des catégories, dans l'ordre de dessin ; le type `CategoryId` en est dérivé.                                                                                                                                                              |
| `src/data/sprite-manifest.ts`              | Export par défaut du manifest généré : dimensions du document, URLs WebP et offsets de recadrage par clé PNG.                                                                                                                                          |
| `src/core/catalog-model.ts`                | Valide et résout les presets, y compris les paires de catégories incompatibles ; fournit les recherches par ID, look, preset par défaut et exclusions. Sans DOM.                                                                                       |
| `src/core/state-store.ts`                  | État Vue réactif isolé : `Look`, chargements, statut, contrôles de presets, panneau responsive, disponibilité du preview et jetons de sélection. Expose une vue en lecture seule aux interfaces Vue et conserve ses actions typées. Sans DOM ni rendu. |
| `src/render/image-loader.ts`               | Deux caches distincts (chargements en cours, images décodées), résolution PNG → WebP par le manifest, préchargement adjacent et en arrière-plan.                                                                                                       |
| `src/render/canvas-renderer.ts`            | Composition des calques, ombre, redimensionnement selon la densité de pixels et export PNG à taille fixe. Lit le store via des getters et ne charge pas d'images.                                                                                      |
| `src/render/create-preview.ts`             | Fournit la factory qui construit le renderer et le contrôleur de tenue pour le canvas monté, à partir des dépendances fournies par `main.ts`.                                                                                                          |
| `src/pwa/register-offline-support.ts`      | Enregistre le service worker après le chargement de la page, publie son statut et nettoie ses écouteurs au démontage.                                                                                                                                  |
| `src/ui/outfit-controller.ts`              | Orchestre sélections, exclusivités, chargements, mutations du store et redessin explicite du canvas.                                                                                                                                                   |
| `src/ui/wardrobe-island.vue`               | Région Vue des catégories et cartes accessibles et avis de reprise ; délègue les actions au contrôleur.                                                                                                                                                |
| `src/ui/item-thumbnail.vue`                | Présente la miniature d'un item et dessine le sprite sur canvas si son image échoue, sans rendre le cache réactif.                                                                                                                                     |
| `src/ui/status-controller.ts`              | Publie les messages de statut dans le store.                                                                                                                                                                                                           |
| `src/ui/wardrobe-panel.vue`                | Présente les presets et le panneau responsive non modal, gère les attributs de dialogue, le focus et Échap, et contient la garde-robe Vue.                                                                                                             |
| `src/ui/status-view.vue`, `reset-view.vue` | Présentent le statut réactif et l'action Reset déléguée au contrôleur.                                                                                                                                                                                 |
| `src/ui/app-view.vue`                      | Présente le shell et le canvas stable ; délègue ses actions et le cycle de vie du preview au composable.                                                                                                                                               |
| `src/ui/use-app-preview.ts`                | Reçoit les services composés par `main.ts`, initialise le preview après montage, observe taille et densité, orchestre les actions et l'export PNG, puis nettoie les observateurs au démontage.                                                         |
| `src/styles/main.css`                      | Présentation responsive ; le seuil mobile utilisé par les contrôleurs est de 720 px.                                                                                                                                                                   |

## Flux des données

```text
sprite-catalog.ts ──→ catalog-model ──→ presets validés + look par défaut
                                               │
                                               ▼
                                           state-store
                                               ▲
DOM ──→ application Vue ──→ outfit-controller ──→ state-store
                                        │                    │
                                        │                    ├──→ island Vue
                                        │                    └──→ autres régions Vue
                                        ├──→ image-loader ───────→ sprites
                                        └──→ canvas-renderer ──→ canvas
                                               ▲
                                               └── manifest
```

Le câblage se fait dans `main.ts`, sans globales applicatives `window.RanmaDressUp*`.
Vue possède le DOM persistant de l'interface ; les contrôleurs orchestrent les
actions et publient l'état via le store sans écrire directement dans les nœuds de
présentation. Les factories reçoivent leurs collaborateurs et les tests injectent
des doubles pour les API du navigateur, les images ou le contexte canvas sans
lancer de navigateur ; les tests de présentation s'exécutent dans jsdom.

Le shell `app-view.vue` synchronise les classes de mise en page du `body` avec
l'état du panneau dans le store et les retire à son démontage. Le panneau gère
ses interactions et son focus sans posséder le cycle de vie de ces classes.

### Périmètre du store

L'analyse de l'étape 6 retient un seul store par application, avec la réactivité
native de Vue, plutôt qu'un découpage ou Pinia. Avant nettoyage, le store exposait
22 méthodes : trois n'étaient utilisées que par les tests et ont été retirées.
Le panneau consomme le look, les presets et le layout ; la garde-robe consomme
le look, la catégorie et son chargement ; le shell et le contrôleur de statut
consomment les états de présentation. Le contrôleur de tenue coordonne ces
domaines sans dupliquer leur état, et les services PWA et de preview publient
respectivement les états hors ligne et de téléchargement.

L'invariant est un look courant et un seul jeton de sélection de preset par
instance de store, construite une fois dans `main.ts`. Le jeton de chargement de
catégorie est distinct : il protège la disponibilité des items, pas la sélection
du look. Une sélection manuelle ou Reset invalide la sélection de preset ; un
preset ou Reset publie aussi le résultat de la catégorie active et invalide ses
chargements antérieurs. Ces transitions restent explicites dans le contrôleur et
sont couvertes par les tests de chargement et d'exclusivité. Les actions du store
restent le seul moyen de modifier l'état ; les images et le canvas restent hors
réactivité. Un découpage ou Pinia ajouterait ici du câblage sans supprimer de
comportement dupliqué ni répondre à un besoin d'état partagé entre instances.

Sur grand écran (au-delà de 720 px), le preview détermine la hauteur commune des
deux panneaux : leurs bords supérieur et inférieur sont alignés, sans déformer
l'image. La garde-robe utilise `contain: size` pour que son contenu n'agrandisse
pas la rangée ; seule sa liste d'objets défile. Le panneau mobile conserve sa mise
en page indépendante.

Sur grand écran, l'en-tête et la zone de travail partagent les mêmes limites
(`--workspace-max-width` et `--workspace-gutter`) pour aligner le logo à gauche et
les actions à droite.

La présentation utilise un fond bleu uni, des surfaces planes sans bordure de
panneau ni ombre, et un rayon partagé `--radius` pour les composants. Les contours
restent réservés à la sélection des objets et au focus clavier.

Les boutons de catégories affichent une coche dans un disque à gauche du libellé
quand un objet est porté dans cette catégorie, indépendamment de la catégorie
consultée. Leur nom accessible indique aussi « item equipped » ; `aria-pressed`
reste réservé à la catégorie consultée. Les indicateurs suivent les presets, les
sélections manuelles, les exclusions, le retrait d'un objet et Reset.

La région `wardrobe-island.vue` lit la catégorie, le look et le résultat de
chargement du store réactif. Le contrôleur ne modifie pas les nœuds de cette
région ; il signale au store le début et le résultat d'un chargement, puis le
composant affiche les cartes à partir des IDs disponibles publiés avec ce résultat,
l'avis partiel ou le bouton de reprise. Les images et leurs caches restent dans
`image-loader`, hors de la réactivité Vue.

Les couleurs de l'interface, la typographie, les espacements réutilisés, les tailles
de contrôles, le focus, les durées de transition et les niveaux de superposition
sont définis comme propriétés personnalisées dans `:root` de `main.css`. Les
variantes responsive redéfinissent ces variables si nécessaire. Les seuils des
media queries, les proportions du document et les ajustements géométriques propres
à un composant restent littéraux ; les propriétés personnalisées ne peuvent pas
remplacer les seuils dans les conditions des media queries.

### Démarrage

1. Le modèle transforme chaque `Outfit` en preset avec ses objets `Item` résolus et
   son `Look` complet (catégorie → ID ou `null`). Il vérifie les références,
   les catégories, la présence de cheveux et d'au moins un vêtement.
2. `main.ts` choisit le preset `001`, ou le premier disponible, et copie son look
   dans un nouveau store.
3. Après montage du canvas, le composable initialise le renderer et le contrôleur,
   branche les observateurs de taille/densité, puis appelle `startApp()`.
4. Le contrôleur charge le fond, le personnage et les pièces sélectionnées, qui sont
   requis, puis le reste de la catégorie initiale `tops`, facultatif. Il publie le
   résultat du chargement au store, marque le preview prêt, puis dessine et
   précharge les presets voisins et les autres pièces. Vue affiche les options et
   les cartes depuis l'état réactif.

### Sélections et concurrence

- Une sélection de catégorie publie son état de chargement, puis charge ses images
  avant d'afficher les cartes. Un échec ne vide pas la grille : les cartes dont le
  sprite est décodé sont affichées, un avis avec un bouton « Try again » remplace
  les autres et le statut indique combien d'images ont échoué. Un jeton empêche une
  réponse devenue obsolète de remplacer l'état de la catégorie active ou de signaler
  une erreur.
- Une sélection manuelle applique les exclusivités déclarées dans le catalogue
  (`incompatibleCategories`), modifie le store, synchronise le preset reconnu et
  redessine. Le store n'applique pas de règles métier lui-même.
- Une sélection de preset obtient un jeton monotone du store. Après chargement,
  seul le jeton encore courant peut appliquer le look ou signaler une erreur.
  Les sélections manuelles et Reset invalident les requêtes en cours et libèrent
  immédiatement les contrôles ; Vue affiche le preset demandé ou celui qui
  correspond au look courant.
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

Les types `Catalog`, `Item`, `Outfit` et `Look` sont définis dans `src/types.ts`,
avec les contrats auxiliaires `Placement`, `Crop`, `Layer`, `Category`,
`OutfitPreset`, `SpriteManifest` et `Sprite`. Ils s'appuient sur `CategoryId`,
dérivé de `src/data/layer-order.ts` : le compilateur refuse une catégorie inconnue
dans un item, un outfit ou une paire incompatible.

- `Outfit` est une définition de preset : ses clés omises sont des catégories vides.
- `Look` est la sélection courante : les catégories vides sont représentées par
  `null`. Les IDs de catégories restent des chaînes afin que le catalogue soit la
  source de vérité ; le modèle et les tests vérifient les références à l'exécution.
- Le store copie le look initial et les looks de remplacement. `getOutfit()` expose
  une vue réactive en lecture seule du look courant ; seules les actions du store
  peuvent le modifier. Après un remplacement, il faut rappeler `getOutfit()` pour
  obtenir la nouvelle vue. Les valeurs du look sont des chaînes ou `null`.
- Les cheveux sont obligatoires dans les presets ; leur catégorie ne propose pas
  de bouton None.
- `Catalog.incompatibleCategories` liste des paires de catégories qui ne se portent
  pas ensemble. Une paire vaut dans les deux sens, le modèle refuse un preset qui
  combine les deux catégories et le contrôleur applique les exclusions à la
  sélection manuelle. Elles et l'ordre des calques sont détaillés dans
  [les contraintes techniques](../.github/technical-constraints.md).
  Les robes et les combinaisons (`jumpsuits`) restent au-dessus des chaussures.
  Les tabliers et robes-tablier (`aprons`) sont des calques facultatifs au-dessus
  des vêtements et sous les cheveux ; ils ne suffisent pas seuls à valider un
  preset avec les cheveux. Les combinaisons excluent pantalons, robes et
  bodysuits, mais restent compatibles avec les tops et les sous-vêtements.
  Les robes et les tops s'excluent mutuellement. Les
  gants et les bracelets ne peuvent pas être portés ensemble.

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

## Typage et vérifications

`vue-tsc` vérifie les modules TypeScript de l'application et les templates `.vue`
en mode strict sans émettre de fichiers ; `tsconfig.node.json` vérifie le validateur
du catalogue avec les types Node. `tsconfig.test.json` vérifie les tests et leurs
doubles en mode strict. Vite et son plugin Vue produisent le JavaScript du site.
ESLint et Prettier couvrent aussi les composants `.vue`. Les configurations
d'outillage restent en JavaScript.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
```

Ne pas masquer les erreurs par `@ts-ignore`, `any` ou un cast non justifié.
Les types n'excluent pas la validation des données à l'exécution. ESLint utilise
le parseur Babel pour la syntaxe TypeScript ; les noms non définis et les variables
locales inutilisées des fichiers TypeScript sont vérifiés par le compilateur.

La CI applique lint, format, types, tests, vérification des sprites et build Vite.
Les PR construisent `dist/` sans déploiement ; seul `main` (ou un lancement manuel
hors PR) peut déclencher le déploiement Pages. Les vérifications navigateur
(parité visuelle, panneau mobile, téléchargement PNG, preview et Pages) restent à
la charge du mainteneur conformément au [plan de migration](migration-vite.md).
