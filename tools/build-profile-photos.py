#!/usr/bin/env python3
"""
build-profile-photos.py — derive every profile-photo asset from the two owner masters.

WHY THIS IS A TOOL AND NOT A ONE-OFF
    The site shows the owner's photo in three different frames with three different rules:
      * the index bento hero card   — the WHOLE portrait, never cropped, theme-aware (day / dark+rainbow)
      * the index About frame       — the WHOLE portrait again, in a square-ish frame
      * the nav avatar (180 pages)  — a 40 px circle, where a face-centred square crop is the
                                      CORRECT treatment, not a defect
    Deriving those by hand is how a set drifts: one file gets re-exported at a different aspect and
    the declared width/height attributes on 180 pages quietly start lying. This script is the one
    place the derivation lives.

MASTERS (outside the repo — the owner's own folder, never committed)
    day  : "Foto setengah badan.png"  1222x1287   bright office background, black jacket
    dark : "fOTO.png"                 1010x1064   grey studio background, navy jacket

OUTPUT (assets/)
    profile-light-<w>.{avif,webp,jpg}   full portrait, day        w in WIDTHS (never upscaled)
    profile-dark-<w>.{avif,webp,jpg}    full portrait, dark       w in WIDTHS
    profile-light.{jpg,webp}            legacy names kept as the <img src> fallback
    profile-dark.{jpg,webp}             ditto
    profile-photo.{jpg,webp}            400x400 face-centred square — the site-wide avatar
    profile-photo-sm.webp               80x80 of the same crop (the 40 px nav avatar at 2x)

Usage:  python3 tools/build-profile-photos.py [--day PATH] [--dark PATH] [--check]
        --check reports what WOULD be written (sizes, dimensions) and writes nothing.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MASTERS = Path("/home/baguspermana7/mnt/data_2/10. Foto Pribadi/bagus/AI2")
DAY_DEFAULT = MASTERS / "Foto setengah badan.png"
DARK_DEFAULT = MASTERS / "fOTO.png"

# Rendered CSS widths measured on the live page (tools/_photo-probe): hero card 315 px desktop,
# 300 laptop, 205 tablet, 310 phone; About frame 280 -> 175. The largest real need is 315 px at
# dpr 3 = 945, so the ladder stops at the master's own width — upscaling only adds bytes.
WIDTHS = (320, 480, 640, 960)
AVIF_Q = 52
WEBP_Q = 82
JPEG_Q = 86
# a light unsharp after a Lanczos downscale: without it a 1200 px portrait reduced to 320 px
# goes soft on a phone, which reads as "pecah" even though no pixel is missing.
SHARPEN = "0x0.55+0.55+0.008"


def run(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"FAILED: {' '.join(str(c) for c in cmd)}\n{proc.stderr.strip()}")


def identify(path):
    out = subprocess.run(["magick", "identify", "-format", "%w %h", str(path)],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return None
    w, h = out.stdout.split()
    return int(w), int(h)


def face_square(path):
    """Face-centred square crop box for the avatar, eyes held above the middle."""
    import cv2
    img = cv2.imread(str(path))
    h, w = img.shape[:2]
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(grey, 1.1, 6, minSize=(int(w * 0.12), int(w * 0.12)))
    if len(faces) != 1:
        raise SystemExit(f"expected exactly one face in {path.name}, found {len(faces)}")
    fx, fy, fw, fh = (int(v) for v in faces[0])
    side = min(int(fw * 2.4), w, h)
    cx = fx + fw / 2
    cy = fy + fh / 2 + side * 0.22          # portrait rule: the face sits above centre
    x0 = int(max(0, min(w - side, cx - side / 2)))
    y0 = int(max(0, min(h - side, cy - side / 2)))
    return x0, y0, side


def emit(src, stem, widths, check):
    master_w, master_h = identify(src)
    written = []
    ladder = [w for w in widths if w < master_w] + [master_w]
    for width in ladder:
        for ext, quality in (("avif", AVIF_Q), ("webp", WEBP_Q), ("jpg", JPEG_Q)):
            out = ASSETS / f"{stem}-{width}.{ext}"
            if not check:
                cmd = ["magick", str(src), "-strip", "-colorspace", "sRGB",
                       "-filter", "Lanczos", "-resize", f"{width}x",
                       "-unsharp", SHARPEN, "-quality", str(quality)]
                if ext == "jpg":
                    cmd += ["-interlace", "Plane", "-sampling-factor", "4:2:0"]
                cmd.append(str(out))
                run(cmd)
            written.append(out)
    return master_w, master_h, ladder, written


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=Path, default=DAY_DEFAULT)
    ap.add_argument("--dark", type=Path, default=DARK_DEFAULT)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    for path in (args.day, args.dark):
        if not path.exists():
            raise SystemExit(f"master not found: {path}")

    report = {}
    for stem, src in (("profile-light", args.day), ("profile-dark", args.dark)):
        mw, mh, ladder, written = emit(src, stem, WIDTHS, args.check)
        report[stem] = {"master": f"{mw}x{mh}", "ladder": ladder,
                        "files": len(written), "aspect": round(mw / mh, 4)}
        if not args.check:
            # the legacy names stay as the <img src> fallback so nothing that already points at
            # them breaks; they carry the mid ladder rung.
            shutil.copyfile(ASSETS / f"{stem}-640.jpg", ASSETS / f"{stem}.jpg")
            shutil.copyfile(ASSETS / f"{stem}-640.webp", ASSETS / f"{stem}.webp")

    x0, y0, side = face_square(args.day)
    report["avatar"] = {"crop": [x0, y0, side], "from": args.day.name}
    if not args.check:
        crop = f"{side}x{side}+{x0}+{y0}"
        for out, size, quality in ((ASSETS / "profile-photo.jpg", 400, JPEG_Q),
                                   (ASSETS / "profile-photo.webp", 400, WEBP_Q),
                                   (ASSETS / "profile-photo-sm.webp", 80, WEBP_Q)):
            cmd = ["magick", str(args.day), "-strip", "-colorspace", "sRGB",
                   "-crop", crop, "+repage", "-filter", "Lanczos",
                   "-resize", f"{size}x{size}", "-unsharp", SHARPEN, "-quality", str(quality)]
            if out.suffix == ".jpg":
                cmd += ["-interlace", "Plane", "-sampling-factor", "4:2:0"]
            cmd.append(str(out))
            run(cmd)

    print(json.dumps(report, indent=1))
    if not args.check:
        total = 0
        for path in sorted(ASSETS.glob("profile-*")):
            size = path.stat().st_size
            total += size
            dims = identify(path)
            print(f"  {path.name:28} {size/1024:7.1f} KB  {dims[0]}x{dims[1]}")
        print(f"  {'TOTAL':28} {total/1024:7.1f} KB")


if __name__ == "__main__":
    main()
