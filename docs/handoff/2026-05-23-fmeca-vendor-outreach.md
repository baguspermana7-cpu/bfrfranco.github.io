# FMECA-KG Vendor Outreach — Handoff

**Date**: 2026-05-23
**Sponsor**: AI Engineering Maintenance concept page (v1.32.0+)
**Goal**: Close the four thin-data gaps surfaced by the worldwide FMECA dataset research run.

---

## Thin-data gaps (from `docs/research/2026-05-23-fmeca-kg-worldwide-asset-failure-data.md`)

| # | Domain | Why thin | Primary source today |
|---|--------|----------|----------------------|
| 1 | Liquid cooling (DLC + immersion) | Emerging tech; primary literature limited | ASHRAE TC 9.9 + OCP + 1 ASME paper |
| 2 | Busway | Manufacturer-confidential MTBF | Starline / Universal Electric brochures |
| 3 | Magnetic-bearing chillers | Vendor-stated MTBF, not independently audited | Trane Agility / York YZ / Daikin Magnitude white-papers |
| 4 | Flywheel UPS | 2 primary vendor white-papers only | Active Power WP-111, Piller |

---

## Outreach targets

### Gap 1 — Liquid cooling
- **Vertiv** — DLC product line manager; ask: MTBF + dominant fault modes for Liebert XDU + XDR + AFC families
- **CoolIT Systems** — RP-CDU MTBF, leak-rate statistics from field deployments
- **Asetek** — SimpleCDU + RackCDU field failure modes, drip-tray activation rate
- **Boyd / Aavid** — Cold plate manufacturing-defect rates, weld-failure return-merchandise data

### Gap 2 — Busway
- **Starline (Universal Electric)** — Track busway plug-in tap failures, contact wear, IR thermography findings from field
- **Schneider Electric (Canalis)** — Joint failure modes, IR-anomaly statistics
- **Eaton (Pow-R-Way III)** — Mechanical fatigue on >5-year installations
- **Siemens (LD-LX-XJ)** — Hot-spot detection thresholds

### Gap 3 — Magnetic-bearing chillers
- **Trane (Agility)** — Bearing-control PCB failure history; rotor-position-sensor MTBF
- **York / Johnson Controls (YZ)** — Inverter section failure modes; magnetic-bearing reset frequency
- **Daikin (Magnitude)** — Compressor housing fatigue; sealing failures

### Gap 4 — Flywheel UPS
- **Piller (PowerBridge)** — Rotor-bearing service-life data; high-speed bearing inspection cycle findings
- **Hitec Power Protection (DRUPS)** — Diesel-rotary failure-mode breakdown
- **Active Power (CleanSource)** — Flywheel containment integrity; rotor-burst probability bounds

---

## Outreach playbook

### Phase 1 — initial contact
- Identify product manager or applications engineer per vendor
- LinkedIn DM + cold email
- 2-line pitch: research run for an open-source KG seeding the AI Engineering Maintenance concept; happy to credit vendor / link the page
- Attach link to `ai-engineering-maintenance.html` and `docs/research/` summary

### Phase 2 — NDA
- Most vendors will gate detailed MTBF data behind NDA
- Standard mutual NDA template (legal to draft)
- Aggregate-only data redistribution clause (no per-serial-number data in the KG)

### Phase 3 — data normalisation
- Receive vendor data in any format
- Normalise to the `KNOWLEDGE_BASE_STANDARD.md` CSV schema
- Tag every row with `source_ref` = `<vendor> NDA-<date>`
- Set `confidence_tier` = `medium` (single-source vendor data) unless corroborated by a second source

### Phase 4 — graph ingestion
- Run through the same CSV loader used for the public dataset
- Tag faults touching this data with a `provenance` property = `vendor-nda`
- Surface a "Vendor data behind this recommendation" indicator on UI nodes

---

## Expected reply window

| Vendor | Likely response time | Notes |
|--------|---------------------|-------|
| Vertiv | 2-4 weeks | DLC team is active; OCP-aligned |
| CoolIT | 1-3 weeks | Smaller team; faster |
| Asetek | 2-4 weeks | EMEA-based |
| Boyd / Aavid | 4-6 weeks | Largest org; slowest |
| Starline | 2-4 weeks | Long-relationship account-based |
| Schneider Canalis | 4-8 weeks | Large legal team |
| Eaton | 4-6 weeks | |
| Siemens | 4-8 weeks | Large legal team |
| Trane | 4-8 weeks | |
| York | 4-8 weeks | |
| Daikin | 6-10 weeks | Japan HQ approvals |
| Piller | 2-4 weeks | EMEA, smaller |
| Hitec | 4-6 weeks | |
| Active Power (Caterpillar) | 4-8 weeks | Acquired by Cat |

---

## Risk register

| Risk | Mitigation |
|------|-----------|
| Vendor refuses to share | Note "vendor-declined" in confidence column; carry on with public data |
| Data quality below ASHRAE TC 9.9 / OCP benchmark | Flag in UI; do not auto-action recommendations from low-quality vendor data |
| NDA prevents naming the source | Cite as `OEM-A` / `OEM-B`; track real identity in private internal note |
| Vendor data conflicts with public source | Document the conflict; keep both rows with separate `source_ref`; let engine handle confidence weighting |

---

## Tracking

This handoff doc is the source of truth. Update the table below as outreach progresses:

| Vendor | Contacted | Replied | NDA signed | Data received | Ingested | Notes |
|--------|-----------|---------|------------|---------------|----------|-------|
| Vertiv | ☐ | ☐ | ☐ | ☐ | ☐ | |
| CoolIT | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Asetek | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Boyd / Aavid | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Starline | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Schneider Canalis | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Eaton | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Siemens | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Trane | ☐ | ☐ | ☐ | ☐ | ☐ | |
| York | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Daikin | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Piller | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Hitec | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Active Power (Caterpillar) | ☐ | ☐ | ☐ | ☐ | ☐ | |

---

## Cross-references

- `docs/research/2026-05-23-fmeca-kg-worldwide-asset-failure-data.md` — the dataset that flagged these gaps
- `standarization/KNOWLEDGE_BASE_STANDARD.md` — CSV schema + confidence tier rules
- `ai-engineering-maintenance.html` — surfaces this handoff in Section 9 / Gap #13
