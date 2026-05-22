# rz-auth-gateway — Provisioning (user steps)

These are the one-time steps **you** run to put the Worker live. Local
development (`npm run dev` → `wrangler dev`) needs **none** of this — wrangler
ships a simulated KV that satisfies the binding offline. Do these only when
you are ready to deploy to production (after Phase 1 endpoints land — Phase 0
ships only `/health` + library primitives).

This Worker is the server-side auth backend that replaces the hardcoded
`USERS` array currently living in `auth.js`. See plan §3 / §6.

## 1. Authenticate wrangler

```bash
cd worker-auth
npx wrangler login
```

Authorize in the browser **with the same Cloudflare account that holds the
`resistancezero.com` zone and the `rz-finance-gateway` Worker** (no new
vendor, no new billing surface).

## 2. Create the KV namespace

```bash
npx wrangler kv namespace create RZ_AUTH_KV
```

Copy the returned `id` and paste it into `worker-auth/wrangler.toml`,
replacing the `PLACEHOLDER_REPLACE_VIA_SETUP_MD` value under the
`RZ_AUTH_KV` binding.

This KV holds users, sessions, tiers, audit log, and rate-limit counters —
see plan §2 (Data model).

## 3. Generate + store the session HMAC secret

The session HMAC pepper is independent of the password hash and is rotated
when sessions need to be invalidated en masse (e.g. after a suspected breach).

```bash
openssl rand -base64 48   # copy the output
npx wrangler secret put ADMIN_SESSION_SECRET
# paste the value when prompted
```

The secret is stored **only** in Cloudflare's secret store. It is never
committed to the repo and never returned to the browser.

## 4. Set the bootstrap seed token (Phase 1 prerequisite)

Used **once** by the Phase 1 `POST /admin/__seed` endpoint as a pre-shared
secret on the query string. After a successful seed run, the endpoint
self-disables — it refuses to run when KV already contains the
`config/seeded` marker (see plan §6).

```bash
openssl rand -base64 32   # copy the output
npx wrangler secret put BOOTSTRAP_SEED_TOKEN
# paste the value when prompted
```

This is intentionally a different secret from `ADMIN_SESSION_SECRET`:
mixing the session HMAC pepper with a single-use bootstrap token would
require you to choose between rotating the pepper (which kills all
sessions) and re-running the seed (which the gateway no longer permits).
Separate concerns, separate secrets.

## 4b. Bootstrap seed migration (one-time)

This call mints the first users (admin/root, demo, educator, pro, etc.)
and the system tiers (free / demo / educator / pro / root). It is the
ONLY time the server accepts user records over the wire.

After it succeeds, the endpoint writes `config/seeded` to KV and refuses
all further calls — even with a valid token. Future user creation goes
through the admin CRUD endpoints (Phase 2).

### Body shape

```json
{
  "users": [
    { "email": "bagus@resistancezero.com", "password": "...",      "tier": "root",     "role": "root" },
    { "email": "demo@resistancezero.com",  "password": "demo2026", "tier": "demo",     "role": "user" },
    { "email": "educator@resistancezero.com", "password": "...",   "tier": "educator", "role": "user" },
    { "email": "pro@resistancezero.com",   "password": "...",      "tier": "pro",      "role": "user" }
  ],
  "tiers": [
    { "name": "free",     "label": "Free",     "priority": 10, "color": "#94a3b8", "defaultFeatures": {} },
    { "name": "demo",     "label": "Demo",     "priority": 20, "color": "#a78bfa", "defaultFeatures": {} },
    { "name": "educator", "label": "Educator", "priority": 25, "color": "#10b981", "defaultFeatures": {} },
    { "name": "pro",      "label": "Pro",      "priority": 30, "color": "#8b5cf6", "defaultFeatures": {} },
    { "name": "root",     "label": "Root",     "priority": 99, "color": "#ef4444", "defaultFeatures": {} }
  ]
}
```

### Curl

```bash
TOKEN=$(grep BOOTSTRAP_SEED_TOKEN .dev.vars | cut -d= -f2-)   # local dev
# (in production, paste the value you just `wrangler secret put`-ed)
curl -i -X POST \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://resistancezero.com' \
  --data @seed-body.json \
  "https://rz-auth-gateway.<account>.workers.dev/admin/__seed?token=$TOKEN"
```

Expected response (200):

```json
{ "ok": true, "data": { "seeded": { "users": 4, "tiers": 5 } }, "error": null, "ts": ... }
```

Subsequent calls return 403. The seed audit-log entry **never** records
the plaintext passwords — only the count of records written.

### Local development

`worker-auth/.dev.vars` (NEVER committed — listed in `.gitignore`):

```
ADMIN_SESSION_SECRET=dev-secret-for-local-only
BOOTSTRAP_SEED_TOKEN=dev-token-for-local-only
```

Then `npx wrangler dev --port 8788` and the curl above against
`http://127.0.0.1:8788/admin/__seed?token=dev-token-for-local-only`.

## 5. Shell-based admin operations (Phase 2)

Until the rz-ops admin UI ships (Phase 4), all user / tier / audit management
runs through `curl` against the live Worker. Every admin endpoint requires
`session.role === 'root'`; state-changing methods also require an
`X-CSRF-Token` header that matches the per-session CSRF token issued at
login. The session cookie is `HttpOnly`, so you MUST use `-c/-b cookies.txt`
to round-trip it — copy-pasting a cookie value into a curl flag won't work
once Secure is enforced.

> Replace `BASE` with the deployed URL (production) or
> `http://127.0.0.1:8788` (local `wrangler dev`).

### 5.1 Login + save cookie + CSRF

```bash
BASE="https://rz-auth-gateway.<account>.workers.dev"
ORIGIN="https://resistancezero.com"

# Login (saves rz_sess cookie to ./cookies.txt, captures CSRF from response).
curl -i -c cookies.txt \
  -H "Origin: $ORIGIN" \
  -H 'Content-Type: application/json' \
  --data '{"email":"bagus@resistancezero.com","password":"<YOUR_PW>"}' \
  "$BASE/auth/login" > login.out

CSRF=$(grep -oE '"csrf":"[^"]+"' login.out | head -1 | cut -d'"' -f4)
echo "CSRF=$CSRF"

# Sanity check — should return {email, role:'root', tier:'root', expiresAt}.
curl -s -b cookies.txt -H "Origin: $ORIGIN" "$BASE/auth/me" | jq .
```

### 5.2 List users (GET — no CSRF needed)

```bash
curl -s -b cookies.txt -H "Origin: $ORIGIN" "$BASE/admin/users" | jq .
# Filter by substring:
curl -s -b cookies.txt -H "Origin: $ORIGIN" "$BASE/admin/users?q=educator" | jq .
```

### 5.3 Create a user

```bash
curl -s -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  --data '{"email":"new-educator@resistancezero.com","password":"changeme2026",
           "tier":"pro","role":"educator"}' \
  "$BASE/admin/users" | jq .
```

### 5.4 Update tier / role / status

```bash
curl -s -X PATCH -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  --data '{"tier":"pro","role":"pro"}' \
  "$BASE/admin/users/new-educator@resistancezero.com" | jq .
```

### 5.5 Reset password (admin override)

```bash
curl -s -X POST -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  --data '{"password":"replacement-pw"}' \
  "$BASE/admin/users/new-educator@resistancezero.com/reset-password" | jq .
```

> The plaintext password NEVER appears in the audit log. Pass it to the
> user out-of-band.

### 5.6 Soft-disable vs hard-delete

```bash
# Soft-disable (default — sets status:disabled, revokes active sessions).
curl -s -X DELETE -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  "$BASE/admin/users/new-educator@resistancezero.com" | jq .

# Hard delete (removes the KV record). Blocked on root users.
curl -s -X DELETE -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  "$BASE/admin/users/new-educator@resistancezero.com?hard=1" | jq .
```

### 5.7 Tier CRUD

```bash
# List (includes defaultFeatures + isSystem).
curl -s -b cookies.txt -H "Origin: $ORIGIN" "$BASE/admin/tiers" | jq .

# Create a non-system tier.
curl -s -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  --data '{"name":"beta","label":"Beta","priority":40,"color":"#22d3ee",
           "defaultFeatures":{"finance-terminal":true}}' \
  "$BASE/admin/tiers" | jq .

# Update one field. System tiers reject priority < 10.
curl -s -X PATCH -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  --data '{"label":"Beta Access"}' \
  "$BASE/admin/tiers/beta" | jq .

# Delete (rejected on system tiers + tiers with users still attached).
curl -s -X DELETE -b cookies.txt \
  -H "Origin: $ORIGIN" -H "X-CSRF-Token: $CSRF" \
  "$BASE/admin/tiers/beta" | jq .
```

### 5.8 Page-key registry + audit log

```bash
# Static registry the rz-ops feature-matrix UI consumes (Phase 4).
curl -s -b cookies.txt -H "Origin: $ORIGIN" "$BASE/admin/pages" | jq .

# Audit log — filter by actor / action / time range.
curl -s -b cookies.txt -H "Origin: $ORIGIN" \
  "$BASE/admin/audit?actor=bagus@resistancezero.com&limit=20" | jq .
curl -s -b cookies.txt -H "Origin: $ORIGIN" \
  "$BASE/admin/audit?action=user.create" | jq .
```

### 5.9 Failure modes (expected status codes)

| Condition | Status | `error` |
|---|---|---|
| no `rz_sess` cookie or expired | 401 | `not authenticated` |
| logged in but `role !== 'root'` | 403 | `admin only` |
| missing / wrong `X-CSRF-Token` on POST/PATCH/DELETE | 403 | `csrf failed` |
| duplicate email on create | 409 | `email exists` |
| tier name collision | 409 | `tier exists` |
| delete tier with users still attached | 409 | `cannot delete: N user(s) still attached` |
| delete system tier | 403 | `cannot delete system tier` |
| hard-delete root user | 403 | `cannot hard-delete root user` |

## 6. Deploy

```bash
npx wrangler deploy
```

Note the deployed URL (e.g. `https://rz-auth-gateway.<account>.workers.dev`).
The client (`auth.js`) is pointed at this URL via the `AUTH_V2` flag —
see §7 below.

## 7. Client activation (Phase 3)

`auth.js` ships with a feature flag (`AUTH_V2`) that routes login,
logout, and session-hydrate through this Worker instead of the legacy
hardcoded `VALID_USERS` array. The flag defaults to **OFF** so existing
pages remain byte-identical until the Worker is stable in production.

### 7.1 Per-browser opt-in (testing)

After the Worker is deployed (step 6), open the site, hit DevTools
console on any page that loads `auth.js`, and run:

```js
localStorage.setItem('rz_auth_v2', '1');
localStorage.setItem('rz_auth_gw', 'https://rz-auth-gateway.<account>.workers.dev');
location.reload();
```

Login from that browser now flows through `/auth/login`. The Worker
sets an `HttpOnly; SameSite=Strict; Path=/` `rz_sess` cookie and
returns `{email, role, tier, csrf, expiresAt}`. `auth.js` stores a
UI-only mirror in `localStorage.rz_premium_session` (with `v2: true`
marker) and the CSRF token in `localStorage.rz_auth_csrf` for the
Phase 4 rz-ops admin panel.

To revert a browser to the legacy hardcoded auth:

```js
localStorage.removeItem('rz_auth_v2');
localStorage.removeItem('rz_auth_gw');
localStorage.removeItem('rz_auth_csrf');
location.reload();
```

### 7.2 Failure-mode UX

When `AUTH_V2` is on and the Worker is unreachable, the login modal
shows **"Auth service unavailable — please retry."** rather than
silently falling back to `VALID_USERS`. This is intentional (plan §6
threat model): an admin who *thinks* they're saving changes against
the Worker but is actually mutating a static mock would be a serious
correctness footgun.

### 7.3 Flipping the default for everyone

Once the Worker has been stable across user testing for ≥1 release,
edit `auth.js`:

```js
var __RZ_AUTH_BACKEND = 'worker'; // was: 'mock'
var AUTH_V2 = true;               // was: false
```

— and rebuild `auth.min.js` (`npx terser auth.js -o auth.min.js
--compress --mangle reserved=['loginV2','logoutV2','hydrateSessionFromWorker','gw']
--keep-fnames`). Ship as a MINOR bump.

A future MAJOR can then delete the `VALID_USERS` array and the legacy
`findUser()` path entirely.

## Security notes (read this)

- **Passwords are never secrets here.** They are PBKDF2-SHA-256 hashes
  (100 000 iterations, 16-byte random salt, 32-byte derived key) stored
  inside the user records in KV. The plaintext password lives only in
  the login request body and in the user's head.
- **Secrets above are HMAC peppers, not API keys**, and rotating them
  invalidates every active session — which is the desired property
  during incident response.
- **No password reset email flow** (YAGNI for v1). Admin resets via
  `POST /admin/users/:email/reset-password`; the new password is given
  to the user out-of-band.
