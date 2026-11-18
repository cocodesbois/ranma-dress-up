"""Generate browser and installed-app icons from the original branding artwork.

Run from the repository root with: python scripts/generate-icons.py
"""

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

ROOT_DIR = Path(__file__).resolve().parent.parent
SOURCE = ROOT_DIR / "assets" / "branding" / "app-icon.png"
PUBLIC = ROOT_DIR / "public"
BACKGROUND = "#85c8f6"


def make_icon(artwork, size):
    """Fit the complete artwork inside a square icon without distortion."""
    icon = Image.new("RGBA", (size, size), BACKGROUND)
    fitted = ImageOps.contain(
        artwork, (round(size * 0.9), round(size * 0.9)), Image.Resampling.LANCZOS
    )
    icon.alpha_composite(
        fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2)
    )
    return icon


def main():
    """Write all icon sizes and an SVG wrapper from the same source artwork."""
    with Image.open(SOURCE) as image:
        artwork = image.convert("RGBA")

    icons = PUBLIC / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        make_icon(artwork, size).save(icons / f"icon-{size}.png", optimize=True)
    make_icon(artwork, 32).save(PUBLIC / "favicon.png", optimize=True)
    make_icon(artwork, 48).save(
        PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    buffer = BytesIO()
    artwork.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    (PUBLIC / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
        f'  <rect width="512" height="512" fill="{BACKGROUND}"/>\n'
        '  <image x="25.6" y="25.6" width="460.8" height="460.8" '
        f'href="data:image/png;base64,{encoded}" preserveAspectRatio="xMidYMid meet"/>\n'
        "</svg>\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
