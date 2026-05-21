# Educator Tier — Implementation Plan

- **Date:** 2026-05-19
- **Mode:** PLAN ONLY (no code until approved)
- **Scope:** introduce a new user tier `educator` strictly between `demo` and `pro` privilege, with hard-gated access to **DC AI** (`datahallAI.html`), **DC Conventional** (`dc-conventional.html`), and **DCMOC** (`/dcmoc/`) — *without* admin-panel access.
- **Not in scope:** Finance Terminal (separate plan); any role above `pro`; auto-emailing or external IdP integration.

---

## 1. Goal & acceptance criteria

An admin can grant a user `educator` status. That user:
1. Logs in via the same modal (`auth.js`).
2. Sees an **EDUCATOR** badge in the global header dropdown.
3. Can open **DC AI**, **DC Conventional**, and the **DCMOC** sub-app — without seeing the "root-only" login prompt that currently blocks `demo` and `pro` users on those pages.
4. **Cannot** open `rz-ops-p7x3k9m.html` (admin panel) — `isAdmin()` and the panel's gate stay strictly `root`-only.
5. Inherits all `demo`-tier features in the per-page feature-flag matrix unless the matrix explicitly grants more (per page).
6. Admin can list / filter / create / promote / demote educators from the **User Management** section of `rz-ops`.
7. All audit-log events that mention tier change render correctly for `educator` (existing `tier_change` log type covers it).
8. No regression: `audit-script-tags.py --strict`, `audit-js-syntax.py --strict`, `audit-mobile-responsive.py --strict`, and the existing Puppeteer probes stay green; `tier` and `role` filters across the UI still render every category.

## 2. Architecture decisions (made up front to avoid drift)

| Decision | Choice | Why |
|---|---|---|
| Add a new role, or reuse `pro`? | **New role `educator`** | Admin gating in `auth.js:isAdmin()` stays strictly `ROOT_EMAILS`; educator is its own bucket separate from `pro` so existing `role==='pro'` checks don't accidentally grant educator behavior. |
| Add a new tier (feature-flag column), or reuse `demo`? | **New tier `educator`** between demo & pro | The user explicitly said "higher than demo"; reusing `demo` would force admins to enable all DC-AI/DC-conv/dcmoc flags for every demo user. A separate tier is cleaner and audit-friendlier. |
| How does educator unlock DC-AI / DC-conventional / DCMOC? | **Remove these 3 paths from `ROOT_ONLY_PATHS`** and gate them via the existing per-page **feature-flag matrix** (which already lists `dc-conventional`, `dcmoc`, `datahallAI`). Default matrix: `free:false, demo:false, educator:true, pro:true`. Root always passes via `role==='root'` early-return. | The feature-flag matrix is already the right mechanism for "tier-based page access"; the hard ROOT_ONLY list is a historical kludge. This converges the two systems and means admins can later tighten/widen via the matrix without code changes. |
| Persistence of educator user list | **`localStorage.rz_admin_educators`** (allowlist of emails), edited via the admin User Management section, mirrored to the in-memory `USERS` array in `auth.js`'s mock auth. Same pattern as `rz_admin_features_by_page`. | Site is static — no backend. This matches the existing admin-tool storage convention. Future: swap to a real backend without changing the UI surface. |
| Tier filter & badge UI | Add `EDUCATOR` everywhere `FREE/DEMO/PRO` appears (filter dropdowns, table badges, dropdown chip, matrix header). | Required for non-bug, fully-aligned UI. |

## 3. File touch map

### Code (canonical paths)
| File | Change |
|---|---|
| `auth.js` | Add `EDUCATOR_EMAILS` (resolved from `localStorage.rz_admin_educators` on init + a hardcoded seed list); extend `detectRole`/`getRoleFromSession` → return `'educator'`; extend `getTier()` → return `'educator'` when role is `educator`; **remove** `/dcmoc`, `/datahallai.html`, `/dc-conventional.html` from `ROOT_ONLY_PATHS`; add a new `enforceTierFeatureAccess()` helper that consults `rz-feature-flags.js` for those three pages and shows the existing login/upgrade modal if access denied; keep `isAdmin()` strictly root. |
| `js/rz-feature-flags.js` | Schema: every page entry gains an `educator` boolean. Default rule: `educator = demo` (inheritance) UNLESS the page is `dc-conventional` / `dcmoc` / `datahallAI` → `educator:true`. Extend `getTier()` (the page-side one) to recognize `'educator'`. Extend `canAccess()` lookup to read the educator field. |
| `rz-ops-p7x3k9m.html` | (a) User Management: tier filter dropdown adds `<option value="educator">Educator</option>`; user table tier-badge renders `.educator` class; Add-User modal accepts educator tier; row context menu has "Promote to educator" / "Demote to demo". (b) Feature Flags matrix: add a 4th column header **EDUCATOR** between DEMO and PRO; cell rendering includes the educator toggle; bulk-toggle options include `educator_only` / `educator+pro`. (c) Tier-badge CSS: add `.tier-badge.educator{background:rgba(56,189,248,0.18);color:#7dd3fc}` (instrument-cyan; matches the design.md cyan token, not Anthropic purple). (d) Sidebar role label and demo-tier user filter rendering aligned. |
| `script.js` / global theme JS | Search for `'pro' \| 'free'` literal checks and extend to include `'educator'` where access decisions are made (currently demo users get certain reveals; educator should behave at-least-as-demo). |
| `standarization/AUTH_STANDARD.md` | Document the new role + the educator-allowlist storage key + the matrix-based DC AI / DC conv / DCMOC gating. |
| `standarization/PRO_MODE_STANDARDIZATION.md` | Add Educator section: capability matrix + UI badge spec. |
| `standarization/FEATURE_FLAGS_STANDARD.md` | Add the EDUCATOR column to the canonical 4-tier matrix; bulk-toggle ops; default rule (`educator = demo` unless explicit override). |
| `CHANGELOG.md` + `js/rz-version.js` + `sw.js` | Bump at MERGE time (MINOR — feature). Version is **not** hardcoded here — at merge, read `js/rz-version.js` on `main` and pick the next free MINOR (parallel session owns v1.21.0–v1.22.x; this is likely v1.24.0 or later). |
| `CLAUDE.md` | Add an "Auth tiers" subsection summarising `root → pro → educator → demo → free`. |

### Tests / probes
| File | Change |
|---|---|
| `tools/probe-educator-access.mjs` *(new)* | Puppeteer: log in as a seeded educator (`educator@resistancezero.com`), assert: (a) admin panel `rz-ops-p7x3k9m.html` redirects/blocks → `isAdmin()` false; (b) `/datahallai.html`, `/dc-conventional.html`, `/dcmoc/` load and render (no login-required modal); (c) header chip reads "EDUCATOR" with the cyan class; (d) a representative locked-pro page (e.g. a Pro-only calc feature) stays locked. |
| `tools/probe-all-pageerrors.mjs` | Re-run on touched pages; must report 0 SyntaxError. |
| `tools/audit-script-tags.py --strict` + `audit-js-syntax.py --strict` + `audit-mobile-responsive.py --strict` + `audit-version-stamp.py --strict` | All green pre-merge. |

## 4. Phased tasks (bite-sized)

Each task = its own commit on a worktree branch `educator-tier`. Pattern matches the Finance Terminal worktree (worktree + branch off latest `main`, feature-flagged where useful, merged once probes green).

### Task 0 — Worktree + plan-doc commit
- `git worktree add ~/.config/superpowers/worktrees/rz-work/educator-tier -b educator-tier main`
- Commit this plan doc (`docs/plans/2026-05-19-educator-tier.md`) into the new branch.

### Task 1 — `auth.js` role/tier extensions (TDD)
- Add `EDUCATOR_EMAILS` allowlist + `localStorage.rz_admin_educators` merge on init.
- Extend `detectRole`, `getRoleFromSession`, `getTier` for `educator`.
- Add seed user `educator@resistancezero.com / educator2026 / tier:'educator' role:'educator'` to the mock `USERS` array.
- **Do NOT** touch `ROOT_ONLY_PATHS` yet (that lands in Task 3 atomically with the matrix gating).
- Smoke: in DevTools, `__rzAuth.getTier({email:'educator@resistancezero.com'}) === 'educator'`.
- Commit: `feat(auth): introduce educator role + tier (no behavior change yet)`.

### Task 2 — `js/rz-feature-flags.js` 4-tier matrix
- Schema migration: every page entry gains an `educator` field.
- Default population: `educator = demo` for every page **except** `dc-conventional`, `dcmoc`, `datahallAI` → `educator:true`.
- Extend `getTier()` and `canAccess()` to read the educator column; admin override storage (`rz_admin_features_by_page`) gains an `educator` key per page.
- Unit test the resolver: educator on `datahallAI` → true; educator on a Pro-only feature → false; educator on a Demo-allowed feature → true.
- Commit: `feat(flags): 4-tier matrix incl. educator (default=demo, dc-* + dcmoc = on)`.

### Task 3 — Convert ROOT_ONLY DC pages to matrix-gated
- In `auth.js`, **remove** `/dcmoc`, `/datahallai.html`, `/dc-conventional.html` from `ROOT_ONLY_PATHS`.
- Add an `enforceTierFeatureAccess(session, pageKey)` helper invoked by the existing on-load gate on those three pages (or as a shared `<script>` include): consults `rz-feature-flags.js`. Root short-circuits to allow. Educator passes via matrix. Demo/Free see the existing login/upgrade modal (or "Pro/Educator required" copy).
- Verify regression: Demo/Free still see the upgrade modal on these pages. Root still passes. Educator now passes.
- Commit: `feat(auth): educator unlocks dc-ai/dc-conventional/dcmoc via flag matrix (removes hard root-only)`.

### Task 4 — rz-ops User Management UI
- Tier filter dropdown: `<option value="educator">Educator</option>` between Demo and Pro.
- `tier-badge.educator` CSS in the `<style>` block (cyan, not purple — `#7dd3fc` on `rgba(56,189,248,0.18)`).
- User table: render educator badge when `user.tier==='educator'`.
- Add-User modal & row context menu: tier select includes Educator; "Promote → Educator" / "Demote → Demo" actions.
- Storage: writes & reads `localStorage.rz_admin_educators` (array of emails); dispatches a `rz-educators-changed` event (mirrors `rz-features-changed`); `auth.js` listens and updates the in-memory allowlist.
- Commit: `feat(rz-ops): educator tier in User Management (filter, badge, promote/demote)`.

### Task 5 — rz-ops Feature Flags 4-tier matrix UI
- Add the **EDUCATOR** `<th>` between DEMO and PRO; same in the per-row toggle cells.
- Extend bulk-toggle options: `all_free`, `all_demo+`, `all_educator+`, `all_pro_only`, `all_off`.
- Same persistence (`rz_admin_features_by_page` already keyed by tier; add `educator`).
- Aria-labels and column-help text updated.
- Commit: `feat(rz-ops): Feature Flags matrix gains EDUCATOR column`.

### Task 6 — Global UI alignment + `script.js` checks
- Header dropdown badge handler: render `EDUCATOR` text with the cyan class.
- Grep the codebase for `tier === 'pro'` / `tier === 'free'` / `tier === 'demo'` literal checks; for each, decide and document whether educator counts (default: educator counts as demo-or-better; on Pro-locked features, educator stays locked).
- Commit: `feat(ui): EDUCATOR badge + tier-comparison alignment site-wide`.

### Task 7 — Standardisation docs
- Update `AUTH_STANDARD.md`, `PRO_MODE_STANDARDIZATION.md`, `FEATURE_FLAGS_STANDARD.md`, and CLAUDE.md "Auth tiers" section.
- Commit: `docs(standarization): document educator tier & 4-tier matrix`.

### Task 8 — Tests & probes
- New `tools/probe-educator-access.mjs` (Puppeteer, port-parameterised) — see §3.
- Re-run `tools/probe-all-pageerrors.mjs` on `rz-ops-p7x3k9m.html`, `datahallAI.html`, `dc-conventional.html`, `index.html`, and one calc page.
- Both audit gates green.
- Commit: `test(educator): E2E educator-access probe + regression sweep`.

### Task 9 — Ship (gated by audit + probe green)
- At merge time only: bump `js/rz-version.js` to the **next free MINOR** on `main` (do NOT hardcode — parallel session owns v1.21.0–v1.22.x); CHANGELOG entry; `sw.js` cache bump; `python3 tools/build-changelog-html.py --apply`; final --strict audit sweep + probes; merge `educator-tier` → `main`.

## 5. Per-ship discipline (every task, every commit)

Same gate as Finance Terminal:
1. Tracker: any bug uncovered → add row to `~/.claude/projects/-home-baguspermana7/memory/project_rz_bug_request_tracker.md`. Educator tier itself = a new request row (R-013-ish, coordinate with parallel session's R-013 already in use → use `R-014`).
2. Audits `--strict` clean (`audit-js-syntax`, `audit-script-tags`, `audit-mobile-responsive`, `audit-version-stamp`).
3. `audit-onclick-handlers.py --strict` if new `onclick` added (likely yes in User Management).
4. CONTENT_LINKAGE_PLAYBOOK §1–§4 walked at start + end (this is a feature task — every linkage applies).
5. Browser-truth: `probe-all-pageerrors.mjs` on every page touched.
6. No `</script>` in any JS string literal (auditor catches it).

## 6. Risks & known unknowns (documented, not blocking)

- **Email allowlist vs. registration**: today the user database is hardcoded + (partially) editable via admin UI; persistence is `localStorage`. New educator users created in the admin panel exist only in that admin's browser unless the in-memory `USERS` array is rebuilt from the localStorage list on auth-init. The plan does this via `rz-educators-changed` listener in `auth.js`. Production-grade multi-device persistence is out of scope (would require a backend).
- **DC pages' existing on-load gate**: each of `datahallAI.html`, `dc-conventional.html`, `dcmoc` has its own login/redirect script (see `auth.js:372` Type C). Task 3 must convert those three pages' inline gates to call the new `enforceTierFeatureAccess` helper. Implementer must touch all three files in the same commit so they stay aligned.
- **DCMOC is a Next.js static export** (`/dcmoc/` is the deployed dist). Its gate is a top-level inline script that calls into the global `__rzAuth`. Confirm the gate script is unchanged structurally — only the tier check inside is widened.
- **Parallel session version collision**: parallel owns v1.21.0–v1.22.x. Ship-time version resolved against `main` HEAD, NEVER hardcoded.
- **No regression to existing demo users**: demo must still see the "upgrade required" UX on DC pages. Probe explicitly asserts this in Task 8.

## 7. Definition of done (Phase complete)

- `tools/probe-educator-access.mjs` GREEN (all 4 assertions pass) on a local dev server.
- All `--strict` audit gates GREEN.
- Manually verified in browser: educator user can open DC AI / DC Conv / DCMOC; admin panel still blocks them; demo/free still blocked from DC pages.
- Standardisation docs reflect the new tier.
- Tracker row R-014 → SOLVED(version, commit) on merge.
