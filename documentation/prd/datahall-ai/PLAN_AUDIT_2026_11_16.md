# datahallAI — total audit and execution plan (rev 2, 2026-11-16, tree at v3.63.2 candidate)

Owner: "Buat detail planning nya dan audit total, nanti yang kerjakan eksekusi itu Opus or Ark" → "Sempurnakan planningnya".
Scope: `datahallAI.html`, `js/datahall-ai/*`, `js/rz-hmi-sheet.js`, `css/rz-hmi.css`, and the shared auth path the page
depends on (`auth.js`, `js/rz-feature-flags.js`, `js/rz-supabase.js`).
Destination in the repo: `documentation/prd/datahall-ai/PLAN_AUDIT_2026_11_16.md` (committed with v3.63.2).

## 0. State and measured facts

| Fact | Value | How measured |
|---|---|---|
| Live | v3.63.1 `e22231516` | `curl` rz-version + tokens |
| Candidate | v3.63.2, sharded gate (lanes 3, 4) | A1 red on v3.63.1, A1 + A2 green, A2 red under mutation |
| Page weight | 1,371,834 B raw / 377,500 B gzip | `wc -c`, `gzip -c` |
| Inline script | 1,192,219 B in 9 blocks; two blocks carry 97 % (line 1575: 919 KB, line 12808: 239 KB) | python regex over the file |
| External scripts | 45, all same-origin | grep |
| L3 schematics (H3) | 21 / 45 drawn; 9 thin (< 8 symbols); **15 missing** | gate `test-dh-drawings` H3 line |
| Pages using `_rzAuth.enforceTierFeatureAccess` | 64 | grep |
| Pages reading `rz_premium_session` inline | 101 | grep |
| Sloplint (static) | page: 820 FAIL / 234 REFLEX; `rz-hmi.css`: 4 / 13 | hallmark `sloplint.mjs --scope app` |

Correction to rev 1: 15 classes are missing an L3 schematic (not 24); 9 more are drawn but thin.

## 1. Executors

| | **Opus** (main session, Anthropic) | **Ark** (subagent, BytePlus `glm-5.2[1m]`) |
|---|---|---|
| Decides | laws, security, physics, cross-file design, what ships | nothing |
| Writes | laws first; C3, S1, S2 code; specs; standards docs; CHANGELOG; release | code for one task card (≤ 2 source files), bulk data from a named source |
| Proves | red on the old tree, green on the new, mutation where a law could be weak; gates; live check | the one command its card names, output quoted |
| Git | add / commit / push | none (no add, rm, commit, stash) |
| Browser | `rz-lane -l 3|4` only | none — Node-only checks; Opus runs browser laws |
| Never | hands a decision to Ark | touches auth, secrets, standards docs, peer files, version, tokens |

### 1a. Ark task card (the only brief format)

```
TASK <id> — <one line>
Tree: the release worktree (no git commands, no browser, no gate runs)
Files you may edit: <path>, <path>            (max 2)
Read first: <file:line ranges>                 (not whole files)
Defect: <what is wrong, file:line>
Required behaviour: <exact, checkable>
Constraints: ES5 only (no let/const/arrow/template/Object.assign), match surrounding style, no unrelated edits
Check you must run: <one node command> → expected output
Return: unified diff + the command output. Nothing else.
```

### 1b. Efficiency rules (token and heat budget)

- One card = one concern. Cards that touch the same file run in sequence, different files in parallel (max 2 agents).
- Opus sends line ranges, never asks Ark to explore. An Ark task that needs exploring is not ready: Opus finishes the
  spec first.
- Ark output is a diff; Opus applies judgement by reading the diff, then runs the law. No second Ark round on the same
  card: a wrong diff is fixed by Opus (cheaper than re-briefing).
- Browser laws batched: one `test-dh-drawings` run per wave candidate, not per card.
- Full sharded gate once per release; while it runs, only read-only work (next wave's laws drafted in scratch, not in
  the tree).
- Thermal: lanes pause at 92 °C; never a third browser.

## 2. Audit total — findings (each re-proved at file:line; subagent claims checked before listing)

### 2a. Security

| # | Sev | Finding | Evidence | Wave | By |
|---|---|---|---|---|---|
| S1 | **HIGH** | A forged `rz_premium_session` `{role:"root"}` opens tier-gated pages: `getSession()` returns the stored role, `enforceTierFeatureAccess` unlocks on `role === 'root'`, `syncServerRole` re-checks only pro/educator and skips `v2:true`. Site-wide: 64 pages through `_rzAuth`, 101 pages read the key inline. | `auth.js:446-460`, `:267-270`, `:1040-1050`, `:1162-1165` | W2 | Opus |
| S2 | MEDIUM | Supabase client from jsDelivr `+esm`, no integrity: a CDN compromise reads the auth token. | `js/rz-supabase.js:20` | W2 | Opus |
| S3 | LOW | Replay parser throws on a column named `__proto__` / `constructor` (plain `{}` maps); no global pollution. | `replay-core.js:106,167,177,182`; `replay-ui.js:144,186` | W1 | Ark |
| S4 | LOW | Tooltips parse `data-tip` as HTML; only page-written text reaches it today. | `datahallAI.html:4994`, `:12184` | W1 | Ark |
| S5 | LOW | Demo password in the offline fallback list (demo tier cannot open this page). | `auth.js:367` | W2 | owner decides |
| S0 | fixed | Inline gate unlocked from localStorage when auth.js was not loaded. | A1 red v3.63.1 → green | v3.63.2 | — |

Stated limit (not a finding to "fix" client-side): the page is static HTML, so its content is downloadable whatever the
gate does. The gate is a paywall. Paid data needs server-side delivery (Supabase RLS / edge function) — owner decision D3.

Traced safe: replay file text, fire isolation register (strict load, fails closed), no URL / postMessage inputs, all
script `src` same-origin, no keys in scope, CSV export blocks spreadsheet formulas.

### 2b. Correctness

| # | Sev | Finding | Evidence | Wave | By |
|---|---|---|---|---|---|
| C1 | **HIGH** | Every sheet render adds `pointermove` + `pointerup` on `window`; `destroy()` never removes them → each modal open keeps a whole drawing alive. | `rz-hmi-sheet.js:312,318` (`root` = window), `destroy` | W1 | Ark |
| C2 | MEDIUM | "Clear register" restarts the isolation sequence at 1000 → the next record id repeats and the Alarms workspace drops it. | `fire-points.js:247,281`; `fire-workstation.js:259` | W1 | Ark |
| C3 | MEDIUM | Items on a hall SLD resolve to hall 1: inspector matches `^elecDH(\d)Svg$` but the sheet is `hmiElecDH<n>Svg`; `read()` builds one context with hall 1 for every sheet. | `equipment-inspector.js:33-34`; `hmi-v2.js:128,405` | W1 | Opus |
| C4 | MEDIUM | Fire point table key `hall|filters|length` reuses rows for a different point set of equal size. | `fire-workstation.js:183` | W1 | Ark |
| C5 | MEDIUM | Compute / NVSwitch tray items open tray 1 (`tier2('rack',['ct'])` carries no tray number). | `hmi-payloads.js:503-527` | W1 | Ark |
| C6 | LOW | CDU trend built with `tick: undefined` → flat line; `openCdu` pads `'07'` where sheets use `'7'` (path not used on this page). | `hmi-v2.js:563,631`; `hmi-payloads.js:1267` | W1 | Ark |
| C7 | LOW | 250 ms tooltip timer survives modal close. | `rz-hmi-sheet.js:335` | W1 (with C1) | Ark |
| C8 | LOW | Isolation reason has no length cap; > 4096 chars → record never reaches Alarms and is marked seen. | `datahallAI.html:1444`; `fire-points.js:339`; `alarm-query.js:381` | W1 | Ark |
| C9 | LOW | `'DH-0' + hall` breaks at ≥ 10 halls (39 places). | `hmi-payloads.js` | W1 | Ark |
| C10 | LOW | `Object.assign` in ES5 code. | `fire-workstation.js:507` | W1 | Ark |

### 2c. UI

| # | Sev | Finding | Evidence | Wave | By |
|---|---|---|---|---|---|
| U1 | MEDIUM | 17 `<svg>` without `aria-label` / `aria-hidden`. | sloplint 33, e.g. `datahallAI.html:1043` | W3 | Ark |
| U2 | LOW | Width transition on the SLD results panel. | `datahallAI.html:517` | W3 | Ark |
| U3 | LOW | `width:100vw` on the BoD drawer ≤ 600 px. | `datahallAI.html:752` | W3 | Ark |
| U4 | LOW | 4 eyebrows above headings. | `datahallAI.html:911,1209,1248,1278` | W3 | owner D1 |
| U5 | LOW | Off-scale spacing (203), pure `#fff` (11) in page CSS; 718 literal colours are mostly SVG strings in script. | sloplint 24b / 7a / 48 | W3 CSS only | Ark |
| U6 | INFO | `rz-hmi.css` uppercase names and mono tags follow ISA-101 (`HMI_DRAWING_STANDARD.md`). | sloplint 67 / 64 | W3 waiver in the standard | Opus |
| — | false | sloplint 38i "italic in h4": the `<i>` is a colour dot. | `datahallAI.html:979` | none | — |

### 2d. SEO / performance

| # | Sev | Finding | Evidence | Wave | By |
|---|---|---|---|---|---|
| E1 | MEDIUM | 1.19 MB inline script parsed before paint; CWV ledger row 8 OPEN. | §0 | W5 | Opus design, Ark moves |
| E2 | LOW | Title 77 chars. | `audit-seo.py --file datahallAI.html` | W5 | Ark |
| E3 | LOW | 3 `<h1>`. | grep | W5 | Ark |

### 2e. Product coverage

Missing L3 (15): `leak`, `fws-piping`, `fire-zone` (H3 does not yet count the v3.63.0 modal — check the law first),
`sld-main-tx`, `site-genset-yard`, `net-wan`, `net-zone`, `fire-facp`, `fire-point`, `fire-vesda`, `fire-mcp`,
`fire-epo`, `fire-cylinder-bank`, `bms-app`, `bms-field`.
Thin (9): `rack-ns` 3, `net-core` 5, `net-spine` 6, `net-leaf` 6, `bms-server` 4, `bms-network` 7, `bms-ldc` 3,
`bms-controller` 5, `bms-gateway` 4.
Also open: R135 commissioning scenarios (PRD written, nothing built); O6; legacy hSvg view; building isometric.

## 3. Waves

Order: W0 → W1 → W2 → W3 → W4 → W5 → W6. A HIGH found mid-wave preempts it.

| Wave | Release | Fixes | Depends on | Size |
|---|---|---|---|---|
| W0 | v3.63.2 | S0 + this plan + honest CHANGELOG (S1 named as open) | gate green | shipped 2d8d4a935 |
| W1 | v3.63.3 | C1–C10, S3, S4 | W0 pushed | shipped 34039abfb (laws L1–L5, L7, L9; C6 and the mimic by reading) |
| W2 | v3.64.0 | S1 for root and educator (Z1–Z3). Open: Pro tier from the record, S2, S5, inline gates of dc-conventional and the LTC modelling lab | W1 | Opus only, 1 gate |
| W3 | v3.64.1 | U1–U6 | D1 | 4 cards, 1 gate |
| W4 | v3.65.0–.2 | 15 missing + 9 thin L3 | W1 (C1 leak multiplies with more modals) | 3 batches, 3 gates |
| W5 | v3.66.0 | E1–E3 | W4 (moves the code W4 edits) | 1 design + ~6 cards |
| W6 | v3.67–3.70 | R135 phases C0–C5 | W4 sheets accepted (owner rule) | per PRD |

### W1 — task cards

Laws go into `tools/test-dh-drawings.mjs` (browser) or a Node test; Opus writes each, proves it red on v3.63.2, then
issues the card.

| Card | Fix | Files (edit) | Law, red first | Parallel group |
|---|---|---|---|---|
| W1-1 | C1 + C7: named handlers, removed in `destroy()`; clear `tipTimer`; tooltip only if svg connected | `js/rz-hmi-sheet.js` | **L1** open/close chiller modal 20 × → window pointermove listener count unchanged (CDP `DOMDebugger.getEventListeners`); no `.hmi-tip` visible 400 ms after Escape | A |
| W1-2 | C2: `createRegister(seq)` keeps the counter on clear | `fire-points.js`, `fire-workstation.js` | **L2** (Node + browser) isolate → clear → isolate: two distinct ids, both in Alarms | B |
| W1-3 | C4: rows key = joined point ids | `fire-workstation.js` | **L4** filter "alarm", run Z05 → Z06: rows = Z06 ids | B (after W1-2, same file) |
| W1-4 | C8: `maxlength`, cap in `fire-points.js`, mark seen after append succeeds | `datahallAI.html`, `fire-points.js` | **L7** 4,000-char reason still yields an Alarms record | B (after W1-3) |
| W1-5 | C10: `for…in` copy helper | `fire-workstation.js` | Node: acorn ES5 + no `Object.assign` in `js/datahall-ai` | B (after W1-4) |
| W1-6 | C5: tray number parsed from the id into `tier2('rack',['ct',n])` / `['ns',n]` | `hmi-payloads.js` | **L5** click CT-14 → modal title CT-14 | C |
| W1-7 | C9: `pad2(hall)` in the 39 places | `hmi-payloads.js` | Node: hall 12 label "DH-12", id `dh12` | C (after W1-6) |
| W1-8 | C6: finite tick fallback, id normalised | `hmi-v2.js` | **L6** CDU trend ≥ 2 distinct values in 48 points | D (after Opus C3, same file) |
| W1-9 | S3: `Object.create(null)` maps | `replay-core.js`, `replay-ui.js` | **L8** Node: CSV with a `__proto__` column parses | E |
| W1-10 | S4: `textContent` / escaped fields for both tooltips | `datahallAI.html` | **L9** `data-tip` with `<img onerror>` renders as text | F (after W1-4, same file) |
| W1-C3 | C3 (Opus): `data-rz-hall` on the host in `mount()`, `hallOf` `\d+`, per-hall context in `read()` and in the memo key | `hmi-v2.js`, `equipment-inspector.js` | **L3** MSB on DH-03 SLD → inspector title DH-03, value ≠ DH-01's | Opus first |

Exit: L1–L9 green, each quoted red on v3.63.2; `test-dh-drawings`, `test-dh-operator`, `test-dcai-coverage`,
fire runtime, payload and fire-points Node tests green; sharded gate; screenshots 1440 / 390 of the DH-03 inspector,
CT-14 modal, alarm table after a zone change; `HMI_DRAWING_STANDARD.md` §laws updated.
Rollback: per-card diff; a card whose law stays red is dropped from the release, not patched under the gate.

### W2 — auth hardening (Opus, site-wide)

Design (decided here, so it is not re-derived):
1. `rz_premium_session` becomes a display hint. `enforceTierFeatureAccess` and `featureAllows` take the role from a
   verified source: the Supabase session (`supa.auth.getSession()`), then `resolveServerRole` / `is_educator()` and the
   profile tier. No Supabase token → role is at most `free`/`demo`, whatever the record says.
2. `root`: the email of the **verified** Supabase user must be in the server-side root set (`is_root()` RPC or a
   `role` claim) — never `session.role`, never an email string from localStorage.
3. `syncServerRole`: remove the `s.v2` skip; `root` is re-checked too.
4. Pages stay `locked` until the verified answer arrives (the v3.63.2 rule, now for every gated page); a 2 s timeout
   keeps the lock and shows the sign-in card — never an optimistic unlock.
5. Offline fallback (`VALID_USERS`): decision D2 — remove, or keep demo-only with no access above `demo`.
6. S2: vendor `@supabase/supabase-js@2.110.2` into `js/vendor/` (sha256 recorded in the standard), import locally.

Laws (new `tools/test-auth-forgery.mjs`, wired into `ship-gate.sh`):
- **Z1** forged `{role:"root"}`, auth.js loaded, no Supabase token → locked on datahallAI, dc-conventional, DCMOC entry,
  one LTC lab, rz-ops, one incident page (sample of the 64, one per page family).
- **Z2** forged `{role:"educator", v2:true}` → locked / downgraded.
- **Z3** verified root, Pro and Educator (Supabase stub) open exactly their matrix rows; Free and Demo do not.
- **Z4** no script or module from a third-party origin without a local copy or SRI (static scan of all pages).
- **Z5** `window._rzAuth.enforceTierFeatureAccess = () => true` from the console does not unlock a locked page
  (the gate re-derives; frozen API object).
Risk: every gated page and every existing probe (`probe-educator-access`, `test-rz-ops-access`, 101 inline readers).
Mitigation: Z3 covers the legitimate paths first (red if a real user gets locked out); the 101 inline readers are
inventoried by one Ark read-only card (page → what it gates → uses `_rzAuth`?) before any edit; peer told before the
branch is cut; released alone, nothing else in v3.64.0.
Rollback: revert the single release commit (auth.js + vendor + gate), `sw.js` bump forward.

### W3 — UI (after D1)

| Card | Fix | Files | Law |
|---|---|---|---|
| W3-1 | U1: `role="img"` + `aria-label` on drawings, `aria-hidden` on decoration | `datahallAI.html` | sloplint 33 = 0; axe CLEAN 1440 + 390, both themes |
| W3-2 | U2 + U3: transform/opacity instead of width; `width:100%` | `datahallAI.html` | sloplint 10a, 34 = 0; BoD drawer at 390: `scrollWidth ≤ innerWidth` |
| W3-3 | U5: page CSS spacing to the 4 px scale, `#fff` → token (CSS blocks only, no SVG strings) | `datahallAI.html` | sloplint 24b, 7a counts fall, recorded as a ratchet; screenshots pixel-compared at 1440 / 390 (≤ 1 % diff) |
| W3-4 | U6 (Opus): waiver text in `HMI_DRAWING_STANDARD.md`; U4 per D1 | standard, page | — |

### W4 — L3 schematics (3 releases)

Per class, Opus writes a 10-line spec from the engine inventory and `PRD_DATAHALL_DRAWINGS.md`: items, tags, which
payload rows feed which node, symbols from the 79-kind library. Ark drafts the builder in `hmi-sheets.js` (one class
family per card, sequential — same file). Opus reviews against engineering truth, registers in `BUILDERS`, wires the
opener, runs laws.

| Batch | Classes | Release |
|---|---|---|
| A fire | `fire-facp`, `fire-point`, `fire-vesda`, `fire-mcp`, `fire-epo`, `fire-cylinder-bank`; `fire-zone` counted by H3 | v3.65.0 |
| B power / network | `sld-main-tx`, `site-genset-yard`, `net-wan`, `net-zone`; thin `net-core`, `net-spine`, `net-leaf` | v3.65.1 |
| C BMS / cooling / rack | `bms-app`, `bms-field`, `leak`, `fws-piping`; thin `bms-*` (5), `rack-ns` | v3.65.2 |

Laws per class (extend H3 from "reported" to blocking for the classes shipped): ≥ 8 symbols; every tag exists in the
engine inventory; every value node has a payload row (no invented value — O2); opens from sheet, inspector and finder;
one modal at 390 without page overflow; text ≥ 8.5 px. Exit of W4: H3 = 45 / 45, 0 thin, law blocking.

### W5 — weight

Opus: split map for the two blocks (919 KB at line 1575, 239 KB at line 12808) into deferred files under
`js/datahall-ai/page/`, ordered by first-paint need; inline keeps only the gate, theme and first-tab bootstrap.
Ark: mechanical moves, one block region per card, byte-identical function bodies.
Laws: controlled A/B on one harness (390, 4× CPU, Slow-4G; LCP, TBT, longest task) old vs new, three runs each, median
reported; every dc-ai gate unchanged; `test-asset-cache-tokens` covers the new files; no global lost (list of
`window.*` names before = after). Target: inline script < 200 KB, TBT − 30 % or the wave is not shipped.
E2 / E3: title ≤ 60 chars, one `<h1>`; `audit-seo.py --file` clean; SEO ledger row 8 and 96 updated.

### W6 — R135 commissioning scenarios

Per `PRD_CX_SCENARIOS.md` phases C0–C5 (laws C1–C10 there). Split:
- Opus: schema validator, `rz-cx-sim.js` (electrical staging, UPS SoC, first-order thermal, calibration so S01
  reproduces the handbook record ± 0.3 K), engine additions with the rebuild chain, console design, painting hooks.
- Ark: the 31 scenario JSON files transcribed from handbook §28 (law C2 parity re-computes every number from the source,
  so a transcription error fails the gate), bindings JSON, console CSS.
Starts only after the W4 sheets are accepted by the owner.

## 4. Owner decisions (defaults applied if no answer)

| # | Question | Default |
|---|---|---|
| D1 | Keep the 4 section eyebrows on datahallAI? | cut 3, keep the "Public brief" line as plain text |
| D2 | Offline `VALID_USERS` fallback + demo password in `auth.js` | remove the fallback; demo signs in through Supabase |
| D3 | Paid content delivered server-side (real boundary) | not in this plan; recorded as a known limit |

## 5. Not mine

- `dc-conventional.html` inline `readSessionDirect()` unlock (peer page) — told; W2 closes the root cause anyway.
- `test-conv-geometry` hangs in the combined gate (detached Frame); per page 6 / 6 — peer.

## 6. Definition of done, every wave

1. Each law quoted red on the previous tree and green on the new one (mutation where a law could not fail).
2. Sharded gate green; the one known peer hang named, run per page.
3. Standard doc + CHANGELOG in the same release; version and `sw.js` up; tokens fixed only for changed assets.
4. Screenshots 1440 and 390 looked at, sent.
5. Pushed; deploy success; live `RZ_VERSION` and changed-asset tokens match the repo; ledger row written.
6. A law not proven is reported first, never rounded up.
