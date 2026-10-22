# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a category, try individual pieces on the character, reset to the original look, or download the preview as a PNG.

## Run locally

Serve the repository root with any static web server, then open its local URL. For example:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. The app has no build step or external runtime dependencies.

## Sprite assets

The app loads the standalone PNGs in `images/sprites/` directly, loading each wardrobe category only when it is opened. Composite atlas frames are split ahead of time; the browser does not load or crop the atlases while running. The original PNGs, Animate export, and project files remain intact.

To regenerate the standalone PNGs after updating the Animate export or sprite catalog, run `python scripts/extract_sprites.py`. This one-time development tool reads asset IDs from the catalog and sprite frames from the Animate export, and requires Pillow (`python -m pip install Pillow`) and Node.js. The app itself still has no build step or external runtime dependencies.

The app is served from the repository root and remains compatible with the existing GitHub Pages deployment workflow.
