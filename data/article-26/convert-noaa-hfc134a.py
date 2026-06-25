#!/usr/bin/env python3
"""
Convert the NOAA GML HATS HFC-134a flask record to a clean CSV.

Source (public domain, US Government):
  https://gml.noaa.gov/aftp/data/hats/hfcs/hfc134a_GCMS_flask.txt
  NOAA/GML flask data — PI: S. Montzka & I. Vimont. Cite NOAA GML.

HFC-134a is the dominant atmospheric precursor of trifluoroacetic acid (TFA),
which degrades at ~100% molar yield — the same TFA endpoint as the HFO
"PFAS-free" immersion-cooling replacements discussed in article-26. This record
documents the rise in atmospheric burden from ~1.8 ppt (1994) to ~150 ppt (2026).

Input columns (tab-delimited): site, dec_date, "yyyymmdd hhmmss",
                               wind_dir, wind_spd, hfc134a, hfc134a_sd
"""
import csv, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/hfc134a_raw.txt"
OUT = "measurements-noaa-hfc134a.csv"

rows = []
with open(SRC) as f:
    lines = f.read().splitlines()

# line 0 = attribution comment, line 1 = header; data starts line 2
for ln in lines[2:]:
    if not ln.strip():
        continue
    parts = ln.split("\t")
    if len(parts) < 7:
        continue
    site, dec_date, datetime_f, wdir, wspd, val, sd = parts[:7]
    dt = datetime_f.split()
    yyyymmdd = dt[0] if dt else ""
    hhmmss = dt[1] if len(dt) > 1 else ""
    rows.append({
        "site": site,
        "decimal_date": dec_date,
        "date_yyyymmdd": yyyymmdd,
        "time_hhmm": hhmmss,
        "wind_dir_deg": wdir,
        "wind_spd": wspd,
        "hfc134a_ppt": val,
        "hfc134a_sd_ppt": sd,
    })

FIELDS = ["site","decimal_date","date_yyyymmdd","time_hhmm","wind_dir_deg",
          "wind_spd","hfc134a_ppt","hfc134a_sd_ppt"]
with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    w.writerows(rows)

print(f"wrote {OUT} with {len(rows)} measurement rows")
