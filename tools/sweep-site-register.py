#!/usr/bin/env python3
"""Site register sweep — moves page-local colour tokens onto the owner's register.

Owner 2026-10-15/16 (see standarization/ANTI_VIBECODE_STANDARD.md §A27-34): neutral graphite
surfaces, ONE amber accent, no navy/blue cast, no neon green. The journal and the hub already
use it (css/rz-article-dark.css, css/rz-hub.css); this tool brings the page families that
declare their own :root tokens onto the same values.

Exact-string rewrites only, per family glob, so the result is reproducible and idempotent:
  --check   exit 1 if any family still carries an old value (wired as a freshness gate)
  --apply   rewrite in place and print a per-family count
Functional colours (status green/red, alarm states) keep a hue; only their neon saturation goes.
"""
from __future__ import annotations

import argparse
import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# design artefacts keep their before/after evidence; the owner decides their fate
EXCLUDE = {"manual/rz-cockpit-mockup.html", "prd/rz-cockpit-mockup.html",
           "article-9-paper.html",  # paper/print document (PAPER_DOCUMENTS in audit-vibecode)
           # owned by the parallel LTC session (lab manuals, pillar-fire-safety rewrite)
           "manual/ltc-system-modelling-lab.html", "manual/standards-ltc-lab.html",
           "manual/pillar-fire-safety.html"}

# graphite + amber, the values css/rz-article-dark.css uses
DARK_BG, DARK_SURFACE, DARK_SURFACE_2 = "#0e0f12", "#16181d", "#121316"
DARK_TEXT, DARK_MUTED = "#cfd3da", "#969eaa"
AMBER_DARK, AMBER_DARK_RGB = "#E8B563", "232,181,99"
AMBER_LIGHT, AMBER_LIGHT_RGB = "#92400e", "146,64,14"
STATUS_GREEN = "#6aa588"   # "ok" keeps its hue, loses the neon

def _compact(prefix: str) -> list[tuple[str, str]]:
    return [
        (f"--{prefix}bg:#081016;", f"--{prefix}bg:{DARK_BG};"),
        (f"--{prefix}surface:#0d171e;", f"--{prefix}surface:{DARK_SURFACE};"),
        (f"--{prefix}surface-2:#101d25;", f"--{prefix}surface-2:{DARK_SURFACE_2};"),
        (f"--{prefix}text:#e7edf3;", f"--{prefix}text:{DARK_TEXT};"),
        (f"--{prefix}muted:#9ba8b5;", f"--{prefix}muted:{DARK_MUTED};"),
        (f"--{prefix}cyan:#2be8ff;", f"--{prefix}cyan:{AMBER_DARK};"),
        (f"--{prefix}green:#00e68a;", f"--{prefix}green:{STATUS_GREEN};"),
    ]


def _spaced(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """The same declarations written as `--x: v;` instead of `--x:v;`."""
    return [(a.replace(":", ": ", 1), b.replace(":", ": ", 1)) for a, b in pairs]


FAMILIES: dict[str, dict[str, object]] = {
    "manual": {
        "globs": ["manual/*.html"],
        "pairs": [
            ("--mn-accent: #00DDFF;", f"--mn-accent: {AMBER_DARK};"),
            ("--mn-accent-rgb: 0,221,255;", f"--mn-accent-rgb: {AMBER_DARK_RGB};"),
            ("--mn-cta: #FFAA00;", f"--mn-cta: {AMBER_DARK};"),
            ("--mn-bg: #0b0f14;", f"--mn-bg: {DARK_BG};"),
            ("--mn-surface: #121820;", f"--mn-surface: {DARK_SURFACE};"),
            ("--mn-surface-2: #0e141b;", f"--mn-surface-2: {DARK_SURFACE_2};"),
            ("--mn-text: #e7edf3;", f"--mn-text: {DARK_TEXT};"),
            ("--mn-muted: #93a1b0;", f"--mn-muted: {DARK_MUTED};"),
            ("--mn-cyan: #00DDFF;", f"--mn-cyan: {AMBER_DARK};"),
            ("--mn-amber: #FFAA00;", f"--mn-amber: {AMBER_DARK};"),
            ("--mn-green: #00FF88;", f"--mn-green: {STATUS_GREEN};"),
            ("--mn-accent: #0891b2;", f"--mn-accent: {AMBER_LIGHT};"),
            ("--mn-accent-rgb: 8,145,178;", f"--mn-accent-rgb: {AMBER_LIGHT_RGB};"),
            ("--mn-border: rgba(15,23,42,0.12);", "--mn-border: rgba(40,44,52,0.12);"),
            ("--mn-cyan: #0891b2;", f"--mn-cyan: {AMBER_LIGHT};"),
            # the fixed .navbar (styles.css) covered the breadcrumb on 36 manuals; 7 already clear it
            ("mn-wrap { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }",
             "mn-wrap { max-width: 960px; margin: 0 auto; padding: 5.5rem 1.25rem 5rem; }"),
            ("mn-wrap { padding: 1.25rem 0.9rem 4rem; }", "mn-wrap { padding: 5rem 0.9rem 4rem; }"),
        ] + _compact("mn-") + _compact("") + _spaced(_compact("")),
    },
    "network": {
        "globs": ["network/**/*.html"],
        "pairs": [
            ("--green:#00FF88;", f"--green:{STATUS_GREEN};"),
            ("--canvas-bg:#0F172A;", f"--canvas-bg:{DARK_SURFACE_2};"),
        ("background:#0a1220;", f"background:{DARK_BG};"),
            ('<meta name="theme-color" content="#0F172A">', f'<meta name="theme-color" content="{DARK_BG}">'),
            # chrome accent: the explainers used cyan for chips, buttons and accordions; the animation
            # canvas takes its colours from js/network-anim/palette.js, not from these tokens
            ("--cyan:#00DDFF;", f"--cyan:{AMBER_DARK};"),
            ("--wire:#475569;", "--wire:#5c6470;"),
            # the header's .nav-right links had no gap ("Network HubCompare")
            (".live-region { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }\n\n  /* v1.8.0",
             ".live-region { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }\n"
             "  .nav-right { display:flex; gap:1.25rem; }\n\n  /* v1.8.0"),
            # header.navbar is position:fixed and transparent until .scrolled, which only the shared
            # nav script adds — these pages do not load it, so text scrolled under a clear header
            ("  .nav-right { display:flex; gap:1.25rem; }\n\n  /* v1.8.0",
             "  .nav-right { display:flex; gap:1.25rem; }\n"
             "  header.navbar { background:rgba(248,249,250,0.94) !important; border-bottom:1px solid rgba(40,44,52,0.12) !important; }\n"
             "  [data-theme=\"dark\"] header.navbar { background:rgba(18,19,22,0.94) !important; border-bottom-color:rgba(160,168,180,0.14) !important; }\n\n  /* v1.8.0"),
            ("  .nav-right { display: flex; gap: 1.25rem; }\n\n  /* v1.8.0",
             "  .nav-right { display: flex; gap: 1.25rem; }\n"
             "  header.navbar { background: rgba(248,249,250,0.94) !important; border-bottom: 1px solid rgba(40,44,52,0.12) !important; }\n"
             "  [data-theme=\"dark\"] header.navbar { background: rgba(18,19,22,0.94) !important; border-bottom-color: rgba(160,168,180,0.14) !important; }\n\n  /* v1.8.0"),
            ("--cyan: #00DDFF;", f"--cyan: {AMBER_DARK};"),
            ("--wire: #475569;", "--wire: #5c6470;"),
            ("    width: 1px; height: 1px; overflow: hidden;\n  }\n\n  /* v1.8.0",
             "    width: 1px; height: 1px; overflow: hidden;\n  }\n  .nav-right { display: flex; gap: 1.25rem; }\n\n  /* v1.8.0"),
        ] + [("--green: #00FF88;", f"--green: {STATUS_GREEN};"), ("--canvas-bg: #0F172A;", f"--canvas-bg: {DARK_SURFACE_2};"),
             ("background: #0a1220;", f"background: {DARK_BG};")],
    },
    "prd": {
        "globs": ["prd/*.html"],
        "pairs": _compact("") + _spaced(_compact("")) + [
            # light theme: the teal accent becomes the readable amber, the blue-grey page goes neutral
            ("--cyan:#087f99;", f"--cyan:{AMBER_LIGHT};"),
            ("--cyan:#00677d;", f"--cyan:{AMBER_LIGHT};"),
            ("--bg:#f4f7f9;", "--bg:#f8f9fa;"),
        ],
    },
}

# ---- "content" family: hand-written content pages (owner 2026-10-31 de-slop) ----
_CONTENT_FILES = Path(__file__).with_name("content-pages.txt")
_ROLE = {  # role -> [(old, new)] ; surfaces and dividers only, never ink
    "bg": [("#0f172a", DARK_BG), ("#0b1220", DARK_BG)],
    "bg2": [("#0f172a", DARK_SURFACE_2)],
    "bg3": [("#1e293b", "#1c1e23"), ("#334155", "#1c1e23")],
    "card": [("#1e293b", DARK_SURFACE)],
    "inset": [("#0b1220", DARK_SURFACE_2)],
    "border": [("#1e293b", "#2a2d34"), ("#334155", "#2a2d34")],
}
_PREFIXES = ["cmp", "cdu", "sg", "db", "dmt", "pjg", "pjgjb", "pjgkb", "pjgjt", "pjgjm"]


def _content_pairs() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for pre in _PREFIXES:
        for role, subs in _ROLE.items():
            for old, new in subs:
                out.append((f"--{pre}-{role}:{old};", f"--{pre}-{role}:{new};"))
                out.append((f"--{pre}-{role}: {old};", f"--{pre}-{role}: {new};"))
    g = STATUS_GREEN
    lit = [
        ("--rz-bg-deep:      #0a0e1a;", f"--rz-bg-deep:      {DARK_BG};"),
        ("--rz-bg-surface:   #10172a;", f"--rz-bg-surface:   {DARK_SURFACE};"),
        ("--rz-bg-raised:    #141c30;", "--rz-bg-raised:    #1c1e23;"),
        ("--rz-green:        #00FF88;", f"--rz-green:        {g};"),
        ("--bg: #0b1324;", f"--bg: {DARK_BG};"),
        ("--bg-solid: #0b1324;", f"--bg-solid: {DARK_BG};"),
        ("--panel: rgba(15,23,42,0.84);", "--panel: rgba(22,24,29,0.84);"),
        ("--panel-inner: rgba(15,23,42,0.6);", "--panel-inner: rgba(22,24,29,0.6);"),
        ("--green: #00FF88;", f"--green: {g};"),
        ("--green:#00FF88;", f"--green:{g};"),
        ("--green-dim: rgba(0,255,136,0.5);", "--green-dim: rgba(106,165,136,0.5);"),
        ("--pill-green-bg: rgba(0,255,136,0.14);", "--pill-green-bg: rgba(106,165,136,0.14);"),
        ("--pill-green-border: rgba(0,255,136,0.40);", "--pill-green-border: rgba(106,165,136,0.40);"),
        ("background: rgba(0,255,136,0.08);", "background: rgba(106,165,136,0.08);"),
        ("fill: rgba(0,255,136,0.07);", "fill: rgba(106,165,136,0.07);"),
        ("color:#00FF88;", f"color:{g};"),
        ("--bm-green:#22F5A8;", f"--bm-green:{g};"),
        ("--canvas-bg:#0F172A;", f"--canvas-bg:{DARK_SURFACE_2};"),
        ("--gl-bg-hero-start: #0f172a;", f"--gl-bg-hero-start: {DARK_BG};"),
        ("--gl-bg-hero-mid: #1e3a5f;", f"--gl-bg-hero-mid: {DARK_SURFACE};"),
        ("--gl-bg-hero-end: #1d4ed8;", f"--gl-bg-hero-end: {DARK_SURFACE_2};"),
        ("radial-gradient(circle at 20% 80%, rgba(37, 99, 235, 0.3) 0%, transparent 50%)", "radial-gradient(circle at 20% 80%, rgba(232, 181, 99, 0.08) 0%, transparent 50%)"),
        ("radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%);", "radial-gradient(circle at 80% 20%, rgba(232, 181, 99, 0.05) 0%, transparent 50%);"),
        ("background:#0a1220;", f"background:{DARK_BG};"),
        ("background: #080c16;", f"background: {DARK_BG};"),
        ("background: linear-gradient(135deg, #0b1220 0%, #1e293b 100%);", f"background: linear-gradient(135deg, {DARK_BG} 0%, {DARK_SURFACE} 100%);"),
        ("background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);", f"background: linear-gradient(135deg, {DARK_BG} 0%, {DARK_SURFACE} 100%);"),
        ("background: linear-gradient(180deg, #050a18 0%, #0b1220 100%);", f"background: linear-gradient(180deg, #0a0b0d 0%, {DARK_BG} 100%);"),
        ("background:#1e293b !important;", f"background:{DARK_SURFACE} !important;"),
        ("background:#1e293b;", f"background:{DARK_SURFACE};"),
        ("background: #1e293b;", f"background: {DARK_SURFACE};"),
        ("background:#0b1220;", f"background:{DARK_BG};"),
        ("background: #0b1220;", f"background: {DARK_BG};"),
        ("background:#0f172a;", f"background:{DARK_BG};"),
        ("background: #0f172a;", f"background: {DARK_BG};"),
        ("border:1px solid #1e293b;", "border:1px solid #2a2d34;"),
        ("border-top: 1px solid #1e293b;", "border-top: 1px solid #2a2d34;"),
    ]
    return out + lit


FAMILIES["content"] = {
    "globs": [ln.strip() for ln in _CONTENT_FILES.read_text().split() if ln.strip()] if _CONTENT_FILES.exists() else [],
    "pairs": _content_pairs(),
}


def family_files(spec: dict[str, object]) -> list[Path]:
    files: set[Path] = set()
    for pattern in spec["globs"]:  # type: ignore[union-attr]
        files.update(Path(p) for p in glob.glob(str(ROOT / pattern), recursive=True))
    return sorted(f for f in files if f.relative_to(ROOT).as_posix() not in EXCLUDE)


def sweep(apply: bool) -> int:
    remaining = 0
    for name, spec in FAMILIES.items():
        files = family_files(spec)
        rewrites = 0
        for path in files:
            text = path.read_text(encoding="utf-8")
            new = text
            for old, repl in spec["pairs"]:  # type: ignore[union-attr]
                count = new.count(old)
                if count:
                    rewrites += count
                    new = new.replace(old, repl)
            if apply and new != text:
                path.write_text(new, encoding="utf-8")
        remaining += 0 if apply else rewrites
        verb = "rewrote" if apply else "pending"
        print(f"{name:8s} {len(files):3d} files · {verb} {rewrites}")
    return remaining


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    pending = sweep(apply=args.apply)
    if args.check and pending:
        print(f"SITE REGISTER — FAIL: {pending} old value(s) remain; run --apply")
        return 1
    print("SITE REGISTER — " + ("applied" if args.apply else "PASS: every family is on the register"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
