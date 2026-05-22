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

## 4. Set the bootstrap root emails (Phase 1 prerequisite)

Used **once** by the Phase 1 `/admin/__seed` endpoint to mint the first
root user(s). After seeding, the endpoint self-disables (it refuses to run
when KV already contains user records — see plan §6).

```bash
npx wrangler secret put BOOTSTRAP_ROOT_EMAILS
# paste: bagus@resistancezero.com,admin@resistancezero.com
```

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
