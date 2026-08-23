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
| 3 | Anthropic-purple `#8B5CF6` as a pill/accent | Mint `#7DDDB4`; residual semantic uses must move to a named token, never the raw pill color. |
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
- **Documentation exemption**: `<code>`/`<pre>` prose is stripped before scanning (a changelog entry that
  quotes `#8b5cf6` while DESCRIBING its purge is not committing it). `changelog.html` (generated archive
  that quotes historical CSS as before/after illustration) is excluded from scope entirely — the ban is
  enforced on live-design surfaces, not the historical log.
