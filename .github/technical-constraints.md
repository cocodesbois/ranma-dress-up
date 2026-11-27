# Technical constraints for Copilot dev sessions

Use this file as the source of truth for data and behavior constraints when changing the dress-up app.

## Catalog data constraints (`src/data/sprite-catalog.ts`)

1. `categories[*].id` values define valid outfit keys.  
   Every key in `outfits[*].items` must match an existing category ID.
2. `items[*].id` values are globally unique and are the only valid references in outfits.
3. For every outfit mapping (`{ category: itemId }`), the referenced item must exist and its `item.category` must equal the mapping key category.
4. Every outfit must include:
   - `hair` (mandatory), and
   - at least one clothing category among: `bodysuits`, `jumpsuits`, `bras`, `slips`, `tights`, `tops`, `dresses`, `pants`. `aprons` is an optional overlay and does not satisfy this requirement alone.
5. Outfit IDs and image filenames are independent. Do not infer item filenames from outfit IDs.
6. Keep shared item IDs reused across outfits instead of duplicating catalog items.
7. `incompatibleCategories` is a list of `[categoryA, categoryB]` pairs of category IDs that cannot be worn together. Both IDs must exist, a pair works in both directions, and no outfit may contain items from both categories of a pair (`createOutfitPresets` throws otherwise).

## Sprite asset constraints

1. `assets/sprites/*.png` are the Photoshop exports and the source of truth. They all share the same canvas size (the Photoshop document). Never resize, crop or rewrite them with tooling.
2. The app loads `images/optimized/*.webp` at runtime (generated under `public/images/optimized/`). Offsets in document pixels are in `src/data/sprite-manifest.ts`, keyed by the PNG path (`items[*].source`). Both the WebP files and the manifest are generated: commit them, never edit them by hand.
3. Every PNG must have an up-to-date manifest entry. `python scripts/optimize-sprites.py --check` verifies this and runs in the Pages workflow. Run `python scripts/optimize-sprites.py` after adding or changing a PNG (`prepare-sprites.py` already does).
4. Files whose name starts with `background` are never cropped; the preview shows the full image.
5. `items[*].source` keeps pointing at the PNG path. `items[*].thumbnail` and `placement` are expressed in document pixels, not in optimized-image pixels. Static thumbnails are generated from the PNG exports.
6. The Pages workflow builds with Vite and publishes only `dist/`, not source directories or `assets/sprites/`. Vite bundles `index.html` and `src/`, and copies `public/` into `dist/`. Keep runtime assets under `public/images/`; URLs start with `images/`, never `public/`. There is no "Assemble site" step.

## Preview geometry (`src/render/canvas-renderer.ts`)

1. The canvas shows the whole Photoshop document. Its drawing units are `catalog.base.placement.scale` times document pixels, with the document's top-left corner at (0, 0); the aspect ratio comes from `manifest.document`.
2. An item is drawn at `placement.x - placement.regX * scale + sprite.x * scale - origin`, where `sprite.x` is the crop offset from the manifest and `origin` derives from the base placement. Items are expected to use the shared placement; a different placement shifts only that item.
3. The floor shadow is defined in document pixels in `canvas-renderer.ts`. Adjust it there if the base character moves on the document.
4. `imageSmoothingQuality` is set to `"high"` in `paintOutfit` because the context state is reset whenever the canvas is resized.
5. The download button saves `exportPreview()`, not the visible canvas: the look is painted again on an offscreen canvas of fixed width (2400 px, capped at the decoded sprites' resolution, `manifest.document` aspect ratio). The saved PNG therefore does not depend on the window size or the device pixel ratio. Painting goes through `paintOutfit` for both, so the composition cannot differ.

## Runtime/UI constraints (`src/ui/outfit-controller.ts`, `src/ui/wardrobe-ui.ts`)

1. Hair is mandatory in presets and user flows:
   - Presets without hair throw during startup (`createOutfitPresets` validation).
   - The Hair category does not render a `None` button, so users cannot remove hair interactively.
2. Mutual exclusivity rules when selecting an item manually come from `catalog.incompatibleCategories` through `getExcludedCategories` (not from controller code). The current pairs give:
   - `bodysuits` clears `tops`, `pants`, `dresses`, `slips`, `jumpsuits`
   - `slips` clears `bodysuits`
   - `tops` clears `bodysuits`
   - `pants` clears `bodysuits`, `dresses`, `jumpsuits`
   - `dresses` clears `bodysuits`, `pants`, `jumpsuits`
   - `jumpsuits` clears `pants`, `dresses`, `bodysuits`, but preserves tops, bras, slips and tights
   - `gloves` and `bracelets` clear each other
   - `aprons` has no exclusions and can be selected or removed independently
3. A category whose images only partly load still shows the loaded items, plus an alert with a "Try again" button for the others. Items whose sprite is not loaded are never offered, because they could not be drawn. Only the scene, the base character and the current look are required at startup.
4. `layerOrder` in `src/data/layer-order.ts` is the single list of categories and their draw order, and must stay coherent with visual composition:
   `bras → slips → tights → bodysuits → pants → tops → shoes → jumpsuits → dresses → aprons → hair → hats → necklace → bracelets → accessories`.
   Dresses and jumpsuits render over shoes so their hems can hide them where appropriate. Aprons and pinafores render over clothing, below hair. The `CategoryId` type is derived from this list, so an item, an outfit or an incompatible pair cannot use a category that is missing from it, and the renderer draws every category. To add a category: add it to `layerOrder` at its draw position, then to `categories` in the catalog (label and tab position).

## Garment classification and imports

- `bodysuits` contains leotard-style garments; `jumpsuits` contains one-piece garments with trouser legs; `dresses` contains actual dresses; `aprons` contains optional aprons and pinafores.
- `jumpsuit006` and `jumpsuit016` belong to `jumpsuits`; presets 006 and 016 use the `jumpsuits` key.
- `prepare-sprites.py` recognizes `jumpsuit`/`jumpsuits` and `apron`/`aprons`, normalized to `jumpsuitNNN.png` and `apronNNN.png`. Export a jumpsuit and its apron separately on the shared canvas when they must be independently selectable.

## Modules, documentation and type checking

- `src/main.ts` wires dependencies; `src/app-bootstrap.ts` binds events and starts the app. Core modules stay independent of the DOM. `src/core/state-store.ts` owns the Vue-reactive state; Vue regions receive its readonly state view while actions remain the mutation API. See [architecture](../docs/architecture.md) for the full flow.
- Document each runtime module's role, dependencies and exports in its JSDoc header, and keep public function contracts current. Do not repeat TypeScript types in JSDoc tags (`@param {string} id`): the signature is the contract, and `tests/source-conventions.test.ts` rejects typed tags. Keep descriptions, as in `@param id - What it identifies`.
- Shared types live in `src/types.ts`: `Catalog`, `Item`, `Outfit`, `Look` and supporting geometry/preset/manifest types. Use type-only imports where appropriate.
- `vue-tsc` checks application TypeScript and `.vue` templates in strict, no-emit mode; `tsconfig.node.json` checks the Node catalog validator and `tsconfig.test.json` checks the tests.
- Run `npm run typecheck` when changing data or contracts. Structural types do not replace runtime validation of IDs, required hair/clothing or catalog tests.
- Run `npm run validate:catalog` to check catalog IDs, that the catalog categories match `src/data/layer-order.ts`, outfit rules, source and optimized sprite files, thumbnails and their crops (whole pixels, inside the document, overlapping the sprite), and files that nothing refers to (unused source images, thumbnails or optimized images fail; an unused `background*` image only warns). The rules live in `scripts/catalog-validation.ts` and are tested in `tests/catalog-validation.test.ts`. The Pages workflow runs this check on every pull request and deployment.
- Preserve generated documentation by editing the template in `scripts/sprite_optimize.py`, not just the manifest output. Do not put braces before the manifest object: Python readers locate the first JSON brace.

## Change checklist

- When editing outfits, validate that each preset still includes `hair`.
- When adding categories/items, update both data and any logic that depends on category IDs.
- When adding or changing a sprite PNG, run `python scripts/optimize-sprites.py` and commit `public/images/optimized/` and `src/data/sprite-manifest.ts`; regenerate thumbnails if the item changed.
- When changing exclusivity (`incompatibleCategories`) or draw order, update this document and the tests, and verify behavior in the browser.
- When changing catalog data or assets, run `npm run validate:catalog`.
- Run `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test` before submitting changes. CI also checks optimized sprites and builds with Vite; visual/browser validation remains the maintainer's responsibility during this migration.
- Vue-owned regions must read the same reactive store without taking ownership of DOM still updated by legacy controllers. Keep canvas contexts, decoded images and image caches outside Vue reactivity; canvas redraws remain explicit.
