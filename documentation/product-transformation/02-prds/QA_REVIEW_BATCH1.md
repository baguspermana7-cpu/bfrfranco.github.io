# QA review, batch 1: PRD-Q01, Q03, Q04, Q06, Q07

Reviewer: independent QA agent (did not write these PRDs). Date 2026-11-11. Tree: `wt-hub3` at `4c6872ce4`.
Rule applied: every one of the 12 dimensions must score at least 4, and a critical deficiency fails the PRD even when the
average is high. Scores are 0–5. Every code check below was run on this tree with the command shown. Nothing in the repo was
changed except this file.

## Summary

| PRD | Compl. | Feas. | Func. clarity | Journey | UI/UX | Data model | API | Cross-module | Errors | Security | Testability | Impl. ready | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q01 relation file | 5 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | **3** | 4 | **FAIL** (testability) |
| Q03 reproduce in a calculator | 5 | 4 | 4 | 5 | 5 | 5 | **3** | 4 | 4 | 4 | 4 | 4 | **FAIL** (API contract) |
| Q04 one engine path per metric | 5 | 4 | 5 | 4 | 4 | 5 | 5 | **3** | 5 | 4 | 4 | 4 | **FAIL** (cross-module) |
| Q06 simulation honesty layer | 5 | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 4 | 5 | 4 | PASS |
| Q07 scripted fault scenarios | 5 | 4 | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **3** | 4 | 4 | **FAIL** (security/privacy) |

Claim checks: 43 claims checked across the five PRDs. 4 are FALSE or STALE: 1 in Q03, 1 in Q04, 2 in Q07. The red-today
claims on the laws held up well. Every law claim I checked fails on today's tree the way the PRD says it does.

---

## PRD-Q01: relation file (articles, tools, incidents, terms)

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. Appendix A lists all 33 tool-register pages, and Appendix B gives the command behind each fact |
| Technical feasibility | 4 | §5.5 and §18 describe a static generator with the same marker splice as `build-journal.py`, and only stdlib Python is needed. The tool-page splice anchor is ambiguous (see D2) |
| Functional clarity | 4 | §8 FR-1…FR-16 are fully specified, and FR-3, FR-4 and FR-6 give exact scoring rules. FR-10 has no marker pair, and the generated section reuses class `tool-ref` (D2) |
| User journey | 5 | §7 J1–J6 cover visitor, non-root dossier click, root, owner batch review and new-article flows, each with failure and recovery steps |
| UI/UX depth | 5 | §9.2 has ASCII layouts at 1440 and 390, §9.3 the exact HTML, §9.6 every copy string, §9.7 the CSS contract with a forbidden-property list, §9.8 states there is no motion, and §9.9 covers a11y |
| Data model | 5 | §10.2 has the full JSON Schema, §10.3 rules V1–V14 with error prefixes, §10.5 real example records, and §10.6 versioning and migration |
| API contracts | 4 | §11.1 lists CLI commands with exit codes, §11.2 the Python signatures, and §11.3 the HTML contract. The HTML contract has no tool-page markers (D2) |
| Cross-module | 4 | §13 covers journal, incidents, explain-db, assembler, auth, llms and sw. It creates a soft read cycle with Q03 (cross-PRD X4) |
| Error handling | 5 | §17 covers 14 cases, including a partial apply, two sessions editing at once and a missing anchor. Writes are atomic |
| Security | 4 | §16 escapes all text, lets no href come from free text, and gates the `auth.js` change on owner approval. It states that the dossier gate is presentational. That is honest, but it is not fixed |
| Testability | **3** | §22 phase 0 says the gate "runs L2, L3, L5, L7, L8". L8 fails with "no `.rz-rel` element" whenever no edge is accepted (§20.4 row L8), which is exactly the phase 0 state. So the ship gate goes red as soon as phase 0 wires it. The red proof for L1, L2, L3, L5 and L7 is "the script/file does not exist", which proves nothing about the check (D1, D3) |
| Implementation readiness | 4 | §19 has T-1…T-12 at 0.5–2 d each, with a verify step and DoD. The engineer would have to invent the tool-page anchor rule (D2) |

### Claim checks

| # | Claim (PRD location) | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | L6 red: `isRootOnlyHref('/incident-…html')` returns false (F6, `auth.js:339-347`) | `sed -n 330,348p auth.js` | Entries are `'/incident-'`; the test is `path === p \|\| path === p+'/' \|\| path.indexOf(p+'/') === 0`, so a dossier path never matches | TRUE |
| 2 | L1/L4 red: 0 journal pages carry `data-rz-rel`/`data-edge="rel-"`; no relations file or gate | `grep -l 'data-rz-rel\|data-edge="rel-' article-*.html FF-*.html geopolitics-*.html \| wc -l`; `ls data/relations.json tools/test-relations.mjs` | `0`; both missing | TRUE |
| 3 | Numeric: 33 pages carry `class="tool-ref"` (F10) | `grep -l 'class="tool-ref"' *.html \| wc -l` | `33` (and 33 with `data-rz-register="tool"`) | TRUE |
| 4 | Numeric: explain-db 1,020 entries, 430 with `link` (F9) | node eval of `js/rz-explain-db.js` | `total 1020`, `linked 430`; all 430 keys match the schema `nodeRef` pattern | TRUE |
| 5 | `article-19.html:1008` links CAPEX and OPEX (F3) | `sed -n 1008p article-19.html \| grep -o 'href="[^"]*"'` | `capex-calculator.html`, `opex-calculator.html` | TRUE |
| 6 | All 36 journal pages carry `div.related-articles` (F11, FR-9 anchor) | node over `data/journal.json` urls | `36 36 []` | TRUE |
| 7 | `ship-gate.sh:67` incident freshness, `:257` generator freshness (F15, F16) | `sed -n 67p; sed -n 257p tools/ship-gate.sh` | Both lines as stated | TRUE |
| 8 | Root prompt text in `handleRootOnlyLinkClick` (J2) | `grep -n 'Please sign in with a root account' auth.js` | `:370` | TRUE |

### Critical deficiencies

- **D1, a contradiction that makes the gate unshippable.** §22 phase 0 runs L8, and §20.4 says L8 fails with "no block" when no
  `.rz-rel` exists. Phase 0 by definition renders only empty markers. Wiring `--phase 0` into `ship-gate.sh` (§20.3)
  therefore turns the ship gate red until the owner accepts edges.
- **D2, something an engineer would have to invent.** FR-10 says to place the tool block "right after the closing `</section>` of
  `section.tool-ref`". But §9.3 gives the generated block the class `tool-ref rz-rel rz-rel--tool`. On the second `--apply`
  there are two `section.tool-ref` elements, and the anchor (and the "eyebrow number = tool-ref + 1" rule) is ambiguous. FR-9
  defines marker pairs for articles, but nothing defines them for tool pages, so idempotence (L7) depends on a guess.
- **D3, red proofs that cannot fail for the right reason.** L1, L2, L3, L5 and L7 are "red" today only because
  `tools/test-relations.mjs` / `build-relations.py` do not exist. Only L2, L3 and L5 name a mutation proof. L1, L4 and L7
  have no mutation proof against a built tree.
- Minor: O8's block budget is 2,048 B per page, but a full block (3 tool, 3 incident and 8 term links in the §9.3 markup) is
  about 2.5 KB by the example's own byte rate. The budget is likely to fail on its first measurement. It is marked UNKNOWN,
  which is acceptable, but T-4 should allow for a budget change.

### Revisions required (dimension below 4: testability)

1. §22 table, phase 0 row, "Gate state" cell: replace the text with: "`test-relations.mjs --strict --phase 0` runs L2, L3, L5 and L7 (they
   hold with 0 accepted edges) and runs L8 against `tools/fixtures/relations/render-fixture.html`, a page written by
   `build-relations.py --render-fixture` with one Tool, one Incident and one Terms row. L1 and L4 wait for phase 1, L6 for phase 2."
   Add the `--render-fixture` command to §11.1, and a matching line to the L8 row of §20.4: "Phase 0: `--law L8 --fixture`."
2. §20.4: add a mutation red proof to every law that lacks one. L1: "after T-11, a temp copy with the Tool row removed from
   `article-7.html` → `L1 FAIL article-7`". L4: "`--live` against a URL serving a pre-release copy → `L4 FAIL 0/n`". L7: "hand-edit
   one `why` inside a block in a temp copy → `--check` exit 1 naming the page". Store each red log in `05-test-evidence/Q01/`.
3. FR-10 and §11.3 (fixes D2): "Tool pages carry `<!-- rz:related -->…<!-- /rz:related -->` inserted on the first run immediately
   after the `</section>` that closes the first `section.tool-ref:not(.rz-rel)`. Later runs replace only what lies between the
   markers. The generated section has classes `rz-rel rz-rel--tool` (never `tool-ref`), and `css/rz-related.css` styles its
   eyebrow through `.rz-rel--tool .eyebrow`. The eyebrow number is read from the first non-generated `.tool-ref .eyebrow`."

---

## PRD-Q03: reproduce an incident in a calculator

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. Appendices A–D give the 4 entries, a verdict for all 43 dossiers, the near misses and the commands |
| Technical feasibility | 4 | §18 uses static `#rzs=` links and makes calculator numbers no-copy (BR-6). It depends hard on peer P2 Part 2, which is not on main yet (§5.4) |
| Functional clarity | 4 | FR-1…FR-13 come with an FR field matrix (§8.1). FR-13 specifies a contract the peer has since replaced (D1) |
| User journey | 5 | §7 J1–J6, including the failure messages taken from P2, the FMEA entry path and the owner review |
| UI/UX depth | 5 | §9.2 has 1440/390 ASCII, §9.3 the HTML, §9.6 every string, §9.7 the CSS with a ban list, plus print behaviour |
| Data model | 5 | §10.2 schema, RV1–RV16, the generated baselines file, the review file, and a real OVH example with verbatim quotes |
| API contracts | **3** | §11.3 and FR-13(2) define `origin` as an object `{kind, slug, entry, set[]}`. The interface agreed with the peer on 2026-11-11 (`STATE.md`, "Interface agreements") makes `origin` a **string** of at most 80 characters matching `^[A-Za-z0-9_.:/-]+$`. The same agreement adds hidden mirror inputs `#tiaTier`/`#tiaDcType`, which FR-2's "parsed defaults equal `capture()`" check and A1 do not account for (D1, D2) |
| Cross-module | 4 | §13 covers the builder, FMEA, response, vectors, hub, Q1, P2 and the account page. It creates a soft cycle with Q01 (cross-PRD X4) |
| Error handling | 4 | §17 covers 13 cases. A restore that partly fails is left to P2's message, with no Q3-side gate on how many fields failed |
| Security | 4 | §16 covers spoofed `#rzs=` links, escaping and the presentational root gate. The origin requirement "no free text from the URL" is right, but it is written against the stale object shape |
| Testability | 4 | L1–L7 have exact expected outputs, and the L4 values were recomputed and hold (checks 6–7). Phase 0 runs only L1 and L7, which is consistent |
| Implementation readiness | 4 | §19 has T-1…T-11 with effort and verification. T-6b is conditional and well-bounded |

### Claim checks

| # | Claim | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | L3 red: `rz-scenario.js` not loaded on TIA or tier (F4) | `grep -c 'rz-scenario' tia-942-checklist.html tier-advisor.html` | `0`, `0` | TRUE |
| 2 | L2 red: P2 schema file missing | `ls data/scenario-link.schema.json` | No such file | TRUE |
| 3 | L1 red / F2: no dossier has `reproduce` | `grep -l '"reproduce"' data/incidents/*.json \| wc -l` | `0` | TRUE |
| 4 | Numeric F4: 11 `data-rz-calc` bodies; `rz-scenario.js` script tag on 8 pages | `grep -l '<body[^>]*data-rz-calc' *.html \| wc -l`; `grep -l '<script[^>]*src="js/rz-scenario.js' *.html` | `11`; 8 pages (7 calculators + account) | TRUE |
| 5 | Numeric F1: 43 dossiers, 15 seed, 30 official postmortem | node over `data/incidents/[a-z]*.json` (`lastVerified` and `"seed — pending"`) | `43`, `15`, `30` | TRUE |
| 6 | Numeric F9/C3: 88 items, 62 at Tier 3 Enterprise, 67 Colocation | node eval of `CATEGORIES`/`ITEMS` from `tia-942-checklist.html` | `88 62 67` | TRUE |
| 7 | Numeric L4: OVH overall 91.912 → "92%", LD8/Delta 97.995 → "98%", Electrical 90.9 | same harness, page formula `:654-670` | `91.9117…`, `97.9946…`, `90.909…`; all 5 item ids exist | TRUE |
| 8 | F10: `fireSuppression` options and default `preaction`; physical = 0.35/0.35/0.30; physical weight 0.10 | `sed -n 357,364p; 586p; 552p tier-advisor.html` | As stated | TRUE |
| 9 | F12: the fire calculator has no hold-time input | `grep -n -i hold fire-calculator.html` | Only the fixed text in the KPI card at `:316` | TRUE |
| 10 | FR-13(2): `origin` = object `{kind, slug, entry, set}` | `STATE.md` "Interface agreements with the peer (2026-11-11)" | Agreed: `origin` is a string ≤ 80 characters, pattern `^[A-Za-z0-9_.:/-]+$` | **STALE** |

### Critical deficiencies

- **D1, a conflicting contract (stale).** An engineer following FR-13(2) and §9.6 would request, and test against, an
  `origin` object that the peer's v1 schema rejects. RV15 would then fail every link that carries it, or silently drop
  the field.
- **D2, a contract gap.** The peer agreement adds hidden mirror inputs `#tiaTier` and `#tiaDcType` to TIA "kept in step by the setters"
  so that tier and DC type round-trip. If they are capturable, the TIA `capture()` on a fresh load has 64 keys, not 62, and
  FR-2's acceptance ("parsed defaults equal `rzScenario.capture()`") fails. If they are `type="hidden"`, `capture()`
  excludes them (F6) and the agreement does not work. The PRD does not resolve which one holds. A1 ("TIA starts at
  Tier 3, Enterprise on every load") becomes weaker than needed: the link could carry the tier explicitly.
- Minor: RV11 counts a `metric` with a non-empty `source` as sourced. Delta's second pointer is a metric sourced to Availability
  Digest, which the PRD itself labels "official postmortem: no". That is acceptable, but the owner should see it in the review sheet.

### Revisions required (dimension below 4: API contracts)

1. FR-13(2), §9.6 last row, §11.3 last paragraph: replace the object with the agreed string: "`origin` = `incident:<slug>:<entry>`,
   for example `incident:ovhcloud-sbg2-fire-2021:rp-tia`. The longest slug today (43 characters) gives 60 characters, under the
   80 cap. A build error is raised if the string exceeds 80 characters or fails `^[A-Za-z0-9_.:/-]+$`." Delete `set` from the
   request. The banner marks fields by comparing the restored value with the page default, and the peer decides whether to show
   markers at all. Add RV17: "`origin` matches the P2 v1 pattern and length".
2. FR-2, §10.4 and A1: add "TIA baseline includes the P2 mirror inputs `tiaTier` (value `"3"`) and `tiaDcType` (value `"ent"`)
   when `capture()` returns them. T-2 checks this against P2's committed `tia-942-checklist.html`: if the mirrors are
   capturable, `count` is 64 and the link carries them; if not, record the peer's answer in §5.4 and keep 62." Change the
   L3 claim to "`capture()` restricted to the stored keys equals the stored map, and `#tiaTier`/`#tiaDcType` read 3/ent".

---

## PRD-Q04: one engine path per metric

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. F1–F16 and N1–N14 carry file:line evidence, C1–C6 correct the addendum, and D-1…D-9 are decision records |
| Technical feasibility | 4 | §5.5 respects the locked engines, the UMD engine and the DCMOC rebuild. This is the biggest change set in the batch (22.5 d, 18 tasks, DCMOC rebuild) |
| Functional clarity | 5 | FR-1…FR-19 give exact formulas, operation order, signatures and the deletion lists |
| User journey | 4 | §7.1–7.5 cover the calculators, cross-tool use, DCMOC, owner decisions and contributors. §7.2 shows that pages still differ by design, and no on-page affordance explains that |
| UI/UX depth | 4 | §9.1–9.14 give exact copy before and after, the precedence of messages and the missing-engine state. The disabled exports explain themselves only through `title`, which touch screens do not show |
| Data model | 5 | §10.2 registry, §10.3 fixtures, saved-scenario compatibility (§10.1) |
| API contracts | 5 | §11.1 gives one canonical function per metric with signatures and statuses, §11.2 the DCMOC TS API, §11.4 the gate output grammar |
| Cross-module | **3** | §13 names PRD-Q06 only for runtime-gate order. FR-17/L7 requires the normalised body of `computeModelLegacy` to equal the frozen copy in `tools/test-ltc-parity.mjs`, but PRD-Q06 FR-13 inserts `RZProvenance.mark(...)` into that same inline branch (`js/ltc-system-modelling-lab.js:2710-2713` is the guard; the mark goes into the else path). Whichever ships second turns L7 red. Q04 T-14/T-15 and Q06 T-13 also both rebuild the `dcmoc/` export, and neither PRD orders the two rebuilds (D1) |
| Error handling | 5 | §17 has 25 cases, including stale tokens, CSP, an engine throw, null and zero prices, and an owner rejection becoming HOLD |
| Security | 4 | §16 adds no input surface. The only new HTML writes use the existing `showErrors`, and the S-SEC static check limits `innerHTML` in the changed lines |
| Testability | 4 | L1–L8 come with exact red outputs, verified (checks 1–6). L1's red is "no registry (exit 2)", and the seeded local count is internally inconsistent (D2) |
| Implementation readiness | 4 | §19 orders T-1…T-18 with a decision gate on each switch. D-8, which removes the local fallback on 5 pages, still needs the owner to rule whether it counts as "feature removal" (§1 says so itself) |

### Claim checks

| # | Claim | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | L2 red: the only engine tag in tier-advisor is inside the print string (`:1457`); no `RZEngine` reference | `grep -n -E '<script[^>]*src=' tier-advisor.html`; `grep -c RZEngine tier-advisor.html` | `:1456`/`:1457` are `html+='<script …'` strings; `0` | TRUE |
| 2 | L8 red: `data-rz-result` count 0 on the five pages | `for f in tier-advisor carbon-footprint opex-calculator pue-calculator tco-calculator; do grep -c data-rz-result $f.html; done` | `0` ×5 | TRUE |
| 3 | L3 red: `LOCAL_PUE` at `arch-adapter.ts:59`; no `PUE_FALLBACK`; built chunk holds `inrow:1.35,rdhx:1.25` | `sed -n 59p …/arch-adapter.ts`; `grep -c PUE_FALLBACK dcmoc/src/constants/pue.ts`; `grep -rl 'inrow:1.35,rdhx:1.25' dcmoc/_next` | as stated; `0`; `page-5ae902f0d83092a9.js` | TRUE |
| 4 | L4/F6 numeric: `gridFactor('TH')` = `gridFactor('DE')` = 0.37; 0 of 40 countries resolve to their own value; `annualCost(1,1.52,'US')` = 197,064 | node `require('./rz-engine.js')` | `0.37 0.37`; `countries 40 own grid 0`; `197064` | TRUE |
| 5 | F6 numeric: "Carbon Levy" 194,472 for US, FR, SE, ZA, TH; ID 107,222 | node `models.opex.fullBreakdown({itMw:1,pue:1.5,countryCode:c})` | US/FR/SE/ZA/TH `194472` "4862 tCO₂"; ID `107222` | TRUE |
| 6 | F11: `rearDoor.pueKey` is `'liquid'` at `rz-engine.js:5856` | `sed -n 5856p rz-engine.js` | `pueKey: 'liquid'` | TRUE |
| 7 | F14/L7 red: `test-ltc-parity` is not in the ship gate | `grep -c test-ltc-parity tools/ship-gate.sh` | `0` | TRUE |
| 8 | Total `local` = "23 PUE + 20 carbon + 7 tier + 10 OPEX energy = 60" (§3.2 F1 `:117`), against "22 of them local" (`:47`, `:102`, C1 `:330`) "plus 2 multi-line local models found by reading" (`:111-113`) | `grep -n '23 PUE\|22 of them\|22 local' PRD-Q04/PRD.md` | 22 + 2 = 24 PUE, not 23, so the total is 61, not 60. Carbon is 18 + 2 = 20 and is consistent | **FALSE** (internal arithmetic) |

### Critical deficiencies

- **D1, a cross-PRD contradiction.** Q04 L7 (the body of `computeModelLegacy` equals the frozen copy) and Q06 FR-13 (a mark call
  inside that same function's inline branch) cannot both pass as written. Q04 §13 was written after Q06 existed, and
  Q04 UC7 even relies on "Q6's line", so the conflict should have been caught.
- **D2, a fabricated or inconsistent number.** The headline `local=60` (§2 table, O1, FR-1 acceptance, T-1 verification, L1 red)
  does not follow from the counts the PRD states. FR-1 hedges with "± the T-1 recount", which makes the L1 red claim
  impossible to falsify.
- Minor: with the engine missing, exports are `aria-disabled` and explain themselves only through `title` (§9.5, §9.12).
  On a phone a press does nothing and says nothing, which is close to a dead control. The missing-engine sentence is already visible
  in the box, so this is minor. Adding `aria-describedby` pointing at the box would close it.

### Revisions required (dimension below 4: cross-module)

1. FR-17, add: "The L7 normaliser removes, before comparing, every statement of the form `if (window.RZProvenance) { … }` and
   every call `RZProvenance.mark(…)` / `RZProvenance.clear(…)` (PRD-Q06 FR-13). T-16 records two proofs: inserting a
   non-provenance statement into the inline branch → `L7 FAIL ltc-inline-body`; inserting a Q6 mark → L7 passes."
2. §13, PRD-Q06 row, replace the cell with: "Q6 FR-13 edits `computeModel` and the inline branch of `computeModelLegacy`, and Q4 L7
   ignores those calls (FR-17). Q6 T-13 and Q4 T-14/T-15 each rebuild `dcmoc/`. The task that ships second rebuilds from
   a tree that contains both changes and re-runs `tools/_dcmoc_trace_parity_probe.mjs` and `node tools/test-engine-paths.mjs
   --law L3` on that combined export. Whichever runtime gate ships second rebases on the first."
3. §3.2 F1 `:117`, §2 table, O1, FR-1, T-1, L1 (fixes D2): either change "23 PUE" to "24 PUE" and every "60" to "61", or name
   which of the two read-found models is already among the 22 and keep 60. Delete "± the T-1 recount" from FR-1. T-1 writes the
   exact count into `verifiedCount`, and L1's red line quotes it.

---

## PRD-Q06: simulation honesty layer

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. F1–F12 come with reproduction commands, C1–C6 and N1–N6. The overlap with PRD-X-DEFECTS is declared (§1) |
| Technical feasibility | 5 | One module of 8 KB or less with `textContent` only, a static-first line, and the existing banner restyled. No engine change |
| Functional clarity | 5 | FR-1…FR-16 name exact lines, ids, copy and placement on every page |
| User journey | 5 | §7 J1–J6, from the PLN snapshot and the excursion through page declaration, the LTC and DCMOC fallbacks, to the crawler |
| UI/UX depth | 5 | §9 gives the styling contract, exact strings (§9.10), a contrast rule against the computed background, and removes a dead control ("All \| Live" pill) |
| Data model | 4 | §10 has the record, the line grammar and a registry of 21 panels and 22 fields. Retention and audit fields of the registry are thin (registry changes are audited by git only) |
| API contracts | 4 | §11.2 gives `RZProvenance` format/validate/mark/clear/audit and the event, §11.3 error codes. `NOTICE_DELAY_MS` is a measured-later constant (A2), which is acceptable but not yet a value |
| Cross-module | 4 | §13 covers Q7, P26, Q8, the generators, OG cards and tests that pin the banner. It does not see Q04 FR-17/L7 (cross-PRD X1). `dc-market-tracker.html` and `build-og-images.py` touch peer-adjacent work, and T-14 says to message the peer |
| Error handling | 5 | §17 E1–E19 cover a bad record, a missing target, repeated marks, port collisions and a slow engine |
| Security | 4 | The module writes text only, so there is no XSS surface. DCMOC is root-only. No new data. It does not discuss whether the fallback `reason` strings could ever carry runtime exception text into the DOM |
| Testability | 5 | Each of L1–L8 has a one-line reproduction that fails today, all verified (checks 1–6). L8 includes a planted failing line |
| Implementation readiness | 4 | §19 has T-1…T-17 (about 15 d). Two items are left open for implementation time: the `NOTICE_DELAY_MS` measurement and "check whether DCMOC calls `worker/`" (T-13) |

### Claim checks

| # | Claim | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | L1 red: four cockpits lack `data-rz-data-mode="simulated"` | `for f in fuel-system.html EPMS_Telemetry.html dc-conventional.html cdu-mini-bms.html; do grep -c 'data-rz-data-mode="simulated"' $f; done` | `0` ×4 | TRUE |
| 2 | L2 red: no HTML carries `data-rz-provenance=` | `grep -rl --include=*.html 'data-rz-provenance=' . \| wc -l` | `0` | TRUE |
| 3 | L4 red: `Live Energy Dashboard` ×2 in `llms-full.txt`; `real-time map` ×1 in `build-og-images.py` | `grep -c …` | `2`, `1` | TRUE |
| 4 | L5 red: `setInterval(updateClock` at `pln-java-grid.html:2443`; `bmsGwOnline` reads `16 / 16` | `grep -n …`; `grep -o 'bmsGwOnline[^<]*' datahallAI.html` | `2443:`; `…16 / 16` | TRUE |
| 5 | Numeric F6/C4: the model lists GW-01~04, 05~08, 09~12, 13~14 plus a `cloud GW` (15), with `native`/`network` rows not gateways | `sed -n 9224,9233p datahallAI.html` | 4+4+4+2 = 14 field + 1 cloud; two rows tagged `native`, `network` | TRUE |
| 6 | L8 red: banner pulse `rzTqPulse … infinite` at `js/rz-telemetry-quality.js:80-82`; simulated bg `rgba(6,182,212,0.12)` at `:32` | `sed -n 80,82p; 32p` | As stated | TRUE |
| 7 | F5/L7: `dhRand` uses `Math.random` at `datahall.html:2085`; schedule at `:2135`; note "deterministic" at `:2333` | `sed -n …p datahall.html` | As stated | TRUE |

### Critical deficiencies

None blocking. Two items to fix in the next revision:
- FR-13 edits code that Q04 L7 freezes (cross-PRD X1). Q06 §13 should name Q04 FR-17 and point to the normaliser rule.
- FR-3 says "replace the state rules at `:59-92`". Make it explicit that the `demo` state's light-theme `!important` background
  (`js/rz-telemetry-quality.js:79`, `#FFF8D6`) is also removed, because Q07 puts every training run in `demo` mode and Q06 L8
  only checks the steady `simulated` state.

---

## PRD-Q07: scripted fault scenarios (training mode)

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. Appendix A inventories alarm paths, Appendix C has the four scenario files, and OQ-1…OQ-4 are explicit |
| Technical feasibility | 4 | DOM-free player, integer clock, LCG with `Math.imul`, adapters that keep `conv-engine.js` byte-locked. The `currentCooling()` refactor touches 8 consumer sites (R3) |
| Functional clarity | 5 | FR-1…FR-16 with a field matrix. The ledger transitions, the LCG, the trace format and the effect timing are all exact |
| User journey | 5 | §7 J1–J7, including tab-hidden pause, reload recovery, deep link and saved-run version mismatch |
| UI/UX depth | 5 | §9.2 ASCII for list, run and debrief, §9.4 every control with its disabled condition, §9.6 full copy, §9.7 styling contract, §9.9 a11y |
| Data model | 5 | §10.2 schema, V1–V16 with codes, the trace grammar, the run record, retention and versioning |
| API contracts | 4 | §11.1–11.6 cover player, panel, adapter, Supabase and static files. The decision-record `request` pattern is `^R[0-9]{3,4}$`, while Q01/Q03 use `^R[0-9]{2,4}$`. V5 lets drafts load when a localStorage `rz_premium_session` says root, which anyone can forge |
| Cross-module | 4 | §13 covers Q6, the three pinned gates, docs, account and tracker. V16 renders `relatedIncidents` "with the word Root access per the Q01 contract", but Q01 is not listed as a dependency. It loads `css/rz-hub.css` on cockpits, while Q06 chose a self-styled line for the same pages |
| Error handling | 5 | §17 and FR-3/10/11 cover fetch, parse, storage blocked, popup blocked, cap, network, double click, engine mismatch and interrupted runs |
| Security | **3** | (a) §11.5/T-9 change `auth.js`'s public surface (`window._rzAuth.ensureSupabase`). `STATE.md` requires owner approval for auth changes, and PRD-Q01 treats an `auth.js` change as an auth boundary, but Q07 only "tells the peer". (b) T-15/O7 calls `rz-tracker.js` with "no personal data", but `track()` stamps every event with `ip`, `country`, `city` from `ipapi.co` (`rz-tracker.js:38-66`, `:107-120`). Adding a training event extends IP-tagged tracking with no consent check (D1, D2) |
| Testability | 4 | L1–L8 fail today as stated (checks 1–4). L2 golden-trace equality is strong. O7 has no working measurement (D2) |
| Implementation readiness | 4 | §19 has T-1…T-17 at 0.5–2 d. Phases A, B and C are gated by owner decisions OQ-1…OQ-4 |

### Claim checks

| # | Claim | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | L1 red / F1: one `Math.random` in code at `datahall.html:2085`; `:978` and `:1217` are comments | `grep -n 'Math.random' datahall.html` | Exactly these three lines; only `:2085` is code | TRUE |
| 2 | L2/L3 red: no `data/scenarios/`, no `js/rz-fault-player.js` | `ls data/scenarios js/rz-fault-player.js` | Both missing | TRUE |
| 3 | L5 red: no Training button | `grep -c rz-fault-open datahall.html` | `0` | TRUE |
| 4 | L4 red: excursion fires at 30 s, then every 120 s | `sed -n 2135p datahall.html` | `setTimeout(… setInterval(fireExcursion, 120000); }, 30000)` | TRUE |
| 5 | Numeric F6: CRAH 130 kW "ASSUMED" at `js/conv-engine.js:158` | `sed -n 158p js/conv-engine.js` | `CRAH_UNIT_SENSIBLE_KW = 130.0; // ASSUMED — no vendor selection made` | TRUE |
| 6 | Numeric F10: `rz-pdf-export.js` loaded by 11 pages, not datahall or fuel | `grep -l rz-pdf-export.js *.html \| wc -l`; `grep -c` on the two pages | `11`; `0`, `0` | TRUE |
| 7 | F9: name 1–120, payload ≤ 65,536, cap 200, RLS own rows; `ensureSupabase` internal; `_rzAuth` at `:785` | `sed -n 280,331p supabase/schema.sql`; `grep -n ensureSupabase auth.js`; `grep -n 'window._rzAuth\s*=' auth.js` | All as stated | TRUE |
| 8 | F3: the excursion hook is pinned by three gates | `grep -rn fireDatahallExcursion tools/` | `test-datahall-authority.mjs:103`, `test-datahall-operator-engineering.mjs:65`, `test-ict-datahall-operator-runtime.mjs:117` | TRUE |
| 9 | O7: "measure with the existing `rz-tracker.js` event … Training runs started per month" | read `rz-tracker.js` | `track()` writes only to the visitor's own `localStorage['rz_user_events']` (no fetch or beacon of events). Per-month runs across visitors cannot be counted | **FALSE** |
| 10 | T-15: "Count runs; no personal data" | `sed -n 30,70p; 100,131p rz-tracker.js` | Every event carries `ip`, `country`, `cc`, `city`, `ua` and `sid`, with the IP fetched from `https://ipapi.co/json/` | **FALSE** |

### Critical deficiencies

- **D1, an unapproved auth-surface change.** FR-11/§11.5 add `ensureSupabase` to `window._rzAuth`. This may be harmless, but the program's
  approval list ("auth or security boundary changes") applies, and the sibling PRD (Q01 FR-13) routes a smaller `auth.js` edit
  through owner approval. Two PRDs in one batch classify `auth.js` edits differently.
- **D2, a false measurement method and a privacy gap.** O7 cannot be measured with the named tool (a device-local store), and
  T-15 says "no personal data" while it calls a tracker that attaches IP and city to the event. Event names also disagree
  (`fault_run_start` in O7, `rz-fault-run-start` in §11.2, §13 and §22).
- **D3, an undeclared dependency.** V16 renders incident links "per the Q01 contract" (the "Root access" word and the matcher fix),
  but §1 lists only Q6. If Q07 ships before Q01 FR-13, the incident links get no lock.
- Minor: V5's root check for drafts reads a client-forgeable session. The drafts are public static files anyway, so this is
  harmless, but the rule should say "drafts are not listed" rather than imply an access control.

### Revisions required (dimension below 4: security)

1. §11.5, T-9 and §1 approval cell, add: "The `auth.js` export changes the auth module's public surface. It ships only after the owner
   approves it by name (`STATE.md` approval list), recorded with its request id, as PRD-Q01 FR-13 does. Until then, Save to
   account is hidden, and the panel shows 'Saving to your account is not available yet.' Device saves work."
2. O7, T-15 and §13 tracker row: replace O7 with "Use: not measured in v1. The site has no consented, aggregated analytics path;
   `rz-tracker.js` stores events only on the visitor's device and tags them with IP and city (`rz-tracker.js:38-66`,
   `:107-120`)." Delete T-15 and every `rzTrack` call. Keep the DOM events `rz-fault-run-start`/`rz-fault-run-end` (one name,
   used everywhere) for a future consented counter. Add to §16: "Training adds no tracking call."
3. §1 Dependencies (fixes D3): add "PRD-Q01 FR-13 (dossier link lock) before any scenario with `relatedIncidents` is approved.
   Until then V16 also requires `relatedIncidents` to be empty."

---

## Cross-PRD findings (these five only)

### X1. Conflicting contracts

| Id | PRDs | Conflict | Resolution |
|---|---|---|---|
| X1 | Q04 FR-17/L7 vs Q06 FR-13 | Q04 freezes the body of `computeModelLegacy`, and Q06 inserts provenance marks into it | Q04 normaliser strips `RZProvenance` calls (revision above). Q06 §13 references it |
| X2 | Q04 FR-16 vs Q06 FR-1 | Two "engine missing" idioms. The five calculators get a sentence in `.rz-calc-validation`, while LTC and DCMOC get an `RZProvenance` `Fallback` line. A reader sees two different signs for the same condition | Make `RZCalc.showEngineMissing` also call `RZProvenance.mark(resultRoot, {kind:'fallback', …})` when the module is present, or record in both PRDs why the two idioms differ by register |
| X3 | Q03 FR-13 vs `STATE.md` peer agreement | `origin` object against the agreed string | Revision above |
| X4 | Q01, Q03, Q07 decision records | The status sets differ: `proposed/accepted/rejected/retired` (Q01, Q03) against `draft/approved/retired` (Q07). The decision fields differ: `decidedBy/decidedOn` against `approvedBy/approvedOn`. The request pattern differs: `^R[0-9]{2,4}$` against `^R[0-9]{3,4}$` | One owner-decision record: `{status: proposed\|accepted\|rejected\|retired, decidedBy:"owner", decidedOn, request:^R[0-9]{2,4}$}`. Q07 maps `approved` → `accepted` |
| X5 | Q01 FR-13 vs Q07 §11.5 | Both edit `auth.js` + `auth.min.js`, but only Q01 classes it as an auth boundary needing approval | One approval rule. Serialise the two edits (same min twin, same cache tokens) |
| X6 | Q06 §3.2 F3 vs Q07 §9.7 | Q06 keeps cockpits off `css/rz-hub.css` and self-styles its line; Q07 loads `rz-hub.css` on `datahall.html` and `fuel-system.html` for its tokens | Pick one. Q07 should reuse the token fallback chain that Q06's module injects, or Q06 should adopt `rz-hub.css`. Either way, write the choice in one standard |

### X2. Duplicated requirements that should be one module

| Duplicate | Where | Proposal |
|---|---|---|
| Owner decide/retire CLI with atomic write, refusal leaves file byte-identical, verbatim-evidence re-check | Q01 FR-8 (`build-relations.py decide`), Q03 FR-5 (`incidents_reproduce.py decide`), Q07 J7 (hand-edited approval fields) | `tools/owner_decisions.py` (status machine, request id, atomic write) imported by both CLIs. Q07 uses it for `approve` |
| Verbatim evidence check | Q01 FR-8 (article text and dossier fields), Q03 RV10 | Both call `incidents_fmea.resolve_evidence`, plus one `visible_text()` for article pages |
| axe planted-line proof | Q01 L8, Q03 L6, Q04 §15, Q06 L8, Q07 L8 (the planted line is "2:1" in one place and `#3D4A5C` in another) | One helper `tools/lib/axe-planted.mjs` with one planted colour and one assertion |
| Browser gate harness | Q01, Q03, Q07 run their own server on port 0 with an identity check; Q04 and Q06 use `$LTC_BASE` from the served-tree block | One rule: inside `ship-gate.sh` use `$LTC_BASE`; standalone runs use the shared port-0 server helper |
| Design-register computed-style checks (no `transition: all`, no transform, radius ≤ 4 px, fonts) | Q01 L8, Q03 L6, Q06 L8, Q07 L8 | One `assertRegister(page, selector)` helper |
| "Root access" word on dossier links | Q01 FR-13/BR6, Q07 V16 | Q01's renderer is the only writer. Q07 renders incident links through it or not at all |

### X3. Dependency graph and cycles

```
Q06 ──► Q07            (Q07 needs RZProvenance; Q07 rewrites Q06 L7)
Q06 ──► Q04            (Q04 UC7 / §7.3 rely on Q6 lines; Q04 L7 must tolerate Q6 FR-13)
Q01 ──► Q03 (soft)     (Q03 FR-12 adds rule R2I to Q01's propose)
Q03 ──► Q01 (soft)     (Q01 §13: "Q3 reads accepted tool→incident edges to cross-check its reproduce[] entries")
Q01 ──► Q07 (undeclared, V16)
P2 (peer) ──► Q03 (hard)
```

- **Cycle Q01 ↔ Q03 (soft).** Each reads the other's accepted data. Neither blocks a build today, but a gate in one that validates
  against the other would deadlock the order. Fix: keep the direction Q03 → Q01 only (R2I proposes Q01 edges from Q03 entries)
  and delete the Q01 §13 row "Q3 reads accepted tool→incident edges to cross-check its reproduce[] entries".
- **Ordering hazard Q04 / Q06.** Both rebuild the `dcmoc/` export and both add runtime gates to the same served-tree block. The
  second to ship must rebuild from the combined tree (revision under Q04).
- **Ordering hazard Q06 / Q07.** This one is handled: Q07 T-12 rewrites Q06 L7, and R9 records it.

### X4. Shared-file collisions to schedule

`auth.js`/`auth.min.js` (Q01, Q07); `datahall.html` (Q06 FR-5/FR-10, Q07 FR-1/FR-5: Q07 deletes what Q06 adds);
`js/ltc-system-modelling-lab.js` (Q04 L7 freeze, Q06 FR-13 edit); `dcmoc/` export (Q04, Q06); `tools/ship-gate.sh` insertion
points (Q01 after `:71`, Q03 after `:70`, Q04/Q06 the served-tree block, Q07 after `:160`); `tier-advisor.html` and
`tia-942-checklist.html` (Q04 FR-9, Q03 T-6b, peer P2 and X5). Each pair needs one owner per release, and the second change
rebases on the first.

---

## Re-score after revision

Revision: all five PRDs are now version 1.1 (2026-11-11, "QA batch 1 revisions (D1–D8)"), applying the coordinator's
binding decisions D1–D8. New file `documentation/product-transformation/DECISIONS.md` holds 22 owner decisions
(D-Q01-1…3, D-Q03-1…4, D-Q04-1…9, D-Q06-1…2, D-Q07-1…4), all PROPOSED with a recommended default. This re-score was
written by the session that made the revisions, not by an independent reviewer; treat it as a self-check that the
next independent pass should confirm. Only dimensions whose score changed are listed; every other dimension keeps its
score from the tables above. Code facts added in the revisions were checked with grep on this tree (listed per PRD).

### Summary after revision

| PRD | Dimensions changed (old → new) | Lowest dimension | Result |
|---|---|---|---|
| Q01 | Feasibility 4→5, Functional clarity 4→5, API 4→5, Cross-module 4→5, Testability 3→4 | 4 (Security, Testability, Impl. readiness) | PASS |
| Q03 | Functional clarity 4→5, API 3→4, Cross-module 4→5 | 4 (several) | PASS |
| Q04 | UI/UX 4→5, Cross-module 3→5, Testability 4→5 | 4 (Feasibility, Journey, Security, Impl. readiness) | PASS |
| Q06 | Cross-module 4→5 | 4 (Data model, API, Security, Impl. readiness) | PASS |
| Q07 | API 4→5, Cross-module 4→5, Security 3→4, Testability 4→5 | 4 (Feasibility, Security, Impl. readiness) | PASS |

No dimension is below 4 after revision.

### PRD-Q01

| Dimension | Old → new | Evidence |
|---|---|---|
| Testability | 3 → 4 | §22 phase 0 row: L8 is green in phase 0, because FR-8a (new) records every in-scope page as `pending-review` (`pendingReview[]`, schema §10.2, rule V15, CLI `pending` in §11.1) and L8 (§20.4) counts a page as compliant with a block, a `pending-review` record or an exemption, failing only for a page with neither; its render checks run on `tools/fixtures/relations/render-fixture.html` (`--render-fixture`). New §20.5: one planted-violation fixture per law (11 fixtures for L1–L9) with the expected failure message; §20.4 states that the fixture run, not a missing script, is the red proof. New L9 (idempotent splice, second `--apply` writes 0 files, one block per page) with AC13. Not 5: L8 coverage can now be satisfied by a bookkeeping record the session writes without an owner request (by design, D1), so it proves "not forgotten", not "linked"; L1 still carries the linking requirement from phase 1. The fixtures are specified, not built |
| Functional clarity | 4 → 5 | FR-10 rewritten: own class `rz-related` (never `tool-ref`), marker pair `<!-- rz-related:start -->`/`<!-- rz-related:end -->`, first-run anchor (after the first `section.tool-ref`, found by tag matching), replace-between-markers on later runs, eyebrow read only from the hand-written section, error cases for missing/duplicate/broken markers |
| Technical feasibility | 4 → 5 | The anchor ambiguity (D2) is gone. Checked: each of the 33 tool-register pages has exactly one `<section class="tool-ref"` (loop with `grep -c`), and `tier-advisor.html`'s eyebrow reads `02 / Reference`, so the generated one reads `03 / Related` |
| API contracts | 4 → 5 | §11.3 now defines both marker pairs and the tool-page root element; §11.1 adds `pending` and `--render-fixture` with exit codes; §9.3 gives the exact tool-page HTML |
| Cross-module | 4 → 5 | D8: §1 Dependencies, §5.4, §11.4, §13 and §10.6 now state that Q1 never reads Q03 data; the §13 row "Q3 reads accepted tool→incident edges" is replaced. Q07 is named as a reader for V16 |

Still short of 5: Security stays 4 (the dossier gate is presentational, unchanged and stated in §16); Implementation
readiness stays 4 (phases 1 and 2 wait for D-Q01-1…3 and the owner's batch review). Q01 now has nine laws; the PRD
brief asks for 3–8. The ninth (L9) was added because D1 requires an idempotence law; L7 and L9 could be merged if the
brief's range is binding.

### PRD-Q03

| Dimension | Old → new | Evidence |
|---|---|---|
| API contracts | 3 → 4 | The STALE claim (check 10) is fixed: FR-13 (2), FR-6, §5.4, §9.6, §11.3 and §16 now use the agreed string `origin` (≤ 80 characters, `^[A-Za-z0-9_.:/-]+$`, optional, never used for navigation, never inserted as HTML), value `incident:<slug>:<entry>`; the `{kind, slug, entry, set[]}` object and the banner/marker request are withdrawn (§11.3 says so). New RV17 checks it. Lengths measured with `wc -c`: the 4 entries give 39, 40, 43, 45; the longest slug in the library gives 60. The mirror inputs are in FR-2, §10.4 (count 64), A1, L3, AC1, AC3, T-2 and Appendix A. Checked: `capture()` drops `type="hidden"` (`js/rz-scenario.js:18`), so the PRD states that P2's mirrors must be capturable for the agreed round trip, and records the type as captured. Not 5: P2 is still not on main, so the mirror element type is `<as captured>` until T-2 reads P2's committed page; FR-2 says what happens if the mirrors are missing (62 inputs, `--check` exit 1 until the peer's answer is recorded) |
| Functional clarity | 4 → 5 | FR-13 specifies the agreed contract instead of a replaced one; FR-2 and FR-6 state exactly what is emitted and when it is omitted |
| Cross-module | 4 → 5 | §1 and §5.4 state the single direction Q3 → Q1 (rule R2I); the matching Q01 rows are removed (D8). The STATE.md agreement is the cited source for every P2 field |

Still at 4: Error handling (a partly failed restore is still left to P2's message), Security, Testability,
Implementation readiness, Technical feasibility (hard dependency on P2 landing on main).

### PRD-Q04

| Dimension | Old → new | Evidence |
|---|---|---|
| Cross-module | 3 → 5 | D1 resolved without a normaliser: FR-17 and L7 check `computeModelLegacy` by behaviour only (the 12 input sets × 28 outputs of `tools/fixtures/ltc-lab-golden.json`, with `window.__ltcLegacy = true`, engine blocked and engine present, equal NEW `tools/fixtures/ltc-legacy-golden.json`), never by its source text, and Q06 FR-13 now places every mark/clear in the wrapper `computeModel` (`js/ltc-system-modelling-lab.js:2701-2706`) and leaves `computeModelLegacy` untouched. T-16 records two red proofs (a changed `CLIMATE_FACTORS` value fails; an added `RZProvenance.mark` inside the legacy function passes). The DCMOC rebuild order (Q04 first, then Q06; one rebuild when both ship in one release, followed by the trace-parity probe and `--law L3`) is stated identically in Q04 §13 and §22.3 and Q06 §13 and §22.3. D6: the missing-engine state is Q06's `kind=fallback` line with code F-CALC-ENGINE-MISSING, registered in Q06's registry (FR-16, §9.2, §9.3, §9.6, §9.8, §9.10, T-9), so Q06's L6 also proves it; Q06 is now a declared hard dependency of FR-16 |
| Testability | 4 → 5 | D2 fixed: the total is 24 PUE + 20 carbon + 7 tier + 10 OPEX energy = 61 in §2, §3.2, O1, FR-1, the §10.2 seed table, T-1 and L1; "±" is removed; T-1 recounts as verification, writes `verifiedCount.local`, and stops on a different number. L7 has behavioural red proofs; L8 now also checks statically that `js/rz-provenance.js` is loaded (today `grep -c` → 0 on all five pages, checked) |
| UI/UX depth | 4 → 5 | The disabled exports carry `aria-describedby="rz-prov-calc"` (FR-16, §9.5, §9.12, L8, AC-16), and the reason is visible in the `Fallback` line above the results on every width, so a press on a phone is never unexplained |

Honesty note on the total: the coordinator's correction (D3) is applied as 61 registry entries. The seed table in 1.0
had counted `opex-calculator.html:1691` only among the energy anchors, so 1.0's 60 counted distinct lines. Version 1.1
registers `:1691` under both `pue` (the implied-PUE model) and `energy`, says so in §3.2 and §10.2, and notes that the
61 entries sit on 60 distinct lines. Still at 4: Journey (no on-page note that pages differ by design), Security,
Feasibility (largest change set), Implementation readiness (D-Q04-1…9 wait for the owner; D-Q04-8 includes the
"feature removal" confirmation).

### PRD-Q06

| Dimension | Old → new | Evidence |
|---|---|---|
| Cross-module | 4 → 5 | §13 gains a PRD-Q04 row (L7 behavioural, wrapper-only calls, F-CALC-ENGINE-MISSING entries added by Q04, Q06 owns the contract, D6) and the Q7 row now states that Q07 uses `.rz-prov` and the token chain and does not load `css/rz-hub.css` (D7). FR-13, §18.2 and T-12 put every provenance call in `computeModel`, which re-reads the engine condition (`:2710`, checked); `computeModelLegacy` is not edited. §13 DCMOC row and §22.3 carry the rebuild order |

Not changed, as instructed (Q06 edits were limited to the placement, the rebuild order and the decision ids): the
review's second note, removing the `demo` state's light-theme `!important` background (`js/rz-telemetry-quality.js:79`,
`#FFF8D6`), is **not** in FR-3. This matters for Q07, whose training runs use the `demo` banner. It does not lower a
score below 4, but it should be added in Q06's next revision. Still at 4: Data model (registry audit fields), API
(`NOTICE_DELAY_MS` measured later), Security (fallback `reason` strings and runtime exception text not discussed),
Implementation readiness.

### PRD-Q07

| Dimension | Old → new | Evidence |
|---|---|---|
| Security | 3 → 4 | (a) No `auth.js` change: §11.5 is replaced by "Supabase client on the cockpits (existing path, no `auth.js` change)"; FR-11, §5.3, §13, §16, §17, §18, T-9, §22 and DoD reuse the calculators' path (`js/rz-config.js` + module `js/rz-supabase.js`, as `opex-calculator.html:3980,3982` and `account.html:175,177` load them; 9 pages load the module, checked) and `rzSupa.saveScenario/listScenarios/deleteScenario` (`js/rz-supabase.js:163-188`). Default behaviour without the module is device-only saving with the "account unavailable" line. No FR needed the owner-approval marking, because saving does not need `auth.js`. (b) `rz-tracker.js` is no metric source: O7 reads "not measurable across visitors until PRD-Q10 ships consent-gated logging; until then, measured only by the gate's scenario runs"; T-15 dispatches the two DOM events and calls no tracker, with no privacy claim; §16 adds "training adds no tracking call" and lists what a run record holds. Checked: `rz-tracker.js:11` key `rz_user_events`, `:38` fetch to `ipapi.co`. (c) V5 says drafts are "not listed", not access-controlled. Not 5: §11.5 records an existing race (if the login modal opens before the deferred module attaches, `ensureSupabase()` injects a second tag with a different `?v=`, `auth.js:439`) that this PRD does not widen and cannot close without an `auth.js` change; L6 checks for the "Multiple GoTrueClient instances" warning |
| Cross-module | 4 → 5 | Q01 FR-13 is a declared dependency (§1, §5.4, V16, L3, §13, R11): until `isRootOnlyHref` matches dossiers, an approved scenario must have empty `relatedIncidents`. D7: §9.7 uses Q06's token names with Q06's fallback values and `css/rz-hub.css` values as fallbacks for hover and motion tokens (`css/rz-hub.css:18`, `:26-27`, `:36`, checked), and cockpits no longer load `css/rz-hub.css` (`grep -c rz-hub.css` → 0 on both pages today, checked). The `auth.js`/`auth.min.js` collision with Q01 (X5) is gone |
| API contracts | 4 → 5 | One event name everywhere (`rz-fault-run-start`/`rz-fault-run-end`, §11.2; `fault_run_start` removed); `request` pattern aligned to `^R[0-9]{2,4}$`; V5 wording fixed; §11.5 now describes the real client contract |
| Testability | 4 → 5 | O7 has a stated measurement (the gate's runs) instead of a false one; L3 also asserts the V16 dependency and that `js/rz-fault-*.js` contains no tracker call; T-9 checks `git diff --stat auth.js auth.min.js` is empty |

Still at 4: Feasibility (`currentCooling()` touches 8 consumer sites), Implementation readiness (phases gated by
D-Q07-1…4).

### Cross-PRD findings after revision

| Finding | Status |
|---|---|
| X1 (Q04 L7 vs Q06 FR-13) | Closed: behavioural L7 + wrapper-only placement (D3) |
| X2 (two "engine missing" idioms) | Closed: Q04 uses Q06's `kind=fallback` (D6) |
| X3 (`origin` object vs string) | Closed (D2) |
| X4 (decision-record formats) | Closed for owner decisions: one `DECISIONS.md` (D5). Per-record status fields inside each feature's data (relation edges, reproduce entries, scenario files) keep their own sets; Q07's `request` pattern now matches Q01/Q03 |
| X5 (`auth.js` edited by Q01 and Q07) | Closed: Q07 no longer edits `auth.js` (D4); only Q01 FR-13 does, behind D-Q01-3 |
| X6 (`rz-hub.css` on cockpits) | Closed: Q06's contract wins (D7) |
| Cycle Q01 ↔ Q03 | Closed: Q03 → Q01 only (D8) |
| Ordering Q04 / Q06 (`dcmoc/` rebuild) | Closed: fixed order, one rebuild per release (D3) |
| Duplicated modules (§X2 above: owner-decision CLI, axe planted-line helper, browser harness, register checks) | Open. Not part of D1–D8; still worth one shared helper each
