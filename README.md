# Ranma Dress-up Studio

A responsive, static dress-up app built from the existing Ranma artwork. Select a category, try individual pieces on the character, reset to the original look, or download the preview as a PNG.

## Run locally

Serve the repository root with any static web server, then open its local URL. For example:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. The app has no build step or external runtime dependencies.

## Sprite assets

`sprite-catalog.js` maps the named character items to their source images, atlas rectangles, and original Animate placement transforms. `app.js` crops the atlas frames in the browser, so sprites can be selected individually even when several share one PNG. The source PNGs, `index.js` export, and Animate project files remain available as references; there is no need to re-export or manually split the images in Photoshop.

The app is served from the repository root and remains compatible with the existing GitHub Pages deployment workflow.
