# Telemetry Schema — Maintenance Intelligence Workbench

> **Status**: Spec (v1.41.10, 2026-05-26)
> **Scope**: Canonical sensor-tag shape, unit list, sample-rate bands,
> and per-asset-class expected channels. Defines what every BMS / SCADA
> / IoT-platform connector MUST emit when it feeds the workbench's
> `TelemetryWindow` contract.

## §1 — Tag naming convention

Format: `<SITE>.<SYSTEM>.<ASSET>.<MEASURE>.<QUALIFIER?>`

Examples:
- `BKS01.CDU01.PUMP01.FLOW.SUCTION`
- `BKS01.UPS-A.BATTERY.VOLTAGE.STRING-3`
- `BKS01.GEN-2.FUEL.LEVEL.DAY-TANK`

Rules:
- All segments UPPERCASE, dot-separated.
- Hyphens within a segment are allowed (`UPS-A`); underscores are
  reserved for synthetic-fixture tags only (`_synth_`).
- Last `.QUALIFIER?` segment optional but recommended when more than one
  sensor of the same measure exists.
- Site prefix is the **site_id** from the asset registry; never an
  IP or rack name.
- Tag MUST resolve to one Asset Registry row. Tag-to-asset binding is
  enforced by the registry; the engine refuses to ingest unbound tags.

## §2 — Canonical unit list (SI)

| Measure | Unit | Canonical write | Disallowed aliases |
|---|---|---|---|
| Flow | `L/min` | "L/min" | "lpm", "litres per minute" |
| Differential pressure | `kPa` | "kPa" | "psi", "bar" — convert at ingestor |
| Temperature | `degC` | "degC" | "C", "°C", "celsius" |
| Current | `A` | "A" | "amps", "amperage" |
| Voltage | `V` | "V" | "volts" |
| Frequency | `Hz` | "Hz" | "hertz" |
| Vibration RMS | `mm/s` | "mm/s" | "in/s" — convert |
| Acceleration | `m/s2` | "m/s2" | "g" — convert |
| Particle concentration | `ug/m3` | "ug/m3" | "ppm" — convert |
| Humidity | `percent_rh` | "percent_rh" | "%RH" |
| Boolean state | `bool` | "bool" | "on/off", "0/1" |

All other units MUST be normalised at the ingestor. Engine never sees
non-canonical units.

## §3 — Sample-rate bands

| Band | Rate | Typical use |
|---|---|---|
| `vibration` | ≥1 kHz | Vibration spectra, bearing signature |
| `electrical_fast` | 50-200 Hz | Power-quality, switching transients |
| `process` | 1-10 Hz | Flow, pressure, level, temperature, current |
| `slow` | 0.1-1 Hz | UPS battery, ambient, BMS rollup |
| `manual` | event-driven | Walk-down notes, technician readings |

Each tag declares its **native** rate. Down-sampled bands appear as
separate child tags with `.DS-<rate>` qualifier (e.g.
`BKS01.CDU01.PUMP01.FLOW.SUCTION.DS-1Hz`).

## §4 — Per-asset-class expected channels

### CDU / chiller pump (asset_class = `chiller_pump`)

Required (≥3 channels needed for diagnosis):
- `*.PUMP*.FLOW.SUCTION` — process band, L/min
- `*.PUMP*.FLOW.DISCHARGE` — process band, L/min (if dual-flow)
- `*.PUMP*.DP.STRAINER` — process band, kPa
- `*.PUMP*.MOTOR.AMPS` — process band, A
- `*.PUMP*.MOTOR.VIBRATION.X` — vibration band, mm/s
- `*.PUMP*.MOTOR.TEMP.STATOR` — slow band, degC

Diagnostic for F11.2 flow obstruction REQUIRES:
- `FLOW.SUCTION` + `DP.STRAINER` + `MOTOR.AMPS` at process band

### UPS (asset_class = `ups_double_conversion`)

Required:
- `*.UPS*.INPUT.VOLTAGE.{L1,L2,L3}` — electrical_fast, V
- `*.UPS*.OUTPUT.VOLTAGE.{L1,L2,L3}` — electrical_fast, V
- `*.UPS*.BATTERY.VOLTAGE.STRING-N` — slow, V
- `*.UPS*.BATTERY.CURRENT.STRING-N` — slow, A
- `*.UPS*.BATTERY.TEMP.STRING-N` — slow, degC
- `*.UPS*.BYPASS.STATIC.STATE` — process, bool

### Generator (asset_class = `genset_diesel`)

Required:
- `*.GEN*.FUEL.LEVEL.DAY-TANK` — slow, percent
- `*.GEN*.FUEL.LEVEL.MAIN-TANK` — slow, percent
- `*.GEN*.ENGINE.RPM` — process, rpm (rpm is allowed; not in §2 — added: rpm)
- `*.GEN*.ENGINE.TEMP.COOLANT` — slow, degC
- `*.GEN*.OUTPUT.VOLTAGE.{L1,L2,L3}` — electrical_fast, V

(Other asset classes specified in later schema appendices: chiller,
CRAH, switchgear, transformer, ATS, fire panel, BMS gateway.)

## §5 — Per-channel metadata required at ingest

Every tag declares (in the asset registry, not per-sample):

```yaml
tag: BKS01.CDU01.PUMP01.FLOW.SUCTION
asset_id: CDU01-PUMP-01
asset_class: chiller_pump
measure: flow
unit: L/min
sample_rate_hz: 2.0
band: process
range_min: 0
range_max: 500
expected_uptime: 0.99
sensor_model: "Endress+Hauser Promass F"
calibration_due: 2026-09-15
```

The TelemetryWindow contract carries the per-window dynamic statistics
(min/max/mean/p50/p95/stale_seconds) computed at extraction time.

## §6 — Operating-state segmentation

Every TelemetryWindow MUST carry `operating_state`:

- `startup` — asset transitioning to operating envelope
- `steady` — within operating envelope, stable
- `load_change` — within envelope but during a step change
- `shutdown` — transitioning to OFF
- `fault` — outside envelope, fault state
- `unknown` — operating state can't be determined

State is computed at the ingestor from process variables (e.g.
`MOTOR.AMPS > 0 && FLOW.SUCTION > 0 && |d/dt(FLOW)| < threshold` →
`steady`). Engine refuses to mix features across operating states
during diagnosis — `steady`-trained features are not applied to
`startup` windows.

## §7 — Not in scope of this schema (yet)

- Tag-quality enumerations beyond `good`/`stale`/`missing`/
  `out_of_range`/`manual_override` (see TelemetryWindow contract).
- High-frequency vibration spectrum representation (placeholder until a
  binary-blob channel is specified).
- Image / thermal / acoustic channels — separate spec needed.
- Time-zone discipline for `start_at` / `end_at` — assumed UTC always;
  document explicitly in a v1.42.x revision.

## §8 — Consumers

- `TelemetryWindow` JSON schema (v1.41.7)
- DQ threshold matrix (`docs/contracts/dq-threshold-matrix.md`)
- Synthetic CDU-pump fixture (`docs/research/fixtures/synthetic-cdu-pump.csv`)
- Asset Registry (out-of-scope spec)
- BMS/SCADA/IoT-platform connectors (out-of-scope spec)
