# Commission Regulation (EU) No 548/2014 — transformer loss limits (ecodesign)

Source: https://eur-lex.europa.eu/eli/reg/2014/548/oj/eng (Official Journal L 152, 22.5.2014), Annex I.
Fetched 2026-11-22 (text reader https://r.jina.ai/ over the EUR-Lex ELI page). Free to read.
Used by js/conv-engine.js 2.6.0 (`electrical.dist_tx_p0_w`, `dist_tx_pk_w`, `hv_tx_pei_min`) and checked against this
file by tools/test-conv-internals-p4.mjs (EL0s). Rows are quoted verbatim; the columns are
Tier 1 (1 July 2015) Pk / P0, then Tier 2 (1 July 2021) Pk / P0, in W.

Applicability: one winding Um ≤ 24 kV (20 kV system) and the other Um ≤ 1.1 kV (400 V), so Table I.3 adds no correction.

## Table I.1 — three-phase liquid-immersed medium power transformers (Um ≤ 24 kV / ≤ 1.1 kV)

| rated kVA | Tier 1 Pk | Tier 1 P0 | Tier 2 Pk | Tier 2 P0 |
|---|---|---|---|---|
| 3 150 | B k (27 500) | A o (2 200) | A k (23 000) | A o – 10 % (1 980) |

## Table I.2 — three-phase dry-type medium power transformers (Um ≤ 24 kV / ≤ 1.1 kV)

| rated kVA | Tier 1 Pk | Tier 1 P0 | Tier 2 Pk | Tier 2 P0 |
|---|---|---|---|---|
| 3 150 | A k (22 000) | A o (3 800) | A k (22 000) | A o – 10 % (3 420) |

## Table I.7 — minimum Peak Efficiency Index, liquid-immersed large power transformers

| rated MVA | Tier 1 PEI % | Tier 2 PEI % |
|---|---|---|
| 63 | 99,709 | 99,745 |

The Tier 2 values are regulatory MAXIMA (losses) and a MINIMUM (PEI): a loss computed from them is an upper bound and
the cockpit labels it "≤ EU Tier 2". The site's distribution transformer type is ASSUMED dry-type (engine
`dist_tx_type`), so Table I.2 applies.
