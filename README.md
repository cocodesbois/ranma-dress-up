# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a numbered outfit preset or choose individual pieces by category, reset to the original look, or download the preview as a PNG. Hairstyles are always selected.

## Run locally

Serve the repository root with any static web server, then open its local URL. For example:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. The app has no build step or external runtime dependencies.

## Sprite assets and catalog

The app loads the individual PNGs in `images/sprites/` directly, loading each wardrobe category only when it is opened. The original `background.png` remains the default scene. The app does not load or crop composite atlases at runtime and has no build step or external runtime dependencies.

The catalog lives in `sprite-catalog.js`:

- Add every wearable as one entry in `items`, with a unique stable `id`, a category ID declared in `categories`, a display `label`, its image `source`, thumbnail crop, and canvas `placement`.
- Add complete looks separately in `outfits`. Each outfit has its own `id`, `label`, and an `items` array containing catalog item IDs. Outfit IDs do not identify or determine image names.
- To share one item between outfits, include its item ID in each outfit's `items` array. Keep only one catalog entry for that item; it will appear once in its category, regardless of how many outfits use it.

### Naming new image files

Use lowercase, descriptive, stable names based on the item's category and identity or appearance, not the outfit number. Separate words with hyphens and use the same stem for the catalog item ID and image filename. For example, `images/sprites/pants-straight-black.png` can use the catalog ID `pants-straight-black`. Add the image asset and its item entry to `sprite-catalog.js`; then reference its ID in any outfit definitions that use it.

Keep existing item entries, IDs, and image filenames unchanged unless there is a specific migration need. Deduplicate an existing pair only when that grouping is explicitly decided; use one canonical catalog item and reference its ID from every outfit that uses it. For example, the catalog uses `pants001` in Outfits 01 and 03, and `pants004` in Outfits 04 and 05. The redundant original PNG files remain in the repository but are not catalog entries or outfit references.

Pants have their own category, while empty categories such as hats and underwear remain available for future assets. Individual category selections remain available.

The app is served from the repository root and remains compatible with the existing GitHub Pages deployment workflow.
