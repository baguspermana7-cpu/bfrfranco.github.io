#!/usr/bin/env bash
# tools/ship-gate.sh — run the full per-ship gate sequence per CLAUDE.md.
# Authored v1.35.2. Exit 0 = green (safe to push), 1 = a gate failed.
#
# Usage:
#   bash tools/ship-gate.sh                    # standard gates (no probe)
#   bash tools/ship-gate.sh --probe            # also run accuracy probe (file:// mode)
#   bash tools/ship-gate.sh --probe-http       # probe against a running dev server
#   RZ_PROBE_BASE=http://127.0.0.1:8090 bash tools/ship-gate.sh --probe-http
#
# The probe is opt-in here because it requires Node + puppeteer (~30-60 s).
# file:// mode works with no server but is ~25 % slower; --probe-http needs
# a running `python3 -m http.server PORT` first (defaults to 8090).
#
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

# 8: optional accuracy probe (file:// or http://)
case "${1:-}" in
  --probe)
    gate "probe-accuracy-validation — 75/75 (file://)" \
      bash -c "RZ_BASE=file timeout 180 node tools/probe-accuracy-validation.mjs > /tmp/_probe.log 2>&1 || (cat /tmp/_probe.log; exit 1)"
    ;;
  --probe-http)
    base="${RZ_PROBE_BASE:-http://127.0.0.1:8090}"
    # Pre-flight: HTTP server must be reachable, else --probe-http would just timeout.
    if ! curl -s -o /dev/null -w "%{http_code}" "${base}/datahallAI.html" | grep -q "^200$"; then
      runs=$((runs+1))
      echo
      echo "── [$runs] probe-accuracy-validation (HTTP) ──"
      echo "   ✗ FAIL — dev server not reachable at ${base}"
      echo "   Start one first:  python3 -m http.server 8090 --directory \$(pwd)"
      fail=$((fail+1))
    else
      gate "probe-accuracy-validation — 75/75 (HTTP ${base})" \
        bash -c "RZ_BASE='${base}' timeout 180 node tools/probe-accuracy-validation.mjs > /tmp/_probe.log 2>&1 || (cat /tmp/_probe.log; exit 1)"
    fi
    ;;
esac

echo
echo "────────────────────────────────────────"
if [ $fail -eq 0 ]; then
  echo "✓ ALL $runs GATES PASS — safe to push"
  exit 0
else
  echo "✗ $fail / $runs GATES FAILED — investigate before pushing"
  exit 1
fi
