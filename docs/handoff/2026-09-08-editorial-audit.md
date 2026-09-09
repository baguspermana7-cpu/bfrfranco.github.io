# In-progress editorial audit handoff

Repository: `/home/baguspermana7/rz-work`, branch `fix/ship-gate-automation`.

The owner requested a whole-site anti-vibecode and article-readability audit, explicitly including containers, whitespace, sitemap and robots. The primary Codex task owns the editorial CSS/runtime, article prose, decorative CSS source sweep, crawler inventory and audit tooling currently dirty in this shared checkout.

## Concurrent ownership

- The separate Claude task owns DC AI network sub-tabs in `datahallAI.html` and its declared version/release bundle. This audit does not authorize committing or publishing those changes, and does not overwrite them.
- Do not stage this audit's files into another task. Do not use `git add -A` or an indiscriminate cleanup.
- This audit is local and unshipped. Version/changelog/service-worker synchronization must be reconciled after the concurrently owned release bundle settles.
- Browser sweeps are serial. The full route audit writes to `/tmp/rz-site-audit`; pending, filtered and gated rows are not passes.

## Evidence and acceptance

Plan and owner refinements: `docs/plans/2026-09-08-editorial-site-audit.md`.

Focused regression: `node tools/test-editorial-reading.mjs` covers immediate prose visibility, readable text size, modern color spaces, nested opaque and gradient-backed instrument preservation, theme-change resampling and keyboard-accessible mobile contents.

The old static audit baseline was 273 monitored file/rule findings across 172 files despite exit 0. A clean static result is not evidence that all visual states or all writing have been approved. Final closure requires the route manifest, current browser evidence, prose-review coverage and crawler consistency results.

## Integration checkpoint

- 35 article-family files received a targeted editorial pass (openings, headings, endings and flagged interior prose), not full fact verification. Evidence: `/tmp/rz-prose-handoff.md`; technical numbers, source links, IDs and executable scripts were checked for preservation.
- The primary agent additionally simplified article 1's redundant introduction note and assessment callout. Only its decorative mouse-hover translation handlers were intentionally removed; assessment navigation remains an ordinary anchor.
- Independent review found two runtime/test defects: background-transition sampling could lose flattening after a theme switch, and the test inspected the hidden contents heading. Both now have focused regression cases and implementation repairs.
- Crawler inventory reconciles 299 tracked HTML paths into 180 included URLs, 72 noindex pages and 47 explicitly excluded paths. Independent review found whole-content extraction, hub gate-classification and body-level noindex edge cases. All three were repaired with RED/GREEN cases; 32 crawler tests passed. Gate-protected exports retain metadata only for 44 pages.
- Search descriptions, current article titles and 355 section entries were refreshed. Articles 2–8 previously had unrelated historic titles in the search index; user-visible sibling labels require the corresponding cross-link audit.
- Shared asset references use `20260908-editorial`. The separately owned `datahallAI.html` and generated `changelog.html` consumer tokens remain a coordination item; minified stylesheet freshness was checked.
- Initial render runs are superseded, not passes: the first probe had clipping false positives; the following run lost its local HTTP server. Preserve their evidence and use only a successful post-fix rerun for product conclusions. The restored server is bound to `127.0.0.1:8093` with its PID recorded in `/tmp/rz-editorial-http.pid`.

## Subsequent review repairs

- The remaining mobile double hero gutter and article 28 desktop hero-container mismatch were corrected and added to the focused browser fixture. Source review confirmed both selectors; current-site rendering remains a separate gate.
- Incorrect historic article 2–8 search titles were corrected. Five related-card labels were repaired, and article 19's unrelated cybersecurity link to article 5 was removed without changing its surrounding claim.
- Article 1 no longer presents UPS bypass as the default reliable operating state. Its opening now describes protected power and stored energy without prescribing a switching mode. Technical basis: [Eaton UPS topologies](https://www.eaton.com/us/en-us/products/backup-power-ups-surge-it-power-distribution/backup-power-ups/types-of-ups-systems.html) distinguishes normal online operation from topology-dependent ECO operation; [Eaton UPS fundamentals](https://www.eaton.com/us/en-us/products/backup-power-ups-surge-it-power-distribution/backup-power-ups/uninterruptible-power-supply-faq.html) describes maintenance bypass separately. This correction is not a claim that all article facts have been revalidated.
- Article 9's related-rail thumbnail used two nonexistent generated URLs. The runtime now uses its existing `assets/article-9-cover_.webp` asset, with a regression assertion.
- First accessibility sweep found seven serious contrast failures in articles 13 and 26. Back-link, formula, light accent and dark citation ink were corrected; the rerun result must be recorded before closing these findings.
- Static validation checkpoint: 35 Node fixtures and 32 crawler tests passed; seven minified twins matched freshly built sources. Script-token, inline JavaScript syntax, version, static mobile, chart provenance, page access and hero loader gates passed. Their differing inventory sizes and noindex exclusions must not be summed into a whole-site visual claim.
- Real-input interaction gate passed: command palette on two pages, living diagrams on two pages, forward/reverse scrollytelling, heading anchors and reading progress.
- Screenshot review caught article 28's mobile category under the fixed navbar despite a probe PASS. Authoritative hero block padding and a regression assertion now cover that legacy shorthand; the render probe is being extended. Top-level static evidence/statistic bands were restyled as neutral reading summaries, not colored card grids. Inner functional diagrams and controls remain separate.
- Article 15's unchanged service model contains 135 services in 11 categories, with 43 high, 47 medium and 45 low revenue tags. Metadata, visible filters and related consumers were reconciled. Incorrect baked-in cover/infographic assets remain archived but are no longer active article visuals; a semantic summary replaces the obsolete infographic, and count-free site artwork replaces its social/rail image.
- Future Forward 2 and 3 now use titles consistent with their bodies. Twenty-seven stale subsection labels in articles 10/11 were corrected; IDs and technical values were retained.
- Series navigation is checked against the published article index, including previous tail links. Four regression tests passed. Thirty search publication dates and 25 displayed reading times were synchronized without inventing new dates or rates. Article 28's mismatching Open Graph timestamps were aligned with its existing visible and JSON-LD July 22 date.
- Independent review found audit integrity defects: stale-source resume reuse, missing-artifact aggregate PASS, suppressed CSP console failures and application errors misclassified as server outages. These audit-tool repairs require their own fixtures and review before a matrix can be trusted.
- Those audit integrity repairs now have schema-2 source/options/inventory fingerprints, validated artifact identities/status/screenshots, strict merge compatibility and explicit environment classification. The latest browser-free combined suite passed 66 tests; later probe calibration has additional cases. Audit output, caches and credential files are not treated as render sources, while real design-token files remain fingerprinted.
- Accessibility rerun passed all 8 representative pages in both themes with zero critical/serious findings (`/tmp/rz-site-audit/a11y-after-raman.log`). The 161-page dark gate also printed CLEAN, but an overlapping external browser job means serial-run validity remains UNVERIFIED; this is not represented as an uncontaminated gate pass.
- The first schema-2 matrix exposed undersized nested case-study paragraphs, quotations and conclusions. A bounded reading-text normalizer now enforces a 16px floor and sufficient leading outside instrument/chart/caption/navigation contexts, across every `.article-body`. Its regression was observed RED at 14px and GREEN at 16px, with chart annotations preserved. Independent source review approved the helper and resize/theme handling.
- Related-rail titles now wrap completely instead of clipping at three lines. Reference grids have shrinkable tracks and long-source wrapping; article 8 and article 13 received local mobile fixes, and article 9's humidity tracks retain all original values while giving labels enough horizontal space.
- Affected FF2/FF3 social artwork also contained obsolete headlines. Active social image references now use existing neutral site artwork; neutral body covers and archival assets are retained.
- The current whole-route exercise remains diagnostic until a frozen-input final run completes. Source changes, filtered pages, gate-blocked content, missing evidence and environment failures cannot be converted into approval by report merging.
