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
gate "CDU engine — worked examples"            node tools/test-cdu-calc.mjs
gate "Fire engine — worked examples"           node tools/test-fire-calc.mjs

# DC operator workspaces: semantic state, current/study separation, and post-tick parity.
gate "DC AI alarms — query and first-out" node tools/test-datahall-ai-alarm-query.mjs
gate "DC AI rack density — current and study" node tools/test-datahall-ai-rack-density.mjs
gate "DC AI CDU — 9 running / 12 installed" node tools/test-datahall-ai-cdu-basis.mjs
gate "DC AI electrical — topology" node tools/test-datahall-ai-electrical-topology.mjs
gate "DC AI electrical — visual projection" node tools/test-datahall-ai-electrical-visual-map.mjs
gate "DC AI electrical — four-second live parity" node tools/test-datahall-ai-electrical-live.mjs
gate "DC AI fire — FACP cause and effect" node tools/test-datahall-ai-fire-cause-effect.mjs
gate "DC AI operator UI — markup contract" node tools/test-datahall-ai-operator-ui.mjs
gate "DC AI operator UI — runtime contract" node tools/test-datahall-ai-operator-runtime.mjs
gate "EPMS — ATS-to-rack source colour" node tools/test-epms-ats-rack-color.mjs
gate "Conventional snapshot binding — no phantom keys, strips follow the engine" node tools/test-conv-snapshot-binding.mjs
# The parameter registry is the single source of truth for what every Conventional number IS,
# where it came from, and what moves it. Dependency edges are MEASURED (the engine is recomputed
# once per authored input) rather than declared, so "everything is wired" is a fact, not a claim.
gate "Conventional parameter registry — schema, staleness, provenance, measured wiring" node tools/test-conv-parameter-registry.mjs
# MONITOR (advisory, exit 0 by design): walks the RENDERED DOM of all 8 cockpits and asks of every
# number a human can read whether any registry parameter accounts for it. The denominator is rendered
# text, NOT element ids, because ~390 of the ~945 numbers on these pages carry no id at all (chiller
# P&ID text nodes, ict link-table cells, hand-written KPI cells) — an id-keyed gate would report 100 %
# while missing two thirds of the screen. Today's honest figure is ~24 %.
# FLIP TO STRICT (add --strict) once page-level derived displays are registered and the P&ID/table
# text nodes are bound; a gate that fails from day one gets muted instead of paid down.
gate "Conventional coverage MONITOR — rendered numbers traced to the registry" node tools/test-conv-coverage.mjs
# The shared basis drawer renders the registry rather than restating provenance by hand. This
# asserts every data-basis-param resolves, the modules actually load, the hooks are keyboard
# controls, and the drawer's number agrees with the number in the row it explains.
gate "Conventional basis drawer — hooks resolve, explanations match their KPI" node tools/test-conv-basis-drawer.mjs
# Hall selection: a REAL scope swap on the page that draws one hall, and an honest view label on
# the pages whose plant is central. Both directions are asserted — a cosmetic selector and an
# invented per-hall split are both failures.
gate "Conventional hall scope — datahall re-scopes, central plants do not" node tools/test-conv-hall-scope.mjs
# MONITOR (advisory, exit 0 by design): measures diagram geometry — label collisions, clipped elements,
# degenerate labels, phone overflow — across 4 diagrams x 4 viewports x 2 themes. It runs in --measure mode
# because the current pages carry a real, already-measured debt (~484 findings: chiller-plant 27-48 collisions
# + 16-18 clipped, EPMS 12-13 collisions, fire 2 clipped + 46px tablet overflow, water 336px tablet overflow).
# FLIP TO STRICT (drop --measure) once the chiller/fire/water/EPMS layout work lands — a gate that fails from
# day one gets muted, so the debt is reported every run until it is actually paid.
gate "Conventional geometry MONITOR — collisions, clipping, arrangement" node tools/test-conv-geometry.mjs --measure
gate "Conventional study — reconciled four-hall basis" node --test tools/test-conv-design-basis.mjs
gate "Conventional alarms — common historian workspace" node --test tools/test-conv-alarm-workspace.mjs
gate "Conventional alarms — modal runtime and accessibility" node tools/test-conv-alarm-runtime.mjs
gate "Conventional cooling/water — operator UI" node --test tools/test-conv-cooling-water-ui.mjs
gate "Conventional fire/fuel — operator consequences" node --test tools/test-conv-fire-fuel-operator.mjs
gate "Conventional data hall — operator engineering" node --test tools/test-datahall-operator-engineering.mjs
gate "Conventional data hall/ICT — runtime state" node --test tools/test-ict-datahall-operator-runtime.mjs
gate "Conventional ICT — operator architecture" node --test tools/test-ict-operator-architecture.mjs
gate "DC Design Studio — shared workflow" node tools/test-rz-design-studio.mjs
gate "Dark coverage — fail-closed confirmation verdict" node --test tools/test-dark-coverage-verdict.mjs

# Public telemetry documentation is a shipped cockpit contract, not an optional audit.
gate "telemetry docs — structure, contract links, and sourced-manual preservation" node tools/test-telemetry-docs.mjs
gate "telemetry docs — generated discovery parity" node tools/test-telemetry-discovery.mjs
gate "telemetry docs — browser, a11y, mobile, and gate safety" node tools/test-telemetry-e2e.mjs

# Harness documentation is release state: public-safety and generated links must not drift.
gate "agent harness standard — privacy and release parity" node tools/test-agent-harness-standard.mjs

# Engine-files byte-identical guard (locked since v1.32.x accuracy review)
echo
runs=$((runs+1))
echo "── [$runs] engine files byte-identical guard ──"
engine_diff=$(git diff HEAD -- js/datahall-model.js js/datahall-calculations.js js/conv-engine.js | wc -l)
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
