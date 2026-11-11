# QA review, batch 3: PRD-Q10, PRD-Q11, PRD-X-DEFECTS, plus a spot re-check of PRD-Q17 and PRD-Q09

Reviewer: an independent QA agent (Opus 5.5). It did not write these PRDs. Date 2026-11-11.
Tree: `wt-hub3` at `ed815502e` ("docs: PRD-Q11 and PRD-X-DEFECTS; Q10 decisions migrated to D-Q10-n; DECISIONS.md 86 rows").

Rules applied:
- The 12 dimensions of batches 1 and 2, each scored 0–5. A PRD passes only if every dimension is at least 4.
- I did not trust any self-score.
- Every code claim in the tables below was run on this tree, and the decisive output is quoted.
- Nothing was changed except this file.
- No secret value was printed. Key-shaped strings were checked with `grep -c` and line numbers only.

## Summary

| PRD | Compl. | Feas. | Func. clarity | Journey | UI/UX | Data model | API | Cross-module | Errors | Security | Testability | Impl. ready | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q10 admin on real data, consent-gated counts | 5 | 4 | 5 | 5 | 4 | 5 | 4 | **3** | 4 | **3** | 4 | **3** | **FAIL** (cross-module, security, implementation readiness) |
| Q11 server-side feature flags | 5 | 4 | 5 | 4 | 4 | 5 | 4 | 4 | 4 | **3** | 4 | 4 | **FAIL** (security) |
| X-DEFECTS verified defect fixes | 5 | 4 | 5 | 4 | 4 | 4 | 4 | **3** | 4 | 4 | 4 | 4 | **FAIL** (cross-module) |
| Q17 spot re-check (API, cross-module, security, impl. readiness) | — | — | — | — | — | — | 4 | 4 | — | 4 | — | 4 | **PASS** (self-scores confirmed; one fix) |
| Q09 spot re-check (testability, plus drift found) | **4** (was 5) | — | — | — | — | 4 (was 5) | — | **3** (was 4) | — | — | 4 | — | **FAIL** (cross-module: the tree moved under the PRD) |

### Claim checks

I checked 41 claims. **6 are STALE and 0 are FALSE in the code facts.** All 6 stale items come from commits that landed after the PRD's "facts verified at" commit. Separately, three cross-PRD statements are contradicted by another PRD (Q10 §13 against Q07 and Q17), and two engine-propagation steps are missing (X-DEFECTS FR-X15.5).

#### Red-today and fact claims

Every red-today claim I ran fails the way the PRD says it does.

| # | PRD | Claim | Decisive output | Verdict |
|---|---|---|---|---|
| 1 | Q10 P1, L1 | `Math.random` on 6 lines and `rand(` on 27 lines in `rz-ops-p7x3k9m.html`. `generateUsers` appears 3×, `seedUADemoData` 2×, `generateActivities` 3× | `6`; `27`; `2481, 2586, 6054` / `5528, 5658` / `2481, 2611, 6057` | TRUE |
| 2 | Q10 P4 | literals at `:894`, `:911`, `:921`, `:1970`, `:1975`, `:1980`, `:4890`, `:4892` | grep lists exactly those 8 lines | TRUE |
| 3 | Q10 P8 | `rz_newsletter_subscribers` appears only in the admin | `rz-ops-p7x3k9m.html` | TRUE |
| 4 | Q10 P10 | Mayar base URL at `:4975`; key read from localStorage at `:4989` | `4975:var MAYAR_API_BASE=…`, `4989: …getItem('rz_mayar_key')` | TRUE |
| 5 | Q10 P12 | the only network call in `rz-tracker.js` is `:38` (`ipapi.co`) | `38: return fetch('https://ipapi.co/json/'…` | TRUE |
| 6 | Q10 P13 | 46 bare tags and 15 tokened tags; token `180645d6`; 7,581 bytes | `46 src="rz-tracker.js"`, `15 …?v=20260920-180645d6`; `sha256 180645d6`; `7581` | TRUE |
| 7 | Q10 P15 | 162 GA files: 83 root, 5 loaded by a classic `async` tag (`changelog` + 4 embeds) | `162`; root 83; `changelog.html embed/pue-widget.html embed/carbon-widget.html embed/index.html embed/capex-widget.html` | TRUE |
| 8 | Q10 P15 | `index.html:26-28` loads GA on first interaction with no consent check | `['scroll','click','keydown','touchstart'].forEach(…loadGtag…)` | TRUE |
| 9 | Q10 P16 | `privacy.html:399` promises withdrawal; `:273` is dated December 11, 2025 | both lines as quoted | TRUE |
| 10 | Q10 P18, N6 | `log_event` is revoked from `anon` only, and no function is revoked from PUBLIC | `revoke execute … log_event … from anon;` (`schema.sql:965`); `from public` matches `:45` (schema CREATE) only | TRUE |
| 11 | Q10 P21 | 7 `(window.showToast\|\|alert)` sites; `rz-toast.js` is loaded on 3 pages | `7`; `cdu-calculator.html changelog.html rfs-readiness-workbench.html` | TRUE |
| 12 | Q10 L4 | `gate-gtag-consent.py` hardcodes another checkout and is wired nowhere | `:13 ROOT = Path("/home/baguspermana7/rz-work")`; `grep -c gate-gtag-consent tools/ship-gate.sh` → `0` | TRUE |
| 13 | Q10 L4 | generator literals at `build-changelog-html.py:445` and `generate-city-pages.py:119`, `:1009` | each line is the eager `<script async src=…gtag/js…>` | TRUE |
| 14 | Q10 §13 | `js/rz-cookie-consent.js` is loaded by 246 HTML files | `git grep -l` → 246 at `9e49bfefd`, **253 at HEAD** | STALE (+7 incident pages) |
| 15 | Q11 P7 | 5 LTC pages call keys that the matrix lacks; the matrix keys sit at `:317`–`:333` | each `matrix=0`; `'ltc-ashrae'`, `'ltc-uptime'`, `'ltc-ansi-tia'`, `'ltc-iso-energy'`, `'ltc-nfpa'` | TRUE |
| 16 | Q11 P8 | `datacenter-solutions.html:639` gates the LTC card; module not loaded | the line is `…enforceTierFeatureAccess('standards-ltc-lab')`; `grep -c rz-feature-flags.js` → `0` | TRUE |
| 17 | Q11 P9, P10 | 57 page keys, 204 cells, 64 feature keys, 42 `page-access`, function key `canAccess` | node eval: `pages 57 cells 204 featurekeys 64 page-access 42 fnkeys [ 'canAccess' ]` | TRUE |
| 18 | Q11 P2, P3 | 9 `rz_admin_features_by_page` lines; the server methods have 0 callers | `9`; `0` | TRUE |
| 19 | Q11 P13 | the presets `all_pro+` = `pro_only` and `all_demo+` = `demo_up` | `sed -n 3669,3675p`: identical assignments | TRUE |
| 20 | Q11 P15 | 59 HTML files load the module; 58 call `enforceTierFeatureAccess` | `59`/`59` at `9e49bfefd`; **`66`/`66` at HEAD** | STALE (7 new `incident-*.html`) |
| 21 | Q11 §10.2 | the column grant keeps `setFeatureOverride` working | `js/rz-supabase.js:460` selects only `page_key, feature_key, tier, enabled` | TRUE |
| 22 | X-DEF X1-a/c | literal fallback at `:4358`, persisted at `:4359`; key `rz_ft_key` | `4358`; `grep -c "…\|\|'<40 alnum>'"` → `1` (value not printed); `:4359 …setItem(CFG.LS.KEY,S.fhKey)`; `KEY:'rz_ft_key'` | TRUE |
| 23 | X-DEF X1-i | Google-key shapes at `F-tech-debt.md:105`, `SUPABASE_FIREBASE_SETUP.md:45`, `:90`, `validate-security.py:30`; a DB URL with a password at `:123` | line numbers only: `105`; `45 90`; `30`; `123`; `git grep -l` → exactly those 3 files | TRUE |
| 24 | X-DEF X7-b/d/e | 213 `<loc>`; the crawler suite fails 1 of 36; not wired | `213`; `Ran 36 tests … FAILED (failures=1)`; `0` | TRUE |
| 25 | X-DEF X7-g | 94 FAQ pages, 77 of them with hidden questions, 263 hidden (the PRD's figure came from a one-off scan) | my independent rescan: `94 faq pages; 77 with hidden; 263 hidden of 354` | TRUE (reproduced) |
| 26 | X-DEF X8-a | both Workers are named `rz-finance-gateway` | `cf-worker/wrangler.toml:1` and `worker/wrangler.toml:1` | TRUE |
| 27 | X-DEF X11-a | 23 tool cards | `23` | TRUE |
| 28 | X-DEF X12-a/d | `dashboard.html:1306` toast; `dc-market-tracker.html:1353` | `(window.showToast\|\|alert)('Account settings coming soon.')`; `:1353` placeholder | TRUE |
| 29 | X-DEF X15-a/c | A1 is labelled "recommended" at `:8754`; H1 is 17–45 "liquid" at `:8758`; `ltc-ashrae.js:25` gives H1 5–25 | lines as quoted | TRUE |
| 30 | X-DEF X15-g | "no page pins 2.5.1" | the HTML hits are prose (`manual/capex.html:332`, `manual/dcmoc.html:334`). But `dcmoc/src/lib/engine-catalog.json:4` `"dataVersion": "2.5.1"` is baked into the DCMOC bundle (`dcmoc/_next/static/chunks/app/page-…js` `{"VH":"2.5.1",…}`) | TRUE for pins, but the propagation consequence is missed (see X-DEFECTS fix 1) |
| 31 | X-DEF X18-a | `rz-gamification` loads on 1 page | `achievements.html` | TRUE |
| 32 | X-DEF X19 | stale sentence at `:98`; `rz-alarm-state.js` loads on 5 pages incl. `ict` | `EPMS_Telemetry.html untouched per owner mandate.`; datahallAI, ict, chiller-plant, water-system, fire-system = 1 each | TRUE |
| 33 | Q17 §11.6 | `auth.js:309` `isRootSession`, exported at `:788`; `getTier` returns `pro` for any signed-in non-demo user (`:1034-1042`) | lines as quoted | TRUE |
| 34 | Q17 v1.1 | `ensureSupabase` appears only in withdrawal text | 2 hits: change history `:26` and §11.6 `:602` | TRUE |
| 35 | Q17 / Q04 | Q04 records Q17's dependency on its output | `grep -c 'depends on its output contract' PRD-Q04/PRD.md` → `1` | TRUE |
| 36 | Q09 v1.1 | `"Press-sourced"` is an existing hub word | `tools/build-incidents.py:591 … ("Press-sourced", "st-press")` | TRUE |
| 37 | Q09 F1 | 43 dossiers | `644b810d4`: 43; **HEAD: 50** (`75c4cd576`, `0f3fd9f0f`, `7d8037737`, all before the v1.1 commit `d64be0c1a` at 20:10) | STALE |
| 38 | Q09 F11 | `referenceCount` on 28 dossiers | `git grep -l referenceCount -- 'data/incidents/*.json'` → **35** | STALE |
| 39 | Q09 F8 | master list 113 entries, `withPostmortem` 60 | **`{'count': 130, 'withPostmortem': 77}`** (`5c2c9e505` added 17 AWS PES / Azure PIR candidates) | STALE |
| 40 | Q09 O7 / F12 | 3 dossiers without coordinates | **10**: the 3 named, plus `gcp-europe-west4-a-drups-cooling-2026`, `gcp-europe-west2-b-plc-power-2026`, `aws-eu-west-1-dublin-plc-2011`, `aws-tokyo-cooling-control-2019`, `aws-sydney-drups-voltage-sag-2016`, `azure-australia-east-chiller-restart-2023`, `azure-southeast-asia-chiller-lockout-2023` | STALE |
| 41 | Q10/Q11 | the paid-service check (owner rule R114) | No new paid service or pay-per-use API was found. Supabase is on the existing plan; GA4 is free; `ipapi.co` is removed; Mayar is the owner's existing payment provider; PGlite is MIT, dev-only; Cloudflare dashboard reads are free | TRUE, but Q10 never states R114 (grep `R114` → 0) |

#### Cross-PRD contradictions

| # | Statement | Contradicted by |
|---|---|---|
| X1 | `PRD-Q10:240` and `:1716`: "PRD-Q07 adds `fault_run_start`" | `PRD-Q07:1039` T-15: "call no tracker or analytics"; `PRD-Q07:892`: "A gate assertion: no `rzTrack`/`track(` call in `js/rz-fault-*.js`" |
| X2 | `PRD-Q10:240` and `:1716`: "PRD-Q17 adds `path_start`/`path_complete`" | `PRD-Q17:305` and `DECISIONS.md` D-Q17-4: `path_step_done` / `path_done`. Q10 L5 S10 requires the three whitelists to be identical, so whichever names are adopted must be written once. This was already raised as `03-architecture/ARCHITECTURE.md:140` (K8) and is still unfixed in Q10 |
| X3 | `PRD-Q10:538` FR-6 inputs: "every `.html` … that contains `G-GED7FX8RTV`" | `STATE.md:46` names `cx-*` and `id/index.html` meta as peer-owned files. `cx-calculator.html` and `id/index.html` each carry 1 GA loader. Raised as ARCHITECTURE K10; still unfixed |

---

## PRD-Q10: admin console on real data, with consent-gated, PII-free usage counts (v1.0)

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. P1–P22 were verified with commands, and the 13 code claims I re-ran hold (#1–#13). New findings N1–N12 go beyond the addendum (GA before consent, `log_event` PUBLIC grant, e-mail in tracker history) |
| Technical feasibility | 4 | SQL, tracker, sweep and proxy are ordinary work. Two items are unproven until built: the PGlite harness (T-1, with a Docker fallback), and A4, which says a `sb_publishable_` key works as `Authorization: Bearer` on `/rest/v1/rpc`. A4 is verified only live (V-3), after the push |
| Functional clarity | 5 | FR-1…FR-17 give an exact processing order. For example, FR-2 steps 1–7 cover validate, purge, minute cap, update, cardinality cap and insert |
| User journey | 5 | J1–J11 cover first visit, Accept, Decline, GPC, withdrawal, owner, usage, audit, Mayar, non-root, and Supabase down |
| UI/UX depth | 4 | §9.1–§9.10 give the nav before and after, layouts, an HTML contract, four states per card, exact copy, and the register (L8). The rebuilt panels have no visual mock before T-13 |
| Data model | 5 | Module 10 DDL with CHECKs, RLS on with no policy, explicit revokes, a 400-day purge, and the wire payload contract (§10.3) |
| API contracts | 4 | §11.2–§11.9 give RPC shapes, the `mayar-proxy` action table and error codes. FR-2 says "a JSON string" while the SQL `returns text`. PostgREST serialises both the same, but the contract should name one |
| Cross-module | **3** | §13 still carries two event-name contradictions (X1, X2) and sweeps two peer-owned files (X3). The architecture review raised all three (K8, K10); none was revised into the PRD |
| Error handling | 4 | E1–E-n (§17) cover storage blocked, offline, missing function, upstream 429/504 and the double-submit of `invoice_create`. Missing: what happens when the owner declines any of the 11 decisions (Impl. readiness, fix 3) |
| Security | **3** | Grants, a forced root check, the key out of the browser and XSS/CSV handling are all specified. Two gaps. (a) The anonymous write path can be denied by one client. `p_page` accepts any path matching `^/[A-Za-z0-9/_.-]{0,119}$` (`:421`), the global cap is 300 events a minute for the whole site, and the cardinality cap is 1,000 keys a day (`:55`). One script with the public key can hold the counter at `limited` all day, or fill the day's 1,000 keys with junk pages so that every real new key lands in `_overflow`. The PRD calls this "bounded" (`:299`, §16 threat table), but it zeroes the feature the admin now trusts. (b) Two new `security definer` functions widen root's read surface beyond today's RLS: `admin_account_summary` reads `auth.users` (§10.2, SQL lines 196–197 of the block), and `admin_scenario_summary` counts other users' `saved_scenarios` (own-row only today, P19). Neither is listed under an approval id |
| Testability | 4 | L1–L8, each with a red-today line I could check (#1, #5–#8, #10, #12). L2's positive path avoids the tracker's local exemption by host mapping (`rz.test`, T-7). The SQL is tested on a real engine (L5). There is a contract fixture between SQL and the browser stub |
| Implementation readiness | **3** | v1.0 never received the program conventions applied to every other PRD in batches 1 and 2: no law-wiring table with preconditions and report mode (D9; `grep -c "report mode"` → 0); no R114 statement (`grep -c R114` → 0); no "if rejected" path for any of D-Q10-1…11 (`grep -ci "if rejected\|declin"` → 0), although every `DECISIONS.md` row D-Q10-n says "the PRD's 'if rejected' path applies". L1 asserts deletion (D-Q10-6) and L2 asserts GPC behaviour (D-Q10-3). A declined decision leaves a law that can never pass, with no stated alternative |

**Verdict: FAIL** (cross-module 3, security 3, implementation readiness 3).

### Required fixes

1. `PRD-Q10/PRD.md:240` and `:1716`: delete "PRD-Q07 `fault_run_start`". Q07 T-15 (`PRD-Q07/PRD.md:1039`) forbids tracker calls. Replace `path_start`/`path_complete` with the D-Q17-4 names (`path_step_done`, `path_done`), and state that they join the whitelist only if D-Q17-4 = B. Update L5 S10 (`:1990`) so the parity list follows that.
2. `PRD-Q10/PRD.md:538` FR-6 inputs and §13 (`:1709-1710`): exclude `cx-calculator.html` and `id/index.html` from `--apply`. Hand the peer the template, and make `--check` report those two as `peer-owned, pending` until the peer confirms. The alternative is to record the peer's written agreement in `STATE.md`. The target stays 162/162 only once the peer has applied it.
3. `PRD-Q10/PRD.md:269-283` §5.7: add an "If declined" column for D-Q10-1…11. Examples: D-Q10-6 declined means FR-X10 labels stay and L1 asserts labels, not absence; D-Q10-3 declined means the GPC cases leave L2; D-Q10-1 declined means no counter, the Usage panel shows "Not collected", and L3 and L5 run in report mode. Add the D9 law-wiring table (law · blocking from · precondition) after §20.2 (`:1993`), and a §5.5 line stating R114.
4. `PRD-Q10/PRD.md:420-421` FR-2 step 1 and the §10.2 SQL: validate `p_page` against a server-side allowlist, for example a `usage_pages` table generated from the 62 tracker pages and refreshed by the release chain, or a CHECK against a fixed array, and map anything else to `/other`. Validate the `rz_search_go` detail against the same allowlist. Then the 1,000-key cap cannot be filled with junk.
5. Same place: replace the single global 300/min bucket with a design one client cannot exhaust, or state the denial risk plainly. The honest minimum is an R-row "one client can saturate the counter; capped minutes are shown per day" plus an admin banner when more than X % of a day's minutes were capped. Add an L5 case S11: 301 calls with a junk page, then a valid page → the valid page is counted or reported as capped, as specified.
6. `PRD-Q10/PRD.md:443-460` FR-3 and §5.7: add D-Q10-12, "new root-only definer reads over `auth.users.last_sign_in_at` and over all users' `saved_scenarios` (aggregate counts only)", marked "Requires owner approval — auth boundary". Or fold both into D-Q10-1's text in `DECISIONS.md`.
7. `PRD-Q10/PRD.md:9` (`js/rz-cookie-consent.js` "246 HTML files"): re-count at the implementing commit. It is 253 at `ed815502e`. Make T-5's token refresh enumerate files by `grep`, not by the number.
8. `PRD-Q10/PRD.md` FR-2 Outputs: say `text` (`ok` | `limited` | `invalid`), as the SQL returns it, or change the SQL to `returns jsonb`.

---

## PRD-Q11: server-side feature flags (v1.1)

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | All 24 sections are present. P1–P15 were verified (#15–#21), with new findings N1–N8: pro and educator users locked out of 5 LTC pages, the hub card, 162 inert cells, the `canAccess` tab |
| Technical feasibility | 4 | One anonymous REST GET, a column grant, two triggers, an admin rewrite. The reach numbers are stale (#20: 66 module pages, not 59), so the bytes and requests in §15 rest on the old count. Module 11 adds CHECKs to a live table without first counting the rows they would reject |
| Functional clarity | 5 | FR-2 gives the resolution order step by step (cache → validate → GET → map → event). FR-1 is exact SQL |
| User journey | 4 | Admin edit, visitor read, offline, migration of local overrides, pro user on LTC. The educator path is described by reference to `:525` only |
| UI/UX depth | 4 | The panel is specified with inert rows read-only, 5 presets, a migration card and axe at 1440/390 (L8). There is no mock |
| Data model | 5 | Module 11 SQL (`:633-700`): CHECKs, a forced `updated_by`, an audit trigger with a no-op skip, a column grant; cache shape at §10.3 |
| API contracts | 4 | GET with a column list, `rzSupa` additions, the `rz-features-changed` event, `source()` and `refresh()` |
| Cross-module | 4 | Q10 (harness, `rzLoadConfig`, audit panel), Q01 (`auth.js` serialised, ARCHITECTURE K13), X-DEFECTS FR-X11.3 access words. One wording defect: L4 runs "Modules 0–11" (`:1031`), and Module 10 belongs to Q10. If Q11 ships first, that module does not exist (ARCHITECTURE K11, still unfixed) |
| Error handling | 4 | Server 500, timeout, stale cache, a malformed row, storage blocked, config missing (FR-2 exceptions, L3) |
| Security | **3** | §16 is honest that this is a UX gate. But the PRD claims objective O2, "A visitor cannot change their own flags" (`:109`), and the new design moves the same weakness to a new key. A visitor can write `localStorage['rz_flags_cache_v1']` with `fetchedAt` = now, or any future time, and rows granting `free` page access. FR-2 step 2 (`:328`) treats an age of ≤ 10 minutes as fresh and makes no request, and no lower bound on age is stated, so a future `fetchedAt` stays "fresh" forever. The forged rows pass the step 1 validation (`:325`), because only `page-access/root/false` is dropped. O2 is therefore false after the change, and L2 tests only the old key |
| Testability | 4 | L1–L8 are red today with stated failures (#15–#19). L2 needs the forged-cache case to prove O2. As written it passes while O2 fails (fix 1) |
| Implementation readiness | 4 | T-1…T-n, a D9 wiring table (`:1069-1076`) with preconditions per decision, and declined paths in the decisions (D-Q11-4, -5, -7 carry "If REJECTED") |

**Verdict: FAIL** (security 3).

### Required fixes

1. `PRD-Q11/PRD.md:109` O2, `:325-328` FR-2, `:705-718` §10.3, and `:1029` L2. Choose one of two options and say which.
   - (a) Accept that the cache is forgeable. Rewrite O2 as "the shipped and server values cannot be changed for other visitors; a visitor can still unlock their own view (UX gate, §16)", and drop the claim that a forged key no longer works.
   - (b) Make a forged cache fail closed. Never trust a cache row that grants more than the shipped matrix until a GET in this page view confirms it, or keep only "restrictive" rows (`enabled:false`) from cache.

   In both cases, reject a cache whose `fetchedAt` is in the future (`age < 0`). Add an L2 case "forged `rz_flags_cache_v1` with `fetchedAt = now` and a granting row → still locked (option b) / documented (option a)", red on the planned design.
2. `PRD-Q11/PRD.md:1031` L4 and `:1072`: replace "Modules 0–11" with "Modules 0–9, plus 10 if present, plus 11". Alternatively, state that Q10 Module 10 ships first and make that a precondition.
3. `PRD-Q11/PRD.md:17`, `:80` P15, and the §15 request and byte budget: re-count at HEAD. There are 66 HTML files loading the module and 66 calling the gate; the 7 new `incident-*.html` dossier pages gate on `dc-incidents`. Have L6 and O9 compute the count rather than quote it.
4. `PRD-Q11/PRD.md` §22.1 OA-1: before the `alter table … add constraint`, add the read-only query `select count(*) from public.feature_overrides where page_key !~ '^[a-z0-9][a-z0-9-]{0,63}$' or feature_key !~ … or (feature_key='page-access' and tier='root' and not enabled);`. If the count is greater than 0, Module 11 fails on the live table; say what the owner does then.

---

## PRD-X-DEFECTS: verified defect fixes (v1.0)

### Scores

| Dimension | Score | Evidence |
|---|---|---|
| Completeness | 5 | 15 defects: 9 active groups, 6 pointers. It corrects false filings (X7 sitemap claim false, #24; X18 1 page, #31) and adds N1–N9 |
| Technical feasibility | 4 | Copy, gates, an engine table and a two-line key removal. X1 and X8 wait on owner actions (OA-1, OA-4), as stated |
| Functional clarity | 5 | Every FR has processing and exceptions. FR-X1.2 gives the purge order and the no-Web-Crypto path exactly |
| User journey | 4 | J1–J11 are short by nature (mostly copy and data) |
| UI/UX depth | 4 | §9.10 gives exact strings, access sentences computed from the matrix, and the `tools.html` render law (L-X11.2) |
| Data model | 4 | Manifest, baseline and allowlist (§10.2–§10.3); engine shape §10.4. The new `liquidClasses` DATA table needs a `DATA.sources` entry (CLAUDE.md engine rule). FR-X15.3 writes a provenance line, but §10.4 does not name the `DATA.sources` key |
| API contracts | 4 | Gate CLIs with exit codes (§11.4); the `thermalCheck` return shape keeps every key and adds `medium` and `withinRecommended` |
| Cross-module | **3** | The appendix self-score is 5 (`:1844`). The engine release FR-X15.5 (`:862-870`) misses three consumers of `rz-engine.js`. (a) The owner-mandated AUTO-LINKING chain, `CLAUDE.md:92` "after ANY `rz-engine.js` change also run `node tools/build-engine-catalog.mjs` … then `node tools/test-value-bindings.mjs`": `grep -c "build-engine-catalog\|test-value-bindings"` in the PRD → 0. (b) DCMOC imports the catalog at build time (`dcmoc/src/components/modules/FaqDashboard.tsx:4`, `PlatformDashboards.tsx:24`), so `liquidClasses` and the version change require a DCMOC rebuild. FR-X15.5 says T-13 should confirm "that no DCMOC rebuild is needed" (`:868`). (c) `cf-worker/src/calc.js:12` bundles `../../rz-engine.js` and exposes the `architecture` namespace (`:19`, `:28`), so live `/calc` keeps the old classes until the owner redeploys. No owner action covers that |
| Error handling | 4 | E1–E24 cover a partial release, a rejected decision, a script-built FAQ and a credential that cannot be revoked |
| Security | 4 | No gate prints a value; rotation and revocation are owner-only; D-XDEF-7 covers the history rewrite. One gap: the secret scan skips `dcmoc/_next/` (`:545`) as "build output of the scanned `dcmoc/src`", but that directory is published, and Next.js inlines env values that are not in `src`. The scan should cover published output |
| Testability | 4 | 17 laws, red today. I reproduced X7's 77/263 independently (#25), and the D9 wiring and mutation proofs are present. The X11 classification (13 missing cards, 5 access failures) still rests on an uncommitted one-off script, and T-10 must reproduce it before any change |
| Implementation readiness | 4 | T-1…T-16, blocking points per law, owner gates explicit |

**Verdict: FAIL** (cross-module 3).

### Required fixes

1. `PRD-X-DEFECTS/PRD.md:862-870` FR-X15.5: add `node tools/build-engine-catalog.mjs` and `node tools/test-value-bindings.mjs` (green) to the engine release. Replace "confirm … that no DCMOC rebuild is needed" with "rebuild DCMOC (the catalog is a build-time import, `FaqDashboard.tsx:4`), following the DCMOC build traps". Add an owner action, OA-5: "redeploy `cf-worker/` so `/calc` serves the new engine (`cf-worker/src/calc.js:12`)", with a live check that `POST /calc` `architecture.thermalCheck` for liquid at 30 °C returns `W32`. Add these to §13 and the V-checks, and lower the self-score at `:1844`.
2. `PRD-X-DEFECTS/PRD.md:545` FR-X1.3: scan `dcmoc/_next/` too, as published output. Exclude only files the gate proves are byte-identical to an earlier scanned build, or add it with its own baseline. Add a self-test that plants a key-shaped string in a `_next` chunk copy.
3. `PRD-X-DEFECTS/PRD.md` §10.4 and FR-X15.3: name the `DATA.sources` entry (`source` + `asOf`) for `liquidClasses`, and the provenance string for the changed `ashraeClasses`, so the engine's sources rule is not broken.
4. `PRD-X-DEFECTS/PRD.md` §20.3: commit the X11 classification script (or its exact source) in the PRD's appendix, as was done for the sitemap check, so the reviewer can reproduce "13 MISSING-CARD, 5 ACCESS" before T-10.
5. Note for the main session (not a PRD defect): `CLAUDE.md:92` calls `test-value-bindings.mjs` a "SHIP GATE", but `grep -n test-value-bindings tools/ship-gate.sh` → no line. It belongs to the same "gate exists but is not wired" class that X7-A fixes, and could be added to FR-X7A or recorded in the register.

---

## Spot re-check: PRD-Q17 (v1.1, self-score raised 3 → 4 on four dimensions)

| Dimension | Batch 2 | Self | This review | Evidence |
|---|---|---|---|---|
| API contracts | 3 | 4 | **4** | FR-7 (`:268-277`) uses `rzSupa.ready` / `rz-supa-ready` / `getUser()` and `RZAppState.register('learning-paths/v1', …)`, which matches `PRD-Q12/PRD.md:468-481` §11.2a. `ensureSupabase` appears only in withdrawal text (#34) |
| Cross-module | 3 | 4 | **4** | Q04 output contract §11.8 (`:607`) with the reverse note in Q04 (#35); the edit order for `tier-advisor.html` (`:644`); Q12 module; Q01 renderer for "Root access". The event-name clash with Q10 (X2) is Q10's defect: Q17 matches `DECISIONS.md` |
| Security | 3 | 4 | **4** | No `auth.js` change (`:602`, `:659`, DoD `:906`); `isRootSession` exists at `auth.js:309`/`:788` (#33); L7 reads `isRootOnlyHref()` in a VM |
| Implementation readiness | 3 | 4 | **4** | T-7 depends on Q12's module, not a withdrawn export; D-Q01-3 rejected path present |

**Verdict: PASS.** The self-scores are confirmed. One required fix:

1. `PRD-Q17/PRD.md:268-277` FR-7 and `:818`: state the behaviour when D-Q12-1 = C. In that case `js/rz-app-state.js` is never built (`PRD-Q12/PRD.md:468` "option A only"): FR-7 is dropped, the page shows "Progress is saved on this device only", and L4's sync part leaves the law. Also state the chain: Q12 itself starts only after X-DEFECTS X1 closes (`PRD-X-DEFECTS/PRD.md:16`), so Q17 sync waits on the owner's key rotation.

## Spot re-check: PRD-Q09 (v1.1, testability self-score raised 3 → 4)

The testability revision holds. `--phase` appears 9 times. The law-wiring table (`§20.2`) gives each law's blocking phase and precondition. Laws whose preconditions wait on the owner (L2–L4) block only from Phase C. §20.5 replaces the "file missing" red proofs with planted fixtures, and the AC-5 word now exists in code (#36). **Testability 4: agree.**

New finding: the tree moved under the PRD before the v1.1 revision was committed, and the revision did not re-verify. Three commits landed at 18:31–18:55 on 2026-11-11, and the revision `d64be0c1a` was committed at 20:10:
- `75c4cd576`, `0f3fd9f0f`, `7d8037737` added 7 dossiers built from official post-incident reviews.
- `5c2c9e505` added 17 queue candidates.

| Dimension | Batch 2 | This review | Evidence |
|---|---|---|---|
| Completeness | 5 | **4** | F1 "43 dossiers" (`:30`, `:52`, `:86`), F11 "28" `referenceCount` (`:62`), F8 "113 entries, `withPostmortem` 60" (`:59`), O7 "3 without coordinates" (`:113`), and "75 distinct unbuilt candidates" (`:41`) are all stale (#37–#40: 50, 35, 130/77, 10) |
| Data model | 5 | **4** | The 7 new dossiers carry `officialPostmortem: true` and an ISO `lastVerified` of 2026-11-11, with no `verification` record and no `sourcing.state`. The PRD's state model and the T-2 migration ("`sourcing.state` on 43 dossiers") do not cover them |
| Cross-module | 4 | **3** | Q09 claims to own the dossier set, the state model and the build order. But a parallel incident session adds dossiers and queue entries outside Q09's flow (`tools/incidents_build_order.py`, `stamp`), and the PRD names no rule for a second writer. Owner decision D-Q09-14 (`DECISIONS.md`; `PRD-Q09/PRD.md:1193`) still says "the library has 43 … build ranks 1–7 (to 50)". The library already holds 50, so the owner would be asked a question on a false premise |
| Testability | 3 | 4 | as above |

**Verdict: FAIL** (cross-module 3). The cause is tree drift, not the quality of the revision. Required fixes:

1. `PRD-Q09/PRD.md:30`, `:41`, `:52`, `:59`, `:62`, `:86`, `:113`, and every literal 43/28/113/60/3/75 in §3, §4, §20 and Appendix A: re-verify at the current HEAD. Where a law or AC states a count, make it computed (as Q18's L7 now is).
2. `PRD-Q09/PRD.md:1193` D-Q09-14, and the matching `DECISIONS.md` row: restate it. "The library has 50 (7 added on 2026-11-11 from official reviews outside this PRD's build order); how many more?" Re-rank `_build-order.json` over the 130-entry master list.
3. `PRD-Q09/PRD.md` §13 and FR-12/FR-13: add a rule for dossiers created outside the Q09 flow. They enter as legacy ("Last verified") with `sourcing.state` set by T-2's migration. L1, L4 and L6 already compute over every dossier, so the 7 new pages (missing coordinates, `referenceCount` present) will turn those laws red at Phase A. Say this in the T-15/T-13 scope so Phase A is not blocked by surprise.
4. Same drift note for PRD-Q18 (outside this batch): its re-counts at `644b810d4` (43 dossiers, PM 30) are also stale. Its counts are computed by L7, so only the prose needs updating.

---

## Most serious findings (ranked)

1. **Q11's central security objective stays false after the change.** O2, "a visitor cannot change their own flags", is broken by forging the new cache key `rz_flags_cache_v1`, and a future `fetchedAt` stays "fresh" forever. L2 tests only the old key, so the gate would pass green.
2. **Q10's anonymous counter can be denied by one client with the public key.** A site-wide 300/min bucket, plus `p_page` accepting any path towards a 1,000-key daily cap, lets one script zero or junk the "real data" the admin is rebuilt on. Q10 v1.0 also never received the program conventions: no "if rejected" paths although `DECISIONS.md` cites them, no D9 wiring, no R114 line. It also still contradicts Q07 and Q17 on event names, and sweeps two peer-owned files.
3. **X-DEFECTS' engine release skips three consumers of `rz-engine.js`:** the owner-mandated catalog and value-bindings chain, the DCMOC rebuild (the catalog is a build-time import), and the `cf-worker` `/calc` redeploy. FR-X15.5 explicitly expects "no DCMOC rebuild".

Also: **Q09's data has drifted** (50 dossiers, not 43; 130 candidates, not 113). Owner decision D-Q09-14 now rests on a false premise.

No PRD in this batch adds a paid service or a pay-per-use API (R114). The auth and security boundary changes are marked for owner approval (D-Q10-1, D-Q10-11, D-Q11-1/2/3/8, D-XDEF-7), except Q10's two new root-only definer reads (Q10 fix 6).
