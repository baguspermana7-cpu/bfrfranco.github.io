#!/usr/bin/env python3
"""
Build per-page Open Graph social preview images (1200×630 WebP) for resistancezero.com.

Usage:
    python3 tools/build-og-images.py           # dry run: show what would be generated
    python3 tools/build-og-images.py --apply   # generate missing images
    python3 tools/build-og-images.py --force   # regenerate all images
    python3 tools/build-og-images.py --apply --update-html  # generate + patch meta tags

Font fallback chain:
    1. Ubuntu-B.ttf / Ubuntu-R.ttf / UbuntuMono-R.ttf  (system, Ubuntu 22.04+)
    2. LiberationSans-Bold.ttf / LiberationSans-Regular.ttf / LiberationMono-Regular.ttf
    3. PIL default font (ImageFont.load_default)
"""

import argparse
import math
import os
import random
import re
import sys
import textwrap
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    print("ERROR: Pillow not installed. Run: pip3 install Pillow", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Output directory
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = REPO_ROOT / "assets" / "og"

# ---------------------------------------------------------------------------
# Per-page targets: (slug, title, subtitle, accent_hex)
# ---------------------------------------------------------------------------
TARGETS = [
    (
        "index",
        "Bagus Dwi Permana",
        "Engineering Operations Leader · Hyperscale Data Centers · Mission-Critical Infrastructure",
        "#fbbf24",
    ),
    (
        "datacenter-solutions",
        "Data Center Solutions",
        "Engineering hubs, calculators, and operator-grade simulations for hyperscale + AI-factory builds.",
        "#10b981",
    ),
    (
        "articles",
        "Technical Articles",
        "27+ field reports on PUE, OPEX, cooling, energy, automation, and resilience.",
        "#3b82f6",
    ),
    (
        "pue-calculator",
        "PUE Calculator",
        "Power Usage Effectiveness modelling — climate, tier, cooling-system inputs.",
        "#8b5cf6",
    ),
    (
        "capex-calculator",
        "CAPEX Calculator",
        "Build cost projection by IT load, tier, and country (30+ countries).",
        "#f59e0b",
    ),
    (
        "opex-calculator",
        "OPEX Calculator",
        "Annual operating cost — country-tuned, climate-adjusted, 3 staffing models.",
        "#10b981",
    ),
    (
        "roi-calculator",
        "ROI Calculator",
        "5-year investment payback projection for DC operators.",
        "#3b82f6",
    ),
    (
        "tco-calculator",
        "TCO Calculator",
        "10-year total cost of ownership for data center programs.",
        "#7DDDB4",
    ),
    (
        "cx-calculator",
        "CX Calculator",
        "L0–L6 commissioning cost + Gantt + Monte Carlo simulation.",
        "#a855f7",
    ),
    (
        "carbon-footprint",
        "Carbon Footprint Calculator",
        "Annual CO₂ from facility operations and grid mix.",
        "#22c55e",
    ),
    (
        "dc-market-tracker",
        "DC Market Tracker",
        "Global hyperscale market trend monitor with real-time map.",
        "#fbbf24",
    ),
    (
        "pln-java-grid",
        "PLN Java-Bali Grid Monitor",
        "Indonesia transmission system viewer — Geographic + SLD views.",
        "#ef4444",
    ),
]

# ---------------------------------------------------------------------------
# HTML page map: slug → filename (for --update-html)
# ---------------------------------------------------------------------------
HTML_FILES = {
    "index": "index.html",
    "datacenter-solutions": "datacenter-solutions.html",
    "articles": "articles.html",
    "pue-calculator": "pue-calculator.html",
    "capex-calculator": "capex-calculator.html",
    "opex-calculator": "opex-calculator.html",
    "roi-calculator": "roi-calculator.html",
    "tco-calculator": "tco-calculator.html",
    "cx-calculator": "cx-calculator.html",
    "carbon-footprint": "carbon-footprint.html",
    "dc-market-tracker": "dc-market-tracker.html",
    "pln-java-grid": "pln-java-grid.html",
}

# ---------------------------------------------------------------------------
# Font discovery
# ---------------------------------------------------------------------------
FONT_SEARCH_ROOTS = [
    Path("/usr/share/fonts"),
    Path("/usr/local/share/fonts"),
    Path.home() / ".fonts",
    Path.home() / ".local/share/fonts",
]

FONT_CANDIDATES = {
    "bold": [
        "ubuntu/Ubuntu-B.ttf",
        "ubuntu/UbuntuSans[wdth,wght].ttf",
        "dejavu/DejaVuSans-Bold.ttf",
        "liberation/LiberationSans-Bold.ttf",
    ],
    "regular": [
        "ubuntu/Ubuntu-R.ttf",
        "ubuntu/UbuntuSans[wdth,wght].ttf",
        "dejavu/DejaVuSans.ttf",
        "liberation/LiberationSans-Regular.ttf",
    ],
    "mono": [
        "ubuntu/UbuntuMono-R.ttf",
        "ubuntu/UbuntuMono[wght].ttf",
        "liberation/LiberationMono-Regular.ttf",
        "dejavu/DejaVuSansMono.ttf",
    ],
}


def _find_font(style: str) -> Path | None:
    candidates = FONT_CANDIDATES.get(style, [])
    for root in FONT_SEARCH_ROOTS:
        for candidate in candidates:
            p = root / "truetype" / candidate
            if p.exists():
                return p
            # also try without "truetype/" sub-dir
            p2 = root / candidate
            if p2.exists():
                return p2
    return None


def _load_font(style: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = _find_font(style)
    if path:
        try:
            return ImageFont.truetype(str(path), size)
        except Exception:
            pass
    print(f"  [WARN] font '{style}' not found, using PIL default", file=sys.stderr)
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
def _hex(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rgba(h: str, a: int = 255) -> tuple[int, int, int, int]:
    r, g, b = _hex(h)
    return r, g, b, a


# ---------------------------------------------------------------------------
# Core image builder
# ---------------------------------------------------------------------------
W, H = 1200, 630

BG_TOP_LEFT = "#0f172a"
BG_BOT_RIGHT = "#1e293b"
TITLE_COLOR = "#f1f5f9"
SUBTITLE_COLOR = "#94a3b8"
BRAND_COLOR = "#fbbf24"
STRIP_COLOR = "#7DDDB4"

BORDER_STOPS = ["#fbbf24", "#10b981", "#3b82f6"]


def _make_gradient_bg() -> Image.Image:
    """Dark-slate linear gradient top-left → bottom-right."""
    img = Image.new("RGB", (W, H))
    tl = _hex(BG_TOP_LEFT)
    br = _hex(BG_BOT_RIGHT)
    for y in range(H):
        for x in range(W):
            t = (x / W + y / H) / 2
            r = int(tl[0] + (br[0] - tl[0]) * t)
            g = int(tl[1] + (br[1] - tl[1]) * t)
            b = int(tl[2] + (br[2] - tl[2]) * t)
            img.putpixel((x, y), (r, g, b))
    return img


def _add_radial_blob(img: Image.Image, accent_hex: str) -> None:
    """Soft radial accent blob at ~30% from top-left, 8% max opacity."""
    blob = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(blob)
    cx, cy = int(W * 0.28), int(H * 0.30)
    radius = int(W * 0.42)
    ar, ag, ab = _hex(accent_hex)
    max_alpha = 20  # 8% of 255 ≈ 20
    for r in range(radius, 0, -max(1, radius // 60)):
        alpha = int(max_alpha * (1 - r / radius) ** 1.5)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(ar, ag, ab, alpha),
        )
    img.paste(blob, (0, 0), blob)


def _add_grain(img: Image.Image) -> None:
    """Subtle noise overlay at ~4% opacity."""
    noise = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pixels = noise.load()
    rng = random.Random(42)  # deterministic
    for y in range(H):
        for x in range(W):
            v = rng.randint(0, 255)
            pixels[x, y] = (v, v, v, 10)  # 10/255 ≈ 4%
    img.paste(Image.alpha_composite(img.convert("RGBA"), noise).convert("RGB"), (0, 0))


def _add_bottom_border(img: Image.Image) -> None:
    """4px gradient strip at bottom (gold → emerald → blue)."""
    strip = Image.new("RGB", (W, 4))
    stops = [_hex(c) for c in BORDER_STOPS]
    seg = W // (len(stops) - 1)
    for x in range(W):
        seg_idx = min(x // seg, len(stops) - 2)
        t = (x - seg_idx * seg) / seg
        c0, c1 = stops[seg_idx], stops[seg_idx + 1]
        r = int(c0[0] + (c1[0] - c0[0]) * t)
        g = int(c0[1] + (c1[1] - c0[1]) * t)
        b = int(c0[2] + (c1[2] - c0[2]) * t)
        strip.putpixel((x, 0), (r, g, b))
        strip.putpixel((x, 1), (r, g, b))
        strip.putpixel((x, 2), (r, g, b))
        strip.putpixel((x, 3), (r, g, b))
    img.paste(strip, (0, H - 4))


def _wrapped_lines(text: str, font, max_width: int, max_lines: int) -> list[str]:
    """Word-wrap text to fit max_width pixels, capped at max_lines."""
    words = text.split()
    lines = []
    current = ""
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines[:max_lines]


def build_og_image(slug: str, title: str, subtitle: str, accent_hex: str) -> Image.Image:
    """Render a 1200×630 OG card and return the PIL Image."""
    img = _make_gradient_bg()

    _add_radial_blob(img, accent_hex)
    _add_grain(img)
    _add_bottom_border(img)

    draw = ImageDraw.Draw(img)

    # ---- Fonts ----
    font_brand_sm = _load_font("bold", 24)
    font_title = _load_font("bold", 64)
    font_subtitle = _load_font("regular", 26)
    font_mono = _load_font("mono", 22)

    pad_x = 72
    pad_y_top = 52

    # ---- Brand mark "RZ" ----
    draw.text((pad_x, pad_y_top), "RZ", font=font_brand_sm, fill=BRAND_COLOR)

    # ---- Accent line under brand ----
    brand_bbox = draw.textbbox((pad_x, pad_y_top), "RZ", font=font_brand_sm)
    line_y = brand_bbox[3] + 8
    line_x_end = brand_bbox[2] + 40
    ar, ag, ab = _hex(accent_hex)
    for i, x in enumerate(range(pad_x, line_x_end)):
        alpha = max(0, 1 - (x - pad_x) / (line_x_end - pad_x))
        draw.point((x, line_y), fill=(ar, ag, ab))

    # ---- Title block (vertically centered in upper 70% of card) ----
    max_text_w = W - pad_x * 2
    title_lines = _wrapped_lines(title, font_title, max_text_w, 2)
    title_line_h = 74  # approx line height for 64px

    subtitle_lines = _wrapped_lines(subtitle, font_subtitle, max_text_w, 3)
    subtitle_line_h = 36

    total_text_h = (
        len(title_lines) * title_line_h
        + 20  # gap title→subtitle
        + len(subtitle_lines) * subtitle_line_h
    )
    text_area_h = int(H * 0.68)
    text_y = pad_y_top + 70 + max(0, (text_area_h - pad_y_top - 70 - total_text_h) // 2)

    # Title
    for line in title_lines:
        draw.text((pad_x, text_y), line, font=font_title, fill=TITLE_COLOR)
        text_y += title_line_h

    text_y += 20

    # Subtitle
    for line in subtitle_lines:
        draw.text((pad_x, text_y), line, font=font_subtitle, fill=SUBTITLE_COLOR)
        text_y += subtitle_line_h

    # ---- Bottom brand strip ----
    brand_text = "resistancezero.com"
    mono_bbox = draw.textbbox((0, 0), brand_text, font=font_mono)
    brand_w = mono_bbox[2] - mono_bbox[0]
    brand_x = W - brand_w - pad_x
    brand_y = H - 46
    draw.text((brand_x, brand_y), brand_text, font=font_mono, fill=STRIP_COLOR)

    return img


# ---------------------------------------------------------------------------
# HTML meta-tag patcher
# ---------------------------------------------------------------------------
def _patch_html(slug: str, html_path: Path) -> bool:
    """
    Replace og:image and twitter:image tags, ensure width/height metas exist.
    Returns True if the file was modified.
    """
    new_url = f"https://resistancezero.com/assets/og/{slug}.webp"
    text = html_path.read_text(encoding="utf-8")

    # Skip if already patched
    if new_url in text:
        print(f"  [SKIP HTML] {html_path.name} — already has og/{slug}.webp")
        return False

    orig = text

    # Replace og:image content
    text = re.sub(
        r'(<meta\s+property="og:image"\s+content=")[^"]*(")',
        rf"\g<1>{new_url}\g<2>",
        text,
        flags=re.IGNORECASE,
    )
    # Replace twitter:image content
    text = re.sub(
        r'(<meta\s+name="twitter:image"\s+content=")[^"]*(")',
        rf"\g<1>{new_url}\g<2>",
        text,
        flags=re.IGNORECASE,
    )

    # Ensure og:image:width / og:image:height are present
    if 'property="og:image:width"' not in text and 'og:image"' in text:
        # Insert after og:image line
        text = re.sub(
            r'(<meta\s+property="og:image"\s+content="[^"]*">)',
            r'\1\n    <meta property="og:image:width" content="1200">'
            r'\n    <meta property="og:image:height" content="630">',
            text,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        # Update existing width/height
        text = re.sub(
            r'(<meta\s+property="og:image:width"\s+content=")[^"]*(")',
            r'\g<1>1200\g<2>',
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r'(<meta\s+property="og:image:height"\s+content=")[^"]*(")',
            r'\g<1>630\g<2>',
            text,
            flags=re.IGNORECASE,
        )

    if text == orig:
        print(f"  [WARN HTML] {html_path.name} — no og:image tag found, skipping")
        return False

    html_path.write_text(text, encoding="utf-8")
    print(f"  [PATCHED] {html_path.name}")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate per-page OG social preview images for resistancezero.com"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Actually write WebP files (default: dry run)"
    )
    parser.add_argument(
        "--force", action="store_true", help="Regenerate even if file already exists"
    )
    parser.add_argument(
        "--update-html",
        action="store_true",
        help="Patch og:image / twitter:image meta tags in HTML files",
    )
    args = parser.parse_args()

    if not args.apply and not args.force:
        print("DRY RUN — pass --apply to generate images, --update-html to patch HTML\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total_bytes = 0
    generated = []
    skipped = []

    for slug, title, subtitle, accent in TARGETS:
        out_path = OUTPUT_DIR / f"{slug}.webp"

        if out_path.exists() and not args.force:
            size_kb = out_path.stat().st_size / 1024
            print(f"  [EXISTS] {slug}.webp  ({size_kb:.1f} KB)")
            skipped.append((slug, size_kb))
            if args.update_html and slug in HTML_FILES:
                _patch_html(slug, REPO_ROOT / HTML_FILES[slug])
            continue

        print(f"  [GEN]    {slug}.webp  title={title!r} accent={accent}")

        if args.apply or args.force:
            img = build_og_image(slug, title, subtitle, accent)
            img.save(str(out_path), "WEBP", quality=85, method=4)
            size_kb = out_path.stat().st_size / 1024
            total_bytes += out_path.stat().st_size
            generated.append((slug, size_kb))
            print(f"           → {size_kb:.1f} KB  ({W}×{H})")

            if args.update_html and slug in HTML_FILES:
                _patch_html(slug, REPO_ROOT / HTML_FILES[slug])
        else:
            print(f"           (dry run, not writing)")

    print()
    if generated:
        print(f"Generated {len(generated)} images, {total_bytes / 1024:.1f} KB total")
        for slug, kb in generated:
            flag = " ⚠ LARGE" if kb > 80 else ""
            print(f"  {slug}.webp  {kb:.1f} KB{flag}")
    if skipped:
        print(f"Skipped {len(skipped)} existing images (use --force to regenerate)")


if __name__ == "__main__":
    main()
