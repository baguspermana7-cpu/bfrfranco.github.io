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
