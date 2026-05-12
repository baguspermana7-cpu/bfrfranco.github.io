-- =============================================================================
-- Critical Spares Engine — SQLite Database Schema
-- resistancezero.com · Data Center M&E Spare Parts Catalog
-- =============================================================================
-- Methodology basis:
--   · FMECA (MIL-STD-1629A) — failure mode / criticality attributes
--   · DMSMS — lifecycle status (Active / NRND / Last-Time-Buy / Obsolete)
--   · ASHRAE TC 9.9 — thermal classifications inform cooling-part ratings
--   · Uptime Institute Tier I-IV — dc_tier_applicability
--   · Kraljic matrix — sourcing-strategy attributes on the OEM table
--   · METRIC / VARI-METRIC — multi-echelon replenishment context (lead-time fields)
-- =============================================================================
-- Coverage: Legacy Raised-Floor through AI Factory (liquid-cooled)
--   Electrical · Mechanical · Cooling · Fire-Life-Safety · ICT-Network
--   BMS-Controls · Structural-Civil · Monitoring
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- TABLE: dc_facility_types
-- Canonical taxonomy of data-center generation/type. Small fixed table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dc_facility_types (
    facility_type_id        TEXT PRIMARY KEY,  -- e.g. 'legacy-raised-floor'
    name                    TEXT NOT NULL,
    era                     TEXT NOT NULL,     -- e.g. '1995-2010'
    typical_it_load_mw_min  REAL,
    typical_it_load_mw_max  REAL,
    typical_pue             REAL,
    cooling_architecture    TEXT,              -- narrative, semi-colon separated
    power_architecture      TEXT,              -- N / N+1 / 2N / block-redundant
    typical_rack_density_kw_min REAL,
    typical_rack_density_kw_max REAL,
    key_equipment           TEXT,              -- comma-separated list
    notes                   TEXT
);

-- ---------------------------------------------------------------------------
-- TABLE: oems
-- Original Equipment Manufacturers and key distributors / specialists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oems (
    oem_id                  TEXT PRIMARY KEY,  -- e.g. 'vertiv'
    name                    TEXT NOT NULL,
    hq_country              TEXT,
    founded_year            INTEGER,
    commodities_supplied    TEXT,              -- comma-separated commodity list
    dc_market_position      TEXT CHECK(dc_market_position IN
                                ('oem-primary','distributor','specialist','generic')),
    financial_health_score  INTEGER CHECK(financial_health_score BETWEEN 1 AND 10),
    typical_lead_time_weeks INTEGER,           -- baseline, no-rush lead time
    typical_otif_pct        REAL,              -- on-time-in-full %
    contract_models         TEXT,              -- MSA / framework / PO-only / consignment-capable
    single_source_risk      TEXT CHECK(single_source_risk IN ('low','medium','high')),
    notes                   TEXT
);

-- ---------------------------------------------------------------------------
-- TABLE: commodity_taxonomy
-- 3-level taxonomy: l1 (system group) → l2 (subsystem) → l3 (component class)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commodity_taxonomy (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    l1                      TEXT NOT NULL,     -- system level
    l2                      TEXT NOT NULL,     -- subsystem level
    l3                      TEXT NOT NULL,     -- component class
    system                  TEXT NOT NULL,     -- canonical system code
    description             TEXT,
    typical_criticality     INTEGER,           -- 1-10 default for this commodity
    typical_dc_generations  TEXT,              -- comma-separated dc_generation values
    UNIQUE(l1, l2, l3)
);

-- ---------------------------------------------------------------------------
-- TABLE: parts
-- Main spare-parts catalog. One row per part SKU.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parts (
    part_id                 TEXT PRIMARY KEY,       -- RZ-SP-NNNNNN
    part_number             TEXT NOT NULL,           -- OEM / synthetic-plausible part number
    oem_id                  TEXT REFERENCES oems(oem_id),
    model_family            TEXT,                    -- product family / series name
    description             TEXT NOT NULL,

    -- Taxonomy / Classification
    system                  TEXT NOT NULL CHECK(system IN (
                                'electrical','mechanical','cooling',
                                'fire-life-safety','network-ict',
                                'bms-controls','structural-civil','monitoring')),
    subsystem               TEXT NOT NULL,           -- see subsystem taxonomy in schema notes
    commodity_l1            TEXT NOT NULL,
    commodity_l2            TEXT NOT NULL,
    commodity_l3            TEXT NOT NULL,

    -- DC Generation & Tier Applicability
    dc_generation           TEXT NOT NULL,           -- pipe-separated, e.g. 'enterprise-tier3|colo-wholesale'
    dc_tier_applicability   TEXT,                    -- comma-separated, e.g. 'II,III,IV'

    -- Reliability / Maintenance Attributes (FMECA / MTBF basis)
    criticality_default     INTEGER CHECK(criticality_default BETWEEN 1 AND 10),
    mtbf_years              REAL,                    -- mean time between failures in years
    mttr_hours              REAL,                    -- mean time to repair in hours

    -- Lead Time (weeks)
    lead_time_weeks_min     INTEGER,
    lead_time_weeks_typ     INTEGER,
    lead_time_weeks_max     INTEGER,

    -- Unit Cost (USD)
    unit_cost_usd_min       REAL,
    unit_cost_usd_typ       REAL,
    unit_cost_usd_max       REAL,

    -- Stocking / Supply Attributes
    moq                     INTEGER DEFAULT 1,       -- minimum order quantity
    lifecycle_status        TEXT NOT NULL CHECK(lifecycle_status IN
                                ('active','nrnd','last-time-buy','obsolete')),
    typical_installed_base_per_site_min INTEGER,     -- # units typically installed per DC
    typical_installed_base_per_site_max INTEGER,

    -- Alternates / Risk
    qualified_alternates_count  INTEGER DEFAULT 0,
    eol_risk                    INTEGER CHECK(eol_risk BETWEEN 1 AND 10),

    -- Physical / Technical Attributes
    refurbishable           INTEGER DEFAULT 0 CHECK(refurbishable IN (0,1)),
    printable_3d            INTEGER DEFAULT 0 CHECK(printable_3d IN (0,1)),
    weight_kg               REAL,
    dimensions_mm           TEXT,                    -- LxWxH
    voltage_rating          TEXT,                    -- e.g. '480V AC', '48V DC', nullable
    current_rating_a        REAL,                    -- nullable
    capacity_rating         TEXT,                    -- e.g. '2000 kVA', '1200 ton', '50 kW'
    refrigerant_type        TEXT,                    -- R-134a / R-410A / R-513A / R-1234ze etc.
    ip_rating               TEXT,                    -- e.g. 'IP54', 'NEMA-4X'
    certifications          TEXT,                    -- UL/CE/ASHRAE/NFPA/FM/CSA etc.

    -- Supply Chain
    country_of_origin       TEXT,
    hazmat                  INTEGER DEFAULT 0 CHECK(hazmat IN (0,1)),

    -- Metadata
    notes                   TEXT,
    source_basis            TEXT,                    -- methodology / data basis description
    created_at              TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- TABLE: compatibility
-- Cross-reference: which parts fit which facility types and equipment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compatibility (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id                 TEXT NOT NULL REFERENCES parts(part_id),
    fits_facility_type_id   TEXT REFERENCES dc_facility_types(facility_type_id),
    fits_oem_equipment      TEXT,                    -- free text e.g. 'Carrier 19XR chiller'
    relationship            TEXT NOT NULL CHECK(relationship IN (
                                'fits','supersedes','superseded-by',
                                'alternate','cross-reference')),
    related_part_id         TEXT REFERENCES parts(part_id),
    notes                   TEXT
);

-- ---------------------------------------------------------------------------
-- TABLE: failure_modes
-- FMECA failure mode catalog. Multiple modes per part (2-5 typical).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS failure_modes (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id                 TEXT NOT NULL REFERENCES parts(part_id),
    failure_mode            TEXT NOT NULL,           -- e.g. 'bearing wear'
    failure_effect          TEXT,                    -- downstream consequence
    detectability           INTEGER CHECK(detectability BETWEEN 1 AND 10),
                                                    -- 1=easy to detect, 10=hidden
    typical_cause           TEXT,
    fmeca_severity          INTEGER CHECK(fmeca_severity BETWEEN 1 AND 10),
                                                    -- 1=negligible, 10=catastrophic
    condition_monitorable   INTEGER DEFAULT 0 CHECK(condition_monitorable IN (0,1)),
    notes                   TEXT
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_parts_oem_id
    ON parts(oem_id);

CREATE INDEX IF NOT EXISTS idx_parts_system
    ON parts(system);

CREATE INDEX IF NOT EXISTS idx_parts_subsystem
    ON parts(subsystem);

CREATE INDEX IF NOT EXISTS idx_parts_commodity
    ON parts(commodity_l1, commodity_l2);

CREATE INDEX IF NOT EXISTS idx_parts_dc_generation
    ON parts(dc_generation);

CREATE INDEX IF NOT EXISTS idx_parts_lifecycle_status
    ON parts(lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_parts_criticality
    ON parts(criticality_default);

CREATE INDEX IF NOT EXISTS idx_parts_eol_risk
    ON parts(eol_risk);

CREATE INDEX IF NOT EXISTS idx_parts_lead_time
    ON parts(lead_time_weeks_typ);

CREATE INDEX IF NOT EXISTS idx_compatibility_part_id
    ON compatibility(part_id);

CREATE INDEX IF NOT EXISTS idx_failure_modes_part_id
    ON failure_modes(part_id);

-- =============================================================================
-- VIEWS (convenience — pre-computed joins)
-- =============================================================================

-- Critical parts with long lead times — typical query for readiness dashboard
CREATE VIEW IF NOT EXISTS v_critical_long_lead AS
SELECT
    p.part_id,
    p.description,
    p.system,
    p.subsystem,
    o.name AS oem_name,
    p.dc_generation,
    p.criticality_default,
    p.lead_time_weeks_typ,
    p.lead_time_weeks_max,
    p.unit_cost_usd_typ,
    p.lifecycle_status,
    p.eol_risk,
    p.qualified_alternates_count
FROM parts p
LEFT JOIN oems o ON p.oem_id = o.oem_id
WHERE p.criticality_default >= 7
  AND p.lead_time_weeks_typ >= 12;

-- EOL-risk parts in legacy DCs with no qualified alternate
CREATE VIEW IF NOT EXISTS v_eol_exposure AS
SELECT
    p.part_id,
    p.description,
    p.system,
    p.subsystem,
    o.name AS oem_name,
    p.dc_generation,
    p.lifecycle_status,
    p.eol_risk,
    p.criticality_default,
    p.unit_cost_usd_typ,
    p.mtbf_years,
    p.typical_installed_base_per_site_min,
    p.typical_installed_base_per_site_max
FROM parts p
LEFT JOIN oems o ON p.oem_id = o.oem_id
WHERE p.lifecycle_status IN ('nrnd','last-time-buy','obsolete')
  AND p.qualified_alternates_count = 0
  AND p.dc_generation LIKE '%legacy%';

-- OEM concentration by subsystem
CREATE VIEW IF NOT EXISTS v_oem_concentration AS
SELECT
    p.subsystem,
    o.name AS oem_name,
    COUNT(*) AS part_count,
    AVG(p.unit_cost_usd_typ) AS avg_unit_cost,
    AVG(p.lead_time_weeks_typ) AS avg_lead_time_wk
FROM parts p
LEFT JOIN oems o ON p.oem_id = o.oem_id
GROUP BY p.subsystem, o.name
ORDER BY p.subsystem, part_count DESC;

-- AI-factory liquid-cooling critical parts
CREATE VIEW IF NOT EXISTS v_ai_factory_cooling AS
SELECT
    p.part_id,
    p.description,
    p.subsystem,
    o.name AS oem_name,
    p.criticality_default,
    p.lead_time_weeks_typ,
    p.unit_cost_usd_typ,
    p.lifecycle_status,
    p.refrigerant_type
FROM parts p
LEFT JOIN oems o ON p.oem_id = o.oem_id
WHERE p.dc_generation LIKE '%ai-factory%'
  AND p.system = 'cooling';

-- =============================================================================
-- PLATFORM LAYER (v1.16)
-- These tables turn the static catalog into a live spares-management system.
-- They are EMPTY in the default build; `build-spares-db.py --platform` fills
-- them with synthetic data, and in production they'd be fed from ERP / CMMS /
-- procurement systems. The calculator's analytical modules can read them to
-- drive real FMECA-criticality / newsvendor-stock / MEIO-positioning /
-- supplier-risk / DMSMS-LTB calculations on the actual fleet.
-- =============================================================================

-- Operating sites (data-center facilities the org runs spares for)
CREATE TABLE IF NOT EXISTS sites (
    site_id                 TEXT PRIMARY KEY,        -- e.g. 'US-EAST-01'
    name                    TEXT NOT NULL,
    region                  TEXT,                    -- AMER / EMEA / APAC / MENA / LATAM
    country                 TEXT,
    facility_type_id        TEXT REFERENCES dc_facility_types(facility_type_id),
    it_load_mw              REAL,
    commissioned_year       INTEGER,
    tier                    TEXT,                    -- 'III' / 'IV' etc.
    has_regional_hub        INTEGER DEFAULT 0 CHECK(has_regional_hub IN (0,1)),
    hub_lead_time_days      REAL,                    -- if served by a regional spares hub
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sites_region ON sites(region);

-- Suppliers (distinct from OEMs — distributors / integrators / service providers
-- with their own commercial terms; an OEM may also be a supplier of record).
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id             TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    supplier_type           TEXT CHECK(supplier_type IN
                                ('oem','distributor','integrator','service-provider','broker','refurbisher')),
    primary_oem_id          TEXT REFERENCES oems(oem_id),   -- nullable — for multi-OEM distributors
    region_coverage         TEXT,                    -- comma-separated regions served
    contract_status         TEXT CHECK(contract_status IN
                                ('MSA','framework','SOW','PO-only','expired','under-negotiation','none')),
    msa_expiry              DATE,
    otif_pct                REAL,                    -- on-time-in-full %
    commit_accuracy_pct     REAL,                    -- actual delivery vs supplier commit
    quote_turnaround_days   REAL,
    po_ack_days             REAL,
    defect_rate_pct         REAL,
    responsiveness_hours    REAL,                    -- time to respond to a critical issue
    corrective_action_closure_pct REAL,
    financial_health_score  INTEGER CHECK(financial_health_score BETWEEN 1 AND 10),
    capacity_headroom_pct   REAL,                    -- spare production / allocation capacity
    geographic_concentration_score INTEGER CHECK(geographic_concentration_score BETWEEN 1 AND 10),
    geopolitical_risk_score INTEGER CHECK(geopolitical_risk_score BETWEEN 1 AND 10),
    lead_time_volatility_score INTEGER CHECK(lead_time_volatility_score BETWEEN 1 AND 10),
    strategic_importance    TEXT CHECK(strategic_importance IN ('critical','preferred','tactical','replaceable')),
    review_cadence          TEXT CHECK(review_cadence IN ('weekly','monthly','quarterly','annual','ad-hoc')),
    consignment_capable     INTEGER DEFAULT 0 CHECK(consignment_capable IN (0,1)),
    vmi_capable             INTEGER DEFAULT 0 CHECK(vmi_capable IN (0,1)),
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_suppliers_oem ON suppliers(primary_oem_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_importance ON suppliers(strategic_importance);

-- Inventory positions: on-hand / reserved / in-transit by part × stocking location.
CREATE TABLE IF NOT EXISTS inventory_positions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id                 TEXT NOT NULL REFERENCES parts(part_id),
    location_type           TEXT NOT NULL CHECK(location_type IN ('site','regional-hub','central-depot','consignment','vmi')),
    location_id             TEXT,                    -- site_id, hub code, or supplier_id for consignment/VMI
    on_hand_qty             INTEGER DEFAULT 0,
    reserved_qty            INTEGER DEFAULT 0,       -- allocated to a planned work order
    in_transit_qty          INTEGER DEFAULT 0,
    safety_stock_target     INTEGER DEFAULT 0,
    reorder_point           INTEGER DEFAULT 0,
    max_stock               INTEGER DEFAULT 0,
    last_count_date         DATE,
    days_of_cover           REAL,                    -- on_hand / avg daily demand
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_inv_part ON inventory_positions(part_id);
CREATE INDEX IF NOT EXISTS idx_inv_loc ON inventory_positions(location_type, location_id);

-- Purchase orders: lifecycle tracking from creation to receipt.
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id                   TEXT PRIMARY KEY,        -- e.g. 'PO-2026-004217'
    supplier_id             TEXT REFERENCES suppliers(supplier_id),
    part_id                 TEXT REFERENCES parts(part_id),
    site_id                 TEXT REFERENCES sites(site_id),     -- ship-to (nullable for hub stock)
    quantity                INTEGER NOT NULL,
    unit_price_usd          REAL,
    total_value_usd         REAL,
    demand_type             TEXT CHECK(demand_type IN
                                ('planned-maintenance','corrective','emergency','lifecycle-eol','commissioning','buffer-replenishment','last-time-buy')),
    po_creation_date        DATE,
    supplier_ack_date       DATE,
    original_commit_date    DATE,
    current_commit_date     DATE,
    need_by_date            DATE,
    received_date           DATE,
    delivery_status         TEXT CHECK(delivery_status IN
                                ('on-track','at-risk','late','delivered','blocked','cancelled')),
    blocker                 TEXT,                    -- root cause if at-risk/late/blocked
    recovery_plan           TEXT,
    owner                   TEXT,
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_part ON purchase_orders(part_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_po_need_by ON purchase_orders(need_by_date);

-- Consumption history: actual part usage events (drives demand forecasting).
CREATE TABLE IF NOT EXISTS consumption_history (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id                 TEXT NOT NULL REFERENCES parts(part_id),
    site_id                 TEXT REFERENCES sites(site_id),
    event_date              DATE,
    quantity                INTEGER DEFAULT 1,
    consumption_type        TEXT CHECK(consumption_type IN
                                ('planned-maintenance','corrective','emergency','commissioning','engineering-change','attrition')),
    failure_mode            TEXT,                    -- if corrective/emergency, the mode that triggered it
    downtime_minutes        REAL,                    -- facility impact, if any
    work_order_ref          TEXT,
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_cons_part ON consumption_history(part_id);
CREATE INDEX IF NOT EXISTS idx_cons_date ON consumption_history(event_date);

-- Engineering changes: part revisions, supersessions, EOL notices.
CREATE TABLE IF NOT EXISTS engineering_changes (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id                 TEXT NOT NULL REFERENCES parts(part_id),
    change_type             TEXT CHECK(change_type IN
                                ('revision','supersession','eol-notice','last-time-buy-window','vendor-transition','spec-change','recall')),
    announced_date          DATE,
    effective_date          DATE,                    -- e.g. EOL date, LTB deadline
    superseded_by_part_id   TEXT REFERENCES parts(part_id),
    installed_base_affected INTEGER,
    qualification_required  INTEGER DEFAULT 0 CHECK(qualification_required IN (0,1)),
    qualification_lead_time_months REAL,
    qualification_cost_usd  REAL,
    status                  TEXT CHECK(status IN ('open','in-progress','mitigated','closed','accepted-risk')),
    mitigation_plan         TEXT,
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_ec_part ON engineering_changes(part_id);
CREATE INDEX IF NOT EXISTS idx_ec_type ON engineering_changes(change_type);

-- Platform-layer convenience views ------------------------------------------

-- Late / at-risk POs against critical parts (the daily-PM-ops triage view)
CREATE VIEW IF NOT EXISTS v_po_at_risk AS
SELECT po.po_id, s.name AS supplier, p.description AS part, p.criticality_default AS crit,
       po.quantity, po.current_commit_date, po.need_by_date, po.delivery_status, po.blocker, po.owner,
       CAST(julianday(po.current_commit_date) - julianday(po.need_by_date) AS INTEGER) AS slip_days
FROM purchase_orders po
LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
LEFT JOIN parts p ON p.part_id = po.part_id
WHERE po.delivery_status IN ('at-risk','late','blocked')
ORDER BY p.criticality_default DESC, slip_days DESC;

-- Spare-readiness gap: critical parts where on-hand + in-transit < safety-stock target
CREATE VIEW IF NOT EXISTS v_readiness_gap AS
SELECT p.part_id, p.description, p.criticality_default AS crit, p.lead_time_weeks_typ AS lt_wk,
       SUM(i.on_hand_qty) AS on_hand, SUM(i.in_transit_qty) AS in_transit,
       SUM(i.safety_stock_target) AS ss_target,
       SUM(i.on_hand_qty + i.in_transit_qty) - SUM(i.safety_stock_target) AS gap
FROM parts p JOIN inventory_positions i ON i.part_id = p.part_id
WHERE p.criticality_default >= 7
GROUP BY p.part_id
HAVING gap < 0
ORDER BY p.criticality_default DESC, gap ASC;

-- =============================================================================
-- SUPPLY CHAIN & TRANSPORT (v1.16) — reference tables (always populated; small)
-- Source basis: ICC Incoterms 2020; World Bank LPI; industry-typical 2024-2026
-- transit/cost/congestion figures; the DC-equipment shortage + tariff context.
-- =============================================================================

CREATE TABLE IF NOT EXISTS transport_modes (
    mode_id                 TEXT PRIMARY KEY,        -- ocean-fcl / ocean-lcl / air-express / air-standard / road / rail / courier-express
    name                    TEXT NOT NULL,
    transit_days_inter_typ  REAL,                    -- intercontinental, typical door-to-door
    transit_days_inter_min  REAL,
    transit_days_inter_max  REAL,
    transit_days_intra_typ  REAL,                    -- intra-region, typical (NULL if N/A)
    cost_index              REAL,                    -- relative to ocean-FCL = 1.00
    co2_index               REAL,                    -- relative to ocean-FCL = 1.00 (per tonne-km)
    capacity_unit           TEXT,                    -- FCL / LCL / ULD-pallet / parcel
    typical_use             TEXT,                    -- e.g. 'bulk M&E equipment', 'critical sub-assembly expedite'
    notes                   TEXT
);

CREATE TABLE IF NOT EXISTS trade_lanes (
    lane_id                 TEXT PRIMARY KEY,        -- e.g. 'CN-NA'
    origin_region           TEXT NOT NULL,           -- CN / EU / NA / SEA-Vietnam / India / Korea-Japan / MENA / LATAM / Intra-NA / Intra-EU / Intra-APAC
    dest_region             TEXT NOT NULL,
    primary_mode            TEXT REFERENCES transport_modes(mode_id),
    ocean_transit_days_typ  REAL,
    air_transit_days_typ    REAL,
    road_rail_transit_days_typ REAL,                 -- NULL if not feasible (e.g. transoceanic)
    customs_clearance_days_typ REAL,
    last_mile_days_typ      REAL,
    congestion_risk         INTEGER CHECK(congestion_risk BETWEEN 1 AND 10),
    geopolitical_risk       INTEGER CHECK(geopolitical_risk BETWEEN 1 AND 10),
    rate_volatility         INTEGER CHECK(rate_volatility BETWEEN 1 AND 10),
    tariff_exposure         INTEGER CHECK(tariff_exposure BETWEEN 1 AND 10),  -- typical DC-M&E duty burden on this lane, 2026
    reroute_options         TEXT,
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_lanes_origin ON trade_lanes(origin_region);

CREATE TABLE IF NOT EXISTS country_risk (
    country                 TEXT PRIMARY KEY,
    region                  TEXT,
    political_stability_score INTEGER CHECK(political_stability_score BETWEEN 1 AND 10),  -- higher = more stable
    customs_efficiency_score  INTEGER CHECK(customs_efficiency_score BETWEEN 1 AND 10),   -- higher = faster/cleaner
    port_infrastructure_score INTEGER CHECK(port_infrastructure_score BETWEEN 1 AND 10),
    logistics_performance_index REAL,                -- ~1.0-5.0, World Bank LPI style
    transformer_mfg_share_pct REAL,                  -- rough share of global power-transformer capacity
    geopolitical_risk_score INTEGER CHECK(geopolitical_risk_score BETWEEN 1 AND 10),     -- higher = riskier
    tariff_regime_note      TEXT,
    notes                   TEXT
);

-- Supply-chain views ---------------------------------------------------------

-- Door-to-door lead-time estimate per lane × mode
CREATE VIEW IF NOT EXISTS v_lane_lead_time AS
SELECT l.lane_id, l.origin_region, l.dest_region,
       ROUND(l.ocean_transit_days_typ + l.customs_clearance_days_typ + l.last_mile_days_typ, 1) AS ocean_door_days,
       ROUND(l.air_transit_days_typ   + l.customs_clearance_days_typ + l.last_mile_days_typ, 1) AS air_door_days,
       CASE WHEN l.road_rail_transit_days_typ IS NULL THEN NULL
            ELSE ROUND(l.road_rail_transit_days_typ + l.customs_clearance_days_typ + l.last_mile_days_typ, 1) END AS road_rail_door_days,
       l.congestion_risk, l.geopolitical_risk, l.rate_volatility, l.tariff_exposure, l.reroute_options
FROM trade_lanes l;

-- Highest-risk lanes (composite of congestion + geopolitical + volatility)
CREATE VIEW IF NOT EXISTS v_high_risk_lanes AS
SELECT lane_id, origin_region, dest_region,
       (congestion_risk + geopolitical_risk + rate_volatility) AS risk_sum,
       congestion_risk, geopolitical_risk, rate_volatility, tariff_exposure, reroute_options, notes
FROM trade_lanes
ORDER BY risk_sum DESC;

-- Country-of-origin exposure: parts (and the OEMs) sitting in higher-risk countries
CREATE VIEW IF NOT EXISTS v_oem_country_exposure AS
SELECT p.country_of_origin, cr.region, cr.geopolitical_risk_score, cr.customs_efficiency_score,
       cr.transformer_mfg_share_pct, COUNT(*) AS part_count,
       SUM(CASE WHEN p.criticality_default >= 7 THEN 1 ELSE 0 END) AS critical_part_count,
       ROUND(AVG(p.lead_time_weeks_typ),1) AS avg_lead_time_wk
FROM parts p LEFT JOIN country_risk cr ON cr.country = p.country_of_origin
GROUP BY p.country_of_origin
ORDER BY part_count DESC;

-- =============================================================================
-- SCHEMA END
-- Subsystem taxonomy (informational comment):
--
-- ELECTRICAL:
--   UPS, switchgear, transformer, PDU, busway, ATS, STS,
--   MV-switchgear, LV-switchgear, capacitor-bank, battery-system,
--   cable-busduct, grounding, power-meter
--
-- MECHANICAL (power generation):
--   diesel-generator, gas-generator, fuel-system, exhaust-system,
--   generator-ancillary
--
-- COOLING:
--   chiller, cooling-tower, CRAC-CRAH, CDU-coolant-distribution,
--   pump, valve, heat-exchanger, dry-cooler, pipework,
--   immersion-cooling, direct-to-chip-cooling, cooling-manifold,
--   refrigerant-circuit, adiabatic-cooling
--
-- FIRE-LIFE-SAFETY:
--   VESDA, clean-agent, fire-pump, sprinkler, smoke-detection,
--   gas-suppression, fire-panel, emergency-lighting, BAS-fire
--
-- NETWORK-ICT:
--   fiber-ODF, spine-leaf-switch, structured-cabling, patch-panel,
--   optical-transceiver, KVM, console-server
--
-- BMS-CONTROLS:
--   DDC-PLC-controller, sensor, actuator, LDC-panel,
--   BACnet-gateway, SCADA-RTU, HMI
--
-- STRUCTURAL-CIVIL:
--   raised-floor-tile, cable-tray, containment, server-rack,
--   aisle-containment, seismic-brace
--
-- MONITORING:
--   DCIM-sensor, power-meter, environment-sensor, leak-detection,
--   video-surveillance, access-control
-- =============================================================================
