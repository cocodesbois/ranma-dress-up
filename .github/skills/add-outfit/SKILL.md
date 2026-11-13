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
3. Run it again without `--dry-run`. It moves the files to `assets/sprites/` (the full-size exports, which stay untouched), generates `public/images/thumbnails/<item-id>.png`, builds the optimized sprite `public/images/optimized/<name>.webp` and updates `src/data/sprite-manifest.ts`, and prints a catalog item snippet per file with both `thumbnailSource` and `thumbnail` crop metadata. The exports must have the same canvas size as the existing ones; the script stops otherwise.
4. Paste each snippet into `items` in `src/data/sprite-catalog.ts`, next to items of the same category. Keep `thumbnailSource` and `thumbnail` together and check the `label` (existing labels sometimes differ from the file number). This TypeScript module exports the catalog by default; follow the `Item` contract in `src/types.ts`. Keep `source` as the stable `assets/sprites/<name>.png` manifest key and `thumbnailSource` as `images/thumbnails/<item-id>.png`, without `public/`.
5. Add an entry to `outfits` with the next free `id` and `label`, following the `Outfit` contract (category IDs mapped to item IDs, not item objects or filenames). It needs `hair` and at least one clothing item; reuse existing items (for example `hair001`) when appropriate. Do not edit the live `Look` or the controller to add a preset.
6. If any existing sprite PNG was replaced or edited, run `python scripts/optimize-sprites.py` (only changed files are converted), and regenerate all thumbnails with `python scripts/generate-thumbnails.py`.
7. Run `python scripts/optimize-sprites.py --check`; it must report that `public/images/optimized/` is up to date. The Pages workflow runs the same check.
8. Run `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test`. Install Node dependencies first if missing (`npm ci`). The catalog unit tests validate real presets as well as IDs, category references and hair/clothing requirements; the type check validates the TypeScript data shape. Neither replaces visual validation.
9. During the Vite migration, leave browser checks to the maintainer: serve with `npm run dev`, then verify new items/presets, alignment with the base and thumbnails. For the production check, run `npm run build` then `npm run preview`; CI also builds, and Pages publishes only `dist/`. Do not launch browser checks as the assistant during this migration.
10. Update `README.md` only if the preset list there needs it, then report the renames, thumbnail files, optimized files (`public/images/optimized/` and `src/data/sprite-manifest.ts`, to be committed with the PNGs), and catalog changes. Keep the generated manifest header in the Python template; never hand-edit generated offsets or URLs.

Requires Node.js 22.18+ in the 22.x line (as in CI), or 24.11+, and Python with Pillow (`pip install pillow`).
Follow [technical constraints](../../technical-constraints.md) and
[architecture](../../../docs/architecture.md). The app and its tests use TypeScript and Vite.
