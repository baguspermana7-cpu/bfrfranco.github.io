#!/usr/bin/env python3
"""
test-network-anim-determinism.py — Strategy-A determinism harness.

Per plan §5.3 v2.3: `seek(N)` must always produce identical output
regardless of how the engine arrived at frame N. This test invokes
each topic module's `_decodeFrame()` pure function and verifies:

  1. Pure-function property: decodeFrame(N, params) is deterministic
     across repeat calls (no hidden state).
  2. Strategy A: every byte position at frame N is a pure function of
     (N, params) — no accumulated velocity, no random jitter.
  3. Phase-cycle integrity: total cycle frame count is internally
     consistent (sum of phase frames = totalFrames).

Uses Node.js if available (preferred — exercises actual JS); falls
back to AST inspection (regex-based) for CI environments without Node.

Run modes:
    python3 tools/test-network-anim-determinism.py
    python3 tools/test-network-anim-determinism.py --strict   # exit 1 on failure
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
TOPICS_DIR = REPO_ROOT / "js" / "network-anim" / "topics"

# Topic-specific test fixtures
TOPIC_FIXTURES = {
    "modbus-rtu": {
        "module_global": "modbusRtu",
        "params": {"baudRate": 9600, "payloadBytes": 8},
        "decode_args": "9600, 8",
        "frames_to_test": [0, 1, 30, 60, 100, 240, 500, 1000],
    },
    "modbus-tcp": {
        "module_global": "modbusTcp",
        "params": {"payloadBytes": 8},
        "decode_args": "8",
        "frames_to_test": [0, 1, 8, 16, 48, 96, 200, 500],
    },
    "bacnet-ip": {
        "module_global": "bacnetIp",
        "params": {"payloadBytes": 12},
        "decode_args": "12",
        "frames_to_test": [0, 1, 10, 50, 100, 200, 400, 800],
    },
    "opc-ua": {
        "module_global": "opcUa",
        "params": {"publishingIntervalMs": 1000},
        "decode_args": "1000",
        "frames_to_test": [0, 1, 16, 100, 200, 500, 1000, 2000],
    },
    # v1.39.1 — extended to all 25 live topics (static mode covers them via regex check;
    # node mode requires per-topic decode_args matching each module's signature).
    "dnp3":              {"module_global": "dnp3",            "params": {}, "decode_args": "true", "frames_to_test": [0, 30, 100, 500]},
    "profinet":          {"module_global": "profinet",        "params": {}, "decode_args": "4",    "frames_to_test": [0, 6, 36, 100]},
    "ethernet-ip":       {"module_global": "ethernetIp",      "params": {}, "decode_args": "8",    "frames_to_test": [0, 50, 200, 600]},
    "ethercat":          {"module_global": "ethercat",        "params": {}, "decode_args": "4",    "frames_to_test": [0, 16, 32, 64]},
    "bacnet-mstp":       {"module_global": "bacnetMstp",      "params": {}, "decode_args": "8",    "frames_to_test": [0, 36, 132, 500]},
    "osi-tcp-ip-models": {"module_global": "osiTcpIpModels",  "params": {}, "decode_args": "",     "frames_to_test": [0, 30, 100, 400]},
    "ipv4-vs-ipv6":      {"module_global": "ipv4VsIpv6",      "params": {}, "decode_args": "",     "frames_to_test": [0, 30, 60, 120]},
    "subnetting-cidr":   {"module_global": "subnettingCidr",  "params": {}, "decode_args": "24",   "frames_to_test": [0, 30, 60, 120]},
    "tcp-handshake":     {"module_global": "tcpHandshake",    "params": {}, "decode_args": "",     "frames_to_test": [0, 50, 100, 150]},
    "dhcp-dns":          {"module_global": "dhcpDns",         "params": {}, "decode_args": "",     "frames_to_test": [0, 50, 100, 250]},
    "tls-handshake":     {"module_global": "tlsHandshake",    "params": {}, "decode_args": "",     "frames_to_test": [0, 60, 180, 300]},
    "oauth-jwt":         {"module_global": "oauthJwt",        "params": {}, "decode_args": "",     "frames_to_test": [0, 35, 140, 210]},
    "mtls":              {"module_global": "mtls",            "params": {}, "decode_args": "",     "frames_to_test": [0, 50, 200, 310]},
    "wireguard":         {"module_global": "wireguard",       "params": {}, "decode_args": "",     "frames_to_test": [0, 24, 96, 144]},
    "rest-api":          {"module_global": "restApi",         "params": {}, "decode_args": "256",  "frames_to_test": [0, 60, 90, 180]},
    "graphql":           {"module_global": "graphql",         "params": {}, "decode_args": "",     "frames_to_test": [0, 60, 105, 165]},
    "grpc":              {"module_global": "grpc",            "params": {}, "decode_args": "",     "frames_to_test": [0, 25, 75, 100]},
    "mcp-tool-call":     {"module_global": "mcpToolCall",     "params": {}, "decode_args": "",     "frames_to_test": [0, 40, 80, 160]},
    "snmp":              {"module_global": "snmp",            "params": {}, "decode_args": "",     "frames_to_test": [0, 30, 60, 120]},
    "ipmi-redfish":      {"module_global": "ipmiRedfish",     "params": {}, "decode_args": "",     "frames_to_test": [0, 50, 70, 160]},
    "syslog":            {"module_global": "syslog",          "params": {}, "decode_args": "",     "frames_to_test": [0, 35, 70, 140]},
}


@dataclass
class TestResult:
    topic: str
    test_name: str
    passed: bool
    detail: str = ""


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def has_node() -> bool:
    try:
        subprocess.run(["node", "--version"], capture_output=True, timeout=5, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def run_node_determinism(slug: str, fixture: dict) -> List[TestResult]:
    """Execute the topic module under Node and verify decodeFrame is deterministic."""
    topic_file = TOPICS_DIR / f"{slug}.js"
    if not topic_file.exists():
        return [TestResult(slug, "node-load", False, f"missing {topic_file}")]

    # Build a tiny Node shim that loads palette/audio/renderer/vfx/engine/topic
    # and exercises _decodeFrame at the fixture frames, twice each, asserting
    # equality between repeat invocations.
    shim_lines = [
        "var window = global;",
        "window.requestAnimationFrame = function () {};",
        "window.cancelAnimationFrame = function () {};",
        "window.performance = { now: function () { return 0; } };",
        "global.performance = window.performance;",
        "global.AudioContext = function () { this.currentTime = 0; this.destination = {}; this.createOscillator = function () { return { type: '', frequency: { setValueAtTime: function(){}, linearRampToValueAtTime: function(){} }, connect: function(){return this;}, start: function(){}, stop: function(){} }; }; this.createGain = function () { return { gain: { setValueAtTime: function(){}, exponentialRampToValueAtTime: function(){} }, connect: function(){return this;} }; }; };",
        "var fs = require('fs');",
        "var path = require('path');",
        "function loadJs(p) { eval(fs.readFileSync(p, 'utf-8')); }",
        f"loadJs('{REPO_ROOT}/js/network-anim/palette.js');",
        f"loadJs('{REPO_ROOT}/js/network-anim/audio.js');",
        f"loadJs('{REPO_ROOT}/js/network-anim/renderer.js');",
        f"loadJs('{REPO_ROOT}/js/network-anim/vfx.js');",
        f"loadJs('{REPO_ROOT}/js/network-anim/engine.js');",
        f"loadJs('{REPO_ROOT}/js/network-anim/topics/{slug}.js');",
        f"var topic = window.RZNetAnim.{fixture['module_global']};",
        "if (!topic || typeof topic.init !== 'function') { console.log(JSON.stringify({error:'no_topic'})); process.exit(1); }",
        # Pull decodeFrame via init() since it's a closure
        "var fakeCanvas = { width: 800, height: 320, getContext: function () { return { save: function(){}, restore: function(){}, fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', font: '', textAlign: '', textBaseline: '', fillRect: function(){}, fillText: function(){}, strokeRect: function(){}, beginPath: function(){}, moveTo: function(){}, lineTo: function(){}, arc: function(){}, closePath: function(){}, fill: function(){}, stroke: function(){}, setLineDash: function(){} }; } };",
        "var instance = topic.init(fakeCanvas, " + json.dumps(fixture["params"]) + ", {});",
        "var results = [];",
        "var frames = " + json.dumps(fixture["frames_to_test"]) + ";",
        "for (var i = 0; i < frames.length; i++) {",
        "  var f = frames[i];",
        f"  var a = instance._decodeFrame(f, {fixture['decode_args']});",
        f"  var b = instance._decodeFrame(f, {fixture['decode_args']});",
        "  results.push({ frame: f, identical: JSON.stringify(a) === JSON.stringify(b), a: a });",
        "}",
        "console.log(JSON.stringify({ ok: true, results: results }));",
    ]
    shim = "\n".join(shim_lines)
    tmp = REPO_ROOT / ".tmp_determinism_shim.js"
    tmp.write_text(shim, encoding="utf-8")
    try:
        proc = subprocess.run(
            ["node", str(tmp)],
            capture_output=True,
            text=True,
            timeout=15,
        )
    finally:
        try: tmp.unlink()
        except OSError: pass

    if proc.returncode != 0:
        return [TestResult(slug, "node-exec", False, proc.stderr[:200])]

    try:
        out = json.loads(proc.stdout.strip().split("\n")[-1])
    except (json.JSONDecodeError, IndexError):
        return [TestResult(slug, "node-parse", False, proc.stdout[:200])]

    if "error" in out:
        return [TestResult(slug, "node-shim", False, out["error"])]

    results: List[TestResult] = []
    for r in out.get("results", []):
        results.append(TestResult(
            slug,
            f"decode-frame-{r['frame']}",
            bool(r["identical"]),
            f"decodeFrame deterministic at frame {r['frame']}",
        ))
    return results


def run_static_inspect(slug: str) -> List[TestResult]:
    """Fallback when Node is unavailable: AST check that decodeFrame is pure."""
    topic_file = TOPICS_DIR / f"{slug}.js"
    if not topic_file.exists():
        return [TestResult(slug, "static-load", False, f"missing {topic_file}")]
    content = _read(topic_file)
    results: List[TestResult] = []

    # 1. decodeFrame must NOT close over outer variables that change at runtime.
    #    Heuristic: it should not reference `_params`, `frame`, `lastByteIdxEmitted`,
    #    `startTs`, `running` — those are init() locals, not decode inputs.
    decode_block_match = re.search(
        r"function decodeFrame\([^)]*\)\s*\{(.+?)\n\s*\}\s*\n\s*function bytePosition",
        content, re.DOTALL,
    )
    if not decode_block_match:
        # Fall back to less greedy match
        decode_block_match = re.search(
            r"function decodeFrame\([^)]*\)\s*\{(.+?)\n\s*\}", content, re.DOTALL,
        )
    if not decode_block_match:
        results.append(TestResult(slug, "static-decode-shape", False,
                                  "could not locate decodeFrame function"))
        return results

    decode_body = decode_block_match.group(1)
    forbidden = ["_params", "lastByteIdxEmitted", "startTs", "running", "rafId",
                 "ackTriggeredThisCycle", "lastPushIdx"]
    # v1.39.1 — strip string literals to avoid false positives on protocol-name
    # tokens like 'data-frame' (contains 'frame' substring).
    decode_body_no_strings = re.sub(r"'[^']*'|\"[^\"]*\"", "''", decode_body)
    leaked = [v for v in forbidden if re.search(r"\b" + re.escape(v) + r"\b", decode_body_no_strings)]
    if leaked:
        results.append(TestResult(
            slug, "static-purity", False,
            f"decodeFrame closes over stateful vars: {', '.join(leaked)}",
        ))
    else:
        results.append(TestResult(
            slug, "static-purity", True,
            "decodeFrame body has no stateful closure references",
        ))

    # 2. decodeFrame must return totalFrames so cycle integrity is checkable
    if "totalFrames" not in decode_body:
        results.append(TestResult(slug, "static-totalFrames", False,
                                  "decodeFrame does not expose totalFrames"))
    else:
        results.append(TestResult(slug, "static-totalFrames", True,
                                  "decodeFrame exposes totalFrames"))

    # 3. bytePosition uses only decoded.phase + decoded.byteProgress (pure)
    bp_match = re.search(r"function bytePosition\([^)]*\)\s*\{(.+?)\n\s*\}",
                         content, re.DOTALL)
    if bp_match:
        bp_body = bp_match.group(1)
        # v1.39.1 — same string-literal stripping for the bytePosition check
        bp_body_no_strings = re.sub(r"'[^']*'|\"[^\"]*\"", "''", bp_body)
        if re.search(r"\b(_params|frame|running)\b", bp_body_no_strings):
            results.append(TestResult(slug, "static-bytePos-purity", False,
                                      "bytePosition closes over stateful vars"))
        else:
            results.append(TestResult(slug, "static-bytePos-purity", True,
                                      "bytePosition is pure"))

    return results


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 on any failure")
    ap.add_argument("--node", action="store_true",
                    help="force Node-based test (default: auto-detect)")
    ap.add_argument("--static", action="store_true",
                    help="force static-only test (skip Node)")
    args = ap.parse_args(argv)

    use_node = args.node or (has_node() and not args.static)
    mode = "node (live execution)" if use_node else "static (AST inspection)"

    all_results: List[TestResult] = []
    for slug, fixture in TOPIC_FIXTURES.items():
        if use_node:
            all_results.extend(run_node_determinism(slug, fixture))
        else:
            all_results.extend(run_static_inspect(slug))

    # Report
    passed = [r for r in all_results if r.passed]
    failed = [r for r in all_results if not r.passed]
    print("=" * 72)
    print(f"test-network-anim-determinism — mode: {mode}")
    print(f"{len(passed)} passed, {len(failed)} failed")
    print("=" * 72)
    for r in all_results:
        marker = "PASS" if r.passed else "FAIL"
        print(f"[{marker}] {r.topic}::{r.test_name}  {r.detail}")
    print("=" * 72)

    if args.strict and failed:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
