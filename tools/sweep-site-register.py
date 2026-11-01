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
import re
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


# ---- "embed" family: the self-contained calculator widgets + their landing page (2026-11-01) ----
# Widgets render dark-only inside a third-party iframe, so their colours are literals, not tokens.
# Functional hues stay: status green/red, the rating ramp, the CAPEX category colours.
_HAIR = "#2a2d34"
_EMBED_ROWS_GRID = ("""        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }""", f"""        .metrics-grid {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 0;
            border-top: 1px solid {_HAIR};
        }}""")
_EMBED_ROWS_CARD = ("""        .metric-card {
            background: rgba(6, 182, 212, 0.05);
            border: 1px solid rgba(6, 182, 212, 0.12);
            border-radius: 4px;
            padding: 10px 12px;
            text-align: center;
        }""", f"""        .metric-card {{
            display: flex;
            flex-direction: row-reverse;
            justify-content: space-between;
            align-items: baseline;
            gap: 12px;
            padding: 7px 0;
            border-bottom: 1px solid {_HAIR};
        }}""")
FAMILIES["embed"] = {
    "globs": ["embed/*.html"],
    "pairs": [
        # the guideline sentence describes the palette: keep it true (must run before the hex pairs)
        ("(#0f172a background, #06b6d4 cyan accents)", f"(graphite {DARK_BG} background, amber {AMBER_DARK} accents)"),
        _EMBED_ROWS_GRID, _EMBED_ROWS_CARD,
        ('<div class="metrics-grid">', '<div class="metrics-grid" data-rz-fact-list>'),
        (".ws-icon.cyan { background: linear-gradient(135deg, #06b6d4, #0891b2); }", ".ws-icon.cyan { background: #92400e; }"),
        (".ws-icon.amber { background: linear-gradient(135deg, #f59e0b, #d97706); }", ".ws-icon.amber { background: #8a5a12; }"),
        (".ws-icon.green { background: linear-gradient(135deg, #22c55e, #16a34a); }", ".ws-icon.green { background: #3f6e57; }"),
        ("background: var(--glass-bg);", "background: var(--card-bg);"),
        ("1px solid var(--glass-border)", "1px solid rgba(127,127,127,0.22)"),
        ("background: #0f172a;", f"background: {DARK_BG};"),
        ("border: 2px solid #0f172a;", f"border: 2px solid {DARK_BG};"),
        ("background: #1e293b;", f"background: {DARK_SURFACE};"),
        ("background: #334155;", f"background: {_HAIR};"),
        ("1px solid #334155", f"1px solid {_HAIR}"),
        ("color: #e2e8f0;", f"color: {DARK_TEXT};"),
        ("color: #94a3b8;", f"color: {DARK_MUTED};"),
        ("rgba(51, 65, 85, 0.5)", "rgba(42, 45, 52, 0.5)"),
        ("#06b6d4", AMBER_DARK),
        ("rgba(6, 182, 212,", f"rgba({AMBER_DARK_RGB.replace(',', ', ')},"),
        ("rgba(6,182,212,", f"rgba({AMBER_DARK_RGB},"),
    ],
}


# ---- "pillar" family: the four topic pillars (fire safety is rewritten by the LTC session) ----
# Each pillar had its own identity hue (cyan / orange / slate / emerald), a tinted hero gradient with
# a glow orb, a gradient hub centre with a glow, and a hover that scaled the hub nodes (which also
# dropped the translate that centres four of them, so those nodes jumped). The register is one amber.
# The "by the numbers" tiles become fact rows: value left in mono, title and sentence right.
_PILLAR_ROOT = {
    "#06b6d4": ("#0ea5e9", "#0891b2", "6,182,212"),
    "#f59e0b": ("#fbbf24", "#d97706", "245,158,11"),
    "#64748b": ("#94a3b8", "#64748b", "100, 116, 139"),
    "#10b981": ("#34d399", "#059669", "16,185,129"),
}
_PILLAR_NEW_ROOT = (":root { --pillar-color: #92400e; --pillar-light: #b45309; --pillar-dark: #7a4800; "
                    "--pillar-bg: rgba(146,64,14,0.07); --pillar-border: rgba(146,64,14,0.28); }")
_pillar_pairs: list = []
for col, (light, dark, rgb) in _PILLAR_ROOT.items():
    _pillar_pairs += [
        (f":root {{ --pillar-color: {col}; --pillar-light: {light}; --pillar-dark: {dark}; "
         f"--pillar-bg: rgba({rgb},0.08); --pillar-border: rgba({rgb},0.25); }}", _PILLAR_NEW_ROOT),
        (f"background: radial-gradient(circle, rgba({rgb},0.12) 0%, transparent 70%);", "background: none;"),
        (f"box-shadow: 0 0 40px rgba({rgb},0.3);", "box-shadow: none;"),
    ]
_pillar_pairs += [
    ("re", r':root:not\(\[data-theme="dark"\]\) \{ --pillar-color:#(?!92400e)[0-9a-f]{6}; \}',
     ':root:not([data-theme="dark"]) { --pillar-color:#92400e; }'),
    ("re", r'\[data-theme="dark"\] \{ --pillar-color:#(?!E8B563)[0-9a-fA-F]{6}; \}',
     '[data-theme="dark"] { --pillar-color:#E8B563; --pillar-bg: rgba(232,181,99,0.08); --pillar-border: rgba(232,181,99,0.28); }'),
    ("re", r"background: linear-gradient\(135deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 40%, #[0-9a-f]{6} 100%\);",
     f"background: {DARK_BG};"),
    ("background: linear-gradient(135deg, var(--pillar-color), var(--pillar-dark));", "background: #7a4800;"),
    (".hub-node:hover { border-color: var(--pillar-color); transform: scale(1.08); }",
     ".hub-node:hover { border-color: var(--pillar-color); }"),
    ("transition: border-color 0.3s, transform 0.3s;", "transition: border-color 0.2s;"),
    # hero: three boxed badges -> one mono metabar line
    ("re", r"\.pillar-stat-badges \{(?![^}]*row-gap)[^}]*\}\s*\.pillar-stat-badge \{[^}]*\}\s*\.pillar-stat-badge \.num \{[^}]*\}",
     ".pillar-stat-badges {\n            display: flex;\n            justify-content: center;\n            flex-wrap: wrap;\n"
     "            row-gap: 0.5rem;\n            margin-top: 2rem;\n            font-family: 'JetBrains Mono', monospace;\n        }\n"
     "        .pillar-stat-badge {\n            display: flex;\n            align-items: baseline;\n            gap: 0.45rem;\n"
     "            padding: 0 1rem;\n            border-left: 1px solid rgba(255,255,255,0.16);\n        }\n"
     "        .pillar-stat-badge:first-child { border-left: 0; }\n"
     "        .pillar-stat-badge .num {\n            font-size: 0.95rem;\n            font-weight: 600;\n            color: #E8B563;\n        }"),
    (".pillar-stat-badge { min-width: 110px; }", ".pillar-stat-badge { padding: 0 0.75rem; }"),
    # "by the numbers": tiles -> fact rows
    ("re", r"\.stats-grid \{(?![^}]*border-top)(?=[^}]*display: grid)[^}]*\}", ".stats-grid {\n            max-width: 900px;\n            margin: 0 auto;\n"
     "            border-top: 1px solid var(--border-color);\n        }"),
    ("re", r"\.stat-card \{(?![^}]*9rem)(?=[^}]*background)[^}]*\}", ".stat-card {\n            display: grid;\n            grid-template-columns: 9rem 1fr;\n"
     "            column-gap: 1.5rem;\n            padding: 1.1rem 0;\n            border-bottom: 1px solid var(--border-color);\n        }"),
    ("re", r"\s*\.stat-card-icon \{[^}]*\}\s*\.stat-card-icon svg \{[^}]*\}", ""),
    ("re", r"\.stat-card \.value \{(?![^}]*grid-row)[^}]*\}", ".stat-card .value {\n            grid-row: span 2;\n"
     "            font-family: 'JetBrains Mono', monospace;\n            font-size: 1.35rem;\n            font-weight: 600;\n"
     "            color: var(--pillar-color);\n        }"),
    ("re", r"\.stats-grid \{ grid-template-columns: repeat\(2, 1fr\); \}", ".stat-card { grid-template-columns: 7rem 1fr; }"),
    ("re", r"\.stats-grid \{ grid-template-columns: 1fr; \}", ".stat-card { grid-template-columns: 1fr; } .stat-card .value { grid-row: auto; }"),
    ("re", r'\s*<div class="stat-card-icon">\s*<svg[\s\S]*?</svg>\s*</div>', ""),
    ('<div class="stats-grid">', '<div class="stats-grid" data-rz-fact-list>'),
    # the hero is dark in both themes, so its accent is the warm amber in both (ink amber read 2.7:1 there)
    ("re", r"(?<!0\.28\); \}\n        )\.pillar-hero h1 span \{ color: var\(--pillar-color\); \}",
     ".pillar-hero { --pillar-color: #E8B563; --pillar-bg: rgba(232,181,99,0.08); --pillar-border: rgba(232,181,99,0.28); }\n"
     "        .pillar-hero h1 span { color: var(--pillar-color); }"),
]
FAMILIES["pillar"] = {
    "globs": ["pillar-cooling.html", "pillar-power.html", "pillar-standards.html", "pillar-sustainability.html"],
    "pairs": _pillar_pairs,
}


# ---- "lang" family: the glossary and the three Indonesian pages (id/) (2026-11-01) ----
# id/ mirrors index / articles / glossary in Bahasa Indonesia and was never swept: a navy-to-cyan
# hero with glow orbs, a gradient-text title, cyan everywhere, rainbow article thumbnails, card lifts.
# The English glossary still carried a blue accent. One amber, ink-dark in light, warm in dark;
# a fill carries its own text colour (--*-on-accent) so the button stays readable in both themes.
def _accent_block(pre: str, light_cyan: str, dark_cyan: str | None) -> list:
    out = [
        (f"--{pre}-accent: {light_cyan};", f"--{pre}-accent: #92400e;\n            --{pre}-on-accent: #ffffff;"),
        (f"--{pre}-accent-light: #22d3ee;", f"--{pre}-accent-light: #b45309;"),
        (f"--{pre}-accent-dark: #0891b2;", f"--{pre}-accent-dark: #7a4800;"),
        (f"--{pre}-bg-hero-start: #0f172a;", f"--{pre}-bg-hero-start: {DARK_BG};"),
        (f"--{pre}-bg-hero-start: #0b1220;", f"--{pre}-bg-hero-start: {DARK_BG};"),
        (f"--{pre}-bg-hero-mid: #164e63;", f"--{pre}-bg-hero-mid: {DARK_SURFACE};"),
        (f"--{pre}-bg-hero-end: #06b6d4;", f"--{pre}-bg-hero-end: {DARK_SURFACE_2};"),
        (f"--{pre}-footer-bg: #0f172a;", f"--{pre}-footer-bg: {DARK_BG};"),
        (f"--{pre}-footer-bg: #020617;", f"--{pre}-footer-bg: #0a0b0d;"),
        (f"--{pre}-bg-alt: #0f0f1a;", f"--{pre}-bg-alt: {DARK_SURFACE_2};"),
        (f"--{pre}-card-bg: #1e293b;", f"--{pre}-card-bg: {DARK_SURFACE};"),
        (f"--{pre}-card-border: #334155;", f"--{pre}-card-border: #2a2d34;"),
        (f"--{pre}-glass-bg: rgba(15,15,26,0.9);", f"--{pre}-glass-bg: rgba(18,19,22,0.9);"),
        (f"[data-theme=\"dark\"] {{\n            --{pre}-bg: #0a0a14;",
         f"[data-theme=\"dark\"] {{\n            --{pre}-accent: {AMBER_DARK};\n            --{pre}-accent-light: #f0c987;\n"
         f"            --{pre}-on-accent: #16181d;\n            --{pre}-bg: {DARK_BG};"),
        (f"background: var(--{pre}-accent); color: #0f172a;", f"background: var(--{pre}-accent); color: var(--{pre}-on-accent);"),
        (f".lang-active {{ background: var(--{pre}-accent); color: #fff; }}", f".lang-active {{ background: var(--{pre}-accent); color: var(--{pre}-on-accent); }}"),
        (f"background: var(--{pre}-accent); color: #fff;", f"background: var(--{pre}-accent); color: var(--{pre}-on-accent);"),
    ]
    return out

_GL = [  # glossary tokens, both pages (English blue, Indonesian cyan)
    ("--gl-accent: #1d4ed8;", "--gl-accent: #92400e;\n            --gl-on-accent: #ffffff;"),
    ("--gl-accent-light: #3b82f6;", "--gl-accent-light: #b45309;"),
    ("[data-theme=\"dark\"] {\n            --gl-pill-bg: rgba(59, 130, 246, 0.15);",
     f"[data-theme=\"dark\"] {{\n            --gl-accent: {AMBER_DARK};\n            --gl-accent-light: #f0c987;\n"
     f"            --gl-on-accent: #16181d;\n            --gl-pill-bg: rgba(232, 181, 99, 0.12);"),
    ("--gl-pill-bg: rgba(37, 99, 235, 0.1);", "--gl-pill-bg: rgba(146, 64, 14, 0.08);"),
    ("--gl-pill-hover: rgba(37, 99, 235, 0.2);", "--gl-pill-hover: rgba(146, 64, 14, 0.16);"),
    ("--gl-pill-hover: rgba(59, 130, 246, 0.25);", "--gl-pill-hover: rgba(232, 181, 99, 0.22);"),
    ("--gl-pill-bg: rgba(6, 182, 212, 0.1);", "--gl-pill-bg: rgba(146, 64, 14, 0.08);"),
    ("--gl-pill-bg: rgba(34, 211, 238, 0.12);", "--gl-pill-bg: rgba(232, 181, 99, 0.12);"),
    ("--gl-alpha-bg: rgba(15, 23, 42, 0.95);", "--gl-alpha-bg: rgba(18, 19, 22, 0.95);"),
    ("--gl-alpha-border: #334155;", "--gl-alpha-border: #2a2d34;"),
]
for _name in ("term-border", "pill-color", "alpha-active", "letter-color"):
    for _old in ("#1d4ed8", "#06b6d4"):
        _GL.append((f"--gl-{_name}: {_old};", f"--gl-{_name}: #92400e;"))
    for _old in ("#3b82f6", "#60a5fa", "#22d3ee"):
        _GL.append((f"--gl-{_name}: {_old};", f"--gl-{_name}: {AMBER_DARK};"))

FAMILIES["lang"] = {
    "globs": ["glossary.html", "id/index.html", "id/artikel.html", "id/glosarium.html"],
    "pairs": _accent_block("rz", "#06b6d4", None) + _accent_block("gl", "#06b6d4", None) + _GL + [
        ('name="theme-color" content="#06b6d4"', f'name="theme-color" content="{DARK_BG}"'),
        ('name="msapplication-TileColor" content="#06b6d4"', f'name="msapplication-TileColor" content="{DARK_BG}"'),
        ("re", r"background:\s*radial-gradient\(circle at \d+% \d+%, rgba\(6,182,212,[^;]*;", "background: none;"),
        ("re", r"background: linear-gradient\(90deg, #fff, #67e8f9\);\s*-webkit-background-clip: text; -webkit-text-fill-color: transparent;\s*background-clip: text;",
         "color: #f3f4f6;"),
        ("box-shadow: var(--rz-card-shadow); transform: translateY(-4px);", "box-shadow: none;"),
        (".btn-primary:hover { background: var(--rz-accent-light); transform: translateY(-2px); }",
         ".btn-primary:hover { background: var(--rz-accent-light); }"),
        (".scroll-top-btn:hover { transform: translateY(-2px); }", ".scroll-top-btn:hover { opacity: 0.9; }"),
        ("box-shadow: 0 4px 12px rgba(6,182,212,0.3);", "box-shadow: none;"),
        ("background: linear-gradient(135deg, #0f172a, #164e63);", f"background: {DARK_SURFACE};"),
        ("border-top: 1px solid #1e293b;", "border-top: 1px solid #2a2d34;"),
        ("rgba(6,182,212,0.08)", "rgba(232,181,99,0.08)"),
        ("re", r'class="feature-icon" style="background:rgba\((?:6,182,212|16,185,129|59,130,246),0\.1\);color:#(?:06b6d4|10b981|3b82f6);"',
         'class="feature-icon" style="background:rgba(127,127,127,0.10);color:var(--rz-accent);"'),
        (' style="color:#06b6d4;font-weight:600;"', ' style="font-weight:600;"'),
        (' style="color:#10b981;"', ""), (' style="color:#3b82f6;"', ""),
        ("background:#06b6d4;color:#000;", f"background:{AMBER_DARK};color:#000;"),
        ("re", r'style="background: linear-gradient\(135deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 50%, #[0-9a-f]{6} 100%\);"',
         f'style="background: {DARK_SURFACE};"'),
        ("re", r'style="background: linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\);"', 'style="background: #2a2d34;"'),
        # id/index hero: four big cyan numerals -> one mono metabar line (as the pillars)
        (".hero-stats {\n            display: flex; gap: 2.5rem; justify-content: center; margin-top: 3rem;\n            flex-wrap: wrap;\n        }",
         ".hero-stats {\n            display: flex; justify-content: center; margin-top: 2.5rem; row-gap: 0.5rem;\n"
         "            flex-wrap: wrap; font-family: 'JetBrains Mono', monospace;\n        }"),
        (".hero-stat { text-align: center; }",
         ".hero-stat { display: flex; align-items: baseline; gap: 0.45rem; padding: 0 1rem; border-left: 1px solid rgba(255,255,255,0.16); }\n"
         "        .hero-stat:first-child { border-left: 0; }"),
        (".hero-stat-value { font-size: 2rem; font-weight: 800; color: #22d3ee; }",
         f".hero-stat-value {{ font-size: 0.95rem; font-weight: 600; color: {AMBER_DARK}; }}"),
        (".hero-stat-label { font-size: 0.8rem;", ".hero-stat-label { font-size: 0.75rem;"),
        (".hero-stats { gap: 1.5rem; }", ".hero-stat { padding: 0 0.75rem; }"),
        ("color: #22d3ee; margin-bottom: 1.5rem;", f"color: {AMBER_DARK}; margin-bottom: 1.5rem;"),
    ],
}


# ---- "admin" family: the private admin console (noindex). Its tokens come from
# css/rz-finance-suite.css, which the LTC session owns; only the page's own literals move here.
FAMILIES["admin"] = {
    "globs": ["rz-ops-p7x3k9m.html"],
    "pairs": [
        (".kpi:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3)}", ".kpi:hover{border-color:var(--fs-acc)}"),
        ("body.light-mode .kpi:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)}", ""),
        (".kpi{background:var(--fs-bg2);border:1px solid var(--fs-bd);border-radius:4px;padding:1.25rem;transition:transform 0.2s}",
         ".kpi{background:var(--fs-bg2);border:1px solid var(--fs-bd);border-radius:4px;padding:1.25rem;transition:border-color 0.2s}"),
        ("background:#0b1220;", f"background:{DARK_SURFACE_2};"),
        ("background:#0f172a;", f"background:{DARK_SURFACE_2};"),
        ("background:#050816;", f"background:{DARK_BG};"),
        ("border:none;background:#0b1120;", f"border:none;background:{DARK_BG};"),
        ("background:rgba(15,23,42,0.6);", "background:rgba(18,19,22,0.6);"),
        ("border:1px solid #334155;", "border:1px solid #2a2d34;"),
        ("border:1px solid #1f2937;", "border:1px solid #2a2d34;"),
    ],
}


# ---- "suite" family: css/rz-finance-suite.css (account, changelog, admin console). Released to this
# sweep by the LTC session 2026-11-01. Surfaces go graphite, the identity accent goes amber (a fill that
# carries white text uses amber-700, 5.0:1); state colours (grn/red/amb/blu/cyn) keep their meaning.
FAMILIES["suite"] = {
    "globs": ["css/rz-finance-suite.css"],
    "pairs": [
        ("--fs-bg0: #0b1120;", f"--fs-bg0: {DARK_BG};"),
        ("--fs-bg1: #111827;", f"--fs-bg1: {DARK_SURFACE_2};"),
        ("--fs-bg2: #1e293b;", f"--fs-bg2: {DARK_SURFACE};"),
        ("--fs-bg3: #0f172a;", f"--fs-bg3: {DARK_SURFACE_2};"),
        ("--fs-bd:  #334155;", "--fs-bd:  #2a2d34;"),
        ("--fs-bd2: rgba(51, 65, 85, .4);", "--fs-bd2: rgba(42, 45, 52, .6);"),
        ("--fs-t3: #94a3b8;", f"--fs-t3: {DARK_MUTED};"),
        ("--fs-acc:   #64748b;", "--fs-acc:   #b45309;"),
        ("--fs-acc2:  #67e8f9;", f"--fs-acc2:  {AMBER_DARK};  /* v3.24.31 — one amber accent (owner register 2026-10-15) */"),
        ("--fs-accbg: rgba(100, 116, 139, .1);", "--fs-accbg: rgba(232, 181, 99, .1);"),
        ("--fs-bg0: #f8fafc;", "--fs-bg0: #f8f9fa;"),
        ("--fs-acc:  #155e75;", "--fs-acc:  #92400e;"),
        ("--fs-acc2: #0e7490;", "--fs-acc2: #7A4800;"),
    ],
}


# ---- "dash" family: the account dashboard. Its accent pair was blue + slate ("purple" by name),
# used as gradient fills under white text. One amber; a fill carries --db-on-accent.
FAMILIES["dash"] = {
    "globs": ["dashboard.html"],
    "pairs": [
        ('name="theme-color" content="#1e3a5f"', f'name="theme-color" content="{DARK_BG}"'),
        ("--db-primary: #1e3a5f;", f"--db-primary: {DARK_SURFACE};"),
        ("--db-accent: #3b82f6;", "--db-accent: #92400e;\n            --db-on-accent: #ffffff;"),
        ("--db-accent-light: #60a5fa;", "--db-accent-light: #b45309;"),
        ("--db-purple: #64748b;", "--db-purple: #92400e;"),
        ("--db-purple-light: #94a3b8;", "--db-purple-light: #b45309;"),
        ("[data-theme=\"dark\"] {\n            --db-bg: #0e0f12;",
         f"[data-theme=\"dark\"] {{\n            --db-accent: {AMBER_DARK};\n            --db-accent-light: #f0c987;\n"
         f"            --db-purple: {AMBER_DARK};\n            --db-purple-light: #f0c987;\n            --db-on-accent: #16181d;\n"
         f"            --db-bg: {DARK_BG};"),
        ("background: linear-gradient(135deg, var(--db-purple), #64748b);\n            color: #fff;",
         "background: var(--db-accent);\n            color: var(--db-on-accent);"),
        (".db-btn-primary:hover { box-shadow: 0 6px 20px rgba(100, 116, 139,0.3); }",
         ".db-btn-primary:hover { background: var(--db-accent-light); }"),
        ("background: linear-gradient(135deg, var(--db-purple), var(--db-accent));\n            display: flex;\n"
         "            align-items: center;\n            justify-content: center;\n            font-size: 1.8rem;\n"
         "            font-weight: 800;\n            color: #fff;",
         "background: var(--db-accent);\n            display: flex;\n            align-items: center;\n"
         "            justify-content: center;\n            font-size: 1.8rem;\n            font-weight: 800;\n"
         "            color: var(--db-on-accent);"),
    ],
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
            for pair in spec["pairs"]:  # type: ignore[union-attr]
                if len(pair) == 3:  # ("re", pattern, replacement): a block whose body varies per page
                    # every pattern excludes its own output (negative lookahead), so --check can go green
                    new, count = re.subn(pair[1], pair[2], new)
                else:
                    old, repl = pair
                    count = new.count(old)
                    new = new.replace(old, repl) if count else new
                if count:
                    rewrites += count
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
