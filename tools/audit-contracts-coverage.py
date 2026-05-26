#!/usr/bin/env python3
"""Audit docs/contracts/ coverage — verifies every canonical contract
artefact exists.

Per review-v3 P0.6 and Sprint 3-5 backlog: the workbench's data
contracts MUST be present and tracked. This auditor enumerates the
canonical document set and fails if any are missing or empty.

Usage:
    python3 tools/audit-contracts-coverage.py             # report only
    python3 tools/audit-contracts-coverage.py --strict    # exit non-zero on gap
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CONTRACTS_DIR = REPO_ROOT / "docs" / "contracts"
FIXTURES_DIR = REPO_ROOT / "docs" / "research" / "fixtures"

# Canonical contract set
CANONICAL_JSON_SCHEMAS = [
    "diagnostic-case.schema.json",
    "telemetry-window.schema.json",
    "data-quality-result.schema.json",
    "fault-hypothesis.schema.json",
    "recommendation-review.schema.json",
    "work-order-draft.schema.json",
    "kg-diff.schema.json",
    "audit-event.schema.json",
    "integration-sync.schema.json",
]

CANONICAL_SPEC_DOCS = [
    "README.md",
    "telemetry-schema.md",
    "dq-threshold-matrix.md",
    "risk-formula-v0.2.md",
    "product-event-taxonomy.md",
]

CANONICAL_FIXTURES = [
    "synthetic-cdu-pump.csv",
]

# Future-scope (warn if missing but don't fail)
FUTURE_DOCS = [
    "model-validation-report-template.md",
    "calibration-acceptance-criteria.md",
    "asset-registry.schema.json",
    "rbac-policy.schema.json",
]


def check(path: Path, min_bytes: int = 100) -> tuple[bool, str]:
    """Return (ok, message)."""
    if not path.exists():
        return (False, "MISSING")
    if path.is_dir():
        return (False, "IS_DIR")
    size = path.stat().st_size
    if size < min_bytes:
        return (False, f"TOO_SMALL ({size} bytes)")
    return (True, f"OK ({size:,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero on missing canonical artefacts.")
    args = parser.parse_args()

    print("=" * 70)
    print("Contracts coverage audit")
    print("=" * 70)
    print(f"Contracts dir: {CONTRACTS_DIR}")
    print()

    missing_canonical: list[str] = []
    missing_future: list[str] = []

    print("[CANONICAL] JSON Schemas:")
    for name in CANONICAL_JSON_SCHEMAS:
        ok, msg = check(CONTRACTS_DIR / name, min_bytes=200)
        status = "✓" if ok else "✗"
        print(f"  {status} {name:42s} {msg}")
        if not ok:
            missing_canonical.append(name)

    print()
    print("[CANONICAL] Spec docs:")
    for name in CANONICAL_SPEC_DOCS:
        ok, msg = check(CONTRACTS_DIR / name, min_bytes=200)
        status = "✓" if ok else "✗"
        print(f"  {status} {name:42s} {msg}")
        if not ok:
            missing_canonical.append(name)

    print()
    print("[CANONICAL] Fixtures:")
    for name in CANONICAL_FIXTURES:
        ok, msg = check(FIXTURES_DIR / name, min_bytes=100)
        status = "✓" if ok else "✗"
        print(f"  {status} fixtures/{name:32s} {msg}")
        if not ok:
            missing_canonical.append(f"fixtures/{name}")

    print()
    print("[FUTURE] Not yet authored (warn only):")
    for name in FUTURE_DOCS:
        ok, msg = check(CONTRACTS_DIR / name, min_bytes=100)
        status = "✓" if ok else "·"
        print(f"  {status} {name:42s} {msg}")
        if not ok:
            missing_future.append(name)

    print()
    print(f"Canonical artefacts:  {len(CANONICAL_JSON_SCHEMAS) + len(CANONICAL_SPEC_DOCS) + len(CANONICAL_FIXTURES)} expected, "
          f"{len(missing_canonical)} missing")
    print(f"Future-scope:         {len(FUTURE_DOCS)} expected, {len(missing_future)} not yet authored")

    if missing_canonical:
        print()
        print("MISSING canonical artefacts:")
        for name in missing_canonical:
            print(f"  - {name}")
        if args.strict:
            print()
            print(f"STRICT FAIL: {len(missing_canonical)} canonical artefact(s) missing.")
            return 1
    else:
        print()
        print("✓ Canonical contract set COMPLETE.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
