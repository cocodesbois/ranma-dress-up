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
