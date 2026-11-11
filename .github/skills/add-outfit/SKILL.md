---
name: add-outfit
description: Add new outfit sprites to Ranma Dress Up. Use when the user adds PNGs exported from Photoshop, mentions a new outfit or new clothing items, asks to rename sprites, or replaces an existing sprite image.
---

# Add an outfit

1. Ask for the folder containing the exported PNGs if it was not given.
2. Dry run: `python scripts/prepare-sprites.py <folder> --dry-run`.
   - Prefixes before the category word are dropped: `xxx_xxx-top001.png` becomes `top001.png`. `accessoires` maps to the `accessories` category and `pant` to `pants`.
   - New files can be copied to a temporary folder first so the source folder is left untouched.
   - The script stops on unrecognized names, collisions with existing sprites, or duplicate targets. Never overwrite; ask the user how to resolve.
3. Run it again without `--dry-run`. It moves the files to `assets/sprites/` (the full-size exports, which stay untouched), generates `public/images/thumbnails/<item-id>.png`, builds the optimized sprite `public/images/optimized/<name>.webp` and updates `src/data/sprite-manifest.js`, and prints a catalog item snippet per file with both `thumbnailSource` and `thumbnail` crop metadata. The exports must have the same canvas size as the existing ones; the script stops otherwise.
4. Paste each snippet into `items` in `src/data/sprite-catalog.js`, next to items of the same category. Keep `thumbnailSource` and `thumbnail` together and check the `label` (existing labels sometimes differ from the file number).
5. Add an entry to `outfits` with the next free `id` and `label`. It needs `hair` and at least one clothing item; reuse existing items (for example `hair001`) when appropriate.
6. If any existing sprite PNG was replaced or edited, run `python scripts/optimize-sprites.py` (only changed files are converted), and regenerate all thumbnails with `python scripts/generate-thumbnails.py`.
7. Run `python scripts/optimize-sprites.py --check`; it must report that `public/images/optimized/` is up to date. The Pages workflow runs the same check.
8. Serve the app (`npm run dev`) and verify the new items and outfit render, line up with the base character, and show proper thumbnails.
9. Update `README.md` only if the preset list there needs it, then report the renames, thumbnail files, optimized files (`public/images/optimized/` and `src/data/sprite-manifest.js`, to be committed with the PNGs), and catalog changes.

Requires Python with Pillow (`pip install pillow`). Follow `.github/technical-constraints.md`.
