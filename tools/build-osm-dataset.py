#!/usr/bin/env python3
"""
build-osm-dataset.py — OSM Overpass crawler for PLN Java-Bali grid.

Queries OSM Overpass API for power=substation, plant, generator, line features
across the Java + Bali bbox [-9, 105, -5, 116] and emits a JS data file with
the same `window.PLN_JAVA_GRID = {...}` schema used by `js/pln-java-grid-data.js`.

Usage:
    python3 tools/build-osm-dataset.py [--force] [--dry-run]

Idempotent: re-running produces identical output (sorted by id).
Cache: tools/.cache/overpass-{md5}.json (24 h TTL).
Overlay: tools/pln-java-grid-overlay.{yaml,json} merged into nodes if present.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

try:
    import yaml  # type: ignore
    HAS_YAML = True
except Exception:
    HAS_YAML = False


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT = Path(__file__).resolve().parent.parent  # rz-work/
TOOLS = ROOT / "tools"
CACHE_DIR = TOOLS / ".cache"
OUT_FILE = ROOT / "js" / "pln-java-grid-data.js"
OVERLAY_YAML = TOOLS / "pln-java-grid-overlay.yaml"
OVERLAY_JSON = TOOLS / "pln-java-grid-overlay.json"

OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
CACHE_TTL_SECONDS = 24 * 3600

QUERY_FEATURES = """
[out:json][timeout:180];
(
  node["power"="substation"](-9.0,105.0,-5.0,116.0);
  way["power"="substation"](-9.0,105.0,-5.0,116.0);
  node["power"~"^(plant|generator)$"](-9.0,105.0,-5.0,116.0);
  way["power"~"^(plant|generator)$"](-9.0,105.0,-5.0,116.0);
);
out tags center;
""".strip()

QUERY_LINES = """
[out:json][timeout:180];
way["power"="line"](-9.0,105.0,-5.0,116.0);
out geom 200;
""".strip()

# Standard PLN voltage tiers (kV) — round OSM voltage to the nearest of these.
VOLTAGE_TIERS = [500, 275, 150, 70, 20]

# Province bbox table: lat_min, lat_max, lng_min, lng_max
PROV_BBOX: Dict[str, Tuple[float, float, float, float]] = {
    "jakarta-banten": (-6.50, -5.85, 105.20, 107.00),
    "jabar":          (-7.80, -6.20, 106.30, 108.80),
    "jateng":         (-8.20, -6.50, 108.80, 111.30),
    "jatim":          (-8.80, -6.80, 111.30, 114.60),
    "bali":           (-8.85, -8.05, 114.40, 115.75),
}

# OSM source -> our 7 fuel categories
FUEL_MAP: Dict[str, str] = {
    "coal": "coal",
    "gas": "gas",
    "natural_gas": "gas",
    "oil": "gas",      # fold heavy fuel oil into gas tier
    "diesel": "gas",
    "hydro": "hydro",
    "water": "hydro",
    "geothermal": "geo",
    "solar": "solar",
    "photovoltaic": "solar",
    "biomass": "biomass",
    "biogas": "biomass",
    "waste": "biomass",
    "wind": "wind",
}

NATIONAL = {
    "installedMW": 47000,
    "peakMW": 32000,
    "reservePct": 31.0,
    "renewablePct": 13.5,
    "dcMW": 950,
    "substations": 142,
    "txKm": 67500,
}

VERSION = "2026-04-29-v3"


# ============================================================================
# HELPERS
# ============================================================================

def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:10]


def fetch_overpass(query: str, force: bool = False) -> Dict[str, Any]:
    """Fetch Overpass JSON, with file cache + retry/backoff."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"overpass-{md5(query)}.json"

    if not force and cache_path.exists():
        age = time.time() - cache_path.stat().st_mtime
        if age < CACHE_TTL_SECONDS:
            log(f"[cache hit] {cache_path.name} (age {int(age)}s)")
            with cache_path.open() as f:
                return json.load(f)

    backoffs = [5, 15, 45]
    last_err: Optional[Exception] = None
    for attempt, delay in enumerate([0] + backoffs):
        if delay:
            log(f"[retry] sleeping {delay}s before attempt {attempt+1}/{len(backoffs)+1}")
            time.sleep(delay)
        try:
            log(f"[overpass] POST {OVERPASS_ENDPOINT} (q={md5(query)})")
            r = requests.post(
                OVERPASS_ENDPOINT,
                data={"data": query},
                timeout=200,
                headers={"User-Agent": "rz-work-pln-grid/1.0 (https://resistancezero.com)"},
            )
            if r.status_code == 429:
                last_err = RuntimeError(f"Overpass 429 rate-limited")
                continue
            if r.status_code != 200:
                last_err = RuntimeError(f"Overpass HTTP {r.status_code}: {r.text[:200]}")
                continue
            payload = r.json()
            with cache_path.open("w") as f:
                json.dump(payload, f)
            log(f"[overpass] {len(payload.get('elements', []))} elements; cached -> {cache_path}")
            return payload
        except Exception as e:
            last_err = e
            log(f"[overpass] attempt {attempt+1} error: {e}")

    raise RuntimeError(f"Overpass failed after retries: {last_err}")


def in_bbox(lat: float, lng: float, bbox: Tuple[float, float, float, float]) -> bool:
    lat_min, lat_max, lng_min, lng_max = bbox
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


def classify_prov(lat: float, lng: float) -> str:
    for prov, bbox in PROV_BBOX.items():
        if in_bbox(lat, lng, bbox):
            return prov
    return "other"


def project_xy(lat: float, lng: float) -> Tuple[int, int]:
    x = round(80 + (lng - 105) * 124)
    y = round(120 + (-5.5 - lat) * 200)
    # Clamp to viewBox 0 0 1400 800
    x = max(0, min(1400, x))
    y = max(0, min(800, y))
    return x, y


def parse_voltage_list(raw: Optional[str]) -> List[int]:
    """Parse OSM voltage tag into kV list. e.g., '150000;20000' -> [150, 20]."""
    if not raw:
        return []
    parts = re.split(r"[;,/]+", raw)
    out: List[int] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # may be "150000" or "150 kV" or "150kV"
        m = re.search(r"(\d+(?:\.\d+)?)", p)
        if not m:
            continue
        val = float(m.group(1))
        # If unit-less and big, assume volts; if small (<= 1100), assume kV.
        if val > 1100:
            kv = val / 1000.0
        else:
            kv = val
        out.append(int(round(kv)))
    return out


def round_to_tier(kv: int) -> int:
    """Round kV to the nearest standard PLN tier (500/275/150/70/20)."""
    return min(VOLTAGE_TIERS, key=lambda t: abs(t - kv))


def parse_year(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    m = re.match(r"(\d{4})", raw)
    if m:
        y = int(m.group(1))
        if 1900 <= y <= 2100:
            return y
    return None


def parse_mw(raw: Optional[str]) -> Optional[int]:
    """Parse '500 MW' / '500000 kW' / '500' to integer MW."""
    if not raw:
        return None
    s = raw.strip().lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(g|m|k)?w?", s)
    if not m:
        return None
    val = float(m.group(1))
    unit = m.group(2) or "m"
    mult = {"g": 1000.0, "m": 1.0, "k": 0.001}.get(unit, 1.0)
    mw = val * mult
    return int(round(mw)) if mw >= 1 else None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def feature_latlng(el: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    if el.get("type") == "node":
        return (el["lat"], el["lon"])
    c = el.get("center")
    if c:
        return (c["lat"], c["lon"])
    return None


# ============================================================================
# OVERLAY
# ============================================================================

def load_overlay() -> Dict[str, Dict[str, Any]]:
    """Load hand-curated overlay from YAML (preferred) or JSON. Returns {} if absent.

    Accepts two layouts:
      (a) flat top-level mapping: {slug: {fields...}, ...}
      (b) nested under 'annotations' key, with optional sibling 'version' key
          that is ignored.
    """
    raw: Dict[str, Any] = {}
    if OVERLAY_YAML.exists() and HAS_YAML:
        with OVERLAY_YAML.open() as f:
            raw = yaml.safe_load(f) or {}
        log(f"[overlay] loaded {OVERLAY_YAML.name}")
    elif OVERLAY_YAML.exists() and not HAS_YAML:
        log(f"[overlay] yaml file present but pyyaml missing; using minimal parser")
        raw = _parse_yaml_minimal(OVERLAY_YAML.read_text())
    elif OVERLAY_JSON.exists():
        with OVERLAY_JSON.open() as f:
            raw = json.load(f)
        log(f"[overlay] loaded {OVERLAY_JSON.name}")
    else:
        log("[overlay] no overlay file present (skipping)")
        return {}

    # Nested layout detection
    if isinstance(raw, dict) and "annotations" in raw and isinstance(raw["annotations"], dict):
        data = raw["annotations"]
    else:
        # Flat layout — drop reserved meta keys
        data = {k: v for k, v in raw.items() if k not in ("version", "annotations") and isinstance(v, dict)}
    log(f"[overlay] {len(data)} entries available")
    return data


def _parse_yaml_minimal(text: str) -> Dict[str, Dict[str, Any]]:
    """Tiny YAML parser: top-level mapping of mappings with scalar/list values."""
    out: Dict[str, Dict[str, Any]] = {}
    cur_key: Optional[str] = None
    cur_field: Optional[str] = None
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if not raw.startswith(" ") and raw.rstrip().endswith(":"):
            cur_key = raw.rstrip()[:-1].strip()
            out[cur_key] = {}
            cur_field = None
            continue
        if cur_key is None:
            continue
        if raw.startswith("    - "):
            # list item under cur_field
            if cur_field and cur_field in out[cur_key] and isinstance(out[cur_key][cur_field], list):
                out[cur_key][cur_field].append(raw.strip()[2:].strip().strip('"').strip("'"))
            continue
        if raw.startswith("  ") and ":" in raw:
            field, _, val = raw.strip().partition(":")
            field = field.strip()
            val = val.strip()
            cur_field = field
            if not val:
                out[cur_key][field] = []  # list begins on next line
            else:
                # scalar
                if val.lstrip("-").isdigit():
                    out[cur_key][field] = int(val)
                else:
                    out[cur_key][field] = val.strip('"').strip("'")
    return out


def slug_normalize(text: str) -> str:
    """Lowercase + strip non-alphanumeric, for fuzzy slug matching."""
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def slug_to_name_keywords(slug: str) -> List[str]:
    """E.g., 'paiton_gi' -> ['paiton'], 'cikarang_150' -> ['cikarang']."""
    parts = re.split(r"[_-]", slug.lower())
    return [p for p in parts if p and not p.isdigit() and p not in ("gi", "gitet", "p")]


def apply_overlay_entry(node: Dict[str, Any], entry: Dict[str, Any]) -> None:
    for f in ("mva", "year", "cod", "served_areas", "notes"):
        if f in entry and entry[f] is not None:
            if f == "cod":
                node["year"] = entry[f]
            else:
                node[f] = entry[f]
    if "tier_override" in entry:
        node["tier"] = entry["tier_override"]
    if "prov_override" in entry:
        node["prov"] = entry["prov_override"]
    if "confidence_override" in entry:
        node["confidence"] = entry["confidence_override"]


def merge_overlay_all(nodes: List[Dict[str, Any]],
                      overlay: Dict[str, Dict[str, Any]]) -> set:
    """Merge overlay into nodes. Returns set of overlay keys NOT matched."""
    if not overlay:
        return set()

    matched: set = set()

    # First pass: exact id match (osm_node_123 / osm_way_456)
    by_id = {n["id"]: n for n in nodes}
    for key, entry in overlay.items():
        if key in by_id and isinstance(entry, dict):
            apply_overlay_entry(by_id[key], entry)
            matched.add(key)

    # Second pass: fuzzy slug match against node name
    for key, entry in overlay.items():
        if key in matched or not isinstance(entry, dict):
            continue
        keywords = slug_to_name_keywords(key)
        if not keywords:
            continue
        # Find best candidate: a node whose normalized name contains all keywords.
        candidates: List[Dict[str, Any]] = []
        for n in nodes:
            name_norm = slug_normalize(n["name"])
            if all(kw in name_norm for kw in keywords):
                candidates.append(n)
        if not candidates:
            continue
        # Prefer kind matching the slug prefix (p_xxx -> plant)
        prefer_plant = key.startswith("p_")
        candidates.sort(key=lambda n: (
            (n["kind"] != "plant") if prefer_plant else (n["kind"] != "station"),
            -n.get("voltage", 0),  # higher voltage first
            n["confidence"] != "high",
        ))
        target = candidates[0]
        apply_overlay_entry(target, entry)
        matched.add(key)

    unmatched = set(overlay.keys()) - matched
    return unmatched


# ============================================================================
# PARSE FEATURES
# ============================================================================

def parse_feature(el: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tags = el.get("tags") or {}
    latlng = feature_latlng(el)
    if not latlng:
        return None
    lat, lng = latlng

    power = tags.get("power", "")
    if power == "substation":
        kind = "station"
    elif power in ("plant", "generator"):
        kind = "plant"
    else:
        return None

    voltages = parse_voltage_list(tags.get("voltage"))
    name = tags.get("name") or tags.get("ref")
    if not name:
        op = tags.get("operator")
        sub = tags.get("substation")
        if op and sub:
            name = f"{op} {sub}"

    # Skip very low-signal features: no name and no voltage tag.
    has_real_name = bool(tags.get("name") or tags.get("ref") or (tags.get("operator") and tags.get("substation")))
    if not has_real_name and not voltages:
        return None
    if not name:
        name = f"Unnamed substation @ {lat:.3f},{lng:.3f}"

    # Voltage selection
    primary_kv: Optional[int] = None
    secondary_kv: List[int] = []
    if voltages:
        sorted_v = sorted(set(voltages), reverse=True)
        primary_kv = round_to_tier(sorted_v[0])
        secondary_kv = [round_to_tier(v) for v in sorted_v[1:] if round_to_tier(v) != primary_kv]
    else:
        sub_type_pre = tags.get("substation", "")
        if sub_type_pre == "transmission":
            primary_kv = 150
        elif sub_type_pre in ("minor_distribution", "distribution"):
            primary_kv = 20
        else:
            primary_kv = 20  # last resort default for unmatched substation

    # Province
    prov = classify_prov(lat, lng)
    if prov == "other":
        return None

    # Filter: drop 20 kV minor distribution boxes (gardu distribusi).
    # The user's plan explicitly excludes the exhaustive feeder map.
    sub_type = tags.get("substation", "")
    if primary_kv == 20:
        if sub_type in ("minor_distribution", "distribution"):
            return None
        # Require a real explicit name for 20 kV nodes (no operator-fallback)
        if not tags.get("name") and not tags.get("ref"):
            return None
        # Drop traction substations (railway power) — out of scope
        if sub_type == "traction":
            return None
        # Drop tiny named gardu (regex like "GD 205", "PK 276", "B 246", "AB 11 E")
        nm = tags.get("name", "") or tags.get("ref", "")
        if re.match(r"^(GD|PK|GH|GP|AB|SD|B)\s*[\.\s]?\d+", nm.strip(), re.IGNORECASE):
            return None
        if re.match(r"^[A-Z]{1,3}\s*\d+\s*[A-Z]?$", nm.strip()):
            return None

    # Operator
    operator = tags.get("operator")
    if not operator:
        operator = "PLN" if primary_kv >= 70 else "unknown"

    # MVA
    mva: Optional[int] = None
    if "capacity_mva" in tags:
        try:
            mva = int(round(float(tags["capacity_mva"])))
        except Exception:
            pass

    # Year
    year = parse_year(tags.get("start_date"))

    # Plant fuel + MW
    fuel: Optional[str] = None
    mw: Optional[int] = None
    if kind == "plant":
        src = tags.get("plant:source") or tags.get("generator:source") or ""
        for token in re.split(r"[;,]", src):
            token = token.strip().lower()
            if token in FUEL_MAP:
                fuel = FUEL_MAP[token]
                break
        mw = parse_mw(tags.get("plant:output:electricity") or tags.get("generator:output:electricity"))

    # Coordinates
    x, y = project_xy(lat, lng)

    # Tier
    tier = 1 if primary_kv >= 150 else 2

    # Confidence
    has_voltage = bool(tags.get("voltage"))
    has_name = bool(tags.get("name") or tags.get("ref"))
    if has_voltage and has_name:
        confidence = "high"
    elif has_name:
        confidence = "medium"
    else:
        confidence = "low"

    osm_type = el["type"]
    osm_id_num = el["id"]
    node_id = f"osm_{osm_type}_{osm_id_num}"

    out: Dict[str, Any] = {
        "id": node_id,
        "name": name,
        "kind": kind,
        "voltage": primary_kv,
        "mva": mva,
        "year": year,
        "prov": prov,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "x": x,
        "y": y,
        "tier": tier,
        "confidence": confidence,
        "operator": operator,
        "source": "osm",
        "osm_id": osm_id_num,
        "osm_type": osm_type,
    }
    if secondary_kv:
        out["secondary_voltages"] = secondary_kv
    if kind == "plant":
        if fuel:
            out["fuel"] = fuel
        if mw is not None:
            out["mw"] = mw
    if "wikidata" in tags:
        out["wikidata"] = tags["wikidata"]

    return out


# ============================================================================
# EDGES (from OSM power=line)
# ============================================================================

def build_node_index(nodes: List[Dict[str, Any]]) -> List[Tuple[float, float, str]]:
    """Flat list of (lat, lng, id) for nearest-neighbor matching."""
    return [(n["lat"], n["lng"], n["id"]) for n in nodes]


def find_nearest_node(lat: float, lng: float,
                      idx: List[Tuple[float, float, str]],
                      max_km: float = 0.5) -> Optional[str]:
    best = None
    best_km = max_km
    for nlat, nlng, nid in idx:
        # quick lat/lng bounding-box prefilter (~0.01 deg = ~1.1 km)
        if abs(nlat - lat) > 0.01 or abs(nlng - lng) > 0.01:
            continue
        d = haversine_km(lat, lng, nlat, nlng)
        if d < best_km:
            best_km = d
            best = nid
    return best


def parse_edges(payload: Dict[str, Any], nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    idx = build_node_index(nodes)
    edges: List[Dict[str, Any]] = []
    seen = set()
    for el in payload.get("elements", []):
        if el.get("type") != "way":
            continue
        tags = el.get("tags") or {}
        if tags.get("power") != "line":
            continue
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        a, b = geom[0], geom[-1]
        from_id = find_nearest_node(a["lat"], a["lon"], idx)
        to_id = find_nearest_node(b["lat"], b["lon"], idx)
        if not from_id or not to_id or from_id == to_id:
            continue
        voltages = parse_voltage_list(tags.get("voltage"))
        primary_kv = round_to_tier(max(voltages)) if voltages else 150

        # Total km along the polyline
        km = 0.0
        for i in range(1, len(geom)):
            km += haversine_km(geom[i-1]["lat"], geom[i-1]["lon"], geom[i]["lat"], geom[i]["lon"])

        key = tuple(sorted([from_id, to_id]) + [primary_kv])
        if key in seen:
            continue
        seen.add(key)

        edges.append({
            "from": from_id,
            "to": to_id,
            "voltage": primary_kv,
            "km": int(round(km)),
            "circuits": 2,
            "tier": 1 if primary_kv >= 150 else 2,
            "source": "osm",
            "osm_way_id": el["id"],
        })
    return edges


# ============================================================================
# JS RENDERING
# ============================================================================

def js_value(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        # Use single quotes to match repo convention; escape internal single quotes.
        esc = v.replace("\\", "\\\\").replace("'", "\\'")
        return f"'{esc}'"
    if isinstance(v, list):
        return "[" + ", ".join(js_value(i) for i in v) + "]"
    if isinstance(v, dict):
        return "{" + ", ".join(f"{k}: {js_value(val)}" for k, val in v.items()) + "}"
    return repr(v)


# Field order for nodes (so diffs are stable + readable)
NODE_FIELD_ORDER = [
    "id", "name", "kind", "voltage", "secondary_voltages",
    "mva", "year", "fuel", "mw",
    "prov", "lat", "lng", "x", "y", "tier",
    "confidence", "operator",
    "served_areas", "notes",
    "source", "osm_id", "osm_type", "wikidata",
]
EDGE_FIELD_ORDER = ["from", "to", "voltage", "km", "circuits", "tier", "source", "osm_way_id"]


def render_node(n: Dict[str, Any]) -> str:
    parts = []
    for f in NODE_FIELD_ORDER:
        if f in n and n[f] is not None:
            parts.append(f"{f}: {js_value(n[f])}")
    # Trailing fields not in our explicit order
    extras = [k for k in n.keys() if k not in NODE_FIELD_ORDER]
    for k in sorted(extras):
        if n[k] is not None:
            parts.append(f"{k}: {js_value(n[k])}")
    return "{ " + ", ".join(parts) + " }"


def render_edge(e: Dict[str, Any]) -> str:
    parts = []
    for f in EDGE_FIELD_ORDER:
        if f in e and e[f] is not None:
            parts.append(f"{f}: {js_value(e[f])}")
    return "{ " + ", ".join(parts) + " }"


def render_js_file(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    lines.append(f"/* PLN Java-Bali grid data v{VERSION}")
    lines.append(" * Topology source: OSM Overpass API (https://www.openstreetmap.org/copyright)")
    lines.append(" *   Query bbox: [-9, 105, -5, 116] (Java + Bali)")
    lines.append(" *   Filters:    power=substation, plant, generator, line")
    lines.append(" * Hand-curated overlay: tools/pln-java-grid-overlay.{yaml,json}")
    lines.append(" * National headlines: PLN AR 2024 / RUPTL 2025-2034")
    lines.append(" * Projection: viewBox 0 0 1400 800")
    lines.append(" *   x = round(80 + (lng - 105) * 124)")
    lines.append(" *   y = round(120 + (-5.5 - lat) * 200)")
    lines.append(" * Generated by tools/build-osm-dataset.py — do not edit by hand.")
    lines.append(" */")
    lines.append("window.PLN_JAVA_GRID = {")
    lines.append(f"  version: '{VERSION}',")
    lines.append("")
    lines.append("  nodes: [")
    for n in nodes:
        lines.append("    " + render_node(n) + ",")
    if lines[-1].endswith(","):
        lines[-1] = lines[-1].rstrip(",")
    lines.append("  ],")
    lines.append("")
    lines.append("  edges: [")
    for e in edges:
        lines.append("    " + render_edge(e) + ",")
    if lines[-1].endswith(","):
        lines[-1] = lines[-1].rstrip(",")
    lines.append("  ],")
    lines.append("")
    lines.append("  national: {")
    nat_items = list(NATIONAL.items())
    for i, (k, v) in enumerate(nat_items):
        comma = "," if i < len(nat_items) - 1 else ""
        lines.append(f"    {k}: {js_value(v)}{comma}")
    lines.append("  }")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


# ============================================================================
# REPORTING
# ============================================================================

def print_breakdown(nodes: List[Dict[str, Any]]) -> None:
    log("")
    log("=== Provincial breakdown (count by voltage tier) ===")
    provs = sorted({n["prov"] for n in nodes})
    voltages = sorted({n["voltage"] for n in nodes}, reverse=True)
    header = f"{'prov':<18}" + "".join(f"{v:>6}kV" for v in voltages) + f"{'TOTAL':>9}"
    log(header)
    log("-" * len(header))
    grand = 0
    for prov in provs:
        row = f"{prov:<18}"
        total = 0
        for v in voltages:
            n = sum(1 for x in nodes if x["prov"] == prov and x["voltage"] == v)
            row += f"{n:>8}"
            total += n
        row += f"{total:>9}"
        grand += total
        log(row)
    log("-" * len(header))
    total_row = f"{'TOTAL':<18}"
    for v in voltages:
        n = sum(1 for x in nodes if x["voltage"] == v)
        total_row += f"{n:>8}"
    total_row += f"{grand:>9}"
    log(total_row)

    log("")
    log("=== Confidence breakdown ===")
    for c in ("high", "medium", "low"):
        n = sum(1 for x in nodes if x["confidence"] == c)
        log(f"  {c:<8} {n}")

    log("")
    log("=== Kind breakdown ===")
    for k in ("station", "plant"):
        n = sum(1 for x in nodes if x["kind"] == k)
        log(f"  {k:<8} {n}")


# ============================================================================
# MAIN
# ============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(description="OSM Overpass crawler -> PLN Java-Bali JS dataset")
    parser.add_argument("--force", action="store_true", help="bypass 24h cache")
    parser.add_argument("--dry-run", action="store_true", help="print stats but don't write file")
    args = parser.parse_args()

    t0 = time.time()
    log(f"[start] OSM crawler v{VERSION}  force={args.force}  dry_run={args.dry_run}")

    # 1. Fetch features
    payload = fetch_overpass(QUERY_FEATURES, force=args.force)
    raw_count = len(payload.get("elements", []))
    log(f"[features] {raw_count} raw OSM elements")

    # 2. Parse
    nodes: List[Dict[str, Any]] = []
    skipped = 0
    skip_reasons: Dict[str, int] = {}
    for el in payload.get("elements", []):
        n = parse_feature(el)
        if n is None:
            skipped += 1
            tags = el.get("tags") or {}
            if not (tags.get("name") or tags.get("ref")) and not tags.get("voltage"):
                skip_reasons["no_name_no_voltage"] = skip_reasons.get("no_name_no_voltage", 0) + 1
            elif feature_latlng(el) is None:
                skip_reasons["no_coords"] = skip_reasons.get("no_coords", 0) + 1
            else:
                skip_reasons["other_prov_or_unsupported"] = skip_reasons.get("other_prov_or_unsupported", 0) + 1
            continue
        nodes.append(n)

    log(f"[parse] kept {len(nodes)}, skipped {skipped} ({skip_reasons})")

    # 3. Deduplicate by id
    by_id: Dict[str, Dict[str, Any]] = {}
    for n in nodes:
        if n["id"] not in by_id:
            by_id[n["id"]] = n
        else:
            # Prefer higher confidence / has name without "Unnamed"
            existing = by_id[n["id"]]
            if n["confidence"] == "high" and existing["confidence"] != "high":
                by_id[n["id"]] = n
    nodes = list(by_id.values())

    # 4. Overlay merge
    overlay = load_overlay()
    unmatched_overlay = merge_overlay_all(nodes, overlay)
    if unmatched_overlay:
        log(f"[overlay] WARN: {len(unmatched_overlay)} overlay keys did not match any node:")
        for k in sorted(unmatched_overlay):
            log(f"           - {k}")

    # 5. Sort for idempotency
    nodes.sort(key=lambda n: n["id"])

    # 6. Edges
    edges_payload = fetch_overpass(QUERY_LINES, force=args.force)
    edges = parse_edges(edges_payload, nodes)
    edges.sort(key=lambda e: (e["from"], e["to"], e["voltage"]))
    log(f"[edges] kept {len(edges)} matched edges from {len(edges_payload.get('elements', []))} OSM lines")

    # 7. Report
    print_breakdown(nodes)

    log("")
    log("=== Edge breakdown by voltage ===")
    for v in sorted({e["voltage"] for e in edges}, reverse=True):
        n = sum(1 for e in edges if e["voltage"] == v)
        log(f"  {v}kV  {n}")

    elapsed = time.time() - t0
    log("")
    log(f"[stats] nodes={len(nodes)}  edges={len(edges)}  elapsed={elapsed:.1f}s")
    log(f"[cache] features: {CACHE_DIR / ('overpass-' + md5(QUERY_FEATURES) + '.json')}")
    log(f"[cache] lines:    {CACHE_DIR / ('overpass-' + md5(QUERY_LINES) + '.json')}")

    # 8. Write
    if args.dry_run:
        log("[dry-run] not writing file")
        return 0

    js = render_js_file(nodes, edges)
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(js)
    log(f"[write] {OUT_FILE} ({len(js):,} bytes)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"[FATAL] {e}")
        sys.exit(1)
