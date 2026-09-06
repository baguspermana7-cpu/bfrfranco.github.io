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
gate "DC AI GB300 engine — identities, balance, cliff, perturbation" node tools/test-dcai-engine.mjs
gate "DC AI GB300 parameter registry — schema, staleness, provenance, wiring" node tools/test-dcai-parameter-registry.mjs
gate "DC AI basis map — DH_BASIS ids resolve, every bo() field mapped, adapter at parity" node tools/test-dcai-basis-map.mjs
gate "DC AI traceability coverage — every drawn, inspector and modal number hooked or declared (hook-aware, settled)" node tools/test-dcai-coverage.mjs --strict --settle=9000 --modals
gate "DC AI basis hooks — marks well-formed, a real click per diagram opens the inspector" node tools/test-dcai-basis-hooks.mjs
gate "DC AI HMI payloads — every class hooked-at-parity or declared, deterministic, scenario states, Rule 2 static scan" node --test tools/test-datahall-ai-hmi-payloads.mjs
gate "DC AI equipment inspector — click=inspector, Open HMI=modal lifecycle, pinned-tick determinism, ladder, Rule 2 counter" node tools/test-datahall-ai-inspector-runtime.mjs --strict-rule2
gate "conv engine — 26/26 DoD identities"      node tools/test-conv-calc.mjs
gate "CDU engine — worked examples"            node tools/test-cdu-calc.mjs
gate "Fire engine — worked examples"           node tools/test-fire-calc.mjs

# DC operator workspaces: semantic state, current/study separation, and post-tick parity.
gate "DC AI alarms — query and first-out" node tools/test-datahall-ai-alarm-query.mjs
gate "DC AI rack density — GB300 baseline, GB200 retired reference" node --test tools/test-datahall-ai-rack-density.mjs
gate "DC AI engine pin — page pins == engine version (fails closed otherwise)" node tools/test-dcai-engine-version-pin.mjs
gate "DC AI page — zero retired GB200 numerals" node tools/test-datahall-ai-no-retired-literals.mjs
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
# STRICT since v1.134.24 — the flip condition written here when this started at ~24 % has been met:
# every number rendered on all 8 cockpits either resolves to a registry parameter or sits in a region
# DECLARED as authored page basis with a written reason. 189 / 189 traced, 831 declared.
# The denominator is rendered text, NOT element ids, because ~390 of the numbers on these pages carry
# no id at all (chiller P&ID text nodes, ict link-table cells, hand-written KPI cells) — an id-keyed
# gate would report 100 % while missing two thirds of the screen.
# It fails on the FIRST untraced number now, which is the point: reaching 100 % is worth little if the
# next unbound literal can walk back in unnoticed.
gate "Conventional coverage — every rendered number traced to the registry" node tools/test-conv-coverage.mjs --strict
# The shared basis drawer renders the registry rather than restating provenance by hand. This
# asserts every data-basis-param resolves, the modules actually load, the hooks are keyboard
# controls, and the drawer's number agrees with the number in the row it explains.
gate "Conventional basis drawer — hooks resolve, explanations match their KPI" node tools/test-conv-basis-drawer.mjs
# GLOSSARY WIRING. Two surfaces that must stay separate: the basis drawer on the value cell says
# where THIS NUMBER came from, the tooltip on the label says what the TERM means. The mapping is
# generated from the registry's explainKey, never hand-authored on a page. This gate found four
# dead keys on its first run — rz-explain.js skips an unknown key in silence, so a tooltip that
# never appears looks exactly like one nobody asked for.
gate "Conventional glossary wiring — explainKeys resolve and reach the page" node tools/test-conv-explain-wiring.mjs

# Hall selection: a REAL scope swap on the page that draws one hall, and an honest view label on
# the pages whose plant is central. Both directions are asserted — a cosmetic selector and an
# invented per-hall split are both failures.
gate "Conventional hall scope — datahall re-scopes, central plants do not" node tools/test-conv-hall-scope.mjs
# Every declared formula is EVALUATED against the engine's published values. The registry has
# carried a `formula` field since v1.134.1 and it was prose — a formula could describe a
# calculation the code had stopped performing and nothing would notice. Dependency EDGES are
# measured by perturbing the engine; the ARITHMETIC on those edges is verified here.
gate "Conventional formulas — declared arithmetic actually holds" node tools/test-conv-formula.mjs
# STRICT since v1.134.6. This ran advisory while the pages carried ~484 measured findings
# (chiller-plant 27-48 label collisions + 16-18 clipped, EPMS 12-13 collisions, fire 2 clipped
# + 46px tablet overflow, water 336px tablet overflow). Every one of those is now paid:
# collisions 0, clipped 0, degenerate 0, document overflow 0, across 4 diagrams x 4 viewports
# x 2 themes. The flip condition documented here has been met, so the gate is armed — a new
# label that lands on another one, or an element drawn outside its viewBox, now fails the ship.
gate "Conventional geometry — collisions, clipping, arrangement" node tools/test-conv-geometry.mjs
gate "Conventional study — reconciled four-hall basis" node --test tools/test-conv-design-basis.mjs
gate "Conventional alarms — common historian workspace" node --test tools/test-conv-alarm-workspace.mjs
gate "Conventional alarms — modal runtime and accessibility" node tools/test-conv-alarm-runtime.mjs
gate "Conventional cooling/water — operator UI" node --test tools/test-conv-cooling-water-ui.mjs
gate "Conventional fire/fuel — operator consequences" node --test tools/test-conv-fire-fuel-operator.mjs
gate "Conventional dashboard — complete authority and Design Studio" node tools/test-conv-dashboard-authority.mjs
gate "Conventional Design Studio — document selection, scope, and export" node tools/test-conv-design-studio-browser.mjs
gate "Conventional ICT and EPMS — complete authority fail-close" node tools/test-conv-secondary-authority.mjs
gate "Conventional data hall — complete authority fan-out" node tools/test-datahall-authority.mjs
gate "Conventional fire — complete authority fan-out" node tools/test-fire-system-runtime-authority.mjs
gate "AI data hall — complete model/calculation authority" node tools/test-datahall-ai-authority.mjs
gate "SCADA cockpit — authorized audit evidence contract" node tools/test-cockpit-audit-state.mjs
gate "SCADA cockpit — responsive operator regressions" node tools/test-operator-cockpit-regressions.mjs
gate "Conventional data hall — operator engineering" node --test tools/test-datahall-operator-engineering.mjs
gate "Conventional data hall/ICT — runtime state" node --test tools/test-ict-datahall-operator-runtime.mjs
gate "Conventional ICT — operator architecture" node --test tools/test-ict-operator-architecture.mjs
gate "DC Design Studio — shared workflow" node tools/test-rz-design-studio.mjs
gate "Dark coverage — fail-closed confirmation verdict" node --test tools/test-dark-coverage-verdict.mjs

# Public telemetry documentation is a shipped cockpit contract, not an optional audit.
gate "telemetry docs — structure, contract links, and sourced-manual preservation" node tools/test-telemetry-docs.mjs
gate "Conventional linked manuals and PRD — current authority parity" node tools/test-conv-document-parity.mjs
gate "telemetry docs — generated discovery parity" node tools/test-telemetry-discovery.mjs
gate "telemetry docs — browser, a11y, mobile, and gate safety" node tools/test-telemetry-e2e.mjs

# Harness documentation is release state: public-safety and generated links must not drift.
# ANTI-VIBECODE — STRICT since v1.135.0. The flip condition written here has been met.
# History, because it is the point: the standard claimed from 2026-08-23 that this was wired as
# --strict. It was not wired at all — the exit code was forced to 0 — so the hard-banned tokens
# went unenforced for the whole period, which is how the shared auth component shipped Anthropic
# purple on every page of the site. The stated blocker was that ~102 pages used #A78BFA as a
# semantic marker with no named token to move to; v1.134.21 chose --rz-restricted and swept all
# 106 files to zero. The last two findings (glassmorphism on .metric-card / .oe-card / .case-card
# in both stylesheets) were fixed in v1.135.0, so there is nothing left to defer behind.
# A monitor that is read as a gate is worse than no gate: it is a green light nobody earned.
gate "anti-vibecode — hard-banned design tokens" node tools/audit-vibecode.mjs --strict
# LEGIBILITY. Rendered label height across every page: a label below the floor is not small text,
# it is texture that looks like information. 848 findings on the first run, all from one root
# cause — the incident timelines' viewBox grew with the event count while max-width squeezed them
# into the column, so the more an incident had to say the smaller it printed. Now zero.
gate "site legibility — no unreadable SVG labels, no clipped text" node tools/audit-legibility.mjs --strict
gate "agent harness standard — privacy and release parity" node tools/test-agent-harness-standard.mjs
# MIN-TWIN FRESHNESS. index.html is one of two pages that load auth.min.js instead of auth.js,
# so a stale twin means the HOMEPAGE runs old auth code while every other page runs the fixed
# one — silently. That shipped twice: once caught by hand in v1.126.x, and again by v1.134.20,
# where the twin still carried the Anthropic purple the same release had just removed from the
# source. terser -c -m is byte-reproducible for every twin here, so the check is exact.
gate "min-twin freshness — no page runs a stale minified build" node tools/audit-min-twins.mjs --strict
# ENGINE VERSION PINS. Every Conventional cockpit fails CLOSED on an engine it does not
# recognise — correct behaviour, and the reason bumping the engine 2.0.0 -> 2.1.0 in v1.134.23
# blanked all eight at once: no page threw, nothing logged, the authority check just returned
# false and nineteen unrelated gates timed out waiting for elements that were never drawn.
gate "engine version pins — pages agree with the engine they load" node tools/test-conv-engine-version-pins.mjs



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
    gate "probe-accuracy-validation — 82/82 (file://)" \
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
      gate "probe-accuracy-validation — 82/82 (HTTP ${base})" \
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
