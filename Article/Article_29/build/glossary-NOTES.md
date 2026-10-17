# Article 29 glossary notes

- Added 57 terms to `glossary.html` (360 -> 417 `id="term-"`), each inserted at the end of its letter section
  (existing order within sections is not strictly alphabetical; new terms are alphabetical among themselves).
- Each has a plain definition, a mechanism/number sentence with [Sn] tags from RESEARCH.md, and an
  `article-29.html#<section-id>` backlink.
- Already existed: `rag` (kept; added an Article 29 backlink to `#agents` only).
- Near-duplicates left intact and cross-linked: `knowledge-distillation` (new `distillation`), `dlc`
  (new `direct-liquid-cooling`, named "Direct Liquid Cooling for AI Racks" to avoid an alias collision).
- Section anchors used: answer, tokens, block, kv-cache, moe, sampling, families, training, post-training,
  smaller, uncensored, serving, hardware, agents, frontier. Verify they exist in the assembled article-29.html.
- No new explain-extra entries were needed. `build-explain-db.py --apply` -> 417 glossary + 518 curated = 916;
  `test-explain-db.mjs` -> 10 passed, 0 failed.
