"""Normalize exported outfit sprite names, generate thumbnails and optimized WebP sprites, and print catalog snippets.

Usage: python scripts/prepare-sprites.py <source-folder> [--dry-run] [--update-catalog]

Files like "xxx_xxx-top001.png" are renamed to "top001.png" and moved to
assets/sprites/. Existing files are never overwritten. For each file, the
catalog item snippet is printed with the thumbnail crop computed from the
bounding box of the non-transparent pixels, and a static thumbnail file is
written to public/images/thumbnails/ (requires Pillow). Finally the optimized WebP sprites
and src/data/sprite-manifest.ts are updated for the new files (same as
scripts/optimize-sprites.py).
"""
import argparse
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from sprite_optimize import optimize_all
from thumbnail_utils import THUMBNAILS_DIR, compute_alpha_bbox, write_thumbnail

# Filename word (any accepted spelling) -> (canonical file prefix, category ID, label word)
CATEGORIES = {
    "bodysuit": ("bodysuit", "bodysuits", "Bodysuit"),
    "bodysuits": ("bodysuit", "bodysuits", "Bodysuit"),
    "jumpsuit": ("jumpsuit", "jumpsuits", "Jumpsuit"),
    "jumpsuits": ("jumpsuit", "jumpsuits", "Jumpsuit"),
    "apron": ("apron", "aprons", "Apron"),
    "aprons": ("apron", "aprons", "Apron"),
    "underwear": ("underwear", "underwear", "Underwear"),
    "slip": ("slip", "slips", "Slip"),
    "slips": ("slip", "slips", "Slip"),
    "tights": ("tights", "tights", "Tights"),
    "top": ("top", "tops", "Top"),
    "tops": ("top", "tops", "Top"),
    "glove": ("gloves", "gloves", "Gloves"),
    "gloves": ("gloves", "gloves", "Gloves"),
    "dress": ("dress", "dresses", "Dress"),
    "dresses": ("dress", "dresses", "Dress"),
    "pant": ("pants", "pants", "Pants"),
    "pants": ("pants", "pants", "Pants"),
    "hair": ("hair", "hair", "Hair"),
    "hat": ("hat", "hats", "Hat"),
    "hats": ("hat", "hats", "Hat"),
    "glasses": ("glasses", "glasses", "Glasses"),
    "sock": ("tights", "tights", "Tights"),
    "socks": ("tights", "tights", "Tights"),
    "shoes": ("shoes", "shoes", "Shoes"),
    "necklace": ("necklace", "necklace", "Necklace"),
    "bracelets": ("bracelets", "bracelets", "Bracelets"),
    "accessoires": ("accessories", "accessories", "Accessories"),
    "accessories": ("accessories", "accessories", "Accessories"),
}
# Longest alternatives first so "pants" wins over "pant".
WORDS = "|".join(sorted(CATEGORIES, key=len, reverse=True))
NAME_PATTERN = re.compile(rf"^(?:.*[^a-z])?({WORDS})(\d+)\.png$", re.IGNORECASE)
SPRITES_DIR = Path(__file__).resolve().parent.parent / "assets" / "sprites"
CATALOG_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "sprite-catalog.ts"
ITEMS_SECTION_PATTERN = re.compile(
    r"items:\s*\[(?P<body>[\s\S]*?)\],\s*outfits:",
    re.MULTILINE,
)
OUTFITS_SECTION_PATTERN = re.compile(
    r"outfits:\s*\[(?P<body>[\s\S]*?)\],",
    re.MULTILINE,
)
ITEM_BLOCK_PATTERN = re.compile(
    r"\{[\s\S]*?placement:\s*sharedSpritePlacement\s*,?\s*\},?", re.MULTILINE
)
ID_PATTERN = re.compile(r'id:\s*"([^"]+)"')
CATEGORY_PATTERN = re.compile(r'category:\s*"([^"]+)"')
CATEGORIES_SECTION_PATTERN = re.compile(
    r"categories:\s*\[(?P<body>[\s\S]*?)\],\s*[\r\n]+\s*// Categories",
    re.MULTILINE,
)
CATEGORY_ID_PATTERN = re.compile(r'id:\s*"([^"]+)"')


@dataclass(frozen=True)
class CatalogItemEntry:
    id: str
    category: str
    label: str
    source: str
    thumbnail_source: str
    thumbnail: tuple[int, int, int, int]


@dataclass(frozen=True)
class ExistingCatalogItem:
    id: str
    category: str
    block: str


def _normalize_block(block: str) -> str:
    lines = [line.rstrip() for line in block.strip().splitlines()]
    if lines and lines[-1].endswith(","):
        lines[-1] = lines[-1][:-1]
    return "\n".join(f"    {line.lstrip()}" for line in lines)


def _format_catalog_item(item: CatalogItemEntry) -> str:
    x, y, width, height = item.thumbnail
    return (
        "    {\n"
        f'      id: "{item.id}",\n'
        f'      category: "{item.category}",\n'
        f'      label: "{item.label}",\n'
        f'      source: "{item.source}",\n'
        f'      thumbnailSource: "{item.thumbnail_source}",\n'
        f"      thumbnail: {{ x: {x}, y: {y}, width: {width}, height: {height} }},\n"
        "      placement: sharedSpritePlacement\n"
        "    }"
    )


def _parse_category_order(catalog_text: str) -> list[str]:
    categories_match = CATEGORIES_SECTION_PATTERN.search(catalog_text)
    if not categories_match:
        raise RuntimeError("Could not find catalog categories in sprite-catalog.ts.")
    return CATEGORY_ID_PATTERN.findall(categories_match.group("body"))


def _parse_existing_items(items_body: str) -> list[ExistingCatalogItem]:
    parsed: list[ExistingCatalogItem] = []
    for block_match in ITEM_BLOCK_PATTERN.finditer(items_body):
        block = block_match.group(0)
        id_match = ID_PATTERN.search(block)
        category_match = CATEGORY_PATTERN.search(block)
        if not id_match or not category_match:
            continue
        parsed.append(
            ExistingCatalogItem(
                id=id_match.group(1),
                category=category_match.group(1),
                block=_normalize_block(block),
            )
        )
    return parsed


def _format_catalog_outfit(outfit_id: str, items: dict[str, str]) -> str:
    item_lines = ",\n".join(
        f'        {category}: "{item_id}"' for category, item_id in items.items()
    )
    return (
        "    {\n"
        f'      id: "{outfit_id}",\n'
        f'      label: "Outfit {int(outfit_id):02d}",\n'
        "      items: {\n"
        f"{item_lines}\n"
        "      },\n"
        "    }"
    )


def _new_catalog_outfits(
    catalog_text: str,
    new_items: list[CatalogItemEntry],
    category_order: list[str],
    available_item_ids: set[str],
) -> list[tuple[str, str]]:
    outfits_match = OUTFITS_SECTION_PATTERN.search(catalog_text)
    if not outfits_match:
        raise RuntimeError("Could not find the outfits section in sprite-catalog.ts.")

    existing_ids = set(ID_PATTERN.findall(outfits_match.group("body")))

    grouped: dict[str, dict[str, str]] = {}
    for item in new_items:
        number_match = re.search(r"(\d+)$", item.id)
        if not number_match:
            raise RuntimeError(f'Could not determine outfit ID from catalog item "{item.id}".')
        outfit_id = number_match.group(1)
        category_items = grouped.setdefault(outfit_id, {})
        if item.category in category_items:
            raise RuntimeError(
                f'Cannot create outfit "{outfit_id}": multiple new items use category "{item.category}".'
            )
        category_items[item.category] = item.id

    clothing_categories = {
        "bodysuits", "jumpsuits", "underwear", "slips", "tights",
        "tops", "dresses", "pants",
    }
    new_outfits = []
    for outfit_id in sorted(grouped, key=int):
        outfit_items = grouped[outfit_id]
        if not clothing_categories.intersection(outfit_items):
            continue
        if outfit_id in existing_ids:
            raise RuntimeError(f'Outfit "{outfit_id}" already exists in sprite-catalog.ts.')
        if "hair" not in outfit_items:
            if "hair001" not in available_item_ids:
                raise RuntimeError(
                    f'Cannot create outfit "{outfit_id}": default hair item "hair001" is missing.'
                )
            outfit_items["hair"] = "hair001"
        ordered_items = {
            category: outfit_items[category]
            for category in category_order
            if category in outfit_items
        }
        new_outfits.append((outfit_id, _format_catalog_outfit(outfit_id, ordered_items)))
    return new_outfits


def update_catalog_items(catalog_path: Path, new_items: list[CatalogItemEntry]) -> None:
    catalog_text = catalog_path.read_text(encoding="utf-8")
    items_section_match = ITEMS_SECTION_PATTERN.search(catalog_text)
    if not items_section_match:
        raise RuntimeError("Could not find the items section in sprite-catalog.ts.")

    category_order = _parse_category_order(catalog_text)
    category_index = {category_id: index for index, category_id in enumerate(category_order)}

    existing_items = _parse_existing_items(items_section_match.group("body"))
    all_ids = {item.id for item in existing_items}
    for item in new_items:
        if item.id in all_ids:
            raise RuntimeError(f'Catalog item "{item.id}" already exists in sprite-catalog.ts.')
        if item.category not in category_index:
            raise RuntimeError(f'Unknown catalog category "{item.category}" for item "{item.id}".')
        all_ids.add(item.id)

    new_outfits = _new_catalog_outfits(catalog_text, new_items, category_order, all_ids)
    merged = existing_items + [
        ExistingCatalogItem(
            id=item.id,
            category=item.category,
            block=_format_catalog_item(item),
        )
        for item in new_items
    ]
    merged.sort(key=lambda item: (category_index.get(item.category, len(category_index)), item.id))

    items_body = "\n" + ",\n".join(item.block for item in merged) + "\n  "
    updated_text = (
        catalog_text[: items_section_match.start("body")]
        + items_body
        + catalog_text[items_section_match.end("body") :]
    )
    if new_outfits:
        outfits_section_match = OUTFITS_SECTION_PATTERN.search(updated_text)
        if not outfits_section_match:
            raise RuntimeError("Could not find the outfits section in sprite-catalog.ts.")
        existing_outfits = outfits_section_match.group("body").rstrip()
        appended_outfits = ",\n".join(outfit for _, outfit in new_outfits)
        outfits_body = (
            existing_outfits
            + (",\n" if existing_outfits else "\n")
            + appended_outfits
            + "\n  "
        )
        updated_text = (
            updated_text[: outfits_section_match.start("body")]
            + outfits_body
            + updated_text[outfits_section_match.end("body") :]
        )
    catalog_path.write_text(updated_text, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--update-catalog",
        action="store_true",
        help="Insert newly prepared items into src/data/sprite-catalog.ts in category/id order.",
    )
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

    new_catalog_items: list[CatalogItemEntry] = []
    for file, target, category, label in plan:
        print(f"{file.name} -> {target.name}")
        if not args.dry_run and file.resolve() != target.resolve():
            shutil.move(str(file), str(target))
        source_path = file if args.dry_run else target
        crop = compute_alpha_bbox(source_path)
        if crop is None:
            print(f"  WARNING: {target.name} is fully transparent", file=sys.stderr)
            continue
        x, y, width, height = crop
        if not args.dry_run:
            thumbnail_path = write_thumbnail(source_path, target.stem, crop, THUMBNAILS_DIR)
            print(f"  thumbnail -> {thumbnail_path.name}")
        entry = CatalogItemEntry(
            id=target.stem,
            category=category,
            label=label,
            source=f"assets/sprites/{target.name}",
            thumbnail_source=f"images/thumbnails/{target.stem}.png",
            thumbnail=(x, y, width, height),
        )
        new_catalog_items.append(entry)
        print(
            "    {\n"
            + _format_catalog_item(entry).split("\n", 1)[1]
            + ","
        )

    if args.update_catalog and new_catalog_items and not args.dry_run:
        update_catalog_items(CATALOG_PATH, new_catalog_items)
        print("\nCatalog updated: src/data/sprite-catalog.ts")

    if plan and not args.dry_run:
        print("\nOptimizing sprites for the app...")
        if not optimize_all():
            sys.exit(1)


if __name__ == "__main__":
    main()
