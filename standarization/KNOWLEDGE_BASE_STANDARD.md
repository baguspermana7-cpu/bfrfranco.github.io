# KNOWLEDGE BASE STANDARD

> **Status**: Active · v1 · 2026-05-24
> **Scope**: Research deliverables, citation-backed datasets, and curated
> reference material that lives under `docs/research/` and feeds engine
> features (FMECA-KG, calculator parameter banks, gap-analysis sections).
> **Mandate**: Codifies the layout established by the 2026-05-23 worldwide
> FMECA dataset (109 fault modes, 834 KG-ready rows, 46 primary citations).

---

## Folder layout

```
docs/research/
├── YYYY-MM-DD-<topic-slug>.md       # the report
├── csv/                              # KG-ready seed data
│   ├── <noun>.csv                    # one file per node-or-relationship type
│   └── ...
└── (optional) attachments/           # supplementary PDFs, NOT committed if licensed
```

## Report frontmatter (required)

Every research markdown must open with:

```markdown
# <Title>

**Date**: 2026-05-23
**Researcher**: <agent-id or human name>
**Sponsor**: <feature this feeds — e.g. ai-engineering-maintenance>
**Confidence**: <executive-summary single line>
**Citation count**: <N primary + N secondary>
**Asset/topic families covered**: <N>
**Seed-data rows shipped**: <N across N CSVs>
```

Then a 200-300 word executive summary, then sections.

## CSV seed-data discipline

Every CSV must:

1. Have a header row with `snake_case` column names.
2. Be UTF-8 encoded, LF line endings, no BOM.
3. Be importable as-is into Neo4j via `LOAD CSV WITH HEADERS`.
4. Use stable identifiers (e.g. `F11.2` for "Fault 11.2") that map to the
   markdown report's section numbering.
5. Cite source in a `source_ref` column (e.g. `CIGRE TB-642 §5.2`).
6. Carry a `confidence_tier` column with values `high` / `medium` / `thin`.

## Confidence tiers

> **v1.41.6 — advisory-only governance (review-v3 P0.5)**: the `high` tier
> previously read *"Auto-action allowed within RPN thresholds"*. That wording
> directly contradicted the page-level advisory-only safety posture and the
> production roadmap. Now corrected: **no tier ever permits autonomous
> actuation**. AI is advisory-only by default; physical control remains in
> SIS / protection relays / BMS engineered sequences (IEC 61508 / 62443).

| Tier | Definition | Engine treatment |
|------|------------|------------------|
| `high` | ≥2 independent peer-reviewed or industry-databook sources | **Eligible for draft recommendation and draft work-order only.** Human approval required before any operational action. No autonomous actuation. |
| `medium` | 1 primary + ≥1 secondary; or vendor white paper + 1 standard | **Reliability engineer review required** before draft work-order is proposed. Analysis-only otherwise. |
| `thin` | Single source or vendor-confidential estimate | **Analysis-only.** Vendor outreach / second source required before any recommendation. No draft work-order. |

Thin-data flags MUST be surfaced on the consuming page (gap section)
so users understand the dataset's edges.

## Citation discipline

- Primary sources: peer-reviewed (IEEE, IET, ASHRAE Transactions),
  standards bodies (NFPA, IEC, ISO, ASME, NETA), industry databooks
  (NPRD, EPRD, FMD, OREDA, IEEE 493, MIL-HDBK-217F), CIGRE Technical
  Brochures.
- Secondary sources: trade press, vendor white papers, OEM bulletins,
  reputable web technical articles. Acceptable but tier-flagged.
- Forbidden: AI-generated summaries, unattributed forum posts, blog
  posts without primary citation.

## Refresh cadence

A knowledge-base dataset goes stale. Default cadence:

- **Standards-derived data** (NFPA, IEC, ISO, ASHRAE): annual review,
  refresh on standard revision.
- **Vendor bulletins / OEM advisories**: quarterly scan.
- **Industry-databook MTBF**: every 3 years (databooks update on that
  cadence).
- **Outage statistics (Uptime, etc.)**: annual refresh on January-February
  when new annual reports drop.

A scheduled routine (Claude routine or cron) should fire the refresh and
PR the diff for human review.

## Site integration

A research deliverable lands on the site as:

1. The `.md` file at `docs/research/...` — readable via direct URL.
2. An entry in `llms.txt` for LLM crawler discovery.
3. An entry in `sitemap.xml` with `priority="0.6"` (research is
   high-signal but not top-level navigation).
4. An entry in `search-index.json` for in-site search.
5. (Optional) a curated copy at `Documents/Training/<topic>.md` so the
   PRO PDF generator can include it.
6. A surfaced section on the consuming page with the headline findings
   and a `<details>` accordion linking to the full report.

## Privacy / licensing

If any source is licensed (purchased databook, NDA OEM data), it MUST be:

- Excluded from the public CSV.
- Recorded in a private internal note (NOT in the public repo).
- Cited by name only, not reproduced.

The standard is: every byte committed to the public repo is
public-redistributable.

## Reference example

The 2026-05-23 FMECA dataset is the canonical reference for this standard:

- `docs/research/2026-05-23-fmeca-kg-worldwide-asset-failure-data.md`
- `docs/research/csv/{components,faults,failures,actions,mechanisms,effects,steps,sod_rpn}.csv`

Layout, citation discipline, confidence tiers, and site integration all
follow the rules above.

---

## Changelog

- **v1 — 2026-05-24** — Codified after the worldwide FMECA dataset shipped.
  Captures the layout that worked on first attempt.
