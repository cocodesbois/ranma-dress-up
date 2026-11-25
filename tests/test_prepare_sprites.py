import importlib.util
import io
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"


class PrepareSpritesTest(unittest.TestCase):
    def test_imports_jumpsuit_and_apron_aliases_without_touching_sources_in_dry_run(self):
        aliases = [
            ("jumpsuit", "jumpsuit", "jumpsuits", "Jumpsuit"),
            ("jumpsuits", "jumpsuit", "jumpsuits", "Jumpsuit"),
            ("apron", "apron", "aprons", "Apron"),
            ("aprons", "apron", "aprons", "Apron"),
            ("sock", "tights", "tights", "Tights"),
            ("socks", "tights", "tights", "Tights"),
        ]
        for word, prefix, category, label in aliases:
            with self.subTest(word=word), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = root / "exports"
                source.mkdir()
                original = source / f"outfit_{word}21.png"
                original.touch()
                optimizer = types.ModuleType("sprite_optimize")
                optimizer.optimize_all = Mock()
                thumbnails = types.ModuleType("thumbnail_utils")
                thumbnails.THUMBNAILS_DIR = root / "thumbnails"
                thumbnails.compute_alpha_bbox = Mock(return_value=(0, 0, 4, 4))
                thumbnails.write_thumbnail = Mock()
                spec = importlib.util.spec_from_file_location(
                    "prepare_sprites", SCRIPTS_DIR / "prepare-sprites.py"
                )
                module = importlib.util.module_from_spec(spec)
                with patch.dict(sys.modules, {
                    "sprite_optimize": optimizer,
                    "thumbnail_utils": thumbnails,
                }):
                    spec.loader.exec_module(module)
                output = io.StringIO()
                with (
                    patch.object(module, "SPRITES_DIR", root / "sprites"),
                    patch.object(sys, "argv", ["prepare-sprites.py", str(source), "--dry-run"]),
                    redirect_stdout(output),
                ):
                    module.main()
                snippet = output.getvalue()
                self.assertIn(f'category: "{category}"', snippet)
                self.assertIn(f'id: "{prefix}021"', snippet)
                self.assertIn(f'label: "{label} 21"', snippet)
                self.assertIn(f'source: "assets/sprites/{prefix}021.png"', snippet)
                self.assertTrue(original.is_file())
                self.assertFalse((root / "sprites").exists())
                optimizer.optimize_all.assert_not_called()
                thumbnails.write_thumbnail.assert_not_called()

    def test_update_catalog_items_sorts_items_and_adds_matching_outfit(self):
        catalog_text = """const catalog: Catalog = {
  categories: [
    { id: "tops", label: "Tops" },
    { id: "pants", label: "Pants" },
    { id: "dresses", label: "Dresses" },
    { id: "hair", label: "Hair" },
  ],
  // Categories that cannot be worn together.
  items: [
    {
      id: "top010",
      category: "tops",
      label: "Top 10",
      source: "assets/sprites/top010.png",
      thumbnailSource: "images/thumbnails/top010.png",
      thumbnail: { x: 1, y: 1, width: 1, height: 1 },
      placement: sharedSpritePlacement
    },
    {
      id: "pants005",
      category: "pants",
      label: "Pants 05",
      source: "assets/sprites/pants005.png",
      thumbnailSource: "images/thumbnails/pants005.png",
      thumbnail: { x: 2, y: 2, width: 2, height: 2 },
      placement: sharedSpritePlacement
    },
    {
      id: "hair001",
      category: "hair",
      label: "Hair 1",
      source: "assets/sprites/hair001.png",
      thumbnailSource: "images/thumbnails/hair001.png",
      thumbnail: { x: 0, y: 0, width: 1, height: 1 },
      placement: sharedSpritePlacement
    }
  ],
  outfits: [],
};"""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            optimizer = types.ModuleType("sprite_optimize")
            optimizer.optimize_all = Mock()
            thumbnails = types.ModuleType("thumbnail_utils")
            thumbnails.THUMBNAILS_DIR = root / "thumbnails"
            thumbnails.compute_alpha_bbox = Mock(return_value=(0, 0, 4, 4))
            thumbnails.write_thumbnail = Mock()
            spec = importlib.util.spec_from_file_location(
                "prepare_sprites", SCRIPTS_DIR / "prepare-sprites.py"
            )
            module = importlib.util.module_from_spec(spec)
            with patch.dict(sys.modules, {
                "sprite_optimize": optimizer,
                "thumbnail_utils": thumbnails,
            }):
                spec.loader.exec_module(module)

            catalog_path = root / "sprite-catalog.ts"
            catalog_path.write_text(catalog_text, encoding="utf-8")

            module.update_catalog_items(
                catalog_path,
                [
                    module.CatalogItemEntry(
                        id="top001",
                        category="tops",
                        label="Top 01",
                        source="assets/sprites/top001.png",
                        thumbnail_source="images/thumbnails/top001.png",
                        thumbnail=(0, 0, 5, 5),
                    ),
                    module.CatalogItemEntry(
                        id="pants001",
                        category="pants",
                        label="Pants 01",
                        source="assets/sprites/pants001.png",
                        thumbnail_source="images/thumbnails/pants001.png",
                        thumbnail=(0, 0, 6, 6),
                    ),
                ],
            )

            updated = catalog_path.read_text(encoding="utf-8")
            self.assertLess(updated.index('id: "top001"'), updated.index('id: "top010"'))
            self.assertLess(updated.index('id: "top010"'), updated.index('id: "pants001"'))
            self.assertLess(updated.index('id: "pants001"'), updated.index('id: "pants005"'))
            outfit = updated.split('outfits: [', 1)[1]
            self.assertIn('id: "001"', outfit)
            self.assertIn('label: "Outfit 01"', outfit)
            self.assertIn('tops: "top001"', outfit)
            self.assertIn('pants: "pants001"', outfit)
            self.assertIn('hair: "hair001"', outfit)

            module.update_catalog_items(
                catalog_path,
                [
                    module.CatalogItemEntry(
                        id="dress002",
                        category="dresses",
                        label="Dress 02",
                        source="assets/sprites/dress002.png",
                        thumbnail_source="images/thumbnails/dress002.png",
                        thumbnail=(0, 0, 5, 5),
                    ),
                    module.CatalogItemEntry(
                        id="hair002",
                        category="hair",
                        label="Hair 02",
                        source="assets/sprites/hair002.png",
                        thumbnail_source="images/thumbnails/hair002.png",
                        thumbnail=(0, 0, 5, 5),
                    ),
                ],
            )
            updated = catalog_path.read_text(encoding="utf-8")
            outfit = updated.split('id: "002"', 1)[1].split('    },', 1)[0]
            self.assertIn('dresses: "dress002"', outfit)
            self.assertIn('hair: "hair002"', outfit)
            self.assertNotIn('hair: "hair001"', outfit)
