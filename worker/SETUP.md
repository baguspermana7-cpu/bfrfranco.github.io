# rz-finance-gateway — Provisioning (user steps)

These are the one-time steps **you** run to put the Worker live. Local
development (`npm run dev` → `wrangler dev`) needs **none** of this — it works
offline with simulated KV. Do these only when ready to deploy to production.

## 0. Rotate the Finnhub key first (security)

The Finnhub API key was pasted into a chat transcript and must be treated as
**exposed**. Before using it here:

1. Go to https://finnhub.io/dashboard → **API Key** panel.
2. Regenerate / copy the **single ~20-character token** from the *API Key*
   panel. Do **not** use the *Webhook → Secret* value, and do **not**
   concatenate the two — a wrong/concatenated token is itself a cause of the
   "Error loading data" failures.

## 1. Authenticate wrangler

```bash
cd worker
npx wrangler login
```

Authorize in the browser **with the Cloudflare account that holds the
`resistancezero.com` zone** (so the Worker shares the existing account; no new
vendor).

## 2. Create the KV namespace

```bash
npx wrangler kv namespace create FT_KV
```

Copy the returned `id` and paste it into `worker/wrangler.toml` under the
`FT_KV` binding (added by plan Task 0.3).

## 3. Store the Finnhub token as a Worker secret (server-side only)

```bash
npx wrangler secret put FINNHUB_KEY
# paste the rotated single API-Key-panel token when prompted
```

The token lives **only** in the Worker secret store. It is never committed to
the repo and never sent to the browser (the site is a public static page).

## 4. Deploy

```bash
npx wrangler deploy
```

Note the deployed URL (e.g. `https://rz-finance-gateway.<account>.workers.dev`).
The client `CFG.GW` default is set to this in plan Task 1.11.

## 5. (Phase 2, later) Finnhub webhook

In the Finnhub dashboard → **Webhook**, set the URL to
`<deployed-worker-url>/finnhub-webhook`. The Worker verifies the
`X-Finnhub-Secret` header against a stored secret and 200-acks before
processing. (Wired in the Phase 2 plan, not now.)
