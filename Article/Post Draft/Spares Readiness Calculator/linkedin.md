# LinkedIn — Spares Readiness Calculator (v1.16 engine refresh)

**Format**: long-form post · engineer-to-engineer · ≤3000 chars
**Tags**: #DataCenter #SparesManagement #Reliability #SupplyChain #DCM&E
**Refreshed**: 2026-05-25 — engine has evolved v1.11 → v1.16 since the original drafts. Distinctive trait list updated below.

---

Most data center spare-parts programs are consumption-driven. You stocked what failed last time. That works fine until you get a fault mode you have never seen before — which is exactly how critical infrastructure fails.

The programs I have audited across hyperscale and colo sites share three gaps: no formal FMECA-to-stock linkage, no last-time-buy model for approaching EOL equipment, and no quantitative supplier risk index that updates when a vendor misses lead-time commitments.

I built the Critical Spares Engine to close those gaps. Since the original v1.11 ship, it has evolved into a **25-tab operating engine across 6 module groups**.

What's new in v1.16 (added since the original LinkedIn announcement):

→ **Spare-Parts Database** — 445 curated parts from ~220 archetypes × ~102 real OEMs × 6 DC generations (legacy → AI-factory). Filter, sort, "Use ▸ loads-part-into-modules" pattern, OEMs sub-view, facility-types sub-view, CSV export.

→ **Global Supply Chain & Transport** — lane & mode planner, supply-chain risk map across 16 countries + 13 trade lanes + 7 transport modes, disruption scenario simulator, logistics cost & expedite calculator. Real ranges for AWB rates, road freight, customs clearance days, port congestion.

→ **Fleet / Portfolio analytics** — when you operate 8+ datacenters in different geographies, knowing per-site stock isn't enough. Cross-site allocation, criticality-weighted readiness, regional cache vs central warehouse positioning.

→ **Operating-engine tabs**: Daily PM Operating System · Supplier Scorecard & Review Cadence · Negotiation & Commercial Strategy · Contract/SOW Checklist · Process Improvement Builder · Meeting Intelligence · Stakeholder & Communication Planner · EOL Response Plan · Ambiguity Solver · Interview/STAR Story Builder.

The discipline that made the engine credible:

→ **Math fixes** (v1.11.1): Poisson-CDF overflow → normal-approximation fallback. Inverted-NPV decision in LTB. Auto-fill commodity defaults. Summary Dashboard. Save/load/share-URL scenario. Dark-mode charts.

→ **Per-input tooltips** (134 of them) explaining what every field means and what default applies if blank.

→ **Try/catch tab nav + safeGen wrapper + per-module reset** — so when one module errors, the other 24 keep working.

→ **Open-source companion docs**: `Documents/Training/spares_engine_platform.md`, `spares_parts_database.md`, `spares_supply_chain_transport_research.md`. Master prompt at `pm2_spares_sourcing_data_center_engine_prompt.md` Appendices A-D.

If you run a DC M&E spares program — particularly across multiple sites — this is the calculator I wish existed when I had to defend my reorder-point math to a CFO.

resistancezero.com/spares-readiness-calculator.html

Free to use. Open critique welcome.

#DataCenter #SparesManagement #Reliability #SupplyChain #DCM&E
