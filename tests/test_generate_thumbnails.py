import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

thumbnail_utils = types.ModuleType("thumbnail_utils")
thumbnail_utils.THUMBNAILS_DIR = Path("thumbnails")


def write_thumbnail(source_path, item_id, crop_box, output_dir):
    thumbnail_path = output_dir / f"{item_id}.png"
    output_dir.mkdir(parents=True, exist_ok=True)
    thumbnail_path.touch()
    return thumbnail_path


thumbnail_utils.write_thumbnail = write_thumbnail
sys.modules["thumbnail_utils"] = thumbnail_utils

GENERATOR_SPEC = importlib.util.spec_from_file_location(
    "generate_thumbnails", SCRIPTS_DIR / "generate-thumbnails.py"
)
generate_thumbnails = importlib.util.module_from_spec(GENERATOR_SPEC)
sys.modules[GENERATOR_SPEC.name] = generate_thumbnails
GENERATOR_SPEC.loader.exec_module(generate_thumbnails)


class GenerateThumbnailsTest(unittest.TestCase):
    def test_generates_custom_thumbnail_source_filename(self):
        catalog_text = """
        items: [
          {
            id: "top001",
            source: "assets/sprites/top001.png",
            thumbnailSource: "images/thumbnails/custom-name.png",
            thumbnail: { x: 0, y: 0, width: 4, height: 4 },
            placement: sharedSpritePlacement
          },
        ],
        outfits:
        """

        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source_path = root / "assets" / "sprites" / "top001.png"
            source_path.parent.mkdir(parents=True)
            source_path.touch()
            catalog_path = root / "sprite-catalog.ts"
            catalog_path.write_text(catalog_text, encoding="utf-8")
            thumbnails_dir = root / "public" / "images" / "thumbnails"

            with (
                patch.object(generate_thumbnails, "ROOT_DIR", root),
                patch.object(generate_thumbnails, "CATALOG_PATH", catalog_path),
                patch.object(generate_thumbnails, "THUMBNAILS_DIR", thumbnails_dir),
                patch.object(sys, "argv", ["generate-thumbnails.py"]),
            ):
                generate_thumbnails.main()

            self.assertTrue((thumbnails_dir / "custom-name.png").is_file())
            self.assertFalse((thumbnails_dir / "top001.png").exists())


if __name__ == "__main__":
    unittest.main()
