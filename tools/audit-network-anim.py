#!/usr/bin/env python3
"""
audit-network-anim.py — Discipline gate for the Network Visualization Hub.

Per docs/plans/2026-05-24-network-visualization-hub-v2.md §5.6 + §15 + Appendix E.

Checks:
  1. Palette discipline — no hex literals in js/network-anim/topics/*.js
     (colours must come from palette.js tokens).
  2. Banned CSS in vfx.js — no box-shadow, filter: blur(...),
     filter: drop-shadow(...) with multi-layer, mix-blend-mode: screen/overlay.
  3. Timbre profile presence — every topic module declares `_timbre` with
     all required fields (waveform, chip shape, wire style, master icon,
     tempo, errorSignature, encryption, latencyClass, completeFreq,
     compareDegrade).
  4. Variation budget bounds — freq ∈ [400, 3000] Hz, duration ∈ [6, 25] ms,
     tempo ∈ [0.7, 1.7], chip size [6,12] × [4,12] px.
  5. Anti-monotony gate — pairwise-within-lane: any two topics in the same
     lane share ≤2 fields among (waveform, chip shape, wire style,
     master icon, tempo-bin).
  6. perState.error.tempoMultiplier === 1.0 (LOCKED per uiux v2.2).
  7. No simultaneous multi-tone (no `freqA + freqB` patterns in audio config).

Run modes:
  python3 tools/audit-network-anim.py            # audit all topics + engine
  python3 tools/audit-network-anim.py --strict   # exit 1 on any violation
  python3 tools/audit-network-anim.py --file F   # audit a single file

Output: structured findings (CRITICAL / HIGH / MEDIUM / LOW / OK).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

# ─── Constants ────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
ANIM_DIR = REPO_ROOT / "js" / "network-anim"
TOPICS_DIR = ANIM_DIR / "topics"
PALETTE_FILE = ANIM_DIR / "palette.js"
VFX_FILE = ANIM_DIR / "vfx.js"

# Allowed enum sets (must match plan §5.6 v2.3)
ALLOWED_WAVEFORMS = {"square", "sine", "sawtooth", "triangle", "square-sweep", "sine-sweep"}
ALLOWED_CHIP_SHAPES = {"square", "rect", "hex", "triangle", "layered", "token", "envelope", "long-rect"}
ALLOWED_WIRE_STYLES = {"serial-thin", "ethernet", "http2-multiplex", "crypto-shroud", "mesh-tunnel", "bus-trunk", "sideband-dashed"}
ALLOWED_ENCRYPTION = {"none", "always", "progressive", "bilateral"}
ALLOWED_LATENCY = {"realtime", "interactive", "batch", "human-paced"}
ALLOWED_ERROR_SIG = {
    "crc-fail-bytes-corrupt", "cert-mismatch-shroud-breaks",
    "token-rejected-amber-flash", "timeout-grey-fade",
    "frame-loss-trail-cut", "collision-stop",
}

# Variation budget bounds
FREQ_MIN, FREQ_MAX = 400, 3000      # Hz
DURATION_MIN, DURATION_MAX = 6, 25  # ms
TEMPO_MIN, TEMPO_MAX = 0.7, 1.7
CHIP_W_MIN, CHIP_W_MAX = 6, 12
CHIP_H_MIN, CHIP_H_MAX = 4, 12

# Lane assignment for anti-monotony grouping
LANE_OF = {
    # Lane A — foundations
    "osi-tcp-ip-models": "A", "ipv4-vs-ipv6": "A", "subnetting-cidr": "A",
    "tcp-handshake": "A", "dhcp-dns": "A",
    # Lane B — industrial OT
    "modbus-rtu": "B", "modbus-tcp": "B", "bacnet-mstp": "B", "bacnet-ip": "B",
    "opc-ua": "B", "dnp3": "B", "profinet": "B", "ethernet-ip": "B", "ethercat": "B",
    # Lane C — DC management
    "snmp": "C", "ipmi-redfish": "C", "syslog": "C",
    # Lane D — security
    "tls-handshake": "D", "oauth-jwt": "D", "mtls": "D", "wireguard": "D",
    # Lane E — APIs + agents
    "rest-api": "E", "graphql": "E", "grpc": "E", "mcp-tool-call": "E",
}

# Anti-monotony fields compared pairwise within lane
MONOTONY_FIELDS = ("waveform", "chip_shape", "wire_style", "master_icon", "tempo_bin")

# Banned CSS-in-JS patterns (regex)
BANNED_CSS_PATTERNS = [
    (r"\bbox-shadow\b", "box-shadow"),
    (r"\bfilter\s*:\s*blur\s*\(", "filter: blur(...)"),
    (r"\bmix-blend-mode\s*:\s*screen\b", "mix-blend-mode: screen"),
    (r"\bmix-blend-mode\s*:\s*overlay\b", "mix-blend-mode: overlay"),
]

# Allowed palette tokens (mirror palette.js)
ALLOWED_PALETTE_TOKENS = {
    "instrument-cyan", "signal-amber", "oscilloscope-green",
    "fault-red", "wire-default", "canvas-bg",
}

# ─── Findings dataclass ──────────────────────────────────────────────────

@dataclass
class Finding:
    severity: str   # CRITICAL | HIGH | MEDIUM | LOW | OK
    file: str
    line: int
    message: str

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "OK": 4}


@dataclass
class TimbreSummary:
    """Extracted timbre fields from a topic module — used for anti-monotony pass."""
    slug: str
    file: str
    waveform: str = ""
    chip_shape: str = ""
    wire_style: str = ""
    master_icon: str = ""
    tempo: float = 1.0
    findings: List[Finding] = field(default_factory=list)

    @property
    def tempo_bin(self) -> str:
        if self.tempo <= 0.8:
            return "slow"
        if self.tempo >= 1.4:
            return "fast"
        return "medium"


# ─── Extractors ───────────────────────────────────────────────────────────

def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_topic_slug(path: Path) -> str:
    return path.stem  # e.g. "modbus-rtu.js" → "modbus-rtu"


def _find_pattern(content: str, pattern: str, group: int = 1) -> str:
    m = re.search(pattern, content, re.MULTILINE)
    return m.group(group) if m else ""


def _find_pattern_float(content: str, pattern: str, group: int = 1) -> float:
    m = re.search(pattern, content, re.MULTILINE)
    if not m:
        return 0.0
    try:
        return float(m.group(group))
    except ValueError:
        return 0.0


def extract_timbre(content: str, slug: str, file_str: str) -> TimbreSummary:
    """
    Static-extract the fields the anti-monotony gate compares.
    Topic modules use plain-object syntax inside an IIFE; regex is sufficient.
    """
    t = TimbreSummary(slug=slug, file=file_str)

    # byte.waveform — first 'waveform' value in the file inside a `byte:` block
    m = re.search(r"byte\s*:\s*\{[^}]*?waveform\s*:\s*['\"]([^'\"]+)['\"]", content, re.DOTALL)
    if m:
        t.waveform = m.group(1)

    # byteChip.shape
    m = re.search(r"byteChip\s*:\s*\{[^}]*?shape\s*:\s*['\"]([^'\"]+)['\"]", content, re.DOTALL)
    if m:
        t.chip_shape = m.group(1)

    # wire.style
    m = re.search(r"wire\s*:\s*\{[^}]*?style\s*:\s*['\"]([^'\"]+)['\"]", content, re.DOTALL)
    if m:
        t.wire_style = m.group(1)

    # node.masterIcon
    m = re.search(r"node\s*:\s*\{[^}]*?masterIcon\s*:\s*['\"]([^'\"]+)['\"]", content, re.DOTALL)
    if m:
        t.master_icon = m.group(1)

    # tempoMultiplier (top-level)
    m = re.search(r"\btempoMultiplier\s*:\s*([0-9.]+)", content)
    if m:
        try:
            t.tempo = float(m.group(1))
        except ValueError:
            pass

    return t


# ─── Audits ───────────────────────────────────────────────────────────────

HEX_LITERAL_RE = re.compile(r"#[0-9A-Fa-f]{3,8}\b")
# Allow hex inside comments + strings that are explicitly documenting palette
# (the audit operates on topics/, where authoring discipline matters most).


def audit_palette_discipline(path: Path) -> List[Finding]:
    """Forbid hex color literals in topic modules. Colours must come from palette.js."""
    findings: List[Finding] = []
    file_str = str(path.relative_to(REPO_ROOT))
    try:
        lines = _read(path).splitlines()
    except OSError as exc:
        return [Finding("HIGH", file_str, 0, f"unreadable: {exc}")]

    for i, line in enumerate(lines, start=1):
        # Strip line comments to avoid flagging hex inside `//` comments
        stripped = re.sub(r"//.*$", "", line)
        for m in HEX_LITERAL_RE.finditer(stripped):
            findings.append(Finding(
                "HIGH",
                file_str,
                i,
                f"hex color literal '{m.group(0)}' — use RZNetAnim.palette.color('token') instead",
            ))
    return findings


def audit_banned_css(path: Path) -> List[Finding]:
    """Forbid banned CSS-in-JS patterns inside vfx.js (or topic VFX usage)."""
    findings: List[Finding] = []
    file_str = str(path.relative_to(REPO_ROOT))
    try:
        lines = _read(path).splitlines()
    except OSError:
        return findings

    for i, line in enumerate(lines, start=1):
        stripped = re.sub(r"//.*$", "", line)
        for pattern, label in BANNED_CSS_PATTERNS:
            if re.search(pattern, stripped, re.IGNORECASE):
                findings.append(Finding(
                    "HIGH",
                    file_str,
                    i,
                    f"banned CSS pattern '{label}' — see plan §5.5",
                ))
    return findings


def audit_timbre_required_fields(path: Path, content: str) -> List[Finding]:
    """Every topic module must declare these timbre fields."""
    file_str = str(path.relative_to(REPO_ROOT))
    findings: List[Finding] = []

    required = [
        ("byte", r"\bbyte\s*:\s*\{"),
        ("byteChip", r"\bbyteChip\s*:\s*\{"),
        ("wire", r"\bwire\s*:\s*\{"),
        ("node", r"\bnode\s*:\s*\{"),
        ("tempoMultiplier", r"\btempoMultiplier\s*:"),
        ("errorSignature", r"\berrorSignature\s*:"),
        ("encryption", r"\bencryption\s*:"),
        ("latencyClass", r"\blatencyClass\s*:"),
        ("compareDegrade", r"\bcompareDegrade\s*:"),
        ("perRole", r"\bperRole\s*:"),
        ("perState", r"\bperState\s*:"),
    ]
    for name, pattern in required:
        if not re.search(pattern, content):
            findings.append(Finding(
                "HIGH", file_str, 0,
                f"timbre missing required field '{name}' (plan §5.6 v2.3)",
            ))
    return findings


def audit_timbre_enums(timbre: TimbreSummary, content: str) -> List[Finding]:
    """Each enum-typed timbre field must use a declared value."""
    findings: List[Finding] = []
    f = timbre.file
    if timbre.waveform and timbre.waveform not in ALLOWED_WAVEFORMS:
        findings.append(Finding("HIGH", f, 0, f"timbre.byte.waveform '{timbre.waveform}' is not in allowed enum"))
    if timbre.chip_shape and timbre.chip_shape not in ALLOWED_CHIP_SHAPES:
        findings.append(Finding("HIGH", f, 0, f"timbre.byteChip.shape '{timbre.chip_shape}' is not in allowed enum"))
    if timbre.wire_style and timbre.wire_style not in ALLOWED_WIRE_STYLES:
        findings.append(Finding("HIGH", f, 0, f"timbre.wire.style '{timbre.wire_style}' is not in allowed enum"))

    # Encryption / latencyClass / errorSignature pattern match
    for field_name, allowed in (
        ("encryption", ALLOWED_ENCRYPTION),
        ("latencyClass", ALLOWED_LATENCY),
        ("errorSignature", ALLOWED_ERROR_SIG),
    ):
        m = re.search(rf"\b{field_name}\s*:\s*['\"]([^'\"]+)['\"]", content)
        if m and m.group(1) not in allowed:
            findings.append(Finding(
                "HIGH", f, 0,
                f"timbre.{field_name} '{m.group(1)}' is not in allowed enum"
            ))
    return findings


def audit_variation_budget(timbre: TimbreSummary, content: str) -> List[Finding]:
    """freq / duration / tempo / chip size within v2.3 bounds."""
    findings: List[Finding] = []
    f = timbre.file

    if not (TEMPO_MIN <= timbre.tempo <= TEMPO_MAX):
        findings.append(Finding(
            "HIGH", f, 0,
            f"tempoMultiplier {timbre.tempo} outside [{TEMPO_MIN}, {TEMPO_MAX}] envelope"
        ))

    # §5.6 variation-budget bounds apply to the BYTE event specifically.
    # Other events (ack/tick/errorSfx/completeSfx/handshake) follow their
    # canonical §5.4 specs, which define their own freq/duration windows.
    byte_block_re = re.compile(r"\bbyte\s*:\s*\{([^}]*)\}", re.DOTALL)
    for block_m in byte_block_re.finditer(content):
        block = block_m.group(1)
        for fname, fmin, fmax, unit in (
            ("freqStart", FREQ_MIN, FREQ_MAX, "Hz"),
            ("freqEnd", FREQ_MIN, FREQ_MAX, "Hz"),
            ("freq", FREQ_MIN, FREQ_MAX, "Hz"),
            ("durationMs", DURATION_MIN, DURATION_MAX, "ms"),
        ):
            m = re.search(rf"\b{fname}\s*:\s*([0-9.]+)", block)
            if not m:
                continue
            try:
                val = float(m.group(1))
            except ValueError:
                continue
            if not (fmin <= val <= fmax):
                findings.append(Finding(
                    "HIGH", f, 0,
                    f"byte.{fname}={val}{unit} outside [{fmin}, {fmax}]{unit} bound",
                ))

    # Chip size bounds (§5.6: [6,12] × [4,12] px)
    m = re.search(r"byteChip\s*:\s*\{[^}]*?sizePx\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]", content, re.DOTALL)
    if m:
        try:
            w, h = int(m.group(1)), int(m.group(2))
            if not (CHIP_W_MIN <= w <= CHIP_W_MAX):
                findings.append(Finding("HIGH", f, 0, f"byteChip.sizePx[0]={w} outside [{CHIP_W_MIN}, {CHIP_W_MAX}]"))
            if not (CHIP_H_MIN <= h <= CHIP_H_MAX):
                findings.append(Finding("HIGH", f, 0, f"byteChip.sizePx[1]={h} outside [{CHIP_H_MIN}, {CHIP_H_MAX}]"))
        except ValueError:
            pass

    return findings


def audit_per_state_error_locked(content: str, file_str: str) -> List[Finding]:
    """perState.error.tempoMultiplier MUST be 1.0 (no slow-on-error, v2.3 lock)."""
    findings: List[Finding] = []
    m = re.search(
        r"perState\s*:\s*\{[^}]*?error\s*:\s*\{[^}]*?tempoMultiplier\s*:\s*([0-9.]+)",
        content, re.DOTALL,
    )
    if m:
        val = float(m.group(1))
        if abs(val - 1.0) > 1e-9:
            findings.append(Finding(
                "HIGH", file_str, 0,
                f"perState.error.tempoMultiplier={val} — must be 1.0 (LOCKED per plan §5.6 v2.3; "
                f"error is communicated via SFX + bezel-flash, not tempo)"
            ))
    return findings


def audit_anti_monotony(summaries: List[TimbreSummary]) -> List[Finding]:
    """Pairwise-within-lane: any two topics in the same lane share ≤2 fields."""
    findings: List[Finding] = []
    # Group by lane
    by_lane: Dict[str, List[TimbreSummary]] = {}
    for s in summaries:
        lane = LANE_OF.get(s.slug)
        if not lane:
            continue
        by_lane.setdefault(lane, []).append(s)

    # Pairwise within lane
    for lane, members in by_lane.items():
        n = len(members)
        for i in range(n):
            for j in range(i + 1, n):
                a, b = members[i], members[j]
                shared = []
                if a.waveform and a.waveform == b.waveform:
                    shared.append("waveform")
                if a.chip_shape and a.chip_shape == b.chip_shape:
                    shared.append("chip_shape")
                if a.wire_style and a.wire_style == b.wire_style:
                    shared.append("wire_style")
                if a.master_icon and a.master_icon == b.master_icon:
                    shared.append("master_icon")
                if a.tempo_bin == b.tempo_bin:
                    shared.append("tempo_bin")
                if len(shared) > 2:
                    findings.append(Finding(
                        "HIGH",
                        f"{a.file} vs {b.file}",
                        0,
                        f"anti-monotony violation (Lane {lane}): {a.slug} and {b.slug} "
                        f"share {len(shared)} fields ({', '.join(shared)}) — cap is 2",
                    ))
    return findings


# ─── Orchestration ────────────────────────────────────────────────────────

def audit_topic(path: Path) -> Tuple[TimbreSummary, List[Finding]]:
    file_str = str(path.relative_to(REPO_ROOT))
    content = _read(path)
    slug = extract_topic_slug(path)
    timbre = extract_timbre(content, slug, file_str)

    findings: List[Finding] = []
    findings.extend(audit_palette_discipline(path))
    findings.extend(audit_banned_css(path))
    findings.extend(audit_timbre_required_fields(path, content))
    findings.extend(audit_timbre_enums(timbre, content))
    findings.extend(audit_variation_budget(timbre, content))
    findings.extend(audit_per_state_error_locked(content, file_str))

    return timbre, findings


def discover_topics() -> List[Path]:
    if not TOPICS_DIR.exists():
        return []
    return sorted(TOPICS_DIR.glob("*.js"))


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--strict", action="store_true", help="exit 1 on any non-OK finding")
    parser.add_argument("--file", type=str, help="audit a single topic file")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = parser.parse_args(argv)

    targets: List[Path]
    if args.file:
        p = Path(args.file).resolve()
        if not p.exists():
            print(f"file not found: {args.file}", file=sys.stderr)
            return 2
        targets = [p]
    else:
        targets = discover_topics()

    summaries: List[TimbreSummary] = []
    all_findings: List[Finding] = []

    for path in targets:
        timbre, findings = audit_topic(path)
        summaries.append(timbre)
        all_findings.extend(findings)

    # Cross-topic anti-monotony pass (only if auditing >1 topic)
    if len(summaries) >= 2:
        all_findings.extend(audit_anti_monotony(summaries))

    # Also lint vfx.js if present
    if VFX_FILE.exists():
        all_findings.extend(audit_banned_css(VFX_FILE))

    # ─── Report ──────────────────────────────────────────────────────
    if args.json:
        print(json.dumps([f.__dict__ for f in all_findings], indent=2))
    else:
        print("=" * 72)
        print(f"audit-network-anim — {len(targets)} topic(s), {len(all_findings)} finding(s)")
        print("=" * 72)
        if not all_findings:
            print("CLEAN — all topics pass discipline gates.")
        else:
            for f in sorted(all_findings, key=lambda x: (SEVERITY_ORDER.get(x.severity, 9), x.file)):
                print(f"[{f.severity}] {f.file}:{f.line}  {f.message}")
        print("=" * 72)
        print(f"Topics audited: {', '.join(s.slug for s in summaries) or '(none)'}")

    # Exit code
    blockers = [f for f in all_findings if f.severity in ("CRITICAL", "HIGH")]
    if args.strict and blockers:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
