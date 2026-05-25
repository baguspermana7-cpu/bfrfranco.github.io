#!/usr/bin/env python3
"""CSV readiness auditor — per-fault chain-completeness scorer for the
FMECA KG seed dataset.

Per review-v3 P0.4: "The platform cannot safely recommend work for many
faults. Some rows are usable for analysis only, not prescriptive action."

This tool walks the 8 CSV seed files and computes a
`recommendation_readiness` tier for every fault:

- `analysis_only`        — chain has a gap (no action, no effect, etc.).
                           Surface in UI; no draft work-order.
- `advisory_possible`    — fault + effect + action present. Engine can
                           emit an advisory note for reviewer.
- `draft_wo_possible`    — full chain incl. procedure steps + safety
                           notes. Engine can propose a draft WO.
- `production_ready`     — chain + claim-level provenance + reviewer
                           sign-off (FUTURE; not assessed here because
                           the reviewer-signoff column doesn't exist
                           yet).

It also cross-checks confidence_tier vs chain completeness — per
KNOWLEDGE_BASE_STANDARD v2.2 (v1.41.6), a `high`-tier fault MUST have a
complete chain to be eligible for draft-WO routing. Faults marked
`high` but missing a chain are a CRITICAL safety contradiction and the
auditor fails STRICT mode on them.

Usage:
    python3 tools/audit-csv-readiness.py             # report only
    python3 tools/audit-csv-readiness.py --strict    # exit non-zero on contradictions
    python3 tools/audit-csv-readiness.py --csv out.csv  # write per-fault scoring to CSV
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, Set

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CSV_DIR = REPO_ROOT / "docs" / "research" / "csv"

CSV_FILES = [
    "components.csv",
    "faults.csv",
    "failures.csv",
    "actions.csv",
    "mechanisms.csv",
    "effects.csv",
    "steps.csv",
    "sod_rpn.csv",
]


def load_csv(path: Path) -> list[dict]:
    if not path.exists():
        print(f"  WARN  missing: {path.name}", file=sys.stderr)
        return []
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def index_fk(rows: list[dict], fk_field: str) -> Dict[str, list[dict]]:
    """Group rows by their foreign-key field."""
    out: Dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        key = (row.get(fk_field) or "").strip()
        if key:
            out[key].append(row)
    return out


def compute_readiness(
    fault: dict,
    effects_by_fault: Dict[str, list[dict]],
    actions_by_fault: Dict[str, list[dict]],
    steps_by_action: Dict[str, list[dict]],
    components_with_mtbf: Set[str],
) -> tuple[str, list[str]]:
    """Return (tier, gap_reasons) for a single fault row."""
    fault_id = fault.get("fault_id", "")
    gaps: list[str] = []

    has_effects = bool(effects_by_fault.get(fault_id))
    actions = actions_by_fault.get(fault_id, [])
    has_actions = bool(actions)
    component_id = (fault.get("affected_component_id") or "").strip()
    component_has_mtbf = component_id in components_with_mtbf

    if not has_effects:
        gaps.append("no_effect")
    if not has_actions:
        gaps.append("no_action")
    if component_id and not component_has_mtbf:
        gaps.append("component_missing_mtbf")

    if not has_actions:
        return ("analysis_only", gaps)

    actions_with_steps = 0
    actions_with_safety_notes = 0
    for action in actions:
        steps = steps_by_action.get((action.get("action_id") or "").strip(), [])
        if steps:
            actions_with_steps += 1
            for step in steps:
                if (step.get("safety_notes") or "").strip():
                    actions_with_safety_notes += 1
                    break

    full_chain = (
        has_effects
        and has_actions
        and actions_with_steps == len(actions)
        and actions_with_safety_notes >= 1
    )

    if full_chain:
        return ("draft_wo_possible", gaps)
    if has_effects and has_actions:
        if actions_with_steps == 0:
            gaps.append("no_procedure_steps")
        elif actions_with_safety_notes == 0:
            gaps.append("no_safety_notes")
        return ("advisory_possible", gaps)
    return ("analysis_only", gaps)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero on confidence-vs-chain contradictions.")
    parser.add_argument("--csv", type=Path,
                        help="Write per-fault scoring to this CSV path.")
    args = parser.parse_args()

    print("=" * 64)
    print("CSV readiness audit — per-fault chain completeness")
    print("=" * 64)

    faults = load_csv(CSV_DIR / "faults.csv")
    if not faults:
        print("ERROR: no faults.csv found; cannot audit.", file=sys.stderr)
        return 2

    components = load_csv(CSV_DIR / "components.csv")
    effects = load_csv(CSV_DIR / "effects.csv")
    actions = load_csv(CSV_DIR / "actions.csv")
    steps = load_csv(CSV_DIR / "steps.csv")

    components_with_mtbf: Set[str] = {
        (row.get("component_id") or "").strip()
        for row in components
        if (row.get("typical_mtbf_hours") or "").strip()
    }
    effects_by_fault = index_fk(effects, "fault_id")
    actions_by_fault = index_fk(actions, "fault_id")
    steps_by_action = index_fk(steps, "action_id")

    tier_counts = defaultdict(int)
    confidence_tier_counts = defaultdict(lambda: defaultdict(int))
    contradictions: list[tuple[str, str, list[str]]] = []
    per_fault: list[tuple[str, str, str, list[str]]] = []

    for fault in faults:
        fault_id = (fault.get("fault_id") or "").strip()
        confidence_tier = (fault.get("confidence_tier") or "thin").strip().lower()
        readiness, gaps = compute_readiness(
            fault,
            effects_by_fault,
            actions_by_fault,
            steps_by_action,
            components_with_mtbf,
        )
        tier_counts[readiness] += 1
        confidence_tier_counts[confidence_tier][readiness] += 1
        per_fault.append((fault_id, confidence_tier, readiness, gaps))

        # KNOWLEDGE_BASE_STANDARD v2.2 says high tier is eligible for draft-WO
        # routing. A high-tier fault stuck at analysis_only is a hidden
        # data-coverage gap that contradicts the standard's promise.
        if confidence_tier == "high" and readiness == "analysis_only":
            contradictions.append((fault_id, confidence_tier, gaps))

    total = len(faults)
    print()
    print(f"Faults audited: {total}")
    print()
    print("Readiness tier distribution:")
    for tier in ["analysis_only", "advisory_possible", "draft_wo_possible", "production_ready"]:
        count = tier_counts.get(tier, 0)
        pct = (count / total * 100) if total else 0
        print(f"  {tier:24s} {count:4d}  ({pct:5.1f}%)")

    print()
    print("Confidence tier × readiness cross-tab:")
    print(f"  {'conf_tier':12s} {'analysis_only':14s} {'advisory':10s} {'draft_wo':10s}")
    for ctier in ["high", "medium", "thin"]:
        row = confidence_tier_counts.get(ctier, {})
        print(f"  {ctier:12s} {row.get('analysis_only', 0):14d} "
              f"{row.get('advisory_possible', 0):10d} "
              f"{row.get('draft_wo_possible', 0):10d}")

    print()
    if contradictions:
        print(f"⚠️  {len(contradictions)} contradiction(s) — high-tier faults stuck at analysis_only:")
        for fault_id, ctier, gaps in contradictions[:25]:
            print(f"    [HIGH+gap] {fault_id} gaps={gaps}")
        if len(contradictions) > 25:
            print(f"    ... and {len(contradictions) - 25} more")
        print()
        print("Per KNOWLEDGE_BASE_STANDARD v2.2 (v1.41.6): high-tier eligibility")
        print("for draft-WO routing assumes the FMECA chain is complete. These")
        print("rows promise more than the data supports — surface the gap or")
        print("downgrade the tier.")
    else:
        print("✓ No high-tier vs analysis-only contradictions.")

    if args.csv:
        with args.csv.open("w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["fault_id", "confidence_tier", "recommendation_readiness", "gaps"])
            for fid, ctier, readiness, gaps in per_fault:
                w.writerow([fid, ctier, readiness, ";".join(gaps)])
        print(f"\nPer-fault scoring written: {args.csv}")

    if args.strict and contradictions:
        print(f"\nSTRICT FAIL: {len(contradictions)} contradiction(s).")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
