---
name: add-outfit
description: Add new outfit sprites to Ranma Dress Up. Use when the user adds PNGs exported from Photoshop, mentions a new outfit or new clothing items, asks to rename sprites, or replaces an existing sprite image.
---

# Add an outfit (minimal workflow)

1. Ask for the PNG export folder if missing.
2. Run a dry run: `python scripts/prepare-sprites.py <folder> --dry-run`.
3. Run import + auto-catalog insertion:
   `python scripts/prepare-sprites.py <folder> --update-catalog`.
4. Add/update outfit presets in `outfits`, then run:
   - `python scripts/optimize-sprites.py --check`
   - `npm run lint`
   - `npm run format:check`
   - `npm run typecheck`
   - `npm test`
5. Follow the detailed instructions in the README section
   “Add a new outfit manually (end-to-end)”.

Requires Node.js 22.18+ in the 22.x line (as in CI), or 24.11+, and Python with Pillow (`pip install pillow`).
Follow [technical constraints](../../technical-constraints.md) and
[architecture](../../../docs/architecture.md). The app and its tests use TypeScript and Vite.
