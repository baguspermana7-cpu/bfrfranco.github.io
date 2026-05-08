# Changelog — ResistanceZero

All notable changes to the ResistanceZero website. Format follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with calendar-versioned
release sections rather than semver.

> **Maintenance rule**: Every code or content change shipped to production must
> add an entry here. Entries are grouped by date. Within a date, group by
> `Added`, `Changed`, `Fixed`, `Removed`, `Security`. Cross-reference the
> related standardization document(s) when applicable.

---

## v1.1.1 — 2026-05-09
- **Fix**: hero gridline pattern was still visible after Plan v12 ship — agent had patched only `.hero-background::before` but the base `.hero-background` rule (and dark-mode override) carried the actual grid via crossed linear-gradients @ 60×60 px. Now both light + dark hero backgrounds are fully transparent; only the `::before` soft radial wash remains.

## v1.1.0 — 2026-05-09 (Plan v12 shipped, commits 22548ba + c1667a4)
- **Landing**: removed rotated side tabs, replaced "↓ SCROLL TO EXPLORE" with Pixel Rise soft animation, added floating 5-icon share column (LinkedIn/X/WhatsApp/Instagram/Facebook), Get Started + Contact Us CTA pair in hero, navbar Contact link scroll-aware (hidden at top, fades in past hero), navbar transparent → frosted-glass on scroll.
- **Visual**: removed dot-grid pattern from hero (clean ambient gradient now), pastel mint user pill replacing default purple, calm pastel bento card palette (mint/lavender/peach/pink/cream), GitHub label/URL removed from Contact and footer (kept in schema.org metadata).
- **Video**: new Remotion intro composition `ResistanceZeroIntro` (30 s, 1920×1080), rendered to `assets/resistancezero-intro.mp4`. Plays in inline modal triggered by Get Started.
- **Site-wide**: introduced `js/rz-version.js` as single-source-of-truth for version, `RZ.injectVersionStamp()` injects "Latest version: vX.Y.Z" stamp at every page footer.
- **Tooling**: new `tools/insert-version-script.py` + `tools/audit-version-stamp.py`. New `standarization/VERSIONING_STANDARD.md`.

## v1.0.0 — 2026-05-09 (semver baseline)

First semver-tagged release. This entry consolidates prior shipped work and establishes the versioning regime. From this point forward, every meaningful change MUST bump `js/rz-version.js` and append a CHANGELOG entry per `standarization/VERSIONING_STANDARD.md`.

Major shipped milestones (pre-baseline, abridged):
- 18 calculator pages (PUE, CAPEX, OPEX, ROI, TCO, CX, Carbon Footprint, …)
- 22+ articles (Future Forward series, Geopolitics series, Article 1–26)
- DC market tracker + 11 city detail pages
- PLN Java-Bali grid monitor (5 pages, OSM-backed dataset)
- Datahall AI BMS simulation + DC conventional sibling
- Engineering audits, security/SEO audit, navbar canonicalisation work
- rz-engine.js (calc engine + auth + format + PDF), auth.js (auth widget)

---

## [2026-04-29] — PLN regional monitors split off landing page; shared `js/rz-map.js` engine

### Added
- **`pln-java-grid.html`** — new dedicated detail page for the PLN Java-Bali (Jamali) transmission system. Geographic Map view (Leaflet/CARTO dark, Java + Bali fitBounds) and Single-Line Diagram view (inline SVG, IEC 60617 symbols, ~100 nodes target with "Show all 150 kV" toggle for the long tail). Province tabs (Jakarta+Banten / Jabar / Jateng+DIY / Jatim) with deep-link support (`#prov=jabar`). Substation slide-in side panel on click.
- **`js/rz-map.js`** — new shared Leaflet wrapper engine. Public API `window.RZMap.init(containerId, opts)` returning `{ map, addMarker, addLine, setMarkerVisible, setLineVisible, fitBounds, setView, refresh, destroy }`. Stations as `circleMarker` (color by voltage 500/275/150, radius `√(MVA)*0.35`). Plants as `divIcon` with FontAwesome glyph per fuel type. Polylines per voltage tier with `rzm-line-{500|275|150}` className for CSS dash-flow. Optional layer control on voltage/fuel toggles. `prefers-reduced-motion` guard. Resilient: no-ops if Leaflet isn't loaded.
- **`js/pln-java-grid-data.js`** — data module for `window.PLN_JAVA_GRID` exposing `{ version, nodes[], edges[], national }`. Topology source: PLN P2B 2016 single-line diagram. Coordinate confidence flag per node (`high` from Wikipedia infobox / OSM Nominatim, `low` from province-centroid fallback — none invented).

### Changed
- **`datacenter-solutions.html` #pln-monitor section** reverted to a 6-card grid (`.ds-strat-card`). Java-Bali card is active and links to `pln-java-grid.html`. Sumatera, Kalimantan, Sulawesi, Maluku-Papua, Nusa Tenggara cards render as dimmed `is-soon` placeholders (`<div>` not `<a>`, `pointer-events:none`, "Coming soon" pill instead of CTA — not crawlable as dead links).
- **`dc-market-tracker.html`** refactored to consume `RZMap.init()` instead of its inline `initLeafletMap()` IIFE. Visual output identical.
- **`standarization/UI_FEATURES_STANDARD.md`**: replaced the earlier "SLD Inline-SVG Animation Pattern" section with the broader "Card → detail-page hub + shared `js/rz-map.js` engine" pattern.

### Removed
- All `.pln-*` CSS rules from `datacenter-solutions.html` (~280 lines of SLD-only styling). Verified by `grep -rln 'pln-grid-card\|pln-mini-stat\|pln-list-title' /home/baguspermana7/rz-work/` returning only the post-revert file itself.

### Rationale
- User feedback: SLD did not belong on the landing page; the hand-drawn SVG was inaccurate; the existing Leaflet/CARTO map from `dc-market-tracker.html` was the correct base; SLD detail target was "very detailed" (~100 nodes, not the prior ~25).

### 2026-05-01-v8 — Inference widening + audit dashboard

- **`infer_edges_by_proximity` widened**: radius 30 → 50 km, max 1 → 2 nearest neighbours per station. Builds rings instead of chains in dense regions; bridges sparse outliers without sacrificing tier-safety. Edges grew **495 → 698** (+203, mostly 150 kV: 410 → 608).
- **NEW `tools/audit-dataset.py`** — quality dashboard. Runs 8 structural + semantic checks:
  - required fields, duplicate IDs, geographic outliers (Java-Bali bbox)
  - orphan stations (transmission tier ≥70 kV — distribution 20 kV expected isolated)
  - confidence distribution per voltage tier (flags >50% low)
  - province coverage (≥10 nodes per province)
  - Bali isolation (must have ≥1 edge crossing the strait)
  - cross-tier jumps (500↔20 without 150 kV intermediate)
- Output as human-readable report or `--json`. `--strict` exits 1 on CRITICAL findings (CI-gate ready).
- Current state: **0 CRITICAL, 38 HIGH** (32 remote orphans, 1 statistical confidence skew, 5 cross-tier jumps from OSM lazy line tagging — all candidates for future YAML-overlay corrections).

### 2026-04-30-v7 — datahallAI auth gate hotfix + Java-Bali submarine fix + second-brain refresh

- **Fixed** the `datahallAI.html` "Root Access Required" modal that blocked logged-in PRO/root users. Root cause: race condition — gate IIFE ran before `window._rzAuth` was defined by `auth.js`. Patched the gate to fall back to a direct `localStorage.rz_premium_session` read with the same email-allowlist (`admin@`, `bagus@`), so the page works whether or not auth.js has loaded yet. Also added a `storage` event listener for cross-tab logout sync.
- **Fixed Java-Bali submarine** topology in `tools/pln-java-grid-overlay.yaml`:
  - `prov_override: bali` on `Cable Head Gilimanuk` (osm_way_339796954) and `GI Gilimanuk` (osm_way_192989828) — both were OSM-tagged `jatim` despite being on the Bali side of the strait.
  - Replaced the wrong `paiton → banyuwangi @ 275 kV` curated edge with the actual physical reality: 4×150 kV submarine cables (~340 MW total, commissioned 1989-1996). The 275 kV submarine is planned but not commissioned.
  - Added curated Bali internal 150 kV ring (Gilimanuk → Negara → Antosari → Pemecutan → Pesanggaran → Pecatu, plus Sanur → Gianyar → Amlapura → Kubu → Celukan Bawang → back to Gilimanuk). 14 new edges fully connect the 40 Bali nodes (up from 38 — two were correctly retagged from jatim to bali).
- **Updated** `Apps/second brain/index.html` knowledge graph: added 5 new nodes (`pjg`, `pjg-jkb`, `pjg-jb`, `pjg-jt`, `pjg-jm`) and 11 edges connecting them to existing reports / DC Solutions / DC Markets hubs. Second-brain visualization now reflects the full Java-Bali grid family.
- Edge total stable at 495 (52×500 / 0×275 / 418×150 / 25×70). 275 kV edge correctly dropped to reflect physical reality of the submarine link.

### 2026-04-30-v5 — Full province coverage + datahallAI cleanup + scheduled OSM refresh

- **Added** `pln-java-grid-jateng.html` (Jawa Tengah + DIY) and `pln-java-grid-jatim.html` (Jawa Timur). Pages mirror the v4-fixed Jakarta+Banten / Jabar template: default labels OFF, tier-graded thin lines, animation only ≥150 kV, hover tooltips, 5-tier voltage toggles. Java-Bali sub-page family is now **4/4 complete**.
- **Added** `js/pln-java-grid-data-jateng.js` and `js/pln-java-grid-data-jatim.js` — curated 20 kV DC + industrial overlays for each province.
- **Promoted** Jawa Tengah + DIY and Jawa Timur cards on the overview page from `is-soon` placeholders to active links. All 4 province cards on `pln-java-grid.html` now click through to working sub-pages.
- **Removed** the `<section>` with 10 academic-style references (NVIDIA, Uptime, Equinix, ASHRAE, OCP, Schneider, SemiAnalysis, IEA, Berkeley Lab, Lawrence Berkeley) from `datahallAI.html`. The page is a DC simulation tool, not a research article — citations were a category mismatch. `datahall.html` (DC conventional sibling) was already clean.
- **Sitemap**: 2 new entries for the province pages, priority 0.85, monthly changefreq.
- **Scheduled** quarterly OSM dataset refresh routine — `python3 tools/build-osm-dataset.py --force` runs on the 1st of each quarter; opens a PR if the dataset diff is non-trivial.

### 2026-04-30-v4.2 — Topology inference + plant evacuation + visual confidence

- **infer_edges_by_proximity** in `tools/build-osm-dataset.py` connects any 500/275/150/70 kV station not already in an OSM or curated edge to its nearest same-voltage neighbour within 30 km (20 km for 70 kV). Source: `inferred-nn`.
- **infer_plant_evacuation** connects each unattached plant to its nearest 500/275/150 kV substation within 5 km. Source: `inferred-evacuation`. Solves "plants float as isolated dots" issue.
- **Visual confidence**: inferred edges render with `opacity:0.35` + tighter dash + no animation (CSS `[data-source^="inferred"]` rule on all 3 pages). Curated/OSM edges remain bright with full laser-flow. Users can see at a glance which edges are factual vs. heuristic.
- Edge totals across iterations: 34 (v1) → 80 (v4.0 curated) → 363 (v4.1 inference) → **488** (v4.2 with plant evacuation + 70 kV).
  - 500 kV 52, 275 kV 1, 150 kV 410, 70 kV 25.
- Curated edges added to `tools/pln-java-grid-overlay.yaml` `edges:` block: 28 backbone 500 kV (Suralaya → Cilegon → Balaraja → Gandul → Bekasi → Cibatu → Cirata → Pemalang → Ungaran → Tanjung Jati / Pedan → Cilacap / Kediri → Krian → Gresik / Ngimbang → Grati → Paiton plus radials), 1×275 kV Java-Bali submarine, 12 key 150 kV corridors.

### 2026-04-30-v4 — SLD readability fix (labels off, tier-graded thin lines, curated backbone edges)

- **Labels default OFF** on the SLD across all 3 pln-java-grid pages. With 744 nodes, drawing every name produced massive overlap. Names now appear only via hover tooltip. Labels toggle is preserved for users who want them.
- **Tier-graded stroke-widths**: 500 kV `1.6 px`, 275 kV `1.4 px`, 150 kV `1.0 px`, 70 kV `0.7 px`, 20 kV `0.6 px`. Visual hierarchy now matches electrical hierarchy.
- **Laser-flow animation locked to ≥150 kV** only. 70 kV and 20 kV lines are static thin dashes (no `animation` property). Confirmed via CSS rule audit.
- **OSM line-endpoint matching threshold relaxed** in `tools/build-osm-dataset.py` from `0.5 km` to `1.5 km` (bbox prefilter `0.01°` → `0.03°`).
- **Curated edges block** added to `tools/pln-java-grid-overlay.yaml` — 28×500 kV backbone (Suralaya → Cilegon → Balaraja → Gandul → Bekasi → Cibatu → Cirata → … → Paiton plus radials + 275 kV Java-Bali submarine + key 150 kV corridors). Merged into the JS data file by the crawler with dedup against OSM. Edge total: 51 → **80** (28×500 / 1×275 / 47×150 / 4×70).
- **Crawler enhancement**: `load_overlay_edges(nodes)` reads `edges:` block from YAML, fuzzy-matches `from`/`to` slugs against node names. Logs unresolved-endpoint warnings.
- **First-paint** flicker prevented: SLD root group renders with `class="*-svg-root no-labels"` baked into the HTML (no JS race).
- **Why**: user feedback after v3 deployment — "tulisan nama gardu sudah saya bilang jangan disini, tapi di tooltip" + "garis koneknnya kurang lengkap dan perlu yang tipis" + "arah flow laser itu hanya >=150kv saja" + "enhance banyak collision".

### 2026-04-29-v3 — Data accuracy expansion (OSM crawl + tooltip system + multi-tier toggles)

- **Added** `tools/build-osm-dataset.py` — Python OSM Overpass crawler for Java+Bali. Queries `power=substation` and `power=plant`/`generator` features, parses voltage tags, writes `js/pln-java-grid-data.js` with provenance fields per node (`source`, `osm_id`, `wikidata`, `confidence`).
- **Added** `tools/pln-java-grid-overlay.yaml` — hand-curated overlay (~60 entries) carrying `mva`, `year`, `served_areas`, `notes` for known substations and plants. Merged into the JS data file at build time.
- **Added** `js/pln-tooltip.js` (471 LOC) — shared rich-tooltip module for SVG nodes + Leaflet markers. Lifecycle: shared singleton DOM, debounced show/hide, auto-position with viewport flipping, keyboard accessible (focus + Esc), mobile bottom-sheet variant.
- **Modified** `js/rz-map.js` (303 → 317 LOC) — now accepts per-marker `tooltipData` opt; auto-wires `PLNTooltip.attach` if module is loaded. Backward-compatible (existing dc-market-tracker.html consumer unaffected).
- **Modified** `pln-java-grid.html`, `pln-java-grid-jakarta-banten.html`, `pln-java-grid-jabar.html` — added 5-tier voltage layer toggles (500/275/150 default ON; 70/20 default OFF on overview, 20 default ON on province pages). Per-fuel plant toggles. Display master toggles (Labels / Capacity / kV badges). Wired tooltips on every node + edge midpoint. SLD viewBox bumped to 1800×900 (overview) and 1400×900 (province) to absorb the larger dataset. Collision-nudge increased from 6 to 10 iterations with ±20 px search radius.
- **Schema additions per node**: `source`, `confidence` (high/medium/low), `osm_id`, `osm_type`, `wikidata`, `served_areas[]`, `notes`, `secondary_voltages[]`, `last_verified`. Visible in tooltip header (kV + confidence badges) and footer (OSM/Wikidata/Map links).
- **Dataset growth**: from 118 nodes hand-curated → **744 nodes** OSM-sourced (563 stations + 181 plants), 6.3× expansion. Voltage breakdown: 33×500 kV / 1×275 kV / 442×150 kV / 55×70 kV / 213×20 kV. Province breakdown: jakarta-banten 213, jabar 196, jatim 185, jateng 112, bali 38. Confidence: 503 high / 224 medium / 17 low. User's specific concern resolved: `GIS Summarecon` now in dataset (`osm_way_966209499`, 150 kV, jakarta-banten, confidence:high) — alongside GIS Bekasi II, GISTET Tambun II, GI Tambun, GI Cikarang, GI Cikarang Lippo, KCIC Karawang, etc.
- **Why**: user feedback on accuracy ("very accurate, very precise") and request that all voltage tiers be selectable. The user's specific complaint about GI Bekasi vs GI Summarecon is addressed via the `served_areas` annotation (Summarecon Bekasi, Harapan Indah, Logos Bekasi listed as served areas of GI Cibitung 150/20 kV).
- Cards-on-landing → detail-page-on-click model matches the existing `.ds-strat-card` pattern used elsewhere in the section (TCO, ROI, DMT cards).

## [Unreleased]

### Planned
- Extract `calc-auth.js` shared engine (Phase 1 of calculator consolidation roadmap, see `standarization/CALC_ENGINE_PLAN.md`).
- **Phase S2.5** — expand `RZEngine.models.{opex,capex,tco}` API to support utilization-aware power, climate/cooling adjustments, multi-factor CAPEX build-up, and multi-stream TCO. Required before tco-/capex-/opex-calculator math can migrate to engine.
- Hero images for articles 1–19 (currently missing `assets/article-N-hero.webp`).
- References sections for articles 2, 4, 5, 6, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20 — older articles still missing canonical `references-section` markup; some have legacy `<ol class="references">` and could be migrated to canonical pattern in a separate sweep (articles 21, 22 done 2026-04-30).
- Tighten Independence Disclaimer placement in articles 19–27 (currently inserted before `</main>`; older convention is before References — cosmetic only).
- Reconcile `auth.js` vs `rz-engine.js` `VALID_USERS` role strings (auth.js: demo='pro', bagus/admin='root'; rz-engine.js: demo='demo', bagus/admin='admin'). Email-based gate makes drift safe but harmonization remains hygiene work.

---

## [2026-04-30] — Backlog sweep + root-only gates + login button bug fixes

### Added
- **`article-16.html`** — bottom-of-article `<div class="article-nav">` block (Previous → `article-15.html`, Next → `article-17.html`), inline-SVG arrow style matching article-15.
- **`article-22.html` References section** — 15 cited sources in canonical `references-section` markup (cyan `#0891b2` accent matched to article palette). NVIDIA Spectrum-X / Quantum-X Photonics, NCCL, Lumentum, Coherent, Open Compute Project, Optica/OFC, IEEE Spectrum, DCD, SemiAnalysis, Lightmatter, Ayar Labs, Wikipedia (silicon photonics).
- **`article-21.html` References section** — 15 cited sources, emerald `#059669` accent. NRC, DOE Office of Nuclear Energy, IAEA ARIS, FERC (Dec 2025 co-location ruling), World Nuclear Association, NEI, IEEE Spectrum, all 5 SMR vendors profiled in §5 (NuScale, Oklo, X-Energy, TerraPower, Kairos Power), Constellation Energy (Microsoft / TMI deal), OPG Darlington BWRX-300, Wikipedia.
- **Articles 19, 20, 21, 22, 23, 24, 25, 26, 27** — Tier-1 legal compliance components per `standarization/LEGAL_COMPLIANCE_STANDARD.md` §3 + §7: Independence Disclaimer (before `</main>`) + Cookie Consent Banner with JS (before `</body>`). Wired to `localStorage` key `rz_cookie_consent`; declining sets `window['ga-disable-G-GED7FX8RTV'] = true`. All 9 articles already load `styles.css` so `.cookie-banner` rules apply.
- **`auth.js`** — added `isRootEmail(email)`, `isRootAccess(session)`, `isRootSession()` helpers exposed on `window._rzAuth.*`. Email-based check uses pre-existing `ROOT_EMAILS = ['admin@resistancezero.com', 'bagus@resistancezero.com']` and is robust to the role-string drift between `auth.js` and `rz-engine.js` `VALID_USERS` lists.
- **`auth.js` `ROOT_ONLY_PATHS`** — extended from `['/dcmoc']` to `['/dcmoc', '/dc-market', '/datahallai.html', '/dc-conventional.html', '/dc-market-tracker.html']`. Auto-applies the navbar 🔒 lock icon (`fas fa-lock rz-lock-icon`) to all matching links across the 60+ pages with the dropdown — no per-page HTML edits needed for the lock visualization. Click handler enforces root-account gate via existing `handleRootOnlyLinkClick`.
- **`dc-conventional.html`** — full root-only gate added (CSS `body.locked` blur + `.rz-restricted-overlay` modal + IIFE that subscribes to `rz-auth-change` and toggles `body.locked` based on `_rzAuth.isRootSession()`). Page was previously unguarded; demo and anonymous now blocked.
- **`dc-market-tracker.html`** — same gate pattern (CSS + overlay + IIFE). Pre-existing hub card linking to `dc-market/` retained (PLN session added it on 2026-04-29).
- **`/home/baguspermana7/.claude/projects/-home-baguspermana7/memory/feedback_simulation_pages_no_refs.md`** — new memory feedback rule: never add `<section>` References blocks to simulation/dashboard pages (`datahallAI.html`, `dc-conventional.html`, future BMS/SCADA-style mimics). Trigger: 2026-04-29's discoverability sweep mistakenly added one to `datahallAI.html`; reverted on 2026-04-30 commit `df0fbd7`.

### Changed
- **`datahallAI.html` gate** — replaced minified `ia(s){return!!(s&&(s.role==='root'||s.role==='pro'));}` IIFE (lines 9768-9779) with `_rzAuth.isRootSession()`-based check. Previous version allowed `role==='pro'` to pass — under `auth.js`'s `VALID_USERS`, the demo account had `role:'pro'`, so demo bypassed the gate. New version uses email-based `ROOT_EMAILS` check and rejects demo while admitting only `bagus@` / `admin@`.
- **`roi-calculator.html` `calcNPV` and `calcIRR`** — both now delegate to `RZEngine.models.roi.npv` / `RZEngine.models.roi.irr` when the engine is available, falling back to inline math otherwise. Pattern matches `pue-calculator.html` S2 pilot. Engine smoke verified: `npv([-100, 30×5], 0.10) = 13.7236` matches inline; IRR via engine bisection = 0.1524 for the same series.
- **DC Market dropdown consolidation** — across **66 HTML pages** (`articles.html`, `glossary.html`, `dashboard.html`, `insights.html`, `index.html`, all `article-N.html` 1-27, all `compare-*.html`, all `geopolitics-*.html`, all `pillar-*.html`, all `ltc-*.html`, all `infographic-*.html`, all `FF-*.html`, `future-forward.html`, `achievements.html`, `asean-dc-report-2026.html`, `tco-calculator.html`), the navbar dropdown's "Market Tracker" label was renamed to "DC Market" via `tools/dc-market-consolidator.py`. `index.html` additionally had its sibling "DC Markets (10 cities)" line consolidated into the single "DC Market" item — that secondary link is now reachable via the in-page hub card on `dc-market-tracker.html` instead. Locked icon auto-renders because `dc-market-tracker.html` is in `ROOT_ONLY_PATHS`.

### Fixed
- **`roi-calculator.html` JavaScript SyntaxError** (lines 1780-1782) — the printPDF function had a single-quoted string literal that spanned three lines without `\` continuations or template-literal backticks, causing the entire IIFE containing `calculate()`, `calcNPV()`, `calcIRR()`, `attemptLogin()`, `handlePremiumTab()` to fail to parse. Every JS-dependent feature on the calculator was silently broken in browsers (curl returned HTTP 200 because HTML still served). Fixed by splitting the broken multi-line string into three concatenated `html += '...';` statements with `<\/script>` escape sequences.
- **`capex-calculator.html` and `opex-calculator.html` Login button no-response** — `<script src="auth.js">` and `<script src="rz-engine.js">` tags were trapped INSIDE the `printHTML` template literal (lines 4028-4029 and 4613-4614 respectively), so they only loaded inside the PDF print window, never on the calculator page itself. Result: `_rzAuth.*` and `RZEngine.auth.*` were undefined on the calculator page → login modal flow silently failed. Fixed by adding real top-level `<script>` tags before `</body>`. The script tags inside printHTML stay (they're correct for the PDF output).
- **`roi-calculator.html` script tags** — same issue (top-level tags missing); added before `</body>`.
- Reason: 2026-04-29 commits `72b81ce feat(capex,opex,cx-calculator): migrate to RZEngine.auth` and `af8875c feat(roi+tco-calculator): migrate to RZEngine.auth` mistakenly placed the migration's script tags inside the PDF print template literals on capex/opex/roi calculators. `tco-calculator.html`, `cx-calculator.html`, and `pue-calculator.html` were correctly wired (top-level tags before `</body>`) and weren't affected.

### Status: Super Engine consumers (delta vs 2026-04-28j)
| Calculator | Loads engine | Uses `auth.*` | Uses `models.*` | Uses `data.*` |
|---|---|---|---|---|
| pue-calculator | ✅ | ✅ | ✅ pue.* | — |
| roi-calculator | ✅ (script tag fix) | ✅ | ✅ **roi.\*** (NEW) | — |
| capex-calculator | ✅ (script tag fix) | ✅ | — (deferred) | — |
| opex-calculator | ✅ (script tag fix) | ✅ | — (deferred) | — |
| tco-calculator | ✅ | ✅ | — (deferred) | — |

### Verification
- All 7 affected pages serve HTTP 200 (`datahallAI.html`, `dc-conventional.html`, `dc-market-tracker.html`, `capex/opex/roi/tco-calculator.html`).
- `auth.js` parses cleanly (browser-style sanity via `new Function(src)`); 7 expected helper definitions/exposures present.
- 0 `>References<` / `id="ref-1"` markers in `datahallAI.html` (confirms PLN session's `df0fbd7` cleanup retained).
- 0 remaining "Market Tracker" labels in nav dropdowns (66 → "DC Market"); 1 remaining standalone reference is the `<h1>` page title on `dc-market-tracker.html` itself, which is intentional (page is still the global Market Tracker dashboard).
- Forged-session DevTools resistance: setting `rz_premium_session` with `{email:'demo@…', role:'root', tier:'pro'}` keeps the gate locked — email-based check rejects forged role strings.

### Rationale
- **Email-based root gate** chosen over role-based to neutralize the role-string drift between `auth.js` (`role:'pro'` for demo) and `rz-engine.js` (`role:'demo'` for demo). Whichever file writes the session wins; email is stable. `ROOT_EMAILS` already exists at `auth.js:20`, matching the working dcmoc gate convention.
- **DC Market consolidation** keeps `dc-market-tracker.html` as the global Leaflet/Chart parent ("DC Market") with the 10-city deep-dive hub reached via in-page card linking to `dc-market/`. Single navbar item replaces the previous two-line "Market Tracker" + "DC Markets (10 cities)" pattern. User intent: "DC Market itu parentnya, tambahkan menu di page itu atau card untuk menuju /dc-market/".
- **No References on simulation pages** — operational dashboards (datahallAI's 4-tab BMS mimic, dc-conventional's facility infographic) take a "Legal Notice" disclaimer instead of academic citations. New memory rule prevents future discoverability sweeps from re-adding them.

---

## [2026-04-28j] — Article-26 PFAS migrated to RZEngine.auth + bulk script-tag wiring

### Changed
- **article-26.html PFAS calculator IIFE** migrated from inline `VALID_USERS` array + bespoke session check to `RZEngine.auth.validateLogin`, `RZEngine.auth.getSession`, `RZEngine.auth.setSession`, `RZEngine.auth.dispatchAuthChange`. Inline `VALID_USERS` declaration removed entirely. Legacy fallback retained for safety if engine fails to load.
- **`<script src="rz-engine.js?v=2026-04-28">` wired into 30 additional pages** (articles 1–22 + articles.html + 5 standalone calcs + dashboard adjacents). Total rz-engine.js consumers across the site now: **35 pages**. Most don't yet consume the engine API but are now set up for future migration without another script-tag pass.

### Status: Super Engine consumers
| Article | Loads engine | Uses `auth.*` | Uses `models.*` | Uses `data.*` |
|---|---|---|---|---|
| article-23 | ✅ | — | — | — |
| article-24 | ✅ | ✅ | — | — |
| article-25 | ✅ | — | — | — |
| article-26 | ✅ | ✅ | — | — |
| article-27 | ✅ | ✅ (S2 pilot) | ✅ workforce.* | ✅ regions, salaryBenchmarks, attritionFactors |
| article-1 through article-22, articles.html, +standalone calcs | ✅ (script tag only) | — | — | — |

## [2026-04-28i] — Standalone calc nav glossary link

### Added
- Glossary link (`#14b8a6` teal) inserted into the `.nav-links` custom navbars on **12 standalone calc/tool pages**:
  - capex-calculator, opex-calculator, roi-calculator, tco-calculator, pue-calculator (5 main calcs)
  - carbon-footprint, dc-market-tracker (2 trackers)
  - tia-942-checklist, tier-advisor (2 standards tools)
  - ltc-system-modelling-lab, standards-ltc-lab (2 LTC labs — used `.nav-back` style for these)
  - datacenter-solutions (1 solutions hub)

This closes the standalone-calculator nav backlog from `[Unreleased]` (2026-04-28g). Glossary is now reachable from every page on the site that has any kind of navbar — main-pattern (`.nav-menu`), custom (`.nav-links`), or LTC-lab (`.nav-back`).

### Status
The discoverability audit is now functionally complete:
- ✅ Glossary linked from every page with a navbar (~77 pages total).
- ✅ Glossary linked from footer NAVIGATION across 60 pages.
- ✅ All Tier-1 and Tier-2 report pages have References sections.
- ✅ insights.html surfaces the Reports cluster.
- ✅ Second Brain graph reflects current site truth.

### Remaining backlog (small)
- Article-26 PFAS IIFE migration to `RZEngine.auth.*` (currently kept as A/B control).
- `dashboard.html` and `datacenter-solutions.html` References — optional, these are tool pages.

## [2026-04-28h] — Tier-2 Discoverability backlog cleared

### Added
- **References sections** on all 10 `dc-market/*.html` city pages (~6 region-specific citations each, 60 citations total). Each uses authoritative regional sources:
  - Singapore: IMDA, EMA, NEA, CBRE APAC, JLL Asia, IEA.
  - Jakarta: Kominfo, PLN, BPS, JLL Indonesia, CBRE Indonesia, Asia Cloud Computing Association.
  - Kuala Lumpur: MyDigital, MCMC, TNB, JLL/Cushman/EPU Malaysia.
  - Tokyo: METI, MIC, TEPCO, JEMA, JLL/CBRE Japan.
  - Sydney: AEMO, AER, ACMA, JLL Australia, Clean Energy Council, CBRE Pacific.
  - London: Ofgem, National Grid ESO, Ofcom, JLL UK, CBRE EMEA, techUK.
  - Frankfurt: Bundesnetzagentur, BMWK, DENA, JLL/CBRE Germany, eco Association.
  - Dubai: TDRA, DEWA, RTA, JLL/Cushman MENA, UAE Ministry of Energy.
  - Mumbai: TRAI, CEA, MAHADISCOM, JLL/CBRE India, NIXI.
  - Northern Virginia: Dominion Energy IRP, FERC, NERC, PJM, Loudoun County EDA, JLL Mid-Atlantic.
- **References sections** on all 3 infographic pages (~6 citations each, 18 citations total):
  - PUE Global: IRENA, Uptime, IEA, LBNL, ASHRAE, Green Grid.
  - DC Sustainability: IEA, AWS, Google, Microsoft, Greenpeace, CDP.
  - DC Cost Breakdown: CBRE, JLL, Uptime, NVIDIA, OCP, Schneider.
- `<script src="rz-engine.js">` wired into `article-23.html`, `article-25.html` (joining article-24, article-26, article-27 as Super Engine consumers — 5 of 27 articles now load the engine).

### Status of discoverability audit
- ✅ All Tier-1 (high-traffic report pages) have References.
- ✅ All Tier-2 (10 city pages + 3 infographics) have References.
- ✅ Glossary navigation in navbar + footer across 65 pages.
- ✅ Reports & Trackers cluster surfaces all reports from `insights.html`.
- ✅ Second Brain graph: 0-edge nodes (CX, Glossary) connected; stale labels fixed; RZEngine + 3 plan docs added.

### Remaining
- `dashboard.html` and `datacenter-solutions.html` References — these are tool pages, references optional.
- ~29 standalone calculator pages with `.nav-links` (custom navbar pattern) still need glossary link addition. Separate audit.
- IIFE migration of article-26's PFAS calculator to `RZEngine.auth.*` (kept as A/B control through the v1.2.0 ship; can migrate now since the engine is stable).

## [2026-04-28g] — Discoverability Audit (glossary nav + report refs + graph sync)

### Added
- **Glossary navigation surfaces:** glossary link in navbar Insights dropdown across 65 HTML pages (color #14b8a6) and in the footer NAVIGATION column across 60 HTML pages.
- **References sections** for the three highest-traffic report pages:
  - `dc-market-tracker.html` — 10 citations (CBRE 2025 Global DC Trends, JLL 2025, Cushman &amp; Wakefield 2025, Synergy Research 2024, Uptime 2024, IEA 2024, McKinsey, BloombergNEF, Data Center Frontier, government / utility filings).
  - `asean-dc-report-2026.html` — 10 citations (CBRE APAC, JLL Asia Outlook, Synergy, IMDA Singapore, Kominfo Indonesia, MyDigital Malaysia, DEPA Thailand, Cushman, IEA, Uptime APAC). This page was previously orphaned with zero inbound visible links — now linked from `insights.html`.
  - `datahallAI.html` — 10 citations (NVIDIA H100/GB200 datasheets, Uptime AI Survey, Equinix AI-Ready, ASHRAE TC 9.9, OCP, Schneider EcoStruxure, SemiAnalysis, IEA, LBNL).
- **Reports &amp; Trackers cluster** on `insights.html` — 6 cards surfacing `dc-market-tracker`, `asean-dc-report-2026`, `datahallAI`, and the 3 infographics. Closes the inbound-link gap.
- **Second Brain graph** new nodes: `a27` (Article 27 Workforce Crisis), `rzeng` (RZEngine v1.2.0), `sse` (SUPER_ENGINE.md), `scep` (CALC_ENGINE_PLAN.md), `scmp` (CALC_MODELS_PLAN.md).

### Fixed
- **Second Brain graph CX Calculator (`ccx`)** was 0-connection — now linked to dash, sdcv, copx, croi, rzeng (5 edges).
- **Second Brain graph Glossary (`glos`)** was 0-connection — now linked to idx, arts, ins, articles 23-27, calculators with terms (cpue, cpp, cpa), rzeng (12 edges).
- **Second Brain graph stale labels:** `a24` was "FF-1: The Web Didn't Die" → now "Art-24: Manpower Shortage". `a25` was "FF-2: Engineer Shortage" → now "Art-25: PJM 6 GW Short". Both moved out of Future Forward tagging into their actual content categories.

### Unreleased follow-ups (logged for next session)
- References sections for the 10 `dc-market/*.html` city pages (~5 region-specific refs each).
- References sections for `infographic-pue-global.html`, `infographic-dc-sustainability.html`, `infographic-dc-cost-breakdown.html`.
- References sections for `dashboard.html` and `datacenter-solutions.html`.
- Glossary link insertion for the ~29 standalone calculator pages with `.nav-links` (custom navbar pattern, separate audit).

## [2026-04-28f] — Super Engine S4 + S5 + S6 (capex/opex/tco/pue math + UI primitives)

### Added
- **`RZEngine.data.capexPerMw`** — per-MW build cost baselines for `airCooledTier2/3/4`, `liquidCooledTier3`, `immersionTier3` (sources: 451 Research 2024, JLL DC OpCost 2024, Cushman & Wakefield 2024).
- **`RZEngine.data.mepPctOfCapex`** — MEP percentage by tier (36/42/48% for T2/T3/T4).
- **`RZEngine.data.modularPremiumPct`** — modular vs stick-built premium by tier.
- **`RZEngine.data.hoursPerYear`** — `8760` constant.
- **`RZEngine.models.capex`** — `datacenterBuildCost(mw, tier, region)`, `modularPremium(baseCost, modularPct, tier)`, `mepDistribution(totalCapex, tier)`. Pulls regional multipliers from `RZEngine.data.regions`.
- **`RZEngine.models.opex`** — `powerCostAnnual(mw, pue, regionPower, hoursPerYear)`, `coolingEfficiency(climate, designDeltaT)`, `staffingCostAnnual(headcount, region, role)` (uses 1.30× fully-loaded mult), `contractCostAnnual(scope, region)`.
- **`RZEngine.models.tco`** — `lifecycle(capex, opexAnnual, years, refreshPct)` (default 5-yr refresh cycle), `replacementCycles(assetLife, totalYears)`.
- **`RZEngine.models.pue`** — `pueFromInputs(itLoad, totalLoad)`, `dcie(pue)`, `annualEnergyCost(itKw, pue, kwhRate, hoursPerYear)`.
- **`RZEngine.ui`** — `gateOverlay(message, ctaLabel, ctaHandlerName)`, `kpiCard(label, value, subLabel, accentColor)`, `badge(text, variant)` (12 variants matching CALCULATOR_PROMPT_STANDARD palette), `glossaryAnchor(term, slug)`, `tooltip(el, content)`.
- Engine bumped to **`v1.2.0`**. Now `35 KB / 711 LOC`, still under 50 KB SUPER_ENGINE §H budget.

### Verified (node smoke tests)
- `datacenterBuildCost(10, 3, 'US') = $105M`; `…'APAC' = $47.25M` (regional scaling correct).
- `mepDistribution(100M, 3) = $42M` (42% of capex).
- `powerCostAnnual(10MW, 1.4, $0.12, 8760h) = $14.72M`.
- `coolingEfficiency('temperate', 12) = 0.84`.
- `staffingCostAnnual(20, 'US', 'dcTechMid') = $1.95M` (20 × $75,100 × 1.30).
- `lifecycle(150M, 8M, 10yr, 40%) = $350M`.
- `pueFromInputs(8000, 11200) = 1.400`; `dcie(1.4) = 71.4%`.
- `ui.badge`, `ui.kpiCard`, `ui.gateOverlay`, `ui.glossaryAnchor` all return well-formed HTML strings.

### Status
All 4 math domains (workforce / capex / opex / tco / pue / roi / forecast) and core UI primitives now live in the engine. **Phases S0–S2, S4, S5, S6 of SUPER_ENGINE.md are SHIPPED** (S3 PDF consolidation deferred to remote agent on 2026-05-05).

## [2026-04-28e] — Super Engine S2 (workforce + ROI + forecast models) + modal helper

### Added
- **`RZEngine.models.workforce`** — `annualHiresRequired`, `attritionCost`, `strategyFitScore`, `cumulativeHires`, `yearsToCloseGap`. Closed-form math, defaults pulled from `RZEngine.data.attritionFactors` so a single benchmark refresh propagates to every workforce calculator.
- **`RZEngine.models.roi`** — `paybackPeriod`, `npv` (with discount rate), `irr` (bisection over [-0.99, 10]).
- **`RZEngine.models.forecast`** — `compoundGrowth`, `linearTrend` (returns `{slope, intercept, predict}`), `projectByYear` (year-by-year array).
- **`RZEngine.modal.create({id, title, accentColor, subtitle, bodyHTML, submitLabel, onSubmit})`** — singleton modal helper. Auto-injects backdrop with `rgba(0,0,0,0.85)` + `backdrop-filter:blur(8px)` per PRO_MODE standard. Returns `{show, hide, destroy}` controls. Reuses existing element on repeat calls (idempotent).
- Engine bumped to `v1.1.0`.

### Changed
- **article-27 IIFE** now calls `RZEngine.models.workforce.attritionCost(...)` and `RZEngine.models.workforce.annualHiresRequired(...)` for the corresponding KPIs (with hardcoded fallbacks if engine missing). This is the first calculator on the site to share math via the engine, not just constants.

### Verified
- Node smoke tests pass: `annualHiresRequired(25,35,25,5)=9`, `attritionCost(25,25,75100)=$999,769`, `paybackPeriod(100K,30K,5K)=4 yr`, `npv([-100,40×4],0.10)=$26.79`, `compoundGrowth(75100,0.025,5)=$84,969`, `linearTrend(slope=2)`.
- localhost: `rz-engine.js` now `23 KB / 499 LOC` (well under 50 KB budget per SUPER_ENGINE §H).

## [2026-04-28d] — Super Engine S0 + S1 Shipped (skeleton + auth + data + format + events)

### Added
- **`rz-engine.js`** at repo root (~290 LOC, 12 KB unminified, vanilla ES5/ES6, zero deps).
  Implements Phases S0 + S1 of `standarization/SUPER_ENGINE.md`:
  - `RZEngine.data` — single source of truth for `version`, `lastUpdated`, `years` (2025–2030),
    `baselineYear`, `regions` (US/EU/APAC/LATAM with salaryMult/powerKwh/currency),
    `currency`, `inflationAnnual`, `salaryBenchmarks` (dcTechMid, electricianJourneyman, cdfomSenior),
    `attritionFactors` (replacementCostMult, voluntaryAttritionAvg, apprenticeRetention),
    `pueDefaults` (air/liquid/immersion Tier-3 baselines).
  - `RZEngine.auth.{VALID_USERS, validateLogin, getSession, setSession, logout, dispatchAuthChange, onAuthChange}`
    — auth.js-compatible session format, accepts both `{expires:ISOString}` and legacy `{exp:number}`.
  - `RZEngine.format.{currency, percent, number, weeks, months, ymd}` — display helpers.
  - `RZEngine.events.{dispatch, on, off}` — generic CustomEvent bus.
  - Stubs for `RZEngine.{models, modal, pdf, charts, ui}` filled in S2–S6.
- Script tag added to `article-27.html` (after auth.js, before script.min.js) and `article-26.html` (after auth.js).

### Changed
- **article-27 pilot** (S0 first consumer):
  - `wsCheckSession` now delegates to `RZEngine.auth.getSession()` with legacy fallback.
  - `REGION_MULT` and `REGION_LABEL` derived from `RZEngine.data.regions` at IIFE init (with hardcoded fallback if engine missing).
  - `avgSalary` baseline pulled from `RZEngine.data.salaryBenchmarks.dcTechMid.US` ($75,100, was hardcoded $72,000 — refresh to 2024 BLS / Uptime number).
  - `replacementFactor` pulled from `RZEngine.data.attritionFactors.replacementCostMult` (213%).
- Constants are now editable in ONE place (`rz-engine.js`) and propagate to article-27. Future migrations move article-26 + standalone calculators to the same engine in subsequent phases.

### Verified
- Node smoke test: `RZEngine.auth.validateLogin('demo@resistancezero.com','demo2026')` returns `{email, tier:'pro', role:'demo'}`; bad password returns `null`.
- localhost: `art-27=200, art-26=200, rz-engine.js=200 (12KB)`.

## [2026-04-28c] — Modal + Auth Hotfix + Super Engine Design

### Fixed
- article-27 + article-26 modal backdrop now `rgba(0,0,0,0.85)` + `backdrop-filter:blur(8px)` (was `rgba(0,0,0,0.7)` no blur — caused article body to bleed through behind the Pro Analysis modal).
- article-27 IIFE now listens for `rz-auth-change` event so navbar login propagates to the embedded calculator without a page reload. Also fixed a session-format mismatch: IIFE was reading `sess.exp` (numeric timestamp) while `auth.js` writes `sess.expires` (ISOString) — IIFE now accepts both formats. Local IIFE login now writes the auth.js-compatible format and emits `rz-auth-change` so the navbar reflects the login state immediately. (Article-26 already had this listener; only the modal fix applied there.)

### Added
- `standarization/SUPER_ENGINE.md` — master architectural design unifying `CALC_ENGINE_PLAN.md` (plumbing) and `CALC_MODELS_PLAN.md` (math) under a single `window.RZEngine.*` API. Documents the **"Shared Anchor Parameters"** rule: even when a new calculator is custom-built, parameters like Target Year, Region, Currency, Inflation, salary benchmarks, attrition factors, PUE defaults, and power costs MUST be sourced from `RZEngine.data` rather than inlined. Includes 6-phase rollout (~10–11 weeks), versioning discipline, consumer template, DCMOC relationship, failure modes, and 5 open questions for review before S0 starts.
- Cross-references: `CALC_ENGINE_PLAN.md` and `CALC_MODELS_PLAN.md` now declare `SUPER_ENGINE.md` as their parent vision.

## [2026-04-28b] — Article-27 Polish + Calc Models Roadmap

### Fixed
- article-27 dark-mode group-header badges (CREATE/SUBSTITUTE/EXTEND) now have `[data-theme="dark"]` overrides; they were the empty-rectangle badges visible at the top of each strategy group in earlier dark-mode screenshots.

### Changed
- article-27 calculator expanded from 8 → 12 inputs and 7 → 10 KPIs.
  - New inputs: **Target Year (2025–2030)**, **Region (US/EU/APAC/LATAM)**, **Workforce Mix (Physical-heavy/Balanced/NOC-heavy)**, **Risk Tolerance (Conservative/Balanced/Aggressive)**.
  - New KPIs: Annual Hires Required, Cumulative Hires by [Target Year], Years to Close Gap.
  - Cost-related KPIs now scale by region multiplier (US 1.00 / EU 0.85 / APAC 0.45 / LATAM 0.55).
  - 5-Year Investment renamed to N-Year Investment, length driven by Target Year.
  - Narrative auto-references Target Year, Region, Workforce Mix, and Risk Tolerance.
- article-27 added a 5th Pro panel: **Year-by-Year Hiring Trajectory** chart (multi-line: Remaining Staff Gap, Cumulative Hires, Strategy Capacity with maturity ramp).
- article-27 PDF export now includes the new KPIs and Target Year/Region in the header.
- article-27 in-prose first occurrences of `AIOps`, `NOCaaS`, and `apprenticeship` now link to `glossary.html#term-[slug]` per the new glossary workflow.

### Added
- `standarization/CALC_MODELS_PLAN.md` — sibling roadmap to `CALC_ENGINE_PLAN.md` covering the **calculation math layer** (`CalcModels.{workforce, capex, opex, roi, tco, pue, forecast}` plus `CalcModels.data` for shared constants like salary benchmarks, region multipliers, attrition factors). 4-phase rollout. Closes user concern about scattered math without a "big engine" for shared parameters.
- Cross-reference between `CALC_ENGINE_PLAN.md` and `CALC_MODELS_PLAN.md`.

## [2026-04-28] — Glossary Sync, Standards & Calculator Engine Roadmap

### Added
- 21 new glossary entries in `glossary.html` covering articles 23–27 domain
  vocabulary (AIOps, Apprenticeship, BICSI RCDD, Capacity Auction, CDCTP,
  Colossus, DCDC, Digital Twin, Galden HT, Interconnection Queue, Lights-Out
  DC, Maintenance Vapor Release, Megapack, Memphis Turbine Deployment, NOCaaS,
  Novec 7000, PFAS, PJM Interconnection, Reliability Pricing Model, Reserve
  Margin, Spectrum-X, Two-Phase Immersion Cooling). Each entry links back to
  its originating article via `term-links`. Total terms: 300 → 321.
- `CHANGELOG.md` (this file) — establishes the maintenance log.
- `standarization/CALC_ENGINE_PLAN.md` — 4-phase consolidation roadmap to
  extract ~5,800 LOC of duplicated auth, login modal, PDF export, and
  Chart.js setup code from 18+ calculator pages into a shared
  `calc-engine.js`. References DCMOC's TypeScript engine pattern as the
  architectural model.
- `standarization/TOOLTIP_STANDARD.md` new section: "Glossary Maintenance
  Workflow" — every new article must add 5+ glossary entries with
  `term-links` back to the article; in-prose first-occurrence terms link to
  `glossary.html#term-[slug]`.
- `standarization/article prompt/ARTICLE_CREATION_PROMPT.md` checklist 9.7:
  glossary update items added.
- Cross-reference notes in `AUTH_STANDARD.md`, `CALCULATOR_PROMPT_STANDARD.md`,
  `PRO_MODE_STANDARDIZATION.md`, and `PDF_EXPORT_STANDARD.md` pointing to
  `CALC_ENGINE_PLAN.md` so future calculator work consults the consolidation
  roadmap before adding more inline duplication.

### Changed
- Expanded existing `term-novec` entry to clarify Novec 1230 vs Novec 7000
  (different products) and added a new `term-novec-7000` entry.

---

## [2026-04-27] — Article 23–27 References + Standards Update

### Added
- References sections (academic format) for articles 23–27 with 12–25 cited
  primary sources each, linking to Uptime Institute, AFCOM, McKinsey, EPA,
  FERC, NERC, IBEW, NVIDIA, Microsoft, Google, and other authoritative sources.
- `assets/article-27-hero.webp` (1200×509 WebP @ q80, 60 KB).
- `ARTICLE_CREATION_PROMPT.md` §3.8 References pattern (mandatory) and
  checklist 9.6 — closes the standards gap that allowed articles 23–27 to ship
  without references.

### Fixed
- `article-27.html` dark-mode badge classes (12 classes covering CREATE/SUB/
  EXTEND, speed tiers, and cost tiers) now have `[data-theme="dark"]`
  overrides for readability.
- `article-26.html` series-nav next link now points to `article-27.html`.
- `article-24.html` SEO `<title>`, `og:title`, JSON-LD headline, share title,
  and H1 lead with "Data Center Manpower Shortage" for crawler clarity.
- `articles.html` updated with article-27 card, article-24 title fix, and
  structured-data headline updates.

---

## [2026-04-12] — Article 27 Published

### Added
- `article-27.html` — "No Humans, No Data Centers: 20 Strategies to Solve the
  AI Workforce Crisis" (Global Analysis series, 2,258 lines, ~133 KB).
- Embedded Workforce Strategy Planner calculator: 8 free inputs → 6 KPIs +
  narrative; 4 Pro panels (radar comparison, 36-month HTML Gantt chart,
  year-by-year cost stacked bar, ROI projection line); auth via shared
  session pattern; PDF export via `window.open()`.
- 25 reference citations (academic format).
- Article-27 card on `articles.html` (gradient styling matching Global
  Analysis red).

---

## Earlier history

For changes before 2026-04-12, refer to `git log` and the per-session memory
files in `~/.claude/projects/-home-baguspermana7/memory/`. This CHANGELOG was
introduced on 2026-04-28; older changes were not retroactively recorded.
