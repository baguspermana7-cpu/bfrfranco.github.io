# Self-Service User Management — Implementation Plan

- **Date:** 2026-05-22
- **Mode:** PLAN ONLY (no code until approved)
- **Goal stated by user:** "enhance user management so I don't need an agent for things like adding a new tier — do it all from the rz-ops admin panel. ensure it's working properly."
- **Builds on:** `educator-tier` plan (introduces the *concept* of a non-hardcoded tier); this plan makes tiers + users **first-class data** the admin edits in the UI.
- **Pre-requisite:** Finance Terminal Phase 1 worker (or equivalent Cloudflare account access — same Cloudflare account holds the resistancezero.com zone).

---

## 1. The honest constraint nobody can hand-wave

Today's `auth.js` is a **client-side mock**: every user/password/tier is in the source HTML/JS. Anyone with DevTools can read it. There is no real user authentication and no real persistence — every "new user" the admin creates today exists only in that admin's browser localStorage.

You cannot have **real** self-service user management on a pure static site. To make admin actions actually take effect for users logging in from OTHER browsers/devices, the system needs a small backend that:
1. Stores users + tier definitions durably (not in any one admin's browser).
2. Verifies passwords server-side (never trust the client).
3. Issues session tokens the client cannot forge.
4. Enforces admin-only endpoints server-side.

**Decision:** Add a small **Cloudflare Worker (`rz-auth-gateway`)** + Workers KV namespace `RZ_AUTH_KV`. Free-tier capacity is more than enough (100k requests/day, 1k KV writes/day — comfortable for a single-admin + a handful of users). Sibling to the Finance Terminal worker; same Cloudflare account, zero new vendor.

This is a one-time backend addition. After it lands, **every future "add a tier / add a user / change a permission" is a click in rz-ops — never a code change.**

---

## 2. Data model (KV)

```
users/<lowercased-email>      => { email, passwordHash, salt, iters,
                                   tier, role, status('active'|'disabled'),
                                   featureOverrides:{<page-key>:bool},
                                   createdAt, createdBy, updatedAt, lastLoginAt }
tiers/<name>                  => { name, label, priority(0-1000),
                                   color, defaultFeatures:{<page-key>:bool},
                                   isSystem(bool) }
sessions/<token>              => { email, role, tier, csrf, expiresAt }      (TTL 8h)
ratelimit/login/<ip>          => { count, windowStart }                      (TTL 15min)
audit/<isoTimestamp>-<rand>   => { actor, action, target, before, after, ip, ua }
config/admin-allowlist        => { emails:[...] }                            (boot-strap root list)
```

- **Password hashing:** PBKDF2-SHA-256 via Workers `crypto.subtle.deriveBits`, 100k iterations, 16-byte random salt per user. Stored: `passwordHash` (base64), `salt`, `iters`. **Never** stored or logged in plaintext. (Argon2 isn't available in Workers without WASM; PBKDF2-SHA-256 at 100k is the right free-tier choice — slow enough to make brute-force expensive, fast enough for legit login under 200ms.)
- **Seed tiers** (system, not deletable): `free`, `demo`, `educator`, `pro`, `root`. Admin can change their `defaultFeatures` and `label/color`. Admin can also **create new tiers** (e.g. `enterprise`, `partner`) with their own feature defaults.
- **`featureOverrides`** lives per-user and overrides the tier default per page (mirrors `rz_admin_features_by_page` semantics).

---

## 3. Worker endpoint surface (`rz-auth-gateway`)

All responses use the same envelope as the finance gateway: `{ok, data, error, ts}`. CORS locked to `resistancezero.com` + `localhost:8081`.

### Public (cookie-authed once a session is established)
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | email+password → sets `rz_sess` HttpOnly cookie, returns `{email, tier, role}`. Rate-limited per IP. |
| POST | `/auth/logout` | invalidates current session token in KV. |
| GET | `/auth/me` | current session info, used by `auth.js` to hydrate UI on page load. |
| GET | `/auth/tiers/public` | list of tier names + labels + colors (no feature matrix exposed) — used to render badges. |
| GET | `/auth/features` | resolved features for the calling session (tier defaults + user overrides) — replaces the local `rz-feature-flags.js` lookup. |

### Admin (require session role === 'root', server-verified each call)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users` | list (paginated). |
| POST | `/admin/users` | create. Body: `{email,password,tier,role,featureOverrides}`. |
| PATCH | `/admin/users/:email` | update tier/role/status/overrides. |
| POST | `/admin/users/:email/reset-password` | admin sets a new password. |
| DELETE | `/admin/users/:email` | mark `status:disabled` (soft) or remove (hard, with `?hard=1`). |
| GET | `/admin/tiers` | list with full feature matrix. |
| POST | `/admin/tiers` | create new tier. Body: `{name,label,color,priority,defaultFeatures}`. |
| PATCH | `/admin/tiers/:name` | edit. System tiers reject `name` changes and reject `isSystem=false`. |
| DELETE | `/admin/tiers/:name` | only non-system, only if zero users on that tier. |
| GET | `/admin/pages` | list of known page-keys (kept in sync with `rz-feature-flags.js` defaults). |
| GET | `/admin/audit` | filtered + paginated. |

### Security middleware (every request)
- `OPTIONS` preflight handled with locked CORS origins.
- Body size cap (10 KB).
- Content-Type must be `application/json` for state-changing endpoints.
- Session validation: read cookie → KV lookup → check `expiresAt`, sliding-window refresh.
- Role gate on `/admin/*`: 403 if not `root`.
- CSRF: state-changing endpoints require `X-CSRF-Token` header matching the per-session token in KV. Set on login response, stored in non-HttpOnly cookie + a non-cookie `localStorage.rz_csrf` for JS reads. `SameSite=Strict` on the session cookie.
- Login rate-limit: 5 fail/15min per IP → 429 with `Retry-After`. Successful login clears the counter.
- Audit log: every admin write + every login (success and failure with reason).

---

## 4. Client refactor (`auth.js`, `js/rz-feature-flags.js`, `rz-ops-p7x3k9m.html`)

### `auth.js`
- **Remove** the hardcoded `USERS` array, `ROOT_EMAILS`, `DEMO_EMAILS`, `EDUCATOR_EMAILS` literals (after the seed migration in Task 0 lands them in KV).
- Login modal POSTs to `${RZ_AUTH_BASE}/auth/login`; on success, the session is set by the Worker via HttpOnly cookie. `auth.js` calls `/auth/me` on every page load to hydrate `__rzAuth.session()`.
- `getTier(session)` reads `session.tier` directly (now sourced from server, not client logic).
- Fallback: if `RZ_AUTH_BASE` unreachable (offline / dev with no worker), `auth.js` shows "Auth unavailable — retry" rather than silently falling back to the old hardcoded path (silent-fallback would mask real auth outages).

### `js/rz-feature-flags.js`
- Becomes a thin wrapper around `/auth/features`. Caches the resolved feature object in memory after the first call.
- The hardcoded defaults file remains as a **fallback** if the worker is unreachable AND as the seed source of truth that's pushed to KV on first deploy via a `tools/seed-rz-auth.js` script.
- New page-keys added to the codebase are detected and the admin sees a "1 new page key — set tier defaults" banner in the Tier Manager.

### `rz-ops-p7x3k9m.html` — three NEW/EXTENDED sections

**A. User Management (extended).**
Existing user-table extended with: status badge, last-login timestamp, actions menu (edit / reset password / disable / delete / "promote to ___"). Top toolbar: search, filter by tier/role/status, "Add User" button (modal with email, generated-or-typed password, tier dropdown from KV, role, feature overrides editor). Bulk actions: enable/disable/change-tier.

**B. Tier Manager (new).**
- Grid of tier cards (one per row from `/admin/tiers`), each card: name, label, priority slider, color picker, "edit defaults" → opens the per-page feature matrix for that tier alone.
- "Create new tier" → modal (name slug, label, priority, color, "copy defaults from" dropdown to seed the matrix).
- System tiers (free/demo/educator/pro/root) show a lock icon for `isSystem:true` — can edit defaults/label/color, cannot delete or rename.

**C. Audit Log (extended).**
- Filter by actor email, action type, target, date range. Pagination. Expand row → show before/after JSON diff for the action. Existing client-side audit log stays for fallback events that can't reach the worker.

### CSS additions
- `.tier-badge` gains a generic `.tier-badge--dynamic` class that reads `--badge-bg` and `--badge-fg` CSS vars so new admin-defined tiers render with the admin-chosen color **without** a code change.

---

## 5. Phased tasks (each = its own commit, eventually its own worktree)

> **Note on sequencing:** this initiative is *bigger* than the educator-tier plan and **must not block it**. The educator-tier work completes first (it ships with the current hardcoded approach). This self-service initiative replaces the hardcoding afterwards — the migration in Task 0 reads the current `EDUCATOR_EMAILS` array, so educator-tier work isn't wasted; it becomes seed data.

### Task 0 — `rz-auth-gateway` worker scaffold + seed migration
- New worker dir `worker-auth/` (sibling to `worker/`): `package.json`, `wrangler.toml` (KV binding `RZ_AUTH_KV`, secrets `ADMIN_SESSION_SECRET`, `BOOTSTRAP_ROOT_EMAILS`), `src/index.js` (router + CORS), `src/lib/{kv.js, crypto.js, session.js, ratelimit.js, audit.js}`.
- One-time seed script `worker-auth/tools/seed.js` (run via `wrangler dev` + curl, OR via a temporary `/admin/__seed?token=<one-time>` endpoint that self-destructs): reads the current `auth.js` USERS array + `EDUCATOR_EMAILS`, hashes the passwords with PBKDF2, writes to KV. Logs which users were seeded.
- Setup doc `worker-auth/SETUP.md`: exact wrangler commands + the one-time-token flow.
- Unit tests: `crypto.js` (PBKDF2 verify), `session.js` (token + CSRF lifecycle), `ratelimit.js` (counter math).

### Task 1 — Public endpoints (`/auth/login`, `/auth/logout`, `/auth/me`, `/auth/features`)
- TDD: login success/fail, locked-out after 5 fails, session expiry, sliding refresh, CSRF mismatch → 403.
- Integration test: `wrangler dev` + curl login → 200 + Set-Cookie; replay cookie → /auth/me 200.

### Task 2 — Admin endpoints (CRUD users, CRUD tiers, audit)
- Per-endpoint TDD covering 401 (no session), 403 (non-root session), 200 (root), validation errors (400), and the audit-log side effects.
- Soft-delete semantics; hard-delete behind explicit `?hard=1`.

### Task 3 — Client `auth.js` swap
- Replace hardcoded login with `POST /auth/login`; cache CSRF; hydrate session via `/auth/me` on every page load.
- Keep a feature flag `__RZ_AUTH_BACKEND` (default ON in prod, OFF in dev unless worker is up) so the old path remains as a one-release escape hatch.

### Task 4 — Client `rz-feature-flags.js` swap
- Thin wrapper around `/auth/features`. New-page-key detection emits a `console.warn` once that the admin should set tier defaults.

### Task 5 — rz-ops User Management UI extension
- Add User modal, edit/reset/disable/delete row actions, filters, bulk operations. All actions POST to admin endpoints with the CSRF header.

### Task 6 — rz-ops Tier Manager UI (new section)
- Cards grid, create/edit/delete, per-tier feature matrix editor, system-tier guard.

### Task 7 — rz-ops Audit Log UI extension
- Filter + pagination + before/after diff viewer (use the existing `<details>` + `<pre>` JSON pattern).

### Task 8 — Standardisation docs
- New `standarization/USER_MANAGEMENT_STANDARD.md` (data model, endpoint surface, admin workflows).
- Update `AUTH_STANDARD.md` (server-backed auth supersedes client mock), `FEATURE_FLAGS_STANDARD.md` (matrix sourced from `/auth/features`), `PRO_MODE_STANDARDIZATION.md`.

### Task 9 — E2E probe `tools/probe-user-management.mjs`
- Login as bagus → create user `bob@test.local/tier:educator` → log out → log in as bob → access `/datahallai.html` ✓ → attempt `/rz-ops-p7x3k9m.html` → blocked. Admin demotes bob to demo → bob's next page load: DC AI blocked. Admin creates NEW tier `enterprise` with `dcmoc:true` → assigns it to a new user → that user accesses dcmoc. Pen-test: hit `/admin/users` with no session → 401; with demo session token → 403.

### Task 10 — **Code review + security review + audit sweep** (per user mandate)
- Dispatch the project's `code-reviewer` agent on the worker + client diff.
- Dispatch the project's `security-reviewer` agent — checklist incl. password hashing parameters, CSRF, session storage, rate limiting, CORS, role-gate completeness, secret handling, no plaintext logging.
- All `--strict` audit gates green: `audit-js-syntax`, `audit-script-tags`, `audit-mobile-responsive`, `audit-version-stamp`, `audit-onclick-handlers`.
- Walk `CONTENT_LINKAGE_PLAYBOOK.md` §1–§4.
- E2E probe (Task 9) GREEN.

### Task 11 — Ship
- At merge time: bump `js/rz-version.js` to next free MINOR (read from current `main`); `CHANGELOG.md` entry; `sw.js` cache bump; `python3 tools/build-changelog-html.py --apply`; merge to main.
- Final user step (you, manual): `wrangler login`, `wrangler kv namespace create RZ_AUTH_KV`, `wrangler secret put ADMIN_SESSION_SECRET`, `wrangler deploy`, then visit the one-time seed URL with the bootstrap token to migrate existing users. Old hardcoded `auth.js` paths can then be removed in a follow-up.

---

## 6. Threat model & how it's mitigated (the "ensure it's working properly" bar)

| Threat | Mitigation |
|---|---|
| Stolen session cookie via XSS | HttpOnly + SameSite=Strict + Secure flags; existing CSP audit already mandated; short 8h TTL; admin "log out all sessions" button writes `revokedAt` on user record (sessions check it). |
| Password brute-force | PBKDF2 100k iters + per-IP rate-limit 5/15min + per-email lockout after 10 fails/1h. |
| CSRF on admin endpoints | SameSite=Strict cookies + double-submit X-CSRF-Token header + role re-verified server-side. |
| Privilege escalation (demo posting `tier:'root'`) | Server NEVER trusts client-supplied role/tier on `/admin/*`; only root sessions can hit those routes. PATCH explicitly enumerates editable fields. |
| Tier removal while users still on it | DELETE `/admin/tiers/:name` rejects if any user has it; UI shows the count. |
| New page-key forgotten | Worker compares known page-keys vs. `rz-feature-flags.js` defaults on deploy; "1 new page key" banner in Tier Manager until each tier has explicit default. |
| Bootstrap-token leak | One-time, single-use, deleted from KV on first call; only valid when KV is empty (first deploy). |
| Worker outage | `auth.js` shows explicit "Auth unavailable — retry" rather than silent client-side fallback (silent fallback would mean broken admin actions on a static cache while admins THINK they're saved). |
| KV eventual consistency | Acceptable: writes propagate <60s globally; the admin UI shows "saved — may take up to a minute to reach all edges". |

---

## 7. What this plan **explicitly avoids** (YAGNI)

- No OAuth/SSO/social login.
- No email-verification flow / password-reset emails (admin resets passwords directly; user is told the new one out-of-band).
- No multi-tenant — single resistancezero.com tenant.
- No 2FA in v1; tracked as v2 (R-015) once core works.
- No backup/restore UI; KV is the source of truth + `wrangler kv key list/get` is enough for ops.

---

## 8. Definition of done

1. All --strict audit gates GREEN.
2. `tools/probe-user-management.mjs` GREEN.
3. `code-reviewer` agent + `security-reviewer` agent pass with no CRITICAL/HIGH findings.
4. Manual: from rz-ops admin panel, **bagus can add a brand-new tier `partner`, create a `partner@test.local` user on it, configure which pages partner sees, log in as that user in an incognito window, and see exactly the configured pages — without any code change, without dispatching any agent**.
5. Standardisation docs reflect the server-backed model.
6. Tracker R-015 → SOLVED(version, commit) on merge.
7. The old hardcoded `USERS`/`ROOT_EMAILS`/`DEMO_EMAILS`/`EDUCATOR_EMAILS` arrays are removed from `auth.js` (one-release lag for the escape hatch is fine; document the removal date).
