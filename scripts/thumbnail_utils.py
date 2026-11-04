"""Shared thumbnail helpers for sprite tooling."""

from pathlib import Path

from PIL import Image

THUMBNAIL_CANVAS_SIZE = 112
THUMBNAIL_CONTENT_SIZE = 88
THUMBNAILS_DIR = Path(__file__).resolve().parent.parent / "images" / "thumbnails"


def compute_alpha_bbox(image_path):
    """Return (x, y, width, height) of non-transparent pixels, or None if empty."""
    with Image.open(image_path) as image:
        box = image.convert("RGBA").getchannel("A").getbbox()
    if box is None:
        return None
    left, top, right, bottom = box
    return left, top, right - left, bottom - top


def write_thumbnail(source_path, item_id, crop_box, output_dir=THUMBNAILS_DIR):
    """Write a centered 112x112 thumbnail PNG from source and crop box."""
    x, y, width, height = crop_box
    output_dir.mkdir(parents=True, exist_ok=True)
    thumbnail_path = output_dir / f"{item_id}.png"

    with Image.open(source_path).convert("RGBA") as source_image:
        left = max(0, x)
        top = max(0, y)
        right = min(source_image.width, x + width)
        bottom = min(source_image.height, y + height)
        if right <= left or bottom <= top:
            raise ValueError(f"Invalid crop box for {source_path.name}: {crop_box}")

        cropped = source_image.crop((left, top, right, bottom))
        scale = min(THUMBNAIL_CONTENT_SIZE / cropped.width, THUMBNAIL_CONTENT_SIZE / cropped.height)
        target_width = max(1, round(cropped.width * scale))
        target_height = max(1, round(cropped.height * scale))
        resized = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)

        thumbnail = Image.new("RGBA", (THUMBNAIL_CANVAS_SIZE, THUMBNAIL_CANVAS_SIZE), (0, 0, 0, 0))
        offset_x = (THUMBNAIL_CANVAS_SIZE - target_width) // 2
        offset_y = (THUMBNAIL_CANVAS_SIZE - target_height) // 2
        thumbnail.paste(resized, (offset_x, offset_y), resized)
        thumbnail.save(thumbnail_path, "PNG")

    return thumbnail_path
