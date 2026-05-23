# Documentation Propagation Pass — v1.32.5 Handoff

**Date**: 2026-05-24
**Trigger**: Owner mandate (handoff rule, locked 2026-05-23) — every comment / task / review note MUST be propagated to memory + standarization/ + CHANGELOG + handoff docs.

---

## What changed in this pass

### 1. Post-draft folders (per `POST_DRAFT_STANDARD.md`)

NEW draft folders in `Article/Post Draft/`:

| Folder | Files | Page covered |
|--------|-------|--------------|
| `AI Maintenance/` | 11 (linkedin, medium, x×3, mastodon×3, facebook, quora, tiktok-script) | `ai-engineering-maintenance.html` |
| `BMS Cockpit/` | 4 (linkedin, medium, x-post-1, mastodon-1) | EPMS / chiller / fire / fuel / water / ict / carbon / datahallAI / dc-conventional / datahall cluster |
| `LTC Lab/` | 4 (linkedin, medium-stub, x-post-1, mastodon-1) | `standards-ltc-lab.html` + 6 sub-pages |
| `CX Calculator/` | 3 (linkedin, x-post-1, mastodon-1) | `cx-calculator.html` |
| `Pillar Pages/` | 3 (linkedin, x-post-1, mastodon-1) | `pillar-power/cooling/fire/standards/sustainability` |

**Total: 25 draft files across 5 folders.** All conform to POST_DRAFT_STANDARD char limits.

### 2. New standarization docs

| Doc | Purpose |
|-----|---------|
| `POST_DRAFT_STANDARD.md` | Codifies per-page draft-folder mandate + per-platform char limits + voice |
| `KNOWLEDGE_BASE_STANDARD.md` | Codifies `docs/research/` layout + CSV schema + confidence tiers |
| `KNOWLEDGE_LABS_STANDARD.md` | Codifies the NEW Knowledge Labs section on `datacenter-solutions.html` (replaces the 7th-card-on-Cost-Calculators error from the Network Hub plan) |

### 3. Research deliverable wired into the live page

`ai-engineering-maintenance.html` gains a new Section 9 — Knowledge Base — surfacing:
- 20 asset families / 109 fault modes / 834 KG-ready rows / 46 primary citations
- Four headline findings (54% outages power-related, <10s liquid-cooling ride-through, VRLA Arrhenius, RPN=200 diesel microbial)
- Confidence-tier breakdown (high / medium / thin)
- CSV inventory table
- NEW Gap #13 — Liquid-cooling fault-mode telemetry below industry benchmark
- Direct link to the research report + CSV files + KNOWLEDGE_BASE_STANDARD.md

### 4. Vendor-outreach handoff doc

`docs/handoff/2026-05-23-fmeca-vendor-outreach.md` lists 14 vendors across 4 thin-data gaps (Vertiv, CoolIT, Asetek, Boyd, Starline, Schneider, Eaton, Siemens, Trane, York, Daikin, Piller, Hitec, Active Power) with outreach playbook + reply-window estimates + tracking table.

### 5. Network Visualization Hub plan — review-cycle complete

Code-reviewer verdict: REWORK (1 CRITICAL on module-loading pattern). UIUX-reviewer verdict: APPROVE_WITH_NOTES.

Plan v2 rewrite is **deferred to a separate commit** (large rewrite). The review findings are now memory-saved so the next session can execute the v2 rewrite cleanly.

---

## Files changed

```
NEW   standarization/POST_DRAFT_STANDARD.md
NEW   standarization/KNOWLEDGE_BASE_STANDARD.md
NEW   standarization/KNOWLEDGE_LABS_STANDARD.md
NEW   Article/Post Draft/AI Maintenance/ (11 files)
NEW   Article/Post Draft/BMS Cockpit/ (4 files)
NEW   Article/Post Draft/LTC Lab/ (4 files)
NEW   Article/Post Draft/CX Calculator/ (3 files)
NEW   Article/Post Draft/Pillar Pages/ (3 files)
NEW   docs/handoff/2026-05-23-fmeca-vendor-outreach.md
NEW   docs/handoff/2026-05-24-doc-propagation-pass.md
NEW   docs/research/2026-05-23-fmeca-kg-worldwide-asset-failure-data.md (researcher)
NEW   docs/research/csv/{components,faults,failures,actions,mechanisms,effects,steps,sod_rpn}.csv (834 rows)
NEW   docs/plans/2026-05-23-network-visualization-hub.md (plan v1; v2 rewrite pending)
EDIT  ai-engineering-maintenance.html (+~85 lines, new Section 9)
EDIT  CHANGELOG.md (prepend v1.32.5 entry)
EDIT  js/rz-version.js (1.32.0 → 1.32.1)
EDIT  sw.js (cache-name bump rz-cache-v1.32.0 → rz-cache-v1.32.5)
```

---

## What's NOT in this pass (deferred)

- **Network Visualization Hub plan v2** — needs ~500-line rewrite incorporating all CRITICAL/HIGH review findings (D-1 IIFE pattern, D-3 Knowledge Labs section, D-4 SFX register fixes, D-5 rest/graphql/grpc split, D-6 SFX taxonomy expansion). Next session.
- **OG images for the AI Maintenance research surfacing** — none of the new draft folders ship new HTML pages, so no new OG cards needed.
- **Sitemap / search-index / llms.txt updates** for the research deliverable — research markdown is at `docs/research/` which is a Documents folder, not a public navigation target. Reachable via the link in Section 9 of the AI Maint page.
- **`spares-readiness-calculator.html` draft refresh** — engine evolved v1.11→v1.16; existing drafts are stale. Flagged in memory for next session.
- **CONTENT_LINKAGE_PLAYBOOK update** — adding the post-draft mandate as a step. Next session (small edit, but out of scope here).
- **Articles 23-27 draft-folder content check** — folders exist but may be empty. Sweep next session.

---

## Next-session checklist

When the next session starts, walk these in order:

1. Read `MEMORY.md` index, especially `project_rz_bug_request_tracker.md` (PENDING/SOLVED list)
2. Read `docs/handoff/2026-05-24-doc-propagation-pass.md` (this doc) — full state of v1.32.5
3. Read `docs/handoff/2026-05-23-fmeca-vendor-outreach.md` — tracking table for vendor outreach
4. Read review findings in memory (`project_network_hub_plan_v2.md`) — gating decisions for Phase 0
5. Confirm D-1 through D-6 owner decisions before writing Network Hub plan v2
6. Start the spares-readiness-calculator draft refresh
7. Sweep Articles 23-27 draft folders for content
8. Check on AI Maintenance Section 9 — confirm it renders correctly (Pro / Educator / Root accounts)

---

## Cross-references

- `POST_DRAFT_STANDARD.md` — the new draft-folder mandate
- `KNOWLEDGE_BASE_STANDARD.md` — the new research-deliverable mandate
- `KNOWLEDGE_LABS_STANDARD.md` — the new DC Solutions section structure
- `CONTENT_LINKAGE_PLAYBOOK.md` — needs post-draft step added (deferred)
- `VERSIONING_STANDARD.md` — v1.32.5 follows PATCH semver (doc-only)
- `CHANGELOG.md` — v1.32.5 entry
