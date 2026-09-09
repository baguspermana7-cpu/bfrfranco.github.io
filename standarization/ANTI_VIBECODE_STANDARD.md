# ANTI-VIBECODE STANDARD — resistancezero.com must never look AI-generated

> Mandate (owner, 2026-08-23): the site must carry **none** of the 30 "vibecoded" tells. This doc
> codifies each into HARD-BANNED / RZ-SIGNATURE (deliberate, protected) / REQUIRED, plus the enforcement
> gate. Read before any visual/CSS work. Gate: `node tools/audit-vibecode.mjs --strict`.

## Why
Generic AI page-builders converge on the same look (Inter font, purple-black, dot-grid, glassmorphism,
radial orbs, emoji, 3-card rows, sparkle icons). resistancezero.com has a **deliberate industrial /
instrument aesthetic** (thin hairlines, oscilloscope tokens, considered type). Any drift toward the
generic set reads as "vibecoded" and must be removed.

## Current audit contract (2026-09-08, local work)

The owner renewed the whole-site requirement, explicitly naming article readability, containers,
whitespace, sitemap/robots and regression prevention. The historical monitor/flagship-only tables below
describe earlier releases, not current clearance. The baseline for this work was **273 monitored
file/rule findings across 172 files despite exit 0**.

- Rails, resting shadows and decorative radii now participate in strict scanning across the declared
  source scope. The tool prints that scope and provides `--json` inventory and findings. It must never
  print “safe to push” from a static design scan.
- Respect functional boundaries: alarm-state rails, process geometry, circles, images, focus states,
  real controls, printed paper and the approved aurora are not disposable decoration. Any exemption
  needs a regression fixture and an identifiable reason, not a broad keyword that hides other rules.
- A source scan is not rendered evidence. Inline/runtime styles, generated assets, sub-apps, keyboard
  journeys, both themes and mobile/desktop states require separate checks. Palette coherence, generic
  grids, hype, invented experience and editorial quality also need human review; do not label an
  unimplemented heuristic an executable monitor.
- `tools/audit-site-render.mjs` records every tracked HTML path and requested theme/viewport row.
  `FILTERED`, `PENDING`, `UNVERIFIED`, unavailable resources and blocked authentication are not passes.
  A superseded probe report must not drive product changes after a false-positive detector is fixed.
- Editorial paragraphs are immediately readable. Suppress decorative heading numbering and drop caps;
  use readable ink, restrained surfaces, consistent container gutters and compact mobile contents.
- Surface classification samples actual browser colors, including modern color spaces and opaque dark
  gradient ancestors. Theme changes must reclassify without sampling an in-flight background transition.
  Preserve nested instrument surfaces rather than flattening every class named `card`.
- New safeguards: `tools/test-audit-vibecode.mjs`, `tools/test-editorial-reading.mjs`, and
  `tools/test-site-render-audit.mjs`. Browser fixtures are separately enabled by
  `RZ_RENDER_BROWSER_TEST=1 node --test tools/test-site-render-browser.mjs`.
- Review and measurement do not establish that the entire site is bug-free. Keep open findings in the
  task handoff until reproduced, repaired and re-tested. Do not publish while verification is incomplete.

## A. HARD-BANNED — never ship (audit-vibecode --strict fails on these)
| # | Sign | RZ rule / correct alternative |
|---|---|---|
| 1 | **Inter / Geist / Space Grotesk as PRIMARY font** | Base UI font = **`'IBM Plex Sans'`**; display = Fraunces; mono = JetBrains Mono. Inter/Geist/Space-Grotesk may NOT be the first family in any `font-family` stack. |
| 2 | Dot-grid pattern on `.hero-background` / any bg | Soft radial washes only (gold+mint, opacity ≤0.06). |
| 3 | Anthropic-purple `#8B5CF6` as a pill/accent | Mint `#7DDDB4`; residual semantic uses must move to a named token, never the raw pill color. **Named tokens that exist for this (v1.134.21):** `--rz-restricted` (root-gated links; `#7A4800` light / `#FFAA00` dark) and `--oe-violet` (the violet slot of the eight-hue `.oe-*` categorical family; `#5B34C4` / `#C3B0FA`). Categorical uses elsewhere take the same re-chosen ramp `#C3B0FA` / `#7B4FE0`; brand surfaces take mint (`#A8ECCF` dark, `#146B4A` light — `#4FBF92` is 2.3:1 on white and must not be used as text). |
| 4 | Sparkle icons ✨ / wand / `fa-magic` as UI | Instrument icons (thin-line), never "AI sparkle". |
| 5 | Emojis as application icons/controls or in headings | Drawn/SVG or professional icon; text stays emoji-free. |
| 6 | Glassmorphism / liquid-glass (`backdrop-filter: blur` as decoration) | Opaque instrument surfaces + 1px hairline. |
| 7 | Radial "orbs" — decorative glowing circles in bg | (see RZ-SIGNATURE for the ALLOWED aurora hero; standalone orbs are banned) |
| 8 | Harsh / high-contrast gradients | Muted multi-stop washes only. |
| 9 | Rainbow coloring on text/accents | Single semantic hue per element. |
| 10 | Colored left-stripe callouts (`.info-box` accent rail slop) | Flat `color-mix` tint + 1px hairline + 2px semantic rail (editorial language). |
| 11 | Drop-shadows as the primary card affordance | Hairline borders; shadows only subtle + purposeful. |
| 12 | Soft/large corner radius everywhere (pill-ish) | Restrained radii per the instrument scale. |
| 13 | Purple-and-black scheme | RZ tokens (instrument-cyan / signal-amber / oscilloscope-green / fault-red). |
| 14 | Neon colors | Muted instrument palette. |
| 15 | Basic/default pastel palette | The considered RZ palette only. |
| 16 | Bento grids as generic filler | Grid only when the content is genuinely a dashboard. |
| 17 | Terminal-window mock component (decorative) | Real output or a real embed, never a fake terminal. |
| 18 | Fake testimonials | None — the site is a personal + engineering site, no invented quotes. |
| 19 | "It's not X, it's Y" copy formula | Write plainly; no slop formula. |
| 20 | Sparkle/checkmark ✓ decorative bullet lists as the hero device | Real content; ✓ only in genuine feature/spec tables. |
| 21 | Lucide icon library as the dominant icon set | Font Awesome / the site's icon idiom already in use. |
| 22 | Pure white `#FFFFFF` full-page background | Off-white / token background; never raw `#fff` on `body`. |
| 23 | Animated arrows / bouncing CTAs | The Pixel-Rise scroll cue (subtle chevron) only. |
| 24 | Excessive hover animations | Restrained, purposeful transitions. |
| 25 | 3 feature cards in a row as the default hero | Layout follows content, not the 3-card template. |
| 26 | Exactly 3 pricing tiers template | N/A (no generic pricing table); if pricing appears it follows real plans. |

## B. RZ SIGNATURE — deliberate design, PROTECTED (do NOT strip as "slop")
An over-eager de-slop pass must not remove these; they are the site's identity, not vibecode:
- **Aurora-mesh hero** — multi-stop radial gradients drifting on 22s/28s loops (mint+gold+violet+blue+
  pink), CSS-only, honours reduced-motion. This is a canonical pattern (UI_FEATURES_STANDARD), NOT an
  "orb". Keep it.
- **Thin-line instrument hairlines** (0.6–1.4px tier-graded), oscilloscope tokens, editorial article
  register (`data-rz-register="editorial"`), IBM Plex Sans + Fraunces + JetBrains Mono type.
- **Semantic category colors** (e.g. a policy/legal icon) via named tokens.
- **Skeleton loaders** where real async loads occur (their PRESENCE is good — their ABSENCE is a tell).

## C. REQUIRED (present = good; absence is itself a vibecode tell)
- **Terms of Service** (`terms.html`) and **Privacy Policy** (`privacy.html`) — must exist + be linked.
- **Real product demos** — live calculators / virtual labs / cockpits (not screenshots of a fake app).
- **Skeleton loaders** on genuinely async surfaces.

## D. UX LAWS — required BEHAVIOUR (owner mandate, 2026-09-08)

§A says what the site must never **look** like. This section says how it must **behave**. Every new or
changed surface is reviewed against these 19 laws (the owner's list named Postel twice; deduped).

| # | Law | Principle | RZ application |
|---|---|---|---|
| 1 | **Hick's** | More choices → slower decision | Cap what is visible at once. Cockpit tab bars stay within one row; calculators keep advanced parameters behind a disclosure instead of showing every field on load. |
| 2 | **Fitts's** | Big + near targets are faster to hit | Primary actions get real size and reach. Touch targets ≥44px (already gate-backed, `audit-mobile-responsive.py`). A primary action is never an icon-only 20px hit box. |
| 3 | **Jakob's** | Users expect your site to work like the others they use | Use the familiar pattern for a familiar job — Ctrl/Cmd+K palette, standard nav, breadcrumb, back-link. Never invent a novel control for a standard task. |
| 4 | **Proximity** | Things placed near each other read as one group | A KPI, its unit and its basis chip sit as one block. Separate groups with space first, borders second. |
| 5 | **Miller's** | ~7±2 items held in short-term memory | Chunk. Long spec tables get sub-headers; cockpit KPI rows group by system, not one flat wall. |
| 6 | **Doherty threshold** | Under ~400 ms feels instant | Anything slower shows a skeleton loader (§C), never a blank panel. Their ABSENCE is itself a tell. |
| 7 | **Von Restorff** | The one that differs is the one remembered | Exactly ONE primary accent per view. Distinction comes from the semantic token and hierarchy — never from neon (§A14) or rainbow (§A9). |
| 8 | **Minimize target distance** | Shorten travel between sequential actions | Controls used in sequence sit adjacent. A confirm sits next to the thing it confirms, not across the viewport. |
| 9 | **Serial position** | First and last items are remembered best | The first and last nav slots are reserved for the highest-value destinations; the same for list ordering. |
| 10 | **Peak-end** | An experience is judged by its peak and its ending | A calculator ends on a clear result + export, never on a dead state or a spinner. Fix the ending before polishing the middle. |
| 11 | **Zeigarnik** | Unfinished tasks stay on the mind | Multi-step flows show where the user is and what remains (step indicator / progress), so an interruption is recoverable. |
| 12 | **Pragnanz** | The eye resolves to the simplest orderly form | Consistent gutters, aligned grids, restrained radii (§A12). Visual noise is cognitive cost. |
| 13 | **Similarity** | Same appearance implies same function | One button family, one KPI treatment, site-wide. If two things look alike they must behave alike — and the reverse. |
| 14 | **Uniform connectedness** | Visually connected elements read as related | Group with a panel + 1px hairline (§A10/§A11) — never with a decorative wash or a coloured stripe. |
| 15 | **Tesler's** | Irreducible complexity must live somewhere | It lives in the system, not the user. The engine computes; a reader never hand-derives a number to use the page. |
| 16 | **Postel's** | Liberal in what you accept, conservative in what you emit | Calculator inputs tolerate messy formats; every output carries its unit and its basis. |
| 17 | **Parkinson's** | Work expands to fill the time allowed | Do not pad a flow with optional steps. Default to the shortest path that is still correct. |
| 18 | **Occam's razor** | The simplest adequate solution wins | If an element carries no information, delete it. This is the same instinct §A enforces visually. |
| 19 | **Pareto (80/20)** | ~80% of the effect comes from ~20% of causes | The most-used cockpits and calculators get the polish budget first. |

### Honest enforcement status
Consistent with the audit contract above: **do not label an unimplemented heuristic an executable monitor.**

- **Gate-backed today (each verified 2026-09-09, not assumed):** **#6** Doherty — `audit-ux-laws.mjs`
  (wired into `ship-gate.sh`) fails any page that performs a non-beacon async data load without a
  loading affordance, resolving shared-module loads to the CONSUMER page. Scope caveat: it gates the
  PRESENCE of the affordance, **not** the 400 ms threshold itself — that still needs a real render.
  Proven RED→GREEN by `tools/test-audit-ux-laws.mjs` (5 cases incl. a beacon false-positive guard);
  **#2** touch targets —
  `audit-mobile-responsive.py --strict` asserts `min-height: 44px` on `button|a.btn|[role="button"]`;
  **#12** radii — rule `large-radius`; **#14** rails and resting shadows — rules `colored-left-stripe`
  and `shadow-sole-affordance` (all three registered in `DECORATIVE_RULES`, `tools/audit-vibecode.mjs`).
- **Human design review only:** #1, #3, #4, #5, #7, #8, #9, #10, #11, #13, #15, #16, #17, #18, #19.
  These are review criteria for any visual/IA change — not something the static scan can decide. Claiming
  otherwise would be exactly the false-assurance this document warns against.
- **Gap CLOSED 2026-09-09.** An earlier revision of this section recorded #6 as unenforced — correctly
  at the time: nothing checked skeleton presence, and the only `skeleton` strings in the tool tree were
  `probe-finance-terminal.mjs` (which REJECTS a stuck skeleton — the opposite check, unwired) and an
  unrelated staffing phenotype in `test-rz-engine.mjs`. A sweep then found the SITE already complied
  (0 pages async-without-affordance; `js/pln-energy-dashboard.js` is the one async module and all three
  of its consumer pages carry one), so the gap was the missing gate, not missing skeletons. That gate
  now exists.
- **A rule that over-reports is NOT the safe direction** (v2.19.0, 2026-09-10). The render audit's
  `editorial-translucent-wash` matched any surface whose class contained `card|callout|…|pill|badge`
  and whose background alpha sat in .02–.5. That caught two things §A does not ban: the site's OWN
  replacement pattern — a flat tint **plus a 1px hairline**, which is what `.quote-callout` renders
  under `css/rz-article-dark.css` and what rejected-pattern #7 prescribes — and tinted instrument
  chips, which carry no card/panel/block token at all and were **1,332 of the 1,988 findings**. The
  rule now requires a card/panel/block/callout surface with **no** hairline. Same session, five
  `text-overflow` exemptions (closed `<details>`, marquee queues, authored ellipsis / line-clamp,
  off-canvas + 1×1 live regions, scroll-capable boxes) removed roughly half the remaining noise.
  **Every one was re-checked against the UNFIXED page** — the new probe still reports all 284
  findings on `git show HEAD:datahall.html`. An exemption that also silences the RED baseline is
  laundering, not calibration; that check is the price of narrowing any rule in this document.
- **Scope coverage is now ASSERTED, not assumed** (`tools/test-audit-coverage.mjs`, wired into
  `ship-gate.sh`). The design gates walk the filesystem with a SKIP list; the sitemap is what the site
  publishes. One added SKIP entry would silently drop a live page out of every design gate. The test
  proves, both directions: every sitemap URL resolves to a file and sits inside BOTH audit scopes
  (180/180 today), and no crawlable page is orphaned from the sitemap unless it is gated, `noindex` or a
  known utility (85 absent today — 75 gated/noindex, 10 utility, 0 unexplained). It also asserts every
  `robots.txt` group carries the identical `Disallow` set: robots groups do NOT inherit, so a rule added
  to one group and forgotten in another leaks that directory to whichever crawler owns the thinner group.

## Enforcement
`tools/audit-vibecode.mjs --strict` — static scan of HTML/CSS for the hard-banned tells with
context-awareness. **Wired into `tools/ship-gate.sh`** (product gate `audit-vibecode --strict`); exit 1
on any hard-banned finding. Detectors + precision rules (all learned from real false-positives during the
2026-08-23 sweep):
- **inter-primary-font** — `font-family: Inter|Geist|Space Grotesk` or a `family=` Google-Fonts link.
  Base font is now **IBM Plex Sans** everywhere (was Inter; datahallAI was Space Grotesk).
- **glass-decoration** — SELECTOR-AWARE: only DECORATIVE surfaces (card/panel/tile/bento/hero/badge/chip/
  widget) count; functional blur on nav/modal/overlay/gate/search/palette/sticky-header is standard UI and
  is NOT flagged. Resolves `backdrop-filter: var(--glass-blur)` indirection to its `blur(...)` definition
  so token-glass can't hide. Flags at ≥3 decorative surfaces. Fix = drop blur + opaque `--glass-bg` + keep
  the 1px `--glass-border` hairline (the prescribed "opaque instrument surface").
- **sparkle-emoji** — `✨🪄` (regex carries the `u` flag — WITHOUT it the surrogate pair 🪄 decays and the
  char-class false-matches the `\uD83E` high-surrogate shared by 🧪🧠🧬) or `fa-magic`/`fa-wand-magic`/`fa-sparkles`.
- **emoji-ui-icon** — decorative PICTOGRAPH emoji as UI icons/headings/badges → use a Font Awesome /
  thin-line icon. WHITELIST (kept, functional/data — not slop): 🔒🔓 lock (gated-feature affordance),
  ⚠ warn, ⚡ energy, ★☆⭐ rating, ✓✔✗✘✅❌ status, 🌐 global + regional-indicator FLAGS (country data),
  ⚑ flag marker, arrows (typographic). `u` flag mandatory. NB: `<i>` icons do NOT render inside
  `<option>` — strip the emoji there rather than swapping. Where a page lacks Font Awesome (e.g. cdu-hub),
  add the cdnjs FA stylesheet (already a site dependency) before swapping.
- **dot-grid-bg**, **anthropic-purple** (`#8b5cf6`), **lucide-icons**, plus REQUIRED terms.html/privacy.html.
- **HTML-entity decoding**: numeric entities (`&#128214;` / `&#x1F4D6;` = 📖) are decoded before scanning
  so an emoji authored as an entity is caught by the same char rules as a literal one. This gap was real —
  the `📖 Technical Manual` pill shipped as `&#128214;` on ~40 pages and a literal-only scan missed every
  one; a headless render (`document.body.innerText`) caught it. Verify emoji work with a real render, not
  just a static grep.
### Detector coverage — stated honestly (v1.135.0)

For most of this standard's life the tool implemented **7 of these 26 rules** while the document
claimed it was wired as `--strict`. It was not wired at all: `ship-gate.sh` ran it as
`node tools/audit-vibecode.mjs; true`, forcing the exit code to 0. Nineteen rules had no detector
and the seven that existed could not fail a build. That is how a card could carry an 8px radius, a
3px rail, a shadow doing the delineation and `transition: all` on the homepage while the gate
reported clean — and it is why the owner kept finding slop the tool had passed.

As of v1.135.2 the gate is **strict**, and coverage is:

| status | rules | count |
|---|---|---|
| **Gating detectors** | 1, 2, 3, 4, 5, 6, 7, 17, 18, 19, 21, 22, 23, 24, 26 | **15** |
| **Monitor + strict on the flagship surfaces** | 10, 11, 12 | 3 |
| Monitor-only — real signal, structural false positives | 8, 9, 14, 15 | 4 |
| Render-hosted (needs computed geometry, not text) | 20, 25 | 2 |
| **Un-gateable judgement calls — declared, not faked** | 13, 16 | 2 |

### Monitor + strict scope (v1.135.2)

Rules 10, 11 and 12 carry a real backlog. Landing them strict site-wide would turn `main` red on
220 files, and the only available response would be to weaken or mute them — which is exactly how
this tool ended up wired as `; true`. So they **report everywhere and fail on `STRICT_SCOPE`**:
`index.html`, `styles.css`, `styles-index.css`. Those are what the owner is looking at, they are
top-three in every category the sweep measured, and a rule that gates somewhere real is a gate.
Each file family joins `STRICT_SCOPE` as it is swept; when a rule reaches zero the monitor set
loses it. Baselines measured on the tree before any edit:

| rule | at v1.135.2 | after the flagship sweep |
|---|---:|---:|
| 10 coloured left-stripe ≥3px | 259 blocks / 95 files | 253 / 93 — flagship clear |
| 11 shadow as the sole affordance | 131 blocks / 93 files | 20 / 13 — see below |
| 12 decorative radius ≥8px | 1058 blocks / 169 files | 1012 / 167 — flagship clear |

**Rule 11 fell from 93 files to 13 by getting more honest, not weaker.** Three exemptions, each
found by reading what it flagged:

1. **State blocks.** `.card:hover { box-shadow: … }` lists only what changes; the border is in the
   base rule. Nine of the rule's first fifteen flagship findings were correctly built cards being
   read one state at a time. The rule is about how a surface is delineated **at rest**.
2. **Circles.** A status dot's glow ring *is* its signal. "Cards are delineated by their border"
   is about cards; `border-radius: 50%` is a shape, not a rounded panel.
3. **Images.** A photograph, logo or avatar has no border to be delineated by. Asking one to grow
   a hairline is asking for a framed picture nobody wanted.

**Rule 23 was narrowed for the same reason.** A first cut matching any `arrow|cta|bounce` selector
flagged `.fp-arrow.active` on `fuel-system.html` — a P&ID flow indicator whose animation *is* the
reading, telling the operator the line is live. Deleting information from a process diagram to
satisfy a marketing-copy rule is not a win. It now matches a resting (never `:hover`) infinite
bounce/float on a call-to-action, and nothing else.

**The extractor had to be rewritten before any of this could run.** The obvious CSS-block regex
`/([^{}]+)\{([^{}]*)\}/g` is catastrophic on this tree: at a nested or unbalanced brace the inner
`[^{}]*\}` fails and the engine backtracks the outer `[^{}]+` one character at a time across the
preceding prose. Measured **10.3 seconds on a single 238 KB article**, and the whole-tree scan never
finished. The linear scanner does the same job in ~2 s across 420 files. It tracks enclosing
at-rules on a **stack** — a first cut kept one running `at` string and never cleared it, so every
block after a `@media print { … }` inherited "print" and was silently exempted. An exemption that
leaks forward is worse than none: it goes quiet exactly where a page has the most rules.

**Three findings that were the tool's fault, not the site's**, all fixed rather than muted: a print
stylesheet a page builds as a JS string legitimately paints white paper (rule 22 now strips
`<script>` before reading `<style>`, and skips any sheet declaring `@page`); the §B aurora-mesh hero
is named `aurora-*` everywhere and is exempt from the orb rule by that exact name; and the orb rule
itself had to stop requiring the card/panel vocabulary, because `.bg-orb` contains none of it.

**Two dead patterns removed while sweeping**, both previously rejected by the owner:
`.floating-side-card*` — 132 lines in `styles-index.css` for markup that lived only on
`articles.html`, which loads `styles.min.css` and therefore **rendered it entirely unstyled**; and
`.gradient-orb*` — the CSS half of cursor-tracking effect #47, whose JS was disabled in v1.135.0.

Rules 13 and 16 will never have a detector. "Purple-and-black *scheme*" is an aggregate palette
judgement, and "bento grid as generic filler" turns on whether the content is genuinely a
dashboard. A detector that guessed at either would report clean on the cases that matter, which is
worse than an honest gap. They are human-review items and this table says so.

**Rules 18 and 19 are shape guards, not truth checks.** No gate can know whether a quotation is
invented; the detector asserts only that the site carries no testimonial-shaped markup at all.
Rule 19 matches the specific slop formula, not every contrastive sentence — a lossy copy rule that
cries wolf gets muted and then protects nothing.

- **Two exemptions the rule needs to be usable** (both found by running it, v1.134.21):
  1. **Protected aurora.** A translucent stop INSIDE a `gradient()` is not a finding — §B
     protects the aurora-mesh hero and its palette legitimately includes a violet. A solid
     `#A78BFA` still fails, gradient or not. Without this the rule flagged the site's own
     signature on every page that loads the shared stylesheets.
  2. **Repairs are not offences.** `[style*="rgb(139, 92, 246)"] { color:… !important }`
     exists to repaint what a chart library injects inline. Naming a colour in a selector is
     not painting with it; flagging it pushes an author to delete the only thing keeping the
     colour off the page. Attribute selectors are stripped before the scan.
- **Documentation exemption**: `<code>`/`<pre>` prose is stripped before scanning (a changelog entry that
  quotes `#8b5cf6` while DESCRIBING its purge is not committing it). `changelog.html` (generated archive
  that quotes historical CSS as before/after illustration) is excluded from scope entirely — the ban is
  enforced on live-design surfaces, not the historical log.
