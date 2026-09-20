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
    from PIL import Image, ImageEnhance, ImageDraw, ImageFont, ImageFilter
except ImportError:
    print("ERROR: Pillow not installed. Run: pip3 install Pillow", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Output directory
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = REPO_ROOT / "assets" / "og"
PROFILE_PHOTO = REPO_ROOT / "assets" / "profile-photo.jpg"

# Slugs that get the owner-photo hero treatment (index card + profile fallback).
PHOTO_SLUGS = {"index", "profile"}
PORTRAIT_DARK = REPO_ROOT / "assets" / "profile-dark-960.jpg"   # studio portrait: grey ground, reads on a dark card
ROOT_DIR_PATH = REPO_ROOT

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
        "#14b8a6",
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
        "#06b6d4",
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
    (
        "spares-readiness-calculator",
        "Critical Spares Engine",
        "FMECA criticality, optimal stock, supplier risk, last-time-buy, Monte-Carlo for DC M&E spares.",
        "#f59e0b",
    ),
    (
        "chiller-plant",
        "Chiller Plant SCADA",
        "Operator-grade chilled-water plant mimic — chillers, pumps, CT, setpoints.",
        "#06b6d4",
    ),
    (
        "datahall",
        "DC Conventional Simulation",
        "Traditional data-hall architecture — racks, CRAC, raised floor, electrical SLD.",
        "#64748b",
    ),
    (
        "fire-system",
        "Fire Suppression System",
        "VESDA, clean-agent suppression, FACP integration — DC fire protection.",
        "#dc2626",
    ),
    (
        "fuel-system",
        "Fuel & Generator System",
        "Diesel storage, day tanks, transfer pumps, generator autonomy.",
        "#f59e0b",
    ),
    (
        "water-system",
        "Water & Make-up System",
        "Condenser-water make-up, treatment, storage, blowdown — DC water balance.",
        "#0ea5e9",
    ),
    (
        "ict",
        "ICT Infrastructure",
        "Structured cabling, network fabric, ODF, fiber pathways for data centers.",
        "#0d9488",
    ),
    (
        "EPMS_Telemetry",
        "EPMS Telemetry",
        "Electrical power monitoring — feeders, breakers, power quality, alarms.",
        "#10b981",
    ),
    (
        "asean-dc-report-2026",
        "ASEAN Data Center Report 2026",
        "Capacity, pipeline, power, and regulatory landscape across Southeast Asia.",
        "#3b82f6",
    ),
    (
        "infographic-dc-cost-breakdown",
        "DC Cost Breakdown",
        "Where the CAPEX & OPEX dollars go in a hyperscale data center build.",
        "#f59e0b",
    ),
    (
        "infographic-dc-sustainability",
        "DC Sustainability",
        "PUE, WUE, CUE, renewable matching, and carbon for modern data centers.",
        "#22c55e",
    ),
    (
        "infographic-pue-global",
        "Global PUE Benchmarks",
        "Power Usage Effectiveness by region, climate, and operator class.",
        "#f59e0b",
    ),
    (
        "achievements",
        "Achievements & Certifications",
        "CDFOM, IOSH, Ahli K3 Listrik — DC operations leadership credentials.",
        "#fbbf24",
    ),
    (
        "insights",
        "Insights",
        "Field notes and analysis on data-center engineering, operations, and strategy.",
        "#3b82f6",
    ),
    (
        "glossary",
        "Data Center Glossary",
        "Definitions for PUE, FMECA, Kraljic, DMSMS, redundancy, tiers, and more.",
        "#10b981",
    ),
    # --- Pages added in v1.18.4 audit ---
    (
        "changelog",
        "Changelog",
        "Live release notes for resistancezero.com — every shipped version from v1.0.0 onward.",
        "#7DDDB4",
    ),
    (
        "dashboard",
        "Dashboard",
        "User dashboard for ResistanceZero — manage your account, saved projects, and progress.",
        "#64748b",
    ),
    (
        "datahallAI",
        "AI Data Hall Dashboard",
        "Live telemetry for AI/HPC infrastructure — Blackwell GPUs, DLC cooling, power distribution, and BMS monitoring.",
        "#06b6d4",
    ),
    (
        "dc-conventional",
        "Conventional DC Dashboard",
        "Conventional data center monitoring dashboard with real-time HVAC, power distribution, and fire-system status.",
        "#64748b",
    ),
    (
        "future-forward",
        "Future Forward",
        "Research series on the future of the web, AI interfaces, platform power, and the next decade of the internet.",
        "#06b6d4",
    ),
    (
        "privacy",
        "Privacy Policy",
        "How ResistanceZero collects, uses, stores, and protects your personal data.",
        "#64748b",
    ),
    (
        "terms",
        "Terms of Service",
        "Terms of service for ResistanceZero.com — data center operations portfolio and engineering tools.",
        "#64748b",
    ),
    (
        "rfs-readiness-workbench",
        "RFS Readiness Workbench",
        "Gate-driven commissioning readiness tracker for data center Ready-for-Service planning.",
        "#3b82f6",
    ),
    (
        "standards-ltc-lab",
        "Root Engineering Lab",
        "Deep standards analysis and high-fidelity liquid-to-chip system modelling for data center operators.",
        "#06b6d4",
    ),
    (
        "ltc-ashrae-thermal-control",
        "ASHRAE Thermal Standards",
        "Comprehensive deep-dive into ASHRAE data center thermal control standards and compliance requirements.",
        "#3b82f6",
    ),
    (
        "ltc-ansi-tia-topology-readiness",
        "ANSI/TIA Topology Readiness",
        "Comprehensive deep-dive into ANSI/TIA structured cabling topology readiness for data centers.",
        "#3b82f6",
    ),
    (
        "ltc-iso-energy-governance",
        "ISO Energy & Governance",
        "Comprehensive deep-dive into ISO 50001 and energy governance frameworks for data centers.",
        "#3b82f6",
    ),
    (
        "ltc-nfpa-fire-risk",
        "NFPA Fire & Safety Risk",
        "Comprehensive deep-dive into NFPA fire protection and safety risk standards for data centers.",
        "#ef4444",
    ),
    (
        "ltc-system-modelling-lab",
        "Liquid-to-Chip Modelling Lab",
        "High-fidelity liquid-to-chip system modelling laboratory with comprehensive input-profile simulation.",
        "#06b6d4",
    ),
    (
        "ltc-uptime-tier-alignment",
        "Uptime Institute Tier Alignment",
        "Comprehensive deep-dive into Uptime Institute Tier I-IV certification alignment for data centers.",
        "#3b82f6",
    ),
    (
        "pln-java-grid-historical",
        "PLN Java-Bali Historical Energy",
        "10-year historical generation mix, demand growth, and renewable transition trends for the Java-Bali grid.",
        "#ef4444",
    ),
    (
        "pln-java-grid-jabar",
        "Jawa Barat Provincial Grid",
        "PLN 500/150 kV transmission ring with 20 kV DC-feeder overlay and industrial load nodes.",
        "#ef4444",
    ),
    (
        "pln-java-grid-jakarta-banten",
        "Jakarta + Banten Provincial Grid",
        "DKI Jakarta and Banten 500/150 kV grid detail with the 20 kV DC-feeder overlay.",
        "#ef4444",
    ),
    (
        "pln-java-grid-jateng",
        "Jawa Tengah + DIY Provincial Grid",
        "Jawa Tengah and DIY 500/150 kV grid with the 20 kV industrial load and DC-feeder overlay.",
        "#ef4444",
    ),
    (
        "pln-java-grid-jatim",
        "Jawa Timur Provincial Grid",
        "Jawa Timur 500/150 kV transmission grid with 20 kV Surabaya DC-feeder overlay.",
        "#ef4444",
    ),
    (
        "tia-942-checklist",
        "TIA-942 Compliance Checklist",
        "80+ item TIA-942-B compliance checklist across 6 domains — rated for 5 data center types.",
        "#f59e0b",
    ),
    (
        "tier-advisor",
        "Tier Advisor",
        "Interactive Uptime Institute tier classification advisor — compare Tier I-IV requirements and find your fit.",
        "#fbbf24",
    ),
    (
        "tools",
        "Tools & Calculators",
        "18 hand-built decision-support tools for data center operators — PUE, CAPEX, OPEX, ROI, TCO, CX and more.",
        "#10b981",
    ),

    # ─────── v1.40.1 — Network Visualization Hub (27 pages) ───────
    ("network-visualization-hub", "Network Visualization Hub",
     "25 animated parameter-driven labs for industrial + IT communication protocols. 5 lanes. CompTIA aligned.",
     "#00DDFF"),
    ("network-compare", "Compare Protocols — Network Hub",
     "Side-by-side comparison of up to 4 communication protocols with normalised instrument chip strip.",
     "#00DDFF"),
    # Lane A — Foundations
    ("network-osi-tcp-ip-models", "OSI / TCP-IP models",
     "Animated visualisation of the OSI 7-layer + TCP/IP 4-layer models. Byte chip ascends the stack.",
     "#00DDFF"),
    ("network-ipv4-vs-ipv6", "IPv4 vs IPv6",
     "Compare 32-bit vs 128-bit addresses side-by-side. Sequential two-stage tones, dual track wire.",
     "#00DDFF"),
    ("network-subnetting-cidr", "Subnetting / CIDR",
     "Subnet boundary line on wire visualises the CIDR prefix. Drag prefix-length slider live.",
     "#00DDFF"),
    ("network-tcp-handshake", "TCP handshake",
     "SYN / SYN-ACK / ACK rendered as 3 distinct chip shapes. RFC 9293.",
     "#00DDFF"),
    ("network-dhcp-dns", "DHCP / DNS",
     "DORA 4-stage monotonic ascending pitch — Discover, Offer, Request, Acknowledge. RFC 2131 + 1035.",
     "#00DDFF"),
    # Lane B — Industrial OT
    ("network-modbus-rtu", "Modbus RTU",
     "RS-485 master/slave byte exchange with V.21 modem-character audio register. CompTIA Net+ §2.1.",
     "#00DDFF"),
    ("network-modbus-tcp", "Modbus TCP",
     "MBAP-header byte exchange over Ethernet. Header chip visibly larger than payload — overhead made visible.",
     "#00DDFF"),
    ("network-bacnet-mstp", "BACnet MS/TP",
     "Token-passing on RS-485. Amber token chip passes between nodes before any data frame. ASHRAE 135.",
     "#00DDFF"),
    ("network-bacnet-ip", "BACnet/IP",
     "ASHRAE 135 over UDP with BVLC tunnel scan-line shroud at packet head.",
     "#00DDFF"),
    ("network-opc-ua", "OPC-UA",
     "IEC 62541 subscription model with always-on encryption shroud + layered binary chips + discovery server.",
     "#00DDFF"),
    ("network-dnp3", "DNP3",
     "IEEE 1815 telemetry SCADA with UNSOLICITED responses — outstation pushes spontaneously without poll.",
     "#00DDFF"),
    ("network-profinet", "PROFINET",
     "IEC 61784-2 real-time industrial Ethernet. Sync line above wire shows cyclic deterministic timing.",
     "#00DDFF"),
    ("network-ethernet-ip", "EtherNet/IP",
     "ODVA CIP over Ethernet. Sawtooth waveform. Envelope chips with rotating CIP-layer marker stripes.",
     "#00DDFF"),
    ("network-ethercat", "EtherCAT",
     "IEC 61158 distributed clocks. Telegram passes through every slave on-the-fly — chip doesn't stop.",
     "#00DDFF"),
    # Lane C — DC Management
    ("network-snmp", "SNMP",
     "Polling cadence visible as amber-dot metronome on wire. RFC 3411/3414.",
     "#00DDFF"),
    ("network-ipmi-redfish", "IPMI / Redfish",
     "Out-of-band management plane on sideband-dashed wire, independent of in-band data path.",
     "#00DDFF"),
    ("network-syslog", "syslog",
     "Append-only one-way log stream. Long-rect line chips. RFC 5424.",
     "#00DDFF"),
    # Lane D — Security
    ("network-tls-handshake", "TLS handshake",
     "Cryptographic ceremony with scan-line shroud that builds progressively across the handshake. RFC 8446.",
     "#00DDFF"),
    ("network-oauth-jwt", "OAuth 2.0 / JWT",
     "4-actor dance with amber→cyan flow-stage tint on token issuance. RFC 6749 + 7519.",
     "#00DDFF"),
    ("network-mtls", "mTLS",
     "Bilateral TLS — both nodes cert-badged; handshake echoes both ways. RFC 8705.",
     "#00DDFF"),
    ("network-wireguard", "WireGuard",
     "Minimalist modern crypto. Pre-keyed mesh with always-on encryption. No separate handshake.",
     "#00DDFF"),
    # Lane E — APIs + Agents
    ("network-rest-api", "REST API",
     "HTTP request/response with envelope chip + header/body distinction + server-processing gap. RFC 9110.",
     "#00DDFF"),
    ("network-graphql", "GraphQL",
     "One outbound long-rect query + multiple inbound field chips (3-shape cap per response).",
     "#00DDFF"),
    ("network-grpc", "gRPC",
     "HTTP/2 4-lane multiplex with simultaneous stream chips on parallel wires.",
     "#00DDFF"),
    ("network-mcp-tool-call", "MCP tool-call",
     "3-actor RPC over MCP transport: agent → tool → resource → back. Industrial register held.",
     "#00DDFF"),
]

# Dynamically extend TARGETS with article + compare + pillar + FF + geopolitics pages
# Each tuple: (slug, title, subtitle, accent_color)
import re as _re
_ROOT = Path(__file__).resolve().parent.parent

def _extract_title_and_desc(html_path):
    """Extract <title> and meta description from a page."""
    if not html_path.exists():
        return None, None
    try:
        text = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None, None
    title_m = _re.search(r"<title>([^<]*)</title>", text, _re.IGNORECASE)
    desc_m = _re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']', text, _re.IGNORECASE)
    title = (title_m.group(1).strip() if title_m else "").split(" | ")[0].split(" — ")[0]
    desc = (desc_m.group(1).strip() if desc_m else "").rstrip(".") + "."
    return title or None, desc if len(desc) > 10 else None

# Article pages — emerald accent
for i in range(1, 30):
    fname = f"article-{i}.html"
    p = _ROOT / fname
    if p.exists():
        title, desc = _extract_title_and_desc(p)
        if title and desc:
            TARGETS.append((f"article-{i}", title[:80], desc[:160], "#10b981"))

# Future Forward — violet accent
for fname in ["FF-1.html", "FF-2.html", "FF-3.html"]:
    p = _ROOT / fname
    if p.exists():
        title, desc = _extract_title_and_desc(p)
        if title and desc:
            slug = fname.replace(".html", "")
            TARGETS.append((slug, title[:80], desc[:160], "#06b6d4"))

# Geopolitics — red accent
for fname in ["geopolitics.html", "geopolitics-1.html", "geopolitics-2.html", "geopolitics-3.html"]:
    p = _ROOT / fname
    if p.exists():
        title, desc = _extract_title_and_desc(p)
        if title and desc:
            slug = fname.replace(".html", "")
            TARGETS.append((slug, title[:80], desc[:160], "#dc2626"))

# Compare pages — cyan accent
for compare_path in _ROOT.glob("compare-*.html"):
    title, desc = _extract_title_and_desc(compare_path)
    if title and desc:
        slug = compare_path.stem
        TARGETS.append((slug, title[:80], desc[:160], "#06b6d4"))

# Pillar pages — gold accent
for pillar_path in _ROOT.glob("pillar-*.html"):
    title, desc = _extract_title_and_desc(pillar_path)
    if title and desc:
        slug = pillar_path.stem
        TARGETS.append((slug, title[:80], desc[:160], "#f59e0b"))

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

# Auto-extend HTML_FILES with the dynamic TARGETS so --update-html walks them too
for _t in TARGETS:
    _slug = _t[0]
    if _slug not in HTML_FILES:
        HTML_FILES[_slug] = f"{_slug}.html"

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

# --- Index-hero palette (matches site index look: near-black base + gold/mint aurora) ---
HERO_BASE = "#0a0e1a"          # index dark base
HERO_AURORA_GOLD = "#fbbf24"   # signal amber
HERO_AURORA_MINT = "#7DDDB4"   # mint accent
AVATAR_DIAMETER = 224          # px, hero avatar
AVATAR_RING = (255, 255, 255, 128)  # thin brand hairline ~ rgba(255,255,255,0.5)


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


def _make_hero_bg() -> Image.Image:
    """Index-hero base: near-black (#0a0e1a) with a soft gold + mint aurora wash.

    Low-opacity radial washes only (gold upper-left, mint lower-right) — no
    saturated generic gradient, matching the site's index hero treatment.
    """
    base = _hex(HERO_BASE)
    img = Image.new("RGBA", (W, H), (*base, 255))

    def _aurora(cx: int, cy: int, radius: int, hex_color: str, max_alpha: int) -> None:
        blob = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(blob)
        ar, ag, ab = _hex(hex_color)
        step = max(1, radius // 70)
        for r in range(radius, 0, -step):
            alpha = int(max_alpha * (1 - r / radius) ** 1.6)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(ar, ag, ab, alpha))
        img.alpha_composite(blob)

    # Gold aurora upper-left, mint aurora lower-right — both very low opacity.
    _aurora(int(W * 0.26), int(H * 0.24), int(W * 0.48), HERO_AURORA_GOLD, 16)
    _aurora(int(W * 0.82), int(H * 0.86), int(W * 0.50), HERO_AURORA_MINT, 14)
    return img.convert("RGB")


def _circular_avatar(
    path: Path, diameter: int, ring_rgba: tuple[int, int, int, int]
) -> Image.Image | None:
    """Load a photo, center-crop to square, apply an anti-aliased circular mask
    (rendered at 4× then downscaled), and draw a thin hairline ring.

    Returns an RGBA image of size (diameter, diameter), or None if the source
    photo is missing/unreadable (caller falls back to a photo-less card).
    """
    if not path.exists():
        return None
    try:
        src = Image.open(path).convert("RGB")
    except Exception:
        return None

    # Center-crop to a square.
    w, h = src.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    src = src.crop((left, top, left + side, top + side))

    ss = 4  # supersample factor for anti-aliased mask + ring
    big = diameter * ss
    photo = src.resize((big, big), Image.LANCZOS).convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)

    avatar_big = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    avatar_big.paste(photo, (0, 0), mask)

    # Thin hairline ring, drawn at supersampled scale (≈1.5px after downscale).
    ring_w = max(1, int(round(1.5 * ss)))
    ImageDraw.Draw(avatar_big).ellipse(
        [ring_w // 2, ring_w // 2, big - 1 - ring_w // 2, big - 1 - ring_w // 2],
        outline=ring_rgba,
        width=ring_w,
    )

    return avatar_big.resize((diameter, diameter), Image.LANCZOS)


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
    if len(lines) > max_lines:
        # v3.9.7 — end on a word, not mid-syllable: the old cap sliced "comparison" to "comp".
        kept = lines[:max_lines]
        kept[-1] = kept[-1].rstrip(" ,;:") + "\u2026"
        return kept
    return lines


def _hero_stats() -> list[tuple[str, str]]:
    """The four figures the homepage already shows, read from index.html at build time.

    Hardcoding them here would let the card drift from the page the moment an article lands;
    the hero counters carry them as data-cu attributes, so the card can just read them.
    """
    import re as _re
    html = (ROOT_DIR_PATH / "index.html").read_text(encoding="utf-8")
    block = html[html.find('class="bento-stats"'):] if 'class="bento-stats"' in html else html
    pairs = _re.findall(
        r'data-cu="(\d+)"[^>]*>\d+</span>(?:<span class="sfx">([^<]*)</span>)?\s*</span>\s*<span class="k">([^<]+)</span>',
        block,
    )
    out = []
    for value, suffix, label in pairs[:4]:
        out.append((f"{value}{suffix or ''}", label.strip().upper()))
    return out


def _identity_card(title: str, subtitle: str) -> Image.Image:
    """The site's own card: a half-bleed portrait, the name, and the proof strip.

    v3.9.7 — the previous one was a 224 px circle on an empty dark rectangle: it said who he is and
    nothing about what the site holds, and two thirds of the canvas carried no information. Owner:
    "og website resistancezero.com kurang bagus terlalu biasa". This one gives the portrait a real
    panel, keeps the instrument language (hairlines, mono figures, one amber accent — no glass, no
    orbs, no gradient wash), and spends the empty half on the four figures the homepage already
    publishes.
    """
    img = _make_hero_bg()
    _add_grain(img)

    panel_w = 430
    portrait = Image.open(PORTRAIT_DARK).convert("RGB")
    scale = max(panel_w / portrait.width, H / portrait.height)
    portrait = portrait.resize((max(1, int(portrait.width * scale)), max(1, int(portrait.height * scale))), Image.LANCZOS)
    left = max(0, (portrait.width - panel_w) // 2)
    top = max(0, int(portrait.height * 0.04))
    portrait = portrait.crop((left, top, left + panel_w, min(portrait.height, top + H)))
    if portrait.height < H:
        portrait = portrait.resize((panel_w, H), Image.LANCZOS)
    img.paste(portrait, (0, 0))

    # feather the portrait's right edge into the card instead of cutting it with a hard line
    fade_w = 190
    base = img.crop((panel_w - fade_w, 0, panel_w, H))
    dark = _make_hero_bg().crop((panel_w - fade_w, 0, panel_w, H))
    mask = Image.new("L", (fade_w, H))
    for x in range(fade_w):
        for_y = int(255 * (x / (fade_w - 1)) ** 0.85)
        mask.paste(for_y, (x, 0, x + 1, H))
    img.paste(Image.composite(dark, base, mask), (panel_w - fade_w, 0))

    draw = ImageDraw.Draw(img)
    # a 1px instrument hairline down the seam
    draw.line([(panel_w, 0), (panel_w, H)], fill="#243244", width=1)

    text_x = panel_w + 64
    max_w = W - text_x - 64

    font_brand = _load_font("mono", 22)
    font_title = _load_font("bold", 60)
    font_role = _load_font("regular", 25)
    font_fig = _load_font("bold", 34)
    font_lbl = _load_font("mono", 15)
    font_url = _load_font("mono", 20)

    draw.text((text_x, 62), "RZ", font=font_brand, fill=BRAND_COLOR)
    draw.line([(text_x + 34, 74), (text_x + 96, 74)], fill=BRAND_COLOR, width=2)

    y = 150
    for line in _wrapped_lines(title, font_title, max_w, 2):
        draw.text((text_x, y), line, font=font_title, fill=TITLE_COLOR)
        y += 70
    y += 8
    for line in _wrapped_lines(subtitle, font_role, max_w, 2):
        draw.text((text_x, y), line, font=font_role, fill=SUBTITLE_COLOR)
        y += 34

    stats = _hero_stats()
    if stats:
        rule_y = y + 34
        draw.line([(text_x, rule_y), (W - 64, rule_y)], fill="#243244", width=1)
        col_w = (W - 64 - text_x) // max(1, len(stats))
        for i, (value, label) in enumerate(stats):
            cx = text_x + i * col_w
            draw.text((cx, rule_y + 26), value, font=font_fig, fill=TITLE_COLOR)
            draw.text((cx, rule_y + 70), label, font=font_lbl, fill=SUBTITLE_COLOR)

    url = "resistancezero.com"
    ubox = draw.textbbox((0, 0), url, font=font_url)
    draw.text((W - (ubox[2] - ubox[0]) - 64, H - 52), url, font=font_url, fill=STRIP_COLOR)
    _add_bottom_border(img)
    return img


def _FAMILY_LABEL(slug: str) -> str:
    """What kind of page this is, from the slug. One label per family, never one per page."""
    table = [
        ("incident-", "INCIDENT CASE FILE"),
        ("cdu-", "LIQUID COOLING TOOLKIT"),
        ("fire-", "FIRE SAFETY TOOLKIT"),
        ("ltc-", "LIQUID-TO-CHIP LAB"),
        ("compare-", "COMPARISON"),
        ("article-", "ARTICLE"),
        ("standards-", "STANDARDS LAB"),
        ("pln-", "GRID MONITOR"),
        ("spares", "SPARES READINESS"),
    ]
    for prefix, label in table:
        if slug.startswith(prefix):
            return label
    if slug.endswith("-calculator") or slug.endswith("calculator"):
        return "CALCULATOR"
    if slug.endswith("-checklist"):
        return "CHECKLIST"
    if slug.endswith("-dashboard") or slug.endswith("-tracker") or slug.endswith("-monitor"):
        return "MONITOR"
    return ""


def _hero_for(slug: str) -> "Path | None":
    """A slice of the page's own hero image, when it has one.

    v3.10.2 — owner: "OG per halaman ya jangan tulisan aja, kasih sedikit potongan hero image dari
    page itu kan bisa." A text-only card is honest but it is also anonymous; the page's own artwork
    is the one image guaranteed to be about the page. Prefer an element the page itself marks as a
    hero, fall back to its first content image, and never take a logo, badge, icon or avatar — those
    are chrome, not subject.
    """
    import re as _re
    path = REPO_ROOT / f"{slug}.html"
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8", errors="ignore")
    marked = _re.search(
        r'<img[^>]+?(?:class="[^"]*(?:hero|brief-hero|sp-hero|article-hero)[^"]*"|data-rz-hero)[^>]*?src="([^"?]+)"',
        text, _re.I,
    )
    candidates = [marked.group(1)] if marked else []
    candidates += _re.findall(r'<img[^>]+src="((?!data:|https?:)[^"?]+\.(?:webp|jpg|jpeg|png))"', text, _re.I)
    for candidate in candidates:
        if _re.search(r"(logo|badge|favicon|avatar|profile-photo|icon|og/)", candidate, _re.I):
            continue
        resolved = REPO_ROOT / candidate
        if resolved.exists():
            return resolved
    return None


def _hero_panel(img: "Image.Image", hero_path: "Path", panel_w: int = 430) -> "Image.Image":
    """Paste a hero slice down the right edge, feathered into the card."""
    hero = Image.open(hero_path).convert("RGB")
    scale = max(panel_w / hero.width, H / hero.height)
    hero = hero.resize((max(1, int(hero.width * scale)), max(1, int(hero.height * scale))), Image.LANCZOS)
    left = max(0, (hero.width - panel_w) // 2)
    # from the TOP: the opening of a hero is what a reader recognises; a centre crop of a tall
    # infographic lands in the middle of a chart and reads as noise at thumbnail size.
    hero = hero.crop((left, 0, left + panel_w, min(hero.height, H)))
    if hero.height < H:
        hero = hero.resize((panel_w, H), Image.LANCZOS)
    # a page's artwork is usually bright; sit it back a little so the card reads as one surface
    hero = ImageEnhance.Brightness(hero).enhance(0.92)
    x0 = W - panel_w
    img.paste(hero, (x0, 0))

    fade_w = 190
    base = img.crop((x0, 0, x0 + fade_w, H))
    dark = _make_gradient_bg().crop((x0, 0, x0 + fade_w, H))
    mask = Image.new("L", (fade_w, H))
    for x in range(fade_w):
        value = int(255 * (1 - x / (fade_w - 1)) ** 0.85)
        mask.paste(value, (x, 0, x + 1, H))
    img.paste(Image.composite(dark, base, mask), (x0, 0))
    ImageDraw.Draw(img).line([(x0, 0), (x0, H)], fill="#243244", width=1)
    return img


def build_og_image(slug: str, title: str, subtitle: str, accent_hex: str) -> Image.Image:
    """Render a 1200×630 OG card and return the PIL Image."""
    # Photo slugs (index + profile fallback) get the index-hero base + avatar.
    if slug in PHOTO_SLUGS:
        return _identity_card(title, subtitle)
    avatar = None

    if avatar is not None:
        img = _make_hero_bg()
    else:
        img = _make_gradient_bg()
        _add_radial_blob(img, accent_hex)

    hero_path = _hero_for(slug) if avatar is None else None
    if hero_path is not None:
        try:
            img = _hero_panel(img, hero_path)
        except Exception as exc:                      # a broken asset must not fail the card
            print(f"  [HERO?]  {slug}: {hero_path.name} unusable ({exc}); text-only card")
            hero_path = None

    _add_grain(img)
    _add_bottom_border(img)

    # ---- Composite the hero avatar (left of the title, vertically centered) ----
    pad_x = 72
    pad_y_top = 52
    avatar_x = pad_x
    if avatar is not None:
        avatar_y = (H - AVATAR_DIAMETER) // 2
        rgba = img.convert("RGBA")
        rgba.alpha_composite(avatar, (avatar_x, avatar_y))
        img = rgba.convert("RGB")

    draw = ImageDraw.Draw(img)

    # ---- Fonts ----
    font_brand_sm = _load_font("bold", 24)
    font_title = _load_font("bold", 64)
    font_subtitle = _load_font("regular", 26)
    font_mono = _load_font("mono", 22)

    # Text block shifts right of the avatar when a photo is present.
    text_x = pad_x
    if avatar is not None:
        text_x = avatar_x + AVATAR_DIAMETER + 56

    # ---- Family label: what KIND of page this is, one line, mono, in the family accent.
    # v3.9.7 — the generic card was a title over an empty lower half. The label costs one line and
    # tells a reader scrolling LinkedIn whether they are looking at a calculator, a checklist or a
    # monitor. It is derived from the slug, never typed per page. ----
    family = _FAMILY_LABEL(slug)

    # ---- Brand mark "RZ" ----
    draw.text((text_x, pad_y_top), "RZ", font=font_brand_sm, fill=BRAND_COLOR)

    # ---- Accent line under brand ----
    brand_bbox = draw.textbbox((text_x, pad_y_top), "RZ", font=font_brand_sm)
    line_y = brand_bbox[3] + 8
    line_x_end = brand_bbox[2] + 40
    ar, ag, ab = _hex(accent_hex)
    for i, x in enumerate(range(text_x, line_x_end)):
        alpha = max(0, 1 - (x - text_x) / (line_x_end - text_x))
        draw.point((x, line_y), fill=(ar, ag, ab))

    # ---- Title block (vertically centered in upper 70% of card) ----
    max_text_w = (W - 430 - 40 if hero_path is not None else W - pad_x) - text_x
    title_lines = _wrapped_lines(title, font_title, max_text_w, 2)
    title_line_h = 74  # approx line height for 64px

    subtitle_lines = _wrapped_lines(subtitle, font_subtitle, max_text_w, 3)
    subtitle_line_h = 36

    total_text_h = (
        len(title_lines) * title_line_h
        + 20  # gap title→subtitle
        + len(subtitle_lines) * subtitle_line_h
    )
    font_family_lbl = _load_font("mono", 19)
    label_h = 42 if family else 0
    total_text_h += label_h
    # centre the block in the card rather than hanging it from the top third
    text_y = max(pad_y_top + 70, (H - total_text_h) // 2)
    if family:
        draw.text((text_x, text_y), family, font=font_family_lbl, fill=accent_hex)
        text_y += label_h

    # Title
    for line in title_lines:
        draw.text((text_x, text_y), line, font=font_title, fill=TITLE_COLOR)
        text_y += title_line_h

    text_y += 20

    # Subtitle
    for line in subtitle_lines:
        draw.text((text_x, text_y), line, font=font_subtitle, fill=SUBTITLE_COLOR)
        text_y += subtitle_line_h

    # ---- Bottom brand strip ----
    brand_text = "resistancezero.com"
    mono_bbox = draw.textbbox((0, 0), brand_text, font=font_mono)
    brand_w = mono_bbox[2] - mono_bbox[0]
    # v3.10.2 — bottom-LEFT when a hero panel owns the right edge: the first cut printed the URL
    # over the artwork, where it was unreadable.
    brand_x = pad_x if hero_path is not None else W - brand_w - pad_x
    brand_y = H - 46
    draw.text((brand_x, brand_y), brand_text, font=font_mono, fill=STRIP_COLOR)

    return img


# ---------------------------------------------------------------------------
# HTML meta-tag patcher
# ---------------------------------------------------------------------------
def _public_slugs() -> set:
    """Slugs sitemap.xml publishes. Cached; empty set when the sitemap is unreadable."""
    if not hasattr(_public_slugs, "_cache"):
        import re as _re
        try:
            xml = (REPO_ROOT / "sitemap.xml").read_text(encoding="utf-8")
        except OSError:
            _public_slugs._cache = set()
            return _public_slugs._cache
        slugs = set()
        for loc in _re.findall(r"<loc>([^<]+)</loc>", xml):
            name = loc.rstrip("/").split("/")[-1]
            if name.endswith(".html"):
                slugs.add(name[:-5])
            elif not name or "." not in name:
                slugs.add("index")
        _public_slugs._cache = slugs
    return _public_slugs._cache


def _discover_targets(include_existing: bool = False) -> list[tuple[str, str, str, str, Path]]:
    """Every root page that advertises NO card, derived from the page itself.

    v3.9.7 — TARGETS is a hand-kept list, so 61 pages (the whole incident dossier among them) went
    out with no og:image at all: shared on LinkedIn or WhatsApp they showed a bare link. A hand list
    is why; the pages already carry a <title> and a description, so the card can be derived instead
    of transcribed.
    """
    import re as _re
    out = []
    for path in sorted(REPO_ROOT.glob("*.html")):
        slug = path.stem
        if slug in {h[:-5] for h in HTML_FILES.values()} and slug in {t[0] for t in TARGETS}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        og = _re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', text, _re.I)
        # A page "has" a card only when it points at its OWN card. Ten public pages advertised the
        # generic profile photo or another page's card, which is the same thing as having none:
        # every one of them shares as the same picture.
        if og and _re.search(rf"/assets/og/{_re.escape(slug)}(?:-\d{{8}})?\.webp", og.group(1)):
            # ...unless the card it points at is not on disk: a 404 preview is a missing card with
            # extra steps (ai-engineering-maintenance advertised one for months without the file).
            # --force means "rebuild what you know how to build", including these
            if (OUTPUT_DIR / f"{slug}.webp").exists() and not include_existing:
                continue
        # a redirect stub has nothing to preview, and a page the sitemap does not publish is not
        # a page anyone shares — sitemap.xml is the site's own definition of "public"
        if _re.search(r'http-equiv=["\']refresh', text, _re.I):
            continue
        if _public_slugs() and slug not in _public_slugs():
            continue
        title_m = _re.search(r"<title>(.*?)</title>", text, _re.S | _re.I)
        desc_m = _re.search(r'<meta\s+name="description"\s+content="(.*?)"', text, _re.S | _re.I)
        if not title_m:
            continue
        import html as _html
        title = _html.unescape(_re.sub(r"\s+", " ", title_m.group(1)).strip())
        title = _re.split(r"\s+[|\u2014\u00b7-]\s+", title)[0][:72]
        subtitle = _html.unescape(_re.sub(r"\s+", " ", desc_m.group(1)).strip()) if desc_m else "resistancezero.com"
        if len(subtitle) > 150:
            subtitle = subtitle[:150].rsplit(" ", 1)[0].rstrip(" ,;:\u2014-") + "\u2026"
        accent = ACCENT_FOR_FAMILY(slug)
        out.append((slug, title, subtitle, accent, path))
    return out


def ACCENT_FOR_FAMILY(slug: str) -> str:
    """One hue per FAMILY, never one per page (§A9 bans the rainbow).

    incidents are faults, calculators and labs are instrument-cyan, everything else takes the brand
    amber — three semantic slots, not a palette.
    """
    if slug.startswith("incident-") or slug.startswith("dc-incidents"):
        return "#ef4444"
    if slug.startswith("fire-"):
        return "#ef4444"
    if any(slug.startswith(prefix) for prefix in ("cdu-", "calc", "ltc-", "compare-", "spares", "standards-")):
        return "#22d3ee"
    return "#fbbf24"


def _ensure_card_meta(slug: str, html_path: Path, alt: str) -> bool:
    """Write the full card meta block into a page that has none."""
    import re as _re
    text = html_path.read_text(encoding="utf-8")
    if _re.search(r'<meta\s+property="og:image"\s+content="[^"]+"', text, _re.I):
        return _patch_html(slug, html_path)
    url = f"https://resistancezero.com/assets/og/{slug}.webp"
    esc = alt.replace('"', "&quot;")
    block = (
        f'    <meta property="og:image" content="{url}">\n'
        f'    <meta property="og:image:width" content="1200">\n'
        f'    <meta property="og:image:height" content="630">\n'
        f'    <meta property="og:image:alt" content="{esc}">\n'
        f'    <meta name="twitter:card" content="summary_large_image">\n'
        f'    <meta name="twitter:image" content="{url}">\n'
    )
    anchor = _re.search(r'[ \t]*<meta\s+property="og:(?:title|description|url|type)"[^>]*>\n', text, _re.I)
    if anchor:
        at = anchor.end()
    else:
        head = _re.search(r"</title>\n", text, _re.I)
        if not head:
            return False
        at = head.end()
    text = text[:at] + block + text[at:]
    # a page may carry twitter:card already; do not duplicate it
    if text.count('name="twitter:card"') > 1:
        first = text.index('<meta name="twitter:card"')
        second = text.index('name="twitter:card"', first + 40)
        line_start = text.rindex("\n", 0, second) + 1
        line_end = text.index("\n", second) + 1
        text = text[:line_start] + text[line_end:]
    html_path.write_text(text, encoding="utf-8")
    return True


def _patch_html(slug: str, html_path: Path) -> bool:
    """
    Replace og:image and twitter:image tags, ensure width/height metas exist.
    Returns True if the file was modified.

    v3.9.7 — a hand-kept list outlives its pages: HTML_FILES still named
    network-osi-tcp-ip-models.html, which no longer exists, and the whole run died on it mid-way
    through patching. A stale entry is a finding, not a crash.
    """
    if not html_path.exists():
        print(f"  [STALE]  {slug}: {html_path.name} is listed in HTML_FILES but not on disk")
        return False
    new_url = f"https://resistancezero.com/assets/og/{slug}.webp"
    text = html_path.read_text(encoding="utf-8")

    # v3.9.7 — DO NOT return early when og:image already points at the card. Nine pages reached
    # that state with no og:image:alt and no twitter:image, and this early return is why the
    # completeness fills below could never run on them.
    if new_url in text:
        print(f"  [CHECK]  {html_path.name} — card already linked; completing the tag set")

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

    # og:image:alt — a preview without alt text is unreadable to a screen reader and to a crawler
    if 'property="og:image:alt"' not in text:
        import re as _re2
        title_m = _re2.search(r"<title>(.*?)</title>", text, _re2.S | _re2.I)
        import html as _html2
        alt = _html2.unescape(_re2.sub(r"\s+", " ", title_m.group(1)).strip()) if title_m else slug
        alt = alt.replace('"', "&quot;")[:180]
        text = _re.sub(
            r'(<meta\s+property="og:image:height"\s+content="[^"]*">)',
            rf'\1\n    <meta property="og:image:alt" content="{alt}">',
            text, count=1, flags=_re.IGNORECASE,
        )
    # twitter:image — X renders its own tag; without it the card falls back to a bare link
    if 'name="twitter:image"' not in text:
        text = _re.sub(
            r'(<meta\s+property="og:image"\s+content="[^"]*">)',
            rf'\1\n    <meta name="twitter:image" content="{new_url}">',
            text, count=1, flags=_re.IGNORECASE,
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
        "--discover", action="store_true",
        help="Also build a card for every root page that advertises none, derived from its own head",
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

    work = [(slug, title, subtitle, accent, None) for slug, title, subtitle, accent in TARGETS]
    if args.discover:
        found = _discover_targets(include_existing=args.force)
        print(f"  [DISCOVER] {len(found)} page(s) advertise no card; deriving from their own <title> + description")
        work += found

    for slug, title, subtitle, accent, page_path in work:
        out_path = OUTPUT_DIR / f"{slug}.webp"

        if out_path.exists() and not args.force:
            size_kb = out_path.stat().st_size / 1024
            print(f"  [EXISTS] {slug}.webp  ({size_kb:.1f} KB)")
            skipped.append((slug, size_kb))
            if args.update_html and slug in HTML_FILES:
                _patch_html(slug, REPO_ROOT / HTML_FILES[slug])
            elif args.update_html and page_path is not None:
                _ensure_card_meta(slug, page_path, title)
            continue

        print(f"  [GEN]    {slug}.webp  title={title!r} accent={accent}")

        if args.apply or args.force:
            img = build_og_image(slug, title, subtitle, accent)
            # a card carrying photographic artwork costs more bytes than a flat one; 80 keeps the
            # hero cards under the platform-friendly budget without a visible difference at the
            # size anyone ever sees them.
            quality = 80 if (slug not in PHOTO_SLUGS and _hero_for(slug) is not None) else 85
            img.save(str(out_path), "WEBP", quality=quality, method=4)
            size_kb = out_path.stat().st_size / 1024
            total_bytes += out_path.stat().st_size
            generated.append((slug, size_kb))
            print(f"           → {size_kb:.1f} KB  ({W}×{H})")

            if args.update_html and slug in HTML_FILES:
                _patch_html(slug, REPO_ROOT / HTML_FILES[slug])
            elif args.update_html and page_path is not None:
                _ensure_card_meta(slug, page_path, title)
        else:
            print(f"           (dry run, not writing)")

    # v3.9.7 — the completeness pass. Discovery only returns pages that LACK a card, so pages that
    # already linked one were never re-examined — and nine of them carried no og:image:alt and no
    # twitter:image for as long as the card existed. With --update-html, walk every public page
    # that advertises its own card and fill whatever the tag set is missing.
    if args.update_html:
        completed = 0
        for path in sorted(REPO_ROOT.glob("*.html")):
            slug = path.stem
            if _public_slugs() and slug not in _public_slugs():
                continue
            if not (OUTPUT_DIR / f"{slug}.webp").exists():
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if 'property="og:image:alt"' in text and 'name="twitter:image"' in text:
                continue
            if _patch_html(slug, path):
                completed += 1
        if completed:
            print(f"  [COMPLETE] filled the missing tag set on {completed} page(s)")

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
