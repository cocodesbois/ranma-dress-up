"""Generate static thumbnail PNG files for all catalog items.

Usage:
  python scripts/generate-thumbnails.py
  python scripts/generate-thumbnails.py --only top001 dress007
"""

import argparse
import re
import sys
from pathlib import Path

from thumbnail_utils import THUMBNAILS_DIR, write_thumbnail

ROOT_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT_DIR / "src" / "data" / "sprite-catalog.js"

ITEMS_SECTION_PATTERN = re.compile(
    r"items:\s*\[(?P<body>[\s\S]*?)\],\s*outfits:",
    re.MULTILINE,
)
ITEM_BLOCK_PATTERN = re.compile(
    r"\{[\s\S]*?placement:\s*sharedSpritePlacement\s*,?\s*\},?", re.MULTILINE
)
ID_PATTERN = re.compile(r'id:\s*"([^"]+)"')
SOURCE_PATTERN = re.compile(r'source:\s*"(assets/sprites/[^"]+)"')
THUMBNAIL_PATTERN = re.compile(
    r"thumbnail:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}"
)


def parse_catalog_items(catalog_text):
    items_section_match = ITEMS_SECTION_PATTERN.search(catalog_text)
    if not items_section_match:
        return []
    items_section = items_section_match.group("body")

    items = []
    for block_match in ITEM_BLOCK_PATTERN.finditer(items_section):
        block = block_match.group(0)
        id_match = ID_PATTERN.search(block)
        source_match = SOURCE_PATTERN.search(block)
        thumbnail_match = THUMBNAIL_PATTERN.search(block)
        if not id_match or not source_match or not thumbnail_match:
            continue
        items.append(
            {
                "id": id_match.group(1),
                "source": source_match.group(1),
                "thumbnail": (
                    int(thumbnail_match.group(1)),
                    int(thumbnail_match.group(2)),
                    int(thumbnail_match.group(3)),
                    int(thumbnail_match.group(4)),
                ),
            }
        )
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", default=[], help="Generate only specific item IDs")
    args = parser.parse_args()

    catalog_text = CATALOG_PATH.read_text(encoding="utf-8")
    items = parse_catalog_items(catalog_text)
    if not items:
        print("No catalog items with thumbnail metadata found.", file=sys.stderr)
        sys.exit(1)

    selected_ids = set(args.only)
    generated = 0
    for item in items:
        if selected_ids and item["id"] not in selected_ids:
            continue
        source_path = ROOT_DIR / item["source"]
        if not source_path.exists():
            print(f"Missing source image: {item['source']}", file=sys.stderr)
            sys.exit(1)
        thumbnail_path = write_thumbnail(source_path, item["id"], item["thumbnail"], THUMBNAILS_DIR)
        generated += 1
        print(f"{item['id']}: {thumbnail_path.relative_to(ROOT_DIR)}")

    if selected_ids and generated != len(selected_ids):
        generated_ids = {item["id"] for item in items}
        missing = sorted(selected_ids - generated_ids)
        if missing:
            print(f"Unknown item IDs in --only: {', '.join(missing)}", file=sys.stderr)
            sys.exit(1)

    print(f"Generated {generated} thumbnail(s).")


if __name__ == "__main__":
    main()
