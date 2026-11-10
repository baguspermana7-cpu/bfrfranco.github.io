# PRD-Q10 — Admin console on real data, with consent-gated, PII-free usage counts

## 1. Document control

| Field | Value |
|---|---|
| PRD id | PRD-Q10 |
| Feature | Every number in the root admin console `rz-ops-p7x3k9m.html` comes from a Supabase query or the panel says "No data yet". A consent-gated, rate-limited, aggregate-only usage counter replaces the localStorage tracker that captures IP address, city and e-mail. GA4 loads only after the visitor presses Accept. The Mayar payment key leaves the browser |
| Version | 1.0 |
| Status | Draft |
| Author | Opus 5.5; Fable quota exhausted |
| Date | 2026-11-11 |
| Owner requests | R110 (a PRD per idea), R111 (24-section structure) |
| Priority | 56.0 (addendum rank 18: I 5, N 3, C 7, E 4, effort 3 weeks; `documentation/PRODUCT_INNOVATION_ASSESSMENT_2026-11_ADDENDUM.md:93`) |
| Related findings | Q10 (`…_ADDENDUM.md:440-457`). X10 (`:56`, "Admin KPIs fabricated with no label"): the interim label is specified in PRD-X-DEFECTS FR-X10 and is removed by this PRD when it ships. The rz-tracker privacy finding reported by PRD-Q17. New findings N1–N12 in §3.3 |
| Dependencies | (1) Owner approval: this PRD changes a privacy and auth boundary (`documentation/product-transformation/STATE.md:9-10`, `:52`); decisions D-1 to D-11 in §5.7. (2) Owner actions OA-1 to OA-5 (§22.1): SQL and Edge Function deploys need the owner's Supabase dashboard; credentials never pass through an agent (`STATE.md:47`). (3) PRD-Q11 shares the SQL test harness `tools/lib/pg-harness.mjs` and the config loader `rzLoadConfig()`; whichever PRD ships first creates them. (4) PRD-X-DEFECTS FR-X10 is the interim. (5) PRD-Q07 (`fault_run_start`, its T-15) and PRD-Q17 (path events, its OQ-4) add their event names to the whitelist in their own releases |
| Related modules | `rz-ops-p7x3k9m.html`; `rz-tracker.js` (62 pages); `js/rz-cookie-consent.js` (246 HTML files); the GA4 loader in 162 HTML files; `privacy.html`; `supabase/schema.sql` (NEW Module 10); NEW `supabase/functions/mayar-proxy/`; `supabase/functions/admin-users/index.ts`; `js/rz-supabase.js`; `setup-supabase.html` (owner action board); `js/rz-toast.js`; `sw.js`; the callers of `window.rzTrack` (`js/rz-command-palette.js`, `js/rz-article-diagram.js`, `js/rz-scrolly.js`) |
| Target wave | Addendum roadmap "Strategic, week 17 onward" (`…_ADDENDUM.md:558`). The main session sets the implementation wave in `04-implementation-plan/` |
| Approval status | PRD approved by owner R110/R111 2026-11-10. Implementation is BLOCKED until the owner explicitly approves D-1 to D-11 (privacy and auth boundary, `STATE.md:52`). The approval class in `01-improvement-register/REGISTER.md:23` is "auth/privacy boundary: approval needed" |
| Facts verified at | `wt-hub3` commit `9e49bfefd` (2026-11-11, "docs: tracker X2 verified, record P25 SW module contract"). Site version `3.35.10` (`js/rz-version.js:2`). Working tree clean except another agent's untracked `02-prds/PRD-Q09/` |

Change history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-11 | Opus 5.5 | First complete draft, all 24 sections. Every fact re-verified on `9e49bfefd` with the commands quoted in §3 |

## 2. Executive summary

The admin console is root-only and `noindex`, and most of what it shows is invented in the browser at load
time. `generateUsers()` makes 39 users (4 seeds and 35 random ones, `rz-ops-p7x3k9m.html:2586`). Revenue is
the count of fake pro users times $49, and churn is fixed at 2.1% (`:2689`). The page prints "99.97%"
uptime, "42ms" response time, a "0.02%" error rate and "234" PDF exports as literals (`:911`, `:921`,
`:1970`, `:1975`, `:1980`). `seedUADemoData()` writes about 280 fake visitor events, with made-up IP addresses
and cities, into the admin's own localStorage (`:5528`). Nothing on screen says any of this is invented.
The parts that are real work: the Supabase account list, tier changes, and create, reset and delete through
the `admin-users` Edge Function.

The data source behind "User Activity" is `rz-tracker.js`, which 62 pages load. It never sends an event to
the site. It writes each event, with IP address, city, region, timezone, user agent, screen, language,
referrer and, on login, the e-mail address, into the visitor's own localStorage. Before any consent it sends
the visitor's IP address to `ipapi.co` (`rz-tracker.js:38`). So the admin can only ever see its own browser
plus the seed. Separately, GA4 loads on 162 HTML files on the first scroll, click, key or touch whatever the
cookie banner says. 0 of the 162 require Accept, and 5 load GA at parse time.

The addendum's plan, "call the existing `log_event` RPC", does not work. `supabase/schema.sql:964-965`
revokes anonymous EXECUTE on `log_event`, so a signed-out visitor is meant to be unable to call it, and
`audit_log` is the privileged-action trail with `ip` and `ua` columns. The revoke itself may not take effect,
because PostgreSQL grants EXECUTE on new functions to PUBLIC and the schema never revokes that (finding N6).

This PRD delivers six things:

1. **A counter.** A new aggregate-only usage store: `usage_daily`, `usage_minute` and `usage_maintenance`,
   and the RPC `record_usage_event`. The RPC is callable by anyone. It checks every field against a
   whitelist, caps the whole site at 300 events a minute and 1,000 distinct rows a day, and keeps 400 days.
   It stores no IP address, no identifier, no user agent, no e-mail, no account id and no query string.
2. **A new `rz-tracker.js`.** It sends only after Accept, and never under Global Privacy Control unless the
   visitor chose Accept explicitly. It deletes the old IP and e-mail history from every visitor's browser.
3. **GA4 behind Accept.** One canonical loader goes on all 162 GA files, applied and checked by a sweep tool.
4. **`privacy.html`.** It says exactly what is counted and what is not, and it gets a control to change or
   withdraw the cookie choice, which the policy already promises.
5. **The admin.** Every fabricated panel and figure is deleted. Dashboard, Usage, Accounts, Audit log and
   Settings read real queries: three new root-only RPCs, plus `profiles` and `audit_log`. Every panel names
   its source and has loading, empty, error and not-root states. Messages use RZToast instead of `alert()`.
6. **Mayar.** Payment calls go through a new Edge Function, `mayar-proxy`. The key becomes a Supabase secret.

Eight laws prove it. Each fails on today's tree (§20.2). There are four new gate files and a sweep check,
wired into `tools/ship-gate.sh`.

## 3. Problem statement

### 3.1 Verified facts (run on `wt-hub3` at `9e49bfefd`, 2026-11-11)

| # | Fact | Evidence | Command |
|---|---|---|---|
| P1 | The admin generates its data at load time | `generateUsers` at `rz-ops-p7x3k9m.html:2481, :2586, :6054`; `seedUADemoData` at `:5528, :5658` (5 lines); `generateActivities` at `:2481, :2611, :6057`; `Math.random` on 6 lines (`:2577, :2578, :2598, :3413, :5567, :5599`); `rand(` on 27 lines | `grep -n "generateUsers\|seedUADemoData\|generateActivities" rz-ops-p7x3k9m.html`; `grep -c "Math.random" rz-ops-p7x3k9m.html` → 6; `grep -c "rand(" rz-ops-p7x3k9m.html` → 27 |
| P2 | 39 fabricated users | `generateUsers()` `:2586-2609`: 4 seed accounts plus 35 users built from `FIRST_NAMES`/`LAST_NAMES`/`DOMAINS`, random tier (`:2598`), random status, dates (`randDate`, `:2578`) and countries | `sed -n 2586,2610p rz-ops-p7x3k9m.html` |
| P3 | Every Dashboard and Revenue figure derives from P2 or a literal | `renderKPIs()` `:2628` ("+% from last month" = total ÷ 42; revenue = pro × 49; "2.1% churn"); `renderDashboardCharts()` `:2645` (active sessions `rand(3,12)` `:2650`; growth `[12,18,24,31,42,N]`; hourly usage `rand(2,45)` `:2661`; funnel `[1200,…]` `:2664`; geography from fake countries `:2669`); `renderRevenue()` `:2689` (MRR = pro × 49, LTV = 49 × 14.2, churn 2.1%, MRR history `[98,147,196,245,343,mrr]`, revenue table `:2708`); user modal "Lifetime Value" = amount × `rand(4,16)` `:3182` | `sed -n 2628,2710p rz-ops-p7x3k9m.html` |
| P4 | Literal figures printed as measurements | subtitle "Real-time platform metrics and analytics" `:894`; PDF Exports "234" `:911`; uptime "99.97%" `:921` and `:1970`; "42ms" `:1975`; "0.02%" `:1980`; nav badges "50" (`navUserCount`, `:812`) and "15" (`:816`); Settings "v2.0.0 (Feb 2026)" `:4890` while the site is 3.35.10 (`js/rz-version.js:2`); "Auth Backend: localStorage (Pre-Supabase)" `:4892`; Data Management buttons that only toast "Mock: …" `:1998-2001` | `grep -n "99.97%\|>42ms<\|>0.02%<\|Mock: \|Real-time platform metrics\|>234<\|Pre-Supabase\|v2.0.0 (Feb 2026)" rz-ops-p7x3k9m.html` |
| P5 | The audit log and "recent activity" are fabricated | `renderAudit/filterAudit` `:4863` and the dashboard feed read `activities` from `generateActivities()` (`:2611`, 40 events from a fixed base date) | `sed -n 2611,2627p rz-ops-p7x3k9m.html` |
| P6 | "User Activity" seeds itself | `UA_STORAGE_KEY='rz_user_events'` `:5488`; `seedUADemoData()` `:5528` writes about 280 events with fake IPs and cities into localStorage through `saveUAEvents` (`:5605`); `renderActivity()` `:5656` seeds whenever fewer than 50 events exist (`:5658`) | `sed -n 5528,5606p rz-ops-p7x3k9m.html` |
| P7 | Feature panel lists fabricated users | "Per-User Overrides" renders pro users from P2 with a button that only alerts "Override panel for … — coming with Supabase integration" `:3570` | `grep -n "coming with Supabase" rz-ops-p7x3k9m.html` |
| P8 | Subscribers panel has no writer | `getSubscribers` `:4912` reads localStorage `rz_newsletter_subscribers`; that key appears in no other file. Newsletter capture is banned by the gate at `tools/ship-gate.sh:285` | `grep -rln "rz_newsletter_subscribers" --include=*.js --include=*.html .` → `rz-ops-p7x3k9m.html` only |
| P9 | The topbar clock is mislabelled | `:2542` prints the browser's local time and appends " UTC+7", wrong in any other timezone | `sed -n 2542p rz-ops-p7x3k9m.html` |
| P10 | The Mayar key lives in browser storage | `MAYAR_API_BASE='https://api.mayar.id/hl/v1'` `:4975`; `getMayarKey()` reads localStorage `rz_mayar_key` `:4989`; sent as `Authorization: Bearer` from the browser `:5005`; client guard 18 calls/min `:4998-5001`; no writer of `rz_mayar_key` anywhere in the repo; failures toast "Some API calls failed — CORS or API key issue" | `sed -n 4975,5010p rz-ops-p7x3k9m.html` |
| P11 | `rz-tracker.js` captures personal data locally and sends the IP to a third party | header `:1-8` ("Captures: IP, country, city, timezone, screen, language, referrer, browser"); `fetch('https://ipapi.co/json/')` `:38` on every non-local host; event fields `:106-123` (`ip, country, cc, city, tz, device, browser, screen, lang, ref, ua` 80 chars, `sid`); `track('page_view')` on load `:134` with no consent check; login listener stores the e-mail `:181-189` (and labels every non-demo login "signup"); `auth.js:910` dispatches `rz-auth-change` with `email` | `sed -n 1,190p rz-tracker.js` |
| P12 | The tracker never sends to the site | the only network call in the file is `:38` | `grep -n "fetch(\|XMLHttpRequest\|sendBeacon" rz-tracker.js` → `:38` only |
| P13 | 62 pages load it | 61 root pages carry a tag: 46 as `src="rz-tracker.js"` and 15 as `src="rz-tracker.js?v=20260920-180645d6"`. The token matches the current hash `180645d6`. `index.html:1509-1511` injects it with no token. All 62 also load `js/rz-cookie-consent.js`. The addendum's "63 pages" counted `changelog.html`, which only mentions the file in text (`:34596`) | `grep -rhoE --include=*.html "src=\"/?rz-tracker\.js[^\"]*\"" . \| sort \| uniq -c`; `sha256sum rz-tracker.js \| cut -c1-8` |
| P14 | Callers of `window.rzTrack` | `js/rz-command-palette.js:104` (`rz_command`, command title), `:140` (`rz_search_open`), `:310` (`rz_search_go` with destination **and the raw search text `q`**); `js/rz-article-diagram.js:75` (`rz_diagram_scenario`); `js/rz-scrolly.js:76` (`rz_scrolly_complete`) | `grep -rn "rzt(\|rzTrack" js/*.js` |
| P15 | GA4 loads without consent on every GA page | 162 HTML files load `G-GED7FX8RTV`: 83 root, 39 `manual/`, 33 `cx-handbook/`, 4 `embed/`, 3 `id/`. 157 use an inline loader that fires on the first scroll, click, key or touch. 5 use a classic `<script async src>` tag that loads at parse time: `changelog.html`, `embed/index.html`, `embed/capex-widget.html`, `embed/pue-widget.html`, `embed/carbon-widget.html`. 101 files skip GA only when the stored choice is `'declined'`; 58 have no consent check at all; 0 require `'accepted'`. `index.html:12-30` has no check. `tools.html:9` says "default to deny on first visit", but the code only checks `'declined'` (`:10-12`) | `grep -rl --include=*.html "googletagmanager.com/gtag/js?id=G-GED7FX8RTV" . \| wc -l` → 162, then `grep -l` for each variant (§20.2 L4) |
| P16 | Consent cannot be changed or withdrawn | `js/rz-cookie-consent.js:131-135` never shows the banner again once a choice is stored, and the file exposes no API. `privacy.html:399` promises "Withdraw consent: Withdraw previously given consent at any time." `standarization/LEGAL_COMPLIANCE_STANDARD.md:28` calls the banner "GDPR-style opt-in/out" | `sed -n 122,150p js/rz-cookie-consent.js` |
| P17 | `privacy.html` does not match the code | "Last updated: December 11, 2025" `:273`. IP row "Server logs, analytics — geo analytics" `:303`. §1.3 (`:309-325`) says local keys are "never transmitted to our servers" and omits `rz_user_events` and `rz_geo_cache`. §3 (`:337-350`) lists Google Analytics, Google Fonts/cdnjs and Chart.js but not Supabase or ipapi.co. `:371` says "input data is not sent to servers", yet saved scenarios are stored in Supabase (`saved_scenarios.payload`, `supabase/schema.sql:280-288`) | `grep -n -i "supabase\|ipapi\|rz_user_events" privacy.html` → no match |
| P18 | `log_event` is not built for anonymous counts | `schema.sql:728-755` inserts `actor_id = auth.uid()` (nullable FK, `:704`) with no rate limit and up to 32 KB of `meta` (`:714`). `:964-965` revokes EXECUTE from `anon` only. No `revoke … from public` exists for any function (`:45` is the schema CREATE revoke) | `grep -n "from public" supabase/schema.sql` → `:45` only |
| P19 | Server reads already available to root | `profiles` "root reads all" policy `:131`; `audit_log` "root reads all" `:724`; `rzSupa.listAllProfiles` (`js/rz-supabase.js:264`), `rzSupa.listAuditLog` (`:420`, 0 callers). `saved_scenarios` is own-row only, so root cannot count other users' scenarios without a definer function | `grep -n "create policy" supabase/schema.sql` |
| P20 | Admin user operations leave no audit row | `supabase/functions/admin-users/index.ts` has 0 references to `audit_log` or `log_event`. Only the profile tier/role trigger (`schema.sql:757-784`) audits | `grep -c "audit_log\|log_event" supabase/functions/admin-users/index.ts` → 0 |
| P21 | Every admin message is a blocking `alert()` | 7 calls of `(window.showToast\|\|alert)`, and `showToast` is defined nowhere in the page; `js/rz-toast.js` is loaded by 3 pages (`changelog.html`, `cdu-calculator.html`, `rfs-readiness-workbench.html`) | `grep -c "window.showToast\|\|alert" rz-ops-p7x3k9m.html` → 7 |
| P22 | A stale warning on two accounts | `SUPA_PUBLIC_PW` `:3266-3267` flags bagus@ and admin@ as "Password is public in source code". `supabase/functions/admin-users/index.ts:47-54` records that both passwords were rotated | `sed -n 3266,3267p rz-ops-p7x3k9m.html` |

### 3.2 Consequence of leaving it

- **The owner decides on invented numbers.** Accounts, revenue, churn, uptime and visitor geography on the
  admin are random or literal. A decision such as "pro converts at 8%" would rest on `Math.random()`.
- **Privacy.** 62 pages send each visitor's IP address to `ipapi.co` before any choice, and keep IP, city
  and login e-mail in localStorage on shared machines. GA4 loads before any choice on 162 files, and on 5
  of them at parse time. Embed widgets carry GA into third-party sites with no banner at all. The privacy
  policy promises a withdrawal that the site cannot perform, and its data table is wrong in four places.
- **Security.** A long-lived payment API key sits in the admin browser's localStorage. Any script running
  on the resistancezero.com origin can read it. The admin page itself loads Chart.js, Leaflet and
  markercluster from jsDelivr and Font Awesome from cdnjs (`rz-ops-p7x3k9m.html:15-21`). That key can
  create invoices and read customer records. Admin user deletions and password resets leave no trail.
- **The addendum's fix would make it worse.** Pointing anonymous events at `log_event` would either fail
  (if the anon revoke works) or let anyone write unlimited 32 KB rows into the privileged audit trail (if
  PUBLIC still holds EXECUTE).

### 3.3 Addendum corrections and new findings

| # | Addendum statement | What the code says | Effect on this PRD |
|---|---|---|---|
| C1 | "Read `profiles` and call the existing `log_event` RPC, rate-limited" (`…_ADDENDUM.md:442`) | `log_event` is meant to be authenticated-only (`schema.sql:964-965`). It writes the privileged trail, which has `ip` and `ua` columns, a 32 KB `meta` and no rate limit (P18) | A separate aggregate store and RPC (FR-1, FR-2). `audit_log` keeps admin actions only |
| C2 | "Visitor events go to the RPC, and the admin reads them" (`:445`) | No event reaches any server today. The tracker writes only to the visitor's localStorage (P12) | The admin's "User Activity" has never shown a visitor. The new counter starts at zero, and the admin says so ("No data yet") |
| C3 | "rz-tracker (63 pages)" (`:447`) | 62 pages load it (P13) | Counted pages = 62 |
| C4 | X10 acceptance names only `generateUsers` and `seedUADemoData` (`:56`, `:455`) | `generateActivities` and 8 literal figures (P4) are not covered by those two names | Law L1 checks the full list |

New findings (not in the addendum):

- **N1.** GA4 loads before consent on all 162 GA files (P15). It is included here because the addendum's
  acceptance "no event is sent without consent" (`:457`) is false for GA otherwise.
- **N2.** There is no way to withdraw or change consent (P16).
- **N3.** `ipapi.co` receives every visitor's IP address on 62 pages before any choice (P11).
- **N4.** The login e-mail is stored in the tracker history, and every non-demo login is mislabelled
  "signup" (`rz-tracker.js:181-189`).
- **N5.** Raw search text is passed to the tracker (`js/rz-command-palette.js:310`, `q`), and today's
  tracker stores it in localStorage.
- **N6.** `log_event` may still be executable by `anon` through PUBLIC. PostgreSQL grants EXECUTE on new
  functions to PUBLIC by default (PostgreSQL manual, "Privileges"), and a revoke from one role does not
  remove a PUBLIC grant. The live state is UNKNOWN; T-1 measures it with a read-only query (OA-1).
- **N7.** `privacy.html` is inaccurate in four places (P17).
- **N8.** The topbar clock is mislabelled (P9).
- **N9.** Admin user operations write no audit row (P20).
- **N10.** The Mayar key is in browser storage (P10). After the move, rotate it (OA-4).
- **N11.** A stale "public pw" warning (P22).
- **N12.** Every admin message uses `alert()` (P21).

## 4. Objectives and success metrics

No target below is invented. "Today" values were measured with the commands in §3.1. Each target is the
end state the laws in §20.2 assert. Traffic-dependent values are UNKNOWN until measured after deployment.

| # | Objective | Metric | Today | Target | Method |
|---|---|---|---|---|---|
| O1 | No fabricated number in the admin | fabricated generator names + `Math.random` lines + the literal figures of P4 in `rz-ops-p7x3k9m.html` | 3 generator functions (8 lines), 6 `Math.random` lines, 8 literal figures | 0, 0, 0 | L1 |
| O2 | Every rebuilt panel names its source | `.ops-card` elements in rebuilt sections carrying `data-ops-source` with a known value | 0 | all of them (13 cards, §9.3) | L1, L6 |
| O3 | No analytics request before Accept | requests to `googletagmanager.com`, `google-analytics.com`, `ipapi.co` or `/rest/v1/rpc/record_usage_event` before a choice, after Decline, and under GPC with no choice, on the sampled pages | ≥ 1 (GA after the first scroll on `index.html`; GA at parse time on `changelog.html`; `ipapi.co` on load on a non-local host) | 0 | L2 |
| O4 | One canonical GA loader everywhere | files carrying the `rz-ga-consent v1` block ÷ files carrying `G-GED7FX8RTV` | 0 / 162 | 162 / 162 | L4 |
| O5 | The usage payload carries no personal data | keys outside `{p_event,p_page,p_device,p_detail}`; values that look like an e-mail, an IP address, a user agent or typed search text | today's local record holds `ip`, `city`, `ua` and `email` | 0 | L3 |
| O6 | A real visit is counted | live: after Accept, the `record_usage_event` response body is `"ok"` | impossible today (no endpoint) | `"ok"` | §22.7 V-3 |
| O7 | The Mayar key is out of the browser | `rz_mayar_key` and `api.mayar.id` in `rz-ops-p7x3k9m.html` | 1 and 1 | 0 and 0 | L7 |
| O8 | Admin mutations leave a trail | audit-row calls per mutating action in `admin-users` and `mayar-proxy` | 0 of 4 (`admin-users`) | 4 of 4, and 2 of 2 for `mayar-proxy` | L7 (static part) |
| O9 | The counter stays within budget | `usage_daily` rows a day; worst-case table size | n/a | ≤ 1,000 rows a day by construction. Worst case 400 days × 1,000 rows = 400,000 rows: arithmetic from the caps, not a forecast. Real volume UNKNOWN; measure 30 days after release with `select count(*) from usage_daily` (T-14) | L5, §22.6 |
| O10 | The tracker does not grow | `wc -c rz-tracker.js` | 7,581 bytes | ≤ 7,581 bytes (today's size is the budget) | L3 static part |

## 5. Scope

### 5.1 In scope

1. **Supabase Module 10 (NEW)**, appended to `supabase/schema.sql`. It creates `usage_daily`,
   `usage_minute` and `usage_maintenance`; `record_usage_event()` (anon and authenticated);
   `admin_usage_summary()`, `admin_account_summary()` and `admin_scenario_summary()` (root only); and the
   grants for all of them. It also revokes `log_event` from PUBLIC (N6).
2. **`rz-tracker.js` v2**, rewritten in place. The same 62 pages load it, so no page markup changes. It is
   consent-gated, sends whitelisted fields only and purges the legacy keys.
3. **`js/rz-cookie-consent.js`.** GPC counts as Decline when no choice is stored. Adds the public API
   `window.RZCookieConsent`, withdrawal that deletes GA cookies, and accurate banner copy.
4. **GA4 canonical loader** in all 162 files and in the three generators that emit GA
   (`tools/build-cx-handbook.py:302-324`, `tools/build-changelog-html.py:444-450`,
   `tools/generate-city-pages.py:119-124`, `:1009-1014`). It is applied and checked by
   `tools/gate-gtag-consent.py`, an existing v1.10.15 one-off fixer that is wired nowhere, hardcodes another
   checkout (`ROOT = Path("/home/baguspermana7/rz-work")`, `:13`) and writes the `'declined'`-only pattern
   (`:16-40`). It is rewritten in place with `--check` and `--apply`.
5. **`privacy.html`.** Rewrite of the analytics, local-storage, sharing and security statements; a
   "Your cookie choice" control; a new "Last updated" date. The wording is the owner's to approve (D-10).
6. **`rz-ops-p7x3k9m.html`.** Deletions (§8 FR-8). Rebuilt Dashboard, Usage (replaces User Activity),
   Accounts (the real Supabase panel, renamed from Credentials; the fabricated Users section is deleted),
   Audit log and Settings. Mayar through the proxy. RZToast. Loading, empty, error and not-root states.
   The clock in Asia/Jakarta time.
7. **NEW Edge Function** `supabase/functions/mayar-proxy/`, with its testable core `core.ts`. Audit rows
   added to `supabase/functions/admin-users/index.ts`.
8. **`js/rz-supabase.js`** additions: `usageSummary`, `accountSummary`, `scenarioSummary`, `setRole`, a
   paged `listAuditLog`, and `mayar`.
9. **`setup-supabase.html`.** Owner-action board entries for OA-1 to OA-5.
10. **`sw.js`.** Add `/rz-tracker.js` and `/js/rz-config.js` to `NETWORK_FIRST_PATHS`, so privacy-critical
    code is never served stale from the service-worker cache.
11. Gates (§20), standards docs (§22.4) and the release chain (§22.8).

### 5.2 Out of scope (non-goals)

- Tier Manager v2 and the dormant AUTH_V2 path (`auth.js:138-147`, placeholder gateway; `worker-auth/`).
  Untouched (D-9).
- The DC Intelligence, Stock Investment, Finance Terminal and IDR Stocks sections. They read their own
  data files or apps, and none of the `Math.random` lines (P1) is in them. Their badges and visual register
  are untouched.
- The Feature Flags panel internals. PRD-Q11 owns them. This PRD deletes only the fabricated "Per-User
  Overrides" card (P7).
- The billing webhook and the `subscriptions` and `payments` tables (`schema.sql:835-879`). They have no
  writer, and root cannot read them (own-row RLS). Mayar data comes from the proxy instead.
- Educator allowlist UI (`rzSupa.listEducators/addEducator/removeEducator`, `js/rz-supabase.js:463-482`, 0
  callers) and the client-side `rz_admin_educators` path in `auth.js:256-292`. That is an auth follow-up.
- Unique visitors, cohorts, retention curves, geography, referrers and funnels. They are not collected by
  design, so the admin never shows them.
- Extending the counter to the roughly 190 pages that do not load `rz-tracker.js` (D-8).
- A full visual re-skin of the 7,115-line admin. Only the rebuilt panels follow §9.8.
- Legal advice. The privacy text in §9.10 is a draft for the owner.

### 5.3 Existing capabilities reused

| Capability | Where |
|---|---|
| Root check in SQL | `public.is_root()` `supabase/schema.sql:102-114` |
| Root-readable profiles and audit rows | policies `:131`, `:724` |
| Tier and role RPCs, root-checked and audited by trigger | `admin_set_tier` `:197`, `admin_set_role` `:236`, trigger `audit_profile_privilege_change()` `:757-784` |
| Edge Function pattern (CORS allowlist, JWT check, root check, `{ok,data}` / `{ok:false,error,message}` envelope) | `supabase/functions/admin-users/index.ts:33-101` (allowlist `:33`, `corsHeaders` `:57`, `getUser` `:94`, root check `:101`) |
| Client wrapper with `friendly()` errors and `ready` promise | `js/rz-supabase.js:81`, `:486-488` |
| Real account panel (list, tier select, add, reset, delete) | `rz-ops-p7x3k9m.html:3238-3400` |
| HTML escaping helper | `rzEsc` `rz-ops-p7x3k9m.html:3230` (used at `:3280`) |
| Toasts | `window.RZToast.{show,ok,warn,fault,info}` `js/rz-toast.js:239-247` |
| Consent key, event and GA disable flag | `js/rz-cookie-consent.js:25-27`, `:53-65` |
| Admin theme (light and dark) | `toggleAdminTheme()` (`rz-ops-p7x3k9m.html:2517`), tokens `css/rz-finance-suite.css:20-75` |
| Owner action board | `OWNER_ACTIONS` array, `setup-supabase.html:67` |
| Served tree and free port for browser gates | `tools/ship-gate.sh:311-348` |
| Cache-token tool | `node tools/test-asset-cache-tokens.mjs --fix <asset>` |

### 5.4 Dependencies

| Dependency | Kind | Status |
|---|---|---|
| Owner approval of D-1 to D-11 | blocking for implementation | pending |
| OA-1 to OA-5 (owner runs SQL, deploys functions, sets the secret, rotates the Mayar key) | blocking for go-live of the server parts | pending; prepared by T-15 |
| `tools/lib/pg-harness.mjs` + dev dependency `@electric-sql/pglite` (or Docker `postgres:16` fallback) | shared with PRD-Q11 | NEW, created by T-1 |
| PRD-X-DEFECTS FR-X10 (interim labels) | interim, superseded here | specified there |
| PRD-Q07 `fault_run_start`, PRD-Q17 `path_start`/`path_complete` | later additions to the whitelist | owned by those PRDs |
| Peer P25 service-worker module (v3.37.0, not live, `STATE.md:64-68`) | `sw.js` is registered on more pages after P25 | coordinate the `NETWORK_FIRST_PATHS` edit with the peer |

### 5.5 Constraints

- Static site, zero build for pages, vanilla ES5 in shared scripts (`rz-tracker.js` and
  `js/rz-cookie-consent.js` are ES5 today; keep them ES5).
- The repo is public, so no secret goes in any file. The Supabase publishable key in `js/rz-config.js` is
  public by design (the `SUPABASE_ANON` value is a publishable `sb_publishable_…` key); RLS and function
  grants are the boundary.
- The free Supabase plan is likely: the keep-alive workflow `.github/workflows/supabase-keepalive.yml`
  exists to prevent pausing, which suggests the free plan. Plan and DB size are UNKNOWN; T-1 measures them
  through OA-1.
- Peer-owned files: `cx-calculator.html` loads `rz-tracker.js` with a bare tag. This PRD does not edit that
  tag. The new tracker is picked up by the same URL.
- Release chain and design register: §9.8, §22.

### 5.6 Assumptions

- A1. A visitor's choice stored in `localStorage['rz_cookie_consent']` is the consent record. There is no
  server-side consent log, because the counter is anonymous and cannot be tied back to a visitor.
- A2. Days are Asia/Jakarta calendar days. The owner reads the admin in that timezone, as the existing
  " UTC+7" label shows.
- A3. Counts are a lower bound: only consenting visitors, only the 62 pages, events fired during navigation
  may be lost, and caps may bind. The admin says so on every usage panel.
- A4. supabase-js v2 sends `apikey` and `Authorization: Bearer <key>` on a signed-out request, and the
  site's sign-in already works with that header pair on `/auth/v1`. The tracker copies the pair. §22.7 V-3
  verifies it live on `/rest/v1/rpc`.

### 5.7 Owner decisions (defaults used by this PRD)

| # | Decision | Default | Why it needs the owner |
|---|---|---|---|
| D-1 | Allow a new anonymous write path, `record_usage_event`, with the caps of FR-2 | approve | new auth surface (`STATE.md:9`) |
| D-2 | Retention: `usage_daily` 400 days, `usage_minute` 1 hour | approve | data retention is a privacy choice |
| D-3 | Global Privacy Control counts as Decline when no choice is stored, and the banner is not shown. An explicit Accept on `privacy.html` overrides it | approve | changes who sees the banner |
| D-4 | GA4 loads only after Accept on all 162 files. GA numbers will then count consenting visitors only | approve | business-visible drop in GA counts |
| D-5 | Mayar through `mayar-proxy`, key as secret `MAYAR_API_KEY`; rotate the key after the move | approve | secret handling; new function |
| D-6 | Delete fabricated panels and figures (FR-8) rather than keep them labelled | approve | feature removal (`STATE.md:9`) |
| D-7 | Delete the Subscribers panel (P8) | approve | feature removal |
| D-8 | Keep counting on the current 62 pages only | approve | scope |
| D-9 | Leave AUTH_V2 and Tier Manager v2 untouched | approve | scope |
| D-10 | Publish the `privacy.html` text of §9.10 | owner reviews wording | legal copy |
| D-11 | Revoke `log_event` from PUBLIC and grant it to `authenticated` only | approve | auth boundary |

## 6. User personas and use cases

Tiers and roles as the site has them: `profiles.tier` is `free | demo | pro | root`
(`supabase/schema.sql:84`), `profiles.role` is `user | educator | root` (`:86`), and root means
`tier = 'root'` (`is_root()`, `:102-114`). In the browser, `auth.js` derives the role from the session
(`detectRole` `:296`, `ROOT_EMAILS` `:246`). Client checks are cosmetic. RLS and function grants are the
boundary.

| Persona | Real role on this site | Goal | Permissions in this feature | Expected outcome |
|---|---|---|---|---|
| V1 Signed-out visitor | reader, any page | read, use tools, decide about analytics once | may cause `record_usage_event` calls only after Accept; cannot read anything | nothing leaves the browser before a choice; the choice can be changed on `privacy.html` |
| V2 Signed-in user (free, demo, pro; role user or educator) | DC and facility engineers, operators, students, educators | same as V1 | same as V1. The counter never reads `auth.uid()`, so counts are never tied to an account | identical to V1 |
| A1 Owner as admin (`tier = 'root'`) | runs the site | true account, usage and payment numbers; manage accounts; review admin actions | `admin_*` RPCs, `profiles` and `audit_log` reads, `admin_set_tier/role`, `admin-users`, `mayar-proxy` | every number has a source; empty data says "No data yet" |
| A2 Signed-in non-root who opens the admin URL | any account | none (curiosity) | none; every RPC returns `not authorized` | the "not a root account" state, no data |
| A3 Scripted client with the public key | abuse | inflate counts or fill the DB | can call `record_usage_event` directly | bounded by 300 events a minute and 1,000 rows a day; cannot read; never sees other data |

Use cases: UC1 first visit with no choice (V1); UC2 Accept (V1); UC3 Decline (V1); UC4 browser with GPC
(V1); UC5 change or withdraw a choice on `privacy.html` (V1, V2); UC6 the owner reads Dashboard and Usage
(A1); UC7 the owner reviews and exports the audit log (A1); UC8 the owner changes a role or deletes an
account and sees the audit row (A1); UC9 the owner reads Mayar balance and transactions and creates an
invoice (A1); UC10 a non-root opens the admin (A2); UC11 Supabase is unreachable (A1).

## 7. Complete user journey

### J1 First visit, no choice (UC1)
1. Entry: any page, for example `/tools.html`. Initial state: no `rz_cookie_consent`, no GPC.
2. The banner slides up with the copy of §9.10. Nothing loads from `googletagmanager.com` or `ipapi.co`, and
   no `record_usage_event` request is made, whatever the visitor scrolls, clicks or types.
3. The tracker deletes `localStorage['rz_user_events']` and `sessionStorage['rz_geo_cache']`, which hold the
   old IP and e-mail history, on every page load whatever the choice.
4. Exit: the visitor leaves. Nothing was sent.

### J2 Accept (UC2)
1. The visitor presses **Accept**. `rz_cookie_consent = 'accepted'` and the `rz-cookie-consent` event fires.
2. The tracker sends `visit_start` (first page of this tab session) and `page_view` for the current page:
   2 POSTs. The GA loader loads `gtag.js`.
3. On later pages the tracker sends `page_view` on load, and the whitelisted interaction events as they happen.
4. Failure: the POST fails (offline, 5xx). The count is lost and nothing is retried. The page is unaffected
   and nothing is shown to the visitor.

### J3 Decline (UC3)
1. **Decline** stores `'declined'` and sets `window['ga-disable-G-GED7FX8RTV'] = true`.
2. No analytics request is made on this or any later page. The banner never returns. The choice can be
   changed in J5.

### J4 GPC (UC4)
1. `navigator.globalPrivacyControl === true` and no stored choice. The banner is not shown. Analytics stay
   off exactly as in J3. Nothing is stored, so a later explicit choice still works.
2. On `privacy.html`, "Your cookie choice" reads "Declined (your browser sends Global Privacy Control)".

### J5 Change or withdraw (UC5)
1. Entry: the banner's "Details" link, or the footer link to `privacy.html`, then the "Your cookie choice"
   section.
2. The current state is shown as a word: "Accepted", "Declined", "Declined (your browser sends Global
   Privacy Control)" or "Not chosen yet".
3. **Turn analytics off** stores `'declined'`, sets the GA disable flag and deletes `_ga` and `_ga_*`
   cookies for `resistancezero.com` and `.resistancezero.com`. The status line reads "Saved. Analytics are
   off on this browser."
4. **Turn analytics on** stores `'accepted'`. The status line reads "Saved. Analytics are on on this
   browser." GA loads on the next interaction, and counting starts with the next page view.
5. Validation: none needed (two buttons). Exit: any link.

### J6 Owner opens the admin (UC6)
1. Entry: the admin URL. `checkAccess()` (`rz-ops-p7x3k9m.html:2405`) is unchanged and cosmetic.
2. Initial state: the Dashboard shows a loading line per card ("Loading…").
3. `rzSupa.ready`, then `getUser()`. If no user: the sign-in state (§9.7). If the user is not root: the
   not-root state.
4. Root: four calls run in parallel: `accountSummary()`, `usageSummary(30)`, `scenarioSummary(12)` and
   `listAuditLog(10)`. Each card fills on its own. "Updated HH:MM:SS WIB" is set when the last call settles.
5. A card whose call fails shows its error line and a **Retry** button that repeats that one call. A card
   with zero rows shows its "No data yet" copy.
6. Recovery: **Refresh** in the header repeats all four calls.

### J7 Usage (UC6)
1. Nav **Usage**. Default range 30 days. Changing the select (7, 30 or 90 days) calls `usageSummary(n)`.
2. Chart: page views per day. Tables: events, top pages, screen widths, search destinations, palette
   commands and diagram scenarios.
3. If a cap bound on any day in the range, a line reads "Counting was capped on N days in this range; these
   counts are lower than the real traffic."

### J8 Audit log (UC7, UC8)
1. Nav **Audit log**. The first 50 rows, newest first, with the actor e-mail resolved from the loaded
   account list.
2. The action filter and target search apply to the loaded rows. **Load older** fetches the next 50, keyed
   on `created_at`. **Export CSV** downloads the loaded rows.
3. After a role change in Accounts, a `role` change row appears at the top on the next load (written by the
   existing trigger). After a delete or a password reset, an `admin_delete_user` or `admin_reset_password`
   row appears (FR-12).

### J9 Mayar (UC9)
1. Nav **Mayar payments**. Balance, recent transactions and unpaid invoices load through `mayar-proxy`.
2. **Create invoice**: form, then a confirm dialog with the amount, then POST. The button is disabled while
   in flight. Success: RZToast "Invoice created." and the link is shown.
3. Failures: `not_deployed` (the function does not exist), `not_root`, `upstream_rate_limited`,
   `upstream_timeout`, `upstream_error`. Each has its copy in §9.10. Recovery: **Retry**, or Owner Actions
   for `not_deployed`.

### J10 Non-root or signed out (UC10)
- Signed out: "Sign in with a root account to see admin data." plus a link to `account.html`. No call is
  made except `getUser()`.
- Not root: "This account (<email>) is not a root account. Admin data is not shown." Every RPC would return
  `not authorized: root required` anyway.

### J11 Supabase unreachable (UC11)
- Every card shows "Could not reach Supabase: <message>." with **Retry**. No number is shown.

## 8. Functional requirements

Each FR is testable. Test ids refer to §20 (L = law, T-x = unit or contract check inside the named gate).

### FR-1 Supabase Module 10: usage store, grants, `log_event` fix
- **Description:** Append "Module 10 — usage counts" to `supabase/schema.sql` (DDL in §10.2). It creates
  three tables with RLS on and no policy, revokes all table privileges from `anon` and `authenticated`,
  creates the four functions of FR-2 and FR-3 with explicit grants, and fixes N6 with
  `revoke execute on function public.log_event(text, text, text, jsonb) from public;` and
  `grant execute on function public.log_event(text, text, text, jsonb) to authenticated;`.
- **Trigger:** the owner pastes the block into the SQL Editor (OA-2).
- **Preconditions:** Modules 0–9 applied (they are live: profiles, audit_log and admin RPCs are in use). OA-1
  results recorded.
- **Inputs:** none.
- **Processing:** re-runnable DDL (`create table if not exists`, `create or replace function`, `drop policy if
  exists`), the convention the file already uses (`schema.sql:63`, `:197`, `:719`).
- **Outputs:** three tables, four functions, one seed row in `usage_maintenance`.
- **State changes:** new objects; `log_event` executable by `authenticated` only.
- **Dependencies:** `public.is_root()` (`:102`).
- **Exceptions:** running it twice changes nothing. Running it before Module 0 fails on `is_root()`, which
  is the correct failure.
- **Acceptance:** L5 cases S5, S8, S9 (§20.2); the static block check in `tools/test-usage-events-sql.mjs`.

### FR-2 `record_usage_event` (NEW RPC, callable by anyone)
- **Description:** count one whitelisted event in `usage_daily`. Never store an identifier.
- **Trigger:** `POST /rest/v1/rpc/record_usage_event` from `rz-tracker.js` (FR-4).
- **Preconditions:** none (anon or authenticated).
- **Inputs:** `p_event text`, `p_page text`, `p_device text`, `p_detail text default ''`.
- **Processing (exact order):**
  1. Validate. `p_event` must be one of the 12 client events of §10.2. `p_page` must match
     `^/[A-Za-z0-9/_.-]{0,119}$`. `p_device` must be `narrow` or `wide`. `coalesce(p_detail,'')` must match
     `^[A-Za-z0-9/_.:-]{0,120}$`. Only `rz_search_go`, `rz_command` and `rz_diagram_scenario` may carry a
     non-empty detail. Any failure returns `'invalid'` with no write of any kind.
  2. `v_day := (now() at time zone 'Asia/Jakarta')::date`.
  3. Housekeeping, once per day: `update usage_maintenance set last_purge = v_day where id and last_purge <
     v_day`. If a row was updated, delete `usage_daily` rows with `day < v_day - 400` and `usage_minute`
     rows older than 1 hour.
  4. Global cap: upsert the current minute in `usage_minute` and read back `n`. If `n > 300`, return
     `'limited'`. When `n = 301` exactly, first add 1 to the `_limited` row of `v_day`, so each capped
     minute is recorded once.
  5. Existing key: `update usage_daily set n = n + 1` on the 5-column key. If a row matched, return `'ok'`.
  6. Cardinality cap: if `v_day` already has 1,000 rows, add 1 to the `_overflow` row of `v_day` and return
     `'limited'`.
  7. Insert the key with `n = 1`, using `on conflict … do update set n = n + 1` for the race. Return
     `'ok'`.
- **Outputs:** a JSON string: `"ok"`, `"limited"` or `"invalid"`.
- **State changes:** at most one `usage_daily` row and one `usage_minute` row touched per call, plus the
  daily purge.
- **Never reads:** `auth.uid()`, `request.headers`, the client IP, or any column other than its own tables.
- **Exceptions:** a database error becomes HTTP 5xx from PostgREST. The client ignores it (FR-4).
- **Acceptance:** L5 S1–S4, S7.

### FR-3 Root-only summaries (NEW RPCs)
- **Description:** three read functions that return JSON shaped for the admin (contracts in §11.3–§11.5):
  `admin_usage_summary(p_days int default 30)`, `admin_account_summary()` and
  `admin_scenario_summary(p_months int default 12)`.
- **Trigger:** the admin panels (FR-9, FR-10).
- **Preconditions:** the caller is authenticated and `is_root()`.
- **Inputs:** `p_days` 1–400; `p_months` 1–36.
- **Processing:** each raises `'not authorized: root required'` when not root (same text as
  `admin_set_tier`, `schema.sql:209`). Each raises `'invalid days'` or `'invalid months'` outside the range,
  then aggregates with `group by`. `admin_account_summary` reads `profiles` and `auth.users.last_sign_in_at`.
  `admin_scenario_summary` reads `saved_scenarios.calc`, `user_id` and `created_at` only, never `payload` or
  `name`. Months and days are Asia/Jakarta. Month and day series include zero entries, so charts do not
  skip gaps.
- **Outputs:** `jsonb` (§11).
- **State changes:** none (`stable`).
- **Dependencies:** FR-1.
- **Exceptions:** not root or bad range: PostgREST HTTP 400 with the message. The client maps it (FR-15).
- **Acceptance:** L5 S6; L6 (rendering of the shapes).

### FR-4 `rz-tracker.js` v2
- **Description:** rewrite the file in place (same URL, so the 62 pages need no markup change). ES5, one
  IIFE, guard `window.__rzUsage`.
- **Trigger:** page load; the `rz-cookie-consent` event; clicks matching the existing heuristics
  (`rz-tracker.js:138-178`); calls to `window.rzTrack`.
- **Preconditions:** none.
- **Inputs:** `localStorage['rz_cookie_consent']`, `navigator.globalPrivacyControl`, `location.pathname`,
  `matchMedia('(max-width: 767px)')`, `window.rzTrack(name, extra)` arguments.
- **Processing:**
  1. On every load, whatever the choice: `localStorage.removeItem('rz_user_events')` and
     `sessionStorage.removeItem('rz_geo_cache')`.
  2. Local runtime (`file:`, `localhost`, `127.x.x.x`, `[::1]`; the regex at `:21-23`): stop here. Nothing
     is ever sent from a development or gate server.
  3. Consent state: stored `'accepted'` is `active`. Stored `'declined'` is `off`. No stored value with GPC
     on is `off`. No stored value without GPC is `pending`, and the tracker listens for `rz-cookie-consent`.
  4. On becoming `active` (on load, or when the event arrives with `'accepted'`): if
     `sessionStorage['rz_ev_visit']` is absent, send `visit_start` and set it to `'1'`. Then send
     `page_view` once for this page load. The event `'declined'` sets the state to `off` permanently for
     this page.
  5. Click heuristics: the existing five (`pro_click`, `pdf_export`, `cv_download`, `ws_download`,
     `calc_use`), with the same text and attribute tests. The text is used only to classify the click and is
     never sent.
  6. `window.rzTrack(name, extra)`: if `name` is one of the 12 client events, derive the detail (rules
     below) and send. Otherwise drop it silently. `extra.q` and every other field are ignored.
  7. `send(event, detail)`: only in state `active`. Skip if the same `event|page|detail` was sent less than
     5,000 ms ago. Skip once the tab has sent 30 events in the current 10-minute window
     (`sessionStorage['rz_ev_budget']`, `{start,n}`). Load config through `rzLoadConfig()` (§11.8). POST
     the four fields with `keepalive: true`, `credentials: 'omit'` and a 5 s abort. Never retry. Never
     surface an error.
- **Detail rules:** `rz_search_go`: the pathname of `extra.to` resolved against `location`, or `external`
  for another origin. `rz_command`: `slug(extra.cmd)`. `rz_diagram_scenario`: `slug(extra.scenario)`. Every
  other event: `''`. `slug` lowercases, replaces each run outside `[a-z0-9]` with `-`, trims `-` and cuts to
  40 characters. **Page:** `location.pathname`; a trailing `/` gets `index.html` appended; anything failing
  the page regex becomes `/other`. **Device:** `narrow` when `(max-width: 767px)` matches, else `wide`.
- **Outputs:** POSTs; `window.rzTrack` (kept signature); `window.RZUsage = {version:'2.0.0', state(),
  sent()}` for diagnostics.
- **State changes:** `sessionStorage` keys `rz_ev_visit` and `rz_ev_budget`. Legacy keys removed.
- **Dependencies:** FR-2, FR-5, `js/rz-config.js`.
- **Exceptions:** no config (file missing, offline): nothing is sent. `matchMedia` missing: `wide`.
  Storage throws (private mode): the dedupe and budget fall back to in-memory values for the page.
- **Acceptance:** L2, L3.

### FR-5 Consent engine (`js/rz-cookie-consent.js`)
- **Description:** keep the key, the legacy migration (`:38-51`), the event and the banner. Add GPC
  handling, a public API, withdrawal and accurate copy.
- **Trigger:** page load; banner buttons; `RZCookieConsent.set()`.
- **Preconditions:** none.
- **Inputs:** stored value; `navigator.globalPrivacyControl`.
- **Processing:**
  1. `effective()` returns the stored value, else `'declined'` when GPC is on, else `null`.
  2. `init()`: a stored choice behaves as today. No stored choice with GPC on: set the GA disable flag, do
     not show the banner, store nothing. Otherwise show the banner.
  3. `window.RZCookieConsent = { get: effective, stored: getConsent, gpc: function () {…}, set: setConsent }`.
     `set` accepts only `'accepted'` or `'declined'`; anything else throws `TypeError('consent must be
     accepted or declined')`.
  4. `setConsent('declined')` additionally expires every cookie named `_ga` or starting with `_ga_`, with
     `Max-Age=0; path=/`, once without a domain and once with `domain=.resistancezero.com`.
  5. Banner copy defaults (`TEXT`, `:30-36`) change to §9.10. The `/id/` pages keep their
     `window.RZ_COOKIE_TEXT`. PRD-Q15 owns their Indonesian wording.
- **Outputs:** the API; the event `rz-cookie-consent` with `detail` set to the value (unchanged).
- **State changes:** the stored key; GA cookies on withdrawal.
- **Exceptions:** storage blocked: `get()` returns `effective()` from GPC only, and `set()` still
  dispatches the event, so this page honours the choice.
- **Acceptance:** L2 (GPC and withdrawal cases); unit cases in `tools/test-usage-consent.mjs`.

### FR-6 One GA4 loader that waits for Accept (162 files)
- **Description:** replace every GA loader with the canonical block of §11.8, marked `rz-ga-consent v1`.
  `gtag` is a queue stub until the visitor's stored choice is `'accepted'`. Then `gtag.js` loads on the
  first interaction, or immediately when the `rz-cookie-consent` event brings `'accepted'`.
- **Trigger:** `python3 tools/gate-gtag-consent.py --apply` (one run, reviewed diff). The file is rewritten in
  place: ROOT is derived from `__file__`, and the old `NEW_BLOCK` (`:16-40`) is deleted.
- **Preconditions:** the template file `tools/templates/rz-ga-consent-v1.html` exists. The tool and the
  three generators read it, and none of them embeds its own copy. `build-cx-handbook.py` (33 pages,
  freshness-checked at `tools/test-generator-freshness.py:72`) and `build-changelog-html.py`
  (`changelog.html`) are re-run after the change. `generate-city-pages.py` writes to `dc-market/`, which is
  absent from the repo; its template is updated so a future run cannot bring the eager tag back.
- **Inputs:** every `.html` under the repo root except `node_modules/`, `dcmoc/` and `.git/` that contains
  `G-GED7FX8RTV`.
- **Processing:** locate each GA loader: the 157 inline `s.src='https://www.googletagmanager.com/gtag/js…'`
  blocks with their preceding `<!-- Google tag … -->` comments, and the 5 classic
  `<script async src="…gtag/js?id=G-GED7FX8RTV">` tags with the inline `gtag('config'…)` script that
  follows them. Replace the first with the template and delete the rest. Leave every other byte unchanged.
  Running it twice is a no-op.
- **Outputs:** edited files; a summary line `GA consent: <n> files rewritten, <m> already canonical`.
- **`--check`:** exit 1 and list each file that lacks exactly one canonical block, whose block differs from
  the template, or that has any `gtag/js?id=` outside the block. It also fails if any `tools/*.py` or
  `tools/*.mjs` other than this tool contains the literal `googletagmanager.com/gtag/js`, which would mean
  a generator still embeds its own loader. Exit 0 prints `GA consent: 162/162 canonical, 0 generator
  literals`.
- **Exceptions:** a file whose GA code matches neither form: `--apply` refuses that file (exit 2), names it,
  and changes nothing in it.
- **Acceptance:** L4; L2 on the sampled pages.

### FR-7 `privacy.html` states what is collected and lets the visitor change the choice
- **Description:** replace the statements of P17 with the text of §9.10 (owner approves wording, D-10).
  Add section "4.1 Your cookie choice" with the control of §9.2.8. Set "Last updated" to the release date.
- **Trigger:** release.
- **Processing:** the control reads `RZCookieConsent.get()`, `stored()` and `gpc()` on load and renders the
  state word. The two buttons call `set()` and update the status line (`role="status"`).
- **Exceptions:** `RZCookieConsent` missing (script blocked): the section shows "Your browser blocked the
  script that stores this choice. Clear this site's data to reset it." and both buttons are `disabled`.
- **Acceptance:** L2 (withdraw case on `privacy.html`), L8 (control at 1440 and 390, both themes).

### FR-8 Delete every fabricated panel, figure and generator from the admin
- **Description:** remove, not label (D-6, D-7):
  - code: `FIRST_NAMES`, `LAST_NAMES`, `DOMAINS`, `STATUSES`, `rand`, `randDate`, `generateUsers`,
    `generateActivities`, `renderKPIs`, `renderDashboardCharts`, `renderRevenue`, the fabricated user table
    (`renderTable` `:2738`, its modal including "Lifetime Value" `:3182`, its exports `:2836-2866`,
    `promoteEducator`/`demoteEducator` `:2813-2834`), `openReport()` `:2900` and its report builders, the
    legacy `CREDENTIALS` vault `:2547-2552` and its card, `renderAudit`/`filterAudit` over `activities`
    `:4863`, `seedUADemoData` and all `UA_*`/`ua*` activity code (`:5485` to the end of `exportUAEventsCSV()`, which starts at `:6027`), `getSubscribers` `:4912`, the
    dead manual-account helpers that still call `Math.random` (`:3413`; manual accounts are retired,
    `:3398-3400`), and the second init block `:6052-6072` (it calls the fabricated renderers and `renderMayar()` at load);
  - markup: `sec-revenue` `:949`, `sec-users` `:969`, `sec-subscribers` `:1592`, the contents of
    `sec-activity` `:1862`, the System Health and Data Management cards in `sec-settings` (`:1962-2003`), the
    quick stats and KPI grid in `sec-dashboard` (`:892-947`), the Per-User Overrides card in `sec-features`;
  - nav: Revenue (`$`), User Activity (count), Users (`50`), Subscribers, and the badges `Live` and `15` on
    Mayar and Credentials.
- **Processing:** on admin load, run `localStorage.removeItem()` for `rz_user_events` (the seeded copy),
  `rz_newsletter_subscribers` and `rz_mayar_key`.
- **Exceptions:** the Personal Apps and DC Intelligence code stays byte-identical. L1 checks a hash of
  those ranges against today's, so an accidental edit fails.
- **Acceptance:** L1.

### FR-9 Dashboard on real data
- **Description:** four cards and one chart (§9.2.1): Accounts (`admin_account_summary`); Usage, last 30
  days (`admin_usage_summary(30)`); Saved scenarios (`admin_scenario_summary(12)`); Recent admin actions
  (`listAuditLog(10)`); New accounts per month (bar chart from `signupsByMonth`).
- **Trigger:** showing the section (first time), the **Refresh** button, and sign-in completion.
- **Preconditions:** `rzSupa.ready` resolved.
- **Processing:** `getUser()`, then the state machine of §12.3. The four calls run in parallel
  (`Promise.allSettled` with an ES5 fallback, as `renderMayar()` does at `:5373`). Each card renders on its
  own result.
- **Outputs:** fact lists (label and value rows), one table and one chart. Every number comes from the
  response. No derived ratio is shown, so no "conversion" and no "churn".
- **State changes:** none (read-only). "Updated HH:MM:SS WIB".
- **Exceptions:** per card (FR-15).
- **Acceptance:** L6 (exact numbers from the stub, no other number), L8.

### FR-10 Usage panel (replaces "User Activity")
- **Description:** nav item **Usage** in Analytics, section `sec-activity` reused (id kept so
  `showSection('activity')` still works).
- **Inputs:** range select `#usageRange` with 7, 30 (default) or 90 days.
- **Processing:** `usageSummary(n)`, then render: a bar chart of `page_view` per day, one amber series with
  every day in range (zeros included); tables Events (every event with a count above 0, in the label order
  of §9.10), Top pages (25), Screen width, Search results opened (10), Palette commands (10) and Diagram
  scenarios (10). Show the capped note when `cappedDays > 0`, the first-day line ("Counting started on
  {firstDay}"), and the not-collected footnote.
- **Exceptions:** an empty range gives the empty state of §9.7. A failed call gives the error state with
  **Retry**.
- **Acceptance:** L6, L8.

### FR-11 Accounts panel (the real Supabase panel, renamed)
- **Description:** nav "Credentials" becomes **Accounts**. Section id `sec-credentials` is kept. The
  legacy vault card is deleted (FR-8). The Supabase panel (`:3238-3400`) stays, with five changes:
  1. `listAllProfiles()` also selects `role` and `status` (columns exist, `schema.sql:76-77`).
  2. Tier is shown as a word (mono text), not a `tier-badge` pill.
  3. A **Role** select per row offers `user` and `educator`, calling the new `rzSupa.setRole()` →
     `admin_set_role` (`schema.sql:236`, root-checked, audited by trigger `:770-773`). Rows whose role is
     `root` show the word `root` and no select.
  4. The stale "⚠ public pw" flag (`SUPA_PUBLIC_PW`, `:3266-3267`) is removed (P22).
  5. The panel title shows the count as text ("42 accounts" from `supaCount`, `:3260`), not a badge.
- **Exceptions:** `admin_set_role` errors map to toasts: `cannot demote the last root role` becomes "Not
  changed: this is the last root account." and the select reverts.
- **Acceptance:** L6 (role change calls `setRole` with the row id; revert on error), L8.

### FR-12 Audit log on `audit_log`, and audit rows from the Edge Functions
- **Description:** the Audit log panel reads `audit_log` through `rzSupa.listAuditLog({limit:50, before,
  action})`. The AUTH_V2 "server" source toggle (`auditSrcServer`) is untouched (D-9). The fabricated
  "client" source is deleted.
- **Processing:** newest first. **Load older** passes `before = created_at` of the last row, a keyset with
  no offset. The action select filters on the server (`eq('action', …)`). The target search filters the
  loaded rows on `target_type`/`target_id`. The actor shows the e-mail from the loaded account list, else
  the first 8 characters of the UUID, else `system` for a null actor. Expanding a row shows `meta` as
  escaped, pretty-printed JSON. **Export CSV** writes the loaded rows (`time_wib, actor, action,
  target_type, target_id, meta_json`) with RFC 4180 quoting.
- **Edge Function audit rows:** `admin-users` inserts through its service client
  `{actor_id: caller.id, action, target_type:'profile', target_id, meta}` for `admin_create_user` (`meta
  {tier}`), `admin_reset_password` (`meta {}`), `admin_delete_user` (`meta {tier_before}`) and
  `admin_migrate_legacy` (`meta {created}`). `mayar-proxy` does the same for `mayar_invoice_create`
  (`target_type 'mayar_invoice'`, `target_id` = Mayar's invoice id, `meta {quantity, rate,
  expiryDays}`) and `mayar_portal_link` (`meta {}`). No audit row holds an e-mail, a name or a phone
  number.
- **Exceptions:** if the audit insert fails after the operation succeeded, the function returns `{ok:true,
  data, audit:'failed'}` and logs the error. The admin shows the warn toast "Done, but the audit row was not
  written." The operation is not rolled back, because a user deletion cannot be undone.
- **Acceptance:** L6 (panel), L7 (static: every mutating case calls `audit(`).

### FR-13 Settings with true facts, and a correct clock
- **Description:** replace the Settings grid (`:4877-4911`) with "Platform facts" (§9.10). Delete System
  Health and Data Management (FR-8).
- **Processing:** facts come from `window.RZ_VERSION` and `RZ_VERSION_DATE` (`js/rz-version.js:2-3`), the
  host of `RZ_CONFIG.SUPABASE_URL`, and constants that describe the code (GA id, counter name, hosting).
  "This browser's localStorage" is measured as today (`storageUsed`) and labelled "This browser only".
  Topbar clock: `new Date().toLocaleTimeString('en-GB', {timeZone:'Asia/Jakarta', hour12:false}) + ' WIB'`.
- **Acceptance:** L1 (no stale literal), L6 (clock text matches `/^\d{2}:\d{2}:\d{2} WIB$/`).

### FR-14 Mayar through `mayar-proxy`, key out of the browser
- **Description:** NEW Edge Function (contract §11.6). The admin's `mayarFetch(endpoint, options)` (`:4994`)
  becomes a thin wrapper over `rzSupa.mayar(action, params)`. Every existing caller (`:5072-5264`) maps to
  one of 7 actions: `balance`, `transactions` (with the optional `period`, `startDate`/`endDate`,
  `productId` and `customerId` filters the callers use at `:5084-5128`), `unpaid` (`:5091`, `:5134`),
  `customer_search` (`:5143`), `membership` (`:5206`), `invoice_create` (`:5244`) and `portal_link`
  (`:5264`). Delete `MAYAR_API_BASE`, `MAYAR_KEY`, `getMayarKey()` and the Bearer header. Keep the
  18-per-minute client guard (`:4998-5001`). `renderMayar()` runs when the Mayar section is first shown,
  not at admin load. Today both init paths call it eagerly (`:2484`, `:6070`), while `showSection()` already
  calls it lazily (`:2505`). Removing the two eager calls means an admin visit costs no Mayar call unless the
  owner opens that section.
- **Processing in the function:** CORS allowlist and root check copied from `admin-users`, then
  `validate(body)` and `buildUpstream(action, params)` from `core.ts`, then `fetch` to
  `https://api.mayar.id/hl/v1` with `Authorization: Bearer ${Deno.env.get('MAYAR_API_KEY')}` and a 10 s
  timeout. Return `{ok:true, data:<Mayar JSON>}`. Errors per §11.9.
- **UI fixes in the same panel:** the 9 invoice and filter inputs whose `aria-label` repeats the
  placeholder (for example `aria-label="john@example.com"`) get real labels (§9.10). Invoice creation shows
  a confirm dialog and disables its button while in flight.
- **Exceptions:** function not deployed (404 from `/functions/v1/mayar-proxy`): state `not_deployed` with
  "The mayar-proxy function is not deployed yet. See Owner Actions." No fallback to a browser key.
- **Acceptance:** L7; L6 (not-deployed state with the stub).

### FR-15 Panel states, source attribution and notifications
- **Description:** every rebuilt card is an `.ops-card` with `data-ops-source` (one of `admin_account_summary`,
  `admin_usage_summary`, `admin_scenario_summary`, `audit_log`, `profiles`, `mayar-proxy`, `site-constants`,
  `this-browser`) and a visible "Source: …" caption (§9.10). Each card runs the state machine of §12.3:
  `loading`, then `ready`, `empty`, `error`, `signed-out` or `not-root`.
- **Notifications:** load `js/rz-toast.js` (with its `?v=` token) and define
  `window.showToast = function (m, kind) { return RZToast[kind || 'info'](m); }`, so the 7 existing
  `(window.showToast||alert)` call sites stop using `alert()`. `showMayarToast` routes to RZToast.
- **Error mapping:** a message matching `/not authorized|root required/` gives `not-root`. `not signed in`
  gives `signed-out`. Network `TypeError` gives "Could not reach Supabase". Anything else gives the
  `friendly()` text.
- **Acceptance:** L1 (attribute present), L6 (each state reachable with the stub).

### FR-16 `js/rz-supabase.js` API additions
- **Description:** add `usageSummary(days)`, `accountSummary()`, `scenarioSummary(months)`,
  `setRole(userId, role)`, `listAuditLog({limit, before, action})` (the old numeric argument still works) and
  `mayar(action, params)`. Add `role` and `status` to `listAllProfiles`. Every method returns `{data,
  error}` as the file does today and never throws.
- **Acceptance:** contract checks in `tools/test-admin-real-data.mjs --static` (method names and argument
  validation, read from source); L6 through the stub that mirrors the same API.

### FR-17 Owner board, service worker and docs
- **Description:** `setup-supabase.html` `OWNER_ACTIONS` gains entries for OA-1 to OA-5 (Indonesian copy,
  as the board is, §9.10). `sw.js` `NETWORK_FIRST_PATHS` (`:11-22`) gains `/rz-tracker.js` and
  `/js/rz-config.js` (coordinate with the peer's P25). Standards docs change per §22.4.
- **Acceptance:** DoD checklist §24; `node tools/test-gate-wiring.mjs` passes with the new CLAUDE.md lines.

## 9. UI/UX specification

### 9.1 Information architecture (admin nav, before and after)

| Group | Before (`rz-ops-p7x3k9m.html:792-858`) | After |
|---|---|---|
| Analytics | Dashboard; Revenue `$`; Mayar Payments `Live`; User Activity `0` | Dashboard; Usage; Mayar payments |
| Management | Users `50`; Credentials `15`; Feature Flags; Tier Manager `v2` (hidden unless AUTH_V2); Subscribers `0` | Accounts; Feature flags (PRD-Q11); Tier Manager (unchanged) |
| Intelligence | DC Intelligence | unchanged |
| System | Audit Log; Owner Actions; Settings | Audit log; Owner Actions; Settings |
| Personal Apps | Stock Investment; Finance Terminal `Live`; IDR Stocks `WIP` | unchanged (out of scope) |

No nav item in the rebuilt groups carries a badge. Counts live on the panels.

### 9.2 Layouts

#### 9.2.1 Dashboard, 1440 px (example values are layout placeholders, not data)

```
+-- sidebar 240 ---+ +-- main ------------------------------------------------------------------------+
| ANALYTICS        | | Dashboard                                        Updated 14:02:11 WIB  [Refresh] |
|  > Dashboard     | | Accounts, usage and admin actions, read from Supabase.                          |
|    Usage         | |                                                                                  |
|    Mayar payments| | +-- Accounts -------------------------+ +-- Usage, last 30 days ---------------+ |
| MANAGEMENT       | | | Accounts                        n   | | Page views                         n   | |
|    Accounts      | | | Tier free                       n   | | Visits (browser-tab sessions)      n   | |
|    Feature flags | | | Tier demo                       n   | | Calculate-button clicks            n   | |
|    Tier Manager  | | | Tier pro                        n   | | PDF-export clicks                  n   | |
| INTELLIGENCE     | | | Tier root                       n   | | Most viewed page    /path.html     n   | |
|    DC Intel.     | | | Role educator                   n   | | Source: usage_daily through            | |
| SYSTEM           | | | Suspended                       n   | | admin_usage_summary(30). Counts only   | |
|    Audit log     | | | Signed in within 30 days        n   | | visitors who accepted analytics        | |
|    Owner Actions | | | Never signed in                 n   | | cookies on the 62 pages that load      | |
|    Settings      | | | New this month                  n   | | rz-tracker.js, so they are a lower     | |
| PERSONAL APPS    | | | Source: profiles and auth.users     | | bound.                                 | |
|    ...           | | | through admin_account_summary().    | +----------------------------------------+ |
|                  | | +-------------------------------------+                                            |
|                  | | +-- New accounts per month (bar, 12 months, one amber series) ------------------+ |
|                  | | |  |   |       |   |   ||  |   |   |                                          | |
|                  | | | Source: profiles.created_at, Asia/Jakarta calendar months.                     | |
|                  | | +--------------------------------------------------------------------------------+ |
|                  | | +-- Saved scenarios -------------------+ +-- Recent admin actions -------------+ |
|                  | | | Saved scenarios                  n   | | Time (WIB)   Actor   Action   Target   | |
|                  | | | Accounts with a saved scenario   n   | | ... 10 rows                            | |
|                  | | | capex                            n   | | Source: audit_log, newest 10 rows.     | |
|                  | | | ... every calculator with a count    | +----------------------------------------+ |
|                  | | | Source: saved_scenarios through      |                                            |
|                  | | | admin_scenario_summary(12). Counts   |                                            |
|                  | | | only; scenario contents are not read.|                                            |
|                  | | +--------------------------------------+                                            |
+------------------+ +----------------------------------------------------------------------------------+
```

Grid: `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px` at ≥ 1024 px; the chart spans both
columns. Values are right-aligned, `font-family: var(--fs-mono)`, `font-variant-numeric: tabular-nums`.

#### 9.2.2 Dashboard, 390 px

```
+-- 390 ------------------------------------+
| [=] Dashboard                  [Refresh]  |
| Updated 14:02:11 WIB                      |
| +-- Accounts ----------------------------+|
| | Accounts                            n  ||
| | ... rows as 1440, one column           ||
| | Source: ...                            ||
| +----------------------------------------+|
| +-- Usage, last 30 days -----------------+|
| +-- New accounts per month (bars) -------+|
| +-- Saved scenarios ---------------------+|
| +-- Recent admin actions ----------------+|
| | 14:02  role_change                     ||
| | bagus@...  profile 3f2a9c1e            ||  (two-line rows; no horizontal scroll)
| +----------------------------------------+|
+-------------------------------------------+
```

Side gutter 16 px. Cards stack in the order shown. The table becomes two-line rows (time and action, then
actor and target).

#### 9.2.3 Usage, 1440 px

```
Usage                                                    Range [Last 30 days v]   [Refresh]
Page views and named events from visitors who accepted analytics cookies.
+-- Page views per day ---------------------------------------------------------------------+
|  bars, one per day, zeros drawn as empty slots                                             |
|  Source: usage_daily through admin_usage_summary(30). Days are Asia/Jakarta calendar days. |
|  2026-10-13 to 2026-11-11.                                                                 |
+--------------------------------------------------------------------------------------------+
(Counting was capped on 2 days in this range, so these counts are lower than the real traffic.)
+-- Events ------------------------------+  +-- Top pages ----------------------------------+
| Event                          Count   |  | Page                              Page views  |
| Page views                         n   |  | /path.html                                n   |
| Visits (browser-tab sessions)      n   |  | ... up to 25                                  |
| ...                                    |  +-----------------------------------------------+
+----------------------------------------+  +-- Screen width ---------------+
+-- Search results opened ---------------+  | Narrow (767 px or less)    n  |
| Destination                    Count   |  | Wide (more than 767 px)    n  |
+----------------------------------------+  +-------------------------------+
+-- Palette commands --------------------+  +-- Diagram scenarios ---------------------------+
Counting started on 2026-11-12.
Not collected: IP address, location, browser, user agent, referrer, account, e-mail, typed search text,
query strings, or any identifier. See privacy.html.
```

At 390 px: one column, the range select is full width with `font-size: 16px`, and the chart keeps a height
of 180 px.

#### 9.2.4 Audit log, 1440 px

```
Audit log                         Action [All actions v]  Search [Target id or type    ]  [Export CSV]
Admin actions recorded in Supabase audit_log. Times are Asia/Jakarta (WIB).
+-----------------------------------------------------------------------------------------------+
| Time (WIB)          Actor                      Action                 Target                  |
| 2026-11-11 14:02    bagus@resistancezero.com   role_change            profile 3f2a9c1e        |
|   > Details   {"old":"user","new":"educator"}                                                 |
| ... 50 rows                                                                                   |
+-----------------------------------------------------------------------------------------------+
[Load older]                                                         Showing 50 rows, newest first
```

At 390 px: the filters stack (select, input, button, each full width, 16 px font). Rows become two-line
blocks as on the dashboard.

#### 9.2.5 Accounts row (root view)

```
| B | bagus@resistancezero.com          root   Tier [root  v]  Role  root        2026-07-11  [key] [trash] |
| E | educator@resistancezero.com       pro    Tier [pro   v]  Role [educator v]  2026-07-11  [key] [trash] |
```

At 390 px the row wraps: e-mail on line 1; tier select and role select on line 2; date and the two icon
buttons on line 3. The icon buttons keep their `title` and gain `aria-label` ("Reset password for
<email>", "Delete <email>").

#### 9.2.6 Settings

```
Settings
+-- Platform facts --------------------------------------------------------------+
| Site version                 3.35.x (from js/rz-version.js)                    |
| Version date                 2026-11-xx                                        |
| Accounts backend             Supabase Auth, project host kffjaqkqwhvbqxdumyll…  |
| Usage counter                record_usage_event, schema Module 10              |
| Google Analytics             G-GED7FX8RTV, loads only after Accept             |
| Hosting                      GitHub Pages (static files)                       |
| Admin file                   rz-ops-p7x3k9m.html                               |
| This browser's localStorage  n KB (this browser only)                          |
| Source: site constants and this browser.                                       |
+--------------------------------------------------------------------------------+
```

#### 9.2.7 Mayar, states that are new

```
+-- Mayar payments ------------------------------------------------------------------+
| The mayar-proxy function is not deployed yet. See Owner Actions.   [Owner Actions] |
+------------------------------------------------------------------------------------+
```

The rest of the Mayar layout is unchanged. Data reaches the same renderers.

#### 9.2.8 `privacy.html` "4.1 Your cookie choice"

```
4.1 Your cookie choice
Current choice: Declined (your browser sends Global Privacy Control)
[Turn analytics on]  [Turn analytics off]
Saved. Analytics are off on this browser.          <- role="status", empty until a button is used
This choice is stored in this browser only (localStorage key rz_cookie_consent).
```

The button that matches the current choice is `disabled` (with `aria-disabled="true"`). At 390 px the two
buttons stack full width with a minimum height of 44 px.

#### 9.2.9 Cookie banner

Layout unchanged (`js/rz-cookie-consent.js:67-88`). Copy changes only (§9.10).

### 9.3 Component hierarchy (HTML contract)

```html
<div class="section active" id="sec-dashboard">
  <header class="ops-head">
    <h1>Dashboard</h1>
    <p class="ops-sub">Accounts, usage and admin actions, read from Supabase.</p>
    <p class="ops-updated" id="dashUpdated" aria-live="polite"></p>
    <button type="button" class="btn btn-ghost" id="dashRefresh">Refresh</button>
  </header>
  <div class="ops-grid">
    <section class="ops-card" data-ops-source="admin_account_summary" data-state="loading" aria-labelledby="cardAccountsH">
      <h2 id="cardAccountsH">Accounts</h2>
      <dl class="ops-facts" id="cardAccounts"></dl>
      <p class="ops-state" role="status"></p>      <!-- loading / empty / error copy -->
      <button type="button" class="btn btn-ghost ops-retry" hidden>Retry</button>
      <p class="ops-source">Source: profiles and auth.users through admin_account_summary().</p>
    </section>
    <!-- usage (admin_usage_summary), scenarios (admin_scenario_summary), audit (audit_log), chart (profiles) -->
  </div>
</div>
```

Cards with `data-ops-source` (13): Dashboard 5 (accounts, usage, scenarios, recent actions, signups chart);
Usage 7 (chart, events, top pages, screen width, search destinations, palette commands, diagram scenarios),
which share one call, so each carries `admin_usage_summary`; Audit log 1 (`audit_log`). Settings and
Mayar carry the attribute on their existing cards (`site-constants`/`this-browser`, `mayar-proxy`), and the
Accounts panel carries `profiles`. L1 counts the rebuilt sections' cards: 13 plus 3 = 16 attributes.

### 9.4 Controls and exact behaviour

| Control | Where | Behaviour | Keyboard |
|---|---|---|---|
| Refresh | Dashboard, Usage | re-runs the panel's calls; disabled while any call is in flight; no toast on success | Enter or Space |
| Retry | each card in error | re-runs that card's call only | Enter or Space |
| Range select `#usageRange` | Usage | `change` triggers `usageSummary(7/30/90)`; the previous result stays visible with `aria-busy="true"` until the new one renders | native select |
| Action select `#auditAction` | Audit log | `change` reloads the first page with the action filter on the server | native select |
| Search `#auditSearch` | Audit log | filters loaded rows by `target_type` or `target_id` substring (case-insensitive) after 200 ms idle; shows "No rows match." when empty | text input, 16 px on phones |
| Export CSV | Audit log | downloads `audit-log-<YYYYMMDD-HHMM>.csv` of the loaded rows; disabled with no rows | Enter or Space |
| Load older | Audit log | fetches 50 older rows; hidden when the last page returned fewer than 50 | Enter or Space |
| Details | Audit row | toggles `aria-expanded` and shows `meta` JSON | Enter or Space |
| Tier select | Accounts | unchanged behaviour (`changeSupaTier`, `:3309`) | native |
| Role select | Accounts | `setRole`; on error toast + revert | native |
| Reset password / Delete | Accounts | unchanged flows (`:3363`, `:3374`); the result toast via RZToast; the audit-failed warn toast when `audit:'failed'` | Enter or Space |
| Turn analytics on/off | `privacy.html` | `RZCookieConsent.set()`; status line; buttons swap disabled state | Enter or Space |
| Create invoice | Mayar | validate, confirm dialog with name, amount and quantity, then POST; button disabled until the response | Enter or Space |

There are no dead buttons. Every control above has a handler and a test in L6 or L8.

### 9.5 States (per card)

| State | Shown | Copy |
|---|---|---|
| loading | state line, no numbers, `data-state="loading"`, `aria-busy="true"` | "Loading…" |
| ready | content; state line empty | — |
| empty | state line; content hidden | per card, §9.10 |
| error | state line plus Retry | "Could not load {card}: {message}." |
| signed-out | one panel-level message replacing all cards | "Sign in with a root account to see admin data." plus link "Open account.html" |
| not-root | one panel-level message | "This account ({email}) is not a root account. Admin data is not shown." |
| not-configured | one panel-level message | "Supabase is not configured on this page." (existing copy, `:3241`) |

### 9.6 Notifications (RZToast)

| Event | Kind | Copy |
|---|---|---|
| Tier changed | ok | "Tier changed to {tier} for {email}." |
| Role changed | ok | "Role changed to {role} for {email}." |
| Role change refused, last root | warn | "Not changed: this is the last root account." |
| Password reset sent | ok | existing copy kept |
| Account deleted | ok | "Deleted {email}." |
| Audit row missing | warn | "Done, but the audit row was not written." |
| Invoice created | ok | "Invoice created." |
| Mayar limit | warn | "Mayar allows 18 calls a minute from this page. Wait a moment and retry." |
| Any failed write | fault | "{action} failed: {message}" |

Reads never toast. Their state lines carry the message.

### 9.7 Loading, empty and error copy

- Accounts empty: "No accounts yet."
- Usage empty: "No data yet. Counting starts when a visitor accepts analytics cookies on a page that loads
  rz-tracker.js."
- Scenarios empty: "No saved scenarios yet."
- Recent actions or Audit log empty: "No admin actions recorded yet."
- Chart with all-zero months: the bars render at zero and the caption adds "No new accounts in this period."
- Error: "Could not load {Accounts|usage counts|saved scenarios|the audit log}: {message}."
- Network: "Could not reach Supabase: {message}."

### 9.8 Styling contract (admin; one CSS block added to the page's `<style>`)

The admin already runs on the finance-suite tokens (`css/rz-finance-suite.css:20-75`), and that sheet
documents them as unified with the hub register (one amber accent `--fs-acc2`, IBM Plex Sans `--fs-sans`,
JetBrains Mono `--fs-mono`, card radius `--fs-r: 4px`). Loading `css/rz-hub.css` beside it would put two
token systems on one page, so the rebuilt panels use `--fs-*`:

```css
.ops-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.ops-card{background:var(--fs-bg2);border:1px solid var(--fs-bd);border-radius:var(--fs-r);padding:16px;min-width:0}
.ops-card h2{font:600 14px/1.3 var(--fs-sans);color:var(--fs-t1);margin:0 0 12px}
.ops-facts{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 16px;margin:0}
.ops-facts dt{color:var(--fs-t3);font:400 13px/1.4 var(--fs-sans)}
.ops-facts dd{margin:0;text-align:right;color:var(--fs-t1);font:500 13px/1.4 var(--fs-mono);font-variant-numeric:tabular-nums}
.ops-source,.ops-state{color:var(--fs-t4);font:400 12px/1.4 var(--fs-sans);margin:12px 0 0}
.ops-table{width:100%;border-collapse:collapse;font:400 13px/1.4 var(--fs-sans)}
.ops-table th{color:var(--fs-t3);font-weight:500;text-align:left;border-bottom:1px solid var(--fs-bd);padding:6px 8px}
.ops-table td{border-bottom:1px solid var(--fs-bd2);padding:6px 8px;color:var(--fs-t2)}
.ops-table td.num{text-align:right;font-family:var(--fs-mono);font-variant-numeric:tabular-nums}
.ops-retry{margin-top:8px}
@media (max-width:1023px){.ops-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:767px){.ops-card select,.ops-card input{font-size:16px;width:100%}}
```

Rules: no stat tiles (facts are `<dl>` rows); no badge or pill for a state (tier and role are words); no
gradient; no shadow beyond the existing card; no `transition: all`; no `:hover` transform; radius ≤ 4 px on
cards. Chart.js series colour reads `getComputedStyle(document.documentElement).getPropertyValue('--fs-acc2')`
at render time and again after `toggleAdminTheme()`, so both themes are correct. One series per chart, no
fill gradient, no legend for a single series. The axis titles are the caption.

### 9.9 Responsive, keyboard, focus, motion

- **Widths:** verified at 1440 and 390 (L8). No horizontal scroll at 390 (`scrollWidth ≤ clientWidth` on
  `main`). Inputs and selects are 16 px on phones.
- **Keyboard:** every control is a native `button`, `select` or `input`. Tab order follows the visual order.
  The Details toggles are buttons with `aria-expanded`. The audit table has `<caption>` text equal to its
  card title.
- **Focus:** `:focus-visible` outline `2px solid var(--fs-acc2)`, offset 2 px. After **Load older**, focus
  moves to the first new row's Details button.
- **Motion:** none added. Cards appear without animation. The chart is created with `animation: false`.
  RZToast keeps its own motion (`js/rz-toast.js:17-29`, transitions on transform and opacity, reduced
  motion respected).
- **Screen readers:** each card's state line is `role="status"`. The updated time is `aria-live="polite"`.

### 9.10 Exact copy strings

**Cookie banner** (`js/rz-cookie-consent.js` defaults)
- msg: "Analytics stay off until you choose. Accept turns on Google Analytics and an anonymous page-view
  count on this site."
- more: "Details" (link to `/privacy.html#cookie-choice`)
- accept: "Accept"
- decline: "Decline"

**`privacy.html` replacements** (draft; the owner approves wording, D-10)
- §1.2 table rows:
  - "Page views and named events (only after you accept analytics cookies) | resistancezero.com page counter
    (Supabase) | Counts per day, page, event and screen-width class. No IP address, no identifier, no
    browser details, no account, no typed text."
  - "Page views and feature usage (only after you accept analytics cookies) | Google Analytics
    (G-GED7FX8RTV) | Service improvement, usage patterns"
  - "IP address | Our hosting and service providers (GitHub Pages, Supabase, Cloudflare) receive it with
    every request and keep request logs under their own policies | Delivering the site. This site's own
    scripts do not record it."
- §1.3 note: "The following data is stored in your browser's localStorage. The page counter and Google
  Analytics never read these keys. Saved scenarios are the exception: when you are signed in and press
  Save, the scenario is stored in your account (Supabase)."
- §1.3 rows added: "rz_cookie_consent | your analytics choice | remembering it". Rows removed: none (the old
  `rz_user_events` and `rz_geo_cache` were never listed; the new tracker deletes them).
- §3 provider list adds: "Supabase — accounts, saved scenarios and the anonymous page counter".
- §4 cookies table, GA row purpose: "Analytics, set only after you accept".
- §5 bullet: "Calculator computations run in your browser. Inputs leave your browser only when you save a
  scenario to your account."
- §6 retention adds: "Anonymous page counts | 400 days".
- §4.1 new section: heading "4.1 Your cookie choice"; "Current choice: {Accepted | Declined | Declined (your
  browser sends Global Privacy Control) | Not chosen yet}"; buttons "Turn analytics on", "Turn analytics
  off"; status "Saved. Analytics are on on this browser." or "Saved. Analytics are off on this browser.";
  note "This choice is stored in this browser only (localStorage key rz_cookie_consent)."; blocked-script
  copy in FR-7.

**Admin.** Every string in §9.2, §9.5–§9.7, plus:
- Event labels: `page_view` "Page views"; `visit_start` "Visits (browser-tab sessions)"; `calc_use`
  "Calculate-button clicks"; `pdf_export` "PDF-export clicks"; `cv_download` "CV-download clicks";
  `ws_download` "Work-sample download clicks"; `pro_click` "Pro-mode button clicks"; `rz_search_open`
  "Search opened"; `rz_search_go` "Search result opened"; `rz_command` "Palette command run";
  `rz_diagram_scenario` "Diagram scenario chosen"; `rz_scrolly_complete` "Scroll story finished";
  `_limited` "Minutes in which the per-minute cap refused events"; `_overflow` "Events refused by the daily
  row cap".
- Screen width rows: "Narrow (767 px or less)", "Wide (more than 767 px)".
- Capped note: "Counting was capped on {n} day(s) in this range, so these counts are lower than the real
  traffic."
- First-day line: "Counting started on {YYYY-MM-DD}."
- Settings rows: "Site version", "Version date", "Accounts backend" ("Supabase Auth, project host {host}"),
  "Usage counter" ("record_usage_event, schema Module 10"), "Google Analytics" ("G-GED7FX8RTV, loads only
  after Accept"), "Hosting" ("GitHub Pages (static files)"), "Admin file", "This browser's localStorage"
  ("{n} KB (this browser only)"); caption "Source: site constants and this browser."
- Mayar input labels: "Customer name", "Customer e-mail", "Customer mobile (optional)", "Description",
  "Quantity", "Rate (IDR)", "Redirect URL after payment (optional)", "Invoice expiry (days)", "Product ID".
  The currency is labelled IDR because the existing placeholder is 99000 and Mayar is an Indonesian
  gateway. T-11 confirms it against Mayar's API documentation before release.
- Mayar errors: `not_deployed` "The mayar-proxy function is not deployed yet. See Owner Actions.";
  `not_root` "Only a root account can read payments."; `upstream_rate_limited` "Mayar refused the call
  (rate limit). Wait a minute and retry."; `upstream_timeout` "Mayar did not answer within 10 seconds.
  Check the invoice list before retrying a create."; `upstream_error` "Mayar answered {status}: {message}".

**Owner board entries** (`setup-supabase.html`, Indonesian like the rest of the board)
- OA-1 title: "Cek dua hal di SQL Editor sebelum Module 10 (read-only)". Steps: the two queries of §22.1.
  Why: "Supaya tahu apakah anon masih bisa memanggil log_event dan berapa ukuran DB sekarang."
- OA-2 title: "Jalankan SQL Module 10 — usage counts". Steps: SQL Editor, paste the Module 10 block, Run,
  then the verify queries of §22.1.
- OA-3 title: "Deploy Edge Function mayar-proxy + set secret MAYAR_API_KEY". Why: "Kunci Mayar tidak boleh
  lagi ada di browser."
- OA-4 title: "Rotasi API key Mayar setelah OA-3". Why: "Kunci lama pernah tersimpan di localStorage
  browser admin."
- OA-5 title: "Deploy ulang admin-users (baris audit)".
