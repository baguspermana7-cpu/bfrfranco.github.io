# Dark-Mode Rollout — `/ultraplan`

> Obsidian mirror of [`standarization/DARK_MODE_ROLLOUT_TRACKER.md`](../../../../standarization/DARK_MODE_ROLLOUT_TRACKER.md).
> **Living note — update on every increment.** Part of [[Standards-Hub]].

**Direction (owner-locked):** POLISH + unify tokens — **NOT** reskin. Keep each page's character
(fonts, accent hues); fix concrete dark-mode defects + bring all pages under one structural token
language (`css/rz-dark.css` polish-track: radius · elevation · `.rz-surface`). The Fraunces
*editorial register* was rejected for content pages. **No card movement on hover.**

Last updated: **2026-06-21** · Scope: **98 public pages**

---

## Shipped (live)

- **v1.43.14 / .18** — `index.html` bento polish, dark + light (layered surfaces · per-card accent glow · staggered reveal)
- **v1.43.22** — removed dead hover-lift · retoned rejected-purple disclaimer · `.bento-sap` dark tint
- **v1.43.24** — killed card-hover flicker (stale `script.min.js` cache-bust) · toned logo pop
- **v1.43.26** — AWS dark logo white fix · added polish-track tokens to `css/rz-dark.css`
- **v1.43.33** — /ultraplan batch 1: `.references-section` light-on-dark fixed on 4 report pages (`!important` shared rule)
- **v1.43.35** — /ultraplan batch 2: geopolitics-2/3 + FF-1/2 status badges (`.confidence-low` + `.prob-*`) dark overrides
- **v1.43.36** — /ultraplan batch 3: site-wide `#64748b` disclaimer/nav contrast lift across 52 pages (1 shared rule)
- **v1.43.38** — /ultraplan batch 4: articles `.philosophy-section` + tia-942 + dc-market-tracker chrome dark overrides
- **v1.43.39** — /ultraplan batch 5: cockpit cookie banners dark (`css/rz-bms-shell.css`, probe-gated 75/75 PASS) — defect rollout COMPLETE
- **v1.43.46** — index hero-name infinite animations removed (nameGlow+rzNameSweep "blink") + OE hover-expand removed ("wobble")
- **v1.43.48** — **article editorial skin now 29/29** — applied the approved §08 editorial register (`css/rz-article-dark.css` + Fraunces) to the 3 missed articles: **article-27** (red #dc2626), **FF-2 + FF-3** (amber #E8B563). Replicated article-26's head block; calculator/content untouched.
- **v1.43.50** — **editorial consistency tanpa pengecualian** — added read-progress JS to 4 hubs (articles/insights/geopolitics/future-forward); gave `article-9-paper` (print/PDF) a **screen-only** dark editorial mode (`@media screen`, Fraunces + amber) so **print output stays white/pristine** — print feature untouched, verified. Full editorial coverage now complete.
- **v1.43.52** — **editorial h2 underline bug fixed on ALL 33 articles** (via `/ultraplan` 6-agent render-verify+fix). Root cause: editorial CSS kills `border-left` but not `border-bottom`; base `.article-body h2{border-bottom:3px}` underline sat on the editorial rail → register never fully took. Neutralized in dark per article. **33/33 render-PASS, independently re-probed (h2 no-underline + Fraunces + Plex Mono meta).** This is the real "100%".
- **v1.43.55** — **planb §11 index hero + E4 calculator shells (Track E COMPLETE).** §11: index `.bento-identity` editorial register, **dark-only + reversible** — Fraunces `.bento-name`, IBM Plex Mono kicker with amber tick, amber-italic accent, new `.bento-readout` 4-KPI strip (12+ Years · 40+ Tools · 27 Articles · 100+ Pages) with count-up on load (reduced-motion aware). Day mode untouched (readout hidden in light); §10 bento-polish lock stays in force. E4: 7 calculators (`pue/capex/opex/roi/tco/cx/spares-readiness`) get editorial hero chrome (Fraunces `<h1>` + amber badge) in dark via `css/rz-calc-editorial.css` — **chrome only, engines untouched.** Verified dark/light probes + screenshots, 0 new errors. **Track E (E0–E4) now 100%.**
- **v1.43.54** — **§08-mockup amber unification (SEMUA artikel jadi amber).** Flipped all **34** editorial pages' `--rz-art-accent`/`--rz-art-accent2` to the mockup's exact pair `#E8B563` (amber) / `#6FBF9A` (mint) — sourced verbatim from `rz-article-mockup.html` (`linear-gradient(90deg,#E8B563,#6FBF9A)`). The editorial chrome (Fraunces h2 rail, drop-cap, mono kicker/meta, pull-quote, read-progress) is now uniform amber instead of per-series hues. The **9 red-series pages** (art-11/14/20/23/25/26/27 + geopolitics/-3) were additionally re-toned **red→amber in body** (Tailwind red ladder → amber ladder) — fixing the owner's "warna dll kok masih sama" (chrome was amber but red bodies remained), incl. art-27's `.ws-*` workforce calculator (colour-only swap; **calc still works, 0 page/console errors**). **Semantic** reds in non-red articles (e.g. art-8 good-vs-bad green/red contrast) were deliberately preserved. Hue-accurate dark-mode probe: **9/9 red pages = 0 residual red, amber present.** `audit-script-tags`/`audit-js-syntax` CLEAN.

## planb PLAN 02 — full rollout status (2026-06-21)

"Semua di planb diimplementasikan" reconciliation of `plan-dark-mode-standard.html` §09:

- **Track E — 100%.** E0/E1/E2 (34 editorial pages, §08 amber, v1.43.54) · E3 hub read-progress
  (v1.43.50) · **E4 calculator shells (v1.43.55)** — all done.
- **§11 index hero** ✓ v1.43.55 (dark-only, reversible). **§12 light twin** ✓ v1.43.18.
- **Track I (cockpits) I0–I3 already LIVE** — all 9 cockpits carry `data-rz-register="instrument"`
  + load `css/rz-bms-shell.css` (the I1 component library) + JetBrains Mono + I0 count-up; the BMS
  track built them in-register. **Accuracy probe 75/75 green.** Not re-skinned (would risk the gate
  + collide with the in-flight BMS track).
- **I4 (market monitors / SLD labs)** — deferred-by-design (already dark; PLN grid SLD readability
  owner-locked, phosphor reskin would regress it).

Net: every planb track shipped or already-live except I4 (deliberate hold).

## `/ultraplan` audit (9-agent parallel, read-only)

- **58 pages checked · 56 defects · 0 critical · 38 high · 18 medium · 32 pages clean.**
- **Key finding:** no page is *missing* dark mode (all inherit from `styles.min.css`); work = fix
  concrete defects + unify tokens, not rescue broken pages.
- **Dominant real-defect patterns:**
  - Light `.references-section` (`#f8fafc`) blocks on 4 infographic/report pages → light-on-dark.
  - Light status badges (`.confidence-low` / `.prob-medium` / `.prob-high`) on geopolitics-2/3 + FF-1/2.
  - White cookie banners / buttons (cockpits, dc-market-tracker, tia-942) → light-on-dark.
  - `#64748b` disclaimer text on 5 pillar pages → low contrast.
  - (Some flagged compare-table accent headers + dark-hero white gradients = conservative/likely-OK; verify before editing.)

## Status by family

| Family | Defects | Status |
|---|---|---|
| index | — | ✅ shipped |
| articles (29) | clean | editorial skin ✅ 29/29 (article-27 + FF-2/FF-3 caught up v1.43.48) |
| infographics/reports (4) | 4 high | ✅ fixed v1.43.33 |
| geopolitics + FF (4) | 12 high | ✅ fixed v1.43.35 |
| pillar (5) + 52-page disclaimer | 5 high + 1 nav | ✅ fixed v1.43.36 |
| checklists/misc (tia-942, dc-market) | 5 high | ⏳ batch |
| cockpits (cookie banners) | ~10 | ✅ fixed v1.43.39 (probe 75/75) |
| compare-* (4) | 8 (verify) | ⏳ verify-first |

Related: [[Standards-Hub]] · [[06-Comparisons/Comparisons-Hub]] · [[07-Reports/Reports-Hub]]
