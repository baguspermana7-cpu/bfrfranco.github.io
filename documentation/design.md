# resistancezero.com — Brand & Design System Manifest

> **Version**: 1.0 — 2026-05-13
> **Owner**: Bagus Dwi Permana
> **Scope**: All pages at resistancezero.com (103+ indexable HTML files)
> **Status**: Active — append-only decision log in Section 15
>
> This is the authoritative design system document. Tactical implementation rules
> (class names, CSS snippets, JS patterns) live in `../standarization/`. This
> document governs the WHY behind every visual and structural decision.

---

## Table of Contents

1. [Brand Essence](#1-brand-essence)
2. [Visual Character](#2-visual-character)
3. [Anti-Patterns — What to Reject](#3-anti-patterns--what-to-reject)
4. [Typography System](#4-typography-system)
5. [Color Tokens](#5-color-tokens)
6. [Layout Patterns](#6-layout-patterns)
7. [Kinetic Patterns](#7-kinetic-patterns)
8. [Iconography](#8-iconography)
9. [Component Library Map](#9-component-library-map)
10. [Page Archetypes](#10-page-archetypes)
11. [PDF Export Design](#11-pdf-export-design)
12. [Accessibility](#12-accessibility)
13. [Mobile-First Responsiveness](#13-mobile-first-responsiveness)
14. [5-Year Roadmap](#14-5-year-roadmap)
15. [Decision Log](#15-decision-log)

---

## 1. Brand Essence

### Three-word brand promise

**Mission-Critical. Engineered. Precise.**

Not three adjectives stacked for aesthetic effect. Three operational categories: the work is mission-critical infrastructure (it fails and a hospital goes dark); it is engineered (physical laws, not opinions); it is precise (tolerances measured in milliseconds and milliamperes, not "approximately" or "roughly").

### Persona statement

Bagus Dwi Permana is an engineering operations leader with 12+ years running hyperscale data-center infrastructure — electrical systems, M&E commissioning, industrial automation — from Bekasi, Indonesia. He is not a startup founder, not a consultant packaging frameworks into PDFs, and not a developer writing think-pieces. He is the person in the switching room at 02:00 when the UPS module trips, and he is also the person who can explain exactly why it tripped and what the probabilistic failure tree looked like.

This site is his public engineering workbench. Calculators do real mathematics against real standards (ASHRAE TC 9.9, Uptime Institute Tier Classification, IEC 60364). Articles cite primary sources. Simulations replicate real BMS and SCADA screen geometry. Every page earns its own authority because the person behind it earned it in the field.

The audience: infrastructure engineers, facilities managers, M&E consultants, DC operations teams, energy analysts, and anyone who needs a tool that treats them as technically capable adults.

### Anti-positioning — what this site explicitly is NOT

- Not a lifestyle blog. No "my journey" narratives. No wellness-coded language.
- Not a SaaS marketing page. There is no product to buy, no pricing tier, no "Start your free trial."
- Not a Tailwind template. Every visual decision is deliberate, not a default.
- Not a generic consulting portfolio. The calculators produce actual numerical output grounded in physical and economic models.
- Not an "AI-generated content farm." Every article reflects direct professional experience or rigorous primary research.
- Not a thought-leadership publication that uses "transform," "innovate," "next-gen," or "disrupt" unironically.
- Not optimized for virality. Optimized for depth and precision.

### Brand voice

**Technical authority, direct, no filler.** Write as if the reader is a senior engineer who will immediately notice if a number is wrong. Short declarative sentences for data. Long compound sentences only when an argument requires tracking multiple dependent variables simultaneously. Indonesian phrases appear where the English equivalent is weaker — "ciri khas" (identifiable character), "kinerja" (operational performance) carry nuance that "unique" and "performance" lose.

First-person voice is acceptable in editorial contexts. Third-person passive is not — "it was determined that" is a bureaucratic hedge; "the test showed" is precise.

### Content strategy alignment with brand

Brand voice and content strategy are inseparable. The way the site presents information reinforces what the brand claims to be. Specific rules:

**Article structure discipline:**
Every article opens with a specific technical claim or finding — not a rhetorical question, not "In today's rapidly evolving data center landscape..." The opening paragraph must contain at least one concrete number or standard reference. If the article cannot begin with specificity, the thesis is not ready.

**Calculator copy discipline:**
Input labels are technical terms, not marketing copy. "IT Load (MW)" is correct. "Your Power Needs" is not. Methodology descriptions reference the standard they are based on (ASHRAE, Uptime, IEC) in the first sentence. If no standard applies, the methodology note explains the model derivation explicitly.

**Chart titles discipline:**
Chart titles state the finding, not just the variable. "Annual Energy Consumption vs. PUE" is a variable pair. "Higher PUE drives a non-linear increase in annual energy cost" is a finding. The site prefers finding-titled charts because the site's purpose is analytical insight, not raw data display.

**Error message discipline:**
Error messages on calculator inputs are technical, not apologetic. "Value must be between 0.1 and 100 MW" is correct. "Oops! Something went wrong with that number." is not. The site treats its users as engineers who can act on specific error information.

**Bilingual policy:**
English is the primary language for all technical content. Bahasa Indonesia is used:
- In the site description and persona references where Indonesian context is relevant
- In localized number formatting when `Intl.NumberFormat('id-ID')` is active (Year 2 feature)
- Never as a decorative "flavor" addition — only where it genuinely serves the Indonesian engineering audience
When a term has a stronger technical meaning in Bahasa (e.g., "kinerja" for operational performance as distinct from theoretical performance), the Bahasa term is acceptable in parentheses: "kinerja (operational performance)."

---

## 2. Visual Character

### The aesthetic identity

The visual language of this site draws from a specific family of professional display environments that share a common constraint: they must convey high-dimensional numerical data with zero ambiguity at a glance. These environments include:

- **SCADA HMI dashboards** — dark backgrounds, instrument-chip data labels, alarm-state color coding, P&ID topology lines, thin stroke weights that preserve clarity at high node density
- **Oscilloscope displays** — phosphor green on near-black, waveform traces rather than bar charts, time-domain precision
- **Electrical single-line diagrams (SLDs)** — tier-graded line weights as a function of voltage level, IEC 60617 symbol conventions, annotation density without clutter
- **PCB layout editors (KiCAD/Altium)** — monochrome-primary with signal-colored trace highlights, precision grid, copper-weight discipline
- **NASA mission control consoles** — tightly packed monospace data fields, alarm-priority color hierarchy, nothing decorative

The translation to editorial web design is not literal imitation. It is borrowing the discipline: every visual element earns its place by carrying information. Nothing is decorative. Color signals state, not brand preference. Line weight signals hierarchy, not stylistic flourish. White space signals boundary and breathing room between dense data zones, not empty luxury.

### The result

A site that feels like a working instrument panel — readable, authoritative, data-dense where it needs to be, generous with whitespace where it serves comprehension — not a magazine, not a product brochure, not a portfolio template.

### Aesthetic influences — what is borrowed and why

The design borrows from specific professional environments. Each borrow is intentional and has a functional reason:

**From SCADA HMI displays:**
- Dark background: reduces eye fatigue during extended monitoring sessions; high contrast ensures alarm states are immediately visible without color calibration dependency
- Instrument chip layout: packs high data density into compact tiles without scrolling; each chip is independently scannable
- 5-stop severity ramp (green-amber-orange-red): standardized per IEC 62682 / ISA-18.2; operators trained on any SCADA system recognize the color coding immediately

**From electrical single-line diagrams (SLDs):**
- Tier-graded stroke weights: in an SLD, voltage level determines line weight — 500 kV lines are visually heavier than 20 kV feeders, which helps operators immediately locate the right tier in a complex diagram. Applied to web components, this means primary structural borders are heavier than data field hairlines.
- Topology-first annotation: labels appear on hover/tooltip, not permanently, because SLD displays with permanent labels become unreadable at 500+ node density. Same principle applies to the PLN grid monitor.
- Symbol vocabulary: IEC 60617 symbols for transformer, breaker, generator, busbar are internationally standardized and immediately readable to any electrical engineer regardless of language.

**From PCB layout editors:**
- Precision grid alignment: KiCAD and Altium enforce a routing grid for copper tracks. The 4-pt baseline grid on this site serves the same function — everything snaps to 4px multiples, preventing the slightly-off alignment that makes interfaces feel amateurish.
- Color-by-layer principle: in PCB design, each copper layer is a different color. On this site, each information tier has a distinct color token. The principle is identical: color communicates which layer of the information hierarchy you are looking at.

**From NASA mission control consoles:**
- Information density without clutter: mission control packs enormous amounts of telemetry into a fixed display area without losing readability. The key technique is consistent monospace font, consistent unit labeling, and consistent column alignment — not fewer data points.
- Nothing ornamental: every pixel on a mission control display serves a function. Decorative elements reduce the density available for actual data. This site applies the same principle.

**From oscilloscopes:**
- Green-on-dark for active data: the P31 phosphor screen color (`#00FF88` approximation) for success and active data states references the oldest and most reliable convention in electronic test equipment. Engineers recognize it as "signal present and within parameters."
- Trace style over bar style: line charts are preferred over bar charts for time-series data because they carry more information per pixel — inflection points, rate of change, and absolute values are all readable from a line trace; a bar chart loses the rate-of-change information.

### Comparison: what this site looks like vs. what it does not

The following table makes the aesthetic distinction concrete. When a design decision is ambiguous, use these comparisons to resolve it.

| Dimension | resistancezero.com | What it is NOT |
|-----------|-------------------|----------------|
| Background | Deep slate `#0a0e1a` — specific, functional dark | "Dark mode" gray from Tailwind defaults |
| Primary accent | Signal amber `#FFAA00` — ISA-18.2 caution state | Violet/purple from Anthropic/Tailwind ecosystem |
| Line weight | Tier-graded 0.6-1.4px based on hierarchy | Decorative 3px slabs or completely borderless |
| Typography | IBM Plex Sans — engineered document character | Inter — generic SaaS product |
| Data display | JetBrains Mono tabular-nums, right-aligned | Proportional font, arbitrary alignment |
| Cards | 1px hairline, 4px radius, elevation via background | Chunky shadows, 12-16px radius, glassmorphism |
| Buttons | Solid fill `--rz-accent-signal` or 1px border | Gradient fill, glow effects, 3D press |
| Icons | IEC/ISA stroke symbols, 1.5-1.75px stroke | Filled cute icons, Font Awesome Solid |
| Motion | State-change only, 150-280ms | Continuous ambient animation, spring bounce |
| Charts | SVG line charts, axis labels in JB Mono | Rounded bar charts with thick fills and drop shadows |
| Whitespace | 4-pt baseline grid, functional separation | Random padding, "airy luxury" overuse |
| Hero | Aurora mesh CSS + text + scroll cue | Full-bleed stock photo, video autoplay |
| Navigation | Mono uppercase, active = 2px amber underline | Pill-style active state, gradient highlight |
| Error state | Fault red `#FF3030` with triangle icon, labeled | Red glow, "Oops!" copy, bouncy animation |

### Ciri khas — what makes this site identifiable

"Ciri khas" in Bahasa Indonesia means something closer to "defining character" or "signature quality" than the English "unique." A design can be unique without having ciri khas — it can be unusual without being recognizable. The goal here is recognizability: if a screenshot of any page on this site were placed next to screenshots from 10 other engineering websites, the resistancezero.com page should be immediately identifiable.

The identifiable elements, in order of visual impact:

1. **Deep slate background with signal amber** — the color combination is specific enough to read as a system. Not "dark mode with yellow" — the exact amber-on-slate combination is the signature.

2. **Tier-graded hairline borders** — no other engineering website applies SLD stroke discipline to its card and table borders. The graduated thinness from 1.4px to 0.6px is a direct visual citation of single-line diagram conventions.

3. **Instrument chip data display** — the pattern of `11px mono uppercase label + 22-32px mono value + unit` rendered on an inset dark background is drawn directly from SCADA HMI chip displays. No lifestyle blog, SaaS page, or portfolio has this pattern because none of them have reason to.

4. **Laser-flow on SLD paths** — a dashed stroke animating along SVG transmission line paths is a direct reference to the power flow animation in professional energy management systems. It is purposeful and domain-specific.

5. **IBM Plex Sans + JetBrains Mono pairing** — IBM Plex was designed for technical documentation. JetBrains Mono was designed for code editors. The pairing says "documentation about code and systems" rather than "product about technology."

These five elements together produce ciri khas. Any page redesign that erodes two or more of them simultaneously is moving away from the site's identity.

### Design quality gate

Before any new component or page passes design review, it must satisfy this question: "Could this component appear on a SaaS marketing page, a lifestyle blog, or a Tailwind template without looking out of place?"

If the answer is yes, the component needs redesign. The goal is that every component would look wrong on any other kind of site — because it was built for this specific aesthetic and purpose.

### Typography character

IBM Plex Sans is the heading and body face. It was designed by IBM for technical documentation and has a slightly wider, more structured posture than Inter or Plus Jakarta Sans. It does not look like "another SaaS site." It looks like an engineering document that has been made beautiful.

JetBrains Mono handles all numerical data, code, captions, metadata, and measurements. Its slashed zero eliminates the 0/O ambiguity that is unacceptable in engineering contexts. Its tabular figures ensure columns of numbers align without letter-spacing tricks.

The combination reads as: authoritative, technical, human-curated. Not algorithmic. Not generated.

### Color character

The palette is anchored by **deep slate** (`#0a0e1a`) — not pure black, which reads as void rather than precision. The primary accent is **signal amber** (`#FFAA00`) — the color of a caution lamp on an industrial panel, of the amber LED on a status indicator, of measured attention without alarm. It is warm but not casual.

Secondary accents are drawn from instrument displays: oscilloscope green (`#00FF88`) for data and success states, fault red (`#FF3030`) for alarm and error states, instrument cyan (`#00DDFF`) for informational and secondary data. These are saturated enough to read against the dark background at instrument chip scale (12px monospace) without requiring a hover target.

No pastels in the primary palette. Pastels appear only in the bento timeline zone on the landing page (a deliberate contrast zone — soft in a hard context), and nowhere else.

### Line discipline

Line weight carries semantic meaning, not decorative weight. The rule is: line weight corresponds to the information tier of the element it delineates, following the same logic as SLD stroke conventions.

| Tier | Weight | Application |
|------|--------|-------------|
| Tier 1 — primary structure | 1.4 px | Page-level section dividers, major card borders |
| Tier 2 — component boundary | 1.0 px | Card hairlines, tab borders, modal frames |
| Tier 3 — data field | 0.6 px | Table hairlines, input field borders, legend rules |
| Tier 4 — annotation | 0.5 px | Footnote rules, caption separators |

This mirrors the PLN Java-Bali grid SLD conventions already established in `js/pln-java-grid-data.js` and codified in the voltage-tier color mapping in Section 5.

3-4 px slabs are never used for borders. They belong to industrial safety floor markings, not precision digital interfaces.

### Motion character

Restrained. Animation exists to convey state change, not to signal that the page is "alive." The site is alive because its content is current and substantive — not because things drift and pulse.

The only continuous animations are laser-flow traces on SLD data-flow paths (≥150 kV equivalent hierarchy tiers) and the aurora mesh hero on the landing page. Everything else is transition-on-state-change: 200-300 ms ease-in-out. Pulsing dots only on active alarms. No auto-playing decorative animations.

---

## 3. Anti-Patterns — What to Reject

These patterns are explicitly forbidden on resistancezero.com. Each entry includes the reason: aesthetic preference alone is not enough justification — every rejection is grounded in what the pattern communicates and why that is wrong for this site.

| # | Pattern | Why it is rejected |
|---|---------|-------------------|
| 1 | Dot-grid noise backgrounds | Reads as "default Claude output" — overused in AI-generated UI mockups, has no semantic content, creates visual noise behind actual data. Use soft radial gradient washes instead (gold + mint, opacity ≤0.06). |
| 2 | Anthropic-default purple `#8B5CF6` as accent | Associated with Tailwind `violet-500` and Anthropic's UI palette. No distinction from a hundred generic SaaS sites. Replaced with mint `#7DDDB4` for user-facing interactive elements. |
| 3 | Saturated emerald as a general-purpose accent | Was overused in v1.0.x throughout cards, buttons, and indicators. Emerald now restricted exclusively to data/success state (mirrors oscilloscope green). No other use. |
| 4 | Cursor-tracking 3D card tilt with mouse follow | Adds interaction cost for zero informational gain. Causes motion sensitivity issues. Disabled in `script.js` (`initCardTilt` — early return). Do not re-enable. |
| 5 | Mouse spotlight / magnetic cursor halo | Same issue as card tilt. Distracting non-semantic animation. Disabled in `script.js` (`initSpotlight` — early return). |
| 6 | Rotated side tabs on the landing page | The `#DATACENTER AI / HPC` + `#DATACENTER CONVENTIONAL` right-edge vertical tabs were visually noisy, overlapped content on narrow viewports, and added an interaction layer with no benefit. Removed in v1.1.0. |
| 7 | Bouncy spring text on hero headings | Spring animation on hero copy communicates "playful product" — the wrong register for engineering authority. Use restrained kinetic typography: blur-fade entrance at 220 ms ease. |
| 8 | Default Tailwind pastel-everything bento cards | Acceptable in ONE controlled zone (the landing page timeline, 5 cards only). Banned everywhere else. Using pastels on calculator cards, article cards, or tool cards creates a lifestyle-blog visual register. |
| 9 | Lifestyle stock photography | No office photos, no smiling engineers in hardhats for aesthetic effect, no datacenter-corridor stock shots with fake blue lighting. Diagrams, real screenshots, and system topology renders only. |
| 10 | Saturated gradient buttons | A button is a control. Control elements in instrument panels use solid fill (state = off/on) or thin border (inactive/active) — not rainbow gradients. Use `--rz-accent-signal` fill with dark text, or 1px border + transparent fill on secondary. |
| 11 | "Modern flat" generic SaaS hero with 3-column CTA grid | Three icons with subheads underneath a hero headline is a Notion/Linear/Vercel template pattern. It says nothing about the specific expertise on this site. |
| 12 | Auto-generated abstract mesh/gradient hero backgrounds | Midjourney gradient mesh aesthetics. Untethered from engineering precision. The aurora mesh used in v1.4.0+ is CSS-custom and controlled — the distinction is intentionality and restraint. Any replacement must match that specificity. |
| 13 | Emoji as decorative elements in prose and UI | Emoji communicate informally and reduce technical register immediately. Use only when the content demands it (game pages, achievement badges with explicit metaphor). Never in article body, calculator UI, or navigation. |
| 14 | Lottie animations as section ornaments | Heavy payload, introduces third-party JS dependency, communicates "startup landing page." Use SVG line animations or CSS keyframes instead. |
| 15 | Aggressive card shine sweep on hover | Subtle single-pass sweep (opacity ≤0.07) is acceptable on landing-page cards. Aggressive repeating shine, rainbow iridescence, or holographic foil effects are decorative noise. |
| 16 | Glassmorphism (frosted glass cards with heavy `backdrop-filter: blur`) | Became a 2021-2023 overused trend. Introduces rendering performance cost on low-spec devices. A 1px hairline border on a dark semi-transparent background is more disciplined and faster. |
| 17 | Neumorphism (soft-shadow inset/outset 3D appearance) | Fails WCAG contrast requirements systematically. Not readable on data-dense panels. Belongs to the "beautiful screenshot, unusable interface" anti-pattern category. |
| 18 | Skeuomorphic multi-layer shadow stacks (4+ `box-shadow` layers) | Borrowed from iOS 6-era design. No relationship to the industrial precision aesthetic. One shadow level maximum: `0 1px 3px rgba(0,0,0,0.35)` — below that level, prefer no shadow and a border instead. |
| 19 | Chunky 3D buttons with perspective transform hover | Related to skeuomorphism. Communicates "game UI" or "children's app." Instrument controls are flat indicators. |
| 20 | Cookie-consent banners that block page content (overlay + dim) | These are legal compliance requirements, not engagement opportunities. The cookie banner must slide in from the bottom, be dismissible in one click, and never dim or blur the page. |
| 21 | Sticky floating chat widgets (Intercom, Drift, Tawk, etc.) | The site does not provide live support. A chat widget permanently occupying 60×60px of screen real estate with an unread badge animation is visual debt for no service. |
| 22 | Pop-up newsletter sign-up modals triggered on scroll or time | Interrupt-driven subscription capture is a dark pattern for a technical authority site. Contact is available in the nav. |
| 23 | Stripe-style "Pricing" section | The site does not sell tiers. Any pricing-table-style layout sends a false signal about what the site is. |
| 24 | "Powered by AI" / "10x faster" / "Transform your X" copy | These are category-commodity phrases. They communicate nothing. Every claim on this site is attached to a specific measurement, a specific standard, or a specific scenario. |
| 25 | Footer with 6+ columns of links | A wide link-forest footer signals a content management system, not a curated engineering publication. Two to three columns maximum: primary pages, calculators, legal. |
| 26 | Hero autoplay background video | Bandwidth cost exceeds informational value for a text/diagram-primary site. The `<video>` intro is gate-locked behind a deliberate user action (Get Started CTA). |
| 27 | "Social proof" sections with company logo bars | The site earns authority through demonstrated analytical depth, not name-dropping. No "As featured in..." logo strips. |
| 28 | Breadcrumb trails rendered visually on every page | Appropriate for deep content hierarchies (e-commerce, knowledge bases). For this flat site structure, breadcrumbs add navigational noise. Schema.org `BreadcrumbList` is in JSON-LD for SEO — not rendered visually. |
| 29 | Infinite scroll on article index pages | Pagination with explicit page counts supports citation-style linking. "Load more" erases position state. |
| 30 | Dark-on-dark text that "looks subtle" | Any text with contrast ratio below 4.5:1 against its background is a WCAG 2.2 AA failure. "Subtle" in instrument UI means 60% opacity on a known background — not guessing at contrast. |

---

## 4. Typography System

### Design rationale

Typography on a precision-engineering site must do three things simultaneously: communicate authority, support high-density data readability, and never subordinate content to style. The IBM Plex family was chosen over Inter because IBM Plex Sans has a slightly wider aperture and more structured stroke contrast — it reads as "engineering document made beautiful" rather than "SaaS default." JetBrains Mono was chosen over Fira Code, Source Code Pro, or Cascadia because of its superior tabular figures, slashed zero, and optical weight that aligns well with IBM Plex at the same font-size.

### Font loading

```html
<!-- Preconnect + preload in <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
```

Font-display strategy: `display=swap` to eliminate FOIT. Critical above-fold text uses the system stack while fonts load; reflow is acceptable given the font metric similarity between IBM Plex Sans and system-ui.

### CSS custom property stack

```css
:root {
    --rz-font-sans: 'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
    --rz-font-mono: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    --rz-font-math: 'IBM Plex Math', 'STIX Two Math', serif;
}
```

### Heading scale

| Level | Size | Weight | Tracking | Line-height | Usage |
|-------|------|--------|----------|-------------|-------|
| H1 | 56-64px | 700 | -0.02em | 1.05 | Page title, hero headline |
| H1 mobile | 36-40px | 700 | -0.015em | 1.08 | Same element, <768px |
| H2 | 36-44px | 600 | -0.015em | 1.1 | Section heading |
| H2 mobile | 26-30px | 600 | -0.01em | 1.15 | Same element, <768px |
| H3 | 24-28px | 600 | -0.01em | 1.2 | Subsection heading |
| H4 | 18-20px | 600 | 0em | 1.3 | Component heading, card title |
| H5 | 15-16px | 600 | 0.01em | 1.35 | Label, grouped data heading |
| H6 | 13-14px | 600 | 0.02em | 1.4 | Fine hierarchy, rarely used |

H1 and H2 use negative tracking because IBM Plex Sans was designed with generous default spacing — negative tracking at large sizes tightens the visual cohesion of multi-word headings without sacrificing per-character readability.

### Body text

```css
body {
    font-family: var(--rz-font-sans);
    font-size: 16px;
    line-height: 1.55;
    color: var(--rz-text-primary);
}

.rz-prose {
    max-width: 70ch;  /* enforced on prose containers, not body element */
}
```

The 70ch maximum width is not arbitrary — it matches the WCAG 2.2 Success Criterion 1.4.8 recommendation of no more than 80 characters per line for sustained reading. In practice, 70ch is more comfortable for technical prose that includes equations and parenthetical citations.

### Monospace numerics

ALL numerical data displayed in a table, instrument chip, KPI card, or data field uses:

```css
.data-value {
    font-family: var(--rz-font-mono);
    font-variant-numeric: tabular-nums slashed-zero;
    font-feature-settings: 'tnum' 1, 'zero' 1;
}
```

Tabular figures ensure that columns of numbers align vertically without letter-spacing manipulation. Slashed zero eliminates the 0/O ambiguity that causes misreading in engineering contexts — a `0.8 MW` figure read as `0.8 MW` is correct; read as `Q.8 MW` it suggests a variable name and an entirely different equation.

### Caption and metadata style

```css
.meta-label,
.caption,
.chart-annotation {
    font-family: var(--rz-font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--rz-text-muted);
}
```

The combination of monospace + uppercase + wide letter-spacing creates the instrument-panel "data field label" look. It reads as: "this is metadata about what follows, not the content itself." IBM Plex Sans in lowercase at 11px is too small to read comfortably; JetBrains Mono at 11px is legible because of its generous x-height.

### Math notation

KaTeX is the preferred renderer for inline and block math. For pages that do not load KaTeX, IBM Plex Math renders an acceptable fallback. Variable names follow the convention of italic serif (standard mathematical convention); operators and subscripts in upright. Equations are never rendered as images — they must be selectable and copyable text.

```html
<!-- KaTeX CDN — defer-load on pages that need it -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js" defer></script>
```

### Type scale CSS tokens

```css
:root {
    --rz-text-h1:      clamp(36px, 5vw, 64px);
    --rz-text-h2:      clamp(26px, 3.5vw, 44px);
    --rz-text-h3:      clamp(20px, 2.5vw, 28px);
    --rz-text-h4:      clamp(16px, 1.8vw, 20px);
    --rz-text-body:    16px;
    --rz-text-small:   14px;
    --rz-text-caption: 11px;
    --rz-text-data:    13px;   /* instrument chip label */
    --rz-text-data-lg: 22px;   /* KPI card value */
    --rz-text-data-xl: 32px;   /* hero metric value */
}
```

The `clamp()` functions implement fluid typography between the minimum (mobile) and maximum (desktop) values, bypassing the need for per-breakpoint font-size overrides on every heading level.

---

## 5. Color Tokens

### Design rationale

Color on this site performs three jobs: it signals information state (normal / caution / fault / informational), it defines spatial hierarchy (background layers, elevated surfaces, overlay surfaces), and it creates the instrument-panel aesthetic without becoming a costume. Pastels and soft gradients do none of these jobs well for a site whose primary content is engineering data.

The palette is derived from professional display standards:
- Dark background follows SCADA console conventions (high contrast, reduced eye fatigue on extended use)
- Signal amber follows IEC 61511 / ISA-18.2 alarm management color priority (amber = condition requiring attention, red = action required immediately)
- Oscilloscope green follows the phosphor P31 emission spectrum (`#00FF88` approximates P31 at moderate brightness)
- Cyan follows industrial HMI informational indicator conventions

### Base surface tokens

```css
:root {
    /* Backgrounds — 3-layer elevation system */
    --rz-bg-base:      #0a0e1a;   /* Page background — deep slate, not pure black */
    --rz-bg-elevated:  #111827;   /* Card, panel, sidebar background */
    --rz-bg-overlay:   #1c2333;   /* Modal, dropdown, tooltip background */
    --rz-bg-inset:     #080c16;   /* Input field, code block background */
    --rz-bg-hover:     #1a2035;   /* Hover state background for interactive rows */
}
```

Why three background levels? SCADA displays use at least three: the console base, the module panel face, and the instrument chip face. The visual depth communicates hierarchy without color or shadow. On a dark theme where shadows become invisible, background elevation is the primary spatial language.

`#0a0e1a` is not arbitrary — it is dark enough to provide contrast for `#FFAA00` at 7.2:1 (WCAG AAA) and for `#00FF88` at 11.3:1, while not being void-black (`#000000`) that reads as absence rather than surface.

### Text tokens

```css
:root {
    --rz-text-primary:   #E8EDF5;   /* Main body text — off-white, not pure white */
    --rz-text-secondary: #A0AEC0;   /* Supporting text, card descriptions */
    --rz-text-muted:     #64748B;   /* Metadata, captions, timestamps */
    --rz-text-disabled:  #3D4A5C;   /* Disabled state text */
    --rz-text-inverse:   #0a0e1a;   /* Text on light backgrounds */
    --rz-text-accent:    #FFAA00;   /* Signal amber for highlighted labels */
    --rz-text-code:      #00FF88;   /* Inline code and numeric data */
}
```

Pure white (`#FFFFFF`) on dark background produces 21:1 contrast — the theoretical maximum — but it also produces the highest chromatic aberration on LCD panels. `#E8EDF5` at approximately 15:1 is still well above WCAG AAA (7:1) while reducing eye fatigue on extended reading sessions.

### Accent tokens

```css
:root {
    /* Primary accent — signal amber */
    --rz-accent-signal:     #FFAA00;              /* Primary interactive, active states, CTA */
    --rz-accent-signal-dim: #CC8800;              /* Hover-pressed state for signal amber */
    --rz-accent-signal-bg:  rgba(255,170,0,0.08); /* Subtle amber tinted background */

    /* Data / success — oscilloscope green */
    --rz-accent-data:       #00FF88;
    --rz-accent-data-dim:   #00CC6A;
    --rz-accent-data-bg:    rgba(0,255,136,0.07);

    /* Fault / alert — fault red */
    --rz-accent-alert:      #FF3030;
    --rz-accent-alert-dim:  #CC2020;
    --rz-accent-alert-bg:   rgba(255,48,48,0.08);

    /* Informational — instrument cyan */
    --rz-accent-info:       #00DDFF;
    --rz-accent-info-dim:   #00AACC;
    --rz-accent-info-bg:    rgba(0,221,255,0.07);

    /* Neutral highlight — muted mint (user-facing interactive) */
    --rz-accent-mint:       #7DDDB4;   /* Auth pill, NOT primary accent */
    --rz-accent-mint-bg:    rgba(125,221,180,0.08);
}
```

Why five accent families rather than one? Because a site that displays engineering data needs to communicate five distinct information states without ambiguity. Using one color for "active tab" AND "success metric" AND "caution reading" creates semantic confusion. This maps directly to ISA-18.2 alarm management: each severity level has a distinct visual channel.

### Line / border tokens

```css
:root {
    /* Tier-graded borders — matches SLD stroke discipline */
    --rz-line-tier-1: rgba(255,255,255,0.18);  /* 1.4px — primary structure */
    --rz-line-tier-2: rgba(255,255,255,0.12);  /* 1.0px — component boundary */
    --rz-line-tier-3: rgba(255,255,255,0.07);  /* 0.6px — data field hairline */
    --rz-line-accent: rgba(255,170,0,0.40);    /* Amber line for active/focus states */
    --rz-line-data:   rgba(0,255,136,0.35);    /* Green line for data flow paths */
    --rz-line-fault:  rgba(255,48,48,0.40);    /* Red line for fault/alarm states */
}
```

### Voltage-tier color mapping (PLN grid pages)

This mapping is already operational in `js/pln-java-grid-data.js`. Codifying here as the canonical reference:

| Voltage | Color | Hex | Stroke weight |
|---------|-------|-----|---------------|
| 500 kV | Gold | `#FFD700` | 1.6 px |
| 275 kV | Orange | `#FF8C00` | 1.4 px |
| 150 kV | Amber | `#FFAA00` | 1.0 px |
| 70 kV | Cyan | `#00DDFF` | 0.7 px |
| 20 kV | Mint | `#7DDDB4` | 0.6 px |
| Inferred | Dimmed variant | `opacity: 0.35` | same as tier |

The color-to-voltage mapping is not arbitrary: it follows the SCADA convention of warmer colors for higher voltages (greater consequence of fault) and cooler colors for distribution-level voltages. This matches Indonesian PLN's internal HMI color conventions.

### DC simulation severity ramp

For `datahallAI.html`, `dc-conventional.html`, and any BMS-style simulation page:

| Level | Label | Color token | Hex |
|-------|-------|-------------|-----|
| 5 | Optimal | `--rz-accent-data` | `#00FF88` |
| 4 | Normal | Dimmed green | `#00CC6A` |
| 3 | Caution | `--rz-accent-signal` | `#FFAA00` |
| 2 | Warning | Orange | `#FF7700` |
| 1 | Critical | `--rz-accent-alert` | `#FF3030` |

5-stop ramp from green through amber to red follows traffic-light convention that is universally understood AND matches IEC 62682 (Management of Alarm Systems for the Process Industries) visual coding requirements.

### Light-mode tokens

Light mode is a fallback; it is not the default. The instrumentation aesthetic is explicitly dark. When `[data-theme="light"]` is active:

```css
[data-theme="light"] {
    --rz-bg-base:        #F5F7FA;
    --rz-bg-elevated:    #FFFFFF;
    --rz-bg-overlay:     #F0F2F5;
    --rz-bg-inset:       #E8ECF2;
    --rz-text-primary:   #111827;
    --rz-text-secondary: #374151;
    --rz-text-muted:     #6B7280;
    --rz-accent-signal:  #CC8800;   /* Darkened amber for contrast on white */
    --rz-accent-data:    #007A44;   /* Darkened green for contrast */
    --rz-accent-alert:   #CC1F1F;
    --rz-accent-info:    #0077AA;
}
```

Light mode uses the same semantic token names — every component that uses `var(--rz-accent-signal)` automatically adapts. Never hardcode `#FFAA00` directly in component CSS; always reference the token.

### Color blindness considerations

Deuteranopia (red-green color blindness, approximately 8% of males): the primary amber/green differentiation can be ambiguous. This site mitigates by:

1. Never relying on color alone to convey state — instrument chips always include a text label or icon alongside the color indicator
2. Using shape differentiation: success states use a checkmark glyph, fault states use an X or triangle, caution uses a diamond
3. Tier-position as a secondary cue: in the severity ramp, the numerical level (1-5) is always displayed alongside the color indicator
4. WCAG 2.2 SC 1.4.1 (Use of Color) compliance is mandatory — run `axe-core` checks before every release

### Color system evolution (Year 2+)

As the site adds multi-language support and potentially regional editions, the color token system may need to accommodate cultural color meaning differences. Notes for Year 2 planning:

- In Indonesian engineering culture, red/green/amber for alarm states are consistent with the international IEC conventions used at PLN and large industrial sites — no adjustment needed for the severity ramp
- If the site ever produces content for a market where amber/yellow has a culturally negative connotation beyond "caution," the `--rz-accent-signal` token allows substitution without touching component CSS
- The token system was explicitly designed to support this kind of regional adaptation: by never hardcoding `#FFAA00` in component rules, a single token reassignment in a regional CSS override can retheme the entire accent system

For Year 2 Bahasa Indonesia localization specifically: the number formatting change (`Intl.NumberFormat('id-ID')`) is a JS concern, not a CSS concern. No color token changes are anticipated for the Indonesian language version.

### Color token versioning

When a color token value changes (not just a new token added), the change must be documented in Section 15 Decision Log with:
- The old hex value
- The new hex value
- The contrast ratio impact (before and after)
- Which components are affected
- The version in which the change ships

This prevents the gradual "color drift" that happens when tokens are adjusted without documentation — where the site ends up with slightly different shades across pages because different sessions adjusted the token independently.

---

## 6. Layout Patterns

### Grid system

The site uses a 12-column CSS Grid on desktop, 6-column on tablet, 1-column on mobile. This is NOT a Tailwind grid — it uses native CSS Grid with custom properties:

```css
.rz-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    column-gap: 24px;
    row-gap: 24px;
}

@media (max-width: 1024px) {
    .rz-grid { grid-template-columns: repeat(6, 1fr); }
}

@media (max-width: 768px) {
    .rz-grid { grid-template-columns: 1fr; }
}
```

The 12-column system allows 1/4, 1/3, 1/2, 2/3, and 3/4 width content without fractional arithmetic.

### Container widths

| Context | Max-width | Rationale |
|---------|-----------|-----------|
| Prose (articles) | 1320px outer, 70ch inner prose | WCAG SC 1.4.8 readability |
| Dashboard | 1680px | Wide data tables need room |
| Calculator | 1320px | 2-pane layout fits at this width |
| Full-bleed | 100% | SLD diagrams, map embeds |

### Whitespace scale

Based on a 4-pt baseline grid. The spacing scale follows a doubling pattern with an intermediate step:

```css
:root {
    --rz-space-1:    4px;
    --rz-space-2:    8px;
    --rz-space-3:   12px;
    --rz-space-4:   16px;
    --rz-space-6:   24px;
    --rz-space-8:   32px;
    --rz-space-10:  40px;
    --rz-space-12:  48px;
    --rz-space-16:  64px;
    --rz-space-24:  96px;
    --rz-space-32: 128px;
}
```

Section padding: `96px` vertical on desktop, `64px` on tablet, `48px` on mobile. This is generous but not extravagant — it gives sections clear boundary separation on large displays without wasting screen space on mobile.

### Bento layout (landing page timeline)

The 5-card bento timeline at `index.html` is a controlled exception zone where pastel border-left accents appear. Rules:

- Maximum 5 cards in the bento group
- Each card: one pastel `border-left` (4px, not full pastel fill)
- Pastel sequence: mint `#A7F3D0`, lavender `#C7D2FE`, peach `#FED7AA`, pink `#FBCFE8`, cream `#FDE68A`
- Card background: `--rz-bg-elevated` (dark slate) — not the pastel color
- This is the ONLY zone on the site where these pastels appear
- Rationale: A single deliberate softness zone in a hard-edged site creates visual relief without surrendering the overall aesthetic. The contrast between the hard instrument aesthetic and the soft timeline creates emphasis for the biographical content.

### Card pattern

```css
.rz-card {
    background: var(--rz-bg-elevated);
    border: 1px solid var(--rz-line-tier-2);   /* 1px hairline */
    border-radius: 4px;                          /* minimal rounding — NOT 12-16px */
    padding: var(--rz-space-6);
    transition: border-color 200ms ease;
}

.rz-card:hover {
    border-color: var(--rz-line-tier-1);
}

.rz-card.active {
    border-color: var(--rz-accent-signal);
    box-shadow: 0 0 0 1px var(--rz-accent-signal-bg);
}
```

Why 4px border-radius? It is industrial, not toy. A 12-16px radius says "consumer app." A 0px radius says "terminal." 4px says "precision machined panel component."

No `box-shadow` on the resting state. Cards on a dark background are delineated by their border, not their shadow. Shadow is for active/focus states only.

### Calculator layout pattern

```css
/* 2-pane calculator: inputs left, results right */
.calc-layout {
    display: grid;
    grid-template-columns: 380px 1fr;
    column-gap: var(--rz-space-6);
    align-items: start;
}

/* Sticky inputs pane on desktop */
.calc-inputs {
    position: sticky;
    top: var(--rz-space-6);
    max-height: calc(100vh - 120px);
    overflow-y: auto;
}

@media (max-width: 768px) {
    .calc-layout {
        grid-template-columns: 1fr;
    }
    .calc-inputs { position: static; max-height: none; }
}
```

Sticky inputs on desktop means the user can adjust inputs without scrolling back up — critical for calculators with 8+ result panels below the fold. On mobile, stacked single-pane with accordion-collapsible input sections.

### Tab strip pattern

```css
.rz-tabs {
    display: flex;
    border-bottom: 1px solid var(--rz-line-tier-2);
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
}

.rz-tab {
    padding: var(--rz-space-3) var(--rz-space-4);
    font-family: var(--rz-font-mono);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--rz-text-secondary);
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    transition: color 200ms ease, border-color 200ms ease;
    cursor: pointer;
}

.rz-tab:hover { color: var(--rz-text-primary); }

.rz-tab.active {
    color: var(--rz-accent-signal);
    border-bottom-color: var(--rz-accent-signal);
}
```

The 2px active tab indicator on the bottom border is an instrument panel convention — a small amber stripe below the active module label. It is identifiable at a glance without using a filled background tab (which would add visual weight to the navigation rather than the content below it).

### Data table pattern

```css
.rz-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--rz-font-mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
}

.rz-table th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--rz-text-muted);
    padding: var(--rz-space-2) var(--rz-space-3);
    border-bottom: 1px solid var(--rz-line-tier-1);
    text-align: right;
}

.rz-table th:first-child { text-align: left; }

.rz-table td {
    padding: var(--rz-space-2) var(--rz-space-3);
    border-bottom: 1px solid var(--rz-line-tier-3);
    color: var(--rz-text-primary);
    text-align: right;
    vertical-align: top;
}

.rz-table td:first-child { text-align: left; }
```

No zebra-stripe. Zebra-stripe is a compensation for insufficient whitespace between rows. Proper row padding (8-10px vertical) with hairline borders is more precise. Right-aligned figures in all numeric columns — ISO 31-0 convention for numeric tables, and a prerequisite for column-aligned comparison reading.

### Modal pattern

```css
.rz-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(10,14,26,0.80);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
}

.rz-modal {
    background: var(--rz-bg-overlay);
    border: 1px solid var(--rz-line-tier-1);
    border-radius: 4px;
    width: min(720px, 92vw);
    max-height: 90vh;
    overflow-y: auto;
    padding: var(--rz-space-8);
}

@media (max-width: 640px) {
    .rz-modal {
        width: 100%;
        height: 100%;
        max-height: 100vh;
        border-radius: 0;
        margin: 0;
    }
}
```

The `backdrop-filter: blur(14px)` on the overlay creates depth signal without applying glassmorphism to the modal card itself. The blur is on the dim layer (background context), not the foreground. This is the correct use: "what I am looking away from is receded," not "this foreground element is made of glass."

---

## 7. Kinetic Patterns

### Motion design principle

Every animation must answer the question: "what information does this motion carry?" If the answer is "none — it just looks dynamic," the animation does not belong here. Permissible reasons for motion:

1. **State signaling**: the element changed state (active, error, success)
2. **Spatial relationship**: the element entered or exited the layout (modal open, drawer slide)
3. **Data flow**: data is flowing through a path (SLD laser trace)
4. **Temporal indicator**: something is pending (loading state, processing)

### Animation duration guidelines

| Type | Duration | Easing |
|------|----------|--------|
| State change (color, border) | 150-200 ms | `ease-out` |
| Component enter (fade, slide) | 220-280 ms | `cubic-bezier(0.2, 0, 0, 1.0)` (decelerate) |
| Component exit | 180 ms | `cubic-bezier(0.4, 0, 1, 1)` (accelerate) |
| Scroll animation | 500 ms | `cubic-bezier(0.65, 0, 0.35, 1)` (ease-in-out) |
| SLD laser-flow loop | 2400-2800 ms | `linear` (per-tier value in voltage table) |
| Aurora mesh hero | 22000-28000 ms | `ease-in-out` (alternating, CSS-only) |
| Text entrance blur-fade | 220 ms | `ease-out` |

### Laser-flow animation (SLD / data-flow paths)

The laser-flow effect on SVG path elements conveys live data flow through a transmission or data network. Implementation:

```css
.sld-line-active {
    stroke-dasharray: 8 12;       /* 8px dash, 12px gap */
    animation: laser-flow 2.4s linear infinite;
}

.sld-line-150kv { animation-duration: 2.4s; }  /* High tier: faster */
.sld-line-70kv  { animation-duration: 3.2s; }
.sld-line-20kv  { animation-duration: 4.0s; }  /* Low tier: slower */

@keyframes laser-flow {
    from { stroke-dashoffset:   0; }
    to   { stroke-dashoffset: -80; }
}
```

Faster animation on higher-voltage tiers mirrors the intuition that higher-capacity transmission paths carry more energy per unit time. This is a functional semantic, not arbitrary speed variation.

### Particle motion along SLD lines (>=150 kV only)

A single SVG circle element with `<animateMotion>` follows the transmission line path. One particle per active >=150 kV line. No particles on distribution-voltage lines.

```svg
<circle r="2.5" fill="rgba(255,255,255,0.85)">
    <animateMotion dur="3.6s" repeatCount="indefinite">
        <mpath href="#line-500kv-01"/>
    </animateMotion>
</circle>
```

Single particle per line. White fill, 85% opacity. Radius 2.5px. No trails, no glow, no color variation. The particle says "this line is live and carrying flow" — no more than that.

### Pulsing alarm dots

Active alarm indicators use a 1Hz opacity sweep — not a scale pulse, because scale changes cause layout reflow risk and read as "notifications" rather than "alarms."

```css
.alarm-dot-active {
    animation: alarm-pulse 1s ease-in-out infinite;
}

@keyframes alarm-pulse {
    0%, 100% { opacity: 1.0; }
    50%       { opacity: 0.35; }
}
```

Resting (acknowledged) alarms: no animation, static color at 60% opacity. Use pulsing ONLY for unacknowledged active alarms.

### Text entrance

Hero heading entrance and section reveal animations:

```css
.rz-reveal {
    opacity: 0;
    filter: blur(8px);
    transform: translateY(8px);
    transition: opacity 220ms ease-out,
                filter  220ms ease-out,
                transform 220ms ease-out;
}

.rz-reveal.visible {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0);
}
```

The blur-fade combination gives a slight depth-of-field entrance without spring-bouncing or scale-overshoot. The 8px `translateY` is subtle enough not to read as "flying in from the bottom" — the element simply emerges. This pattern is borrowed from the Remotion `kinetic-text.tsx` component already in use for the intro video.

### Hover micro-interactions

Permitted hover effects on interactive elements:

| Element | Permitted hover effect | Not permitted |
|---------|----------------------|---------------|
| `.rz-card` | `border-color` transition to tier-1 | Scale, shadow stack |
| `.rz-btn` | `background` to dimmed variant | Glow, shadow |
| Navigation link | `color` to text-primary | Underline slide, background fill |
| Tab | `color` to text-primary | Border-bottom before active |
| Icon | `color` to accent | Scale, rotation (unless directional) |
| SLD node | `stroke` to accent | Scale, floating label |

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration:       0.01ms !important;
        animation-iteration-count: 1     !important;
        transition-duration:      0.01ms !important;
        scroll-behavior: auto           !important;
    }
}
```

This is a blanket override. No individual component is exempt. If an animation is essential to understanding the component (e.g., a loading indicator), replace it with a static state indicator when reduced motion is active.

### Loading states

Loading states require a visible indicator without relying on motion as the only signal:

```css
.rz-loading {
    position: relative;
    pointer-events: none;
    opacity: 0.6;
}

.rz-loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 40%,
        rgba(255,170,0,0.06) 50%,
        transparent 60%
    );
    background-size: 200% 100%;
    animation: rz-skeleton 1.6s linear infinite;
}

@keyframes rz-skeleton {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
    .rz-loading::after {
        animation: none;
        background: rgba(255,170,0,0.06);
    }
}
```

The skeleton shimmer is directional — left to right — which is intuitive as "content loading progressively." Under `prefers-reduced-motion`, it becomes a static amber tint, which still communicates "not yet loaded" without animation.

### Page transition policy

Page transitions are instant. No fade-in/fade-out overlays between pages. Reasons:
1. The site is zero-build static HTML — there is no JavaScript router managing navigation; every navigation is a full page load
2. Fade overlays on full page loads require complex coordination between the outgoing page's JS and the incoming page's JS — this is fragile in a static site architecture
3. Browser's native progress indicator (tab spinner) already communicates page loading state

The only transition-like effect on navigation is the `.rz-reveal` entrance animation (Section 7) on critical above-fold content, which provides a slight softened first-render appearance without requiring cross-page coordination.

### Aurora mesh hero — implementation intent

The aurora mesh on `index.html` is CSS-only multi-stop radial gradients drifting on alternating 22s + 28s loops. The implementation intent:

- Colors: mint + gold + violet + blue + pink at low opacity (max 0.12 on any individual stop)
- Movement: `transform: scale() translate()` on alternating timers; GPU-accelerated via `will-change: transform`
- The mesh must recede behind text, not compete with it — the text contrast ratio against the aurora background must still pass WCAG AA
- No more than 5 gradient layers active simultaneously — each additional layer multiplies compositing cost
- `prefers-reduced-motion`: all transforms stop; gradients become static

The aurora is a controlled exception to the "no ambient animation" rule. It is acceptable because: it is on the landing page only, it moves slowly enough to not be distracting (22-28s loops), it is the deliberate "welcome moment" before the user reaches the functional content below the fold, and it is purely CSS with no JS dependency.

---

## 8. Iconography

### Icon philosophy

Icons on this site are not decorations. They are shorthand labels for engineering concepts. This requires a different icon vocabulary than general-purpose UI libraries (Heroicons, Font Awesome) which skew toward software product UI patterns (notifications, shopping carts, social sharing).

The goal: an icon set where the electrical domain icons are drawn from IEC 60617 conventions, the process/mechanical domain from ISA-5.1 conventions, and the data/network domain from IEEE 802 diagram conventions. These are internationally standardized — a transformer symbol means transformer globally in any language.

### Stroke discipline

All icons: stroke-only, no filled shapes (except where the standard symbol requires fill, e.g., ANSI relay filled circle for the relay type indicator). Stroke weight: 1.5-1.75px at 24px canvas. This matches the site's line-weight discipline.

At 16px size: reduce to 1.25px stroke to prevent visual heaviness. At 32px+: 2px stroke maximum.

```css
.rz-icon {
    stroke-width: 1.5px;
    stroke: currentColor;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}
```

### Icon domain families

**Electrical domain** (IEC 60617 inspired):
- Transformer (two semicircles facing, with winding lines)
- Circuit breaker (box with diagonal slash — ANSI/IEC combined)
- Generator (circle with G or sine wave)
- Busbar (thick horizontal line with taps)
- Ground (descending horizontal lines with triangle point)
- Surge arrester (zigzag with ground)
- Current transformer (circle on line)
- Voltage transformer (two-winding symbol)
- Fuse (rectangle on line — IEC)

**Mechanical domain** (ISA-5.1 inspired):
- Pump (circle with triangle indicating flow direction)
- Valve (bowtie / butterfly symbol)
- Heat exchanger (parallel lines with crossing arrows)
- Chiller (hexagon or standard ISA shell)
- Fan / cooling tower (fan blade circle)
- Temperature sensor (circle with T)
- Pressure sensor (circle with P)

**Data / compute domain** (IEEE 802 / standards inspired):
- Server (rectangle with status LED slots)
- Rack (tall rectangle with unit markers)
- Switch / router (box with directional arrows)
- Fiber path (curve with sine wave indicator)
- PDU / power strip (rectangle with plug symbol)

**Business / analytical domain**:
- Cost / CapEx (minimalist building block stack)
- Risk / probability (triangle — universal risk symbol)
- Timeline / schedule (arrow on horizontal line with tick marks)
- Compliance / standard (shield with tick)
- Trend (line chart with directional arrow)

### Sources and tooling

Icon SVGs live in `assets/icons/`. Naming convention: `rz-{domain}-{element}.svg` (e.g., `rz-elec-transformer.svg`, `rz-mech-pump.svg`).

For components not yet custom-drawn: Lucide Icons is the acceptable fallback (consistent stroke width, open source, tree-shakeable). Avoid Font Awesome Solid. Use Font Awesome Thin (6.x) if Lucide coverage is insufficient.

### Icon sizing grid

Icons are drawn on a 24px canvas. The visual mass is concentrated in the inner 20px "safe zone," leaving 2px padding on each side. This ensures the stroke does not touch the bounding box when placed adjacent to text.

| Canvas size | Stroke width | Context |
|------------|-------------|---------|
| 16px | 1.25px | Dense data table row indicator |
| 20px | 1.5px | Form field suffix / prefix |
| 24px | 1.5-1.75px | Standard UI icon |
| 32px | 2.0px | Card header icon |
| 48px | 2.0px | Hero / section illustration icon |

Icons are NEVER rasterized into PNG. SVG only — inline for interactive icons (allows `currentColor` stroke), external `<img src>` for decorative icons that do not require color adaptation.

### Icon color rules

- Default: `stroke: currentColor` — icon inherits text color of parent
- Active state: `stroke: var(--rz-accent-signal)` — amber
- Error state: `stroke: var(--rz-accent-alert)` — fault red
- Success state: `stroke: var(--rz-accent-data)` — oscilloscope green
- Disabled: `opacity: 0.35`, `stroke: currentColor`
- Never use `fill` on domain-specific icons (electrical, mechanical) — filled icons reduce the IEC/ISA symbolic readability
- Exception: ANSI relay-type indicators use a small filled circle as part of the standard symbol notation

### Iconography anti-patterns

- No icon fonts (Font Awesome icon font, Material Icons font) — these load an entire font file for a subset of icons, cause text cursor flash on icon elements, and degrade accessibility when `aria-hidden` is missed
- No raster emoji substitutes — emoji rendering varies by OS; a `⚡` on macOS looks different from Android; IEC symbols are universal
- No outline-to-fill transition on hover — changing from stroke to fill on hover alters the visual weight of the symbol significantly and can confuse semantic meaning (especially for electrical symbols where filled vs. unfilled has standard meaning)
- No drop shadows on icons — consistent with the site-wide ban on decorative shadows

---

## 9. Component Library Map

### How to read this table

- **Current state**: what exists in production today
- **Design delta**: what needs to change to match this design system
- **Acceptance criteria**: specific testable conditions for a v2 pass to be considered complete

| Component | Location | Current state | Design delta | Acceptance criteria |
|-----------|----------|--------------|--------------|---------------------|
| **Navbar** | `js/rz-mobile-nav.js` + `styles.css` `.nav-menu` / `.nav-links` | Two navbar class patterns; hamburger injected by JS | Unify to single `.rz-navbar` component; ensure consistent `--rz-bg-base` background on scroll | Passes `audit-mobile-responsive.py` with hamburger; no horizontal overflow at 320px |
| **Hero (landing)** | `index.html` inline CSS | Aurora mesh CSS, Pixel Rise scroll cue, pastel bento | Ensure aurora uses only `--rz-bg-*` tokens; verify bento pastel zone is isolated | All rules in `styles-index.css`; passes 2-stylesheet architecture check |
| **Bento timeline** | `index.html` | 5 pastel-border-left cards | Confirm `border-left` uses CSS variable mapped to pastel list, not hardcoded hex | Each card `border-left` references a CSS variable; pastels appear ONLY in this component |
| **Calculator inputs** | Per-calc HTML | Input fields with per-page class prefixes | Standardize to `.rz-input`, `.rz-select`, `.rz-label` with `--rz-bg-inset` background | All input fields pass dark-mode contrast check; no per-page class prefix required for base style |
| **Calculator results** | Per-calc HTML | `.metric-box`, `.summary-kpi`, per-page variants | Map to `.rz-metric-chip` using `--rz-font-mono` for values, `--rz-text-muted` for labels | Value text uses tabular-nums; label uses 11px uppercase mono caption style |
| **Tab strip** | `spares-readiness-calculator.html` | Custom per-page tabs | Extract to `.rz-tabs` / `.rz-tab` shared pattern per Section 6 | Active tab: 2px signal-amber bottom border; hover: text-primary; mono 13px uppercase |
| **Tour wizard overlay** | `spares-readiness-calculator.html` | Custom inline JS + CSS | Adopt `.rz-modal` pattern for the overlay container; keep custom step logic | Overlay matches `.rz-modal` token system; passes keyboard navigation test |
| **PDF print template** | Per-calc `window.open()` strings | Inline CSS in JS string | Apply `--rz-font-sans`, `--rz-font-mono`; ensure `<\/script>` escaping | `audit-script-tags.py --strict` passes; PDF renders IBM Plex Sans if available |
| **SLD diagram** | `pln-java-grid.html` family | SVG with `rz-map.js` + `pln-tooltip.js` | Confirm voltage-tier colors match canonical table in Section 5 | Tier color tokens match Section 5 voltage table; laser-flow gated to >=150 kV |
| **Leaflet map** | `js/rz-map.js` | CARTO Dark tile layer | No change to tile layer; ensure tooltip uses `.rz-card` token system | Tooltip background = `--rz-bg-overlay`; tooltip text = `--rz-text-primary` |
| **Auth pill** | `auth.js` | Mint `#7DDDB4` user pill | Confirmed correct; mint maps to `--rz-accent-mint` | Auth pill background = `var(--rz-accent-mint-bg)`; text = `var(--rz-accent-mint)` |
| **Login modal** | `auth.js` + `AUTH_STANDARD.md` | Custom modal per AUTH_STANDARD | Adopt `.rz-modal` container; keep auth-specific inputs and logic | Passes `../standarization/AUTH_STANDARD.md` checklist; modal uses `.rz-modal` border/background |
| **Cookie banner** | `script.js` | Bottom-slide GDPR banner | Confirm `--rz-bg-elevated` background; signal amber for accept button | Never dims or blocks page content; dismiss in one click; no full-page overlay |
| **Skip-to-content** | `script.js` via `inject-skip-link.py` | Injected `<a class="skip-link">` | Focus indicator: 2px signal amber outline per Section 12 | Visible on first Tab keypress; links to `#main` anchor; contrast >=4.5:1 |
| **Version stamp** | `js/rz-version.js` + `script.js` | Footer version string via `RZ.injectVersionStamp()` | Ensure stamp uses `--rz-font-mono` + `--rz-text-muted` | Stamp renders JetBrains Mono; matches `v{major}.{minor}.{patch}` format |
| **Achievement badges** | `achievements.html` | Custom inline styles | Replace emoji-decorated style with instrument-card style: rectangular `.rz-card` + monospace label + unlock condition text | No emoji decorations; each badge shows criterion text; progress bar uses `--rz-accent-data` |
| **Marquee strip** | `index.html` | CSS animation marquee with edge masks | Confirm keywords use `--rz-font-mono` uppercase | Edge masks use `--rz-bg-base` for fade; text = `--rz-text-muted` |
| **Aurora mesh hero** | `index.html` inline CSS | Multi-stop radial CSS-only animation | Document token colors used; keep as-is | Passes `prefers-reduced-motion`; sustained scroll CPU usage <=5% |
| **Share buttons (floating)** | `styles.css` `.share-buttons` | Fixed column right: LinkedIn/X/WhatsApp/Instagram/Facebook | Confirm icon-only buttons have `aria-label`; ensure `.visible` class usage is consistent | 5 platforms only; icon-only with `aria-label`; collapses to bottom bar at 768px |
| **Bottom-bar share (mobile)** | `styles.css` `@media (max-width: 768px)` | Horizontal bar at page bottom | Confirm bar uses `--rz-bg-elevated` background | Bar does not overlap sticky calculator inputs; z-index documented |
| **Scroll cue (Pixel Rise)** | `index.html` `.scroll-explore-pixel` | Chevron bounce with caption | No change; confirm `prefers-reduced-motion` suppresses bounce | Static chevron on reduced-motion; accessible link target |
| **Article progress bar** | `script.js` | Top reading-progress stripe | Stripe color: `--rz-accent-signal` (amber) | Stripe height 2px; positioned above navbar; does not push content down |

---

## 10. Page Archetypes

### 10.1 Landing page (`index.html`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                              │
│ [Logo/Wordmark]        [nav links — Articles, Calculators, Tools]  │
│                        [Search Ctrl+K]  [Login]                     │
├─────────────────────────────────────────────────────────────────────┤
│ HERO ZONE                                        [Aurora mesh bg]  │
│                                                                     │
│  ┌───────────────────────────────────────────┐                      │
│  │  H1: 56-64px IBM Plex Sans 700            │                      │
│  │  Tagline: 16px body, 70ch max             │                      │
│  │  [Get Started CTA — signal amber btn]     │                      │
│  └───────────────────────────────────────────┘                      │
│                                                                     │
│  [Scroll cue — Pixel Rise chevron bounce]                           │
├─────────────────────────────────────────────────────────────────────┤
│ MARQUEE STRIP — engineering keywords            [Edge fade masks]  │
├─────────────────────────────────────────────────────────────────────┤
│ BENTO TIMELINE  ← pastel zone (ONLY here)                          │
│  ┌──────────────┬──────────────┬──────────────┐                    │
│  │ Card 1 [mint]│ Card 2 [lav] │ Card 3 [pch] │                    │
│  │ border-left  │ border-left  │ border-left  │                    │
│  │ Date label   │ Date label   │ Date label   │                    │
│  │ Title        │ Title        │ Title        │                    │
│  └──────────────┴──────┬───────┴──────────────┘                    │
│                  ┌─────┴──────────────────────┐                    │
│                  │ Card 4 [pink] Card 5 [crm]  │                    │
│                  └─────────────────────────────┘                    │
├─────────────────────────────────────────────────────────────────────┤
│ METRICS BAR — 3-4 KPI cards                                         │
│  ┌─────────────────┐┌─────────────────┐┌─────────────────┐         │
│  │ [JB Mono value] ││ [JB Mono value] ││ [JB Mono value] │         │
│  │ [IBM Sans label]││ [IBM Sans label]││ [IBM Sans label]│         │
│  └─────────────────┘└─────────────────┘└─────────────────┘         │
├─────────────────────────────────────────────────────────────────────┤
│ CONTACT / BIO                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ FOOTER — 2-3 columns, version stamp, legal                          │
└─────────────────────────────────────────────────────────────────────┘
  [SHARE BUTTONS — fixed right column, visible on scroll]
```

Zone specifications:
- Hero: aurora mesh CSS background (`styles-index.css`); no autoplay video; intro video gates behind CTA click
- Marquee: `--rz-font-mono` uppercase, `--rz-text-muted` color, 60s loop
- Bento: 5 cards maximum; pastel `border-left` only; dark card background
- Metrics bar: JetBrains Mono values, IBM Plex Sans labels, no icons
- Contact: No GitHub URL visible; social links via icon-only buttons with `aria-label`
- Footer: 3 columns max; version stamp bottom-right; `--rz-font-mono` 11px caption style

### 10.2 Calculator (`spares-readiness-calculator.html` archetype)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ TOP KPI BAR — summary metrics always visible                        │
│  [Metric 1] [Metric 2] [Metric 3] [Metric 4]   [Save] [Share URL] │
├─────────────────────────────────────────────────────────────────────┤
│ SCENARIO BUTTONS                                                    │
│  [Default] [Scenario A] [Scenario B] [+ New]                       │
├─────────────────────────────────────────────────────────────────────┤
│ TAB STRIP — module navigation                                       │
│  [Tab 1] [Tab 2] [Tab 3] ... [Tab N]     1px bottom border         │
│           2px signal-amber active underline ^                      │
├───────────────────────────────┬────────────────────────────────────┤
│ INPUTS PANE (sticky, 380px)   │ RESULTS PANE (flex, 1fr)           │
│                               │                                    │
│ [Section heading — mono]      │ [Chart — SVG, full-width]          │
│ ┌─────────────────────────┐   │                                    │
│ │ Label         [input]   │   │ [KPI chips row]                    │
│ │ [11px mono caption]     │   │  ┌──────────┐┌──────────┐         │
│ └─────────────────────────┘   │  │ VALUE    ││ VALUE    │         │
│                               │  │ label    ││ label    │         │
│ [Section heading]             │  └──────────┘└──────────┘         │
│ ┌─────────────────────────┐   │                                    │
│ │ Label     [select v]    │   │ [Data table — hairline rows]       │
│ └─────────────────────────┘   │                                    │
│                               │ [Methodology details — collapsed]  │
│ [? tooltip for each input]    │ [> Show calculation detail]        │
│                               │                                    │
│ [Reset module] [Manual PDF]   │ [Formula block — KaTeX]            │
└───────────────────────────────┴────────────────────────────────────┘
  [SHARE / PDF EXPORT — top-right corner of results pane]
```

Zone specifications:
- KPI bar: sticky at page top, below navbar; `--rz-bg-elevated` background
- Scenario buttons: `--rz-line-tier-2` border; active scenario: `--rz-accent-signal` border
- Tab strip: mono uppercase 13px; active tab 2px amber underline; horizontal scroll on overflow
- Inputs: `--rz-bg-inset` field background; `--rz-line-tier-3` border; `--rz-font-mono` for numeric inputs
- Results charts: SVG with `--rz-accent-signal` fills; `--rz-font-mono` axis labels
- Methodology block: collapsed by default; expandable via disclosure widget; no auto-expand

### 10.3 Article (`article-26.html` archetype)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                              │
│ [Reading progress bar — 2px signal amber at top of viewport]       │
├─────────────────────────────────────────────────────────────────────┤
│ HERO IMAGE — 1200px max, WebP quality 80                            │
│ [Category badge] [Series nav: prev | Series name | next]           │
│                                                                     │
│ H1 — article title — 56px max                                       │
│ Author / Date / Reading time — 11px mono metadata                  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────┬────────────────────────┐    │
│ │ ARTICLE BODY (70ch max)            │ TOC SIDEBAR (sticky)   │    │
│ │                                    │ [H2 links — auto]      │    │
│ │ Body text 16px/1.55                │ [Active: amber 2px L]  │    │
│ │                                    │                        │    │
│ │ ┌──────────────────────────────┐   │                        │    │
│ │ │ STAT CALLOUT                 │   │                        │    │
│ │ │ JB Mono large — key figure   │   │                        │    │
│ │ │ 3px left border signal amber │   │                        │    │
│ │ └──────────────────────────────┘   │                        │    │
│ │                                    │                        │    │
│ │ [Section divider — 1px hairline]   │                        │    │
│ │                                    │                        │    │
│ │ [Author bio — mono small]          │                        │    │
│ │ [Related articles — 3 cards max]   │                        │    │
│ └────────────────────────────────────┴────────────────────────┘    │
│ [Share buttons floating column — outside <article>]                 │
│ [Footer]                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

Zone specifications:
- Reading progress bar: 2px, `--rz-accent-signal`, fixed top, behind navbar z-index
- Hero: WebP, 1200px max-width, `aspect-ratio: 16/9`; `assets/{slug}-hero.webp`
- Article body: `max-width: 70ch`; `font-size: 16px`; `line-height: 1.55`
- Stat callouts: `border-left: 3px solid var(--rz-accent-signal)`, `padding-left: var(--rz-space-4)`, JetBrains Mono for the figure
- TOC sidebar: sticky, hidden below 1024px; active section indicator: 2px amber left border
- Author bio and related articles: inside `<article>` element
- Share column: outside `<article>`, inside body — per structural pattern in `CLAUDE.md`

### 10.4 Tool / Simulation (`datahallAI.html`, `dc-conventional.html` archetype)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BMS-STYLE HUD BAR — SCADA instrument style                          │
│  [Facility name]  [Status: NORMAL|CAUTION|FAULT]   [Timestamp]     │
│  [Tier classification]                             [JB Mono clock] │
├─────────────────────────────────────────────────────────────────────┤
│ TAB STRIP — module navigation (mono uppercase)                      │
│  [Overview] [Power] [Cooling] [Connectivity] [Sustainability] ...   │
├─────────────────────────────────────────────────────────────────────┤
│ MODULE PANE                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ MODULE HEADING — ANSI/IEC relay number + description        │   │
│  │ 11px mono uppercase                                         │   │
│  │  ┌──────────────────────────┬───────────────────────────┐   │   │
│  │  │ INSTRUMENT CHIP GRID     │ LIVE DATA PANEL           │   │   │
│  │  │                          │                           │   │   │
│  │  │ [Chip: label+value+unit] │ [Single-line data rows]   │   │   │
│  │  │ [Chip: label+value+unit] │ [JB Mono, right-aligned]  │   │   │
│  │  │ [Chip: severity ramp]    │ [1px hairline rows]        │   │   │
│  │  │                          │                           │   │   │
│  │  └──────────────────────────┴───────────────────────────┘   │   │
│  │  [SLD / topology SVG if applicable]                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

Zone specifications:
- HUD bar: `--rz-bg-elevated` background; status text uses severity ramp colors (Section 5)
- Module headings: 11px mono uppercase; optional ANSI relay number prefix (e.g., `87T — Transformer Differential`)
- Instrument chips: `--rz-bg-inset` background; `--rz-font-mono` for value; `--rz-text-muted` for label; `border-left` severity color
- Data panel: right-aligned figures, tabular-nums, hairline rows — no zebra-stripe
- NO `<section>` References block — per `feedback_simulation_pages_no_refs.md`

### 10.5 Grid Monitor (`pln-java-grid.html` family)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ PAGE TITLE BAR                                                      │
│  "PLN Java-Bali Transmission Grid" — province sub-page indicator    │
├───────────────────────────────────────────────────┬─────────────────┤
│                                                   │ SIDEBAR         │
│  SLD CANVAS (Leaflet, CARTO Dark tiles)           │                 │
│                                                   │ [Metadata:      │
│  [Transmission lines — tier-graded strokes]       │  node count     │
│  [Substations — ANSI symbol chips]                │  edge count     │
│  [Power plants — generator symbols]               │  voltage tiers] │
│                                                   │                 │
│  [Laser-flow on >=150 kV active lines]            │ [Tier-grade     │
│  [Labels: OFF default — tooltip on hover only]    │  legend]        │
│                                                   │                 │
│  Inferred edges: opacity 0.35                     │ [Province       │
│                                                   │  filter]        │
└───────────────────────────────────────────────────┴─────────────────┘
```

Zone specifications:
- Canvas: 100% width, `calc(100vh - navbar-height)` height; Leaflet with CARTO Dark
- Tier-graded strokes: exact values from Section 5 voltage-tier table
- Laser-flow: gated to >=150 kV; `stroke-dasharray` animation per Section 7
- Labels: `display: none` default; render ONLY in Leaflet tooltip hover state
- Inferred edges: `[data-source^="inferred"]` selector, `opacity: 0.35`
- Sidebar: `--rz-bg-elevated`, 280px width, scrollable on small viewport heights

### 10.6 Slide-deck report (NEW archetype — not yet shipped)

For printable 16:9 presentation output. Triggered by `@media print` or a "Presentation mode" toggle. Content is authored as standard HTML; the print stylesheet reflows it into slide format.

```
┌──────────────────────────────────────────────┐
│  COVER SLIDE (16:9 = 1440 x 810px render)    │
│  ┌────────────────────────────────────────┐  │
│  │  [RZ wordmark — top left, 16px mono]   │  │
│  │                                        │  │
│  │  DECK TITLE                            │  │
│  │  64px IBM Plex Sans 700                │  │
│  │                                        │  │
│  │  Author . Date . Version               │  │
│  │  11px JB Mono                          │  │
│  │                                        │  │
│  │  [1px signal amber hairline bottom]    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  SECTION DIVIDER SLIDE                       │
│  ┌────────────────────────────────────────┐  │
│  │  [section number — 96px JB Mono muted] │  │
│  │                                        │  │
│  │  Section Title                         │  │
│  │  44px IBM Plex Sans 600                │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  CONTENT SLIDE — 4-zone grid                 │
│  ┌─────────────────────┬──────────────────┐  │
│  │  LEAD FIGURE        │  BODY TEXT       │  │
│  │  [JB Mono large]    │  [IBM Plex 15px] │  │
│  │  [unit / label]     │  [max 35ch]      │  │
│  ├─────────────────────┼──────────────────┤  │
│  │  DATA TABLE         │  CALLOUT         │  │
│  │  [hairline rows]    │  [1px amber L]   │  │
│  │  [mono figures]     │  [key insight]   │  │
│  └─────────────────────┴──────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  DATA VIZ SLIDE                              │
│  ┌────────────────────────────────────────┐  │
│  │  [Full-bleed SVG chart]                │  │
│  │                                        │  │
│  │  [Chart legend — mono 11px]            │  │
│  │                                        │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │ INSIGHT CALLOUT — amber border   │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  CLOSER SLIDE                                │
│  ┌────────────────────────────────────────┐  │
│  │  resistancezero.com                    │  │
│  │  [Contact — email or social]           │  │
│  │  [Version stamp]  [License]            │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Print stylesheet spec:

```css
@media print {
    @page {
        size: 1440px 810px;   /* 16:9 */
        margin: 0;
    }

    .slide {
        page-break-after: always;
        width: 1440px; height: 810px;
        overflow: hidden;
        padding: 80px;
        background: var(--rz-bg-base);
        color: var(--rz-text-primary);
    }

    .slide-header,
    .slide-footer {
        position: absolute;
        font-family: var(--rz-font-mono);
        font-size: 11px;
        color: var(--rz-text-muted);
    }

    .slide-header { top: 24px; left: 80px; right: 80px; }
    .slide-footer { bottom: 24px; left: 80px; right: 80px;
                    display: flex; justify-content: space-between; }
}
```

### 10.7 Achievements page (`achievements.html`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ PROGRESS OVERVIEW                                                   │
│  [Unlocked N / Total M]                                             │
│  [Progress bar — 1px track, --rz-accent-data fill]                 │
│  [Category counts: Electrical N | Mechanical N | Data N | ...]     │
├─────────────────────────────────────────────────────────────────────┤
│ BADGE CATEGORIES — tab strip                                        │
│  [All] [Electrical] [Mechanical] [Data] [Safety] [Process]          │
├─────────────────────────────────────────────────────────────────────┤
│ BADGE GRID — per category                                           │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ .rz-card    │ │ .rz-card    │ │ .rz-card    │ │ ...         │  │
│  │ [Icon 24px  │ │ [LOCKED:    │ │ [Icon 24px] │ │             │  │
│  │  stroke]    │ │  grayscale] │ │             │ │             │  │
│  │ Badge name  │ │ Badge name  │ │ Badge name  │ │             │  │
│  │ [criterion] │ │ [criterion] │ │ [criterion] │ │             │  │
│  │ [JB Mono    │ │ [JB Mono    │ │ [JB Mono    │ │             │  │
│  │  date]      │ │  ???]       │ │  date]      │ │             │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ [Link: See calculator FAQ for how achievements are earned]          │
└─────────────────────────────────────────────────────────────────────┘
```

Zone specifications:
- Progress bar: 1px track (`--rz-line-tier-3`), `--rz-accent-data` fill
- Badges: `.rz-card` 4px border-radius, 1px hairline border
- Locked badges: `filter: grayscale(1)`, `opacity: 0.40`
- No emoji decorations — use stroke icons from the iconography system
- Unlock criterion text: 11px JB Mono, `--rz-text-muted`
- Earned date: 11px JB Mono, `--rz-text-secondary`

---

## 11. PDF Export Design

The PDF export system is documented tactically in `../standarization/PDF_EXPORT_STANDARD.md`. This section establishes the design intent that the tactical standard implements.

### Design principle

A PDF generated by this site must be recognizable as belonging to the same system as the web page it came from. That means: IBM Plex Sans headings, JetBrains Mono data, appropriate ink usage (light mode for print), and the same information hierarchy. It must not look like a browser print with unstyled text and broken layout.

### Cover sheet

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  resistancezero.com                                      │
│  [RZ wordmark or text logo — 16px mono]                  │
│                                                          │
│  ─────────────────────────────────────────              │
│  DOCUMENT TITLE                                          │
│  32px IBM Plex Sans 700                                  │
│  ─────────────────────────────────────────              │
│                                                          │
│  Author: Bagus Dwi Permana                               │
│  Date: [ISO 8601 — YYYY-MM-DD]                           │
│  Version: v{major}.{minor}.{patch}                       │
│  License: CC BY-NC 4.0                                   │
│                                                          │
│  [Page number: 1]                                        │
└──────────────────────────────────────────────────────────┘
```

### Page template

- **Header**: RZ wordmark (10px mono, top-left) + page title (10px mono, top-center) + page number (top-right, right-aligned)
- **Footer**: `(c) {year} Bagus Dwi Permana — resistancezero.com` + license + date of export
- **Body font**: IBM Plex Sans 11pt
- **Data font**: JetBrains Mono 10pt
- **Margins**: 20mm top/bottom, 24mm left/right (standard A4 portrait)
- **Line spacing**: 1.45 for body, 1.25 for data tables

### Table of contents

Auto-generated from H2 anchors. Format:

```
  TABLE OF CONTENTS

  1. Section Title ............ 3
  2. Section Title ............ 7
  3. Section Title ............ 12
```

Dot leaders via CSS `content: ''` / `after` trick in print stylesheet. JetBrains Mono for the dots and page numbers.

### Section dividers

Full-bleed slate background with section number (48px mono, muted) and section name (24px IBM Plex Sans 600). This creates visual chapters in long calculator exports.

### Charts

SVG only — never `<canvas>` raster captures. All Chart.js-rendered charts must export as SVG or be replaced with D3/hand-drawn SVG equivalents before they appear in PDF. Raster screenshots at 1x produce blurry output at 300 DPI print resolution. SVG is infinitely scalable and supports text selection.

### Data tables in PDF

```
  | Parameter          | Value    | Unit   | Source        |
  |--------------------|----------|--------|---------------|
  | IT Load            | 2.40     | MW     | User input    |
  | PUE                | 1.38     |        | Calculated    |
  | Annual Energy      | 28,944   | MWh    | Calculated    |
```

Rules: hairline borders, right-aligned numeric columns, JetBrains Mono, 10pt. Units column separated from value column. Source column mandatory for exported reports.

### Formulas

KaTeX renders to HTML+CSS that prints cleanly. IBM Plex Math as fallback. Block equations on their own line with 4mm vertical margin. Inline equations in running text.

### Code / algorithm blocks

```
  ┌─────────────────────────────────────────────────────────┐
  │  1  PUE = Total Facility Power / IT Equipment Power     │
  │  2  AFUE = (1 - PUE) x 100%                            │
  │  3  Annual kWh = IT_Load_MW x 1000 x 8760 x PUE        │
  └─────────────────────────────────────────────────────────┘
```

1px border, JetBrains Mono 10pt, line numbers in muted color, 4mm padding.

### References

Numbered list, hanging 3em indent, JetBrains Mono for the reference key tokens:

```
  REFERENCES

  [1]  ASHRAE TC 9.9. (2021). Thermal Guidelines for Data
       Processing Environments, 5th ed. Atlanta: ASHRAE.

  [2]  Uptime Institute. (2023). Tier Standards Topology.
       New York: Uptime Institute LLC.
```

---

## 12. Accessibility

### Target standard

WCAG 2.2 Level AA minimum. This is not a stretch goal — it is a floor. The site carries technical content that professionals may need to access with assistive technology.

### Contrast requirements

| Context | Minimum ratio | Target |
|---------|--------------|--------|
| Normal text (>=18px) | 4.5:1 | 7:1 |
| Large text (<18px bold) | 3:1 | 4.5:1 |
| UI components | 3:1 | 4.5:1 |
| Active tab indicator | 3:1 | 4.5:1 |

Run `axe-core` browser extension check before every MINOR version release. All tokens in Section 5 were designed to meet AA on `--rz-bg-base`.

### Focus indicators

```css
:focus-visible {
    outline: 2px solid var(--rz-accent-signal);   /* signal amber */
    outline-offset: 2px;
    border-radius: 2px;
}
```

2px signal amber at 2px offset gives a 3px combined visual outline against the dark background. WCAG 2.2 SC 2.4.11 (Focus Appearance) requires minimum 2px perimeter and 3:1 contrast change — this satisfies both. Do NOT use `outline: none` anywhere without providing an equivalent visible focus state.

### Skip-to-content

Every page has `<a class="skip-link" href="#main">Skip to content</a>` injected by `inject-skip-link.py`. The link is visually hidden until focused, then slides in from the top with signal amber background. Keyboard users can skip repetitive navigation on every page load.

### ARIA roles

Mandatory ARIA on interactive components:

| Component | Role / Attribute |
|-----------|-----------------|
| Tab strip | `role="tablist"`, each tab `role="tab"`, `aria-selected`, `aria-controls` |
| Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to modal title |
| Accordion | `role="button"`, `aria-expanded`, `aria-controls` |
| Icon-only buttons | `aria-label` with descriptive text |
| Share buttons | `aria-label="Share on {Platform}"` |
| Search box | `role="combobox"`, `aria-expanded`, `aria-autocomplete` |
| Alert chips | `role="alert"` for fault states, `role="status"` for informational |
| Progress bar | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |

### Screen reader notes

- All charts have `aria-label` or `<figcaption>` with a text summary of the data displayed
- Data tables have `<caption>` and `scope="col"` on all header cells
- SVG elements that carry informational content have `<title>` and `<desc>` child elements
- Decorative SVGs (lines, backgrounds) have `aria-hidden="true"`

### `prefers-reduced-motion`

Covered in Section 7. Treat as mandatory accessibility requirement, not an optional consideration. WCAG 2.2 SC 2.3.3 (Animation from Interactions) at Level AAA; SC 2.3.1 at AA covers the seizure risk subset. The blanket override in Section 7 ensures compliance.

### Keyboard navigation

- Tab order must follow visual reading order (top-to-bottom, left-to-right)
- All interactive elements reachable by Tab (no div/span click handlers without `tabindex="0"` and `role`)
- Modal: focus trap while open; focus returns to trigger element on close
- Tab strip: arrow-key navigation between tabs (ARIA authoring practices pattern)
- Dropdowns: Escape closes; Enter/Space opens

---

## 13. Mobile-First Responsiveness

Reference `../standarization/RESPONSIVE_STANDARD.md` for tactical implementation. This section defines the design intent.

### Breakpoints

| Breakpoint | Viewport | Context |
|-----------|----------|---------|
| xs | 320px | Smallest Android / iPhone SE |
| sm | 375px | iPhone 12/13/14 standard |
| md | 414px | iPhone Plus / large Android |
| lg | 768px | iPad portrait / tablet |
| xl | 1024px | iPad landscape / small laptop |
| 2xl | 1280px | Standard laptop |
| 3xl | 1680px | Wide desktop / external monitor |

Design for 375px and 1280px first. All other breakpoints are adjustments, not redesigns.

### Mobile layout principles

Calculator pages on mobile: single-pane stacked. Input sections are accordion-collapsible with a summary chip showing the current input value — so users can review inputs without expanding the full section. Results panels are full-width below the stacked inputs.

Navigation: hamburger drawer via `js/rz-mobile-nav.js`. The drawer slides from the right, covers full viewport height, and uses `body.rz-nav-open { overflow: hidden }` to prevent background scroll while open. Swipe-to-close is supported via touch event listeners.

Tables on mobile: `overflow-x: auto` with `white-space: nowrap` on `<td>` cells. Sticky first column (`position: sticky; left: 0`) so the row label is always visible during horizontal scroll.

### Touch target sizing

All tap targets minimum 44x44px per Apple HIG and WCAG 2.5.5. This applies to:
- Tab strip tabs (increase padding, not font size)
- Share buttons (icon-only: 44px minimum)
- Input fields (at least 44px height)
- Buttons inside calculator panes

The mobile bottom-bar share buttons are 48px height on mobile to accommodate thumb-zone reach.

### Performance on mobile

Calculator pages above 1000 lines must lazy-load non-critical tab content. Only the active tab's computation runs on initial load. Switching tabs triggers computation for that tab, cached in memory. This follows the picker pattern established in `game.js` (`renderPartyGrid` / `renderTrainerTabs` as canonical reference — see Dunia Emosi project notes).

Charts are deferred on mobile below 768px unless the tab containing the chart is active — `IntersectionObserver` triggers chart initialization when the chart container enters the viewport.

### Mobile navigation drawer specification

The hamburger drawer injected by `js/rz-mobile-nav.js` follows these design rules:

- Slides from the right; width 280px on phones, 320px on tablets (>414px)
- Background: `--rz-bg-overlay` — visually distinct from page background
- Navigation links: IBM Plex Sans 16px, 48px min-height per link (touch target)
- Active page link: `color: var(--rz-accent-signal)` + `border-left: 2px solid var(--rz-accent-signal)`
- Close mechanism: X button (top-right of drawer) + tap-outside-to-close + Escape key
- When drawer is open: `body.rz-nav-open { overflow: hidden }` prevents scroll-behind
- Drawer overlay: semi-transparent `rgba(10,14,26,0.60)` behind the drawer panel
- The hamburger button itself: 44x44px, top-right corner of navbar, 3 horizontal lines at 1.5px stroke

The hamburger button is always present at <1024px viewport. It is never hidden or removed by page-specific CSS. If a page adds `display: none` to the navbar at mobile widths, the hamburger script will not have a container to inject into — verify `.navbar` element is present at all breakpoints.

### Scrollbar styling

Scrollbars on overflow containers follow the dark theme:

```css
/* Webkit (Chrome, Safari, Edge) */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--rz-bg-inset); }
::-webkit-scrollbar-thumb {
    background: var(--rz-line-tier-1);
    border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: var(--rz-line-accent); }

/* Firefox */
* { scrollbar-width: thin; scrollbar-color: var(--rz-line-tier-1) var(--rz-bg-inset); }
```

Thin 6px scrollbars preserve the precision aesthetic. The amber thumb on hover is consistent with the accent color system. Tab strips with horizontal scroll use `scrollbar-width: none` (hidden scrollbar) because the swipe gesture is sufficient and a horizontal scrollbar at 6px height disrupts the 1px tab strip border alignment.

### Viewport units and safe areas

For pages with fixed bottom bars (mobile share bar, cookie banner), always account for the iOS Safari home-indicator safe area:

```css
.rz-bottom-bar {
    padding-bottom: max(var(--rz-space-3), env(safe-area-inset-bottom));
}
```

The `env(safe-area-inset-bottom)` adds padding for the iPhone home indicator (typically 20-34px). Without it, content is hidden behind the system UI on notched devices.

For full-viewport modals at <640px:

```css
@media (max-width: 640px) {
    .rz-modal {
        padding-top: max(var(--rz-space-8), env(safe-area-inset-top));
        padding-bottom: max(var(--rz-space-8), env(safe-area-inset-bottom));
    }
}
```

---

## 14. 5-Year Roadmap

### Year 1: Foundation (2026 — current)

**Theme**: Establish the brand, stabilize the platform, make the calculators production-grade.

Design deliverables:
- This design system manifest completed and published (2026-05-13 — this document)
- Full token system applied to all calc pages (remove per-page class prefix inconsistencies per Appendix E)
- Icon library v1: electrical, mechanical, data domains, 40+ SVG icons in `assets/icons/`
- Component library v1: `.rz-card`, `.rz-btn`, `.rz-tabs`, `.rz-metric-chip`, `.rz-table` extracted to shared CSS
- Slide-deck archetype (Section 10.6) built and tested on 2 existing reports
- Achievement badge redesign: instrument-card style, no emoji
- All 5 calc pages pass dark-mode audit (>=30 dark rules per calc; reference: `tco-calculator.html` at 49 rules)
- PLN grid monitor: confirm all 5 pages use canonical voltage-tier color table from Section 5

What "full token system applied" means in practice for calc pages:
1. Identify all per-page CSS class prefixes (`.opex-input`, `.capex-input`, etc. — see Appendix E migration table)
2. For each page, audit every background color, border color, and text color that uses a hardcoded hex value
3. Replace with the correct `var(--rz-*)` token
4. Verify the `[data-theme="dark"]` block uses the same tokens — no shadow copies of hex values in dark overrides
5. Run `axe-core` contrast check in both light and dark mode
6. Run `audit-mobile-responsive.py` to confirm no regressions

Content milestones:
- Article 27 (Tax Break Reckoning) published
- Future Forward series completed (FF-4, FF-5)
- 5 new calculators in production

Brand-equity targets:
- Site indexed by Bing/Google for 50+ engineering-specific queries
- Referenced in at least 1 DC industry forum or community thread
- Design system document visible and citable (this file committed to public repo)

Design success criteria for Year 1 completion:
- Any page on the site passes the "design quality gate" test from Section 2 (could not be mistaken for a SaaS marketing page)
- All 5 primary calc pages use the `.rz-*` token system exclusively
- Icon library v1 covers 100% of domain symbols currently used in text or emoji form
- The slide-deck archetype produces a PDF that is visually consistent with the web UI

### Year 2: Expansion (2027)

**Theme**: 10 new analytical engines, multi-language, embeddable widget foundations.

Design deliverables:
- Component library v2: full documentation site at `resistancezero.com/design/` (static HTML, no build step)
- Bahasa Indonesia language toggle — all articles and calculator labels translated
  - Type system remains unchanged; translation is content, not layout
  - Number formatting: Bahasa uses `.` thousands separator and `,` decimal — enforce with `Intl.NumberFormat('id-ID')`
- Dark mode coverage 100%: every page, every component
- Icon library v2: process/automation domain (ISA-5.1 set) + ANSI relay numbering icons
- Print/PDF system v2: auto-generated cover sheet via `tools/build-pdf-cover.py`

Technical milestones:
- 10 new calculators: WUE, TCO-cloud-comparison, generator-sizing, UPS-runtime, cable-sizing, harmonic-distortion, transformer-loading, CRAC-capacity, containment-efficiency, battery-CAPEX
- `rz-engine.min.js` shared computation library covers all calculator domains
- Lighthouse >=90 across all pages
- `Intl.NumberFormat('id-ID')` number formatting active on Bahasa Indonesia toggle
- SEO: sitemap.xml expanded to 150+ URLs; llms.txt updated to reflect new calculators and articles

Design notes for Year 2 expansion:
- As new calculators are added, resist the temptation to add unique visual identities to each. The token system absorbs new calculators without design cost — each new calculator uses the same `.rz-card`, `.rz-tabs`, `.rz-metric-chip` components. Visual variety between calculators is NOT a goal; consistency is.
- The Bahasa Indonesia language toggle must not change any visual token, layout structure, or component class. It is a content translation, not a redesign.
- Component library v2 documentation site should itself use the design system — not a documentation tool like Storybook or Notion. A single `design/index.html` with inline component demos is sufficient and consistent with the zero-build architecture.

Brand-equity targets:
- First academic citation by any university DC/energy research paper
- Mentioned in at least 1 international DC industry publication (DCD, DC Dynamics, Data Centre Alliance)

### Year 3: Platform (2028)

**Theme**: Embeddable widgets for third-party sites, API access for verified users.

Design deliverables:
- Embeddable widget design system: each calculator publishable as a self-contained iframe widget, 360px minimum width
  - Widget has its own token subset: lighter background (`#1c2333` not `#0a0e1a`), no navbar, no footer
  - Attribution link: small RZ wordmark in widget footer, links back to full calculator
- API documentation page archetype: technical reference style using RZ token system
- Dark/light forced widget variant (embeds inherit host page theme via `postMessage`)

Technical milestones:
- Public API v1: read access to calculator models, JSON response, rate-limited
- Supabase-backed user accounts for saving calculation scenarios across sessions

Brand-equity targets:
- 3+ external sites embed an RZ calculator widget
- 500+ registered accounts

### Year 4: Community (2029)

**Theme**: Open-data contributions, peer-reviewed model library.

Design deliverables:
- Contribution portal: form-based submission for new calculator parameters (benchmark data, country-specific energy costs, OEM equipment data)
  - Design: modal flow with step progress indicator, validation feedback, submission confirmation
- Peer review indicator: "Model reviewed by N engineers" badge on calculator pages — instrument-card style, mono text, no social-media aesthetics
- Open data catalog page archetype: filterable, sortable, downloadable dataset listing

Technical milestones:
- 20+ crowd-sourced data sets integrated
- Calculator model versioning: users can reference specific model versions by number

Brand-equity targets:
- 50+ contributors
- Data sets cited in at least 5 engineering studies

### Year 5: Authority (2030-2031)

**Theme**: Referenced in standards bodies, academic citations, recognized as primary technical resource.

Design deliverables:
- Print edition design: long-form technical reports formatted as 150+ page PDFs, cobranded with any standards-body partnerships
- White-label calc engine: other organizations deploy an RZ calculator under their branding (token-swap system, no HTML changes)

Technical milestones:
- API v2: write access for authorized institutions
- Machine-readable standards references: calculators link directly to ASHRAE, Uptime, IEC clause numbers via Linked Data

Brand-equity targets:
- Referenced in at least 1 ASHRAE, IEEE, or Uptime publication or white paper
- Cited in 10+ academic papers

---

## 15. Decision Log

This is an append-only record of design decisions made for resistancezero.com, with rationale and alternatives considered.

| Date | Decision | Rationale | Alternative considered | Status |
|------|----------|-----------|----------------------|--------|
| 2026-05-13 | IBM Plex Sans selected as primary typeface | Engineering document character, wider aperture than Inter, not associated with "default SaaS." IBM provenance is appropriate for infrastructure/enterprise domain. | Inter (too generic SaaS), Plus Jakarta Sans (too friendly), Source Sans (too neutral) | Confirmed |
| 2026-05-13 | JetBrains Mono for all numerics and code | Slashed zero (0/O ambiguity unacceptable in engineering), tabular figures (column alignment), optimal x-height at 11-13px for caption use. | Fira Code (no tabular figures in free weights), Cascadia Code (Windows-native feel), Source Code Pro (weaker instrument-panel character) | Confirmed |
| 2026-05-13 | Signal amber `#FFAA00` as primary accent | IEC 61511 / ISA-18.2 caution state color. Sufficient contrast on `#0a0e1a` (7.2:1, WCAG AAA). Warm attention color without alarm register. | Tailwind amber-400 `#FBBF24` (too warm/orange), yellow `#FACC15` (too cheerful), default purple (Anthropic-associated, explicitly rejected). | Confirmed |
| 2026-05-13 | Deep slate `#0a0e1a` as background base | SCADA console dark background convention. Not pure black (avoids void-absence reading). Dark enough for WCAG AAA contrast against all accent colors. | Tailwind slate-900 `#0f172a` (too blue-tinted for neutral instrument feel), pure `#000000` (too void-like), `#111827` (too light for instrument aesthetic) | Confirmed |
| 2026-05-13 | No Tailwind palette — custom token system | Tailwind palette is widely used and immediately recognizable. Any site using it loses visual distinctiveness. Custom tokens enforce intentional color decisions. | Adopting Tailwind with overrides (mixing custom and Tailwind creates maintenance burden; Tailwind class names bleed through components) | Confirmed |
| 2026-05-13 | Anti-pattern list codified as enforcement gate | Design anti-patterns accumulate silently. Codifying them with rationale makes enforcement non-arbitrary — not "I don't like it" but "it fails this specific test." | Ad hoc rejection per session (inconsistent, context-dependent) | Active — add new entries when new patterns are rejected |
| 2026-05-13 | 4px border-radius on all cards | Industrial precision machined component aesthetic. Not toy (12-16px), not terminal (0px). 4px is the smallest meaningful rounding. | 8px (closer to SaaS default), 0px (too hard/terminal), 12px (too friendly) | Confirmed |
| 2026-05-13 | 5-voltage-tier color mapping preserved from PLN SLD | Already proven in production on PLN grid pages. Matches Indonesian PLN internal HMI conventions. Codified here to prevent regression. | Redesigning to a new palette would break continuity with established grid pages and require retraining the eye for the same content. | Confirmed |
| 2026-05-13 | Pastel bento colors restricted to ONE zone (landing page timeline only) | Controlled contrast zone for biographical content. Soft-in-hard creates emphasis. Pastels anywhere else break the instrument aesthetic. | Eliminating pastels entirely (removes the biographical contrast zone), or allowing pastels on article cards (dilutes technical register sitewide) | Confirmed |
| 2026-05-13 | PDF export using `window.print()` + print media query, not Puppeteer/wkhtmltopdf | Zero server dependency, works offline, no security surface from headless browser. Site is zero-build — server-side PDF generation contradicts architecture. | Puppeteer (requires Node server), wkhtmltopdf (unmaintained), jsPDF (poor layout fidelity for complex calc pages) | Confirmed |
| 2026-05-13 | Slide-deck archetype (Section 10.6) defined but not yet shipped | Identified as needed for long-form reports currently published as plain PDFs. Defining now prevents ad hoc implementation that ignores the token system. | Wait until demand requires it (risk: ad hoc implementation without design system adherence) | Pending implementation |
| 2026-07-14 | Violet `#8b5cf6` retained as the FINANCE-SUITE accent (`--fs-acc` in css/rz-finance-suite.css), scoped exception to the no-default-purple anti-pattern | The Finance Terminal + rz-ops shipped with this accent as their established identity; retiring it during unification would regress two daily-use surfaces for zero user benefit. Scoped to `html[data-rz-suite]` surfaces only — the main site keeps signal amber. White-on-`#8b5cf6` fails AA, so any white-text fill uses violet-700 `#6d28d9` (see FINANCE_SUITE_STANDARD.md). | Re-accent the suite to signal amber (regresses established surfaces; amber reads as caution-state inside data-dense finance UIs) | Confirmed — scoped |
| 2026-05-13 | `min-height: 44px` on all touch targets | Apple HIG and WCAG 2.5.5 minimum. Prevents tap-miss events on mobile. Enforced by `audit-mobile-responsive.py`. | 40px (WCAG 2.1 Advisory, not strict), 36px (common SaaS default — too small for engineering tools used in field) | Confirmed |
| 2026-05-13 | No zebra-stripe on data tables | Zebra-stripe compensates for insufficient row padding. Proper 8-10px vertical padding with hairline borders is more precise and cleaner at high data density. | Alternating background rows (valid but adds color noise at high table density) | Confirmed |
| 2026-05-13 | Laser-flow animation speed varies by voltage tier (faster = higher tier) | Intuitive semantic: higher voltage transmission carries more energy per unit time. Consistent with SCADA convention of higher-importance paths having more prominent visual treatment. | Uniform speed (misses the semantic opportunity), random speed (confusing) | Confirmed |
| 2026-05-13 | `backdrop-filter: blur(14px)` on modal overlay, NOT on modal card | The blur should apply to the receding background, not the foreground. Applying blur to the modal card is glassmorphism applied backwards — it makes the focal element look translucent. | Blur on modal card (glassmorphism — rejected), no blur at all (less depth signal) | Confirmed |
| 2026-05-13 | Thin scrollbars (6px) styled to match dark theme | System-default scrollbar in a dark UI appears as a bright chrome intrusion. 6px matches the precision aesthetic; amber on hover is consistent with the accent system. | System default (inconsistent with dark theme), hidden scrollbar everywhere (hides overflow affordance on desktop) | Confirmed |
| 2026-05-13 | Chart titles state the finding, not just the variable pair | "Annual Energy vs. PUE" describes axes only. "Higher PUE drives non-linear energy cost increase" communicates the analytical insight. The site's purpose is analysis, not raw data display. | Axis-pair titles (common in generic charting, easy to auto-generate, communicates nothing beyond variable names) | Confirmed |
| 2026-05-13 | Error messages cite specific valid range, no apologetic copy | "Value must be between 0.1 and 100 MW" gives actionable information. Engineers can act on specifics. | Friendly/apologetic copy (SaaS convention — wrong register for engineering tools) | Confirmed |
| 2026-05-13 | Icon SVG inline for interactive icons, `<img src>` for decorative | Inline SVG inherits `currentColor` enabling state-aware color changes without JS. `<img>` for decorative icons avoids bloating the DOM with unused SVG nodes. | All icons inline (DOM bloat for decorative), all icons as `<img>` (loses currentColor) | Confirmed |
| 2026-05-13 | `documentation/` folder created as sibling to `standarization/` | Strategic design intent (why) in `documentation/`; tactical implementation rules (how) in `standarization/`. Separation prevents standarization files from becoming philosophical documents. | Single flat file in root (hard to navigate), merge into standarization (blurs why/how boundary) | Confirmed |
| 2026-05-13 | Content strategy discipline codified in Section 1 | Brand voice must govern content structure (article openings, calculator copy, chart titles, error messages), not just visual aesthetics. Voice consistency reinforces brand authority. | Content strategy as informal convention (inconsistently applied across new pages added by different sessions) | Confirmed |
| 2026-05-13 | Color token versioning protocol added to Section 5 | Token values must not drift silently. Documenting before/after hex, contrast ratio impact, and affected components makes color changes auditable and reversible. | Informal token changes without documentation (causes per-page drift when different sessions adjust the same token independently) | Confirmed |
| 2026-05-13 | 6 appendices added to design.md (A through F) | Design system must be actionable, not just declarative. Checklists (Appendix A), token reference (B), standards citations (C), typographic specimens (D), naming conventions (E), and standarization relationship (F) make the strategic document operationally useful. | Separate operational docs (risk of drift from strategic intent) | Confirmed |
| 2026-06-01 | RZ Dark System v1 — two registers (instrument + editorial), HYBRID split locked (§16) | Old dark mode read as generic "AI-slop". Two registers of one token system give cockpits an oscilloscope-instrument character and content an editorial-refined character while sharing signal-semantics + motion + responsive rules. Animated-on-load + distinctive type + anti-slop checklist make the dark surface unmistakably RZ. | One character everywhere (loses the cockpit-vs-content distinction), keep generic dark (rejected by owner as slop) | Confirmed |

---

## 16. Dark Mode — RZ Dark System v1

> Added 2026-06-01. Full implementation reference: `css/rz-dark.css` + `standarization/DARK_MODE_STANDARD.md`. Live picker: `rz-style-lab.html`. Before/after gallery (12 surfaces): `rz-skin-gallery.html`.

### 16.1 Why this exists

The earlier dark mode read as generic "AI-slop": flat panels, static numbers, Inter/system type, rounded-everything, Anthropic-purple accents. Owner mandate (2026-05-26, ref raihankalla.id): the dark surface must feel **animated-on-load, distinctively typed, and intuitively responsive** — and unmistakably RZ.

### 16.2 Core principle — two registers, one token system

RZ has two page families. Each gets a **register** of the same system: identical structure, motion, and signal-semantics; different surface character. A page swaps register with a single attribute: `data-rz-register="instrument" | "editorial"`.

| Register | Character | Display font | Radius | Atmosphere | Used on |
|---|---|---|---|---|---|
| **Instrument** (`instrument`) | Oscilloscope — phosphor-green/cyan | JetBrains Mono | 3px | graticule grid + scanlines + radial glow | cockpits (datahallAI, dc-conventional, chiller/water/fire/EPMS/ict), SLD/P&ID labs, market monitors |
| **Editorial** (`editorial`) | Refined report | Fraunces (serif) | 10px | two calm radial washes, no grid | index, articles, hubs, plan landings, calculator marketing shells |

**Decision LOCKED 2026-06-01: HYBRID** — instrument for cockpits, editorial for content. Not one character everywhere.

### 16.3 Tokens

Shared signal semantics (match §5 + ACCURACY_VALIDATION + ALARM_STATE): `--rz-ok` green / `--rz-warn` amber / `--rz-fault` red / `--rz-info` cyan. **Status colour always wins over domain colour** (a faulted cooling pipe renders fault-red, not cooling-cyan — see ALARM_STATE `resolveColor()`).

```css
[data-rz-register="instrument"]{ --rz-bg:#060A0D; --rz-accent:#22F5A8; --rz-accent2:#2BE8FF;
  --rz-display:'JetBrains Mono'; --rz-radius:3px; }
[data-rz-register="editorial"]{ --rz-bg:#0E0F12; --rz-accent:#E8B563; --rz-accent2:#6FBF9A;
  --rz-display:'Fraunces'; --rz-radius:10px; }
```

### 16.4 Motion primitives (the "animated on load" requirement)

Vanilla `requestAnimationFrame`, cubic-ease, 1.3–1.5s, all honour `prefers-reduced-motion`. **Probe-safe rule for engine-bound KPIs: capture the exact original string and restore it verbatim at animation end, plus a `setTimeout` hard-settle** so a backgrounded tab never freezes a wrong basis value (lesson from v1.43.5).

| Primitive | Mechanism | Used for |
|---|---|---|
| trace-in | `stroke-dashoffset` L→0 + sweep dot | line / waveform |
| plot-in | path draw + area fade | schematic area |
| grow | bar height 0→full, staggered | bar readouts |
| count-up | rAF number interpolation + hard-settle | KPI values |
| sweep | donut `stroke-dasharray` arc | ratio / share |
| stagger reveal | `[data-enter]` + IntersectionObserver | section entrance |

### 16.5 Anti-slop checklist (every dark page must pass)

1. ❌ static numbers → ✓ count-up / trace-in on load
2. ❌ Inter/system character font → ✓ Plex + JetBrains + Fraunces
3. ❌ Anthropic-purple / Tailwind-default / blue→purple gradient → ✓ signal tokens
4. ❌ rounded-everything → ✓ 3px instrument / 10px editorial
5. ❌ flat dead panels → ✓ graticule (instrument) / calm wash (editorial)
6. ❌ glassmorphism / neumorphism / dot-grid noise / cursor-tilt
7. ❌ decorative motion with no meaning → ✓ motion encodes data/state or one orchestrated load reveal

### 16.6 Responsive

Switcher/nav → horizontal scroll strip < 760px; KPI strips 4→2→1 col; charts full-bleed (`viewBox` + `preserveAspectRatio`, never fixed-px); touch targets ≥ 44px; ≥7/10 on `audit-mobile-responsive.py`.

### 16.7 Adoption order

1. ✓ v1.43.5 — `#p-dash` count-up primitive (datahallAI), probe-safe.
2. ✓ v1.43.6 — editorial register on `plan-dark-mode-standard.html`.
3. ✓ v1.43.7 — full 12-surface before/after gallery + cockpit semantic-preservation mockup.
4. ⏳ cockpit instrument re-skin — apply atmosphere/type/panel-chrome ADDITIVELY; preserve semantic SLD feed-A/B + alarm colours; engine + `#p-dash` byte-identical; 75/75 accuracy probe must stay green. Show before/after mockup before any live edit.

---

## Appendix A: Design Implementation Checklist

Use this checklist when building a new page or component. Each item maps to a section in this document.

### A.1 New page checklist

**Structure:**
- [ ] Page has `<a class="skip-link" href="#main">Skip to content</a>` (injected by `inject-skip-link.py`)
- [ ] Page has `<main id="main">` wrapping primary content
- [ ] Page has `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- [ ] Page loads `js/rz-version.js` for version stamp
- [ ] Page loads `js/rz-mobile-nav.js` for hamburger drawer
- [ ] `index.html` loads `styles-index.min.css`; all other pages load `styles.min.css` — never mix

**Typography:**
- [ ] `--rz-font-sans` used for all heading and body text — no hardcoded `font-family: Arial` or `font-family: sans-serif`
- [ ] `--rz-font-mono` used for all numerical data, captions, metadata
- [ ] Heading scale follows CSS tokens (`--rz-text-h1` through `--rz-text-h4`)
- [ ] Prose containers have `max-width: 70ch`
- [ ] All data values use `font-variant-numeric: tabular-nums slashed-zero`

**Color:**
- [ ] No hardcoded hex values in CSS — all colors reference `var(--rz-*)` tokens
- [ ] Dark mode coverage: every hardcoded light background has a `[data-theme="dark"]` override
- [ ] Dark mode audit: `>=30` dark overrides on calc pages (reference: `tco-calculator.html` canonical)
- [ ] Light mode: all token overrides in `[data-theme="light"]` block, not inline styles
- [ ] `axe-core` contrast check passed (run in browser devtools before release)

**Borders and elevation:**
- [ ] Card borders use `--rz-line-tier-2` (resting) and `--rz-line-tier-1` (hover)
- [ ] No `border-width` value greater than 1.4px on any component border
- [ ] No `box-shadow` on resting card state
- [ ] Modal overlay uses `backdrop-filter: blur(14px)` on the dim layer, NOT on the modal card

**Motion:**
- [ ] `@media (prefers-reduced-motion: reduce)` blanket override present in page CSS
- [ ] No animations with `animation-iteration-count: infinite` outside of SLD laser-flow or aurora mesh
- [ ] State change transitions <= 200ms
- [ ] No spring/bounce animations on text or cards

**Accessibility:**
- [ ] All icon-only buttons have `aria-label`
- [ ] Tab strip has `role="tablist"`, each tab has `role="tab"` and `aria-selected`
- [ ] Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- [ ] All charts have `aria-label` or `<figcaption>` with text summary
- [ ] Focus indicator: `outline: 2px solid var(--rz-accent-signal); outline-offset: 2px`
- [ ] `prefers-reduced-motion` reduces all animation to 0.01ms

**Mobile:**
- [ ] Passes `tools/audit-mobile-responsive.py` with score >=7
- [ ] Hamburger script tag present: `<script src="js/rz-mobile-nav.js?v=..." defer>`
- [ ] No horizontal overflow at 320px viewport
- [ ] Touch targets minimum 44x44px
- [ ] Floating `.share-buttons` collapses to bottom bar at 768px

**Anti-pattern gate:**
- [ ] No dot-grid background on any element
- [ ] No `#8B5CF6` in any CSS or inline style
- [ ] No `box-shadow` with 4+ layers
- [ ] No cursor-tracking, spotlight, or 3D card tilt effects
- [ ] No gradient on primary action buttons
- [ ] No `backdrop-filter` on the foreground modal card (only on the overlay)
- [ ] Emoji not used in navigation, calc UI, or article body

**Versioning:**
- [ ] `js/rz-version.js` bumped (PATCH for bugs, MINOR for new pages)
- [ ] `CHANGELOG.md` entry appended
- [ ] `tools/build-changelog-html.py --apply` run to regenerate `/changelog.html`
- [ ] `audit-script-tags.py --strict` passes (no unescaped `</script>` in JS strings)

---

### A.2 New calculator module checklist

In addition to the new page checklist above:

- [ ] KPI bar at top shows at least 3 summary metrics before tab content
- [ ] Scenario save/load/share-URL pattern implemented
- [ ] Each tab's computation is independent and cached after first run
- [ ] Inputs pane sticky at `top: var(--rz-space-6)` on desktop
- [ ] Inputs pane position:static on mobile (<768px)
- [ ] Each input field has a `title` or tooltip `?` button with the parameter definition
- [ ] All numeric inputs use `type="number"` with `step` attribute matching precision
- [ ] All select dropdowns have a `<label for>` element
- [ ] PDF print template escapes `<\/script>` — run `audit-script-tags.py --strict`
- [ ] Methodology detail block collapses by default
- [ ] Charts are SVG (not canvas) if PDF export is required
- [ ] Results table has `scope="col"` on all `<th>` elements
- [ ] `role="progressbar"` with `aria-valuenow` on any progress indicators

---

### A.3 New article page checklist

In addition to the new page checklist above:

- [ ] Reading progress bar (`<div class="reading-progress">`) present in `<header>`
- [ ] Hero image: WebP quality 80, max 1200px width, `assets/{slug}-hero.webp`
- [ ] OG image: 1200x630px WebP, `assets/og/{slug}.webp`
- [ ] Article body inside `<article>` element
- [ ] Author bio inside `<article>`, AFTER the body
- [ ] Related articles inside `<article>`, AFTER author bio
- [ ] Share buttons floating column OUTSIDE `<article>`, inside `<body>`
- [ ] Footer OUTSIDE `<article>`
- [ ] Series navigation badge present (prev/next or standalone)
- [ ] TOC sidebar auto-generated from H2 anchors
- [ ] Stat callout blocks use `border-left: 3px solid var(--rz-accent-signal)` + `padding-left: var(--rz-space-4)`
- [ ] Glossary: 5+ terms added to `glossary.html` with backlinks to this article (per `feedback_glossary_workflow.md`)
- [ ] No `<section>` References block if the page is a simulation/tool (per `feedback_simulation_pages_no_refs.md`)

---

### A.4 SLD / grid monitor checklist

In addition to the new page checklist above:

- [ ] Tile layer: CARTO Dark — no substitution
- [ ] Voltage-tier stroke widths match Section 5 canonical table (500kV=1.6px through 20kV=0.6px)
- [ ] Voltage-tier colors match Section 5 canonical table
- [ ] Laser-flow animation present ONLY on lines with voltage >=150 kV
- [ ] Labels: `display: none` by default; tooltip-only on hover
- [ ] Inferred edges: `data-source^="inferred"` selector, `opacity: 0.35`
- [ ] Leaflet tooltip background = `--rz-bg-overlay`; text = `--rz-text-primary`
- [ ] Sidebar width 280px, `--rz-bg-elevated` background
- [ ] No decorative particle animations on lines below 150 kV

---

## Appendix B: CSS Token Reference

Complete alphabetical token listing for quick lookup. Grouped by function.

### Background tokens

```css
--rz-bg-base        /* #0a0e1a — Page background */
--rz-bg-elevated    /* #111827 — Card, panel surface */
--rz-bg-hover       /* #1a2035 — Row hover state */
--rz-bg-inset       /* #080c16 — Input, code block */
--rz-bg-overlay     /* #1c2333 — Modal, dropdown */
```

### Text tokens

```css
--rz-text-accent     /* #FFAA00 — Highlighted label */
--rz-text-code       /* #00FF88 — Inline code */
--rz-text-disabled   /* #3D4A5C — Disabled state */
--rz-text-inverse    /* #0a0e1a — On light backgrounds */
--rz-text-muted      /* #64748B — Captions, timestamps */
--rz-text-primary    /* #E8EDF5 — Main body text */
--rz-text-secondary  /* #A0AEC0 — Supporting text */
```

### Accent tokens

```css
--rz-accent-alert       /* #FF3030 — Fault / error */
--rz-accent-alert-bg    /* rgba(255,48,48,0.08) */
--rz-accent-alert-dim   /* #CC2020 */
--rz-accent-data        /* #00FF88 — Success / data */
--rz-accent-data-bg     /* rgba(0,255,136,0.07) */
--rz-accent-data-dim    /* #00CC6A */
--rz-accent-info        /* #00DDFF — Informational */
--rz-accent-info-bg     /* rgba(0,221,255,0.07) */
--rz-accent-info-dim    /* #00AACC */
--rz-accent-mint        /* #7DDDB4 — Auth pill */
--rz-accent-mint-bg     /* rgba(125,221,180,0.08) */
--rz-accent-signal      /* #FFAA00 — Primary / CTA */
--rz-accent-signal-bg   /* rgba(255,170,0,0.08) */
--rz-accent-signal-dim  /* #CC8800 */
```

### Line tokens

```css
--rz-line-accent   /* rgba(255,170,0,0.40)    — Amber line */
--rz-line-data     /* rgba(0,255,136,0.35)    — Data flow */
--rz-line-fault    /* rgba(255,48,48,0.40)    — Fault state */
--rz-line-tier-1   /* rgba(255,255,255,0.18)  — 1.4px primary */
--rz-line-tier-2   /* rgba(255,255,255,0.12)  — 1.0px component */
--rz-line-tier-3   /* rgba(255,255,255,0.07)  — 0.6px data field */
```

### Typography tokens

```css
--rz-font-math    /* 'IBM Plex Math', 'STIX Two Math', serif */
--rz-font-mono    /* 'JetBrains Mono', 'SF Mono', monospace */
--rz-font-sans    /* 'IBM Plex Sans', system-ui, sans-serif */

--rz-text-body      /* 16px */
--rz-text-caption   /* 11px */
--rz-text-data      /* 13px — instrument chip */
--rz-text-data-lg   /* 22px — KPI card value */
--rz-text-data-xl   /* 32px — hero metric */
--rz-text-h1        /* clamp(36px, 5vw, 64px) */
--rz-text-h2        /* clamp(26px, 3.5vw, 44px) */
--rz-text-h3        /* clamp(20px, 2.5vw, 28px) */
--rz-text-h4        /* clamp(16px, 1.8vw, 20px) */
--rz-text-small     /* 14px */
```

### Spacing tokens

```css
--rz-space-1    /*   4px */
--rz-space-2    /*   8px */
--rz-space-3    /*  12px */
--rz-space-4    /*  16px */
--rz-space-6    /*  24px */
--rz-space-8    /*  32px */
--rz-space-10   /*  40px */
--rz-space-12   /*  48px */
--rz-space-16   /*  64px */
--rz-space-24   /*  96px */
--rz-space-32   /* 128px */
```

---

## Appendix C: Standards Reference

This appendix lists the technical standards cited in this document. It is not exhaustive — it records only those standards that are direct influences on specific design decisions.

### Electrical and process standards

**IEC 60617** — Graphical Symbols for Diagrams
- Part 2: Symbol elements, qualifying symbols and other symbols having general application
- Part 6: Production and conversion of electrical energy
- Part 7: Switchgear, controlgear and protective devices
- Part 11: Architectural and topographical installation plans and diagrams
- Influence on this document: icon vocabulary for the electrical domain (Section 8); SLD topology conventions (Section 10.5)

**IEC 61511** — Functional Safety: Safety Instrumented Systems for the Process Industry
- Part 1: Framework, definitions, system, hardware and application programming requirements
- Influence: Color priority hierarchy for safety-related states — amber for condition requiring attention, red for action required immediately (Section 5)

**ISA-18.2** — Management of Alarm Systems for the Process Industries (equivalent to IEC 62682)
- Published by the International Society of Automation
- Influence: Alarm priority color coding in the 5-stop severity ramp (Section 5); prohibition on non-alarm pulsing animations (Section 7)

**ISA-5.1** — Instrumentation Symbols and Identification
- Published by the International Society of Automation
- Influence: P&ID icon vocabulary for the mechanical domain (Section 8)

**IEC 62682** — Management of Alarm Systems for the Process Industries
- Equivalent to ISA-18.2; referenced for the severity ramp (Section 5)

**ISO 31-0** — Quantities and Units — General Principles
- Influence: Right-aligned numeric columns in data tables; space as thousands separator in technical tables (Section 6)

### Data center standards

**ASHRAE TC 9.9** — Mission Critical Facilities, Technology Spaces, and Electronic Equipment
- Thermal Guidelines for Data Processing Environments (current edition: 5th, 2021)
- Influence: Referenced in calculator methodology pages; anchor for PUE, ASHRAE thermal envelope parameters

**Uptime Institute** — Tier Standards Topology, Operational Sustainability
- Influence: Tier I-IV classification labels in simulation pages; Tier IV 99.99943% availability figure

**TIA-942** — Telecommunications Infrastructure Standard for Data Centers
- Influence: Topology and redundancy classification labels used in DCMOC and tier-advisor pages

### Web and accessibility standards

**WCAG 2.2** — Web Content Accessibility Guidelines (W3C Recommendation 2023-10-05)
- SC 1.4.1 (Use of Color, Level A): Color must not be the only means of conveying information — enforced via shape + tier-position redundancy in the severity ramp
- SC 1.4.8 (Visual Presentation, Level AAA): Maximum 80 characters per line — implemented as 70ch max-width on prose containers
- SC 2.3.1 (Three Flashes, Level A): No component flashes more than 3 times per second
- SC 2.3.3 (Animation from Interactions, Level AAA): Honoured via `prefers-reduced-motion` blanket override
- SC 2.4.11 (Focus Appearance, Level AA): 2px minimum focus indicator perimeter, 3:1 contrast change — implemented via signal amber outline
- SC 2.5.5 (Target Size, Level AAA): 44px minimum touch target — enforced via `audit-mobile-responsive.py`
- SC 3.1.1 (Language of Page, Level A): `<html lang="en">` mandatory on all pages

**ARIA Authoring Practices Guide (APG)** — W3C Working Group Note
- Tab panel pattern: `role="tablist"` + `role="tab"` + arrow-key navigation
- Dialog pattern: `role="dialog"` + focus trap + `aria-modal`

**Apple Human Interface Guidelines** — Accessibility
- Minimum touch target size 44x44pt — referenced as industry baseline alongside WCAG 2.5.5

---

## Appendix D: Typographic Specimens

These specimens document the expected visual appearance of key text styles. Use them to verify correct font rendering in new components.

### Specimen 1: Hero headline

```
IBM Plex Sans 700, 64px, tracking -0.02em, line-height 1.05

Engineering Operations
for Mission-Critical Infrastructure
```

Correct rendering: characters appear slightly tighter than system-ui default, stroke weight has IBM's characteristic slightly higher contrast than Inter. The word "Infrastructure" should fit within 70ch at 64px on a 1280px viewport.

### Specimen 2: Section heading

```
IBM Plex Sans 600, 44px, tracking -0.015em, line-height 1.1

Power Distribution Architecture
```

Correct rendering: semibold weight is clearly distinguishable from bold H1. The slightly looser tracking than H1 reads as "important but subordinate."

### Specimen 3: JetBrains Mono data chip

```
JetBrains Mono 400, 13px, tabular-nums, uppercase, tracking 0.06em

IT LOAD       2.40 MW
PUE           1.38
ANNUAL ENERGY 28,944 MWh
```

Correct rendering: the `0` in `2.40` has a visible diagonal slash (slashed zero). All three decimal points align vertically. `MW` and `MWh` units appear at identical horizontal position across rows.

### Specimen 4: Caption / metadata

```
JetBrains Mono 400, 11px, uppercase, tracking 0.18em, color #64748B

DATA SOURCE: ASHRAE TC 9.9 2021 EDITION
LAST UPDATED: 2026-05-13
```

Correct rendering: text is readable but clearly secondary. Uppercase + wide tracking creates the "field label" quality. The muted color (#64748B) passes 4.5:1 on #0a0e1a (approximately 4.8:1).

### Specimen 5: Stat callout

```
┌──────────────────────────────────────────────────────────┐
│ 3px amber left border                                    │
│                                                          │
│  28,944                                                  │
│  JetBrains Mono 700, 32px, #E8EDF5                       │
│                                                          │
│  MWh annual energy consumption at 1.38 PUE               │
│  IBM Plex Sans 400, 14px, #A0AEC0                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Correct rendering: the large numeric figure dominates, the explanatory text is clearly subordinate. The amber left border (3px, `--rz-accent-signal`) is visually heavier than the standard 1px hairline but does not overwhelm the data.

### Specimen 6: Volt-tier SLD legend

```
JetBrains Mono 11px uppercase, matching stroke color + label

  ─────────────  500 kV   #FFD700  1.6px
  ─────────────  275 kV   #FF8C00  1.4px
  ─────────────  150 kV   #FFAA00  1.0px
  ─────────────   70 kV   #00DDFF  0.7px
  ─────────────   20 kV   #7DDDB4  0.6px
  - - - - - - -  inferred          0.35 opacity
```

Correct rendering: each line's stroke width is visibly different from the adjacent tier. The step from 500 kV to 275 kV (1.6 to 1.4px) is subtle; the step from 150 kV to 70 kV (1.0 to 0.7px) is clearly visible.

---

## Appendix E: Naming Conventions

Consistent naming across CSS classes, JS variables, file names, and token names prevents the accumulation of per-page prefixes that currently exist (e.g., `.opex-input`, `.capex-input`, `.tco-metric`).

### CSS class naming

Pattern: `.rz-{component}[-{variant}][-{state}]`

| Class | Usage |
|-------|-------|
| `.rz-card` | Base card container |
| `.rz-card--active` | Active state variant |
| `.rz-card--alert` | Fault/alert state |
| `.rz-btn` | Base button |
| `.rz-btn--primary` | Signal amber filled button |
| `.rz-btn--secondary` | 1px border, no fill |
| `.rz-btn--ghost` | Text-only, no border |
| `.rz-tabs` | Tab strip container |
| `.rz-tab` | Individual tab item |
| `.rz-tab--active` | Active tab state |
| `.rz-input` | Text / number input |
| `.rz-select` | Select dropdown |
| `.rz-label` | Form field label |
| `.rz-table` | Data table |
| `.rz-modal` | Modal container |
| `.rz-modal-overlay` | Modal dim layer |
| `.rz-metric-chip` | KPI / instrument value chip |
| `.rz-metric-chip--alert` | Red fault state |
| `.rz-metric-chip--caution` | Amber caution state |
| `.rz-metric-chip--ok` | Green normal state |
| `.rz-prose` | 70ch max-width prose container |
| `.rz-reveal` | Blur-fade entrance animation target |
| `.rz-icon` | Stroke icon |
| `.rz-icon--sm` | 16px icon |
| `.rz-icon--lg` | 32px icon |
| `.rz-grid` | 12-column layout grid |
| `.rz-navbar` | Top navigation bar |
| `.rz-sidebar` | Side metadata / filter panel |

### Existing per-page prefix migration

The following per-page prefixes exist today and should be migrated to `.rz-*` during any page-level refactor:

| Legacy prefix | Migration target | Pages affected |
|---------------|-----------------|----------------|
| `.opex-input` | `.rz-input` | `opex-calculator.html` |
| `.capex-input` | `.rz-input` | `capex-calculator.html` |
| `.tco-metric` | `.rz-metric-chip` | `tco-calculator.html` |
| `.pue-result` | `.rz-metric-chip` | `pue-calculator.html` |
| `.roi-summary` | `.rz-metric-chip` | `roi-calculator.html` |
| `.calc-brief-card` | `.rz-card` | multiple calc pages |
| `.model-card` | `.rz-card` | `opex-calculator.html` |
| `.brief-card` | `.rz-card` | multiple calc pages |

Do NOT perform a mass find-replace migration on all pages at once — the risk of breaking dark-mode overrides that reference the specific prefixed class is high. Migrate one page at a time, run the dark-mode audit after each, and verify visual output before committing.

### File naming conventions

| Asset type | Pattern | Example |
|-----------|---------|---------|
| Article hero | `assets/{slug}-hero.webp` | `assets/article-26-hero.webp` |
| OG image | `assets/og/{slug}.webp` | `assets/og/article-26.webp` |
| Icon | `assets/icons/rz-{domain}-{element}.svg` | `assets/icons/rz-elec-transformer.svg` |
| JS module | `js/rz-{function}.js` | `js/rz-mobile-nav.js` |
| JS data | `js/{domain}-data[-{region}].js` | `js/pln-java-grid-data-jabar.js` |
| Standarization doc | `standarization/{SCOPE}_STANDARD.md` | `standarization/AUTH_STANDARD.md` |
| Documentation doc | `documentation/{scope}.md` | `documentation/design.md` |

### Token naming convention

CSS custom properties follow the pattern: `--rz-{category}-{name}[-{variant}]`

Categories: `bg`, `text`, `accent`, `line`, `font`, `text` (size), `space`

Variants: `dim` (darkened for hover/press), `bg` (translucent background tint for that accent color)

---

## Appendix F: Relationship to Standarization Directory

The `documentation/` and `standarization/` directories serve different functions. Understanding the boundary prevents duplication and confusion.

### `standarization/` — tactical rules

Files in `standarization/` answer: "how do I implement this specific thing right now?"

- `AUTH_STANDARD.md` — login modal HTML structure, JS pattern, class names
- `PDF_EXPORT_STANDARD.md` — `window.open()` template, `<\/script>` escape rule
- `RESPONSIVE_STANDARD.md` — breakpoint list, 8 audit checkpoints, version marker comment
- `TOOLTIP_STANDARD.md` — tooltip trigger, HTML structure, accessibility requirements
- `UI_FEATURES_STANDARD.md` — share buttons HTML, reading progress bar, navbar pattern
- `VERSIONING_STANDARD.md` — semver scheme, bump checklist, stamp injection
- `DATAHALL_AI_STANDARD.md` — simulation page structure, no-References-section rule

### `documentation/` — strategic intent

Files in `documentation/` answer: "why does this exist and what is it trying to achieve?"

- `design.md` (this file) — brand essence, visual character, design rationale, 5-year direction

### Cross-reference protocol

When a new pattern is established:
1. The strategic intent goes in `documentation/design.md` (Section 15 Decision Log + relevant section)
2. The implementation rules go in the appropriate `standarization/` file
3. The `documentation/` entry links to the `standarization/` file; the `standarization/` file links back to `documentation/design.md` for context

When an existing pattern is rejected or changed:
1. Section 3 (Anti-Patterns) or Section 15 (Decision Log) in this file is updated first
2. The standarization file is then updated to remove or replace the tactical implementation

Standarization files MUST NOT contradict design.md. If they do, design.md takes precedence and the standarization file must be updated to match.

---

## Appendix G: Design Change Version Discipline

Design changes — unlike bug fixes or new content — affect the entire visual consistency of the site. This appendix specifies how design changes are versioned and communicated.

### Classification of design changes

| Change type | Version bump | Example |
|-------------|-------------|---------|
| Token value change (single token) | PATCH | Adjust `--rz-accent-signal` from `#FFAA00` to `#FFB000` |
| New token added | PATCH | Add `--rz-accent-signal-light` for light mode |
| Component pattern change (one component) | PATCH | Change `.rz-card` border-radius from 4px to 6px |
| New component added | MINOR | Add `.rz-instrument-panel` layout pattern |
| New page archetype | MINOR | Add slide-deck archetype (Section 10.6) |
| Breaking layout / IA change | MAJOR | Sitewide navbar restructure |
| New anti-pattern codified | PATCH | Document and enforce a new rejection |
| Design system document update (no visual change) | PATCH | Add a new appendix, expand explanatory prose |

"Breaking" in the MAJOR context means: a change that would cause a previously-compliant component to look incorrect without a corresponding code update. Token renames are MAJOR if they require find-replace across all pages.

### Design change documentation workflow

When a design decision changes:

1. Update Section 15 (Decision Log) with the change, the rationale, the alternative considered, and the date
2. If the change involves a token value: update Appendix B (CSS Token Reference) with the new hex and the contrast ratio recalculation
3. If the change involves a component pattern: update Section 9 (Component Library Map) with the new design delta and acceptance criteria
4. If the change introduces or removes an anti-pattern: update Section 3 (Anti-Patterns)
5. Update the tactical standarization file if one exists for the changed component
6. Bump the site version per the table above
7. Append a `## v{version}` entry to `CHANGELOG.md` that explicitly mentions "design system update" if the change is visible in the UI

### Design drift prevention

The most common cause of design drift is implementing a new page under time pressure without referencing this document. The following habit prevents it:

Before building any new component or page, open `documentation/design.md` and locate:
- The relevant page archetype (Section 10)
- The component library entry (Section 9) if the component already exists
- The applicable anti-patterns (Section 3) for the type of content being built
- The implementation checklist (Appendix A)

This is not a bureaucratic process — it takes less than 3 minutes to scan the relevant sections. The cost of not doing it is a component that requires a design cleanup pass in a future session.

---

*End of document. Version 1.0 — 2026-05-13.*
*Next review: when MINOR version reaches 2.0.0 or on 2027-01-01, whichever comes first.*
*Tactical implementation rules: `../standarization/` directory.*

---

## Appendix H: Quick Reference Card

A condensed single-page reference for the most-used design decisions. Use this when building new components under time pressure.

### Palette at a glance

```
Background base      #0a0e1a   Deep slate
Background elevated  #111827   Card surface
Background overlay   #1c2333   Modal / dropdown
Background inset     #080c16   Input / code block

Text primary         #E8EDF5   Body copy
Text secondary       #A0AEC0   Support text
Text muted           #64748B   Captions, timestamps

Signal amber         #FFAA00   Primary / CTA / active state
Oscilloscope green   #00FF88   Success / data / positive metric
Fault red            #FF3030   Error / alarm / critical
Instrument cyan      #00DDFF   Informational / secondary data
Muted mint           #7DDDB4   Auth pill only -- NOT primary accent
```

### Typography at a glance

```
Headings:  IBM Plex Sans  700/600  (H1 64px down to H4 20px)
Body:      IBM Plex Sans  400      16px / 1.55 line-height / 70ch max-width
Numerics:  JetBrains Mono 400      tabular-nums slashed-zero (all data values)
Captions:  JetBrains Mono 400      11px UPPERCASE 0.18em letter-spacing
```

### Line weights at a glance

```
1.4 px  Tier 1 -- primary structure, major card borders, section dividers
1.0 px  Tier 2 -- card hairlines, tab borders, modal frames
0.6 px  Tier 3 -- table hairlines, input field borders, legend rules
0.5 px  Tier 4 -- footnote rules, caption separators
```

### Border-radius at a glance

```
4px   All cards, modals, buttons, input fields
0px   Tab strip active indicator, progress bars, hairline dividers
```

### Animation timing at a glance

```
150-200 ms   Color / border state transition     ease-out
220-280 ms   Component enter (blur-fade/slide)   cubic-bezier(0.2,0,0,1.0)
180 ms       Component exit                      cubic-bezier(0.4,0,1,1)
500 ms       Smooth scroll anchor                cubic-bezier(0.65,0,0.35,1)
2400 ms      SLD laser-flow loop -- 150 kV       linear, infinite
3200 ms      SLD laser-flow loop -- 70 kV        linear, infinite
4000 ms      SLD laser-flow loop -- 20 kV        linear, infinite
22-28 s      Aurora mesh hero drift              ease-in-out, infinite (landing only)
```

### Voltage-tier strokes at a glance

```
500 kV   #FFD700  1.6px
275 kV   #FF8C00  1.4px
150 kV   #FFAA00  1.0px  (laser-flow animates from here and above)
 70 kV   #00DDFF  0.7px
 20 kV   #7DDDB4  0.6px
inferred  same color at opacity: 0.35
```

### Touch targets at a glance

```
44 x 44 px   Minimum for all interactive elements (WCAG 2.5.5 / Apple HIG)
48 px height  Mobile bottom-bar share buttons
```

### Breakpoints at a glance

```
320px   xs  iPhone SE minimum
375px   sm  iPhone 12/13/14  << PRIMARY MOBILE TARGET
414px   md  iPhone Plus / large Android
768px   lg  iPad portrait / tablet (hamburger threshold)
1024px  xl  iPad landscape / small laptop
1280px  2xl Standard laptop  << PRIMARY DESKTOP TARGET
1680px  3xl Wide desktop / external monitor (dashboard max-width)
```

### Five most-violated rules -- check these first

Before submitting any component for design review:

1. No hardcoded hex in CSS -- every color must use var(--rz-*); grep '#[0-9a-fA-F]' to verify
2. No box-shadow on resting card state -- shadow only on .active or :focus-visible
3. No gradient on buttons -- solid --rz-accent-signal fill or 1px border only
4. No outline: none without providing an equivalent visible focus state (2px amber outline)
5. No emoji in article body, calculator UI, or navigation

### Cross-reference index

| Topic | Section / Appendix |
|-------|--------------------|
| Accepted color values | Section 5 + Appendix B |
| Anti-patterns list | Section 3 |
| ARIA requirements | Section 12 |
| ASCII wireframes | Section 10 |
| Breakpoints | Section 13 |
| Component status and delta | Section 9 |
| CSS class names | Appendix E |
| Decision history | Section 15 |
| Design quality gate | Section 2 |
| File naming conventions | Appendix E |
| Font loading HTML | Section 4 |
| Icon families and sizing | Section 8 |
| Implementation checklist | Appendix A |
| Line weights | Section 2 + Section 6 |
| Motion durations | Section 7 |
| PDF export design | Section 11 |
| Roadmap 2026-2031 | Section 14 |
| Standarization relationship | Appendix F |
| Standards references | Appendix C |
| Token reference (alphabetical) | Appendix B |
| Typographic specimens | Appendix D |
| Version discipline for design | Appendix G |
| Voltage-tier color mapping | Section 5 |

