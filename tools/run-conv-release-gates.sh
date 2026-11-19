#!/usr/bin/env bash
# run-conv-release-gates.sh — the gate set a Conventional-cockpit release must pass, taken from tools/ship-gate.sh.
#
# Why this exists: releases v3.70.0 … v3.74.0 were gated with an ad-hoc filter that matched only `test-conv-*`.
# The fire authority gate (tools/test-fire-system-runtime-authority.mjs) is a Conventional gate with another name,
# was never in that filter, and stayed red on main for four releases. This script selects by what a gate COVERS,
# not by its file name, and it joins continuation lines so a gate written over two lines is not dropped.
#
# It selects every `gate "<name>" <command>` of ship-gate.sh whose NAME or COMMAND mentions the Conventional family
# (conv, Conventional, EPMS, ICT, datahall (not datahall-ai), chiller, fire, fuel, water, cockpit, operator, engine
# version, registry, payload, formula, explain) and adds the site-wide audits a cockpit change can break.
# DC AI gates (datahall-ai, dcai) are excluded: another session owns that page.
#
# Usage:  tools/run-conv-release-gates.sh [--list] [--from N] [--only <regex>]
#         run inside a browser lane:  TMPDIR=$HOME/.cache/qa-tmp rz-lane -l 2 -t 14400 -- bash tools/run-conv-release-gates.sh
# Output: one line per gate "exit <code> :: <command> :: <last line>", a summary, exit 1 if any gate failed.
#         Full output of each gate: $RZ_GATE_LOG_DIR/<n>.log (default $TMPDIR/conv-release-gates/).
set -u
cd "$(dirname "$0")/.."
: "${TMPDIR:=$HOME/.cache/qa-tmp}"; export TMPDIR
LOG_DIR="${RZ_GATE_LOG_DIR:-$TMPDIR/conv-release-gates}"; mkdir -p "$LOG_DIR"
LIST=0; FROM=1; ONLY=''
while [ $# -gt 0 ]; do case "$1" in --list) LIST=1;; --from) FROM="$2"; shift;; --only) ONLY="$2"; shift;; esac; shift; done

FAMILY='conv|Conventional|EPMS|epms|ICT |ict-|ict\.|datahall|chiller|fire|fuel|water|cockpit|operator|engine version|engine-version|registry|payload|formula|explain|value-bindings|eng-symbols|hmi'
EXCLUDE='datahall-ai|dcai|DC AI|pillar-fire|fire-calc|fire-ca|article|journal|incident|homepage|hub-tools'
EXTRA=(
  'node tools/audit-a11y.mjs --strict'
  'node tools/audit-dark-coverage.mjs --strict'
  'node tools/audit-responsive-layout.mjs --strict'
  'node tools/audit-editorial-render.mjs'
  'python3 tools/audit-js-syntax.py --strict'
  'python3 tools/audit-script-tags.py --strict'
  'node tools/test-asset-cache-tokens.mjs'
  'python3 tools/test-generator-freshness.py'
  'python3 tools/sweep-site-chrome.py --check'
  'node tools/test-site-chrome.mjs --page=dc-conventional.html,datahall.html,chiller-plant.html,water-system.html,fire-system.html,fuel-system.html,ict.html,EPMS_Telemetry.html,cdu-mini-bms.html'
)

# join "\"-continued lines, keep gate lines, strip the leading `gate "name" `
mapfile -t CMDS < <(sed -e ':a' -e '/\\$/N; s/\\\n[[:space:]]*/ /; ta' tools/ship-gate.sh \
  | grep -E '^gate "' | grep -E "$FAMILY" | grep -Ev "$EXCLUDE" \
  | sed -E 's/^gate "[^"]*"[[:space:]]+//' | sed -E 's/\$LTC_BASE/file/g')
for e in "${EXTRA[@]}"; do
  dup=0; for c in "${CMDS[@]}"; do [ "$c" = "$e" ] && dup=1; done
  [ $dup -eq 0 ] && CMDS+=("$e")
done

if [ $LIST -eq 1 ]; then n=0; for c in "${CMDS[@]}"; do n=$((n+1)); echo "[$n] $c"; done; echo "${#CMDS[@]} gates"; exit 0; fi

fail=0; pass=0; n=0
for c in "${CMDS[@]}"; do
  n=$((n+1)); [ $n -lt "$FROM" ] && continue
  if [ -n "$ONLY" ] && ! echo "$c" | grep -Eq "$ONLY"; then continue; fi
  eval "$c" > "$LOG_DIR/$n.log" 2>&1; rc=$?
  last=$(grep -Ev '^\s*at |^\s*$|^Node\.js v' "$LOG_DIR/$n.log" | tail -1 | cut -c1-110)
  echo "exit $rc :: [$n] $c :: $last"
  if [ $rc -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); fi
done
echo "CONV RELEASE GATES — $pass passed, $fail failed, of ${#CMDS[@]} selected (logs: $LOG_DIR)"
[ $fail -eq 0 ]
