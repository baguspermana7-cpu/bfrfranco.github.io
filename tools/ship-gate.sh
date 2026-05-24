#!/usr/bin/env bash
# tools/ship-gate.sh — run the full per-ship gate sequence per CLAUDE.md.
# Authored v1.35.2. Exit 0 = green (safe to push), 1 = a gate failed.
#
# Usage:
#   bash tools/ship-gate.sh            # standard gates (no probe)
#   bash tools/ship-gate.sh --probe    # also run accuracy probe (file:// mode, ~50 s)
#
# The probe is opt-in here because it requires Node + puppeteer (~30-50 s).
# Owner can wire to a git pre-push hook if desired:
#   echo 'bash tools/ship-gate.sh --probe' > .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push

set -u
fail=0
runs=0

gate() {
  local name="$1"; shift
  runs=$((runs+1))
  echo
  echo "── [$runs] $name ──"
  if "$@"; then
    echo "   ✓ PASS"
  else
    echo "   ✗ FAIL"
    fail=$((fail+1))
  fi
}

# 1-4: hard audit gates
gate "audit-script-tags --strict" python3 tools/audit-script-tags.py --strict
gate "audit-js-syntax --strict"   python3 tools/audit-js-syntax.py --strict
gate "audit-version-stamp --strict" python3 tools/audit-version-stamp.py --strict
gate "audit-mobile-responsive --strict" python3 tools/audit-mobile-responsive.py --strict

# 5-6: engine acceptance suites
gate "datahall engine — 57/57 doc-21 examples" node tools/test-datahall-calc.mjs
gate "conv engine — 22/22 DoD identities"      node tools/test-conv-calc.mjs

# 7: engine-files byte-identical guard (locked since v1.32.x accuracy review)
echo
echo "── [7] engine files byte-identical guard ──"
engine_diff=$(git diff HEAD -- js/datahall-model.js js/datahall-calculations.js js/conv-engine.js | wc -l)
runs=$((runs+1))
if [ "$engine_diff" -eq 0 ]; then
  echo "   ✓ PASS — engine files unchanged"
else
  echo "   ✗ FAIL — engine files have $engine_diff lines of unstaged diff"
  echo "   (BMS Shell adoption rule of engagement: engines stay byte-identical."
  echo "    If this change is intentional, REVIEW with owner before pushing.)"
  fail=$((fail+1))
fi

# 8: optional accuracy probe
if [ "${1:-}" = "--probe" ]; then
  gate "probe-accuracy-validation — 60/60 (reviewer + drawers + cross-page + Tech Spec PDF)" \
    bash -c "RZ_BASE=file timeout 120 node tools/probe-accuracy-validation.mjs > /tmp/_probe.log 2>&1 || (cat /tmp/_probe.log; exit 1)"
fi

echo
echo "────────────────────────────────────────"
if [ $fail -eq 0 ]; then
  echo "✓ ALL $runs GATES PASS — safe to push"
  exit 0
else
  echo "✗ $fail / $runs GATES FAILED — investigate before pushing"
  exit 1
fi
