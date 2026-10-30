"""Normalize exported outfit sprite names and print catalog thumbnail data.

Usage: python scripts/prepare-sprites.py <source-folder> [--dry-run]

Files like "xxx_xxx-top001.png" are renamed to "top001.png" and moved to
images/sprites/. Existing files are never overwritten. For each file, the
catalog item snippet is printed with the thumbnail crop computed from the
bounding box of the non-transparent pixels (requires Pillow).
"""
import argparse
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

# Filename word (any accepted spelling) -> (canonical file prefix, category ID, label word)
CATEGORIES = {
    "bodysuit": ("bodysuit", "bodysuits", "Bodysuit"),
    "bodysuits": ("bodysuit", "bodysuits", "Bodysuit"),
    "underwear": ("underwear", "underwear", "Underwear"),
    "slip": ("slip", "slips", "Slip"),
    "slips": ("slip", "slips", "Slip"),
    "tights": ("tights", "tights", "Tights"),
    "top": ("top", "tops", "Top"),
    "tops": ("top", "tops", "Top"),
    "dress": ("dress", "dresses", "Dress"),
    "dresses": ("dress", "dresses", "Dress"),
    "pant": ("pants", "pants", "Pants"),
    "pants": ("pants", "pants", "Pants"),
    "hair": ("hair", "hair", "Hair"),
    "hat": ("hat", "hats", "Hat"),
    "hats": ("hat", "hats", "Hat"),
    "shoes": ("shoes", "shoes", "Shoes"),
    "necklace": ("necklace", "necklace", "Necklace"),
    "bracelets": ("bracelets", "bracelets", "Bracelets"),
}
# Longest alternatives first so "pants" wins over "pant".
WORDS = "|".join(sorted(CATEGORIES, key=len, reverse=True))
NAME_PATTERN = re.compile(rf"^(?:.*[^a-z])?({WORDS})(\d+)\.png$", re.IGNORECASE)
SPRITES_DIR = Path(__file__).resolve().parent.parent / "images" / "sprites"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    plan, errors = [], []
    for file in sorted(args.source.glob("*.png")):
        match = NAME_PATTERN.match(file.name)
        if not match:
            errors.append(f"No category/number found in: {file.name}")
            continue
        word, number = match.group(1).lower(), match.group(2).zfill(3)
        prefix, category, label_word = CATEGORIES[word]
        target = SPRITES_DIR / f"{prefix}{number}.png"
        if target.exists() and target.resolve() != file.resolve():
            errors.append(f"Target already exists: {target.name} (from {file.name})")
            continue
        plan.append((file, target, category, f"{label_word} {number[1:]}"))

    names = [p[1].name for p in plan]
    for name in sorted({n for n in names if names.count(n) > 1}):
        errors.append(f"Several files map to {name}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    for file, target, category, label in plan:
        print(f"{file.name} -> {target.name}")
        if not args.dry_run and file.resolve() != target.resolve():
            shutil.move(str(file), str(target))
        with Image.open(file if args.dry_run else target) as image:
            box = image.convert("RGBA").getchannel("A").getbbox()
        if box is None:
            print(f"  WARNING: {target.name} is fully transparent", file=sys.stderr)
            continue
        x, y, right, bottom = box
        print(
            "    {\n"
            f'      id: "{target.stem}",\n'
            f'      category: "{category}",\n'
            f'      label: "{label}",\n'
            f'      source: "images/sprites/{target.name}",\n'
            f"      thumbnail: {{ x: {x}, y: {y}, width: {right - x}, height: {bottom - y} }},\n"
            "      placement: sharedSpritePlacement\n"
            "    },"
        )


if __name__ == "__main__":
    main()
