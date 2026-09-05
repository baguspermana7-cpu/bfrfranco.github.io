# ANTI-VIBECODE STANDARD — resistancezero.com must never look AI-generated

> Mandate (owner, 2026-08-23): the site must carry **none** of the 30 "vibecoded" tells. This doc
> codifies each into HARD-BANNED / RZ-SIGNATURE (deliberate, protected) / REQUIRED, plus the enforcement
> gate. Read before any visual/CSS work. Gate: `node tools/audit-vibecode.mjs --strict`.

## Why
Generic AI page-builders converge on the same look (Inter font, purple-black, dot-grid, glassmorphism,
radial orbs, emoji, 3-card rows, sparkle icons). resistancezero.com has a **deliberate industrial /
instrument aesthetic** (thin hairlines, oscilloscope tokens, considered type). Any drift toward the
generic set reads as "vibecoded" and must be removed.

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
