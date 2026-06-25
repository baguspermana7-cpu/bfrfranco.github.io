#!/usr/bin/env bash
# Reproduce measurements-usgs-wqp-pfoa.csv from the USGS Water Quality Portal.
#
# The Water Quality Portal (waterqualitydata.us) is a cooperative service of the
# USGS, EPA and NWQMC. This pulls every PFOA (Perfluorooctanoic acid) result
# reported since 2020-01-01, across all providers and media (surface water,
# groundwater, sediment, tissue). PFOA is one of the two compounds in the EPA's
# 4 ppt drinking-water MCL referenced in article-26.
#
# Data are public domain. Re-run to refresh; the row count grows over time.
set -euo pipefail

URL="https://www.waterqualitydata.us/data/Result/search"
QUERY="characteristicName=Perfluorooctanoic%20acid&startDateLo=01-01-2020&mimeType=csv&zip=no&dataProfile=narrowResult"

echo "Fetching PFOA results from the Water Quality Portal..."
curl -s --max-time 300 "${URL}?${QUERY}" -o measurements-usgs-wqp-pfoa.csv
echo "rows: $(($(wc -l < measurements-usgs-wqp-pfoa.csv) - 1))"
