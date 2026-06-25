#!/usr/bin/env bash
# Reproduce measurements-usgs-wqp-pfos.csv from the USGS Water Quality Portal.
#
# PFOS (perfluorooctane sulfonate) is the second compound in the EPA 4 ppt
# drinking-water MCL. The Water Quality Portal records it under two controlled
# vocabulary names; this query ORs both to capture the full set, across all
# providers and media (surface water, groundwater, sediment, tissue), since 2020.
#
# Data are public domain (USGS/EPA/NWQMC). Re-run to refresh.
set -euo pipefail

URL="https://www.waterqualitydata.us/data/Result/search"
QUERY="characteristicName=Perfluorooctanesulfonate&characteristicName=Perfluorooctane%20sulfonic%20acid&startDateLo=01-01-2020&mimeType=csv&zip=no&dataProfile=narrowResult"

echo "Fetching PFOS results from the Water Quality Portal..."
curl -s --max-time 300 "${URL}?${QUERY}" -o measurements-usgs-wqp-pfos.csv
echo "rows: $(($(wc -l < measurements-usgs-wqp-pfos.csv) - 1))"
