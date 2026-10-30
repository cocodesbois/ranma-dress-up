---
name: add-outfit
description: Add new outfit sprites to Ranma Dress Up. Use when the user adds PNGs exported from Photoshop, mentions a new outfit or new clothing items, or asks to rename sprites.
---

# Add an outfit

1. Ask for the folder containing the exported PNGs if it was not given.
2. Dry run: `python scripts/prepare-sprites.py <folder> --dry-run`.
   - Prefixes before the category word are dropped: `xxx_xxx-top001.png` becomes `top001.png`.
   - The script stops on unrecognized names, collisions with existing sprites, or duplicate targets. Never overwrite; ask the user how to resolve.
3. Run it again without `--dry-run`. It moves the files to `images/sprites/` and prints a catalog item snippet per file, with the `thumbnail` crop computed from the bounding box of non-transparent pixels.
4. Paste each snippet into `items` in `sprite-catalog.js`, next to items of the same category. Check the `label` (existing labels sometimes differ from the file number).
5. Add an entry to `outfits` with the next free `id` and `label`. It needs `hair` and at least one clothing item; reuse existing items (for example `hair001`) when appropriate.
6. Serve the app (`npx http-server .`) and verify the new items and outfit render and show proper thumbnails.
7. Update `README.md` only if the preset list there needs it, then report the renames and catalog changes.

Requires Python with Pillow (`pip install pillow`). Follow `.github/technical-constraints.md`.
