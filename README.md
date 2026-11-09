# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a numbered outfit preset or choose individual pieces by category, reset to the original look, or download the preview as a PNG. Hairstyles are always selected.

## Run locally

Run the preview server from the repository root:

```powershell
npx http-server .
```

Open `http://localhost:8080` in a browser. The app has no build step or external runtime dependencies. The optimized sprites it loads are committed in `images/optimized/` (see below), so nothing needs to be generated before running it.

## Sprite assets and catalog

The Photoshop exports live in `images/sprites/` as PNGs, all with the same canvas size (the Photoshop document, currently 6643 x 6507 px). They are the source of truth and are never modified by the tooling. The app does not load them directly: it loads the optimized WebP equivalents from `images/optimized/` (see [Optimized sprites](#optimized-sprites-webp)), loading each wardrobe category only when it is opened. The preview shows the whole `background.png` scene, uncropped, with every sprite at its original position on it. Item cards use pre-generated thumbnail images from `images/thumbnails/` and fall back to runtime crop rendering only when a thumbnail file is missing.

The catalog lives in `sprite-catalog.js`:

- Add every wearable as one entry in `items`, with a unique stable `id`, a category ID declared in `categories`, a display `label`, its image `source` (the PNG export in `images/sprites/`; the app maps it to the optimized WebP through the manifest), thumbnail image `thumbnailSource`, thumbnail crop (in pixels of the Photoshop document), and canvas `placement`.
- Add looks separately in `outfits`. Each outfit has its own `id`, `label`, and an `items` object mapping category IDs to catalog item IDs, for example `{ tops: "top001", pants: "pants001", hair: "hair001" }`. Outfit IDs do not identify or determine image names.
- Each category can have at most one item in an outfit because it is a key in the mapping. Omit a category key when the outfit has no item in that category; outfits may share the same catalog item ID. Keep only one catalog entry for a shared item; it appears once in its category regardless of how many outfits use it.

### Naming new image files

Use lowercase, descriptive, stable names based on the item's category and identity or appearance, not the outfit number. Separate words with hyphens and use the same stem for the catalog item ID and image filename when choosing a new filename. For example, `images/sprites/pants-straight-black.png` can use the catalog ID `pants-straight-black`. If retaining extraction-generated or otherwise provided filenames, use a descriptive catalog item ID even when it differs from the filename. Add the image asset and its item entry to `sprite-catalog.js`; then reference its ID in any outfit definitions that use it. Run the optimization script after adding or changing any sprite (`scripts/prepare-sprites.py` does it for new files).

Keep existing item entries, IDs, and image filenames unchanged unless there is a specific migration need. When an existing duplicate pair is explicitly identified for cleanup, keep the lower-numbered image as the canonical asset and remove the redundant higher-numbered file. Use one canonical catalog item and reference its ID from every outfit that uses it. For example, the catalog uses `pants001` in Outfits 01 and 03, and `pants004` in Outfits 04 and 05.

Pants, slips, and tights have their own categories; the Slips and Tights categories contain individual options. Outfits 01-17 are available as presets, including Outfit 06 with its top, overalls, slip, and shoes, Outfit 07 with its dress and shoes, Outfit 08 with its top, slip, tights, and bracelets, Outfit 09 with its bodysuit, tights, shoes, hat, and accessories, Outfit 10 with its top, pants, and shoes, Outfit 11 with its bodysuit, shoes, and accessories, Outfit 12 with its bodysuit, shoes, and accessories, Outfit 13 with its dress and shoes, Outfit 14 with its top and pants, Outfit 15 with its top, pants, and shoes, Outfit 16 with its dress, shoes, and bracelets, and Outfit 17 with its top, pants, hat, and shoes. Tops can be layered with dresses; bodysuits remain mutually exclusive with tops, pants, and dresses, and pants remain mutually exclusive with dresses. Empty categories such as hats and underwear remain available for future assets. Individual category selections remain available.

The app is served from the repository root. The GitHub Pages workflow checks that `images/optimized/` is up to date, then publishes only the files the app loads (`index.html`, `styles.css`, the root `*.js` files, `images/optimized/` and `images/thumbnails/`), not the full-size exports.

### Optimized sprites (WebP)

The full-size PNGs are far heavier for the browser than for the network: a 6643 x 6507 image takes about 173 MB of memory once decoded, even when it is mostly transparent. `scripts/optimize-sprites.py` therefore builds the files the app actually loads:

```powershell
python scripts/optimize-sprites.py
```

For every PNG in `images/sprites/` it writes `images/optimized/<name>.webp`, cropped to the bounding box of its non-transparent pixels and downscaled to 50% (WebP quality 85), and records the crop offsets in `images/optimized/manifest.js`. The renderer uses these offsets to draw each sprite at exactly the same place as the full-size export. Files whose name starts with `background` are not cropped. The whole sprite set drops from about 78 MB to about 2.5 MB.

- **Resolution:** the preview shows the whole document, so a 50% sprite is pixel-perfect up to a canvas 3321 px wide (about 1100 CSS px at 3x density). Change `DEFAULT_SCALE` or `DEFAULT_QUALITY` in `scripts/sprite_optimize.py` to change this; the full-size exports are never touched, so you can rebuild at any time with `--force`.
- **Photoshop workflow:** unchanged. Export at the same canvas size as before, add the PNGs to `images/sprites/` (or use `scripts/prepare-sprites.py`), then run the script. Only new or changed files are converted (it compares file hashes), so re-runs are fast.
- **Generated files:** commit `images/optimized/` together with the PNGs. Do not edit it by hand. All PNGs must have the same canvas size; the script stops otherwise.
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
