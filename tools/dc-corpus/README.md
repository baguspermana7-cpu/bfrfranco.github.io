# DC Data Corpus (PHASE EA)
Pipeline: `sources.yaml` → `fetch.mjs` (curl, rate-limited, cache → raw/, gitignored)
→ markitdown (`~/.venvs/corpus/bin/markitdown`) → `extract.mjs` (fakta JSONL
{metric,value,unit,company,segment,region,year,source_url,quote}) → `dc-facts.json`
+ SQLite `dc-facts.db` (committed) → `aggregate.mjs` → engine `DATA.benchmarksCorpus`
(distribusi n/p10-p90 per metrik×segment, sourced) → Benchmarks page.
Gate: `tools/test-dc-corpus.mjs` — fakta tanpa source_url+quote DITOLAK.
Refresh: node fetch.mjs && node extract.mjs && node aggregate.mjs && node tools/test-dc-corpus.mjs   # SHIP GATE (provenance + monotonic distributions + library consistency)


## Refresh recipe (Arc-2, 2026-07-20 — jalankan berkala manual)
```bash
node tools/dc-corpus/fetch.mjs      # curl (cap 60MB) → markitdown → raw/*.md; BINER DIHAPUS pasca-konversi
node tools/dc-corpus/extract.mjs    # fakta {metric,value,unit,company,segment,year,source_url,quote} — provenance WAJIB
node tools/dc-corpus/aggregate.mjs  # @@CORPUS di rz-engine.js + research-library.json + corpus-facts.json (deterministik)
npx terser rz-engine.js -c -m --comments false -o rz-engine.min.js
node tools/build-engine-catalog.mjs
node tools/test-dc-corpus.mjs && node tools/test-rz-engine.mjs && node tools/test-value-bindings.mjs
node tools/test-model-calibration.mjs   # KEBIJAKAN DRIFT: verdict flip = temuan → catat CHANGELOG; band TIDAK dilonggarkan
# lalu ?v bump loader + build dcmoc + probes (lihat CLAUDE.md ship suite)
```
Sumber baru: append di sources.yaml (kind: sustainability/spec/pm/tender-eis/finance/research; `ext: pdf` bila URL tidak berakhiran .pdf; publik non-paywall <60MB). Append-only.
