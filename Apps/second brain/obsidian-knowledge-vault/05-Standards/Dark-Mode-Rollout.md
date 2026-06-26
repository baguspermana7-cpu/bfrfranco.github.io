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
- **v1.46.5** — **Editorial reading-experience overhaul (from a uiux-reviewer audit).** Capped prose **measure to 68ch** (was ~142ch — the biggest readability win); forced day body copy to **IBM Plex Sans** (the day register block had no `.article-body p` rule → it inherited Inter, the rejected font); explicit **heading scale** (h2 `clamp(1.75rem,3vw,2.25rem)` w600 / h3 w500, ratio ~1.55) + vertical rhythm; removed the **day hero amber wash** (stacked over saturated bespoke heroes, washed out the dek); figcaption `!important` mono/non-italic; **section-number kickers** (mono 01/02/03 on h2 via CSS counter + amber underline); lead paragraph; figure framing. Verified 37 pages: 0 light-on-dark, 0 errors, 0 over-wide measure. Lesson: when a register has two theme blocks (dark + `:not([data-theme=dark])`), every per-element rule (font, line-height, measure) must exist in BOTH or the un-mirrored theme silently regresses (day fell back to Inter).
- **v1.46.4** — **Editorial refinements + day-accent contrast fix.** Each article hard-codes `style="--rz-art-accent:#E8B563"` (dark gold) inline on `<html>`; that **inline value overrode the day variant's `#b45309`**, so day links/meta/rails rendered at ~1.7:1 on white (fails). Fixed by forcing the day accent with `!important` (beats inline). Also: amber underlined body links, pull-quote 2px side-stripe (impeccable ban) → hanging Fraunces quote glyph, mono figcaptions, amber selection. Lesson: a custom property set inline on an element beats any non-`!important` selector — to override a per-element inline var you must use `!important`.
- **v1.48.2** — **Comprehensive both-mode (light + dark) text-contrast audit, all 114 pages.** 3 probes (2 DOM contrast + 1 pixel-accurate via `sharp` sampling real rendered backgrounds) + ~14 pages screenshot-verified in both modes. **Genuine finding:** `.cmp-badge-a/-b` set accent text on a light tint of the same accent (~2.5 contrast, sub-WCAG, both themes) → fixed to solid accent bg + white (5 compare pages). **All other probe flags are false positives, verified by eye:** (1) light text on **colored/photo heroes** (intentional, readable); (2) **auth-gate dimming** — gated labs/cockpits (ltc-*, standards-ltc-lab, datahallAI, dc-conventional) show *dimmed* content behind the Sign-In modal, not a styling bug; (3) gradient/photo card backgrounds (computed `backgroundColor` is transparent → DOM contrast walk fails); (4) dim-by-design mono labels / captions / chart annotations; (5) **dark-only instrument cockpits** (`datahall/chiller/water/fire/fuel/ict` have no light toggle or `[data-theme="light"]` palette — dark by the instrument standard — so a forced-light audit is moot). **Net: body text, headings, lists, tables render readable across the site in both modes.** Lesson: DOM-walk contrast audits over-flag massively (heroes/gradients/gates) — sample actual rendered pixels (sharp) AND screenshot-verify before "fixing", or you'll degrade intentional designs. The real failure mode (white-body-in-dark) is the one to gate, and it is (`audit-dark-coverage.mjs`).
- **v1.48.1** — **White-body-in-dark fixed across content pages + dark-mode standard made self-enforcing.** Owner ("parah") flagged many pages where dark mode only darkens the nav + title while the article body stays white (e.g. `cdu-selection-guide`). Root cause = the **`:root, [data-theme="light"]` cascade bug**: the page defines a `[data-theme="dark"]{ --bg... }` palette, then `:root, [data-theme="light"]{ --bg:light }` — but `:root` matches in ALL themes and, equal specificity + later in source, **overrides the dark vars**, so bg + cards + body text stay light in dark. Fix = `:root:not([data-theme="dark"])` for the light fallback (one selector; flips the whole var-driven palette incl. **body text**). 11 pages fixed (cdu-calculator/hub/selection-guide, 5× compare-*, fire-calculator/checklist, pln-sumatra) + tia-942 (no dark palette → added one) + tier-advisor (.calc-disclaimer). **Enforcement: `tools/audit-dark-coverage.mjs --strict`** (render gate — fails white-in-dark + flags the `:root,` bug) added to the ship-audit suite + CLAUDE.md + this standard. Gate CLEAN across 114 pages. Lesson: never use `:root,` for the light fallback; every content page must define a dark palette + pass the gate (the [[implement-applicable-standards]] mandate — sessions diverging is the root cause this prevents).
- **v1.46.3** — **Article-hub editorial parity.** Extended v1.46.2 to `articles.html`/`insights.html`/`future-forward.html` (the hub surfaces the §08 skin also targets): added the no-FOUC guard (geopolitics already had it) + fixed insights.html's 6 white resource-card islands (`.reports-grid > a` inline `var(--bg-card,#fff)` undefined in dark → white; dark-toned `#1e293b`). All 3 verified: FOUC pre-paint, 0 light-on-dark, toggle clean.
- **v1.46.2** — **§08 article editorial skin now in BOTH dark + day, zero switching bugs (all 34 articles).** The editorial register was dark-only; added a light-palette mirror in `css/rz-article-dark.css` scoped `:not([data-theme="dark"])` (Fraunces title + mono meta + gold drop-cap + amber h2 rail + warm hero wash; gold `#b45309` accents readable on light; article light surfaces kept). Added the no-FOUC `<head>` theme guard to all 34 (was calculators-only → dark readers got a white flash). **Fixed the "switch bermasalah" root cause: article-26 had a redundant inline `#themeToggle` handler double-bound with `script.js initDarkMode` → the two cancelled, toggle stuck.** Fixed dark light-on-dark coverage gaps (art-10/11/13/16/17 + FF-3 via `/ultraplan` — same-hue dark tints, 4px white gauge-needles kept) and art-2's chartjs-annotation `defer` TypeError. Verified headless: dark 0 light-on-dark/0 errors (34/34), toggle 0 broken (34/34), day editorial renders, FOUC fires pre-paint. Lesson: per-page custom theme handlers that duplicate `script.js` cause silent double-bind toggle breakage — articles should rely on `script.js` + the inline FOUC guard only.
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
- **I4 (market monitors)** — ✓ SHIPPED v1.43.56. dc-market-tracker + pln-java-grid (+4 provinces)
  get `data-rz-register="instrument"` + `css/rz-monitor-instrument.css` (header/section-title mono
  + phosphor tick, **chrome only**). Owner-locked SLD line widths / labels / tier colours / map viz
  pixel-identical (verified). **Track I COMPLETE.**

Net: **planb PLAN 02 is 100%** — every track shipped or already-live.

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
