# P-series close-out program — every open item, one plan (2026-11-14)

**Owner:** calc/product session (P1–P26, X2, X3, X5, X9). LTC owns the Q rows and index.html.
**Why this file exists:** the owner, 2026-11-14: "create comprehensive plan prd, for all, then implement, biar nggak
setengah2". PROGRAM-P.md planned the waves; this file closes them. Nothing here is marked done without the evidence
named in its "Proof" column, and nothing is left silently half-built: every item ends VERIFIED COMPLETE, or BLOCKED
with the exact question for the owner or the peer.

**Release discipline (unchanged):** full gate (`ship-gate.sh --probe`, two shards) green or every red proven
pre-existing on a clean `origin/main` worktree → push fast-forward → live `rz-version` + byte-compare of every
changed deployable file → TRACKER row with SHA → standards docs + CHANGELOG in the same release. One release
number at a time; LTC and this session alternate and announce by message.

## 1. Inventory (measured 2026-11-14 on `b3844e79c`)

| # | Item | State before this plan | Remaining scope |
|---|---|---|---|
| 1 | Calc registry `dependsOnInputs` (LTC FYI) | **DONE — v3.57.0 LIVE `5876563c6`**, 303/303 byte-equal | — |
| 2 | P22 render scale gate | built, gates green (E1–E5) — ships v3.61.0 | — |
| 3 | P20 part A article embeds | built, gates green (A0–A10) — ships v3.61.0 | — |
| 4 | FR-P13-5 project → spares | built, gates green (C4, H6–H8; 12 red first) — ships v3.61.0 | — |
| 5 | P06 amendment C3 (Tier 3 intake) | built, gates green (U5–U6, E4–E6; 8+1 red first, unlock law mutation-proven) — ships v3.61.0 | — |
| 6 | P09 datahallAI per-tab modules | 1,371,798 B, 9 inline blocks, 1,189,212 chars, top block 916,176 (`RZDefer` defers execution, not download) | FR-P09-1…7 |
| 7 | P05 stage 2 (Conventional replay) | planned; depends on LTC Q7 (cockpits do not use `sim-telemetry.js`) | ask LTC; build when Q7 lands |
| 8 | X5 (tier/tia random bands) | closed by P08: 0 `Math.random` on tier-advisor / tia-942-checklist, covered by `test-seeded-uncertainty.mjs` | record in TRACKER only |
| 9 | Row 0b QA review, row 0c cross-PRD review | DONE: 0b (`05-test-evidence/0b-qa-review.md`, 76 criteria, gaps closed red-first), 0c (13 seams gated) | — |
| 10 | Wave 6 (W6-1…W6-4) | DONE: journey 19, responsive 760, console 157 pages, final audit `09-final-audit.md` | — |
| 11 | Owner-blocked: P24, P01 S2 / P06 S2 / P15B / P18 (SQL), P19B, P20B, P21 S2, P26B, O-P11 tariffs, O-PAT revoke | BLOCKED | one consolidated ask list (§4) — not built without a yes |

## 2. Laws per item (each checkable; red before green)

### 2.1 v3.57.0 — dependencies measured past rounding (item 1)
- L1 `test-calc-parameter-registry` S6: a quotient cell depends on every input of the cell it divides minus the
  divisor. RED on the v3.54 registry (`per_kw` missed Region, fuel autonomy, both fire inputs) → GREEN.
- L2 no record loses a measured input versus v3.56 (diff printed in the commit).
- L3 the per-kW cell is never clipped: 390 px scrollWidth = clientWidth (was 118 > 112).
- **Proof:** registry gate 39/39, responsive/legibility/a11y strict CLEAN, tool register green, full gate, live.

### 2.2 P22 — render scale gate (item 2)
- L1 `data/design-scale.json` is generated from the tokens design.md names, not typed twice (schema + freshness check).
- L2 fixture with exactly 3 planted off-scale values (13.37 px font, 7 px gap, 11 px radius) reports exactly 3; the
  on-scale twin reports 0.
- L3 walker ignores invisible boxes, SVG internals, icon fonts, third-party iframes (fixture rows for each).
- L4 baseline frozen per page in `tools/editorial-render-ratchet.json` only after 5 representative pages are reviewed by
  hand for false positives (memory: render-audit false positives); the review is written into the file header.
- L5 ratchet: adding one off-scale element to any page fails the gate (planted on a real page in a scratch copy).
- L6 runtime measured and printed; shards if > 10 min.

### 2.3 P20 part A — article embeds (item 3)
- L1 `?embed=article` on all 11 calculators renders only `[data-rz-embed-keep]` inputs + headline result + "Open full
  calculator": no nav, footer, cookie banner, palette, pill (counted in the gate per page).
- L2 auto-height: iframe height = content height ±2 px at 360 / 768 / 1280, no inner scrollbar.
- L3 changing an input inside the embed changes the result inside the embed.
- L4 "Open full calculator" is a P02 link carrying the embed's current inputs; the full page opens with them.
- L5 cross-origin parent fixture: the page breaks out to the full calculator and posts no message; the parent
  script ignores a message from another origin (both planted).
- L6 no size message in 8 s → fallback link with the sentence from the PRD (planted dead frame).
- L7 3 article adoptions chosen by measurement (articles that already link a calculator), reserved min-height, CLS
  measured ≤ 0.02 on each; screenshots at 390/1366 both themes looked at.

### 2.4 FR-P13-5 — project → spares (item 4)
- L1 opening spares from a P01 project fills country and tier through the same contract transforms
  (`js/rz-handoff.js`), field-map gate extended; RED before the adapter exists.
- L2 out-of-range or unknown values are refused by the receiver (existing range checks) — one planted case.

### 2.5 P06 C3 — intake follows the active Cx tier (item 5)
- L1 no Tier 3 set active → intake writes Tier 1 `RZCxIssues` (current behaviour, kept).
- L2 Tier 3 set active → intake writes Tier 3 `issues` through `RZCxWorkspace.write` (rules R1–R13 apply).
- L3 Demo set active → refused, nothing written. Each law RED before the change.

### 2.6 P09 — datahallAI loads per tab (item 6) — announced to LTC before each stage
- L1 FR-P09-1 global map report exists before any move: every top-level name each inline block defines and reads.
- L2 `tab-loader.js` `ensureTab(id)`: single flight, retry after failure, `rz:tab-ready` event (unit + E2E).
- L3 stage 1 moves the 3 heaviest builders; stage 2 the rest + their modals. After each stage, every datahallAI gate
  green with UNCHANGED counts (coverage strict, inspector runtime strict-rule2, fire runtime, basis hooks, replay,
  authority, operator, legibility/geometry monitors).
- L4 HTML bytes and mobile LCP measured by a controlled A/B (same machine, multi-threaded server, Lighthouse mobile,
  median of 5); results reported as measured, not rounded to the target.
- L5 first tab switch cold ≤ 1 s desktop, measured; skeleton + error state shown (planted failed module).

### 2.7 P05 stage 2 (item 7)
- L0 ask LTC for Q7 status (cockpit telemetry seam). If Q7 is not shipped, the row is BLOCKED with that reason; the
  stage-1 replay core is already page-agnostic, so stage 2 is a provider binding, not a rewrite.

### 2.8 Reviews and Wave 6 (items 9, 10)
- 0b QA review: each shipped P PRD's acceptance criteria re-run against live code; findings filed as rows, fixed
  or BLOCKED.
- 0c cross-PRD review: the shared seams (calculators.json, rz-scenario, rz-project, rz-handoff, rz-embed-compute,
  calc registry, sim-telemetry provider) each have one owner and one gate; any seam without a gate gets one.
- W6-1 one E2E journey: project → capex → roi → compare → pack → share link → offline reopen (all in one test).
- W6-2 responsive sweep 360/390/768/1280/1440 × 2 themes on every surface added by P01–P26.
- W6-3 0 pageerror on every touched page.
- W6-4 independent audit file `05-test-evidence/09-final-audit.md`, written from the PRDs, not from this plan.

## 3. Order and releases

| Release | Items | Shared files (announce) |
|---|---|---|
| v3.57.0 | 1 — LIVE `5876563c6` | css/rz-tool.css (67 pages, token only for theirs) |
| v3.58.0 | LTC (R125 PUE Measured, R126 employer card) | — |
| v3.61.0 | 2 + 3 + 4 + 5 (P22 ratchet, P20 A, FR-P13-5, P06 C3) — one gate cycle | ship-gate.sh, 3 article pages, 9 calculator pages, spares, cx-calculator scripts |
| v3.61.0 / v3.62.0 | 6 stage 1 / stage 2 (P09) | datahallAI.html (LTC Q6/Q7) |
| v3.63.0 | 9 + 10 fixes from reviews and Wave 6 | as found |
| when Q7 lands | 7 | Conventional cockpits (LTC) |

Numbers are taken in turn with LTC; if LTC takes one in between, these shift.

## 4. Owner decisions — one consolidated list (nothing below is built without a yes)

| Id | Question | Default if you say "yg terbaik" |
|---|---|---|
| O-PAT | Revoke the GitHub token pasted in chat on 2026-11-05 (GitHub → Settings → Developer settings → tokens) | — (only you can) |
| O-P11 | 14/14 countries: DATA.electricityTariffs ≠ DATA.countries (ID 0.082 vs 0.09, US 0.079 vs 0.13). Adopt the cited table for both? It moves DCMOC financials | adopt the cited values, record the shift in CHANGELOG |
| P24 | Timeline: preview + Apply, or direct + undo; 24 or 30 fps | direct + undo, 30 fps |
| SQL bundle | Apply `supabase/migrations/2026-11-product-transformation.sql` (unlocks P01 S2, P06 S2, P15B, P18) | you apply in Supabase; I verify read-only |
| P18 | Student/team records (personal data of other people) | keep out until a privacy note is approved |
| P19B | Publish RZEngine as a public npm package | no |
| P20B | Allow third-party sites to frame the calculators | no |
| P21 S2 | LLM answers on "Ask" (key, cost, model) | no |
| P26B | Scheduled external fetch for data freshness | no |

## 5. Done means
Every row of §1 is VERIFIED COMPLETE with SHA + gate line + live check in TRACKER, or BLOCKED naming the person and
the question. This file is updated in the same commit as each TRACKER row.
