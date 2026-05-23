# KNOWLEDGE LABS STANDARD

> **Status**: Active · v1 · 2026-05-24
> **Scope**: The "Knowledge Labs" section of `datacenter-solutions.html`
> and the topic pages it surfaces (LTC labs, Network Visualization Hub,
> AI Engineering Maintenance, etc.).
> **Mandate**: Codified per UIUX review of the Network Hub plan (2026-05-23):
> a 7th card on Cost Calculators would trip the 6-grid SaaS anti-pattern
> (design.md §3, anti-pattern 11). A new section is the correct IA move.

---

## Why Knowledge Labs exists

Cost Calculators is semantically about financial modelling. LTC labs,
the Network Visualization Hub, and the AI Engineering Maintenance
concept page are educational / instrumentation-grade artefacts. They
need their own home.

Section placement on `datacenter-solutions.html`:
1. Hero / pillar nav
2. Cost Calculators (CAPEX, OPEX, ROI, TCO, PUE, CX)
3. **Knowledge Labs — Standards, Networks, Protocols** ← this section
4. Simulations (DC Conventional, DC AI Tech Spec)
5. Compare grid
6. Footer

## Section structure (Knowledge Labs)

The section is a card grid (3 columns desktop, 1 column mobile).
Each card:

- Title (≤32 chars)
- 60-90 word description
- Tier badge (`FREE` / `PRO` / `EDUCATOR` / `ROOT`)
- One H4 metadata line ("12 SVG diagrams · 8 sections · synthesised from 2026 paper")
- Hover: thin border lifts (no glow shadow per design.md §3 anti-pattern 18)
- Click: opens the topic page

## Color discipline

The section accent is **instrument-cyan `#00DDFF`** (informational channel
per design.md §5 colour-token map; ISA-18.2 informational alarm tier).

Per-card accents follow each topic's brand colour (e.g. AI Maintenance =
blue-400 `#60a5fa`, LTC Labs = oscilloscope-green `#00FF88`,
Network Hub = instrument-cyan `#00DDFF`).

NO Anthropic-purple. NO glassmorphism. NO neon-glow. NO Material ripple.

## Cards currently in scope

| # | Card | Topic page | Tier | Status |
|---|------|------------|------|--------|
| 1 | AI Engineering Maintenance | `ai-engineering-maintenance.html` | PRO | ✅ shipped v1.32.0 |
| 2 | LTC Labs (Standards Hub) | `standards-ltc-lab.html` | PRO | ✅ shipped |
| 3 | Network Visualization Hub | `network-visualization-hub.html` | FREE | ⏳ Phase 0 pending |

Future additions follow the same anatomy.

## Topic page anatomy (required)

Every Knowledge Labs topic page has:

1. **Hero** — IBM Plex Sans H1, JetBrains Mono badge chip with tier
   indicator and version stamp.
2. **Concept / model section** — what it is, in plain language, with
   ≥1 SVG diagram in industrial-instrumentation style (thin lines,
   palette-locked).
3. **Interactive section** — animation, calculator, or accordion-based
   exploration. Live-updating, no submit button.
4. **Gap section** — 6-12 `<details>` accordions documenting known
   limitations and proposed enhancements. Honesty about limitations
   is mandatory.
5. **Roadmap section** — phase-based, with explicit owner-sign-off
   gates between phases.
6. **Knowledge base section** — surfaces any consumed research
   deliverable with headline findings and a link to the full
   `docs/research/` report.
7. **Citations / references** — collapsed `<details>` block listing
   all primary sources (≥30 for a serious topic page).
8. **Related pages** — 3-6 internal links to adjacent calculators,
   articles, or other lab topics.
9. **Footer** — standard site footer + version stamp via
   `RZ.injectVersionStamp()`.

## SVG diagram discipline

- Thin lines: 0.6-1.4 px tier-graded (per design.md §2 line-discipline).
- Palette: instrument-cyan, signal-amber, oscilloscope-green, fault-red.
  No purple, no neon, no gradient fills.
- Typography in SVG: IBM Plex Sans labels, JetBrains Mono for numeric
  values.
- Block-diagram register: industrial-DCS / oscilloscope, not consumer
  techno music video.

## Gating

Each card respects `enforceTierFeatureAccess('<page-key>')` from
`rz-feature-flags.js`. Tier matrix:

| Tier | Free pages | Pro pages | Educator pages | Root pages |
|------|------------|-----------|----------------|------------|
| `free` | ✅ | ❌ | ❌ | ❌ |
| `demo` | ✅ | ❌ | ❌ | ❌ |
| `pro` | ✅ | ✅ | ✅ | ❌ |
| `educator` | ✅ | ✅ | ✅ | ❌ |
| `root` | ✅ | ✅ | ✅ | ✅ |

## Site integration checklist

For every new Knowledge Labs topic page:

- [ ] Page registered in `rz-feature-flags.js`
- [ ] Sitemap entry added (`priority="0.7"`)
- [ ] Search-index entry added with curated description
- [ ] `llms.txt` entry added
- [ ] OG image at `assets/og/<slug>.webp` (1200×630)
- [ ] Card added to `datacenter-solutions.html` Knowledge Labs section
- [ ] Post-draft folder created per POST_DRAFT_STANDARD
- [ ] CHANGELOG entry on ship
- [ ] sw.js cache version bumped

## Cross-references

- `design.md` — brand tokens + anti-pattern ledger
- `POST_DRAFT_STANDARD.md` — promotional copy mandate
- `KNOWLEDGE_BASE_STANDARD.md` — research-deliverable mandate
- `CONTENT_LINKAGE_PLAYBOOK.md` — sitemap / search-index / llms.txt
- `UI_FEATURES_STANDARD.md` — focus indicators, slider patterns
- `VERSIONING_STANDARD.md` — bump cadence

---

## Changelog

- **v1 — 2026-05-24** — Section established to host AI Maintenance,
  LTC Labs, and the upcoming Network Visualization Hub. Replaces the
  earlier (incorrect) plan to add a 7th card to Cost Calculators.
