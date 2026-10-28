# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a numbered outfit preset or choose individual pieces by category, reset to the original look, or download the preview as a PNG. Hairstyles are always selected.

## Run locally

Run the preview server from the repository root:

```powershell
npx http-server .
```

Open `http://localhost:8080` in a browser. The app has no build step or external runtime dependencies.

## Sprite assets and catalog

The app loads the individual PNGs in `images/sprites/` directly, loading each wardrobe category only when it is opened. The original `background.png` remains the default scene. The app does not load or crop composite atlases at runtime and has no build step or external runtime dependencies.

The catalog lives in `sprite-catalog.js`:

- Add every wearable as one entry in `items`, with a unique stable `id`, a category ID declared in `categories`, a display `label`, its image `source`, thumbnail crop, and canvas `placement`.
- Add looks separately in `outfits`. Each outfit has its own `id`, `label`, and an `items` object mapping category IDs to catalog item IDs, for example `{ tops: "top001", pants: "pants001", hair: "hair001" }`. Outfit IDs do not identify or determine image names.
- Each category can have at most one item in an outfit because it is a key in the mapping. Omit a category key when the outfit has no item in that category; outfits may share the same catalog item ID. Keep only one catalog entry for a shared item; it appears once in its category regardless of how many outfits use it.

### Naming new image files

Use lowercase, descriptive, stable names based on the item's category and identity or appearance, not the outfit number. Separate words with hyphens and use the same stem for the catalog item ID and image filename when choosing a new filename. For example, `images/sprites/pants-straight-black.png` can use the catalog ID `pants-straight-black`. If retaining extraction-generated or otherwise provided filenames, use a descriptive catalog item ID even when it differs from the filename. Add the image asset and its item entry to `sprite-catalog.js`; then reference its ID in any outfit definitions that use it.

Keep existing item entries, IDs, and image filenames unchanged unless there is a specific migration need. When an existing duplicate pair is explicitly identified for cleanup, keep the lower-numbered image as the canonical asset and remove the redundant higher-numbered file. Use one canonical catalog item and reference its ID from every outfit that uses it. For example, the catalog uses `pants001` in Outfits 01 and 03, and `pants004` in Outfits 04 and 05.

Pants, slips, and tights have their own categories; the Slips and Tights categories contain individual options. Outfits 01-08 are available as presets, including Outfit 06 with its top, overalls, slip, and shoes, Outfit 07 with its dress and shoes, and Outfit 08 with its top, slip, tights, and bracelets. Tops can be layered with dresses; bodysuits remain mutually exclusive with tops, pants, and dresses, and pants remain mutually exclusive with dresses. Empty categories such as hats and underwear remain available for future assets. Individual category selections remain available.

The app is served from the repository root and remains compatible with the existing GitHub Pages deployment workflow.
