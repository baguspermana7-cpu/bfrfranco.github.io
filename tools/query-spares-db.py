#!/usr/bin/env python3
"""
query-spares-db.py — query / export tool for the DC spare-parts database
========================================================================
Companion to `tools/build-spares-db.py`. Runs the canned analysis queries
documented in `Documents/Training/spares_parts_database.md`, or arbitrary SQL.

Usage:
    python3 tools/query-spares-db.py --list                       # show the canned reports
    python3 tools/query-spares-db.py critical-long-lead            # run a canned report
    python3 tools/query-spares-db.py eol-exposure --limit 30
    python3 tools/query-spares-db.py oem-concentration --csv out.csv
    python3 tools/query-spares-db.py ai-cooling
    python3 tools/query-spares-db.py blind-risks
    python3 tools/query-spares-db.py printable
    python3 tools/query-spares-db.py refurb
    python3 tools/query-spares-db.py summary                       # row counts + distributions
    python3 tools/query-spares-db.py --sql "SELECT system, COUNT(*) FROM parts GROUP BY system"
    python3 tools/query-spares-db.py --sql-file myquery.sql --csv result.csv

If the DB doesn't exist, run `python3 tools/build-spares-db.py --scale 1` first.
Stdlib only.
"""
from __future__ import annotations
import argparse
import csv
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "spares-parts.sqlite"

CANNED = {
    "critical-long-lead": (
        "Critical parts (criticality ≥ 7) with long lead times (≥ 12 weeks)",
        """SELECT p.part_id, p.description, o.name AS oem, p.criticality_default AS crit,
                  p.lead_time_weeks_typ AS lt_wk, p.unit_cost_usd_typ AS cost,
                  p.lifecycle_status AS life, p.eol_risk AS eol, p.qualified_alternates_count AS alts
           FROM parts p LEFT JOIN oems o ON o.oem_id = p.oem_id
           WHERE p.criticality_default >= 7 AND p.lead_time_weeks_typ >= 12
           ORDER BY p.criticality_default DESC, p.lead_time_weeks_typ DESC""",
    ),
    "eol-exposure": (
        "EOL exposure — NRND/LTB/obsolete parts in legacy DCs with no qualified alternate",
        """SELECT p.part_id, p.description, o.name AS oem, p.dc_generation AS gen,
                  p.lifecycle_status AS life, p.eol_risk AS eol, p.criticality_default AS crit,
                  p.unit_cost_usd_typ AS cost, p.mtbf_years AS mtbf,
                  p.typical_installed_base_per_site_min AS ib_min, p.typical_installed_base_per_site_max AS ib_max
           FROM parts p LEFT JOIN oems o ON o.oem_id = p.oem_id
           WHERE p.lifecycle_status IN ('nrnd','last-time-buy','obsolete')
             AND p.qualified_alternates_count = 0
             AND p.dc_generation LIKE '%legacy%'
           ORDER BY p.eol_risk DESC, p.criticality_default DESC""",
    ),
    "oem-concentration": (
        "OEM concentration by subsystem (single-source-risk hotspots, ≥ 3 parts)",
        """SELECT subsystem, oem_name, part_count, ROUND(avg_unit_cost) AS avg_cost,
                  ROUND(avg_lead_time_wk) AS avg_lt_wk
           FROM v_oem_concentration WHERE part_count >= 3
           ORDER BY subsystem, part_count DESC""",
    ),
    "ai-cooling": (
        "AI-factory liquid-cooling parts (system = cooling)",
        """SELECT p.part_id, p.description, o.name AS oem, p.criticality_default AS crit,
                  p.lead_time_weeks_typ AS lt_wk, p.unit_cost_usd_typ AS cost,
                  p.lifecycle_status AS life, p.refrigerant_type AS refr
           FROM parts p LEFT JOIN oems o ON o.oem_id = p.oem_id
           WHERE p.dc_generation LIKE '%ai-factory%' AND p.system = 'cooling'
           ORDER BY p.criticality_default DESC, p.lead_time_weeks_typ DESC""",
    ),
    "blind-risks": (
        "Highest-severity failure modes that are NOT condition-monitorable (blind risks)",
        """SELECT p.part_id, p.description, f.failure_mode, f.fmeca_severity AS sev,
                  f.detectability AS detect, f.typical_cause AS cause
           FROM failure_modes f JOIN parts p ON p.part_id = f.part_id
           WHERE f.fmeca_severity >= 8 AND f.condition_monitorable = 0
           ORDER BY f.fmeca_severity DESC, f.detectability DESC""",
    ),
    "printable": (
        "3D-printable parts (collapse lead time / kill LTB risk)",
        """SELECT p.part_id, p.description, o.name AS oem, p.subsystem, p.lead_time_weeks_typ AS lt_wk
           FROM parts p LEFT JOIN oems o ON o.oem_id = p.oem_id
           WHERE p.printable_3d = 1 ORDER BY p.subsystem, p.description""",
    ),
    "refurb": (
        "Refurbished-pool candidates (circular-economy sourcing, criticality ≤ 6)",
        """SELECT p.part_id, p.description, p.subsystem, p.criticality_default AS crit, p.lifecycle_status AS life
           FROM parts p WHERE p.refurbishable = 1 AND p.criticality_default <= 6
           ORDER BY p.subsystem, p.description""",
    ),
    "by-generation": (
        "Part count + avg lead time + avg cost per DC generation × system",
        """SELECT g.gen, p.system, COUNT(*) AS n,
                  ROUND(AVG(p.lead_time_weeks_typ),1) AS avg_lt_wk,
                  ROUND(AVG(p.unit_cost_usd_typ)) AS avg_cost,
                  ROUND(AVG(p.criticality_default),1) AS avg_crit
           FROM parts p
           JOIN (SELECT part_id, TRIM(value) AS gen
                 FROM parts, json_each('["' || REPLACE(dc_generation, '|', '","') || '"]')) g
                ON g.part_id = p.part_id
           GROUP BY g.gen, p.system ORDER BY g.gen, n DESC""",
    ),
    "long-lead-leaders": (
        "Subsystems with the longest typical lead times (≥ 20 parts)",
        """SELECT subsystem, COUNT(*) AS n, ROUND(AVG(lead_time_weeks_typ),1) AS avg_lt_wk,
                  MAX(lead_time_weeks_max) AS worst_lt_wk, ROUND(AVG(criticality_default),1) AS avg_crit
           FROM parts GROUP BY subsystem HAVING n >= 20
           ORDER BY avg_lt_wk DESC""",
    ),
}


def connect():
    if not DB_PATH.exists():
        sys.exit(f"[error] DB not found: {DB_PATH}\n        Run: python3 tools/build-spares-db.py --scale 1")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def run_query(con, sql, limit=None):
    cur = con.cursor()
    if limit is not None and "limit" not in sql.lower():
        sql = sql.rstrip().rstrip(";") + f" LIMIT {int(limit)}"
    cur.execute(sql)
    cols = [d[0] for d in cur.description] if cur.description else []
    rows = cur.fetchall()
    return cols, rows


def print_table(cols, rows, max_rows=40):
    if not cols:
        print("(no result set)")
        return
    # compute widths from a sample
    widths = [len(c) for c in cols]
    sample = rows[:max_rows]
    for r in sample:
        for i, c in enumerate(cols):
            widths[i] = min(48, max(widths[i], len(str(r[c]))))
    line = " | ".join(c.ljust(widths[i]) for i, c in enumerate(cols))
    print(line)
    print("-" * len(line))
    for r in sample:
        print(" | ".join(str(r[c])[:widths[i]].ljust(widths[i]) for i, c in enumerate(cols)))
    if len(rows) > max_rows:
        print(f"... ({len(rows)} rows total; showing {max_rows}. Use --csv to export all.)")
    else:
        print(f"({len(rows)} rows)")


def write_csv(path, cols, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in rows:
            w.writerow([r[c] for c in cols])
    print(f"[ok] wrote {len(rows)} rows × {len(cols)} cols → {path}")


def summary(con):
    cur = con.cursor()
    def one(q):
        cur.execute(q); return cur.fetchone()[0]
    print("=== SPARE-PARTS DB SUMMARY ===")
    print(f"parts:          {one('SELECT COUNT(*) FROM parts'):,}")
    print(f"failure_modes:  {one('SELECT COUNT(*) FROM failure_modes'):,}")
    print(f"compatibility:  {one('SELECT COUNT(*) FROM compatibility'):,}")
    print(f"oems:           {one('SELECT COUNT(*) FROM oems')}")
    print(f"taxonomy rows:  {one('SELECT COUNT(*) FROM commodity_taxonomy')}")
    print(f"facility types: {one('SELECT COUNT(*) FROM dc_facility_types')}")
    print()
    print("by system:")
    cur.execute("SELECT system, COUNT(*) n FROM parts GROUP BY system ORDER BY n DESC")
    for r in cur.fetchall(): print(f"  {r[0]:<20} {r[1]:>6,}")
    print()
    print("by lifecycle:")
    cur.execute("SELECT lifecycle_status, COUNT(*) n FROM parts GROUP BY lifecycle_status ORDER BY n DESC")
    for r in cur.fetchall(): print(f"  {r[0]:<20} {r[1]:>6,}")
    print()
    print("top 10 OEMs by part count:")
    cur.execute("SELECT o.name, COUNT(*) n FROM parts p LEFT JOIN oems o ON o.oem_id=p.oem_id GROUP BY p.oem_id ORDER BY n DESC LIMIT 10")
    for r in cur.fetchall(): print(f"  {str(r[0])[:32]:<34} {r[1]:>6,}")
    print()
    print("criticality distribution:")
    cur.execute("SELECT criticality_default c, COUNT(*) n FROM parts GROUP BY c ORDER BY c")
    for r in cur.fetchall(): print(f"  {r[0]:>2}: {'█'*max(1,r[1]//50)} {r[1]:,}")


def main():
    ap = argparse.ArgumentParser(description="Query / export the DC spare-parts database.")
    ap.add_argument("report", nargs="?", help="canned report name (see --list) or 'summary'")
    ap.add_argument("--list", action="store_true", help="list the canned reports")
    ap.add_argument("--sql", help="run an arbitrary SQL query")
    ap.add_argument("--sql-file", help="run SQL from a file")
    ap.add_argument("--limit", type=int, help="LIMIT n (appended if the query has no LIMIT)")
    ap.add_argument("--csv", help="write the result to a CSV file instead of printing")
    ap.add_argument("--max-rows", type=int, default=40, help="max rows to print (default 40)")
    args = ap.parse_args()

    if args.list:
        print("Canned reports:")
        for k, (desc, _sql) in CANNED.items():
            print(f"  {k:<22} {desc}")
        print(f"  {'summary':<22} Row counts + distributions")
        return

    con = connect()

    if args.sql or args.sql_file:
        sql = args.sql if args.sql else Path(args.sql_file).read_text()
        cols, rows = run_query(con, sql, args.limit)
        if args.csv: write_csv(args.csv, cols, rows)
        else: print_table(cols, rows, args.max_rows)
        return

    if args.report == "summary":
        summary(con); return

    if not args.report or args.report not in CANNED:
        ap.print_help()
        print("\nUse --list to see canned reports, or --sql / --sql-file for arbitrary queries.")
        sys.exit(0 if not args.report else 2)

    desc, sql = CANNED[args.report]
    print(f"# {desc}\n")
    cols, rows = run_query(con, sql, args.limit)
    if args.csv: write_csv(args.csv, cols, rows)
    else: print_table(cols, rows, args.max_rows)


if __name__ == "__main__":
    main()
