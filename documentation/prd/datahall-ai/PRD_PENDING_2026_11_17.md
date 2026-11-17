# PRD — what is still open after the 2026-11-16 audit (datahallAI and the shared sign-in)

Written 2026-11-17. Owner brief: "kamu yang tentukan yang terbaik, rancang dulu detail PRD untuk yang pending" — the
decisions below are taken here, each with its reason; the owner can overrule any of them before its phase starts.
Source of the open list: `PLAN_AUDIT_2026_11_16.md` (status table), releases v3.63.2 – v3.65.3.

Every number in this document was measured on the tree at v3.65.3 or read from the named file. Where something was
read but not run, it says so.

## 0. Decisions

| # | Question | Decision | Reason |
|---|---|---|---|
| D1 | Labels above section headings (8 on datahallAI) | Keep | The site register allows a mono eyebrow (`CLAUDE.md`, canonical patterns). The audit tool's rule is not the site's rule. Closed in v3.65.3. |
| D2 | Offline demo account in `auth.js` | Keep the account, change how it is granted (P1) | It is published on the homepage FAQ, `cdu-calculator.html` and `cx-calculator.html` as the way to try the calculators. It is a product feature, not a leaked secret. |
| D3 | Pro tier taken from the browser's own record | Fix in two steps (P1): tier from the server profile first, paid computation on the Worker second | The first step is small and closes the free upgrade; the second is the only real boundary on a static site. |
| D4 | Supabase client from a CDN without integrity (S2) | Vendor it into the repo (P3) | One file, pinned, hash recorded; removes a third party from the sign-in path. Needs the owner's yes for the download. |
| D5 | 1.19 MB of inline script (W5) | Do it, in three releases, after a dry run that measures who breaks (P4) | 87 % of the page is script that cannot be cached separately; but the page is the source file of several gates. |
| D6 | Nine schematics with fewer than 8 symbols | Leave them; change the H3 rule | A switch with uplinks, downlinks, a management port and two supplies is complete at 5–6 symbols. The threshold counts ink, not completeness. |
| D7 | Four isolable fire points open the inspector, not a schematic | Leave; H3 lists them as "inspector by design" | The isolation workflow is in the inspector. A schematic in front of it adds a click to a safety task. |
| D8 | Spacing-scale sweep (203 off-scale values) | Do not sweep | It moves pixels on every tab for no reader-visible gain and cannot be proven better. New CSS follows the scale; old values change only when their block is edited. |
| D10 | Page title is 77 characters (audit E2) | Keep | The operator-UI contract (`ship-gate` step 53) requires "Simulated Operations" in the title; a 59-character title dropped it and failed that gate. Saying the page is simulated and naming the platform outrank the length. |
| D9 | Commissioning scenarios (R135, W6) | Start phase C0–C1 (Node only, no page change) now; the page phases wait for the owner's acceptance of the drawings | C0–C1 is schema, engine and tests: it cannot disturb what the owner is still judging. |

## 1. P1 — the tier comes from the server (HIGH)

### 1.1 What is wrong today

| Finding | Evidence | Status |
|---|---|---|
| Any session with an email is Pro | `auth.js` `getTier()`: no session → `free`; demo email → `demo`; every other email → `pro`. The `tier` stored in the record (from `profiles.tier`) is not read. | Read from the code, not yet reproduced in a browser. First task of P1 is the law that reproduces it. |
| The record itself is client-written | v3.64.0 closed this for `root` and `educator` only. | Proven (laws Z1–Z4). |
| A free sign-up exists | `account.html` sign-up; migration `2026-11-14-signup-never-root.sql`; `profiles.tier` default `free`. | Read. |
| 64 Pro-only and 96 demo-or-Pro features over 57 page entries | `js/rz-feature-flags.js` matrix. | Counted. |
| A server-side engine endpoint exists | `cf-worker/src/calc.js`: `POST /calc`, allow-listed models, optional Supabase JWT check (`verifyToken`). No site page calls it today (only the DCMOC bundle references `/calc`). | Read. |

Consequence: a visitor who signs up for free, or types a record, gets every Pro feature. Nobody has to forge anything.

### 1.2 Target

1. `getTier()` returns what the server says: `proven.tier`, the `tier` of the profile row of the account Supabase's
   server confirms (`getUser()` → `getProfile()`), never the record's field and never "has an email".
2. The demo account is a real Supabase account with `profiles.tier = 'demo'`. Its published password stays published.
   The offline list `VALID_USERS` is removed: with Supabase unreachable nobody is signed in, and the calculators run in
   their free mode (they already do for a visitor who never signs in).
3. Paid computation that should not be readable in the page source moves behind `POST /calc` with the JWT gate on.
   This is phase 2 and is decided per calculator, not as a sweep.

### 1.3 Phases

| Phase | Release | Change | Files | Executor |
|---|---|---|---|---|
| P1-0 | no release | Laws first, red: T1 a free profile reads `free` and a Pro-only control stays locked; T2 a typed `tier:"pro"` record reads `free`; T3 the demo account reads `demo`; T4 a Pro profile reads `pro` with no prompt left open; T5 with Supabase unreachable a previously proven Pro user is not signed out and not upgraded (reads the last proven tier for this tab only, held in memory) | `tools/test-tier-authority.mjs` (new), stub `tierSupabaseBody({tier})` in `tools/lib/signed-in-supabase.mjs` | Opus |
| P1-1 | v3.66.0 | `proven` gains `tier`; `getTier()` reads it; `proveIdentity()` runs for every record with an email, not only privileged claims; while pending, Pro controls render locked without a prompt and re-render on `rz-auth-change` | `auth.js`, `auth.min.js`, `js/rz-feature-flags.js` | Opus |
| P1-2 | same release | Sample every page family that reads the tier once at load and never again: one calculator with PDF export, one with Monte Carlo, `account.html`, one article with a Pro block. Each must re-render on `rz-auth-change`. | page fixes as found | Opus finds, Ark fixes per page (≤ 2 files a card) |
| P1-3 | v3.66.1 | Demo as a Supabase account; `VALID_USERS`, `findUser`, the offline branches and the demo literal removed from `auth.js`; public copy unchanged | `auth.js`, `auth.min.js`; one SQL statement for the owner to run (in the PR text, not executed by the build session) | Opus |
| P1-4 | later, per calculator | Pro-only result computed by `POST /calc` with the Supabase token; the page keeps its free computation | `cf-worker` (deploy by the owner), one calculator at a time | design per calculator |

### 1.4 Risks and how each is held

- A paying user sees a locked control for the time Supabase takes to answer. That time is not measured yet: law T6
  measures it (p95 from load to unlocked ≤ 1.5 s on the local stub, and the live figure is reported beside it).
  Mitigation: no prompt while pending; one re-render.
- A page that reads the tier once and never listens. Mitigation: P1-2 sample plus a static scan for
  `getTier(` / `.tier ===` without an `rz-auth-change` listener; every hit is a card.
- The owner cannot sign in after the change. Mitigation: T4 on the stub, then the owner's two-minute check (§7) before
  the next release is built on top.
- Every signed-in page load now loads the Supabase module (it did only for privileged claims). Cost to measure in P1-0:
  bytes and time of the module on a cold and a warm cache; if it exceeds 150 ms p95 warm, the proof result is cached in
  memory per tab (never in storage).

### 1.5 Done when

T1–T6 green, each quoted red on v3.65.3; Z1–Z4 still green; `test-rz-ops-access`, `test-feature-overrides`,
`audit-page-gates` green; the owner confirms a root, a Pro and the demo sign-in on the live site; `AUTH_STANDARD.md`
states that tier and role have one source.

## 2. P2 — two pages still unlock from the record before auth.js decides (MEDIUM)

| Page | Code | Effect |
|---|---|---|
| `dc-conventional.html` | `readSessionDirect()` and its own `ROOT_EMAILS` list (line 1751 on) | a typed record with a root email reads as root in the page's own gate |
| `ltc-system-modelling-lab.html` | `rootFastPath()` (line 5548): a root email in the record removes `body.locked` synchronously | the page opens for a typed record, before `_rzAuth` exists |

Both belong to other work streams. Change, identical on both: delete the direct reader and the email list; the gate
calls `_rzAuth.enforceTierFeatureAccess(pageKey)` when `_rzAuth` exists and keeps `body.locked` otherwise (the pattern
datahallAI has since v3.63.2). Law: the Z1 set of `tools/test-dh-operator.mjs` parameterised by page — seven typed
records, nobody signed in, the page stays locked; the proven root still opens.

Execution: offered to the owning stream as a ready card (two files, one law). If the owner prefers, the build session
does it in one release (v3.66.2) after telling that stream — it is the same six-line change that shipped on datahallAI.

## 3. P3 — the Supabase client served from this site (MEDIUM, needs the owner's yes)

Today: `js/rz-supabase.js` imports `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2/+esm` (version pinned,
no integrity; an ES module import cannot carry one). A compromised CDN response would run inside every sign-in.

Change:
1. Download that exact file once, with the owner's permission, into `js/vendor/supabase-js-2.110.2.esm.js`. The `+esm`
   build imports its dependencies by URL: the file and each dependency it names are vendored, or the single-file
   bundle (`dist/umd/supabase.js`) is used through a small ES wrapper. Which one is decided by reading the downloaded
   file, not assumed here.
2. Record the SHA-256 of each vendored file in `js/vendor/SUPABASE_VENDOR.md` with the URL and date.
3. `js/rz-supabase.js` imports the local path. CSP (if a page sets one) loses the jsDelivr script source.
4. Law V1: no file under the repo root that a page loads imports from another origin
   (`grep` over tracked `.js`/`.html` for `import … from 'http`), allow-list empty. Red today on `rz-supabase.js`.
   Law V2: the vendored files' hashes equal the recorded ones.
5. Upgrade procedure in the vendor note: download, diff the changelog, re-hash, run Z1–Z4 and T1–T6.

Release v3.66.3. Executor: Opus (auth path). Rollback: one import line.

## 4. P4 — page weight (MEDIUM)

### 4.1 Measured

| Quantity | Value |
|---|---|
| `datahallAI.html` | 1,372,791 bytes raw, 377,627 gzip |
| Inline script | 1,188,664 bytes in 9 blocks: 916,645 (line 1575), 238,550 (line 12808), 18,146, 6,483, 4,058, four smaller |
| HTML + CSS without inline script | 184,127 bytes |
| External scripts | 45, all same-origin |
| Tools that search for text found only inside the two big blocks | at least 8, by a static scan of their string and regex searches: `test-datahall-ai-hmi-payloads`, `test-dcai-security-zones`, `test-dcai-wan-study`, `test-rz-diagram-engine`, `test-dcai-voltage-chain`, `test-diagram-engine-adoption`, `report-datahall-globals`, plus the page-wide scanners (`audit-script-tags`, `audit-js-syntax`, colour and slop sweeps) that read every inline script |

Correction of an earlier statement: the plan said "29 tools parse the inline source". That was a filename grep that
also counted site-wide tools such as the sitemap builder. The static scan above gives at least 8; the true number is
what phase P4-0 measures by running the gate against a moved copy.

### 4.2 Why move it

The two blocks change in most releases, and every change re-downloads 377 KB gzip of a document the service worker
cannot split. As external files: the document drops to about 184 KB raw, each script is cached under its own token,
and a release that touches one of them re-downloads only that one. Parse and execute time does not change by moving
(same code, same order); the win is transfer and cache, and the SEO ledger row 8 (heavy page on mobile) can be
re-measured, not assumed closed.

### 4.3 Design

- Move, do not rewrite: block at line 1575 → `js/datahall-ai/page-core.js`, block at line 12808 →
  `js/datahall-ai/page-studio.js`, each loaded by a classic `<script src>` at the same position, no `defer`, no
  `async`, no module: execution order and globals stay byte-for-byte the same.
- `</script>` inside JS strings stays escaped (`<\/script>`); in an external file it is harmless either way.
- One reader for tools: `tools/lib/page-source.mjs` → `pageSource('datahallAI.html')` returns the HTML with every
  same-origin classic script inlined at its tag (what the page was before the move). A tool that searched the page for
  code calls it instead of `readFileSync`. Python tools get the same function in `tools/lib/page_source.py`.
- Tokens: the two new files are STRICT assets (`test-asset-cache-tokens`).

### 4.4 Phases

| Phase | Release | What | Exit |
|---|---|---|---|
| P4-0 | none | In a scratch worktree: move the two blocks, run the full sharded gate, list every failing step. Nothing is committed. | the list of tools that need `pageSource`, with owner stream per tool |
| P4-1 | v3.67.0 | `page-source` helper + its test (`pageSource(x)` of the unmoved page equals the file); the listed tools adopt it while the page is still unmoved — every gate stays green and nothing has moved yet | gate green; adoption is a no-op, proven by identical gate output |
| P4-2 | v3.67.1 | Move the 239 KB block (the smaller one first) | gate green; law W1: inline script ≤ 960 KB; `pageSource` equals the pre-move page byte for byte |
| P4-3 | v3.67.2 | Move the 917 KB block | law W1 tightened: inline script ≤ 40 KB; document ≤ 220 KB raw; O11 frame budget unchanged; first paint not later than before on the throttled profile (measured before and after, same machine, 5 runs, medians) |

P4-1 touches tools of other streams. They are told before P4-0's list is acted on; a tool whose owner says no keeps
reading the file and gets the moved code through `pageSource` in a wrapper the build session owns.

### 4.5 Risks

- A tool reads the page by a path the scan missed and silently measures less (a count that falls because the code is
  elsewhere reads as "cleaner"). Mitigation: P4-0 compares every gate's printed totals before and after, not only its
  exit code; a total that changes is a finding.
- Blocking external script fetches add a round trip on a cold cache. Mitigation: `<link rel="preload" as="script">`
  for both in the head; measured in P4-3.

## 5. P5 — commissioning scenarios (R135)

The concept and PRD exist: `PRD_CX_SCENARIOS.md` (schema v1, 31 scenarios S00–S30, response engine, console, laws
C1–C10, phases C0–C6). Nothing is built. What this PRD adds is the start order.

| Step | Release | Scope | Why now |
|---|---|---|---|
| C0 | v3.68.0 | `standarization/CX_SCENARIO_STANDARD.md`; `tools/test-cx-scenarios.mjs` with laws C1–C4, C8 written and red; `data/cx/scenarios/` empty | fixes the contract before any code |
| C1 | v3.68.1 | schema validator, role bindings for datahallAI, S00, S01, S30 as JSON; `js/rz-cx-sim.js` (electrical + UPS state of charge + first-order thermal); engine additions `equipment.ups_runtime_min` and `DATA.commissioning.limits` with sources; Node laws green. No page loads the file. | the owner's acceptance of the drawings is not touched by a Node module |
| C2 on | after acceptance | console on DH-E-101, painting, alarms; then cooling, fire, settings, records | owner rule in the PRD |

Hard rules carried over: pass and abort limits are relative to the engine's design values, the handbook's MSC-1 numbers
are display examples only; the thermal model is first order, declared, calibrated once against the handbook record
(inlet 25.9 °C at T0 + 4 min, TCS 46.2 °C at T0 + 3 min, within ± 0.3 K) and labelled as a model in the console.

## 6. P6 — drawings: what is finished, what changes in the gate

- H3 becomes three numbers instead of one: schematic drawn (32 of 45), inspector by design (4: fire point, aspirating
  detector, call point, EPO), and for each drawn class its symbol count without a threshold. The line "drawn with
  < 8 symbols" is removed (D6). Law change only; red proof: the new H3 must still fail when a drawn class stops
  drawing (mutation: return early from `leakL3`).
- Verification debts from v3.63.3, closed by a law each: the stand-alone CDU modal trend (reach it in the gate by
  removing the page opener for one page load, assert ≥ 2 distinct values in 48 points); the per-hall mimic (open the
  mimic for hall 3 under a scenario that differs between halls, or, if no scenario does, record that halls are
  electrically identical in the engine and the law cannot distinguish them — then the fix stays "by reading").
- The sidebar width transition (`css/rz-dh-shell.css:41`): keep. It animates an absolutely positioned overlay of 200
  px, uses the motion tokens and has a reduced-motion rule; the audit rule targets layout-shifting width changes.

One release, v3.66.4, test and standard only.

## 7. P7 — what only the owner can do (about ten minutes in total)

| # | Action | Needed by |
|---|---|---|
| O1 | Sign in on the live site as root, open `datahallAI.html` and `rz-ops.html`; then as a Pro account; say what happened | before P1-1 is built on top of v3.64.0 |
| O2 | Yes or no to downloading one pinned file from jsDelivr into the repo | P3 |
| O3 | Create the demo account in Supabase with `profiles.tier = 'demo'` (statement supplied in the P1-3 release notes), or allow the admin function to do it | P1-3 |
| O4 | Deploy the Worker with the JWT gate on, when a calculator is chosen for server-side Pro results | P1-4 |
| O5 | Accept or comment on the drawings (tabs and the ten new schematics) | P5 from C2 |
| O6 | Tell the Conventional and LTC streams about P2 and P4-1, or allow the build session to | P2, P4 |

## 8. Order, releases, effort

| Order | Item | Releases | Gate runs | Blocked by |
|---|---|---|---|---|
| 1 | P6 gate and debts | v3.66.4 | 1 | nothing |
| 2 | P5 C0–C1 | v3.68.0, v3.68.1 | 2 | nothing |
| 3 | P1-0 laws (red) | none | 0 | nothing |
| 4 | P1-1, P1-2 | v3.66.0 | 1 | O1 |
| 5 | P4-0 dry run | none | 1 (scratch) | nothing |
| 6 | P2 | v3.66.2 | 1 | O6 |
| 7 | P3 | v3.66.3 | 1 | O2 |
| 8 | P1-3 | v3.66.1 | 1 | O3 |
| 9 | P4-1 – P4-3 | v3.67.0 – .2 | 3 | O6 |
| 10 | P5 C2 on | v3.68.2 on | per phase | O5 |
| 11 | P1-4 | per calculator | per calculator | O4 |

Items 1, 2, 3 and 5 need nobody: they start first. One full gate is about two hours on this machine; at most one runs
at a time; the tree is not edited while it runs.

Version numbers are the planned order, not a promise: a release takes the next free number when it ships.

## 9. Laws added by this PRD (each proven red before it is trusted)

| Law | Claim | Red on |
|---|---|---|
| T1–T5 | tier = server profile; typed record and free sign-up read `free`; demo reads `demo`; Supabase unreachable neither upgrades nor signs out | v3.65.3 (`getTier` returns `pro` for any email) |
| T6 | p95 time from load to unlocked for a proven Pro user ≤ 1.5 s on the stub | a deliberate 3 s delay in the stub |
| Z1 per page | the seven typed records keep `dc-conventional.html` and the LTC modelling lab locked | their current gates |
| V1, V2 | no cross-origin script import; vendored hashes match | `js/rz-supabase.js` today; a changed byte |
| W1 | inline script budget of `datahallAI.html` | today's 1,188,664 bytes |
| W2 | `pageSource(page)` equals the pre-move page | a block moved without the helper |
| H3 (new form) | every class is drawn, or listed as inspector by design | early return in one builder |
| C1–C4, C8 | as `PRD_CX_SCENARIOS.md` §9 | the mutations named there |

## 10. Not in this PRD

Delivering the HTML of gated pages from a server (the cockpit pages are static files on GitHub Pages: a visitor can
always download them; P1 protects features and paid results, not markup). Changing the tier model or prices. The
Conventional cockpit's own audit plan (`standarization/Audit result/CONV_EXECUTION_PLAN_2026-11-16.md`).
