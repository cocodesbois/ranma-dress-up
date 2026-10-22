# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a numbered outfit preset or choose individual pieces by category, reset to the original look, or download the preview as a PNG. Hairstyles are always selected.

## Run locally

Serve the repository root with any static web server, then open its local URL. For example:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. The app has no build step or external runtime dependencies.

## Sprite assets

The app loads the individual PNGs in `images/sprites/` directly, loading each wardrobe category only when it is opened. The app does not load or crop composite atlases at runtime and has no build step or external runtime dependencies.

Outfit presets group clothing, accessories, and hair by their shared three-digit suffix (for example, `slip001` and `top001` are in Outfit 01). Individual category selections remain available.

The app is served from the repository root and remains compatible with the existing GitHub Pages deployment workflow.
