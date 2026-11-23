# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a numbered outfit preset or choose individual pieces by category, reset to the original look, or download the look as a PNG of fixed size (2400 px wide), whatever the screen. Hairstyles are always selected.

On mobile, open the wardrobe to keep the entire preview visible above it. Swipe the
category and item rows horizontally, or use **Expand** to browse a larger grid and
**Compact** to return to the smaller, icon-only wardrobe. The status, reset and save
controls remain available above it. Closing and reopening starts in compact mode.
Above 720 px, including tablet widths, the wardrobe remains beside the preview.

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

### App icons

The original logo is preserved in `assets/branding/app-icon.png`. Browser icons,
the header logo, the 180px Apple touch icon, and the 192px/512px install icons all
use this artwork, centered on the app's blue background without cropping or
stretching. The SVG embeds the original raster artwork; it is not a vector trace.

After replacing the source, regenerate the committed icons with Pillow installed:

```powershell
python scripts/generate-icons.py
```

## Sprite assets and catalog

The Photoshop exports live in `assets/sprites/` as PNGs, all with the same canvas size (the Photoshop document, currently 6643 x 6507 px). They are the source of truth and are never modified by the tooling. The app does not load them directly: it loads the optimized WebP equivalents from `images/optimized/` at runtime (generated under `public/images/optimized/`, see [Optimized sprites](#optimized-sprites-webp)), loading each wardrobe category only when it is opened. The preview shows the whole `background.png` scene, uncropped, with every sprite at its original position on it. Item cards use pre-generated thumbnail images from `images/thumbnails/` at runtime (generated under `public/images/thumbnails/`) and fall back to runtime crop rendering only when a thumbnail file is missing.

The catalog lives in `src/data/sprite-catalog.ts`:

- Add every wearable as one entry in `items`, with a unique stable `id`, a category ID declared in `categories`, a display `label`, its image `source` (the PNG export in `assets/sprites/`; the app maps it to the optimized WebP through the manifest), thumbnail image `thumbnailSource`, thumbnail crop (in pixels of the Photoshop document), and canvas `placement`.
- Add looks separately in `outfits`. Each outfit has its own `id`, `label`, and an `items` object mapping category IDs to catalog item IDs, for example `{ tops: "top001", pants: "pants001", hair: "hair001" }`. Outfit IDs do not identify or determine image names.
- Each category can have at most one item in an outfit because it is a key in the mapping. Omit a category key when the outfit has no item in that category; outfits may share the same catalog item ID. Keep only one catalog entry for a shared item; it appears once in its category regardless of how many outfits use it.

### Add a new outfit manually (end-to-end)

When you receive new Photoshop exports for one outfit, follow this sequence from the repository root.

1. Pick the folder that contains the new PNG exports.
   - If you want to preserve that source folder untouched, copy only the new files to a temporary folder first.
2. Run a dry run first:

```powershell
python scripts/prepare-sprites.py <folder> --dry-run
```

    - The script strips prefixes before a recognized category token (`xxx_xxx-top001.png` becomes `top001.png`).
    - It normalizes known aliases (`accessoires` -> `accessories`, `pant` -> `pants`).
    - Use `jumpsuitNNN.png` for one-piece garments with trouser legs and `apronNNN.png` for optional aprons or pinafores. Plural tokens (`jumpsuits`, `aprons`) are also accepted. Export these layers separately on the shared canvas.
    - It stops on unrecognized names, duplicate targets, or collisions with existing sprites. Resolve those first; do not overwrite files.

3. If the dry run looks correct, run the same command without `--dry-run`:

```powershell
python scripts/prepare-sprites.py <folder>
```

    This command:
    - moves new full-size PNGs to `assets/sprites/`
    - generates `public/images/thumbnails/<item-id>.png`
    - generates/updates `public/images/optimized/<name>.webp`
    - updates `src/data/sprite-manifest.ts`
    - prints catalog item snippets that include `thumbnailSource` and `thumbnail` crop data

4. Paste each printed snippet into `items` in `src/data/sprite-catalog.ts`, near items of the same category. - Keep `source` as `assets/sprites/<name>.png`. - Keep `thumbnailSource` as `images/thumbnails/<item-id>.png` (no `public/` prefix). - Verify labels before saving. 5. Add a preset in `outfits` with the next free `id` and label. - Map category IDs to item IDs (not filenames). - Include `hair` and at least one clothing category. - Reuse existing items where appropriate (for example `hair001`). - Do not modify the live `Look` state or controllers to force a new preset. 6. If you edited or replaced any existing PNG (not just adding new files), run:

```powershell
python scripts/optimize-sprites.py
python scripts/generate-thumbnails.py
```

7. Verify optimized assets are up to date:

```powershell
python scripts/optimize-sprites.py --check
```

8. Run project checks (install dependencies first if needed):

```powershell
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
```

9. Browser validation during the Vite migration is maintainer-owned.
   - Use `npm run dev` to review new wardrobe entries and alignment.
   - Use `npm run build` then `npm run preview` for a production-like check.
10. If the README preset list changes, update it in the same PR.
    Commit generated files together with source PNGs:
    - `public/images/optimized/`
    - `public/images/thumbnails/`
    - `src/data/sprite-manifest.ts`
      Keep manifest output generated; do not hand-edit manifest geometry or URLs.

### Naming new image files

Use lowercase, descriptive, stable names based on the item's category and identity or appearance, not the outfit number. Separate words with hyphens and use the same stem for the catalog item ID and image filename when choosing a new filename. For example, `assets/sprites/pants-straight-black.png` can use the catalog ID `pants-straight-black`. If retaining extraction-generated or otherwise provided filenames, use a descriptive catalog item ID even when it differs from the filename. Add the image asset and its item entry to `src/data/sprite-catalog.ts`; then reference its ID in any outfit definitions that use it. Run the optimization script after adding or changing any sprite (`scripts/prepare-sprites.py` does it for new files).

Keep existing item entries, IDs, and image filenames unchanged unless there is a specific migration need. When an existing duplicate pair is explicitly identified for cleanup, keep the lower-numbered image as the canonical asset and remove the redundant higher-numbered file. Use one canonical catalog item and reference its ID from every outfit that uses it. For example, the catalog uses `pants001` in Outfits 01 and 03, and `pants004` in Outfits 04 and 05.

Pants, slips, tights, and socks have their own categories; the Slips, Tights, and Socks categories contain individual options. Outfits 01-27 are available as presets, including Outfit 06 with its top, jumpsuit (overalls), slip, and shoes, Outfit 07 with its dress and shoes, Outfit 08 with its top, slip, tights, and bracelets, Outfit 09 with its bodysuit, tights, shoes, hat, and accessories, Outfit 10 with its top, pants, and shoes, Outfit 11 with its bodysuit, shoes, and accessories, Outfit 12 with its bodysuit, shoes, and accessories, Outfit 13 with its dress and shoes, Outfit 14 with its top and pants, Outfit 15 with its top, pants, and shoes, Outfit 16 with its jumpsuit, shoes, and bracelets, Outfit 17 with its top, pants, hat, and shoes, Outfit 18 with its top, pants, and shoes, Outfit 19 with its bodysuit and shoes, Outfit 25 with its jumpsuit, top, gloves, shoes, and accessories, and Outfit 27 with its top, slip, socks, shoes, and hat. Individual category selections remain available.

**Jumpsuits** contains one-piece garments with trouser legs, including
`jumpsuit006` and `jumpsuit016`.
**Bodysuits** contains leotard-style garments; **Dresses** contains actual dresses.
Tops can be layered with dresses or jumpsuits. Jumpsuits exclude pants, dresses,
and bodysuits, but preserve underwear, slips, and tights. Bodysuits exclude tops,
pants, dresses, slips, and jumpsuits; pants also exclude dresses.

**Aprons & pinafores** (`aprons`) is an optional overlay category, initially empty
and ready for future exports. It draws above clothing and below hair, has a None
option, and introduces no exclusions. An apron can accompany a jumpsuit, dress,
or top/pants combination, but does not satisfy a preset's clothing requirement
alone. Both jumpsuits and dresses draw above shoes so their hems can cover them.

The GitHub Pages workflow checks lint, formatting, TypeScript types, catalog IDs/outfit rules, asset files and unused files, tests, and optimized sprites, then builds with Vite and publishes `dist/`. Pull requests run the same checks and build without deploying. Full-size exports in `assets/sprites/` are not published. Run `npm run validate:catalog` locally to check catalog data, source images, optimized images, and thumbnails.

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
