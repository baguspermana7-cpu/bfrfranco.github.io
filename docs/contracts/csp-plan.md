# Content Security Policy — Phased Plan

> **Status**: Plan (v1.41.11, 2026-05-26)
> **Origin**: review-v3 P2.1 — "Inline styles/scripts block production-
> grade CSP."
> **Scope**: How to move resistancezero.com from "inline-everything"
> (current zero-build pattern) to a strict, enforced CSP without
> breaking pages mid-flight.

## §1 — Why the site can't enforce CSP today

The current zero-build pattern relies on:

- **Inline `<style>` blocks** — every page authors its own component
  CSS inline (typically 200-800 lines per page).
- **Inline `<script>` blocks** — page-scoped JS for tab routing,
  calculator engines, gate logic, theme toggle.
- **`style="..."` attributes** — used heavily for one-off color/
  spacing overrides on cards, badges, status pills.
- **`onclick="..."` handlers** — some legacy pages still use these.

Enforcing a `Content-Security-Policy` header with `script-src 'self'`
and `style-src 'self'` would break ~120 pages on the next deploy.
Allowing `'unsafe-inline'` defeats the purpose of having CSP at all.

## §2 — Target end-state CSP

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-<...>' https://cdnjs.cloudflare.com;
  style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:;
  img-src 'self' data: https:;
  connect-src 'self' https://www.google-analytics.com https://*.indexnow.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests
```

Notes:
- `script-src` keeps `https://cdnjs.cloudflare.com` for Font Awesome 6
  (already SRI-pinned in v1.41.11).
- `style-src` keeps `cdnjs.cloudflare.com` because Font Awesome ships
  its CSS from there.
- `font-src` allows `data:` for inline base64 icon fallbacks.
- `frame-ancestors 'none'` blocks clickjacking; safe because we never
  embed the site in a third-party iframe.
- `connect-src` allows GA + IndexNow only; tightens if we add
  Supabase/edge functions later.

## §3 — Phased migration

### Phase 1 — Inventory + audit (this ship, v1.41.11)

- New audit `tools/audit-cdn-sri.py` reports every `<link>` / `<script>`
  pointing at a CDN without `integrity="sha384-..."`. Sitewide scan.
- Inline-counter: `grep -c '<style>\|<script>' *.html` baselines per
  page so future ships can track extraction progress.
- This plan document committed to `docs/contracts/csp-plan.md`.

### Phase 2 — External CSS extraction (Phase B engineering)

- Per-page tooling: a Python script reads each `.html`, lifts each
  `<style>` block (and unique `style="..."` attributes via class
  generation) into a sibling `.css` file, replaces with `<link>`.
- Start with the **5 calc pages** (PUE/CAPEX/OPEX/ROI/TCO) since they
  share the most inline patterns.
- Then **5 pillar pages** (cooling/fire-safety/power/standards/
  sustainability) which were just enhanced in v1.41.4.
- Then **AI Maintenance pages** (ai-engineering-maintenance,
  ai-maintenance-workbench) — last because they have the most inline
  per page.

Per-page acceptance:
- Visual diff at desktop + mobile: zero pixel difference.
- All audits remain CLEAN (`audit-script-tags`, `audit-js-syntax`,
  `audit-pro-mode-indicator`, `audit-mobile-responsive`).
- Bundle size for the new `.css` file ≤ 1.5× the original inline
  block (no minification regressions).

### Phase 3 — External JS extraction (Phase B engineering)

- Same pattern: lift each `<script>` block into a sibling `.js`.
- Removes the `</script>` escape pitfall entirely (auditor
  `audit-script-tags.py` becomes a no-op).
- Inline JSON-LD `<script type="application/ld+json">` stays inline —
  CSP allows that via `script-src` directives.
- Inline theme-bootstrap `<script>` at top of `<body>` stays inline
  with `nonce` value to avoid theme flash; nonce rotation requires
  server-side rendering, which is deferred to Phase 4.

### Phase 4 — Server-rendered nonces

- Requires moving from static GitHub Pages to a small edge function
  (Cloudflare Pages Workers or similar) that injects per-request
  `nonce` values into `<script>` and `<style>` tags.
- Cookie consent flow + theme bootstrap can then use nonced inline
  scripts safely.
- This is the only block to actually shipping the `script-src 'self'
  'nonce-...'` directive.

### Phase 5 — Enforce header

- Stage as `Content-Security-Policy-Report-Only` first; pipe reports
  to a small endpoint for 2 weeks.
- Triage report-only findings; fix any straggler inline blocks.
- Promote to enforced `Content-Security-Policy` after 2 weeks of zero
  reports.

## §4 — What ships today (Phase 1 only)

- This document.
- `tools/audit-cdn-sri.py` audit tool.
- `integrity="sha384-..."` + `crossorigin="anonymous"` on the Font
  Awesome 6 CDN `<link>` across every page that loads it.

Nothing else changes. The inline-everything pattern continues for
v1.41.11 — the plan exists so Phase B has a target.

## §5 — Out of scope of this plan

- Sub-resource integrity for `assets/og/*.webp` (same-origin; not a
  CSP concern).
- `Trusted-Types` policy — separate spec when XSS surface area
  warrants it.
- Per-tenant CSP overrides — the site is single-tenant.
- `Permissions-Policy` header — adjacent concern, will get its own
  plan when needed.

## §6 — Consumers / blockers

| Consumer | Status |
|---|---|
| `tools/audit-cdn-sri.py` | Phase 1, this ship |
| GitHub Pages deployment | No CSP support natively; need edge proxy for Phase 5 |
| Per-page inline-counter dashboard | Phase 2 |
| `audit-script-tags.py` | Becomes redundant after Phase 3 |
| Server-side rendered nonces | Requires platform shift (Cloudflare Pages Workers) |
