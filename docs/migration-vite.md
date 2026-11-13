# Plan de migration vers Vite

> Document historique : pour l'état actuel du code et du typage, voir
> [Architecture](architecture.md).

> Statut : étapes 1 à 6 fusionnées dans `main` ; étape 7 implémentée dans sa PR dédiée (documentation et typage progressif). Étape 8 optionnelle, non engagée.
> Principe : une PR par étape, l'application reste fonctionnelle à chaque étape.
> Toujours affecter les PR à l'utilisateur courant et choisir un label existant : `enhancement` pour les étapes techniques, `documentation` pour les changements documentaires. Le label `migration` n'existe pas dans le dépôt ; ne pas le créer.
> Descriptions de PR : utiliser un fichier UTF-8 avec `gh pr create/edit --body-file` pour préserver les accents, puis vérifier le texte enregistré sur GitHub.
> Règle de progression : la CI GitHub Pages doit rester verte à la fin de chaque étape.
> Validation : l'assistant ne lance que lint / format / vérification des types JavaScript / tests unitaires automatiques. Les tests dans le navigateur (rendu, téléchargement PNG, déploiement Pages) sont faits par le mainteneur à la fin de chaque étape. Le build et la vérification des sprites sont également exécutés par la CI.

## 1. Constat initial (avant migration)

- 12 fichiers JS à la racine, chargés par `<script defer>` dans un ordre fragile.
- Communication par globales `window.RanmaDressUp*` (IIFE `registerXxx(windowObject)`).
- `sprite-catalog.js` (données) et `images/optimized/manifest.js` (généré par Python) sont des scripts, pas des modules.
- Pas de `package.json`, de lint, de format ni de tests.
- Documentation JS quasi absente.
- Le workflow Pages copie `./*.js` ; la doc (`README.md`, `.github/technical-constraints.md`, skill `add-outfit`) référence les chemins actuels.

## 2. Structure cible

```
index.html
package.json, vite.config.js, jsconfig.json
public/images/{optimized,thumbnails}    # servis tels quels
assets/sprites/                         # PNG Photoshop, jamais publiés
src/
  types.js                              # contrats JSDoc partagés, sans valeurs métier
  main.js                               # point d'entrée (ex app.js)
  app-bootstrap.js
  styles/main.css
  data/sprite-catalog.js                # export default
  data/sprite-manifest.js               # généré, export default
  core/    catalog-model.js, state-store.js
  render/  canvas-renderer.js, image-loader.js
  ui/      wardrobe-ui.js, wardrobe-panel-controller.js,
           outfit-controller.js, status-controller.js
scripts/                                # Python, chemins adaptés
tests/                                  # Vitest
docs/architecture.md
```

## 3. Étapes

### Étape 1 — Outillage minimal

- `package.json` (`"type": "module"`), Vite, scripts `dev` / `build` / `preview` / `lint` / `format` / `test`.
- `vite.config.js` avec `base` adapté à GitHub Pages (`/ranma-dress-up/` ou `./`).
- ESLint + Prettier, `.gitignore` (`node_modules`, `dist`).
- Les fichiers existants ne bougent pas : Vite sert l'ancien `index.html` tel quel.
- Checks assistant : lint, format. Test mainteneur : `npm run dev` affiche l'app comme avant.

### Étape 2 — Modules ES (feuilles vers racine)

Ordre : `state-store` → `catalog-model` → `image-loader` → `canvas-renderer` → `wardrobe-ui` → `status-controller` → `wardrobe-panel-controller` → `outfit-controller` → `app-bootstrap` → `app`.

- Remplacer chaque IIFE et `window.RanmaDressUp*` par `export` / `import`.
- Supprimer `windowObject` ; injecter `document` / `window` uniquement là où c'est nécessaire (testabilité).
- `sprite-catalog.js` et `manifest.js` deviennent des modules ES (`export default`) ; adapter le générateur Python du manifest.
- `index.html` : un seul `<script type="module">`.
- Test mainteneur : parité visuelle (preset par défaut, changement de tenue, exclusivités, Reset, téléchargement PNG, panneau Wardrobe, précédent/suivant).

### Étape 3 — Réorganisation en `src/`

- `git mv` vers la structure du §2 (historique conservé), CSS dans `src/styles/`.
- Mettre à jour les imports relatifs.
- Test mainteneur : idem étape 2.

### Étape 4 — Assets et scripts Python

- `images/optimized` et `images/thumbnails` → `public/images/` ; `images/sprites` → `assets/sprites/` (non publié, remplace l'étape manuelle « Assemble site »).
- Garder la clé du manifest (`items[*].source`) stable : ne pas lui ajouter de préfixe de dossier.
- Adapter `scripts/*.py` (entrées / sorties) et `--check`.
- Test mainteneur : `python scripts/optimize-sprites.py --check`, ajout d'un outfit de test via le skill `add-outfit`.

### Étape 5 — CI / déploiement

- Workflow Pages : `npm ci` → lint → test → `optimize-sprites.py --check` → `npm run build` → upload de `dist/`.
- Test mainteneur : `npm run preview` sous la base Pages, puis exécution du workflow (`workflow_dispatch`).

### Étape 6 — Tests unitaires (Vitest)

- Catalogue : règles de `technical-constraints.md` (hair obligatoire, catégories et ids valides, unicité, cohérence `item.category`).
- `state-store`, exclusivités, ordre des calques.
- Suites dans `tests/` : catalogue réel et validations des presets, isolation et transitions du store, exclusivités du contrôleur et ordre des appels de dessin du canvas (sans navigateur).
- Checks assistant : `npm test`.

### Étape 7 — Documentation

- JSDoc en tête de chaque module (rôle, dépendances, exports) et sur chaque fonction publique ; `@typedef` pour `Catalog`, `Item`, `Outfit`, `Look`.
- `// @ts-check` + `jsconfig.json` pour typer progressivement sans TypeScript.
- `docs/architecture.md` (flux catalogue → store → controllers → renderer).
- Mise à jour de `README.md`, `.github/technical-constraints.md`, `.github/copilot-instructions.md` et du skill `add-outfit` (nouveaux chemins, nouvelles commandes).
- Réalisation : contrats partagés dans `src/types.js`, contrôle strict sans émission via `npm run typecheck`. Activation initiale sur le catalogue, le modèle, le store et le contrôleur de statut ; les autres modules runtime sont documentés et restent hors contrôle strict pour cette étape.
- La CI vérifie aussi les types ; le template Python conserve le JSDoc du manifest généré. Voir [architecture](architecture.md) pour le flux et la procédure d'extension du typage.

### Étape 8 (optionnelle) — Passage à Vite+

Voir §4. PR séparée, facilement réversible.

## 4. Faut-il passer à Vite+ ?

Vite+ (VoidZero, MIT, open source) est une chaîne d'outils unifiée : Vite + Vitest + Oxlint + Oxfmt + Rolldown + gestion de Node / du gestionnaire de paquets, avec la CLI `vp` (`vp dev`, `vp check`, `vp test`, `vp build`, `vp migrate`) et une configuration unique dans `vite.config.ts`.

**Intérêt pour ce projet : oui, en fin de migration.**

- Remplace Vite + Vitest + ESLint + Prettier par une seule dépendance : moins de configuration à maintenir.
- `vp check` regroupe format, lint et types, adapté à un code typé via JSDoc / `@ts-check`.
- `vp migrate` fusionne les configurations existantes dans `vite.config.ts` : coût faible si on part de Vite + Vitest standard.
- Le projet est petit : le gain est surtout la simplicité, pas la performance.

**Réserves.**

- Outil jeune : l'API et les versions bougent ; épingler la version (y compris l'action `setup-vp` en CI, par version exacte ou SHA).
- Installation globale de `vp` sur la machine de dev.
- Aucun gain pour l'utilisateur final : c'est de l'expérience développeur.
- Oxfmt peut formater différemment de Prettier (diff de reformatage ponctuel).

**Recommandation.**

1. Faire les étapes 1 à 7 avec Vite + Vitest standard et un outillage lint/format léger.
2. Évaluer Vite+ à l'étape 8 avec `vp migrate` sur une branche. Si le build est identique et la CI verte, fusionner ; sinon rester sur Vite standard, rien n'est perdu.

## 5. Risques

| Risque                                                            | Parade                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| Régression visuelle du canvas (offsets, ombre, ordre des calques) | Checklist de parité manuelle à chaque étape           |
| Chemins d'images cassés sous la base Pages                        | Test `vite preview` avant déploiement                 |
| Clé du manifest désynchronisée                                    | `optimize-sprites.py --check` en CI                   |
| PR trop grosses                                                   | Une étape = une PR, `git mv` séparé des modifications |
