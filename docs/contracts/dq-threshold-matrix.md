# Data Quality Threshold Matrix

> **Status**: Spec (v1.41.10, 2026-05-26)
> **Scope**: Per-feature DQ thresholds that gate every DiagnosticCase.
> Defines what `DataQualityResult.dq_score` 0.0-1.0 is composed of and
> when a window passes / soft-warns / fails.

## §1 — DQ verdict ladder

| `verdict` | `dq_score` band | Engine behaviour |
|---|---|---|
| `pass` | ≥ 0.85 | Case eligible for diagnosis. Model outputs surface in UI. |
| `soft_warn` | 0.60-0.85 | Case eligible. UI shows amber DQ banner; reviewer required even if model_confidence ≥ threshold. |
| `fail` | < 0.60 | Case marked `recommendation_readiness = analysis_only`. Model outputs suppressed; only raw telemetry + manual notes visible. |

Threshold values are version-pinned (`DQ_THRESHOLDS.v0.1`). Engine
release notes call out any band shift.

## §2 — Per-feature failure rules

A feature is marked **failed** if **any** rule trips:

| Rule | Condition | Affected feature `status` |
|---|---|---|
| Stale | `stale_seconds > max_stale_for_band` | `stale` |
| Missing | `actual_value == null` for > `tolerance_missing_samples` of window | `missing` |
| Out of range | `actual_value < range_min` or `> range_max` for > `tolerance_oor_samples` | `out_of_range` |
| Imputed | Connector reports the value was filled (forward-fill / linear) | `imputed` |
| Manual override | Operator set the value manually | `manual_override` |

Feature status `ok` or `manual_override` → counts as good. All others
count as bad in DQ score.

## §3 — Stale-seconds band table

| Sample-rate band | `max_stale_for_band` | Note |
|---|---|---|
| `vibration` (≥1 kHz) | 2 s | Vibration sensors die fast under bearing wear |
| `electrical_fast` (50-200 Hz) | 5 s | Power-quality must be near-real-time |
| `process` (1-10 Hz) | 30 s | Pump / flow / DP main band |
| `slow` (0.1-1 Hz) | 600 s | Battery / ambient / BMS rollup |
| `manual` | 86400 s (24 h) | Walk-down readings expire next day |

## §4 — Range tolerance

`tolerance_oor_samples` defaults to **5%** of window samples.

When `operating_state ∈ {startup, shutdown}`: tolerance is relaxed to
**15%** because transient excursions are expected. Range checks during
`fault` state are suppressed entirely; the model evaluates the fault on
shape, not envelope.

## §5 — DQ score composition

```
dq_score = w_completeness * completeness
         + w_freshness    * freshness
         + w_in_range     * in_range
         + w_self_consistency * self_consistency
```

Default weights:

```
w_completeness   = 0.30
w_freshness      = 0.25
w_in_range       = 0.25
w_self_consistency = 0.20
```

Where:

- **completeness** = 1 − fraction_of_samples_missing
- **freshness** = 1 if all features under stale_seconds threshold; falls linearly to 0 as the worst stale_seconds approaches 5× threshold
- **in_range** = 1 − fraction_of_samples_oor (after the operating-state tolerance is applied)
- **self_consistency** = 1 if cross-channel sanity checks pass (e.g.
  `FLOW > 0 ⇒ MOTOR.AMPS > 0 ± slack`); 0 if a hard contradiction; in
  between if soft inconsistency detected.

## §6 — Per-asset-class expected feature set

For each asset class, the DQ gate enumerates a `expected_features`
list. If a required feature is missing entirely (not just `missing`
status but absent from window), DQ verdict is `fail` regardless of
other metrics.

### chiller_pump (asset_class)

Required features:
- `flow_suction_mean_15s`
- `flow_suction_p95_15s`
- `dp_strainer_mean_15s`
- `dp_strainer_trend_60s`
- `motor_amps_mean_15s`
- `motor_amps_rms_60s`
- `motor_vibration_x_rms_60s` (optional but recommended)
- `motor_temp_stator_p95_300s`

Cross-check rule: `(flow > 0) AND (motor_amps == 0)` →
`self_consistency = 0` (hard fail).

### ups_double_conversion

Required features:
- `input_voltage_imbalance_pct_60s`
- `output_voltage_thd_60s`
- `battery_voltage_min_per_string`
- `battery_current_p95_per_string`
- `battery_temp_max_per_string`
- `bypass_static_state_at_t0`

### genset_diesel

Required features:
- `fuel_level_day_tank_pct_at_t0`
- `fuel_level_main_tank_pct_at_t0`
- `engine_rpm_p95_60s`
- `engine_coolant_temp_p95_60s`
- `output_voltage_imbalance_pct_60s`

## §7 — Versioning

The threshold matrix is its own versioned artifact:

```
threshold_version = "dq.v0.1.0"
```

`DataQualityResult.threshold_version` MUST reference the active matrix
version. A new matrix release requires:
1. Validation set re-evaluation.
2. Case-replay diff (does pass/fail verdict change for historical cases?
   By how much?).
3. Reviewer sign-off via KGDiff workflow (treating the matrix as KG
   metadata).

## §8 — Out of scope of v0.1

- Multi-channel correlation features (e.g. flow vs DP slope coherence).
- Drift detection of the threshold itself (`dq_drift_v0`).
- Per-tenant override of thresholds (current model is global per asset
  class; tenant overrides will be additive in v0.2).
