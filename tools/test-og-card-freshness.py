#!/usr/bin/env python3
"""
A card is a rendering of its generator — prove it still is.

WHY THIS GATE EXISTS

standarization/ANTI_VIBECODE_STANDARD.md, "A colour gate must read the GENERATOR, not only what a
browser loads", clause 4: *Source scanning cannot see pixels.* v3.10.8 fixed three violet accent
literals in `tools/build-og-images.py` and then had to remember, by hand, that fixing a literal does
not repaint an image already written. Nothing would have caught a fourth.

WHAT WAS TRIED FIRST, AND WHY IT WAS ABANDONED

The obvious gate is to scan the rendered cards for the banned hue band and fail above a threshold.
Measured, it does not separate signal from subject:

    pre-fix pue-calculator.webp (a violet accent rule)      943 band pixels of 756,000
    FF-1.webp (clean; a hero photograph)                    851 band pixels of 756,000

A flat 4px accent survives WebP at quality 80 as a smear of ~750 distinct near-colours, so neither
the total nor the longest same-colour run tells an accent apart from a photograph that happens to
contain violet-ish tones. A threshold there would either miss the accent or condemn the photo.

WHAT THIS GATE ASSERTS INSTEAD

The invariant that actually holds: **every committed card is what the current generator produces.**
Each target is re-rendered in memory through `build_og_image()`, re-encoded at the quality the
builder would use, and compared with the committed file. A card whose generator has moved on —
a changed accent, a changed layout, a changed hero image — no longer matches, and the fix is to
rebuild it, which is the action that was missing.

This is the same rule `tools/audit-min-twins.mjs` enforces for minified twins: a derived artefact
that no longer matches its source is stale, and staleness is what ships old code and old colour.

TOLERANCE, AND WHAT IT IS AND IS NOT FOR

Comparison is per-pixel mean absolute difference, not bytes, so a libwebp or Pillow upgrade that
re-encodes identical input a hair differently does not turn all 139 cards red.

Measured, on a clean tree: **135 of 139 cards differ from a fresh render by exactly 0.000**, and
rendering the same target twice also measures 0.000. The render is deterministic and the encoder
is reproducible, so the tolerance is protecting against a future toolchain change and nothing
else — it is not absorbing run-to-run noise, because there is none.

The other four measured 1.55–1.89 and were genuinely stale hero-panel cards, rebuilt when this
gate first ran. That is why the threshold is 1.0 rather than the 2.0 it was first written with:
at 2.0 those four would have passed. The RED proof is the card this gate exists for — the
pre-v3.10.8 `pue-calculator.webp`, whose violet accent had been fixed in the generator and never
repainted, measures **33.6**.

Rendering 139 cards is about two minutes of CPU, so the work is spread across processes. Each
worker loads the builder itself — the module is not shared state.

Usage: python3 tools/test-og-card-freshness.py [--json] [--tolerance 1.0] [--limit N] [--jobs N]
"""
import argparse
import importlib.util
import io
import json
import os
import pathlib
import sys
from concurrent.futures import ProcessPoolExecutor

from PIL import Image, ImageChops, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILDER = ROOT / "tools" / "build-og-images.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("rz_og_builder", BUILDER)
    module = importlib.util.module_from_spec(spec)
    sys.argv = [str(BUILDER)]  # the builder parses argv only inside main(), but be explicit
    spec.loader.exec_module(module)
    return module


def mean_abs_diff(a: Image.Image, b: Image.Image) -> float:
    if a.size != b.size:
        return 255.0
    diff = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
    return sum(ImageStat.Stat(diff).mean) / 3.0


_OG = None


def _builder():
    """One builder per worker process, loaded once and reused."""
    global _OG
    if _OG is None:
        _OG = load_builder()
    return _OG


def check(target):
    """Returns (slug, delta) — delta None when the card is declared but absent."""
    slug, title, subtitle, accent = target
    og = _builder()
    path = og.OUTPUT_DIR / f"{slug}.webp"
    if not path.exists():
        return slug, None
    rendered = og.build_og_image(slug, title, subtitle, accent)
    quality = 80 if (slug not in og.PHOTO_SLUGS and og._hero_for(slug) is not None) else 85
    buf = io.BytesIO()
    rendered.save(buf, "WEBP", quality=quality, method=4)
    buf.seek(0)
    with Image.open(buf) as fresh, Image.open(path) as committed:
        return slug, mean_abs_diff(fresh, committed)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--tolerance", type=float, default=1.0,
                    help="mean absolute per-pixel difference (of 255) above which a card is stale")
    ap.add_argument("--limit", type=int, default=0, help="only check the first N targets (debug)")
    ap.add_argument("--jobs", type=int, default=min(8, os.cpu_count() or 1),
                    help="worker processes (default: up to 8)")
    args = ap.parse_args()

    og = load_builder()
    targets = [(slug, title, subtitle, accent)
               for slug, title, subtitle, accent in og.TARGETS]
    targets += [(slug, title, subtitle, accent)
                for slug, title, subtitle, accent, _page in og._discover_targets(include_existing=True)]
    if args.limit:
        targets = targets[:args.limit]

    stale, missing, checked = [], [], 0
    if args.jobs > 1:
        with ProcessPoolExecutor(max_workers=args.jobs) as pool:
            results = list(pool.map(check, targets, chunksize=2))
    else:
        results = [check(t) for t in targets]

    for slug, delta in results:
        if delta is None:
            missing.append(slug)
            continue
        checked += 1
        if delta > args.tolerance:
            stale.append({"slug": slug, "delta": round(delta, 3)})

    if args.json:
        print(json.dumps({"checked": checked, "tolerance": args.tolerance,
                          "stale": stale, "missing": missing}, indent=2))
        return 1 if (stale or missing) else 0

    print("── OG CARD FRESHNESS ──")
    if not stale and not missing:
        print(f"  ✓ {checked} card(s) match a fresh render of their generator "
              f"(tolerance {args.tolerance} of 255)")
        print("\nPASS — no card is running an accent, layout or hero its generator has moved on from.")
        return 0

    for s in stale:
        print(f"  ✗ {s['slug']}.webp  differs from a fresh render by {s['delta']} of 255")
    for s in missing:
        print(f"  ✗ {s}.webp  declared by the builder, not on disk")
    print(f"\nFAIL — {len(stale) + len(missing)} card(s) stale or missing.")
    print("Fixing a literal in tools/build-og-images.py does NOT repaint an image already written.")
    print("Rebuild: rm the card(s), then python3 tools/build-og-images.py --apply --discover")
    return 1


if __name__ == "__main__":
    sys.exit(main())
