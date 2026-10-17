# Article 30 glossary notes

- Added 32 terms to `glossary.html` (417 -> 449 `id="term-"`), each inserted at the end of its letter section.
  Each has a plain definition, a mechanism/number sentence with [Sn] tags from RESEARCH.md, and an
  `article-30.html#<section-id>` backlink. Section ids follow the first `glossary.html#term-...` link in `build/sec-*.html`.
- Already existed (backlink only added, definitions untouched): `agent` (#claim), `tool-calling` (#right),
  `harness` (#right), `mcp` (#agent), `reasoning-model` (#absolutes), `test-time-compute` (#absolutes),
  `prompt-injection` (#failure), `capex` (#money).
- Caveats: `expert-system` has no [Sn] (RESEARCH section 3.3 gives it as dossier analysis, flagged in the text);
  `iec-62443`, `sis`, `iso-42001`, `nist-ai-rmf` rest on S34-S36 which RESEARCH marks "not re-read" (stated in the entries);
  `swe-bench` percentages for OpenAI's withdrawal are "reported, not read" (S23/S24); `agent-washing` wording beyond the Gartner headline is UNVERIFIED.
- `build-explain-db.py --apply` -> 449 glossary + 564 curated = 994 entries; `test-explain-db.mjs` -> 10 passed, 0 failed.
