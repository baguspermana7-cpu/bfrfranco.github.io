# Notes: sections 9-16 (words are visible text, tags and chart JSON excluded)

| File | Words | [Sn] cited | Figures | Calculators | Chart |
|---|---|---|---|---|---|
| sec-09 | 959 | 4, 24, 27, 52, 53, 54, 55, 57, 73 | none | none | gpt-oss SWE-bench by effort |
| sec-10 | 1193 | 3, 4, 10, 13, 23, 24, 34-39, 56, 60 | llm-d9 | lora | GGUF size, Llama 3.1 8B |
| sec-11 | 730 | 3, 4, 23, 24, 26, 40, 52, 55 | none | none | none |
| sec-12 | 1322 | 1, 8, 9, 12, 13, 15, 18, 27, 30, 31, 32, 39, 44, 63, 66, 70, 71 | llm-d6, llm-d10 | serve | $/M tokens by batch |
| sec-13 | 1274 | 2, 8-17, 19-21, 60, 65, 68, 70, 71, 75 | llm-d7 | none (links #kv-cache, #training) | power per system |
| sec-14 | 1158 | 4, 22, 24-28, 42, 43, 58, 61, 62 | llm-d8 | none | none |
| sec-15 | 932 | 3, 4, 18, 22, 24-29, 41, 57, 64-67 | none | none | none (table) |
| sec-16 | 660 | 1, 2, 4-10, 18, 22, 27, 30, 34, 35, 38, 39, 54, 60, 61, 64-66, 68, 70 | none | none (links #kv-cache) | none |

H2 ids: post-training, smaller, uncensored, serving, hardware, agents, frontier, checklist. No duplicate ids across sec-01..16.

## Dropped or kept as unverified
- R1-Distill 800k samples: written as "reported, unverified".
- B200 ridge point (sparse/dense unknown): omitted from the ridge table, stated as unverified.
- Vera Rubin NVL144: one sentence, labelled unverified [S75].
- Colossus beyond 200k GPUs, Cerebras 250 PF (reported with unknown basis), EU AI Act date (told to check the text), RTX 4090 bandwidth (secondary), 50-80% engine efficiency and 10-20% overhead (rules of thumb), $3.50/GPU-h and PUE 1.2 (assumed): all labelled in text.
- Dropped: capex per rack/GPU/campus, Apple silicon newer than M4 Max/M3 Ultra, GAIA current scores, SWE-bench scores above 79.2%, laptop wattage (unsourced).
- "Classic rack 4-8 kW" kept only as "rule of thumb, not sourced here".
- Section 11 uses non-glossary term "residual stream" unlinked; no procedure, code or model links.
- Placeholders assume the earlier sections' ids #kv-cache and #training (both exist in sec-04/sec-08).
