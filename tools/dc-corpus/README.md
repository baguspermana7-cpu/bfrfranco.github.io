# DC Data Corpus (PHASE EA)
Pipeline: `sources.yaml` → `fetch.mjs` (curl, rate-limited, cache → raw/, gitignored)
→ markitdown (`~/.venvs/corpus/bin/markitdown`) → `extract.mjs` (fakta JSONL
{metric,value,unit,company,segment,region,year,source_url,quote}) → `dc-facts.json`
+ SQLite `dc-facts.db` (committed) → `aggregate.mjs` → engine `DATA.benchmarksCorpus`
(distribusi n/p10-p90 per metrik×segment, sourced) → Benchmarks page.
Gate: `tools/test-dc-corpus.mjs` — fakta tanpa source_url+quote DITOLAK.
Refresh: node fetch.mjs && node extract.mjs && node aggregate.mjs && node tools/test-dc-corpus.mjs   # SHIP GATE (provenance + monotonic distributions + library consistency)
