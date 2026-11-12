# Technical constraints for Copilot dev sessions

Use this file as the source of truth for data and behavior constraints when changing the dress-up app.

## Catalog data constraints (`src/data/sprite-catalog.js`)

1. `categories[*].id` values define valid outfit keys.  
   Every key in `outfits[*].items` must match an existing category ID.
2. `items[*].id` values are globally unique and are the only valid references in outfits.
3. For every outfit mapping (`{ category: itemId }`), the referenced item must exist and its `item.category` must equal the mapping key category.
4. Every outfit must include:
   - `hair` (mandatory), and
   - at least one clothing category among: `bodysuits`, `underwear`, `slips`, `tights`, `tops`, `dresses`, `pants`.
5. Outfit IDs and image filenames are independent. Do not infer item filenames from outfit IDs.
6. Keep shared item IDs reused across outfits instead of duplicating catalog items.

## Sprite asset constraints

1. `assets/sprites/*.png` are the Photoshop exports and the source of truth. They all share the same canvas size (the Photoshop document). Never resize, crop or rewrite them with tooling.
2. The app loads `images/optimized/*.webp` at runtime (generated under `public/images/optimized/`). Offsets in document pixels are in `src/data/sprite-manifest.js`, keyed by the PNG path (`items[*].source`). Both the WebP files and the manifest are generated: commit them, never edit them by hand.
3. Every PNG must have an up-to-date manifest entry. `python scripts/optimize-sprites.py --check` verifies this and runs in the Pages workflow. Run `python scripts/optimize-sprites.py` after adding or changing a PNG (`prepare-sprites.py` already does).
4. Files whose name starts with `background` are never cropped; the preview shows the full image.
5. `items[*].source` keeps pointing at the PNG path. `items[*].thumbnail` and `placement` are expressed in document pixels, not in optimized-image pixels. Static thumbnails are generated from the PNG exports.
6. The Pages workflow builds with Vite and publishes only `dist/`, not source directories or `assets/sprites/`. Vite bundles `index.html` and `src/`, and copies `public/` into `dist/`. Keep runtime assets under `public/images/`; URLs start with `images/`, never `public/`. There is no "Assemble site" step.

## Preview geometry (`src/render/canvas-renderer.js`)

1. The canvas shows the whole Photoshop document. Its drawing units are `catalog.base.placement.scale` times document pixels, with the document's top-left corner at (0, 0); the aspect ratio comes from `manifest.document`.
2. An item is drawn at `placement.x - placement.regX * scale + sprite.x * scale - origin`, where `sprite.x` is the crop offset from the manifest and `origin` derives from the base placement. Items are expected to use the shared placement; a different placement shifts only that item.
3. The floor shadow is defined in document pixels in `canvas-renderer.js`. Adjust it there if the base character moves on the document.
4. `imageSmoothingQuality` is set to `"high"` in `drawOutfit` because the context state is reset whenever the canvas is resized.

## Runtime/UI constraints (`src/ui/outfit-controller.js`, `src/ui/wardrobe-ui.js`)

1. Hair is mandatory in presets and user flows:
   - Presets without hair throw during startup (`createOutfitPresets` validation).
   - The Hair category does not render a `None` button, so users cannot remove hair interactively.
2. Mutual exclusivity rules when selecting an item manually:
   - `bodysuits` clears `tops`, `pants`, `dresses`
   - `tops` clears `bodysuits`
   - `pants` clears `bodysuits`, `dresses`
   - `dresses` clears `bodysuits`, `pants`
3. Layer draw order in `src/render/canvas-renderer.js` is fixed and must stay coherent with visual composition:
   `underwear → slips → tights → bodysuits → pants → tops → shoes → dresses → hair → hats → necklace → bracelets → accessories`.
   Dresses render over shoes so their hems can hide them where appropriate.

## Modules, documentation and type checking

- `src/main.js` wires dependencies; `src/app-bootstrap.js` binds events and starts the app. Core modules stay independent of the DOM. See [architecture](../docs/architecture.md) for the full flow.
- Document each runtime module's role, dependencies and exports in its JSDoc header, and keep public function contracts current.
- Shared typedefs live in `src/types.js`: `Catalog`, `Item`, `Outfit`, `Look` and supporting geometry/preset/manifest types. Import them through JSDoc, not runtime imports.
- `jsconfig.json` enables strict, no-emit checking only for modules opting into `// @ts-check`. Initially this covers shared types, the catalog, catalog model, state store and status controller; other runtime modules remain documented but unchecked.
- Run `npm run typecheck` when changing data or contracts. Structural types do not replace runtime validation of IDs, required hair/clothing or catalog tests.
- Preserve generated documentation by editing the template in `scripts/sprite_optimize.py`, not just the manifest output. Do not put brace-delimited JSDoc types before the manifest object: Python readers locate the first JSON brace.

## Change checklist

- When editing outfits, validate that each preset still includes `hair`.
- When adding categories/items, update both data and any logic that depends on category IDs.
- When adding or changing a sprite PNG, run `python scripts/optimize-sprites.py` and commit `public/images/optimized/` and `src/data/sprite-manifest.js`; regenerate thumbnails if the item changed.
- When changing exclusivity or draw order, update this document and verify behavior in the browser.
- Run `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test` before submitting changes. CI also checks optimized sprites and builds with Vite; visual/browser validation remains the maintainer's responsibility during this migration.
