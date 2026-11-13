# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a numbered outfit preset or choose individual pieces by category, reset to the original look, or download the look as a PNG of fixed size (2400 px wide), whatever the screen. Hairstyles are always selected.

## Run locally

Install Node.js dependencies once from the repository root (Node.js 22.18+ in
the 22.x line, or 24.11+):

```powershell
npm install
```

Start the local dev server:

```powershell
npm run dev
```

Open the URL displayed by Vite (usually `http://localhost:5173`). The optimized sprites the app loads are committed in `public/images/optimized/` (see below), so nothing needs to be generated before running it.

### Build and preview

```powershell
npm run build
npm run preview
```

### Install and use offline

The production build includes a web app manifest and a service worker. On a
supported browser, open the deployed app over HTTPS (or the local preview on
localhost) and use the browser's install option. After the first online visit,
the service worker downloads the application and its optimized images and
thumbnails; leave the page open until that download completes before going
offline. The header shows when offline access is ready, or if setup failed.
The wardrobe and PNG export then work without a connection.

The offline cache is updated on a subsequent visit after a deployment. An
already-open app keeps its previous version until its tabs are closed, so a
new version does not mix with assets from the old one. Service workers are not
registered by the Vite development server.

### Technical checks

```powershell
npm run lint
npm run format:check
npm run typecheck
npm test
```

`npm run typecheck` checks the TypeScript application, catalog validator and
Vitest tests in strict mode, using the shared contracts in `src/types.ts`; it
emits no files. Run the tests with `npm test`.
See [Architecture](docs/architecture.md) for module responsibilities, data flow
and the checked scope.

## Sprite assets and catalog

The Photoshop exports live in `assets/sprites/` as PNGs, all with the same canvas size (the Photoshop document, currently 6643 x 6507 px). They are the source of truth and are never modified by the tooling. The app does not load them directly: it loads the optimized WebP equivalents from `images/optimized/` at runtime (generated under `public/images/optimized/`, see [Optimized sprites](#optimized-sprites-webp)), loading each wardrobe category only when it is opened. The preview shows the whole `background.png` scene, uncropped, with every sprite at its original position on it. Item cards use pre-generated thumbnail images from `images/thumbnails/` at runtime (generated under `public/images/thumbnails/`) and fall back to runtime crop rendering only when a thumbnail file is missing.

The catalog lives in `src/data/sprite-catalog.ts`:

- Add every wearable as one entry in `items`, with a unique stable `id`, a category ID declared in `categories`, a display `label`, its image `source` (the PNG export in `assets/sprites/`; the app maps it to the optimized WebP through the manifest), thumbnail image `thumbnailSource`, thumbnail crop (in pixels of the Photoshop document), and canvas `placement`.
- Add looks separately in `outfits`. Each outfit has its own `id`, `label`, and an `items` object mapping category IDs to catalog item IDs, for example `{ tops: "top001", pants: "pants001", hair: "hair001" }`. Outfit IDs do not identify or determine image names.
- Each category can have at most one item in an outfit because it is a key in the mapping. Omit a category key when the outfit has no item in that category; outfits may share the same catalog item ID. Keep only one catalog entry for a shared item; it appears once in its category regardless of how many outfits use it.

### Naming new image files

Use lowercase, descriptive, stable names based on the item's category and identity or appearance, not the outfit number. Separate words with hyphens and use the same stem for the catalog item ID and image filename when choosing a new filename. For example, `assets/sprites/pants-straight-black.png` can use the catalog ID `pants-straight-black`. If retaining extraction-generated or otherwise provided filenames, use a descriptive catalog item ID even when it differs from the filename. Add the image asset and its item entry to `src/data/sprite-catalog.ts`; then reference its ID in any outfit definitions that use it. Run the optimization script after adding or changing any sprite (`scripts/prepare-sprites.py` does it for new files).

Keep existing item entries, IDs, and image filenames unchanged unless there is a specific migration need. When an existing duplicate pair is explicitly identified for cleanup, keep the lower-numbered image as the canonical asset and remove the redundant higher-numbered file. Use one canonical catalog item and reference its ID from every outfit that uses it. For example, the catalog uses `pants001` in Outfits 01 and 03, and `pants004` in Outfits 04 and 05.

Pants, slips, and tights have their own categories; the Slips and Tights categories contain individual options. Outfits 01-17 are available as presets, including Outfit 06 with its top, overalls, slip, and shoes, Outfit 07 with its dress and shoes, Outfit 08 with its top, slip, tights, and bracelets, Outfit 09 with its bodysuit, tights, shoes, hat, and accessories, Outfit 10 with its top, pants, and shoes, Outfit 11 with its bodysuit, shoes, and accessories, Outfit 12 with its bodysuit, shoes, and accessories, Outfit 13 with its dress and shoes, Outfit 14 with its top and pants, Outfit 15 with its top, pants, and shoes, Outfit 16 with its dress, shoes, and bracelets, and Outfit 17 with its top, pants, hat, and shoes. Tops can be layered with dresses; bodysuits remain mutually exclusive with tops, pants, and dresses, and pants remain mutually exclusive with dresses. Empty categories such as hats and underwear remain available for future assets. Individual category selections remain available.

The GitHub Pages workflow checks lint, formatting, TypeScript types, catalog IDs/outfit rules and asset files, tests, and optimized sprites, then builds with Vite and publishes `dist/`. Pull requests run the same checks and build without deploying. Full-size exports in `assets/sprites/` are not published. Run `npm run validate:catalog` locally to check catalog data, source images, optimized images, and thumbnails.

### Optimized sprites (WebP)

The full-size PNGs are far heavier for the browser than for the network: a 6643 x 6507 image takes about 173 MB of memory once decoded, even when it is mostly transparent. `scripts/optimize-sprites.py` therefore builds the files the app actually loads:

```powershell
python scripts/optimize-sprites.py
```

For every PNG in `assets/sprites/` it writes `public/images/optimized/<name>.webp`, cropped to the bounding box of its non-transparent pixels and downscaled to 50% (WebP quality 85), and records the crop offsets in `src/data/sprite-manifest.ts`. The renderer uses these offsets to draw each sprite at exactly the same place as the full-size export. Files whose name starts with `background` are not cropped. The whole sprite set drops from about 78 MB to about 2.5 MB.

- **Resolution:** the preview shows the whole document, so a 50% sprite is pixel-perfect up to a canvas 3321 px wide (about 1100 CSS px at 3x density). Change `DEFAULT_SCALE` or `DEFAULT_QUALITY` in `scripts/sprite_optimize.py` to change this; the full-size exports are never touched, so you can rebuild at any time with `--force`.
- **Photoshop workflow:** unchanged. Export at the same canvas size as before, add the PNGs to `assets/sprites/` (or use `scripts/prepare-sprites.py`), then run the script. Only new or changed files are converted (it compares file hashes), so re-runs are fast.
- **Generated files:** commit `public/images/optimized/` and `src/data/sprite-manifest.ts` together with the PNGs. Do not edit them by hand. All PNGs must have the same canvas size; the script stops otherwise.
- **Checking:** `python scripts/optimize-sprites.py --check` fails when a PNG is new, changed or removed without re-running the script. It needs no Pillow and runs in the Pages workflow before deployment.
- Other options: `--force` rebuilds everything, `--lossless` writes lossless WebP (much larger), `--scale` and `--quality` are for experiments (the next run without them rebuilds with the defaults).

Python with Pillow is required to build (`pip install pillow`).
The local virtual environment folder (`.venv/`) is intentionally ignored by Git.

### Regenerate thumbnails

When thumbnail crops or source sprites change, regenerate static thumbnails from the catalog:

```powershell
python scripts/generate-thumbnails.py
```

For specific items only:

```powershell
python scripts/generate-thumbnails.py --only top001 dress007
```

## Developer constraints

Technical data and runtime constraints for future Copilot/dev sessions are documented in `.github/technical-constraints.md`.
Module responsibilities and the catalog → store → controllers → renderer flow
are documented in [Architecture](docs/architecture.md). The
[add-outfit skill](.github/skills/add-outfit/SKILL.md) describes the asset/catalog
workflow; [the migration plan](docs/migration-vite.md) records the Vite steps.
