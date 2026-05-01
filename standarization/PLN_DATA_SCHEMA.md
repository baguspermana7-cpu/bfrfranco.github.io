# PLN Java-Bali Grid Dataset — Schema Standard

> **Version**: 1.0 — 2026-05-01
>
> **Scope**: Defines the canonical shape of `js/pln-java-grid-data.js` (the runtime data module consumed by `pln-java-grid.html` and the four province sub-pages), the curated overlay file `tools/pln-java-grid-overlay.yaml`, and the regenerated artifact contract.
>
> **Source of truth**: This document. The JSON Schema (`js/pln-java-grid-data.schema.json`) is the machine-readable form.

---

## 1. Why this exists

`js/pln-java-grid-data.js` exposes `window.PLN_JAVA_GRID = { version, nodes[], edges[], national }`. As the dataset grew (118 → 744 nodes), the per-field conventions started to drift across nodes (some had `mva`, some had `secondary_voltages` only, some had `cod` overlapping `year`). This standard pins:

- Required vs optional fields per record type
- Enums (provinces, voltages, fuels, confidence levels, sources)
- Cross-record invariants (e.g., edge `from`/`to` must reference existing node ids)
- Versioning + change-management policy
- Where each field is sourced (OSM crawl vs curated overlay vs build-script computed)

---

## 2. Top-level shape

```typescript
window.PLN_JAVA_GRID = {
  version: string;          // e.g. "2026-04-29-v3" — matches overlay yaml version
  nodes: Node[];            // stations + plants
  edges: Edge[];            // transmission lines
  national: NationalStats;  // headline subsystem totals
}
```

`version` must match the `version:` field in `tools/pln-java-grid-overlay.yaml`. The build script (`tools/build-osm-dataset.py`) propagates this on rebuild.

---

## 3. Node — substations and plants

| Field | Type | Required | Source | Notes |
|---|---|---|---|---|
| `id` | string | ✅ | OSM crawl or curated | Format: `osm_node_<int>` or `osm_way_<int>` (preferred) or short slug for curated entries. Stable across rebuilds. |
| `name` | string | ✅ | OSM `name` tag | OSM-canonical name, NOT overrideable by overlay (use `notes` for aliases) |
| `kind` | enum | ✅ | OSM tag inference | `"station"` (substation) or `"plant"` (generation) |
| `voltage` | enum | ✅ | OSM `voltage` tag (kV) | One of: `500, 275, 150, 70, 20`. Stations report their highest tier. |
| `lat` | number | ✅ | OSM | WGS84 decimal degrees, range -8.8..-5.6 (Java-Bali bbox) |
| `lng` | number | ✅ | OSM | WGS84 decimal degrees, range 105.0..115.7 |
| `prov` | enum | ✅ | OSM/curated | One of: `"jakarta-banten"`, `"jabar"`, `"jateng"`, `"jatim"`, `"bali"` |
| `confidence` | enum | ✅ | OSM/curated | `"high"`, `"medium"`, `"low"` — quality of coordinate + identification |
| `source` | string | ✅ | build script | `"osm"` (from OSM crawl), `"curated"` (hand-placed), `"inferred-nn"` (nearest-neighbor edge inference), `"inferred-evacuation"` (plant evacuation inference) |
| `tier` | enum | ✅ | computed | `1` (transmission backbone, ≥150 kV) or `2` (distribution / minor) |
| `mva` | int | ⬜ | curated overlay | MVA rating; absent when unknown |
| `year` | int | ⬜ | curated overlay | Original construction year (CE) |
| `cod` | int | ⬜ | curated overlay | Commercial operation date — used to override `year` when integration year differs from build year. Build script: `node["year"] = entry["cod"]` |
| `secondary_voltages` | int[] | ⬜ | OSM | List of secondary tiers, e.g. `[20]` for a 150/20 kV step-down |
| `fuel` | enum | ⬜ | OSM, kind=plant only | `"coal"`, `"gas"`, `"hydro"`, `"geothermal"`, `"biomass"`, `"solar"`, `"diesel"`, `"wind"` |
| `served_areas` | string[] | ⬜ | curated overlay | Free-text list of neighborhoods / industrial estates / customers |
| `notes` | string | ⬜ | curated overlay | Free-form context. Aliases, KCIC connections, source URLs go here |
| `osm_id` | int | ⬜ | OSM | Numeric OSM id (matches the suffix of `id`) |
| `osm_type` | enum | ⬜ | OSM | `"way"` or `"node"` |
| `wikidata` | string | ⬜ | OSM `wikidata` tag | Q-id, if present |
| `operator` | string | ⬜ | OSM `operator` tag | Usually `"PLN"` or `"Perusahaan Listrik Negara"` |
| `x` | int | ⬜ | build script | SVG-projection x for the SLD view (computed) |
| `y` | int | ⬜ | build script | SVG-projection y for the SLD view (computed) |

### Cross-field invariants

- `kind == "plant"` ⇒ `fuel` SHOULD be present (OSM tag `power=plant` + `plant:source=*`)
- `kind == "station"` ⇒ `secondary_voltages` MAY be present
- `tier == 1` ⇒ `voltage ∈ {500, 275, 150}`; `tier == 2` ⇒ `voltage ∈ {70, 20}`
- `confidence == "high"` ⇒ coordinates verified against OSM way centroid OR curated by hand from PLN/wikidata
- `source == "curated"` ⇒ `id` SHOULD start with `curated_` to avoid collision with OSM ids

---

## 4. Edge — transmission lines

| Field | Type | Required | Source | Notes |
|---|---|---|---|---|
| `from` | string | ✅ | curated yaml `edges:` block or build script | Must reference a `Node.id` |
| `to` | string | ✅ | curated yaml `edges:` block or build script | Must reference a `Node.id` |
| `voltage` | enum | ✅ | OSM/curated | One of `500, 275, 150, 70` |
| `km` | number | ✅ | OSM length / curated estimate | Geodesic distance in km |
| `circuits` | int | ✅ | curated/inferred | Number of physical circuits, default 2 |
| `source` | enum | ✅ | build script | `"osm"`, `"pln-p2b-2016"` (curated from PLN P2B 2016 SLD), `"inferred-nn"` (auto), `"inferred-evacuation"` (auto), or named press-release |
| `osm_way_id` | int | ⬜ | OSM | Numeric OSM way id when `source=="osm"` |
| `tier` | enum | ⬜ | computed | `1` (backbone) or `2` (radial/distribution) — drives rendering style |
| `type` | enum | ⬜ | curated | `"overhead"` (default) or `"underground"` (SKTT cable) or `"submarine"` |

### Rendering guarantees

- `voltage == 500` → drawn at the highest visual weight; CSS class `pjg-line-v500`
- `voltage == 275` → second weight; class `pjg-line-v275`
- `voltage == 150` → standard weight; class `pjg-line-v150`
- `voltage ≤ 70` → light weight, only visible when "70 kV layer" toggle is on
- `source` starts with `"inferred"` → 35% opacity + dashed in CSS (visual confidence indicator)

---

## 5. National stats

```typescript
NationalStats = {
  installedMW: number;     // Java-Bali subsystem installed capacity (PLN AR)
  peakMW: number;          // Annual peak demand (PLN AR)
  reservePct: number;      // (installedMW - peakMW) / peakMW × 100
  renewablePct: number;    // share of renewables in generation mix
  dcMW: number;            // subscribed data-center load
  substations: number;     // count of unique 500/275/150 kV substations
  txKm: number;            // total transmission line km
}
```

Always present, always representative-of-publication-year (currently 2024). Source: PLN Annual Report 2024 + RUPTL 2025-2034.

---

## 6. Province aggregates (computed at runtime)

Not stored in `js/pln-java-grid-data.js`; computed by `computeProvinceAggregates(window.PLN_JAVA_GRID)` in `js/pln-energy-data.js`:

```typescript
ProvinceAggregate = {
  prov: "jakarta-banten" | "jabar" | "jateng" | "jatim" | "bali";
  installedMW: number;   // sum of nodes' mva where prov matches
  peakMW: number;        // from static lookup table (PLN AR + province-level estimates)
  reserveMW: number;     // installedMW - peakMW
  utilizationPct: number; // peakMW / installedMW × 100
  stations: number;       // count of nodes with kind=="station"
  plants: number;         // count of nodes with kind=="plant"
}
```

Static peak-demand baseline (matches the in-page "Province Snapshot" headlines):

| Province | Peak GW (2024) |
|---|---|
| `jakarta-banten` | 11.5 |
| `jabar` | 8.2 |
| `jateng` | 5.4 |
| `jatim` | 6.9 |
| `bali` | 1.0 |

---

## 7. Versioning + change policy

`window.PLN_JAVA_GRID.version` follows `YYYY-MM-DD-vN` format. Bump `N` when:

- Schema-breaking field rename or removal (consumers must update)
- New required field added
- Enum value added or renamed

Non-breaking enrichments (more nodes, more `served_areas`, more `notes`) do NOT bump the version.

The `CHANGELOG.md` at repo root carries the human narrative; this schema doc is the contract.

---

## 8. Source files

| File | Role |
|---|---|
| `tools/build-osm-dataset.py` | Crawls Overpass API + merges `pln-java-grid-overlay.yaml` + emits `js/pln-java-grid-data.js`. Idempotent, 24-hour Overpass cache. |
| `tools/pln-java-grid-overlay.yaml` | Hand-curated annotations + curated edges. Keys: `osm_node_<id>`, `osm_way_<id>`, or short slug. Schema fields per Section 3. |
| `js/pln-java-grid-data.js` | Generated artifact. Do not edit by hand. |
| `js/pln-java-grid-data.schema.json` | Machine-readable JSON Schema (draft-2020-12) for the generated artifact. |
| `js/pln-java-grid-data-{prov}.js` | Per-province 20 kV DC-feeder overlays. Each exposes `window.PLN_JAVA_GRID_<PROV>` with the same Node/Edge schema, scoped to the province. |
| `pln-java-grid.html` + `pln-java-grid-{prov}.html` | Consumers. Read `window.PLN_JAVA_GRID*` and render via `js/rz-map.js` + inline SVG SLD. |

---

## 9. Validation tooling (suggested)

```bash
# JSON Schema validation (requires ajv-cli or similar)
npx ajv-cli validate \
  --spec=draft2020 \
  --schema=js/pln-java-grid-data.schema.json \
  --data=<(node -e "require('./js/pln-java-grid-data.js'); process.stdout.write(JSON.stringify(window.PLN_JAVA_GRID))")
```

Or smaller-scope smoke test:

```bash
node -e "
const fs = require('fs');
const window = {};
require('./js/pln-java-grid-data.js');
const d = window.PLN_JAVA_GRID;
console.log('version:', d.version);
console.log('nodes:', d.nodes.length);
console.log('edges:', d.edges.length);
const provs = ['jakarta-banten','jabar','jateng','jatim','bali'];
const byProv = {};
provs.forEach(p => byProv[p] = d.nodes.filter(n => n.prov === p).length);
console.log('by prov:', byProv);
const noProv = d.nodes.filter(n => !provs.includes(n.prov));
if (noProv.length) console.error('INVALID prov values:', noProv.map(n => n.prov).slice(0,5));
"
```

---

## 10. Extension points (planned)

These fields are reserved for future use and MAY be added without bumping `version`:

- `Node.commissioning_status` — `"operational" | "planned" | "construction" | "decommissioned"`
- `Node.dc_load_mw` — connected data-center load when known
- `Edge.fault_history` — recent fault events for reliability dashboards
- `Edge.thermal_rating_mw` — published line rating

When implemented, this doc gets a new section + the JSON Schema gets the corresponding field.
