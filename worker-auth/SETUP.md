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

## 5. (Phase 1, later) Deploy

```bash
npx wrangler deploy
```

Note the deployed URL (e.g. `https://rz-auth-gateway.<account>.workers.dev`).
The client (`auth.js`) will be pointed at this URL in plan Task 3, gated by
the `__RZ_AUTH_BACKEND` feature flag so the existing client mock remains
available as a one-release escape hatch.

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
