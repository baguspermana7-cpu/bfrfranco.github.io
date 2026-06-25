#!/usr/bin/env bash
# Reproduce measurements-usgs-wqp-genx-hfpo-da.csv from the USGS Water Quality Portal.
#
# GenX (HFPO-DA, Hexafluoropropylene oxide dimer acid) is a current-generation
# PFAS marketed as a "safer" replacement — and is now itself EPA-regulated (a
# 10 ppt MCL, 2024). It is the direct analogue to the article's argument that
# the HFO "PFAS-free" cooling replacements simply trade one persistent compound
# (and its TFA breakdown product) for another. All media, since 2020.
#
# NOTE: trifluoroacetic acid (TFA) itself returns ZERO records in the Water
# Quality Portal under every name variant tried (Trifluoroacetic acid /
# Trifluoroacetate / Trifluoroethanoic acid) — the breakdown product central to
# this article is effectively unmonitored in US water-quality systems.
#
# Data are public domain (USGS/EPA/NWQMC). Re-run to refresh.
set -euo pipefail

URL="https://www.waterqualitydata.us/data/Result/search"
QUERY="characteristicName=Hexafluoropropylene%20oxide%20dimer%20acid&startDateLo=01-01-2020&mimeType=csv&zip=no&dataProfile=narrowResult"

echo "Fetching GenX (HFPO-DA) results from the Water Quality Portal..."
curl -s --max-time 300 "${URL}?${QUERY}" -o measurements-usgs-wqp-genx-hfpo-da.csv
echo "rows: $(($(wc -l < measurements-usgs-wqp-genx-hfpo-da.csv) - 1))"
