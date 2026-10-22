import json
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "images" / "sprites"
CATALOG_SCRIPT = """
const fs = require("fs");
const vm = require("vm");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("sprite-catalog.js", "utf8"), context);
console.log(JSON.stringify(context.window.RanmaDressUpCatalog));
"""


def read_catalog():
    result = subprocess.run(
        ["node", "-e", CATALOG_SCRIPT],
        cwd=ROOT,
        capture_output=True,
        check=True,
        text=True,
    )
    return json.loads(result.stdout)


def read_animate_sprites():
    source = (ROOT / "index.js").read_text(encoding="utf-8")
    metadata = source.split("lib.ssMetadata = [", 1)[1].split("\n];", 1)[0]
    atlases = {}

    for atlas_match in re.finditer(
        r'\{name:"([^"]+)", frames: \[([\s\S]*?)\]\}', metadata
    ):
        atlases[atlas_match.group(1)] = [
            tuple(map(int, frame))
            for frame in re.findall(
                r"\[(\d+),(\d+),(\d+),(\d+)\]", atlas_match.group(2)
            )
        ]

    return source, atlases


def find_sprite_frame(symbol, source, atlases):
    declaration = re.search(
        rf'\(lib\.{re.escape(symbol)} = function\(\) \{{\s*'
        rf'this\.initialize\(ss\["([^"]+)"\]\);\s*'
        rf'this\.gotoAndStop\((\d+)\);',
        source,
    )
    if declaration is None:
        return None

    atlas_name, frame_number = declaration.groups()
    try:
        return atlas_name, atlases[atlas_name][int(frame_number)]
    except (KeyError, IndexError) as error:
        raise ValueError(f"Missing Animate frame for {symbol}: {atlas_name}") from error


def extract_sprite(asset, source, atlases):
    sprite_id = asset.get("id", "background")
    destination = OUTPUT_DIR / f"{sprite_id}.png"
    symbol = "bg001" if sprite_id == "background" else sprite_id
    frame_data = find_sprite_frame(symbol, source, atlases)

    if frame_data is None:
        original = ROOT / "images" / f"{sprite_id}.png"
        if not original.is_file():
            raise FileNotFoundError(f"No Animate sprite or standalone image found for {sprite_id}")
        shutil.copyfile(original, destination)
        print(f"Copied {destination.relative_to(ROOT)}")
        return

    atlas_name, (x, y, width, height) = frame_data
    original = ROOT / "images" / f"{atlas_name}.png"
    if not original.is_file():
        raise FileNotFoundError(f"Missing atlas image: {original}")

    if min(x, y) < 0 or min(width, height) <= 0:
        raise ValueError(f"Invalid frame for {sprite_id}: {(x, y, width, height)}")

    with Image.open(original) as image:
        if x + width > image.width or y + height > image.height:
            raise ValueError(f"Frame exceeds {original.name}: {sprite_id}")

        image.crop((x, y, x + width, y + height)).save(destination, optimize=True)

    print(f"Extracted {destination.relative_to(ROOT)}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = read_catalog()
    source, atlases = read_animate_sprites()
    assets = [catalog["background"], catalog["base"], *catalog["items"]]

    for asset in assets:
        extract_sprite(asset, source, atlases)

    print(f"Created {len(assets)} standalone sprite images.")


if __name__ == "__main__":
    main()
