#!/usr/bin/env bash
# spares-db.sh — convenience wrapper for the DC spare-parts database toolchain.
#
#   tools/spares-db.sh build [SCALE]    # (re)generate data/spares-parts.sqlite + CSVs + js catalog (default SCALE=1)
#   tools/spares-db.sh big              # generate a large dataset (SCALE=30 ≈ 40k+ parts, ~50-80 MB DB)
#   tools/spares-db.sh huge             # generate a very large dataset (SCALE=100 ≈ 140k+ parts, ~250 MB DB)
#   tools/spares-db.sh million          # generate ~1M parts (SCALE=700 — slow, ~1.5 GB DB; for stress/research only)
#   tools/spares-db.sh query <report>   # run a canned report (see: tools/spares-db.sh reports)
#   tools/spares-db.sh sql "<SQL>"      # run arbitrary SQL
#   tools/spares-db.sh summary          # row counts + distributions
#   tools/spares-db.sh reports          # list canned reports
#   tools/spares-db.sh stats            # size of the DB file + table row counts
#
# The .sqlite and .csv.gz files are gitignored (regeneratable); the small CSVs +
# js/spares-parts-catalog.js (curated subset for the browser) are committed.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BUILD="$HERE/build-spares-db.py"
QUERY="$HERE/query-spares-db.py"
DB="$ROOT/data/spares-parts.sqlite"

cmd="${1:-help}"; shift || true
case "$cmd" in
  build)   python3 "$BUILD" --scale "${1:-1}" --audit ;;
  big)     python3 "$BUILD" --scale 30 --audit ;;
  huge)    python3 "$BUILD" --scale 100 --audit ;;
  million) echo "[warn] this generates ~1M parts (~1.5 GB DB) and may take a few minutes…"; python3 "$BUILD" --scale 700 --audit ;;
  query)   python3 "$QUERY" "$@" ;;
  sql)     python3 "$QUERY" --sql "$*" ;;
  summary) python3 "$QUERY" summary ;;
  reports) python3 "$QUERY" --list ;;
  stats)
    if [ ! -f "$DB" ]; then echo "[error] $DB not found — run: tools/spares-db.sh build"; exit 1; fi
    echo "DB file: $DB  ($(du -h "$DB" | cut -f1))"
    python3 - "$DB" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1]); cur = c.cursor()
for t in ("parts","failure_modes","compatibility","oems","commodity_taxonomy","dc_facility_types"):
    cur.execute(f"SELECT COUNT(*) FROM {t}"); print(f"  {t:<22} {cur.fetchone()[0]:>12,}")
PY
    ;;
  help|*) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
esac
